
import React, { useState } from 'react';
import { Mail, Lock, User, Chrome, ArrowRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { loginUser, registerUser, loginWithGoogle } from '../services/authService';
import { AppMode } from '../types';

interface AuthScreenProps {
  onLoginSuccess: () => void;
  onNavigateBack: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess, onNavigateBack }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form Data
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        const result = await loginUser(email, password);
        if (result.success) {
          onLoginSuccess();
        } else {
          setError(result.message);
        }
      } else {
        // Register Validations
        if (password !== confirmPass) {
          throw new Error("As senhas não coincidem.");
        }
        if (password.length < 6) {
          throw new Error("A senha deve ter no mínimo 6 caracteres.");
        }
        
        const result = await registerUser(name, email, password);
        if (result.success) {
          setSuccess("Conta criada! Entrando...");
          setTimeout(() => onLoginSuccess(), 1500);
        } else {
          setError(result.message);
        }
      }
    } catch (err: any) {
      setError(err.message || "Erro desconhecido.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    const result = await loginWithGoogle();
    if (result.success) {
      onLoginSuccess();
    } else {
      setError(result.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
        {/* Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-indigo-600/20 blur-3xl pointer-events-none" />

        <div className="p-8 relative z-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h2>
            <p className="text-slate-400 text-sm">
              {isLogin ? 'Entre para acessar seu estúdio criativo.' : 'Comece a criar narrações e músicas com IA.'}
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <button 
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full bg-white text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-100 transition-colors disabled:opacity-70"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Chrome size={20} />}
              Entrar com Google
            </button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink-0 mx-4 text-slate-600 text-xs uppercase">Ou continue com email</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-xs text-slate-400 ml-1">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-indigo-500 transition-colors"
                    placeholder="Seu nome"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-slate-400 ml-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-indigo-500 transition-colors"
                  placeholder="exemplo@email.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-indigo-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-1">
                <label className="text-xs text-slate-400 ml-1">Confirmar Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="password" 
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-indigo-500 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500/50 text-green-400 text-xs p-3 rounded-lg flex items-center gap-2">
                <CheckCircle2 size={14} />
                {success}
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-70 mt-4"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : isLogin ? 'Entrar na Plataforma' : 'Criar Conta Grátis'}
              {!isLoading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">
              {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
              <button 
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                  setSuccess(null);
                }}
                className="text-indigo-400 font-bold hover:text-indigo-300 ml-2 transition-colors"
              >
                {isLogin ? 'Registre-se' : 'Faça Login'}
              </button>
            </p>
          </div>
          
          <button onClick={onNavigateBack} className="w-full text-center text-slate-600 text-xs mt-4 hover:text-slate-400">
            Voltar ao Início
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
