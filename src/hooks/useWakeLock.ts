import { useEffect, useRef } from 'react';

export function useWakeLock() {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    let active = true;

    const acquire = async () => {
      if (!('wakeLock' in navigator)) return;
      try {
        lockRef.current = await navigator.wakeLock.request('screen');
      } catch {
        // wake lock not available or denied
      }
    };

    acquire();

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && active) {
        acquire();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibility);
      if (lockRef.current) {
        lockRef.current.release().catch(() => {});
      }
    };
  }, []);
}
