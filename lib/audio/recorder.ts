"use client";

// Tap-to-talk microphone (ported from HiBenny): tap once, speak, and it stops
// by itself after a pause (voice activity detection), so nobody has to hold a
// button. Encodes 16 kHz mono WAV (MediaRecorder containers differ per browser
// and Gemini rejected some of them; WAV works everywhere, ).
// Uses an AudioWorklet, with a ScriptProcessor fallback for old WebViews.

export type Recording = { blob: Blob; ms: number; speechMs: number };
export type MicEvents = { onSpeechStart?: () => void; endSilenceMs?: number };

const RATE = 16000;
const MAX_MS = 25_000;
const NO_SPEECH_MS = 8000; // tapped but never spoke: give up
// People pause mid-request ("a dinner... then maybe drinks"); cutting them off
// is worse than waiting. Tapping the mic still sends right away.
const END_SILENCE_MS = 1600;
const EARLY_SILENCE_MS = 2200; // just started talking: the likeliest pause to think
const EARLY_SPEECH_MS = 1500;
const KEEP_TALKING = 0.6; // once talking, quieter frames still count as voice (soft endings)
const MIN_SPEECH_MS = 250;

export class Mic {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioNode | null = null;
  private sink: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private data = new Uint8Array(256);
  private frames: Float32Array[] = [];
  private recording = false;
  private started = 0;
  private speechAt = 0;
  private lastVoice = 0;
  private speechMs = 0;
  private noiseFloor = 0.01;
  private finish: ((r: Recording | null) => void) | null = null;
  private events: MicEvents = {};

  static supported(): boolean {
    return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
  }

  get isOpen() {
    return !!this.stream;
  }

  async open(ctx: AudioContext): Promise<void> {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    this.ctx = ctx;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    this.source = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.source.connect(this.analyser);
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.sink.connect(ctx.destination);
    try {
      await ctx.audioWorklet.addModule("/worklets/capture.js");
      const w = new AudioWorkletNode(ctx, "capture");
      w.port.onmessage = (e) => this.onFrame(e.data as Float32Array);
      this.node = w;
    } catch {
      const p = ctx.createScriptProcessor(4096, 1, 1);
      p.onaudioprocess = (e) => this.onFrame(new Float32Array(e.inputBuffer.getChannelData(0)));
      this.node = p;
    }
    this.source.connect(this.node);
    this.node.connect(this.sink);
  }

  /** 0..1 mic loudness, for the listening ring. */
  level(): number {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.data);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      const v = (this.data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.data.length) * 5);
  }

  private onFrame(ch: Float32Array) {
    if (!this.recording) return;
    this.frames.push(ch);
    let sum = 0;
    for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    const rms = Math.sqrt(sum / ch.length);
    const now = performance.now();
    const frameMs = (ch.length / (this.ctx?.sampleRate ?? 48000)) * 1000;
    // Adaptive threshold: a quiet room vs. a TV in the background.
    const threshold = Math.max(0.015, this.noiseFloor * 3);
    if (rms > (this.speechAt ? threshold * KEEP_TALKING : threshold)) {
      if (!this.speechAt) {
        this.speechAt = now;
        this.events.onSpeechStart?.();
      }
      this.lastVoice = now;
      this.speechMs += frameMs;
    } else if (!this.speechAt) {
      this.noiseFloor = this.noiseFloor * 0.95 + rms * 0.05;
    }
    const elapsed = now - this.started;
    if (elapsed > MAX_MS) void this.stop();
    else if (!this.speechAt && elapsed > NO_SPEECH_MS) void this.stop();
    else if (this.speechAt && this.speechMs > MIN_SPEECH_MS && now - this.lastVoice > this.endSilence()) void this.stop();
  }

  private endSilence(): number {
    if (this.events.endSilenceMs) return this.events.endSilenceMs;
    return this.speechMs < EARLY_SPEECH_MS ? EARLY_SILENCE_MS : END_SILENCE_MS;
  }

  /** Starts recording; resolves when the speaker stops (or null if nothing was said). */
  listen(events: MicEvents = {}): Promise<Recording | null> {
    if (!this.stream || !this.ctx) throw new Error("mic not open");
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.events = events;
    this.frames = [];
    this.speechAt = 0;
    this.lastVoice = 0;
    this.speechMs = 0;
    this.started = performance.now();
    this.recording = true;
    return new Promise((r) => (this.finish = r));
  }

  get isRecording() {
    return this.recording;
  }

  /** Stop now (tap again, or auto-stop). */
  async stop(): Promise<void> {
    if (!this.recording || !this.ctx) return;
    this.recording = false;
    const ms = performance.now() - this.started;
    const done = this.finish;
    this.finish = null;
    if (this.speechMs < MIN_SPEECH_MS) return done?.(null);
    const pcm = downsample(concat(this.frames), this.ctx.sampleRate, RATE, Math.round((MAX_MS / 1000) * RATE));
    this.frames = [];
    done?.({ blob: wav(pcm, RATE), ms, speechMs: this.speechMs });
  }

  /** Cancel without a result (leaving the page, barge-in). */
  cancel() {
    this.recording = false;
    const done = this.finish;
    this.finish = null;
    this.frames = [];
    done?.(null);
  }

  close() {
    this.cancel();
    this.node?.disconnect();
    this.sink?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}

function concat(frames: Float32Array[]): Float32Array {
  const out = new Float32Array(frames.reduce((n, f) => n + f.length, 0));
  let o = 0;
  for (const f of frames) {
    out.set(f, o);
    o += f.length;
  }
  return out;
}

/** Box-filter downsample (cheap anti-aliasing). */
function downsample(input: Float32Array, from: number, to: number, maxLen: number): Float32Array {
  if (from === to) return input.slice(0, maxLen);
  const ratio = from / to;
  const len = Math.min(maxLen, Math.floor(input.length / ratio));
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = a; j < b; j++) sum += input[j];
    out[i] = sum / Math.max(1, b - a);
  }
  return out;
}

function wav(pcm: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

export async function blobToBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
