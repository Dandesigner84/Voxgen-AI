
import { ToneType, VoiceName } from "./types";

export const VOICE_OPTIONS = [
  { value: VoiceName.Kore, label: 'Kore (Feminino, Equilibrado)', gender: 'Feminino' },
  { value: VoiceName.Puck, label: 'Puck (Masculino, Equilibrado)', gender: 'Masculino' },
  { value: VoiceName.Charon, label: 'Charon (Masculino, Grave)', gender: 'Masculino' },
  { value: VoiceName.Fenrir, label: 'Fenrir (Masculino, Intenso)', gender: 'Masculino' },
  { value: VoiceName.Zephyr, label: 'Zephyr (Feminino, Calmo)', gender: 'Feminino' },
];

export const TONE_OPTIONS = [
  { value: ToneType.Neutral, label: 'Neutro (Sem alterações)' },
  { value: ToneType.Excited, label: 'Empolgado & Enérgico' },
  { value: ToneType.Sales, label: 'Black Friday / Vendas' },
  { value: ToneType.Professional, label: 'Profissional & Corporativo' },
  { value: ToneType.Soothing, label: 'Calmo & Suave' },
  { value: ToneType.Dramatic, label: 'Dramático & Narrativo' },
  { value: ToneType.Preaching, label: 'Pregação (Cristã)' },
];

export const SFX_PRESETS = [
  { label: 'Explosão / Fogos', keyword: 'explosao' },
  { label: 'Laser / Sci-Fi', keyword: 'laser' },
  { label: 'Motor V8', keyword: 'motor' },
  { label: 'Buzina / Alarme', keyword: 'buzina' },
  { label: 'Trânsito / Cidade', keyword: 'transito' },
  { label: '8-Bit Coin', keyword: 'coin' },
];

export const DEFAULT_TEXT = "Bem-vindo ao futuro da geração de áudio. Esta é uma demonstração dos recursos de texto para fala do Gemini 2.5.";
