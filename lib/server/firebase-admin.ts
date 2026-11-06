import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Server-only Firestore (cache + usage budgets; the browser never talks to it).
// Pinned project id (building standard §18) so a
// local CLI defaulting to another project never receives these writes.
export const PROJECT_ID = "savorlm-app";

let app: App | null = null;
let store: Firestore | null = null;

function getApp(): App | null {
  if (app) return app;
  if (getApps().length) return (app = getApps()[0]);
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) return null;
  const creds = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  app = initializeApp({ credential: cert(creds), projectId: PROJECT_ID });
  return app;
}

// Next bundles pages and route handlers into separate chunks, each with its own
// copy of this module, but they share one firebase-admin app and therefore one
// Firestore instance. Calling settings() twice throws ("already initialized"),
// which broke HiBenny after a cold start (2026-09-27).
// So the configured instance is cached on globalThis, shared by every chunk.
const g = globalThis as typeof globalThis & { __slmFirestore?: Firestore };

export function db(): Firestore | null {
  if (store) return store;
  if (g.__slmFirestore) return (store = g.__slmFirestore);
  const a = getApp();
  if (!a) return null;
  store = getFirestore(a);
  g.__slmFirestore = store;
  // REST transport on Vercel: faster serverless cold starts than gRPC
  // (AnyScholar, 2026-09-26). Locally (Node 22) REST fails
  // with ERR_STREAM_PREMATURE_CLOSE for every project, so dev uses gRPC.
  store.settings({ preferRest: !!process.env.VERCEL, ignoreUndefinedProperties: true });
  return store;
}
