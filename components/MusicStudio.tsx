
import React, { useState, useRef } from 'react';
import { Sparkles, Play, Pause, Disc, Music2, ListMusic, Upload, Mic2 } from 'lucide-react';
import { MusicItem } from '../types';
import { generateSongMetadata } from '../services/geminiService';
import { generateInstrumentalTrack, mixAudioBuffers } from '../utils/audioUtils';

interface MusicStudioProps {
  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;
}

type StudioMode = 'scratch' | 'remix';

const MusicStudio: React.FC<MusicStudioProps> = ({ audioContext, initAudioContext }) => {
  const [mode, setMode] = useState<StudioMode>('scratch');
  
  // General State
  const [prompt, setPrompt] = useState('');
  const [styleInput, setStyleInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [playlist, setPlaylist] = useState<MusicItem[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  // Remix State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleCreate = async () => {
    // Capture the context immediately. The prop 'audioContext' might be stale if app hasn't re-rendered.
    const ctx = initAudioContext();
    
    if (!ctx) {
        console.error("AudioContext could not be initialized");
        return;
    }

    setIsGenerating(true);

    try {
      if (mode === 'scratch') {
        if (!prompt.trim()) return;
        
        // 1. Generate Metadata (Lyrics, Title, Style)
        const metadata = await generateSongMetadata(prompt);
        
        // 2. Generate Audio (Instrumental)
        const buffer = await generateInstrumentalTrack(metadata.styleTag, ctx);
          
        const newSong: MusicItem = {
          id: crypto.randomUUID(),
          title: metadata.title,
          lyrics: metadata.lyrics,
          style: metadata.styleTag,
          coverColor: metadata.coverColor,
          audioData: buffer,
          createdAt: new Date(),
          duration: buffer.duration
        };

        setPlaylist(prev => [newSong, ...prev]);
        
      } else if (mode === 'remix') {
        if (!uploadedFile) return;

        // 1. Decode uploaded vocal
        const arrayBuffer = await uploadedFile.arrayBuffer();
        const vocalBuffer = await ctx.decodeAudioData(arrayBuffer);
        
        // 2. Generate Backing Track (matching duration)
        const effectiveStyle = styleInput || "Ambient";
        // Force random variation by prepending a timestamp or random token to the style internally?
        // Actually generateInstrumentalTrack now uses random functions, so calling it again produces different results.
        const backingBuffer = await generateInstrumentalTrack(effectiveStyle, ctx, vocalBuffer.duration);

        // 3. Mix
        const mixedBuffer = await mixAudioBuffers(vocalBuffer, backingBuffer, ctx, effectiveStyle);

        // 4. Create Item
        const newSong: MusicItem = {
            id: crypto.randomUUID(),
            title: `Remix: ${uploadedFile.name.replace(/\.[^/.]+$/, "")}`,
            lyrics: "A Capella Original + IA Instrumental\n" + (styleInput ? `Estilo: ${styleInput}` : ""),
            style: effectiveStyle,
            coverColor: "#ff0055", // distinct color for remixes
            audioData: mixedBuffer,
            createdAt: new Date(),
            duration: mixedBuffer.duration,
            isRemix: true
        };

        setPlaylist(prev => [newSong, ...prev]);
      }
    } catch (e) {
      console.error("Music Gen Failed", e);
      alert("Ocorreu um erro ao processar o áudio. Verifique se o arquivo é válido.");
    } finally {
      setIsGenerating(false);
      setPrompt('');
    }
  };

  const handlePlay = async (item: MusicItem) => {
    // Use the context available via prop (for playback it usually persists), or re-init
    const ctx = audioContext || initAudioContext();
    
    if (playingId === item.id) {
      activeSourceRef.current?.stop();
      setPlayingId(null);
      return;
    }

    if (activeSourceRef.current) {
      activeSourceRef.current.stop();
    }

    if (ctx.state === 'suspended') {
        await ctx.resume();
    }

    const source = ctx.createBufferSource();
    source.buffer = item.audioData;
    source.connect(ctx.destination);
    source.onended = () => setPlayingId(null);
    source.start(0);
    activeSourceRef.current = source;
    setPlayingId(item.id);
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 animate-fade-in">
      <div className="mb-8 text-center">
         <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <Music2 className="text-pink-500" /> Studio de Música
         </h2>
         <p className="text-slate-400 text-sm">Gere instrumentais e letras, ou faça remix de suas gravações a capella.</p>
      </div>

      {/* Mode Toggles */}
      <div className="flex justify-center mb-8">
        <div className="bg-slate-900 p-1 rounded-xl inline-flex border border-slate-800">
            <button 
                onClick={() => setMode('scratch')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${mode === 'scratch' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
                <Sparkles size={16} /> Criar do Zero
            </button>
            <button 
                onClick={() => setMode('remix')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${mode === 'remix' ? 'bg-pink-600/20 text-pink-200 border border-pink-500/30 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
                <Upload size={16} /> Remix A Capella
            </button>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 mb-12 relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${mode === 'scratch' ? 'from-pink-500 via-purple-500 to-indigo-500' : 'from-orange-500 via-red-500 to-pink-500'}`} />
        
        {mode === 'scratch' ? (
            // --- SCRATCH MODE ---
            <div className="flex flex-col md:flex-row gap-4 animate-fade-in">
            <div className="flex-grow">
                <label className="block text-xs font-medium text-pink-300 mb-2 uppercase tracking-wider">Descrição da Música</label>
                <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Um lo-fi triste sobre chuva em São Paulo..."
                disabled={isGenerating}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all outline-none"
                />
            </div>
            <div className="flex items-end">
                <button
                onClick={handleCreate}
                disabled={isGenerating || !prompt.trim()}
                className={`h-14 px-8 rounded-xl font-bold flex items-center gap-2 transition-all ${
                    isGenerating 
                    ? 'bg-slate-700 text-slate-400 cursor-wait' 
                    : 'bg-gradient-to-r from-pink-600 to-purple-600 text-white hover:shadow-lg hover:shadow-pink-500/25 hover:scale-105'
                }`}
                >
                {isGenerating ? 'Criando...' : <><Sparkles size={20} /> Criar</>}
                </button>
            </div>
            </div>
        ) : (
            // --- REMIX MODE ---
            <div className="flex flex-col gap-6 animate-fade-in">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* File Upload */}
                   <div className="bg-slate-800/50 border border-dashed border-slate-600 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-slate-800 transition-colors cursor-pointer relative" onClick={() => fileInputRef.current?.click()}>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="audio/mp3,audio/wav,audio/mpeg" 
                        className="hidden" 
                      />
                      <Mic2 size={32} className="text-pink-400 mb-3" />
                      <h4 className="text-white font-medium mb-1">{uploadedFile ? uploadedFile.name : "Upload A Capella (MP3/WAV)"}</h4>
                      <p className="text-xs text-slate-500">{uploadedFile ? "Clique para alterar" : "Arraste ou clique para selecionar"}</p>
                   </div>

                   {/* Style Input */}
                   <div>
                      <label className="block text-xs font-medium text-pink-300 mb-2 uppercase tracking-wider">Estilo do Remix</label>
                      <textarea
                        value={styleInput}
                        onChange={(e) => setStyleInput(e.target.value)}
                        placeholder="Estilos: Rock, Saxofone, Bateria Rápida, [Drop Violento], <Piano Melancólico>..."
                        className="w-full h-[106px] bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all outline-none resize-none"
                      />
                   </div>
               </div>

               <div className="flex justify-end">
                    <button
                    onClick={handleCreate}
                    disabled={isGenerating || !uploadedFile}
                    className={`h-12 px-8 rounded-xl font-bold flex items-center gap-2 transition-all ${
                        isGenerating || !uploadedFile
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-orange-500 to-pink-600 text-white hover:shadow-lg hover:shadow-orange-500/25 hover:scale-105'
                    }`}
                    >
                    {isGenerating ? 'Processando Remix...' : <><Disc size={20} /> Gerar Remix</>}
                    </button>
               </div>
            </div>
        )}
      </div>

      {/* Playlist Grid */}
      <div>
        <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
           <ListMusic size={20} className="text-purple-400" /> Suas Criações
        </h3>
        
        {playlist.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl">
                <Disc size={48} className="mx-auto text-slate-700 mb-4" />
                <p className="text-slate-500">Nenhuma música criada ainda.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playlist.map((song) => (
                <div key={song.id} className={`bg-slate-800 rounded-xl overflow-hidden border transition-all group ${song.isRemix ? 'border-pink-500/30 shadow-lg shadow-pink-900/10' : 'border-slate-700 hover:border-slate-500'}`}>
                   {/* Cover Art Area */}
                   <div 
                     className="h-40 w-full relative flex items-center justify-center"
                     style={{ backgroundColor: song.coverColor }}
                   >
                      <div className="absolute inset-0 bg-black/20" />
                      <button 
                        onClick={() => handlePlay(song)}
                        className="z-10 w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all transform hover:scale-110 border border-white/20"
                      >
                        {playingId === song.id ? <Pause fill="white" /> : <Play fill="white" className="ml-1" />}
                      </button>
                      <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end">
                        <span className="inline-block px-2 py-1 rounded bg-black/40 text-[10px] text-white backdrop-blur-sm uppercase tracking-wider font-bold border border-white/10">
                            {song.style}
                        </span>
                        {song.isRemix && (
                            <span className="inline-block px-2 py-1 rounded bg-pink-600 text-[10px] text-white uppercase tracking-wider font-bold shadow-sm">
                                REMIX
                            </span>
                        )}
                      </div>
                   </div>

                   {/* Info Area */}
                   <div className="p-5">
                     <h4 className="text-lg font-bold text-white mb-1 truncate">{song.title}</h4>
                     <p className="text-xs text-slate-400 mb-4">Gerado em {song.createdAt.toLocaleDateString()}</p>
                     
                     <div className="bg-slate-900/50 p-3 rounded-lg h-32 overflow-y-auto custom-scrollbar border border-slate-800/50">
                        <p className="text-xs text-slate-300 whitespace-pre-line font-light leading-relaxed italic">
                           {song.lyrics}
                        </p>
                     </div>
                   </div>
                </div>
            ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default MusicStudio;
