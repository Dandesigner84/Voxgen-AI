
import React, { useState, useRef, useEffect } from 'react';
import { HardHat, Construction, Upload, Video, Play, Pause, Mic2, Sparkles, AlertCircle, Download, MonitorPlay } from 'lucide-react';
import { AudioItem, AvatarItem } from '../types';
import { generateAvatarVideo } from '../services/geminiService';

interface AvatarStudioProps {
  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;
  narrationHistory: AudioItem[];
}

const AvatarStudio: React.FC<AvatarStudioProps> = ({ audioContext, initAudioContext, narrationHistory }) => {
  const [selectedNarrationId, setSelectedNarrationId] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Refs for sync playback
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setImagePreview(ev.target.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!imagePreview) {
        alert("Por favor, faça upload de uma foto para o avatar.");
        return;
    }

    setIsGenerating(true);
    setStatusMessage('Enviando para o modelo Veo 3...');

    try {
        // Gera o vídeo usando Veo (Veo gera vídeo mudo, nós sincronizamos o áudio no front)
        const url = await generateAvatarVideo(imagePreview, "Character talking to the camera, neutral expression, subtle movement");
        setGeneratedVideoUrl(url);
        setStatusMessage('Vídeo gerado com sucesso!');
    } catch (e: any) {
        console.error("Avatar Gen Error", e);
        alert("Erro ao gerar vídeo: " + e.message);
        setStatusMessage('Erro na geração.');
    } finally {
        setIsGenerating(false);
    }
  };

  const togglePlay = async () => {
    if (!generatedVideoUrl || !selectedNarrationId) return;

    if (isPlaying) {
        // STOP
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
            audioSourceRef.current = null;
        }
        setIsPlaying(false);
    } else {
        // PLAY SYNCED
        const narration = narrationHistory.find(n => n.id === selectedNarrationId);
        if (!narration) {
            alert("Narração não encontrada.");
            return;
        }

        const ctx = initAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();

        // Start Audio
        const source = ctx.createBufferSource();
        source.buffer = narration.audioData;
        source.connect(ctx.destination);
        
        // Setup sync stop
        source.onended = () => {
            setIsPlaying(false);
            if (videoRef.current) videoRef.current.pause();
        };

        // Start Video (Looping to match audio length if video is shorter)
        if (videoRef.current) {
            videoRef.current.loop = true;
            videoRef.current.play();
        }

        source.start(0);
        audioSourceRef.current = source;
        setIsPlaying(true);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center gap-2">
           <Video size={32} className="text-yellow-500" /> Avatar Studio (Beta)
        </h2>
        <p className="text-slate-400 text-sm mt-2">Dê vida às suas narrações usando o modelo de vídeo <strong>Veo</strong>.</p>
        <div className="mt-2 inline-block bg-yellow-900/20 border border-yellow-700/50 rounded-lg px-3 py-1 text-xs text-yellow-500">
            Powered by Google Veo 3.1
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* --- CONFIGURATION --- */}
          <div className="space-y-6">
              
              {/* Step 1: Select Narration */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                      <Mic2 size={18} className="text-cyan-400" /> 1. Escolha a Narração
                  </h3>
                  
                  {narrationHistory.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
                          Crie uma narração na aba "Narração" primeiro.
                      </div>
                  ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                          {narrationHistory.map(n => (
                              <button
                                key={n.id}
                                onClick={() => setSelectedNarrationId(n.id)}
                                className={`w-full text-left p-3 rounded-lg text-xs transition-all border ${
                                    selectedNarrationId === n.id 
                                    ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-100' 
                                    : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700'
                                }`}
                              >
                                  <div className="font-bold truncate mb-1">{n.text}</div>
                                  <div className="flex justify-between opacity-70">
                                      <span>{n.voice}</span>
                                      <span>{Math.round(n.duration)}s</span>
                                  </div>
                              </button>
                          ))}
                      </div>
                  )}
              </div>

              {/* Step 2: Upload Image */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                      <Upload size={18} className="text-purple-400" /> 2. Upload do Avatar
                  </h3>
                  
                  <div className="flex gap-4 items-center">
                      <label className="w-32 h-32 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors overflow-hidden relative">
                          {imagePreview ? (
                              <img src={imagePreview} className="w-full h-full object-cover" />
                          ) : (
                              <>
                                <Upload size={24} className="text-slate-500 mb-2" />
                                <span className="text-[10px] text-slate-400 uppercase font-bold">Foto</span>
                              </>
                          )}
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                      </label>
                      <div className="flex-1 text-xs text-slate-500 leading-relaxed">
                          <p className="mb-2">Envie uma foto frontal, bem iluminada.</p>
                          <p>A IA usará esta imagem como base para gerar o vídeo do personagem falando.</p>
                      </div>
                  </div>
              </div>

              {/* Step 3: Generate */}
              <button 
                onClick={handleGenerate}
                disabled={isGenerating || !selectedNarrationId || !imagePreview}
                className="w-full py-4 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                  {isGenerating ? (
                      <><Sparkles className="animate-spin" /> Gerando Vídeo (Isso leva ~1 min)...</>
                  ) : (
                      <><Video /> Criar Avatar Falante</>
                  )}
              </button>
              {statusMessage && <p className="text-center text-xs text-slate-400 animate-pulse">{statusMessage}</p>}
          </div>

          {/* --- PREVIEW --- */}
          <div className="bg-black rounded-3xl overflow-hidden relative shadow-2xl border border-slate-800 flex items-center justify-center min-h-[400px]">
              {generatedVideoUrl ? (
                  <div className="relative w-full h-full flex flex-col">
                      <video 
                        ref={videoRef}
                        src={generatedVideoUrl} 
                        className="w-full h-full object-contain bg-black"
                        playsInline
                        muted // Muted because audio comes from Web Audio API sync
                        loop
                      />
                      
                      {/* Playback Controls Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-between">
                          <button 
                            onClick={togglePlay}
                            className="w-14 h-14 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                          >
                              {isPlaying ? <Pause fill="black" /> : <Play fill="black" className="ml-1" />}
                          </button>
                          
                          <div className="text-right">
                              <p className="text-white font-bold text-sm">Preview Sincronizado</p>
                              <p className="text-slate-400 text-xs">Áudio VoxGen + Vídeo Veo</p>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="text-center p-8 opacity-50">
                      <MonitorPlay size={64} className="mx-auto mb-4 text-slate-600" />
                      <h3 className="text-xl font-bold text-slate-500">Preview do Vídeo</h3>
                      <p className="text-sm text-slate-600 mt-2">O resultado aparecerá aqui.</p>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default AvatarStudio;
