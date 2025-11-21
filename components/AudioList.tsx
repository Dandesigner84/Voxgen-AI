import React, { useRef, useState } from 'react';
import { Play, Pause, Download, Clock, User } from 'lucide-react';
import { AudioItem } from '../types';
import { audioBufferToWav } from '../utils/audioUtils';

interface AudioListProps {
  items: AudioItem[];
  audioContext: AudioContext | null;
}

const AudioList: React.FC<AudioListProps> = ({ items, audioContext }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handlePlay = async (item: AudioItem) => {
    if (!audioContext) return;

    // If already playing this item, stop it
    if (playingId === item.id) {
      if (activeSourceRef.current) {
        activeSourceRef.current.stop();
        activeSourceRef.current = null;
      }
      setPlayingId(null);
      return;
    }

    // If playing something else, stop it first
    if (activeSourceRef.current) {
      activeSourceRef.current.stop();
      activeSourceRef.current = null;
    }

    // If context is suspended (browser policy), resume it
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = item.audioData;
    source.connect(audioContext.destination);
    
    source.onended = () => {
      setPlayingId(null);
      activeSourceRef.current = null;
    };

    source.start(0);
    activeSourceRef.current = source;
    setPlayingId(item.id);
  };

  const handleDownload = (item: AudioItem) => {
    const wavBlob = audioBufferToWav(item.audioData);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `voxgen-${item.id.slice(0,6)}.wav`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
        <p>Nenhum áudio gerado ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div 
          key={item.id} 
          className={`bg-slate-800 p-4 rounded-xl border transition-all duration-200 ${
            playingId === item.id ? 'border-indigo-500 shadow-lg shadow-indigo-900/20' : 'border-slate-700 hover:border-slate-600'
          }`}
        >
          <div className="flex justify-between items-start gap-4">
            <div className="flex-grow min-w-0">
               <div className="flex items-center gap-2 mb-2">
                 <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-slate-700 text-slate-300">
                    <User size={10} />
                    {item.voice}
                 </span>
                 <span className="flex items-center gap-1 text-xs text-slate-500">
                   <Clock size={10} />
                   {item.createdAt.toLocaleTimeString()}
                 </span>
               </div>
               <p className="text-sm text-slate-300 line-clamp-2 font-light italic">"{item.text}"</p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handlePlay(item)}
                className={`p-3 rounded-full transition-colors ${
                  playingId === item.id 
                    ? 'bg-indigo-500 text-white hover:bg-indigo-600' 
                    : 'bg-slate-700 text-indigo-400 hover:bg-slate-600'
                }`}
              >
                {playingId === item.id ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              </button>
              
              <button
                onClick={() => handleDownload(item)}
                className="p-3 rounded-full bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200 transition-colors"
                title="Baixar WAV"
              >
                <Download size={20} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AudioList;