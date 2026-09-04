/**
 * Camera ownership.
 *
 * MindAR calls `navigator.mediaDevices.getUserMedia({ video: { facingMode:
 * 'environment' } })` itself and keeps the resulting MediaStream private, which
 * leaves no way to pick a lens, zoom, or turn the torch on. So this module opens
 * the camera *first*, with the constraints we want, and hands MindAR that same
 * stream by intercepting exactly one getUserMedia call.
 *
 * The interception is deliberately one-shot and self-restoring: patching a
 * global permanently would silently capture every other getUserMedia caller on
 * the page, including the tracking test's synthetic feed.
 */

/** Cameras the browser will admit to. Labels are blank until permission is granted. */
export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Camera ${index + 1}`,
    }));
}

/**
 * What to ask a phone camera for.
 *
 * Unconstrained, browsers pick for themselves, and some Android phones hand
 * back 1080p or higher. Every one of those pixels is carried through MindAR's
 * per-frame feature detection for as long as the camera is open, which on a
 * mid-range phone costs frame rate, battery and — over a two-hour event — a
 * device hot enough to throttle itself.
 *
 * 720p is well above what marker detection needs; the tracker downsamples
 * before it looks for features anyway, so the extra resolution buys nothing but
 * heat. Capping the frame rate is the other half: 30fps is more than enough to
 * acquire an image target, and a phone that would happily run the sensor at 60
 * is doing twice the work for no gain a player can see.
 *
 * Every value is `ideal`, never `exact`. An exact constraint a camera cannot
 * meet rejects the whole getUserMedia call — the difference between a slightly
 * different resolution and no camera at all.
 */
const PHONE_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 30 },
};

/** Read a capability range, tolerating browsers that expose none. */
function range(capabilities, key) {
  const value = capabilities?.[key];
  if (!value || typeof value.max !== 'number') return null;
  return { min: value.min ?? 0, max: value.max, step: value.step || 0.1 };
}

export class CameraSession {
  constructor() {
    this.stream = null;
    this.track = null;
  }

  /**
   * Open a camera. `deviceId` wins when given; otherwise ask for the rear lens,
   * which is what an image-tracking app always wants.
   */
  async open({ deviceId, facingMode = 'environment' } = {}) {
    this.close();
    const video = deviceId
      ? { deviceId: { exact: deviceId }, ...PHONE_CONSTRAINTS }
      : { facingMode: { ideal: facingMode }, ...PHONE_CONSTRAINTS };

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
    this.track = this.stream.getVideoTracks()[0] ?? null;
    return this.stream;
  }

  /**
   * Make the next getUserMedia call resolve to our already-open stream.
   * Returns a cleanup that restores the original, whether or not it fired.
   */
  interceptNextRequest() {
    const media = navigator.mediaDevices;
    if (!media || !this.stream) return () => {};

    const original = media.getUserMedia.bind(media);
    let used = false;

    media.getUserMedia = async (constraints) => {
      if (used || !this.stream) return original(constraints);
      used = true;
      media.getUserMedia = original;
      return this.stream;
    };

    return () => {
      if (!used) media.getUserMedia = original;
    };
  }

  /** What this particular camera can actually do. Varies wildly by device. */
  capabilities() {
    const caps = this.track?.getCapabilities?.() ?? {};
    return {
      zoom: range(caps, 'zoom'),
      torch: caps.torch === true,
    };
  }

  settings() {
    return this.track?.getSettings?.() ?? {};
  }

  /**
   * Optical/sensor zoom. `advanced` is what makes this work: browsers that do
   * not support zoom ignore an advanced constraint instead of rejecting the
   * whole call, so an unsupported device degrades to a no-op.
   */
  async setZoom(value) {
    if (!this.track) return false;
    try {
      await this.track.applyConstraints({ advanced: [{ zoom: value }] });
      return true;
    } catch (err) {
      console.warn('zoom not applied', err);
      return false;
    }
  }

  async setTorch(on) {
    if (!this.track) return false;
    try {
      await this.track.applyConstraints({ advanced: [{ torch: on }] });
      return true;
    } catch (err) {
      console.warn('torch not applied', err);
      return false;
    }
  }

  close() {
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.track = null;
  }
}
