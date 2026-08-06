"use client";

import { useEffect, useRef } from "react";

const OGL_VERT = `attribute vec2 position; attribute vec2 uv; varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

const OGL_FRAG = `precision highp float;
uniform float uTime;
uniform vec2 uAspect;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 uv = vUv;
  float t = uTime * 0.06;
  float q = noise(vec2(uv.x * 1.8 + t, uv.y * 1.8 - t * 0.7));
  float w = noise(vec2(uv.x * 3.0 - t * 0.9, uv.y * 3.0 + t * 0.5) + q * 1.6);
  vec3 deep = vec3(0.039, 0.059, 0.122);
  vec3 mid  = vec3(0.055, 0.118, 0.247);
  vec3 lift = vec3(0.086, 0.188, 0.361);
  vec3 col = mix(deep, mid, smoothstep(0.3, 0.72, w));
  col = mix(col, lift, smoothstep(0.62, 0.95, w) * 0.5);
  float vig = 1.0 - smoothstep(0.55, 1.1, length((uv - 0.5) * vec2(uAspect.x, 1.0)) * 1.15);
  col *= vig;
  gl_FragColor = vec4(col, 1.0);
}`;

export default function HeroCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < 720) return;

    let alive = true;
    let cleanup: (() => void) | undefined;

    import("ogl").then(({ Renderer, Transform, Camera, Triangle, Program, Mesh }) => {
      if (!alive || !mount.isConnected) return;

      const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2), alpha: true });
      const gl = renderer.gl;
      const canvas = gl.canvas as HTMLCanvasElement;
      canvas.style.position = "absolute";
      canvas.style.inset = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.pointerEvents = "none";
      mount.appendChild(canvas);
      mount.style.display = "block";

      const scene = new Transform();
      const camera = new Camera(gl);
      const geometry = new Triangle(gl);
      const program = new Program(gl, {
        vertex: OGL_VERT,
        fragment: OGL_FRAG,
        uniforms: { uTime: { value: 0 }, uAspect: { value: [1, 1] } },
      });
      const mesh = new Mesh(gl, { geometry, program });
      mesh.setParent(scene);

      const fit = () => {
        const w = mount.clientWidth || window.innerWidth;
        const h = mount.clientHeight || 480;
        renderer.setSize(w, h);
        program.uniforms.uAspect.value = [w / h, 1];
      };
      fit();
      window.addEventListener("resize", fit);

      let raf = 0;
      const tick = (t: number) => {
        if (!alive) return;
        program.uniforms.uTime.value = t * 0.001;
        renderer.render({ scene, camera });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        window.removeEventListener("resize", fit);
        cancelAnimationFrame(raf);
        canvas.remove();
      };
    });

    return () => {
      alive = false;
      cleanup?.();
    };
  }, []);

  return <div ref={mountRef} aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", display: "none" }} />;
}
