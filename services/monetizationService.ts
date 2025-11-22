
import { PremiumCode, UserStatus } from "../types";

const STORAGE_KEYS = {
  USER_STATUS: 'voxgen_user_status_v1',
  CODES: 'voxgen_codes_db_v1',
  USAGE: 'voxgen_daily_usage_v1'
};

// Configurações do Plano Free
const FREE_LIMITS = {
  NARRATIONS_PER_DAY: 3,
  MAX_INTERVAL_SMART_PLAYER: 60, // segundos
};

// --- Admin Logic ---

export const generateCode = (days: number): string => {
  const code = 'VOX-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const newCode: PremiumCode = {
    code,
    days,
    isRedeemed: false,
    createdAt: Date.now()
  };
  
  const codes = getStoredCodes();
  codes.push(newCode);
  localStorage.setItem(STORAGE_KEYS.CODES, JSON.stringify(codes));
  return code;
};

export const getStoredCodes = (): PremiumCode[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CODES);
  return data ? JSON.parse(data) : [];
};

export const deleteCode = (codeStr: string) => {
  const codes = getStoredCodes().filter(c => c.code !== codeStr);
  localStorage.setItem(STORAGE_KEYS.CODES, JSON.stringify(codes));
};

// --- User Logic ---

export const getUserStatus = (): UserStatus => {
  const todayKey = new Date().toDateString();
  const usageData = JSON.parse(localStorage.getItem(STORAGE_KEYS.USAGE) || '{}');
  const narrationsToday = usageData[todayKey] || 0;

  const statusData = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_STATUS) || '{}');
  let plan: 'free' | 'premium' = 'free';
  
  if (statusData.expiryDate && statusData.expiryDate > Date.now()) {
    plan = 'premium';
  }

  return {
    plan,
    expiryDate: statusData.expiryDate || null,
    narrationsToday
  };
};

export const redeemCode = (codeStr: string): { success: boolean; message: string; days?: number } => {
  const codes = getStoredCodes();
  const codeIndex = codes.findIndex(c => c.code === codeStr && !c.isRedeemed);

  if (codeIndex === -1) {
    return { success: false, message: "Código inválido ou já utilizado." };
  }

  const code = codes[codeIndex];
  
  // Atualiza o código para resgatado
  codes[codeIndex].isRedeemed = true;
  codes[codeIndex].redeemedAt = Date.now();
  localStorage.setItem(STORAGE_KEYS.CODES, JSON.stringify(codes));

  // Atualiza o status do usuário
  const currentStatus = getUserStatus();
  const currentExpiry = currentStatus.expiryDate && currentStatus.expiryDate > Date.now() 
    ? currentStatus.expiryDate 
    : Date.now();
  
  const newExpiry = currentExpiry + (code.days * 24 * 60 * 60 * 1000);
  
  localStorage.setItem(STORAGE_KEYS.USER_STATUS, JSON.stringify({
    expiryDate: newExpiry
  }));

  return { success: true, message: `Sucesso! ${code.days} dias de Premium adicionados.`, days: code.days };
};

export const incrementUsage = () => {
  const todayKey = new Date().toDateString();
  const usageData = JSON.parse(localStorage.getItem(STORAGE_KEYS.USAGE) || '{}');
  usageData[todayKey] = (usageData[todayKey] || 0) + 1;
  localStorage.setItem(STORAGE_KEYS.USAGE, JSON.stringify(usageData));
};

export const canGenerateNarration = (): { allowed: boolean; message?: string } => {
  const status = getUserStatus();
  
  if (status.plan === 'premium') {
    return { allowed: true };
  }

  if (status.narrationsToday >= FREE_LIMITS.NARRATIONS_PER_DAY) {
    return { 
      allowed: false, 
      message: `Limite diário do plano Free atingido (${FREE_LIMITS.NARRATIONS_PER_DAY}/${FREE_LIMITS.NARRATIONS_PER_DAY}). Insira um Código Premiado para continuar.` 
    };
  }

  return { allowed: true };
};

export const isSmartPlayerUnlocked = (): boolean => {
  const status = getUserStatus();
  return status.plan === 'premium';
};

export const getFormatExpiryDate = (): string => {
    const status = getUserStatus();
    if (!status.expiryDate) return '';
    return new Date(status.expiryDate).toLocaleDateString('pt-BR');
};
