import { NextResponse } from "next/server";
import {
  GENERIC_OK,
  alertsEnabled,
  hashClientIp,
  requestSubscription,
} from "@/lib/alerts";

export const dynamic = "force-dynamic";

// Signup endpoint for <AlertSignup>. The form's script posts JSON and gets
// JSON back; a plain form post (script not loaded yet) gets the same message
// as text rather than a bare JSON blob.
export async function POST(request: Request) {
  if (!alertsEnabled()) return new NextResponse("Not found", { status: 404 });

  const isJson = (request.headers.get("content-type") ?? "").includes("application/json");
  const reply = (ok: boolean, message: string, status = 200) =>
    isJson
      ? NextResponse.json({ ok, message }, { status })
      : new NextResponse(message, {
          status,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });

  let body: Record<string, unknown> = {};
  try {
    if (isJson) {
      const parsed: unknown = await request.json();
      if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
    } else {
      body = Object.fromEntries((await request.formData()).entries());
    }
  } catch {
    return reply(false, "Invalid request.", 400);
  }
  const field = (name: string) => {
    const value = body[name];
    return typeof value === "string" ? value : "";
  };

  // Honeypot: real visitors never see or fill this field. Answer as if it
  // worked so bots don't learn to skip it.
  if (field("website").trim()) return reply(true, GENERIC_OK);

  const result = await requestSubscription({
    email: field("email"),
    ticker: field("ticker"),
    submitterHash: hashClientIp(request.headers.get("x-forwarded-for")),
  });
  return reply(result.ok, result.message, result.ok ? 200 : result.status);
}
