"use client";

import { useActionState } from "react";
import type { CompanyFormState } from "@/app/admin/companies/actions";

type InitialCompany = {
  id: string;
  slug: string;
  name: string;
  ticker: string | null;
  country: string;
  exchange: string | null;
  industries: string[];
};

export function AdminCompanyForm({
  action,
  allIndustryNames,
  initialCompany,
}: {
  action: (
    prevState: CompanyFormState,
    formData: FormData
  ) => Promise<CompanyFormState>;
  allIndustryNames: string[];
  initialCompany?: InitialCompany;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {initialCompany && (
        <input type="hidden" name="id" value={initialCompany.id} />
      )}

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium">
        Company name
        <input
          type="text"
          name="name"
          defaultValue={initialCompany?.name}
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Slug <span className="font-normal text-zinc-400">(used in the URL, e.g. apple-inc)</span>
        <input
          type="text"
          name="slug"
          defaultValue={initialCompany?.slug}
          pattern="[a-z0-9-]+"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Ticker <span className="font-normal text-zinc-400">(optional)</span>
          <input
            type="text"
            name="ticker"
            defaultValue={initialCompany?.ticker ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Country
          <input
            type="text"
            name="country"
            defaultValue={initialCompany?.country}
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Exchange <span className="font-normal text-zinc-400">(optional)</span>
        <input
          type="text"
          name="exchange"
          defaultValue={initialCompany?.exchange ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Industries{" "}
        <span className="font-normal text-zinc-400">
          (comma-separated; a company can belong to more than one)
        </span>
        <input
          type="text"
          name="industries"
          list="industry-suggestions"
          defaultValue={initialCompany?.industries.join(", ")}
          placeholder="Technology, Consumer Electronics"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <datalist id="industry-suggestions">
          {allIndustryNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <p className="text-xs text-zinc-500">
        Existing industries: {allIndustryNames.join(", ") || "none yet"}.
        Typing a new name creates that industry automatically.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving..." : initialCompany ? "Save changes" : "Create company"}
      </button>
    </form>
  );
}
