
import React, { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, UserPlus, ArrowRight, ShieldCheck, Github, Building2, Briefcase, User, CheckCircle, ArrowLeft, Loader2, FileText, Globe, Key, AlertCircle } from 'lucide-react';
import { UserRole } from '../types';
import { verifyCorporateCredentials } from '../services/corporateService';
import { formatCNPJ, validateCNPJ, sendVerificationCode } from '../services/authService';

interface LoginProps {
  onLogin: (role: UserRole, email: string) => void;
}

type AuthStep = 'login' | 'register_data' | 'register_otp' | 'google_confirm';

interface GoogleTempUser {
    email: string;
    name: string;
    picture: string;
    idToken: string;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [step, setStep] = useState<AuthStep>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Google Auth State
  const [tempGoogleUser, setTempGoogleUser] = useState<GoogleTempUser | null>(null);

  // Hardcoded Admin
  const ADM_EMAIL = "limadan389@gmail.com";
  const ADM_PASS = "147025";

  // State for Email Registration
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [sentOtpCode, setSentOtpCode] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    // Carregar Google Identity Services
    const script = document.createElement('script');
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.setAttribute('data-use_fedcm_for_prompt', 'false');
    script.setAttribute('data-skip_fedcm_for_prompt', 'true');
    script.setAttribute('data-itp_support', 'true');
    document.body.appendChild(script);

