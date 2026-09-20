"use client";

import { useActionState, useState } from "react";
import { ReportContent } from "@/components/ReportContent";
import { articleKindLabels } from "@/lib/articles";
import type { ReportFormState } from "@/app/admin/actions";

export function AdminArticleForm({
  action,
}: {
  action: (
    prevState: ReportFormState,
    formData: FormData
  ) => Promise<ReportFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  return (
    <form action={formAction} className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        {state.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Slug <span className="font-normal text-zinc-400">(re-using one updates it)</span>
            <input
              type="text"
              name="slug"
              required
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Kind
            <select
              name="kind"
              defaultValue=""
              required
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select
              </option>
              {Object.entries(articleKindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Title
          <input
            type="text"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Summary
          <textarea
            name="summary"
            required
            rows={2}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Tickers <span className="font-normal text-zinc-400">(comma-separated, optional)</span>
          <input
            type="text"
            name="tickers"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Content (Markdown)
          <textarea
            name="contentMd"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
            rows={22}
            className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving..." : "Publish article"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-zinc-500">Live preview</div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="mb-4 text-2xl font-semibold leading-tight">
            {title || "Article title"}
          </h1>
          <ReportContent markdown={content || "*Start writing to see a preview here...*"} />
        </div>
      </div>
    </form>
  );
}
