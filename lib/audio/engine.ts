"use client";

// Web Audio playback (ported from HiBenny): streamed Savvy speech (raw PCM
// from /api/tts), instant barge-in, a loudness meter that drives Savvy's
// talking bounce, and tiny synthesized sounds (no audio assets needed).

export type VoiceHandle = { done: Promise<"ended" | "stopped" | "error">; stop: () => void };

class Engine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private voiceBus!: GainNode;
  private analyser!: AnalyserNode;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private clips = new Map<string, AudioBuffer>(); // finished TTS clips by cacheKey
  private active: { stop: () => void } | null = null;
  private amp = new Uint8Array(512);

  ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctor: typeof AudioContext = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: "interactive" });
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.voiceBus = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.voiceBus.connect(this.analyser);
    this.voiceBus.connect(this.master);
    return ctx;
  }

  /** Must run inside a user gesture (autoplay policy, esp. iOS). */
  async unlock() {
    // iPadOS / iOS WebKit (incl. Chrome on iPad): declare a play-and-record
    // session up front so opening the mic doesn't switch audio to a quieter route.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) {
      try {
        session.type = "play-and-record";
      } catch {}
    }
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
    // iOS: a silent buffer inside the gesture fully unlocks output.
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
  }

  /** 0..1 loudness of Savvy's voice right now. */
  level(): number {
    if (!this.ctx) return 0;
    this.analyser.getByteTimeDomainData(this.amp);
    let sum = 0;
    for (let i = 0; i < this.amp.length; i++) {
      const v = (this.amp[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.amp.length) * 4.5);
  }

  preload(url: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(url);
    if (!p) {
      const ctx = this.ensure();
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null);
      this.buffers.set(url, p);
    }
    return p;
  }

  stopVoice() {
    this.active?.stop();
    this.active = null;
  }

  async playUrl(url: string): Promise<VoiceHandle> {
    this.stopVoice();
    const buf = await this.preload(url);
    if (!buf) return { done: Promise.resolve("error"), stop: () => {} };
    return this.playBuffer(buf);
  }

  /** Length in seconds of a clip kept by playStream(…, cacheKey), or null if not kept yet. */
  clipSeconds(key: string): number | null {
    return this.clips.get(key)?.duration ?? null;
  }

  private playBuffer(buf: AudioBuffer): VoiceHandle {
    const ctx = this.ensure();
    this.stopVoice();
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf;
    src.connect(g).connect(this.voiceBus);
    let resolve!: (v: "ended" | "stopped") => void;
    const done = new Promise<"ended" | "stopped" | "error">((r) => (resolve = r));
    let stopped = false;
    src.onended = () => resolve(stopped ? "stopped" : "ended");
    src.start();
    const stop = () => {
      if (stopped) return;
      stopped = true;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      try {
        src.stop(ctx.currentTime + 0.08);
      } catch {}
    };
    this.active = { stop };
    return { done, stop };
  }

  /**
   * Stream PCM16 @24kHz and play it gaplessly as it arrives. With a cacheKey,
   * a finished clip is kept in memory and replays without a network call.
   */
  playStream(fetcher: (signal: AbortSignal) => Promise<Response>, cacheKey?: string): VoiceHandle {
    const kept = cacheKey ? this.clips.get(cacheKey) : undefined;
    if (kept) return this.playBuffer(kept);
    const ctx = this.ensure();
    this.stopVoice();
    const pcm: Float32Array[] = [];
    const ac = new AbortController();
    const g = ctx.createGain();
    g.connect(this.voiceBus);
    const sources: AudioBufferSourceNode[] = [];
    let stopped = false;
    let playHead = 0;
    let resolve!: (v: "ended" | "stopped" | "error") => void;
    const done = new Promise<"ended" | "stopped" | "error">((r) => (resolve = r));
    const stop = () => {
      if (stopped) return;
      stopped = true;
      ac.abort();
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      for (const s of sources) {
        try {
          s.stop(ctx.currentTime + 0.08);
        } catch {}
      }
      resolve("stopped");
    };
    this.active = { stop };

    (async () => {
      try {
        const res = await fetcher(ac.signal);
        if (!res.ok || !res.body) throw new Error(String(res.status));
        const reader = res.body.getReader();
        let carry: Uint8Array | null = null;
        let last: AudioBufferSourceNode | null = null;
        for (;;) {
          const { value, done: end } = await reader.read();
          if (end || stopped) break;
          let bytes = value;
          if (carry) {
            const merged = new Uint8Array(carry.length + bytes.length);
            merged.set(carry);
            merged.set(bytes, carry.length);
            bytes = merged;
            carry = null;
          }
          if (bytes.length % 2) {
            carry = bytes.slice(bytes.length - 1);
            bytes = bytes.slice(0, bytes.length - 1);
          }
          const n = bytes.length / 2;
          if (n === 0) continue;
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          const buf = ctx.createBuffer(1, n, 24000);
          const ch = buf.getChannelData(0);
          for (let i = 0; i < n; i++) ch[i] = view.getInt16(i * 2, true) / 32768;
          if (cacheKey) pcm.push(ch.slice());
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(g);
          // A small lead on the first chunk absorbs network jitter.
          const at = Math.max(ctx.currentTime + (playHead ? 0.03 : 0.12), playHead);
          src.start(at);
          playHead = at + buf.duration;
          sources.push(src);
          last = src;
        }
        if (stopped) return;
        if (!last) return resolve("error");
        if (cacheKey) {
          const total = pcm.reduce((s, c) => s + c.length, 0);
          const buf = ctx.createBuffer(1, total, 24000);
          let at = 0;
          for (const c of pcm) {
            buf.getChannelData(0).set(c, at);
            at += c.length;
          }
          this.clips.set(cacheKey, buf);
        }
        last.onended = () => resolve(stopped ? "stopped" : "ended");
      } catch {
        if (!stopped) resolve("error");
      }
    })();
    return { done, stop };
  }

  private tone(freq: number, at: number, dur: number, gain: number, type: OscillatorType = "sine") {
    const ctx = this.ensure();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.master);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  /** Soft "listening" blip when the mic opens. */
  blip() {
    const ctx = this.ensure();
    this.tone(880, ctx.currentTime, 0.12, 0.08);
  }

  /** Little chirp when someone taps Savvy: three quick rising notes. */
  giggle() {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    [620, 760, 900].forEach((f, i) => this.tone(f, t + i * 0.07, 0.09, 0.06, "sine"));
  }

  /** Sparkle when a stop lands on the map. */
  chime() {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    [1046.5, 1318.5, 1568].forEach((f, i) => this.tone(f, t + i * 0.08, 0.35, 0.07, "triangle"));
  }
}

export const audio = typeof window !== "undefined" ? new Engine() : (null as unknown as Engine);
