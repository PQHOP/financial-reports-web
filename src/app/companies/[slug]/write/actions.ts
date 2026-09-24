"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { ReportPeriod } from "@/generated/prisma/client";
import { COMMUNITY_AUTO_PUBLISH, COMMUNITY_LIMITS as L } from "@/lib/community";

export type CommunityFormState = {
  error?: string;
  // Set once saved; the form swaps to a confirmation message.
  submitted?: { reportId: string; published: boolean };
};

const PERIODS: ReportPeriod[] = ["Q1", "Q2", "Q3", "Q4", "H1", "ANNUAL"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

async function hashedClientIp(): Promise<string> {
  const store = await headers();
  const ip = store.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return crypto
    .createHash("sha256")
    .update(`${ip}:${process.env.ADMIN_SESSION_SECRET ?? ""}`)
    .digest("hex");
}

export async function submitCommunityReportAction(
  _prevState: CommunityFormState,
  formData: FormData
): Promise<CommunityFormState> {
  // Honeypot: real visitors never see or fill this field. Answer as if it
  // worked so bots don't learn to skip it.
  if (String(formData.get("website") ?? "").trim()) {
    return { submitted: { reportId: "", published: false } };
  }

  const companyId = String(formData.get("companyId") ?? "");
  const year = Number(formData.get("year"));
  const period = String(formData.get("period") ?? "") as ReportPeriod;
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const contentMd = String(formData.get("contentMd") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim() || null;
  const authorName = String(formData.get("authorName") ?? "").trim();
  const authorEmail = String(formData.get("authorEmail") ?? "")
    .trim()
    .toLowerCase();

  if (!authorName) return { error: "Please enter your name." };
  if (authorName.length > L.name) {
    return { error: `Name must be ${L.name} characters or fewer.` };
  }
  if (!EMAIL_RE.test(authorEmail) || authorEmail.length > L.email) {
    return { error: "Please enter a valid email address." };
  }
  if (!companyId) return { error: "Missing company." };
  if (
    !Number.isInteger(year) ||
    year < 1990 ||
    year > new Date().getUTCFullYear() + 1
  ) {
    return { error: "Please enter a valid fiscal year." };
  }
  if (!PERIODS.includes(period)) {
    return { error: "Please select a reporting period." };
  }
  if (!title || title.length > L.title) {
    return { error: `Title is required (max ${L.title} characters).` };
  }
  if (!summary || summary.length > L.summary) {
    return { error: `Summary is required (max ${L.summary} characters).` };
  }
  if (contentMd.length < L.contentMin) {
    return {
      error: `Please write at least ${L.contentMin} characters of analysis.`,
    };
  }
  if (contentMd.length > L.contentMax) {
    return {
      error: `The analysis is too long (max ${L.contentMax} characters).`,
    };
  }
  if (
    sourceUrl &&
    (sourceUrl.length > L.sourceUrl || !/^https?:\/\//i.test(sourceUrl))
  ) {
    return { error: "Source URL must start with http:// or https://." };
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) return { error: "Company not found." };

  const submitterHash = await hashedClientIp();
  const since = new Date(Date.now() - DAY_MS);
  const [byEmail, byIp] = await Promise.all([
    prisma.report.count({
      where: { origin: "COMMUNITY", authorEmail, publishedAt: { gte: since } },
    }),
    prisma.report.count({
      where: {
        origin: "COMMUNITY",
        submitterHash,
        publishedAt: { gte: since },
      },
    }),
  ]);
  if (byEmail >= L.perEmailPerDay || byIp >= L.perIpPerDay) {
    return {
      error: "You've submitted several reports today. Please try again tomorrow.",
    };
  }

  const status = COMMUNITY_AUTO_PUBLISH ? "PUBLISHED" : "PENDING";
  try {
    const report = await prisma.report.create({
      data: {
        companyId,
        year,
        period,
        title,
        summary,
        contentMd,
        sourceUrl,
        author: authorName,
        authorEmail,
        submitterHash,
        origin: "COMMUNITY",
        status,
      },
    });
    return {
      submitted: { reportId: report.id, published: status === "PUBLISHED" },
    };
  } catch {
    return {
      error:
        "You have already submitted a report for this company, year and period with this email.",
    };
  }
}
