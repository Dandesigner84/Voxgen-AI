
import React, { useState, useRef } from 'react';
import { BookOpen, Image as ImageIcon, Mic2, Play, Pause, ChevronRight, ChevronLeft, Plus, Sparkles, Download, Upload, Lock, Info, Layers } from 'lucide-react';
import { ComicPage, ComicStyle, VoiceName } from '../types';
import { generateImage, generateSpeech, planComicStory } from '../services/geminiService';
import { decodeAudioData } from '../utils/audioUtils';
import { getUserStatus } from '../services/monetizationService';

interface MangaStudioProps {
  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;
}

const STYLES: ComicStyle[] = ['Manga', 'American Comic', 'Pixar 3D', 'Anime', 'Sketch'];

const MangaStudio: React.FC<MangaStudioProps> = ({ audioContext, initAudioContext }) => {
  const [pages, setPages] = useState<ComicPage[]>([]);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  
  // Inputs
  const [storyPrompt, setStoryPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<ComicStyle>('Manga');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [numPagesToGen, setNumPagesToGen] = useState(4);
  
  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const userStatus = getUserStatus();
  const isPremium = userStatus.plan === 'premium';
  const MAX_FREE_PAGES = 4;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setReferenceImage(ev.target.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleGenerateFullStory = async () => {
    if (!storyPrompt.trim()) return;
    
    const pagesRequested = isPremium ? numPagesToGen : Math.min(numPagesToGen, MAX_FREE_PAGES);
    if (pagesRequested > MAX_FREE_PAGES && !isPremium) {
        alert(`Usuários Free estão limitados a ${MAX_FREE_PAGES} páginas. Atualize para criar histórias maiores.`);
        return;
    }

    setIsGenerating(true);
    setGenerationStatus('Planejando Roteiro...');
    const ctx = initAudioContext();

    try {
      // 1. Plan Story (Storyboard)
      const storyboard = await planComicStory(storyPrompt, pagesRequested);
      
      setPages([]); // Clear previous
      let newPages: ComicPage[] = [];

      // 2. Loop and Generate Each Page
      for (let i = 0; i < storyboard.length; i++) {
          const scene = storyboard[i];
          setGenerationStatus(`Desenhando Página ${i+1}/${storyboard.length}...`);
          
          // Generate Image with Grid Layout and Dialogue bubbles
          const imgBase64 = await generateImage(
              scene.scene, 
              selectedStyle, 
              referenceImage || undefined,
              scene.layout,
              scene.dialogue
          );

          // Generate Narration (Optional, can be done later to save time, but let's do it now for "Full Experience")
          let audioBuffer: AudioBuffer | undefined;
          try {
             if (scene.dialogue && scene.dialogue !== "NO DIALOGUE") {
                 const audioBase64 = await generateSpeech(scene.dialogue, VoiceName.Kore);
                 audioBuffer = await decodeAudioData(audioBase64, ctx);
             }
          } catch (e) {
              console.warn("Narration skipped for page", i);
          }

          const newPage: ComicPage = {
            id: crypto.randomUUID(),
            imageUrl: imgBase64,
            text: scene.scene,
            dialogue: scene.dialogue,
            panelLayout: scene.layout,
            audioData: audioBuffer,
            panelNumber: i + 1
          };

          newPages.push(newPage);
          setPages([...newPages]); // Update UI progressively
      }

      setCurrentPageIdx(0);
      setGenerationStatus('Concluído!');

    } catch (e: any) {
      alert("Erro ao gerar história: " + e.message);
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  const playNarration = async (page: ComicPage) => {
    if (!page.audioData) return;
    const ctx = initAudioContext();
    
    if (activeSourceRef.current) {
        activeSourceRef.current.stop();
    }

    if (ctx.state === 'suspended') await ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = page.audioData;
    source.connect(ctx.destination);
    source.onended = () => setIsPlaying(false);
    
    source.start(0);
    activeSourceRef.current = source;
    setIsPlaying(true);
  };

  const stopAudio = () => {
      if (activeSourceRef.current) {
          activeSourceRef.current.stop();
          setIsPlaying(false);
      }
  };

  const handleExportPDF = () => {
      alert("Função de exportar PDF em breve! (Premium Feature)");
  };

  return (
    <div className="w-full h-full flex flex-col lg:flex-row bg-[#0f172a] text-white animate-fade-in min-h-[85vh]">
      
      {/* --- LEFT SIDEBAR (Creation) --- */}
      <div className="w-full lg:w-[400px] flex-shrink-0 border-r border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-6 overflow-y-auto">
        <div className="flex items-center gap-2 mb-2">
            <BookOpen className="text-indigo-400" size={24} />
            <h2 className="text-xl font-bold">Manga Studio</h2>
        </div>

        {/* Character Ref */}
        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase">Personagem Principal (Opcional)</label>
            <div className="flex items-center gap-4">
                <label className="w-20 h-20 border border-dashed border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-800 overflow-hidden transition-colors relative group">
                    {referenceImage ? (
                        <>
                            <img src={referenceImage} className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload size={16} className="text-white" />
                            </div>
                        </>
                    ) : (
                        <Upload size={20} className="text-slate-500" />
                    )}
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
                <div className="text-xs text-slate-500 flex-1 leading-relaxed">
                    Faça upload do rosto do seu personagem para manter a consistência visual.
                </div>
            </div>
        </div>

        {/* Style Selector */}
        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase">Estilo Visual</label>
            <div className="grid grid-cols-3 gap-2">
                {STYLES.map(style => (
                    <button 
                        key={style}
                        onClick={() => setSelectedStyle(style)}
                        className={`text-[10px] py-2 rounded border transition-all ${selectedStyle === style ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                    >
                        {style}
                    </button>
                ))}
            </div>
        </div>

        {/* Story Input */}
        <div className="space-y-2 flex-grow">
            <label className="text-xs font-bold text-slate-400 uppercase">História Completa</label>
            <textarea 
                value={storyPrompt}
                onChange={(e) => setStoryPrompt(e.target.value)}
                placeholder="Ex: Um samurai solitário viaja por uma floresta mágica. Ele encontra um dragão ferido e decide ajudá-lo. No final, eles se tornam amigos e voam juntos."
                className="w-full h-32 bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:border-indigo-500 outline-none resize-none placeholder-slate-600"
            />
            
            <div className="flex justify-between items-center mt-2">
                <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <Layers size={14} /> Páginas
                </label>
                <select 
                    value={numPagesToGen}
                    onChange={(e) => setNumPagesToGen(Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs outline-none"
                >
                    <option value={2}>2 Páginas</option>
                    <option value={4}>4 Páginas</option>
                    <option value={6} disabled={!isPremium}>6 Páginas (Pro)</option>
                    <option value={8} disabled={!isPremium}>8 Páginas (Pro)</option>
                    <option value={10} disabled={!isPremium}>10 Páginas (Pro)</option>
                </select>
            </div>
        </div>

        <div className="mt-auto">
            <div className="flex justify-between items-center mb-2 text-xs text-slate-500">
                <span>Status: {pages.length > 0 ? 'Gerado' : 'Pronto'}</span>
                {!isPremium && <span className="text-yellow-500 flex items-center gap-1"><Lock size={10}/> Max 4 pág (Free)</span>}
            </div>
            <button 
                onClick={handleGenerateFullStory}
                disabled={isGenerating || !storyPrompt.trim()}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-900/20 transition-all transform active:scale-95"
            >
                {isGenerating ? <Sparkles className="animate-spin" size={18} /> : <Sparkles size={18} />}
                {isGenerating ? generationStatus || 'Gerando...' : 'Criar História Completa'}
            </button>
        </div>
      </div>

      {/* --- RIGHT SIDE (Viewer) --- */}
      <div className="flex-1 bg-slate-950 p-4 lg:p-8 flex flex-col items-center justify-center relative overflow-hidden">
          {pages.length === 0 ? (
              <div className="text-center text-slate-600 border-2 border-dashed border-slate-800 rounded-2xl p-12 max-w-md animate-fade-in">
                  <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-bold text-slate-500 mb-2">Sua história começa aqui</h3>
                  <p className="text-sm mb-6">
                      Descreva uma história completa e a IA criará todas as páginas, cenas e diálogos automaticamente.
                  </p>
              </div>
          ) : (
              <div className="w-full max-w-3xl h-full flex flex-col">
                  {/* Main Page Display */}
                  <div className="flex-grow relative bg-black rounded-xl shadow-2xl overflow-hidden border border-slate-800 group">
                      <img 
                        src={pages[currentPageIdx].imageUrl} 
                        alt={`Page ${currentPageIdx + 1}`}
                        className="w-full h-full object-contain"
                      />
                      
                      {/* Page Info Overlay */}
                      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs font-bold border border-white/10">
                          Página {currentPageIdx + 1} de {pages.length}
                      </div>

                      {/* Caption/Dialogue Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/90 backdrop-blur-sm p-4 border-t border-white/10 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                          <p className="text-slate-400 text-xs uppercase font-bold mb-1">Descrição da Cena</p>
                          <p className="text-white text-sm font-serif leading-relaxed line-clamp-2 mb-2">
                              {pages[currentPageIdx].text}
                          </p>
                          {pages[currentPageIdx].dialogue && pages[currentPageIdx].dialogue !== "NO DIALOGUE" && (
                              <>
                                <p className="text-slate-400 text-xs uppercase font-bold mb-1 mt-2">Diálogo</p>
                                <p className="text-cyan-300 text-sm italic">"{pages[currentPageIdx].dialogue}"</p>
                              </>
                          )}
                          
                          {pages[currentPageIdx].audioData && (
                              <button 
                                onClick={() => isPlaying ? stopAudio() : playNarration(pages[currentPageIdx])}
                                className="absolute top-[-24px] right-6 bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-110 flex items-center justify-center"
                              >
                                  {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" className="ml-1"/>}
                              </button>
                          )}
                      </div>
                  </div>

                  {/* Controls */}
                  <div className="flex justify-between items-center mt-6 px-4">
                      <button 
                        onClick={() => setCurrentPageIdx(Math.max(0, currentPageIdx - 1))}
                        disabled={currentPageIdx === 0}
                        className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors"
                      >
                          <ChevronLeft size={24} />
                      </button>
                      
                      <div className="flex gap-2 overflow-x-auto max-w-[300px] custom-scrollbar pb-2 px-2">
                          {pages.map((p, idx) => (
                              <button 
                                key={p.id}
                                onClick={() => setCurrentPageIdx(idx)}
                                className={`w-12 h-16 flex-shrink-0 rounded border transition-all ${idx === currentPageIdx ? 'border-indigo-500 ring-2 ring-indigo-500/30 scale-110 z-10' : 'border-slate-700 opacity-50 hover:opacity-100'} overflow-hidden bg-slate-900`}
                              >
                                  <img src={p.imageUrl} className="w-full h-full object-cover" />
                              </button>
                          ))}
                      </div>

                      <div className="flex gap-3">
                        <button 
                            onClick={handleExportPDF}
                            className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            title="Exportar"
                        >
                            <Download size={24} />
                        </button>
                        <button 
                            onClick={() => setCurrentPageIdx(Math.min(pages.length - 1, currentPageIdx + 1))}
                            disabled={currentPageIdx === pages.length - 1}
                            className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors"
                        >
                            <ChevronRight size={24} />
                        </button>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default MangaStudio;
