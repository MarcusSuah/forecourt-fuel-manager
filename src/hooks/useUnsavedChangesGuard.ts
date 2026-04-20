import { useEffect } from "react";

/**
 * Guards against in-app navigation when there are unsaved changes.
 * Intercepts clicks on <a> tags and history.pushState/replaceState/back/forward
 * by patching them while the guard is active. Shows a native confirm dialog.
 */
export function useUnsavedChangesGuard(when: boolean, message = "You have unsaved changes. Are you sure you want to leave this page?") {
  useEffect(() => {
    if (!when) return;

    // 1) Browser refresh / close
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    // 2) Intercept all <a> link clicks within the app
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = (e.target as HTMLElement | null)?.closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || target.target === "_blank" || target.hasAttribute("download")) return;
      // Only intercept same-origin links
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
      } catch {
        return;
      }
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", onClick, true);

    // 3) Intercept programmatic history navigations (react-router uses these)
    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    window.history.pushState = function (...args) {
      const targetUrl = args[2]?.toString() ?? "";
      if (targetUrl && targetUrl !== window.location.pathname + window.location.search) {
        if (!window.confirm(message)) return;
      }
      return origPush.apply(this, args as any);
    };
    window.history.replaceState = function (...args) {
      return origReplace.apply(this, args as any);
    };

    // 4) Intercept back/forward buttons
    const onPopState = (e: PopStateEvent) => {
      if (!window.confirm(message)) {
        // Push current path back to undo the navigation
        window.history.pushState(null, "", window.location.pathname + window.location.search);
      }
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
    };
  }, [when, message]);
}