const STORAGE_KEY = 'veloov_device_uuid';
const FP_VERSION = 'v1';

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 100, 30);
    ctx.fillStyle = '#069';
    ctx.fillText(`Veloov-${FP_VERSION}`, 4, 17);
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText(`Veloov-${FP_VERSION}`, 6, 19);
    return canvas.toDataURL().slice(-64);
  } catch {
    return 'canvas-error';
  }
}

function getStoredUUID(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredUUID(uuid: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, uuid);
  } catch {
    // localStorage may be blocked
  }
}

export function getDeviceFingerprint(): string {
  const stored = getStoredUUID();
  if (stored && stored.startsWith('native-')) return stored;
  if (stored && !stored.startsWith('native-')) {
    const nativeId = (window as unknown as { VeloovNative?: { getDeviceId?: () => string } }).VeloovNative?.getDeviceId?.();
    if (nativeId) {
      setStoredUUID(nativeId);
      return nativeId;
    }
  }

  const canvas = getCanvasFingerprint();
  const screen = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'unknown';
  const lang = navigator.language ?? 'unknown';
  const ua = navigator.userAgent.slice(0, 128);
  const random = crypto.getRandomValues(new Uint8Array(8));
  const randomStr = Array.from(random).map((b) => b.toString(16).padStart(2, '0')).join('');

  const raw = `${FP_VERSION}|${canvas}|${screen}|${tz}|${lang}|${ua}|${randomStr}`;
  const uuid = `${FP_VERSION}-${btoa(raw).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}`;

  setStoredUUID(uuid);
  return uuid;
}
