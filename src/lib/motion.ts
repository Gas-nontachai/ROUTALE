export const clamp = (n: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, n));
export const linear = (t: number) => clamp(t);
export const smoothstep = (t: number) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
export const smootherstep = (t: number) => {
  t = clamp(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const angleDelta = (from: number, to: number) =>
  ((((to - from + 540) % 360) + 360) % 360) - 180;
export const angleLerp = (from: number, to: number, t: number) =>
  from + angleDelta(from, to) * t;
export const motionProfile = {
  sampleRate: 30,
  minPlayback: 20,
  maxPlayback: 180,
  minCameraSpeed: 300,
  cameraSpeedMultiplier: 3,
  accelerationTime: 2,
  angularSpeed: 18,
  angularAcceleration: 24,
  pitchSpeed: 12,
  zoomSpeed: 0.5,
  obliquePitch: 60,
  minPitch: 0,
  maxPitch: 60,
  minZoom: 3,
  maxZoom: 16,
  minTransition: 1.5,
  maxTransition: 12,
  minCompletion: 1.5,
  maxCompletion: 5,
  uiInterval: 0.1,
};
