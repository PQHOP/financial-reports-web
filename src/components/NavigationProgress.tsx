"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Thin bar across the top of the page from the moment a same-site link is
// clicked (or a GET form like search is submitted) until the new route has
// rendered. Every page here is rendered per request, so without it a click
// looks like nothing happened for half a second or more.
type Phase = "idle" | "start" | "loading" | "done";

const SAFETY_TIMEOUT_MS = 15_000;

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // Route committed: finish the bar (adjusting state during render, the
  // React-recommended way to respond to a changed value), then hide it.
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [renderedRoute, setRenderedRoute] = useState(routeKey);
  if (routeKey !== renderedRoute) {
    setRenderedRoute(routeKey);
    if (phase !== "idle") setPhase("done");
  }
  useEffect(() => {
    if (phase !== "done") return;
    const t = window.setTimeout(() => setPhase("idle"), 350);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    const start = () => {
      clearTimers();
      setPhase("start");
      // Next frame: let the zero-width state paint, then animate outward.
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase("loading")));
      timers.current.push(window.setTimeout(() => setPhase("idle"), SAFETY_TIMEOUT_MS));
    };

    const isSameDocument = (url: URL) =>
      url.pathname === window.location.pathname && url.search === window.location.search;

    // Capture phase: next/link calls preventDefault() on the click, so a
    // bubbling listener would see every navigation as already handled.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor || !anchor.href) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || isSameDocument(url)) return;
      start();
    };

    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      // Server-action forms (POST) show their own pending state.
      if ((form.getAttribute("method") ?? "get").toLowerCase() !== "get") return;
      if (typeof form.action !== "string") return;
      if (new URL(form.action, window.location.href).origin !== window.location.origin) return;
      start();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      clearTimers();
    };
  }, []);

  const width = { idle: "0%", start: "0%", loading: "85%", done: "100%" }[phase];
  const transition = {
    idle: "none",
    start: "none",
    loading: "width 8s cubic-bezier(0.1, 0.7, 0.2, 1)",
    done: "width 200ms ease-out, opacity 300ms ease 150ms",
  }[phase];

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
    >
      <div
        className="h-full bg-blue-600 shadow-[0_0_6px_rgba(37,99,235,0.6)]"
        style={{
          width,
          transition,
          opacity: phase === "idle" || phase === "done" ? 0 : 1,
        }}
      />
    </div>
  );
}
