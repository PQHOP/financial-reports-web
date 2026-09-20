import crypto from "node:crypto";
import { SITE_URL } from "@/lib/site";
import { periodLabels } from "@/lib/period";
import { metricsHeadline, readMetrics } from "@/lib/metrics";
import type { ReportPeriod } from "@/generated/prisma/client";

export type PostableReport = {
  id: string;
  year: number;
  period: ReportPeriod;
  summary: string;
  metrics: unknown;
  company: { name: string; ticker: string | null };
};

export type PostResult = { platform: string; ok: boolean; detail?: string };

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

// Text that goes before the link. `budget` is the room left once the URL is
// accounted for.
function buildBody(report: PostableReport, cashtag: boolean, budget: number): string {
  const metrics = readMetrics(report.metrics);
  const ticker = report.company.ticker;
  const label = ticker ? `${cashtag ? "$" : ""}${ticker}` : report.company.name;
  const head = `${label} ${periodLabels[report.period]} ${report.year} earnings:`;
  const detail = metrics ? metricsHeadline(metrics) : "";
  const body = detail
    ? `${head} ${detail}. ${report.summary}`
    : `${head} ${report.summary}`;
  return truncate(body, budget);
}

export function reportUrl(id: string): string {
  return `${SITE_URL}/reports/${id}`;
}

// ---- Bluesky (AT Protocol; app password auth) -------------------------------

const BSKY = "https://bsky.social/xrpc";

export function blueskyConfigured(): boolean {
  return Boolean(process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD);
}

export async function postToBluesky(report: PostableReport): Promise<PostResult> {
  try {
    const url = reportUrl(report.id);
    // 300-character limit for the whole post; the link is appended after the body.
    const text = `${buildBody(report, false, 300 - url.length - 2)}\n${url}`;

    const session = await fetch(`${BSKY}/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: process.env.BLUESKY_HANDLE,
        password: process.env.BLUESKY_APP_PASSWORD,
      }),
    });
    if (!session.ok) {
      return { platform: "bluesky", ok: false, detail: `login ${session.status}` };
    }
    const { accessJwt, did } = (await session.json()) as {
      accessJwt: string;
      did: string;
    };

    // Links are only clickable with a facet; indexes are UTF-8 byte offsets.
    const enc = new TextEncoder();
    const byteStart = enc.encode(text.slice(0, text.lastIndexOf(url))).length;
    const byteEnd = byteStart + enc.encode(url).length;

    const res = await fetch(`${BSKY}/com.atproto.repo.createRecord`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessJwt}`,
      },
      body: JSON.stringify({
        repo: did,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text,
          createdAt: new Date().toISOString(),
          langs: ["en"],
          facets: [
            {
              index: { byteStart, byteEnd },
              features: [{ $type: "app.bsky.richtext.facet#link", uri: url }],
            },
          ],
        },
      }),
    });
    return {
      platform: "bluesky",
      ok: res.ok,
      detail: res.ok ? undefined : `post ${res.status}`,
    };
  } catch (error) {
    return { platform: "bluesky", ok: false, detail: (error as Error).message };
  }
}

// ---- X (Twitter API v2, OAuth 1.0a user context) ----------------------------

export function xConfigured(): boolean {
  return Boolean(
    process.env.X_API_KEY &&
      process.env.X_API_SECRET &&
      process.env.X_ACCESS_TOKEN &&
      process.env.X_ACCESS_SECRET
  );
}

// RFC 3986 percent-encoding, which OAuth 1.0a requires (encodeURIComponent
// leaves the characters ! ' ( ) * unescaped).
function pct(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function oauthHeader(method: string, url: string): string {
  const params: Record<string, string> = {
    oauth_consumer_key: process.env.X_API_KEY!,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.X_ACCESS_TOKEN!,
    oauth_version: "1.0",
  };
  // JSON request bodies are not part of the OAuth 1.0a signature base string.
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${pct(k)}=${pct(params[k])}`)
    .join("&");
  const base = [method.toUpperCase(), pct(url), pct(paramString)].join("&");
  const key = `${pct(process.env.X_API_SECRET!)}&${pct(process.env.X_ACCESS_SECRET!)}`;
  params.oauth_signature = crypto.createHmac("sha1", key).update(base).digest("base64");
  return (
    "OAuth " +
    Object.keys(params)
      .sort()
      .map((k) => `${pct(k)}="${pct(params[k])}"`)
      .join(", ")
  );
}

export async function postToX(report: PostableReport): Promise<PostResult> {
  try {
    const url = reportUrl(report.id);
    // X counts any link as 23 characters of the 280.
    const text = `${buildBody(report, true, 280 - 23 - 2)}\n${url}`;
    const endpoint = "https://api.twitter.com/2/tweets";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: oauthHeader("POST", endpoint),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
    return {
      platform: "x",
      ok: res.ok,
      detail: res.ok ? undefined : `post ${res.status}`,
    };
  } catch (error) {
    return { platform: "x", ok: false, detail: (error as Error).message };
  }
}
