"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReportPeriod } from "@/generated/prisma/client";
import {
  ADMIN_COOKIE_MAX_AGE,
  ADMIN_COOKIE_NAME,
  createSessionToken,
  requireAdmin,
} from "@/lib/adminAuth";

export type ReportFormState = { error?: string };

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    redirect("/admin/login?error=1");
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });

  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE_NAME);
  redirect("/admin/login");
}

function readReportFields(formData: FormData) {
  return {
    companyId: String(formData.get("companyId") ?? ""),
    year: Number(formData.get("year")),
    period: String(formData.get("period") ?? "") as ReportPeriod,
    title: String(formData.get("title") ?? "").trim(),
    summary: String(formData.get("summary") ?? "").trim(),
    contentMd: String(formData.get("contentMd") ?? ""),
    coverImageUrl: String(formData.get("coverImageUrl") ?? "").trim() || null,
  };
}

function validateReportFields(
  fields: ReturnType<typeof readReportFields>
): string | null {
  if (!fields.companyId) return "Please select a company.";
  if (Number.isNaN(fields.year)) return "Please enter a valid year.";
  if (!fields.period) return "Please select a reporting period.";
  if (!fields.title) return "Please enter a title.";
  if (!fields.summary) return "Please enter a short summary.";
  if (!fields.contentMd.trim()) return "Please write the report content.";
  return null;
}

export async function createReportAction(
  _prevState: ReportFormState,
  formData: FormData
): Promise<ReportFormState> {
  await requireAdmin();

  const fields = readReportFields(formData);
  const validationError = validateReportFields(fields);
  if (validationError) return { error: validationError };

  let reportId: string;
  try {
    const report = await prisma.report.create({ data: fields });
    reportId = report.id;
  } catch {
    return {
      error: "A report for this company, year, and period already exists.",
    };
  }

  redirect(`/reports/${reportId}`);
}

export async function updateReportAction(
  _prevState: ReportFormState,
  formData: FormData
): Promise<ReportFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing report id." };

  const fields = readReportFields(formData);
  const validationError = validateReportFields(fields);
  if (validationError) return { error: validationError };

  try {
    await prisma.report.update({ where: { id }, data: fields });
  } catch {
    return {
      error: "A report for this company, year, and period already exists.",
    };
  }

  redirect(`/reports/${id}`);
}

export async function deleteReportAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.report.delete({ where: { id } });
  redirect("/admin");
}
