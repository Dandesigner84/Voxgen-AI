
import { CustomVoice, VoiceCategory } from "../types";

const STORAGE_KEYS = {
  CUSTOM_VOICES: 'voxgen_custom_voices_v1'
};

// --- Voice Management ---

export const getCustomVoices = (): CustomVoice[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_VOICES);
  return data ? JSON.parse(data) : [];
};

export const getVoicesByUser = (userId: string): CustomVoice[] => {
  return getCustomVoices().filter(v => v.userId === userId);
};

export const getApprovedVoices = (): CustomVoice[] => {
  return getCustomVoices().filter(v => v.category === 'official_approved');
};

export const getPendingVoices = (): CustomVoice[] => {
  return getCustomVoices().filter(v => v.category === 'official_candidate');
};

export const getAllOfficialVoices = (): CustomVoice[] => {
  return getCustomVoices().filter(v => v.category.startsWith('official'));
};

export const saveCustomVoice = (voice: CustomVoice): void => {
  const voices = getCustomVoices();
  voices.push(voice);
  localStorage.setItem(STORAGE_KEYS.CUSTOM_VOICES, JSON.stringify(voices));
};

export const updateVoiceStatus = (voiceId: string, status: VoiceCategory, feedback?: string): void => {
  const voices = getCustomVoices();
  const index = voices.findIndex(v => v.id === voiceId);
  
  if (index !== -1) {
    voices[index].category = status;
    if (feedback && voices[index].aiAnalysis) {
        // Append admin feedback or replace
        voices[index].aiAnalysis!.feedback = feedback;
    }
    localStorage.setItem(STORAGE_KEYS.CUSTOM_VOICES, JSON.stringify(voices));
  }
};

export const deleteCustomVoice = (voiceId: string): void => {
  const voices = getCustomVoices().filter(v => v.id !== voiceId);
  localStorage.setItem(STORAGE_KEYS.CUSTOM_VOICES, JSON.stringify(voices));
};
