"use server";

import crypto from "node:crypto";
import { after } from "next/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArticleKind, Prisma, ReportPeriod } from "@/generated/prisma/client";
import { articlePath } from "@/lib/articles";
import { parseMetricsInput } from "@/lib/metrics";
import { pingIndexNow } from "@/lib/indexnow";
import { SITE_URL } from "@/lib/site";
import { reportUrl } from "@/lib/reportPath";
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
    sourceUrl: String(formData.get("sourceUrl") ?? "").trim() || null,
    metricsRaw: String(formData.get("metrics") ?? ""),
  };
}

type ReportFields = ReturnType<typeof readReportFields>;

// Splits the raw form fields into the validated Prisma payload, or an error.
function buildReportData(
  fields: ReportFields
): { data: Prisma.ReportUncheckedCreateInput } | { error: string } {
  const validationError = validateReportFields(fields);
  if (validationError) return { error: validationError };

  const parsed = parseMetricsInput(fields.metricsRaw);
  if ("error" in parsed) return { error: parsed.error };

  return {
    data: {
      companyId: fields.companyId,
      year: fields.year,
      period: fields.period,
      title: fields.title,
      summary: fields.summary,
      contentMd: fields.contentMd,
      coverImageUrl: fields.coverImageUrl,
      sourceUrl: fields.sourceUrl,
      metrics: parsed.metrics ?? Prisma.DbNull,
    },
  };
}

function validateReportFields(fields: ReportFields): string | null {
  if (fields.sourceUrl && !/^https?:\/\//i.test(fields.sourceUrl)) {
    return "Source URL must start with http:// or https://.";
  }
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

  const built = buildReportData(readReportFields(formData));
  if ("error" in built) return { error: built.error };

  let reportId: string;
  let publicUrl: string;
  try {
    const report = await prisma.report.create({
      data: built.data,
      include: { company: { select: { slug: true } } },
    });
    reportId = report.id;
    publicUrl = reportUrl(report);
  } catch {
    return {
      error: "A report for this company, year, and period already exists.",
    };
  }

  after(() => pingIndexNow([publicUrl]));
  // /reports/<id> renders in place for the admin (scripts/admin-publish.ts
  // waits for it); visitors are sent on to the canonical URL.
  redirect(`/reports/${reportId}`);
}

export async function updateReportAction(
  _prevState: ReportFormState,
  formData: FormData
): Promise<ReportFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing report id." };

  const built = buildReportData(readReportFields(formData));
  if ("error" in built) return { error: built.error };

  let publicUrl: string;
  try {
    const report = await prisma.report.update({
      where: { id },
      data: built.data,
      include: { company: { select: { slug: true } } },
    });
    publicUrl = reportUrl(report);
  } catch {
    return {
      error: "A report for this company, year, and period already exists.",
    };
  }

  after(() => pingIndexNow([publicUrl]));
  redirect(`/reports/${id}`);
}

// Moves a community submission out of the review queue. Deliberately no
// IndexNow ping: community pages are noindex.
export async function approveReportAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.report.update({ where: { id }, data: { status: "PUBLISHED" } });
  redirect("/admin");
}

export async function deleteReportAction(id: string): Promise<void> {
  await requireAdmin();
  await prisma.report.delete({ where: { id } });
  redirect("/admin");
}

const ARTICLE_KINDS = ["GUIDE", "PREVIEW", "COMPARISON", "SCORECARD", "NEWS", "DIGEST"] as const;

// Upserts by slug so re-running the publish script updates the piece.
export async function saveArticleAction(
  _prevState: ReportFormState,
  formData: FormData
): Promise<ReportFormState> {
  await requireAdmin();

  const slug = String(formData.get("slug") ?? "").trim();
  const kind = String(formData.get("kind") ?? "") as ArticleKind;
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const contentMd = String(formData.get("contentMd") ?? "");
  const tickers = String(formData.get("tickers") ?? "")
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: "Slug must be lowercase letters, digits and hyphens." };
  }
  if (!ARTICLE_KINDS.includes(kind)) return { error: "Please select a kind." };
  if (!title) return { error: "Please enter a title." };
  if (!summary) return { error: "Please enter a short summary." };
  if (!contentMd.trim()) return { error: "Please write the article content." };

  await prisma.article.upsert({
    where: { slug },
    create: { slug, kind, title, summary, contentMd, tickers },
    update: { kind, title, summary, contentMd, tickers },
  });

  const path = articlePath(kind, slug);
  after(() => pingIndexNow([`${SITE_URL}${path}`]));
  redirect(path);
}
