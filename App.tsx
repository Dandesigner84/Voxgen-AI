
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Sparkles, Loader2, PlayCircle, ArrowLeft, Heart, Smartphone, Play, Square, Volume2, LogOut, CheckCircle, XCircle, Radio, Shield, Info } from 'lucide-react';
import VoiceControls from './components/VoiceControls';
import TextInput from './components/TextInput';
import AudioList from './components/AudioList';
import Home from './components/Home';
import MusicStudio from './components/MusicStudio';
import AvatarStudio from './components/AvatarStudio';
import SFXStudio from './components/SFXStudio';
import SmartPlayer from './components/SmartPlayer';
import MangaStudio from './components/MangaStudio';
import VoiceCloningStudio from './components/VoiceCloningStudio';
import PDFReaderStudio from './components/PDFReaderStudio';
import AdminPanel from './components/AdminPanel';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './components/Login';
import VoiceAssistant from './components/VoiceAssistant';
import { AudioItem, ProcessingState, ToneType, VoiceName, AppMode, UserRole, UserSession } from './types';
import { DEFAULT_TEXT } from './constants';
import { refineText, generateSpeech, addAutomaticSFX } from './services/geminiService';
import { decodeAudioData, addBackgroundMusic, masterAudioBuffer } from './utils/audioUtils';
import { canGenerateNarration, incrementUsage } from './services/monetizationService';
import { 
  isBackgroundPlaybackEnabled, 
  setBackgroundPlaybackEnabled, 
  registerAudioContext, 
  setupBackgroundAudioListeners,
  startKeepAlive,
  updateMediaSession
} from './utils/backgroundAudio';

