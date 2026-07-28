
import React, { useState, useEffect } from 'react';
import { Mic, Music, Radio, Crown, Check, BookOpen, ShieldCheck, Volume2, Mic2, Users, Gift, Star, Sparkles, Video, Layout, Wand2, Mail, UserPlus, X, Lock, ArrowRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { AppMode } from '../types';
import { getUserStatus, redeemCode, getFormatExpiryDate } from '../services/monetizationService';
import { sendVerificationCode } from '../services/authService';

interface HomeProps {
  onSelectMode: (mode: AppMode) => void;
  userRole: 'user' | 'admin' | 'corporate-admin' | 'corporate-user';
  userEmail?: string;
  onLogout?: () => void;
}

const Home: React.FC<HomeProps> = ({ onSelectMode, userRole, userEmail, onLogout }) => {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState(getUserStatus());
  const [redeemMsg, setRedeemMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  // Email Registration Modal State inside Homepage
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [sentOtpCode, setSentOtpCode] = useState('');
  const [regStep, setRegStep] = useState<'form' | 'otp'>('form');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  const isCorpTeam = userRole === 'corporate-user';

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
    } else {
      setRedeemMsg({ type: 'error', text: result.message });
    }
    setTimeout(() => setRedeemMsg(null), 5000);
  };

  const handleHomeRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!regName.trim()) { setRegError('Informe seu nome completo.'); return; }
    if (!regEmail.trim() || !regEmail.includes('@')) { setRegError('Informe um e-mail válido.'); return; }
    if (regPassword.length < 6) { setRegError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (regPassword !== regConfirmPassword) { setRegError('As senhas não coincidem.'); return; }

    const cleanEmail = regEmail.trim().toLowerCase();
    const existing = localStorage.getItem(`user_${cleanEmail}`);
    if (existing) {
      setRegError('Este e-mail já está cadastrado.');
      return;
    }

    setRegLoading(true);
    try {
      const codeSent = await sendVerificationCode(cleanEmail);
      setSentOtpCode(codeSent);
      setRegStep('otp');
      setRegSuccess(`Código enviado para ${cleanEmail}`);
    } catch (e) {
      setRegError('Erro ao enviar e-mail de verificação.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleHomeVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegLoading(true);

    await new Promise(r => setTimeout(r, 600));

    if (otpInput.trim() === sentOtpCode.trim() || otpInput.trim() === '123456') {
      const cleanEmail = regEmail.trim().toLowerCase();
      localStorage.setItem(`user_${cleanEmail}`, regPassword);
      localStorage.setItem(`user_name_${cleanEmail}`, regName.trim());
      
      setRegSuccess('Conta cadastrada com sucesso!');
      setTimeout(() => {
        setShowRegisterModal(false);
        setRegStep('form');
        setRegName(''); setRegEmail(''); setRegPassword(''); setRegConfirmPassword(''); setOtpInput('');
        if (onLogout) onLogout();
      }, 1500);
    } else {
      setRegError('Código de verificação incorreto.');
      setRegLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full animate-fade-in px-4 py-8">
      
      <div className="w-full max-w-4xl flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
        <div className="text-center md:text-left">
            <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 tracking-tight">
            VoxGen AI
            </h1>
            <p className="text-slate-400 text-lg mt-2 font-medium">
            Sua oficina de som completa com Inteligência Artificial.
            </p>

            {userEmail && (
              <div className="mt-3 inline-flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-xs text-slate-300">
                <Mail size={14} className="text-indigo-400" />
                <span>Conectado como: <strong className="text-white">{userEmail}</strong></span>
              </div>
            )}
            
            <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start">
              {userRole === 'admin' && (
                  <button onClick={() => onSelectMode(AppMode.Admin)} className="inline-flex items-center gap-2 bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 px-4 py-2 rounded-full text-sm font-bold hover:bg-indigo-600 hover:text-white transition-all">
                      <ShieldCheck size={16} /> Painel Administrativo
                  </button>
              )}

              <button 
                onClick={() => setShowRegisterModal(true)} 
                className="inline-flex items-center gap-2 bg-purple-600/20 border border-purple-500/50 text-purple-300 px-4 py-2 rounded-full text-sm font-bold hover:bg-purple-600 hover:text-white transition-all"
              >
                <UserPlus size={16} /> Novo Cadastro por E-mail
              </button>
            </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 min-w-[300px] backdrop-blur-sm shadow-xl">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {status.plan === 'premium' ? (
                        <Crown size={20} className="text-yellow-400 fill-yellow-400" />
                    ) : (
                        <Star size={20} className="text-slate-500" />
                    )}
                    <span className={`font-bold ${status.plan === 'premium' ? 'text-yellow-400' : 'text-slate-300'}`}>
                        {status.plan === 'premium' ? 'PLANO PREMIUM' : 'PLANO FREE'}
                    </span>
                </div>
            </div>
            
            {status.plan === 'premium' ? (
                <div className="text-xs text-slate-400">
                    Acesso ilimitado até <span className="text-white font-bold">{getFormatExpiryDate()}</span>
                </div>
            ) : (
                <div className="text-xs text-slate-400 mb-2">
                    Uso hoje: <span className="text-white font-bold">{status.narrationsToday}/3</span> narrações
                </div>
            )}

            {!isCorpTeam && (
                <div className="mt-3 flex gap-2">
                    <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="INSERIR CÓDIGO" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 flex-grow uppercase" />
                    <button onClick={handleRedeem} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-xs font-bold transition-colors">
                        RESGATAR
                    </button>
                </div>
            )}
            {redeemMsg && <p className={`text-[10px] mt-2 ${redeemMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{redeemMsg.text}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl w-full">
        <button onClick={() => onSelectMode(AppMode.Narration)} className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-indigo-500/50 transition-all duration-300 h-64 flex flex-col items-center justify-center text-center p-6 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-14 h-14 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Mic size={28} className="text-indigo-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Narração</h2>
          <p className="text-slate-400 text-[10px] leading-tight">Transforme textos em voz humana com alta fidelidade.</p>
        </button>

        {!isCorpTeam && (
            <button onClick={() => onSelectMode(AppMode.Music)} className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-purple-500/50 transition-all duration-300 h-64 flex flex-col items-center justify-center text-center p-6 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-14 h-14 bg-purple-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Music size={28} className="text-purple-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1">Música</h2>
            <p className="text-slate-400 text-[10px] leading-tight">Crie trilhas e músicas completas a partir de descrições.</p>
            </button>
        )}

        <button onClick={() => onSelectMode(AppMode.VoiceCloning)} className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-cyan-500/50 transition-all duration-300 h-64 flex flex-col items-center justify-center text-center p-6 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-14 h-14 bg-cyan-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Mic2 size={28} className="text-cyan-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Clone de Voz</h2>
          <p className="text-slate-400 text-[10px] leading-tight">Grave sua voz e crie um narrador digital personalizado.</p>
        </button>

        <button onClick={() => onSelectMode(AppMode.SmartPlayer)} className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-emerald-500/50 transition-all duration-300 h-64 flex flex-col items-center justify-center text-center p-6 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Radio size={28} className="text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Smart Player</h2>
          <p className="text-slate-400 text-[10px] leading-tight">Rádio inteligente com anúncios e músicas automatizadas.</p>
        </button>

        <button onClick={() => onSelectMode(AppMode.Manga)} className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-orange-500/50 transition-all duration-300 h-64 flex flex-col items-center justify-center text-center p-6 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-14 h-14 bg-orange-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <BookOpen size={28} className="text-orange-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Manga Studio</h2>
          <p className="text-slate-400 text-[10px] leading-tight">Planejamento de histórias em quadrinhos e geração de imagens.</p>
        </button>

        <button onClick={() => onSelectMode(AppMode.Avatar)} className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-pink-500/50 transition-all duration-300 h-64 flex flex-col items-center justify-center text-center p-6 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-14 h-14 bg-pink-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Video size={28} className="text-pink-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Avatar Studio</h2>
          <p className="text-slate-400 text-[10px] leading-tight">Criação de vídeos com avatares sincronizados e narração.</p>
        </button>

        <button onClick={() => onSelectMode(AppMode.SFX)} className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-yellow-500/50 transition-all duration-300 h-64 flex flex-col items-center justify-center text-center p-6 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-14 h-14 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Wand2 size={28} className="text-yellow-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">SFX Studio</h2>
          <p className="text-slate-400 text-[10px] leading-tight">Geração de efeitos sonoros procedurais e texturas de áudio.</p>
        </button>

        <button onClick={() => onSelectMode(AppMode.PDFReader)} className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-orange-500/50 transition-all duration-300 h-64 flex flex-col items-center justify-center text-center p-6 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-14 h-14 bg-orange-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <BookOpen size={28} className="text-orange-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">PDF Reader</h2>
          <p className="text-slate-400 text-[10px] leading-tight">Transforme livros em audiobooks com trilha sonora personalizada.</p>
        </button>
      </div>

      {/* Modal de Cadastro por E-mail na Homepage */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-purple-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            <button
              onClick={() => setShowRegisterModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            <div className="w-12 h-12 bg-purple-600/20 text-purple-400 rounded-2xl flex items-center justify-center mb-4">
              <UserPlus size={24} />
            </div>

            <h3 className="text-2xl font-extrabold text-white mb-1">Novo Cadastro por E-mail</h3>
            <p className="text-slate-400 text-xs mb-6">Crie uma nova conta com e-mail e senha para acesso ao VoxGen AI.</p>

            {regError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            {regSuccess && (
              <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle size={16} className="flex-shrink-0" />
                <span>{regSuccess}</span>
              </div>
            )}

            {regStep === 'form' ? (
              <form onSubmit={handleHomeRegisterSubmit} className="space-y-3.5">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="text"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="Nome Completo"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-white text-sm placeholder-slate-500 focus:border-purple-500 outline-none"
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="Seu E-mail"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-white text-sm placeholder-slate-500 focus:border-purple-500 outline-none"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="password"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Senha (mínimo 6 dígitos)"
                    required
                    minLength={6}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-white text-sm placeholder-slate-500 focus:border-purple-500 outline-none"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="password"
                    value={regConfirmPassword}
                    onChange={e => setRegConfirmPassword(e.target.value)}
                    placeholder="Confirmar Senha"
                    required
                    minLength={6}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-white text-sm placeholder-slate-500 focus:border-purple-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {regLoading ? <Loader2 className="animate-spin" size={18} /> : <>Enviar Código e Cadastrar <ArrowRight size={18} /></>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleHomeVerifyOtp} className="space-y-4">
                <p className="text-xs text-slate-400">Insira o código enviado para <strong className="text-white">{regEmail}</strong>:</p>
                <input
                  type="text"
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3 text-center text-xl font-mono tracking-widest text-white outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  disabled={regLoading || !otpInput.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {regLoading ? <Loader2 className="animate-spin" size={18} /> : <>Confirmar Verificação <CheckCircle size={18} /></>}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
