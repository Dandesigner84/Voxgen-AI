
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Sparkles, Loader2, PlayCircle, ArrowLeft, Heart, Smartphone } from 'lucide-react';
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

  const handleGenerateNarration = async () => {
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
                        <button onClick={handleGenerateNarration} disabled={processing.isGeneratingAudio || !text.trim()} className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex justify-center items-center gap-2">
                            {processing.isEnhancing ? "Refinando..." : processing.isGeneratingAudio ? "Gerando..." : <><Sparkles size={18}/> Gerar Fala</>}
                        </button>
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
    </div>
  );
};

const App: React.FC = () => <ErrorBoundary><AppContent /></ErrorBoundary>;
export default App;
