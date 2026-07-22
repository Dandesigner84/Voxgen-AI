
import { ToneType, VoiceName } from "./types";

export const VOICE_OPTIONS = [
  { value: VoiceName.Kore, label: 'Kore (Feminino, Equilibrado)', gender: 'Feminino' },
  { value: VoiceName.Puck, label: 'Puck (Masculino, Equilibrado)', gender: 'Masculino' },
  { value: VoiceName.Charon, label: 'Charon (Masculino, Grave)', gender: 'Masculino' },
  { value: VoiceName.Fenrir, label: 'Fenrir (Masculino, Intenso)', gender: 'Masculino' },
  { value: VoiceName.Zephyr, label: 'Zephyr (Feminino, Calmo)', gender: 'Feminino' },
  
  { value: 'Kore-Radio', label: 'Kore (Rádio FM / Pop)', gender: 'Feminino', style: 'Radio' },
  { value: 'Fenrir-Promo', label: 'Fenrir (Locutor de Ofertas)', gender: 'Masculino', style: 'Promo' },
  { value: 'Puck-News', label: 'Puck (Jornalista / News)', gender: 'Masculino', style: 'News' },
  { value: 'Zephyr-Story', label: 'Zephyr (Contadora de Histórias)', gender: 'Feminino', style: 'Story' },
];

export const TONE_OPTIONS = [
  { value: ToneType.Neutral, label: 'Neutro (Sem alterações)' },
  { value: ToneType.Excited, label: 'Empolgado & Enérgico' },
  { value: ToneType.CarSound, label: 'Carro de Som (Anunciante de Rua)' },
  { value: ToneType.StorefrontAnnouncer, label: 'Porta de Loja (Gritado/Agitado)' },
  { value: ToneType.RadioCommercial, label: 'Comercial de Rádio (Locutor)' },
  { value: ToneType.PromotionalEnergetic, label: 'Promoção Explosiva (Vendas)' },
  { value: 'Vignette', label: 'Vinheta de Rádio / Promoção' }, 
  { value: ToneType.Sales, label: 'Black Friday / Vendas' },
  { value: ToneType.Professional, label: 'Profissional & Corporativo' },
  { value: ToneType.Soothing, label: 'Calmo & Suave' },
  { value: ToneType.Dramatic, label: 'Dramático & Narrativo' },
  { value: ToneType.Preaching, label: 'Pregação (Cristã)' },
];

export const SFX_PRESETS = [
  { label: 'Explosão', keyword: 'explosao' },
  { label: 'Sino', keyword: 'sino' },
  { label: 'Laser / Sci-Fi', keyword: 'laser' },
  { label: 'Motor V8', keyword: 'motor' },
  { label: 'Buzina / Alarme', keyword: 'buzina' },
  { label: 'Aplausos', keyword: 'aplausos' },
  { label: 'Risada', keyword: 'risada' },
  { label: 'Caixa Registradora', keyword: 'caixa' },
];

export const SFX_COMMANDS_HELP = [
  "(buzina)", "(explosao)", "(aplausos)", "(risada)", 
  "(caixa)", "(laser)", "(motor)", "(sino)", "(brinde)", "(coin)"
];

export const DEFAULT_TEXT = "Olá! Eu sou a VoxGen AI. Como posso ajudar com sua criação de áudio hoje?";

export const CALIBRATION_TEXT = "Ao registrar minha voz neste estúdio de inteligência artificial, declaro que estou ciente de que as amostras coletadas serão utilizadas exclusivamente para o treinamento de modelos de síntese de voz personalizados.";

export const VIGNETTE_TEXT = "Você está ouvindo a programação inteligente alimentada pela VoxGen AI. Para anúncios e parcerias, entre em contato pelo WhatsApp: 1 1, 9 7 3 7 6, 8 3 7 3.";
