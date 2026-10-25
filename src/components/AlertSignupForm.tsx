"use client";

import { useState, type FormEvent } from "react";

type Status = { kind: "idle" | "sending" } | { kind: "ok" | "error"; message: string };

export function AlertSignupForm({ ticker }: { ticker: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          ticker: data.get("ticker"),
          website: data.get("website"),
        }),
      });
      const json = (await res.json().catch(() => null)) as { message?: string } | null;
      const message = json?.message ?? "Something went wrong. Please try again.";
      setStatus(res.ok ? { kind: "ok", message } : { kind: "error", message });
    } catch {
      setStatus({ kind: "error", message: "Network error. Please try again." });
    }
  }

  if (status.kind === "ok") {
    return (
      <p role="status" className="mt-3 text-green-800">
        {status.message}
      </p>
    );
  }

  return (
    <form
      method="post"
      action="/api/alerts"
      onSubmit={onSubmit}
      className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
    >
      <input type="hidden" name="ticker" value={ticker} />
      {/* Honeypot: hidden from people, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="sr-only" htmlFor={`alert-email-${ticker}`}>
        Email address
      </label>
      <input
        id={`alert-email-${ticker}`}
        type="email"
        name="email"
        required
        maxLength={200}
        autoComplete="email"
        placeholder="you@example.com"
        className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={status.kind === "sending"}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
      >
        {status.kind === "sending" ? "Sending…" : "Notify me"}
      </button>
      {status.kind === "error" && (
        <p role="alert" className="text-red-700 sm:basis-full">
          {status.message}
        </p>
      )}
    </form>
  );
}
