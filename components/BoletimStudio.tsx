import React, { useState, useEffect, useRef } from 'react';
import { 
  Newspaper, Radio, Sparkles, Clock, Globe, MapPin, Sliders, Play, Square, 
  Upload, Youtube, CheckCircle, AlertTriangle, RefreshCw, Volume2, Music, 
  Layers, Send, Check, Loader2, Info, ChevronRight, Shield, Zap, Trash2
} from 'lucide-react';
import { VoiceName, ToneType, UserRole } from '../types';
import { VOICE_OPTIONS } from '../constants';
import { 
  BoletimConfig, 
  BoletimHistoryItem, 
  DEFAULT_BOLETIM_CONFIG, 
  BOLETIM_PRESETS,
  loadBoletimConfig, 
  saveBoletimConfig, 
  getDailyBoletimUsage, 
  executeBoletimGeneration, 
  getBoletimHistory, 
  fetchYouTubeMetadata,
  YouTubeMetadata 
} from '../services/boletimService';

const NICHES = [
  'Promoções e Varejo',
  'Política',
  'Economia',
  'Agronegócio',
  'Tecnologia',
  'Esportes',
  'Saúde',
  'Trânsito',
  'Clima',
  'Notícias Locais',
  'Segurança',
  'Educação',
  'Personalizado'
];

interface BoletimStudioProps {
  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;
  userRole?: UserRole;
  userEmail?: string;
}

