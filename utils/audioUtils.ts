
import { ToneType } from "../types";

/**
 * Decodes a base64 string into a raw byte array.
 */
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64.replace(/\s/g, ''));
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM data (or other formats supported by context) into an AudioBuffer.
 */
export async function decodeAudioData(
  base64Data: string,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  const bytes = decodeBase64(base64Data);
  
  const isWav = bytes.length > 12 && 
                bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
                bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;

  if (isWav) {
    try {
      const bufferCopy = bytes.buffer.slice(0);
      return await audioContext.decodeAudioData(bufferCopy);
    } catch (e) {
      console.warn("WAV header detected but standard decode failed, attempting manual PCM decode.", e);
    }
  }

  // Gemini TTS returns 24kHz mono raw PCM by default
  const sampleRate = 24000;
  const numChannels = 1;
  
  let bufferToDecode = bytes.buffer;
  if (bytes.byteLength % 2 !== 0) {
     bufferToDecode = bytes.buffer.slice(0, bytes.byteLength - 1);
  }

  const int16Data = new Int16Array(bufferToDecode);
  const frameCount = int16Data.length;
  
  const audioBuffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < frameCount; i++) {
    const sample = int16Data[i];
    channelData[i] = sample < 0 ? sample / 32768.0 : sample / 32767.0;
  }

  return audioBuffer;
}

/**
 * Export audio buffer to WAV blob for download
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this example)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][pos])); 
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; 
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([bufferArr], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

// --- Random Helpers ---
const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Mixes two audio buffers (Vocal + Instrumental) with style-aware processing
 */
export async function mixAudioBuffers(
  bufferA: AudioBuffer, // Vocals
  bufferB: AudioBuffer, // Music
  context: AudioContext,
  style: string = ""
): Promise<AudioBuffer> {
  const channels = 2;
  const duration = Math.max(bufferA.duration, bufferB.duration);
  const sampleRate = context.sampleRate;
  
  const offlineCtx = new OfflineAudioContext(channels, duration * sampleRate, sampleRate);

  // --- Vocal Chain ---
  const vocalSource = offlineCtx.createBufferSource();
  vocalSource.buffer = bufferA;
  
  const vocalGain = offlineCtx.createGain();
  vocalGain.gain.value = 0.8; // Default vocal level

  // Vocal Compressor (make it sit in the mix)
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 30;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  // Style-specific Vocal Effects
  const styleL = style.toLowerCase();
  const vocalEffectSend = offlineCtx.createGain();
  vocalEffectSend.gain.value = 0; 
  
  // Delay effect
  const delay = offlineCtx.createDelay();
  delay.delayTime.value = 0.3;
  const delayFeedback = offlineCtx.createGain();
  delayFeedback.gain.value = 0.4;
  const delayFilter = offlineCtx.createBiquadFilter();
  delayFilter.frequency.value = 2000;
  
  delay.connect(delayFeedback);
  delayFeedback.connect(delayFilter);
  delayFilter.connect(delay);
  
  // Routing
  vocalSource.connect(compressor);
  compressor.connect(vocalGain);
  vocalGain.connect(offlineCtx.destination); // Dry signal
  
  vocalGain.connect(vocalEffectSend);
  vocalEffectSend.connect(delay);
  delay.connect(offlineCtx.destination); // Wet signal

  if (styleL.includes('rock') || styleL.includes('metal') || styleL.includes('violento')) {
     // Saturation / Drive
     const shaper = offlineCtx.createWaveShaper();
     const curve = new Float32Array(256);
     for(let i=0; i<256; i++) {
         const x = (i/256) * 2 - 1;
         curve[i] = (3 + 10) * x * 20 * (Math.PI/180) / (Math.PI + 10 * Math.abs(x));
     }
     shaper.curve = curve;
     vocalSource.disconnect();
     vocalSource.connect(shaper);
     shaper.connect(compressor);
     
     vocalGain.gain.value = 0.7;
     vocalEffectSend.gain.value = 0.15; 
     delay.delayTime.value = 0.1; // Slapback
  } else if (styleL.includes('electronic') || styleL.includes('dance') || styleL.includes('pop')) {
     // More delay
     vocalEffectSend.gain.value = 0.3;
     delay.delayTime.value = 0.375; 
     delayFeedback.gain.value = 0.5;
  } else if (styleL.includes('lo-fi') || styleL.includes('radio') || styleL.includes('old')) {
     // Telephone EQ
     const phoneFilter = offlineCtx.createBiquadFilter();
     phoneFilter.type = 'bandpass';
     phoneFilter.frequency.value = 1000;
     phoneFilter.Q.value = 2.0;
     vocalSource.disconnect();
     vocalSource.connect(phoneFilter);
     phoneFilter.connect(compressor);
     vocalEffectSend.gain.value = 0.1;
  } else if (styleL.includes('pregação') || styleL.includes('church')) {
      // Large Hall Reverb Sim (Long Delay)
      delay.delayTime.value = 0.08;
      delayFeedback.gain.value = 0.7;
      vocalEffectSend.gain.value = 0.4;
  }

  // --- Music Chain ---
  const musicSource = offlineCtx.createBufferSource();
  musicSource.buffer = bufferB;
  const musicGain = offlineCtx.createGain();
  musicGain.gain.value = 0.6; 
  
  musicSource.connect(musicGain);
  musicGain.connect(offlineCtx.destination);

  vocalSource.start(0);
  musicSource.start(0);

  return await offlineCtx.startRendering();
}

