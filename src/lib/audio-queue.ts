import type { AudioSegment, OculusViseme } from "@/types";

/**
 * FIFO audio playback queue. Plays AudioSegments sequentially and
 * tracks the current viseme based on playback elapsed time.
 */
export class AudioQueue {
  private queue: AudioSegment[] = [];
  private currentSegment: AudioSegment | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private startTime = 0;
  private playing = false;
  private audioCtx: AudioContext;
  private onFinished: (() => void) | null = null;

  constructor(audioCtx: AudioContext, onFinished?: () => void) {
    this.audioCtx = audioCtx;
    this.onFinished = onFinished ?? null;
  }

  enqueue(segment: AudioSegment) {
    this.queue.push(segment);
    if (!this.playing) {
      this.playNext();
    }
  }

  getCurrentViseme(): OculusViseme {
    if (!this.currentSegment || !this.playing) return "sil";

    const elapsed = (this.audioCtx.currentTime - this.startTime) * 1000; // ms
    const { visemes, vtimes, vdurations } = this.currentSegment;

    // Binary search for active viseme
    let lo = 0;
    let hi = vtimes.length - 1;
    let idx = -1;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (vtimes[mid] <= elapsed) {
        idx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (idx >= 0 && elapsed < vtimes[idx] + vdurations[idx]) {
      return visemes[idx];
    }

    return "sil";
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  clear() {
    this.queue = [];
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      this.sourceNode.stop();
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.currentSegment = null;
    this.playing = false;
  }

  private playNext() {
    if (this.queue.length === 0) {
      this.playing = false;
      this.currentSegment = null;
      this.onFinished?.();
      return;
    }

    this.playing = true;
    this.currentSegment = this.queue.shift()!;

    const source = this.audioCtx.createBufferSource();
    source.buffer = this.currentSegment.audio;
    source.connect(this.audioCtx.destination);
    source.onended = () => {
      this.sourceNode = null;
      this.playNext();
    };

    this.sourceNode = source;
    this.startTime = this.audioCtx.currentTime;
    source.start();
  }
}
