import "server-only";

// Gemini Developer API (key), server only. Ported from HiBenny.
// Newest Flash by explicit id (aliases lag). Checked with GET v1beta/models on 2026-11-06.
export const TEXT_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
/** 3.8 Flash rejects "minimal"; "low" keeps a structured reply around 1.5 to 2.5 s. */
export const TEXT_THINKING = process.env.GEMINI_THINKING ?? "low";
export const TTS_MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-3.8-flash-lite-tts";
/** Fast model for transcription (temperature 0, no thinking needed). */
export const EAR_MODEL = process.env.GEMINI_EAR_MODEL ?? "gemini-3.5-flash-lite";
/** Savvy's voice: warm and lively. */
export const VOICE = process.env.SAVVY_VOICE ?? "Sadachbia";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function key(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY missing");
  return k;
}

/**
 * JSON generation with a per-attempt deadline and one retry on a fresh
 * connection (on Vercel an occasional call hangs; retrying beats waiting).
 * The caller's signal (client disconnect) aborts both attempts.
 */
export async function generateJson(model: string, body: unknown, opts: { attemptMs?: number; signal?: AbortSignal } = {}): Promise<unknown> {
  const attemptMs = opts.attemptMs ?? 6000;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (opts.signal?.aborted) throw new Error("aborted");
    const t0 = Date.now();
    const timeout = AbortSignal.timeout(attempt === 0 ? attemptMs : attemptMs * 1.5);
    const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout;
    try {
      const out = await generateOnce(model, body, signal);
      console.log(`gemini ${model} ok attempt=${attempt} ms=${Date.now() - t0}`);
      return out;
    } catch (e) {
      lastErr = e;
      console.warn(`gemini ${model} attempt=${attempt} failed after ${Date.now() - t0}ms: ${(e as Error).message}`);
    }
  }
  throw lastErr;
}

async function generateOnce(model: string, body: unknown, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key(), Connection: "close" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
  return JSON.parse(text);
}

/**
 * Streams raw 24 kHz 16-bit mono PCM from Gemini TTS. The whole reply is voiced
 * in one request (per-sentence requests sound choppy).
 * Direction goes in a short [bracket tag]: longer direction gets read aloud.
 */
export async function streamSpeech(text: string, tag: string, signal?: AbortSignal, voice: string = VOICE): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${BASE}/${TTS_MODEL}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key() },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `[${tag}] ${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`tts ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        const nl = buf.indexOf("\n");
        if (nl >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          let chunks: Uint8Array[] = [];
          try {
            const d = JSON.parse(line.slice(5));
            const parts = d.candidates?.[0]?.content?.parts ?? [];
            chunks = parts.flatMap((p: { inlineData?: { data?: string } }) => (p.inlineData?.data ? [Uint8Array.from(Buffer.from(p.inlineData.data, "base64"))] : []));
          } catch {
            /* partial or keepalive line */
          }
          if (chunks.length) {
            for (const c of chunks) controller.enqueue(c);
            return;
          }
          continue;
        }
        const { value, done } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buf += value;
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

/** Verbatim transcript of a short spoken request (16 kHz WAV, base64). "" when there is no speech. */
export async function transcribe(wavB64: string, signal?: AbortSignal): Promise<string> {
  const out = (await generateJson(
    EAR_MODEL,
    {
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: wavB64 } }, { text: "Transcribe exactly what the speaker says, in the language spoken. If there is no clear human speech, return an empty string." }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: { text: { type: "STRING" } }, required: ["text"] },
      },
    },
    { attemptMs: 6000, signal },
  )) as { text?: string };
  return (out.text ?? "").trim().slice(0, 500);
}