/**
 * PROCEDURAL MUSIC GENERATION UTILS
 */

const createOscillator = (ctx: BaseAudioContext, type: OscillatorType, freq: number) => {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  return osc;
};

const createNoiseBuffer = (ctx: BaseAudioContext) => {
  const bufferSize = ctx.sampleRate * 2; 
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  return buffer;
};

/**
 * Used for background music in Narration Mode (Simpler)
 */
export async function addBackgroundMusic(
  voiceBuffer: AudioBuffer,
  tone: ToneType,
  context: AudioContext
): Promise<AudioBuffer> {
  // Add slightly more tail to music
  const duration = voiceBuffer.duration + 2.0; 
  const sampleRate = voiceBuffer.sampleRate;
  const offlineCtx = new OfflineAudioContext(1, duration * sampleRate, sampleRate);

  const voiceSource = offlineCtx.createBufferSource();
  voiceSource.buffer = voiceBuffer;
  const voiceGain = offlineCtx.createGain();
  voiceGain.gain.value = 1.0; 
  voiceSource.connect(voiceGain);
  voiceGain.connect(offlineCtx.destination);
  voiceSource.start(0);

  const musicGain = offlineCtx.createGain();
  
  // FIXED: Increased volume from 0.15 to 0.3 for better audibility
  let bgVolume = 0.3; 
  musicGain.connect(offlineCtx.destination);

  await generateProceduralLayers(offlineCtx, musicGain, tone, duration);
  
  musicGain.gain.value = bgVolume;

  return await offlineCtx.startRendering();
}

/**
 * Used for Music Mode (Complex Instrumental Generation)
 * Now accepts custom duration
 */
export async function generateInstrumentalTrack(
  styleDescription: string,
  context: AudioContext,
  customDuration?: number
): Promise<AudioBuffer> {
  const duration = customDuration || 30; 
  const sampleRate = context.sampleRate || 44100; 
  const offlineCtx = new OfflineAudioContext(2, duration * sampleRate, sampleRate);
  
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.6;
  masterGain.connect(offlineCtx.destination);

  // Analyze style string to pick a preset
  const style = styleDescription.toLowerCase();
  
  if (style.includes('rock') || style.includes('metal') || style.includes('intense') || style.includes('violento')) {
     await generateRockTrack(offlineCtx, masterGain, duration, style);
  } else if (style.includes('electronic') || style.includes('techno') || style.includes('dance') || style.includes('phonk') || style.includes('pop')) {
     await generateElectronicTrack(offlineCtx, masterGain, duration, style);
  } else if (style.includes('lo-fi') || style.includes('chill') || style.includes('hip hop') || style.includes('jazz')) {
     await generateLofiTrack(offlineCtx, masterGain, duration, style);
  } else {
     // Default Ambient/Cinematic
     await generateAmbientTrack(offlineCtx, masterGain, duration, style);
  }

  return await offlineCtx.startRendering();
}

/**
 * NEW: Procedural SFX Generator
 */
