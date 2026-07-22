
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
 * Automatic Audio Mastering (Enhancer)
 * Applies HighPass Filter, EQ Presence, and Compression
 */
export async function masterAudioBuffer(
  inputBuffer: AudioBuffer,
  context: AudioContext,
  isCarSoundMode: boolean = false
): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(
    inputBuffer.numberOfChannels,
    inputBuffer.length,
    inputBuffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = inputBuffer;

  // 1. Denoise (High Pass Filter to remove rumble)
  const highPass = offlineCtx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = isCarSoundMode ? 150 : 100; // More aggressive for car speakers

  // 2. Presence (Peaking EQ to add clarity)
  const presenceEq = offlineCtx.createBiquadFilter();
  presenceEq.type = 'peaking';
  presenceEq.frequency.value = 3000; // Human speech clarity range
  presenceEq.Q.value = 1.0;
  presenceEq.gain.value = isCarSoundMode ? 6 : 3; // +6dB boost for car speakers

  // 3. Outdoor Speaker EQ (Boost high-mids for projection)
  const outdoorEq = offlineCtx.createBiquadFilter();
  outdoorEq.type = 'peaking';
  outdoorEq.frequency.value = 5000;
  outdoorEq.gain.value = isCarSoundMode ? 4 : 0;

  // 4. Compressor (Even out dynamics)
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = isCarSoundMode ? -30 : -20; // More compression for car sound
  compressor.knee.value = 30;
  compressor.ratio.value = isCarSoundMode ? 12 : 4; // Higher ratio for aggressive commercial sound
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  // 5. Makeup Gain
  const gain = offlineCtx.createGain();
  gain.gain.value = isCarSoundMode ? 2.0 : 1.5; // Louder for car sound

  // Connect chain
  source.connect(highPass);
  highPass.connect(presenceEq);
  presenceEq.connect(outdoorEq);
  outdoorEq.connect(compressor);
  compressor.connect(gain);
  gain.connect(offlineCtx.destination);

  source.start(0);

  return await offlineCtx.startRendering();
}

/**
 * Concatenates multiple AudioBuffers into a single AudioBuffer sequence.
 */
export function concatenateAudioBuffers(buffers: AudioBuffer[], context: AudioContext): AudioBuffer {
    if (buffers.length === 0) return context.createBuffer(1, 1, 24000);
    
    // Calculate total length and max channels
    let totalLength = 0;
    let maxChannels = 1;
    buffers.forEach(b => {
        totalLength += b.length;
        if (b.numberOfChannels > maxChannels) maxChannels = b.numberOfChannels;
    });

    const output = context.createBuffer(maxChannels, totalLength, buffers[0].sampleRate);

    let offset = 0;
    buffers.forEach(buffer => {
        for (let channel = 0; channel < maxChannels; channel++) {
            // If buffer has fewer channels, duplicate mono to stereo if needed, or just take channel 0
            const inputChannel = buffer.getChannelData(channel < buffer.numberOfChannels ? channel : 0);
            const outputChannel = output.getChannelData(channel);
            outputChannel.set(inputChannel, offset);
        }
        offset += buffer.length;
    });

    return output;
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

  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };

  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

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
}

/**
 * Export audio buffer to MP3 blob using lamejs
 */
export function audioBufferToMp3(buffer: AudioBuffer): Blob {
  // @ts-ignore
  if (typeof lamejs === 'undefined') {
    throw new Error('A biblioteca lamejs não foi carregada corretamente.');
  }

  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  // @ts-ignore
  const mp3encoder = new lamejs.Mp3Encoder(numOfChan, sampleRate, 128);
  const mp3Data: Uint8Array[] = [];

  const left = buffer.getChannelData(0);
  const right = numOfChan > 1 ? buffer.getChannelData(1) : left;

  const sampleBlockSize = 1152;

  // Convert Float32 samples to Int16
  const floatToInt16 = (samples: Float32Array): Int16Array => {
    const int16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      int16[i] = s < 0 ? s * 32768 : s * 32767;
    }
    return int16;
  };

  const leftInt16 = floatToInt16(left);
  const rightInt16 = floatToInt16(right);

  for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
    const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
    const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
    let mp3buf: Uint8Array;
    if (numOfChan === 1) {
      mp3buf = mp3encoder.encodeBuffer(leftChunk);
    } else {
      mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    }
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }
  }

  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(new Uint8Array(mp3buf));
  }

  return new Blob(mp3Data, { type: 'audio/mp3' });
}

// --- procedural methods below ---
export async function mixAudioBuffers(
  bufferA: AudioBuffer, // Vocals
  bufferB: AudioBuffer, // Music
  context: AudioContext,
  style: string = "",
  duckingIntensity: number = 0.2 // 0.2 means music drops to 20% volume
): Promise<AudioBuffer> {
  const channels = 2;
  const duration = Math.max(bufferA.duration, bufferB.duration);
  const sampleRate = context.sampleRate;
  
  const offlineCtx = new OfflineAudioContext(channels, duration * sampleRate, sampleRate);

  // --- Vocal Chain ---
  const vocalSource = offlineCtx.createBufferSource();
  vocalSource.buffer = bufferA;
  
  const vocalGain = offlineCtx.createGain();
  vocalGain.gain.value = 1.3; // Boosted Voice

  vocalSource.connect(vocalGain);
  vocalGain.connect(offlineCtx.destination);

  // --- Music Chain with Ducking ---
  const musicSource = offlineCtx.createBufferSource();
  musicSource.buffer = bufferB;
  const musicGain = offlineCtx.createGain();
  
  // Ducking logic: lower music volume when voice is playing
  musicGain.gain.setValueAtTime(1.0, 0); // Start at full volume
  
  // Simple ducking: drop volume at start of voice, restore at end
  // In a real implementation, we'd analyze the voice buffer for silence
  musicGain.gain.linearRampToValueAtTime(duckingIntensity, 0.1); 
  musicGain.gain.setValueAtTime(duckingIntensity, bufferA.duration - 0.5);
  musicGain.gain.linearRampToValueAtTime(1.0, bufferA.duration);
  
  musicSource.connect(musicGain);
  musicGain.connect(offlineCtx.destination);

  vocalSource.start(0);
  musicSource.start(0);

  return await offlineCtx.startRendering();
}

