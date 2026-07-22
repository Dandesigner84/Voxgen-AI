
import React, { useRef, useState } from 'react';
import { Play, Pause, Download, Clock, User, ChevronDown, FileAudio } from 'lucide-react';
import { AudioItem } from '../types';
import { audioBufferToWav, audioBufferToMp3 } from '../utils/audioUtils';
import { startKeepAlive, updateMediaSession, setMediaSessionPlaybackState } from '../utils/backgroundAudio';

interface AudioListProps {
  items: AudioItem[];
  audioContext: AudioContext | null;
}

const AudioList: React.FC<AudioListProps> = ({ items, audioContext }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [openExportId, setOpenExportId] = useState<string | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handlePlay = async (item: AudioItem) => {
    if (!audioContext) return;

    if (playingId === item.id) {
      if (activeSourceRef.current) {
        activeSourceRef.current.stop();
        activeSourceRef.current = null;
      }
      setPlayingId(null);
      setMediaSessionPlaybackState('paused');
      return;
    }

    if (activeSourceRef.current) {
      activeSourceRef.current.stop();
      activeSourceRef.current = null;
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    startKeepAlive();
    updateMediaSession({
      title: item.text.slice(0, 30) + '...',
      artist: `Voz: ${item.voice}`,
      album: 'VoxGen Narração',
      artworkUrl: '/icon.png'
    }, {
      onPlay: () => handlePlay(item),
      onPause: () => {
        if (activeSourceRef.current) {
          activeSourceRef.current.stop();
          activeSourceRef.current = null;
        }
        setPlayingId(null);
        setMediaSessionPlaybackState('paused');
      }
    });
    setMediaSessionPlaybackState('playing');

    const source = audioContext.createBufferSource();
    source.buffer = item.audioData;
    source.connect(audioContext.destination);
    
    source.onended = () => {
      setPlayingId(null);
      activeSourceRef.current = null;
      setMediaSessionPlaybackState('paused');
    };

    source.start(0);
    activeSourceRef.current = source;
    setPlayingId(item.id);
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleDownloadWav = (item: AudioItem) => {
    const wavBlob = audioBufferToWav(item.audioData);
    downloadFile(wavBlob, `voxgen-${item.id.slice(0,6)}.wav`);
    setOpenExportId(null);
  };

  const handleDownloadMp3 = (item: AudioItem) => {
    try {
      const mp3Blob = audioBufferToMp3(item.audioData);
      downloadFile(mp3Blob, `voxgen-${item.id.slice(0,6)}.mp3`);
    } catch (e: any) {
      alert("Erro ao converter para MP3: " + e.message);
    }
    setOpenExportId(null);
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

            <div className="flex items-center gap-2 flex-shrink-0 relative">
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
              
              <div className="relative">
                <button
                  onClick={() => setOpenExportId(openExportId === item.id ? null : item.id)}
                  className="p-3 rounded-full bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200 transition-colors flex items-center gap-1"
                  title="Exportar"
                >
                  <Download size={20} />
                  <ChevronDown size={14} />
                </button>

                {openExportId === item.id && (
                  <div className="absolute right-0 mt-2 w-36 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                    <button 
                      onClick={() => handleDownloadWav(item)}
                      className="w-full text-left px-4 py-3 text-xs font-bold text-slate-300 hover:bg-indigo-600 hover:text-white flex items-center gap-2 transition-colors border-b border-slate-800"
                    >
                      <FileAudio size={14} /> Baixar WAV
                    </button>
                    <button 
                      onClick={() => handleDownloadMp3(item)}
                      className="w-full text-left px-4 py-3 text-xs font-bold text-slate-300 hover:bg-indigo-600 hover:text-white flex items-center gap-2 transition-colors"
                    >
                      <FileAudio size={14} /> Baixar MP3
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AudioList;
