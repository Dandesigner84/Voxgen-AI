
import React, { useState, useRef, useEffect } from 'react';
import { Radio, Upload, Play, Pause, SkipForward, Mic2, Clock, Youtube, Trash2, Link, Lock } from 'lucide-react';
import { AudioItem } from '../types';
import { isSmartPlayerUnlocked } from '../services/monetizationService';

interface SmartPlayerProps {
  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;
  narrationHistory: AudioItem[];
}

interface Track {
  id: string;
  type: 'file' | 'youtube';
  name: string;
  src: string; // Blob URL for file, Video ID for YouTube
  thumbnail?: string;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

const SmartPlayer: React.FC<SmartPlayerProps> = ({ audioContext, initAudioContext, narrationHistory }) => {
  // Playlist State
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Inputs
  const [youtubeInput, setYoutubeInput] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(60); // Default 1 minute
  
  // Narration State
  const [narrationSource, setNarrationSource] = useState<'history' | 'upload'>('history');
  const [uploadedNarration, setUploadedNarration] = useState<AudioBuffer | null>(null);
  const [selectedNarrationId, setSelectedNarrationId] = useState<string>('');
  const [nextNarrationTimeDisplay, setNextNarrationTimeDisplay] = useState<string>('--:--');
  
  // Refs & System
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  const isNarratingRef = useRef(false);
  const nextNarrationTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<number | null>(null);
  const narrationSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);

  const isPremium = isSmartPlayerUnlocked();

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Init Audio Element (Local Files)
    const ctx = initAudioContext();
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audioElRef.current = audio;

    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(ctx.destination);
    gainNodeRef.current = gain;

