import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { cleanCompanyName } from "@/lib/companyName";

// Opt-in "email me when you analyze <TICKER>'s next report" alerts, sent
// through Resend. With RESEND_API_KEY unset the whole feature is off: the
// signup form renders nothing, /api/alerts 404s and the cron is a no-op.
export function alertsEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

const FROM =
  process.env.ALERTS_FROM ??
  "Financial Report Insights <alerts@financialreportinsights.com>";

export const ALERT_LIMITS = {
  email: 200,
  // Per email and per IP, rolling 24h. Each counted request can send one
  // confirmation email, so these also cap how often the form can be used to
  // mail someone else's address.
  perEmailPerDay: 5,
  perIpPerDay: 20,
} as const;

// Subscription.ticker value meaning "every system report". Not "ALL", which
// is Allstate's ticker. TICKER_RE below rejects it, so only an admin can
// create such a row for now.
export const ALL_TICKERS = "*";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function newToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function hashClientIp(forwardedFor: string | null): string {
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  return crypto
    .createHash("sha256")
    .update(`${ip}:${process.env.ADMIN_SESSION_SECRET ?? ""}`)
    .digest("hex");
}

export const confirmUrl = (token: string) =>
  `${SITE_URL}/alerts/confirm?token=${encodeURIComponent(token)}`;
export const unsubscribeUrl = (token: string) =>
  `${SITE_URL}/alerts/unsubscribe?token=${encodeURIComponent(token)}`;

export type SendResult = { ok: true } | { ok: false; status: number; error: string };

export async function sendEmail({
  to,
  subject,
  html,
  text,
  headers,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, status: 0, error: "RESEND_API_KEY not set" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text, headers }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: (await res.text()).slice(0, 300) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, status: 0, error: String(err) };
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailShell(bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18181b;font-size:15px;line-height:1.5"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:24px">${bodyHtml}</div></body></html>`;
}

export type SubscribeResult =
  | { ok: true; message: string }
  | { ok: false; status: number; message: string };

// Same answer whether the address is new, pending or already confirmed, so the
// form can't be used to find out who follows what.
export const GENERIC_OK =
  "Check your inbox: we sent a link to confirm the alert. Nothing is sent until you click it.";

export async function requestSubscription(input: {
  email: string;
  ticker: string;
  submitterHash: string;
}): Promise<SubscribeResult> {
  const email = input.email.trim().toLowerCase();
  const requested = input.ticker.trim().toUpperCase();

  if (!EMAIL_RE.test(email) || email.length > ALERT_LIMITS.email) {
    return { ok: false, status: 400, message: "Please enter a valid email address." };
  }
  if (!TICKER_RE.test(requested)) {
    return { ok: false, status: 400, message: "Unknown company." };
  }
  const company = await prisma.company.findFirst({
    where: { ticker: { equals: requested, mode: "insensitive" } },
    select: { name: true, ticker: true },
  });
  if (!company?.ticker) return { ok: false, status: 400, message: "Unknown company." };
  // Stored exactly as the alerts cron derives it from Company.ticker.
  const ticker = company.ticker.toUpperCase();

  const since = new Date(Date.now() - DAY_MS);
  const [byEmail, byIp] = await Promise.all([
    prisma.subscription.count({ where: { email, createdAt: { gte: since } } }),
    prisma.subscription.count({
      where: { submitterHash: input.submitterHash, createdAt: { gte: since } },
    }),
  ]);
  if (byIp >= ALERT_LIMITS.perIpPerDay) {
    return {
      ok: false,
      status: 429,
      message: "Too many sign-ups from this connection today. Please try again tomorrow.",
    };
  }
  // Over the per-email limit: answer as usual but send nothing, so repeated
  // requests can't flood an inbox or reveal anything about the address.
  if (byEmail >= ALERT_LIMITS.perEmailPerDay) return { ok: true, message: GENERIC_OK };

  const existing = await prisma.subscription.findUnique({
    where: { email_ticker: { email, ticker } },
  });
  if (existing?.confirmedAt) return { ok: true, message: GENERIC_OK };

  let token: string;
  if (existing) {
    // A pending row already exists: re-send its link, and move createdAt
    // forward so the resend counts toward the rolling limits above.
    token = existing.token;
    await prisma.subscription.update({
      where: { id: existing.id },
      data: { createdAt: new Date(), submitterHash: input.submitterHash },
    });
  } else {
    token = newToken();
    try {
      await prisma.subscription.create({
        data: { email, ticker, token, submitterHash: input.submitterHash },
      });
    } catch {
      // Lost a race with a concurrent identical request; that one sends.
      return { ok: true, message: GENERIC_OK };
    }
  }

  const name = cleanCompanyName(company.name);
  const link = confirmUrl(token);
  const sent = await sendEmail({
    to: email,
    subject: `Confirm your ${ticker} report alert`,
    text: [
      `Someone (hopefully you) asked ${SITE_NAME} to email this address when we publish our next analysis of ${name} (${ticker}).`,
      "",
      `Confirm the alert: ${link}`,
      "",
      "If this wasn't you, ignore this email and nothing more will be sent.",
    ].join("\n"),
    html: emailShell(
      `<p>Someone (hopefully you) asked ${escapeHtml(SITE_NAME)} to email this address when we publish our next analysis of <strong>${escapeHtml(name)} (${escapeHtml(ticker)})</strong>.</p>` +
        `<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#18181b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block">Confirm the alert</a></p>` +
        `<p style="color:#71717a;font-size:13px">If this wasn't you, ignore this email and nothing more will be sent.</p>`
    ),
  });
  if (!sent.ok) {
    console.error("alerts: confirmation email failed", sent.status, sent.error);
    return {
      ok: false,
      status: 502,
      message: "We couldn't send the confirmation email just now. Please try again later.",
    };
  }
  return { ok: true, message: GENERIC_OK };
}

