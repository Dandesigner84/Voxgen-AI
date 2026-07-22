import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

console.log('[App] Inicializando aplicação React...');

const container = document.getElementById('root');

if (!container) {
  console.error('[App] Erro fatal: Elemento #root não encontrado no DOM.');
} else {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log('[App] Renderização iniciada com sucesso.');
  } catch (error) {
    console.error('[App] Falha ao montar a aplicação:', error);
  }
}
