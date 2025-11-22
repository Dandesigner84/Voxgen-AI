
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
  Preaching = 'Preaching'
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
  Auth = 'Auth' // Novo modo para Login/Registro
}

export interface AudioItem {
  id: string;
  text: string;
  voice: VoiceName;
  audioData: AudioBuffer;
  createdAt: Date;
  duration: number;
}

export interface MusicItem {
  id: string;
  title: string;
  style: string;
  lyrics: string;
  coverColor: string;
  audioData: AudioBuffer;
  createdAt: Date;
  duration: number;
  isRemix?: boolean;
  engine?: 'web-audio' | 'musicgen';
}

export interface SFXItem {
  id: string;
  name: string;
  type: string;
  audioData: AudioBuffer;
  createdAt: Date;
}

export interface AvatarProject {
  id: string;
  imageUrl: string;
  audioData: AudioBuffer;
  name: string;
}

export interface ProcessingState {
  isEnhancing: boolean;
  isGeneratingAudio: boolean;
  error: string | null;
}

// --- Manga / Gibi Types ---

export type ComicStyle = 'Manga' | 'American Comic' | 'Pixar 3D' | 'Anime' | 'Sketch';

export interface ComicPage {
  id: string;
  imageUrl: string;
  text: string;
  audioData?: AudioBuffer;
  panelNumber: number;
}

export interface ComicProject {
  id: string;
  title: string;
  style: ComicStyle;
  pages: ComicPage[];
  characterImage?: string;
}

// --- Monetization & Auth Types ---

export type UserPlan = 'free' | 'premium';
export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash?: string; // Senha criptografada
  avatarUrl?: string;
  role: UserRole;
  plan: UserPlan;
  provider: 'email' | 'google';
  createdAt: number;
  lastLogin: number;
  expiryDate?: number; // Se premium
  isBanned?: boolean;
}

export interface UserStatus {
  plan: UserPlan;
  expiryDate: number | null;
  narrationsToday: number;
}

export interface PremiumCode {
  code: string;
  days: number;
  isRedeemed: boolean;
  createdAt: number;
  redeemedAt?: number;
  redeemedByUserId?: string; // Rastreabilidade
}