    // 2. Init YouTube API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = initYoutubePlayer;
    } else {
      initYoutubePlayer();
    }

    return () => {
      audio.pause();
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    };
  }, []);

  const initYoutubePlayer = () => {
    if (window.YT && window.YT.Player) {
        ytPlayerRef.current = new window.YT.Player('youtube-player-hidden', {
            height: '0',
            width: '0',
            events: {
                'onStateChange': onPlayerStateChange,
                'onError': (e: any) => console.error("YT Error", e)
            }
        });
    }
  };

  const onPlayerStateChange = (event: any) => {
      // YT.PlayerState.ENDED = 0
      if (event.data === 0) {
          handleNextTrack();
      }
  };

  // --- PLAYBACK CONTROL ---

  useEffect(() => {
    const currentTrack = playlist[currentTrackIndex];
    if (!currentTrack) return;

    if (isPlaying) {
        playTrack(currentTrack);
        startScheduler();
    } else {
        pauseTrack();
        stopScheduler();
    }
  }, [isPlaying, currentTrackIndex, playlist]); 

  const playTrack = (track: Track) => {
      // Stop the other player
      if (track.type === 'file') {
          ytPlayerRef.current?.pauseVideo();
          if (audioElRef.current) {
              const currentSrc = audioElRef.current.src;
              if (currentSrc !== track.src) {
                  audioElRef.current.src = track.src;
              }
              audioElRef.current.play().catch(e => console.error("Audio Play Error", e));
              audioElRef.current.onended = handleNextTrack;
          }
      } else {
          audioElRef.current?.pause();
          if (ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
               const playerState = ytPlayerRef.current.getPlayerState();
               ytPlayerRef.current.loadVideoById(track.src);
               ytPlayerRef.current.playVideo();
          }
      }
  };

  const pauseTrack = () => {
      audioElRef.current?.pause();
      ytPlayerRef.current?.pauseVideo();
      
      if (isNarratingRef.current && narrationSourceNodeRef.current) {
          narrationSourceNodeRef.current.stop();
          isNarratingRef.current = false;
          restoreVolume();
      }
  };

  const handleNextTrack = () => {
      if (playlist.length === 0) return;
      const nextIndex = (currentTrackIndex + 1) % playlist.length;
      setCurrentTrackIndex(nextIndex);
  };

  // --- NARRATION LOGIC ---

  const startScheduler = () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      
      if (nextNarrationTimeRef.current < Date.now()) {
           nextNarrationTimeRef.current = Date.now() + (intervalSeconds * 1000);
      }

      timerIntervalRef.current = window.setInterval(() => {
          const now = Date.now();
          const remaining = Math.max(0, Math.ceil((nextNarrationTimeRef.current - now) / 1000));
          
          if (remaining > 60) {
              const m = Math.floor(remaining / 60);
              const s = remaining % 60;
              setNextNarrationTimeDisplay(`${m}m ${s}s`);
          } else {
              setNextNarrationTimeDisplay(`${remaining}s`);
          }

          if (now >= nextNarrationTimeRef.current && !isNarratingRef.current) {
              playNarration();
          }
      }, 500);
  };

  const stopScheduler = () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  const playNarration = () => {
      const ctx = initAudioContext(); 
      if (ctx.state === 'suspended') ctx.resume();

      let buffer: AudioBuffer | null = null;
      if (narrationSource === 'upload') {
          buffer = uploadedNarration;
      } else {
          const item = narrationHistory.find(n => n.id === selectedNarrationId);
          if (item) buffer = item.audioData;
      }

      if (!buffer) {
          nextNarrationTimeRef.current = Date.now() + (intervalSeconds * 1000);
          return;
      }

      isNarratingRef.current = true;
      lowerVolume();

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      narrationSourceNodeRef.current = source;

      source.onended = () => {
          isNarratingRef.current = false;
          restoreVolume(); 
          nextNarrationTimeRef.current = Date.now() + (intervalSeconds * 1000);
      };

      source.start(0);
  };

  // --- VOLUME CONTROL (DUCKING) ---

  const lowerVolume = () => {
      const ctx = initAudioContext();
      if (gainNodeRef.current) {
          gainNodeRef.current.gain.setTargetAtTime(0.05, ctx.currentTime, 0.5);
      }
      if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
          ytPlayerRef.current.setVolume(5); 
      }
  };

  const restoreVolume = () => {
      const ctx = initAudioContext();
      if (gainNodeRef.current) {
           gainNodeRef.current.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 3.0);
      }
      if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
          let vol = 5;
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = window.setInterval(() => {
              vol += 5;
              if (vol >= 100) {
                  vol = 100;
                  if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
              }
              ytPlayerRef.current.setVolume(vol);
          }, 150); 
      }
  };

  // --- UI HANDLERS ---

  const addYoutubeLink = () => {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = youtubeInput.match(regExp);
      
      if (match && match[2].length === 11) {
          const id = match[2];
          const newTrack: Track = {
              id: crypto.randomUUID(),
              type: 'youtube',
              name: `YouTube Video (${id})`,
              src: id,
              thumbnail: `https://img.youtube.com/vi/${id}/0.jpg`
          };
          setPlaylist(prev => [...prev, newTrack]);
          setYoutubeInput('');
      } else {
          alert("Link do YouTube inválido");
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isPlaylist: boolean) => {
      if (e.target.files) {
          const files = Array.from(e.target.files) as File[];
          
          if (isPlaylist) {
              const newTracks: Track[] = files.map(f => ({
                  id: crypto.randomUUID(),
                  type: 'file',
                  name: f.name,
                  src: URL.createObjectURL(f)
              }));
              setPlaylist(prev => [...prev, ...newTracks]);
          } else {
              const f = files[0];
              const reader = new FileReader();
              reader.onload = async (ev) => {
                  const buffer = ev.target?.result as ArrayBuffer;
                  const ctx = initAudioContext();
                  const decoded = await ctx.decodeAudioData(buffer);
                  setUploadedNarration(decoded);
              };
              reader.readAsArrayBuffer(f);
          }
      }
  };

  const removeTrack = (index: number) => {
      const newPl = [...playlist];
      newPl.splice(index, 1);
      setPlaylist(newPl);
      if (currentTrackIndex >= index && currentTrackIndex > 0) {
          setCurrentTrackIndex(currentTrackIndex - 1);
      }
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 animate-fade-in pb-20">
        <div id="youtube-player-hidden" className="hidden"></div>

        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                <Radio className="text-cyan-400" /> Smart Player
            </h2>
            <p className="text-slate-400 text-sm">Rádio automática híbrida (YouTube + Arquivos Locais) com narração inteligente.</p>
        </div>

        {/* Main Player Display */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-8 mb-8 relative overflow-hidden">
             <div className="absolute inset-0 opacity-20 blur-3xl bg-gradient-to-br from-cyan-500 to-blue-600 pointer-events-none" />
             
             <div className="relative z-10 flex flex-col items-center">
                 <div className="w-64 h-64 rounded-full border-4 border-slate-700/50 shadow-2xl mb-6 overflow-hidden bg-black flex items-center justify-center relative">
                     {playlist[currentTrackIndex] ? (
                         playlist[currentTrackIndex].type === 'youtube' ? (
                             <img src={playlist[currentTrackIndex].thumbnail} alt="Cover" className="w-full h-full object-cover" />
                         ) : (
                             <div className="bg-gradient-to-br from-slate-700 to-slate-800 w-full h-full flex items-center justify-center">
                                 <Mic2 size={64} className="text-slate-500 opacity-50" />
                             </div>
                         )
                     ) : (
                         <div className="text-slate-600">Sem Faixa</div>
                     )}
                     
                     {isNarratingRef.current && (
                         <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                             <Mic2 size={48} className="text-cyan-400 animate-pulse" />
                             <span className="absolute bottom-10 text-cyan-400 font-bold text-sm uppercase tracking-widest">Narrando...</span>
                         </div>
                     )}
                 </div>

                 <h3 className="text-xl font-bold text-white mb-1 text-center line-clamp-1 max-w-md">
                     {playlist[currentTrackIndex]?.name || "Nenhuma faixa selecionada"}
                 </h3>
                 <p className="text-cyan-400 text-xs font-bold tracking-widest uppercase mb-8">
                     {playlist[currentTrackIndex]?.type === 'youtube' ? 'YouTube Stream' : 'Arquivo Local'}
                 </p>

                 <div className="flex items-center gap-8">
                     <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        disabled={playlist.length === 0}
                        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                            isPlaying 
                            ? 'bg-cyan-500 text-black shadow-[0_0_30px_rgba(6,182,212,0.5)] scale-105' 
                            : 'bg-slate-700 text-white hover:bg-slate-600'
                        }`}
                     >
                         {isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="white" className="ml-2" />}
                     </button>
                     
                     <button 
                        onClick={handleNextTrack}
                        className="p-4 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                     >
                         <SkipForward size={24} />
                     </button>
                 </div>

                 <div className="mt-8 bg-black/30 px-6 py-2 rounded-full border border-white/5 flex items-center gap-3">
                     <Clock size={14} className="text-cyan-400" />
                     <span className="text-xs text-slate-400">Próxima Narração em:</span>
                     <span className="text-sm font-mono font-bold text-white w-16 text-center">
                         {isPlaying ? nextNarrationTimeDisplay : '--:--'}
                     </span>
                 </div>
             </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Playlist Manager */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Upload size={18} className="text-purple-400" /> Gerenciar Playlist
                </h4>
                
                <div className="space-y-4 mb-6">
                    <div className="flex gap-2">
                        <div className="relative flex-grow">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                <Link size={14} />
                            </div>
                            <input 
                                type="text" 
                                value={youtubeInput}
                                onChange={(e) => setYoutubeInput(e.target.value)}
                                placeholder="Cole link do YouTube aqui..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:border-cyan-500 outline-none"
                            />
                        </div>
                        <button 
                            onClick={addYoutubeLink}
                            className="bg-red-600 hover:bg-red-500 text-white px-4 rounded-lg transition-colors"
                        >
                            <Youtube size={18} />
                        </button>
                    </div>

                    <label className="flex items-center justify-center gap-2 w-full py-2 border border-dashed border-slate-600 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors">
                        <Upload size={16} className="text-slate-400" />
                        <span className="text-sm text-slate-300">Adicionar MP3/WAV Locais</span>
                        <input 
                            type="file" 
                            multiple 
                            accept=".mp3,.wav,.m4a,.aac,audio/*" 
                            onChange={(e) => handleFileUpload(e, true)}
                            className="hidden" 
                        />
                    </label>
                </div>

                <div className="h-64 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    {playlist.length === 0 && (
                        <div className="text-center py-8 text-slate-600 text-sm">Playlist vazia</div>
                    )}
                    {playlist.map((track, idx) => (
                        <div key={track.id} className={`flex items-center justify-between p-3 rounded-lg text-sm ${idx === currentTrackIndex ? 'bg-cyan-900/20 border border-cyan-500/30 text-cyan-200' : 'bg-slate-800 text-slate-300'}`}>
                            <div className="flex items-center gap-3 truncate">
                                {track.type === 'youtube' ? <Youtube size={14} className="text-red-400 flex-shrink-0" /> : <Mic2 size={14} className="text-blue-400 flex-shrink-0" />}
                                <span className="truncate max-w-[180px]">{track.name}</span>
                            </div>
                            <button onClick={() => removeTrack(idx)} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Narration Manager */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                 <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Mic2 size={18} className="text-cyan-400" /> Configurar Narração
                 </h4>

                 <div className="flex bg-slate-800 p-1 rounded-lg mb-6">
                     <button 
                        onClick={() => setNarrationSource('history')}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${narrationSource === 'history' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                     >
                         Do Histórico VoxGen
                     </button>
                     <button 
                        onClick={() => setNarrationSource('upload')}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${narrationSource === 'upload' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                     >
                         Upload de Arquivo
                     </button>
                 </div>

                 {narrationSource === 'history' ? (
                     <div className="mb-6">
                         <label className="block text-xs text-slate-400 mb-2">Selecione uma narração criada:</label>
                         <select 
                            value={selectedNarrationId} 
                            onChange={(e) => setSelectedNarrationId(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg p-3 outline-none focus:border-cyan-500"
                         >
                             <option value="">-- Selecione --</option>
                             {narrationHistory.map(n => (
                                 <option key={n.id} value={n.id}>{n.text.substring(0, 40)}...</option>
                             ))}
                         </select>
                     </div>
                 ) : (
                     <div className="mb-6">
                         <label className="block w-full h-24 border border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors">
                             {uploadedNarration ? (
                                 <span className="text-cyan-400 text-sm font-bold">Arquivo Carregado!</span>
                             ) : (
                                 <>
                                     <Upload size={20} className="text-slate-400 mb-2" />
                                     <span className="text-xs text-slate-400">Clique para enviar MP3/WAV</span>
                                 </>
                             )}
                             <input 
                                type="file" 
                                accept=".mp3,.wav,.m4a,.aac,audio/*"
                                onChange={(e) => handleFileUpload(e, false)}
                                className="hidden"
                             />
                         </label>
                     </div>
                 )}

                 {/* Interval Slider */}
                 <div>
                     <div className="flex justify-between mb-2">
                         <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-400">Intervalo entre locuções</label>
                            {!isPremium && <Lock size={10} className="text-yellow-500" />}
                         </div>
                         <span className={`text-xs font-bold ${isPremium ? 'text-cyan-400' : 'text-slate-500'}`}>{intervalSeconds} segundos</span>
                     </div>
                     <input 
                        type="range" 
                        min="5" 
                        max={isPremium ? "180" : "60"} 
                        step="5"
                        value={intervalSeconds} 
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isPremium && val > 60) return; // Prevent change
                            setIntervalSeconds(val);
                        }}
                        disabled={!isPremium}
                        className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isPremium ? 'bg-slate-700 accent-cyan-500' : 'bg-slate-800 accent-slate-600'}`}
                     />
                     <div className="flex justify-between mt-1 text-[10px] text-slate-600">
                         <span>5s</span>
                         <span>{isPremium ? '3min' : '60s (Free Max)'}</span>
                     </div>
                     {!isPremium && (
                         <p className="text-[10px] text-yellow-500/80 mt-2 bg-yellow-900/10 p-2 rounded border border-yellow-900/20">
                             <Lock size={8} className="inline mr-1"/>
                             Usuários Free limitados a 60s. Insira um código para liberar até 3min.
                         </p>
                     )}
                 </div>
            </div>

        </div>
    </div>
  );
};

export default SmartPlayer;
