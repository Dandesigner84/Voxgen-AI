
// Simulação de Backend Corporativo usando LocalStorage
// Em produção, isso seria uma API real (Firebase/Supabase)

export interface CorporateTrack {
  id: string;
  type: 'file' | 'youtube' | 'spotify';
  name: string;
  src: string;
  thumbnail?: string;
}

export interface CorporateAccount {
  email: string;
  password: string; // Em produção, usar hash/salt
  name: string;
  createdAt: number;
}

const STORAGE_KEYS = {
  CORP_PLAYLIST: 'voxgen_corp_playlist_v1',
  CORP_CONFIG: 'voxgen_corp_config_v1', // { vignetteEnabled: boolean }
  CORP_ACCOUNTS: 'voxgen_corp_accounts_v1'
};

// --- Playlist Management ---

export const saveCorporatePlaylist = (tracks: CorporateTrack[]) => {
  localStorage.setItem(STORAGE_KEYS.CORP_PLAYLIST, JSON.stringify(tracks));
};

export const getCorporatePlaylist = (): CorporateTrack[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CORP_PLAYLIST);
  return data ? JSON.parse(data) : [];
};

export const setCorporateVignetteStatus = (enabled: boolean) => {
  const config = JSON.parse(localStorage.getItem(STORAGE_KEYS.CORP_CONFIG) || '{}');
  config.vignetteEnabled = enabled;
  localStorage.setItem(STORAGE_KEYS.CORP_CONFIG, JSON.stringify(config));
};

export const isCorporateVignetteEnabled = (): boolean => {
  const config = JSON.parse(localStorage.getItem(STORAGE_KEYS.CORP_CONFIG) || '{}');
  // Por padrão, empresas pagantes podem desativar. Aqui simulamos que começa ativado se não definido.
  return config.vignetteEnabled !== false; 
};

// --- Team Management (Employees) ---

export const getCorporateAccounts = (): CorporateAccount[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CORP_ACCOUNTS);
  return data ? JSON.parse(data) : [];
};

export const addCorporateAccount = (account: Omit<CorporateAccount, 'createdAt'>): { success: boolean; message: string } => {
  const accounts = getCorporateAccounts();
  
  if (accounts.length >= 4) {
    return { success: false, message: "Limite de 4 contas atingido. Remova uma conta para adicionar outra." };
  }

  if (accounts.find(a => a.email === account.email)) {
    return { success: false, message: "Este email já está cadastrado na equipe." };
  }

  accounts.push({ ...account, createdAt: Date.now() });
  localStorage.setItem(STORAGE_KEYS.CORP_ACCOUNTS, JSON.stringify(accounts));
  return { success: true, message: "Conta criada com sucesso." };
};

export const removeCorporateAccount = (email: string) => {
  const accounts = getCorporateAccounts().filter(a => a.email !== email);
  localStorage.setItem(STORAGE_KEYS.CORP_ACCOUNTS, JSON.stringify(accounts));
};

export const verifyCorporateCredentials = (email: string, password: string): boolean => {
  const accounts = getCorporateAccounts();
  const user = accounts.find(a => a.email === email && a.password === password);
  return !!user;
};
