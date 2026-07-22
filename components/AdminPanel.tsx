
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2, Copy, CheckCircle, Mic2, UserMinus, UserCheck, Users, UserPlus, Building2, Ticket } from 'lucide-react';
import { generateCode, getStoredCodes, deleteCode } from '../services/monetizationService';
import { getAllOfficialVoices, updateVoiceStatus, deleteCustomVoice } from '../services/voiceService';
import { getCorporateAccounts, addCorporateAccount, removeCorporateAccount, CorporateAccount } from '../services/corporateService';
import { PremiumCode, CustomVoice, UserRole } from '../types';

interface AdminPanelProps {
  userRole?: UserRole;
  userEmail?: string;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ userRole = 'admin', userEmail }) => {
  // O usuário limadan389@gmail.com é o Super Admin da plataforma
  const isSuperAdmin = userEmail === 'limadan389@gmail.com' || userRole === 'admin';
  const isCorporate = userRole === 'corporate-admin' && !isSuperAdmin;
  
  const [activeTab, setActiveTab] = useState<'codes' | 'voices' | 'team'>(isSuperAdmin ? 'codes' : 'team');
  
  // Platform Admin State
  const [codes, setCodes] = useState<PremiumCode[]>([]);
  const [daysToGen, setDaysToGen] = useState(30);
  const [copied, setCopied] = useState<string | null>(null);
  const [managedVoices, setManagedVoices] = useState<CustomVoice[]>([]);

  // Corporate Admin State
  const [teamMembers, setTeamMembers] = useState<CorporateAccount[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPass, setNewMemberPass] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab, isSuperAdmin, isCorporate]);

  const loadData = () => {
    if (isSuperAdmin) {
        if (activeTab === 'codes') setCodes(getStoredCodes().reverse());
        if (activeTab === 'voices') setManagedVoices(getAllOfficialVoices());
        if (activeTab === 'team') setTeamMembers(getCorporateAccounts());
    } else if (isCorporate) {
        setTeamMembers(getCorporateAccounts());
    }
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleIncludeNarrator = (id: string) => {
      if (confirm('Deseja INCLUIR este narrador na lista oficial da plataforma?')) {
        updateVoiceStatus(id, 'official_approved', 'Parabéns! Sua voz foi aprovada.');
        loadData();
      }
  };

  const handleExcludeNarrator = (id: string) => {
      if (confirm('Excluir permanentemente este narrador?')) {
          deleteCustomVoice(id);
          loadData();
      }
  };

  const handleAddMember = (e: React.FormEvent) => {
      e.preventDefault();
      const result = addCorporateAccount({ email: newMemberEmail, password: newMemberPass, name: newMemberName });
      if (result.success) {
          setNewMemberEmail(''); setNewMemberPass(''); setNewMemberName('');
          loadData();
      } else { alert(result.message); }
  };

  const handleRemoveMember = (email: string) => {
    if (confirm('Tem certeza que deseja remover este membro da equipe?')) {
      removeCorporateAccount(email);
      loadData();
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      <div className="bg-slate-800/50 border border-indigo-500/30 rounded-2xl p-6 md:p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-8 border-b border-slate-700 pb-6">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center">
            <ShieldCheck size={28} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Painel de Controle</h2>
            <p className="text-slate-400 text-sm">
                {isSuperAdmin ? 'Administração Global do VoxGen AI' : 'Gestão de Unidade Corporativa'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
            {isSuperAdmin && (
                <>
                    <button onClick={() => setActiveTab('codes')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'codes' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>
                        <Ticket size={18} /> Códigos Premium
                    </button>
                    <button onClick={() => setActiveTab('voices')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'voices' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>
                        <Mic2 size={18} /> Narradores Oficiais
                    </button>
                </>
            )}
            <button onClick={() => setActiveTab('team')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'team' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>
                <Users size={18} /> Equipe & Unidades
            </button>
        </div>

        {/* Content Section */}
        <div className="space-y-6">
            {activeTab === 'codes' && isSuperAdmin && (
                <div className="animate-fade-in">
                    <div className="bg-slate-900 p-6 rounded-2xl mb-8 border border-slate-700">
                        <h3 className="text-white font-bold mb-4">Gerar Novo Acesso Premium</h3>
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="w-full md:w-64">
                                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Período de Validade</label>
                                <select value={daysToGen} onChange={(e) => setDaysToGen(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm outline-none focus:border-indigo-500">
                                    <option value={7}>7 Dias (Teste)</option>
                                    <option value={30}>30 Dias (Mensal)</option>
                                    <option value={90}>90 Dias (Trimestral)</option>
                                    <option value={365}>1 Ano (Anual)</option>
                                </select>
                            </div>
                            <button onClick={handleGenerate} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/20">
                                <Plus size={20} /> Gerar Cupom
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {codes.map((code) => (
                            <div key={code.code} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors">
                                <div className="flex items-center gap-4">
                                    <code className="text-xl font-mono font-bold text-indigo-400 bg-slate-950 px-3 py-1 rounded-lg border border-indigo-900/50">{code.code}</code>
                                    <div className="hidden sm:block">
                                        <p className="text-xs text-white font-bold">{code.days} Dias de Acesso</p>
                                        <p className="text-[10px] text-slate-500 italic">{code.isRedeemed ? 'Resgatado' : 'Aguardando uso'}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => copyToClipboard(code.code)} className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">
                                        {copied === code.code ? <CheckCircle size={18} className="text-green-400"/> : <Copy size={18} />}
                                    </button>
                                    <button onClick={() => handleDeleteCode(code.code)} className="p-2.5 bg-red-900/20 hover:bg-red-900/40 rounded-lg text-red-400">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'voices' && isSuperAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                    {managedVoices.map(voice => (
                        <div key={voice.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-700 flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="font-bold text-white text-lg">{voice.name}</h4>
                                    <p className="text-xs text-slate-500">{voice.userId}</p>
                                </div>
                                <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${voice.category === 'official_approved' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                                    {voice.category === 'official_approved' ? 'Aprovado' : 'Candidato'}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                {voice.category !== 'official_approved' && (
                                    <button onClick={() => handleIncludeNarrator(voice.id)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg text-xs font-bold transition-all">
                                        Aprovar
                                    </button>
                                )}
                                <button onClick={() => handleExcludeNarrator(voice.id)} className="flex-1 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 py-2 rounded-lg text-xs font-bold transition-all">
                                    Excluir
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'team' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                    <div className="lg:col-span-1 bg-slate-900 p-6 rounded-2xl border border-slate-700 h-fit">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2"><UserPlus size={18}/> Novo Usuário</h3>
                        <form onSubmit={handleAddMember} className="space-y-4">
                            <input type="text" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white" placeholder="Nome / Identificação" required />
                            <input type="email" value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white" placeholder="email@empresa.com" required />
                            <input type="text" value={newMemberPass} onChange={e => setNewMemberPass(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white" placeholder="Senha Inicial" required />
                            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-indigo-900/20">
                                Criar Acesso
                            </button>
                        </form>
                    </div>
                    <div className="lg:col-span-2 space-y-3">
                        {teamMembers.map(member => (
                            <div key={member.email} className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex justify-between items-center group">
                                <div>
                                    <p className="text-white font-bold">{member.name}</p>
                                    <p className="text-slate-400 text-xs">{member.email}</p>
                                </div>
                                <button onClick={() => handleRemoveMember(member.email)} className="p-2 text-slate-500 hover:text-red-400 transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
