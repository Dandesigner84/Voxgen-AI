
import React, { useState, useEffect } from 'react';
import { Mic, Music, Volume2, Radio, Crown, Check, BookOpen, ShieldCheck, KeyRound, User as UserIcon } from 'lucide-react';
import { AppMode, User } from '../types';
import { getUserStatus, redeemCode, getFormatExpiryDate } from '../services/monetizationService';

interface HomeProps {
  onSelectMode: (mode: AppMode) => void;
  user: User | null;
}

const Home: React.FC<HomeProps> = ({ onSelectMode, user }) => {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState(getUserStatus());
  const [redeemMsg, setRedeemMsg] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [showRedeemInput, setShowRedeemInput] = useState(false);

  useEffect(() => {
    setStatus(getUserStatus());
  }, []);

  const handleRedeem = () => {
    if (!code.trim()) return;
    const result = redeemCode(code.trim().toUpperCase());
    
    if (result.success) {
      setRedeemMsg({ type: 'success', text: result.message });
      setStatus(getUserStatus());
      setCode('');
      setTimeout(() => setShowRedeemInput(false), 2000);
    } else {
      setRedeemMsg({ type: 'error', text: result.message });
    }
    
    setTimeout(() => setRedeemMsg(null), 5000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full animate-fade-in px-4 py-8">
      
      <div className="w-full max-w-4xl flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
        <div className="text-center md:text-left">
            <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 tracking-tight select-none">
            VoxGen AI
            </h1>
            <p className="text-slate-400 text-lg mt-2">
              {user ? `Olá, ${user.name.split(' ')[0]}!` : 'Sua plataforma criativa tudo-em-um.'}
            </p>
        </div>

        {/* Action Buttons / Status Box */}
        <div className="flex flex-col gap-3 items-end">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 backdrop-blur-sm flex items-center gap-3 min-w-[200px]">
                {status.plan === 'premium' ? (
                    <Crown size={20} className="text-yellow-400 fill-yellow-400 animate-pulse" />
                ) : (
                    <div className="w-3 h-3 rounded-full bg-slate-500" />
                )}
                <div className="flex flex-col items-start">
                    <span className={`text-sm font-bold ${status.plan === 'premium' ? 'text-yellow-400' : 'text-slate-300'}`}>
                        {status.plan === 'premium' ? 'MEMBRO PREMIUM' : 'Plano Gratuito'}
                    </span>
                    {status.plan === 'premium' ? (
                        <span className="text-[10px] text-slate-500">Válido até {getFormatExpiryDate()}</span>
                    ) : (
                        <span className="text-[10px] text-slate-500">{status.narrationsToday}/3 narrações hoje</span>
                    )}
                </div>
            </div>

            <div className="flex gap-2 w-full justify-end">
                <button 
                    onClick={() => setShowRedeemInput(!showRedeemInput)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border transition-colors ${showRedeemInput ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-indigo-300 hover:bg-slate-700'}`}
                >
                    <KeyRound size={14} />
                    {showRedeemInput ? 'Fechar' : 'Código Premiado'}
                </button>
                
                {user?.role === 'admin' && (
                  <button 
                      onClick={() => onSelectMode(AppMode.Admin)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                      <ShieldCheck size={14} />
                      Painel Admin
                  </button>
                )}
            </div>

            {showRedeemInput && (
                <div className="bg-slate-800 border border-slate-600 p-3 rounded-xl w-full max-w-[300px] animate-fade-in shadow-xl">
                    <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Inserir Código</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="VOX-XXXXXX"
                            className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white outline-none focus:border-indigo-500 flex-grow uppercase font-mono"
                        />
                        <button 
                            onClick={handleRedeem}
                            className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
                        >
                            <Check size={16} />
                        </button>
                    </div>
                    {redeemMsg && (
                        <p className={`text-[10px] mt-2 font-medium ${redeemMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                            {redeemMsg.text}
                        </p>
                    )}
                </div>
            )}
        </div>
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
          <p className="text-slate-400 text-xs leading-relaxed">Texto em fala com vozes premium e controle de tom.</p>
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
          <p className="text-slate-400 text-xs leading-relaxed">Gere instrumentais e remixes estilo Suno AI.</p>
        </button>

        {/* Manga Card */}
        <button
          onClick={() => onSelectMode(AppMode.Manga)}
          className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-purple-500/50 transition-all duration-300 h-80 flex flex-col items-center justify-center text-center p-6 hover:shadow-2xl hover:shadow-purple-900/20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <BookOpen size={32} className="text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">Manga Studio</h2>
          <p className="text-slate-400 text-xs leading-relaxed">Crie HQs e Mangás com IA. Personagens e Cenas.</p>
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
          <p className="text-slate-400 text-xs leading-relaxed">Rádio automática com narrações intercaladas.</p>
        </button>

        {/* SFX Card */}
        <button
          onClick={() => onSelectMode(AppMode.SFX)}
          className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-yellow-500/50 transition-all duration-300 h-80 flex flex-col items-center justify-center text-center p-6 hover:shadow-2xl hover:shadow-yellow-900/20 lg:col-span-4 mt-4"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <Volume2 size={32} className="text-yellow-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2 group-hover:text-yellow-300 transition-colors">Sintetizador SFX</h2>
          <p className="text-slate-400 text-xs leading-relaxed">Crie efeitos sonoros (Fogos, Laser, Motor, etc).</p>
        </button>
      </div>
    </div>
  );
};

export default Home;
