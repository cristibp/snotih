/**
 * Utilitare pentru gestionarea modului Kiosk / Full Screen pe Web și dispozitive tabletă (ex. Allview, Firefox/Chrome)
 */

export function isWebFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as any;
  return Boolean(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

export function requestWebFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  const docEl = document.documentElement as any;

  if (docEl.requestFullscreen) {
    return docEl.requestFullscreen().catch(() => {});
  }
  if (docEl.webkitRequestFullscreen) {
    try {
      docEl.webkitRequestFullscreen();
    } catch (e) {}
    return Promise.resolve();
  }
  if (docEl.mozRequestFullScreen) {
    try {
      docEl.mozRequestFullScreen();
    } catch (e) {}
    return Promise.resolve();
  }
  if (docEl.msRequestFullscreen) {
    try {
      docEl.msRequestFullscreen();
    } catch (e) {}
    return Promise.resolve();
  }
  return Promise.resolve();
}

export function exitWebFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  const doc = document as any;

  if (isWebFullscreenActive()) {
    if (doc.exitFullscreen) {
      return doc.exitFullscreen().catch(() => {});
    }
    if (doc.webkitExitFullscreen) {
      try {
        doc.webkitExitFullscreen();
      } catch (e) {}
      return Promise.resolve();
    }
    if (doc.mozCancelFullScreen) {
      try {
        doc.mozCancelFullScreen();
      } catch (e) {}
      return Promise.resolve();
    }
    if (doc.msExitFullscreen) {
      try {
        doc.msExitFullscreen();
      } catch (e) {}
      return Promise.resolve();
    }
  }
  return Promise.resolve();
}

export function toggleWebFullscreen(enable?: boolean): void {
  const shouldEnable = enable !== undefined ? enable : !isWebFullscreenActive();
  if (shouldEnable) {
    requestWebFullscreen();
  } else {
    exitWebFullscreen();
  }
}

export function addFullscreenChangeListener(callback: (isFullscreen: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => {};

  const handler = () => {
    callback(isWebFullscreenActive());
  };

  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  document.addEventListener('mozfullscreenchange', handler);
  document.addEventListener('MSFullscreenChange', handler);

  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
    document.removeEventListener('mozfullscreenchange', handler);
    document.removeEventListener('MSFullscreenChange', handler);
  };
}
