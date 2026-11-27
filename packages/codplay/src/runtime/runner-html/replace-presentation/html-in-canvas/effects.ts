/**
 * HTML-in-Canvas transition effects, written for WebGPU (WGSL).
 *
 * Every effect shares one prelude: the uniforms, the two DOM state textures
 * (`getFromColor` / `getToColor`, view coordinates 0..1 with a top-left
 * origin) and a canvas-covering vertex stage. A shader effect only defines
 * `transition(uv)`; a mesh effect draws the incoming state, then its own
 * geometry of the outgoing state. Effects are drawn in order with premultiplied
 * "over" blending.
 */

/** Names of the effects drawn by the HTML-in-Canvas renderer. */
export const HTML_IN_CANVAS_EFFECTS = ['burn', 'ripple', 'pixelate', 'swirl', 'shatter', 'fold'] as const

export type HtmlInCanvasEffectName = (typeof HTML_IN_CANVAS_EFFECTS)[number]

/** One draw call of an effect: its entry points and how many vertices/instances it emits. */
type HtmlInCanvasDraw = Readonly<{
  vertex: string
  fragment: string
  vertexCount: number
}>

/** One effect: its WGSL source (prelude excluded) and its ordered draw calls. */
type HtmlInCanvasEffect = Readonly<{
  code: string
  draws: readonly HtmlInCanvasDraw[]
}>

/** Byte size of the uniform block declared by the prelude. */
export const HTML_IN_CANVAS_UNIFORM_BYTES = 16 * 4

const PRELUDE = /* wgsl */ `
struct Uniforms {
  progress: f32,
  ratio: f32,
  reserved: vec2f,
  view: vec4f,
  fromMap: vec4f,
  toMap: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var viewSampler: sampler;
@group(0) @binding(2) var fromTexture: texture_2d<f32>;
@group(0) @binding(3) var toTexture: texture_2d<f32>;

struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) alpha: f32,
  @location(2) shade: f32,
}

const PI = 3.14159265;

fn inView(uv: vec2f) -> bool {
  return all(uv >= vec2f(0.0)) && all(uv <= vec2f(1.0));
}

// A state map turns view coordinates into texture coordinates: offset in xy, scale in zw.
fn sampleState(stateTexture: texture_2d<f32>, map: vec4f, uv: vec2f) -> vec4f {
  let coordinates = map.xy + uv * map.zw;
  let color = textureSampleLevel(stateTexture, viewSampler, coordinates, 0.0);
  return select(vec4f(0.0), color, inView(uv) && inView(coordinates));
}

fn getFromColor(uv: vec2f) -> vec4f {
  return sampleState(fromTexture, u.fromMap, uv);
}

fn getToColor(uv: vec2f) -> vec4f {
  return sampleState(toTexture, u.toMap, uv);
}

fn viewToClip(uv: vec2f) -> vec4f {
  let canvasUV = (uv - u.view.xy) / u.view.zw;
  return vec4f(canvasUV.x * 2.0 - 1.0, 1.0 - canvasUV.y * 2.0, 0.0, 1.0);
}

fn quadCorner(index: u32) -> vec2f {
  var corners = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
  );
  return corners[index];
}

fn hash(point: vec2f) -> f32 {
  return fract(sin(dot(point, vec2f(127.1, 311.7))) * 43758.5453);
}

fn noise(point: vec2f) -> f32 {
  let cell = floor(point);
  var offset = fract(point);
  offset = offset * offset * (3.0 - 2.0 * offset);
  let lower = mix(hash(cell), hash(cell + vec2f(1.0, 0.0)), offset.x);
  let upper = mix(hash(cell + vec2f(0.0, 1.0)), hash(cell + vec2f(1.0, 1.0)), offset.x);
  return mix(lower, upper, offset.y);
}

@vertex fn vsCanvas(@builtin(vertex_index) index: u32) -> Varyings {
  let corner = quadCorner(index);
  var result: Varyings;
  result.position = vec4f(corner.x * 2.0 - 1.0, 1.0 - corner.y * 2.0, 0.0, 1.0);
  result.uv = u.view.xy + corner * u.view.zw;
  result.alpha = 1.0;
  result.shade = 1.0;
  return result;
}

@fragment fn fsIncoming(input: Varyings) -> @location(0) vec4f {
  return getToColor(input.uv);
}
`

const CANVAS_TRANSITION = /* wgsl */ `
@fragment fn fsTransition(input: Varyings) -> @location(0) vec4f {
  if (!inView(input.uv)) { return vec4f(0.0); }
  return transition(input.uv);
}
`