export async function generateProceduralSFX(
  keyword: string,
  context: AudioContext
): Promise<AudioBuffer> {
  const sampleRate = context.sampleRate;
  let duration = 3.0;
  const k = keyword.toLowerCase();
  
  // Determine duration based on type
  if (k.includes('explosao') || k.includes('fogo')) duration = 4.0;
  if (k.includes('coin') || k.includes('8-bit')) duration = 0.5;
  if (k.includes('buzina')) duration = 1.0;
  
  const offlineCtx = new OfflineAudioContext(1, duration * sampleRate, sampleRate);
  const gain = offlineCtx.createGain();
  gain.connect(offlineCtx.destination);

  // --- SFX LOGIC ---

  if (k.includes('explosao') || k.includes('fogo') || k.includes('thunder')) {
    // White Noise through Lowpass filter envelope
    const noise = offlineCtx.createBufferSource();
    noise.buffer = createNoiseBuffer(offlineCtx);
    
    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, 0);
    filter.frequency.exponentialRampToValueAtTime(3000, 0.1);
    filter.frequency.exponentialRampToValueAtTime(50, duration);
    
    gain.gain.setValueAtTime(1, 0);
    gain.gain.exponentialRampToValueAtTime(0.01, duration);
    
    noise.connect(filter);
    filter.connect(gain);
    noise.start(0);

  } else if (k.includes('laser') || k.includes('sci-fi') || k.includes('tiro')) {
    // Sine sweep down
    const osc = offlineCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, 0);
    osc.frequency.exponentialRampToValueAtTime(100, 0.3);
    
    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 500;

    gain.gain.setValueAtTime(0.5, 0);
    gain.gain.linearRampToValueAtTime(0, 0.3);

    osc.connect(filter);
    filter.connect(gain);
    osc.start(0);

  } else if (k.includes('motor') || k.includes('carro') || k.includes('engine')) {
    // Modulated Sawtooth for revving
    const osc = offlineCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, 0);
    osc.frequency.linearRampToValueAtTime(120, 1.0); // Rev up
    osc.frequency.linearRampToValueAtTime(80, 2.0); // Rev down
    
    // Amplitude modulation for "rumble"
    const lfo = offlineCtx.createOscillator();
    lfo.frequency.value = 30;
    const lfoGain = offlineCtx.createGain();
    lfoGain.gain.value = 0.3;
    
    const mainGain = offlineCtx.createGain();
    mainGain.gain.value = 0.5;

    lfo.connect(lfoGain);
    lfoGain.connect(mainGain.gain);
    
    osc.connect(mainGain);
    mainGain.connect(gain);
    
    osc.start(0);
    lfo.start(0);

  } else if (k.includes('buzina') || k.includes('horn') || k.includes('alarme')) {
    // Two dissonant oscillators
    const osc1 = offlineCtx.createOscillator();
    const osc2 = offlineCtx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    
    if (k.includes('alarme')) {
        // Siren
        const lfo = offlineCtx.createOscillator();
        lfo.frequency.value = 2; // 2 Hz cycle
        const lfoG = offlineCtx.createGain();
        lfoG.gain.value = 200; // +/- 200Hz
        lfo.connect(lfoG);
        lfoG.connect(osc1.frequency);
        
        osc1.frequency.value = 800;
        osc1.connect(gain);
        lfo.start(0);
    } else {
        // Car Horn
        osc1.frequency.value = 400;
        osc2.frequency.value = 500; // Major third-ish
        osc1.connect(gain);
        osc2.connect(gain);
        osc2.start(0);
    }
    osc1.start(0);
    gain.gain.setValueAtTime(0.5, 0);
    gain.gain.setValueAtTime(0.5, duration - 0.1);
    gain.gain.linearRampToValueAtTime(0, duration);

  } else if (k.includes('coin') || k.includes('game')) {
    // Arpeggio
    const osc = offlineCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(987.77, 0); // B5
    osc.frequency.setValueAtTime(1318.51, 0.1); // E6
    
    gain.gain.setValueAtTime(0.3, 0);
    gain.gain.linearRampToValueAtTime(0, 0.4);
    
    osc.connect(gain);
    osc.start(0);
  } else if (k.includes('transito') || k.includes('city')) {
    // Pink noise + Panning
     const noise = offlineCtx.createBufferSource();
     noise.buffer = createNoiseBuffer(offlineCtx);
     const filter = offlineCtx.createBiquadFilter();
     filter.type = 'lowpass';
     filter.frequency.value = 600;
     
     // LFO for panning "cars passing"
     const panner = offlineCtx.createStereoPanner();
     const lfo = offlineCtx.createOscillator();
     lfo.frequency.value = 0.5;
     lfo.connect(panner.pan);
     
     noise.connect(filter);
     filter.connect(panner);
     panner.connect(gain);
     
     gain.gain.value = 0.5;
     noise.start(0);
     lfo.start(0);
  } else {
    // Generic "Impact" (Kick)
    const osc = offlineCtx.createOscillator();
    osc.frequency.setValueAtTime(150, 0);
    osc.frequency.exponentialRampToValueAtTime(0.01, 0.5);
    gain.gain.setValueAtTime(1, 0);
    gain.gain.exponentialRampToValueAtTime(0.01, 0.5);
    osc.connect(gain);
    osc.start(0);
  }

  return await offlineCtx.startRendering();
}


