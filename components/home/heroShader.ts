/**
 * "Slash field": hairlines flowing along the logo's 64° slash, converging into a beam.
 * One fullscreen triangle, a handful of operations per pixel.
 */

export const HERO_VERTEX = /* glsl */ `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const HERO_FRAGMENT = /* glsl */ `
precision mediump float;

uniform float uTime;
uniform vec2 uRes;
uniform vec2 uPointer;
uniform vec2 uAnchor;

float hash(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = gl_FragCoord.xy / uRes.y;

  // Beam anchor sits right of centre and drifts gently with the pointer.
  vec2 anchor = vec2(aspect * uAnchor.x + uPointer.x * 0.035, uAnchor.y + uPointer.y * 0.02);

  // 64 degrees: the angle of the slash in the Aceva mark.
  const float A = 1.11701;
  vec2 dir = vec2(cos(A), sin(A));
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 d = p - anchor;
  float along = dot(d, dir);
  float across = dot(d, nrm);

  // The field breathes and bends slightly towards the pointer.
  across += 0.03 * sin(along * 3.1 + uTime * 0.32) * smoothstep(0.02, 0.5, abs(across));
  across += uPointer.x * 0.035 * exp(-along * along * 3.0);

  float lane = across * 72.0;
  float id = floor(lane + 0.5);
  float dist = abs(fract(lane + 0.5) - 0.5);
  float line = 1.0 - smoothstep(0.015, 0.075, dist);

  float r = hash(id + 3.7);
  float weight = 0.18 + 0.82 * r * r;
  float flow = sin(along * (4.0 + r * 7.0) - uTime * (0.55 + r * 1.25) + r * 40.0);
  float pulse = smoothstep(0.86, 1.0, flow);

  float env = exp(-across * across * 10.0);
  float alongEnv = 1.0 - smoothstep(0.25, 1.05, abs(along));
  float core = exp(-across * across * 5200.0) + 0.3 * exp(-across * across * 260.0);

  vec3 ink = vec3(0.039, 0.043, 0.055);
  vec3 blue = vec3(0.102, 0.235, 0.961);
  vec3 ice = vec3(0.561, 0.659, 1.0);

  vec3 col = ink;
  col += blue * 0.10 * exp(-across * across * 2.5) * alongEnv;
  col += blue * line * weight * env * alongEnv * 0.62;
  col += ice * line * pulse * env * alongEnv * 0.85;
  col += mix(blue, vec3(1.0), 0.6) * core * alongEnv * 0.85;

  // Keep the reading side calm: darken towards the text column.
  col = mix(ink, col, mix(0.28, 1.0, smoothstep(0.12, 0.62, p.x / aspect)));

  gl_FragColor = vec4(col, 1.0);
}
`;
