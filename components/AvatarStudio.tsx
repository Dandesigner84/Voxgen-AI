
import React, { useState, useRef, useEffect } from 'react';
import { UserSquare2, Upload, Mic2, Play, Pause, Wand2, Image as ImageIcon, FileAudio, Activity, Download, Smartphone, Monitor, Square } from 'lucide-react';
import { generateSpeech, generateAvatarBehavior, AvatarBehavior } from '../services/geminiService';
import { decodeAudioData } from '../utils/audioUtils';
import { VoiceName } from '../types';
import { VOICE_OPTIONS } from '../constants';

interface AvatarStudioProps {
  audioContext: AudioContext | null;
  initAudioContext: () => AudioContext;
}

type AspectRatio = '9:16' | '16:9' | '1:1';

const AvatarStudio: React.FC<AvatarStudioProps> = ({ audioContext, initAudioContext }) => {
  // Inputs
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [inputType, setInputType] = useState<'text' | 'audio'>('text');
  const [textPrompt, setTextPrompt] = useState('');
  const [motionPrompt, setMotionPrompt] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Kore);
  
  // Settings
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');

  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [behavior, setBehavior] = useState<AvatarBehavior>({ energy: 1, range: 0.5, rotationSpeed: 0.5, responsiveness: 1.2 });

  // Refs for Animation Loop (State is stale in requestAnimationFrame)
  const isPlayingRef = useRef(false);
  const isRecordingRef = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Load Image
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      
      const img = new Image();
      img.src = url;
      img.onload = () => {
        imgRef.current = img;
        // Initial Draw
        requestAnimationFrame(() => drawFrame(0, 0));
      };
    }
  };

  // Handle Audio Input
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
    }
  };

  // Generate/Prepare Audio AND Behavior
  const handleGenerate = async () => {
    const ctx = initAudioContext();
    setIsProcessing(true);

    try {
      // 1. Behavior Analysis
      if (motionPrompt.trim()) {
         const newBehavior = await generateAvatarBehavior(motionPrompt);
         setBehavior(newBehavior);
      }

      // 2. Audio Generation / Decoding
      let buffer: AudioBuffer;

      if (inputType === 'text') {
        if (!textPrompt.trim()) return;
        const base64 = await generateSpeech(textPrompt, selectedVoice);
        buffer = await decodeAudioData(base64, ctx);
      } else {
        if (!audioFile) return;
        const arrayBuffer = await audioFile.arrayBuffer();
        buffer = await ctx.decodeAudioData(arrayBuffer);
      }

      setAudioBuffer(buffer);
      // Auto play
      playAudio(buffer, ctx);

    } catch (e) {
      console.error(e);
      alert("Erro ao processar. Verifique os dados de entrada.");
    } finally {
      setIsProcessing(false);
    }
  };

  const stopAudio = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    }
    
    // Update State & Refs
    setIsPlaying(false);
    isPlayingRef.current = false;
    
    cancelAnimationFrame(animationRef.current);
    // Reset visual
    requestAnimationFrame(() => drawFrame(0, Date.now() / 1000));
  };

  const playAudio = (buffer: AudioBuffer, ctx: AudioContext) => {
    // Ensure clean state first
    if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch (e) {}
    }
    cancelAnimationFrame(animationRef.current);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    const analyzer = ctx.createAnalyser();
    analyzer.fftSize = 512;
    analyzer.smoothingTimeConstant = 0.8;

    source.connect(analyzer);
    analyzer.connect(ctx.destination);

    source.onended = () => {
        setIsPlaying(false);
        isPlayingRef.current = false;
    };

    source.start(0);

    sourceRef.current = source;
    analyzerRef.current = analyzer;
    
    // Update State & Refs
    setIsPlaying(true);
    isPlayingRef.current = true;
    
    animate();
  };

  // --- Recording Logic ---

  const handleRecordDownload = async () => {
    if (!audioBuffer || !canvasRef.current) return;
    const ctx = initAudioContext();
    const canvas = canvasRef.current;

    // 1. Setup Resolution
    let width = 1080;
    let height = 1920;
    if (aspectRatio === '16:9') { width = 1920; height = 1080; }
    else if (aspectRatio === '1:1') { width = 1080; height = 1080; }
    
    // Enforce dimensions for recording quality
    canvas.width = width;
    canvas.height = height;

    setIsRecording(true);
    isRecordingRef.current = true;
    stopAudio(); // Ensure clean state

    // 2. Setup Streams
    const streamDest = ctx.createMediaStreamDestination();
    const videoStream = canvas.captureStream(30); // 30 FPS
    
    const combinedTracks = [
      ...videoStream.getVideoTracks(),
      ...streamDest.stream.getAudioTracks()
    ];
    const combinedStream = new MediaStream(combinedTracks);

    // 3. Setup Recorder
    let mimeType = 'video/webm';
    if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
        mimeType = 'video/webm;codecs=h264';
    }

    const recorder = new MediaRecorder(combinedStream, { 
        mimeType, 
        videoBitsPerSecond: 5000000 // 5 Mbps
    });
    
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `avatar-video.${mimeType === 'video/mp4' ? 'mp4' : 'webm'}`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setIsRecording(false);
        isRecordingRef.current = false;
    };

    // 4. Play & Record
    recorder.start();

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    
    const analyzer = ctx.createAnalyser();
    analyzer.fftSize = 512;
    analyzer.smoothingTimeConstant = 0.8;

    source.connect(analyzer);
    analyzer.connect(streamDest); // Record audio
    analyzer.connect(ctx.destination); // Hear audio

    source.onended = () => {
        recorder.stop();
        setIsPlaying(false);
        isPlayingRef.current = false;
    };

    source.start(0);
    
    sourceRef.current = source;
    analyzerRef.current = analyzer;
    
    setIsPlaying(true);
    isPlayingRef.current = true;
    animate();
  };

  // --- Animation Engine ---
  
  const animate = () => {
    // Use Refs for loop condition to avoid stale state in closure
    if (!isPlayingRef.current && !isRecordingRef.current) return;
    if (!analyzerRef.current) return;

    const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
    analyzerRef.current.getByteFrequencyData(dataArray);

    // Calculate energy
    let sum = 0;
    for (let i = 0; i < dataArray.length / 2; i++) {
      sum += dataArray[i];
    }
    const average = sum / (dataArray.length / 2); 
    
    const time = Date.now() / 1000;
    drawFrame(average, time);

    animationRef.current = requestAnimationFrame(animate);
  };

  const drawFrame = (audioLevel: number, time: number) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If not recording, allow responsive resizing. 
    // If recording, dimensions are fixed in handleRecordDownload.
    if (!isRecordingRef.current) {
        const parent = canvas.parentElement;
        if (parent && (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight)) {
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
        }
    }

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background (optional: make it black or transparent)
    // ctx.fillStyle = '#000';
    // ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Fit Image logic (contain)
    const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.9; 
    const w = img.width * scale;
    const h = img.height * scale;
    const startX = (canvas.width - w) / 2;
    const startY = (canvas.height - h) / 2;

    // --- PHYSICS ---
    const { energy, range, rotationSpeed, responsiveness } = behavior;
    const normalizedVol = audioLevel / 255; 

    const idleY = Math.sin(time * energy * 2) * (range * 10); 
    const idleRot = Math.sin(time * rotationSpeed) * (0.03 * range);

    const talkScale = normalizedVol * 0.1 * responsiveness; 
    const jitterX = (Math.random() - 0.5) * normalizedVol * 10 * responsiveness * (energy > 1.5 ? 1 : 0); 
    const talkRot = Math.sin(time * 10) * normalizedVol * 0.1 * responsiveness;
    const squashY = normalizedVol * 0.05 * responsiveness;

    // --- APPLY TRANSFORMS ---
    const pivotX = startX + w / 2;
    const pivotY = startY + h; 

    ctx.translate(pivotX, pivotY);
    ctx.rotate(idleRot + talkRot);
    const totalScaleX = 1.0 - squashY + talkScale;
    const totalScaleY = 1.0 + squashY + talkScale;
    ctx.scale(totalScaleX, totalScaleY);
    ctx.translate(-pivotX, -pivotY);

    const bounceY = - (normalizedVol * 20 * responsiveness); 
    
    ctx.drawImage(
        img, 
        startX + jitterX, 
        startY + idleY + bounceY, 
        w, 
        h
    );

    ctx.restore();
  };

  useEffect(() => {
    if(imgRef.current) {
        requestAnimationFrame(() => drawFrame(0, 0));
    }
  }, [imgRef.current, aspectRatio]);

  // New Effect: Restore canvas when recording/playback stops to fix black screen issue
  useEffect(() => {
    if (!isRecording && !isPlaying && imgRef.current) {
        // Force a redraw next frame to ensure state is settled
        requestAnimationFrame(() => drawFrame(0, 0));
    }
  }, [isRecording, isPlaying]);

  // Helper for container styling based on aspect ratio
  const getPreviewStyle = () => {
    if (aspectRatio === '9:16') return { maxWidth: '360px', aspectRatio: '9/16' };
    if (aspectRatio === '16:9') return { width: '100%', aspectRatio: '16/9' };
    return { maxWidth: '500px', aspectRatio: '1/1' };
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 animate-fade-in h-[calc(100vh-140px)] min-h-[600px] flex flex-col">
      <div className="mb-6 flex items-center gap-3">
         <div className="p-3 bg-emerald-500/10 rounded-xl">
            <UserSquare2 className="text-emerald-400" size={24} />
         </div>
         <div>
             <h2 className="text-2xl font-bold text-white">Avatar Studio</h2>
             <p className="text-slate-400 text-xs">Dê vida a personagens estáticos usando física de áudio.</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow overflow-hidden">
        {/* CONTROLS (Left) */}
        <div className="lg:col-span-4 space-y-5 flex flex-col h-full overflow-y-auto pr-2 custom-scrollbar pb-10">
            
            {/* Aspect Ratio Controls */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 shrink-0">
                <label className="text-xs font-medium text-emerald-400 mb-3 flex items-center gap-2 uppercase tracking-wide">
                    Formato do Vídeo
                </label>
                <div className="grid grid-cols-3 gap-2">
                    <button 
                        onClick={() => setAspectRatio('9:16')}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${aspectRatio === '9:16' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-800'}`}
                    >
                        <Smartphone size={16} className="mb-1" />
                        <span className="text-[10px] font-bold">Story (9:16)</span>
                    </button>
                    <button 
                        onClick={() => setAspectRatio('16:9')}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${aspectRatio === '16:9' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-800'}`}
                    >
                        <Monitor size={16} className="mb-1" />
                        <span className="text-[10px] font-bold">YouTube (16:9)</span>
                    </button>
                    <button 
                        onClick={() => setAspectRatio('1:1')}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${aspectRatio === '1:1' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-800'}`}
                    >
                        <Square size={16} className="mb-1" />
                        <span className="text-[10px] font-bold">Feed (1:1)</span>
                    </button>
                </div>
            </div>

            {/* 1. Image Upload */}
            <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer flex flex-col items-center justify-center text-center shrink-0 h-32 ${imageSrc ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-slate-700 bg-slate-900/50 hover:bg-slate-800'}`}
            >
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    accept="image/*" 
                    className="hidden" 
                />
                {imageSrc ? (
                    <img src={imageSrc} className="h-full w-auto object-contain rounded-lg shadow-lg" alt="Preview" />
                ) : (
                    <>
                        <Upload className="text-emerald-400 mb-2" size={20} />
                        <span className="text-slate-300 text-sm font-medium">Upload do Personagem</span>
                    </>
                )}
            </div>

            {/* 2. Motion Prompt */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 shrink-0">
                <label className="text-xs font-medium text-emerald-400 mb-2 flex items-center gap-2 uppercase tracking-wide">
                    <Activity size={14} /> Comportamento
                </label>
                <input 
                    type="text"
                    value={motionPrompt}
                    onChange={(e) => setMotionPrompt(e.target.value)}
                    placeholder="Ex: Dançando muito, Nervoso, Calmo..."
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:border-emerald-500 outline-none transition-all"
                />
            </div>

            {/* 3. Audio Source Selection */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex-grow flex flex-col min-h-[200px]">
                <div className="flex bg-slate-900 rounded-lg p-1 mb-4 shrink-0">
                    <button 
                        onClick={() => setInputType('text')}
                        className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${inputType === 'text' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        TTS
                    </button>
                    <button 
                         onClick={() => setInputType('audio')}
                         className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${inputType === 'audio' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        MP3
                    </button>
                </div>

                {inputType === 'text' ? (
                    <div className="space-y-4 flex-grow flex flex-col">
                        <select 
                            value={selectedVoice}
                            onChange={(e) => setSelectedVoice(e.target.value as VoiceName)}
                            className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg p-2 focus:border-emerald-500 outline-none"
                        >
                            {VOICE_OPTIONS.map(v => (
                                <option key={v.value} value={v.value}>{v.label}</option>
                            ))}
                        </select>
                        <textarea
                            value={textPrompt}
                            onChange={(e) => setTextPrompt(e.target.value)}
                            placeholder="Texto da fala..."
                            className="w-full flex-grow min-h-[60px] bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-xs resize-none focus:border-emerald-500 outline-none"
                        />
                    </div>
                ) : (
                    <div 
                        onClick={() => audioInputRef.current?.click()}
                        className="flex-grow border border-dashed border-slate-700 rounded-lg bg-slate-900/30 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900/50"
                    >
                         <input 
                            type="file" 
                            ref={audioInputRef}
                            onChange={handleAudioUpload}
                            accept="audio/*"
                            className="hidden"
                        />
                        <FileAudio className="text-emerald-400 mb-2" />
                        <span className="text-xs text-slate-300">{audioFile ? audioFile.name : "Selecionar Arquivo"}</span>
                    </div>
                )}
            </div>

            {/* 4. Action Button */}
            <button
                onClick={handleGenerate}
                disabled={isProcessing || !imageFile || (inputType === 'text' && !textPrompt) || (inputType === 'audio' && !audioFile)}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shrink-0 ${
                    isProcessing 
                    ? 'bg-slate-800 text-slate-500 cursor-wait' 
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.02]'
                }`}
            >
                {isProcessing ? 'Processando...' : <><Wand2 size={20} /> Gerar Animação</>}
            </button>
        </div>

        {/* PREVIEW (Right) */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center h-full overflow-hidden bg-slate-950/50 rounded-2xl border border-slate-800 p-4 relative">
            
            {/* Canvas Container constrained by Aspect Ratio */}
            <div 
                className="relative bg-black rounded-lg overflow-hidden shadow-2xl transition-all duration-300 ease-in-out border border-slate-800"
                style={getPreviewStyle()}
            >
                {!imageSrc ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                        <ImageIcon size={64} className="mb-4 opacity-50" />
                        <p className="text-sm">O personagem aparecerá aqui</p>
                    </div>
                ) : (
                    <canvas 
                        ref={canvasRef} 
                        className="w-full h-full object-contain"
                    />
                )}

                {/* Overlay Controls */}
                {audioBuffer && (
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 z-10 w-max">
                         {/* Play/Pause Control */}
                        <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-4 border border-slate-700 shadow-xl">
                            <button 
                                onClick={() => isPlaying ? stopAudio() : playAudio(audioBuffer, initAudioContext())}
                                disabled={isRecording}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isRecording ? 'bg-slate-700 text-slate-500' : 'bg-emerald-500 text-white hover:bg-emerald-400'}`}
                            >
                                {isPlaying && !isRecording ? <Pause fill="currentColor" size={16} /> : <Play fill="currentColor" className="ml-1" size={16} />}
                            </button>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                                    {isRecording ? "Gravando..." : isPlaying ? "Animando" : "Pronto"}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {Math.floor(audioBuffer.duration)}s • {aspectRatio}
                                </span>
                            </div>
                        </div>

                        {/* Download Button */}
                        <button 
                            onClick={handleRecordDownload}
                            disabled={isRecording || isPlaying}
                            className={`px-5 py-3 rounded-full font-bold text-sm flex items-center gap-2 shadow-xl border transition-all ${
                                isRecording 
                                ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse cursor-not-allowed' 
                                : 'bg-white text-emerald-900 border-white hover:bg-emerald-50 hover:scale-105'
                            }`}
                        >
                            {isRecording ? (
                                <>
                                   <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"/>
                                   Gravando...
                                </>
                            ) : (
                                <>
                                    <Download size={16} />
                                    Baixar Vídeo
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarStudio;
