
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
        // Simulação de chamada ao Backend para validar ID Token
        // O Backend decodifica o JWT do Google de forma segura
        const idToken = response.credential;
        
        // Simulação de resposta do Backend /api/auth/google/verify
        await new Promise(r => setTimeout(r, 1000));
        
        // Em produção, isso viria decodificado do seu servidor
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
      client_id: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com", // Substituir por ID real
      callback: handleGoogleIdentityCallback,
      auto_select: false, // MANDATÓRIO: Desabilita seleção automática
      use_fedcm_for_prompt: false, // CORREÇÃO: Desabilita FedCM para evitar erro NotAllowedError em iframes sem permissão 'identity-credentials-get'
      itp_support: true,
    });

    /* 
    (window as any).google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Se o One Tap for bloqueado ou ignorado, não fazemos nada (fluxo manual)
            console.log('Google Identity Prompt skipped or not displayed');
        }
    });
    */
    
    // Renderiza o botão manual
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
        // Enviar idToken e intenção de acesso ao backend
        // Backend valida, cria sessão real (JWT/Cookie) e retorna
        await new Promise(r => setTimeout(r, 1200));

        // Simula verificação se o usuário existe ou precisa completar cadastro
        // Aqui assumimos acesso liberado
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4 font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-600/20 rounded-full blur-[128px]" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl shadow-2xl p-8 relative z-10 animate-fade-in">
        
        {step === 'login' && (
            <>
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 tracking-tight mb-2">
                    VoxGen AI
                  </h1>
                  <p className="text-slate-400 text-sm">Acesse seu estúdio criativo profissional</p>
                </div>

                <div className="space-y-5">
                    <div id="googleBtnManual" className="w-full min-h-[44px]"></div>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-700"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-500 text-xs uppercase font-bold">Ou via E-mail corporativo</span>
                        <div className="flex-grow border-t border-slate-700"></div>
                    </div>

                    {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-xs text-center border border-red-500/20">{error}</div>}

                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail profissional" className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-colors" />
                        </div>
                        <div className="relative">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-colors" />
                        </div>
                        <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2">
                            {loading ? <Loader2 className="animate-spin" /> : <>Entrar <ArrowRight size={18} /></>}
                        </button>
                    </form>
                </div>
            </>
        )}

        {/* --- TELA DE CONFIRMAÇÃO INTERMEDIÁRIA (Enterprise Standard) --- */}
        {step === 'google_confirm' && tempGoogleUser && (
            <div className="animate-fade-in text-center space-y-6">
                <div className="relative inline-block">
                    <img src={tempGoogleUser.picture} alt="Profile" className="w-24 h-24 rounded-full mx-auto border-4 border-indigo-500/30 shadow-xl" />
                    <div className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow-lg">
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.47 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                    </div>
                </div>

                <div>
                    <h3 className="text-white font-bold text-xl">Olá, {tempGoogleUser.name.split(' ')[0]}</h3>
                    <p className="text-slate-400 text-sm mt-1">Identidade verificada com {tempGoogleUser.email}</p>
                </div>

                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 text-left">
                    <p className="text-slate-300 text-xs leading-relaxed flex gap-2">
                        <ShieldCheck className="text-indigo-400 flex-shrink-0" size={16} />
                        Deseja prosseguir e autorizar o acesso à plataforma VoxGen AI Studio com este perfil?
                    </p>
                </div>

                <div className="space-y-3">
                    <button 
                        onClick={handleFinalGoogleConfirm}
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <>Confirmar Acesso <CheckCircle size={18} /></>}
                    </button>
                    <button 
                        onClick={() => setStep('login')}
                        disabled={loading}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-4 rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2"
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
