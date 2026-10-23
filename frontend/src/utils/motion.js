// Small animation / chart helpers for the home page charts (no chart library, so the home page stays light).
import { useEffect, useRef, useState } from 'react';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True once the element behind `ref` has scrolled into view (and stays true). */
export function useInView(ref, threshold = 0.25) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, inView, threshold]);
  return inView;
}

/** Content-box width of the element behind `ref`, kept up to date on resize (0 until measured). */
export function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/** Eases a number towards `target` (from wherever it currently is); jumps straight there with reduced motion. */
export function useTween(target, { duration = 900, active = true } = {}) {
  const [value, setValue] = useState(0);
  const cur = useRef(0);
  useEffect(() => {
    if (!active) return undefined;
    if (prefersReducedMotion()) {
      cur.current = target;
      setValue(target);
      return undefined;
    }
    const from = cur.current;
    const t0 = performance.now();
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      cur.current = from + (target - from) * (1 - Math.pow(1 - p, 3));
      setValue(cur.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return value;
}

/** Round axis bounds and evenly spaced ticks covering [min, max]. */
export function niceTicks(min, max, count = 4) {
  const raw = (max - min || Math.abs(max) || 1) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return { lo, hi, ticks };
}

const r1 = (n) => Math.round(n * 10) / 10;

/** Smooth SVG path through [x, y] points (monotone cubic, so the curve never overshoots the data). */
export function monotonePath(pts) {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${r1(pts[0][0])},${r1(pts[0][1])}`;
  const dx = [];
  const m = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${r1(pts[i][0] + h)},${r1(pts[i][1] + t[i] * h)} ${r1(pts[i + 1][0] - h)},${r1(pts[i + 1][1] - t[i + 1] * h)} ${r1(pts[i + 1][0])},${r1(pts[i + 1][1])}`;
  }
  return d;
}

/** Index of the data point nearest to a pointer event over a chart plotted from padLeft to width - padRight. */
export function nearestIndex(e, count, width, padLeft, padRight) {
  const r = e.currentTarget.getBoundingClientRect();
  const px = ((e.clientX - r.left) * width) / (r.width || 1);
  const i = Math.round(((px - padLeft) / (width - padLeft - padRight)) * (count - 1));
  return Math.max(0, Math.min(count - 1, i));
}

/** Up to `max` evenly spread label indices, always including the first and last. */
export function labelIndices(count, max = 6) {
  if (count <= max) return [...Array(count).keys()];
  const step = Math.ceil((count - 1) / (max - 1));
  const out = [];
  for (let i = 0; i < count - 1; i += step) out.push(i);
  if (count - 1 - out[out.length - 1] < step / 2) out.pop();
  out.push(count - 1);
  return out;
}
