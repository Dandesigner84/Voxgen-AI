
import React from 'react';
import { Mic, Music, ArrowRight, UserSquare2, Volume2, Radio } from 'lucide-react';
import { AppMode } from '../types';

interface HomeProps {
  onSelectMode: (mode: AppMode) => void;
}

const Home: React.FC<HomeProps> = ({ onSelectMode }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full animate-fade-in px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 mb-4 tracking-tight">
          VoxGen AI
        </h1>
        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto">
          Sua plataforma criativa tudo-em-um. Crie narrações, músicas, efeitos sonoros e rádios inteligentes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl w-full">
        {/* Narration Card */}
        <button
          onClick={() => onSelectMode(AppMode.Narration)}
          className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-indigo-500/50 transition-all duration-300 h-80 flex flex-col items-center justify-center text-center p-6 hover:shadow-2xl hover:shadow-indigo-900/20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <Mic size={32} className="text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">Narração</h2>
          <p className="text-slate-400 text-xs leading-relaxed">
            Texto em fala com vozes premium e controle de tom.
          </p>
        </button>

        {/* Music Card */}
        <button
          onClick={() => onSelectMode(AppMode.Music)}
          className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-pink-500/50 transition-all duration-300 h-80 flex flex-col items-center justify-center text-center p-6 hover:shadow-2xl hover:shadow-pink-900/20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-16 h-16 bg-pink-500/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <Music size={32} className="text-pink-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2 group-hover:text-pink-300 transition-colors">Música</h2>
          <p className="text-slate-400 text-xs leading-relaxed">
            Gere instrumentais e remixes estilo Suno AI.
          </p>
        </button>

        {/* SFX Card */}
        <button
          onClick={() => onSelectMode(AppMode.SFX)}
          className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-yellow-500/50 transition-all duration-300 h-80 flex flex-col items-center justify-center text-center p-6 hover:shadow-2xl hover:shadow-yellow-900/20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <Volume2 size={32} className="text-yellow-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2 group-hover:text-yellow-300 transition-colors">Sintetizador SFX</h2>
          <p className="text-slate-400 text-xs leading-relaxed">
            Crie efeitos sonoros (Fogos, Laser, Motor, etc).
          </p>
        </button>

        {/* Smart Player */}
        <button
          onClick={() => onSelectMode(AppMode.SmartPlayer)}
          className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-cyan-500/50 transition-all duration-300 h-80 flex flex-col items-center justify-center text-center p-6 hover:shadow-2xl hover:shadow-cyan-900/20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <Radio size={32} className="text-cyan-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">Smart Player</h2>
          <p className="text-slate-400 text-xs leading-relaxed">
            Rádio automática com narrações intercaladas.
          </p>
        </button>

         {/* Avatar Card (Centered in new row or kept at end) - For simplicity sticking to 4 grid or add Avatar as 5th */}
         <button
          onClick={() => onSelectMode(AppMode.Avatar)}
          className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-emerald-500/50 transition-all duration-300 h-80 flex flex-col items-center justify-center text-center p-6 hover:shadow-2xl hover:shadow-emerald-900/20 lg:col-span-4 mt-4"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <UserSquare2 size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">Avatar Studio</h2>
          <p className="text-slate-400 text-xs leading-relaxed">
            Dê vida a fotos! Faça upload de um personagem e faça-o falar com IA.
          </p>
        </button>
      </div>
    </div>
  );
};

export default Home;
