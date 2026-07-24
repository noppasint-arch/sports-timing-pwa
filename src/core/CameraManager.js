/**
 * CameraManager — module-level singleton that keeps the camera stream alive
 * across component mounts/unmounts.
 *
 * Permission is requested ONCE per session. Between trials the camera stays
 * on and the background model keeps building — no re-warm-up delay.
 */
import { CameraMotionDetector } from './CameraMotionDetector';

let _detector = null;
let _started  = false;

export async function ensureCameraStarted({ videoEl, sensitivity, zoneCenter, zoneWidth, getServerTime, diagnostics, dualZone } = {}) {
  if (!_detector) {
    _detector = new CameraMotionDetector({ sensitivity, minFgPercent: 0.20, diagnostics, dualZone });
  }
  if (getServerTime) _detector.setServerTimeFn(getServerTime);
  if (zoneCenter !== undefined) _detector.setZone(zoneCenter, zoneWidth ?? 0.08);
  if (sensitivity !== undefined) _detector.setSensitivity(sensitivity);
  if (diagnostics !== undefined) _detector.setDiagnostics(diagnostics);
  if (dualZone !== undefined) _detector.setDualZone(dualZone);

  if (!_started) {
    await _detector.start(videoEl);
    _started = true;
  }
  return _detector;
}

export function getCameraDetector() {
  return _detector;
}

export function updateCameraCallbacks({ onTrigger, onFrame }) {
  if (!_detector) return;
  _detector.onTrigger = onTrigger;
  _detector.onFrame   = onFrame;
}

/** Call only when the whole session ends */
export function releaseCamera() {
  if (_detector) {
    _detector.stop();
    _detector = null;
    _started  = false;
  }
}