export const BoletimStudio: React.FC<BoletimStudioProps> = ({
  audioContext,
  initAudioContext,
  userRole = 'user'
}) => {
  const currentRole: UserRole = userRole as UserRole;
  const [config, setConfig] = useState<BoletimConfig>(loadBoletimConfig());
  const [usage, setUsage] = useState(getDailyBoletimUsage(currentRole));
  const [history, setHistory] = useState<BoletimHistoryItem[]>(getBoletimHistory());
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // YouTube States
  const [ytUrl, setYtUrl] = useState('');
  const [isFetchingYt, setIsFetchingYt] = useState(false);
  const [ytMetadata, setYtMetadata] = useState<YouTubeMetadata | null>(null);

  // Audio Preview Player
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Timer auto-generation ref
  const autoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setUsage(getDailyBoletimUsage(currentRole));
    setHistory(getBoletimHistory());
  }, [currentRole]);

  // Salva config sempre que alterar
  const handleConfigChange = (updated: Partial<BoletimConfig>) => {
    const newConfig = { ...config, ...updated };
    setConfig(newConfig);
    saveBoletimConfig(newConfig);
  };

  // Cron/Timer de Automação em segundo plano quando ativado
  useEffect(() => {
    if (autoTimerRef.current) clearInterval(autoTimerRef.current);

    if (config.enabled) {
      const intervalMs = Math.max(15, config.intervalMinutes) * 60 * 1000;
      console.log(`[Boletim IA] Automação ativada! Verificando a cada ${config.intervalMinutes} minutos.`);

      autoTimerRef.current = window.setInterval(async () => {
        const currentUsage = getDailyBoletimUsage(currentRole);
        if (currentUsage.count >= currentUsage.maxLimit) {
          console.warn("[Boletim IA] Limite diário atingido na automação. Pausando execuções automáticas.");
          return;
        }

        try {
          console.log("[Boletim IA] Executando boletim automático de rotina...");
          const ctx = initAudioContext();
          await executeBoletimGeneration(config, ctx, currentRole);
          setUsage(getDailyBoletimUsage(currentRole));
          setHistory(getBoletimHistory());
        } catch (e) {
          console.error("[Boletim IA] Erro no timer automático:", e);
        }
      }, intervalMs);
    }

    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, [config.enabled, config.intervalMinutes, currentRole, initAudioContext, config]);

  // Busca metadados do YouTube
  const handleFetchYouTube = async () => {
    if (!ytUrl.trim()) return;
    setIsFetchingYt(true);
    setErrorMessage(null);
    try {
      const meta = await fetchYouTubeMetadata(ytUrl);
      setYtMetadata(meta);
      handleConfigChange({
        bgMusicSource: 'youtube',
        youtubeUrl: meta.url,
        youtubeTitle: meta.title,
        youtubeThumbnail: meta.thumbnailUrl,
        youtubeStartTime: 0,
        youtubeEndTime: 60
      });
      setStatusMessage("Informações do vídeo do YouTube carregadas com sucesso!");
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao carregar link do YouTube.");
    } finally {
      setIsFetchingYt(false);
    }
  };

  // Upload de arquivo de áudio de fundo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string)?.split(',')[1];
      if (base64) {
        handleConfigChange({
          bgMusicSource: 'upload',
          uploadedBgAudioBase64: base64,
          uploadedBgName: file.name
        });
        setStatusMessage(`Arquivo "${file.name}" carregado como fundo musical.`);
      }
    };
    reader.readAsDataURL(file);
  };

  // Disparo Manual de Geração
  const handleGenerateNow = async () => {
    setErrorMessage(null);
    setStatusMessage(null);

    const currentUsage = getDailyBoletimUsage(currentRole);
    if (currentUsage.count >= currentUsage.maxLimit) {
      setErrorMessage(
        `Você atingiu o limite diário de ${currentUsage.maxLimit} boletins automáticos. O limite será renovado automaticamente no próximo dia ou poderá ser ampliado conforme seu plano.`
      );
      return;
    }

    setIsGenerating(true);
    try {
      const ctx = initAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      const item = await executeBoletimGeneration(config, ctx, currentRole);
      setUsage(getDailyBoletimUsage(currentRole));
      setHistory(getBoletimHistory());
      setStatusMessage(`✨ Boletim "${item.niche}" gerado com sucesso e enviado para o Smart Play na fila "📰 Boletins IA"!`);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao gerar o boletim. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Tocar item do histórico
  const handlePlayHistoryItem = (item: BoletimHistoryItem) => {
    if (playingId === item.id) {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
      }
      setPlayingId(null);
      return;
    }

    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
    }

    if (item.audioData) {
      const ctx = initAudioContext();
      const source = ctx.createBufferSource();
      source.buffer = item.audioData;
      source.connect(ctx.destination);
      source.onended = () => setPlayingId(null);
      source.start();
      audioSourceRef.current = source;
      setPlayingId(item.id);
    }
  };

  // Re-enviar para o Smart Play
  const handleReSendToSmartPlay = (item: BoletimHistoryItem) => {
    window.dispatchEvent(new CustomEvent('voxgen-boletim-created', { detail: item }));
    setStatusMessage(`Boletim re-enviado para a fila do Smart Play!`);
  };

  const isLimitReached = usage.count >= usage.maxLimit;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Banner Principal */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-2xl flex-shrink-0">
              <Newspaper size={32} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white">Boletim Inteligente IA</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${config.enabled ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                  {config.enabled ? 'Automação Ativa' : 'Automação Inativa'}
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                Pesquisa automática de notícias atualizadas no nicho e cidade escolhidos, roteirização com linguagem de rádio por IA, locução e envio direto para a fila do <strong className="text-indigo-300">Smart Play</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end gap-3 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
            <div className="flex items-center justify-between w-full md:w-auto gap-4">
              <span className="text-xs font-bold text-slate-300 uppercase">Boletins Automáticos Hoje</span>
              <span className={`text-sm font-extrabold ${isLimitReached ? 'text-amber-400' : 'text-emerald-400'}`}>
                {usage.count} / {usage.maxLimit}
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full md:w-48 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
              <div 
                className={`h-full transition-all duration-300 ${isLimitReached ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, (usage.count / usage.maxLimit) * 100)}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-400">Consumo: 1 crédito por boletim gerado.</p>
          </div>
        </div>

        {/* Notificação de Limite Excedido */}
        {isLimitReached && (
          <div className="mt-6 bg-amber-950/60 border border-amber-500/40 rounded-2xl p-4 flex items-start gap-3 text-amber-200 text-xs">
            <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">Limite Diário Atingido</p>
              <p className="mt-0.5">
                Você atingiu o limite diário de {usage.maxLimit} boletins automáticos. O limite será renovado automaticamente no próximo dia ou poderá ser ampliado conforme seu plano.
              </p>
            </div>
          </div>
        )}

        {/* Switch de Ativação Geral */}
        <div className="mt-6 pt-6 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio size={20} className={config.enabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'} />
            <div>
              <p className="text-sm font-bold text-white">Ativar Geração Automática em Segundo Plano</p>
              <p className="text-xs text-slate-400">O VoxGen pesquisará e enviará novos boletins para a rádio no intervalo configurado.</p>
            </div>
          </div>
          <button
            onClick={() => handleConfigChange({ enabled: !config.enabled })}
            className={`w-14 h-7 rounded-full relative transition-colors ${config.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
          >
            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${config.enabled ? 'left-8' : 'left-1'}`}></div>
          </button>
        </div>
      </div>

      {/* Grid de Configurações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LADO ESQUERDO: Nicho & Região */}
        <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/80 backdrop-blur-sm space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Globe size={18} className="text-indigo-400" /> Nicho & Filtros Regionais
          </h3>

          {/* Seleção do Nicho */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-3">Nicho da Notícia</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {NICHES.map((niche) => (
                <button
                  key={niche}
                  onClick={() => handleConfigChange({ niche })}
                  className={`p-2.5 rounded-xl text-xs font-medium border text-left transition-all ${
                    config.niche === niche
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {niche}
                </button>
              ))}
            </div>
          </div>

          {/* Nicho Personalizado */}
          {config.niche === 'Personalizado' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase">Especifique o Nicho Personalizado</label>
              <input
                type="text"
                placeholder="Ex: Criptomoedas, Mercado Imobiliário, F1..."
                value={config.customNiche || ''}
                onChange={(e) => handleConfigChange({ customNiche: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* Filtros Regionais */}
          <div className="space-y-3 pt-4 border-t border-slate-700/60">
            <label className="block text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
              <MapPin size={14} className="text-emerald-400" /> Localização para Priorização Regional
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="block text-[10px] text-slate-400 mb-1">Cidade</span>
                <input
                  type="text"
                  placeholder="Cidade"
                  value={config.city}
                  onChange={(e) => handleConfigChange({ city: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 mb-1">Estado (UF)</span>
                <input
                  type="text"
                  placeholder="UF"
                  value={config.state}
                  onChange={(e) => handleConfigChange({ state: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 mb-1">País</span>
                <input
                  type="text"
                  placeholder="País"
                  value={config.country}
                  onChange={(e) => handleConfigChange({ country: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* LADO DIREITO: Configurações de Geração */}
        <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/80 backdrop-blur-sm space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sliders size={18} className="text-emerald-400" /> Parâmetros de Narração e Frequência
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Intervalo */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Intervalo de Pesquisa</label>
              <select
                value={config.intervalMinutes}
                onChange={(e) => handleConfigChange({ intervalMinutes: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value={15}>A cada 15 minutos</option>
                <option value={30}>A cada 30 minutos</option>
                <option value={60}>A cada 60 minutos (1 hora)</option>
                <option value={120}>A cada 2 horas</option>
              </select>
            </div>

            {/* Notícias por boletim */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Qtd. Notícias</label>
              <select
                value={config.newsCount}
                onChange={(e) => handleConfigChange({ newsCount: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value={1}>1 notícia principal</option>
                <option value={2}>2 notícias</option>
                <option value={3}>3 notícias (Recomendado)</option>
                <option value={5}>5 notícias resumo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Duração Máxima */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Duração Máxima</label>
              <select
                value={config.maxDuration}
                onChange={(e) => handleConfigChange({ maxDuration: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="30s">30 segundos (Rápido)</option>
                <option value="60s">60 segundos (Padrão)</option>
                <option value="2 min">2 minutos (Detalhado)</option>
              </select>
            </div>

            {/* Voz Utilizada */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Voz do Narrador</label>
              <select
                value={config.voice}
                onChange={(e) => handleConfigChange({ voice: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Estilo da Locução */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Estilo da Locução</label>
              <select
                value={config.style}
                onChange={(e) => handleConfigChange({ style: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Informativo Rádio">Informativo Rádio</option>
                <option value="Entusiasta">Entusiasta / Dinâmico</option>
                <option value="Sério">Sério / Jornalístico</option>
                <option value="Conversacional">Conversacional</option>
              </select>
            </div>

            {/* Temperatura IA */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 uppercase mb-1">
                <span>Criatividade IA</span>
                <span className="text-emerald-400">{config.temperature}</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.1"
                value={config.temperature}
                onChange={(e) => handleConfigChange({ temperature: parseFloat(e.target.value) })}
                className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-500 mt-2"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO: FUNDOS PARA BOLETIM (FUNDO MUSICAL) */}
      <div className="bg-slate-800/50 p-6 md:p-8 rounded-3xl border border-slate-700/80 backdrop-blur-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Music size={20} className="text-pink-400" /> Fundos para Boletins
          </h3>
          <span className="text-xs text-slate-400">Personalize a trilha sonora e vinheta de fundo do boletim</span>
        </div>

        {/* Tabs de Seleção de Fundo */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleConfigChange({ bgMusicSource: 'preset' })}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              config.bgMusicSource === 'preset' ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Layers size={14} /> Biblioteca VoxGen
          </button>
          <button
            onClick={() => handleConfigChange({ bgMusicSource: 'upload' })}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              config.bgMusicSource === 'upload' ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Upload size={14} /> Upload de Arquivos (MP3, WAV, OGG)
          </button>
          <button
            onClick={() => handleConfigChange({ bgMusicSource: 'youtube' })}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              config.bgMusicSource === 'youtube' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Youtube size={14} /> Link do YouTube
          </button>
          <button
            onClick={() => handleConfigChange({ bgMusicSource: 'none' })}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              config.bgMusicSource === 'none' ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            Sem Fundo (Apenas Voz)
          </button>
        </div>

        {/* Conteúdo da Tab Selecionada */}
        {config.bgMusicSource === 'preset' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {BOLETIM_PRESETS.map((preset) => (
              <div
                key={preset.id}
                onClick={() => handleConfigChange({ selectedBgPresetId: preset.id })}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  config.selectedBgPresetId === preset.id
                    ? 'bg-pink-950/40 border-pink-500 text-white shadow-md'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${config.selectedBgPresetId === preset.id ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    <Radio size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{preset.name}</p>
                    <p className="text-[10px] text-slate-400">Estilo: {preset.style}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {config.bgMusicSource === 'upload' && (
          <div className="bg-slate-900/60 border-2 border-dashed border-slate-700 rounded-2xl p-6 text-center space-y-3">
            <Upload size={32} className="mx-auto text-pink-400" />
            <div>
              <p className="text-sm font-bold text-white">
                {config.uploadedBgName ? `Arquivo Selecionado: ${config.uploadedBgName}` : 'Arraste ou selecione o arquivo de áudio'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Formatos aceitos: MP3, WAV e OGG</p>
            </div>
            <label className="inline-block bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-lg shadow-pink-600/30">
              Selecionar Arquivo
              <input type="file" accept="audio/mp3,audio/wav,audio/ogg" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        )}

        {config.bgMusicSource === 'youtube' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Cole a URL do vídeo do YouTube (ex: https://www.youtube.com/watch?v=...)"
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                className="flex-grow bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
              />
              <button
                onClick={handleFetchYouTube}
                disabled={isFetchingYt || !ytUrl.trim()}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-red-600/30"
              >
                {isFetchingYt ? <Loader2 size={14} className="animate-spin" /> : <Youtube size={14} />} Analisar Vídeo
              </button>
            </div>

            {ytMetadata && (
              <div className="bg-slate-900 p-4 rounded-2xl border border-red-500/30 flex flex-col sm:flex-row items-center gap-4">
                <img src={ytMetadata.thumbnailUrl} alt={ytMetadata.title} className="w-24 h-24 object-cover rounded-xl flex-shrink-0" />
                <div className="flex-grow space-y-1">
                  <p className="text-xs font-bold text-white">{ytMetadata.title}</p>
                  <p className="text-[11px] text-slate-400">Canal: {ytMetadata.author}</p>
                  <span className="inline-block px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                    Salvo na Biblioteca de Fundos
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Controles de Volume e Ducking */}
        {config.bgMusicSource !== 'none' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-700/60">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 uppercase mb-2">
                <span>Volume do Fundo Musical</span>
                <span className="text-pink-400">{Math.round(config.musicVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.musicVolume}
                onChange={(e) => handleConfigChange({ musicVolume: parseFloat(e.target.value) })}
                className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 uppercase mb-2">
                <span>Ducking Automático (Atenuação da Música)</span>
                <span className="text-indigo-400">-{Math.round((1 - config.duckingIntensity) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.5"
                step="0.05"
                value={config.duckingIntensity}
                onChange={(e) => handleConfigChange({ duckingIntensity: parseFloat(e.target.value) })}
                className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Mensagens de Feedback */}
      {statusMessage && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-950/80 border border-red-500/50 text-red-200 px-4 py-3 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* BOTÃO DE AÇÃO MANUAL */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleGenerateNow}
          disabled={isGenerating || isLimitReached}
          className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white rounded-2xl font-bold flex justify-center items-center gap-3 shadow-xl shadow-indigo-600/30 disabled:opacity-50 transition-all text-sm"
        >
          {isGenerating ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Pesquisando Notícias e Gerando Locução...
            </>
          ) : (
            <>
              <Zap size={18} /> Gerar Boletim Agora (Manual) & Enviar ao Smart Play
            </>
          )}
        </button>
      </div>

      {/* SEÇÃO: HISTÓRICO DE BOLETIMS */}
      <div className="bg-slate-800/50 p-6 md:p-8 rounded-3xl border border-slate-700/80 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock size={20} className="text-indigo-400" /> Histórico de Boletins Gerados
          </h3>
          <span className="text-xs text-slate-400">{history.length} boletins registrados</span>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">Nenhum boletim gerado ainda. Clique em "Gerar Boletim Agora" para criar o primeiro!</p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
            {history.map((item) => (
              <div key={item.id} className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-600 transition-all">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[10px] font-bold">
                      {item.niche}
                    </span>
                    <span className="text-xs font-bold text-white">{item.location}</span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(item.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2 max-w-xl">{item.scriptText}</p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1">
                    <span>Voz: {item.voice}</span>
                    <span>•</span>
                    <span>Duração: {item.duration}s</span>
                    <span>•</span>
                    <span>Fontes: {item.sources.join(', ')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto justify-end">
                  {item.audioData && (
                    <button
                      onClick={() => handlePlayHistoryItem(item)}
                      className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      {playingId === item.id ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                      <span>{playingId === item.id ? 'Parar' : 'Ouvir'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleReSendToSmartPlay(item)}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
                    title="Enviar este boletim para a fila do Smart Play"
                  >
                    <Send size={14} className="text-emerald-400" />
                    <span>Smart Play</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BoletimStudio;
