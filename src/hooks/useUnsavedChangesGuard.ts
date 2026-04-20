import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Guards against in-app navigation when there are unsaved changes.
 * Intercepts <a> link clicks, history.pushState, and back/forward navigation
 * and resolves them through a styled AlertDialog (rendered by the consumer).
 *
 * Usage:
 *   const { dialogProps } = useUnsavedChangesGuard(hasUnsaved);
 *   return (<>{children}<UnsavedChangesDialog {...dialogProps} /></>);
 */
export interface UnsavedChangesDialogProps {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function useUnsavedChangesGuard(
  when: boolean,
  message = "You have unsaved changes. Are you sure you want to leave this page?",
) {
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);
  const whenRef = useRef(when);
  whenRef.current = when;

  useEffect(() => {
    if (!when) return;

    // 1) Browser refresh / close — must stay native (browser controls this dialog)
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
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
        e.preventDefault();
        e.stopPropagation();
        setPendingAction(() => () => {
          window.location.assign(url.href);
        });
      } catch {
        return;
      }
    };
    document.addEventListener("click", onClick, true);

    // 3) Intercept programmatic history navigations (react-router uses these)
    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    window.history.pushState = function (...args) {
      const targetUrl = args[2]?.toString() ?? "";
      const sameUrl = !targetUrl || targetUrl === window.location.pathname + window.location.search;
      if (whenRef.current && !sameUrl) {
        setPendingAction(() => () => origPush.apply(window.history, args as any));
        return;
      }
      return origPush.apply(this, args as any);
    };
    window.history.replaceState = function (...args) {
      return origReplace.apply(this, args as any);
    };

    // 4) Intercept back/forward buttons
    let suppressNextPop = false;
    const onPopState = () => {
      if (suppressNextPop) {
        suppressNextPop = false;
        return;
      }
      // Capture the URL the user navigated TO so we can re-apply it on confirm.
      const targetUrl = window.location.pathname + window.location.search;
      // Undo the navigation immediately so they stay on the page until they decide.
      suppressNextPop = true;
      window.history.pushState(null, "", window.location.pathname + window.location.search);
      setPendingAction(() => () => {
        window.location.assign(targetUrl);
      });
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
    };
  }, [when]);

  const onConfirm = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);
    if (action) action();
  }, [pendingAction]);

  const onCancel = useCallback(() => setPendingAction(null), []);

  const dialogProps: UnsavedChangesDialogProps = {
    open: pendingAction !== null,
    message,
    onConfirm,
    onCancel,
  };

  return { dialogProps };
}