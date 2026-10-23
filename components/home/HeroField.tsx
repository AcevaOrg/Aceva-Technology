"use client";

import { useEffect, useRef } from "react";
import { HERO_FRAGMENT, HERO_VERTEX } from "./heroShader";

/** Where the beam crosses the hero, as fractions of width / height. Mirrors the CSS beam. */
const anchorFor = (width: number, height: number): [number, number] => [width / height <= 1.1 ? 0.9 : 0.76, 0.5];

/** Pixel budgets per quality step; the last step renders one still frame and stops. */
const PIXEL_BUDGETS = [1.1e6, 0.55e6];
const FRAME_INTERVAL = 1000 / 30; // the field moves slowly; 30fps is indistinguishable
const SLOW_FRAME = 1000 / 22; // average interval above this means the device is struggling
const SCROLL_PAUSE = 180;

function shouldRender(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (window.innerWidth < 768) return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  if (nav.hardwareConcurrency && nav.hardwareConcurrency < 4) return false;
  return true;
}

/**
 * Progressive enhancement over the static CSS beam in HomeHero. Renders the same empty
 * element on server and client (no hydration mismatch). The canvas is created after idle,
 * fades in over the static beam, and stays cheap: a pixel budget, 30fps, no drawing while
 * the page scrolls, paused off-screen or in a hidden tab, and it steps down in resolution,
 * then freezes on a still frame, if the device cannot keep up.
 */
export default function HeroField({ className }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !shouldRender()) return;

    let alive = true;
    let cleanup: (() => void) | undefined;

    const start = () => {
      import("ogl").then(({ Renderer, Program, Mesh, Triangle }) => {
        if (!alive || !mount.isConnected) return;

        let renderer: InstanceType<typeof Renderer>;
        try {
          renderer = new Renderer({
            dpr: 1,
            alpha: false,
            antialias: false,
            depth: false,
            powerPreference: "low-power",
          });
        } catch {
          return; // No WebGL: the static beam stays.
        }

        const gl = renderer.gl;
        const canvas = gl.canvas as HTMLCanvasElement;
        canvas.setAttribute("aria-hidden", "true");
        canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 1.4s cubic-bezier(.16,1,.3,1)";
        gl.clearColor(0.039, 0.043, 0.055, 1);

        const program = new Program(gl, {
          vertex: HERO_VERTEX,
          fragment: HERO_FRAGMENT,
          uniforms: {
            uTime: { value: 0 },
            uRes: { value: [1, 1] },
            uPointer: { value: [0, 0] },
            uAnchor: { value: [0.76, 0.5] },
          },
        });
        const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
        mount.appendChild(canvas);

        let quality = 0;
        let raf = 0;
        let running = false;
        let frozen = false;
        let shown = false;
        let lastDraw = 0;
        let sampleStart = 0;
        let sampleFrames = 0;
        let scrollingUntil = 0;
        const t0 = performance.now();

        // Pointer lives in plain variables; eased every frame, never React state.
        const target = [0, 0];
        const pointer = program.uniforms.uPointer.value as number[];

        const draw = (now: number) => {
          pointer[0] += (target[0] - pointer[0]) * 0.08;
          pointer[1] += (target[1] - pointer[1]) * 0.08;
          // Wrap time to keep mediump precision stable on long sessions.
          program.uniforms.uTime.value = ((now - t0) / 1000) % 600;
          renderer.render({ scene: mesh });
          if (!shown) {
            shown = true;
            canvas.style.opacity = "1";
          }
        };

        const fit = () => {
          const width = mount.clientWidth || 1;
          const height = mount.clientHeight || 1;
          const deviceScale = Math.min(window.devicePixelRatio || 1, 1.5);
          const budget = PIXEL_BUDGETS[Math.min(quality, PIXEL_BUDGETS.length - 1)];
          renderer.dpr = Math.min(deviceScale, Math.sqrt(budget / (width * height)));
          renderer.setSize(width, height);
          program.uniforms.uRes.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
          program.uniforms.uAnchor.value = anchorFor(width, height);
          // Resizing clears the canvas; a frozen field still needs its still frame.
          if (frozen) draw(performance.now());
        };
        fit();
        const resizeObserver = new ResizeObserver(fit);
        resizeObserver.observe(mount);

        const onPointer = (event: PointerEvent) => {
          target[0] = (event.clientX / window.innerWidth) * 2 - 1;
          target[1] = -((event.clientY / window.innerHeight) * 2 - 1);
        };
        window.addEventListener("pointermove", onPointer, { passive: true });

        const onScroll = () => {
          scrollingUntil = performance.now() + SCROLL_PAUSE;
        };
        window.addEventListener("scroll", onScroll, { passive: true });

        const frame = (now: number) => {
          if (!running) return;
          raf = requestAnimationFrame(frame);
          if (now < scrollingUntil) {
            sampleFrames = 0; // scrolling skews the pacing sample
            return;
          }
          if (now - lastDraw < FRAME_INTERVAL - 2) return;
          lastDraw = now;
          draw(now);

          // Adaptive quality: judge the real pacing over ~2s of uninterrupted drawing.
          if (sampleFrames === 0) sampleStart = now;
          sampleFrames += 1;
          if (sampleFrames === 60) {
            const average = (now - sampleStart) / 59;
            sampleFrames = 0;
            if (average > SLOW_FRAME) {
              quality += 1;
              if (quality >= PIXEL_BUDGETS.length) {
                frozen = true;
                running = false;
                cancelAnimationFrame(raf);
              } else {
                fit();
              }
            }
          }
        };

        let onScreen = true;
        const sync = () => {
          const shouldRun = !frozen && onScreen && document.visibilityState === "visible";
          if (shouldRun && !running) {
            running = true;
            sampleFrames = 0;
            raf = requestAnimationFrame(frame);
          } else if (!shouldRun && running) {
            running = false;
            cancelAnimationFrame(raf);
          }
        };

        const visibilityObserver = new IntersectionObserver(([entry]) => {
          onScreen = entry.isIntersecting;
          sync();
        });
        visibilityObserver.observe(mount);
        document.addEventListener("visibilitychange", sync);
        sync();

        cleanup = () => {
          running = false;
          cancelAnimationFrame(raf);
          visibilityObserver.disconnect();
          resizeObserver.disconnect();
          document.removeEventListener("visibilitychange", sync);
          window.removeEventListener("pointermove", onPointer);
          window.removeEventListener("scroll", onScroll);
          gl.getExtension("WEBGL_lose_context")?.loseContext();
          canvas.remove();
        };
      });
    };

    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(start, { timeout: 1500 })
      : window.setTimeout(start, 400);

    return () => {
      alive = false;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      cleanup?.();
    };
  }, []);

  return <div ref={mountRef} aria-hidden="true" className={className} />;
}
