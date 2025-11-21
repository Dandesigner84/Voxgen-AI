
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Sparkles, Loader2, PlayCircle, ArrowLeft, Heart, Download, Smartphone } from 'lucide-react';
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

  // Narration State
  const [text, setText] = useState(DEFAULT_TEXT);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Kore);
  const [selectedTone, setSelectedTone] = useState<ToneType>(ToneType.Neutral);
  const [useMusic, setUseMusic] = useState(false);
  
  const [history, setHistory] = useState<AudioItem[]>([]);
  const [processing, setProcessing] = useState<ProcessingState>({
    isEnhancing: false,
    isGeneratingAudio: false,
    error: null,
  });

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // Audio Context management
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      setDeferredPrompt(null);
      setIsInstallable(false);
    });
  };

  // Returns the context so it can be used immediately in event handlers
  const initAudioContext = (): AudioContext => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      try {
        // Try to set sample rate to 24000 to match Gemini, but fallback if browser refuses
        audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      } catch (e) {
        console.warn("Could not set specific sample rate, falling back to default.", e);
        audioContextRef.current = new AudioContextClass();
      }
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(e => console.warn("Resume failed", e));
    }
    return audioContextRef.current;
  };

  const handleGenerateNarration = async () => {
    const ctx = initAudioContext();
    if (!text.trim()) return;
    
    // Check for API Key availability
    if (!process.env.API_KEY) {
        setProcessing(prev => ({ 
          ...prev, 
          error: "Chave da API não encontrada. Configure a variável de ambiente API_KEY no seu servidor (Vercel) ou arquivo .env local." 
        }));
        return;
    }

    setProcessing({ isEnhancing: false, isGeneratingAudio: false, error: null });

    try {
      let finalText = text;

      if (selectedTone !== ToneType.Neutral || useMusic || text.match(/[\[<]/)) {
        setProcessing(prev => ({ ...prev, isEnhancing: true }));
        finalText = await refineText(text, selectedTone, useMusic);
        setText(finalText);
      }

      setProcessing({ isEnhancing: false, isGeneratingAudio: true, error: null });
      const base64Data = await generateSpeech(finalText, selectedVoice);

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

    } catch (err) {
      console.error(err);
      setProcessing(prev => ({ 
        ...prev, 
        error: err instanceof Error ? err.message : "Ocorreu um erro." 
      }));
    } finally {
      setProcessing({ isEnhancing: false, isGeneratingAudio: false, error: null });
    }
  };

  const renderHeader = () => (
    <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setMode(AppMode.Home)}>
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Mic className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">VoxGen AI</h1>
            <p className="text-xs text-slate-400 font-medium">
               {mode === AppMode.Home && 'Creative Suite'}
               {mode === AppMode.Narration && 'Studio Narração'}
               {mode === AppMode.Music && 'Studio Música'}
               {mode === AppMode.Avatar && 'Avatar Studio'}
               {mode === AppMode.SFX && 'Sintetizador SFX'}
               {mode === AppMode.SmartPlayer && 'Smart Player Auto-DJ'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
            {isInstallable && (
                <button 
                    onClick={handleInstallClick}
                    className="hidden md:flex items-center gap-2 bg-slate-800 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-full text-xs font-medium transition-all animate-pulse border border-slate-700"
                >
                    <Smartphone size={14} />
                    Instalar App
                </button>
            )}

            {mode !== AppMode.Home && (
            <button 
                onClick={() => setMode(AppMode.Home)}
                className="text-sm text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
                <ArrowLeft size={16} /> Voltar ao Início
            </button>
            )}
        </div>
      </div>
    </header>
  );

  const renderNarrationStudio = () => (
    <div className="max-w-6xl mx-auto px-4 animate-fade-in">
       {/* Error Banner */}
       {processing.error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-200 text-sm">
            <strong>Erro:</strong> {processing.error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <VoiceControls 
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
              selectedTone={selectedTone}
              onToneChange={setSelectedTone}
              useMusic={useMusic}
              onMusicChange={setUseMusic}
            />

            <div className="h-full min-h-[200px]">
              <TextInput 
                value={text}
                onChange={setText}
                disabled={processing.isEnhancing || processing.isGeneratingAudio}
              />
            </div>

            <button
              onClick={handleGenerateNarration}
              disabled={processing.isEnhancing || processing.isGeneratingAudio || !text.trim()}
              className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${
                processing.isEnhancing || processing.isGeneratingAudio
                  ? 'bg-slate-800 text-slate-400 cursor-wait'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              {processing.isEnhancing ? (
                <>
                  <Loader2 className="animate-spin" /> Refinando Roteiro...
                </>
              ) : processing.isGeneratingAudio ? (
                <>
                  <Loader2 className="animate-spin" /> Gerando Áudio...
                </>
              ) : (
                <>
                  <Sparkles size={20} className="fill-white/20" /> Gerar Fala
                </>
              )}
            </button>
          </div>

          <div className="lg:col-span-5 space-y-6">
             <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <PlayCircle size={20} className="text-purple-400" />
                  Áudios Gerados
                </h2>
                <span className="text-xs bg-slate-800 px-2 py-1 rounded-full text-slate-400">
                  {history.length} clips
                </span>
             </div>
             
             <div className="bg-slate-900/30 rounded-2xl p-1 border border-slate-800/50 min-h-[500px]">
               <div className="h-full overflow-y-auto custom-scrollbar max-h-[600px] p-3">
                 <AudioList items={history} audioContext={audioContextRef.current} />
               </div>
             </div>
          </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f172a] to-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {renderHeader()}
      
      <main className="flex-grow py-8">
         {mode === AppMode.Home && <Home onSelectMode={setMode} />}
         {mode === AppMode.Narration && renderNarrationStudio()}
         {mode === AppMode.Music && <MusicStudio audioContext={audioContextRef.current} initAudioContext={initAudioContext} />}
         {mode === AppMode.Avatar && <AvatarStudio audioContext={audioContextRef.current} initAudioContext={initAudioContext} />}
         {mode === AppMode.SFX && <SFXStudio audioContext={audioContextRef.current} initAudioContext={initAudioContext} />}
         {mode === AppMode.SmartPlayer && <SmartPlayer audioContext={audioContextRef.current} initAudioContext={initAudioContext} narrationHistory={history} />}
      </main>

      <footer className="border-t border-slate-800/50 bg-slate-900/30 backdrop-blur-sm py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
             <p>&copy; {new Date().getFullYear()} VoxGen AI Studio. Todos os direitos reservados.</p>
             <p className="flex items-center gap-1">
                Criado por <span className="text-indigo-400 font-medium flex items-center gap-1"><Heart size={10} className="fill-indigo-400" /> Daniel de Oliveira</span>
             </p>
          </div>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <AppContent />
        </ErrorBoundary>
    );
};

export default App;
