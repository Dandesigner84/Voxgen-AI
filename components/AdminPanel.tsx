
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2, Copy, CheckCircle } from 'lucide-react';
import { generateCode, getStoredCodes, deleteCode } from '../services/monetizationService';
import { PremiumCode } from '../types';

const AdminPanel: React.FC = () => {
  const [codes, setCodes] = useState<PremiumCode[]>([]);
  const [daysToGen, setDaysToGen] = useState(30);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = () => {
    setCodes(getStoredCodes().reverse());
  };

  const handleGenerate = () => {
    generateCode(daysToGen);
    loadCodes();
  };

  const handleDelete = (code: string) => {
    if (confirm('Tem certeza que deseja excluir este código?')) {
      deleteCode(code);
      loadCodes();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <div className="bg-slate-800/50 border border-indigo-500/30 rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center">
            <ShieldCheck size={24} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Painel Administrativo</h2>
            <p className="text-slate-400 text-sm">Gerenciar Códigos Premiados e Acessos</p>
          </div>
        </div>

        {/* Generator */}
        <div className="bg-slate-900 p-6 rounded-xl mb-8 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Gerar Novo Código</h3>
          <div className="flex gap-4 items-end">
            <div className="flex-grow">
              <label className="block text-xs text-slate-400 mb-2">Validade (Dias)</label>
              <select 
                value={daysToGen} 
                onChange={(e) => setDaysToGen(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white outline-none focus:border-indigo-500"
              >
                <option value={1}>1 Dia (Teste)</option>
                <option value={7}>7 Dias (Semanal)</option>
                <option value={14}>14 Dias (Quinzenal)</option>
                <option value={30}>30 Dias (Mensal)</option>
                <option value={365}>1 Ano (Anual)</option>
              </select>
            </div>
            <button 
              onClick={handleGenerate}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-colors h-[46px]"
            >
              <Plus size={18} /> Gerar Código
            </button>
          </div>
        </div>

        {/* List */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
            <span>Códigos Ativos</span>
            <span className="text-xs font-normal text-slate-400 bg-slate-900 px-2 py-1 rounded">{codes.length} gerados</span>
          </h3>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
            {codes.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-8">Nenhum código gerado ainda.</p>
            )}
            
            {codes.map((code) => (
              <div key={code.code} className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <code className="text-xl font-mono font-bold text-indigo-300">{code.code}</code>
                    {code.isRedeemed ? (
                      <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded uppercase font-bold">Resgatado</span>
                    ) : (
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded uppercase font-bold">Disponível</span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-slate-500">
                    <span>Validade: {code.days} dias</span>
                    <span>Gerado em: {new Date(code.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => copyToClipboard(code.code)}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                    title="Copiar"
                  >
                    {copied === code.code ? <CheckCircle size={18} className="text-green-400"/> : <Copy size={18} />}
                  </button>
                  <button 
                    onClick={() => handleDelete(code.code)}
                    className="p-2 bg-red-900/30 hover:bg-red-900/50 rounded text-red-400 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
