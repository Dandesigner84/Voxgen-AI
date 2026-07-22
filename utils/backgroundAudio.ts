/**
 * VoxGen Background Audio & MediaSession Manager
 * Restaura e otimiza a reprodução em segundo plano para Smartphones (iOS e Android).
 */

const STORAGE_KEY = 'voxgen_background_playback_v1';

// Áudio silencioso em Base64 (1 segundo de silêncio em formato WAV)
const SILENT_WAV_BASE64 = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQ0AAAAA';

let silentAudioEl: HTMLAudioElement | null = null;
let wakeLock: any = null;
let activeAudioContexts: Set<AudioContext> = new Set();
let isKeepAliveActive = false;

/**
 * Obtém se o modo Segundo Plano está ativado
 */
export function isBackgroundPlaybackEnabled(): boolean {
  const saved = localStorage.getItem(STORAGE_KEY);
  // Padrão: ativado (true)
  return saved === null ? true : saved === 'true';
}

/**
 * Define a preferência do modo Segundo Plano
 */
export function setBackgroundPlaybackEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
  if (enabled) {
    startKeepAlive();
  } else {
    stopKeepAlive();
  }
  // Notifica ouvintes globais
  window.dispatchEvent(new CustomEvent('voxgen-background-setting-changed', { detail: { enabled } }));
}

/**
 * Registra um AudioContext para ser mantido ativo em segundo plano
 */
export function registerAudioContext(ctx: AudioContext): void {
  if (ctx) {
    activeAudioContexts.add(ctx);
    if (ctx.state === 'suspended' && isBackgroundPlaybackEnabled()) {
      ctx.resume().catch(() => {});
    }
  }
}

/**
 * Solicita trava de tela (WakeLock) se suportado pelo navegador
 */
export async function requestWakeLock(): Promise<void> {
  if ('wakeLock' in navigator && !wakeLock && isBackgroundPlaybackEnabled()) {
    try {
      wakeLock = await (navigator as any).wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } catch (err) {
      console.warn('[VoxGen Background] WakeLock não pôde ser ativado:', err);
    }
  }
}

/**
 * Libera a trava de tela
 */
export function releaseWakeLock(): void {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

/**
 * Inicia a reprodução do áudio silencioso mantenedor (keep-alive)
 */
export function startKeepAlive(): void {
  if (!isBackgroundPlaybackEnabled()) return;

  if (!silentAudioEl) {
    silentAudioEl = new Audio(SILENT_WAV_BASE64);
    silentAudioEl.loop = true;
    silentAudioEl.volume = 0.01; // Quase mudo mas ativo para o SO reconhecer sessão de áudio
    silentAudioEl.setAttribute('playsinline', 'true');
    silentAudioEl.setAttribute('webkit-playsinline', 'true');
  }

  if (silentAudioEl.paused) {
    silentAudioEl.play().then(() => {
      isKeepAliveActive = true;
      console.log('[VoxGen Background] Sessão de áudio em segundo plano ativa com sucesso.');
    }).catch(err => {
      console.warn('[VoxGen Background] Aguardando interação do usuário para áudio em segundo plano:', err);
    });
  }

  requestWakeLock();
}

/**
 * Para o áudio silencioso mantenedor
 */
export function stopKeepAlive(): void {
  if (silentAudioEl && !silentAudioEl.paused) {
    silentAudioEl.pause();
  }
  isKeepAliveActive = false;
  releaseWakeLock();
}

/**
 * Atualiza os metadados da central de controle de mídia do smartphone (Lockscreen e Central de Notificações)
 */
export function updateMediaSession(
  metadata: {
    title: string;
    artist?: string;
    album?: string;
    artworkUrl?: string;
  },
  handlers?: {
    onPlay?: () => void;
    onPause?: () => void;
    onNext?: () => void;
    onPrevious?: () => void;
  }
): void {
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: metadata.title || 'VoxGen AI Studio',
        artist: metadata.artist || 'VoxGen Rádio & Narração',
        album: metadata.album || 'Voz Inteligente com IA',
        artwork: [
          { src: metadata.artworkUrl || '/icon.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      if (handlers) {
        if (handlers.onPlay) {
          navigator.mediaSession.setActionHandler('play', () => {
            handlers.onPlay?.();
            navigator.mediaSession.playbackState = 'playing';
          });
        }
        if (handlers.onPause) {
          navigator.mediaSession.setActionHandler('pause', () => {
            handlers.onPause?.();
            navigator.mediaSession.playbackState = 'paused';
          });
        }
        if (handlers.onNext) {
          navigator.mediaSession.setActionHandler('nexttrack', () => {
            handlers.onNext?.();
          });
        }
        if (handlers.onPrevious) {
          navigator.mediaSession.setActionHandler('previoustrack', () => {
            handlers.onPrevious?.();
          });
        }
      }
    } catch (e) {
      console.warn('[VoxGen MediaSession] Erro ao configurar MediaSession:', e);
    }
  }
}

/**
 * Define o estado de reprodução na Media Session
 */
export function setMediaSessionPlaybackState(state: 'playing' | 'paused' | 'none'): void {
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = state;
    } catch (e) {}
  }
}

/**
 * Configura os ouvintes de mudança de visibilidade da página para garantir a retomada em segundo plano
 */
export function setupBackgroundAudioListeners(): () => void {
  const handleVisibilityChange = () => {
    const isHidden = document.hidden;
    const isEnabled = isBackgroundPlaybackEnabled();

    console.log(`[VoxGen Background] Mudança de visibilidade - Oculto: ${isHidden}, Segundo Plano Ativo: ${isEnabled}`);

    if (isEnabled) {
      // Sempre que a página vai para segundo plano ou retorna, garante que os AudioContexts estejam rodando
      activeAudioContexts.forEach(ctx => {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      });

      // Se o usuário ocultou a tela, reforça a sessão keep-alive
      if (isHidden) {
        if (silentAudioEl && silentAudioEl.paused) {
          silentAudioEl.play().catch(() => {});
        }
        requestWakeLock();
      }
    }
  };

  const handlePageShow = () => {
    if (isBackgroundPlaybackEnabled()) {
      activeAudioContexts.forEach(ctx => {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      });
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pageshow', handlePageShow);
  window.addEventListener('pagehide', handleVisibilityChange);

  // Inicialização no primeiro clique ou toque
  const handleUserInteraction = () => {
    if (isBackgroundPlaybackEnabled() && (!silentAudioEl || silentAudioEl.paused)) {
      startKeepAlive();
    }
    window.removeEventListener('click', handleUserInteraction);
    window.removeEventListener('touchstart', handleUserInteraction);
  };

  window.addEventListener('click', handleUserInteraction, { once: true });
  window.addEventListener('touchstart', handleUserInteraction, { once: true });

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pageshow', handlePageShow);
    window.removeEventListener('pagehide', handleVisibilityChange);
  };
}
