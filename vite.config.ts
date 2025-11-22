
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Prioritize the key configured in Vercel (based on your screenshot) or .env
  const apiKey = env.API_KEY || env.VITE_API_KEY || env.VITE_GOOGLE_API_KEY || env.GOOGLE_API_KEY || '';

  return {
    plugins: [react()],
    define: {
      // This ensures process.env.API_KEY is replaced with the actual string value during build/serve
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
  };
});