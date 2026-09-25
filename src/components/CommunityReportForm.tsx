"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ReportContent } from "@/components/ReportContent";
import { periodLabels } from "@/lib/period";
import { COMMUNITY_LIMITS as L } from "@/lib/community";
import {
  submitCommunityReportAction,
  type CommunityFormState,
} from "@/app/companies/[slug]/write/actions";
import { cleanCompanyName } from "@/lib/companyName";

const inputClass = "rounded-md border border-zinc-300 px-3 py-2 text-sm";

export function CommunityReportForm({
  company,
}: {
  company: { id: string; slug: string; name: string };
}) {
  const [state, formAction, pending] = useActionState<
    CommunityFormState,
    FormData
  >(submitCommunityReportAction, {});
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  if (state.submitted) {
    const { reportId, published } = state.submitted;
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-sm text-green-900">
        <p className="text-base font-medium">Thanks, your report was received.</p>
        <p className="mt-2">
          {published ? (
            <>
              It is now live in the community view.{" "}
              {reportId && (
                <Link href={`/reports/${reportId}`} className="underline">
                  View your report
                </Link>
              )}
            </>
          ) : (
            "We review every community report before it appears. Once approved, it will show up under the Community tab on this company's page."
          )}
        </p>
        <Link
          href={`/companies/${company.slug}`}
          className="mt-3 inline-block underline"
        >
          ← Back to {cleanCompanyName(company.name)}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <input type="hidden" name="companyId" value={company.id} />
      {/* Honeypot: hidden from people, tempting to bots. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="flex flex-col gap-4">
        {state.error && (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {state.error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Your name{" "}
            <span className="font-normal text-zinc-400">(shown publicly)</span>
            <input
              type="text"
              name="authorName"
              required
              maxLength={L.name}
              autoComplete="name"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Your email{" "}
            <span className="font-normal text-zinc-400">(never shown)</span>
            <input
              type="email"
              name="authorEmail"
              required
              maxLength={L.email}
              autoComplete="email"
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Fiscal year
            <input
              type="number"
              name="year"
              required
              min={1990}
              defaultValue={new Date().getFullYear()}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Period
            <select name="period" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Select
              </option>
              {Object.entries(periodLabels).map(([value, label]) => (
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
            required
            maxLength={L.title}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Summary{" "}
          <span className="font-normal text-zinc-400">
            (one or two sentences, shown in lists)
          </span>
          <textarea
            name="summary"
            required
            rows={2}
            maxLength={L.summary}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Source filing URL{" "}
          <span className="font-normal text-zinc-400">
            (recommended: the 10-Q / 10-K or earnings release you used)
          </span>
          <input
            type="url"
            name="sourceUrl"
            maxLength={L.sourceUrl}
            placeholder="https://www.sec.gov/Archives/edgar/data/..."
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Your analysis (Markdown)
          <textarea
            name="contentMd"
            required
            rows={18}
            minLength={L.contentMin}
            maxLength={L.contentMax}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className={`${inputClass} font-mono`}
          />
          <span className="text-xs font-normal text-zinc-400">
            {content.length} / {L.contentMax} characters (minimum{" "}
            {L.contentMin})
          </span>
        </label>

        <div className="rounded-md bg-zinc-100 px-3 py-2 text-xs leading-relaxed text-zinc-500">
          Use <code className="font-mono">## Heading</code> for sections,
          GitHub-style tables for figures and{" "}
          <code className="font-mono">{"> key takeaway"}</code> for a callout.
          Images are not supported. Base your figures on the company&apos;s own
          filings and cite them. Submissions are reviewed before publishing and
          shown as community-written, not as our analysis.
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Submitting..." : "Submit report"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-zinc-500">Live preview</div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="mb-4 text-2xl font-semibold leading-tight">
            {title || "Report title"}
          </h2>
          <ReportContent
            untrusted
            markdown={content || "*Start writing to see a preview here...*"}
          />
        </div>
      </div>
    </form>
  );
}
