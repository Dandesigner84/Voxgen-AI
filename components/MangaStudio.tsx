import React, { useState, useRef } from 'react';
import { BookOpen, Image as ImageIcon, Mic2, Play, Pause, ChevronRight, ChevronLeft, Plus, Sparkles, Download, Upload, Lock, Info } from 'lucide-react';
import { ComicPage, ComicStyle, VoiceName } from '../types';
import { generateImage, generateSpeech } from '../services/geminiService';
import { decodeAudioData } from '../utils/audioUtils';
import { getUserStatus } from '../services/monetizationService';

interface MangaStudioProps {
  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;
}

const STYLES: ComicStyle[] = ['Manga', 'American Comic', 'Pixar 3D', 'Anime', 'Sketch'];

const MangaStudio: React.FC<MangaStudioProps> = ({ audioContext, initAudioContext }) => {
  const [pages, setPages] = useState<ComicPage[]>([]);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Inputs
  const [sceneText, setSceneText] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<ComicStyle>('Manga');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [includeNarration, setIncludeNarration] = useState(false);
  
  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const userStatus = getUserStatus();
  const isPremium = userStatus.plan === 'premium';
  const MAX_FREE_PAGES = 4;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setReferenceImage(ev.target.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleGeneratePage = async () => {
    if (!sceneText.trim()) return;
    if (!isPremium && pages.length >= MAX_FREE_PAGES) {
        alert(`Usuários Free estão limitados a ${MAX_FREE_PAGES} páginas. Ative o Premium para criar histórias ilimitadas.`);
        return;
    }

    setIsGenerating(true);
    const ctx = initAudioContext();

    try {
      // 1. Generate Image
      const imgBase64 = await generateImage(sceneText, selectedStyle, referenceImage || undefined);
      
      // 2. Generate Audio (Optional)
      let audioBuffer: AudioBuffer | undefined;
      if (includeNarration) {
         const audioBase64 = await generateSpeech(sceneText, VoiceName.Kore); // Default voice for now
         audioBuffer = await decodeAudioData(audioBase64, ctx);
      }

      const newPage: ComicPage = {
        id: crypto.randomUUID(),
        imageUrl: imgBase64,
        text: sceneText,
        audioData: audioBuffer,
        panelNumber: pages.length + 1
      };

      setPages(prev => [...prev, newPage]);
      setCurrentPageIdx(pages.length); // Go to new page
      setSceneText(''); // Clear input

    } catch (e: any) {
      alert("Erro ao gerar página: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const playNarration = async (page: ComicPage) => {
    if (!page.audioData) return;
    const ctx = initAudioContext();
    
    if (activeSourceRef.current) {
        activeSourceRef.current.stop();
    }

    if (ctx.state === 'suspended') await ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = page.audioData;
    source.connect(ctx.destination);
    source.onended = () => setIsPlaying(false);
    
    source.start(0);
    activeSourceRef.current = source;
    setIsPlaying(true);
  };

  const stopAudio = () => {
      if (activeSourceRef.current) {
          activeSourceRef.current.stop();
          setIsPlaying(false);
      }
  };

  const handleExportPDF = () => {
      alert("Função de exportar PDF em breve! (Premium Feature)");
  };

  return (
    <div className="w-full h-full flex flex-col lg:flex-row bg-[#0f172a] text-white animate-fade-in min-h-[85vh]">
      
      {/* --- LEFT SIDEBAR (Creation) --- */}
      <div className="w-full lg:w-[400px] flex-shrink-0 border-r border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-6 overflow-y-auto">
        <div className="flex items-center gap-2 mb-2">
            <BookOpen className="text-indigo-400" size={24} />
            <h2 className="text-xl font-bold">Manga Studio</h2>
        </div>

        {/* Character Ref */}
        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase">Personagem (Opcional)</label>
            <div className="flex items-center gap-4">
                <label className="w-20 h-20 border border-dashed border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-800 overflow-hidden transition-colors relative group">
                    {referenceImage ? (
                        <>
                            <img src={referenceImage} className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload size={16} className="text-white" />
                            </div>
                        </>
                    ) : (
                        <Upload size={20} className="text-slate-500" />
                    )}
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
                <div className="text-xs text-slate-500 flex-1 leading-relaxed">
                    Faça upload do rosto do seu personagem para manter a consistência visual em todos os quadros.
                </div>
            </div>
        </div>

        {/* Style Selector */}
        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase">Estilo Visual</label>
            <div className="grid grid-cols-3 gap-2">
                {STYLES.map(style => (
                    <button 
                        key={style}
                        onClick={() => setSelectedStyle(style)}
                        className={`text-[10px] py-2 rounded border transition-all ${selectedStyle === style ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                    >
                        {style}
                    </button>
                ))}
            </div>
        </div>

        {/* Scene Input */}
        <div className="space-y-2 flex-grow">
            <label className="text-xs font-bold text-slate-400 uppercase">Descreva a Cena (Página {pages.length + 1})</label>
            <textarea 
                value={sceneText}
                onChange={(e) => setSceneText(e.target.value)}
                placeholder="Ex: O herói encontra a espada lendária. [expressão de surpresa] [segurando a espada] <zoom no rosto> <iluminação dourada>"
                className="w-full h-40 bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:border-indigo-500 outline-none resize-none placeholder-slate-600"
            />
            
            {/* Syntax Help */}
            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-3 text-[10px] text-indigo-300 space-y-1">
                <div className="flex items-center gap-1 font-bold"><Info size={10}/> Comandos de Direção:</div>
                <div className="pl-3">
                    <p><code>[...]</code> : Ação/Emoção (ex: [chorando], [correndo])</p>
                    <p><code>&lt;...&gt;</code> : Câmera/Luz (ex: &lt;plano detalhe&gt;, &lt;noite&gt;)</p>
                </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
                <button 
                    onClick={() => setIncludeNarration(!includeNarration)}
                    className={`flex items-center gap-2 px-3 py-2 w-full justify-center rounded-lg text-xs font-medium border transition-colors ${includeNarration ? 'bg-pink-900/30 border-pink-500 text-pink-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                >
                    <Mic2 size={14} />
                    {includeNarration ? 'Narração Ativada' : 'Adicionar Narração'}
                </button>
            </div>
        </div>

        <div className="mt-auto">
            <div className="flex justify-between items-center mb-2 text-xs text-slate-500">
                <span>Páginas: {pages.length} / {isPremium ? '∞' : MAX_FREE_PAGES}</span>
                {!isPremium && <span className="text-yellow-500 flex items-center gap-1"><Lock size={10}/> Premium Ilimitado</span>}
            </div>
            <button 
                onClick={handleGeneratePage}
                disabled={isGenerating || !sceneText.trim()}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-900/20 transition-all transform active:scale-95"
            >
                {isGenerating ? <Sparkles className="animate-spin" size={18} /> : <Plus size={18} />}
                {isGenerating ? 'Criando Arte...' : 'Gerar Página'}
            </button>
        </div>
      </div>

      {/* --- RIGHT SIDE (Viewer) --- */}
      <div className="flex-1 bg-slate-950 p-4 lg:p-8 flex flex-col items-center justify-center relative overflow-hidden">
          {pages.length === 0 ? (
              <div className="text-center text-slate-600 border-2 border-dashed border-slate-800 rounded-2xl p-12 max-w-md animate-fade-in">
                  <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-bold text-slate-500 mb-2">Sua história começa aqui</h3>
                  <p className="text-sm mb-6">
                      Configure o estilo e descreva a primeira cena para gerar seu Gibi ou Mangá.
                  </p>
                  <div className="text-xs bg-slate-900 p-3 rounded text-slate-500 text-left space-y-1">
                      <p className="font-bold">Dica Pro:</p>
                      <p>Use uma foto de referência para manter o mesmo personagem em todas as páginas.</p>
                  </div>
              </div>
          ) : (
              <div className="w-full max-w-3xl h-full flex flex-col">
                  {/* Main Page Display */}
                  <div className="flex-grow relative bg-black rounded-xl shadow-2xl overflow-hidden border border-slate-800 group">
                      <img 
                        src={pages[currentPageIdx].imageUrl} 
                        alt={`Page ${currentPageIdx + 1}`}
                        className="w-full h-full object-contain"
                      />
                      
                      {/* Caption Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-6 border-t border-white/10 transform transition-transform duration-300">
                          <p className="text-white text-lg font-medium font-serif leading-relaxed line-clamp-3">
                              {pages[currentPageIdx].text}
                          </p>
                          {pages[currentPageIdx].audioData && (
                              <button 
                                onClick={() => isPlaying ? stopAudio() : playNarration(pages[currentPageIdx])}
                                className="absolute top-[-24px] right-6 bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-110 flex items-center justify-center"
                              >
                                  {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" className="ml-1"/>}
                              </button>
                          )}
                      </div>
                  </div>

                  {/* Controls */}
                  <div className="flex justify-between items-center mt-6 px-4">
                      <button 
                        onClick={() => setCurrentPageIdx(Math.max(0, currentPageIdx - 1))}
                        disabled={currentPageIdx === 0}
                        className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors"
                      >
                          <ChevronLeft size={24} />
                      </button>
                      
                      <div className="flex gap-2 overflow-x-auto max-w-[300px] custom-scrollbar pb-2 px-2">
                          {pages.map((p, idx) => (
                              <button 
                                key={p.id}
                                onClick={() => setCurrentPageIdx(idx)}
                                className={`w-12 h-16 flex-shrink-0 rounded border transition-all ${idx === currentPageIdx ? 'border-indigo-500 ring-2 ring-indigo-500/30 scale-110 z-10' : 'border-slate-700 opacity-50 hover:opacity-100'} overflow-hidden bg-slate-900`}
                              >
                                  <img src={p.imageUrl} className="w-full h-full object-cover" />
                              </button>
                          ))}
                      </div>

                      <div className="flex gap-3">
                        <button 
                            onClick={handleExportPDF}
                            className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            title="Exportar"
                        >
                            <Download size={24} />
                        </button>
                        <button 
                            onClick={() => setCurrentPageIdx(Math.min(pages.length - 1, currentPageIdx + 1))}
                            disabled={currentPageIdx === pages.length - 1}
                            className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors"
                        >
                            <ChevronRight size={24} />
                        </button>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default MangaStudio;