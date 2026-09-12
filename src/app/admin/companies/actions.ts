"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export type CompanyFormState = { error?: string };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readCompanyFields(formData: FormData) {
  const industryNames = String(formData.get("industries") ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  return {
    slug: String(formData.get("slug") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    ticker: String(formData.get("ticker") ?? "").trim() || null,
    country: String(formData.get("country") ?? "").trim(),
    exchange: String(formData.get("exchange") ?? "").trim() || null,
    industryNames,
  };
}

function validateCompanyFields(
  fields: ReturnType<typeof readCompanyFields>
): string | null {
  if (!fields.slug) return "Please enter a URL slug.";
  if (!/^[a-z0-9-]+$/.test(fields.slug)) {
    return "Slug can only contain lowercase letters, numbers, and hyphens.";
  }
  if (!fields.name) return "Please enter a company name.";
  if (!fields.country) return "Please enter a country.";
  if (fields.industryNames.length === 0) {
    return "Please enter at least one industry.";
  }
  return null;
}

export async function createCompanyAction(
  _prevState: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  await requireAdmin();

  const fields = readCompanyFields(formData);
  const validationError = validateCompanyFields(fields);
  if (validationError) return { error: validationError };

  try {
    await prisma.company.create({
      data: {
        slug: fields.slug,
        name: fields.name,
        ticker: fields.ticker,
        country: fields.country,
        exchange: fields.exchange,
        industries: {
          connectOrCreate: fields.industryNames.map((name) => ({
            where: { slug: slugify(name) },
            create: { slug: slugify(name), name },
          })),
        },
      },
    });
  } catch {
    return { error: "A company with this slug already exists." };
  }

  redirect("/admin/companies");
}

export async function updateCompanyAction(
  _prevState: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing company id." };

  const fields = readCompanyFields(formData);
  const validationError = validateCompanyFields(fields);
  if (validationError) return { error: validationError };

  try {
    await prisma.company.update({
      where: { id },
      data: {
        slug: fields.slug,
        name: fields.name,
        ticker: fields.ticker,
        country: fields.country,
        exchange: fields.exchange,
        industries: {
          set: [],
          connectOrCreate: fields.industryNames.map((name) => ({
            where: { slug: slugify(name) },
            create: { slug: slugify(name), name },
          })),
        },
      },
    });
  } catch {
    return { error: "A company with this slug already exists." };
  }

  redirect("/admin/companies");
}

export async function deleteCompanyAction(id: string): Promise<void> {
  await requireAdmin();

  const reportCount = await prisma.report.count({ where: { companyId: id } });
  if (reportCount > 0) {
    redirect(
      `/admin/companies?error=${encodeURIComponent(
        "Cannot delete a company that still has reports. Delete its reports first."
      )}`
    );
  }

  await prisma.company.delete({ where: { id } });
  redirect("/admin/companies");
}
