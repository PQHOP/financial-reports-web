import { SITE_URL } from "@/lib/site";

// IndexNow (Bing, Yandex, Seznam, Naver) — tells search engines about new or
// changed URLs immediately instead of waiting for a crawl. The key is public
// by design: it must be served at ${SITE_URL}/${KEY}.txt to prove ownership.
export const INDEXNOW_KEY = "99a6749da6a22257c8f2605131c7c679";

export async function pingIndexNow(urls: string[]): Promise<void> {
  const host = new URL(SITE_URL).hostname;
  if (host === "localhost" || urls.length === 0) return;

  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    });
  } catch {
    // Best effort only — a failed ping must never fail a publish.
  }
}
