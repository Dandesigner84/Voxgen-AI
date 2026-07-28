import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Radio, Upload, Play, Pause, SkipForward, Mic2, Clock, Youtube, Trash2, Link, Smartphone, Music, CheckSquare, Square, Lock, Sliders, Volume2, CloudUpload, Repeat, Repeat1, Shuffle, FileAudio, Check, AlertCircle, Loader2, XCircle, Shield, Newspaper, Send } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { AudioItem, UserRole } from '../types';
import { isSmartPlayerUnlocked } from '../services/monetizationService';
import { usePlatformDetection } from '../hooks/usePlatformDetection';
import { getCorporatePlaylist, saveCorporatePlaylist } from '../services/corporateService';
import { generateSpeech } from '../services/geminiService';
import { decodeAudioData, audioBufferToWav } from '../utils/audioUtils';
import { VIGNETTE_TEXT } from '../constants';
import { BoletimHistoryItem, getBoletimHistory } from '../services/boletimService';
import { 
  startKeepAlive, 
  stopKeepAlive, 
  updateMediaSession, 
  setMediaSessionPlaybackState, 
  isBackgroundPlaybackEnabled, 
  setBackgroundPlaybackEnabled 
} from '../utils/backgroundAudio';

interface Track {
  id: string;
  type: 'file' | 'youtube' | 'spotify';
  name: string;
  src: string; 
  thumbnail?: string;
}

interface UploadedNarrationFile {
    id: string;
    name: string;
    buffer: AudioBuffer;
}

interface PendingFile {
    name: string;
    buffer: AudioBuffer;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

interface SmartPlayerProps {
  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;
  narrationHistory: AudioItem[];
  userRole?: UserRole;
}

const SmartPlayer: React.FC<SmartPlayerProps> = ({ audioContext, initAudioContext, narrationHistory, userRole = 'user' }) => {
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVignettePlaying, setIsVignettePlaying] = useState(false);
  const [isYtReady, setIsYtReady] = useState(false);
  const hasPlayedVignetteRef = useRef(false);
  const vignetteBufferRef = useRef<AudioBuffer | null>(null);

  const [loopMode, setLoopMode] = useState<'off' | 'all' | 'one'>('all');
  const [isShuffle, setIsShuffle] = useState(false);
  const [webInput, setWebInput] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(1800); // Padrão: 30 minutos (1800s)
  const [isSmartEqEnabled, setIsSmartEqEnabled] = useState(true);
  const [narrationSource, setNarrationSource] = useState<'history' | 'upload'>('history');
  const [uploadedNarrations, setUploadedNarrations] = useState<UploadedNarrationFile[]>([]);
  const [pendingUploads, setPendingUploads] = useState<PendingFile[]>([]);
  const [isProcessingUploads, setIsProcessingUploads] = useState(false);
  const [selectedNarrationIds, setSelectedNarrationIds] = useState<string[]>([]);
  const [nextNarrationTimeDisplay, setNextNarrationTimeDisplay] = useState<string>('--:--');
  const [isNarratingUI, setIsNarratingUI] = useState(false);
  const [showRemoteModal, setShowRemoteModal] = useState(false);

  // Fila de Boletins IA
  const [boletinsQueue, setBoletinsQueue] = useState<BoletimHistoryItem[]>(() => {
    return getBoletimHistory().filter(item => item.generationStatus === 'success');
  });

  useEffect(() => {
    const handleBoletimCreated = (e: Event) => {
      const customEvent = e as CustomEvent<BoletimHistoryItem>;
      if (customEvent.detail && customEvent.detail.generationStatus === 'success') {
        console.log("[SmartPlay] Novo boletim IA recebido na fila:", customEvent.detail.niche);
        const newBoletim = customEvent.detail;
        setBoletinsQueue(prev => [newBoletim, ...prev.filter(b => b.id !== newBoletim.id)]);
        setSelectedNarrationIds(prev => Array.from(new Set([newBoletim.id, ...prev])));
        setIntervalSeconds(1800); // Define intervalo automático para 30 minutos
      }
    };

    window.addEventListener('voxgen-boletim-created', handleBoletimCreated);
    return () => {
      window.removeEventListener('voxgen-boletim-created', handleBoletimCreated);
    };
  }, []);
  
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const isNarratingRef = useRef(false);
  const nextNarrationTimeRef = useRef<number>(0);
  const hasFadedOutRef = useRef<boolean>(false);
  const timerIntervalRef = useRef<number | null>(null);
  const narrationSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const narrationsSinceVignetteRef = useRef(0);

  const { isIOS } = usePlatformDetection();
  const isPremium = isSmartPlayerUnlocked();
  console.log("[VoxGen] Status do Usuário:", isPremium ? "Premium" : "Grátis");
  const isCorpAdmin = userRole === 'corporate-admin';
  const isCorpUser = userRole === 'corporate-user';
  const isCorporateMode = isCorpAdmin || isCorpUser;
  const currentTrack = playlist[currentTrackIndex];

  // --- Audio Control Functions ---

  const fadeYouTubeVolume = useCallback((startVol: number, endVol: number, durationMs: number) => {
      if (!ytPlayerRef.current?.setVolume) return;
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      const steps = 20; const stepTime = durationMs / steps; const volStep = (endVol - startVol) / steps;
      let currentVol = startVol;
      fadeIntervalRef.current = window.setInterval(() => {
          currentVol += volStep;
          if ((volStep > 0 && currentVol >= endVol) || (volStep < 0 && currentVol <= endVol)) {
              currentVol = endVol; clearInterval(fadeIntervalRef.current!);
          }
          try { ytPlayerRef.current.setVolume(currentVol); } catch(e){}
      }, stepTime);
  }, []);

