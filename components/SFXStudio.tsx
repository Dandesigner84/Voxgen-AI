
import React, { useState, useRef } from 'react';
import { Volume2, Zap, Play, Download, Activity, FileAudio } from 'lucide-react';
import { SFXItem } from '../types';
import { SFX_PRESETS } from '../constants';
import { generateProceduralSFX, audioBufferToWav, audioBufferToMp3 } from '../utils/audioUtils';

interface SFXStudioProps {
  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;
}

const SFXStudio: React.FC<SFXStudioProps> = ({ audioContext, initAudioContext }) => {
  const [keyword, setKeyword] = useState('');
  const [generatedSFX, setGeneratedSFX] = useState<SFXItem | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);

  const handleGenerate = async (term: string) => {
    const ctx = initAudioContext();
    setKeyword(term);
    setIsGenerating(true);
    
    try {
        const buffer = await generateProceduralSFX(term, ctx);
        
        const newItem: SFXItem = {
            id: crypto.randomUUID(),
            name: term,
            type: 'Synthesized',
            audioData: buffer,
            createdAt: new Date()
        };
        
        setGeneratedSFX(newItem);
        setShowExportOptions(false);
    } catch (e) {
        console.error(e);
    } finally {
        setIsGenerating(false);
    }
  };

  const handlePlay = () => {
    if (!generatedSFX) return;
    const ctx = initAudioContext();
    
    const source = ctx.createBufferSource();
    source.buffer = generatedSFX.audioData;
    source.connect(ctx.destination);
    source.onended = () => setIsPlaying(false);
    
    source.start(0);
    setIsPlaying(true);
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadWav = () => {
      if (!generatedSFX) return;
      const blob = audioBufferToWav(generatedSFX.audioData);
      downloadFile(blob, `sfx-${generatedSFX.name}.wav`);
      setShowExportOptions(false);
  };

  const handleDownloadMp3 = () => {
      if (!generatedSFX) return;
      try {
        const blob = audioBufferToMp3(generatedSFX.audioData);
        downloadFile(blob, `sfx-${generatedSFX.name}.mp3`);
      } catch (e: any) {
        alert("Erro ao converter para MP3: " + e.message);
      }
      setShowExportOptions(false);
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-4 animate-fade-in">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
          <Volume2 className="text-yellow-500" /> Sintetizador SFX
        </h2>
        <p className="text-slate-400 text-sm">Gere efeitos sonoros processuais usando Web Audio API.</p>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {SFX_PRESETS.map((preset) => (
            <button
                key={preset.keyword}
                onClick={() => handleGenerate(preset.keyword)}
                disabled={isGenerating}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white py-4 px-2 rounded-xl font-medium text-sm transition-colors flex flex-col items-center gap-2"
            >
                <Activity size={20} className="text-yellow-500" />
                {preset.label}
            </button>
        ))}
      </div>

      {/* Custom Input */}
      <div className="flex gap-3 mb-10">
         <input 
            type="text" 
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Ou digite: Laser, Motor, Buzina..."
            className="flex-grow bg-slate-900 border border-slate-700 rounded-xl px-4 text-white focus:border-yellow-500 outline-none"
         />
         <button 
            onClick={() => handleGenerate(keyword)}
            disabled={!keyword.trim() || isGenerating}
            className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-6 rounded-xl transition-colors"
         >
            {isGenerating ? '...' : <Zap />}
         </button>
      </div>

      {/* Result */}
      {generatedSFX && (
          <div className="bg-slate-800/50 border border-yellow-500/30 rounded-2xl p-8 flex flex-col items-center justify-center text-center animate-fade-in relative">
              <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
                  <Volume2 size={32} className="text-yellow-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1 capitalize">{generatedSFX.name}</h3>
              <p className="text-slate-500 text-xs mb-6">Gerado com Procedural Audio Engine</p>
              
              <div className="flex gap-4 relative">
                  <button 
                    onClick={handlePlay}
                    className="bg-white text-black px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                  >
                      <Play size={18} fill="black" /> Reproduzir
                  </button>
                  
                  <div className="relative">
                    <button 
                        onClick={() => setShowExportOptions(!showExportOptions)}
                        className="bg-slate-700 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-slate-600 transition-colors"
                    >
                        <Download size={18} /> Exportar
                    </button>

                    {showExportOptions && (
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                            <button 
                                onClick={handleDownloadWav}
                                className="w-full text-left px-4 py-3 text-xs font-bold text-slate-300 hover:bg-indigo-600 hover:text-white flex items-center gap-2 transition-colors border-b border-slate-800"
                            >
                                <FileAudio size={14} /> Baixar WAV
                            </button>
                            <button 
                                onClick={handleDownloadMp3}
                                className="w-full text-left px-4 py-3 text-xs font-bold text-slate-300 hover:bg-indigo-600 hover:text-white flex items-center gap-2 transition-colors"
                            >
                                <FileAudio size={14} /> Baixar MP3
                            </button>
                        </div>
                    )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SFXStudio;
