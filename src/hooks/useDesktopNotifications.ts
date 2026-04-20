import { useCallback, useEffect, useState } from "react";

const KEY = "desktop-notifications-enabled";

export function useDesktopNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "denied";
    return Notification.permission;
  });
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(KEY) === "true";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(KEY, String(enabled));
    }
  }, [enabled]);

  const supported = typeof window !== "undefined" && "Notification" in window;

  const requestPermission = useCallback(async () => {
    if (!supported) return "denied" as NotificationPermission;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") setEnabled(true);
    return result;
  }, [supported]);

  const notify = useCallback(
    (title: string, options?: NotificationOptions & { onClick?: () => void }) => {
      if (!supported || !enabled || permission !== "granted") return;
      // Skip when tab is already focused — avoids double-noise with on-screen toasts
      if (typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus()) return;
      try {
        const n = new Notification(title, {
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: options?.tag,
          body: options?.body,
          requireInteraction: options?.requireInteraction,
        });
        if (options?.onClick) {
          n.onclick = () => {
            window.focus();
            options.onClick?.();
            n.close();
          };
        }
      } catch {
        // ignore
      }
    },
    [supported, enabled, permission]
  );

  return { supported, permission, enabled, setEnabled, requestPermission, notify };
}