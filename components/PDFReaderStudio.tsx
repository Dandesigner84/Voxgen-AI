
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Book, Upload, Play, Pause, SkipForward, SkipBack, Volume2, Music, Mic2, Loader2, FileText, X, Settings2, Headphones, Wand2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { VOICE_OPTIONS, TONE_OPTIONS } from '../constants';
import { generateSpeech, refineText } from '../services/geminiService';
import { decodeAudioData, masterAudioBuffer } from '../utils/audioUtils';
import { ToneType } from '../types';

// Configuração do Worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;

interface PDFReaderStudioProps {
  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;
}

const PDFReaderStudio: React.FC<PDFReaderStudioProps> = ({ audioContext, initAudioContext }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState<string>('');
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0].value);
  const [selectedTone, setSelectedTone] = useState<string>(ToneType.Neutral);
  const [useHumanization, setUseHumanization] = useState(true);
  const [currentRefinedText, setCurrentRefinedText] = useState<string>('');
  const [bgMusicUrl, setBgMusicUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferingProgress, setBufferingProgress] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [duckingIntensity, setDuckingIntensity] = useState(0.2);
  const [isCarSoundMode, setIsCarSoundMode] = useState(false);

  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgMusicRef = useRef<HTMLIFrameElement>(null);

  // Carregar progresso salvo
  useEffect(() => {
    if (pdfFile) {
      const savedPage = localStorage.getItem(`voxgen_pdf_progress_${pdfFile.name}`);
      if (savedPage) {
        setCurrentPage(parseInt(savedPage, 10));
      }
    }
  }, [pdfFile]);

  // Salvar progresso
  useEffect(() => {
    if (pdfFile && pages.length > 0) {
      localStorage.setItem(`voxgen_pdf_progress_${pdfFile.name}`, currentPage.toString());
    }
  }, [currentPage, pdfFile, pages.length]);

  const extractText = async (file: File) => {
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      console.log(`[PDF Reader] PDF carregado: ${pdf.numPages} páginas.`);
      const extractedPages: string[] = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Melhorar a extração: agrupar itens por linha para manter o fluxo
        let lastY = -1;
        let pageText = "";
        
        for (const item of textContent.items as any[]) {
          if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
            pageText += "\n";
          }
          pageText += item.str + " ";
          lastY = item.transform[5];
        }

        if (pageText.trim()) {
          extractedPages.push(pageText.trim());
        }
      }
      
      console.log(`[PDF Reader] Texto extraído de ${extractedPages.length} páginas.`);
      if (extractedPages.length === 0) {
        throw new Error("Não foi possível extrair texto deste PDF. O arquivo pode ser composto apenas por imagens.");
      }
      setPages(extractedPages);
      setPdfText(extractedPages.join('\n\n'));
    } catch (error: any) {
      console.error("Erro ao extrair PDF:", error);
      alert(`Não foi possível ler este PDF. Erro: ${error.message || "Verifique se o arquivo não está protegido."}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      extractText(file);
    } else if (file) {
      alert("Por favor, selecione um arquivo PDF.");
    }
  };

  const stopNarration = useCallback(() => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) {}
      audioSourceRef.current = null;
    }
    setIsNarrating(false);
  }, []);

  const playCurrentPage = async () => {
    if (pages.length === 0 || isNarrating || !isPlaying || isBuffering) {
      console.log("[PDF Reader] playCurrentPage ignorado:", { 
        hasPages: pages.length > 0, 
        isNarrating, 
        isPlaying, 
        isBuffering 
      });
      return;
    }
    
    console.log(`[PDF Reader] Tentando narrar página ${currentPage + 1}...`);
    const ctx = initAudioContext();
    
    try {
      if (ctx.state === 'suspended') {
        console.log("[PDF Reader] AudioContext suspenso, retomando...");
        await ctx.resume();
      }
      console.log(`[PDF Reader] AudioContext pronto (Estado: ${ctx.state})`);

      const text = pages[currentPage];
      if (!text || text.trim().length === 0) {
        console.warn("[PDF Reader] Página vazia detectada.");
        setIsPlaying(false);
        setIsNarrating(false);
        return;
      }

      setIsNarrating(true);
      
      let textToNarrate = text;
      
      if (useHumanization) {
        console.log(`[PDF Reader] Refinando texto da página ${currentPage + 1} com tom ${selectedTone}...`);
        textToNarrate = await refineText(text, selectedTone, !!bgMusicUrl);
        setCurrentRefinedText(textToNarrate);
      } else {
        setCurrentRefinedText('');
      }

      console.log(`[PDF Reader] Solicitando TTS para a voz: ${selectedVoice}...`);
      const base64 = await generateSpeech(textToNarrate.slice(0, 3500), selectedVoice);
      
      if (!base64) {
        throw new Error("O serviço de voz não retornou dados de áudio.");
      }

      console.log(`[PDF Reader] Áudio recebido (${Math.round(base64.length / 1024)} KB). Decodificando...`);
      const buffer = await decodeAudioData(base64, ctx);
      console.log(`[PDF Reader] Áudio decodificado. Duração: ${buffer.duration.toFixed(2)}s`);
      
      if (buffer.duration === 0) {
        throw new Error("Áudio decodificado tem duração zero.");
      }

      // Aplicar Masterização para Carro de Som se ativado
      const masteredBuffer = await masterAudioBuffer(buffer, ctx, isCarSoundMode);

      const source = ctx.createBufferSource();
      source.buffer = masteredBuffer;
      source.connect(ctx.destination);
      
      source.onended = () => {
        console.log(`[PDF Reader] Narração da página ${currentPage + 1} concluída.`);
        setIsNarrating(false);
        if (isPlaying) {
          if (currentPage < pages.length - 1) {
            console.log("[PDF Reader] Avançando para próxima página...");
            setCurrentPage(prev => prev + 1);
          } else {
            console.log("[PDF Reader] Fim do documento atingido.");
            setIsPlaying(false);
            alert("Você chegou ao fim do livro!");
          }
        }
      };
      
      audioSourceRef.current = source;
      source.start(0);
      console.log("[PDF Reader] Reprodução iniciada com sucesso.");
    } catch (error: any) {
      console.error("[PDF Reader] Falha crítica na narração:", error);
      setIsNarrating(false);
      setIsPlaying(false);
      alert(`Erro na narração: ${error.message || "Verifique sua conexão ou chave de API."}`);
    }
  };

  useEffect(() => {
    if (isPlaying && !isNarrating && !isBuffering) {
      console.log("[PDF Reader] useEffect: Condições atendidas para playCurrentPage.");
      playCurrentPage();
    } else {
      console.log("[PDF Reader] useEffect: Condições NÃO atendidas.", { isPlaying, isNarrating, isBuffering });
    }
  }, [isPlaying, isNarrating, currentPage, isBuffering]);

  const handleTogglePlay = () => {
    // Inicializar o contexto de áudio IMEDIATAMENTE no gesto do usuário
    const ctx = initAudioContext();
    console.log("[PDF Reader] handleTogglePlay acionado. Estado do contexto:", ctx.state);
    
    if (isPlaying) {
      setIsPlaying(false);
      setIsBuffering(false);
      stopNarration();
    } else {
      if (pages.length > 0) {
        console.log("[PDF Reader] Iniciando buffering...");
        // Iniciar processo de buffering (30%)
        setIsBuffering(true);
        setBufferingProgress(0);
        
        const interval = setInterval(() => {
          setBufferingProgress(prev => {
            if (prev >= 30) {
              clearInterval(interval);
              setIsBuffering(false);
              // Garantir que o contexto esteja ativo antes de mudar isPlaying
              ctx.resume().then(() => {
                setIsPlaying(true);
                console.log("[PDF Reader] Buffering concluído. Iniciando leitura...");
              });
              return 30;
            }
            return prev + 2;
          });
        }, 100);
      } else {
        alert("Carregue um PDF primeiro.");
      }
    }
  };

  const getYoutubeId = (url: string) => {
    const ytRegExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/|live\/)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(ytRegExp);
    return match ? match[1] : null;
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    const ytId = getYoutubeId(url);
    if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=0&controls=0&showinfo=0&rel=0`;
    
    const spotifyRegExp = /open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/;
    const spotMatch = url.match(spotifyRegExp);
    if (spotMatch) return `https://open.spotify.com/embed/${spotMatch[1]}/${spotMatch[2]}?utm_source=generator&theme=0&autoplay=1`;
    
    return '';
  };

  const ytId = bgMusicUrl ? getYoutubeId(bgMusicUrl) : null;

  return (
    <div className="max-w-6xl mx-auto w-full px-4 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-orange-500 rounded-2xl shadow-lg shadow-orange-500/20">
            <Book className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">PDF Reader Studio</h1>
            <p className="text-slate-400 font-medium">Leitura automatizada com trilha sonora</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Lado Esquerdo: Leitor e Texto */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl min-h-[500px] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
               <div 
                  className="bg-orange-500 h-full transition-all duration-500" 
                  style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
                ></div>
            </div>

            {!pdfFile ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="flex-grow border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group"
              >
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload size={32} className="text-slate-400 group-hover:text-orange-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Carregar Livro (PDF)</h3>
                <p className="text-slate-500 text-sm">Clique ou arraste seu arquivo aqui</p>
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <FileText className="text-orange-400" size={20} />
                    <span className="text-white font-bold truncate max-w-[200px]">{pdfFile.name}</span>
                    <span className="text-slate-500 text-xs bg-slate-800 px-2 py-1 rounded">Página {currentPage + 1} de {pages.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { if(confirm("Deseja resetar o progresso de leitura?")) setCurrentPage(0); }}
                      className="text-slate-500 hover:text-orange-400 transition-colors p-2"
                      title="Resetar Progresso"
                    >
                      <Settings2 size={18} />
                    </button>
                    <button onClick={() => { setPdfFile(null); setPages([]); stopNarration(); setIsPlaying(false); setIsBuffering(false); }} className="text-slate-500 hover:text-white transition-colors p-2">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex-grow bg-slate-950/50 rounded-2xl p-8 border border-slate-800 overflow-y-auto custom-scrollbar mb-6 relative">
                  {isProcessing ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4">
                      <Loader2 size={40} className="text-orange-500 animate-spin" />
                      <p className="text-slate-400 animate-pulse">Extraindo texto do PDF...</p>
                    </div>
                  ) : (
                    <div className="relative">
                      {(isNarrating || isBuffering) && (
                        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-orange-500 rounded-full animate-pulse"></div>
                      )}
                      
                      <div className="absolute top-2 right-2 flex items-center gap-2">
                        {isBuffering && <span className="text-[10px] text-orange-400 animate-pulse uppercase font-bold">Buffering...</span>}
                        {isNarrating && !isBuffering && <span className="text-[10px] text-orange-400 animate-pulse uppercase font-bold">Narrando...</span>}
                      </div>

                      {useHumanization && currentRefinedText && (isNarrating || isBuffering) ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                          <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-2">
                            <Wand2 size={12} /> Texto Humanizado (IA)
                          </div>
                          <p className="text-white leading-relaxed whitespace-pre-wrap text-2xl font-medium font-sans">
                            {currentRefinedText}
                          </p>
                          <div className="mt-8 pt-8 border-t border-slate-800/50">
                            <p className="text-slate-500 text-[10px] italic opacity-50 uppercase font-bold tracking-widest mb-2">Texto Original do PDF:</p>
                            <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 italic font-serif">
                              {pages[currentPage]}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className={`text-slate-300 leading-relaxed whitespace-pre-wrap text-xl italic font-serif transition-opacity duration-500 ${isBuffering ? 'opacity-30' : 'opacity-100'}`}>
                          {pages[currentPage]}
                        </p>
                      )}
                      
                      {isBuffering && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-sm rounded-xl">
                           <Loader2 size={48} className="text-orange-500 animate-spin mb-4" />
                           <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="bg-orange-500 h-full transition-all duration-300" 
                                style={{ width: `${(bufferingProgress / 30) * 100}%` }}
                              ></div>
                           </div>
                           <p className="text-white font-bold mt-4 animate-pulse uppercase tracking-widest text-xs">Preparando Experiência (30%)</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Controles de Reprodução */}
                <div className="flex flex-col items-center gap-6">
                  <div className="flex items-center gap-8">
                    <button 
                      onClick={() => { stopNarration(); setCurrentPage(prev => Math.max(0, prev - 1)); }}
                      disabled={currentPage === 0 || isBuffering}
                      className="p-3 text-slate-400 hover:text-white disabled:opacity-20 transition-all"
                    >
                      <SkipBack size={28} />
                    </button>
                    
                    <button 
                      onClick={handleTogglePlay}
                      disabled={isBuffering}
                      className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transform hover:scale-105 active:scale-95 transition-all ${
                        isPlaying 
                        ? 'bg-slate-800 text-white border border-slate-700' 
                        : 'bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-orange-500/20'
                      }`}
                    >
                      {isBuffering ? (
                        <Loader2 size={40} className="animate-spin" />
                      ) : isPlaying ? (
                        <Pause size={40} fill="currentColor" />
                      ) : (
                        <Play size={40} fill="currentColor" className="ml-2" />
                      )}
                    </button>

                    <button 
                      onClick={() => { stopNarration(); setCurrentPage(prev => Math.min(pages.length - 1, prev + 1)); }}
                      disabled={currentPage === pages.length - 1 || isBuffering}
                      className="p-3 text-slate-400 hover:text-white disabled:opacity-20 transition-all"
                    >
                      <SkipForward size={28} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lado Direito: Configurações */}
        <div className="lg:col-span-4 space-y-6">
          {/* Voz do Leitor */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <Mic2 className="text-orange-400" size={20} />
              <h3 className="text-white font-bold uppercase tracking-wider text-sm">Voz do Narrador</h3>
            </div>
            
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {VOICE_OPTIONS.map((voice) => (
                <button
                  key={voice.value}
                  onClick={() => { setSelectedVoice(voice.value); if(isPlaying) { stopNarration(); playCurrentPage(); } }}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
                    selectedVoice === voice.value 
                    ? 'bg-orange-500/10 border-orange-500 text-white' 
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-bold text-xs">{voice.label.split('(')[0]}</span>
                    <span className="text-[9px] opacity-60">{voice.gender} {voice.style ? `• ${voice.style}` : ''}</span>
                  </div>
                  {selectedVoice === voice.value && <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping"></div>}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-3 mb-4">
                <Wand2 className="text-emerald-400" size={18} />
                <h3 className="text-white font-bold uppercase tracking-wider text-[10px]">Tom da Leitura</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TONE_OPTIONS.slice(0, 6).map((tone) => (
                  <button
                    key={tone.value}
                    onClick={() => { setSelectedTone(tone.value); if(isPlaying) { stopNarration(); playCurrentPage(); } }}
                    className={`p-2 rounded-lg border text-[10px] font-medium transition-all ${
                      selectedTone === tone.value 
                      ? 'bg-emerald-500/20 border-emerald-500 text-white' 
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {tone.label.split(' (')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Trilha Sonora de Fundo */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <Settings2 className="text-indigo-400" size={20} />
              <h3 className="text-white font-bold uppercase tracking-wider text-sm">Ajustes de Áudio</h3>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200">Humanização Inteligente</span>
                  <span className="text-[10px] text-slate-400">Limpa o texto e remove lixo do PDF</span>
                </div>
                <button 
                  onClick={() => setUseHumanization(!useHumanization)}
                  className={`w-12 h-6 rounded-full relative transition-all duration-300 ${useHumanization ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${useHumanization ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200">Modo Carro de Som</span>
                  <span className="text-[10px] text-slate-400">Otimizar para alto-falantes externos</span>
                </div>
                <button 
                  onClick={() => setIsCarSoundMode(!isCarSoundMode)}
                  className={`w-12 h-6 rounded-full relative transition-all duration-300 ${isCarSoundMode ? 'bg-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${isCarSoundMode ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-3 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                <div className="flex justify-between text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                  <span>Ducking (Volume da Música)</span>
                  <span className="text-indigo-400">{Math.round((1 - duckingIntensity) * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={1 - duckingIntensity} 
                  onChange={(e) => setDuckingIntensity(1 - parseFloat(e.target.value))} 
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                />
                <p className="text-[9px] text-slate-500 text-center italic">Abaixa a música automaticamente durante a fala</p>
              </div>
            </div>
          </div>

          {/* Trilha Sonora de Fundo */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <Music className="text-orange-400" size={20} />
              <h3 className="text-white font-bold uppercase tracking-wider text-sm">Trilha de Fundo</h3>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <Music className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text" 
                  value={bgMusicUrl}
                  onChange={(e) => setBgMusicUrl(e.target.value)}
                  placeholder="Link YouTube ou Spotify"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-sm text-white focus:border-orange-500 outline-none transition-all"
                />
              </div>

              {bgMusicUrl && (
                <div className="relative rounded-xl overflow-hidden border border-slate-800 aspect-video bg-black shadow-lg group">
                  {ytId ? (
                    <img 
                      src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`} 
                      alt="Capa da Playlist" 
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-900">
                      <Music size={48} className="text-slate-700 animate-pulse" />
                    </div>
                  )}
                  
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`p-3 rounded-full bg-orange-500/20 border border-orange-500/50 text-orange-400 ${isPlaying ? 'animate-pulse' : ''}`}>
                      <Music size={24} />
                    </div>
                  </div>

                  {/* Player Oculto - Só carrega quando isPlaying é true */}
                  {isPlaying && getEmbedUrl(bgMusicUrl) && (
                    <div className="absolute inset-0 pointer-events-none opacity-0">
                      <iframe 
                        ref={bgMusicRef}
                        src={getEmbedUrl(bgMusicUrl)}
                        width="100%" 
                        height="100%" 
                        frameBorder="0" 
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                        loading="lazy"
                      ></iframe>
                    </div>
                  )}
                </div>
              )}
              
              {!bgMusicUrl && (
                <div className="p-4 bg-slate-950/50 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-center">
                   <Music size={24} className="text-slate-700 mb-2" />
                   <p className="text-[10px] text-slate-600">Nenhuma trilha configurada</p>
                </div>
              )}
            </div>
          </div>

          {/* Status de Leitura */}
          <div className="bg-gradient-to-br from-orange-500/20 to-transparent border border-orange-500/20 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <Headphones size={16} className="text-orange-400" />
              <h4 className="text-orange-400 font-bold text-xs uppercase">Modo Automático</h4>
            </div>
            <p className="text-slate-400 text-[10px] leading-relaxed">
              O VoxGen passará as páginas automaticamente assim que a narração terminar. Seu progresso é salvo localmente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFReaderStudio;
