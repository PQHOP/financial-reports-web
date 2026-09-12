// Kept separate from adminAuth.ts (which uses node:crypto and next/headers)
// so the Edge-compatible proxy.ts can import just the cookie name safely.
export const ADMIN_COOKIE_NAME = "admin_session";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds
