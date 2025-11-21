
import React, { useState, useRef, useEffect } from 'react';
import { Radio, Upload, Play, Pause, SkipForward, Mic2, Clock, Youtube, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { AudioItem } from '../types';

interface SmartPlayerProps {
  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;
  narrationHistory: AudioItem[];
}

type TrackType = 'file' | 'youtube';

interface Track {
  id: string;
  type: TrackType;
  name: string;
  src: string | File; // URL (blob or youtube id) or File object
  thumbnail?: string;
}

// Global declaration for YouTube API
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
  const [youtubeLink, setYoutubeLink] = useState('');
  
  // Narration State
  const [selectedNarrationId, setSelectedNarrationId] = useState<string>('');
  const [uploadedNarration, setUploadedNarration] = useState<AudioBuffer | null>(null);
  const [narrationSource, setNarrationSource] = useState<'history' | 'upload'>('history');

  // Controls
  const [isPlaying, setIsPlaying] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(15);
  const [nextNarrationTime, setNextNarrationTime] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false); // Combined readiness
  const [isYoutubeApiReady, setIsYoutubeApiReady] = useState(false);

  // Refs
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const musicSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number | null>(null);
  const isNarratingRef = useRef(false); // Critical for preventing echo
  
  // YouTube Refs
  const playerRef = useRef<any>(null);

  // --- Initialization ---

  useEffect(() => {
    // 1. Setup Web Audio for Local Files
    const ctx = initAudioContext();
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audioElRef.current = audio;

    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(ctx.destination);

    musicSourceNodeRef.current = source;
    gainNodeRef.current = gain;

    // 2. Load YouTube API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        setIsYoutubeApiReady(true);
        initYoutubePlayer();
      };
    } else {
      setIsYoutubeApiReady(true);
      initYoutubePlayer();
    }

    return () => {
      audio.pause();
      audio.src = '';
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const initYoutubePlayer = () => {
    if (window.YT && !playerRef.current) {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: {
          'playsinline': 1,
          'controls': 0,
          'disablekb': 1,
          'fs': 0,
          'rel': 0,
          'origin': window.location.origin
        },
        events: {
          'onReady': () => setIsPlayerReady(true),
          'onStateChange': onPlayerStateChange
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

  // --- Track Management ---

  // Effect to trigger playback when track changes
  useEffect(() => {
    if (playlist.length === 0) {
        setIsPlayerReady(true); // Ready to accept input
        return;
    }

    setIsPlayerReady(false); // Loading new track...

    const track = playlist[currentTrackIndex];
    const audio = audioElRef.current;
    const ytPlayer = playerRef.current;

    // Reset everything first
    if (audio) audio.pause();
    if (ytPlayer && typeof ytPlayer.stopVideo === 'function') ytPlayer.stopVideo();

    if (track.type === 'file') {
       if (audio) {
         audio.src = track.src as string;
         audio.onended = handleNextTrack;
         // Local files load fast, basically ready immediately
         setIsPlayerReady(true);
         
         if (isPlaying) {
            const ctx = initAudioContext();
            if (ctx.state === 'suspended') ctx.resume();
            audio.play().catch(e => console.error("Play error", e));
         }
       }
    } else if (track.type === 'youtube') {
       if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
          ytPlayer.loadVideoById(track.src); // src is video ID
          // We wait for the player to buffer/load
          if (!isPlaying) {
             ytPlayer.pauseVideo();
          }
          // Note: onStateChange will handle readiness, but we can assume ready shortly
          setTimeout(() => setIsPlayerReady(true), 1000);
       } else {
           // If player not init yet, wait
           setTimeout(() => setIsPlayerReady(true), 2000);
       }
    }

  }, [currentTrackIndex, playlist]);

  // Watch isPlaying state to toggle current players
  useEffect(() => {
    if (playlist.length === 0) return;
    const track = playlist[currentTrackIndex];

    if (track.type === 'file' && audioElRef.current) {
       isPlaying ? audioElRef.current.play() : audioElRef.current.pause();
    } else if (track.type === 'youtube' && playerRef.current && typeof playerRef.current.playVideo === 'function') {
       isPlaying ? playerRef.current.playVideo() : playerRef.current.pauseVideo();
    }

    // Interval Logic
    if (isPlaying) {
       // Reset timer initially
       setNextNarrationTime(Date.now() + intervalSeconds * 1000);
       isNarratingRef.current = false;

       if (intervalRef.current) clearInterval(intervalRef.current);
       
       intervalRef.current = window.setInterval(() => {
           if (!isNarratingRef.current && Date.now() >= nextNarrationTime) {
                playNarration();
           }
       }, 1000);
    } else {
       if (intervalRef.current) clearInterval(intervalRef.current);
       isNarratingRef.current = false;
    }

  }, [isPlaying]);

  // If intervalSeconds changes while playing, update the target time
  useEffect(() => {
      if (isPlaying) {
          setNextNarrationTime(Date.now() + intervalSeconds * 1000);
      }
  }, [intervalSeconds]);

  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newTracks: Track[] = (Array.from(e.target.files) as File[]).map(file => ({
        id: crypto.randomUUID(),
        type: 'file',
        name: file.name,
        src: URL.createObjectURL(file)
      }));
      setPlaylist(prev => [...prev, ...newTracks]);
    }
  };

  const handleYoutubeAdd = () => {
    if (!youtubeLink) return;
    // Extract ID
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = youtubeLink.match(regExp);
    const id = (match && match[2].length === 11) ? match[2] : null;

    if (id) {
      setPlaylist(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'youtube',
        name: `YouTube Video`,
        src: id,
        thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`
      }]);
      setYoutubeLink('');
    } else {
      alert("Link inválido do YouTube");
    }
  };

  const removeTrack = (index: number) => {
    const newPlaylist = [...playlist];
    newPlaylist.splice(index, 1);
    setPlaylist(newPlaylist);
    if (index === currentTrackIndex) {
        setCurrentTrackIndex(0);
        setIsPlaying(false);
    } else if (index < currentTrackIndex) {
        setCurrentTrackIndex(prev => prev - 1);
    }
  };

  const handleNextTrack = () => {
    setCurrentTrackIndex(prev => (prev + 1) % playlist.length);
  };

  // --- Narration & Ducking ---

  const handleNarrationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const ctx = initAudioContext();
        const ab = await e.target.files[0].arrayBuffer();
        const buffer = await ctx.decodeAudioData(ab);
        setUploadedNarration(buffer);
        setNarrationSource('upload');
    }
  };

  const playNarration = () => {
    // LOCK to prevent echo/loop
    if (isNarratingRef.current) return;
    isNarratingRef.current = true;

    // Force reset next time to infinity temporarily so interval doesn't catch it again
    setNextNarrationTime(Date.now() + 9999999); 

    const ctx = initAudioContext();
    let buffer: AudioBuffer | null = null;

    if (narrationSource === 'upload') {
        buffer = uploadedNarration;
    } else {
        const item = narrationHistory.find(n => n.id === selectedNarrationId);
        if (item) buffer = item.audioData;
    }

    if (!buffer) {
        console.warn("No narration buffer found, skipping.");
        isNarratingRef.current = false;
        // Retry in 5 seconds if failed
        setNextNarrationTime(Date.now() + 5000);
        return;
    }

    const currentTrack = playlist[currentTrackIndex];
    const fadeTime = 1.0;
    const now = ctx.currentTime;

    // --- DUCKING LOGIC START ---
    
    if (currentTrack?.type === 'file' && gainNodeRef.current) {
       gainNodeRef.current.gain.cancelScheduledValues(now);
       gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, now);
       gainNodeRef.current.gain.linearRampToValueAtTime(0.15, now + fadeTime);
    } else if (currentTrack?.type === 'youtube' && playerRef.current) {
       if (typeof playerRef.current.setVolume === 'function') {
           playerRef.current.setVolume(15);
       }
    }

    // --- PLAY VOICE ---
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(now + fadeTime); 
    
    source.onended = () => {
        // --- DUCKING LOGIC END (RESTORE) ---
        const endNow = ctx.currentTime;
        
        if (currentTrack?.type === 'file' && gainNodeRef.current) {
            gainNodeRef.current.gain.cancelScheduledValues(endNow);
            gainNodeRef.current.gain.setValueAtTime(0.15, endNow);
            gainNodeRef.current.gain.linearRampToValueAtTime(1.0, endNow + fadeTime);
        } else if (currentTrack?.type === 'youtube' && playerRef.current) {
            if (typeof playerRef.current.setVolume === 'function') {
                playerRef.current.setVolume(100);
            }
        }
        
        // Unlock and Schedule next
        isNarratingRef.current = false;
        setNextNarrationTime(Date.now() + intervalSeconds * 1000);
    };
  };

  const togglePlayback = () => {
      const ctx = initAudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      
      if (playlist.length === 0) {
          alert("Adicione músicas à playlist primeiro.");
          return;
      }

      // Validate Narration setup
      const hasNarration = (narrationSource === 'history' && selectedNarrationId) || (narrationSource === 'upload' && uploadedNarration);
      if (!hasNarration) {
          alert("Atenção: Nenhuma narração selecionada. O player tocará apenas a música.");
      }

      if (!isPlayerReady) return;

      setIsPlaying(!isPlaying);
  };

  // Visual Helpers
  const currentTrack = playlist[currentTrackIndex];
  const showThumbnail = currentTrack?.type === 'youtube' && currentTrack.thumbnail;

  // Format helper
  const formatTime = (secs: number) => {
      if (secs < 60) return `${secs}s`;
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}m ${s}s`;
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 animate-fade-in pb-20">
        <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <Radio className="text-cyan-400" /> Smart Player Auto-DJ
            </h2>
            <p className="text-slate-400 text-sm">Misture músicas locais e vídeos do YouTube com narração automática.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT: Playlist Manager (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 h-full flex flex-col">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <Upload size={18} className="text-cyan-400" /> Gerenciar Playlist
                    </h3>
                    
                    {/* Inputs */}
                    <div className="space-y-3 mb-4">
                         {/* File Input */}
                        <div className="border border-dashed border-slate-600 rounded-lg p-3 text-center cursor-pointer hover:bg-slate-800 transition-all relative">
                            <input 
                                type="file" 
                                multiple 
                                accept="audio/*" 
                                onChange={handleLocalUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer" 
                            />
                            <div className="flex items-center justify-center gap-2 text-xs text-slate-300">
                                <Upload size={14} /> Adicionar MP3s
                            </div>
                        </div>

                        {/* YouTube Input */}
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                value={youtubeLink}
                                onChange={(e) => setYoutubeLink(e.target.value)}
                                placeholder="Link do YouTube..."
                                className="flex-grow bg-slate-900 border border-slate-700 rounded-lg px-3 text-xs text-white outline-none focus:border-cyan-500"
                            />
                            <button 
                                onClick={handleYoutubeAdd}
                                className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-lg"
                            >
                                <Youtube size={16} />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 min-h-[200px] border-t border-slate-700/50 pt-3">
                        {playlist.length === 0 && <p className="text-center text-slate-500 text-xs mt-10">Playlist vazia</p>}
                        {playlist.map((track, i) => (
                            <div 
                                key={track.id} 
                                className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors group ${i === currentTrackIndex ? 'bg-cyan-900/30 border border-cyan-500/30' : 'bg-slate-900 border border-transparent'}`}
                            >
                                <div 
                                    className="flex items-center gap-2 overflow-hidden cursor-pointer flex-grow"
                                    onClick={() => { setCurrentTrackIndex(i); setIsPlaying(true); }}
                                >
                                    {track.type === 'youtube' ? <Youtube size={12} className="text-red-400 flex-shrink-0" /> : <Upload size={12} className="text-cyan-400 flex-shrink-0" />}
                                    <span className={`truncate ${i === currentTrackIndex ? 'text-cyan-300 font-medium' : 'text-slate-400'}`}>
                                        {track.name}
                                    </span>
                                </div>
                                <button onClick={() => removeTrack(i)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CENTER: Player & Visual (5 cols) */}
            <div className="lg:col-span-5 flex flex-col">
                <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center flex-grow shadow-2xl relative overflow-hidden min-h-[400px]">
                    
                    {/* The Player Circle / Video Container */}
                    <div className={`relative w-64 h-64 rounded-full border-4 flex items-center justify-center mb-8 transition-all duration-500 overflow-hidden bg-black ${isPlaying ? 'border-cyan-400 shadow-[0_0_40px_rgba(34,211,238,0.2)]' : 'border-slate-700'}`}>
                        
                        {/* Hidden container for YT API initialization, but we move it into view if track is YT */}
                        <div id="youtube-player" className="absolute inset-0 w-full h-full pointer-events-none" style={{ display: currentTrack?.type === 'youtube' ? 'block' : 'none', opacity: 0 }} />
                        
                        {/* Thumbnail or Video Display */}
                        {showThumbnail ? (
                             <div className="absolute inset-0 w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${currentTrack.thumbnail})` }}>
                                 {/* Overlay to make it look active */}
                                 {isPlaying && <div className="absolute inset-0 bg-cyan-500/10 animate-pulse" />}
                             </div>
                        ) : (
                            /* Fallback Icon for MP3s */
                            <div className="flex items-center justify-center w-full h-full bg-slate-900">
                                <Radio size={64} className={`text-slate-600 ${isPlaying ? 'text-cyan-400 animate-pulse' : ''}`} />
                            </div>
                        )}
                        
                        {/* Visualizer overlay for style */}
                         {currentTrack?.type !== 'youtube' && isPlaying && <div className="absolute inset-0 bg-cyan-500/10 animate-ping rounded-full" />}
                    </div>

                    <h2 className="text-lg font-bold text-white mb-1 max-w-xs truncate px-4">
                        {currentTrack?.name || "Aguardando Playlist..."}
                    </h2>
                    <p className="text-cyan-500 text-[10px] font-bold uppercase tracking-widest mb-8 flex items-center gap-2">
                        {isPlaying ? <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"/> : <span className="w-2 h-2 bg-slate-600 rounded-full"/>}
                        {currentTrack?.type === 'youtube' ? 'YouTube Audio' : 'Local Audio'}
                    </p>

                    {/* Controls */}
                    <div className="flex items-center gap-8">
                        <button 
                            onClick={togglePlayback}
                            disabled={!isPlayerReady || playlist.length === 0}
                            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all transform ${
                                !isPlayerReady || playlist.length === 0 
                                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                                    : isPlaying 
                                        ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/50 hover:scale-110' 
                                        : 'bg-slate-700 text-white hover:bg-slate-600 hover:scale-110'
                            }`}
                        >
                            {!isPlayerReady && playlist.length > 0 ? (
                                <Loader2 className="animate-spin" />
                            ) : isPlaying ? (
                                <Pause fill="currentColor" />
                            ) : (
                                <Play fill="currentColor" className="ml-1" />
                            )}
                        </button>
                        <button 
                            onClick={handleNextTrack}
                            disabled={playlist.length <= 1}
                            className="w-12 h-12 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                        >
                            <SkipForward size={20} />
                        </button>
                    </div>
                    
                    {/* Loading Status */}
                    {!isPlayerReady && playlist.length > 0 && (
                         <span className="text-xs text-cyan-400 mt-4 animate-pulse">Carregando Player...</span>
                    )}
                </div>
            </div>

            {/* RIGHT: Narration Config (3 cols) */}
            <div className="lg:col-span-3 space-y-6">
                 <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 h-full">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <Mic2 size={18} className="text-cyan-400" /> Narração
                        </h3>
                        
                        {/* Readiness Dot */}
                        {((narrationSource === 'history' && selectedNarrationId) || (narrationSource === 'upload' && uploadedNarration)) ? (
                            <span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]" title="Narração pronta" />
                        ) : (
                            <span className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_5px_rgba(239,68,68,0.5)]" title="Narração pendente" />
                        )}
                     </div>

                     <div className="space-y-6">
                        {/* Source Selector */}
                        <div className="flex bg-slate-900 rounded-lg p-1">
                            <button 
                                onClick={() => setNarrationSource('history')}
                                className={`flex-1 py-2 text-xs rounded font-medium transition-all ${narrationSource === 'history' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400'}`}
                            >Histórico</button>
                            <button 
                                onClick={() => setNarrationSource('upload')}
                                className={`flex-1 py-2 text-xs rounded font-medium transition-all ${narrationSource === 'upload' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400'}`}
                            >Upload</button>
                        </div>

                        {/* Content */}
                        {narrationSource === 'history' ? (
                             <div className="space-y-2">
                                <label className="text-xs text-slate-400 block">Selecionar do VoxGen:</label>
                                <select 
                                    value={selectedNarrationId}
                                    onChange={(e) => setSelectedNarrationId(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg p-3 outline-none focus:border-cyan-500"
                                >
                                    <option value="">Selecione...</option>
                                    {narrationHistory.map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.voice} - {item.text.substring(0, 20)}...
                                        </option>
                                    ))}
                                </select>
                                {narrationHistory.length === 0 && <p className="text-[10px] text-red-400">Nenhuma narração criada ainda.</p>}
                             </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 block">Arquivo de Voz:</label>
                                <input 
                                    type="file"
                                    accept="audio/*"
                                    onChange={handleNarrationUpload}
                                    className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-cyan-900 file:text-cyan-200 hover:file:bg-cyan-800 cursor-pointer"
                                />
                            </div>
                        )}

                        {/* Timer */}
                        <div className="pt-6 border-t border-slate-700/50">
                            <div className="flex justify-between text-xs font-medium text-slate-300 mb-4">
                                <span className="flex items-center gap-2"><Clock size={14} /> Intervalo</span>
                                <span className="text-cyan-400">{formatTime(intervalSeconds)}</span>
                            </div>
                            <input 
                                type="range" 
                                min="5" 
                                max="180" 
                                value={intervalSeconds} 
                                onChange={(e) => setIntervalSeconds(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                            <p className="text-[10px] text-slate-500 mt-2 text-center">
                                A narração tocará a cada {formatTime(intervalSeconds)} de música.
                            </p>
                        </div>
                        
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 flex gap-2 items-start">
                            <AlertCircle size={14} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] text-yellow-200/80 leading-tight">
                                Certifique-se de selecionar uma narração válida antes de iniciar para ativar o Auto-DJ.
                            </p>
                        </div>
                     </div>
                </div>
            </div>

        </div>
    </div>
  );
};

export default SmartPlayer;
