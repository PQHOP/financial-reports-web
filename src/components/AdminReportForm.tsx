"use client";

import { useActionState, useState } from "react";
import { ReportContent } from "@/components/ReportContent";
import { periodLabels } from "@/lib/period";
import type { ReportFormState } from "@/app/admin/actions";

type Company = { id: string; name: string; ticker: string | null };

type InitialReport = {
  id: string;
  companyId: string;
  year: number;
  period: string;
  title: string;
  summary: string;
  contentMd: string;
  coverImageUrl: string | null;
  sourceUrl: string | null;
  metrics: string;
};

export function AdminReportForm({
  companies,
  action,
  initialReport,
}: {
  companies: Company[];
  action: (
    prevState: ReportFormState,
    formData: FormData
  ) => Promise<ReportFormState>;
  initialReport?: InitialReport;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [title, setTitle] = useState(initialReport?.title ?? "");
  const [content, setContent] = useState(initialReport?.contentMd ?? "");

  return (
    <form action={formAction} className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {initialReport && (
        <input type="hidden" name="id" value={initialReport.id} />
      )}

      <div className="flex flex-col gap-4">
        {state.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium">
          Company
          <select
            name="companyId"
            defaultValue={initialReport?.companyId ?? ""}
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Select a company
            </option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
                {company.ticker ? ` (${company.ticker})` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Year
            <input
              type="number"
              name="year"
              defaultValue={initialReport?.year}
              required
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Period
            <select
              name="period"
              defaultValue={initialReport?.period ?? ""}
              required
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
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
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Summary <span className="font-normal text-zinc-400">(shown in lists and search)</span>
          <textarea
            name="summary"
            defaultValue={initialReport?.summary}
            required
            rows={2}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Cover image URL <span className="font-normal text-zinc-400">(optional)</span>
          <input
            type="url"
            name="coverImageUrl"
            defaultValue={initialReport?.coverImageUrl ?? ""}
            placeholder="https://..."
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Source filing URL{" "}
          <span className="font-normal text-zinc-400">
            (SEC EDGAR document or IR page; shown on the report)
          </span>
          <input
            type="url"
            name="sourceUrl"
            defaultValue={initialReport?.sourceUrl ?? ""}
            placeholder="https://www.sec.gov/Archives/edgar/data/..."
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Metrics JSON{" "}
          <span className="font-normal text-zinc-400">
            (optional; money in millions, percentages as plain numbers)
          </span>
          <textarea
            name="metrics"
            defaultValue={initialReport?.metrics ?? ""}
            rows={3}
            placeholder='{"revenue": 94930, "revenueYoyPct": 6.0, "netIncome": 21448, "epsDiluted": 1.4, "operatingMarginPct": 30.2}'
            className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs"
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

        <div className="rounded-md bg-zinc-100 px-3 py-2 text-xs leading-relaxed text-zinc-500">
          Use <code className="font-mono">## Heading</code> for section
          titles, a blank line between paragraphs,{" "}
          <code className="font-mono">{"![caption](image-url)"}</code> to
          place an image inline, GitHub-style tables for figures, and{" "}
          <code className="font-mono">{"> key takeaway"}</code> for a
          highlighted callout.
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving..." : initialReport ? "Save changes" : "Publish report"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-zinc-500">Live preview</div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="mb-4 text-2xl font-semibold leading-tight">
            {title || "Report title"}
          </h1>
          <ReportContent
            markdown={content || "*Start writing to see a preview here...*"}
          />
        </div>
      </div>
    </form>
  );
}
