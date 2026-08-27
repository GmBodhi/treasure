import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraSession, listCameras } from '../ar/camera.js';

/**
 * Owns the camera for the AR route: which lens is open, what it can do, and the
 * live zoom/torch state.
 *
 * The session outlives individual renders (it is a ref) because a MediaStream
 * is not something React can reconcile — losing track of one leaves the camera
 * light on with no way to turn it off.
 */
export function useCamera() {
  const sessionRef = useRef(null);
  if (!sessionRef.current) sessionRef.current = new CameraSession();

  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState(null);
  const [capabilities, setCapabilities] = useState({ zoom: null, torch: false });
  const [zoom, setZoomState] = useState(1);
  const [torch, setTorchState] = useState(false);

  /** Open (or reopen) the camera and publish what it can do. */
  const open = useCallback(async (nextDeviceId) => {
    const session = sessionRef.current;
    await session.open({ deviceId: nextDeviceId });

    const caps = session.capabilities();
    setCapabilities(caps);
    setZoomState(session.settings().zoom ?? caps.zoom?.min ?? 1);
    setTorchState(false);
    setDeviceId(session.settings().deviceId ?? nextDeviceId ?? null);

    // Labels are empty until a camera has been granted at least once, so the
    // device list is only worth reading after the stream is live.
    setDevices(await listCameras());

    return session;
  }, []);

  const close = useCallback(() => {
    sessionRef.current.close();
    setTorchState(false);
  }, []);

  // Never leave the camera running because a route unmounted.
  useEffect(() => close, [close]);

  const setZoom = useCallback(async (value) => {
    setZoomState(value);
    await sessionRef.current.setZoom(value);
  }, []);

  const setTorch = useCallback(async (on) => {
    const ok = await sessionRef.current.setTorch(on);
    if (ok) setTorchState(on);
    return ok;
  }, []);

  const toggleTorch = useCallback(() => setTorch(!torch), [setTorch, torch]);

  /**
   * Stop frames leaving the sensor without giving up the camera.
   *
   * `enabled = false` keeps the track — and the permission — alive, so resuming
   * needs no gesture and no re-open, but the pipeline stops delivering frames.
   * Only `track.stop()` powers the camera down completely, and that costs a
   * full MindAR restart to undo.
   */
  const setEnabled = useCallback((on) => {
    const track = sessionRef.current.track;
    if (track) track.enabled = on;
  }, []);

  /** The next camera in the list, or null when there is nothing to switch to. */
  const nextDeviceId = useCallback(() => {
    if (devices.length < 2) return null;
    const index = devices.findIndex((device) => device.deviceId === deviceId);
    return devices[(index + 1) % devices.length].deviceId;
  }, [devices, deviceId]);

  return {
    session: sessionRef.current,
    devices,
    deviceId,
    capabilities,
    zoom,
    torch,
    open,
    close,
    setZoom,
    setTorch,
    toggleTorch,
    setEnabled,
    nextDeviceId,
    canSwitch: devices.length > 1,
  };
}