// Tokens are 32 base64url characters; anything else can't match a row.
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export async function confirmSubscription(
  token: string | undefined
): Promise<{ ticker: string } | null> {
  if (!token || !TOKEN_RE.test(token)) return null;
  const sub = await prisma.subscription.findUnique({ where: { token } });
  if (!sub) return null;
  if (!sub.confirmedAt) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { confirmedAt: new Date() },
    });
  }
  return { ticker: sub.ticker };
}

export async function unsubscribe(
  token: string | undefined
): Promise<{ ticker: string } | null> {
  if (!token || !TOKEN_RE.test(token)) return null;
  const sub = await prisma.subscription.findUnique({ where: { token } });
  if (!sub) return null;
  await prisma.subscription.deleteMany({ where: { id: sub.id } });
  return { ticker: sub.ticker };
}

export function reportAlertEmail(report: {
  title: string;
  summary: string;
  url: string;
  companyName: string;
  ticker: string;
  // The subscriber's row is for every report, not just this ticker.
  allReports: boolean;
  unsubscribe: string;
}): { subject: string; html: string; text: string; headers: Record<string, string> } {
  const { title, summary, url, companyName, ticker, unsubscribe: unsub } = report;
  const why = report.allReports
    ? "You get this because you asked for an email whenever we publish a report."
    : `You get this because you asked for an email when we analyze ${ticker}'s next report.`;
  return {
    subject: title,
    text: [
      `New on ${SITE_NAME}: our analysis of ${companyName} (${ticker}).`,
      "",
      title,
      summary,
      "",
      `Read it: ${url}`,
      "",
      `${why} Unsubscribe: ${unsub}`,
    ].join("\n"),
    html: emailShell(
      `<p style="color:#71717a;font-size:13px;margin-top:0">New on ${escapeHtml(SITE_NAME)}: ${escapeHtml(companyName)} (${escapeHtml(ticker)})</p>` +
        `<h1 style="font-size:20px;line-height:1.3;margin:0 0 12px"><a href="${escapeHtml(url)}" style="color:#18181b">${escapeHtml(title)}</a></h1>` +
        `<p>${escapeHtml(summary)}</p>` +
        `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#18181b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block">Read the analysis</a></p>` +
        `<p style="color:#71717a;font-size:13px">${escapeHtml(why)} <a href="${escapeHtml(unsub)}" style="color:#71717a">Unsubscribe</a>.</p>`
    ),
    // Lets mail clients show their own unsubscribe button.
    headers: { "List-Unsubscribe": `<${unsub}>` },
  };
}
