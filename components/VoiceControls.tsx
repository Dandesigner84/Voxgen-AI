import React from 'react';
import { Mic2, Wand2, Music } from 'lucide-react';
import { TONE_OPTIONS, VOICE_OPTIONS } from '../constants';
import { ToneType, VoiceName } from '../types';

interface VoiceControlsProps {
  selectedVoice: VoiceName;
  onVoiceChange: (voice: VoiceName) => void;
  selectedTone: ToneType;
  onToneChange: (tone: ToneType) => void;
  useMusic: boolean;
  onMusicChange: (useMusic: boolean) => void;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({
  selectedVoice,
  onVoiceChange,
  selectedTone,
  onToneChange,
  useMusic,
  onMusicChange,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      {/* Voice Selector */}
      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 backdrop-blur-sm">
        <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
          <Mic2 size={16} className="text-indigo-400" />
          Selecionar Voz
        </label>
        <div className="space-y-2">
          {VOICE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onVoiceChange(option.value)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-all duration-200 ${
                selectedVoice === option.value
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 border border-indigo-500'
                  : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800 border border-transparent'
              }`}
            >
              <span className="font-medium">{option.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                 option.gender === 'Feminino' ? 'bg-pink-500/10 text-pink-400' : 'bg-blue-500/10 text-blue-400'
              }`}>
                {option.gender}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tone & Music Selector */}
      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 backdrop-blur-sm flex flex-col">
        <label className="block text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
          <Wand2 size={16} className="text-emerald-400" />
          Estilo & Tom
        </label>
        
        <div className="grid grid-cols-2 gap-2 mb-4">
          {TONE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onToneChange(option.value)}
              className={`flex items-center justify-center px-2 py-3 rounded-lg text-xs font-medium transition-all duration-200 border ${
                selectedTone === option.value
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/20'
                  : 'bg-slate-900/50 text-slate-400 border-transparent hover:bg-slate-800'
              }`}
            >
              {option.label.split(' (')[0]}
            </button>
          ))}
        </div>

        <div className="mt-auto pt-4 border-t border-slate-700/50">
           <button
            onClick={() => onMusicChange(!useMusic)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-all duration-200 border ${
              useMusic
                ? 'bg-pink-600/20 border-pink-500/50 text-pink-200'
                : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
           >
             <div className="flex items-center gap-3">
               <Music size={18} className={useMusic ? "text-pink-400" : "text-slate-500"} />
               <div className="flex flex-col items-start">
                 <span className="font-medium">Fundo Musical</span>
                 <span className="text-[10px] opacity-70">Otimizar ritmo para música</span>
               </div>
             </div>
             <div className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${useMusic ? 'bg-pink-500' : 'bg-slate-700'}`}>
               <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-200 ${useMusic ? 'left-6' : 'left-1'}`} />
             </div>
           </button>
        </div>

        <p className="text-xs text-slate-500 mt-3 leading-relaxed">
          Dica: Use comandos como <code>[risada]</code>, <code>[sussurro]</code> ou <code>&lt;pausa&gt;</code>. A IA adaptará o estilo de fala.
        </p>
      </div>
    </div>
  );
};

export default VoiceControls;