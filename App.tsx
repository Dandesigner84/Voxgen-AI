
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Sparkles, Loader2, PlayCircle, ArrowLeft, Heart, Smartphone, Play, Square, Volume2 } from 'lucide-react';
import VoiceControls from './components/VoiceControls';
import TextInput from './components/TextInput';
import AudioList from './components/AudioList';
import Home from './components/Home';
import MusicStudio from './components/MusicStudio';
import AvatarStudio from './components/AvatarStudio';
import SFXStudio from './components/SFXStudio';
import SmartPlayer from './components/SmartPlayer';
import ErrorBoundary from './components/ErrorBoundary';
import { AudioItem, ProcessingState, ToneType, VoiceName, AppMode } from './types';
import { DEFAULT_TEXT } from './constants';
import { refineText, generateSpeech } from './services/geminiService';
import { decodeAudioData, addBackgroundMusic } from './utils/audioUtils';

const AppContent: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.Home);
  const [text, setText] = useState(DEFAULT_TEXT);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Kore);
  const [selectedTone, setSelectedTone] = useState<ToneType>(ToneType.Neutral);
  const [useMusic, setUseMusic] = useState(false);
  const [history, setHistory] = useState<AudioItem[]>([]);
  const [processing, setProcessing] = useState<ProcessingState>({
    isEnhancing: false, isGeneratingAudio: false, error: null,
  });
  
  // Preview State
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
    }
  };

  const initAudioContext = (): AudioContext => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume();
    return audioContextRef.current;
  };

  const stopPreview = () => {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      previewSourceRef.current = null;
    }
    setIsPlayingPreview(false);
  };

  const handlePreviewNarration = async () => {
    // If currently playing preview, stop it
    if (isPlayingPreview) {
      stopPreview();
      return;
    }

    if (!text.trim()) return;

    const ctx = initAudioContext();
    
    if (!process.env.API_KEY) {
        alert("ERRO: Chave API não encontrada.");
        return;
    }

    setIsPlayingPreview(true);

    try {
      // 1. Create Snippet (Max 150 chars)
      let previewText = text.length > 150 ? text.slice(0, 150) + "..." : text;

      // 2. Refine snippet if tone is selected (to hear the style)
      if (selectedTone !== ToneType.Neutral) {
         // Quick refinement for preview
         previewText = await refineText(previewText, selectedTone, false);
      }

      // 3. Generate Audio
      const base64Data = await generateSpeech(previewText, selectedVoice);
      const buffer = await decodeAudioData(base64Data, ctx);

      // 4. Play directly
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      source.onended = () => {
        setIsPlayingPreview(false);
        previewSourceRef.current = null;
      };

      source.start(0);
      previewSourceRef.current = source;

    } catch (err: any) {
      console.error("Preview Error:", err);
      alert("Erro no preview: " + (err.message || "Tente novamente"));
      setIsPlayingPreview(false);
    }
  };

  const handleGenerateNarration = async () => {
    // Stop any running preview
    stopPreview();

    const ctx = initAudioContext();
    
    if (!process.env.API_KEY) {
        const msg = "ERRO: Chave API não encontrada. Configure no .env ou Vercel e REINICIE o servidor.";
        setProcessing(prev => ({ ...prev, error: msg }));
        alert(msg);
        return;
    }

    setProcessing({ isEnhancing: false, isGeneratingAudio: false, error: null });

    try {
      let finalText = text;

      // Passo 1: Refinar Texto (Opcional)
      if (selectedTone !== ToneType.Neutral || useMusic || text.match(/[\[<]/)) {
        setProcessing(prev => ({ ...prev, isEnhancing: true }));
        finalText = await refineText(text, selectedTone, useMusic);
        setText(finalText);
      }

      // Passo 2: Gerar Áudio
      setProcessing({ isEnhancing: false, isGeneratingAudio: true, error: null });
      const base64Data = await generateSpeech(finalText, selectedVoice);

      // Passo 3: Decodificar e Mixar
      if (ctx) {
        const speechBuffer = await decodeAudioData(base64Data, ctx);
        let finalBuffer = speechBuffer;
        if (useMusic) {
          finalBuffer = await addBackgroundMusic(speechBuffer, selectedTone, ctx);
        }

        const newItem: AudioItem = {
          id: crypto.randomUUID(),
          text: finalText,
          voice: selectedVoice,
          audioData: finalBuffer,
          createdAt: new Date(),
          duration: finalBuffer.duration
        };
        setHistory(prev => [newItem, ...prev]);
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Erro desconhecido ao gerar áudio.";
      setProcessing(prev => ({ ...prev, error: msg }));
      alert("FALHA NA GERAÇÃO: " + msg);
    } finally {
      // NÃO limpe o erro aqui, senão o usuário não vê
      setProcessing(prev => ({ ...prev, isEnhancing: false, isGeneratingAudio: false }));
    }
  };

  // Render helpers omitted for brevity, structure remains same as original
  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] text-slate-200 font-sans">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-lg sticky top-0 z-50 p-4 border-b border-slate-800 flex justify-between items-center">
          <div onClick={() => setMode(AppMode.Home)} className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center"><Mic size={20}/></div>
              <h1 className="font-bold text-lg">VoxGen AI</h1>
          </div>
          <div className="flex gap-2">
            {isInstallable && <button onClick={handleInstallClick} className="bg-slate-800 px-3 py-1 rounded-full text-xs flex items-center gap-2"><Smartphone size={14}/> Instalar</button>}
            {mode !== AppMode.Home && <button onClick={() => setMode(AppMode.Home)} className="text-slate-400 text-sm flex items-center"><ArrowLeft size={16}/> Voltar</button>}
          </div>
      </header>
      
      <main className="flex-grow py-8">
         {mode === AppMode.Home && <Home onSelectMode={setMode} />}
         {mode === AppMode.Narration && (
            <div className="max-w-6xl mx-auto px-4">
                {processing.error && (
                    <div className="bg-red-900/20 border border-red-500 text-red-200 p-4 rounded-xl mb-4 text-sm">
                        {processing.error}
                    </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-7 space-y-6">
                        <VoiceControls selectedVoice={selectedVoice} onVoiceChange={setSelectedVoice} selectedTone={selectedTone} onToneChange={setSelectedTone} useMusic={useMusic} onMusicChange={setUseMusic} />
                        <div className="min-h-[200px]"><TextInput value={text} onChange={setText} disabled={processing.isGeneratingAudio} /></div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-4">
                            <button 
                              onClick={handlePreviewNarration} 
                              disabled={processing.isGeneratingAudio || !text.trim()} 
                              className={`flex-1 py-4 rounded-xl font-bold flex justify-center items-center gap-2 border transition-all ${
                                isPlayingPreview 
                                  ? 'bg-red-500/20 border-red-500 text-red-200 hover:bg-red-500/30' 
                                  : 'bg-slate-800 border-slate-700 text-indigo-300 hover:bg-slate-700 hover:border-indigo-500/50'
                              }`}
                            >
                                {isPlayingPreview 
                                  ? <><Square size={18} fill="currentColor" /> Parar Preview</> 
                                  : <><Play size={18} /> Ouvir Trecho</>
                                }
                            </button>

                            <button 
                              onClick={handleGenerateNarration} 
                              disabled={processing.isGeneratingAudio || !text.trim() || isPlayingPreview} 
                              className="flex-[2] py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex justify-center items-center gap-2 shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {processing.isEnhancing ? "Refinando..." : processing.isGeneratingAudio ? "Gerando..." : <><Sparkles size={18}/> Gerar Fala Completa</>}
                            </button>
                        </div>
                    </div>
                    <div className="lg:col-span-5">
                        <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800 h-[500px] overflow-y-auto">
                            <AudioList items={history} audioContext={audioContextRef.current} />
                        </div>
                    </div>
                </div>
            </div>
         )}
         {mode === AppMode.Music && <MusicStudio audioContext={audioContextRef.current} initAudioContext={initAudioContext} />}
         {mode === AppMode.Avatar && <AvatarStudio audioContext={audioContextRef.current} initAudioContext={initAudioContext} />}
         {mode === AppMode.SFX && <SFXStudio audioContext={audioContextRef.current} initAudioContext={initAudioContext} />}
         {mode === AppMode.SmartPlayer && <SmartPlayer audioContext={audioContextRef.current} initAudioContext={initAudioContext} narrationHistory={history} />}
      </main>
      
      <footer className="p-6 text-center text-slate-500 text-xs border-t border-slate-900/50 bg-[#0f172a] mt-auto">
         <p>Desenvolvido com ❤️ por <span className="text-indigo-400 font-bold">Daniel de Oliveira</span></p>
         <p className="opacity-50 mt-1">Powered by Google Gemini 2.5 & Web Audio API</p>
      </footer>
    </div>
  );
};

const App: React.FC = () => <ErrorBoundary><AppContent /></ErrorBoundary>;
export default App;