// --- Generators ---

async function generateProceduralLayers(ctx: OfflineAudioContext, dest: AudioNode, tone: ToneType, duration: number) {
  if (tone === ToneType.Preaching) {
      const preachingFreqs = [130.81, 164.81, 196.00, 261.63];
      preachingFreqs.forEach((freq) => {
        const osc = createOscillator(ctx, 'triangle', freq);
        osc.detune.value = (Math.random() - 0.5) * 10; 
        const oscGain = ctx.createGain();
        oscGain.gain.value = 0.2; // Increased
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        osc.connect(filter);
        filter.connect(oscGain);
        oscGain.connect(dest);
        osc.start(0);
        oscGain.gain.setValueAtTime(0.2, duration - 2);
        oscGain.gain.linearRampToValueAtTime(0, duration);
      });
  } else if (tone === ToneType.Sales || tone === ToneType.Excited) {
      // Upbeat pulse
      const bpm = 120;
      const beatInterval = 60 / bpm;
      for (let time = 0; time < duration; time += beatInterval) {
        // Kick
        const osc = ctx.createOscillator();
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        const kickGain = ctx.createGain();
        kickGain.gain.setValueAtTime(0.8, time);
        kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
        osc.connect(kickGain);
        kickGain.connect(dest);
        osc.start(time);
        osc.stop(time + 0.5);
        
        // HiHat on offbeat
        const hat = ctx.createBufferSource();
        hat.buffer = createNoiseBuffer(ctx);
        const hg = ctx.createGain();
        hg.gain.setValueAtTime(0.1, time + beatInterval/2);
        hg.gain.linearRampToValueAtTime(0, time + beatInterval/2 + 0.05);
        const hf = ctx.createBiquadFilter();
        hf.type = 'highpass';
        hf.frequency.value = 6000;
        hat.connect(hf);
        hf.connect(hg);
        hg.connect(dest);
        hat.start(time + beatInterval/2);
      }
  } else {
      // Default / Neutral / Soothing / Professional
      const freqs = tone === ToneType.Soothing ? [440, 554.37, 659.25] : [261.63, 329.63, 392.00]; // A Major vs C Major
      freqs.forEach(freq => {
        const osc = createOscillator(ctx, 'sine', freq);
        const oscGain = ctx.createGain();
        oscGain.gain.value = 0.15; // Increased
        osc.connect(oscGain);
        oscGain.connect(dest);
        osc.start(0);
      });
      
      // Add a gentle rhythmic element for Neutral so users know it's working
      if (tone === ToneType.Neutral || tone === ToneType.Professional) {
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 0.5; // Slow pulse
          const lfoG = ctx.createGain();
          lfoG.gain.value = 0.05;
          
          const drone = createOscillator(ctx, 'triangle', freqs[0] / 2);
          drone.connect(lfoG);
          lfoG.connect(dest);
          drone.start(0);
      }
  }
}

// --- Music Mode Generators ---

// Helper to parse BPM from style string, or return random within range
const getBpm = (style: string, min: number, max: number): number => {
    // Look for numbers followed by 'bpm'
    const match = style.match(/(\d+)\s*bpm/);
    if (match) {
        const val = parseInt(match[1]);
        if (!isNaN(val) && val > 30 && val < 300) return val;
    }
    return randomRange(min, max);
};

