
import { User } from "../types";

const STORAGE_KEYS = {
  USERS: 'voxgen_users_db_v1',
  CURRENT_SESSION: 'voxgen_session_v1'
};

// --- Crypto Helpers (Simulate Backend Security) ---

async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- User Database Management ---

const getUsersDB = (): User[] => {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  return data ? JSON.parse(data) : [];
};

const saveUserDB = (users: User[]) => {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
};

// --- Public Methods ---

export const getCurrentUser = (): User | null => {
  const data = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
  return data ? JSON.parse(data) : null;
};

export const logout = () => {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
  // Opcional: limpar status de uso temporário
};

export const registerUser = async (name: string, email: string, password: string): Promise<{ success: boolean; message: string; user?: User }> => {
  const users = getUsersDB();
  
  if (users.find(u => u.email === email)) {
    return { success: false, message: "E-mail já cadastrado." };
  }

  const passwordHash = await hashPassword(password);
  
  const newUser: User = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash,
    role: email.includes('admin') ? 'admin' : 'user', // Backdoor simples para teste: email com 'admin' vira admin
    plan: 'free',
    provider: 'email',
    createdAt: Date.now(),
    lastLogin: Date.now(),
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`
  };

  users.push(newUser);
  saveUserDB(users);
  
  // Auto login
  localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(newUser));
  
  return { success: true, message: "Conta criada com sucesso!", user: newUser };
};

export const loginUser = async (email: string, password: string): Promise<{ success: boolean; message: string; user?: User }> => {
  const users = getUsersDB();
  const user = users.find(u => u.email === email);

  if (!user) {
    return { success: false, message: "Usuário não encontrado." };
  }

  if (user.isBanned) {
    return { success: false, message: "Esta conta foi suspensa pelo administrador." };
  }

  const inputHash = await hashPassword(password);
  
  if (user.passwordHash !== inputHash) {
    return { success: false, message: "Senha incorreta." };
  }

  // Update last login
  user.lastLogin = Date.now();
  const userIndex = users.findIndex(u => u.id === user.id);
  users[userIndex] = user;
  saveUserDB(users);

  localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(user));
  return { success: true, message: "Bem-vindo de volta!", user };
};

// Simulação de Login com Google (OAuth)
export const loginWithGoogle = async (): Promise<{ success: boolean; message: string; user?: User }> => {
  return new Promise((resolve) => {
    // Simula delay de rede/popup
    setTimeout(() => {
      const users = getUsersDB();
      // Mock de dados vindos do Google
      const mockGoogleUser = {
        email: "usuario.google@gmail.com",
        name: "Usuário Google",
        avatar: "https://lh3.googleusercontent.com/a/default-user=s96-c"
      };

      let user = users.find(u => u.email === mockGoogleUser.email);

      if (!user) {
        // Registra se não existe
        user = {
          id: crypto.randomUUID(),
          name: mockGoogleUser.name,
          email: mockGoogleUser.email,
          role: 'user',
          plan: 'free',
          provider: 'google',
          createdAt: Date.now(),
          lastLogin: Date.now(),
          avatarUrl: mockGoogleUser.avatar
        };
        users.push(user);
      } else {
        user.lastLogin = Date.now();
        const idx = users.findIndex(u => u.id === user!.id);
        users[idx] = user;
      }

      if (user.isBanned) {
        resolve({ success: false, message: "Conta suspensa." });
        return;
      }

      saveUserDB(users);
      localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(user));
      resolve({ success: true, message: "Login com Google realizado!", user });
    }, 1500);
  });
};

export const getAllUsers = (): User[] => {
  return getUsersDB();
};

export const toggleBanUser = (userId: string): User[] => {
  const users = getUsersDB();
  const user = users.find(u => u.id === userId);
  if (user && user.role !== 'admin') {
    user.isBanned = !user.isBanned;
    saveUserDB(users);
  }
  return users;
};