const TRANSITION_DRAW: HtmlInCanvasDraw = { vertex: 'vsCanvas', fragment: 'fsTransition', vertexCount: 6 }
const INCOMING_DRAW: HtmlInCanvasDraw = { vertex: 'vsCanvas', fragment: 'fsIncoming', vertexCount: 6 }

const SHATTER_COLUMNS = 10
const SHATTER_ROWS = 7
const FOLD_STRIPS = 24

/** WGSL sources and draw calls of every HTML-in-Canvas effect. */
export const HTML_IN_CANVAS_EFFECT_DEFINITIONS: Readonly<Record<HtmlInCanvasEffectName, HtmlInCanvasEffect>> = {
  // A noisy diagonal front burns the outgoing view, with embers on its edge.
  burn: {
    code: /* wgsl */ `
fn transition(uv: vec2f) -> vec4f {
  let threshold = 0.55 * length(uv) / sqrt(2.0) + 0.45 * noise(uv * 6.0);
  let edge = u.progress * 1.3 - 0.14 - threshold;
  let fromColor = getFromColor(uv);
  let toColor = getToColor(uv);
  if (edge > 0.0) {
    let hot = 1.0 - smoothstep(0.0, 0.05, edge);
    return toColor + vec4f(1.0, 0.45, 0.1, 0.0) * hot * 0.5 * toColor.a;
  }
  let charred = smoothstep(-0.09, -0.02, edge);
  let glow = smoothstep(-0.035, 0.0, edge);
  let ember = mix(vec3f(1.0, 0.25, 0.02), vec3f(1.0, 0.85, 0.35), glow);
  return vec4f(fromColor.rgb * (1.0 - 0.9 * charred) + ember * glow * fromColor.a, fromColor.a);
}
${CANVAS_TRANSITION}`,
    draws: [TRANSITION_DRAW],
  },
  // Concentric waves distort both views while the incoming one spreads from the center.
  ripple: {
    code: /* wgsl */ `
fn transition(uv: vec2f) -> vec4f {
  let aspect = vec2f(u.ratio, 1.0);
  let delta = (uv - vec2f(0.5)) * aspect;
  let distance = length(delta);
  let direction = delta / max(distance, 0.0001);
  let wave = sin(distance * 48.0 - u.progress * 24.0) * 0.025 * sin(u.progress * PI);
  let sampled = uv + direction / aspect * wave;
  let front = smoothstep(distance - 0.15, distance + 0.15, u.progress * 1.3 - 0.05);
  return mix(getFromColor(sampled), getToColor(sampled), front);
}
${CANVAS_TRANSITION}`,
    draws: [TRANSITION_DRAW],
  },
  // Pixels grow until the middle of the transition, then shrink on the incoming view.
  pixelate: {
    code: /* wgsl */ `
fn transition(uv: vec2f) -> vec4f {
  let strength = 1.0 - abs(u.progress * 2.0 - 1.0);
  let steps = mix(400.0, 14.0, strength);
  let grid = vec2f(steps * u.ratio, steps);
  let cell = (floor(uv * grid) + 0.5) / grid;
  let sampled = select(uv, cell, strength > 0.02);
  return mix(getFromColor(sampled), getToColor(sampled), smoothstep(0.4, 0.6, u.progress));
}
${CANVAS_TRANSITION}`,
    draws: [TRANSITION_DRAW],
  },
  // A vortex winds the whole view up to about three turns, switches to the
  // incoming view at its tightest point, then unwinds it. Its falloff reaches
  // zero exactly at the corners, and a slight zoom toward the center deepens
  // the pull without ever sampling outside the view.
  swirl: {
    code: /* wgsl */ `
const TURNS = 3.0;
const PEAK_ZOOM = 0.08;

fn transition(uv: vec2f) -> vec4f {
  let aspect = vec2f(u.ratio, 1.0);
  let winding = sin(u.progress * PI);
  let delta = (uv - vec2f(0.5)) * aspect * (1.0 - PEAK_ZOOM * winding);
  let falloff = max(0.0, 1.0 - length(delta) / (0.5 * length(aspect)));
  let angle = winding * winding * TURNS * 2.0 * PI * falloff * falloff;
  let c = cos(angle);
  let s = sin(angle);
  let sampled = vec2f(delta.x * c - delta.y * s, delta.x * s + delta.y * c) / aspect + vec2f(0.5);
  return mix(getFromColor(sampled), getToColor(sampled), smoothstep(0.48, 0.52, u.progress));
}
${CANVAS_TRANSITION}`,
    draws: [TRANSITION_DRAW],
  },
  // The outgoing view breaks into irregular shards that spin, fall and fade over the incoming one.
  shatter: {
    code: /* wgsl */ `
const COLUMNS = ${SHATTER_COLUMNS}u;
const ROWS = ${SHATTER_ROWS}u;

fn shatterPoint(point: vec2f) -> vec2f {
  let border = point.x <= 0.0 || point.y <= 0.0 || point.x >= f32(COLUMNS) || point.y >= f32(ROWS);
  let jitter = (vec2f(hash(point), hash(point + vec2f(17.0, 5.0))) - 0.5) * 0.6;
  return point + select(jitter, vec2f(0.0), border);
}

@vertex fn vsShatter(@builtin(vertex_index) index: u32) -> Varyings {
  let shard = index / 6u;
  let cell = vec2f(f32(shard % COLUMNS), f32(shard / COLUMNS));
  let size = vec2f(1.0 / f32(COLUMNS), 1.0 / f32(ROWS));
  let local = shatterPoint(cell + quadCorner(index % 6u)) * size;
  let center = (cell + 0.5) * size;
  let seed = hash(cell + vec2f(3.0, 11.0));
  let delay = seed * 0.3 + length(center - vec2f(0.5)) * 0.3;
  let t = clamp((u.progress - delay) / 0.55, 0.0, 1.0);
  let eased = t * t;
  let aspect = vec2f(u.ratio, 1.0);
  let away = normalize((center - vec2f(0.5)) * aspect + vec2f(0.0001)) / aspect * eased * 0.35;
  let angle = (seed - 0.5) * 4.0 * eased;
  let relative = (local - center) * aspect * (1.0 - 0.3 * eased);
  let rotated = vec2f(
    relative.x * cos(angle) - relative.y * sin(angle),
    relative.x * sin(angle) + relative.y * cos(angle),
  ) / aspect;
  var result: Varyings;
  result.position = viewToClip(center + rotated + away + vec2f(0.0, eased * eased * 0.6));
  result.uv = local;
  result.alpha = 1.0 - smoothstep(0.6, 1.0, t);
  result.shade = 1.0 - 0.3 * eased;
  return result;
}

@fragment fn fsShard(input: Varyings) -> @location(0) vec4f {
  let color = getFromColor(input.uv);
  return vec4f(color.rgb * input.shade, color.a) * input.alpha;
}
`,
    draws: [INCOMING_DRAW, { vertex: 'vsShatter', fragment: 'fsShard', vertexCount: SHATTER_COLUMNS * SHATTER_ROWS * 6 }],
  },
  // The outgoing view turns like a page on its left edge, revealing the incoming one.
  fold: {
    code: /* wgsl */ `
const STRIPS = ${FOLD_STRIPS}u;
const FOCAL = 2.4;

@vertex fn vsFold(@builtin(vertex_index) index: u32) -> Varyings {
  let corner = quadCorner(index % 6u);
  let x = (f32(index / 6u) + corner.x) / f32(STRIPS);
  let angle = min(u.progress, 1.0) * PI * 0.5;
  let depth = x * u.ratio * sin(angle);
  let perspective = FOCAL / (FOCAL + depth);
  let turned = vec2f(x * cos(angle) * perspective, 0.5 + (corner.y - 0.5) * perspective);
  var result: Varyings;
  result.position = viewToClip(turned);
  result.uv = vec2f(x, corner.y);
  result.alpha = 1.0 - smoothstep(0.85, 1.0, u.progress);
  result.shade = 1.0 - 0.45 * sin(angle);
  return result;
}

@fragment fn fsPage(input: Varyings) -> @location(0) vec4f {
  let color = getFromColor(input.uv);
  return vec4f(color.rgb * input.shade, color.a) * input.alpha;
}
`,
    draws: [INCOMING_DRAW, { vertex: 'vsFold', fragment: 'fsPage', vertexCount: FOLD_STRIPS * 6 }],
  },
}

/** Returns the full WGSL module of one effect. */
export function createHtmlInCanvasEffectModule(effect: HtmlInCanvasEffect): string {
  return `${PRELUDE}\n${effect.code}`
}

/** Checks one transition name drawn by the HTML-in-Canvas renderer. */
export function isHtmlInCanvasEffectName(value: unknown): value is HtmlInCanvasEffectName {
  return typeof value === 'string' && (HTML_IN_CANVAS_EFFECTS as readonly string[]).includes(value)
}
