'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { InstallPromptModal } from './InstallPromptModal';
import { UpdateBanner } from './UpdateBanner';

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [swWaiting, setSwWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Register Service Worker
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');

        // Check if there is an updated service worker waiting
        if (registration.waiting) {
          setSwWaiting(registration.waiting);
        }

        // Listen for new service worker installation
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setSwWaiting(installingWorker);
            }
          });
        });
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    };

    registerSW();

    // Listen for service worker controllerchange (after update)
    let refreshing = false;
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Online / Offline Status Monitoring
    const handleOnline = () => {
      toast.success('Connection Restored', {
        description: 'You are back online. MyEduRide is syncing live updates.',
        id: 'network-status',
      });
    };

    const handleOffline = () => {
      toast.error('Connection Lost', {
        description: 'You are currently offline. Viewing cached app data.',
        id: 'network-status',
        duration: 6000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleApplyUpdate = () => {
    if (swWaiting) {
      swWaiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  return (
    <>
      {children}
      <InstallPromptModal />
      {swWaiting && <UpdateBanner onUpdate={handleApplyUpdate} />}
    </>
  );
}
