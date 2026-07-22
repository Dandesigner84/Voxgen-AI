
export enum VoiceName {
  Kore = 'Kore',
  Puck = 'Puck',
  Charon = 'Charon',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr',
}

export enum ToneType {
  Neutral = 'Neutral',
  Excited = 'Excited',
  Professional = 'Professional',
  Soothing = 'Soothing',
  Dramatic = 'Dramatic',
  Sales = 'Sales (Black Friday)',
  Preaching = 'Preaching',
  CarSound = 'Car Sound (Carro de Som)',
  RadioCommercial = 'Radio Commercial',
  PromotionalEnergetic = 'Promotional Energetic',
  StorefrontAnnouncer = 'Storefront Announcer (Porta de Loja)'
}

export enum AppMode {
  Home = 'Home',
  Narration = 'Narration',
  Music = 'Music',
  Avatar = 'Avatar',
  SFX = 'SFX',
  SmartPlayer = 'SmartPlayer',
  Manga = 'Manga',
  Admin = 'Admin',
  VoiceCloning = 'VoiceCloning',
  PDFReader = 'PDFReader',
}

export interface AudioItem {
  id: string;
  text: string;
  voice: string;
  audioData: AudioBuffer;
  createdAt: Date;
  duration: number;
}

export interface AvatarItem {
  id: string;
  videoUrl: string;
  narrationId: string;
  createdAt: Date;
}

export interface ProcessingState {
  isEnhancing: boolean;
  isGeneratingAudio: boolean;
  error: string | null;
}

export interface MusicItem {
  id: string;
  title: string;
  lyrics: string;
  style: string;
  coverColor: string;
  audioData: AudioBuffer;
  createdAt: Date;
  duration: number;
  isRemix?: boolean;
}

export interface SFXItem {
  id: string;
  name: string;
  type: string;
  audioData: AudioBuffer;
  createdAt: Date;
}

export interface PremiumCode {
  code: string;
  days: number;
  isRedeemed: boolean;
  createdAt: number;
  redeemedAt?: number;
}

export interface UserStatus {
  plan: 'free' | 'premium';
  expiryDate: number | null;
  narrationsToday: number;
}

export type VoiceCategory = 'private' | 'official_candidate' | 'official_approved' | 'official_rejected';

export interface VoiceAnalysis {
  clarityScore: number;
  dictionScore: number;
  rhythmScore: number;
  feedback: string;
}

export interface CustomVoice {
  id: string;
  userId: string;
  name: string;
  category: VoiceCategory;
  audioSampleBase64: string;
  aiAnalysis?: VoiceAnalysis;
  createdAt: number;
}

export interface ComicPage {
  id: string;
  imageUrl: string;
  text: string;
  dialogue?: string;
  panelLayout: string;
  audioData?: AudioBuffer;
  panelNumber: number;
}

export type ComicStyle = 'Manga' | 'American Comic' | 'Pixar 3D' | 'Anime' | 'Sketch';

export type UserRole = 'user' | 'admin' | 'corporate-admin' | 'corporate-user';

export interface UserSession {
  role: UserRole;
  email: string;
  companyName?: string;
}
