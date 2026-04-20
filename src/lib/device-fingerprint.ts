// Lightweight, non-PII device fingerprint. Stable across sessions on the same browser.
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "ssr";
  const KEY = "lov_device_fp";
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;

  const parts = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    `${screen.colorDepth}`,
    new Date().getTimezoneOffset().toString(),
    (navigator as any).hardwareConcurrency?.toString() ?? "?",
    (navigator as any).platform ?? "?",
  ].join("|");

  const fp = fnv1a(parts);
  try { localStorage.setItem(KEY, fp); } catch (_e) { /* ignore */ }
  return fp;
}