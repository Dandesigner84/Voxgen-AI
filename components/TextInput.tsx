import React from 'react';
import { Type, X } from 'lucide-react';

interface TextInputProps {
  value: string;
  onChange: (text: string) => void;
  disabled: boolean;
}

const TextInput: React.FC<TextInputProps> = ({ value, onChange, disabled }) => {
  const MAX_CHARS = 10000;

  return (
    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 backdrop-blur-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-3">
        <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
          <Type size={16} className="text-indigo-400" />
          Roteiro de Entrada
        </label>
        <span className={`text-xs ${value.length > MAX_CHARS ? 'text-red-400' : 'text-slate-500'}`}>
          {value.length} / {MAX_CHARS}
        </span>
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