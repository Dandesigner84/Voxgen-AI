
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, VolumeX, Play, Pause, Zap } from 'lucide-react';

interface VoiceAssistantProps {
  onCommand: (command: 'play' | 'pause' | 'volume_down' | 'volume_up') => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onCommand }) => {
  const [isListening, setIsListening] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn("Speech Recognition não suportado neste navegador.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
        setIsListening(false);
        // Reiniciar automaticamente para escuta contínua
        if (isListening) recognition.start();
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.toLowerCase();
          processTranscript(transcript);
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      // Detecção rápida da palavra de ativação em interim
      if (interimTranscript.toLowerCase().includes('voxgen')) {
          setIsActivated(true);
          setTimeout(() => setIsActivated(false), 2000);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const processTranscript = (transcript: string) => {
    setLastTranscript(transcript);
    
    if (!transcript.includes('voxgen')) return;

    setIsActivated(true);
    setTimeout(() => setIsActivated(false), 1500);

    if (transcript.includes('tocar') || transcript.includes('play') || transcript.includes('reproduzir')) {
      onCommand('play');
    } else if (transcript.includes('pausar') || transcript.includes('parar') || transcript.includes('pause')) {
      onCommand('pause');
    } else if (transcript.includes('abaixar') || transcript.includes('baixo') || transcript.includes('diminuir')) {
      onCommand('volume_down');
    } else if (transcript.includes('aumentar') || transcript.includes('alto')) {
      onCommand('volume_up');
    }
  };

  return (
    <div className="fixed bottom-24 right-6 z-[100] flex flex-col items-end gap-3 pointer-events-none">
      {isActivated && (
          <div className="bg-cyan-600 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-2xl animate-bounce flex items-center gap-2 border border-cyan-400">
              <Zap size={14} className="animate-pulse" /> VoxGen ouvindo...
          </div>
      )}
      
      <div className={`p-4 rounded-full border-2 transition-all duration-300 shadow-xl flex items-center justify-center ${
        isActivated 
          ? 'bg-cyan-500 border-white scale-110' 
          : 'bg-slate-900/80 backdrop-blur-md border-slate-700'
      }`}>
        {isListening ? (
          <Mic size={20} className={isActivated ? 'text-white' : 'text-indigo-400'} />
        ) : (
          <MicOff size={20} className="text-red-500" />
        )}
      </div>
    </div>
  );
};

export default VoiceAssistant;
