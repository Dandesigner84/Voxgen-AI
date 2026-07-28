import React, { useState, useRef } from 'react';
import { 
  Users, MessageSquare, Sparkles, Play, Pause, Plus, Trash2, ArrowUp, ArrowDown, 
  Volume2, Download, Radio, Send, Loader2, Check, RefreshCw, Wand2, Zap, Layers 
} from 'lucide-react';
import { VOICE_OPTIONS, SFX_COMMANDS_HELP } from '../constants';
import { AudioItem } from '../types';
import { 
  SpeakerConfig, DialogueLine, DIALOGUE_PRESETS, 
  generateDialogueScriptWithAI, generateDialogueAudio 
} from '../services/dialogueService';
import { generateSpeech } from '../services/geminiService';
import { decodeAudioData } from '../utils/audioUtils';

interface DialogueStudioProps {
  onAudioGenerated?: (item: AudioItem) => void;
  isPremium?: boolean;
}

export const DialogueStudio: React.FC<DialogueStudioProps> = ({ onAudioGenerated, isPremium = true }) => {
  // Configuração dos Dois Personagens
  const [speakerA, setSpeakerA] = useState<SpeakerConfig>({
    id: 'speakerA',
    roleLabel: 'Vendedor / Atendente',
    voice: 'Kore'
  });

  const [speakerB, setSpeakerB] = useState<SpeakerConfig>({
    id: 'speakerB',
    roleLabel: 'Cliente / Ouvinte',
    voice: 'Zephyr'
  });

  // Linhas do Roteiro
  const [lines, setLines] = useState<DialogueLine[]>(DIALOGUE_PRESETS[0].lines.map((l, idx) => ({
    id: `init_${idx}`,
    speakerId: l.speakerId,
    text: l.text
  })));

  // Prompt de Situação para Gerar com IA
  const [aiSituationPrompt, setAiSituationPrompt] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  // Sintetização do Áudio Completo
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [pauseDuration, setPauseDuration] = useState(0.35); // Pausa em segundos entre falas

  // Resultado
  const [generatedAudioBuffer, setGeneratedAudioBuffer] = useState<AudioBuffer | null>(null);
  const [generatedAudioBase64, setGeneratedAudioBase64] = useState<string | null>(null);
  const [isPlayingFullAudio, setIsPlayingFullAudio] = useState(false);
  const [previewLineId, setPreviewLineId] = useState<string | null>(null);

  // Status de Envio para Smart Play
  const [sentToSmartPlay, setSentToSmartPlay] = useState(false);

  // Refs de Áudio
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Carregar Preset Pronto
  const handleLoadPreset = (presetId: string) => {
    const preset = DIALOGUE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    setSpeakerA({ ...speakerA, roleLabel: preset.speakerA.roleLabel, voice: preset.speakerA.voice });
    setSpeakerB({ ...speakerB, roleLabel: preset.speakerB.roleLabel, voice: preset.speakerB.voice });
    setLines(preset.lines.map((l, idx) => ({
      id: `preset_${Date.now()}_${idx}`,
      speakerId: l.speakerId,
      text: l.text
    })));
    setGeneratedAudioBuffer(null);
    setGeneratedAudioBase64(null);
    setSentToSmartPlay(false);
  };

  // Gerar Roteiro Inteligente com IA
  const handleGenerateAIScript = async () => {
    if (!aiSituationPrompt.trim()) return;
    setIsGeneratingScript(true);
    try {
      const generatedLines = await generateDialogueScriptWithAI(
        aiSituationPrompt,
        speakerA,
        speakerB
      );
      setLines(generatedLines);
      setGeneratedAudioBuffer(null);
      setGeneratedAudioBase64(null);
      setSentToSmartPlay(false);
    } catch (err) {
      console.error("Erro ao gerar roteiro:", err);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Funções de Edição do Roteiro
  const handleAddLine = (speakerId: 'speakerA' | 'speakerB') => {
    const newLine: DialogueLine = {
      id: `line_${Date.now()}`,
      speakerId,
      text: ''
    };
    setLines(prev => [...prev, newLine]);
  };

  const handleUpdateLine = (id: string, text: string) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, text } : l));
  };

  const handleToggleSpeaker = (id: string) => {
    setLines(prev => prev.map(l => l.id === id ? { 
      ...l, 
      speakerId: l.speakerId === 'speakerA' ? 'speakerB' : 'speakerA' 
    } : l));
  };

  const handleDeleteLine = (id: string) => {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const handleMoveLine = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lines.length) return;
    const newLines = [...lines];
    const temp = newLines[index];
    newLines[index] = newLines[targetIndex];
    newLines[targetIndex] = temp;
    setLines(newLines);
  };

  const handleInsertSFX = (lineId: string, sfx: string) => {
    setLines(prev => prev.map(l => l.id === lineId ? {
      ...l,
      text: l.text ? `${l.text} ${sfx}` : sfx
    } : l));
  };

  // Testar Falar uma Linha Individual
  const handlePreviewLine = async (line: DialogueLine) => {
    if (!line.text.trim()) return;
    try {
      setPreviewLineId(line.id);
      const ctx = getAudioContext();
      const voice = line.speakerId === 'speakerB' ? speakerB.voice : speakerA.voice;
      const b64 = await generateSpeech(line.text, voice);
      if (b64) {
        const buffer = await decodeAudioData(b64, ctx);
        if (activeSourceNodeRef.current) {
          activeSourceNodeRef.current.stop();
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => setPreviewLineId(null);
        activeSourceNodeRef.current = source;
        source.start(0);
      }
    } catch (e) {
      console.error("Erro ao pré-visualizar linha:", e);
      setPreviewLineId(null);
    }
  };

  // Gerar Áudio Completo do Diálogo
  const handleGenerateFullDialogue = async () => {
    const validLines = lines.filter(l => l.text.trim().length > 0);
    if (validLines.length === 0) return;

    setIsGeneratingAudio(true);
    setProgress({ current: 0, total: validLines.length });
    setSentToSmartPlay(false);

    try {
      const ctx = getAudioContext();
      const result = await generateDialogueAudio(
        validLines,
        speakerA,
        speakerB,
        ctx,
        pauseDuration,
        (current, total) => setProgress({ current, total })
      );

      setGeneratedAudioBuffer(result.audioBuffer);
      setGeneratedAudioBase64(result.audioBase64);

      // Criar item de áudio final para histórico
      const titleText = `Diálogo: ${speakerA.roleLabel} & ${speakerB.roleLabel} (${validLines.length} falas)`;
      const newAudioItem: AudioItem = {
        id: `dialogue_${Date.now()}`,
        text: `${titleText}\n\n${result.textSummary}`,
        voice: `${speakerA.voice} + ${speakerB.voice}`,
        audioData: result.audioBuffer,
        createdAt: new Date(),
        duration: result.duration
      };

      if (onAudioGenerated) {
        onAudioGenerated(newAudioItem);
      }

      // Notificar o Smart Play via Custom Event
      const smartPlayDetail = {
        id: newAudioItem.id,
        niche: `💬 Diálogo (${speakerA.roleLabel} / ${speakerB.roleLabel})`,
        location: 'Vozes Simuladas VoxGen',
        scriptText: result.textSummary,
        audioData: result.audioBuffer,
        audioBase64: result.audioBase64,
        createdAt: new Date().toISOString(),
        duration: result.duration,
        voice: `${speakerA.voice} / ${speakerB.voice}`,
        generationStatus: 'success',
        playbackStatus: 'queued'
      };

      window.dispatchEvent(new CustomEvent('voxgen-boletim-created', { detail: smartPlayDetail }));

    } catch (err) {
      console.error("Erro ao sintetizar diálogo completo:", err);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Reproduzir Áudio Completo
  const togglePlayFullAudio = () => {
    if (!generatedAudioBuffer) return;
    const ctx = getAudioContext();

    if (isPlayingFullAudio) {
      if (activeSourceNodeRef.current) {
        activeSourceNodeRef.current.stop();
        activeSourceNodeRef.current = null;
      }
      setIsPlayingFullAudio(false);
    } else {
      const source = ctx.createBufferSource();
      source.buffer = generatedAudioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlayingFullAudio(false);
      activeSourceNodeRef.current = source;
      source.start(0);
      setIsPlayingFullAudio(true);
    }
  };

  // Baixar Áudio
  const handleDownload = () => {
    if (!generatedAudioBase64) return;
    const link = document.createElement('a');
    link.href = `data:audio/wav;base64,${generatedAudioBase64}`;
    link.download = `dialogo_voxgen_${Date.now()}.wav`;
    link.click();
  };

  return (
    <div className="space-y-8">
      {/* Banner de Apresentação */}
      <div className="bg-gradient-to-r from-indigo-900/60 via-slate-900 to-emerald-900/40 p-6 rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Users size={160} className="text-indigo-300" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14} /> Diálogo Multivoz
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                Novo Recurso
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Simulador de Diálogos entre Duas Vozes
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Crie conversas dinâmicas para anúncios comerciais, rádios, podcasts, peças de teatro e cenas de atendimento. Monte o roteiro com IA ou escreva linha a linha.
            </p>
          </div>
        </div>
      </div>

      {/* Seção 1: Presets Prontos & Configuração dos Narradores */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Presets Rápidos */}
        <div className="lg:col-span-12 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Zap size={14} className="text-amber-400" /> Modelos Rápidos de Diálogo
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DIALOGUE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleLoadPreset(preset.id)}
                className="p-3.5 bg-slate-800/80 hover:bg-indigo-900/40 border border-slate-700/80 hover:border-indigo-500/50 rounded-2xl text-left transition-all group flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                    {preset.category}
                  </span>
                  <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                    {preset.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-snug">
                    {preset.description}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="truncate">🗣️ {preset.speakerA.roleLabel} & {preset.speakerB.roleLabel}</span>
                  <span className="text-indigo-400 font-bold group-hover:translate-x-0.5 transition-transform">Usar →</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Configuração de Voz A */}
        <div className="lg:col-span-6 bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-xl space-y-4 relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Personagem A <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full">Voz 1</span>
              </h3>
              <p className="text-xs text-slate-400">Defina o nome do papel e a voz do primeiro narrador</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-300 mb-1 block">Nome/Papel no Diálogo</label>
              <input
                type="text"
                value={speakerA.roleLabel}
                onChange={(e) => setSpeakerA({ ...speakerA, roleLabel: e.target.value })}
                placeholder="Ex: Atendente, Locutor A, Vendedor"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 mb-1 block">Voz do Personagem A</label>
              <select
                value={speakerA.voice}
                onChange={(e) => setSpeakerA({ ...speakerA, voice: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {VOICE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Configuração de Voz B */}
        <div className="lg:col-span-6 bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-xl space-y-4 relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Personagem B <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full">Voz 2</span>
              </h3>
              <p className="text-xs text-slate-400">Defina o nome do papel e a voz do segundo narrador</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-300 mb-1 block">Nome/Papel no Diálogo</label>
              <input
                type="text"
                value={speakerB.roleLabel}
                onChange={(e) => setSpeakerB({ ...speakerB, roleLabel: e.target.value })}
                placeholder="Ex: Cliente, Locutor B, Entrevistado"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 mb-1 block">Voz do Personagem B</label>
              <select
                value={speakerB.voice}
                onChange={(e) => setSpeakerB({ ...speakerB, voice: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {VOICE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Seção 2: Gerador de Roteiro com IA */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
              <Wand2 size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Criar Roteiro Automático com IA</h3>
              <p className="text-xs text-slate-400">Descreva a situação desejada e a IA criará o diálogo no tom perfeito</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={aiSituationPrompt}
            onChange={(e) => setAiSituationPrompt(e.target.value)}
            placeholder="Ex: Cliente reclamando do preço da pizza e o atendente oferecendo promoção de 2 pizzas pelo preço de 1..."
            className="flex-grow bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleGenerateAIScript}
            disabled={isGeneratingScript || !aiSituationPrompt.trim()}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition-all flex-shrink-0"
          >
            {isGeneratingScript ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Gerando Roteiro...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Gerar Roteiro Inteligente
              </>
            )}
          </button>
        </div>
      </div>

      {/* Seção 3: Editor Interativo de Falas (Linha a Linha) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare size={18} className="text-indigo-400" /> Editor de Falas do Diálogo
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Edite o texto de cada participante, altere a ordem e teste a narração individual de cada linha.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAddLine('speakerA')}
              className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Plus size={14} /> + Fala ({speakerA.roleLabel})
            </button>
            <button
              onClick={() => handleAddLine('speakerB')}
              className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Plus size={14} /> + Fala ({speakerB.roleLabel})
            </button>
          </div>
        </div>

        {/* Lista de Linhas do Diálogo */}
        <div className="space-y-3.5">
          {lines.map((line, index) => {
            const isSpeakerA = line.speakerId === 'speakerA';
            const speakerConfig = isSpeakerA ? speakerA : speakerB;

            return (
              <div
                key={line.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isSpeakerA
                    ? 'bg-slate-800/80 border-indigo-500/30 hover:border-indigo-500/50'
                    : 'bg-slate-800/80 border-emerald-500/30 hover:border-emerald-500/50'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleSpeaker(line.id)}
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                        isSpeakerA
                          ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/50'
                          : 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/50'
                      }`}
                      title="Clique para alternar o participante desta fala"
                    >
                      <Users size={12} />
                      {speakerConfig.roleLabel} ({speakerConfig.voice})
                      <RefreshCw size={10} className="ml-1 opacity-70" />
                    </button>
                    <span className="text-[10px] text-slate-500 font-mono">
                      #{index + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Botão de Testar Linha Individual */}
                    <button
                      onClick={() => handlePreviewLine(line)}
                      disabled={previewLineId === line.id || !line.text.trim()}
                      className="p-2 bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                      title="Ouvir prévia apenas desta fala"
                    >
                      {previewLineId === line.id ? (
                        <Loader2 size={12} className="animate-spin text-indigo-400" />
                      ) : (
                        <Volume2 size={12} />
                      )}
                      <span className="hidden sm:inline text-[11px]">Testar Fala</span>
                    </button>

                    {/* Mover Linha */}
                    <button
                      onClick={() => handleMoveLine(index, 'up')}
                      disabled={index === 0}
                      className="p-1.5 bg-slate-700/40 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg disabled:opacity-30"
                      title="Mover para cima"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      onClick={() => handleMoveLine(index, 'down')}
                      disabled={index === lines.length - 1}
                      className="p-1.5 bg-slate-700/40 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg disabled:opacity-30"
                      title="Mover para baixo"
                    >
                      <ArrowDown size={12} />
                    </button>

                    {/* Deletar Linha */}
                    <button
                      onClick={() => handleDeleteLine(line.id)}
                      disabled={lines.length <= 1}
                      className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg disabled:opacity-30 ml-1"
                      title="Remover fala"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Input do Texto da Fala */}
                <textarea
                  value={line.text}
                  onChange={(e) => handleUpdateLine(line.id, e.target.value)}
                  placeholder={`Digite a fala de ${speakerConfig.roleLabel}...`}
                  rows={2}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />

                {/* Tags Rápidas de Efeitos Sonoros */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase mr-1">Inserir SFX:</span>
                  {['(buzina)', '(aplausos)', '(risada)', '(caixa)', '(sino)'].map((sfx) => (
                    <button
                      key={sfx}
                      onClick={() => handleInsertSFX(line.id, sfx)}
                      className="px-2 py-0.5 bg-slate-900/60 hover:bg-indigo-900/40 border border-slate-700 hover:border-indigo-500/40 rounded-lg text-[10px] text-slate-300 transition-colors"
                    >
                      + {sfx}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Ajuste de Pausa entre Falas e Botão Principal de Geração */}
        <div className="pt-4 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Pausa entre falas:</span>
            <div className="flex items-center gap-1.5">
              {[0.2, 0.35, 0.5, 0.8].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setPauseDuration(sec)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    pauseDuration === sec
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerateFullDialogue}
            disabled={isGeneratingAudio || lines.filter(l => l.text.trim()).length === 0}
            className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/20 transition-all"
          >
            {isGeneratingAudio ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Sintetizando Diálogo ({progress.current}/{progress.total})...
              </>
            ) : (
              <>
                <Sparkles size={18} /> Sintetizar Áudio Completo do Diálogo
              </>
            )}
          </button>
        </div>
      </div>

      {/* Seção 4: Reprodução e Envio do Diálogo Gerado */}
      {generatedAudioBuffer && (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-600/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                <Radio size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Áudio do Diálogo Concluído! <Check size={18} className="text-emerald-400" />
                </h3>
                <p className="text-xs text-slate-400">
                  Duração total: <strong className="text-emerald-300">{Math.round(generatedAudioBuffer.duration)} segundos</strong> • Vozes: {speakerA.roleLabel} & {speakerB.roleLabel}
                </p>
              </div>
            </div>

            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold">
              Pronto para Reproduzir
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={togglePlayFullAudio}
              className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              {isPlayingFullAudio ? (
                <>
                  <Pause size={16} /> Pausar
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" /> Ouvir Diálogo Completo
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all"
            >
              <Download size={16} /> Baixar WAV
            </button>

            <div className="ml-auto text-xs text-slate-400 flex items-center gap-1.5 bg-slate-800/80 px-3.5 py-2.5 rounded-2xl border border-slate-700">
              <Check size={14} className="text-emerald-400" /> Enviado automaticamente para a Fila do Smart Play
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