async function generateElectronicTrack(ctx: OfflineAudioContext, dest: AudioNode, duration: number, style: string) {
  const bpm = getBpm(style, 120, 140);
  const beatTime = 60 / bpm;
  
  // Randomize Root Key
  const rootFreq = randomChoice([49.00, 55.00, 65.41, 73.42]); // G1, A1, C2, D2
  
  // Kick Drum
  for (let t = 0; t < duration; t += beatTime) {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // Hi-hats (Randomize pattern)
  const noiseBuff = createNoiseBuffer(ctx);
  const sixteenth = beatTime / 4;
  for (let t = 0; t < duration; t += sixteenth) {
     // Simple probabilistic rhythm
     if (Math.random() > 0.3) { 
        const src = ctx.createBufferSource();
        src.buffer = noiseBuff;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = randomRange(6000, 10000);
        const g = ctx.createGain();
        const vol = ((t / beatTime) % 1 === 0.5) ? 0.2 : 0.05; // Accent upbeat
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        src.connect(filter);
        filter.connect(g);
        g.connect(dest);
        src.start(t);
        src.stop(t + 0.1);
     }
  }

  // Bassline (Random Arp)
  const bassOsc = ctx.createOscillator();
  bassOsc.type = Math.random() > 0.5 ? 'sawtooth' : 'square';
  const bassFilter = ctx.createBiquadFilter();
  bassFilter.type = 'lowpass';
  bassFilter.frequency.value = 400;
  bassFilter.Q.value = 10;
  
  // Randomize Arp Notes based on root
  const intervals = [0, 3, 7, 10, 12]; // Minor Pentatonic intervals
  const arpNotes = [];
  for(let i=0; i<4; i++) {
      const interval = randomChoice(intervals);
      arpNotes.push(rootFreq * Math.pow(2, interval/12));
  }

  let noteIdx = 0;
  for (let t = 0; t < duration; t += beatTime / 2) {
     const freq = arpNotes[noteIdx % arpNotes.length];
     bassOsc.frequency.setValueAtTime(freq, t);
     
     // Wub wub envelope
     bassFilter.frequency.setValueAtTime(200, t);
     bassFilter.frequency.linearRampToValueAtTime(800, t + 0.15);
     bassFilter.frequency.linearRampToValueAtTime(200, t + 0.3);

     noteIdx++;
  }
  
  const bassGain = ctx.createGain();
  bassGain.gain.value = 0.3;
  
  bassOsc.connect(bassFilter);
  bassFilter.connect(bassGain);
  bassGain.connect(dest);
  bassOsc.start(0);
}

async function generateAmbientTrack(ctx: OfflineAudioContext, dest: AudioNode, duration: number, style: string) {
   // Randomized Drones
   const baseFreq = randomChoice([110, 130.81, 146.83, 164.81, 196.00]); // A2, C3, D3, E3, G3
   const numOscs = 3;
   
   for(let i=0; i<numOscs; i++) {
       const osc = ctx.createOscillator();
       osc.type = randomChoice(['sine', 'triangle']);
       // Random harmonic
       const harmonic = randomChoice([1, 1.5, 2, 3]);
       osc.frequency.value = baseFreq * harmonic;
       
       // Slight detune
       osc.detune.value = randomRange(-10, 10);

       const gain = ctx.createGain();
       gain.gain.value = 0.1;
       
       // Slow amplitude modulation (swells)
       const lfo = ctx.createOscillator();
       lfo.frequency.value = randomRange(0.05, 0.2);
       const lfoGain = ctx.createGain();
       lfoGain.gain.value = 0.05;
       lfo.connect(lfoGain);
       lfoGain.connect(gain.gain); 
       lfo.start(0);

       // Panning
       const panner = ctx.createStereoPanner();
       panner.pan.value = randomRange(-0.8, 0.8);

       osc.connect(gain);
       gain.connect(panner);
       panner.connect(dest);
       
       osc.start(0);
   }
}

async function generateRockTrack(ctx: OfflineAudioContext, dest: AudioNode, duration: number, style: string) {
  const bpm = getBpm(style, 100, 160);
  const beat = 60/bpm;
  const rootFreq = randomChoice([82.41, 73.42, 98.00]); // E2, D2, G2

  // Distorted Guitar Drone Simulation
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = rootFreq;
  
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(44100);
  const distAmount = randomRange(20, 100);
  for (let i = 0; i < 44100; i++) {
    const x = (i * 2) / 44100 - 1;
    curve[i] = (3 + distAmount) * x * 20 * (Math.PI / 180) / (Math.PI + distAmount * Math.abs(x));
  }
  shaper.curve = curve;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = randomRange(1500, 3000);
  
  const gain = ctx.createGain();
  gain.gain.value = 0.1;
  
  // Power Chords (Root + 5th)
  const osc5 = ctx.createOscillator();
  osc5.type = 'sawtooth';
  osc5.frequency.value = rootFreq * 1.5;
  
  osc.connect(shaper);
  osc5.connect(shaper);

  shaper.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(0);
  osc5.start(0);

  // Drums (Random Rock beat)
  for(let t=0; t<duration; t+=beat) {
     // Kick on 1, maybe on "and" of 3
     const playKick = true; // Always on beat for now
     
     if (playKick) {
        const kOsc = ctx.createOscillator();
        kOsc.frequency.setValueAtTime(100, t);
        kOsc.frequency.exponentialRampToValueAtTime(0.01, t+0.1);
        const kG = ctx.createGain();
        kG.gain.setValueAtTime(0.8, t);
        kG.gain.exponentialRampToValueAtTime(0.001, t+0.1);
        kOsc.connect(kG);
        kG.connect(dest);
        kOsc.start(t); kOsc.stop(t+0.1);
     }

     // Snare on 2 and 4 (offsets 1 and 3 in 0-index)
     if (t % (beat*2) >= beat - 0.01) {
         const sN = ctx.createBufferSource();
         sN.buffer = createNoiseBuffer(ctx);
         const sG = ctx.createGain();
         sG.gain.setValueAtTime(0.4, t);
         sG.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
         sN.connect(sG);
         sG.connect(dest);
         sN.start(t);
         sN.stop(t + 0.2);
     }
  }
}

async function generateLofiTrack(ctx: OfflineAudioContext, dest: AudioNode, duration: number, style: string) {
    const bpm = getBpm(style, 70, 90);
    
    // Dusty Vinyl Noise
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx);
    noise.loop = true;
    const nG = ctx.createGain();
    nG.gain.value = 0.03;
    noise.connect(nG);
    nG.connect(dest);
    noise.start(0);
    
    // Rhodes-ish Chords
    // Randomize progression
    const progression = Math.random() > 0.5 
        ? [[261.63, 329.63, 392.00, 493.88], [220.00, 261.63, 329.63, 392.00]] // Cmaj7 - Am7
        : [[349.23, 440.00, 523.25, 659.25], [392.00, 493.88, 587.33, 698.46]]; // Fmaj7 - G7
    
    const chordDur = (60/bpm) * 4; // 1 bar
    for(let t=0; t<duration; t+=chordDur) {
       const chord = progression[(t/chordDur)%progression.length];
       chord.forEach(freq => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.04, t + 0.1);
          g.gain.setValueAtTime(0.04, t + chordDur - 0.5);
          g.gain.linearRampToValueAtTime(0, t + chordDur);
          
          // Tremolo
          const lfo = ctx.createOscillator();
          lfo.frequency.value = randomRange(3, 6);
          const lfoG = ctx.createGain();
          lfoG.gain.value = 0.01;
          lfo.connect(lfoG);
          lfoG.connect(g.gain); 
          lfo.start(t);
          lfo.stop(t+chordDur);
          
          osc.connect(g);
          g.connect(dest);
          osc.start(t);
          osc.stop(t+chordDur);
       });
    }
    
    // Simple Hip Hop Beat
    const beat = 60/bpm;
    for(let t=0; t<duration; t+=beat) {
       // Kick with swing
       const swing = 0.05;
       const time = t + (Math.random() * swing);
       
       const kOsc = ctx.createOscillator();
       kOsc.frequency.setValueAtTime(80, time);
       kOsc.frequency.exponentialRampToValueAtTime(0.01, time+0.2);
       const kG = ctx.createGain();
       kG.gain.setValueAtTime(0.6, time);
       kG.gain.exponentialRampToValueAtTime(0.001, time+0.2);
       kOsc.connect(kG);
       kG.connect(dest);
       kOsc.start(time); kOsc.stop(time+0.2);
    }
}
