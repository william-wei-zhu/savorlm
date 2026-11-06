// Trusted client IP (building standard §14): never the client-controllable
// leftmost X-Forwarded-For hop. Vercel sets x-real-ip / x-vercel-forwarded-for.
export function clientIp(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",").pop()!.trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",").pop()!.trim();
  return "unknown";
}