const AppContent: React.FC = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [mode, setMode] = useState<AppMode>(AppMode.Home);
  
  const [text, setText] = useState(DEFAULT_TEXT);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName | string>(VoiceName.Kore);
  const [selectedTone, setSelectedTone] = useState<ToneType | string>(ToneType.Neutral);
  const [useMusic, setUseMusic] = useState(false);
  const [energy, setEnergy] = useState(50);
  const [ducking, setDucking] = useState(20);
  const [history, setHistory] = useState<AudioItem[]>([]);
  const [processing, setProcessing] = useState<ProcessingState>({
    isEnhancing: false, isGeneratingAudio: false, error: null,
  });

  const [suggestedText, setSuggestedText] = useState<string | null>(null);
  const [isAddingSFX, setIsAddingSFX] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [globalGain, setGlobalGain] = useState(1.0);
  const [narrationTab, setNarrationTab] = useState<'locucao' | 'boletim' | 'dialogo'>('locucao');

  const [isBgAudioEnabled, setIsBgAudioEnabled] = useState(isBackgroundPlaybackEnabled());
  const [showBgAudioModal, setShowBgAudioModal] = useState(false);
  
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainNodeRef = useRef<GainNode | null>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const cleanup = setupBackgroundAudioListeners();
    const handleBgChange = (e: any) => {
      if (e.detail) setIsBgAudioEnabled(e.detail.enabled);
    };
    window.addEventListener('voxgen-background-setting-changed', handleBgChange);

    const handleBoletimCreated = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      const item = customEvent.detail;
      if (item && item.generationStatus === 'success' && item.audioData) {
        const audioItem: AudioItem = {
          id: item.id,
          text: `[Boletim ${item.niche}] ${item.scriptText}`,
          voice: item.voice || 'Kore',
          audioData: item.audioData,
          createdAt: new Date(item.createdAt || Date.now()),
          duration: item.duration || 60,
        };
        setHistory(prev => [audioItem, ...prev.filter(h => h.id !== item.id)]);
      }
    };
    window.addEventListener('voxgen-boletim-created', handleBoletimCreated);

    return () => {
      cleanup();
      window.removeEventListener('voxgen-background-setting-changed', handleBgChange);
      window.removeEventListener('voxgen-boletim-created', handleBoletimCreated);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleLogin = (role: UserRole, email: string) => {
    setUser({ role, email });
    if (role === 'admin' || email === 'limadan389@gmail.com') {
        setMode(AppMode.Admin);
    } else {
        setMode(AppMode.Home);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setMode(AppMode.Home);
  };

  const handleInstallClick = () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
    }
  };

  const toggleBackgroundAudio = () => {
    const newStatus = !isBgAudioEnabled;
    setIsBgAudioEnabled(newStatus);
    setBackgroundPlaybackEnabled(newStatus);
  };

  const initAudioContext = React.useCallback((): AudioContext => {
    if (!audioContextRef.current) {
      console.log("[Audio] Criando novo AudioContext...");
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass({ sampleRate: 24000 });
      
      const masterGain = ctx.createGain();
      masterGain.gain.value = globalGain;
      masterGain.connect(ctx.destination);
      
      audioContextRef.current = ctx;
      masterGainNodeRef.current = masterGain;
      registerAudioContext(ctx);
    }
    
    console.log(`[Audio] AudioContext state: ${audioContextRef.current.state}`);
    if (audioContextRef.current.state === 'suspended') {
      console.log("[Audio] Retomando AudioContext...");
      audioContextRef.current.resume();
    }
    registerAudioContext(audioContextRef.current);
    return audioContextRef.current;
  }, [globalGain]);

  const stopPreview = () => {
    if (previewSourceRef.current) {
      try { previewSourceRef.current.stop(); } catch (e) {}
      previewSourceRef.current = null;
    }
    setIsPlayingPreview(false);
  };

  const handlePreviewNarration = async () => {
    if (isPlayingPreview) { stopPreview(); return; }
    if (!text.trim()) return;
    const ctx = initAudioContext();
    setIsPlayingPreview(true);
    try {
      let previewText = text;
      if (text.length > 150) {
        const truncated = text.slice(0, 150);
        const lastSpace = truncated.lastIndexOf(' ');
        previewText = (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
      }
      const base64Data = await generateSpeech(previewText, selectedVoice);
      const buffer = await decodeAudioData(base64Data, ctx);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(masterGainNodeRef.current || ctx.destination);
      source.onended = () => {
        setIsPlayingPreview(false);
        previewSourceRef.current = null;
      };
      source.start(0);
      previewSourceRef.current = source;
    } catch (err: any) {
      alert("Erro no preview: " + (err.message || "Tente novamente"));
      setIsPlayingPreview(false);
    }
  };

  const handleVoiceCommand = (command: 'play' | 'pause' | 'volume_down' | 'volume_up') => {
    console.log(`[VoxGen Voice] Executando comando: ${command}`);
    
    switch (command) {
        case 'play':
            if (mode === AppMode.Narration && text.trim()) {
                handlePreviewNarration();
            } else if (mode === AppMode.SmartPlayer) {
                // O SmartPlayer tem controles internos, mas o comando de voz pode ser estendido via evento global
                window.dispatchEvent(new CustomEvent('voxgen-play'));
            }
            break;
        case 'pause':
            stopPreview();
            window.dispatchEvent(new CustomEvent('voxgen-pause'));
            if (audioContextRef.current) audioContextRef.current.suspend();
            break;
        case 'volume_down':
            const newVolDown = Math.max(0, globalGain - 0.3);
            setGlobalGain(newVolDown);
            if (masterGainNodeRef.current) masterGainNodeRef.current.gain.setTargetAtTime(newVolDown, audioContextRef.current!.currentTime, 0.2);
            break;
        case 'volume_up':
            const newVolUp = Math.min(1.5, globalGain + 0.3);
            setGlobalGain(newVolUp);
            if (masterGainNodeRef.current) masterGainNodeRef.current.gain.setTargetAtTime(newVolUp, audioContextRef.current!.currentTime, 0.2);
            break;
    }
  };

  const handleOptimizeText = async () => {
      if (!text.trim()) return;
      setProcessing(prev => ({ ...prev, isEnhancing: true }));
      try {
          const refined = await refineText(text, selectedTone, useMusic);
          setSuggestedText(refined);
      } catch (e) { alert("Não foi possível otimizar o texto."); } finally { setProcessing(prev => ({ ...prev, isEnhancing: false })); }
  };

  const handleAutoSFX = async () => {
      if (!text.trim()) return;
      setIsAddingSFX(true);
      try {
          const textWithSFX = await addAutomaticSFX(text);
          setText(textWithSFX);
      } catch (e) { alert("Não foi possível inserir efeitos automáticos."); } finally { setIsAddingSFX(false); }
  };

  const confirmSuggestion = () => {
      if (suggestedText) { setText(suggestedText); setSuggestedText(null); }
  };

  const handleGenerateNarration = async () => {
    stopPreview();
    const isSuperAdmin = user?.email === 'limadan389@gmail.com';
    if (user?.role !== 'admin' && !isSuperAdmin && user?.role !== 'corporate-admin') {
        const limitCheck = canGenerateNarration();
        if (!limitCheck.allowed) { alert(limitCheck.message); return; }
    }
    const ctx = initAudioContext();
    setProcessing({ isEnhancing: false, isGeneratingAudio: false, error: null });
    try {
      setProcessing({ isEnhancing: false, isGeneratingAudio: true, error: null });
      const base64Data = await generateSpeech(text, selectedVoice);
      if (ctx) {
        const speechBuffer = await decodeAudioData(base64Data, ctx);
        
        // Apply Mastering
        const isCarSound = selectedTone === ToneType.CarSound || 
                          selectedTone === ToneType.PromotionalEnergetic ||
                          selectedTone === ToneType.StorefrontAnnouncer;
        const masteredBuffer = await masterAudioBuffer(speechBuffer, ctx, isCarSound);
        
        let finalBuffer = masteredBuffer;
        if (useMusic) { 
          finalBuffer = await addBackgroundMusic(masteredBuffer, selectedTone, ctx, ducking / 100); 
        }
        
        const newItem: AudioItem = { id: crypto.randomUUID(), text: text, voice: selectedVoice, audioData: finalBuffer, createdAt: new Date(), duration: finalBuffer.duration };
        setHistory(prev => [newItem, ...prev]);
        if (user?.role !== 'admin' && !isSuperAdmin && user?.role !== 'corporate-admin') { incrementUsage(); }
      }
    } catch (err: any) {
      const msg = err.message || "Erro desconhecido ao gerar áudio.";
      setProcessing(prev => ({ ...prev, error: msg }));
      alert("FALHA NA GERAÇÃO: " + msg);
    } finally { setProcessing(prev => ({ ...prev, isEnhancing: false, isGeneratingAudio: false })); }
  };

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] text-slate-200 font-sans relative">
      <VoiceAssistant onCommand={handleVoiceCommand} />
      
      {suggestedText && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-slate-900 border border-indigo-500/50 rounded-2xl p-6 max-w-4xl w-full shadow-2xl">
                  <div className="text-center mb-6">
                      <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-3"><Sparkles size={24} className="text-indigo-400" /></div>
                      <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Versão Humanizada Disponível</h2>
                      <p className="text-slate-400 text-sm">A IA sugeriu melhorias para o texto original.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                          <h4 className="text-slate-400 font-bold text-xs uppercase mb-3 flex items-center gap-2">Original</h4>
                          <div className="text-sm text-slate-300 h-48 overflow-y-auto custom-scrollbar p-2 bg-slate-900/50 rounded whitespace-pre-wrap">{text}</div>
                          <button onClick={() => setSuggestedText(null)} className="mt-4 w-full py-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-sm flex items-center justify-center gap-2"><XCircle size={16} /> Manter Original</button>
                      </div>
                      <div className="bg-indigo-900/10 rounded-xl p-4 border border-indigo-500/30">
                          <h4 className="text-indigo-400 font-bold text-xs uppercase mb-3 flex items-center gap-2">Sugestão IA</h4>
                          <div className="text-sm text-white h-48 overflow-y-auto custom-scrollbar p-2 bg-indigo-900/20 rounded whitespace-pre-wrap border border-indigo-500/10">{suggestedText}</div>
                          <button onClick={confirmSuggestion} className="mt-4 w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg"><CheckCircle size={16} /> Usar Sugestão</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showBgAudioModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden">
                  <button 
                      onClick={() => setShowBgAudioModal(false)}
                      className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                  >
                      <XCircle size={24} />
                  </button>

                  <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center mb-4">
                      <Smartphone size={28} className="text-indigo-400" />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-2">Funcionamento em Segundo Plano</h3>
                  <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                      O VoxGen agora conta com suporte restaurado para continuar tocando em segundo plano nos Smartphones (iOS e Android). O áudio não é pausado quando você sai da página, minimiza o navegador ou bloqueia a tela!
                  </p>

                  <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 mb-6 space-y-3">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <Radio size={20} className={isBgAudioEnabled ? "text-emerald-400" : "text-slate-500"} />
                              <div>
                                  <p className="text-sm font-bold text-white">Modo Segundo Plano</p>
                                  <p className="text-xs text-slate-400">Manter áudio rodando com tela desligada</p>
                              </div>
                          </div>
                          <button 
                              onClick={toggleBackgroundAudio}
                              className={`w-12 h-6 rounded-full relative transition-colors ${isBgAudioEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                          >
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isBgAudioEnabled ? 'left-7' : 'left-1'}`}></div>
                          </button>
                      </div>
                  </div>

                  <div className="bg-indigo-950/40 p-4 rounded-xl border border-indigo-500/20 text-xs text-indigo-300 space-y-2 mb-6">
                      <div className="flex items-start gap-2">
                          <Info size={16} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                          <p>Dica: O controle de reprodução (Play/Pause/Avançar) ficará acessível na tela de bloqueio do seu smartphone através da Central de Mídia do sistema.</p>
                      </div>
                  </div>

                  <button 
                      onClick={() => setShowBgAudioModal(false)}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/30"
                  >
                      Entendi, Concluído
                  </button>
              </div>
          </div>
      )}

      <header className="bg-slate-900/50 backdrop-blur-lg sticky top-0 z-50 p-4 border-b border-slate-800 flex justify-between items-center">
          <div onClick={() => setMode(AppMode.Home)} className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center"><Mic size={20}/></div>
              <h1 className="font-bold text-lg hidden md:block">VoxGen AI</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
                onClick={() => setShowBgAudioModal(true)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all border ${
                  isBgAudioEnabled 
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
                title="Configurações de Áudio em Segundo Plano no Smartphone"
            >
                <Smartphone size={14} className={isBgAudioEnabled ? 'text-emerald-400' : 'text-slate-500'} />
                <span>{isBgAudioEnabled ? '2º Plano: ON' : '2º Plano: OFF'}</span>
            </button>

            {isInstallable && (
                <button onClick={handleInstallClick} className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full text-xs flex items-center gap-2 transition-colors"><Smartphone size={14}/> <span className="hidden sm:inline">Instalar App</span></button>
            )}
            <div className="h-4 w-[1px] bg-slate-700 mx-0.5"></div>
            {mode !== AppMode.Home && (
                <button onClick={() => setMode(AppMode.Home)} className="text-slate-400 hover:text-white text-sm flex items-center gap-1 transition-colors"><ArrowLeft size={16}/> Voltar</button>
            )}
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 text-sm flex items-center gap-1 transition-colors ml-1" title="Sair"><LogOut size={18}/></button>
          </div>
      </header>
      
      <main className="flex-grow py-8">
         <div className={mode === AppMode.SmartPlayer ? 'block' : 'hidden'}>
            <SmartPlayer audioContext={audioContextRef.current} initAudioContext={initAudioContext} narrationHistory={history} userRole={user.role} />
         </div>

         {mode === AppMode.Home && <Home onSelectMode={setMode} userRole={user.role} userEmail={user.email} onLogout={handleLogout} />}
         {mode === AppMode.Admin && <AdminPanel userRole={user.role} userEmail={user.email} />}
         {mode === AppMode.Narration && (
            <div className="max-w-6xl mx-auto px-4">
                <VoiceControls 
                  selectedVoice={selectedVoice} 
                  onVoiceChange={setSelectedVoice} 
                  selectedTone={selectedTone} 
                  onToneChange={setSelectedTone} 
                  useMusic={useMusic} 
                  onMusicChange={setUseMusic} 
                  energy={energy}
                  onEnergyChange={setEnergy}
                  ducking={ducking}
                  onDuckingChange={setDucking}
                  userEmail={user.email} 
                  audioContext={audioContextRef.current}
                  initAudioContext={initAudioContext}
                  userRole={user.role}
                  activeTab={narrationTab}
                  onTabChange={setNarrationTab}
                  onAudioGenerated={(item) => setHistory(prev => [item, ...prev])}
                />

                {narrationTab === 'locucao' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      <div className="lg:col-span-7 space-y-6">
                          <div className="min-h-[200px]">
                              <TextInput value={text} onChange={setText} disabled={processing.isGeneratingAudio} selectedTone={selectedTone} onOptimize={handleOptimizeText} isOptimizing={processing.isEnhancing} onAutoSFX={handleAutoSFX} isAddingSFX={isAddingSFX} />
                          </div>
                          <div className="flex gap-4">
                              <button onClick={handlePreviewNarration} disabled={processing.isGeneratingAudio || !text.trim()} className={`flex-1 py-4 rounded-xl font-bold flex justify-center items-center gap-2 border transition-all ${isPlayingPreview ? 'bg-red-500/20 border-red-500 text-red-200' : 'bg-slate-800 border-slate-700 text-indigo-300'}`}>
                                  {isPlayingPreview ? <><Square size={18} fill="currentColor" /> Parar</> : <><Play size={18} /> Preview</>}
                              </button>
                              <button onClick={handleGenerateNarration} disabled={processing.isGeneratingAudio || !text.trim() || isPlayingPreview} className="flex-[2] py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex justify-center items-center gap-2 shadow-lg disabled:opacity-50">
                                  {processing.isGeneratingAudio ? "Gerando..." : <><Sparkles size={18}/> Gerar Áudio</>}
                              </button>
                          </div>
                      </div>
                      <div className="lg:col-span-5">
                          <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800 h-[500px] overflow-y-auto custom-scrollbar">
                              <AudioList items={history} audioContext={audioContextRef.current} />
                          </div>
                      </div>
                  </div>
                )}
            </div>
         )}
         {mode === AppMode.Music && <MusicStudio audioContext={audioContextRef.current} initAudioContext={initAudioContext} />}
         {mode === AppMode.Avatar && <AvatarStudio audioContext={audioContextRef.current} initAudioContext={initAudioContext} narrationHistory={history} />}
         {mode === AppMode.Manga && <MangaStudio audioContext={audioContextRef.current} initAudioContext={initAudioContext} />}
         {mode === AppMode.SFX && <SFXStudio audioContext={audioContextRef.current} initAudioContext={initAudioContext} />}
         {mode === AppMode.VoiceCloning && <VoiceCloningStudio audioContext={audioContextRef.current} initAudioContext={initAudioContext} userEmail={user.email} />}
         {mode === AppMode.PDFReader && <PDFReaderStudio audioContext={audioContextRef.current} initAudioContext={initAudioContext} />}
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
