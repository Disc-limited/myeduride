// @ts-nocheck
'use client';

let leafletPromise: Promise<any> | null = null;

/**
 * Dynamically loads Leaflet script and styles in the browser environment.
 * Prevents Next.js SSR "window is not defined" issues and avoids node_modules bloat.
 */
export function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Leaflet can only be loaded in browser environments.'));
  }

  if ((window as any).L) {
    return Promise.resolve((window as any).L);
  }

  if (leafletPromise) {
    return leafletPromise;
  }

  leafletPromise = new Promise((resolve, reject) => {
    // 1. Inject Leaflet CSS
    const cssId = 'leaflet-css-cdn';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    // 2. Inject Leaflet JS
    const scriptId = 'leaflet-js-cdn';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.crossOrigin = '';
      script.async = true;

      script.onload = () => {
        const L = (window as any).L;
        if (L) {
          // Fix default marker icon asset paths
          try {
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
              iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
              iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
              shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });
          } catch (e) {
            console.warn('Leaflet icon path fix notice:', e);
          }
          resolve(L);
        } else {
          reject(new Error('Leaflet loaded but window.L is undefined'));
        }
      };

      script.onerror = () => {
        reject(new Error('Failed to load Leaflet script from CDN'));
      };

      document.head.appendChild(script);
    } else {
      // Script already added, wait for window.L
      const interval = setInterval(() => {
        if ((window as any).L) {
          clearInterval(interval);
          resolve((window as any).L);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(interval);
        if ((window as any).L) resolve((window as any).L);
        else reject(new Error('Timed out waiting for Leaflet to load'));
      }, 5000);
    }
  });

  return leafletPromise;
}
