import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Mic2, Wand2, Music, User, ShieldCheck, Play, Square, Loader2, Clock, Volume2, Newspaper, Radio, Users } from 'lucide-react';
import { TONE_OPTIONS, VOICE_OPTIONS, SFX_COMMANDS_HELP } from '../constants';
import { ToneType, VoiceName, UserRole, AudioItem } from '../types';
import { getApprovedVoices, getVoicesByUser } from '../services/voiceService';
import { generateSpeech } from '../services/geminiService';
import { decodeAudioData } from '../utils/audioUtils';
import BoletimStudio from './BoletimStudio';
import { DialogueStudio } from './DialogueStudio';

interface VoiceControlsProps {
  selectedVoice: VoiceName | string;
  onVoiceChange: (voice: VoiceName | string) => void;
  selectedTone: ToneType | string;
  onToneChange: (tone: ToneType | string) => void;
  useMusic: boolean;
  onMusicChange: (useMusic: boolean) => void;
  energy: number;
  onEnergyChange: (energy: number) => void;
  ducking: number;
  onDuckingChange: (ducking: number) => void;
  userEmail?: string;
  audioContext?: AudioContext | null;
  initAudioContext?: () => AudioContext;
  userRole?: UserRole;
  activeTab?: 'locucao' | 'boletim' | 'dialogo';
  onTabChange?: (tab: 'locucao' | 'boletim' | 'dialogo') => void;
  onAudioGenerated?: (item: AudioItem) => void;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({
  selectedVoice,
  onVoiceChange,
  selectedTone,
  onToneChange,
  useMusic,
  onMusicChange,
  energy,
  onEnergyChange,
  ducking,
  onDuckingChange,
  userEmail,
  audioContext = null,
  initAudioContext = () => new (window.AudioContext || (window as any).webkitAudioContext)(),
  userRole = 'user',
  activeTab = 'locucao',
  onTabChange,
  onAudioGenerated
}) => {
  const [internalTab, setInternalTab] = useState<'locucao' | 'boletim' | 'dialogo'>(activeTab);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const currentTab = onTabChange ? activeTab : internalTab;

  const handleTabSwitch = (tab: 'locucao' | 'boletim' | 'dialogo') => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  useEffect(() => {
    return () => {
      if (sourceRef.current) sourceRef.current.stop();
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  const handlePlayPreview = async (voiceName: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (playingPreviewId === voiceName) {
      if (sourceRef.current) sourceRef.current.stop();
      setPlayingPreviewId(null);
      return;
    }
    if (sourceRef.current) {
      sourceRef.current.stop();
      setPlayingPreviewId(null);
    }
    setLoadingPreviewId(voiceName);
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
      const demoText = `Olá, eu sou a voz ${label.split('(')[0].trim()}.`;
      const base64 = await generateSpeech(demoText, voiceName);
      const buffer = await decodeAudioData(base64, audioCtxRef.current);
      const source = audioCtxRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtxRef.current.destination);
      source.onended = () => { setPlayingPreviewId(null); };
      source.start();
      sourceRef.current = source;
      setPlayingPreviewId(voiceName);
    } catch (error) { alert("Erro no preview."); } finally { setLoadingPreviewId(null); }
  };
  
  const availableVoices = useMemo(() => {
    const standard = VOICE_OPTIONS.map(v => ({...v, type: 'standard'}));
    const approved = getApprovedVoices().map(v => ({ value: v.id, label: `${v.name} (Comunidade)`, gender: 'Oficial', type: 'official' }));
    const privateVoices = userEmail ? getVoicesByUser(userEmail).filter(v => v.category === 'private' || v.category === 'official_approved').map(v => ({ value: v.id, label: `${v.name} (Minha Voz)`, gender: 'Privada', type: 'private' })) : [];
    const uniqueVoices = [...standard, ...approved];
    privateVoices.forEach(pv => { if (!uniqueVoices.find(uv => uv.value === pv.value)) uniqueVoices.push(pv); });
    return uniqueVoices;
  }, [userEmail]);

  return (
    <div className="space-y-6 mb-6">
      {/* Abas Superiores da Ferramenta Voz do Narrador */}
      <div className="bg-slate-900/90 p-2 rounded-2xl border border-slate-800 flex flex-wrap gap-2">
        <button
          onClick={() => handleTabSwitch('locucao')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2.5 transition-all ${
            currentTab === 'locucao'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Mic2 size={16} />
          <span>🎙️ Locução Manual</span>
        </button>

        <button
          onClick={() => handleTabSwitch('boletim')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2.5 transition-all relative ${
            currentTab === 'boletim'
              ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-lg shadow-pink-600/30'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Newspaper size={16} />
          <span>📰 Boletim Inteligente IA</span>
        </button>

        <button
          onClick={() => handleTabSwitch('dialogo')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2.5 transition-all relative ${
            currentTab === 'dialogo'
              ? 'bg-gradient-to-r from-purple-600 to-emerald-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Users size={16} />
          <span>💬 Diálogo Duas Vozes</span>
          <span className="px-1.5 py-0.5 bg-emerald-500 text-slate-950 text-[9px] font-black rounded-full uppercase tracking-wider">Novo</span>
        </button>
      </div>

      {/* Conteúdo da Aba Selecionada */}
      {currentTab === 'dialogo' ? (
        <DialogueStudio
          onAudioGenerated={onAudioGenerated}
        />
      ) : currentTab === 'boletim' ? (
        <BoletimStudio
          audioContext={audioContext}
          initAudioContext={initAudioContext}
          userRole={userRole}
          userEmail={userEmail}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 backdrop-blur-sm">
            <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center gap-2"><Mic2 size={16} className="text-indigo-400" /> Selecionar Voz</label>
            <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
              {availableVoices.map((option) => (
                <div key={option.value} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 border ${selectedVoice === option.value ? 'bg-indigo-600/20 text-white shadow-sm border-indigo-500' : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800 border-transparent'}`}>
                  <div className="flex items-center gap-3 flex-grow cursor-pointer" onClick={() => onVoiceChange(option.value)}>
                      <button onClick={(e) => handlePlayPreview(option.value, option.label, e)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${playingPreviewId === option.value ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-indigo-400 hover:bg-indigo-500 hover:text-white'}`}>{loadingPreviewId === option.value ? <Loader2 size={14} className="animate-spin" /> : playingPreviewId === option.value ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}</button>
                      <div className="flex flex-col"><div className="flex items-center gap-2 font-medium">{option.type === 'private' && <User size={12} />}{option.type === 'official' && <ShieldCheck size={12} className="text-yellow-400"/>}<span className={`truncate ${selectedVoice === option.value ? 'text-indigo-200' : ''}`}>{option.label}</span></div></div>
                  </div>
                  <span onClick={() => onVoiceChange(option.value)} className={`text-[10px] px-2 py-0.5 rounded-full cursor-pointer ml-2 ${option.gender === 'Feminino' ? 'bg-pink-500/10 text-pink-400' : option.gender === 'Masculino' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>{option.gender}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 backdrop-blur-sm flex flex-col">
            <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center gap-2"><Wand2 size={16} className="text-emerald-400" /> Estilo & Tom</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {TONE_OPTIONS.map((option) => (
                <button key={option.value} onClick={() => onToneChange(option.value as ToneType)} className={`flex items-center justify-center px-2 py-3 rounded-lg text-xs font-medium transition-all duration-200 border ${selectedTone === option.value ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/20' : 'bg-slate-900/50 text-slate-400 border-transparent hover:bg-slate-800'}`}>{option.label.split(' (')[0]}</button>
              ))}
            </div>

            <div className="space-y-4 mb-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] text-slate-400 uppercase font-bold">
                  <span>Energia / Excitação</span>
                  <span className="text-emerald-400">{energy}%</span>
                </div>
                <input type="range" min="0" max="100" value={energy} onChange={(e) => onEnergyChange(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] text-slate-400 uppercase font-bold">
                  <span>Ducking (Música de Fundo)</span>
                  <span className="text-pink-400">-{100 - ducking}%</span>
                </div>
                <input type="range" min="0" max="100" value={ducking} onChange={(e) => onDuckingChange(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500" />
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-700/50">
               <button onClick={() => onMusicChange(!useMusic)} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-all duration-200 border ${useMusic ? 'bg-pink-600/20 border-pink-500/50 text-pink-200' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                 <div className="flex items-center gap-3"><Music size={18} className={useMusic ? "text-pink-400" : "text-slate-500"} /><div className="flex flex-col items-start"><span className="font-medium">Fundo Musical</span><span className="text-[10px] opacity-70">Otimizar ritmo para música</span></div></div>
                 <div className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${useMusic ? 'bg-pink-500' : 'bg-slate-700'}`}><div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-200 ${useMusic ? 'left-6' : 'left-1'}`} /></div>
               </button>
            </div>
            <div className="mt-3 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                 <div className="flex items-center gap-2 mb-1 text-xs text-yellow-500 font-bold"><Volume2 size={12}/> Efeitos Sonoros Disponíveis:</div>
                 <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                    {SFX_COMMANDS_HELP.join(', ')}
                 </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceControls;