  const lowerVolume = useCallback((duration: number = 3.0) => {
      if (!isSmartEqEnabled) return;
      const ctx = initAudioContext();
      if (gainNodeRef.current) {
          gainNodeRef.current.gain.cancelScheduledValues(ctx.currentTime);
          gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, ctx.currentTime);
          gainNodeRef.current.gain.linearRampToValueAtTime(0.15, ctx.currentTime + duration);
      }
      if (ytPlayerRef.current?.setVolume) fadeYouTubeVolume(100, 15, duration * 1000);
  }, [isSmartEqEnabled, initAudioContext, fadeYouTubeVolume]);

  const restoreVolume = useCallback((duration: number = 3.0) => {
      if (!isSmartEqEnabled) return;
      const ctx = initAudioContext();
      if (gainNodeRef.current) {
          gainNodeRef.current.gain.cancelScheduledValues(ctx.currentTime);
          gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, ctx.currentTime);
          gainNodeRef.current.gain.linearRampToValueAtTime(1.2, ctx.currentTime + duration);
      }
      if (ytPlayerRef.current?.setVolume) fadeYouTubeVolume(15, 100, duration * 1000);
  }, [isSmartEqEnabled, initAudioContext, fadeYouTubeVolume]);

  const playBoletimNow = useCallback((boletim: BoletimHistoryItem) => {
    if (!boletim.audioData) return;
    const ctx = initAudioContext(); 
    if (ctx.state === 'suspended') ctx.resume();

    isNarratingRef.current = true;
    setIsNarratingUI(true); 
    lowerVolume(1.0);

    const source = ctx.createBufferSource();
    source.buffer = boletim.audioData;
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = isSmartEqEnabled ? 1.2 : 1.0; 
    source.connect(voiceGain);
    voiceGain.connect(ctx.destination);
    narrationSourceNodeRef.current = source;

    source.onended = () => {
        isNarratingRef.current = false;
        setIsNarratingUI(false); 
        restoreVolume(2.0);
    };
    source.start(0);

    // Marca como reproduzido na fila
    setBoletinsQueue(prev => prev.map(b => b.id === boletim.id ? { ...b, playbackStatus: 'played' } : b));
  }, [initAudioContext, isSmartEqEnabled, lowerVolume, restoreVolume]);

  const playNarration = useCallback(() => {
      const ctx = initAudioContext(); 
      let buffer: AudioBuffer | null = null;

      // PRIORIDADE: Se houver boletim IA na fila pendente de reprodução
      const pendingBoletim = boletinsQueue.find(b => b.playbackStatus === 'queued' && b.audioData);
      if (pendingBoletim) {
        buffer = pendingBoletim.audioData || null;
        pendingBoletim.playbackStatus = 'played';
      }

      if (!buffer) {
        if (!isPremium && narrationsSinceVignetteRef.current >= 4 && vignetteBufferRef.current) {
            buffer = vignetteBufferRef.current;
            narrationsSinceVignetteRef.current = 0;
        } else {
            const availableIds = selectedNarrationIds.filter(id => 
              narrationHistory.some(n => n.id === id) || 
              uploadedNarrations.some(u => u.id === id)
            );
            
            if (availableIds.length > 0) {
                const randomId = availableIds[Math.floor(Math.random() * availableIds.length)];
                const historyItem = narrationHistory.find(n => n.id === randomId);
                if (historyItem) {
                    buffer = historyItem.audioData;
                } else {
                    const uploadItem = uploadedNarrations.find(u => u.id === randomId);
                    if (uploadItem) buffer = uploadItem.buffer;
                }
                if (buffer && !isPremium) narrationsSinceVignetteRef.current += 1;
            }
        }
      }

      if (!buffer) {
          nextNarrationTimeRef.current = Date.now() + (intervalSeconds * 1000);
          hasFadedOutRef.current = false;
          restoreVolume(1.0);
          return;
      }
      isNarratingRef.current = true;
      setIsNarratingUI(true); 
      if (!hasFadedOutRef.current) lowerVolume(0.5);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const voiceGain = ctx.createGain();
      voiceGain.gain.value = isSmartEqEnabled ? 1.2 : 1.0; 
      source.connect(voiceGain);
      voiceGain.connect(ctx.destination);
      narrationSourceNodeRef.current = source;
      source.onended = () => {
          isNarratingRef.current = false;
          setIsNarratingUI(false); 
          restoreVolume(3.0);
          nextNarrationTimeRef.current = Date.now() + (intervalSeconds * 1000);
          hasFadedOutRef.current = false;
      };
      source.start(0);
  }, [isPremium, boletinsQueue, selectedNarrationIds, narrationHistory, uploadedNarrations, intervalSeconds, isSmartEqEnabled, initAudioContext, lowerVolume, restoreVolume]);

  const startScheduler = useCallback(() => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (nextNarrationTimeRef.current < Date.now()) {
           nextNarrationTimeRef.current = Date.now() + (intervalSeconds * 1000);
           hasFadedOutRef.current = false;
      }
      timerIntervalRef.current = window.setInterval(() => {
          const now = Date.now();
          const remainingMs = nextNarrationTimeRef.current - now;
          const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
          setNextNarrationTimeDisplay(remainingSec > 60 ? `${Math.floor(remainingSec/60)}m ${remainingSec%60}s` : `${remainingSec}s`);
          
          if (remainingMs <= 3500 && remainingMs > 0 && !hasFadedOutRef.current && isPlaying && !isVignettePlaying) {
               lowerVolume(3.0);
               hasFadedOutRef.current = true;
          }
          if (now >= nextNarrationTimeRef.current && !isNarratingRef.current && !isVignettePlaying) {
               playNarration();
          }
      }, 500);
  }, [intervalSeconds, isPlaying, isVignettePlaying, lowerVolume, playNarration]);

  const stopScheduler = useCallback(() => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); }, []);

  const pauseTrack = useCallback(() => {
      audioElRef.current?.pause();
      try { ytPlayerRef.current?.pauseVideo(); } catch(e){}
  }, []);

  const handleNextTrack = useCallback(() => {
      if (playlist.length === 0) return;

      if (loopMode === 'one') {
          if (currentTrack) {
            if (currentTrack.type === 'file' && audioElRef.current) {
                audioElRef.current.currentTime = 0;
                audioElRef.current.play();
            } else if (currentTrack.type === 'youtube' && ytPlayerRef.current) {
                ytPlayerRef.current.seekTo(0);
                ytPlayerRef.current.playVideo();
            } else {
                playTrack(currentTrack);
            }
          }
          return;
      }

      if (isShuffle) {
          const rand = Math.floor(Math.random() * playlist.length);
          setCurrentTrackIndex(rand);
          return;
      }

      if (currentTrackIndex < playlist.length - 1) {
          setCurrentTrackIndex(prev => prev + 1);
      } else {
          if (loopMode === 'all') {
              setCurrentTrackIndex(0);
          } else {
              setIsPlaying(false);
          }
      }
  }, [playlist, loopMode, currentTrack, isShuffle, currentTrackIndex]); // playTrack removed from deps to avoid circularity

  const playTrack = useCallback(async (track: Track) => {
      if (isVignettePlaying) return;
      
      const ctx = initAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      // Ativa keep-alive para segundo plano e atualiza MediaSession no smartphone
      startKeepAlive();
      updateMediaSession({
          title: track?.name || 'VoxGen Smart Player',
          artist: 'VoxGen Radio Inteligente',
          album: 'Smart Player',
          artworkUrl: track?.thumbnail || '/icon.png'
      }, {
          onPlay: () => { if (!isPlaying) handleMainPlay(); },
          onPause: () => { if (isPlaying) handleMainPlay(); },
          onNext: () => handleNextTrack()
      });
      setMediaSessionPlaybackState('playing');

      // Pausar outros meios para evitar sobreposição
      if (track.type !== 'file') {
          audioElRef.current?.pause();
      }
      if (track.type !== 'youtube') {
          try { ytPlayerRef.current?.pauseVideo(); } catch(e){}
      }
      
      if (isCorpUser && isIOS && track.type === 'youtube') {
          setIsPlaying(false);
          alert("Aviso iOS: YouTube não suporta autoplay em modo oculto. Use Spotify ou Arquivos de Áudio.");
          return;
      }
      
      if (track.type === 'file') {
          if (audioElRef.current) {
              // Só altera o src se for diferente para não reiniciar o áudio se já estiver carregado
              const absoluteTrackSrc = new URL(track.src, window.location.href).href;
              const currentAudioSrc = new URL(audioElRef.current.src, window.location.href).href;

              if (currentAudioSrc !== absoluteTrackSrc) {
                  audioElRef.current.src = track.src;
              }
              
              if (gainNodeRef.current) gainNodeRef.current.gain.value = 1.2;
              
              // Só chama play se não estiver tocando
              if (audioElRef.current.paused) {
                  audioElRef.current.play().catch(console.error);
              }
              audioElRef.current.onended = handleNextTrack;
          }
      } else if (track.type === 'youtube') {
          if (ytPlayerRef.current && isYtReady) {
               try {
                   const currentVideoUrl = ytPlayerRef.current.getVideoUrl?.() || "";
                   if (!currentVideoUrl.includes(track.src)) {
                       ytPlayerRef.current.loadVideoById(track.src);
                   } else {
                       const state = ytPlayerRef.current.getPlayerState();
                       if (state !== window.YT.PlayerState.PLAYING) {
                           ytPlayerRef.current.playVideo();
                       }
                   }
                   ytPlayerRef.current.setVolume(100);
                   ytPlayerRef.current.unMute();
               } catch(e) {
                   console.error("Erro ao reproduzir YouTube", e);
               }
          }
      }
  }, [isVignettePlaying, isCorpUser, isIOS, isYtReady, handleNextTrack, initAudioContext]);

  const playVignette = useCallback(async () => {
      const ctx = initAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      if (!vignetteBufferRef.current) { 
          console.warn("[VoxGen] Vinheta não carregada, pulando...");
          setIsPlaying(true); 
          return; 
      }
      
      console.log("[VoxGen] Iniciando reprodução da vinheta CTA...");
      setIsPlaying(true);
      setIsVignettePlaying(true);
      startKeepAlive();
      setMediaSessionPlaybackState('playing');
      
      const source = ctx.createBufferSource();
      source.buffer = vignetteBufferRef.current;
      
      // Conectar ao gainNodeRef se disponível para respeitar o volume do player
      if (gainNodeRef.current) {
          source.connect(gainNodeRef.current);
      } else {
          source.connect(ctx.destination);
      }
      
      source.onended = () => {
          console.log("[VoxGen] Vinheta finalizada.");
          setIsVignettePlaying(false);
          hasPlayedVignetteRef.current = true;
          // O useEffect de monitoramento de isVignettePlaying cuidará de iniciar a próxima faixa
          startScheduler();
      };
      source.start(0);
  }, [initAudioContext, startScheduler]);

  const handleMainPlay = useCallback(async () => {
      const ctx = initAudioContext();

      if (isPlaying) {
          setIsPlaying(false);
          setMediaSessionPlaybackState('paused');
          
          if (narrationSourceNodeRef.current) {
              try {
                  narrationSourceNodeRef.current.stop();
              } catch (e) {
                  console.warn("Erro ao parar narração:", e);
              }
              narrationSourceNodeRef.current = null;
          }
          isNarratingRef.current = false;
          setIsNarratingUI(false);
          
          restoreVolume(0.1);

          // Removido suspend() para não afetar outros componentes que compartilham o contexto
          pauseTrack();
          return;
      }

      if (ctx.state === 'suspended') await ctx.resume();

      startKeepAlive();
      setMediaSessionPlaybackState('playing');

      if (!isPremium && !hasPlayedVignetteRef.current && vignetteBufferRef.current) {
          playVignette();
      } else {
          setIsPlaying(true);
          // O useEffect de monitoramento de isPlaying cuidará de iniciar a reprodução
          startScheduler();
      }
  }, [isPlaying, currentTrackIndex, playlist, isPremium, vignetteBufferRef.current, playVignette, playTrack, startScheduler, restoreVolume, pauseTrack, initAudioContext]);

  const onPlayerStateChange = useCallback((event: any) => {
      if (event.data === window.YT.PlayerState.ENDED) {
          handleNextTrack();
      }
  }, [handleNextTrack]);

  const initYoutubePlayer = useCallback(() => {
    if (window.YT && window.YT.Player && !ytPlayerRef.current) {
        try {
            ytPlayerRef.current = new window.YT.Player('youtube-player-hidden', {
                height: '0', width: '0',
                playerVars: { 
                    'autoplay': 0, 
                    'controls': 0, 
                    'disablekb': 1,
                    'origin': window.location.origin
                },
                events: { 
                    'onReady': () => { 
                        setIsYtReady(true);
                    },
                    'onStateChange': onPlayerStateChange,
                    'onError': (e: any) => console.error("YouTube Player Error", e)
                }
            });
        } catch(e) { 
            console.error("YT Player init error", e); 
        }
    }
  }, [onPlayerStateChange]);

  const syncCorporatePlaylist = useCallback(() => {
      const corpTracks = getCorporatePlaylist();
      if (corpTracks.length > 0) setPlaylist(corpTracks);
  }, []);

  // --- Effects ---

  useEffect(() => {
    if (!audioElRef.current) {
      const ctx = initAudioContext();
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audioElRef.current = audio;

      try {
        const source = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();
        gain.gain.value = 1.2; 
        source.connect(gain);
        gain.connect(ctx.destination);
        gainNodeRef.current = gain;
      } catch (e) {
        console.warn("MediaElementSource already created or error:", e);
      }
    }

    // Inicialização segura da API do YouTube
    if (!window.YT || !window.YT.Player) {
        window.onYouTubeIframeAPIReady = () => {
            initYoutubePlayer();
        };
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    } else {
        initYoutubePlayer();
    }
    
    return () => {
      if (audioElRef.current) audioElRef.current.pause();
      if (ytPlayerRef.current) try { ytPlayerRef.current.destroy(); } catch(e){}
      stopScheduler();
    };
  }, []); // Run only once on mount

  useEffect(() => {
    if (isCorporateMode) syncCorporatePlaylist();
  }, [isCorporateMode, syncCorporatePlaylist]);

  useEffect(() => {
    const onVoicePlay = () => {
        if (!isPlaying) handleMainPlay();
    };
    const onVoicePause = () => {
        if (isPlaying) handleMainPlay();
    };

    window.addEventListener('voxgen-play', onVoicePlay);
    window.addEventListener('voxgen-pause', onVoicePause);

    return () => {
      window.removeEventListener('voxgen-play', onVoicePlay);
      window.removeEventListener('voxgen-pause', onVoicePause);
    };
  }, [isPlaying, handleMainPlay]);

  useEffect(() => {
    const loadVignette = async () => {
        if (vignetteBufferRef.current) return;
        try {
            console.log("[VoxGen] Pré-carregando vinheta CTA...");
            const ctx = initAudioContext();
            const base64 = await generateSpeech(VIGNETTE_TEXT, 'Kore');
            const buffer = await decodeAudioData(base64, ctx);
            vignetteBufferRef.current = buffer;
            console.log("[VoxGen] Vinheta pré-carregada com sucesso.");
        } catch (e) { 
            console.warn("[VoxGen] Falha ao pré-carregar vinheta", e); 
        }
    };
    loadVignette();
  }, [initAudioContext]); 

  useEffect(() => {
    if (!currentTrack) return;
    if (isPlaying && !isVignettePlaying) {
        playTrack(currentTrack);
        startScheduler();
    }
  }, [currentTrackIndex, isPlaying, isVignettePlaying, currentTrack, playTrack, startScheduler]); 

  useEffect(() => {
    if (isYtReady && isPlaying && currentTrack?.type === 'youtube') {
        playTrack(currentTrack);
    }
  }, [isYtReady, isPlaying, currentTrack, playTrack]);

  // --- Other Handlers ---

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const files: File[] = Array.from(e.target.files);
          if (files.length > 10) {
              alert("Por favor, selecione no máximo 10 arquivos de uma vez.");
              return;
          }
          setIsProcessingUploads(true);
          const ctx = initAudioContext();
          const newPendingFiles: PendingFile[] = [];
          try {
              for (const file of files) {
                  try {
                      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
                      newPendingFiles.push({ name: file.name.replace(/\.[^/.]+$/, ""), buffer });
                  } catch(err) { console.error(`Erro ao processar ${file.name}`, err); }
              }
              if (newPendingFiles.length > 0) setPendingUploads(newPendingFiles);
              else alert("Não foi possível processar os arquivos de áudio.");
          } catch (error) { alert("Erro durante o upload múltiplo."); } finally { setIsProcessingUploads(false); }
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmUpload = (target: 'playlist' | 'narration') => {
      if (pendingUploads.length === 0) return;
      if (target === 'playlist') {
          const newTracks: Track[] = pendingUploads.map(file => {
              const blob = audioBufferToWav(file.buffer);
              const url = URL.createObjectURL(blob);
              return { id: crypto.randomUUID(), type: 'file', name: file.name, src: url };
          });
          setPlaylist(prev => [...prev, ...newTracks]);
      } else {
          const remainingSlots = 10 - uploadedNarrations.length;
          if (remainingSlots <= 0) {
               alert("Limite de 10 narrações atingido.");
               setPendingUploads([]);
               return;
          }
          let filesToAdd = pendingUploads;
          if (pendingUploads.length > remainingSlots) {
              alert(`Adicionando apenas ${remainingSlots}.`);
              filesToAdd = pendingUploads.slice(0, remainingSlots);
          }
          const newNarrations: UploadedNarrationFile[] = filesToAdd.map(file => ({
              id: crypto.randomUUID(), name: file.name, buffer: file.buffer
          }));
          setUploadedNarrations(prev => [...prev, ...newNarrations]);
          setSelectedNarrationIds(prev => [...prev, ...newNarrations.map(n => n.id)]);
          setNarrationSource('upload');
      }
      setPendingUploads([]);
  };

  const addWebLink = () => {
      const trimmedInput = webInput.trim();
      const ytRegExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/|live\/)|youtu\.be\/)([^"&?\/\s]{11})/;
      const ytListRegExp = /[?&]list=([^"&?\/\s]+)/;
      const spotifyRegExp = /open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/;

      const ytMatch = trimmedInput.match(ytRegExp);
      const ytListMatch = trimmedInput.match(ytListRegExp);

      if (ytMatch && ytMatch[1]) {
          const id = ytMatch[1];
          setPlaylist(prev => [...prev, { id: crypto.randomUUID(), type: 'youtube', name: `YouTube Faixa (${id})`, src: id, thumbnail: `https://img.youtube.com/vi/${id}/0.jpg` }]);
          setWebInput('');
      } else if (ytListMatch && ytListMatch[1]) {
          const listId = ytListMatch[1];
          setPlaylist(prev => [...prev, { id: crypto.randomUUID(), type: 'youtube', name: `YouTube Playlist (${listId.substring(0, 8)}...)`, src: listId, thumbnail: `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80` }]);
          setWebInput('');
      } else if (trimmedInput.match(spotifyRegExp)) {
          const match = trimmedInput.match(spotifyRegExp)!;
          setPlaylist(prev => [...prev, { id: crypto.randomUUID(), type: 'spotify', name: `Spotify ${match[1]}`, src: `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`, thumbnail: '' }]);
          setWebInput('');
      } else { alert("Link inválido ou não suportado. Use links diretos de vídeo/playlist do YouTube ou faixas do Spotify."); }
  };

  const getSpotifySrc = () => {
      if (currentTrack?.type !== 'spotify') return '';
      // No modo embed do Spotify, o autoplay via URL é restrito, mas tentamos habilitar
      return isPlaying && !isVignettePlaying ? `${currentTrack.src}&autoplay=1` : currentTrack.src;
  };

  const handleToggleNarration = (id: string) => {
      if (selectedNarrationIds.includes(id)) {
          setSelectedNarrationIds(prev => prev.filter(item => item !== id));
      } else {
          if (isPremium || isCorporateMode) {
               if (selectedNarrationIds.length >= 20) { alert("Limite de seleção atingido."); return; }
               setSelectedNarrationIds(prev => [...prev, id]);
          } else {
               setSelectedNarrationIds([id]);
          }
      }
  };

  const handleRemoveNarration = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setUploadedNarrations(prev => prev.filter(n => n.id !== id));
      setSelectedNarrationIds(prev => prev.filter(sid => sid !== id));
  };

  const triggerUpload = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 animate-fade-in pb-20 relative">
        <div id="youtube-player-hidden" className="hidden"></div>
        <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleFileSelect} />
        
        {pendingUploads.length > 0 && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-slate-900 border border-indigo-500 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
                    <button onClick={() => setPendingUploads([])} className="absolute top-4 right-4 text-slate-500 hover:text-white"><AlertCircle size={20} /></button>
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Upload size={24} className="text-indigo-400" /> Upload de Áudio</h3>
                    <div className="bg-slate-800 p-3 rounded-lg mb-6 text-sm text-slate-300">
                        <p className="font-bold text-white mb-1">{pendingUploads.length > 1 ? `${pendingUploads.length} arquivos` : pendingUploads[0].name}</p>
                        <p>Onde deseja adicionar?</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => confirmUpload('playlist')} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white py-4 rounded-xl flex flex-col items-center gap-2 transition-all hover:scale-105 group">
                            <Music size={24} className="text-green-400 group-hover:scale-110" /><span className="text-xs font-bold">Playlist</span>
                        </button>
                        <button onClick={() => confirmUpload('narration')} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white py-4 rounded-xl flex flex-col items-center gap-2 transition-all hover:scale-105 group">
                            <Mic2 size={24} className="text-cyan-400 group-hover:scale-110" /><span className="text-xs font-bold">Narrações</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {isProcessingUploads && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                 <div className="bg-slate-900 p-6 rounded-2xl flex flex-col items-center border border-slate-700">
                     <Loader2 size={48} className="text-cyan-500 animate-spin mb-4" /><p className="text-white font-bold">Processando...</p>
                 </div>
             </div>
        )}

        {showRemoteModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
                <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/20 blur-3xl rounded-full"></div>
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-600/20 blur-3xl rounded-full"></div>
                    
                    <button 
                        onClick={() => setShowRemoteModal(false)}
                        className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <XCircle size={24} />
                    </button>

                    <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Smartphone size={32} className="text-indigo-400" />
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-2">Controle Remoto</h3>
                    <p className="text-slate-400 text-sm mb-8">Escaneie o código abaixo para controlar o VoxGen diretamente do seu smartphone.</p>

                    <div className="bg-white p-6 rounded-3xl inline-block mb-8 shadow-2xl border-4 border-indigo-500/20">
                        <QRCodeSVG 
                            value={window.location.href} 
                            size={200}
                            level="H"
                            includeMargin={true}
                            imageSettings={{
                                src: "/favicon.svg",
                                x: undefined,
                                y: undefined,
                                height: 40,
                                width: 40,
                                excavate: true,
                            }}
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-left">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Status do Servidor</span>
                            </div>
                            <p className="text-xs text-slate-500">Pronto para pareamento. Certifique-se de que ambos os dispositivos estão na mesma rede ou use o link público.</p>
                        </div>
                        
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(window.location.href);
                                alert("Link copiado para a área de transferência!");
                            }}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                        >
                            <Link size={16} /> Copiar Link de Acesso
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
            <div className="flex items-center gap-4">
                <div className="p-4 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20">
                    <Radio className="text-white" size={32} />
                </div>
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Smart Player</h1>
                    <p className="text-slate-400 font-medium flex items-center gap-2">
                        {isCorporateMode ? <span className="text-indigo-400 flex items-center gap-1"><Check size={14} /> Modo Empresa Ativo</span> : 'Sua rádio personalizada com IA'}
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                <button 
                    onClick={triggerUpload}
                    className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all border border-slate-700 hover:border-indigo-500 group"
                >
                    <CloudUpload size={20} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                    Upload de Mídia
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Player Main Section */}
            <div className="lg:col-span-8 space-y-8">
                {/* Now Playing Card */}
                <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative group">
                    {/* Background Glow */}
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                    <div className="p-8 md:p-12">
                        <div className="flex flex-col md:flex-row gap-10 items-center">
                            {/* Album Art / Visualizer */}
                            <div className="relative w-64 h-64 flex-shrink-0">
                                <div className={`absolute inset-0 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-2xl shadow-2xl transform transition-transform duration-700 ${isPlaying ? 'scale-105 rotate-3' : 'scale-100 rotate-0'}`}></div>
                                <div className="absolute inset-1 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
                                    {currentTrack?.thumbnail ? (
                                        <img src={currentTrack.thumbnail} alt={currentTrack.name} className="w-full h-full object-cover opacity-60" referrerPolicy="no-referrer" />
                                    ) : (
                                        <Music size={80} className={`text-indigo-500/40 ${isPlaying ? 'animate-pulse' : ''}`} />
                                    )}
                                    
                                    {/* Visualizer bars */}
                                    {isPlaying && (
                                        <div className="absolute bottom-4 left-0 right-0 flex justify-center items-end gap-1 h-12">
                                            {[...Array(8)].map((_, i) => (
                                                <div 
                                                    key={i} 
                                                    className="w-1 bg-indigo-500 rounded-full animate-music-bar"
                                                    style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s` }}
                                                ></div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Track Info & Controls */}
                            <div className="flex-grow text-center md:text-left">
                                <div className="mb-8">
                                    <span className="text-indigo-400 text-xs font-black uppercase tracking-[0.2em] mb-2 block">Tocando Agora</span>
                                    <h2 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight line-clamp-2">
                                        {currentTrack?.name || 'Nenhuma faixa selecionada'}
                                    </h2>
                                    <p className="text-slate-400 font-medium flex items-center justify-center md:justify-start gap-2">
                                        {currentTrack?.type === 'youtube' && <Youtube size={16} className="text-red-500" />}
                                        {currentTrack?.type === 'spotify' && <Music size={16} className="text-green-500" />}
                                        {currentTrack?.type === 'file' && <FileAudio size={16} className="text-indigo-400" />}
                                        {currentTrack?.type || 'VoxGen AI'}
                                    </p>
                                </div>

                                {/* Progress Bar Placeholder */}
                                <div className="w-full h-1.5 bg-slate-800 rounded-full mb-8 overflow-hidden">
                                    <div className={`h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-1000 ${isPlaying ? 'w-full' : 'w-0'}`}></div>
                                </div>

                                <div className="flex items-center justify-center md:justify-start gap-6">
                                    <button 
                                        onClick={() => setIsShuffle(!isShuffle)}
                                        className={`p-2 transition-colors ${isShuffle ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                                        title="Aleatório"
                                    >
                                        <Shuffle size={20} />
                                    </button>
                                    
                                    <button 
                                        onClick={handleMainPlay}
                                        className="w-20 h-20 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
                                    >
                                        {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                                    </button>

                                    <button 
                                        onClick={handleNextTrack}
                                        className="p-4 bg-slate-800 text-white rounded-full hover:bg-slate-700 transition-all"
                                        title="Próxima"
                                    >
                                        <SkipForward size={24} fill="currentColor" />
                                    </button>

                                    <button 
                                        onClick={() => {
                                            if (loopMode === 'off') setLoopMode('all');
                                            else if (loopMode === 'all') setLoopMode('one');
                                            else setLoopMode('off');
                                        }}
                                        className={`p-2 transition-colors ${loopMode !== 'off' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                                        title="Repetir"
                                    >
                                        {loopMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Spotify Embed (Hidden but functional for audio) */}
                    {currentTrack?.type === 'spotify' && (
                        <div className="h-20 border-t border-slate-800 bg-slate-950/50">
                            <iframe 
                                src={getSpotifySrc()} 
                                width="100%" 
                                height="80" 
                                frameBorder="0" 
                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                                loading="lazy"
                                className="opacity-80"
                            ></iframe>
                        </div>
                    )}
                </div>

                {/* Playlist Section */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Sliders size={20} className="text-indigo-400" /> Sua Playlist
                        </h3>
                        <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-xl">
                            <input 
                                type="text" 
                                value={webInput}
                                onChange={(e) => setWebInput(e.target.value)}
                                placeholder="Link YouTube ou Spotify..."
                                className="bg-transparent border-none text-xs text-white px-3 py-2 w-48 focus:ring-0"
                                onKeyDown={(e) => e.key === 'Enter' && addWebLink()}
                            />
                            <button 
                                onClick={addWebLink}
                                className="p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                            >
                                <Link size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {playlist.length === 0 ? (
                            <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl">
                                <Music size={40} className="text-slate-700 mx-auto mb-3" />
                                <p className="text-slate-500 text-sm">Sua playlist está vazia.<br/>Adicione links ou faça upload de arquivos.</p>
                            </div>
                        ) : (
                            playlist.map((track, index) => (
                                <div 
                                    key={track.id}
                                    className={`group flex items-center gap-4 p-3 rounded-2xl transition-all cursor-pointer ${index === currentTrackIndex ? 'bg-indigo-500/10 border border-indigo-500/30' : 'hover:bg-slate-800/50 border border-transparent'}`}
                                    onClick={() => {
                                        setCurrentTrackIndex(index);
                                        if (!isPlaying) handleMainPlay();
                                    }}
                                >
                                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {track.thumbnail ? (
                                            <img src={track.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                            <Music size={20} className="text-slate-600" />
                                        )}
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <h4 className={`text-sm font-bold truncate ${index === currentTrackIndex ? 'text-white' : 'text-slate-300'}`}>{track.name}</h4>
                                        <p className="text-xs text-slate-500 uppercase font-black tracking-wider">{track.type}</p>
                                    </div>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const newPlaylist = playlist.filter(t => t.id !== track.id);
                                            setPlaylist(newPlaylist);
                                            if (index === currentTrackIndex) {
                                                pauseTrack();
                                                setIsPlaying(false);
                                            }
                                        }}
                                        className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Sidebar Section */}
            <div className="lg:col-span-4 space-y-8">
                {/* Card de Fila de Boletins IA */}
                <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
                                <Newspaper size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    📰 Boletins IA
                                </h3>
                                <p className="text-[11px] text-slate-400">Fila do Smart Play</p>
                            </div>
                        </div>
                        <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-bold">
                            {boletinsQueue.length} na fila
                        </span>
                    </div>

                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                        {boletinsQueue.length === 0 ? (
                            <p className="text-center py-4 text-slate-500 text-xs italic">
                                Nenhum boletim na fila. Gere um novo boletim na aba "Boletim Inteligente IA".
                            </p>
                        ) : (
                            boletinsQueue.map(boletim => (
                                <div key={boletim.id} className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/80 flex items-center justify-between gap-3">
                                    <div className="min-w-0 flex-grow">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-white truncate">{boletim.niche}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${boletim.playbackStatus === 'played' ? 'bg-slate-700 text-slate-400' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                                                {boletim.playbackStatus === 'played' ? 'Tocado' : 'Na Fila'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{boletim.location} • {boletim.duration}s</p>
                                    </div>
                                    <button
                                        onClick={() => playBoletimNow(boletim)}
                                        className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 flex-shrink-0 transition-colors"
                                        title="Reproduzir este boletim agora no Smart Play"
                                    >
                                        <Play size={12} fill="currentColor" /> Tocar
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Background Audio Smartphone Card */}
                <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl">
                                <Smartphone size={22} />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white">Segundo Plano (Smartphone)</h4>
                                <p className="text-[11px] text-slate-400">Tocar ao sair da página ou bloquear tela</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                const nextVal = !isBackgroundPlaybackEnabled();
                                setBackgroundPlaybackEnabled(nextVal);
                                window.dispatchEvent(new CustomEvent('voxgen-background-setting-changed', { detail: { enabled: nextVal } }));
                            }}
                            className={`w-12 h-6 rounded-full relative transition-colors ${isBackgroundPlaybackEnabled() ? 'bg-emerald-500' : 'bg-slate-700'}`}
                            title="Alternar reprodução em segundo plano"
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isBackgroundPlaybackEnabled() ? 'left-7' : 'left-1'}`}></div>
                        </button>
                    </div>
                    <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 text-[11px] text-emerald-300 flex items-center justify-between">
                        <span>Status de Execução:</span>
                        <span className="font-bold uppercase tracking-wider">{isBackgroundPlaybackEnabled() ? 'Restaurado & Ativo' : 'Pausar ao Ocultar'}</span>
                    </div>
                </div>

                {/* AI Scheduler Card */}
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 border border-indigo-500/30 rounded-3xl p-8 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Mic2 size={80} />
                    </div>
                    
                    <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2 italic uppercase tracking-tight">
                        <Clock className="text-indigo-400" size={20} /> Agendador IA
                    </h3>

                    <div className="space-y-6">
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">Intervalo de Narração (Boletins IA)</label>
                            <div className="grid grid-cols-4 gap-2">
                                {[60, 300, 900, 1800, 3600].map(sec => (
                                    <button 
                                        key={sec}
                                        onClick={() => setIntervalSeconds(sec)}
                                        className={`py-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center ${intervalSeconds === sec ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-400' : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700'}`}
                                    >
                                        <span>{sec >= 3600 ? `${sec/3600}h` : sec >= 60 ? `${sec/60}m` : `${sec}s`}</span>
                                        {sec === 1800 && <span className="text-[9px] opacity-80 font-normal">Padrão</span>}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-slate-400">Próxima Intervenção</span>
                                <span className={`text-xs font-black px-2 py-0.5 rounded ${isNarratingUI ? 'bg-green-500/20 text-green-400 animate-pulse' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                    {isNarratingUI ? 'AO VIVO' : 'AGUARDANDO'}
                                </span>
                            </div>
                            <div className="text-4xl font-black text-white tracking-tighter tabular-nums">
                                {nextNarrationTimeDisplay}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isSmartEqEnabled ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700 text-slate-500'}`}>
                                    <Volume2 size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-white">Smart EQ</p>
                                    <p className="text-[10px] text-slate-500">Auto-ducking de volume</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsSmartEqEnabled(!isSmartEqEnabled)}
                                className={`w-10 h-5 rounded-full relative transition-colors ${isSmartEqEnabled ? 'bg-indigo-500' : 'bg-slate-700'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isSmartEqEnabled ? 'left-6' : 'left-1'}`}></div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Narration Selection Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Mic2 size={18} className="text-cyan-400" /> Banco de Vozes
                        </h3>
                        <div className="flex bg-slate-800 p-1 rounded-xl">
                            <button 
                                onClick={() => setNarrationSource('history')}
                                className={`p-2 rounded-lg transition-all ${narrationSource === 'history' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500'}`}
                                title="Histórico"
                            >
                                <Clock size={16} />
                            </button>
                            <button 
                                onClick={() => setNarrationSource('upload')}
                                className={`p-2 rounded-lg transition-all ${narrationSource === 'upload' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500'}`}
                                title="Uploads"
                            >
                                <Upload size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {narrationSource === 'history' ? (
                            narrationHistory.length === 0 ? (
                                <p className="text-center py-6 text-slate-600 text-xs italic">Nenhuma narração no histórico.</p>
                            ) : (
                                narrationHistory.map(item => (
                                    <div 
                                        key={item.id}
                                        onClick={() => handleToggleNarration(item.id)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${selectedNarrationIds.includes(item.id) ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-slate-800/50 border-transparent hover:border-slate-700'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedNarrationIds.includes(item.id) ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                            {selectedNarrationIds.includes(item.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <p className="text-xs font-bold text-slate-200 truncate">{item.text}</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">{item.voice}</p>
                                        </div>
                                    </div>
                                ))
                            )
                        ) : (
                            uploadedNarrations.length === 0 ? (
                                <div className="text-center py-6">
                                    <p className="text-slate-600 text-xs italic mb-3">Nenhum áudio enviado.</p>
                                    <button onClick={triggerUpload} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mx-auto">
                                        <Upload size={12} /> Fazer Upload
                                    </button>
                                </div>
                            ) : (
                                uploadedNarrations.map(item => (
                                    <div 
                                        key={item.id}
                                        onClick={() => handleToggleNarration(item.id)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${selectedNarrationIds.includes(item.id) ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-slate-800/50 border-transparent hover:border-slate-700'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedNarrationIds.includes(item.id) ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                            {selectedNarrationIds.includes(item.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <p className="text-xs font-bold text-slate-200 truncate">{item.name}</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">UPLOAD</p>
                                        </div>
                                        <button 
                                            onClick={(e) => handleRemoveNarration(item.id, e)}
                                            className="text-slate-600 hover:text-red-400 p-1"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )
                        )}
                    </div>

                    {!isPremium && !isCorporateMode && (
                        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
                            <Lock size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] text-amber-200/70 leading-relaxed">
                                <span className="font-bold text-amber-500">Modo Grátis:</span> Seleção limitada a 1 voz por vez e vinhetas obrigatórias a cada 4 narrações.
                            </p>
                        </div>
                    )}
                </div>

                {/* Remote Control Card */}
                <div 
                    onClick={() => setShowRemoteModal(true)}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex items-center gap-4 group cursor-pointer hover:border-indigo-500/50 transition-all"
                >
                    <div className="p-3 bg-slate-800 rounded-xl text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                        <Smartphone size={24} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white">Controle Remoto</h4>
                        <p className="text-xs text-slate-500">Acesse via QR Code no celular</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default SmartPlayer;
