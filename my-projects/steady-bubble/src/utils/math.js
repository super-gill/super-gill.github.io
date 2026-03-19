'use strict';

export const TAU = Math.PI * 2;
export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const now = () => performance.now() / 1000;
export const jitter = (n = 1) => (Math.random() * 2 - 1) * n;
export const angleNorm = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
export const lerpAngle = (a, b, t) => a + angleNorm(b - a) * t;
export const deg2rad = (d) => d * Math.PI / 180;
