
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente, aceitando qualquer prefixo
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Prioriza a chave configurada na Vercel ou .env local
  const apiKey = env.API_KEY || env.VITE_API_KEY || env.VITE_GOOGLE_API_KEY || env.GOOGLE_API_KEY || '';

  return {
    plugins: [react()],
    define: {
      // Injeta a chave no processo do navegador
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
  };
});
