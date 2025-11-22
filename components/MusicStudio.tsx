
import React, { useState, useRef } from 'react';
import { Sparkles, Play, Pause, Disc, Music2, ListMusic, Upload, Mic2, AlignLeft, Type, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import { MusicItem } from '../types';
import { generateSongMetadata } from '../services/geminiService';
import { generateInstrumentalTrack, mixAudioBuffers } from '../utils/audioUtils';

interface MusicStudioProps {
  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;
}

type CreationMode = 'simple' | 'custom';
type SourceMode = 'generate' | 'remix';

const MusicStudio: React.FC<MusicStudioProps> = ({ audioContext, initAudioContext }) => {
  // UI State
  const [sourceMode, setSourceMode] = useState<SourceMode>('generate');
  const [creationMode, setCreationMode] = useState<CreationMode>('simple');
  const [isInstrumental, setIsInstrumental] = useState(false);

  // Inputs
  const [prompt, setPrompt] = useState('');
  const [customLyrics, setCustomLyrics] = useState('');
  const [styleInput, setStyleInput] = useState('');
  const [titleInput, setTitleInput] = useState('');

  // Processing
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
    const ctx = initAudioContext();
    if (!ctx) {
        alert("Erro: Não foi possível inicializar o sistema de áudio do navegador.");
        return;
    }

    setIsGenerating(true);

    try {
      if (sourceMode === 'generate') {
        // Validation
        if (creationMode === 'simple' && !prompt.trim()) {
            alert("Descreva o estilo da música.");
            setIsGenerating(false);
            return;
        }
        if (creationMode === 'custom' && !styleInput.trim()) {
            alert("Defina um estilo musical.");
            setIsGenerating(false);
            return;
        }
        
        // Determine inputs
        let styleToGen = "";
        let finalLyrics = "";
        let finalTitle = "";
        let finalColor = "#334155";

        if (creationMode === 'simple') {
            // AI generates everything based on prompt
            const metadata = await generateSongMetadata(prompt, undefined);
            styleToGen = metadata.styleTag || prompt;
            finalLyrics = metadata.lyrics;
            finalTitle = metadata.title;
            finalColor = metadata.coverColor;
        } else {
            // Custom Mode
            styleToGen = styleInput;
            finalLyrics = isInstrumental ? "[Instrumental]" : customLyrics;
            
            // If no title, generate one or use style
            if (!titleInput.trim()) {
                const meta = await generateSongMetadata(styleInput, isInstrumental ? undefined : customLyrics);
                finalTitle = meta.title;
                finalColor = meta.coverColor;
            } else {
                finalTitle = titleInput;
                // Generate random color
                finalColor = `hsl(${Math.random() * 360}, 70%, 50%)`;
            }
        }
        
        // Audio Generation
        const buffer = await generateInstrumentalTrack(styleToGen, ctx);
          
        const newSong: MusicItem = {
          id: crypto.randomUUID(),
          title: finalTitle,
          lyrics: finalLyrics,
          style: styleToGen,
          coverColor: finalColor,
          audioData: buffer,
          createdAt: new Date(),
          duration: buffer.duration
        };

        setPlaylist(prev => [newSong, ...prev]);
        
      } else {
        // REMIX MODE
        if (!uploadedFile) return;

        const arrayBuffer = await uploadedFile.arrayBuffer();
        const vocalBuffer = await ctx.decodeAudioData(arrayBuffer);
        
        const effectiveStyle = styleInput || "Ambient";
        const backingBuffer = await generateInstrumentalTrack(effectiveStyle, ctx, vocalBuffer.duration);
        const mixedBuffer = await mixAudioBuffers(vocalBuffer, backingBuffer, ctx, effectiveStyle);

        const newSong: MusicItem = {
            id: crypto.randomUUID(),
            title: `Remix: ${uploadedFile.name.replace(/\.[^/.]+$/, "")}`,
            lyrics: "Remix A Capella\n" + (styleInput ? `Estilo: ${styleInput}` : ""),
            style: effectiveStyle,
            coverColor: "#ff0055",
            audioData: mixedBuffer,
            createdAt: new Date(),
            duration: mixedBuffer.duration,
            isRemix: true
        };

        setPlaylist(prev => [newSong, ...prev]);
      }
    } catch (e: any) {
      console.error("Music Gen Failed", e);
      alert(`Falha: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlay = async (item: MusicItem) => {
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
    <div className="w-full h-full flex flex-col lg:flex-row bg-[#000000] text-white animate-fade-in min-h-[85vh]">
      
      {/* --- LEFT SIDEBAR (Creation) --- */}
      <div className="w-full lg:w-[420px] flex-shrink-0 border-r border-white/10 bg-[#18181b] p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="text-white" size={20} /> Criar
            </h2>
            <div className="flex bg-zinc-800 p-1 rounded-full">
                <button 
                  onClick={() => setSourceMode('generate')}
                  className={`px-4 py-1 text-xs font-bold rounded-full transition-all ${sourceMode === 'generate' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                >
                  IA
                </button>
                <button 
                  onClick={() => setSourceMode('remix')}
                  className={`px-4 py-1 text-xs font-bold rounded-full transition-all ${sourceMode === 'remix' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                >
                  Remix
                </button>
            </div>
        </div>

        {sourceMode === 'generate' ? (
            <>
                {/* Mode Toggle Pills */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCreationMode(prev => prev === 'simple' ? 'custom' : 'simple')}>
                        <div className={`w-10 h-6 rounded-full p-1 duration-300 ease-in-out ${creationMode === 'custom' ? 'bg-green-500' : 'bg-zinc-600'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${creationMode === 'custom' ? 'translate-x-4' : ''}`} />
                        </div>
                        <span className="text-sm font-medium">Modo Personalizado</span>
                    </div>
                </div>

                {creationMode === 'simple' ? (
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Descrição da Música</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Ex: Uma música pop animada sobre férias na praia..."
                            className="w-full h-32 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm focus:border-white outline-none resize-none text-zinc-200 placeholder-zinc-600"
                        />
                    </div>
                ) : (
                    <div className="space-y-4 animate-fade-in">
                        {/* Lyrics Section */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Letra</label>
                                <button 
                                    onClick={() => setIsInstrumental(!isInstrumental)} 
                                    className={`text-xs px-2 py-1 rounded border ${isInstrumental ? 'bg-green-500/20 border-green-500 text-green-400' : 'border-zinc-700 text-zinc-500'}`}
                                >
                                    Instrumental
                                </button>
                            </div>
                            
                            {!isInstrumental ? (
                                <textarea
                                    value={customLyrics}
                                    onChange={(e) => setCustomLyrics(e.target.value)}
                                    placeholder="[Verso 1]&#10;Escreva sua letra aqui..."
                                    className="w-full h-48 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm focus:border-white outline-none resize-none font-mono text-zinc-200 placeholder-zinc-600"
                                />
                            ) : (
                                <div className="h-24 bg-zinc-900/50 border border-dashed border-zinc-700 rounded-lg flex items-center justify-center text-zinc-500 text-sm italic">
                                    Música sem letra (Instrumental)
                                </div>
                            )}
                        </div>

                        {/* Style Section */}
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Estilo Musical</label>
                             <input
                                type="text"
                                value={styleInput}
                                onChange={(e) => setStyleInput(e.target.value)}
                                placeholder="Ex: Heavy Metal, 150bpm"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm focus:border-white outline-none text-zinc-200"
                             />
                        </div>

                         {/* Title Section */}
                         <div className="space-y-2">
                             <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Título (Opcional)</label>
                             <input
                                type="text"
                                value={titleInput}
                                onChange={(e) => setTitleInput(e.target.value)}
                                placeholder="Digite um título..."
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm focus:border-white outline-none text-zinc-200"
                             />
                        </div>
                    </div>
                )}
            </>
        ) : (
            // REMIX MODE UI
            <div className="space-y-4 animate-fade-in">
                <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-800 transition-colors" onClick={() => fileInputRef.current?.click()}>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".mp3,.wav,.m4a,.aac" className="hidden" />
                    <Upload className="text-zinc-400 mb-2" />
                    <span className="text-sm text-zinc-300 font-medium">{uploadedFile ? uploadedFile.name : "Upload Áudio"}</span>
                </div>
                
                <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Estilo do Remix</label>
                    <textarea
                        value={styleInput}
                        onChange={(e) => setStyleInput(e.target.value)}
                        placeholder="Descreva como deve ser o fundo musical..."
                        className="w-full h-24 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm focus:border-white outline-none resize-none text-zinc-200"
                    />
                </div>
            </div>
        )}

        <div className="mt-auto pt-4">
             <button
                onClick={handleCreate}
                disabled={isGenerating}
                className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    isGenerating 
                    ? 'bg-zinc-700 text-zinc-400' 
                    : 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white hover:shadow-[0_0_20px_rgba(234,88,12,0.4)]'
                }`}
             >
                {isGenerating ? 'Criando...' : <><Sparkles size={16} /> {sourceMode === 'remix' ? 'Gerar Remix' : 'Criar Música'}</>}
             </button>
             <div className="flex justify-between items-center mt-3 text-xs text-zinc-500">
                <span>{isGenerating ? 'Processando...' : '10 créditos restantes'}</span>
                <span>v2.5</span>
             </div>
        </div>
      </div>

      {/* --- RIGHT SIDE (Library/Feed) --- */}
      <div className="flex-1 bg-[#09090b] p-6 lg:p-8 overflow-y-auto custom-scrollbar">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
             <ListMusic size={24} className="text-zinc-400" /> Biblioteca
          </h2>

          {playlist.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-[400px] text-zinc-600 border border-dashed border-zinc-800 rounded-xl">
                 <Music2 size={48} className="mb-4 opacity-50" />
                 <p>Suas músicas aparecerão aqui.</p>
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {playlist.map((song) => (
                    <div key={song.id} className="group bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 rounded-lg overflow-hidden transition-all hover:bg-zinc-900">
                        <div className="relative h-48 w-full bg-zinc-800" style={{ backgroundColor: song.coverColor }}>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                            
                            <div className="absolute top-3 right-3">
                                {song.isRemix && <span className="bg-pink-600 text-[10px] font-bold px-2 py-1 rounded text-white">REMIX</span>}
                            </div>

                            <button 
                                onClick={() => handlePlay(song)}
                                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-[2px]"
                            >
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black pl-1 hover:scale-110 transition-transform">
                                    {playingId === song.id ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" />}
                                </div>
                            </button>

                            <div className="absolute bottom-3 left-4 right-4">
                                <h3 className="font-bold text-lg truncate text-white">{song.title}</h3>
                                <p className="text-xs text-zinc-300 truncate opacity-80">{song.style}</p>
                            </div>
                        </div>
                        
                        {/* Lyrics Preview / Details */}
                        <div className="p-4">
                            <div className="h-20 overflow-hidden relative">
                                <p className="text-xs text-zinc-400 whitespace-pre-line font-mono leading-relaxed">
                                    {song.lyrics || "Sem letra."}
                                </p>
                                <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-zinc-900 to-transparent" />
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-800/50 text-xs text-zinc-500">
                                <span>{new Date(song.createdAt).toLocaleDateString()}</span>
                                <span className="flex items-center gap-1"><Disc size={10}/> {Math.round(song.duration)}s</span>
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
