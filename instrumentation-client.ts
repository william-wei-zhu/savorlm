import posthog from "posthog-js";

// PostHog product analytics (William's standard stack), loaded on the client by
// Next.js. `defaults: "2025-05-24"` turns on autocapture plus pageviews and
// page leaves that follow App Router navigation. Events go through the
// /ingest reverse proxy (next.config.ts) so ad blockers don't drop them.
// Privacy: anonymous events only (no person profiles, no sign-in), no session
// replay, Do Not Track respected, IPs anonymized in the PostHog project.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (key) {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.posthog.com",
    defaults: "2025-05-24",
    person_profiles: "identified_only",
    disable_session_recording: true,
    respect_dnt: true,
  });
}
