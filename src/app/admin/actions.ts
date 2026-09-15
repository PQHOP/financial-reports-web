"use server";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
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

const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;

// Plain !== leaks password length/prefix via response-time differences.
// Rate limiting already caps this at 5 guesses/15min, but the fix is free.
function passwordMatches(input: string, expected: string): boolean {
  const inputBuf = Buffer.from(input);
  const expectedBuf = Buffer.from(expected);
  if (inputBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(inputBuf, expectedBuf);
}

async function getClientIdentifier(): Promise<string> {
  const store = await headers();
  const forwardedFor = store.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const identifier = await getClientIdentifier();
  const windowStart = new Date(Date.now() - LOGIN_RATE_LIMIT_WINDOW_MS);

  // Opportunistic cleanup so this table doesn't grow unbounded.
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: windowStart } },
  });

  const recentAttempts = await prisma.loginAttempt.count({
    where: { identifier, createdAt: { gte: windowStart } },
  });

  if (recentAttempts >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    redirect("/admin/login?error=ratelimited");
  }

  if (!process.env.ADMIN_PASSWORD || !passwordMatches(password, process.env.ADMIN_PASSWORD)) {
    await prisma.loginAttempt.create({ data: { identifier } });
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