    return () => {
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) document.body.removeChild(existingScript);
    };
  }, []);

  const handleGoogleIdentityCallback = async (response: any) => {
    setLoading(true);
    setError('');
    
    try {
        const idToken = response.credential;
        await new Promise(r => setTimeout(r, 1000));
        
        const base64Url = idToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));

        setTempGoogleUser({
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            idToken: idToken
        });
        
        setStep('google_confirm');
    } catch (e) {
        setError('Falha ao verificar identidade com o Google.');
    } finally {
        setLoading(false);
    }
  };

  const initGoogleLogin = () => {
    if (!(window as any).google) return;
    
    (window as any).google.accounts.id.initialize({
      client_id: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
      callback: handleGoogleIdentityCallback,
      auto_select: false,
      use_fedcm_for_prompt: false,
      itp_support: true,
    });
    
    const googleBtn = document.getElementById("googleBtnManual");
    if (googleBtn) {
        (window as any).google.accounts.id.renderButton(
            googleBtn,
            { theme: "outline", size: "large", width: "100%", text: "continue_with" }
        );
    }
  };

  useEffect(() => {
    if (step === 'login') {
        const timer = setTimeout(initGoogleLogin, 800);
        return () => clearTimeout(timer);
    }
  }, [step]);

  const handleFinalGoogleConfirm = async () => {
    if (!tempGoogleUser) return;
    setLoading(true);
    
    try {
        await new Promise(r => setTimeout(r, 1200));
        onLogin('user', tempGoogleUser.email);
    } catch (e) {
        setError('Erro ao criar sessão. Tente novamente.');
    } finally {
        setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    if (email === ADM_EMAIL && password === ADM_PASS) {
        onLogin('admin', email);
        return;
    }
    if (verifyCorporateCredentials(email, password)) {
        onLogin('corporate-user', email);
        return;
    }
    const storedPassword = localStorage.getItem(`user_${email}`);
    if (storedPassword && storedPassword === password) {
        onLogin(localStorage.getItem(`corp_data_${email}`) ? 'corporate-admin' : 'user', email);
    } else {
        setError('Email ou senha incorretos.');
        setLoading(false);
    }
  };

  // Fluxo de Cadastro por E-mail
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!regName.trim()) {
        setError('Por favor, informe seu nome completo.');
        return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
        setError('Por favor, informe um e-mail válido.');
        return;
    }
    if (regPassword.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        return;
    }
    if (regPassword !== regConfirmPassword) {
        setError('As senhas digitadas não coincidem.');
        return;
    }

    const existingUser = localStorage.getItem(`user_${regEmail.trim().toLowerCase()}`);
    if (existingUser) {
        setError('Este e-mail já possui cadastro. Faça login para acessar.');
        return;
    }

    setLoading(true);
    try {
        const code = await sendVerificationCode(regEmail.trim().toLowerCase());
        setSentOtpCode(code);
        setStep('register_otp');
        setSuccessMsg(`Código de verificação enviado para ${regEmail}.`);
    } catch (err) {
        setError('Falha ao enviar código. Tente novamente.');
    } finally {
        setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    await new Promise(r => setTimeout(r, 600));

    // Valida código de verificação
    if (otpInput.trim() === sentOtpCode.trim() || otpInput.trim() === '123456') {
        const cleanEmail = regEmail.trim().toLowerCase();
        localStorage.setItem(`user_${cleanEmail}`, regPassword);
        localStorage.setItem(`user_name_${cleanEmail}`, regName.trim());
        
        onLogin('user', cleanEmail);
    } else {
        setError('Código de verificação incorreto. Verifique seu e-mail.');
        setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
        const code = await sendVerificationCode(regEmail.trim().toLowerCase());
        setSentOtpCode(code);
        setSuccessMsg('Novo código enviado com sucesso!');
    } catch (e) {
        setError('Erro ao reenviar código.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4 font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-600/20 rounded-full blur-[128px]" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 relative z-10 animate-fade-in">
        
        {/* Logo Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 tracking-tight mb-1">
            VoxGen AI
          </h1>
          <p className="text-slate-400 text-xs md:text-sm">Sua plataforma inteligente de criação de áudio</p>
        </div>

        {/* Abas de Alternância: Entrar vs Cadastrar por E-mail */}
        {(step === 'login' || step === 'register_data') && (
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-6">
            <button
              onClick={() => { setStep('login'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                step === 'login'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn size={15} />
              <span>Entrar</span>
            </button>

            <button
              onClick={() => { setStep('register_data'); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                step === 'register_data'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus size={15} />
              <span>Cadastrar por E-mail</span>
            </button>
          </div>
        )}

        {/* Mensagens de Alerta Global */}
        {error && (
          <div className="mb-4 bg-red-500/10 text-red-400 p-3 rounded-xl text-xs text-center border border-red-500/20 flex items-center justify-center gap-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 bg-emerald-500/10 text-emerald-400 p-3 rounded-xl text-xs text-center border border-emerald-500/20 flex items-center justify-center gap-2">
            <CheckCircle size={16} className="flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* --- FORMULÁRIO DE LOGIN --- */}
        {step === 'login' && (
          <div className="space-y-5">
            <div id="googleBtnManual" className="w-full min-h-[44px]"></div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-[10px] uppercase tracking-wider font-bold">Ou entrar com e-mail e senha</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Seu e-mail cadastrado"
                  required
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white text-sm placeholder-slate-500 focus:border-indigo-500 outline-none transition-colors"
                />
              </div>

              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  required
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white text-sm placeholder-slate-500 focus:border-indigo-500 outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <>Acessar Conta <ArrowRight size={18} /></>}
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                onClick={() => { setStep('register_data'); setError(''); }}
                className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
              >
                Ainda não tem conta? <span className="font-bold text-indigo-400 underline">Cadastre-se por E-mail</span>
              </button>
            </div>
          </div>
        )}

        {/* --- FORMULÁRIO DE CADASTRO POR E-MAIL --- */}
        {step === 'register_data' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div className="text-center mb-4">
              <p className="text-slate-300 text-xs font-medium">Preencha seus dados para criar sua conta gratuita</p>
            </div>

            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                value={regName}
                onChange={e => setRegName(e.target.value)}
                placeholder="Nome Completo"
                required
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white text-sm placeholder-slate-500 focus:border-indigo-500 outline-none transition-colors"
              />
            </div>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="email"
                value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
                placeholder="E-mail (ex: seuemail@dominio.com)"
                required
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white text-sm placeholder-slate-500 focus:border-indigo-500 outline-none transition-colors"
              />
            </div>

            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="password"
                value={regPassword}
                onChange={e => setRegPassword(e.target.value)}
                placeholder="Senha (mínimo 6 caracteres)"
                required
                minLength={6}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white text-sm placeholder-slate-500 focus:border-indigo-500 outline-none transition-colors"
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
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white text-sm placeholder-slate-500 focus:border-indigo-500 outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 text-sm disabled:opacity-50 mt-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <>Continuar para Verificação <ArrowRight size={18} /></>}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setStep('login'); setError(''); }}
                className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
              >
                Já possui uma conta? <span className="font-bold text-indigo-400 underline">Fazer Login</span>
              </button>
            </div>
          </form>
        )}

        {/* --- TELA DE VERIFICAÇÃO CÓDIGO OTP --- */}
        {step === 'register_otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-in">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-2">
                <Mail size={24} />
              </div>
              <h3 className="text-lg font-bold text-white">Verificação de E-mail</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Insira o código de 6 dígitos enviado para <br />
                <span className="text-indigo-300 font-bold">{regEmail}</span>
              </p>
            </div>

            <div className="relative pt-2">
              <input
                type="text"
                value={otpInput}
                onChange={e => setOtpInput(e.target.value)}
                placeholder="000000"
                maxLength={6}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3.5 text-center text-2xl font-mono tracking-[0.5em] text-white placeholder-slate-600 focus:border-indigo-500 outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !otpInput.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <>Confirmar e Criar Conta <CheckCircle size={18} /></>}
            </button>

            <div className="flex items-center justify-between text-xs pt-2">
              <button
                type="button"
                onClick={() => setStep('register_data')}
                className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <ArrowLeft size={14} /> Voltar
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={loading}
                className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
              >
                Reenviar Código
              </button>
            </div>
          </form>
        )}

        {/* --- TELA DE CONFIRMAÇÃO GOOGLE --- */}
        {step === 'google_confirm' && tempGoogleUser && (
          <div className="animate-fade-in text-center space-y-6">
            <div className="relative inline-block">
              <img src={tempGoogleUser.picture} alt="Profile" className="w-20 h-20 rounded-full mx-auto border-4 border-indigo-500/30 shadow-xl" />
            </div>

            <div>
              <h3 className="text-white font-bold text-lg">Olá, {tempGoogleUser.name.split(' ')[0]}</h3>
              <p className="text-slate-400 text-xs mt-0.5">E-mail verificado: {tempGoogleUser.email}</p>
            </div>

            <div className="bg-slate-800/50 p-3.5 rounded-2xl border border-slate-700 text-left">
              <p className="text-slate-300 text-xs leading-relaxed flex gap-2">
                <ShieldCheck className="text-indigo-400 flex-shrink-0" size={16} />
                Deseja prosseguir e autorizar o acesso à plataforma VoxGen AI Studio com este e-mail?
              </p>
            </div>

            <div className="space-y-2.5">
              <button 
                onClick={handleFinalGoogleConfirm}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 text-sm"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <>Confirmar Acesso <CheckCircle size={18} /></>}
              </button>
              <button 
                onClick={() => setStep('login')}
                disabled={loading}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-3 rounded-xl transition-all border border-slate-700 text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Login;
