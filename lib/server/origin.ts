// Cheap CSRF / hotlink guard for state-changing requests. Exact host matches
// only (a suffix check once let a look-alike domain through elsewhere), and a
// missing Origin is NOT a free pass: then the browser's Sec-Fetch-Site must say
// same-origin. Localhost only outside production.

const OUR_HOSTS = new Set(["savorlm.com", "www.savorlm.com"]);
const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function sameOrigin(headers: Headers, production = process.env.NODE_ENV === "production"): boolean {
  const origin = headers.get("origin");
  if (!origin) return headers.get("sec-fetch-site") === "same-origin";
  try {
    const url = new URL(origin);
    if (url.host === headers.get("host")) return true;
    if (OUR_HOSTS.has(url.host) && url.protocol === "https:") return true;
    return !production && LOCAL.has(url.hostname);
  } catch {
    return false;
  }
}
