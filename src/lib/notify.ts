/**
 * Desktop notifications + an audible alarm.
 *
 * Note: these only fire while the dashboard is open in a tab (possibly in the
 * background). Delivering alerts with the site closed would need a push server,
 * which a static GitHub Pages site cannot provide.
 */

export type NotifyPermission = "default" | "granted" | "denied" | "unsupported";

export function notifyPermission(): NotifyPermission {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission as NotifyPermission;
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (typeof Notification === "undefined") return "unsupported";
  return (await Notification.requestPermission()) as NotifyPermission;
}

export function sendNotification(title: string, body: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: title, requireInteraction: false });
  } catch {
    // Some browsers throw for notifications outside a service worker; the
    // in-app banner still covers the user.
  }
}

let audioCtx: AudioContext | null = null;

function beep(ctx: AudioContext, at: number, freq: number, duration: number, gain: number) {
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  vol.gain.setValueAtTime(0, at);
  vol.gain.linearRampToValueAtTime(gain, at + 0.02);
  vol.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(vol).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

/** "chime" is a soft two-note cue; "alarm" is an insistent repeated tone. */
export function playSound(kind: "chime" | "alarm"): void {
  try {
    audioCtx = audioCtx ?? new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const t = audioCtx.currentTime;
    if (kind === "chime") {
      beep(audioCtx, t, 660, 0.18, 0.12);
      beep(audioCtx, t + 0.2, 880, 0.25, 0.12);
    } else {
      for (let i = 0; i < 4; i++) {
        beep(audioCtx, t + i * 0.42, 880, 0.16, 0.2);
        beep(audioCtx, t + i * 0.42 + 0.18, 660, 0.16, 0.2);
      }
    }
  } catch {
    // Audio is a nicety; never let it break the alert flow.
  }
}
