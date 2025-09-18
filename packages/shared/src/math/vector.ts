export interface Vector2 {
  x: number;
  y: number;
}

export function createVector(x: number = 0, y: number = 0): Vector2 {
  return { x, y };
}

export function addVectors(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtractVectors(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scaleVector(v: Vector2, s: number): Vector2 {
  return { x: v.x * s, y: v.y * s };
}

export function vectorLength(v: Vector2): number {
  return Math.hypot(v.x, v.y);
}

export function normalizeVector(v: Vector2): Vector2 {
  const len = vectorLength(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}