export async function addBackgroundMusic(
  voiceBuffer: AudioBuffer,
  tone: ToneType | string,
  context: AudioContext,
  duckingIntensity: number = 0.2
): Promise<AudioBuffer> {
  const duration = voiceBuffer.duration + 2.0; 
  const sampleRate = voiceBuffer.sampleRate;
  const offlineCtx = new OfflineAudioContext(1, duration * sampleRate, sampleRate);

  const voiceSource = offlineCtx.createBufferSource();
  voiceSource.buffer = voiceBuffer;
  const voiceGain = offlineCtx.createGain();
  voiceGain.gain.value = 1.3; 
  voiceSource.connect(voiceGain);
  voiceGain.connect(offlineCtx.destination);
  voiceSource.start(0);

  const musicGain = offlineCtx.createGain();
  
  // Ducking logic for procedural music
  musicGain.gain.setValueAtTime(0.4, 0); // Background music starts at 40%
  musicGain.gain.linearRampToValueAtTime(duckingIntensity, 0.2); // Duck when voice starts
  musicGain.gain.setValueAtTime(duckingIntensity, voiceBuffer.duration - 0.5);
  musicGain.gain.linearRampToValueAtTime(0.4, voiceBuffer.duration); // Restore after voice
  
  musicGain.connect(offlineCtx.destination);

  await generateProceduralLayers(offlineCtx, musicGain, tone, duration);
  
  return await offlineCtx.startRendering();
}

async function generateProceduralLayers(ctx: OfflineAudioContext, dest: AudioNode, tone: any, duration: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.05;
    osc.connect(g);
    g.connect(dest);
    osc.start(0);
}

export async function generateInstrumentalTrack(
  styleDescription: string,
  context: AudioContext,
  customDuration?: number
): Promise<AudioBuffer> {
    return context.createBuffer(2, context.sampleRate * (customDuration || 10), context.sampleRate);
}

export async function generateProceduralSFX(
  keyword: string,
  context: AudioContext
): Promise<AudioBuffer> {
  const sampleRate = context.sampleRate;
  let duration = 2.0;
  const k = keyword.toLowerCase();
  
  if (k.includes('explosao') || k.includes('fogo')) duration = 3.0;
  if (k.includes('coin') || k.includes('8-bit') || k.includes('caixa')) duration = 1.0;
  if (k.includes('buzina')) duration = 0.8;
  if (k.includes('risada')) duration = 2.5;
  if (k.includes('aplausos')) duration = 4.0;
  
  const offlineCtx = new OfflineAudioContext(1, duration * sampleRate, sampleRate);
  const gain = offlineCtx.createGain();
  gain.connect(offlineCtx.destination);

  if (k.includes('explosao') || k.includes('fogo')) {
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
  } else if (k.includes('laser') || k.includes('sci-fi')) {
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
  } else if (k.includes('buzina') || k.includes('horn')) {
    const osc1 = offlineCtx.createOscillator();
    const osc2 = offlineCtx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.value = 400;
    osc2.frequency.value = 500; 
    osc1.connect(gain);
    osc2.connect(gain);
    osc1.start(0);
    osc2.start(0);
    gain.gain.setValueAtTime(0.6, 0);
    gain.gain.setValueAtTime(0.6, duration - 0.1);
    gain.gain.linearRampToValueAtTime(0, duration);
  } else if (k.includes('caixa') || k.includes('cash')) {
    [0, 0.15].forEach(t => {
        const osc = offlineCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000, t);
        osc.frequency.exponentialRampToValueAtTime(4000, t + 0.1);
        const g = offlineCtx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.3, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.connect(g);
        g.connect(offlineCtx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
    });
  } else if (k.includes('aplausos')) {
     const noise = offlineCtx.createBufferSource();
     noise.buffer = createNoiseBuffer(offlineCtx);
     const filter = offlineCtx.createBiquadFilter();
     filter.type = 'lowpass';
     filter.frequency.value = 2000;
     gain.gain.setValueAtTime(0.1, 0);
     gain.gain.linearRampToValueAtTime(0.8, 0.5);
     gain.gain.linearRampToValueAtTime(0, duration);
     noise.connect(filter);
     filter.connect(gain);
     noise.start(0);
  } else if (k.includes('risada')) {
      for(let i=0; i<4; i++) {
          const osc = offlineCtx.createOscillator();
          osc.type = 'triangle';
          const startT = i * 0.4;
          osc.frequency.setValueAtTime(400 - (i*20), startT);
          osc.frequency.linearRampToValueAtTime(200, startT + 0.3);
          const g = offlineCtx.createGain();
          g.gain.setValueAtTime(0, startT);
          g.gain.linearRampToValueAtTime(0.3, startT + 0.05);
          g.gain.linearRampToValueAtTime(0, startT + 0.3);
          osc.connect(g);
          g.connect(offlineCtx.destination);
          osc.start(startT);
          osc.stop(startT + 0.4);
      }
  } else {
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

const createNoiseBuffer = (ctx: BaseAudioContext) => {
  const bufferSize = ctx.sampleRate * 2; 
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  return buffer;
};
