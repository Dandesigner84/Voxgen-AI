
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2, Copy, CheckCircle, Users, Tag, Ban, UserCheck, Search } from 'lucide-react';
import { generateCode, getStoredCodes, deleteCode } from '../services/monetizationService';
import { getAllUsers, toggleBanUser } from '../services/authService';
import { PremiumCode, User } from '../types';

const AdminPanel: React.FC = () => {
  const [tab, setTab] = useState<'codes' | 'users'>('codes');
  
  // Code State
  const [codes, setCodes] = useState<PremiumCode[]>([]);
  const [daysToGen, setDaysToGen] = useState(30);
  const [copied, setCopied] = useState<string | null>(null);

  // User State
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setCodes(getStoredCodes().reverse());
    setUsers(getAllUsers().reverse());
  };

  const handleGenerate = () => {
    generateCode(daysToGen);
    loadData();
  };

  const handleDeleteCode = (code: string) => {
    if (confirm('Tem certeza que deseja excluir este código?')) {
      deleteCode(code);
      loadData();
    }
  };

  const handleToggleBan = (userId: string) => {
    toggleBanUser(userId);
    loadData();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      <div className="bg-slate-800/50 border border-indigo-500/30 rounded-2xl p-8 shadow-xl">
        <div className="flex items-center justify-between mb-8 border-b border-slate-700 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center">
              <ShieldCheck size={24} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Painel Administrativo</h2>
              <p className="text-slate-400 text-sm">Controle Total do Sistema</p>
            </div>
          </div>
          
          <div className="flex bg-slate-900 p-1 rounded-lg">
            <button 
              onClick={() => setTab('codes')}
              className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all ${tab === 'codes' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <Tag size={16}/> Códigos
            </button>
            <button 
              onClick={() => setTab('users')}
              className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all ${tab === 'users' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <Users size={16}/> Usuários
            </button>
          </div>
        </div>

        {tab === 'codes' && (
          <div className="animate-fade-in">
            {/* Generator */}
            <div className="bg-slate-900 p-6 rounded-xl mb-8 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Gerar Novo Código Premium</h3>
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
                        <span>Criado: {new Date(code.createdAt).toLocaleDateString()}</span>
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
                        onClick={() => handleDeleteCode(code.code)}
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
        )}

        {tab === 'users' && (
          <div className="animate-fade-in">
            <div className="mb-6 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="Buscar usuário por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                {filteredUsers.map(user => (
                  <div key={user.id} className={`bg-slate-800 p-4 rounded-lg border flex items-center justify-between ${user.isBanned ? 'border-red-500/50 opacity-75' : 'border-slate-700'}`}>
                    <div className="flex items-center gap-4">
                      <img src={user.avatarUrl} className="w-10 h-10 rounded-full bg-slate-700" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={`font-bold ${user.isBanned ? 'text-red-400 line-through' : 'text-white'}`}>{user.name}</h4>
                          {user.role === 'admin' && <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2 rounded font-bold">ADMIN</span>}
                          <span className={`text-[10px] px-2 rounded font-bold uppercase ${user.plan === 'premium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-400'}`}>
                            {user.plan}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden md:block">
                        <p className="text-[10px] text-slate-500">Cadastro: {new Date(user.createdAt).toLocaleDateString()}</p>
                        <p className="text-[10px] text-slate-500">Último Login: {new Date(user.lastLogin).toLocaleDateString()}</p>
                      </div>
                      
                      {user.role !== 'admin' && (
                        <button 
                          onClick={() => handleToggleBan(user.id)}
                          className={`p-2 rounded transition-colors ${user.isBanned ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'}`}
                          title={user.isBanned ? "Reativar Conta" : "Banir Usuário"}
                        >
                          {user.isBanned ? <UserCheck size={18} /> : <Ban size={18} />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
