
import React from 'react';
import { Type, X, Sparkles, Loader2, Wand2 } from 'lucide-react';
import { ToneType } from '../types';

interface TextInputProps {
  value: string;
  onChange: (text: string) => void;
  disabled: boolean;
  selectedTone: ToneType | string;
  onOptimize: () => void;
  isOptimizing: boolean;
  onAutoSFX: () => void; // Novo prop
  isAddingSFX: boolean; // Novo prop
}

const TextInput: React.FC<TextInputProps> = ({ 
  value, 
  onChange, 
  disabled, 
  selectedTone, 
  onOptimize, 
  isOptimizing,
  onAutoSFX,
  isAddingSFX
}) => {
  const MAX_CHARS = 10000;

  return (
    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 backdrop-blur-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-3">
        <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
          <Type size={16} className="text-indigo-400" />
          Roteiro de Entrada
        </label>
        
        <div className="flex items-center gap-2">
            {/* Botão de Auto SFX */}
            <button
                onClick={onAutoSFX}
                disabled={disabled || isAddingSFX || !value.trim()}
                className="flex items-center gap-1.5 px-3 py-1 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/50 text-yellow-400 text-xs rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Inserir Efeitos Sonoros automaticamente com IA"
            >
                {isAddingSFX ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12} />}
                {isAddingSFX ? 'Analisando...' : 'Auto SFX'}
            </button>

            {/* Botão de Otimização Explícita - Agora visível para todos os tons */}
            <button
                onClick={onOptimize}
                disabled={disabled || isOptimizing || !value.trim()}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 text-xs rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title={selectedTone === ToneType.Neutral ? "Melhorar clareza e correção" : `Reescrever texto no estilo ${selectedTone}`}
            >
                {isOptimizing ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12} />}
                {isOptimizing ? 'Adaptando...' : (selectedTone === ToneType.Neutral ? 'Melhorar Texto' : 'Adaptar Texto')}
            </button>

            <span className={`text-xs ml-2 ${value.length > MAX_CHARS ? 'text-red-400' : 'text-slate-500'}`}>
            {value.length} / {MAX_CHARS}
            </span>
        </div>
      </div>
      <div className="relative flex-grow">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
          disabled={disabled}
          placeholder="Digite seu texto aqui... (ex: 'Olá! Estou ansioso para trabalhar com você.')"
          className="w-full h-full min-h-[160px] bg-slate-900/50 text-slate-100 p-4 rounded-lg border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none text-lg leading-relaxed placeholder:text-slate-600"
          spellCheck={false}
        />
        {value && !disabled && (
          <button 
            onClick={() => onChange('')}
            className="absolute top-2 right-2 p-1 text-slate-600 hover:text-slate-300 transition-colors rounded-full hover:bg-slate-800"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default TextInput;
