"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

// A form's submit button that disables itself and says so while the server
// action runs, so a slow action doesn't look like a dead click.
export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: ReactNode;
  pendingText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ""} disabled:cursor-wait disabled:opacity-60`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
