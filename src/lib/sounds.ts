/**
 * Notification sounds generated entirely via the Web Audio API.
 * No external audio files required — works offline and in PWA mode.
 *
 * All functions are safe to call without user interaction guards because
 * browsers allow AudioContext creation after the first user gesture on the page.
 * If called before any gesture, the context will be in "suspended" state and
 * we resume it automatically.
 */

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx) {
    _ctx = new AudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (_ctx.state === "suspended") {
    _ctx.resume();
  }
  return _ctx;
}

/** Smooth fade-out helper */
function fadeOut(gain: GainNode, ctx: AudioContext, duration: number) {
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
}

function isMuted(): boolean {
  try {
    return (window as unknown as Record<string, unknown>).__notifMuted === true;
  } catch {
    return false;
  }
}

/**
 * Soft two-tone chime — used for incoming user notifications
 */
export function playNotificationChime() {
  if (isMuted()) return;
  try {
    const ctx = getCtx();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.18, ctx.currentTime);
    master.connect(ctx.destination);

    // Two notes: C5 then E5, slightly overlapping
    const notes = [523.25, 659.25]; // C5, E5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.01 + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5 + i * 0.12);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + 0.6 + i * 0.12);
    });
  } catch {
    // AudioContext not available (e.g. SSR) — silently ignore
  }
}

/**
 * Urgent triple-beep alert — used for admin new-report notifications
 */
export function playAlertBeep() {
  if (isMuted()) return;
  try {
    const ctx = getCtx();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.22, ctx.currentTime);
    master.connect(ctx.destination);

    // Three short beeps at 880 Hz (A5)
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(880, ctx.currentTime);

      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.8, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.14);
    }
  } catch {
    // Silently ignore
  }
}

/**
 * Subtle pop — used for marking a notification as read
 */
export function playReadPop() {
  if (isMuted()) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    fadeOut(gain, ctx, 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    // Silently ignore
  }
}
