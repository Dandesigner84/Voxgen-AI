
import React, { useState, useRef, useEffect } from 'react';
import { Mic2, Square, Play, Save, ShieldCheck, Lock, Upload, Activity, CheckCircle, AlertCircle, Trash2, Pause, Loader2, Sparkles, Headphones } from 'lucide-react';
import { CALIBRATION_TEXT } from '../constants';
import { CustomVoice, VoiceAnalysis } from '../types';
import { analyzeVoiceQuality } from '../services/geminiService';
import { saveCustomVoice, getVoicesByUser } from '../services/voiceService';
import { decodeAudioData, masterAudioBuffer, audioBufferToWav } from '../utils/audioUtils';

interface VoiceCloningStudioProps {
  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;
  userEmail: string;
}

const VoiceCloningStudio: React.FC<VoiceCloningStudioProps> = ({ audioContext, initAudioContext, userEmail }) => {
  // State
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VoiceAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMastering, setIsMastering] = useState(false);
  const [voiceName, setVoiceName] = useState('');
  const [applicationType, setApplicationType] = useState<'private' | 'official'>('private');
  const [userVoices, setUserVoices] = useState<CustomVoice[]>([]);
  
  // List Player State
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const listAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadUserVoices();
    // Cleanup URL object when component unmounts or blob changes
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (listAudioRef.current) {
        listAudioRef.current.pause();
        listAudioRef.current = null;
      }
    };
  }, [userEmail, activeTab]);

  const loadUserVoices = () => {
    setUserVoices(getVoicesByUser(userEmail));
  };

  // --- Recording Logic ---

  const getSupportedMimeType = () => {
    const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/aac'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // Let browser choose default
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const options = { mimeType: getSupportedMimeType() };
      // Se options.mimeType for vazio, passamos undefined para o browser decidir
      const recorder = options.mimeType ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      // Visualizer Setup
      const ctx = initAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        // Detectar o tipo real usado ou fallback
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        setAudioBlob(blob);
        setAudioUrl(url);
        
        // Stop Visualizer & Stream
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      drawVisualizer();

    } catch (e: any) {
      alert("Erro ao acessar microfone: " + (e.message || "Permissão negada."));
      console.error(e);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;
      animationFrameRef.current = requestAnimationFrame(draw);
      analyserRef.current!.getByteFrequencyData(dataArray);

      if (canvasCtx) {
        canvasCtx.fillStyle = '#0f172a'; // Match bg
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i] / 2;
          canvasCtx.fillStyle = `rgb(${barHeight + 100}, 50, 200)`;
          canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      }
    };
    draw();
  };

  // --- Player Logic (List) ---

  const togglePlayVoice = (voice: CustomVoice) => {
    // Se estiver tocando a mesma voz, pausa
    if (playingVoiceId === voice.id) {
        if (listAudioRef.current) {
            listAudioRef.current.pause();
            listAudioRef.current = null;
        }
        setPlayingVoiceId(null);
        return;
    }

    // Se estiver tocando outra, para a anterior
    if (listAudioRef.current) {
        listAudioRef.current.pause();
    }

    try {
        const audio = new Audio(voice.audioSampleBase64);
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = (e) => {
            console.error("Erro ao reproduzir áudio", e);
            alert("Não foi possível reproduzir este áudio.");
            setPlayingVoiceId(null);
        };
        
        audio.play().catch(err => {
            console.error("Play failed", err);
            setPlayingVoiceId(null);
        });

        listAudioRef.current = audio;
        setPlayingVoiceId(voice.id);
    } catch (e) {
        console.error("Erro ao criar Audio", e);
    }
  };

  // --- Actions ---

  const handleAutoMaster = async () => {
      if (!audioBlob) return;
      setIsMastering(true);
      const ctx = initAudioContext();
      
      try {
          // 1. Convert Blob to Buffer
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          
          // 2. Apply Filters (Mastering)
          const masteredBuffer = await masterAudioBuffer(audioBuffer, ctx);
          
          // 3. Convert back to Blob
          const masteredBlob = audioBufferToWav(masteredBuffer);
          const masteredUrl = URL.createObjectURL(masteredBlob);
          
          setAudioBlob(masteredBlob);
          setAudioUrl(masteredUrl);
      } catch (e) {
          console.error("Mastering error", e);
          alert("Erro na masterização automática.");
      } finally {
          setIsMastering(false);
      }
  };

  const handleAnalyze = async () => {
    if (!audioBlob) return;
    setIsAnalyzing(true);

    try {
      // Converter blob para base64 com segurança
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        // Envia para o serviço (que já trata o strip do header se necessário)
        const result = await analyzeVoiceQuality(base64, CALIBRATION_TEXT);
        setAnalysis(result);
        setIsAnalyzing(false);
      };
      reader.onerror = () => {
          alert("Erro ao ler arquivo de áudio.");
          setIsAnalyzing(false);
      };
    } catch (e) {
      alert("Erro na análise.");
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!audioBlob || !voiceName || !analysis) return;

    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
      const base64 = reader.result as string;
      
      const newVoice: CustomVoice = {
        id: crypto.randomUUID(),
        userId: userEmail,
        name: voiceName,
        category: applicationType === 'official' ? 'official_candidate' : 'private',
        audioSampleBase64: base64, // Salva o DataURL completo (com prefixo data:audio/...)
        aiAnalysis: analysis,
        createdAt: Date.now()
      };

      saveCustomVoice(newVoice);
      alert(applicationType === 'official' ? "Candidatura enviada para aprovação!" : "Voz privada salva com sucesso!");
      
      // Reset
      setAudioBlob(null);
      setAudioUrl(null);
      setVoiceName('');
      setAnalysis(null);
      setActiveTab('list');
    };
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 animate-fade-in">
      <header className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center justify-center gap-2">
           <Mic2 /> Laboratório de Voz
        </h2>
        <p className="text-slate-400 text-sm mt-2">Clone sua voz para uso privado ou candidate-se a narrador oficial.</p>
      </header>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="bg-slate-800 p-1 rounded-xl flex gap-2">
            <button 
                onClick={() => setActiveTab('create')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'create' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
                Nova Gravação
            </button>
            <button 
                onClick={() => setActiveTab('list')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
                Minhas Vozes
            </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Script & Controls */}
            <div className="space-y-6">
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <Activity size={18} className="text-cyan-400" /> Passo 1: Calibração
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                        Leia o texto abaixo de forma clara e natural. A IA avaliará sua dicção e ritmo.
                    </p>
                    <div className="bg-slate-900 p-4 rounded-lg border-l-4 border-cyan-500 italic text-slate-200 text-lg leading-relaxed">
                        "{CALIBRATION_TEXT}"
                    </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex flex-col items-center">
                    <canvas ref={canvasRef} width="300" height="60" className="w-full h-16 bg-slate-900 rounded-lg mb-4 border border-slate-700"></canvas>
                    
                    <div className="flex gap-4">
                        {!isRecording ? (
                            <button 
                                onClick={startRecording}
                                className="bg-red-500 hover:bg-red-400 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg shadow-red-900/30 transition-transform hover:scale-110"
                            >
                                <Mic2 size={32} />
                            </button>
                        ) : (
                            <button 
                                onClick={stopRecording}
                                className="bg-slate-700 hover:bg-slate-600 text-white w-16 h-16 rounded-full flex items-center justify-center border-2 border-red-500 animate-pulse"
                            >
                                <Square size={24} fill="currentColor" />
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-4">
                        {isRecording ? "Gravando... (Fale claramente)" : (audioBlob ? "Áudio capturado!" : "Clique para gravar")}
                    </p>
                    
                    {/* Dica de Ambiente */}
                    <div className="mt-6 w-full bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg flex items-center gap-3">
                         <Headphones size={24} className="text-blue-400 flex-shrink-0" />
                         <div className="text-xs text-blue-200">
                             <strong>Dica Pro:</strong> Para um resultado profissional, procure um local silencioso e use um fone de ouvido com microfone ou um microfone externo.
                         </div>
                    </div>
                </div>
            </div>

            {/* Analysis & Save */}
            <div className="space-y-6">
                {audioBlob && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-white font-bold">Revisão & Masterização</h3>
                            {/* Key obriga o player a recarregar se a URL mudar */}
                            {audioUrl && <audio key={audioUrl} src={audioUrl} controls className="h-8 w-40" />}
                        </div>

                        {/* Botão de Masterização Automática */}
                        <button 
                            onClick={handleAutoMaster}
                            disabled={isMastering || isAnalyzing}
                            className="w-full mb-4 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 transition-all"
                        >
                            {isMastering ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                            {isMastering ? 'Processando...' : 'Melhorar Áudio Automaticamente (IA)'}
                        </button>

                        {!analysis ? (
                             <button 
                                onClick={handleAnalyze}
                                disabled={isAnalyzing || isMastering}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                             >
                                {isAnalyzing ? <><Loader2 className="animate-spin" /> Analisando...</> : 'Analisar Qualidade'}
                             </button>
                        ) : (
                             <div className="space-y-4">
                                 <div className="grid grid-cols-3 gap-2 text-center">
                                     <div className="bg-slate-900 p-2 rounded-lg">
                                         <div className="text-xs text-slate-400">Clareza</div>
                                         <div className={`text-xl font-bold ${analysis.clarityScore > 70 ? 'text-green-400' : 'text-yellow-400'}`}>{analysis.clarityScore}%</div>
                                     </div>
                                     <div className="bg-slate-900 p-2 rounded-lg">
                                         <div className="text-xs text-slate-400">Dicção</div>
                                         <div className={`text-xl font-bold ${analysis.dictionScore > 70 ? 'text-green-400' : 'text-yellow-400'}`}>{analysis.dictionScore}%</div>
                                     </div>
                                     <div className="bg-slate-900 p-2 rounded-lg">
                                         <div className="text-xs text-slate-400">Ritmo</div>
                                         <div className={`text-xl font-bold ${analysis.rhythmScore > 70 ? 'text-green-400' : 'text-yellow-400'}`}>{analysis.rhythmScore}%</div>
                                     </div>
                                 </div>
                                 <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 text-sm text-slate-300">
                                     <span className="text-cyan-400 font-bold">Feedback IA:</span> {analysis.feedback}
                                 </div>
                                 
                                 {/* Save Form */}
                                 <div className="pt-4 border-t border-slate-700">
                                     <input 
                                        type="text" 
                                        placeholder="Nome da Voz (ex: Minha Voz Pro)" 
                                        value={voiceName}
                                        onChange={(e) => setVoiceName(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white mb-3 outline-none focus:border-cyan-500"
                                     />
                                     
                                     <div className="flex gap-2 mb-4">
                                         <button 
                                            onClick={() => setApplicationType('private')}
                                            className={`flex-1 py-3 rounded-lg border text-xs font-bold transition-all ${applicationType === 'private' ? 'bg-slate-700 border-cyan-500 text-cyan-400' : 'border-slate-700 text-slate-500'}`}
                                         >
                                             <Lock size={14} className="inline mr-1" /> Uso Privado
                                         </button>
                                         <button 
                                            onClick={() => setApplicationType('official')}
                                            className={`flex-1 py-3 rounded-lg border text-xs font-bold transition-all ${applicationType === 'official' ? 'bg-slate-700 border-purple-500 text-purple-400' : 'border-slate-700 text-slate-500'}`}
                                         >
                                             <ShieldCheck size={14} className="inline mr-1" /> Candidatar Oficial
                                         </button>
                                     </div>

                                     <button 
                                        onClick={handleSave}
                                        disabled={!voiceName}
                                        className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                                     >
                                         <Save size={18} /> Salvar Voz
                                     </button>
                                 </div>
                             </div>
                        )}
                    </div>
                )}
                {!audioBlob && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-2xl p-8">
                        <AlertCircle size={48} className="mb-2 opacity-50" />
                        <p className="text-sm">Grave o áudio para liberar a análise.</p>
                    </div>
                )}
            </div>
        </div>
      ) : (
        // LIST TAB
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userVoices.length === 0 && (
                <div className="col-span-2 text-center py-12 text-slate-500 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
                    Nenhuma voz gravada ainda.
                </div>
            )}
            {userVoices.map(voice => (
                <div key={voice.id} className={`bg-slate-800 border transition-colors rounded-xl p-4 flex justify-between items-center ${playingVoiceId === voice.id ? 'border-cyan-500 bg-slate-800/80' : 'border-slate-700'}`}>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className={`font-bold ${playingVoiceId === voice.id ? 'text-cyan-300' : 'text-white'}`}>{voice.name}</h4>
                            {voice.category === 'private' && <span className="bg-slate-700 text-slate-300 text-[10px] px-2 py-0.5 rounded flex items-center gap-1"><Lock size={10}/> Privada</span>}
                            {voice.category === 'official_candidate' && <span className="bg-yellow-500/20 text-yellow-400 text-[10px] px-2 py-0.5 rounded flex items-center gap-1"><Activity size={10}/> Em Análise</span>}
                            {voice.category === 'official_approved' && <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle size={10}/> Aprovada</span>}
                            {voice.category === 'official_rejected' && <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded flex items-center gap-1"><AlertCircle size={10}/> Recusada</span>}
                        </div>
                        <p className="text-xs text-slate-500">
                            Score IA: {voice.aiAnalysis ? Math.round((voice.aiAnalysis.clarityScore + voice.aiAnalysis.dictionScore + voice.aiAnalysis.rhythmScore) / 3) : 0}% 
                            | {new Date(voice.createdAt).toLocaleDateString()}
                        </p>
                        {voice.category === 'official_rejected' && voice.aiAnalysis?.feedback && (
                            <p className="text-[10px] text-red-300 mt-2 bg-red-900/20 p-2 rounded">Feedback: {voice.aiAnalysis.feedback}</p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button 
                           onClick={() => togglePlayVoice(voice)}
                           className={`p-3 rounded-full transition-all ${playingVoiceId === voice.id ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'bg-slate-700 text-cyan-400 hover:bg-slate-600'}`}
                           title="Ouvir Gravação"
                        >
                            {playingVoiceId === voice.id ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        </button>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default VoiceCloningStudio;
