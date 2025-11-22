
import React from 'react';
import { HardHat, Construction } from 'lucide-react';

interface AvatarStudioProps {
  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;
}

const AvatarStudio: React.FC<AvatarStudioProps> = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] w-full animate-fade-in px-4 text-center">
      <div className="relative">
        <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full"></div>
        <div className="relative bg-slate-800/50 border border-yellow-500/30 p-10 rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col items-center max-w-md w-full">
          
          <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
             <Construction size={48} className="text-yellow-500" />
          </div>

          <h2 className="text-3xl font-bold text-white mb-4">Em Construção</h2>
          
          <p className="text-slate-400 mb-8 leading-relaxed">
            Estamos trabalhando duro para melhorar o <strong>Avatar Studio</strong>. 
            Em breve, você poderá criar animações faciais ultra-realistas sincronizadas com suas narrações.
          </p>

          <div className="flex items-center gap-2 text-xs font-mono text-yellow-500/70 bg-yellow-900/20 px-4 py-2 rounded-full border border-yellow-900/30">
             <HardHat size={12} />
             <span>Obras em andamento...</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarStudio;