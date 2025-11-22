
import React, { useState, useRef, useEffect } from 'react';
import { Radio, Upload, Play, Pause, SkipForward, Mic2, Clock, Youtube, Trash2, Loader2 } from 'lucide-react';
import { AudioItem } from '../types';

interface SmartPlayerProps {
  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;
  narrationHistory: AudioItem[];
}

const SmartPlayer: React.FC<SmartPlayerProps> = ({ audioContext, initAudioContext, narrationHistory }) => {
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(15);
  const [narrationSource, setNarrationSource] = useState<'history' | 'upload'>('history');
  const [uploadedNarration, setUploadedNarration] = useState<AudioBuffer | null>(null);
  const [selectedNarrationId, setSelectedNarrationId] = useState<string>('');
  
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const nextNarrationTimeRef = useRef(0);
  const isNarratingRef = useRef(false);

  // Setup inicial (simplificado)
  useEffect(() => {
    const ctx = initAudioContext();
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audioElRef.current = audio;
    
    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(ctx.destination);
    gainNodeRef.current = gain;

    return () => { audio.pause(); };
  }, []);

  // Lógica de Loop
  useEffect(() => {
      let interval: number;
      if (isPlaying) {
          nextNarrationTimeRef.current = Date.now() + (intervalSeconds * 1000);
          interval = window.setInterval(() => {
              if (!isNarratingRef.current && Date.now() >= nextNarrationTimeRef.current) {
                  playNarration();
              }
          }, 1000);
          audioElRef.current?.play();
      } else {
          audioElRef.current?.pause();
      }
      return () => clearInterval(interval);
  }, [isPlaying]);

  const playNarration = () => {
      if (isNarratingRef.current) return;
      isNarratingRef.current = true;
      
      const ctx = initAudioContext();
      let buffer = narrationSource === 'upload' ? uploadedNarration : narrationHistory.find(n => n.id === selectedNarrationId)?.audioData;
      
      if (!buffer) {
          isNarratingRef.current = false;
          nextNarrationTimeRef.current = Date.now() + 5000; // Tenta de novo em 5s
          return;
      }

      // DUCKING: Baixa volume para 5% (0.05)
      const now = ctx.currentTime;
      if (gainNodeRef.current) {
          gainNodeRef.current.gain.setTargetAtTime(0.05, now, 0.5);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(now);
      
      source.onended = () => {
          // RESTORE: Volume volta a 100%
          if (gainNodeRef.current) {
              gainNodeRef.current.gain.setTargetAtTime(1.0, ctx.currentTime, 0.5);
          }
          isNarratingRef.current = false;
          nextNarrationTimeRef.current = Date.now() + (intervalSeconds * 1000);
      };
  };

  const handleUpload = (e: any, isPlaylist: boolean) => {
      if (e.target.files) {
          if (isPlaylist) {
              const files = Array.from(e.target.files).map((f: any) => ({
                  id: crypto.randomUUID(), type: 'file', name: f.name, src: URL.createObjectURL(f)
              }));
              setPlaylist(prev => [...prev, ...files]);
          } else {
              const f = e.target.files[0];
              f.arrayBuffer().then((ab: any) => initAudioContext().decodeAudioData(ab)).then(setUploadedNarration);
          }
      }
  };

  useEffect(() => {
      if (playlist[currentTrackIndex]?.type === 'file' && audioElRef.current) {
          audioElRef.current.src = playlist[currentTrackIndex].src;
          if (isPlaying) audioElRef.current.play();
          audioElRef.current.onended = () => setCurrentTrackIndex(p => (p + 1) % playlist.length);
      }
  }, [currentTrackIndex, playlist]);

  return (
    <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8"><h2 className="text-2xl font-bold text-white"><Radio className="inline"/> Smart Player</h2></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h3 className="text-cyan-400 font-bold mb-4 flex gap-2"><Upload/> Playlist</h3>
                <input type="file" multiple accept=".mp3,.wav,.m4a,.aac,audio/*" onChange={(e) => handleUpload(e, true)} className="block w-full text-sm text-slate-400 file:bg-cyan-900 file:text-cyan-200 file:rounded-full file:px-4 mb-4"/>
                <div className="h-40 overflow-y-auto bg-slate-900 p-2 rounded">
                    {playlist.map((t, i) => <div key={i} className={`text-xs p-2 ${i === currentTrackIndex ? 'text-cyan-400' : 'text-slate-400'}`}>{t.name}</div>)}
                </div>
            </div>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h3 className="text-cyan-400 font-bold mb-4 flex gap-2"><Mic2/> Narração</h3>
                <div className="mb-4 flex gap-2">
                    <button onClick={() => setNarrationSource('history')} className={`text-xs px-3 py-1 rounded ${narrationSource === 'history' ? 'bg-cyan-600' : 'bg-slate-700'}`}>Histórico</button>
                    <button onClick={() => setNarrationSource('upload')} className={`text-xs px-3 py-1 rounded ${narrationSource === 'upload' ? 'bg-cyan-600' : 'bg-slate-700'}`}>Upload</button>
                </div>
                {narrationSource === 'history' ? (
                    <select onChange={(e) => setSelectedNarrationId(e.target.value)} className="w-full bg-slate-900 text-white p-2 rounded mb-4 text-xs">
                        <option value="">Selecione...</option>
                        {narrationHistory.map(n => <option key={n.id} value={n.id}>{n.text.slice(0, 20)}...</option>)}
                    </select>
                ) : (
                    <input type="file" accept=".mp3,.wav,.m4a,.aac,audio/*" onChange={(e) => handleUpload(e, false)} className="block w-full text-sm text-slate-400 file:bg-cyan-900 mb-4"/>
                )}
                <label className="text-xs text-slate-400 block mb-1">Intervalo: {intervalSeconds}s</label>
                <input type="range" min="5" max="180" value={intervalSeconds} onChange={(e) => setIntervalSeconds(Number(e.target.value))} className="w-full accent-cyan-500"/>
            </div>
        </div>
        <div className="flex justify-center mt-8">
            <button onClick={() => setIsPlaying(!isPlaying)} className="w-16 h-16 bg-cyan-500 rounded-full flex items-center justify-center text-black shadow-lg hover:scale-110 transition-transform">
                {isPlaying ? <Pause fill="black"/> : <Play fill="black"/>}
            </button>
        </div>
    </div>
  );
};
export default SmartPlayer;
