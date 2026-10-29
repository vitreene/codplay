import { n as e, r as t } from "./rolldown-runtime-Dqa2HsxW.js";
import { BaseComponent as n, BaseHTMLComponent as r } from "codplay";
//#region ../authoring/component-v2/src/threejs/core/threejs-component.ts
var i = class extends n {
	runtime;
	constructor(e) {
		super(e), this.runtime = e.runtime.getLibrary("three");
	}
}, a = class extends r {
	runtime;
	constructor(e) {
		super(e), this.runtime = e.runtime.getLibrary("three");
	}
}, o = class extends i {
	static declaredServices = [];
	camera;
	cameraKind;
	target;
	attachedScene;
	update(e) {
		let t = e.target;
		this.attachedScene !== void 0 && this.attachedScene !== t.scene && this.detach();
		let n = e.state;
		(this.camera === void 0 || this.cameraKind !== (n.kind ?? "perspective")) && (this.detach(), this.camera = s(this.runtime, n), this.cameraKind = n.kind ?? "perspective"), this.target = t, this.attachedScene = t.scene, c(this.camera, n, this.runtime), t.setCamera(this.camera);
	}
	destroy() {
		this.detach(), this.camera = void 0;
	}
	detach() {
		this.camera !== void 0 && this.attachedScene !== void 0 && this.attachedScene.remove(this.camera), this.target !== void 0 && this.target.scene === this.attachedScene && this.target.setCamera(null), this.target = void 0, this.attachedScene = void 0;
	}
};
function s(e, t) {
	return t.kind === "orthographic" ? new e.OrthographicCamera(t.left ?? -1, t.right ?? 1, t.top ?? 1, t.bottom ?? -1, t.near ?? .1, t.far ?? 100) : new e.PerspectiveCamera(t.fov ?? 50, 1, t.near ?? .1, t.far ?? 100);
}
function c(e, t, n) {
	t.position !== void 0 && e.position.set(...t.position), t.lookAt !== void 0 && e.lookAt(new n.Vector3(...t.lookAt));
	let r = e;
	typeof r.fov == "number" && t.fov !== void 0 && (r.fov = t.fov), typeof r.near == "number" && t.near !== void 0 && (r.near = t.near), typeof r.far == "number" && t.far !== void 0 && (r.far = t.far), r.updateProjectionMatrix?.();
}
//#endregion
//#region src/shared/is-plain-record.ts
function l(e) {
	if (typeof e != "object" || !e || Array.isArray(e)) return !1;
	let t = Object.getPrototypeOf(e);
	return t === Object.prototype || t === null;
}
//#endregion
//#region src/runtime/components/component-validation.ts
function u(e, t, n, r) {
	e.diagnostics.error(t, n, {
		refs: e.refs,
		context: { path: r === void 0 ? e.path : `${e.path}.${r}` }
	});
}
function d(e) {
	return l(e);
}
//#endregion
//#region ../authoring/component-v2/src/threejs/core/threejs-validation.ts
function f(e, t, n) {
	let r = e[t];
	r !== void 0 && (typeof r == "number" && Number.isFinite(r) || u(n, "AUTHOR_THREEJS_NUMBER_INVALID", `${t} must be a finite number.`, t));
}
function p(e, t, n) {
	let r = e[t];
	r !== void 0 && (Array.isArray(r) && r.length === 3 && r.every((e) => typeof e == "number" && Number.isFinite(e)) || u(n, "AUTHOR_THREEJS_VECTOR_INVALID", `${t} must contain three finite numbers.`, t));
}
function m(e, t) {
	p(e, "position", t), p(e, "lookAt", t);
	for (let n of [
		"fov",
		"near",
		"far",
		"left",
		"right",
		"top",
		"bottom"
	]) f(e, n, t);
}
var h = (e, t) => {
	if (!d(e)) {
		u(t, "AUTHOR_THREE_SCENE_INITIAL_INVALID", "Three.js scene host initial state must be a plain object.");
		return;
	}
	f(e, "width", t), f(e, "height", t), e.background !== void 0 && typeof e.background != "string" && (typeof e.background != "number" || !Number.isFinite(e.background)) && u(t, "AUTHOR_THREEJS_COLOR_INVALID", "background must be a string or a finite number.", "background"), e.renderer !== void 0 && (d(e.renderer) ? f(e.renderer, "pixelRatio", t) : u(t, "AUTHOR_THREEJS_RENDERER_INVALID", "renderer must be a plain object.", "renderer"));
}, g = (e, t) => {
	if (!d(e)) {
		u(t, "AUTHOR_THREE_CAMERA_INVALID", "Three.js camera state must be a plain object.");
		return;
	}
	e.kind !== void 0 && e.kind !== "perspective" && e.kind !== "orthographic" && u(t, "AUTHOR_THREE_CAMERA_KIND_INVALID", "kind must be \"perspective\" or \"orthographic\".", "kind"), m(e, t);
}, _ = (e, t) => {
	if (!d(e)) {
		u(t, "AUTHOR_THREE_LIGHT_INVALID", "Three.js light state must be a plain object.");
		return;
	}
	t.target === "initial" && e.kind !== "ambient" && e.kind !== "directional" && e.kind !== "point" && u(t, "AUTHOR_THREE_LIGHT_KIND_INVALID", "kind must be \"ambient\", \"directional\" or \"point\".", "kind"), f(e, "intensity", t), f(e, "distance", t), f(e, "decay", t), p(e, "position", t);
};
function v(e) {
	return {
		...e,
		width: e.width ?? 640,
		height: e.height ?? 480
	};
}
//#endregion
//#region ../authoring/component-v2/src/threejs/core/camera/three-camera-definition.ts
var y = {
	type: "three-camera",
	component: o,
	modules: [],
	runtimeProfile: "attached",
	libraries: ["three"],
	validateInitial: g,
	validateAction: g
}, b = class extends i {
	static declaredServices = [];
	light;
	lightKind;
	attachedScene;
	update(e) {
		let t = e.target;
		this.attachedScene !== void 0 && this.attachedScene !== t.scene && this.detach();
		let n = e.state, r = n.kind;
		(this.light === void 0 || this.lightKind !== r) && (this.detach(), this.light = x(this.runtime, n), this.lightKind = r), this.attachedScene = t.scene, this.light.parent !== t.scene && t.scene.add(this.light), S(this.light, n);
	}
	destroy() {
		this.detach(), this.light = void 0, this.lightKind = void 0;
	}
	detach() {
		this.light !== void 0 && this.attachedScene !== void 0 && this.attachedScene.remove(this.light), this.attachedScene = void 0;
	}
};
function x(e, t) {
	let n = t.color ?? 16777215;
	return t.kind === "directional" ? new e.DirectionalLight(n, t.intensity ?? 1) : t.kind === "point" ? new e.PointLight(n, t.intensity ?? 1, t.distance ?? 0, t.decay ?? 2) : new e.AmbientLight(n, t.intensity ?? 1);
}
function S(e, t) {
	t.color !== void 0 && e.color.set(t.color), t.intensity !== void 0 && (e.intensity = t.intensity), t.position !== void 0 && e.position.set(...t.position), t.castShadow !== void 0 && "castShadow" in e && (e.castShadow = t.castShadow), "distance" in e && t.distance !== void 0 && (e.distance = t.distance), "decay" in e && t.decay !== void 0 && (e.decay = t.decay);
}
//#endregion
//#region ../authoring/component-v2/src/threejs/core/light/three-light-definition.ts
var C = {
	type: "three-light",
	component: b,
	modules: [],
	runtimeProfile: "attached",
	libraries: ["three"],
	validateInitial: _,
	validateAction: _
}, w = class extends a {
	static declaredServices = [];
	renderer;
	scene;
	camera = null;
	target;
	resizeObserver;
	render() {
		return "<canvas data-codplay-threejs=\"scene\"></canvas>";
	}
	initialize() {
		if (this.node === null) throw Error(`Three.js scene host is not materialized: ${this.perso.id}`);
		let e = this.perso.initial, t = this.node, n = T(e.width, 640), r = T(e.height, 480);
		t.width = n, t.height = r;
		let i = new this.runtime.WebGLRenderer({
			canvas: t,
			alpha: e.renderer?.alpha ?? !0,
			antialias: e.renderer?.antialias ?? !0,
			preserveDrawingBuffer: e.renderer?.preserveDrawingBuffer ?? !1
		});
		i.setPixelRatio(E(e.renderer?.pixelRatio)), i.setSize(n, r, !1);
		let a = new this.runtime.Scene();
		this.renderer = i, this.scene = a, this.target = {
			scene: a,
			renderer: i,
			getCamera: () => this.camera,
			setCamera: (e) => this.setCamera(e),
			resize: (e, t) => this.resize(e, t),
			render: () => this.renderFrame()
		}, this.applyBackground(e.background), this.observeResize(t);
	}
	getSceneTarget() {
		return this.target;
	}
	update(e) {
		this.applyBackground(e.state.background), e.registerAnimation?.({
			id: "three-scene-render",
			startAt: 0,
			endAt: 2 ** 53 - 1,
			presentationPhase: "commit",
			sample: (e) => ({
				value: e,
				apply: () => this.renderFrame()
			})
		});
	}
	destroy() {
		this.target = void 0, this.camera = null, this.resizeObserver?.disconnect(), this.resizeObserver = void 0, this.scene?.clear(), this.scene = void 0, this.renderer?.dispose(), this.renderer = void 0;
	}
	resize(e, t) {
		if (this.renderer === void 0) return;
		let n = T(e, 1), r = T(t, 1);
		this.renderer.setSize(n, r, !1), this.camera !== null && D(this.camera, n, r);
	}
	observeResize(e) {
		typeof ResizeObserver > "u" || (this.resizeObserver = new ResizeObserver(([t]) => {
			let n = t?.contentRect.width ?? e.clientWidth, r = t?.contentRect.height ?? e.clientHeight;
			n > 0 && r > 0 && this.resize(n, r);
		}), this.resizeObserver.observe(e));
	}
	setCamera(e) {
		this.scene !== void 0 && (this.camera !== null && this.camera !== e && this.scene.remove(this.camera), this.camera = e, e !== null && e.parent !== this.scene && this.scene.add(e), e !== null && D(e, this.renderer?.domElement.width ?? 1, this.renderer?.domElement.height ?? 1));
	}
	applyBackground(e) {
		this.scene === void 0 || typeof e != "string" && typeof e != "number" || (this.scene.background = new this.runtime.Color(e));
	}
	renderFrame() {
		this.renderer === void 0 || this.scene === void 0 || this.camera === null || this.renderer.render(this.scene, this.camera);
	}
};
function T(e, t) {
	return e === void 0 || !Number.isFinite(e) || e <= 0 ? t : Math.max(1, Math.round(e));
}
function E(e) {
	return e !== void 0 && Number.isFinite(e) && e > 0 ? e : typeof window > "u" ? 1 : Math.max(1, window.devicePixelRatio || 1);
}
function D(e, t, n) {
	let r = e;
	typeof r.aspect == "number" && (r.aspect = t / Math.max(1, n), r.updateProjectionMatrix?.());
}
//#endregion
//#region ../authoring/component-v2/src/threejs/core/host/three-scene-host-definition.ts
var O = {
	type: "three-scene-host",
	component: w,
	modules: [],
	libraries: ["three"],
	validateInitial: h,
	sanitizeInitial: v,
	targetProvider: (e) => {
		if (!(e instanceof w)) return;
		let t = e.getSceneTarget();
		return t === void 0 ? void 0 : {
			value: t,
			scope: "host"
		};
	}
}, k;
function A() {
	return k ??= Promise.resolve().then(() => em), k;
}
var ee = {
	libraries: { register: [{
		id: "three",
		load: A,
		origin: "foreign"
	}] },
	components: { register: [
		O,
		y,
		C
	] }
}, te = /* @__PURE__ */ new Map(), j = /* @__PURE__ */ new Map();
function ne(e, t) {
	if (te.has(e)) return Promise.resolve();
	let n = j.get(e);
	return n === void 0 && (n = M(e, t), j.set(e, n), n.then(() => {
		j.get(e) === n && j.delete(e);
	}, () => {
		j.get(e) === n && j.delete(e);
	})), ae(n, t).then(() => void 0);
}
var re = {
	"three-glb": ne,
	"three-fbx": ne
};
async function M(e, t) {
	let n = await A();
	return new Promise((r, i) => {
		let a = new n.FileLoader();
		a.setResponseType("arraybuffer");
		let o = !1, s = () => {
			t.removeEventListener("abort", c);
		}, c = () => {
			a.abort(), l(ie());
		}, l = (e) => {
			o || (o = !0, s(), i(e));
		};
		if (t.aborted) {
			l(ie());
			return;
		}
		t.addEventListener("abort", c, { once: !0 });
		try {
			a.load(e, (t) => {
				if (o) return;
				o = !0, s();
				let n = t;
				te.set(e, n), r(n);
			}, void 0, l);
		} catch (e) {
			l(e);
		}
	});
}
function ie() {
	let e = /* @__PURE__ */ Error("Three.js resource preload aborted.");
	return e.name = "AbortError", e;
}
function ae(e, t) {
	return t.aborted ? Promise.reject(ie()) : new Promise((n, r) => {
		let i = () => {
			t.removeEventListener("abort", i), r(ie());
		};
		t.addEventListener("abort", i, { once: !0 }), e.then((e) => {
			t.removeEventListener("abort", i), n(e);
		}, (e) => {
			t.removeEventListener("abort", i), r(e);
		});
	});
}
//#endregion
//#region ../authoring/component-v2/src/threejs/instanced-grid/three-instanced-grid-component.ts
var oe = class extends i {
	static declaredServices = [];
	mesh;
	geometry;
	material;
	scratch;
	layout;
	signature;
	attachedScene;
	update(e) {
		let t = e.target;
		this.attachedScene !== void 0 && this.attachedScene !== t.scene && this.detach();
		let n = e.state, r = ue(n);
		if ((this.mesh === void 0 || this.signature !== r) && (this.disposeMesh(), this.createMesh(n), this.signature = r), this.mesh === void 0 || this.layout === void 0 || this.scratch === void 0) return;
		this.mesh.parent !== t.scene && t.scene.add(this.mesh), this.attachedScene = t.scene;
		let i = se(e), a = i?.startAt ?? e.timeMs;
		if (i === void 0) {
			ce(this.mesh, this.layout, 0, n, this.scratch);
			return;
		}
		let o = {
			id: "three-instanced-grid-animation",
			startAt: a,
			endAt: 2 ** 53 - 1,
			sample: (e) => ({
				value: e,
				apply: () => {
					this.mesh !== void 0 && this.layout !== void 0 && this.scratch !== void 0 && ce(this.mesh, this.layout, Math.max(0, e - a), n, this.scratch);
				}
			})
		};
		e.registerAnimation?.(o);
	}
	destroy() {
		this.detach(), this.disposeMesh(), this.layout = void 0, this.scratch = void 0;
	}
	detach() {
		this.mesh !== void 0 && this.attachedScene !== void 0 && this.attachedScene.remove(this.mesh), this.attachedScene = void 0;
	}
	createMesh(e) {
		let t = de(e.gridSize), n = fe(e.cellSize, .5), r = new this.runtime.BoxGeometry(n, n, n), i = new this.runtime.MeshLambertMaterial({
			color: e.color ?? "#64748b",
			transparent: !0,
			opacity: pe(e.opacity)
		}), a = new this.runtime.InstancedMesh(r, i, t ** 3);
		a.castShadow = !0, a.receiveShadow = !0, this.geometry = r, this.material = i, this.mesh = a, this.layout = N(t, fe(e.delayMaxMs, 500)), this.scratch = new this.runtime.Object3D(), ce(a, this.layout, 0, e, this.scratch);
	}
	disposeMesh() {
		this.mesh?.parent?.remove(this.mesh), this.geometry?.dispose(), this.material?.dispose(), this.mesh = void 0, this.geometry = void 0, this.material = void 0, this.signature = void 0;
	}
};
function se(e) {
	let t = e.activeActions?.find((e) => e.action.animate === !0);
	return t === void 0 ? void 0 : { startAt: t.startAt };
}
function N(e, t) {
	let n = [], r = [], i = 2 / e, a = (e - 1) / 2 * i, o = (e - 1) / 2, s = Math.sqrt(o * o * 3);
	for (let c = 0; c < e; c += 1) for (let l = 0; l < e; l += 1) for (let u = 0; u < e; u += 1) {
		n.push({
			x: -a + u * i,
			y: -a + l * i,
			z: -a + c * i
		});
		let e = u - o, d = l - o, f = c - o, p = s === 0 ? 0 : Math.max(0, Math.min(1, Math.sqrt(e * e + d * d + f * f) / s));
		r.push((1 - p) ** 3 * t);
	}
	return {
		positions: n,
		delaysMs: r,
		spread: a
	};
}
function ce(e, t, n, r, i) {
	let a = fe(r.durationMs, 2e3), o = fe(r.holdMs, 500), s = fe(r.expansion, 4), c = fe(r.rotationPeriodMs, 9e3), l = fe(r.rotationXPeriodMs, 12e3);
	e.rotation.y = n / c * Math.PI * 2 % (Math.PI * 2), e.rotation.x = n / l * Math.PI * 2 % (Math.PI * 2), i.rotation.set(0, 0, 0), i.scale.set(1, 1, 1);
	for (let r = 0; r < t.positions.length; r += 1) {
		let c = t.positions[r], l = 1 + le(n, t.delaysMs[r] ?? 0, a, o) * (s - 1);
		i.position.set(c.x * l, c.y * l, c.z * l), i.updateMatrix(), e.setMatrixAt(r, i.matrix);
	}
	e.instanceMatrix.needsUpdate = !0;
}
function le(e, t, n, r) {
	let i = e - t;
	if (i <= 0) return 0;
	let a = n * 2 + r * 2, o = (i % a + a) % a;
	return o < n ? o / n : o < n + r ? 1 : o < n * 2 + r ? 1 - (o - n - r) / n : 0;
}
function ue(e) {
	return JSON.stringify([
		de(e.gridSize),
		fe(e.cellSize, .5),
		fe(e.delayMaxMs, 500),
		e.color ?? "#64748b",
		pe(e.opacity)
	]);
}
function de(e) {
	return e === void 0 || !Number.isFinite(e) ? 4 : Math.max(1, Math.min(32, Math.round(e)));
}
function fe(e, t) {
	return e !== void 0 && Number.isFinite(e) && e > 0 ? e : t;
}
function pe(e) {
	return e === void 0 || !Number.isFinite(e) ? .35 : Math.max(0, Math.min(1, e));
}
//#endregion
//#region ../authoring/component-v2/src/threejs/instanced-grid/three-instanced-grid-validation.ts
var me = (e, t) => {
	if (!d(e)) {
		u(t, "AUTHOR_THREE_GRID_INVALID", "Three.js instanced grid state must be a plain object.");
		return;
	}
	for (let n of [
		"gridSize",
		"cellSize",
		"expansion",
		"delayMaxMs",
		"durationMs",
		"holdMs",
		"rotationPeriodMs",
		"rotationXPeriodMs",
		"opacity"
	]) f(e, n, t);
	e.animate !== void 0 && typeof e.animate != "boolean" && u(t, "AUTHOR_THREE_GRID_ANIMATE_INVALID", "animate must be a boolean.", "animate");
};
function he(e) {
	return {
		...e,
		gridSize: e.gridSize ?? 4,
		cellSize: e.cellSize ?? .5,
		expansion: e.expansion ?? 4,
		delayMaxMs: e.delayMaxMs ?? 500,
		durationMs: e.durationMs ?? 2e3,
		holdMs: e.holdMs ?? 500,
		rotationPeriodMs: e.rotationPeriodMs ?? 9e3,
		rotationXPeriodMs: e.rotationXPeriodMs ?? 12e3,
		opacity: e.opacity ?? .35
	};
}
//#endregion
//#region ../authoring/component-v2/src/threejs/instanced-grid/three-instanced-grid-definition.ts
var ge = {
	type: "three-instanced-grid",
	component: oe,
	modules: [],
	runtimeProfile: "attached",
	libraries: ["three"],
	validateInitial: me,
	validateAction: me,
	sanitizeInitial: he
}, _e = /* @__PURE__ */ new Map(), ve = /* @__PURE__ */ new Map(), ye;
function be() {
	return ye ??= import("./rive-Sq5pmAo7.js").then((e) => /* @__PURE__ */ t(e.default, 1)).then(({ RuntimeLoader: e }) => e.awaitInstance()), ye;
}
function xe(e) {
	let t = _e.get(e);
	if (!t) throw Error(`Rive resource "${e}" was not preloaded.`);
	return t;
}
async function Se(e, t) {
	if (_e.has(e)) return;
	let n = ve.get(e);
	n || (n = P(e), ve.set(e, n), n.then(() => {
		ve.get(e) === n && ve.delete(e);
	}, () => {
		ve.get(e) === n && ve.delete(e);
	})), await we(n, t);
}
var Ce = { rive: Se };
async function P(e) {
	let t = await fetch(e);
	if (!t.ok) throw Error(`Unable to load Rive resource "${e}" (${t.status}).`);
	let n = await be(), r = {
		runtime: n,
		file: await n.load(new Uint8Array(await t.arrayBuffer()))
	};
	return _e.set(e, r), r;
}
function we(e, t) {
	return t.aborted ? Promise.reject(/* @__PURE__ */ Error("Rive resource preload aborted.")) : new Promise((n, r) => {
		let i = () => {
			t.removeEventListener("abort", i), r(/* @__PURE__ */ Error("Rive resource preload aborted."));
		};
		t.addEventListener("abort", i, { once: !0 }), e.then((e) => {
			t.removeEventListener("abort", i), n(e);
		}, (e) => {
			t.removeEventListener("abort", i), r(e);
		});
	});
}
//#endregion
//#region ../authoring/component-v2/src/rive/rive-document-component.ts
var Te = class e extends r {
	static declaredServices = [
		"className",
		"style",
		"attr"
	];
	runtime;
	resource = xe(this.perso.initial.src);
	initial = this.perso.initial;
	target;
	canvas;
	renderer;
	artboard;
	animationInstances = [];
	playback;
	lastTimeMs;
	revision = 0;
	constructor(t) {
		super(t), this.runtime = t.runtime.getLibrary("rive"), this.playback = this.initial.autoplay === !1 ? "paused" : "playing", this.target = {
			getRuntime: () => this.runtime,
			getArtboard: () => this.artboard,
			getRevision: () => this.revision
		}, this.services.declare(e.declaredServices);
	}
	render() {
		return "<canvas data-codplay-rive=\"document\"></canvas>";
	}
	initialize() {
		this.canvas = this.node, this.canvas.width = this.initial.width ?? 600, this.canvas.height = this.initial.height ?? 600, this.renderer = this.runtime.makeRenderer(this.canvas), this.createArtboard();
	}
	update(e) {
		if (this.services.apply(this.node, {
			className: e.state.className,
			style: e.state.style,
			attr: e.state.attr
		}), this.applyBroadcast(e.activeActions), e.registerAnimation) {
			e.registerAnimation(this.createResetAnimation()), e.registerAnimation(this.createAdvanceAnimation()), e.registerAnimation(this.createRenderAnimation());
			return;
		}
		this.advanceAt(e.timeMs), this.drawFrame();
	}
	destroy() {
		this.deleteArtboard(), this.renderer?.delete(), this.renderer = void 0, this.canvas = void 0;
	}
	getTarget() {
		return this.target;
	}
	createResetAnimation() {
		return {
			id: "rive-reset",
			startAt: 0,
			endAt: Infinity,
			sample: (e) => ({
				value: `${e}:${this.revision}`,
				apply: () => this.resetAt(e)
			})
		};
	}
	resetAt(e) {
		this.lastTimeMs !== void 0 && e < this.lastTimeMs && (this.createArtboard(), this.lastTimeMs = 0);
	}
	createAdvanceAnimation() {
		return {
			id: "rive-advance",
			startAt: 0,
			endAt: Infinity,
			presentationPhase: "commit",
			sample: (e) => ({
				value: `${e}:${this.revision}:${this.playback}`,
				apply: () => this.advanceAt(e)
			})
		};
	}
	createRenderAnimation() {
		return {
			id: "rive-render",
			startAt: 0,
			endAt: Infinity,
			presentationPhase: "commit",
			sample: (e) => ({
				value: `${e}:${this.revision}:${this.playback}`,
				apply: () => this.drawFrame()
			})
		};
	}
	createArtboard() {
		this.deleteArtboard();
		let e = this.initial.artboard, t = e ? this.resource.file.artboardByName(e) : this.resource.file.defaultArtboard();
		if (!t) throw Error(`Rive artboard "${e}" was not found.`);
		this.artboard = t, this.animationInstances = this.resolveAnimations(t), this.revision += 1;
	}
	resolveAnimations(e) {
		let t = this.initial.animations ? typeof this.initial.animations == "string" ? [this.initial.animations] : this.initial.animations : void 0;
		return (t ? t.map((t) => e.animationByName(t)) : Array.from({ length: e.animationCount() }, (t, n) => e.animationByIndex(n))).map((t) => new this.runtime.LinearAnimationInstance(t, e));
	}
	deleteArtboard() {
		for (let e of this.animationInstances) e.delete();
		this.animationInstances = [], this.artboard?.delete(), this.artboard = void 0;
	}
	applyBroadcast(e) {
		let t = [...e ?? []].reverse().find((e) => e.action.broadcast !== void 0)?.action.broadcast, n = typeof t == "object" && t ? t.type : void 0;
		n === "START" ? this.playback = "playing" : n === "PAUSE" ? this.playback = "paused" : n === "STOP" && (this.playback = "stopped", this.createArtboard(), this.lastTimeMs = 0);
	}
	advanceAt(e) {
		if (!this.artboard) return;
		this.lastTimeMs !== void 0 && e < this.lastTimeMs && (this.createArtboard(), this.lastTimeMs = 0);
		let t = Math.max(0, e - (this.lastTimeMs ?? e));
		if (this.playback === "playing" && t > 0) {
			let e = t / 1e3;
			for (let t of this.animationInstances) t.advance(e), t.apply(1);
			this.artboard.advance(e);
		}
		this.lastTimeMs = e;
	}
	drawFrame() {
		if (!this.canvas || !this.renderer || !this.artboard) return;
		let e = this.initial.fit ?? "contain", t = this.initial.alignment ?? "center", n = {
			minX: 0,
			minY: 0,
			maxX: this.canvas.width,
			maxY: this.canvas.height
		};
		this.renderer.clear(), this.renderer.save(), this.renderer.align(this.runtime.Fit[e], this.runtime.Alignment[t], n, this.artboard.bounds), this.artboard.draw(this.renderer), this.renderer.restore(), this.runtime.resolveAnimationFrame();
	}
}, Ee = class extends n {
	static declaredServices = [];
	initial = this.perso.initial;
	initialPlayback;
	target;
	stateMachine;
	targetRevision = -1;
	instanceRevision = 0;
	playback;
	lastTimeMs;
	activeActions = [];
	needsInputReplay = !1;
	constructor(e) {
		super(e), this.initialPlayback = this.resolveInitialPlayback(), this.playback = this.initialPlayback;
	}
	update(e) {
		let t = e.target;
		if (!this.ensureStateMachine(t)) return;
		let n = e.activeActions ?? [];
		if (this.activeActions = n, this.applyActions(n, e.timeMs), this.needsInputReplay = !1, e.registerAnimation) {
			e.registerAnimation(this.createAdvanceAnimation());
			return;
		}
		this.advanceAt(e.timeMs);
	}
	destroy() {
		this.stateMachine?.delete(), this.stateMachine = void 0, this.target = void 0, this.activeActions = [];
	}
	createAdvanceAnimation() {
		return {
			id: "rive-state-machine-advance",
			startAt: 0,
			endAt: Infinity,
			sample: (e) => ({
				value: `${e}:${this.targetRevision}:${this.instanceRevision}:${this.playback}`,
				apply: () => this.advanceAt(e)
			})
		};
	}
	applyActions(e, t) {
		for (let n of e) {
			let e = n.action, r = e.broadcast?.type;
			if (r === "START") this.playback = "playing", this.lastTimeMs = n.startAt;
			else if (r === "PAUSE") this.playback = "paused", this.lastTimeMs = t;
			else if (r === "STOP") {
				this.playback = "stopped", this.resetStateMachine(), this.lastTimeMs = t;
				continue;
			}
			this.playback === "paused" || this.playback === "stopped" || this.applyInputValues(this.resolveActionInputs(e));
		}
	}
	advanceAt(e) {
		if (!this.ensureStateMachine(this.target)) return;
		this.needsInputReplay &&= (this.replayInputs(), !1), this.lastTimeMs !== void 0 && e < this.lastTimeMs && (this.resetStateMachine(), this.replayInputs(), this.needsInputReplay = !1, this.lastTimeMs = 0);
		let t = Math.max(0, e - (this.lastTimeMs ?? e));
		this.playback === "playing" && t > 0 && this.stateMachine.advance(t / 1e3), this.lastTimeMs = e;
	}
	resetStateMachine() {
		let e = this.target, t = e?.getArtboard();
		!e || !t || (this.stateMachine?.delete(), this.stateMachine = this.createStateMachine(e, t), this.targetRevision = e.getRevision(), this.instanceRevision += 1, this.applyInputValues(this.initial.inputs), this.needsInputReplay = !0);
	}
	ensureStateMachine(e) {
		let t = e?.getArtboard();
		return !e || !t ? !1 : this.stateMachine !== void 0 && this.target === e && this.targetRevision === e.getRevision() ? !0 : (this.stateMachine?.delete(), this.target = e, this.targetRevision = e.getRevision(), this.stateMachine = this.createStateMachine(e, t), this.instanceRevision += 1, this.lastTimeMs = 0, this.applyInputValues(this.initial.inputs), this.needsInputReplay = !0, !0);
	}
	createStateMachine(e, t) {
		let n = t.stateMachineByName(this.initial.stateMachine), r = e.getRuntime().StateMachineInstance;
		return new r(n, t);
	}
	resolveInput(e) {
		if (!(e === void 0 || this.stateMachine === void 0)) for (let t = 0; t < this.stateMachine.inputCount(); t += 1) {
			let n = this.stateMachine.input(t);
			if (n.name === e) return n;
		}
	}
	resolveActionInputs(e) {
		return e.inputs;
	}
	applyInputValues(e) {
		if (e !== void 0) for (let [t, n] of Object.entries(e)) {
			let e = this.resolveInput(t);
			e !== void 0 && (e.value = n);
		}
	}
	replayInputs() {
		this.applyInputValues(this.initial.inputs);
		let e = this.initialPlayback === "playing";
		for (let t of this.activeActions) {
			let n = t.action, r = n.broadcast?.type;
			r === "START" && (e = !0), (r === "PAUSE" || r === "STOP") && (e = !1), e && this.applyInputValues(this.resolveActionInputs(n));
		}
	}
	resolveInitialPlayback() {
		for (let e of Object.values(this.perso.actions ?? {})) {
			if (typeof e != "object" || !e || Array.isArray(e)) continue;
			let t = e.broadcast?.type;
			if (t === "START" || t === "PAUSE" || t === "STOP") return "stopped";
		}
		return "playing";
	}
};
//#endregion
//#region ../authoring/component-v2/src/rive/rive-validation.ts
function F(e, t) {
	if (!d(e)) {
		u(t, "AUTHOR_RIVE_INITIAL_INVALID", "Rive initial state must be a plain object.");
		return;
	}
	(typeof e.src != "string" || e.src.length === 0) && u(t, "AUTHOR_RIVE_SRC_INVALID", "src must be a non-empty string.", "src"), e.artboard !== void 0 && typeof e.artboard != "string" && u(t, "AUTHOR_RIVE_ARTBOARD_INVALID", "artboard must be a string.", "artboard"), e.animations !== void 0 && typeof e.animations != "string" && (!Array.isArray(e.animations) || e.animations.some((e) => typeof e != "string")) && u(t, "AUTHOR_RIVE_ANIMATIONS_INVALID", "animations must be a string or an array of strings.", "animations");
}
function De(e, t) {
	if (!d(e)) {
		u(t, "AUTHOR_RIVE_ACTION_INVALID", "Rive action must be a plain object.");
		return;
	}
	let n = e.broadcast;
	n !== void 0 && (!d(n) || ![
		"START",
		"PAUSE",
		"STOP"
	].includes(String(n.type))) && u(t, "AUTHOR_RIVE_BROADCAST_INVALID", "broadcast.type must be START, PAUSE, or STOP.", "broadcast.type");
}
function I(e, t) {
	if (!d(e)) {
		u(t, "AUTHOR_RIVE_STATE_MACHINE_INITIAL_INVALID", "Rive state-machine initial state must be a plain object.");
		return;
	}
	(typeof e.stateMachine != "string" || e.stateMachine.length === 0) && u(t, "AUTHOR_RIVE_STATE_MACHINE_NAME_INVALID", "stateMachine must be a non-empty string.", "stateMachine"), Oe(e.inputs, t, "inputs");
}
function L(e, t) {
	De(e, t), d(e) && Oe(e.inputs, t, "inputs");
}
function Oe(e, t, n) {
	if (e !== void 0) {
		if (!d(e)) {
			u(t, "AUTHOR_RIVE_INPUTS_INVALID", `${n} must be a plain object.`, n);
			return;
		}
		for (let [r, i] of Object.entries(e)) (typeof i != "number" || !Number.isFinite(i)) && typeof i != "boolean" && u(t, "AUTHOR_RIVE_INPUT_VALUE_INVALID", `${n}.${r} must be a finite number or boolean.`, `${n}.${r}`);
	}
}
var ke = {
	libraries: { register: [{
		id: "rive",
		load: be,
		origin: "foreign"
	}] },
	components: { register: [{
		type: "rive",
		component: Te,
		modules: [],
		libraries: ["rive"],
		validateInitial: F,
		validateAction: De,
		targetProvider: (e) => {
			if (e instanceof Te) return {
				value: e.getTarget(),
				scope: "host"
			};
		}
	}, {
		type: "rive-state-machine",
		component: Ee,
		modules: [],
		libraries: ["rive"],
		runtimeProfile: "attached",
		validateInitial: I,
		validateAction: L
	}] }
}, Ae = Object.entries({
	neutral: {
		_description: "Default relaxed state with no strong emotion — use to reset after any mood",
		_tags: [
			"calm",
			"default",
			"reset"
		],
		_track: "mood"
	},
	happy: {
		_description: "Warm positive mood with subtle smile and upbeat energy",
		_tags: [
			"joy",
			"positive",
			"warm"
		],
		_track: "mood",
		_detect: {
			mouthSmileLeft: .5,
			mouthSmileRight: .5
		},
		_react: {
			mood: "happy",
			intensity: .3,
			gesture: "slight_smile"
		}
	},
	sleep: {
		_description: "Eyes closed, slow breathing, drowsy head sway — deep sleep or very tired",
		_tags: [
			"tired",
			"sleeping",
			"rest"
		],
		_track: "mood",
		dt: [
			1e3,
			3e3,
			1e3
		],
		vs: {
			eyeBlinkLeft: [.9],
			eyeBlinkRight: [.9],
			eyeSquintLeft: [.5],
			eyeSquintRight: [.5],
			browDownLeft: [.2],
			browDownRight: [.2],
			jawOpen: [.05]
		},
		_detect: {
			eyeBlinkLeft: .4,
			eyeBlinkRight: .4,
			eyeSquintLeft: .1,
			eyeSquintRight: .1
		},
		_react: {
			mood: "sleep",
			intensity: .3,
			gesture: "close_eyes"
		}
	},
	wave_right: {
		_description: "Friendly wave with right hand oscillation and warm smile",
		_tags: [
			"greeting",
			"friendly",
			"hand"
		],
		dt: [
			300,
			2500,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			mouthSmile: [.6],
			eyeSquintLeft: [.3],
			eyeSquintRight: [.3],
			browInnerUp: [.3],
			gesture: [[
				"handup",
				null,
				!0
			], null]
		},
		_overlay: {
			bones: {
				RightHand: {
					freq: 8,
					amp: [
						0,
						.12,
						.12
					],
					phase: 0
				},
				RightForeArm: {
					freq: 8,
					amp: [
						.04,
						0,
						.08
					],
					phase: 1.5707963267948966
				}
			},
			delay: 400,
			duration: 2500
		},
		_track: "action"
	},
	wave_left: {
		_description: "Friendly wave with left hand oscillation and warm smile",
		_tags: [
			"greeting",
			"friendly",
			"hand"
		],
		dt: [
			300,
			2500,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			mouthSmile: [.6],
			eyeSquintLeft: [.3],
			eyeSquintRight: [.3],
			browInnerUp: [.3],
			gesture: [[
				"handup",
				null,
				!1
			], null]
		},
		_overlay: {
			bones: {
				LeftHand: {
					freq: 8,
					amp: [
						0,
						.12,
						.12
					],
					phase: 0
				},
				LeftForeArm: {
					freq: 8,
					amp: [
						.04,
						0,
						.08
					],
					phase: 1.5707963267948966
				}
			},
			delay: 400,
			duration: 2500
		},
		_track: "action"
	},
	thumbup_right: {
		_description: "Enthusiastic thumbs up with big smile and raised eyebrows",
		_tags: [
			"approval",
			"positive",
			"hand",
			"happy"
		],
		dt: [
			300,
			2e3,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			mouthSmile: [.6],
			browInnerUp: [.4],
			eyeSquintLeft: [.4],
			eyeSquintRight: [.4],
			noseSneerLeft: [.3],
			noseSneerRight: [.3],
			gesture: [[
				"thumbup",
				null,
				!0
			], null]
		},
		_track: "action"
	},
	thumbdown_right: {
		_description: "Disapproving thumbs down with frown and furrowed brows",
		_tags: [
			"disapproval",
			"negative",
			"hand",
			"sad"
		],
		dt: [
			300,
			2e3,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browDownLeft: [.8],
			browDownRight: [.8],
			mouthFrownLeft: [.7],
			mouthFrownRight: [.7],
			bodyRotateX: [.1],
			gesture: [[
				"thumbdown",
				null,
				!0
			], null]
		},
		_track: "action"
	},
	point: {
		_description: "Pointing gesture with focused expression",
		_tags: [
			"direction",
			"attention",
			"hand"
		],
		dt: [
			300,
			2e3,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browDownLeft: [.3],
			browDownRight: [.3],
			eyeSquintLeft: [.4],
			eyeSquintRight: [.4],
			mouthPressLeft: [.3],
			mouthPressRight: [.3],
			gesture: [[
				"index",
				null,
				!0
			], null]
		},
		_track: "action"
	},
	ok_wink: {
		_description: "OK hand sign with a playful wink and smile",
		_tags: [
			"approval",
			"playful",
			"hand",
			"wink"
		],
		dt: [
			600,
			200,
			200,
			1500,
			500
		],
		rescale: [
			0,
			0,
			0,
			1,
			0
		],
		vs: {
			mouthSmile: [.5],
			eyeBlinkLeft: [
				0,
				.8,
				0,
				0
			],
			browDownLeft: [
				0,
				.5,
				0,
				0
			],
			cheekSquintLeft: [
				0,
				.5,
				.2,
				0
			],
			gesture: [["ok", null], null]
		},
		_track: "action"
	},
	shrug_confused: {
		_description: "Confused shrug with raised eyebrows and uncertain mouth",
		_tags: [
			"confusion",
			"uncertain",
			"body"
		],
		dt: [
			400,
			1800,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browInnerUp: [.8],
			browOuterUpLeft: [.5],
			browOuterUpRight: [.5],
			mouthPucker: [.3],
			mouthFrownLeft: [.4],
			mouthFrownRight: [.4],
			mouthShrugLower: [.5],
			mouthShrugUpper: [.3],
			gesture: [["shrug", null], null]
		},
		_track: "action"
	},
	namaste_bow: {
		_description: "Respectful namaste with prayer hands and gentle bow",
		_tags: [
			"respect",
			"greeting",
			"formal",
			"hand"
		],
		dt: [
			500,
			300,
			1500,
			500,
			500
		],
		rescale: [
			0,
			0,
			1,
			0,
			0
		],
		vs: {
			eyeBlinkLeft: [
				0,
				0,
				.8,
				.8,
				0
			],
			eyeBlinkRight: [
				0,
				0,
				.8,
				.8,
				0
			],
			eyeSquintLeft: [.5],
			eyeSquintRight: [.5],
			mouthSmile: [.4],
			browInnerUp: [.5],
			bodyRotateX: [
				0,
				0,
				.15,
				.15,
				0
			],
			gesture: [["namaste", null], null]
		},
		_track: "action"
	},
	nod_yes: {
		_description: "Affirmative head nod with a subtle smile",
		_tags: [
			"agreement",
			"positive",
			"head"
		],
		dt: [
			250,
			250,
			250,
			250,
			300
		],
		vs: {
			headMove: [0],
			headRotateX: [
				.15,
				-.05,
				.15,
				-.05,
				0
			],
			mouthSmile: [.3],
			headRotateZ: [[-.05, .05]]
		},
		_track: "action"
	},
	shake_no: {
		_description: "Disapproving head shake with frown",
		_tags: [
			"disagreement",
			"negative",
			"head"
		],
		dt: [
			200,
			300,
			300,
			300,
			300
		],
		vs: {
			headMove: [0],
			headRotateY: [
				.15,
				-.15,
				.15,
				-.15,
				0
			],
			mouthFrownLeft: [.4],
			mouthFrownRight: [.4],
			browDownLeft: [.3],
			browDownRight: [.3],
			headRotateZ: [[-.05, .05]]
		},
		_track: "action"
	},
	look_up: {
		_description: "Looking upward with wide eyes and raised brows, as if pondering",
		_tags: [
			"thinking",
			"curious",
			"head"
		],
		dt: [
			800,
			1e3,
			800
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			headMove: [0],
			headRotateX: [
				-.3,
				-.3,
				0
			],
			bodyRotateX: [
				-.1,
				-.1,
				0
			],
			eyeWideLeft: [
				.5,
				.5,
				0
			],
			eyeWideRight: [
				.5,
				.5,
				0
			],
			browInnerUp: [
				.6,
				.6,
				0
			],
			browOuterUpLeft: [
				.4,
				.4,
				0
			],
			browOuterUpRight: [
				.4,
				.4,
				0
			],
			mouthOpen: [
				.1,
				.1,
				0
			]
		},
		_track: "action"
	},
	look_down: {
		_description: "Looking downward with squinted eyes, reflective or shy",
		_tags: [
			"thinking",
			"shy",
			"head"
		],
		dt: [
			600,
			800,
			600
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			headMove: [0],
			headRotateX: [
				.25,
				.25,
				0
			],
			bodyRotateX: [
				.08,
				.08,
				0
			],
			eyeSquintLeft: [
				.5,
				.5,
				0
			],
			eyeSquintRight: [
				.5,
				.5,
				0
			]
		},
		_track: "action"
	},
	bow: {
		_description: "Respectful bow with closed eyes and gentle smile",
		_tags: [
			"respect",
			"formal",
			"body"
		],
		dt: [
			600,
			300,
			800,
			800
		],
		rescale: [
			0,
			0,
			1,
			0
		],
		vs: {
			headMove: [0],
			bodyRotateX: [
				.2,
				.25,
				.25,
				0
			],
			headRotateX: [
				.15,
				.2,
				.2,
				0
			],
			eyeBlinkLeft: [
				0,
				.8,
				.8,
				0
			],
			eyeBlinkRight: [
				0,
				.8,
				.8,
				0
			],
			mouthSmile: [.2]
		},
		_track: "action"
	},
	jump: {
		_description: "Excited jump with wide eyes and big smile",
		_tags: [
			"excitement",
			"energy",
			"body"
		],
		dt: [
			250,
			200,
			150,
			200,
			400
		],
		vs: {
			headMove: [0],
			bodyRotateX: [
				.15,
				-.1,
				-.1,
				.1,
				0
			],
			headRotateX: [
				.1,
				-.15,
				-.1,
				.08,
				0
			],
			mouthOpen: [
				0,
				.3,
				.3,
				0,
				0
			],
			eyeWideLeft: [
				0,
				.6,
				.6,
				0,
				0
			],
			eyeWideRight: [
				0,
				.6,
				.6,
				0,
				0
			],
			browInnerUp: [
				0,
				.5,
				.5,
				0,
				0
			],
			mouthSmile: [
				0,
				.6,
				.6,
				0,
				0
			]
		},
		_overlay: {
			bones: { Hips: {
				freq: 0,
				amp: [
					0,
					0,
					0
				],
				phase: 0,
				custom: "jump"
			} },
			delay: 0,
			duration: 1200
		},
		_track: "action"
	},
	celebrate: {
		_description: "Joyful celebration with raised hand, hip bounce, and beaming smile",
		_tags: [
			"joy",
			"celebration",
			"energy",
			"hand"
		],
		dt: [
			300,
			800,
			800,
			500
		],
		rescale: [
			0,
			.5,
			.5,
			0
		],
		vs: {
			mouthSmile: [.8],
			mouthOpen: [.3],
			eyeSquintLeft: [.6],
			eyeSquintRight: [.6],
			browInnerUp: [.5],
			noseSneerLeft: [.5],
			noseSneerRight: [.5],
			jawOpen: [.2],
			gesture: [[
				"handup",
				null,
				!0
			], null]
		},
		_overlay: {
			bones: {
				RightHand: {
					freq: 10,
					amp: [
						.08,
						.12,
						.08
					]
				},
				Hips: {
					freq: 4,
					amp: [
						0,
						.03,
						0
					]
				}
			},
			delay: 400,
			duration: 2e3
		},
		_track: "action"
	},
	turn_around: {
		_description: "Playful 360-degree spin with a smile",
		_tags: ["playful", "body"],
		dt: [
			600,
			600,
			600,
			400
		],
		vs: {
			headMove: [0],
			bodyRotateY: [
				-.8,
				-1.6,
				-2.4,
				0
			],
			mouthSmile: [.2]
		},
		_track: "action"
	},
	thinking: {
		_description: "Deep thought pose with asymmetric brow, tilted head, and pursed mouth",
		_tags: [
			"thinking",
			"contemplation",
			"head"
		],
		dt: [
			500,
			2e3,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browDownLeft: [1],
			browOuterUpRight: [1],
			eyeSquintLeft: [.6],
			mouthFrownLeft: [.7],
			mouthFrownRight: [.7],
			mouthRight: [.5],
			mouthRollLower: [.5],
			mouthPressRight: [.4],
			headRotateY: [
				.15,
				.15,
				0
			],
			headRotateZ: [
				.05,
				.05,
				0
			],
			bodyRotateY: [
				.1,
				.1,
				0
			]
		},
		_track: "mood",
		_detect: {
			browOuterUpLeft: .25,
			eyeSquintLeft: .25,
			eyeSquintRight: .15,
			mouthPucker: .2,
			mouthRight: .15
		},
		_react: {
			mood: "curious",
			intensity: .25,
			gesture: "look_up"
		}
	},
	surprised: {
		_description: "Shocked expression with wide eyes, open mouth, and slight lean back",
		_tags: [
			"surprise",
			"shock",
			"expression"
		],
		dt: [
			200,
			1500,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browInnerUp: [.8],
			eyeWideLeft: [.7],
			eyeWideRight: [.7],
			jawOpen: [.5],
			mouthFunnel: [.3],
			headRotateX: [
				-.1,
				-.1,
				0
			],
			bodyRotateX: [
				-.05,
				-.05,
				0
			]
		},
		_track: "action"
	},
	wink: {
		_description: "Playful wink with left eye, body lean, and cheeky smile",
		_tags: [
			"playful",
			"flirty",
			"wink",
			"expression"
		],
		dt: [
			500,
			200,
			500,
			500
		],
		rescale: [
			0,
			0,
			0,
			1
		],
		vs: {
			mouthSmile: [.5],
			mouthOpen: [.2],
			mouthSmileLeft: [
				0,
				.5,
				0
			],
			eyeBlinkLeft: [
				0,
				.7,
				0
			],
			bodyRotateX: [
				.05,
				.05,
				.05,
				0
			],
			bodyRotateZ: [
				-.05,
				-.05,
				-.05,
				0
			],
			browDownLeft: [
				0,
				.7,
				0
			],
			cheekSquintLeft: [
				0,
				.7,
				0
			],
			eyeSquintLeft: [
				0,
				1,
				0
			]
		},
		_track: "action",
		_detect: {
			eyeBlinkLeft: .5,
			mouthSmileLeft: .2,
			mouthSmileRight: .2,
			cheekSquintLeft: .1
		},
		_react: {
			mood: "happy",
			intensity: .3,
			gesture: "smug"
		}
	},
	angry: {
		_description: "Intense anger with furrowed brows, frown, clenched fists, and forward lean",
		_tags: [
			"anger",
			"negative",
			"expression"
		],
		dt: [
			500,
			2e3,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browDownLeft: [1],
			browDownRight: [1],
			eyesLookUp: [.2],
			jawForward: [.3],
			mouthFrownLeft: [1],
			mouthFrownRight: [1],
			bodyRotateX: [
				.15,
				.15,
				0
			],
			handFistLeft: [1],
			handFistRight: [1]
		},
		_track: "mood",
		_detect: {
			browDownLeft: .25,
			browDownRight: .25,
			noseSneerLeft: .15,
			noseSneerRight: .15,
			mouthFrownLeft: .1,
			mouthFrownRight: .1
		},
		_react: {
			mood: "pleading",
			intensity: .25,
			gesture: "deep_breath"
		}
	},
	sad: {
		_description: "Deep sadness with drooped brows, squinted eyes, frown, and slumped posture",
		_tags: [
			"sadness",
			"negative",
			"expression"
		],
		dt: [
			800,
			2e3,
			800
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browInnerUp: [1],
			eyeSquintLeft: [1],
			eyeSquintRight: [1],
			eyesClosed: [.3],
			mouthFrownLeft: [1],
			mouthFrownRight: [1],
			mouthPucker: [.5],
			bodyRotateX: [
				.2,
				.2,
				0
			],
			headRotateX: [
				.15,
				.15,
				0
			]
		},
		_track: "mood",
		_detect: {
			mouthFrownLeft: .3,
			mouthFrownRight: .3,
			browInnerUp: .2,
			eyeSquintLeft: .1,
			eyeSquintRight: .1
		},
		_react: {
			mood: "pleading",
			intensity: .25,
			gesture: "close_eyes"
		}
	},
	laugh: {
		_description: "Hearty laugh with body shakes, wide smile, and spine oscillation",
		_tags: [
			"joy",
			"humor",
			"expression",
			"body"
		],
		dt: [
			300,
			300,
			300,
			300,
			300,
			500
		],
		vs: {
			mouthSmile: [.9],
			mouthOpen: [
				.3,
				.5,
				.3,
				.5,
				.3,
				0
			],
			jawOpen: [
				.2,
				.4,
				.2,
				.4,
				.2,
				0
			],
			eyeSquintLeft: [.8],
			eyeSquintRight: [.8],
			cheekSquintLeft: [.6],
			cheekSquintRight: [.6],
			noseSneerLeft: [.3],
			noseSneerRight: [.3],
			bodyRotateX: [
				.05,
				-.02,
				.05,
				-.02,
				.05,
				0
			]
		},
		_overlay: {
			bones: {
				Spine: {
					freq: 10,
					amp: [
						.02,
						0,
						.01
					]
				},
				Head: {
					freq: 10,
					amp: [
						.01,
						0,
						.01
					],
					phase: 1.5707963267948966
				}
			},
			delay: 200,
			duration: 1800
		},
		_track: "action",
		_detect: {
			mouthSmileLeft: .2,
			mouthSmileRight: .2,
			jawOpen: .2,
			cheekSquintLeft: .15,
			cheekSquintRight: .15,
			eyeSquintLeft: .05,
			eyeSquintRight: .05
		},
		_react: {
			mood: "happy",
			intensity: .3,
			gesture: "slight_smile"
		}
	},
	yawn: {
		_description: "Tired yawn with wide jaw, squinted eyes, and slight lean back",
		_tags: [
			"tired",
			"bored",
			"expression"
		],
		dt: [
			800,
			1500,
			800
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			jawOpen: [.8],
			mouthOpen: [.7],
			mouthFunnel: [.5],
			eyeSquintLeft: [.9],
			eyeSquintRight: [.9],
			eyesClosed: [.4],
			browInnerUp: [.7],
			headRotateX: [
				-.1,
				-.1,
				0
			],
			bodyRotateX: [
				-.05,
				-.05,
				0
			]
		},
		_track: "action",
		_detect: {
			jawOpen: .35,
			mouthFunnel: .2,
			eyeSquintLeft: .15,
			eyeSquintRight: .15,
			eyeBlinkLeft: .1,
			eyeBlinkRight: .05
		},
		_react: {
			mood: "sleep",
			intensity: .25,
			gesture: "nod"
		}
	},
	nervous: {
		_description: "Nervous fidgeting with quick head shifts and tense expression",
		_tags: [
			"anxiety",
			"nervous",
			"head"
		],
		dt: [
			200,
			200,
			200,
			200,
			200,
			200,
			300
		],
		vs: {
			browInnerUp: [.6],
			eyeWideLeft: [.3],
			eyeWideRight: [.3],
			mouthPressLeft: [.4],
			mouthPressRight: [.4],
			mouthStretchLeft: [.2],
			mouthStretchRight: [.2],
			headRotateY: [
				.06,
				-.06,
				.04,
				-.04,
				.06,
				-.06,
				0
			],
			headRotateZ: [[-.03, .03]],
			bodyRotateY: [
				.03,
				-.03,
				.02,
				-.02,
				.03,
				-.03,
				0
			]
		},
		_track: "mood"
	},
	applause: {
		_description: "Clapping hands with joyful expression and hand oscillation overlay",
		_tags: [
			"approval",
			"celebration",
			"hand"
		],
		dt: [
			300,
			2e3,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			mouthSmile: [.7],
			eyeSquintLeft: [.4],
			eyeSquintRight: [.4],
			browInnerUp: [.4],
			noseSneerLeft: [.3],
			noseSneerRight: [.3],
			gesture: [["namaste", null], null]
		},
		_overlay: {
			bones: {
				RightHand: {
					freq: 12,
					amp: [
						.06,
						.06,
						0
					],
					phase: 0
				},
				LeftHand: {
					freq: 12,
					amp: [
						.06,
						.06,
						0
					],
					phase: 3.14159265358979
				},
				RightForeArm: {
					freq: 12,
					amp: [
						.03,
						0,
						.03
					],
					phase: 0
				},
				LeftForeArm: {
					freq: 12,
					amp: [
						.03,
						0,
						.03
					],
					phase: 3.14159265358979
				}
			},
			delay: 300,
			duration: 2200
		},
		_track: "action"
	},
	dance: {
		_description: "Rhythmic dance with hip bounce, arm wave, and spine sway",
		_tags: [
			"joy",
			"energy",
			"body",
			"hand"
		],
		dt: [
			300,
			400,
			400,
			400,
			400,
			400,
			300
		],
		vs: {
			mouthSmile: [.7],
			eyeSquintLeft: [.3],
			eyeSquintRight: [.3],
			headRotateZ: [
				.1,
				-.1,
				.1,
				-.1,
				.1,
				-.1,
				0
			],
			bodyRotateZ: [
				.05,
				-.05,
				.05,
				-.05,
				.05,
				-.05,
				0
			],
			gesture: [[
				"handup",
				null,
				!0
			], null]
		},
		_overlay: {
			bones: {
				Hips: {
					freq: 5,
					amp: [
						0,
						.04,
						.03
					]
				},
				RightHand: {
					freq: 5,
					amp: [
						.05,
						.08,
						.05
					],
					phase: 0
				},
				Spine: {
					freq: 2.5,
					amp: [
						.02,
						0,
						.02
					]
				}
			},
			delay: 200,
			duration: 2800
		},
		_track: "action"
	},
	shy: {
		_description: "Shy head turn with bashful smile and downcast gaze",
		_tags: [
			"shy",
			"embarrassment",
			"head"
		],
		dt: [
			500,
			1500,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			mouthSmile: [.3],
			eyeSquintLeft: [.6],
			eyeSquintRight: [.6],
			eyesClosed: [.3],
			browInnerUp: [.5],
			headRotateY: [
				.2,
				.2,
				0
			],
			headRotateX: [
				.1,
				.1,
				0
			],
			headRotateZ: [
				.08,
				.08,
				0
			],
			bodyRotateY: [
				.1,
				.1,
				0
			]
		},
		_track: "mood"
	},
	facepalm: {
		_description: "Facepalm with hand to forehead, closed eyes, and slight body slump",
		_tags: [
			"frustration",
			"disbelief",
			"hand"
		],
		dt: [
			600,
			1500,
			600
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browDownLeft: [.6],
			browDownRight: [.6],
			eyesClosed: [.5],
			mouthFrownLeft: [.5],
			mouthFrownRight: [.5],
			headRotateX: [
				.15,
				.15,
				0
			],
			bodyRotateX: [
				.1,
				.1,
				0
			],
			gesture: [[
				"handup",
				null,
				!0
			], null]
		},
		_track: "action"
	},
	listen: {
		_description: "Attentive listening pose with head tilted and slight smile",
		_tags: [
			"attention",
			"listening",
			"head"
		],
		dt: [
			500,
			2e3,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			headRotateZ: [
				.08,
				.08,
				0
			],
			headRotateY: [
				.1,
				.1,
				0
			],
			browInnerUp: [.3],
			eyeSquintLeft: [.2],
			mouthSmile: [.2],
			mouthPressLeft: [.2]
		},
		_track: "mood"
	},
	excited: {
		_description: "Bursting with excitement — wide eyes, rapid hand wave, and hip bounce",
		_tags: [
			"excitement",
			"energy",
			"hand",
			"body"
		],
		dt: [
			200,
			300,
			300,
			300,
			300,
			300
		],
		vs: {
			mouthSmile: [.9],
			mouthOpen: [.4],
			eyeWideLeft: [.6],
			eyeWideRight: [.6],
			browInnerUp: [.7],
			browOuterUpLeft: [.5],
			browOuterUpRight: [.5],
			cheekSquintLeft: [.4],
			cheekSquintRight: [.4],
			bodyRotateX: [
				-.05,
				.05,
				-.05,
				.05,
				-.05,
				0
			],
			gesture: [[
				"handup",
				null,
				!0
			], null]
		},
		_overlay: {
			bones: {
				RightHand: {
					freq: 10,
					amp: [
						.06,
						.1,
						.06
					],
					phase: 0
				},
				Hips: {
					freq: 6,
					amp: [
						.01,
						.03,
						.01
					]
				}
			},
			delay: 100,
			duration: 1700
		},
		_track: "action"
	},
	dismiss: {
		_description: "Dismissive wave-off with head turn and disinterested expression",
		_tags: [
			"dismissal",
			"negative",
			"hand"
		],
		dt: [
			300,
			1500,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browDownLeft: [.4],
			browDownRight: [.4],
			eyeSquintLeft: [.3],
			eyeSquintRight: [.3],
			mouthFrownLeft: [.3],
			mouthFrownRight: [.3],
			mouthPressLeft: [.3],
			headRotateY: [
				-.15,
				-.15,
				0
			],
			bodyRotateY: [
				-.08,
				-.08,
				0
			],
			gesture: [[
				"side",
				null,
				!0
			], null]
		},
		_overlay: {
			bones: {
				RightHand: {
					freq: 6,
					amp: [
						0,
						.08,
						.08
					],
					phase: 0
				},
				RightForeArm: {
					freq: 6,
					amp: [
						.03,
						0,
						.05
					],
					phase: 1.5707963267948966
				}
			},
			delay: 300,
			duration: 1500
		},
		_track: "action"
	},
	tongueout: {
		_description: "Playful tongue sticking out with closed eyes and big grin",
		_tags: [
			"playful",
			"silly",
			"expression"
		],
		dt: [
			300,
			100,
			1500,
			500,
			500
		],
		rescale: [
			0,
			0,
			1,
			0,
			0
		],
		vs: {
			browInnerUp: [.8],
			eyesClosed: [1],
			jawOpen: [.7],
			mouthFunnel: [.5],
			mouthSmile: [1],
			tongueOut: [
				0,
				1,
				1,
				0
			]
		},
		_track: "action"
	},
	kiss: {
		_description: "Blowing a kiss with wink, pursed lips, and body lean",
		_tags: [
			"affection",
			"playful",
			"expression"
		],
		dt: [
			500,
			500,
			200,
			500
		],
		rescale: [
			0,
			0,
			0,
			1
		],
		vs: {
			browInnerUp: [.6],
			eyeBlinkLeft: [
				0,
				0,
				1,
				0
			],
			eyeBlinkRight: [0],
			eyeSquintLeft: [1],
			eyeSquintRight: [1],
			mouthPucker: [
				0,
				.5,
				0
			],
			noseSneerLeft: [0, .7],
			noseSneerRight: [.7],
			viseme_U: [0, 1],
			bodyRotateX: [
				0,
				.05,
				.05,
				0
			],
			bodyRotateZ: [
				0,
				-.05,
				-.05,
				0
			]
		},
		_track: "action",
		_detect: {
			mouthPucker: .5,
			mouthShrugUpper: .2,
			mouthClose: .15,
			browInnerUp: .15
		},
		_react: {
			mood: "love",
			intensity: .3,
			gesture: "adoring"
		}
	},
	eyeroll: {
		_description: "Dramatic eye roll with head tilt back and pursed lips",
		_tags: [
			"sarcasm",
			"annoyance",
			"expression"
		],
		dt: [
			500,
			1500,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browInnerUp: [.8],
			eyeWideLeft: [1],
			eyeWideRight: [1],
			eyesRotateX: [-.8],
			bodyRotateX: [
				.15,
				.15,
				0
			],
			mouthPucker: [.5],
			mouthRollLower: [.6],
			mouthRollUpper: [.5]
		},
		_track: "action"
	},
	smirk: {
		_description: "Sly one-sided smirk with raised brow and side glance",
		_tags: [
			"sarcasm",
			"confident",
			"playful",
			"expression"
		],
		dt: [
			300,
			2e3,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			eyeContact: [0],
			browDownRight: [.1],
			browInnerUp: [.7],
			browOuterUpRight: [.2],
			eyeLookInRight: [.7],
			eyeLookOutLeft: [.7],
			eyeSquintLeft: [1],
			eyeSquintRight: [.8],
			eyesRotateY: [.7],
			mouthLeft: [.4],
			mouthPucker: [.4],
			mouthShrugLower: [.3],
			mouthShrugUpper: [.2],
			mouthSmile: [.2],
			mouthSmileLeft: [.4],
			mouthSmileRight: [.2],
			mouthStretchLeft: [.5],
			mouthUpperUpLeft: [.6],
			noseSneerLeft: [.7]
		},
		_track: "mood",
		_detect: {
			mouthSmileLeft: .4,
			noseSneerLeft: .2,
			eyeSquintLeft: .15,
			mouthLeft: .15,
			browInnerUp: .1
		},
		_react: {
			mood: "happy",
			intensity: .2,
			gesture: "side_glance"
		}
	},
	grimace: {
		_description: "Pained grimace with clenched teeth and tense brows",
		_tags: [
			"pain",
			"discomfort",
			"expression"
		],
		dt: [
			500,
			1500,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browDownLeft: [1],
			browDownRight: [1],
			browInnerUp: [1],
			mouthDimpleLeft: [.5],
			mouthDimpleRight: [.5],
			mouthLowerDownLeft: [1],
			mouthLowerDownRight: [1],
			mouthPressLeft: [.4],
			mouthPressRight: [.4],
			mouthPucker: [.5],
			mouthSmile: [.1],
			mouthSmileLeft: [.2],
			mouthSmileRight: [.2],
			mouthStretchLeft: [1],
			mouthStretchRight: [1],
			mouthUpperUpLeft: [1],
			mouthUpperUpRight: [1]
		},
		_track: "mood",
		_detect: {
			mouthStretchLeft: .2,
			mouthStretchRight: .2,
			jawOpen: .15,
			browDownLeft: .1,
			browDownRight: .1,
			eyeSquintLeft: .1,
			eyeSquintRight: .1,
			mouthPressLeft: .025,
			mouthPressRight: .025
		},
		_react: {
			mood: "sad",
			intensity: .2,
			gesture: "pensive"
		}
	},
	pleading: {
		_description: "Puppy-dog pleading face with big eyes and pouty lips",
		_tags: [
			"pleading",
			"cute",
			"expression"
		],
		dt: [
			1e3,
			2e3,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browDownLeft: [.2],
			browDownRight: [.2],
			browInnerUp: [1],
			eyeWideLeft: [.9],
			eyeWideRight: [.9],
			eyesClosed: [.1],
			mouthClose: [.2],
			mouthFrownLeft: [1],
			mouthFrownRight: [1],
			mouthPressLeft: [.4],
			mouthPressRight: [.4],
			mouthPucker: [1],
			mouthRollLower: [.6],
			mouthRollUpper: [.2],
			mouthUpperUpLeft: [.8],
			mouthUpperUpRight: [.8],
			headRotateX: [
				.1,
				.1,
				0
			],
			bodyRotateX: [
				.05,
				.05,
				0
			]
		},
		_track: "mood",
		_detect: {
			browInnerUp: .35,
			eyeWideLeft: .15,
			eyeWideRight: .15,
			mouthFrownLeft: .1,
			mouthFrownRight: .1,
			mouthPucker: .15
		},
		_react: {
			mood: "sad",
			intensity: .3,
			gesture: "adoring"
		}
	},
	sleeping: {
		_description: "Peacefully sleeping with closed eyes and slow head sway",
		_tags: [
			"tired",
			"sleep",
			"expression"
		],
		dt: [
			2e3,
			3e3,
			2e3
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			headMove: [0],
			eyeBlinkLeft: [1],
			eyeBlinkRight: [1],
			eyesClosed: [.6],
			bodyRotateX: [
				.2,
				.2,
				0
			],
			bodyRotateZ: [
				.1,
				.1,
				0
			]
		},
		_track: "mood"
	},
	sigh: {
		_description: "Deep sigh with visible chest inhale, slumped body, and exasperated expression",
		_tags: [
			"frustration",
			"tired",
			"expression",
			"body"
		],
		dt: [
			800,
			1200,
			500,
			1500,
			500
		],
		rescale: [
			0,
			0,
			0,
			1,
			0
		],
		vs: {
			chestInhale: [
				0,
				.8,
				.8,
				0,
				0
			],
			bodyRotateX: [
				0,
				-.05,
				-.05,
				.15,
				0
			],
			headRotateX: [
				0,
				-.1,
				-.1,
				.15,
				0
			],
			eyesClosed: [
				0,
				.3,
				.3,
				.5,
				0
			],
			eyeSquintLeft: [
				0,
				0,
				0,
				.8,
				0
			],
			eyeSquintRight: [
				0,
				0,
				0,
				.8,
				0
			],
			mouthOpen: [
				0,
				.3,
				.3,
				0,
				0
			],
			mouthFrownLeft: [
				0,
				0,
				0,
				.6,
				0
			],
			mouthFrownRight: [
				0,
				0,
				0,
				.6,
				0
			],
			browInnerUp: [
				0,
				.3,
				.3,
				.7,
				0
			]
		},
		_track: "action"
	},
	raise_eyebrows: {
		_description: "Raised eyebrows with wide eyes, expressing surprise or emphasis",
		_tags: [
			"expression",
			"surprise",
			"face"
		],
		dt: [
			400,
			2e3,
			400
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browInnerUp: [.9],
			browOuterUpLeft: [.7],
			browOuterUpRight: [.7],
			eyeWideLeft: [.3],
			eyeWideRight: [.3]
		},
		_track: "action"
	},
	frown: {
		_description: "Displeased frown with furrowed brows and turned-down mouth",
		_tags: [
			"expression",
			"negative",
			"face"
		],
		dt: [
			400,
			2e3,
			400
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browDownLeft: [.8],
			browDownRight: [.8],
			mouthFrownLeft: [.7],
			mouthFrownRight: [.7],
			eyeSquintLeft: [.3],
			eyeSquintRight: [.3]
		},
		_track: "mood",
		_detect: {
			browDownLeft: .25,
			browDownRight: .25,
			mouthFrownLeft: .25,
			mouthFrownRight: .25
		},
		_react: {
			mood: "pleading",
			intensity: .2,
			gesture: "nod"
		}
	},
	open_mouth: {
		_description: "Mouth wide open in awe or shock",
		_tags: [
			"expression",
			"surprise",
			"face"
		],
		dt: [
			300,
			1500,
			300
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			jawOpen: [.7],
			mouthOpen: [.5],
			eyeWideLeft: [.4],
			eyeWideRight: [.4],
			browInnerUp: [.5]
		},
		_track: "action"
	},
	cheek_puff: {
		_description: "Puffed cheeks with closed mouth, playful or holding breath",
		_tags: [
			"expression",
			"playful",
			"face"
		],
		dt: [
			300,
			2e3,
			300
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			cheekPuff: [.9],
			mouthClose: [.3],
			mouthPressLeft: [.4],
			mouthPressRight: [.4],
			eyeSquintLeft: [.2],
			eyeSquintRight: [.2]
		},
		_track: "action"
	},
	close_eyes: {
		_description: "Gently closed eyes, relaxed or meditating",
		_tags: [
			"expression",
			"calm",
			"face"
		],
		dt: [
			500,
			3e3,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			eyeBlinkLeft: [1],
			eyeBlinkRight: [1],
			eyeSquintLeft: [.5],
			eyeSquintRight: [.5],
			mouthSmile: [.15]
		},
		_track: "action"
	},
	squint: {
		_description: "Squinting with furrowed brows, suspicious or scrutinizing",
		_tags: [
			"expression",
			"skeptical",
			"face"
		],
		dt: [
			400,
			2e3,
			400
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			eyeSquintLeft: [.9],
			eyeSquintRight: [.9],
			browDownLeft: [.6],
			browDownRight: [.6],
			noseSneerLeft: [.2],
			noseSneerRight: [.2]
		},
		_track: "mood",
		_detect: {
			eyeSquintLeft: .3,
			eyeSquintRight: .3,
			browDownLeft: .15,
			browDownRight: .15,
			noseSneerLeft: .05,
			noseSneerRight: .05
		},
		_react: {
			mood: "curious",
			intensity: .2,
			gesture: "look_down"
		}
	},
	look_left: {
		_description: "Looking to the left with eyes and slight head turn",
		_tags: [
			"direction",
			"attention",
			"head"
		],
		dt: [
			500,
			2e3,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			headMove: [0],
			headRotateY: [
				.2,
				.2,
				0
			],
			eyeLookOutLeft: [
				.7,
				.7,
				0
			],
			eyeLookInRight: [
				.7,
				.7,
				0
			]
		},
		_track: "action"
	},
	look_right: {
		_description: "Looking to the right with eyes and slight head turn",
		_tags: [
			"direction",
			"attention",
			"head"
		],
		dt: [
			500,
			2e3,
			500
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			headMove: [0],
			headRotateY: [
				-.2,
				-.2,
				0
			],
			eyeLookInLeft: [
				.7,
				.7,
				0
			],
			eyeLookOutRight: [
				.7,
				.7,
				0
			]
		},
		_track: "action"
	},
	head_circles: {
		_description: "Slow circular head movement, stretching or being goofy",
		_tags: [
			"playful",
			"body",
			"head"
		],
		dt: [
			500,
			500,
			500,
			500,
			500
		],
		vs: {
			headMove: [0],
			headRotateX: [
				-.15,
				0,
				.15,
				0,
				0
			],
			headRotateZ: [
				0,
				-.15,
				0,
				.15,
				0
			]
		},
		_overlay: {
			bones: { Neck: {
				freq: 1.2,
				amp: [
					.06,
					0,
					.06
				],
				phase: 1.5707963267948966
			} },
			delay: 0,
			duration: 2500
		},
		_track: "action"
	},
	shiver: {
		_description: "Shivering from cold or fear with rapid small tremors",
		_tags: [
			"fear",
			"cold",
			"body"
		],
		dt: [
			300,
			2e3,
			300
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			eyeSquintLeft: [.4],
			eyeSquintRight: [.4],
			mouthPressLeft: [.3],
			mouthPressRight: [.3],
			jawOpen: [.1]
		},
		_overlay: {
			bones: {
				Spine1: {
					freq: 18,
					amp: [
						.008,
						0,
						.005
					],
					phase: 0
				},
				Spine2: {
					freq: 18,
					amp: [
						.005,
						0,
						.008
					],
					phase: .8
				},
				Neck: {
					freq: 20,
					amp: [
						.004,
						0,
						.004
					],
					phase: 1.2
				}
			},
			delay: 200,
			duration: 2200
		},
		_track: "action"
	},
	chew: {
		_description: "Chewing motion with rhythmic jaw movement",
		_tags: [
			"expression",
			"eating",
			"face"
		],
		dt: [
			200,
			200,
			200,
			200,
			200,
			300
		],
		vs: {
			jawOpen: [
				.3,
				.05,
				.3,
				.05,
				.25,
				0
			],
			mouthClose: [
				0,
				.3,
				0,
				.3,
				0,
				0
			],
			mouthPressLeft: [.2],
			mouthPressRight: [.2],
			cheekPuff: [
				.1,
				.3,
				.1,
				.3,
				.1,
				0
			]
		},
		_track: "action"
	},
	deep_breath: {
		_description: "Deep inhale and exhale with visible chest expansion",
		_tags: [
			"calm",
			"breathing",
			"body"
		],
		dt: [
			1e3,
			1500,
			500,
			2e3,
			500
		],
		rescale: [
			0,
			0,
			0,
			1,
			0
		],
		vs: {
			chestInhale: [
				0,
				.9,
				.9,
				0,
				0
			],
			bodyRotateX: [
				0,
				-.08,
				-.08,
				.05,
				0
			],
			headRotateX: [
				0,
				-.1,
				-.1,
				.05,
				0
			],
			eyeBlinkLeft: [
				0,
				.6,
				.6,
				0,
				0
			],
			eyeBlinkRight: [
				0,
				.6,
				.6,
				0,
				0
			],
			mouthOpen: [
				0,
				.2,
				.2,
				0,
				0
			],
			browInnerUp: [
				0,
				.3,
				.3,
				0,
				0
			]
		},
		_track: "action"
	},
	vibrate: {
		_description: "Rapid vibration effect, excitement or buzzing energy",
		_tags: [
			"energy",
			"excitement",
			"body"
		],
		dt: [
			200,
			1500,
			200
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			eyeWideLeft: [.3],
			eyeWideRight: [.3],
			mouthSmile: [.3]
		},
		_overlay: {
			bones: { Hips: {
				freq: 30,
				amp: [
					.003,
					.003,
					.003
				],
				phase: 0
			} },
			delay: 100,
			duration: 1600
		},
		_track: "action"
	},
	curious: {
		_description: "Curious expression with tilted head, raised brow, and wide eyes",
		_tags: [
			"curious",
			"thinking",
			"expression"
		],
		dt: [
			400,
			2e3,
			400
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browInnerUp: [.7],
			browOuterUpLeft: [.3],
			eyeWideLeft: [.5],
			eyeWideRight: [.5],
			headRotateZ: [
				.1,
				.1,
				0
			],
			headRotateY: [
				.08,
				.08,
				0
			],
			mouthSmile: [.15],
			mouthOpen: [.1]
		},
		_track: "mood",
		_detect: {
			browOuterUpLeft: .25,
			browOuterUpRight: .25,
			browInnerUp: .2,
			eyeWideLeft: .15,
			eyeWideRight: .15
		},
		_react: {
			mood: "curious",
			intensity: .3,
			gesture: "raise_eyebrows"
		}
	},
	disgust: {
		_description: "Disgusted expression with nose scrunch, frown, and recoil",
		_tags: [
			"disgust",
			"negative",
			"expression"
		],
		dt: [
			300,
			2e3,
			400
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			noseSneerLeft: [.8],
			noseSneerRight: [.8],
			mouthFrownLeft: [.7],
			mouthFrownRight: [.7],
			browDownLeft: [.5],
			browDownRight: [.5],
			mouthUpperUpLeft: [.4],
			mouthUpperUpRight: [.4],
			headRotateX: [
				-.08,
				-.08,
				0
			],
			bodyRotateX: [
				-.04,
				-.04,
				0
			]
		},
		_track: "mood",
		_detect: {
			noseSneerLeft: .25,
			noseSneerRight: .25,
			mouthUpperUpLeft: .15,
			mouthUpperUpRight: .15,
			mouthShrugUpper: .1,
			mouthFrownLeft: .05,
			mouthFrownRight: .05
		},
		_react: {
			mood: "pleading",
			intensity: .2,
			gesture: "pensive"
		}
	},
	neutral_face: {
		_description: "Neutral blank stare with straight pose and wide eyes",
		_tags: ["expression", "neutral"],
		_track: "action",
		dt: [300, 2e3],
		rescale: [0, 1],
		vs: {
			browInnerUp: [.4],
			eyeWideLeft: [.7],
			eyeWideRight: [.7],
			mouthPressLeft: [.6],
			mouthPressRight: [.6],
			mouthRollLower: [.3],
			mouthStretchLeft: [1],
			mouthStretchRight: [1]
		}
	},
	smug: {
		_description: "Smug side-glance with one-sided smirk and raised brow",
		_tags: ["expression", "attitude"],
		_track: "action",
		dt: [300, 2e3],
		rescale: [0, 1],
		vs: {
			browDownRight: [.1],
			browInnerUp: [.7],
			browOuterUpRight: [.2],
			eyeLookInRight: [.7],
			eyeLookOutLeft: [.7],
			eyeSquintLeft: [1],
			eyeSquintRight: [.8],
			eyesRotateY: [.7],
			mouthLeft: [.4],
			mouthPucker: [.4],
			mouthShrugLower: [.3],
			mouthShrugUpper: [.2],
			mouthSmile: [.2],
			mouthSmileLeft: [.4],
			mouthSmileRight: [.2],
			mouthStretchLeft: [.5],
			mouthUpperUpLeft: [.6],
			noseSneerLeft: [.7]
		}
	},
	slight_smile: {
		_description: "Subtle gentle smile",
		_tags: ["expression", "happy"],
		_track: "action",
		dt: [300, 2e3],
		rescale: [0, 1],
		vs: { mouthSmile: [.5] }
	},
	warm_smile: {
		_description: "Warm smile with squinted eyes and nose crinkle",
		_tags: ["expression", "happy"],
		_track: "action",
		dt: [300, 2e3],
		rescale: [0, 1],
		vs: {
			browInnerUp: [.6],
			eyeSquintLeft: [1],
			eyeSquintRight: [1],
			mouthSmile: [.7],
			noseSneerLeft: [.7],
			noseSneerRight: [.7]
		}
	},
	grin: {
		_description: "Big grin with open mouth and dimples",
		_tags: ["expression", "happy"],
		_track: "action",
		dt: [300, 2e3],
		rescale: [0, 1],
		vs: {
			browInnerUp: [.6],
			jawOpen: [.1],
			mouthDimpleLeft: [.2],
			mouthDimpleRight: [.2],
			mouthOpen: [.3],
			mouthPressLeft: [.3],
			mouthPressRight: [.3],
			mouthRollLower: [.4],
			mouthShrugUpper: [.4],
			mouthSmile: [.7],
			mouthUpperUpLeft: [.3],
			mouthUpperUpRight: [.3],
			noseSneerLeft: [.4],
			noseSneerRight: [.4]
		}
	},
	open_grin: {
		_description: "Wide-eyed grin with open mouth",
		_tags: ["expression", "happy"],
		_track: "action",
		dt: [300, 2e3],
		rescale: [0, 1],
		vs: {
			browInnerUp: [.6],
			eyeWideLeft: [.7],
			eyeWideRight: [.7],
			jawOpen: [.1],
			mouthDimpleLeft: [.2],
			mouthDimpleRight: [.2],
			mouthOpen: [.3],
			mouthPressLeft: [.3],
			mouthPressRight: [.3],
			mouthRollLower: [.4],
			mouthShrugUpper: [.4],
			mouthSmile: [.7],
			mouthUpperUpLeft: [.3],
			mouthUpperUpRight: [.3],
			noseSneerLeft: [.4],
			noseSneerRight: [.4]
		}
	},
	squint_smile: {
		_description: "Happy squinting smile with jaw open",
		_tags: ["expression", "happy"],
		_track: "action",
		dt: [300, 2e3],
		rescale: [0, 1],
		vs: {
			browInnerUp: [.3],
			eyeSquintLeft: [1],
			eyeSquintRight: [1],
			jawOpen: [.2],
			mouthDimpleLeft: [.2],
			mouthDimpleRight: [.2],
			mouthOpen: [.3],
			mouthPressLeft: [.3],
			mouthPressRight: [.3],
			mouthRollLower: [.4],
			mouthShrugUpper: [.4],
			mouthSmile: [.7],
			mouthUpperUpLeft: [.3],
			mouthUpperUpRight: [.3],
			noseSneerLeft: [.4],
			noseSneerRight: [.4]
		}
	},
	beam: {
		_description: "Beaming closed-eye grin",
		_tags: ["expression", "happy"],
		_track: "action",
		dt: [300, 2e3],
		rescale: [0, 1],
		vs: {
			browInnerUp: [.3],
			eyeSquintLeft: [1],
			eyeSquintRight: [1],
			jawOpen: [.3],
			mouthDimpleLeft: [.2],
			mouthDimpleRight: [.2],
			mouthPressLeft: [.5],
			mouthPressRight: [.5],
			mouthShrugUpper: [.4],
			mouthSmile: [.7],
			mouthUpperUpLeft: [.3],
			mouthUpperUpRight: [.3],
			noseSneerLeft: [.4],
			noseSneerRight: [.4]
		}
	},
	laugh_closed: {
		_description: "Eyes-closed laughing with wide grin",
		_tags: ["expression", "happy"],
		_track: "action",
		dt: [300, 2e3],
		rescale: [0, 1],
		vs: {
			browInnerUp: [.3],
			eyeSquintLeft: [1],
			eyeSquintRight: [1],
			eyesClosed: [.6],
			jawOpen: [.3],
			mouthDimpleLeft: [.2],
			mouthDimpleRight: [.2],
			mouthPressLeft: [.5],
			mouthPressRight: [.5],
			mouthShrugUpper: [.4],
			mouthSmile: [.7],
			mouthUpperUpLeft: [.3],
			mouthUpperUpRight: [.3],
			noseSneerLeft: [.4],
			noseSneerRight: [.4]
		}
	},
	tongue_out: {
		_description: "Playful tongue out with closed eyes and big smile",
		_tags: ["expression", "playful"],
		_track: "action",
		dt: [
			300,
			100,
			1500,
			500,
			500
		],
		rescale: [
			0,
			0,
			1,
			0,
			0
		],
		vs: {
			browInnerUp: [.8],
			eyesClosed: [1],
			jawOpen: [.7],
			mouthFunnel: [.5],
			mouthSmile: [1],
			tongueOut: [
				0,
				1,
				1,
				0
			]
		},
		_detect: { tongueOut: 1 },
		_react: {
			mood: "happy",
			intensity: .25,
			gesture: "raise_eyebrows"
		}
	},
	crying_laugh: {
		_description: "Laughing so hard with tears, eyes squinted shut",
		_tags: ["expression", "happy"],
		_track: "action",
		dt: [300, 2e3],
		rescale: [0, 1],
		vs: {
			browInnerUp: [.3],
			eyeSquintLeft: [1],
			eyeSquintRight: [1],
			eyesClosed: [.6],
			jawOpen: [.3],
			mouthDimpleLeft: [.2],
			mouthDimpleRight: [.2],
			mouthPressLeft: [.5],
			mouthPressRight: [.5],
			mouthShrugUpper: [.4],
			mouthSmile: [.7],
			mouthUpperUpLeft: [.3],
			mouthUpperUpRight: [.3],
			noseSneerLeft: [.4],
			noseSneerRight: [.4]
		}
	},
	wink_smile: {
		_description: "Charming wink with smile and body lean",
		_tags: ["expression", "playful"],
		_track: "action",
		dt: [
			500,
			200,
			500,
			500
		],
		rescale: [
			0,
			0,
			0,
			1
		],
		vs: {
			mouthSmile: [.5],
			mouthOpen: [.2],
			mouthSmileLeft: [
				0,
				.5,
				0
			],
			eyeBlinkLeft: [
				0,
				.7,
				0
			],
			eyeBlinkRight: [
				0,
				0,
				0
			],
			bodyRotateX: [
				.05,
				.05,
				.05,
				0
			],
			bodyRotateZ: [
				-.05,
				-.05,
				-.05,
				0
			],
			browDownLeft: [
				0,
				.7,
				0
			],
			cheekSquintLeft: [
				0,
				.7,
				0
			],
			eyeSquintLeft: [
				0,
				1,
				0
			],
			eyesClosed: [0]
		}
	},
	sobbing: {
		_description: "Heavy crying with open mouth and furrowed brows",
		_tags: ["expression", "sad"],
		_track: "action",
		dt: [1e3, 1e3],
		rescale: [0, 1],
		vs: {
			browInnerUp: [1],
			eyeSquintLeft: [1],
			eyeSquintRight: [1],
			eyesClosed: [.1],
			jawOpen: [0],
			mouthFrownLeft: [1],
			mouthFrownRight: [1],
			mouthOpen: [.5],
			mouthPucker: [.5],
			mouthUpperUpLeft: [.6],
			mouthUpperUpRight: [.6]
		}
	},
	puppy_eyes: {
		_description: "Pleading puppy-dog eyes with pouty lip",
		_tags: ["expression", "sad"],
		_track: "action",
		dt: [1e3, 1e3],
		rescale: [0, 1],
		vs: {
			browDownLeft: [.2],
			browDownRight: [.2],
			browInnerUp: [1],
			eyeWideLeft: [.9],
			eyeWideRight: [.9],
			eyesClosed: [.1],
			mouthClose: [.2],
			mouthFrownLeft: [1],
			mouthFrownRight: [1],
			mouthPressLeft: [.4],
			mouthPressRight: [.4],
			mouthPucker: [1],
			mouthRollLower: [.6],
			mouthRollUpper: [.2],
			mouthUpperUpLeft: [.8],
			mouthUpperUpRight: [.8]
		}
	},
	disappointed: {
		_description: "Disappointed look with drooped eyes and slumped posture",
		_tags: ["expression", "sad"],
		_track: "action",
		dt: [1e3, 1e3],
		rescale: [0, 1],
		vs: {
			browInnerUp: [.7],
			eyeSquintLeft: [1],
			eyeSquintRight: [1],
			eyesClosed: [.5],
			bodyRotateX: [.3],
			mouthClose: [.2],
			mouthFrownLeft: [1],
			mouthFrownRight: [1],
			mouthPucker: [1],
			mouthRollLower: [1],
			mouthShrugLower: [.2],
			mouthUpperUpLeft: [.8],
			mouthUpperUpRight: [.8]
		}
	},
	pensive: {
		_description: "Pensive sadness with closed eyes and pressed lips",
		_tags: ["expression", "sad"],
		_track: "action",
		dt: [1e3, 1e3],
		rescale: [0, 1],
		vs: {
			browInnerUp: [1],
			eyeSquintLeft: [1],
			eyeSquintRight: [1],
			eyesClosed: [.5],
			bodyRotateX: [.3],
			mouthClose: [.2],
			mouthFrownLeft: [1],
			mouthFrownRight: [1],
			mouthPressLeft: [.4],
			mouthPressRight: [.4],
			mouthPucker: [1],
			mouthRollLower: [.6],
			mouthRollUpper: [.2],
			mouthUpperUpLeft: [.8],
			mouthUpperUpRight: [.8]
		}
	},
	flushed: {
		_description: "Flushed embarrassment with wide eyes and pursed lips",
		_tags: ["expression", "surprise"],
		_track: "action",
		dt: [1e3, 1e3],
		rescale: [0, 1],
		vs: {
			browInnerUp: [1],
			eyeWideLeft: [.5],
			eyeWideRight: [.5],
			eyesRotateY: [.05],
			eyesRotateX: [.05],
			mouthClose: [.2],
			mouthFunnel: [.5],
			mouthPucker: [.4],
			mouthRollLower: [.4],
			mouthRollUpper: [.4]
		}
	},
	sad_frown: {
		_description: "Simple frown with pursed lower lip",
		_tags: ["expression", "sad"],
		_track: "action",
		dt: [500, 1500],
		rescale: [0, 1],
		vs: {
			mouthFrownLeft: [1],
			mouthFrownRight: [1],
			mouthPucker: [.1],
			mouthRollLower: [.8]
		}
	},
	kiss_eyes_closed: {
		_description: "Sweet kiss with closed eyes and puckered lips",
		_tags: ["expression", "love"],
		_track: "action",
		dt: [
			500,
			1e3,
			1e3
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			browInnerUp: [.6],
			eyeBlinkLeft: [1],
			eyeBlinkRight: [1],
			eyeSquintLeft: [1],
			eyeSquintRight: [1],
			mouthPucker: [0, .5],
			noseSneerLeft: [0, .7],
			noseSneerRight: [0, .7],
			viseme_U: [0, 1]
		}
	},
	blow_kiss: {
		_description: "Blowing a kiss with wink and body lean",
		_tags: ["expression", "love"],
		_track: "action",
		dt: [
			500,
			500,
			200,
			500
		],
		rescale: [
			0,
			0,
			0,
			1
		],
		vs: {
			browInnerUp: [.6],
			eyeBlinkLeft: [
				0,
				0,
				1,
				0
			],
			eyeBlinkRight: [0],
			eyesRotateY: [0],
			bodyRotateY: [0],
			bodyRotateX: [
				0,
				.05,
				.05,
				0
			],
			bodyRotateZ: [
				0,
				-.05,
				-.05,
				0
			],
			eyeSquintLeft: [1],
			eyeSquintRight: [1],
			mouthPucker: [
				0,
				.5,
				0
			],
			noseSneerLeft: [0, .7],
			noseSneerRight: [.7],
			viseme_U: [0, 1]
		}
	},
	adoring: {
		_description: "Adoring look with warm squinted smile",
		_tags: ["expression", "love"],
		_track: "action",
		dt: [1e3, 1e3],
		rescale: [0, 1],
		vs: {
			browInnerUp: [.6],
			eyeSquintLeft: [1],
			eyeSquintRight: [1],
			mouthSmile: [.7],
			noseSneerLeft: [.7],
			noseSneerRight: [.7]
		}
	},
	heart_eyes: {
		_description: "Starstruck admiration with wide smile and open mouth",
		_tags: ["expression", "love"],
		_track: "action",
		dt: [1e3, 1e3],
		rescale: [0, 1],
		vs: {
			browInnerUp: [.6],
			jawOpen: [.1],
			mouthDimpleLeft: [.2],
			mouthDimpleRight: [.2],
			mouthOpen: [.3],
			mouthPressLeft: [.3],
			mouthPressRight: [.3],
			mouthRollLower: [.4],
			mouthShrugUpper: [.4],
			mouthSmile: [.7],
			mouthUpperUpLeft: [.3],
			mouthUpperUpRight: [.3],
			noseSneerLeft: [.4],
			noseSneerRight: [.4]
		}
	},
	rage: {
		_description: "Furious rage with furrowed brows and forward lean",
		_tags: ["expression", "angry"],
		_track: "action",
		dt: [1e3, 1500],
		rescale: [0, 1],
		vs: {
			browDownLeft: [1],
			browDownRight: [1],
			eyesLookUp: [.2],
			jawForward: [.3],
			mouthFrownLeft: [1],
			mouthFrownRight: [1],
			bodyRotateX: [.15]
		}
	},
	unamused: {
		_description: "Unamused side-glance with deep frown",
		_tags: ["expression", "angry"],
		_track: "action",
		dt: [1e3, 1e3],
		rescale: [0, 1],
		vs: {
			browDownRight: [.1],
			browInnerUp: [.7],
			browOuterUpRight: [.2],
			eyeLookInRight: [.7],
			eyeLookOutLeft: [.7],
			eyeSquintLeft: [1],
			eyeSquintRight: [.8],
			eyesRotateY: [.7],
			mouthFrownLeft: [1],
			mouthFrownRight: [1],
			mouthLeft: [.2],
			mouthPucker: [.5],
			mouthRollLower: [.2],
			mouthRollUpper: [.2],
			mouthShrugLower: [.2],
			mouthShrugUpper: [.2],
			mouthStretchLeft: [.5]
		}
	},
	scream: {
		_description: "Screaming in terror with wide eyes and open jaw",
		_tags: ["expression", "fear"],
		_track: "action",
		dt: [500, 1500],
		rescale: [0, 1],
		vs: {
			browInnerUp: [.8],
			eyeWideLeft: [.5],
			eyeWideRight: [.5],
			jawOpen: [.7],
			mouthFunnel: [.5]
		}
	},
	grimace_teeth: {
		_description: "Nervous grimace showing clenched teeth",
		_tags: ["expression", "nervous"],
		_track: "action",
		dt: [500, 1500],
		rescale: [0, 1],
		vs: {
			browDownLeft: [1],
			browDownRight: [1],
			browInnerUp: [1],
			mouthDimpleLeft: [.5],
			mouthDimpleRight: [.5],
			mouthLowerDownLeft: [1],
			mouthLowerDownRight: [1],
			mouthPressLeft: [.4],
			mouthPressRight: [.4],
			mouthPucker: [.5],
			mouthSmile: [.1],
			mouthSmileLeft: [.2],
			mouthSmileRight: [.2],
			mouthStretchLeft: [1],
			mouthStretchRight: [1],
			mouthUpperUpLeft: [1],
			mouthUpperUpRight: [1]
		}
	},
	thinking_face: {
		_description: "Pondering with furrowed brow and pursed lips",
		_tags: ["expression", "thinking"],
		_track: "action",
		dt: [500, 1500],
		rescale: [0, 1],
		vs: {
			browDownLeft: [1],
			browOuterUpRight: [1],
			eyeSquintLeft: [.6],
			mouthFrownLeft: [.7],
			mouthFrownRight: [.7],
			mouthLowerDownLeft: [.3],
			mouthPressRight: [.4],
			mouthPucker: [.1],
			mouthRight: [.5],
			mouthRollLower: [.5],
			mouthRollUpper: [.2]
		}
	},
	side_glance: {
		_description: "Suspicious side glance with eyes only",
		_tags: ["expression", "attitude"],
		_track: "action",
		dt: [500, 1500],
		rescale: [0, 1],
		vs: { eyesRotateY: [-.8] }
	},
	zzz: {
		_description: "Falling asleep with closed eyes and head drooping",
		_tags: ["expression", "sleep"],
		_track: "action",
		dt: [5e3, 5e3],
		rescale: [0, 1],
		vs: {
			eyeBlinkLeft: [1],
			eyeBlinkRight: [1],
			bodyRotateX: [.2],
			bodyRotateZ: [.1]
		}
	},
	hand_raise: {
		_description: "Raise right hand with smile",
		_tags: ["gesture", "greeting"],
		_track: "action",
		dt: [300, 2e3],
		rescale: [0, 1],
		vs: {
			mouthSmile: [.5],
			gesture: [[
				"handup",
				null,
				!0
			], null]
		}
	},
	hand_raise_left: {
		_description: "Raise left hand with smile",
		_tags: ["gesture", "greeting"],
		_track: "action",
		dt: [300, 2e3],
		rescale: [0, 1],
		vs: {
			mouthSmile: [.5],
			gesture: [["handup", null], null]
		}
	},
	thumbs_up: {
		_description: "Thumbs up with smile",
		_tags: ["gesture", "positive"],
		_track: "action",
		dt: [300, 2e3],
		rescale: [0, 1],
		vs: {
			mouthSmile: [.5],
			gesture: [["thumbup", null], null]
		}
	},
	thumbs_down: {
		_description: "Thumbs down with angry frown",
		_tags: ["gesture", "negative"],
		_track: "action",
		dt: [300, 2e3],
		rescale: [0, 1],
		vs: {
			browDownLeft: [1],
			browDownRight: [1],
			eyesLookUp: [.2],
			jawForward: [.3],
			mouthFrownLeft: [1],
			mouthFrownRight: [1],
			bodyRotateX: [.15],
			gesture: [["thumbdown", null], null]
		}
	},
	ok_sign: {
		_description: "OK hand sign with smile",
		_tags: ["gesture", "positive"],
		_track: "action",
		dt: [300, 2e3],
		rescale: [0, 1],
		vs: {
			mouthSmile: [.5],
			gesture: [["ok", null], null]
		}
	},
	shrug_both: {
		_description: "Confused shrug with both palms up",
		_tags: ["gesture", "confused"],
		_track: "action",
		dt: [1e3, 1500],
		rescale: [0, 1],
		vs: { gesture: [["shrug", null], null] }
	},
	pray: {
		_description: "Prayer hands with closed eyes and slight bow",
		_tags: ["gesture", "respect"],
		_track: "action",
		dt: [
			1500,
			300,
			1e3
		],
		rescale: [
			0,
			1,
			0
		],
		vs: {
			eyeBlinkLeft: [0, 1],
			eyeBlinkRight: [0, 1],
			bodyRotateX: [0],
			bodyRotateZ: [.1],
			gesture: [["namaste", null], null]
		}
	},
	nod: {
		_description: "Affirmative head nod",
		_tags: ["gesture", "agreement"],
		_track: "action",
		dt: [
			350,
			350,
			350,
			350
		],
		vs: {
			headMove: [0],
			headRotateX: [
				.15,
				.1,
				.15,
				0
			],
			headRotateZ: [0]
		}
	},
	head_shake: {
		_description: "Disapproving head shake",
		_tags: ["gesture", "disagreement"],
		_track: "action",
		dt: [
			350,
			350,
			350,
			350,
			350
		],
		vs: {
			headMove: [0],
			headRotateY: [
				-.08,
				.08,
				-.08,
				.08,
				0
			],
			headRotateZ: [0]
		}
	},
	fear: {
		_description: "Fearful state with wide eyes, raised brows, and tense mouth",
		_tags: ["emotion", "negative"],
		_track: "mood",
		dt: [
			800,
			3e3,
			800
		],
		vs: {
			browInnerUp: [.7],
			eyeSquintLeft: [.5],
			eyeSquintRight: [.5],
			eyeWideLeft: [.6],
			eyeWideRight: [.6],
			mouthClose: [.1],
			mouthFunnel: [.3],
			mouthShrugLower: [.5],
			mouthShrugUpper: [.5]
		},
		_detect: {
			eyeWideLeft: .25,
			eyeWideRight: .25,
			browInnerUp: .2,
			mouthFunnel: .15,
			mouthShrugUpper: .1,
			mouthShrugLower: .05
		},
		_react: {
			mood: "pleading",
			intensity: .3,
			gesture: "deep_breath"
		}
	},
	love: {
		_description: "Loving gaze with soft eyes, gentle smile, and slight forward lean",
		_tags: ["emotion", "positive"],
		_track: "mood",
		dt: [
			1e3,
			3e3,
			1e3
		],
		vs: {
			browInnerUp: [.4],
			browOuterUpLeft: [.2],
			browOuterUpRight: [.2],
			mouthSmile: [.2],
			eyeBlinkLeft: [.6],
			eyeBlinkRight: [.6],
			eyeWideLeft: [.7],
			eyeWideRight: [.7],
			bodyRotateX: [.1],
			mouthDimpleLeft: [.1],
			mouthDimpleRight: [.1],
			mouthPressLeft: [.2],
			mouthShrugUpper: [.2],
			mouthUpperUpLeft: [.1],
			mouthUpperUpRight: [.1]
		},
		_detect: {
			cheekSquintLeft: .2,
			cheekSquintRight: .2,
			mouthSmileLeft: .15,
			mouthSmileRight: .15,
			eyeSquintLeft: .15,
			eyeSquintRight: .15
		},
		_react: {
			mood: "happy",
			intensity: .25,
			gesture: "adoring"
		}
	},
	surprise: {
		_description: "Surprised with wide eyes and open mouth",
		_tags: [
			"shock",
			"amazed",
			"wow"
		],
		_track: "mood",
		_detect: {
			jawOpen: .35,
			eyeWideLeft: .15,
			eyeWideRight: .15,
			browInnerUp: .15,
			browOuterUpLeft: .1,
			browOuterUpRight: .1
		},
		_react: {
			mood: "curious",
			intensity: .3,
			gesture: "raise_eyebrows"
		}
	}
}), je = /* @__PURE__ */ new Set([
	"headMove",
	"eyeContact",
	"gesture"
]);
function Me() {
	let e = {};
	for (let [t, n] of Ae) {
		let r = Ie(n.dt ?? []), i = n.vs ?? {}, a = i.gesture ?? [];
		e[t] = {
			name: t,
			track: n._track === "mood" ? "mood" : "action",
			description: n._description ?? "",
			tags: n._tags ?? [],
			durationMs: r[r.length - 1] ?? 0,
			frameTimes: r,
			frameValues: i,
			gestureValues: a,
			rescale: n.rescale,
			overlay: n._overlay
		};
	}
	return Object.freeze(e);
}
var Ne = Me();
Object.freeze(Object.fromEntries(Object.entries(Ne).map(([e, t]) => [e, {
	name: t.name,
	track: t.track,
	description: t.description,
	tags: t.tags,
	durationMs: t.durationMs
}]))), Object.freeze(Object.values(Ne).filter((e) => e.track === "action").map((e) => e.name));
var Pe = Object.freeze(Object.values(Ne).filter((e) => e.track === "mood" && (e.name === "neutral" || e.name === "happy" || Object.keys(e.frameValues).length > 0)).map((e) => e.name));
function Fe(e) {
	let t = Ne[e];
	if (!(t === void 0 || t.track !== "mood")) return Re(t.frameValues);
}
function Ie(e) {
	let t = [0];
	for (let n of e) t.push(t[t.length - 1] + n);
	return t;
}
function Le(e, t) {
	let n = {};
	for (let [r, i] of Object.entries(e)) {
		if (je.has(r) || r.startsWith("viseme_")) continue;
		let e = i.map((e) => ze(e, t));
		if (r === "eyesRotateX") {
			n.eyesLookDown = e.map((e) => Math.max(0, e)), n.eyesLookUp = e.map((e) => Math.max(0, -e));
			continue;
		}
		if (r === "eyesRotateY") {
			n.eyeLookOutLeft = e.map((e) => Math.max(0, e)), n.eyeLookInLeft = e.map((e) => Math.max(0, -e)), n.eyeLookOutRight = e.map((e) => Math.max(0, -e)), n.eyeLookInRight = e.map((e) => Math.max(0, e));
			continue;
		}
		n[r] = e;
	}
	return n;
}
function Re(e) {
	let t = Le(e, { random: () => .5 }), n = {};
	for (let [e, r] of Object.entries(t)) {
		let t = r[+(r.length > 1)];
		t !== void 0 && (n[e] = t);
	}
	return n;
}
function ze(e, t) {
	if (typeof e == "number") return e;
	if (!Array.isArray(e) || e.length < 2) return 0;
	let n = typeof e[0] == "number" ? e[0] : 0, r = typeof e[1] == "number" ? e[1] : n, i = typeof e[2] == "number" ? e[2] : 1, a = typeof e[3] == "number" ? e[3] : 1, o = t.random(), s = i + (a - i) * o;
	return n + (r - n) * o ** (1 / Math.max(.001, s));
}
//#endregion
//#region ../authoring/component-v2/src/avatar/mood/expression-engine.ts
var Be = {
	neutral: { eyesLookDown: .1 },
	happy: {
		mouthSmile: .2,
		eyesLookDown: .1
	},
	angry: {
		eyesLookDown: .1,
		browDownLeft: .6,
		browDownRight: .6,
		jawForward: .3,
		mouthFrownLeft: .7,
		mouthFrownRight: .7,
		mouthRollLower: .2,
		mouthShrugLower: .3,
		handFistLeft: 1,
		handFistRight: 1
	},
	sad: {
		eyesLookDown: .2,
		browDownRight: .1,
		browInnerUp: .6,
		browOuterUpRight: .2,
		eyeSquintLeft: .7,
		eyeSquintRight: .7,
		mouthFrownLeft: .8,
		mouthFrownRight: .8,
		mouthLeft: .2,
		mouthPucker: .5,
		mouthRollLower: .2,
		mouthRollUpper: .2,
		mouthShrugLower: .2,
		mouthShrugUpper: .2,
		mouthStretchLeft: .4
	},
	fear: {
		browInnerUp: .7,
		eyeSquintLeft: .5,
		eyeSquintRight: .5,
		eyeWideLeft: .6,
		eyeWideRight: .6,
		mouthClose: .1,
		mouthFunnel: .3,
		mouthShrugLower: .5,
		mouthShrugUpper: .5
	},
	disgust: {
		browDownLeft: .7,
		browDownRight: .1,
		browInnerUp: .3,
		eyeSquintLeft: 1,
		eyeSquintRight: 1,
		eyeWideLeft: .5,
		eyeWideRight: .5,
		eyesRotateX: .05,
		mouthLeft: .4,
		mouthPressLeft: .3,
		mouthRollLower: .3,
		mouthShrugLower: .3,
		mouthShrugUpper: .8,
		mouthUpperUpLeft: .3,
		noseSneerLeft: 1,
		noseSneerRight: .7
	},
	love: {
		browInnerUp: .4,
		browOuterUpLeft: .2,
		browOuterUpRight: .2,
		mouthSmile: .2,
		eyeBlinkLeft: .6,
		eyeBlinkRight: .6,
		eyeWideLeft: .7,
		eyeWideRight: .7,
		bodyRotateX: .1,
		mouthDimpleLeft: .1,
		mouthDimpleRight: .1,
		mouthPressLeft: .2,
		mouthShrugUpper: .2,
		mouthUpperUpLeft: .1,
		mouthUpperUpRight: .1
	},
	sleep: {
		eyeBlinkLeft: 1,
		eyeBlinkRight: 1,
		eyesClosed: .6
	}
};
function Ve() {
	return {
		...Object.fromEntries(Pe.map((e) => [e, Fe(e) ?? {}])),
		...Be
	};
}
Ve();
var He = {
	LEFT: 0,
	MIDDLE: 1,
	RIGHT: 2,
	ROTATE: 0,
	DOLLY: 1,
	PAN: 2
}, Ue = {
	ROTATE: 0,
	PAN: 1,
	DOLLY_PAN: 2,
	DOLLY_ROTATE: 3
}, We = "attached", Ge = "detached", Ke = 1e3, qe = 1001, Je = 1002, Ye = 1003, Xe = 1004, Ze = 1004, Qe = 1005, $e = 1005, et = 1006, tt = 1007, nt = 1007, rt = 1008, it = 1008, at = 1009, ot = 1010, st = 1011, ct = 1012, lt = 1013, ut = 1014, dt = 1015, ft = 1016, pt = 1017, mt = 1018, ht = 1020, gt = 35902, _t = 35899, vt = 1021, yt = 1022, bt = 1023, xt = 1026, St = 1027, Ct = 1028, wt = 1029, Tt = 1030, Et = 1031, Dt = 1032, Ot = 1033, kt = 33776, At = 33777, jt = 33778, Mt = 33779, Nt = 35840, Pt = 35841, Ft = 35842, It = 35843, Lt = 36196, Rt = 37492, zt = 37496, Bt = 37488, Vt = 37489, Ht = 37490, Ut = 37491, Wt = 37808, Gt = 37809, Kt = 37810, qt = 37811, Jt = 37812, Yt = 37813, Xt = 37814, Zt = 37815, Qt = 37816, $t = 37817, en = 37818, tn = 37819, nn = 37820, rn = 37821, an = 36492, on = 36494, sn = 36495, cn = 36283, ln = 36284, un = 36285, dn = 36286, fn = 2200, pn = 2201, mn = 2202, hn = 2300, gn = 2301, _n = 2302, vn = 2303, yn = 2400, bn = 2401, xn = 2402, Sn = 2500, Cn = 2501, wn = 3200, Tn = 3201, En = 3202, Dn = 3203, On = "srgb", kn = "srgb-linear", An = "linear", jn = "srgb", Mn = 7680, Nn = 7681, Pn = 7682, Fn = 7683, In = 34055, Ln = 34056, Rn = 5386, zn = 35044, Bn = 35048, Vn = 35040, Hn = 35045, Un = 35049, Wn = 35041, Gn = 35046, Kn = 35050, qn = 35042, Jn = "300 es", Yn = 2e3, Xn = 2001, Zn = {
	COMPUTE: "compute",
	RENDER: "render"
}, Qn = {
	PERSPECTIVE: "perspective",
	LINEAR: "linear",
	FLAT: "flat"
}, $n = {
	NORMAL: "normal",
	CENTROID: "centroid",
	SAMPLE: "sample",
	FIRST: "first",
	EITHER: "either"
}, er = { TEXTURE_COMPARE: "depthTextureCompare" };
function tr(e) {
	for (let t = e.length - 1; t >= 0; --t) if (e[t] >= 65535) return !0;
	return !1;
}
var nr = {
	Int8Array,
	Uint8Array,
	Uint8ClampedArray,
	Int16Array,
	Uint16Array,
	Int32Array,
	Uint32Array,
	Float32Array,
	Float64Array
};
function rr(e, t) {
	return new nr[e](t);
}
function ir(e) {
	return ArrayBuffer.isView(e) && !(e instanceof DataView);
}
function ar(e) {
	return document.createElementNS("http://www.w3.org/1999/xhtml", e);
}
function or() {
	let e = ar("canvas");
	return e.style.display = "block", e;
}
var sr = {}, cr = null;
function lr(e) {
	cr = e;
}
function ur() {
	return cr;
}
function dr(...e) {
	let t = "THREE." + e.shift();
	cr ? cr("log", t, ...e) : console.log(t, ...e);
}
function fr(e) {
	let t = e[0];
	if (typeof t == "string" && t.startsWith("TSL:")) {
		let t = e[1];
		t && t.isStackTrace ? e[0] += " " + t.getLocation() : e[1] = "Stack trace not available. Enable \"THREE.Node.captureStackTrace\" to capture stack traces.";
	}
	return e;
}
function R(...e) {
	e = fr(e);
	let t = "THREE." + e.shift();
	if (cr) cr("warn", t, ...e);
	else {
		let n = e[0];
		n && n.isStackTrace ? console.warn(n.getError(t)) : console.warn(t, ...e);
	}
}
function z(...e) {
	e = fr(e);
	let t = "THREE." + e.shift();
	if (cr) cr("error", t, ...e);
	else {
		let n = e[0];
		n && n.isStackTrace ? console.error(n.getError(t)) : console.error(t, ...e);
	}
}
function pr(...e) {
	let t = e.join(" ");
	t in sr || (sr[t] = !0, R(...e));
}
function mr(e, t, n) {
	return new Promise(function(r, i) {
		function a() {
			switch (e.clientWaitSync(t, e.SYNC_FLUSH_COMMANDS_BIT, 0)) {
				case e.WAIT_FAILED:
					i();
					break;
				case e.TIMEOUT_EXPIRED:
					setTimeout(a, n);
					break;
				default: r();
			}
		}
		setTimeout(a, n);
	});
}
var hr = {
	0: 1,
	2: 6,
	4: 7,
	3: 5,
	1: 0,
	6: 2,
	7: 4,
	5: 3
}, gr = class {
	addEventListener(e, t) {
		this._listeners === void 0 && (this._listeners = {});
		let n = this._listeners;
		n[e] === void 0 && (n[e] = []), n[e].indexOf(t) === -1 && n[e].push(t);
	}
	hasEventListener(e, t) {
		let n = this._listeners;
		return n === void 0 ? !1 : n[e] !== void 0 && n[e].indexOf(t) !== -1;
	}
	removeEventListener(e, t) {
		let n = this._listeners;
		if (n === void 0) return;
		let r = n[e];
		if (r !== void 0) {
			let e = r.indexOf(t);
			e !== -1 && r.splice(e, 1);
		}
	}
	dispatchEvent(e) {
		let t = this._listeners;
		if (t === void 0) return;
		let n = t[e.type];
		if (n !== void 0) {
			e.target = this;
			let t = n.slice(0);
			for (let n = 0, r = t.length; n < r; n++) t[n].call(this, e);
			e.target = null;
		}
	}
}, _r = /* @__PURE__ */ "00.01.02.03.04.05.06.07.08.09.0a.0b.0c.0d.0e.0f.10.11.12.13.14.15.16.17.18.19.1a.1b.1c.1d.1e.1f.20.21.22.23.24.25.26.27.28.29.2a.2b.2c.2d.2e.2f.30.31.32.33.34.35.36.37.38.39.3a.3b.3c.3d.3e.3f.40.41.42.43.44.45.46.47.48.49.4a.4b.4c.4d.4e.4f.50.51.52.53.54.55.56.57.58.59.5a.5b.5c.5d.5e.5f.60.61.62.63.64.65.66.67.68.69.6a.6b.6c.6d.6e.6f.70.71.72.73.74.75.76.77.78.79.7a.7b.7c.7d.7e.7f.80.81.82.83.84.85.86.87.88.89.8a.8b.8c.8d.8e.8f.90.91.92.93.94.95.96.97.98.99.9a.9b.9c.9d.9e.9f.a0.a1.a2.a3.a4.a5.a6.a7.a8.a9.aa.ab.ac.ad.ae.af.b0.b1.b2.b3.b4.b5.b6.b7.b8.b9.ba.bb.bc.bd.be.bf.c0.c1.c2.c3.c4.c5.c6.c7.c8.c9.ca.cb.cc.cd.ce.cf.d0.d1.d2.d3.d4.d5.d6.d7.d8.d9.da.db.dc.dd.de.df.e0.e1.e2.e3.e4.e5.e6.e7.e8.e9.ea.eb.ec.ed.ee.ef.f0.f1.f2.f3.f4.f5.f6.f7.f8.f9.fa.fb.fc.fd.fe.ff".split("."), vr = 1234567, yr = Math.PI / 180, br = 180 / Math.PI;
function xr() {
	let e = Math.random() * 4294967295 | 0, t = Math.random() * 4294967295 | 0, n = Math.random() * 4294967295 | 0, r = Math.random() * 4294967295 | 0;
	return (_r[e & 255] + _r[e >> 8 & 255] + _r[e >> 16 & 255] + _r[e >> 24 & 255] + "-" + _r[t & 255] + _r[t >> 8 & 255] + "-" + _r[t >> 16 & 15 | 64] + _r[t >> 24 & 255] + "-" + _r[n & 63 | 128] + _r[n >> 8 & 255] + "-" + _r[n >> 16 & 255] + _r[n >> 24 & 255] + _r[r & 255] + _r[r >> 8 & 255] + _r[r >> 16 & 255] + _r[r >> 24 & 255]).toLowerCase();
}
function B(e, t, n) {
	return Math.max(t, Math.min(n, e));
}
function Sr(e, t) {
	return (e % t + t) % t;
}
function Cr(e, t, n, r, i) {
	return r + (e - t) * (i - r) / (n - t);
}
function wr(e, t, n) {
	return e === t ? 0 : (n - e) / (t - e);
}
function Tr(e, t, n) {
	return (1 - n) * e + n * t;
}
function Er(e, t, n, r) {
	return Tr(e, t, 1 - Math.exp(-n * r));
}
function Dr(e, t = 1) {
	return t - Math.abs(Sr(e, t * 2) - t);
}
function Or(e, t, n) {
	return e <= t ? 0 : e >= n ? 1 : (e = (e - t) / (n - t), e * e * (3 - 2 * e));
}
function kr(e, t, n) {
	return e <= t ? 0 : e >= n ? 1 : (e = (e - t) / (n - t), e * e * e * (e * (e * 6 - 15) + 10));
}
function Ar(e, t) {
	return e + Math.floor(Math.random() * (t - e + 1));
}
function jr(e, t) {
	return e + Math.random() * (t - e);
}
function Mr(e) {
	return e * (.5 - Math.random());
}
function Nr(e) {
	e !== void 0 && (vr = e);
	let t = vr += 1831565813;
	return t = Math.imul(t ^ t >>> 15, t | 1), t ^= t + Math.imul(t ^ t >>> 7, t | 61), ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function Pr(e) {
	return e * yr;
}
function Fr(e) {
	return e * br;
}
function Ir(e) {
	return (e & e - 1) == 0 && e !== 0;
}
function Lr(e) {
	return 2 ** Math.ceil(Math.log(e) / Math.LN2);
}
function Rr(e) {
	return 2 ** Math.floor(Math.log(e) / Math.LN2);
}
function zr(e, t, n, r, i) {
	let a = Math.cos, o = Math.sin, s = a(n / 2), c = o(n / 2), l = a((t + r) / 2), u = o((t + r) / 2), d = a((t - r) / 2), f = o((t - r) / 2), p = a((r - t) / 2), m = o((r - t) / 2);
	switch (i) {
		case "XYX":
			e.set(s * u, c * d, c * f, s * l);
			break;
		case "YZY":
			e.set(c * f, s * u, c * d, s * l);
			break;
		case "ZXZ":
			e.set(c * d, c * f, s * u, s * l);
			break;
		case "XZX":
			e.set(s * u, c * m, c * p, s * l);
			break;
		case "YXY":
			e.set(c * p, s * u, c * m, s * l);
			break;
		case "ZYZ":
			e.set(c * m, c * p, s * u, s * l);
			break;
		default: R("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: " + i);
	}
}
function Br(e, t) {
	switch (t.constructor) {
		case Float32Array: return e;
		case Uint32Array: return e / 4294967295;
		case Uint16Array: return e / 65535;
		case Uint8Array: return e / 255;
		case Int32Array: return Math.max(e / 2147483647, -1);
		case Int16Array: return Math.max(e / 32767, -1);
		case Int8Array: return Math.max(e / 127, -1);
		default: throw Error("THREE.MathUtils: Invalid component type.");
	}
}
function V(e, t) {
	switch (t.constructor) {
		case Float32Array: return e;
		case Uint32Array: return Math.round(e * 4294967295);
		case Uint16Array: return Math.round(e * 65535);
		case Uint8Array: return Math.round(e * 255);
		case Int32Array: return Math.round(e * 2147483647);
		case Int16Array: return Math.round(e * 32767);
		case Int8Array: return Math.round(e * 127);
		default: throw Error("THREE.MathUtils: Invalid component type.");
	}
}
var Vr = {
	DEG2RAD: yr,
	RAD2DEG: br,
	generateUUID: xr,
	clamp: B,
	euclideanModulo: Sr,
	mapLinear: Cr,
	inverseLerp: wr,
	lerp: Tr,
	damp: Er,
	pingpong: Dr,
	smoothstep: Or,
	smootherstep: kr,
	randInt: Ar,
	randFloat: jr,
	randFloatSpread: Mr,
	seededRandom: Nr,
	degToRad: Pr,
	radToDeg: Fr,
	isPowerOfTwo: Ir,
	ceilPowerOfTwo: Lr,
	floorPowerOfTwo: Rr,
	setQuaternionFromProperEuler: zr,
	normalize: V,
	denormalize: Br
}, H = class e {
	static {
		e.prototype.isVector2 = !0;
	}
	constructor(e = 0, t = 0) {
		this.x = e, this.y = t;
	}
	get width() {
		return this.x;
	}
	set width(e) {
		this.x = e;
	}
	get height() {
		return this.y;
	}
	set height(e) {
		this.y = e;
	}
	set(e, t) {
		return this.x = e, this.y = t, this;
	}
	setScalar(e) {
		return this.x = e, this.y = e, this;
	}
	setX(e) {
		return this.x = e, this;
	}
	setY(e) {
		return this.y = e, this;
	}
	setComponent(e, t) {
		switch (e) {
			case 0:
				this.x = t;
				break;
			case 1:
				this.y = t;
				break;
			default: throw Error("THREE.Vector2: index is out of range: " + e);
		}
		return this;
	}
	getComponent(e) {
		switch (e) {
			case 0: return this.x;
			case 1: return this.y;
			default: throw Error("THREE.Vector2: index is out of range: " + e);
		}
	}
	clone() {
		return new this.constructor(this.x, this.y);
	}
	copy(e) {
		return this.x = e.x, this.y = e.y, this;
	}
	add(e) {
		return this.x += e.x, this.y += e.y, this;
	}
	addScalar(e) {
		return this.x += e, this.y += e, this;
	}
	addVectors(e, t) {
		return this.x = e.x + t.x, this.y = e.y + t.y, this;
	}
	addScaledVector(e, t) {
		return this.x += e.x * t, this.y += e.y * t, this;
	}
	sub(e) {
		return this.x -= e.x, this.y -= e.y, this;
	}
	subScalar(e) {
		return this.x -= e, this.y -= e, this;
	}
	subVectors(e, t) {
		return this.x = e.x - t.x, this.y = e.y - t.y, this;
	}
	multiply(e) {
		return this.x *= e.x, this.y *= e.y, this;
	}
	multiplyScalar(e) {
		return this.x *= e, this.y *= e, this;
	}
	divide(e) {
		return this.x /= e.x, this.y /= e.y, this;
	}
	divideScalar(e) {
		return this.multiplyScalar(1 / e);
	}
	applyMatrix3(e) {
		let t = this.x, n = this.y, r = e.elements;
		return this.x = r[0] * t + r[3] * n + r[6], this.y = r[1] * t + r[4] * n + r[7], this;
	}
	min(e) {
		return this.x = Math.min(this.x, e.x), this.y = Math.min(this.y, e.y), this;
	}
	max(e) {
		return this.x = Math.max(this.x, e.x), this.y = Math.max(this.y, e.y), this;
	}
	clamp(e, t) {
		return this.x = B(this.x, e.x, t.x), this.y = B(this.y, e.y, t.y), this;
	}
	clampScalar(e, t) {
		return this.x = B(this.x, e, t), this.y = B(this.y, e, t), this;
	}
	clampLength(e, t) {
		let n = this.length();
		return this.divideScalar(n || 1).multiplyScalar(B(n, e, t));
	}
	floor() {
		return this.x = Math.floor(this.x), this.y = Math.floor(this.y), this;
	}
	ceil() {
		return this.x = Math.ceil(this.x), this.y = Math.ceil(this.y), this;
	}
	round() {
		return this.x = Math.round(this.x), this.y = Math.round(this.y), this;
	}
	roundToZero() {
		return this.x = Math.trunc(this.x), this.y = Math.trunc(this.y), this;
	}
	negate() {
		return this.x = -this.x, this.y = -this.y, this;
	}
	dot(e) {
		return this.x * e.x + this.y * e.y;
	}
	cross(e) {
		return this.x * e.y - this.y * e.x;
	}
	lengthSq() {
		return this.x * this.x + this.y * this.y;
	}
	length() {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}
	manhattanLength() {
		return Math.abs(this.x) + Math.abs(this.y);
	}
	normalize() {
		return this.divideScalar(this.length() || 1);
	}
	angle() {
		return Math.atan2(-this.y, -this.x) + Math.PI;
	}
	angleTo(e) {
		let t = Math.sqrt(this.lengthSq() * e.lengthSq());
		if (t === 0) return Math.PI / 2;
		let n = this.dot(e) / t;
		return Math.acos(B(n, -1, 1));
	}
	distanceTo(e) {
		return Math.sqrt(this.distanceToSquared(e));
	}
	distanceToSquared(e) {
		let t = this.x - e.x, n = this.y - e.y;
		return t * t + n * n;
	}
	manhattanDistanceTo(e) {
		return Math.abs(this.x - e.x) + Math.abs(this.y - e.y);
	}
	setLength(e) {
		return this.normalize().multiplyScalar(e);
	}
	lerp(e, t) {
		return this.x += (e.x - this.x) * t, this.y += (e.y - this.y) * t, this;
	}
	lerpVectors(e, t, n) {
		return this.x = e.x + (t.x - e.x) * n, this.y = e.y + (t.y - e.y) * n, this;
	}
	equals(e) {
		return e.x === this.x && e.y === this.y;
	}
	fromArray(e, t = 0) {
		return this.x = e[t], this.y = e[t + 1], this;
	}
	toArray(e = [], t = 0) {
		return e[t] = this.x, e[t + 1] = this.y, e;
	}
	fromBufferAttribute(e, t) {
		return this.x = e.getX(t), this.y = e.getY(t), this;
	}
	rotateAround(e, t) {
		let n = Math.cos(t), r = Math.sin(t), i = this.x - e.x, a = this.y - e.y;
		return this.x = i * n - a * r + e.x, this.y = i * r + a * n + e.y, this;
	}
	random() {
		return this.x = Math.random(), this.y = Math.random(), this;
	}
	*[Symbol.iterator]() {
		yield this.x, yield this.y;
	}
}, Hr = class {
	constructor(e = 0, t = 0, n = 0, r = 1) {
		this.isQuaternion = !0, this._x = e, this._y = t, this._z = n, this._w = r;
	}
	static slerpFlat(e, t, n, r, i, a, o) {
		let s = n[r + 0], c = n[r + 1], l = n[r + 2], u = n[r + 3], d = i[a + 0], f = i[a + 1], p = i[a + 2], m = i[a + 3];
		if (u !== m || s !== d || c !== f || l !== p) {
			let e = s * d + c * f + l * p + u * m;
			e < 0 && (d = -d, f = -f, p = -p, m = -m, e = -e);
			let t = 1 - o;
			if (e < .9995) {
				let n = Math.acos(e), r = Math.sin(n);
				t = Math.sin(t * n) / r, o = Math.sin(o * n) / r, s = s * t + d * o, c = c * t + f * o, l = l * t + p * o, u = u * t + m * o;
			} else {
				s = s * t + d * o, c = c * t + f * o, l = l * t + p * o, u = u * t + m * o;
				let e = 1 / Math.sqrt(s * s + c * c + l * l + u * u);
				s *= e, c *= e, l *= e, u *= e;
			}
		}
		e[t] = s, e[t + 1] = c, e[t + 2] = l, e[t + 3] = u;
	}
	static multiplyQuaternionsFlat(e, t, n, r, i, a) {
		let o = n[r], s = n[r + 1], c = n[r + 2], l = n[r + 3], u = i[a], d = i[a + 1], f = i[a + 2], p = i[a + 3];
		return e[t] = o * p + l * u + s * f - c * d, e[t + 1] = s * p + l * d + c * u - o * f, e[t + 2] = c * p + l * f + o * d - s * u, e[t + 3] = l * p - o * u - s * d - c * f, e;
	}
	get x() {
		return this._x;
	}
	set x(e) {
		this._x = e, this._onChangeCallback();
	}
	get y() {
		return this._y;
	}
	set y(e) {
		this._y = e, this._onChangeCallback();
	}
	get z() {
		return this._z;
	}
	set z(e) {
		this._z = e, this._onChangeCallback();
	}
	get w() {
		return this._w;
	}
	set w(e) {
		this._w = e, this._onChangeCallback();
	}
	set(e, t, n, r) {
		return this._x = e, this._y = t, this._z = n, this._w = r, this._onChangeCallback(), this;
	}
	clone() {
		return new this.constructor(this._x, this._y, this._z, this._w);
	}
	copy(e) {
		return this._x = e.x, this._y = e.y, this._z = e.z, this._w = e.w, this._onChangeCallback(), this;
	}
	setFromEuler(e, t = !0) {
		let n = e._x, r = e._y, i = e._z, a = e._order, o = Math.cos, s = Math.sin, c = o(n / 2), l = o(r / 2), u = o(i / 2), d = s(n / 2), f = s(r / 2), p = s(i / 2);
		switch (a) {
			case "XYZ":
				this._x = d * l * u + c * f * p, this._y = c * f * u - d * l * p, this._z = c * l * p + d * f * u, this._w = c * l * u - d * f * p;
				break;
			case "YXZ":
				this._x = d * l * u + c * f * p, this._y = c * f * u - d * l * p, this._z = c * l * p - d * f * u, this._w = c * l * u + d * f * p;
				break;
			case "ZXY":
				this._x = d * l * u - c * f * p, this._y = c * f * u + d * l * p, this._z = c * l * p + d * f * u, this._w = c * l * u - d * f * p;
				break;
			case "ZYX":
				this._x = d * l * u - c * f * p, this._y = c * f * u + d * l * p, this._z = c * l * p - d * f * u, this._w = c * l * u + d * f * p;
				break;
			case "YZX":
				this._x = d * l * u + c * f * p, this._y = c * f * u + d * l * p, this._z = c * l * p - d * f * u, this._w = c * l * u - d * f * p;
				break;
			case "XZY":
				this._x = d * l * u - c * f * p, this._y = c * f * u - d * l * p, this._z = c * l * p + d * f * u, this._w = c * l * u + d * f * p;
				break;
			default: R("Quaternion: .setFromEuler() encountered an unknown order: " + a);
		}
		return t === !0 && this._onChangeCallback(), this;
	}
	setFromAxisAngle(e, t) {
		let n = t / 2, r = Math.sin(n);
		return this._x = e.x * r, this._y = e.y * r, this._z = e.z * r, this._w = Math.cos(n), this._onChangeCallback(), this;
	}
	setFromRotationMatrix(e) {
		let t = e.elements, n = t[0], r = t[4], i = t[8], a = t[1], o = t[5], s = t[9], c = t[2], l = t[6], u = t[10], d = n + o + u;
		if (d > 0) {
			let e = .5 / Math.sqrt(d + 1);
			this._w = .25 / e, this._x = (l - s) * e, this._y = (i - c) * e, this._z = (a - r) * e;
		} else if (n > o && n > u) {
			let e = 2 * Math.sqrt(1 + n - o - u);
			this._w = (l - s) / e, this._x = .25 * e, this._y = (r + a) / e, this._z = (i + c) / e;
		} else if (o > u) {
			let e = 2 * Math.sqrt(1 + o - n - u);
			this._w = (i - c) / e, this._x = (r + a) / e, this._y = .25 * e, this._z = (s + l) / e;
		} else {
			let e = 2 * Math.sqrt(1 + u - n - o);
			this._w = (a - r) / e, this._x = (i + c) / e, this._y = (s + l) / e, this._z = .25 * e;
		}
		return this._onChangeCallback(), this;
	}
	setFromUnitVectors(e, t) {
		let n = e.dot(t) + 1;
		return n < 1e-8 ? (n = 0, Math.abs(e.x) > Math.abs(e.z) ? (this._x = -e.y, this._y = e.x, this._z = 0, this._w = n) : (this._x = 0, this._y = -e.z, this._z = e.y, this._w = n)) : (this._x = e.y * t.z - e.z * t.y, this._y = e.z * t.x - e.x * t.z, this._z = e.x * t.y - e.y * t.x, this._w = n), this.normalize();
	}
	angleTo(e) {
		return 2 * Math.acos(Math.abs(B(this.dot(e), -1, 1)));
	}
	rotateTowards(e, t) {
		let n = this.angleTo(e);
		if (n === 0) return this;
		let r = Math.min(1, t / n);
		return this.slerp(e, r), this;
	}
	identity() {
		return this.set(0, 0, 0, 1);
	}
	invert() {
		return this.conjugate();
	}
	conjugate() {
		return this._x *= -1, this._y *= -1, this._z *= -1, this._onChangeCallback(), this;
	}
	dot(e) {
		return this._x * e._x + this._y * e._y + this._z * e._z + this._w * e._w;
	}
	lengthSq() {
		return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w;
	}
	length() {
		return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w);
	}
	normalize() {
		let e = this.length();
		return e === 0 ? (this._x = 0, this._y = 0, this._z = 0, this._w = 1) : (e = 1 / e, this._x *= e, this._y *= e, this._z *= e, this._w *= e), this._onChangeCallback(), this;
	}
	multiply(e) {
		return this.multiplyQuaternions(this, e);
	}
	premultiply(e) {
		return this.multiplyQuaternions(e, this);
	}
	multiplyQuaternions(e, t) {
		let n = e._x, r = e._y, i = e._z, a = e._w, o = t._x, s = t._y, c = t._z, l = t._w;
		return this._x = n * l + a * o + r * c - i * s, this._y = r * l + a * s + i * o - n * c, this._z = i * l + a * c + n * s - r * o, this._w = a * l - n * o - r * s - i * c, this._onChangeCallback(), this;
	}
	slerp(e, t) {
		let n = e._x, r = e._y, i = e._z, a = e._w, o = this.dot(e);
		o < 0 && (n = -n, r = -r, i = -i, a = -a, o = -o);
		let s = 1 - t;
		if (o < .9995) {
			let e = Math.acos(o), c = Math.sin(e);
			s = Math.sin(s * e) / c, t = Math.sin(t * e) / c, this._x = this._x * s + n * t, this._y = this._y * s + r * t, this._z = this._z * s + i * t, this._w = this._w * s + a * t, this._onChangeCallback();
		} else this._x = this._x * s + n * t, this._y = this._y * s + r * t, this._z = this._z * s + i * t, this._w = this._w * s + a * t, this.normalize();
		return this;
	}
	slerpQuaternions(e, t, n) {
		return this.copy(e).slerp(t, n);
	}
	random() {
		let e = 2 * Math.PI * Math.random(), t = 2 * Math.PI * Math.random(), n = Math.random(), r = Math.sqrt(1 - n), i = Math.sqrt(n);
		return this.set(r * Math.sin(e), r * Math.cos(e), i * Math.sin(t), i * Math.cos(t));
	}
	equals(e) {
		return e._x === this._x && e._y === this._y && e._z === this._z && e._w === this._w;
	}
	fromArray(e, t = 0) {
		return this._x = e[t], this._y = e[t + 1], this._z = e[t + 2], this._w = e[t + 3], this._onChangeCallback(), this;
	}
	toArray(e = [], t = 0) {
		return e[t] = this._x, e[t + 1] = this._y, e[t + 2] = this._z, e[t + 3] = this._w, e;
	}
	fromBufferAttribute(e, t) {
		return this._x = e.getX(t), this._y = e.getY(t), this._z = e.getZ(t), this._w = e.getW(t), this._onChangeCallback(), this;
	}
	toJSON() {
		return this.toArray();
	}
	_onChange(e) {
		return this._onChangeCallback = e, this;
	}
	_onChangeCallback() {}
	*[Symbol.iterator]() {
		yield this._x, yield this._y, yield this._z, yield this._w;
	}
}, U = class e {
	static {
		e.prototype.isVector3 = !0;
	}
	constructor(e = 0, t = 0, n = 0) {
		this.x = e, this.y = t, this.z = n;
	}
	set(e, t, n) {
		return n === void 0 && (n = this.z), this.x = e, this.y = t, this.z = n, this;
	}
	setScalar(e) {
		return this.x = e, this.y = e, this.z = e, this;
	}
	setX(e) {
		return this.x = e, this;
	}
	setY(e) {
		return this.y = e, this;
	}
	setZ(e) {
		return this.z = e, this;
	}
	setComponent(e, t) {
		switch (e) {
			case 0:
				this.x = t;
				break;
			case 1:
				this.y = t;
				break;
			case 2:
				this.z = t;
				break;
			default: throw Error("THREE.Vector3: index is out of range: " + e);
		}
		return this;
	}
	getComponent(e) {
		switch (e) {
			case 0: return this.x;
			case 1: return this.y;
			case 2: return this.z;
			default: throw Error("THREE.Vector3: index is out of range: " + e);
		}
	}
	clone() {
		return new this.constructor(this.x, this.y, this.z);
	}
	copy(e) {
		return this.x = e.x, this.y = e.y, this.z = e.z, this;
	}
	add(e) {
		return this.x += e.x, this.y += e.y, this.z += e.z, this;
	}
	addScalar(e) {
		return this.x += e, this.y += e, this.z += e, this;
	}
	addVectors(e, t) {
		return this.x = e.x + t.x, this.y = e.y + t.y, this.z = e.z + t.z, this;
	}
	addScaledVector(e, t) {
		return this.x += e.x * t, this.y += e.y * t, this.z += e.z * t, this;
	}
	sub(e) {
		return this.x -= e.x, this.y -= e.y, this.z -= e.z, this;
	}
	subScalar(e) {
		return this.x -= e, this.y -= e, this.z -= e, this;
	}
	subVectors(e, t) {
		return this.x = e.x - t.x, this.y = e.y - t.y, this.z = e.z - t.z, this;
	}
	multiply(e) {
		return this.x *= e.x, this.y *= e.y, this.z *= e.z, this;
	}
	multiplyScalar(e) {
		return this.x *= e, this.y *= e, this.z *= e, this;
	}
	multiplyVectors(e, t) {
		return this.x = e.x * t.x, this.y = e.y * t.y, this.z = e.z * t.z, this;
	}
	applyEuler(e) {
		return this.applyQuaternion(Wr.setFromEuler(e));
	}
	applyAxisAngle(e, t) {
		return this.applyQuaternion(Wr.setFromAxisAngle(e, t));
	}
	applyMatrix3(e) {
		let t = this.x, n = this.y, r = this.z, i = e.elements;
		return this.x = i[0] * t + i[3] * n + i[6] * r, this.y = i[1] * t + i[4] * n + i[7] * r, this.z = i[2] * t + i[5] * n + i[8] * r, this;
	}
	applyNormalMatrix(e) {
		return this.applyMatrix3(e).normalize();
	}
	applyMatrix4(e) {
		let t = this.x, n = this.y, r = this.z, i = e.elements, a = 1 / (i[3] * t + i[7] * n + i[11] * r + i[15]);
		return this.x = (i[0] * t + i[4] * n + i[8] * r + i[12]) * a, this.y = (i[1] * t + i[5] * n + i[9] * r + i[13]) * a, this.z = (i[2] * t + i[6] * n + i[10] * r + i[14]) * a, this;
	}
	applyQuaternion(e) {
		let t = this.x, n = this.y, r = this.z, i = e.x, a = e.y, o = e.z, s = e.w, c = 2 * (a * r - o * n), l = 2 * (o * t - i * r), u = 2 * (i * n - a * t);
		return this.x = t + s * c + a * u - o * l, this.y = n + s * l + o * c - i * u, this.z = r + s * u + i * l - a * c, this;
	}
	project(e) {
		return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix);
	}
	unproject(e) {
		return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld);
	}
	transformDirection(e) {
		let t = this.x, n = this.y, r = this.z, i = e.elements;
		return this.x = i[0] * t + i[4] * n + i[8] * r, this.y = i[1] * t + i[5] * n + i[9] * r, this.z = i[2] * t + i[6] * n + i[10] * r, this.normalize();
	}
	divide(e) {
		return this.x /= e.x, this.y /= e.y, this.z /= e.z, this;
	}
	divideScalar(e) {
		return this.multiplyScalar(1 / e);
	}
	min(e) {
		return this.x = Math.min(this.x, e.x), this.y = Math.min(this.y, e.y), this.z = Math.min(this.z, e.z), this;
	}
	max(e) {
		return this.x = Math.max(this.x, e.x), this.y = Math.max(this.y, e.y), this.z = Math.max(this.z, e.z), this;
	}
	clamp(e, t) {
		return this.x = B(this.x, e.x, t.x), this.y = B(this.y, e.y, t.y), this.z = B(this.z, e.z, t.z), this;
	}
	clampScalar(e, t) {
		return this.x = B(this.x, e, t), this.y = B(this.y, e, t), this.z = B(this.z, e, t), this;
	}
	clampLength(e, t) {
		let n = this.length();
		return this.divideScalar(n || 1).multiplyScalar(B(n, e, t));
	}
	floor() {
		return this.x = Math.floor(this.x), this.y = Math.floor(this.y), this.z = Math.floor(this.z), this;
	}
	ceil() {
		return this.x = Math.ceil(this.x), this.y = Math.ceil(this.y), this.z = Math.ceil(this.z), this;
	}
	round() {
		return this.x = Math.round(this.x), this.y = Math.round(this.y), this.z = Math.round(this.z), this;
	}
	roundToZero() {
		return this.x = Math.trunc(this.x), this.y = Math.trunc(this.y), this.z = Math.trunc(this.z), this;
	}
	negate() {
		return this.x = -this.x, this.y = -this.y, this.z = -this.z, this;
	}
	dot(e) {
		return this.x * e.x + this.y * e.y + this.z * e.z;
	}
	lengthSq() {
		return this.x * this.x + this.y * this.y + this.z * this.z;
	}
	length() {
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	}
	manhattanLength() {
		return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z);
	}
	normalize() {
		return this.divideScalar(this.length() || 1);
	}
	setLength(e) {
		return this.normalize().multiplyScalar(e);
	}
	lerp(e, t) {
		return this.x += (e.x - this.x) * t, this.y += (e.y - this.y) * t, this.z += (e.z - this.z) * t, this;
	}
	lerpVectors(e, t, n) {
		return this.x = e.x + (t.x - e.x) * n, this.y = e.y + (t.y - e.y) * n, this.z = e.z + (t.z - e.z) * n, this;
	}
	cross(e) {
		return this.crossVectors(this, e);
	}
	crossVectors(e, t) {
		let n = e.x, r = e.y, i = e.z, a = t.x, o = t.y, s = t.z;
		return this.x = r * s - i * o, this.y = i * a - n * s, this.z = n * o - r * a, this;
	}
	projectOnVector(e) {
		let t = e.lengthSq();
		if (t === 0) return this.set(0, 0, 0);
		let n = e.dot(this) / t;
		return this.copy(e).multiplyScalar(n);
	}
	projectOnPlane(e) {
		return Ur.copy(this).projectOnVector(e), this.sub(Ur);
	}
	reflect(e) {
		return this.sub(Ur.copy(e).multiplyScalar(2 * this.dot(e)));
	}
	angleTo(e) {
		let t = Math.sqrt(this.lengthSq() * e.lengthSq());
		if (t === 0) return Math.PI / 2;
		let n = this.dot(e) / t;
		return Math.acos(B(n, -1, 1));
	}
	distanceTo(e) {
		return Math.sqrt(this.distanceToSquared(e));
	}
	distanceToSquared(e) {
		let t = this.x - e.x, n = this.y - e.y, r = this.z - e.z;
		return t * t + n * n + r * r;
	}
	manhattanDistanceTo(e) {
		return Math.abs(this.x - e.x) + Math.abs(this.y - e.y) + Math.abs(this.z - e.z);
	}
	setFromSpherical(e) {
		return this.setFromSphericalCoords(e.radius, e.phi, e.theta);
	}
	setFromSphericalCoords(e, t, n) {
		let r = Math.sin(t) * e;
		return this.x = r * Math.sin(n), this.y = Math.cos(t) * e, this.z = r * Math.cos(n), this;
	}
	setFromCylindrical(e) {
		return this.setFromCylindricalCoords(e.radius, e.theta, e.y);
	}
	setFromCylindricalCoords(e, t, n) {
		return this.x = e * Math.sin(t), this.y = n, this.z = e * Math.cos(t), this;
	}
	setFromMatrixPosition(e) {
		let t = e.elements;
		return this.x = t[12], this.y = t[13], this.z = t[14], this;
	}
	setFromMatrixScale(e) {
		let t = this.setFromMatrixColumn(e, 0).length(), n = this.setFromMatrixColumn(e, 1).length(), r = this.setFromMatrixColumn(e, 2).length();
		return this.x = t, this.y = n, this.z = r, this;
	}
	setFromMatrixColumn(e, t) {
		return this.fromArray(e.elements, t * 4);
	}
	setFromMatrix3Column(e, t) {
		return this.fromArray(e.elements, t * 3);
	}
	setFromEuler(e) {
		return this.x = e._x, this.y = e._y, this.z = e._z, this;
	}
	setFromColor(e) {
		return this.x = e.r, this.y = e.g, this.z = e.b, this;
	}
	equals(e) {
		return e.x === this.x && e.y === this.y && e.z === this.z;
	}
	fromArray(e, t = 0) {
		return this.x = e[t], this.y = e[t + 1], this.z = e[t + 2], this;
	}
	toArray(e = [], t = 0) {
		return e[t] = this.x, e[t + 1] = this.y, e[t + 2] = this.z, e;
	}
	fromBufferAttribute(e, t) {
		return this.x = e.getX(t), this.y = e.getY(t), this.z = e.getZ(t), this;
	}
	random() {
		return this.x = Math.random(), this.y = Math.random(), this.z = Math.random(), this;
	}
	randomDirection() {
		let e = Math.random() * Math.PI * 2, t = Math.random() * 2 - 1, n = Math.sqrt(1 - t * t);
		return this.x = n * Math.cos(e), this.y = t, this.z = n * Math.sin(e), this;
	}
	*[Symbol.iterator]() {
		yield this.x, yield this.y, yield this.z;
	}
}, Ur = /*@__PURE__*/ new U(), Wr = /*@__PURE__*/ new Hr(), W = class e {
	static {
		e.prototype.isMatrix3 = !0;
	}
	constructor(e, t, n, r, i, a, o, s, c) {
		this.elements = [
			1,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			1
		], e !== void 0 && this.set(e, t, n, r, i, a, o, s, c);
	}
	set(e, t, n, r, i, a, o, s, c) {
		let l = this.elements;
		return l[0] = e, l[1] = r, l[2] = o, l[3] = t, l[4] = i, l[5] = s, l[6] = n, l[7] = a, l[8] = c, this;
	}
	identity() {
		return this.set(1, 0, 0, 0, 1, 0, 0, 0, 1), this;
	}
	copy(e) {
		let t = this.elements, n = e.elements;
		return t[0] = n[0], t[1] = n[1], t[2] = n[2], t[3] = n[3], t[4] = n[4], t[5] = n[5], t[6] = n[6], t[7] = n[7], t[8] = n[8], this;
	}
	extractBasis(e, t, n) {
		return e.setFromMatrix3Column(this, 0), t.setFromMatrix3Column(this, 1), n.setFromMatrix3Column(this, 2), this;
	}
	setFromMatrix4(e) {
		let t = e.elements;
		return this.set(t[0], t[4], t[8], t[1], t[5], t[9], t[2], t[6], t[10]), this;
	}
	multiply(e) {
		return this.multiplyMatrices(this, e);
	}
	premultiply(e) {
		return this.multiplyMatrices(e, this);
	}
	multiplyMatrices(e, t) {
		let n = e.elements, r = t.elements, i = this.elements, a = n[0], o = n[3], s = n[6], c = n[1], l = n[4], u = n[7], d = n[2], f = n[5], p = n[8], m = r[0], h = r[3], g = r[6], _ = r[1], v = r[4], y = r[7], b = r[2], x = r[5], S = r[8];
		return i[0] = a * m + o * _ + s * b, i[3] = a * h + o * v + s * x, i[6] = a * g + o * y + s * S, i[1] = c * m + l * _ + u * b, i[4] = c * h + l * v + u * x, i[7] = c * g + l * y + u * S, i[2] = d * m + f * _ + p * b, i[5] = d * h + f * v + p * x, i[8] = d * g + f * y + p * S, this;
	}
	multiplyScalar(e) {
		let t = this.elements;
		return t[0] *= e, t[3] *= e, t[6] *= e, t[1] *= e, t[4] *= e, t[7] *= e, t[2] *= e, t[5] *= e, t[8] *= e, this;
	}
	determinant() {
		let e = this.elements, t = e[0], n = e[1], r = e[2], i = e[3], a = e[4], o = e[5], s = e[6], c = e[7], l = e[8];
		return t * a * l - t * o * c - n * i * l + n * o * s + r * i * c - r * a * s;
	}
	invert() {
		let e = this.elements, t = e[0], n = e[1], r = e[2], i = e[3], a = e[4], o = e[5], s = e[6], c = e[7], l = e[8], u = l * a - o * c, d = o * s - l * i, f = c * i - a * s, p = t * u + n * d + r * f;
		if (p === 0) return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0);
		let m = 1 / p;
		return e[0] = u * m, e[1] = (r * c - l * n) * m, e[2] = (o * n - r * a) * m, e[3] = d * m, e[4] = (l * t - r * s) * m, e[5] = (r * i - o * t) * m, e[6] = f * m, e[7] = (n * s - c * t) * m, e[8] = (a * t - n * i) * m, this;
	}
	transpose() {
		let e, t = this.elements;
		return e = t[1], t[1] = t[3], t[3] = e, e = t[2], t[2] = t[6], t[6] = e, e = t[5], t[5] = t[7], t[7] = e, this;
	}
	getNormalMatrix(e) {
		return this.setFromMatrix4(e).invert().transpose();
	}
	transposeIntoArray(e) {
		let t = this.elements;
		return e[0] = t[0], e[1] = t[3], e[2] = t[6], e[3] = t[1], e[4] = t[4], e[5] = t[7], e[6] = t[2], e[7] = t[5], e[8] = t[8], this;
	}
	setUvTransform(e, t, n, r, i, a, o) {
		let s = Math.cos(i), c = Math.sin(i);
		return this.set(n * s, n * c, -n * (s * a + c * o) + a + e, -r * c, r * s, -r * (-c * a + s * o) + o + t, 0, 0, 1), this;
	}
	scale(e, t) {
		return pr("Matrix3: .scale() is deprecated. Use .makeScale() instead."), this.premultiply(Gr.makeScale(e, t)), this;
	}
	rotate(e) {
		return pr("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."), this.premultiply(Gr.makeRotation(-e)), this;
	}
	translate(e, t) {
		return pr("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."), this.premultiply(Gr.makeTranslation(e, t)), this;
	}
	makeTranslation(e, t) {
		return e.isVector2 ? this.set(1, 0, e.x, 0, 1, e.y, 0, 0, 1) : this.set(1, 0, e, 0, 1, t, 0, 0, 1), this;
	}
	makeRotation(e) {
		let t = Math.cos(e), n = Math.sin(e);
		return this.set(t, -n, 0, n, t, 0, 0, 0, 1), this;
	}
	makeScale(e, t) {
		return this.set(e, 0, 0, 0, t, 0, 0, 0, 1), this;
	}
	equals(e) {
		let t = this.elements, n = e.elements;
		for (let e = 0; e < 9; e++) if (t[e] !== n[e]) return !1;
		return !0;
	}
	fromArray(e, t = 0) {
		for (let n = 0; n < 9; n++) this.elements[n] = e[n + t];
		return this;
	}
	toArray(e = [], t = 0) {
		let n = this.elements;
		return e[t] = n[0], e[t + 1] = n[1], e[t + 2] = n[2], e[t + 3] = n[3], e[t + 4] = n[4], e[t + 5] = n[5], e[t + 6] = n[6], e[t + 7] = n[7], e[t + 8] = n[8], e;
	}
	clone() {
		return new this.constructor().fromArray(this.elements);
	}
}, Gr = /*@__PURE__*/ new W(), Kr = /*@__PURE__*/ new W().set(.4123908, .3575843, .1804808, .212639, .7151687, .0721923, .0193308, .1191948, .9505322), qr = /*@__PURE__*/ new W().set(3.2409699, -1.5373832, -.4986108, -.9692436, 1.8759675, .0415551, .0556301, -.203977, 1.0569715);
function Jr() {
	let e = {
		enabled: !0,
		workingColorSpace: kn,
		spaces: {},
		convert: function(e, t, n) {
			return this.enabled === !1 || t === n || !t || !n ? e : (this.spaces[t].transfer === "srgb" && (e.r = Yr(e.r), e.g = Yr(e.g), e.b = Yr(e.b)), this.spaces[t].primaries !== this.spaces[n].primaries && (e.applyMatrix3(this.spaces[t].toXYZ), e.applyMatrix3(this.spaces[n].fromXYZ)), this.spaces[n].transfer === "srgb" && (e.r = Xr(e.r), e.g = Xr(e.g), e.b = Xr(e.b)), e);
		},
		workingToColorSpace: function(e, t) {
			return this.convert(e, this.workingColorSpace, t);
		},
		colorSpaceToWorking: function(e, t) {
			return this.convert(e, t, this.workingColorSpace);
		},
		getPrimaries: function(e) {
			return this.spaces[e].primaries;
		},
		getTransfer: function(e) {
			return e === "" ? An : this.spaces[e].transfer;
		},
		getToneMappingMode: function(e) {
			return this.spaces[e].outputColorSpaceConfig.toneMappingMode || "standard";
		},
		getLuminanceCoefficients: function(e, t = this.workingColorSpace) {
			return e.fromArray(this.spaces[t].luminanceCoefficients);
		},
		define: function(e) {
			Object.assign(this.spaces, e);
		},
		_getMatrix: function(e, t, n) {
			return e.copy(this.spaces[t].toXYZ).multiply(this.spaces[n].fromXYZ);
		},
		_getDrawingBufferColorSpace: function(e) {
			return this.spaces[e].outputColorSpaceConfig.drawingBufferColorSpace;
		},
		_getUnpackColorSpace: function(e = this.workingColorSpace) {
			return this.spaces[e].workingColorSpaceConfig.unpackColorSpace;
		},
		fromWorkingColorSpace: function(t, n) {
			return pr("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."), e.workingToColorSpace(t, n);
		},
		toWorkingColorSpace: function(t, n) {
			return pr("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."), e.colorSpaceToWorking(t, n);
		}
	}, t = [
		.64,
		.33,
		.3,
		.6,
		.15,
		.06
	], n = [
		.2126,
		.7152,
		.0722
	], r = [.3127, .329];
	return e.define({
		[kn]: {
			primaries: t,
			whitePoint: r,
			transfer: An,
			toXYZ: Kr,
			fromXYZ: qr,
			luminanceCoefficients: n,
			workingColorSpaceConfig: { unpackColorSpace: On },
			outputColorSpaceConfig: { drawingBufferColorSpace: On }
		},
		[On]: {
			primaries: t,
			whitePoint: r,
			transfer: jn,
			toXYZ: Kr,
			fromXYZ: qr,
			luminanceCoefficients: n,
			outputColorSpaceConfig: { drawingBufferColorSpace: On }
		}
	}), e;
}
var G = /*@__PURE__*/ Jr();
function Yr(e) {
	return e < .04045 ? e * .0773993808 : (e * .9478672986 + .0521327014) ** 2.4;
}
function Xr(e) {
	return e < .0031308 ? e * 12.92 : 1.055 * e ** .41666 - .055;
}
var Zr, Qr = class {
	static getDataURL(e, t = "image/png") {
		if (/^data:/i.test(e.src) || typeof HTMLCanvasElement > "u") return e.src;
		let n;
		if (e instanceof HTMLCanvasElement) n = e;
		else {
			Zr === void 0 && (Zr = ar("canvas")), Zr.width = e.width, Zr.height = e.height;
			let t = Zr.getContext("2d");
			e instanceof ImageData ? t.putImageData(e, 0, 0) : t.drawImage(e, 0, 0, e.width, e.height), n = Zr;
		}
		return n.toDataURL(t);
	}
	static sRGBToLinear(e) {
		if (typeof HTMLImageElement < "u" && e instanceof HTMLImageElement || typeof HTMLCanvasElement < "u" && e instanceof HTMLCanvasElement || typeof ImageBitmap < "u" && e instanceof ImageBitmap) {
			let t = ar("canvas");
			t.width = e.width, t.height = e.height;
			let n = t.getContext("2d");
			n.drawImage(e, 0, 0, e.width, e.height);
			let r = n.getImageData(0, 0, e.width, e.height), i = r.data;
			for (let e = 0; e < i.length; e++) i[e] = Yr(i[e] / 255) * 255;
			return n.putImageData(r, 0, 0), t;
		} else if (e.data) {
			let t = e.data.slice(0);
			for (let e = 0; e < t.length; e++) t instanceof Uint8Array || t instanceof Uint8ClampedArray ? t[e] = Math.floor(Yr(t[e] / 255) * 255) : t[e] = Yr(t[e]);
			return {
				data: t,
				width: e.width,
				height: e.height
			};
		} else return R("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."), e;
	}
}, $r = 0, ei = class {
	constructor(e = null) {
		this.isSource = !0, Object.defineProperty(this, "id", { value: $r++ }), this.uuid = xr(), this.data = e, this.dataReady = !0, this.version = 0;
	}
	getSize(e) {
		let t = this.data;
		return typeof HTMLVideoElement < "u" && t instanceof HTMLVideoElement ? e.set(t.videoWidth, t.videoHeight, 0) : typeof VideoFrame < "u" && t instanceof VideoFrame ? e.set(t.displayWidth, t.displayHeight, 0) : t === null ? e.set(0, 0, 0) : e.set(t.width, t.height, t.depth || 0), e;
	}
	set needsUpdate(e) {
		e === !0 && this.version++;
	}
	toJSON(e) {
		let t = e === void 0 || typeof e == "string";
		if (!t && e.images[this.uuid] !== void 0) return e.images[this.uuid];
		let n = {
			uuid: this.uuid,
			url: ""
		}, r = this.data;
		if (r !== null) {
			let e;
			if (Array.isArray(r)) {
				e = [];
				for (let t = 0, n = r.length; t < n; t++) r[t].isDataTexture ? e.push(ti(r[t].image)) : e.push(ti(r[t]));
			} else e = ti(r);
			n.url = e;
		}
		return t || (e.images[this.uuid] = n), n;
	}
};
function ti(e) {
	return typeof HTMLImageElement < "u" && e instanceof HTMLImageElement || typeof HTMLCanvasElement < "u" && e instanceof HTMLCanvasElement || typeof ImageBitmap < "u" && e instanceof ImageBitmap ? Qr.getDataURL(e) : e.data ? {
		data: Array.from(e.data),
		width: e.width,
		height: e.height,
		type: e.data.constructor.name
	} : (R("Texture: Unable to serialize Texture."), {});
}
var ni = 0, ri = /*@__PURE__*/ new U(), ii = class e extends gr {
	constructor(t = e.DEFAULT_IMAGE, n = e.DEFAULT_MAPPING, r = qe, i = qe, a = et, o = rt, s = bt, c = at, l = e.DEFAULT_ANISOTROPY, u = "") {
		super(), this.isTexture = !0, Object.defineProperty(this, "id", { value: ni++ }), this.uuid = xr(), this.name = "", this.source = new ei(t), this.mipmaps = [], this.mapping = n, this.channel = 0, this.wrapS = r, this.wrapT = i, this.magFilter = a, this.minFilter = o, this.anisotropy = l, this.format = s, this.internalFormat = null, this.type = c, this.offset = new H(0, 0), this.repeat = new H(1, 1), this.center = new H(0, 0), this.rotation = 0, this.matrixAutoUpdate = !0, this.matrix = new W(), this.generateMipmaps = !0, this.premultiplyAlpha = !1, this.flipY = !0, this.unpackAlignment = 4, this.colorSpace = u, this.userData = {}, this.updateRanges = [], this.version = 0, this.onUpdate = null, this.renderTarget = null, this.isRenderTargetTexture = !1, this.isArrayTexture = !!(t && t.depth && t.depth > 1), this.pmremVersion = 0, this.normalized = !1;
	}
	get width() {
		return this.source.getSize(ri).x;
	}
	get height() {
		return this.source.getSize(ri).y;
	}
	get depth() {
		return this.source.getSize(ri).z;
	}
	get image() {
		return this.source.data;
	}
	set image(e) {
		this.source.data = e;
	}
	updateMatrix() {
		this.matrix.setUvTransform(this.offset.x, this.offset.y, this.repeat.x, this.repeat.y, this.rotation, this.center.x, this.center.y);
	}
	addUpdateRange(e, t) {
		this.updateRanges.push({
			start: e,
			count: t
		});
	}
	clearUpdateRanges() {
		this.updateRanges.length = 0;
	}
	clone() {
		return new this.constructor().copy(this);
	}
	copy(e) {
		return this.name = e.name, this.source = e.source, this.mipmaps = e.mipmaps.slice(0), this.mapping = e.mapping, this.channel = e.channel, this.wrapS = e.wrapS, this.wrapT = e.wrapT, this.magFilter = e.magFilter, this.minFilter = e.minFilter, this.anisotropy = e.anisotropy, this.format = e.format, this.internalFormat = e.internalFormat, this.type = e.type, this.normalized = e.normalized, this.offset.copy(e.offset), this.repeat.copy(e.repeat), this.center.copy(e.center), this.rotation = e.rotation, this.matrixAutoUpdate = e.matrixAutoUpdate, this.matrix.copy(e.matrix), this.generateMipmaps = e.generateMipmaps, this.premultiplyAlpha = e.premultiplyAlpha, this.flipY = e.flipY, this.unpackAlignment = e.unpackAlignment, this.colorSpace = e.colorSpace, this.renderTarget = e.renderTarget, this.isRenderTargetTexture = e.isRenderTargetTexture, this.isArrayTexture = e.isArrayTexture, this.userData = JSON.parse(JSON.stringify(e.userData)), this.needsUpdate = !0, this;
	}
	setValues(e) {
		for (let t in e) {
			let n = e[t];
			if (n === void 0) {
				R(`Texture.setValues(): parameter '${t}' has value of undefined.`);
				continue;
			}
			let r = this[t];
			if (r === void 0) {
				R(`Texture.setValues(): property '${t}' does not exist.`);
				continue;
			}
			r && n && r.isVector2 && n.isVector2 || r && n && r.isVector3 && n.isVector3 || r && n && r.isMatrix3 && n.isMatrix3 ? r.copy(n) : this[t] = n;
		}
	}
	toJSON(e) {
		let t = e === void 0 || typeof e == "string";
		if (!t && e.textures[this.uuid] !== void 0) return e.textures[this.uuid];
		let n = {
			metadata: {
				version: 4.7,
				type: "Texture",
				generator: "Texture.toJSON"
			},
			uuid: this.uuid,
			name: this.name,
			image: this.source.toJSON(e).uuid,
			mapping: this.mapping,
			channel: this.channel,
			repeat: [this.repeat.x, this.repeat.y],
			offset: [this.offset.x, this.offset.y],
			center: [this.center.x, this.center.y],
			rotation: this.rotation,
			wrap: [this.wrapS, this.wrapT],
			format: this.format,
			internalFormat: this.internalFormat,
			type: this.type,
			normalized: this.normalized,
			colorSpace: this.colorSpace,
			minFilter: this.minFilter,
			magFilter: this.magFilter,
			anisotropy: this.anisotropy,
			flipY: this.flipY,
			generateMipmaps: this.generateMipmaps,
			premultiplyAlpha: this.premultiplyAlpha,
			unpackAlignment: this.unpackAlignment
		};
		return Object.keys(this.userData).length > 0 && (n.userData = this.userData), t || (e.textures[this.uuid] = n), n;
	}
	dispose() {
		this.dispatchEvent({ type: "dispose" });
	}
	transformUv(e) {
		if (this.mapping !== 300) return e;
		if (e.applyMatrix3(this.matrix), e.x < 0 || e.x > 1) switch (this.wrapS) {
			case Ke:
				e.x -= Math.floor(e.x);
				break;
			case qe:
				e.x = e.x < 0 ? 0 : 1;
				break;
			case Je:
				Math.abs(Math.floor(e.x) % 2) === 1 ? e.x = Math.ceil(e.x) - e.x : e.x -= Math.floor(e.x);
				break;
		}
		if (e.y < 0 || e.y > 1) switch (this.wrapT) {
			case Ke:
				e.y -= Math.floor(e.y);
				break;
			case qe:
				e.y = e.y < 0 ? 0 : 1;
				break;
			case Je:
				Math.abs(Math.floor(e.y) % 2) === 1 ? e.y = Math.ceil(e.y) - e.y : e.y -= Math.floor(e.y);
				break;
		}
		return this.flipY && (e.y = 1 - e.y), e;
	}
	set needsUpdate(e) {
		e === !0 && (this.version++, this.source.needsUpdate = !0);
	}
	set needsPMREMUpdate(e) {
		e === !0 && this.pmremVersion++;
	}
};
ii.DEFAULT_IMAGE = null, ii.DEFAULT_MAPPING = 300, ii.DEFAULT_ANISOTROPY = 1;
var ai = class e {
	static {
		e.prototype.isVector4 = !0;
	}
	constructor(e = 0, t = 0, n = 0, r = 1) {
		this.x = e, this.y = t, this.z = n, this.w = r;
	}
	get width() {
		return this.z;
	}
	set width(e) {
		this.z = e;
	}
	get height() {
		return this.w;
	}
	set height(e) {
		this.w = e;
	}
	set(e, t, n, r) {
		return this.x = e, this.y = t, this.z = n, this.w = r, this;
	}
	setScalar(e) {
		return this.x = e, this.y = e, this.z = e, this.w = e, this;
	}
	setX(e) {
		return this.x = e, this;
	}
	setY(e) {
		return this.y = e, this;
	}
	setZ(e) {
		return this.z = e, this;
	}
	setW(e) {
		return this.w = e, this;
	}
	setComponent(e, t) {
		switch (e) {
			case 0:
				this.x = t;
				break;
			case 1:
				this.y = t;
				break;
			case 2:
				this.z = t;
				break;
			case 3:
				this.w = t;
				break;
			default: throw Error("THREE.Vector4: index is out of range: " + e);
		}
		return this;
	}
	getComponent(e) {
		switch (e) {
			case 0: return this.x;
			case 1: return this.y;
			case 2: return this.z;
			case 3: return this.w;
			default: throw Error("THREE.Vector4: index is out of range: " + e);
		}
	}
	clone() {
		return new this.constructor(this.x, this.y, this.z, this.w);
	}
	copy(e) {
		return this.x = e.x, this.y = e.y, this.z = e.z, this.w = e.w === void 0 ? 1 : e.w, this;
	}
	add(e) {
		return this.x += e.x, this.y += e.y, this.z += e.z, this.w += e.w, this;
	}
	addScalar(e) {
		return this.x += e, this.y += e, this.z += e, this.w += e, this;
	}
	addVectors(e, t) {
		return this.x = e.x + t.x, this.y = e.y + t.y, this.z = e.z + t.z, this.w = e.w + t.w, this;
	}
	addScaledVector(e, t) {
		return this.x += e.x * t, this.y += e.y * t, this.z += e.z * t, this.w += e.w * t, this;
	}
	sub(e) {
		return this.x -= e.x, this.y -= e.y, this.z -= e.z, this.w -= e.w, this;
	}
	subScalar(e) {
		return this.x -= e, this.y -= e, this.z -= e, this.w -= e, this;
	}
	subVectors(e, t) {
		return this.x = e.x - t.x, this.y = e.y - t.y, this.z = e.z - t.z, this.w = e.w - t.w, this;
	}
	multiply(e) {
		return this.x *= e.x, this.y *= e.y, this.z *= e.z, this.w *= e.w, this;
	}
	multiplyScalar(e) {
		return this.x *= e, this.y *= e, this.z *= e, this.w *= e, this;
	}
	applyMatrix4(e) {
		let t = this.x, n = this.y, r = this.z, i = this.w, a = e.elements;
		return this.x = a[0] * t + a[4] * n + a[8] * r + a[12] * i, this.y = a[1] * t + a[5] * n + a[9] * r + a[13] * i, this.z = a[2] * t + a[6] * n + a[10] * r + a[14] * i, this.w = a[3] * t + a[7] * n + a[11] * r + a[15] * i, this;
	}
	divide(e) {
		return this.x /= e.x, this.y /= e.y, this.z /= e.z, this.w /= e.w, this;
	}
	divideScalar(e) {
		return this.multiplyScalar(1 / e);
	}
	setAxisAngleFromQuaternion(e) {
		this.w = 2 * Math.acos(e.w);
		let t = Math.sqrt(1 - e.w * e.w);
		return t < 1e-4 ? (this.x = 1, this.y = 0, this.z = 0) : (this.x = e.x / t, this.y = e.y / t, this.z = e.z / t), this;
	}
	setAxisAngleFromRotationMatrix(e) {
		let t, n, r, i, a = .01, o = .1, s = e.elements, c = s[0], l = s[4], u = s[8], d = s[1], f = s[5], p = s[9], m = s[2], h = s[6], g = s[10];
		if (Math.abs(l - d) < a && Math.abs(u - m) < a && Math.abs(p - h) < a) {
			if (Math.abs(l + d) < o && Math.abs(u + m) < o && Math.abs(p + h) < o && Math.abs(c + f + g - 3) < o) return this.set(1, 0, 0, 0), this;
			t = Math.PI;
			let e = (c + 1) / 2, s = (f + 1) / 2, _ = (g + 1) / 2, v = (l + d) / 4, y = (u + m) / 4, b = (p + h) / 4;
			return e > s && e > _ ? e < a ? (n = 0, r = .707106781, i = .707106781) : (n = Math.sqrt(e), r = v / n, i = y / n) : s > _ ? s < a ? (n = .707106781, r = 0, i = .707106781) : (r = Math.sqrt(s), n = v / r, i = b / r) : _ < a ? (n = .707106781, r = .707106781, i = 0) : (i = Math.sqrt(_), n = y / i, r = b / i), this.set(n, r, i, t), this;
		}
		let _ = Math.sqrt((h - p) * (h - p) + (u - m) * (u - m) + (d - l) * (d - l));
		return Math.abs(_) < .001 && (_ = 1), this.x = (h - p) / _, this.y = (u - m) / _, this.z = (d - l) / _, this.w = Math.acos((c + f + g - 1) / 2), this;
	}
	setFromMatrixPosition(e) {
		let t = e.elements;
		return this.x = t[12], this.y = t[13], this.z = t[14], this.w = t[15], this;
	}
	min(e) {
		return this.x = Math.min(this.x, e.x), this.y = Math.min(this.y, e.y), this.z = Math.min(this.z, e.z), this.w = Math.min(this.w, e.w), this;
	}
	max(e) {
		return this.x = Math.max(this.x, e.x), this.y = Math.max(this.y, e.y), this.z = Math.max(this.z, e.z), this.w = Math.max(this.w, e.w), this;
	}
	clamp(e, t) {
		return this.x = B(this.x, e.x, t.x), this.y = B(this.y, e.y, t.y), this.z = B(this.z, e.z, t.z), this.w = B(this.w, e.w, t.w), this;
	}
	clampScalar(e, t) {
		return this.x = B(this.x, e, t), this.y = B(this.y, e, t), this.z = B(this.z, e, t), this.w = B(this.w, e, t), this;
	}
	clampLength(e, t) {
		let n = this.length();
		return this.divideScalar(n || 1).multiplyScalar(B(n, e, t));
	}
	floor() {
		return this.x = Math.floor(this.x), this.y = Math.floor(this.y), this.z = Math.floor(this.z), this.w = Math.floor(this.w), this;
	}
	ceil() {
		return this.x = Math.ceil(this.x), this.y = Math.ceil(this.y), this.z = Math.ceil(this.z), this.w = Math.ceil(this.w), this;
	}
	round() {
		return this.x = Math.round(this.x), this.y = Math.round(this.y), this.z = Math.round(this.z), this.w = Math.round(this.w), this;
	}
	roundToZero() {
		return this.x = Math.trunc(this.x), this.y = Math.trunc(this.y), this.z = Math.trunc(this.z), this.w = Math.trunc(this.w), this;
	}
	negate() {
		return this.x = -this.x, this.y = -this.y, this.z = -this.z, this.w = -this.w, this;
	}
	dot(e) {
		return this.x * e.x + this.y * e.y + this.z * e.z + this.w * e.w;
	}
	lengthSq() {
		return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
	}
	length() {
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
	}
	manhattanLength() {
		return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z) + Math.abs(this.w);
	}
	normalize() {
		return this.divideScalar(this.length() || 1);
	}
	setLength(e) {
		return this.normalize().multiplyScalar(e);
	}
	lerp(e, t) {
		return this.x += (e.x - this.x) * t, this.y += (e.y - this.y) * t, this.z += (e.z - this.z) * t, this.w += (e.w - this.w) * t, this;
	}
	lerpVectors(e, t, n) {
		return this.x = e.x + (t.x - e.x) * n, this.y = e.y + (t.y - e.y) * n, this.z = e.z + (t.z - e.z) * n, this.w = e.w + (t.w - e.w) * n, this;
	}
	equals(e) {
		return e.x === this.x && e.y === this.y && e.z === this.z && e.w === this.w;
	}
	fromArray(e, t = 0) {
		return this.x = e[t], this.y = e[t + 1], this.z = e[t + 2], this.w = e[t + 3], this;
	}
	toArray(e = [], t = 0) {
		return e[t] = this.x, e[t + 1] = this.y, e[t + 2] = this.z, e[t + 3] = this.w, e;
	}
	fromBufferAttribute(e, t) {
		return this.x = e.getX(t), this.y = e.getY(t), this.z = e.getZ(t), this.w = e.getW(t), this;
	}
	random() {
		return this.x = Math.random(), this.y = Math.random(), this.z = Math.random(), this.w = Math.random(), this;
	}
	*[Symbol.iterator]() {
		yield this.x, yield this.y, yield this.z, yield this.w;
	}
}, oi = class extends gr {
	constructor(e = 1, t = 1, n = {}) {
		super(), n = Object.assign({
			generateMipmaps: !1,
			internalFormat: null,
			minFilter: et,
			depthBuffer: !0,
			stencilBuffer: !1,
			resolveDepthBuffer: !0,
			resolveStencilBuffer: !0,
			depthTexture: null,
			samples: 0,
			count: 1,
			depth: 1,
			multiview: !1,
			useArrayDepthTexture: !1
		}, n), this.isRenderTarget = !0, this.width = e, this.height = t, this.depth = n.depth, this.scissor = new ai(0, 0, e, t), this.scissorTest = !1, this.viewport = new ai(0, 0, e, t), this.textures = [];
		let r = new ii({
			width: e,
			height: t,
			depth: n.depth
		}), i = n.count;
		for (let e = 0; e < i; e++) this.textures[e] = r.clone(), this.textures[e].isRenderTargetTexture = !0, this.textures[e].renderTarget = this;
		this._setTextureOptions(n), this.depthBuffer = n.depthBuffer, this.stencilBuffer = n.stencilBuffer, this.resolveDepthBuffer = n.resolveDepthBuffer, this.resolveStencilBuffer = n.resolveStencilBuffer, this._depthTexture = null, this.depthTexture = n.depthTexture, this.samples = n.samples, this.multiview = n.multiview, this.useArrayDepthTexture = n.useArrayDepthTexture;
	}
	_setTextureOptions(e = {}) {
		let t = {
			minFilter: et,
			generateMipmaps: !1,
			flipY: !1,
			internalFormat: null
		};
		e.mapping !== void 0 && (t.mapping = e.mapping), e.wrapS !== void 0 && (t.wrapS = e.wrapS), e.wrapT !== void 0 && (t.wrapT = e.wrapT), e.wrapR !== void 0 && (t.wrapR = e.wrapR), e.magFilter !== void 0 && (t.magFilter = e.magFilter), e.minFilter !== void 0 && (t.minFilter = e.minFilter), e.format !== void 0 && (t.format = e.format), e.type !== void 0 && (t.type = e.type), e.anisotropy !== void 0 && (t.anisotropy = e.anisotropy), e.colorSpace !== void 0 && (t.colorSpace = e.colorSpace), e.flipY !== void 0 && (t.flipY = e.flipY), e.generateMipmaps !== void 0 && (t.generateMipmaps = e.generateMipmaps), e.internalFormat !== void 0 && (t.internalFormat = e.internalFormat);
		for (let e = 0; e < this.textures.length; e++) this.textures[e].setValues(t);
	}
	get texture() {
		return this.textures[0];
	}
	set texture(e) {
		this.textures[0] = e;
	}
	set depthTexture(e) {
		this._depthTexture !== null && (this._depthTexture.renderTarget = null), e !== null && (e.renderTarget = this), this._depthTexture = e;
	}
	get depthTexture() {
		return this._depthTexture;
	}
	setSize(e, t, n = 1) {
		if (this.width !== e || this.height !== t || this.depth !== n) {
			this.width = e, this.height = t, this.depth = n;
			for (let r = 0, i = this.textures.length; r < i; r++) this.textures[r].image.width = e, this.textures[r].image.height = t, this.textures[r].image.depth = n, this.textures[r].isData3DTexture !== !0 && (this.textures[r].isArrayTexture = this.textures[r].image.depth > 1);
			this.dispose();
		}
		this.viewport.set(0, 0, e, t), this.scissor.set(0, 0, e, t);
	}
	clone() {
		return new this.constructor().copy(this);
	}
	copy(e) {
		this.width = e.width, this.height = e.height, this.depth = e.depth, this.scissor.copy(e.scissor), this.scissorTest = e.scissorTest, this.viewport.copy(e.viewport), this.textures.length = 0;
		for (let t = 0, n = e.textures.length; t < n; t++) {
			this.textures[t] = e.textures[t].clone(), this.textures[t].isRenderTargetTexture = !0, this.textures[t].renderTarget = this;
			let n = Object.assign({}, e.textures[t].image);
			this.textures[t].source = new ei(n);
		}
		return this.depthBuffer = e.depthBuffer, this.stencilBuffer = e.stencilBuffer, this.resolveDepthBuffer = e.resolveDepthBuffer, this.resolveStencilBuffer = e.resolveStencilBuffer, e.depthTexture !== null && (this.depthTexture = e.depthTexture.clone()), this.samples = e.samples, this.multiview = e.multiview, this.useArrayDepthTexture = e.useArrayDepthTexture, this;
	}
	dispose() {
		this.dispatchEvent({ type: "dispose" });
	}
}, si = class extends oi {
	constructor(e = 1, t = 1, n = {}) {
		super(e, t, n), this.isWebGLRenderTarget = !0;
	}
}, ci = class extends ii {
	constructor(e = null, t = 1, n = 1, r = 1) {
		super(null), this.isDataArrayTexture = !0, this.image = {
			data: e,
			width: t,
			height: n,
			depth: r
		}, this.magFilter = Ye, this.minFilter = Ye, this.wrapR = qe, this.generateMipmaps = !1, this.flipY = !1, this.unpackAlignment = 1, this.layerUpdates = /* @__PURE__ */ new Set();
	}
	addLayerUpdate(e) {
		this.layerUpdates.add(e);
	}
	clearLayerUpdates() {
		this.layerUpdates.clear();
	}
}, li = class extends si {
	constructor(e = 1, t = 1, n = 1, r = {}) {
		super(e, t, r), this.isWebGLArrayRenderTarget = !0, this.depth = n, this.texture = new ci(null, e, t, n), this._setTextureOptions(r), this.texture.isRenderTargetTexture = !0;
	}
}, ui = class extends ii {
	constructor(e = null, t = 1, n = 1, r = 1) {
		super(null), this.isData3DTexture = !0, this.image = {
			data: e,
			width: t,
			height: n,
			depth: r
		}, this.magFilter = Ye, this.minFilter = Ye, this.wrapR = qe, this.generateMipmaps = !1, this.flipY = !1, this.unpackAlignment = 1;
	}
}, di = class extends si {
	constructor(e = 1, t = 1, n = 1, r = {}) {
		super(e, t, r), this.isWebGL3DRenderTarget = !0, this.depth = n, this.texture = new ui(null, e, t, n), this._setTextureOptions(r), this.texture.isRenderTargetTexture = !0;
	}
}, K = class e {
	static {
		e.prototype.isMatrix4 = !0;
	}
	constructor(e, t, n, r, i, a, o, s, c, l, u, d, f, p, m, h) {
		this.elements = [
			1,
			0,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			0,
			1
		], e !== void 0 && this.set(e, t, n, r, i, a, o, s, c, l, u, d, f, p, m, h);
	}
	set(e, t, n, r, i, a, o, s, c, l, u, d, f, p, m, h) {
		let g = this.elements;
		return g[0] = e, g[4] = t, g[8] = n, g[12] = r, g[1] = i, g[5] = a, g[9] = o, g[13] = s, g[2] = c, g[6] = l, g[10] = u, g[14] = d, g[3] = f, g[7] = p, g[11] = m, g[15] = h, this;
	}
	identity() {
		return this.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1), this;
	}
	clone() {
		return new e().fromArray(this.elements);
	}
	copy(e) {
		let t = this.elements, n = e.elements;
		return t[0] = n[0], t[1] = n[1], t[2] = n[2], t[3] = n[3], t[4] = n[4], t[5] = n[5], t[6] = n[6], t[7] = n[7], t[8] = n[8], t[9] = n[9], t[10] = n[10], t[11] = n[11], t[12] = n[12], t[13] = n[13], t[14] = n[14], t[15] = n[15], this;
	}
	copyPosition(e) {
		let t = this.elements, n = e.elements;
		return t[12] = n[12], t[13] = n[13], t[14] = n[14], this;
	}
	setFromMatrix3(e) {
		let t = e.elements;
		return this.set(t[0], t[3], t[6], 0, t[1], t[4], t[7], 0, t[2], t[5], t[8], 0, 0, 0, 0, 1), this;
	}
	extractBasis(e, t, n) {
		return this.determinantAffine() === 0 ? (e.set(1, 0, 0), t.set(0, 1, 0), n.set(0, 0, 1), this) : (e.setFromMatrixColumn(this, 0), t.setFromMatrixColumn(this, 1), n.setFromMatrixColumn(this, 2), this);
	}
	makeBasis(e, t, n) {
		return this.set(e.x, t.x, n.x, 0, e.y, t.y, n.y, 0, e.z, t.z, n.z, 0, 0, 0, 0, 1), this;
	}
	extractRotation(e) {
		if (e.determinantAffine() === 0) return this.identity();
		let t = this.elements, n = e.elements, r = 1 / fi.setFromMatrixColumn(e, 0).length(), i = 1 / fi.setFromMatrixColumn(e, 1).length(), a = 1 / fi.setFromMatrixColumn(e, 2).length();
		return t[0] = n[0] * r, t[1] = n[1] * r, t[2] = n[2] * r, t[3] = 0, t[4] = n[4] * i, t[5] = n[5] * i, t[6] = n[6] * i, t[7] = 0, t[8] = n[8] * a, t[9] = n[9] * a, t[10] = n[10] * a, t[11] = 0, t[12] = 0, t[13] = 0, t[14] = 0, t[15] = 1, this;
	}
	makeRotationFromEuler(e) {
		let t = this.elements, n = e.x, r = e.y, i = e.z, a = Math.cos(n), o = Math.sin(n), s = Math.cos(r), c = Math.sin(r), l = Math.cos(i), u = Math.sin(i);
		if (e.order === "XYZ") {
			let e = a * l, n = a * u, r = o * l, i = o * u;
			t[0] = s * l, t[4] = -s * u, t[8] = c, t[1] = n + r * c, t[5] = e - i * c, t[9] = -o * s, t[2] = i - e * c, t[6] = r + n * c, t[10] = a * s;
		} else if (e.order === "YXZ") {
			let e = s * l, n = s * u, r = c * l, i = c * u;
			t[0] = e + i * o, t[4] = r * o - n, t[8] = a * c, t[1] = a * u, t[5] = a * l, t[9] = -o, t[2] = n * o - r, t[6] = i + e * o, t[10] = a * s;
		} else if (e.order === "ZXY") {
			let e = s * l, n = s * u, r = c * l, i = c * u;
			t[0] = e - i * o, t[4] = -a * u, t[8] = r + n * o, t[1] = n + r * o, t[5] = a * l, t[9] = i - e * o, t[2] = -a * c, t[6] = o, t[10] = a * s;
		} else if (e.order === "ZYX") {
			let e = a * l, n = a * u, r = o * l, i = o * u;
			t[0] = s * l, t[4] = r * c - n, t[8] = e * c + i, t[1] = s * u, t[5] = i * c + e, t[9] = n * c - r, t[2] = -c, t[6] = o * s, t[10] = a * s;
		} else if (e.order === "YZX") {
			let e = a * s, n = a * c, r = o * s, i = o * c;
			t[0] = s * l, t[4] = i - e * u, t[8] = r * u + n, t[1] = u, t[5] = a * l, t[9] = -o * l, t[2] = -c * l, t[6] = n * u + r, t[10] = e - i * u;
		} else if (e.order === "XZY") {
			let e = a * s, n = a * c, r = o * s, i = o * c;
			t[0] = s * l, t[4] = -u, t[8] = c * l, t[1] = e * u + i, t[5] = a * l, t[9] = n * u - r, t[2] = r * u - n, t[6] = o * l, t[10] = i * u + e;
		}
		return t[3] = 0, t[7] = 0, t[11] = 0, t[12] = 0, t[13] = 0, t[14] = 0, t[15] = 1, this;
	}
	makeRotationFromQuaternion(e) {
		return this.compose(mi, e, hi);
	}
	lookAt(e, t, n) {
		let r = this.elements;
		return vi.subVectors(e, t), vi.lengthSq() === 0 && (vi.z = 1), vi.normalize(), gi.crossVectors(n, vi), gi.lengthSq() === 0 && (Math.abs(n.z) === 1 ? vi.x += 1e-4 : vi.z += 1e-4, vi.normalize(), gi.crossVectors(n, vi)), gi.normalize(), _i.crossVectors(vi, gi), r[0] = gi.x, r[4] = _i.x, r[8] = vi.x, r[1] = gi.y, r[5] = _i.y, r[9] = vi.y, r[2] = gi.z, r[6] = _i.z, r[10] = vi.z, this;
	}
	multiply(e) {
		return this.multiplyMatrices(this, e);
	}
	premultiply(e) {
		return this.multiplyMatrices(e, this);
	}
	multiplyMatrices(e, t) {
		let n = e.elements, r = t.elements, i = this.elements, a = n[0], o = n[4], s = n[8], c = n[12], l = n[1], u = n[5], d = n[9], f = n[13], p = n[2], m = n[6], h = n[10], g = n[14], _ = n[3], v = n[7], y = n[11], b = n[15], x = r[0], S = r[4], C = r[8], w = r[12], T = r[1], E = r[5], D = r[9], O = r[13], k = r[2], A = r[6], ee = r[10], te = r[14], j = r[3], ne = r[7], re = r[11], M = r[15];
		return i[0] = a * x + o * T + s * k + c * j, i[4] = a * S + o * E + s * A + c * ne, i[8] = a * C + o * D + s * ee + c * re, i[12] = a * w + o * O + s * te + c * M, i[1] = l * x + u * T + d * k + f * j, i[5] = l * S + u * E + d * A + f * ne, i[9] = l * C + u * D + d * ee + f * re, i[13] = l * w + u * O + d * te + f * M, i[2] = p * x + m * T + h * k + g * j, i[6] = p * S + m * E + h * A + g * ne, i[10] = p * C + m * D + h * ee + g * re, i[14] = p * w + m * O + h * te + g * M, i[3] = _ * x + v * T + y * k + b * j, i[7] = _ * S + v * E + y * A + b * ne, i[11] = _ * C + v * D + y * ee + b * re, i[15] = _ * w + v * O + y * te + b * M, this;
	}
	multiplyScalar(e) {
		let t = this.elements;
		return t[0] *= e, t[4] *= e, t[8] *= e, t[12] *= e, t[1] *= e, t[5] *= e, t[9] *= e, t[13] *= e, t[2] *= e, t[6] *= e, t[10] *= e, t[14] *= e, t[3] *= e, t[7] *= e, t[11] *= e, t[15] *= e, this;
	}
	determinant() {
		let e = this.elements, t = e[0], n = e[4], r = e[8], i = e[12], a = e[1], o = e[5], s = e[9], c = e[13], l = e[2], u = e[6], d = e[10], f = e[14], p = e[3], m = e[7], h = e[11], g = e[15], _ = s * f - c * d, v = o * f - c * u, y = o * d - s * u, b = a * f - c * l, x = a * d - s * l, S = a * u - o * l;
		return t * (m * _ - h * v + g * y) - n * (p * _ - h * b + g * x) + r * (p * v - m * b + g * S) - i * (p * y - m * x + h * S);
	}
	determinantAffine() {
		let e = this.elements, t = e[0], n = e[4], r = e[8], i = e[1], a = e[5], o = e[9], s = e[2], c = e[6], l = e[10];
		return t * (a * l - o * c) - n * (i * l - o * s) + r * (i * c - a * s);
	}
	transpose() {
		let e = this.elements, t;
		return t = e[1], e[1] = e[4], e[4] = t, t = e[2], e[2] = e[8], e[8] = t, t = e[6], e[6] = e[9], e[9] = t, t = e[3], e[3] = e[12], e[12] = t, t = e[7], e[7] = e[13], e[13] = t, t = e[11], e[11] = e[14], e[14] = t, this;
	}
	setPosition(e, t, n) {
		let r = this.elements;
		return e.isVector3 ? (r[12] = e.x, r[13] = e.y, r[14] = e.z) : (r[12] = e, r[13] = t, r[14] = n), this;
	}
	invert() {
		let e = this.elements, t = e[0], n = e[1], r = e[2], i = e[3], a = e[4], o = e[5], s = e[6], c = e[7], l = e[8], u = e[9], d = e[10], f = e[11], p = e[12], m = e[13], h = e[14], g = e[15], _ = t * o - n * a, v = t * s - r * a, y = t * c - i * a, b = n * s - r * o, x = n * c - i * o, S = r * c - i * s, C = l * m - u * p, w = l * h - d * p, T = l * g - f * p, E = u * h - d * m, D = u * g - f * m, O = d * g - f * h, k = _ * O - v * D + y * E + b * T - x * w + S * C;
		if (k === 0) return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
		let A = 1 / k;
		return e[0] = (o * O - s * D + c * E) * A, e[1] = (r * D - n * O - i * E) * A, e[2] = (m * S - h * x + g * b) * A, e[3] = (d * x - u * S - f * b) * A, e[4] = (s * T - a * O - c * w) * A, e[5] = (t * O - r * T + i * w) * A, e[6] = (h * y - p * S - g * v) * A, e[7] = (l * S - d * y + f * v) * A, e[8] = (a * D - o * T + c * C) * A, e[9] = (n * T - t * D - i * C) * A, e[10] = (p * x - m * y + g * _) * A, e[11] = (u * y - l * x - f * _) * A, e[12] = (o * w - a * E - s * C) * A, e[13] = (t * E - n * w + r * C) * A, e[14] = (m * v - p * b - h * _) * A, e[15] = (l * b - u * v + d * _) * A, this;
	}
	scale(e) {
		let t = this.elements, n = e.x, r = e.y, i = e.z;
		return t[0] *= n, t[4] *= r, t[8] *= i, t[1] *= n, t[5] *= r, t[9] *= i, t[2] *= n, t[6] *= r, t[10] *= i, t[3] *= n, t[7] *= r, t[11] *= i, this;
	}
	getMaxScaleOnAxis() {
		let e = this.elements, t = e[0] * e[0] + e[1] * e[1] + e[2] * e[2], n = e[4] * e[4] + e[5] * e[5] + e[6] * e[6], r = e[8] * e[8] + e[9] * e[9] + e[10] * e[10];
		return Math.sqrt(Math.max(t, n, r));
	}
	makeTranslation(e, t, n) {
		return e.isVector3 ? this.set(1, 0, 0, e.x, 0, 1, 0, e.y, 0, 0, 1, e.z, 0, 0, 0, 1) : this.set(1, 0, 0, e, 0, 1, 0, t, 0, 0, 1, n, 0, 0, 0, 1), this;
	}
	makeRotationX(e) {
		let t = Math.cos(e), n = Math.sin(e);
		return this.set(1, 0, 0, 0, 0, t, -n, 0, 0, n, t, 0, 0, 0, 0, 1), this;
	}
	makeRotationY(e) {
		let t = Math.cos(e), n = Math.sin(e);
		return this.set(t, 0, n, 0, 0, 1, 0, 0, -n, 0, t, 0, 0, 0, 0, 1), this;
	}
	makeRotationZ(e) {
		let t = Math.cos(e), n = Math.sin(e);
		return this.set(t, -n, 0, 0, n, t, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1), this;
	}
	makeRotationAxis(e, t) {
		let n = Math.cos(t), r = Math.sin(t), i = 1 - n, a = e.x, o = e.y, s = e.z, c = i * a, l = i * o;
		return this.set(c * a + n, c * o - r * s, c * s + r * o, 0, c * o + r * s, l * o + n, l * s - r * a, 0, c * s - r * o, l * s + r * a, i * s * s + n, 0, 0, 0, 0, 1), this;
	}
	makeScale(e, t, n) {
		return this.set(e, 0, 0, 0, 0, t, 0, 0, 0, 0, n, 0, 0, 0, 0, 1), this;
	}
	makeShear(e, t, n, r, i, a) {
		return this.set(1, n, i, 0, e, 1, a, 0, t, r, 1, 0, 0, 0, 0, 1), this;
	}
	compose(e, t, n) {
		let r = this.elements, i = t._x, a = t._y, o = t._z, s = t._w, c = i + i, l = a + a, u = o + o, d = i * c, f = i * l, p = i * u, m = a * l, h = a * u, g = o * u, _ = s * c, v = s * l, y = s * u, b = n.x, x = n.y, S = n.z;
		return r[0] = (1 - (m + g)) * b, r[1] = (f + y) * b, r[2] = (p - v) * b, r[3] = 0, r[4] = (f - y) * x, r[5] = (1 - (d + g)) * x, r[6] = (h + _) * x, r[7] = 0, r[8] = (p + v) * S, r[9] = (h - _) * S, r[10] = (1 - (d + m)) * S, r[11] = 0, r[12] = e.x, r[13] = e.y, r[14] = e.z, r[15] = 1, this;
	}
	decompose(e, t, n) {
		let r = this.elements;
		e.x = r[12], e.y = r[13], e.z = r[14];
		let i = this.determinantAffine();
		if (i === 0) return n.set(1, 1, 1), t.identity(), this;
		let a = fi.set(r[0], r[1], r[2]).length(), o = fi.set(r[4], r[5], r[6]).length(), s = fi.set(r[8], r[9], r[10]).length();
		i < 0 && (a = -a), pi.copy(this);
		let c = 1 / a, l = 1 / o, u = 1 / s;
		return pi.elements[0] *= c, pi.elements[1] *= c, pi.elements[2] *= c, pi.elements[4] *= l, pi.elements[5] *= l, pi.elements[6] *= l, pi.elements[8] *= u, pi.elements[9] *= u, pi.elements[10] *= u, t.setFromRotationMatrix(pi), n.x = a, n.y = o, n.z = s, this;
	}
	makePerspective(e, t, n, r, i, a, o = Yn, s = !1) {
		let c = this.elements, l = 2 * i / (t - e), u = 2 * i / (n - r), d = (t + e) / (t - e), f = (n + r) / (n - r), p, m;
		if (s) p = i / (a - i), m = a * i / (a - i);
		else if (o === 2e3) p = -(a + i) / (a - i), m = -2 * a * i / (a - i);
		else if (o === 2001) p = -a / (a - i), m = -a * i / (a - i);
		else throw Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: " + o);
		return c[0] = l, c[4] = 0, c[8] = d, c[12] = 0, c[1] = 0, c[5] = u, c[9] = f, c[13] = 0, c[2] = 0, c[6] = 0, c[10] = p, c[14] = m, c[3] = 0, c[7] = 0, c[11] = -1, c[15] = 0, this;
	}
	makeOrthographic(e, t, n, r, i, a, o = Yn, s = !1) {
		let c = this.elements, l = 2 / (t - e), u = 2 / (n - r), d = -(t + e) / (t - e), f = -(n + r) / (n - r), p, m;
		if (s) p = 1 / (a - i), m = a / (a - i);
		else if (o === 2e3) p = -2 / (a - i), m = -(a + i) / (a - i);
		else if (o === 2001) p = -1 / (a - i), m = -i / (a - i);
		else throw Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: " + o);
		return c[0] = l, c[4] = 0, c[8] = 0, c[12] = d, c[1] = 0, c[5] = u, c[9] = 0, c[13] = f, c[2] = 0, c[6] = 0, c[10] = p, c[14] = m, c[3] = 0, c[7] = 0, c[11] = 0, c[15] = 1, this;
	}
	equals(e) {
		let t = this.elements, n = e.elements;
		for (let e = 0; e < 16; e++) if (t[e] !== n[e]) return !1;
		return !0;
	}
	fromArray(e, t = 0) {
		for (let n = 0; n < 16; n++) this.elements[n] = e[n + t];
		return this;
	}
	toArray(e = [], t = 0) {
		let n = this.elements;
		return e[t] = n[0], e[t + 1] = n[1], e[t + 2] = n[2], e[t + 3] = n[3], e[t + 4] = n[4], e[t + 5] = n[5], e[t + 6] = n[6], e[t + 7] = n[7], e[t + 8] = n[8], e[t + 9] = n[9], e[t + 10] = n[10], e[t + 11] = n[11], e[t + 12] = n[12], e[t + 13] = n[13], e[t + 14] = n[14], e[t + 15] = n[15], e;
	}
}, fi = /*@__PURE__*/ new U(), pi = /*@__PURE__*/ new K(), mi = /*@__PURE__*/ new U(0, 0, 0), hi = /*@__PURE__*/ new U(1, 1, 1), gi = /*@__PURE__*/ new U(), _i = /*@__PURE__*/ new U(), vi = /*@__PURE__*/ new U(), yi = /*@__PURE__*/ new K(), bi = /*@__PURE__*/ new Hr(), xi = class e {
	constructor(t = 0, n = 0, r = 0, i = e.DEFAULT_ORDER) {
		this.isEuler = !0, this._x = t, this._y = n, this._z = r, this._order = i;
	}
	get x() {
		return this._x;
	}
	set x(e) {
		this._x = e, this._onChangeCallback();
	}
	get y() {
		return this._y;
	}
	set y(e) {
		this._y = e, this._onChangeCallback();
	}
	get z() {
		return this._z;
	}
	set z(e) {
		this._z = e, this._onChangeCallback();
	}
	get order() {
		return this._order;
	}
	set order(e) {
		this._order = e, this._onChangeCallback();
	}
	set(e, t, n, r = this._order) {
		return this._x = e, this._y = t, this._z = n, this._order = r, this._onChangeCallback(), this;
	}
	clone() {
		return new this.constructor(this._x, this._y, this._z, this._order);
	}
	copy(e) {
		return this._x = e._x, this._y = e._y, this._z = e._z, this._order = e._order, this._onChangeCallback(), this;
	}
	setFromRotationMatrix(e, t = this._order, n = !0) {
		let r = e.elements, i = r[0], a = r[4], o = r[8], s = r[1], c = r[5], l = r[9], u = r[2], d = r[6], f = r[10];
		switch (t) {
			case "XYZ":
				this._y = Math.asin(B(o, -1, 1)), Math.abs(o) < .9999999 ? (this._x = Math.atan2(-l, f), this._z = Math.atan2(-a, i)) : (this._x = Math.atan2(d, c), this._z = 0);
				break;
			case "YXZ":
				this._x = Math.asin(-B(l, -1, 1)), Math.abs(l) < .9999999 ? (this._y = Math.atan2(o, f), this._z = Math.atan2(s, c)) : (this._y = Math.atan2(-u, i), this._z = 0);
				break;
			case "ZXY":
				this._x = Math.asin(B(d, -1, 1)), Math.abs(d) < .9999999 ? (this._y = Math.atan2(-u, f), this._z = Math.atan2(-a, c)) : (this._y = 0, this._z = Math.atan2(s, i));
				break;
			case "ZYX":
				this._y = Math.asin(-B(u, -1, 1)), Math.abs(u) < .9999999 ? (this._x = Math.atan2(d, f), this._z = Math.atan2(s, i)) : (this._x = 0, this._z = Math.atan2(-a, c));
				break;
			case "YZX":
				this._z = Math.asin(B(s, -1, 1)), Math.abs(s) < .9999999 ? (this._x = Math.atan2(-l, c), this._y = Math.atan2(-u, i)) : (this._x = 0, this._y = Math.atan2(o, f));
				break;
			case "XZY":
				this._z = Math.asin(-B(a, -1, 1)), Math.abs(a) < .9999999 ? (this._x = Math.atan2(d, c), this._y = Math.atan2(o, i)) : (this._x = Math.atan2(-l, f), this._y = 0);
				break;
			default: R("Euler: .setFromRotationMatrix() encountered an unknown order: " + t);
		}
		return this._order = t, n === !0 && this._onChangeCallback(), this;
	}
	setFromQuaternion(e, t, n) {
		return yi.makeRotationFromQuaternion(e), this.setFromRotationMatrix(yi, t, n);
	}
	setFromVector3(e, t = this._order) {
		return this.set(e.x, e.y, e.z, t);
	}
	reorder(e) {
		return bi.setFromEuler(this), this.setFromQuaternion(bi, e);
	}
	equals(e) {
		return e._x === this._x && e._y === this._y && e._z === this._z && e._order === this._order;
	}
	fromArray(e) {
		return this._x = e[0], this._y = e[1], this._z = e[2], e[3] !== void 0 && (this._order = e[3]), this._onChangeCallback(), this;
	}
	toArray(e = [], t = 0) {
		return e[t] = this._x, e[t + 1] = this._y, e[t + 2] = this._z, e[t + 3] = this._order, e;
	}
	_onChange(e) {
		return this._onChangeCallback = e, this;
	}
	_onChangeCallback() {}
	*[Symbol.iterator]() {
		yield this._x, yield this._y, yield this._z, yield this._order;
	}
};
xi.DEFAULT_ORDER = "XYZ";
var Si = class {
	constructor() {
		this.mask = 1;
	}
	set(e) {
		this.mask = (1 << e | 0) >>> 0;
	}
	enable(e) {
		this.mask |= 1 << e | 0;
	}
	enableAll() {
		this.mask = -1;
	}
	toggle(e) {
		this.mask ^= 1 << e | 0;
	}
	disable(e) {
		this.mask &= ~(1 << e | 0);
	}
	disableAll() {
		this.mask = 0;
	}
	test(e) {
		return (this.mask & e.mask) !== 0;
	}
	isEnabled(e) {
		return (this.mask & (1 << e | 0)) != 0;
	}
}, Ci = 0, wi = /*@__PURE__*/ new U(), Ti = /*@__PURE__*/ new Hr(), Ei = /*@__PURE__*/ new K(), Di = /*@__PURE__*/ new U(), Oi = /*@__PURE__*/ new U(), ki = /*@__PURE__*/ new U(), Ai = /*@__PURE__*/ new Hr(), ji = /*@__PURE__*/ new U(1, 0, 0), Mi = /*@__PURE__*/ new U(0, 1, 0), Ni = /*@__PURE__*/ new U(0, 0, 1), Pi = { type: "added" }, Fi = { type: "removed" }, Ii = {
	type: "childadded",
	child: null
}, Li = {
	type: "childremoved",
	child: null
}, q = class e extends gr {
	constructor() {
		super(), this.isObject3D = !0, Object.defineProperty(this, "id", { value: Ci++ }), this.uuid = xr(), this.name = "", this.type = "Object3D", this.parent = null, this.children = [], this.up = e.DEFAULT_UP.clone();
		let t = new U(), n = new xi(), r = new Hr(), i = new U(1, 1, 1);
		function a() {
			r.setFromEuler(n, !1);
		}
		function o() {
			n.setFromQuaternion(r, void 0, !1);
		}
		n._onChange(a), r._onChange(o), Object.defineProperties(this, {
			position: {
				configurable: !0,
				enumerable: !0,
				value: t
			},
			rotation: {
				configurable: !0,
				enumerable: !0,
				value: n
			},
			quaternion: {
				configurable: !0,
				enumerable: !0,
				value: r
			},
			scale: {
				configurable: !0,
				enumerable: !0,
				value: i
			},
			modelViewMatrix: { value: new K() },
			normalMatrix: { value: new W() }
		}), this.matrix = new K(), this.matrixWorld = new K(), this.matrixAutoUpdate = e.DEFAULT_MATRIX_AUTO_UPDATE, this.matrixWorldAutoUpdate = e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE, this.matrixWorldNeedsUpdate = !1, this.layers = new Si(), this.visible = !0, this.castShadow = !1, this.receiveShadow = !1, this.frustumCulled = !0, this.renderOrder = 0, this.animations = [], this.customDepthMaterial = void 0, this.customDistanceMaterial = void 0, this.static = !1, this.userData = {}, this.pivot = null;
	}
	onBeforeShadow() {}
	onAfterShadow() {}
	onBeforeRender() {}
	onAfterRender() {}
	applyMatrix4(e) {
		this.matrixAutoUpdate && this.updateMatrix(), this.matrix.premultiply(e), this.matrix.decompose(this.position, this.quaternion, this.scale);
	}
	applyQuaternion(e) {
		return this.quaternion.premultiply(e), this;
	}
	setRotationFromAxisAngle(e, t) {
		this.quaternion.setFromAxisAngle(e, t);
	}
	setRotationFromEuler(e) {
		this.quaternion.setFromEuler(e, !0);
	}
	setRotationFromMatrix(e) {
		this.quaternion.setFromRotationMatrix(e);
	}
	setRotationFromQuaternion(e) {
		this.quaternion.copy(e);
	}
	rotateOnAxis(e, t) {
		return Ti.setFromAxisAngle(e, t), this.quaternion.multiply(Ti), this;
	}
	rotateOnWorldAxis(e, t) {
		return Ti.setFromAxisAngle(e, t), this.quaternion.premultiply(Ti), this;
	}
	rotateX(e) {
		return this.rotateOnAxis(ji, e);
	}
	rotateY(e) {
		return this.rotateOnAxis(Mi, e);
	}
	rotateZ(e) {
		return this.rotateOnAxis(Ni, e);
	}
	translateOnAxis(e, t) {
		return wi.copy(e).applyQuaternion(this.quaternion), this.position.add(wi.multiplyScalar(t)), this;
	}
	translateX(e) {
		return this.translateOnAxis(ji, e);
	}
	translateY(e) {
		return this.translateOnAxis(Mi, e);
	}
	translateZ(e) {
		return this.translateOnAxis(Ni, e);
	}
	localToWorld(e) {
		return this.updateWorldMatrix(!0, !1), e.applyMatrix4(this.matrixWorld);
	}
	worldToLocal(e) {
		return this.updateWorldMatrix(!0, !1), e.applyMatrix4(Ei.copy(this.matrixWorld).invert());
	}
	lookAt(e, t, n) {
		e.isVector3 ? Di.copy(e) : Di.set(e, t, n);
		let r = this.parent;
		this.updateWorldMatrix(!0, !1), Oi.setFromMatrixPosition(this.matrixWorld), this.isCamera || this.isLight ? Ei.lookAt(Oi, Di, this.up) : Ei.lookAt(Di, Oi, this.up), this.quaternion.setFromRotationMatrix(Ei), r && (Ei.extractRotation(r.matrixWorld), Ti.setFromRotationMatrix(Ei), this.quaternion.premultiply(Ti.invert()));
	}
	add(e) {
		if (arguments.length > 1) {
			for (let e = 0; e < arguments.length; e++) this.add(arguments[e]);
			return this;
		}
		return e === this ? (z("Object3D.add: object can't be added as a child of itself.", e), this) : (e && e.isObject3D ? (e.removeFromParent(), e.parent = this, this.children.push(e), e.dispatchEvent(Pi), Ii.child = e, this.dispatchEvent(Ii), Ii.child = null) : z("Object3D.add: object not an instance of THREE.Object3D.", e), this);
	}
	remove(e) {
		if (arguments.length > 1) {
			for (let e = 0; e < arguments.length; e++) this.remove(arguments[e]);
			return this;
		}
		let t = this.children.indexOf(e);
		return t !== -1 && (e.parent = null, this.children.splice(t, 1), e.dispatchEvent(Fi), Li.child = e, this.dispatchEvent(Li), Li.child = null), this;
	}
	removeFromParent() {
		let e = this.parent;
		return e !== null && e.remove(this), this;
	}
	clear() {
		return this.remove(...this.children);
	}
	attach(e) {
		return this.updateWorldMatrix(!0, !1), Ei.copy(this.matrixWorld).invert(), e.parent !== null && (e.parent.updateWorldMatrix(!0, !1), Ei.multiply(e.parent.matrixWorld)), e.applyMatrix4(Ei), e.removeFromParent(), e.parent = this, this.children.push(e), e.updateWorldMatrix(!1, !0), e.dispatchEvent(Pi), Ii.child = e, this.dispatchEvent(Ii), Ii.child = null, this;
	}
	getObjectById(e) {
		return this.getObjectByProperty("id", e);
	}
	getObjectByName(e) {
		return this.getObjectByProperty("name", e);
	}
	getObjectByProperty(e, t) {
		if (this[e] === t) return this;
		for (let n = 0, r = this.children.length; n < r; n++) {
			let r = this.children[n].getObjectByProperty(e, t);
			if (r !== void 0) return r;
		}
	}
	getObjectsByProperty(e, t, n = []) {
		this[e] === t && n.push(this);
		let r = this.children;
		for (let i = 0, a = r.length; i < a; i++) r[i].getObjectsByProperty(e, t, n);
		return n;
	}
	getWorldPosition(e) {
		return this.updateWorldMatrix(!0, !1), e.setFromMatrixPosition(this.matrixWorld);
	}
	getWorldQuaternion(e) {
		return this.updateWorldMatrix(!0, !1), this.matrixWorld.decompose(Oi, e, ki), e;
	}
	getWorldScale(e) {
		return this.updateWorldMatrix(!0, !1), this.matrixWorld.decompose(Oi, Ai, e), e;
	}
	getWorldDirection(e) {
		this.updateWorldMatrix(!0, !1);
		let t = this.matrixWorld.elements;
		return e.set(t[8], t[9], t[10]).normalize();
	}
	raycast() {}
	traverse(e) {
		e(this);
		let t = this.children;
		for (let n = 0, r = t.length; n < r; n++) t[n].traverse(e);
	}
	traverseVisible(e) {
		if (this.visible === !1) return;
		e(this);
		let t = this.children;
		for (let n = 0, r = t.length; n < r; n++) t[n].traverseVisible(e);
	}
	traverseAncestors(e) {
		let t = this.parent;
		t !== null && (e(t), t.traverseAncestors(e));
	}
	updateMatrix() {
		this.matrix.compose(this.position, this.quaternion, this.scale);
		let e = this.pivot;
		if (e !== null) {
			let t = e.x, n = e.y, r = e.z, i = this.matrix.elements;
			i[12] += t - i[0] * t - i[4] * n - i[8] * r, i[13] += n - i[1] * t - i[5] * n - i[9] * r, i[14] += r - i[2] * t - i[6] * n - i[10] * r;
		}
		this.matrixWorldNeedsUpdate = !0;
	}
	updateMatrixWorld(e) {
		this.matrixAutoUpdate && this.updateMatrix(), (this.matrixWorldNeedsUpdate || e) && (this.matrixWorldAutoUpdate === !0 && (this.parent === null ? this.matrixWorld.copy(this.matrix) : this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix)), this.matrixWorldNeedsUpdate = !1, e = !0);
		let t = this.children;
		for (let n = 0, r = t.length; n < r; n++) t[n].updateMatrixWorld(e);
	}
	updateWorldMatrix(e, t, n = !1) {
		let r = this.parent;
		if (e === !0 && r !== null && r.updateWorldMatrix(!0, !1), this.matrixAutoUpdate && this.updateMatrix(), (this.matrixWorldNeedsUpdate || n) && (this.matrixWorldAutoUpdate === !0 && (this.parent === null ? this.matrixWorld.copy(this.matrix) : this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix)), this.matrixWorldNeedsUpdate = !1, n = !0), t === !0) {
			let e = this.children;
			for (let t = 0, r = e.length; t < r; t++) e[t].updateWorldMatrix(!1, !0, n);
		}
	}
	toJSON(e) {
		let t = e === void 0 || typeof e == "string", n = {};
		t && (e = {
			geometries: {},
			materials: {},
			textures: {},
			images: {},
			shapes: {},
			skeletons: {},
			animations: {},
			nodes: {}
		}, n.metadata = {
			version: 4.7,
			type: "Object",
			generator: "Object3D.toJSON"
		});
		let r = {};
		r.uuid = this.uuid, r.type = this.type, this.name !== "" && (r.name = this.name), this.castShadow === !0 && (r.castShadow = !0), this.receiveShadow === !0 && (r.receiveShadow = !0), this.visible === !1 && (r.visible = !1), this.frustumCulled === !1 && (r.frustumCulled = !1), this.renderOrder !== 0 && (r.renderOrder = this.renderOrder), this.static !== !1 && (r.static = this.static), Object.keys(this.userData).length > 0 && (r.userData = this.userData), r.layers = this.layers.mask, r.matrix = this.matrix.toArray(), r.up = this.up.toArray(), this.pivot !== null && (r.pivot = this.pivot.toArray()), this.matrixAutoUpdate === !1 && (r.matrixAutoUpdate = !1), this.morphTargetDictionary !== void 0 && (r.morphTargetDictionary = Object.assign({}, this.morphTargetDictionary)), this.morphTargetInfluences !== void 0 && (r.morphTargetInfluences = this.morphTargetInfluences.slice()), this.isInstancedMesh && (r.type = "InstancedMesh", r.count = this.count, r.instanceMatrix = this.instanceMatrix.toJSON(), this.instanceColor !== null && (r.instanceColor = this.instanceColor.toJSON())), this.isBatchedMesh && (r.type = "BatchedMesh", r.perObjectFrustumCulled = this.perObjectFrustumCulled, r.sortObjects = this.sortObjects, r.drawRanges = this._drawRanges, r.reservedRanges = this._reservedRanges, r.geometryInfo = this._geometryInfo.map((e) => ({
			...e,
			boundingBox: e.boundingBox ? e.boundingBox.toJSON() : void 0,
			boundingSphere: e.boundingSphere ? e.boundingSphere.toJSON() : void 0
		})), r.instanceInfo = this._instanceInfo.map((e) => ({ ...e })), r.availableInstanceIds = this._availableInstanceIds.slice(), r.availableGeometryIds = this._availableGeometryIds.slice(), r.nextIndexStart = this._nextIndexStart, r.nextVertexStart = this._nextVertexStart, r.geometryCount = this._geometryCount, r.maxInstanceCount = this._maxInstanceCount, r.maxVertexCount = this._maxVertexCount, r.maxIndexCount = this._maxIndexCount, r.geometryInitialized = this._geometryInitialized, r.matricesTexture = this._matricesTexture.toJSON(e), r.indirectTexture = this._indirectTexture.toJSON(e), this._colorsTexture !== null && (r.colorsTexture = this._colorsTexture.toJSON(e)), this.boundingSphere !== null && (r.boundingSphere = this.boundingSphere.toJSON()), this.boundingBox !== null && (r.boundingBox = this.boundingBox.toJSON()));
		function i(t, n) {
			return t[n.uuid] === void 0 && (t[n.uuid] = n.toJSON(e)), n.uuid;
		}
		if (this.isScene) this.background && (this.background.isColor ? r.background = this.background.toJSON() : this.background.isTexture && (r.background = this.background.toJSON(e).uuid)), this.environment && this.environment.isTexture && this.environment.isRenderTargetTexture !== !0 && (r.environment = this.environment.toJSON(e).uuid);
		else if (this.isMesh || this.isLine || this.isPoints) {
			r.geometry = i(e.geometries, this.geometry);
			let t = this.geometry.parameters;
			if (t !== void 0 && t.shapes !== void 0) {
				let n = t.shapes;
				if (Array.isArray(n)) for (let t = 0, r = n.length; t < r; t++) {
					let r = n[t];
					i(e.shapes, r);
				}
				else i(e.shapes, n);
			}
		}
		if (this.isSkinnedMesh && (r.bindMode = this.bindMode, r.bindMatrix = this.bindMatrix.toArray(), this.skeleton !== void 0 && (i(e.skeletons, this.skeleton), r.skeleton = this.skeleton.uuid)), this.material !== void 0) if (Array.isArray(this.material)) {
			let t = [];
			for (let n = 0, r = this.material.length; n < r; n++) t.push(i(e.materials, this.material[n]));
			r.material = t;
		} else r.material = i(e.materials, this.material);
		if (this.children.length > 0) {
			r.children = [];
			for (let t = 0; t < this.children.length; t++) r.children.push(this.children[t].toJSON(e).object);
		}
		if (this.animations.length > 0) {
			r.animations = [];
			for (let t = 0; t < this.animations.length; t++) {
				let n = this.animations[t];
				r.animations.push(i(e.animations, n));
			}
		}
		if (t) {
			let t = a(e.geometries), r = a(e.materials), i = a(e.textures), o = a(e.images), s = a(e.shapes), c = a(e.skeletons), l = a(e.animations), u = a(e.nodes);
			t.length > 0 && (n.geometries = t), r.length > 0 && (n.materials = r), i.length > 0 && (n.textures = i), o.length > 0 && (n.images = o), s.length > 0 && (n.shapes = s), c.length > 0 && (n.skeletons = c), l.length > 0 && (n.animations = l), u.length > 0 && (n.nodes = u);
		}
		return n.object = r, n;
		function a(e) {
			let t = [];
			for (let n in e) {
				let r = e[n];
				delete r.metadata, t.push(r);
			}
			return t;
		}
	}
	clone(e) {
		return new this.constructor().copy(this, e);
	}
	copy(e, t = !0) {
		if (this.name = e.name, this.up.copy(e.up), this.position.copy(e.position), this.rotation.order = e.rotation.order, this.quaternion.copy(e.quaternion), this.scale.copy(e.scale), this.pivot = e.pivot === null ? null : e.pivot.clone(), this.matrix.copy(e.matrix), this.matrixWorld.copy(e.matrixWorld), this.matrixAutoUpdate = e.matrixAutoUpdate, this.matrixWorldAutoUpdate = e.matrixWorldAutoUpdate, this.matrixWorldNeedsUpdate = e.matrixWorldNeedsUpdate, this.layers.mask = e.layers.mask, this.visible = e.visible, this.castShadow = e.castShadow, this.receiveShadow = e.receiveShadow, this.frustumCulled = e.frustumCulled, this.renderOrder = e.renderOrder, this.static = e.static, this.animations = e.animations.slice(), this.userData = JSON.parse(JSON.stringify(e.userData)), t === !0) for (let t = 0; t < e.children.length; t++) {
			let n = e.children[t];
			this.add(n.clone());
		}
		return this;
	}
};
q.DEFAULT_UP = /*@__PURE__*/ new U(0, 1, 0), q.DEFAULT_MATRIX_AUTO_UPDATE = !0, q.DEFAULT_MATRIX_WORLD_AUTO_UPDATE = !0;
var Ri = class extends q {
	constructor() {
		super(), this.isGroup = !0, this.type = "Group";
	}
}, zi = { type: "move" }, Bi = class {
	constructor() {
		this._targetRay = null, this._grip = null, this._hand = null;
	}
	getHandSpace() {
		return this._hand === null && (this._hand = new Ri(), this._hand.matrixAutoUpdate = !1, this._hand.visible = !1, this._hand.joints = {}, this._hand.inputState = { pinching: !1 }), this._hand;
	}
	getTargetRaySpace() {
		return this._targetRay === null && (this._targetRay = new Ri(), this._targetRay.matrixAutoUpdate = !1, this._targetRay.visible = !1, this._targetRay.hasLinearVelocity = !1, this._targetRay.linearVelocity = new U(), this._targetRay.hasAngularVelocity = !1, this._targetRay.angularVelocity = new U()), this._targetRay;
	}
	getGripSpace() {
		return this._grip === null && (this._grip = new Ri(), this._grip.matrixAutoUpdate = !1, this._grip.visible = !1, this._grip.hasLinearVelocity = !1, this._grip.linearVelocity = new U(), this._grip.hasAngularVelocity = !1, this._grip.angularVelocity = new U(), this._grip.eventsEnabled = !1), this._grip;
	}
	dispatchEvent(e) {
		return this._targetRay !== null && this._targetRay.dispatchEvent(e), this._grip !== null && this._grip.dispatchEvent(e), this._hand !== null && this._hand.dispatchEvent(e), this;
	}
	connect(e) {
		if (e && e.hand) {
			let t = this._hand;
			if (t) for (let n of e.hand.values()) this._getHandJoint(t, n);
		}
		return this.dispatchEvent({
			type: "connected",
			data: e
		}), this;
	}
	disconnect(e) {
		return this.dispatchEvent({
			type: "disconnected",
			data: e
		}), this._targetRay !== null && (this._targetRay.visible = !1), this._grip !== null && (this._grip.visible = !1), this._hand !== null && (this._hand.visible = !1), this;
	}
	update(e, t, n) {
		let r = null, i = null, a = null, o = this._targetRay, s = this._grip, c = this._hand;
		if (e && t.session.visibilityState !== "visible-blurred") {
			if (c && e.hand) {
				a = !0;
				for (let r of e.hand.values()) {
					let e = t.getJointPose(r, n), i = this._getHandJoint(c, r);
					e !== null && (i.matrix.fromArray(e.transform.matrix), i.matrix.decompose(i.position, i.rotation, i.scale), i.matrixWorldNeedsUpdate = !0, i.jointRadius = e.radius), i.visible = e !== null;
				}
				let r = c.joints["index-finger-tip"], i = c.joints["thumb-tip"], o = r.position.distanceTo(i.position);
				c.inputState.pinching && o > .025 ? (c.inputState.pinching = !1, this.dispatchEvent({
					type: "pinchend",
					handedness: e.handedness,
					target: this
				})) : !c.inputState.pinching && o <= .015 && (c.inputState.pinching = !0, this.dispatchEvent({
					type: "pinchstart",
					handedness: e.handedness,
					target: this
				}));
			} else s !== null && e.gripSpace && (i = t.getPose(e.gripSpace, n), i !== null && (s.matrix.fromArray(i.transform.matrix), s.matrix.decompose(s.position, s.rotation, s.scale), s.matrixWorldNeedsUpdate = !0, i.linearVelocity ? (s.hasLinearVelocity = !0, s.linearVelocity.copy(i.linearVelocity)) : s.hasLinearVelocity = !1, i.angularVelocity ? (s.hasAngularVelocity = !0, s.angularVelocity.copy(i.angularVelocity)) : s.hasAngularVelocity = !1, s.eventsEnabled && s.dispatchEvent({
				type: "gripUpdated",
				data: e,
				target: this
			})));
			o !== null && (r = t.getPose(e.targetRaySpace, n), r === null && i !== null && (r = i), r !== null && (o.matrix.fromArray(r.transform.matrix), o.matrix.decompose(o.position, o.rotation, o.scale), o.matrixWorldNeedsUpdate = !0, r.linearVelocity ? (o.hasLinearVelocity = !0, o.linearVelocity.copy(r.linearVelocity)) : o.hasLinearVelocity = !1, r.angularVelocity ? (o.hasAngularVelocity = !0, o.angularVelocity.copy(r.angularVelocity)) : o.hasAngularVelocity = !1, this.dispatchEvent(zi)));
		}
		return o !== null && (o.visible = r !== null), s !== null && (s.visible = i !== null), c !== null && (c.visible = a !== null), this;
	}
	_getHandJoint(e, t) {
		if (e.joints[t.jointName] === void 0) {
			let n = new Ri();
			n.matrixAutoUpdate = !1, n.visible = !1, e.joints[t.jointName] = n, e.add(n);
		}
		return e.joints[t.jointName];
	}
}, Vi = {
	aliceblue: 15792383,
	antiquewhite: 16444375,
	aqua: 65535,
	aquamarine: 8388564,
	azure: 15794175,
	beige: 16119260,
	bisque: 16770244,
	black: 0,
	blanchedalmond: 16772045,
	blue: 255,
	blueviolet: 9055202,
	brown: 10824234,
	burlywood: 14596231,
	cadetblue: 6266528,
	chartreuse: 8388352,
	chocolate: 13789470,
	coral: 16744272,
	cornflowerblue: 6591981,
	cornsilk: 16775388,
	crimson: 14423100,
	cyan: 65535,
	darkblue: 139,
	darkcyan: 35723,
	darkgoldenrod: 12092939,
	darkgray: 11119017,
	darkgreen: 25600,
	darkgrey: 11119017,
	darkkhaki: 12433259,
	darkmagenta: 9109643,
	darkolivegreen: 5597999,
	darkorange: 16747520,
	darkorchid: 10040012,
	darkred: 9109504,
	darksalmon: 15308410,
	darkseagreen: 9419919,
	darkslateblue: 4734347,
	darkslategray: 3100495,
	darkslategrey: 3100495,
	darkturquoise: 52945,
	darkviolet: 9699539,
	deeppink: 16716947,
	deepskyblue: 49151,
	dimgray: 6908265,
	dimgrey: 6908265,
	dodgerblue: 2003199,
	firebrick: 11674146,
	floralwhite: 16775920,
	forestgreen: 2263842,
	fuchsia: 16711935,
	gainsboro: 14474460,
	ghostwhite: 16316671,
	gold: 16766720,
	goldenrod: 14329120,
	gray: 8421504,
	green: 32768,
	greenyellow: 11403055,
	grey: 8421504,
	honeydew: 15794160,
	hotpink: 16738740,
	indianred: 13458524,
	indigo: 4915330,
	ivory: 16777200,
	khaki: 15787660,
	lavender: 15132410,
	lavenderblush: 16773365,
	lawngreen: 8190976,
	lemonchiffon: 16775885,
	lightblue: 11393254,
	lightcoral: 15761536,
	lightcyan: 14745599,
	lightgoldenrodyellow: 16448210,
	lightgray: 13882323,
	lightgreen: 9498256,
	lightgrey: 13882323,
	lightpink: 16758465,
	lightsalmon: 16752762,
	lightseagreen: 2142890,
	lightskyblue: 8900346,
	lightslategray: 7833753,
	lightslategrey: 7833753,
	lightsteelblue: 11584734,
	lightyellow: 16777184,
	lime: 65280,
	limegreen: 3329330,
	linen: 16445670,
	magenta: 16711935,
	maroon: 8388608,
	mediumaquamarine: 6737322,
	mediumblue: 205,
	mediumorchid: 12211667,
	mediumpurple: 9662683,
	mediumseagreen: 3978097,
	mediumslateblue: 8087790,
	mediumspringgreen: 64154,
	mediumturquoise: 4772300,
	mediumvioletred: 13047173,
	midnightblue: 1644912,
	mintcream: 16121850,
	mistyrose: 16770273,
	moccasin: 16770229,
	navajowhite: 16768685,
	navy: 128,
	oldlace: 16643558,
	olive: 8421376,
	olivedrab: 7048739,
	orange: 16753920,
	orangered: 16729344,
	orchid: 14315734,
	palegoldenrod: 15657130,
	palegreen: 10025880,
	paleturquoise: 11529966,
	palevioletred: 14381203,
	papayawhip: 16773077,
	peachpuff: 16767673,
	peru: 13468991,
	pink: 16761035,
	plum: 14524637,
	powderblue: 11591910,
	purple: 8388736,
	rebeccapurple: 6697881,
	red: 16711680,
	rosybrown: 12357519,
	royalblue: 4286945,
	saddlebrown: 9127187,
	salmon: 16416882,
	sandybrown: 16032864,
	seagreen: 3050327,
	seashell: 16774638,
	sienna: 10506797,
	silver: 12632256,
	skyblue: 8900331,
	slateblue: 6970061,
	slategray: 7372944,
	slategrey: 7372944,
	snow: 16775930,
	springgreen: 65407,
	steelblue: 4620980,
	tan: 13808780,
	teal: 32896,
	thistle: 14204888,
	tomato: 16737095,
	turquoise: 4251856,
	violet: 15631086,
	wheat: 16113331,
	white: 16777215,
	whitesmoke: 16119285,
	yellow: 16776960,
	yellowgreen: 10145074
}, Hi = {
	h: 0,
	s: 0,
	l: 0
}, Ui = {
	h: 0,
	s: 0,
	l: 0
};
function Wi(e, t, n) {
	return n < 0 && (n += 1), n > 1 && --n, n < 1 / 6 ? e + (t - e) * 6 * n : n < 1 / 2 ? t : n < 2 / 3 ? e + (t - e) * 6 * (2 / 3 - n) : e;
}
var J = class {
	constructor(e, t, n) {
		return this.isColor = !0, this.r = 1, this.g = 1, this.b = 1, this.set(e, t, n);
	}
	set(e, t, n) {
		if (t === void 0 && n === void 0) {
			let t = e;
			t && t.isColor ? this.copy(t) : typeof t == "number" ? this.setHex(t) : typeof t == "string" && this.setStyle(t);
		} else this.setRGB(e, t, n);
		return this;
	}
	setScalar(e) {
		return this.r = e, this.g = e, this.b = e, this;
	}
	setHex(e, t = On) {
		return e = Math.floor(e), this.r = (e >> 16 & 255) / 255, this.g = (e >> 8 & 255) / 255, this.b = (e & 255) / 255, G.colorSpaceToWorking(this, t), this;
	}
	setRGB(e, t, n, r = G.workingColorSpace) {
		return this.r = e, this.g = t, this.b = n, G.colorSpaceToWorking(this, r), this;
	}
	setHSL(e, t, n, r = G.workingColorSpace) {
		if (e = Sr(e, 1), t = B(t, 0, 1), n = B(n, 0, 1), t === 0) this.r = this.g = this.b = n;
		else {
			let r = n <= .5 ? n * (1 + t) : n + t - n * t, i = 2 * n - r;
			this.r = Wi(i, r, e + 1 / 3), this.g = Wi(i, r, e), this.b = Wi(i, r, e - 1 / 3);
		}
		return G.colorSpaceToWorking(this, r), this;
	}
	setStyle(e, t = On) {
		function n(t) {
			t !== void 0 && parseFloat(t) < 1 && R("Color: Alpha component of " + e + " will be ignored.");
		}
		let r;
		if (r = /^(\w+)\(([^\)]*)\)/.exec(e)) {
			let i, a = r[1], o = r[2];
			switch (a) {
				case "rgb":
				case "rgba":
					if (i = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o)) return n(i[4]), this.setRGB(Math.min(255, parseInt(i[1], 10)) / 255, Math.min(255, parseInt(i[2], 10)) / 255, Math.min(255, parseInt(i[3], 10)) / 255, t);
					if (i = /^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o)) return n(i[4]), this.setRGB(Math.min(100, parseInt(i[1], 10)) / 100, Math.min(100, parseInt(i[2], 10)) / 100, Math.min(100, parseInt(i[3], 10)) / 100, t);
					break;
				case "hsl":
				case "hsla":
					if (i = /^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o)) return n(i[4]), this.setHSL(parseFloat(i[1]) / 360, parseFloat(i[2]) / 100, parseFloat(i[3]) / 100, t);
					break;
				default: R("Color: Unknown color model " + e);
			}
		} else if (r = /^\#([A-Fa-f\d]+)$/.exec(e)) {
			let n = r[1], i = n.length;
			if (i === 3) return this.setRGB(parseInt(n.charAt(0), 16) / 15, parseInt(n.charAt(1), 16) / 15, parseInt(n.charAt(2), 16) / 15, t);
			if (i === 6) return this.setHex(parseInt(n, 16), t);
			R("Color: Invalid hex color " + e);
		} else if (e && e.length > 0) return this.setColorName(e, t);
		return this;
	}
	setColorName(e, t = On) {
		let n = Vi[e.toLowerCase()];
		return n === void 0 ? R("Color: Unknown color " + e) : this.setHex(n, t), this;
	}
	clone() {
		return new this.constructor(this.r, this.g, this.b);
	}
	copy(e) {
		return this.r = e.r, this.g = e.g, this.b = e.b, this;
	}
	copySRGBToLinear(e) {
		return this.r = Yr(e.r), this.g = Yr(e.g), this.b = Yr(e.b), this;
	}
	copyLinearToSRGB(e) {
		return this.r = Xr(e.r), this.g = Xr(e.g), this.b = Xr(e.b), this;
	}
	convertSRGBToLinear() {
		return this.copySRGBToLinear(this), this;
	}
	convertLinearToSRGB() {
		return this.copyLinearToSRGB(this), this;
	}
	getHex(e = On) {
		return G.workingToColorSpace(Gi.copy(this), e), Math.round(B(Gi.r * 255, 0, 255)) * 65536 + Math.round(B(Gi.g * 255, 0, 255)) * 256 + Math.round(B(Gi.b * 255, 0, 255));
	}
	getHexString(e = On) {
		return ("000000" + this.getHex(e).toString(16)).slice(-6);
	}
	getHSL(e, t = G.workingColorSpace) {
		G.workingToColorSpace(Gi.copy(this), t);
		let n = Gi.r, r = Gi.g, i = Gi.b, a = Math.max(n, r, i), o = Math.min(n, r, i), s, c, l = (o + a) / 2;
		if (o === a) s = 0, c = 0;
		else {
			let e = a - o;
			switch (c = l <= .5 ? e / (a + o) : e / (2 - a - o), a) {
				case n:
					s = (r - i) / e + (r < i ? 6 : 0);
					break;
				case r:
					s = (i - n) / e + 2;
					break;
				case i:
					s = (n - r) / e + 4;
					break;
			}
			s /= 6;
		}
		return e.h = s, e.s = c, e.l = l, e;
	}
	getRGB(e, t = G.workingColorSpace) {
		return G.workingToColorSpace(Gi.copy(this), t), e.r = Gi.r, e.g = Gi.g, e.b = Gi.b, e;
	}
	getStyle(e = On) {
		G.workingToColorSpace(Gi.copy(this), e);
		let t = Gi.r, n = Gi.g, r = Gi.b;
		return e === "srgb" ? `rgb(${Math.round(t * 255)},${Math.round(n * 255)},${Math.round(r * 255)})` : `color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`;
	}
	offsetHSL(e, t, n) {
		return this.getHSL(Hi), this.setHSL(Hi.h + e, Hi.s + t, Hi.l + n);
	}
	add(e) {
		return this.r += e.r, this.g += e.g, this.b += e.b, this;
	}
	addColors(e, t) {
		return this.r = e.r + t.r, this.g = e.g + t.g, this.b = e.b + t.b, this;
	}
	addScalar(e) {
		return this.r += e, this.g += e, this.b += e, this;
	}
	sub(e) {
		return this.r = Math.max(0, this.r - e.r), this.g = Math.max(0, this.g - e.g), this.b = Math.max(0, this.b - e.b), this;
	}
	multiply(e) {
		return this.r *= e.r, this.g *= e.g, this.b *= e.b, this;
	}
	multiplyScalar(e) {
		return this.r *= e, this.g *= e, this.b *= e, this;
	}
	lerp(e, t) {
		return this.r += (e.r - this.r) * t, this.g += (e.g - this.g) * t, this.b += (e.b - this.b) * t, this;
	}
	lerpColors(e, t, n) {
		return this.r = e.r + (t.r - e.r) * n, this.g = e.g + (t.g - e.g) * n, this.b = e.b + (t.b - e.b) * n, this;
	}
	lerpHSL(e, t) {
		this.getHSL(Hi), e.getHSL(Ui);
		let n = Tr(Hi.h, Ui.h, t), r = Tr(Hi.s, Ui.s, t), i = Tr(Hi.l, Ui.l, t);
		return this.setHSL(n, r, i), this;
	}
	setFromVector3(e) {
		return this.r = e.x, this.g = e.y, this.b = e.z, this;
	}
	applyMatrix3(e) {
		let t = this.r, n = this.g, r = this.b, i = e.elements;
		return this.r = i[0] * t + i[3] * n + i[6] * r, this.g = i[1] * t + i[4] * n + i[7] * r, this.b = i[2] * t + i[5] * n + i[8] * r, this;
	}
	equals(e) {
		return e.r === this.r && e.g === this.g && e.b === this.b;
	}
	fromArray(e, t = 0) {
		return this.r = e[t], this.g = e[t + 1], this.b = e[t + 2], this;
	}
	toArray(e = [], t = 0) {
		return e[t] = this.r, e[t + 1] = this.g, e[t + 2] = this.b, e;
	}
	fromBufferAttribute(e, t) {
		return this.r = e.getX(t), this.g = e.getY(t), this.b = e.getZ(t), this;
	}
	toJSON() {
		return this.getHex();
	}
	*[Symbol.iterator]() {
		yield this.r, yield this.g, yield this.b;
	}
}, Gi = /*@__PURE__*/ new J();
J.NAMES = Vi;
var Ki = class e {
	constructor(e, t = 25e-5) {
		this.isFogExp2 = !0, this.name = "", this.color = new J(e), this.density = t;
	}
	clone() {
		return new e(this.color, this.density);
	}
	toJSON() {
		return {
			type: "FogExp2",
			name: this.name,
			color: this.color.getHex(),
			density: this.density
		};
	}
}, qi = class e {
	constructor(e, t = 1, n = 1e3) {
		this.isFog = !0, this.name = "", this.color = new J(e), this.near = t, this.far = n;
	}
	clone() {
		return new e(this.color, this.near, this.far);
	}
	toJSON() {
		return {
			type: "Fog",
			name: this.name,
			color: this.color.getHex(),
			near: this.near,
			far: this.far
		};
	}
}, Ji = class extends q {
	constructor() {
		super(), this.isScene = !0, this.type = "Scene", this.background = null, this.environment = null, this.fog = null, this.backgroundBlurriness = 0, this.backgroundIntensity = 1, this.backgroundRotation = new xi(), this.environmentIntensity = 1, this.environmentRotation = new xi(), this.overrideMaterial = null, typeof __THREE_DEVTOOLS__ < "u" && __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", { detail: this }));
	}
	copy(e, t) {
		return super.copy(e, t), e.background !== null && (this.background = e.background.clone()), e.environment !== null && (this.environment = e.environment.clone()), e.fog !== null && (this.fog = e.fog.clone()), this.backgroundBlurriness = e.backgroundBlurriness, this.backgroundIntensity = e.backgroundIntensity, this.backgroundRotation.copy(e.backgroundRotation), this.environmentIntensity = e.environmentIntensity, this.environmentRotation.copy(e.environmentRotation), e.overrideMaterial !== null && (this.overrideMaterial = e.overrideMaterial.clone()), this.matrixAutoUpdate = e.matrixAutoUpdate, this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return this.fog !== null && (t.object.fog = this.fog.toJSON()), this.backgroundBlurriness > 0 && (t.object.backgroundBlurriness = this.backgroundBlurriness), this.backgroundIntensity !== 1 && (t.object.backgroundIntensity = this.backgroundIntensity), t.object.backgroundRotation = this.backgroundRotation.toArray(), this.environmentIntensity !== 1 && (t.object.environmentIntensity = this.environmentIntensity), t.object.environmentRotation = this.environmentRotation.toArray(), t;
	}
}, Yi = /*@__PURE__*/ new U(), Xi = /*@__PURE__*/ new U(), Zi = /*@__PURE__*/ new U(), Qi = /*@__PURE__*/ new U(), $i = /*@__PURE__*/ new U(), ea = /*@__PURE__*/ new U(), ta = /*@__PURE__*/ new U(), na = /*@__PURE__*/ new U(), ra = /*@__PURE__*/ new U(), ia = /*@__PURE__*/ new U(), aa = /*@__PURE__*/ new ai(), oa = /*@__PURE__*/ new ai(), sa = /*@__PURE__*/ new ai(), ca = class e {
	constructor(e = new U(), t = new U(), n = new U()) {
		this.a = e, this.b = t, this.c = n;
	}
	static getNormal(e, t, n, r) {
		r.subVectors(n, t), Yi.subVectors(e, t), r.cross(Yi);
		let i = r.lengthSq();
		return i > 0 ? r.multiplyScalar(1 / Math.sqrt(i)) : r.set(0, 0, 0);
	}
	static getBarycoord(e, t, n, r, i) {
		Yi.subVectors(r, t), Xi.subVectors(n, t), Zi.subVectors(e, t);
		let a = Yi.dot(Yi), o = Yi.dot(Xi), s = Yi.dot(Zi), c = Xi.dot(Xi), l = Xi.dot(Zi), u = a * c - o * o;
		if (u === 0) return i.set(0, 0, 0), null;
		let d = 1 / u, f = (c * s - o * l) * d, p = (a * l - o * s) * d;
		return i.set(1 - f - p, p, f);
	}
	static containsPoint(e, t, n, r) {
		return this.getBarycoord(e, t, n, r, Qi) === null ? !1 : Qi.x >= 0 && Qi.y >= 0 && Qi.x + Qi.y <= 1;
	}
	static getInterpolation(e, t, n, r, i, a, o, s) {
		return this.getBarycoord(e, t, n, r, Qi) === null ? (s.x = 0, s.y = 0, "z" in s && (s.z = 0), "w" in s && (s.w = 0), null) : (s.setScalar(0), s.addScaledVector(i, Qi.x), s.addScaledVector(a, Qi.y), s.addScaledVector(o, Qi.z), s);
	}
	static getInterpolatedAttribute(e, t, n, r, i, a) {
		return aa.setScalar(0), oa.setScalar(0), sa.setScalar(0), aa.fromBufferAttribute(e, t), oa.fromBufferAttribute(e, n), sa.fromBufferAttribute(e, r), a.setScalar(0), a.addScaledVector(aa, i.x), a.addScaledVector(oa, i.y), a.addScaledVector(sa, i.z), a;
	}
	static isFrontFacing(e, t, n, r) {
		return Yi.subVectors(n, t), Xi.subVectors(e, t), Yi.cross(Xi).dot(r) < 0;
	}
	set(e, t, n) {
		return this.a.copy(e), this.b.copy(t), this.c.copy(n), this;
	}
	setFromPointsAndIndices(e, t, n, r) {
		return this.a.copy(e[t]), this.b.copy(e[n]), this.c.copy(e[r]), this;
	}
	setFromAttributeAndIndices(e, t, n, r) {
		return this.a.fromBufferAttribute(e, t), this.b.fromBufferAttribute(e, n), this.c.fromBufferAttribute(e, r), this;
	}
	clone() {
		return new this.constructor().copy(this);
	}
	copy(e) {
		return this.a.copy(e.a), this.b.copy(e.b), this.c.copy(e.c), this;
	}
	getArea() {
		return Yi.subVectors(this.c, this.b), Xi.subVectors(this.a, this.b), Yi.cross(Xi).length() * .5;
	}
	getMidpoint(e) {
		return e.addVectors(this.a, this.b).add(this.c).multiplyScalar(1 / 3);
	}
	getNormal(t) {
		return e.getNormal(this.a, this.b, this.c, t);
	}
	getPlane(e) {
		return e.setFromCoplanarPoints(this.a, this.b, this.c);
	}
	getBarycoord(t, n) {
		return e.getBarycoord(t, this.a, this.b, this.c, n);
	}
	getInterpolation(t, n, r, i, a) {
		return e.getInterpolation(t, this.a, this.b, this.c, n, r, i, a);
	}
	containsPoint(t) {
		return e.containsPoint(t, this.a, this.b, this.c);
	}
	isFrontFacing(t) {
		return e.isFrontFacing(this.a, this.b, this.c, t);
	}
	intersectsBox(e) {
		return e.intersectsTriangle(this);
	}
	closestPointToPoint(e, t) {
		let n = this.a, r = this.b, i = this.c, a, o;
		$i.subVectors(r, n), ea.subVectors(i, n), na.subVectors(e, n);
		let s = $i.dot(na), c = ea.dot(na);
		if (s <= 0 && c <= 0) return t.copy(n);
		ra.subVectors(e, r);
		let l = $i.dot(ra), u = ea.dot(ra);
		if (l >= 0 && u <= l) return t.copy(r);
		let d = s * u - l * c;
		if (d <= 0 && s >= 0 && l <= 0) return a = s / (s - l), t.copy(n).addScaledVector($i, a);
		ia.subVectors(e, i);
		let f = $i.dot(ia), p = ea.dot(ia);
		if (p >= 0 && f <= p) return t.copy(i);
		let m = f * c - s * p;
		if (m <= 0 && c >= 0 && p <= 0) return o = c / (c - p), t.copy(n).addScaledVector(ea, o);
		let h = l * p - f * u;
		if (h <= 0 && u - l >= 0 && f - p >= 0) return ta.subVectors(i, r), o = (u - l) / (u - l + (f - p)), t.copy(r).addScaledVector(ta, o);
		let g = 1 / (h + m + d);
		return a = m * g, o = d * g, t.copy(n).addScaledVector($i, a).addScaledVector(ea, o);
	}
	equals(e) {
		return e.a.equals(this.a) && e.b.equals(this.b) && e.c.equals(this.c);
	}
}, la = class {
	constructor(e = new U(Infinity, Infinity, Infinity), t = new U(-Infinity, -Infinity, -Infinity)) {
		this.isBox3 = !0, this.min = e, this.max = t;
	}
	set(e, t) {
		return this.min.copy(e), this.max.copy(t), this;
	}
	setFromArray(e) {
		this.makeEmpty();
		for (let t = 0, n = e.length; t < n; t += 3) this.expandByPoint(da.fromArray(e, t));
		return this;
	}
	setFromBufferAttribute(e) {
		this.makeEmpty();
		for (let t = 0, n = e.count; t < n; t++) this.expandByPoint(da.fromBufferAttribute(e, t));
		return this;
	}
	setFromPoints(e) {
		this.makeEmpty();
		for (let t = 0, n = e.length; t < n; t++) this.expandByPoint(e[t]);
		return this;
	}
	setFromCenterAndSize(e, t) {
		let n = da.copy(t).multiplyScalar(.5);
		return this.min.copy(e).sub(n), this.max.copy(e).add(n), this;
	}
	setFromObject(e, t = !1) {
		return this.makeEmpty(), this.expandByObject(e, t);
	}
	clone() {
		return new this.constructor().copy(this);
	}
	copy(e) {
		return this.min.copy(e.min), this.max.copy(e.max), this;
	}
	makeEmpty() {
		return this.min.x = this.min.y = this.min.z = Infinity, this.max.x = this.max.y = this.max.z = -Infinity, this;
	}
	isEmpty() {
		return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z;
	}
	getCenter(e) {
		return this.isEmpty() ? e.set(0, 0, 0) : e.addVectors(this.min, this.max).multiplyScalar(.5);
	}
	getSize(e) {
		return this.isEmpty() ? e.set(0, 0, 0) : e.subVectors(this.max, this.min);
	}
	expandByPoint(e) {
		return this.min.min(e), this.max.max(e), this;
	}
	expandByVector(e) {
		return this.min.sub(e), this.max.add(e), this;
	}
	expandByScalar(e) {
		return this.min.addScalar(-e), this.max.addScalar(e), this;
	}
	expandByObject(e, t = !1) {
		e.updateWorldMatrix(!1, !1);
		let n = e.geometry;
		if (n !== void 0) {
			let r = n.getAttribute("position");
			if (t === !0 && r !== void 0 && e.isInstancedMesh !== !0) for (let t = 0, n = r.count; t < n; t++) e.isMesh === !0 ? e.getVertexPosition(t, da) : da.fromBufferAttribute(r, t), da.applyMatrix4(e.matrixWorld), this.expandByPoint(da);
			else e.boundingBox === void 0 ? (n.boundingBox === null && n.computeBoundingBox(), fa.copy(n.boundingBox)) : (e.boundingBox === null && e.computeBoundingBox(), fa.copy(e.boundingBox)), fa.applyMatrix4(e.matrixWorld), this.union(fa);
		}
		let r = e.children;
		for (let e = 0, n = r.length; e < n; e++) this.expandByObject(r[e], t);
		return this;
	}
	containsPoint(e) {
		return e.x >= this.min.x && e.x <= this.max.x && e.y >= this.min.y && e.y <= this.max.y && e.z >= this.min.z && e.z <= this.max.z;
	}
	containsBox(e) {
		return this.min.x <= e.min.x && e.max.x <= this.max.x && this.min.y <= e.min.y && e.max.y <= this.max.y && this.min.z <= e.min.z && e.max.z <= this.max.z;
	}
	getParameter(e, t) {
		return t.set((e.x - this.min.x) / (this.max.x - this.min.x), (e.y - this.min.y) / (this.max.y - this.min.y), (e.z - this.min.z) / (this.max.z - this.min.z));
	}
	intersectsBox(e) {
		return e.max.x >= this.min.x && e.min.x <= this.max.x && e.max.y >= this.min.y && e.min.y <= this.max.y && e.max.z >= this.min.z && e.min.z <= this.max.z;
	}
	intersectsSphere(e) {
		return this.clampPoint(e.center, da), da.distanceToSquared(e.center) <= e.radius * e.radius;
	}
	intersectsPlane(e) {
		let t, n;
		return e.normal.x > 0 ? (t = e.normal.x * this.min.x, n = e.normal.x * this.max.x) : (t = e.normal.x * this.max.x, n = e.normal.x * this.min.x), e.normal.y > 0 ? (t += e.normal.y * this.min.y, n += e.normal.y * this.max.y) : (t += e.normal.y * this.max.y, n += e.normal.y * this.min.y), e.normal.z > 0 ? (t += e.normal.z * this.min.z, n += e.normal.z * this.max.z) : (t += e.normal.z * this.max.z, n += e.normal.z * this.min.z), t <= -e.constant && n >= -e.constant;
	}
	intersectsTriangle(e) {
		if (this.isEmpty()) return !1;
		this.getCenter(ya), ba.subVectors(this.max, ya), pa.subVectors(e.a, ya), ma.subVectors(e.b, ya), ha.subVectors(e.c, ya), ga.subVectors(ma, pa), _a.subVectors(ha, ma), va.subVectors(pa, ha);
		let t = [
			0,
			-ga.z,
			ga.y,
			0,
			-_a.z,
			_a.y,
			0,
			-va.z,
			va.y,
			ga.z,
			0,
			-ga.x,
			_a.z,
			0,
			-_a.x,
			va.z,
			0,
			-va.x,
			-ga.y,
			ga.x,
			0,
			-_a.y,
			_a.x,
			0,
			-va.y,
			va.x,
			0
		];
		return !Ca(t, pa, ma, ha, ba) || (t = [
			1,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			1
		], !Ca(t, pa, ma, ha, ba)) ? !1 : (xa.crossVectors(ga, _a), t = [
			xa.x,
			xa.y,
			xa.z
		], Ca(t, pa, ma, ha, ba));
	}
	clampPoint(e, t) {
		return t.copy(e).clamp(this.min, this.max);
	}
	distanceToPoint(e) {
		return this.clampPoint(e, da).distanceTo(e);
	}
	getBoundingSphere(e) {
		return this.isEmpty() ? e.makeEmpty() : (this.getCenter(e.center), e.radius = this.getSize(da).length() * .5), e;
	}
	intersect(e) {
		return this.min.max(e.min), this.max.min(e.max), this.isEmpty() && this.makeEmpty(), this;
	}
	union(e) {
		return this.min.min(e.min), this.max.max(e.max), this;
	}
	applyMatrix4(e) {
		return this.isEmpty() ? this : (ua[0].set(this.min.x, this.min.y, this.min.z).applyMatrix4(e), ua[1].set(this.min.x, this.min.y, this.max.z).applyMatrix4(e), ua[2].set(this.min.x, this.max.y, this.min.z).applyMatrix4(e), ua[3].set(this.min.x, this.max.y, this.max.z).applyMatrix4(e), ua[4].set(this.max.x, this.min.y, this.min.z).applyMatrix4(e), ua[5].set(this.max.x, this.min.y, this.max.z).applyMatrix4(e), ua[6].set(this.max.x, this.max.y, this.min.z).applyMatrix4(e), ua[7].set(this.max.x, this.max.y, this.max.z).applyMatrix4(e), this.setFromPoints(ua), this);
	}
	translate(e) {
		return this.min.add(e), this.max.add(e), this;
	}
	equals(e) {
		return e.min.equals(this.min) && e.max.equals(this.max);
	}
	toJSON() {
		return {
			min: this.min.toArray(),
			max: this.max.toArray()
		};
	}
	fromJSON(e) {
		return this.min.fromArray(e.min), this.max.fromArray(e.max), this;
	}
}, ua = [
	/*@__PURE__*/ new U(),
	/*@__PURE__*/ new U(),
	/*@__PURE__*/ new U(),
	/*@__PURE__*/ new U(),
	/*@__PURE__*/ new U(),
	/*@__PURE__*/ new U(),
	/*@__PURE__*/ new U(),
	/*@__PURE__*/ new U()
], da = /*@__PURE__*/ new U(), fa = /*@__PURE__*/ new la(), pa = /*@__PURE__*/ new U(), ma = /*@__PURE__*/ new U(), ha = /*@__PURE__*/ new U(), ga = /*@__PURE__*/ new U(), _a = /*@__PURE__*/ new U(), va = /*@__PURE__*/ new U(), ya = /*@__PURE__*/ new U(), ba = /*@__PURE__*/ new U(), xa = /*@__PURE__*/ new U(), Sa = /*@__PURE__*/ new U();
function Ca(e, t, n, r, i) {
	for (let a = 0, o = e.length - 3; a <= o; a += 3) {
		Sa.fromArray(e, a);
		let o = i.x * Math.abs(Sa.x) + i.y * Math.abs(Sa.y) + i.z * Math.abs(Sa.z), s = t.dot(Sa), c = n.dot(Sa), l = r.dot(Sa);
		if (Math.max(-Math.max(s, c, l), Math.min(s, c, l)) > o) return !1;
	}
	return !0;
}
var wa = /*@__PURE__*/ Ta();
function Ta() {
	let e = /* @__PURE__ */ new ArrayBuffer(4), t = new Float32Array(e), n = new Uint32Array(e), r = /* @__PURE__ */ new Uint32Array(512), i = /* @__PURE__ */ new Uint32Array(512);
	for (let e = 0; e < 256; ++e) {
		let t = e - 127;
		t < -27 ? (r[e] = 0, r[e | 256] = 32768, i[e] = 24, i[e | 256] = 24) : t < -14 ? (r[e] = 1024 >> -t - 14, r[e | 256] = 1024 >> -t - 14 | 32768, i[e] = -t - 1, i[e | 256] = -t - 1) : t <= 15 ? (r[e] = t + 15 << 10, r[e | 256] = t + 15 << 10 | 32768, i[e] = 13, i[e | 256] = 13) : t < 128 ? (r[e] = 31744, r[e | 256] = 64512, i[e] = 24, i[e | 256] = 24) : (r[e] = 31744, r[e | 256] = 64512, i[e] = 13, i[e | 256] = 13);
	}
	let a = /* @__PURE__ */ new Uint32Array(2048), o = /* @__PURE__ */ new Uint32Array(64), s = /* @__PURE__ */ new Uint32Array(64);
	for (let e = 1; e < 1024; ++e) {
		let t = e << 13, n = 0;
		for (; !(t & 8388608);) t <<= 1, n -= 8388608;
		t &= -8388609, n += 947912704, a[e] = t | n;
	}
	for (let e = 1024; e < 2048; ++e) a[e] = 939524096 + (e - 1024 << 13);
	for (let e = 1; e < 31; ++e) o[e] = e << 23;
	o[31] = 1199570944, o[32] = 2147483648;
	for (let e = 33; e < 63; ++e) o[e] = 2147483648 + (e - 32 << 23);
	o[63] = 3347054592;
	for (let e = 1; e < 64; ++e) e !== 32 && (s[e] = 1024);
	return {
		floatView: t,
		uint32View: n,
		baseTable: r,
		shiftTable: i,
		mantissaTable: a,
		exponentTable: o,
		offsetTable: s
	};
}
function Ea(e) {
	Math.abs(e) > 65504 && R("DataUtils.toHalfFloat(): Value out of range."), e = B(e, -65504, 65504), wa.floatView[0] = e;
	let t = wa.uint32View[0], n = t >> 23 & 511;
	return wa.baseTable[n] + ((t & 8388607) >> wa.shiftTable[n]);
}
function Da(e) {
	let t = e >> 10;
	return wa.uint32View[0] = wa.mantissaTable[wa.offsetTable[t] + (e & 1023)] + wa.exponentTable[t], wa.floatView[0];
}
var Oa = class {
	static toHalfFloat(e) {
		return Ea(e);
	}
	static fromHalfFloat(e) {
		return Da(e);
	}
}, ka = /*@__PURE__*/ new U(), Aa = /*@__PURE__*/ new H(), ja = 0, Y = class extends gr {
	constructor(e, t, n = !1) {
		if (super(), Array.isArray(e)) throw TypeError("THREE.BufferAttribute: array should be a Typed Array.");
		this.isBufferAttribute = !0, Object.defineProperty(this, "id", { value: ja++ }), this.name = "", this.array = e, this.itemSize = t, this.count = e === void 0 ? 0 : e.length / t, this.normalized = n, this.usage = zn, this.updateRanges = [], this.gpuType = dt, this.version = 0;
	}
	onUploadCallback() {}
	set needsUpdate(e) {
		e === !0 && this.version++;
	}
	setUsage(e) {
		return this.usage = e, this;
	}
	addUpdateRange(e, t) {
		this.updateRanges.push({
			start: e,
			count: t
		});
	}
	clearUpdateRanges() {
		this.updateRanges.length = 0;
	}
	copy(e) {
		return this.name = e.name, this.array = new e.array.constructor(e.array), this.itemSize = e.itemSize, this.count = e.count, this.normalized = e.normalized, this.usage = e.usage, this.gpuType = e.gpuType, this;
	}
	copyAt(e, t, n) {
		e *= this.itemSize, n *= t.itemSize;
		for (let r = 0, i = this.itemSize; r < i; r++) this.array[e + r] = t.array[n + r];
		return this;
	}
	copyArray(e) {
		return this.array.set(e), this;
	}
	applyMatrix3(e) {
		if (this.itemSize === 2) for (let t = 0, n = this.count; t < n; t++) Aa.fromBufferAttribute(this, t), Aa.applyMatrix3(e), this.setXY(t, Aa.x, Aa.y);
		else if (this.itemSize === 3) for (let t = 0, n = this.count; t < n; t++) ka.fromBufferAttribute(this, t), ka.applyMatrix3(e), this.setXYZ(t, ka.x, ka.y, ka.z);
		return this;
	}
	applyMatrix4(e) {
		for (let t = 0, n = this.count; t < n; t++) ka.fromBufferAttribute(this, t), ka.applyMatrix4(e), this.setXYZ(t, ka.x, ka.y, ka.z);
		return this;
	}
	applyNormalMatrix(e) {
		for (let t = 0, n = this.count; t < n; t++) ka.fromBufferAttribute(this, t), ka.applyNormalMatrix(e), this.setXYZ(t, ka.x, ka.y, ka.z);
		return this;
	}
	transformDirection(e) {
		for (let t = 0, n = this.count; t < n; t++) ka.fromBufferAttribute(this, t), ka.transformDirection(e), this.setXYZ(t, ka.x, ka.y, ka.z);
		return this;
	}
	set(e, t = 0) {
		return this.array.set(e, t), this;
	}
	getComponent(e, t) {
		let n = this.array[e * this.itemSize + t];
		return this.normalized && (n = Br(n, this.array)), n;
	}
	setComponent(e, t, n) {
		return this.normalized && (n = V(n, this.array)), this.array[e * this.itemSize + t] = n, this;
	}
	getX(e) {
		let t = this.array[e * this.itemSize];
		return this.normalized && (t = Br(t, this.array)), t;
	}
	setX(e, t) {
		return this.normalized && (t = V(t, this.array)), this.array[e * this.itemSize] = t, this;
	}
	getY(e) {
		let t = this.array[e * this.itemSize + 1];
		return this.normalized && (t = Br(t, this.array)), t;
	}
	setY(e, t) {
		return this.normalized && (t = V(t, this.array)), this.array[e * this.itemSize + 1] = t, this;
	}
	getZ(e) {
		let t = this.array[e * this.itemSize + 2];
		return this.normalized && (t = Br(t, this.array)), t;
	}
	setZ(e, t) {
		return this.normalized && (t = V(t, this.array)), this.array[e * this.itemSize + 2] = t, this;
	}
	getW(e) {
		let t = this.array[e * this.itemSize + 3];
		return this.normalized && (t = Br(t, this.array)), t;
	}
	setW(e, t) {
		return this.normalized && (t = V(t, this.array)), this.array[e * this.itemSize + 3] = t, this;
	}
	setXY(e, t, n) {
		return e *= this.itemSize, this.normalized && (t = V(t, this.array), n = V(n, this.array)), this.array[e + 0] = t, this.array[e + 1] = n, this;
	}
	setXYZ(e, t, n, r) {
		return e *= this.itemSize, this.normalized && (t = V(t, this.array), n = V(n, this.array), r = V(r, this.array)), this.array[e + 0] = t, this.array[e + 1] = n, this.array[e + 2] = r, this;
	}
	setXYZW(e, t, n, r, i) {
		return e *= this.itemSize, this.normalized && (t = V(t, this.array), n = V(n, this.array), r = V(r, this.array), i = V(i, this.array)), this.array[e + 0] = t, this.array[e + 1] = n, this.array[e + 2] = r, this.array[e + 3] = i, this;
	}
	onUpload(e) {
		return this.onUploadCallback = e, this;
	}
	clone() {
		return new this.constructor(this.array, this.itemSize).copy(this);
	}
	toJSON() {
		let e = {
			itemSize: this.itemSize,
			type: this.array.constructor.name,
			array: Array.from(this.array),
			normalized: this.normalized
		};
		return this.name !== "" && (e.name = this.name), this.usage !== 35044 && (e.usage = this.usage), e;
	}
	dispose() {
		this.dispatchEvent({ type: "dispose" });
	}
}, Ma = class extends Y {
	constructor(e, t, n) {
		super(new Int8Array(e), t, n);
	}
}, Na = class extends Y {
	constructor(e, t, n) {
		super(new Uint8Array(e), t, n);
	}
}, Pa = class extends Y {
	constructor(e, t, n) {
		super(new Uint8ClampedArray(e), t, n);
	}
}, Fa = class extends Y {
	constructor(e, t, n) {
		super(new Int16Array(e), t, n);
	}
}, Ia = class extends Y {
	constructor(e, t, n) {
		super(new Uint16Array(e), t, n);
	}
}, La = class extends Y {
	constructor(e, t, n) {
		super(new Int32Array(e), t, n);
	}
}, Ra = class extends Y {
	constructor(e, t, n) {
		super(new Uint32Array(e), t, n);
	}
}, za = class extends Y {
	constructor(e, t, n) {
		super(new Uint16Array(e), t, n), this.isFloat16BufferAttribute = !0;
	}
	getX(e) {
		let t = Da(this.array[e * this.itemSize]);
		return this.normalized && (t = Br(t, this.array)), t;
	}
	setX(e, t) {
		return this.normalized && (t = V(t, this.array)), this.array[e * this.itemSize] = Ea(t), this;
	}
	getY(e) {
		let t = Da(this.array[e * this.itemSize + 1]);
		return this.normalized && (t = Br(t, this.array)), t;
	}
	setY(e, t) {
		return this.normalized && (t = V(t, this.array)), this.array[e * this.itemSize + 1] = Ea(t), this;
	}
	getZ(e) {
		let t = Da(this.array[e * this.itemSize + 2]);
		return this.normalized && (t = Br(t, this.array)), t;
	}
	setZ(e, t) {
		return this.normalized && (t = V(t, this.array)), this.array[e * this.itemSize + 2] = Ea(t), this;
	}
	getW(e) {
		let t = Da(this.array[e * this.itemSize + 3]);
		return this.normalized && (t = Br(t, this.array)), t;
	}
	setW(e, t) {
		return this.normalized && (t = V(t, this.array)), this.array[e * this.itemSize + 3] = Ea(t), this;
	}
	setXY(e, t, n) {
		return e *= this.itemSize, this.normalized && (t = V(t, this.array), n = V(n, this.array)), this.array[e + 0] = Ea(t), this.array[e + 1] = Ea(n), this;
	}
	setXYZ(e, t, n, r) {
		return e *= this.itemSize, this.normalized && (t = V(t, this.array), n = V(n, this.array), r = V(r, this.array)), this.array[e + 0] = Ea(t), this.array[e + 1] = Ea(n), this.array[e + 2] = Ea(r), this;
	}
	setXYZW(e, t, n, r, i) {
		return e *= this.itemSize, this.normalized && (t = V(t, this.array), n = V(n, this.array), r = V(r, this.array), i = V(i, this.array)), this.array[e + 0] = Ea(t), this.array[e + 1] = Ea(n), this.array[e + 2] = Ea(r), this.array[e + 3] = Ea(i), this;
	}
}, X = class extends Y {
	constructor(e, t, n) {
		super(new Float32Array(e), t, n);
	}
}, Ba = /*@__PURE__*/ new la(), Va = /*@__PURE__*/ new U(), Ha = /*@__PURE__*/ new U(), Ua = class {
	constructor(e = new U(), t = -1) {
		this.isSphere = !0, this.center = e, this.radius = t;
	}
	set(e, t) {
		return this.center.copy(e), this.radius = t, this;
	}
	setFromPoints(e, t) {
		let n = this.center;
		t === void 0 ? Ba.setFromPoints(e).getCenter(n) : n.copy(t);
		let r = 0;
		for (let t = 0, i = e.length; t < i; t++) r = Math.max(r, n.distanceToSquared(e[t]));
		return this.radius = Math.sqrt(r), this;
	}
	copy(e) {
		return this.center.copy(e.center), this.radius = e.radius, this;
	}
	isEmpty() {
		return this.radius < 0;
	}
	makeEmpty() {
		return this.center.set(0, 0, 0), this.radius = -1, this;
	}
	containsPoint(e) {
		return e.distanceToSquared(this.center) <= this.radius * this.radius;
	}
	distanceToPoint(e) {
		return e.distanceTo(this.center) - this.radius;
	}
	intersectsSphere(e) {
		let t = this.radius + e.radius;
		return e.center.distanceToSquared(this.center) <= t * t;
	}
	intersectsBox(e) {
		return e.intersectsSphere(this);
	}
	intersectsPlane(e) {
		return Math.abs(e.distanceToPoint(this.center)) <= this.radius;
	}
	clampPoint(e, t) {
		let n = this.center.distanceToSquared(e);
		return t.copy(e), n > this.radius * this.radius && (t.sub(this.center).normalize(), t.multiplyScalar(this.radius).add(this.center)), t;
	}
	getBoundingBox(e) {
		return this.isEmpty() ? (e.makeEmpty(), e) : (e.set(this.center, this.center), e.expandByScalar(this.radius), e);
	}
	applyMatrix4(e) {
		return this.center.applyMatrix4(e), this.radius *= e.getMaxScaleOnAxis(), this;
	}
	translate(e) {
		return this.center.add(e), this;
	}
	expandByPoint(e) {
		if (this.isEmpty()) return this.center.copy(e), this.radius = 0, this;
		Va.subVectors(e, this.center);
		let t = Va.lengthSq();
		if (t > this.radius * this.radius) {
			let e = Math.sqrt(t), n = (e - this.radius) * .5;
			this.center.addScaledVector(Va, n / e), this.radius += n;
		}
		return this;
	}
	union(e) {
		return e.isEmpty() ? this : this.isEmpty() ? (this.copy(e), this) : (this.center.equals(e.center) === !0 ? this.radius = Math.max(this.radius, e.radius) : (Ha.subVectors(e.center, this.center).setLength(e.radius), this.expandByPoint(Va.copy(e.center).add(Ha)), this.expandByPoint(Va.copy(e.center).sub(Ha))), this);
	}
	equals(e) {
		return e.center.equals(this.center) && e.radius === this.radius;
	}
	clone() {
		return new this.constructor().copy(this);
	}
	toJSON() {
		return {
			radius: this.radius,
			center: this.center.toArray()
		};
	}
	fromJSON(e) {
		return this.radius = e.radius, this.center.fromArray(e.center), this;
	}
}, Wa = 0, Ga = /*@__PURE__*/ new K(), Ka = /*@__PURE__*/ new q(), qa = /*@__PURE__*/ new U(), Ja = /*@__PURE__*/ new la(), Ya = /*@__PURE__*/ new la(), Xa = /*@__PURE__*/ new U(), Z = class e extends gr {
	constructor() {
		super(), this.isBufferGeometry = !0, Object.defineProperty(this, "id", { value: Wa++ }), this.uuid = xr(), this.name = "", this.type = "BufferGeometry", this.index = null, this.indirect = null, this.indirectOffset = 0, this.attributes = {}, this.morphAttributes = {}, this.morphTargetsRelative = !1, this.groups = [], this.boundingBox = null, this.boundingSphere = null, this.drawRange = {
			start: 0,
			count: Infinity
		}, this.userData = {}, this._transformed = !1;
	}
	getIndex() {
		return this.index;
	}
	setIndex(e) {
		return Array.isArray(e) ? this.index = new (tr(e) ? Ra : Ia)(e, 1) : this.index = e, this;
	}
	setIndirect(e, t = 0) {
		return this.indirect = e, this.indirectOffset = t, this;
	}
	getIndirect() {
		return this.indirect;
	}
	getAttribute(e) {
		return this.attributes[e];
	}
	setAttribute(e, t) {
		return this.attributes[e] = t, this;
	}
	deleteAttribute(e) {
		return delete this.attributes[e], this;
	}
	hasAttribute(e) {
		return this.attributes[e] !== void 0;
	}
	addGroup(e, t, n = 0) {
		this.groups.push({
			start: e,
			count: t,
			materialIndex: n
		});
	}
	clearGroups() {
		this.groups = [];
	}
	setDrawRange(e, t) {
		this.drawRange.start = e, this.drawRange.count = t;
	}
	applyMatrix4(e) {
		let t = this.attributes.position;
		t !== void 0 && (t.applyMatrix4(e), t.needsUpdate = !0);
		let n = this.attributes.normal;
		if (n !== void 0) {
			let t = new W().getNormalMatrix(e);
			n.applyNormalMatrix(t), n.needsUpdate = !0;
		}
		let r = this.attributes.tangent;
		return r !== void 0 && (r.transformDirection(e), r.needsUpdate = !0), this.boundingBox !== null && this.computeBoundingBox(), this.boundingSphere !== null && this.computeBoundingSphere(), this._transformed = !0, this;
	}
	applyQuaternion(e) {
		return Ga.makeRotationFromQuaternion(e), this.applyMatrix4(Ga), this;
	}
	rotateX(e) {
		return Ga.makeRotationX(e), this.applyMatrix4(Ga), this;
	}
	rotateY(e) {
		return Ga.makeRotationY(e), this.applyMatrix4(Ga), this;
	}
	rotateZ(e) {
		return Ga.makeRotationZ(e), this.applyMatrix4(Ga), this;
	}
	translate(e, t, n) {
		return Ga.makeTranslation(e, t, n), this.applyMatrix4(Ga), this;
	}
	scale(e, t, n) {
		return Ga.makeScale(e, t, n), this.applyMatrix4(Ga), this;
	}
	lookAt(e) {
		return Ka.lookAt(e), Ka.updateMatrix(), this.applyMatrix4(Ka.matrix), this;
	}
	center() {
		return this.computeBoundingBox(), this.boundingBox.getCenter(qa).negate(), this.translate(qa.x, qa.y, qa.z), this;
	}
	setFromPoints(e) {
		let t = this.getAttribute("position");
		if (t === void 0) {
			let t = [];
			for (let n = 0, r = e.length; n < r; n++) {
				let r = e[n];
				t.push(r.x, r.y, r.z || 0);
			}
			this.setAttribute("position", new X(t, 3));
		} else {
			let n = Math.min(e.length, t.count);
			for (let r = 0; r < n; r++) {
				let n = e[r];
				t.setXYZ(r, n.x, n.y, n.z || 0);
			}
			e.length > t.count && R("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."), t.needsUpdate = !0;
		}
		return this;
	}
	computeBoundingBox() {
		this.boundingBox === null && (this.boundingBox = new la());
		let e = this.attributes.position, t = this.morphAttributes.position;
		if (e && e.isGLBufferAttribute) {
			z("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.", this), this.boundingBox.set(new U(-Infinity, -Infinity, -Infinity), new U(Infinity, Infinity, Infinity));
			return;
		}
		if (e !== void 0) {
			if (this.boundingBox.setFromBufferAttribute(e), t) for (let e = 0, n = t.length; e < n; e++) {
				let n = t[e];
				Ja.setFromBufferAttribute(n), this.morphTargetsRelative ? (Xa.addVectors(this.boundingBox.min, Ja.min), this.boundingBox.expandByPoint(Xa), Xa.addVectors(this.boundingBox.max, Ja.max), this.boundingBox.expandByPoint(Xa)) : (this.boundingBox.expandByPoint(Ja.min), this.boundingBox.expandByPoint(Ja.max));
			}
		} else this.boundingBox.makeEmpty();
		(isNaN(this.boundingBox.min.x) || isNaN(this.boundingBox.min.y) || isNaN(this.boundingBox.min.z)) && z("BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The \"position\" attribute is likely to have NaN values.", this);
	}
	computeBoundingSphere() {
		this.boundingSphere === null && (this.boundingSphere = new Ua());
		let e = this.attributes.position, t = this.morphAttributes.position;
		if (e && e.isGLBufferAttribute) {
			z("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.", this), this.boundingSphere.set(new U(), Infinity);
			return;
		}
		if (e) {
			let n = this.boundingSphere.center;
			if (Ja.setFromBufferAttribute(e), t) for (let e = 0, n = t.length; e < n; e++) {
				let n = t[e];
				Ya.setFromBufferAttribute(n), this.morphTargetsRelative ? (Xa.addVectors(Ja.min, Ya.min), Ja.expandByPoint(Xa), Xa.addVectors(Ja.max, Ya.max), Ja.expandByPoint(Xa)) : (Ja.expandByPoint(Ya.min), Ja.expandByPoint(Ya.max));
			}
			Ja.getCenter(n);
			let r = 0;
			for (let t = 0, i = e.count; t < i; t++) Xa.fromBufferAttribute(e, t), r = Math.max(r, n.distanceToSquared(Xa));
			if (t) for (let i = 0, a = t.length; i < a; i++) {
				let a = t[i], o = this.morphTargetsRelative;
				for (let t = 0, i = a.count; t < i; t++) Xa.fromBufferAttribute(a, t), o && (qa.fromBufferAttribute(e, t), Xa.add(qa)), r = Math.max(r, n.distanceToSquared(Xa));
			}
			this.boundingSphere.radius = Math.sqrt(r), isNaN(this.boundingSphere.radius) && z("BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The \"position\" attribute is likely to have NaN values.", this);
		}
	}
	computeTangents() {
		let e = this.index, t = this.attributes;
		if (e === null || t.position === void 0 || t.normal === void 0 || t.uv === void 0) {
			z("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");
			return;
		}
		let n = t.position, r = t.normal, i = t.uv, a = this.getAttribute("tangent");
		(a === void 0 || a.count !== n.count) && (a = new Y(new Float32Array(4 * n.count), 4), this.setAttribute("tangent", a));
		let o = [], s = [];
		for (let e = 0; e < n.count; e++) o[e] = new U(), s[e] = new U();
		let c = new U(), l = new U(), u = new U(), d = new H(), f = new H(), p = new H(), m = new U(), h = new U();
		function g(e, t, r) {
			c.fromBufferAttribute(n, e), l.fromBufferAttribute(n, t), u.fromBufferAttribute(n, r), d.fromBufferAttribute(i, e), f.fromBufferAttribute(i, t), p.fromBufferAttribute(i, r), l.sub(c), u.sub(c), f.sub(d), p.sub(d);
			let a = 1 / (f.x * p.y - p.x * f.y);
			isFinite(a) && (m.copy(l).multiplyScalar(p.y).addScaledVector(u, -f.y).multiplyScalar(a), h.copy(u).multiplyScalar(f.x).addScaledVector(l, -p.x).multiplyScalar(a), o[e].add(m), o[t].add(m), o[r].add(m), s[e].add(h), s[t].add(h), s[r].add(h));
		}
		let _ = this.groups;
		_.length === 0 && (_ = [{
			start: 0,
			count: e.count
		}]);
		for (let t = 0, n = _.length; t < n; ++t) {
			let n = _[t], r = n.start, i = n.count;
			for (let t = r, n = r + i; t < n; t += 3) g(e.getX(t + 0), e.getX(t + 1), e.getX(t + 2));
		}
		let v = new U(), y = new U(), b = new U(), x = new U();
		function S(e) {
			b.fromBufferAttribute(r, e), x.copy(b);
			let t = o[e];
			v.copy(t), v.sub(b.multiplyScalar(b.dot(t))).normalize(), y.crossVectors(x, t);
			let n = y.dot(s[e]) < 0 ? -1 : 1;
			a.setXYZW(e, v.x, v.y, v.z, n);
		}
		for (let t = 0, n = _.length; t < n; ++t) {
			let n = _[t], r = n.start, i = n.count;
			for (let t = r, n = r + i; t < n; t += 3) S(e.getX(t + 0)), S(e.getX(t + 1)), S(e.getX(t + 2));
		}
		this._transformed = !0;
	}
	computeVertexNormals() {
		let e = this.index, t = this.getAttribute("position");
		if (t !== void 0) {
			let n = this.getAttribute("normal");
			if (n === void 0 || n.count !== t.count) n = new Y(new Float32Array(t.count * 3), 3), this.setAttribute("normal", n);
			else for (let e = 0, t = n.count; e < t; e++) n.setXYZ(e, 0, 0, 0);
			let r = new U(), i = new U(), a = new U(), o = new U(), s = new U(), c = new U(), l = new U(), u = new U();
			if (e) for (let d = 0, f = e.count; d < f; d += 3) {
				let f = e.getX(d + 0), p = e.getX(d + 1), m = e.getX(d + 2);
				r.fromBufferAttribute(t, f), i.fromBufferAttribute(t, p), a.fromBufferAttribute(t, m), l.subVectors(a, i), u.subVectors(r, i), l.cross(u), o.fromBufferAttribute(n, f), s.fromBufferAttribute(n, p), c.fromBufferAttribute(n, m), o.add(l), s.add(l), c.add(l), n.setXYZ(f, o.x, o.y, o.z), n.setXYZ(p, s.x, s.y, s.z), n.setXYZ(m, c.x, c.y, c.z);
			}
			else for (let e = 0, o = t.count; e < o; e += 3) r.fromBufferAttribute(t, e + 0), i.fromBufferAttribute(t, e + 1), a.fromBufferAttribute(t, e + 2), l.subVectors(a, i), u.subVectors(r, i), l.cross(u), n.setXYZ(e + 0, l.x, l.y, l.z), n.setXYZ(e + 1, l.x, l.y, l.z), n.setXYZ(e + 2, l.x, l.y, l.z);
			this.normalizeNormals(), n.needsUpdate = !0;
		}
	}
	normalizeNormals() {
		let e = this.attributes.normal;
		for (let t = 0, n = e.count; t < n; t++) Xa.fromBufferAttribute(e, t), Xa.normalize(), e.setXYZ(t, Xa.x, Xa.y, Xa.z);
	}
	toNonIndexed() {
		function t(e, t) {
			let n = e.array, r = e.itemSize, i = e.normalized, a = new n.constructor(t.length * r), o = 0, s = 0;
			for (let i = 0, c = t.length; i < c; i++) {
				o = e.isInterleavedBufferAttribute ? t[i] * e.data.stride + e.offset : t[i] * r;
				for (let e = 0; e < r; e++) a[s++] = n[o++];
			}
			return new Y(a, r, i);
		}
		if (this.index === null) return R("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."), this;
		let n = new e(), r = this.index.array, i = this.attributes;
		for (let e in i) {
			let a = i[e], o = t(a, r);
			n.setAttribute(e, o);
		}
		let a = this.morphAttributes;
		for (let e in a) {
			let i = [], o = a[e];
			for (let e = 0, n = o.length; e < n; e++) {
				let n = o[e], a = t(n, r);
				i.push(a);
			}
			n.morphAttributes[e] = i;
		}
		n.morphTargetsRelative = this.morphTargetsRelative;
		let o = this.groups;
		for (let e = 0, t = o.length; e < t; e++) {
			let t = o[e];
			n.addGroup(t.start, t.count, t.materialIndex);
		}
		return n;
	}
	toJSON() {
		let e = { metadata: {
			version: 4.7,
			type: "BufferGeometry",
			generator: "BufferGeometry.toJSON"
		} };
		if (e.uuid = this.uuid, e.type = this.parameters !== void 0 && this._transformed === !0 ? "BufferGeometry" : this.type, this.name !== "" && (e.name = this.name), Object.keys(this.userData).length > 0 && (e.userData = this.userData), this.parameters !== void 0 && this._transformed !== !0) {
			let t = this.parameters;
			for (let n in t) t[n] !== void 0 && (e[n] = t[n]);
			return e;
		}
		e.data = { attributes: {} };
		let t = this.index;
		t !== null && (e.data.index = {
			type: t.array.constructor.name,
			array: Array.prototype.slice.call(t.array)
		});
		let n = this.attributes;
		for (let t in n) {
			let r = n[t];
			e.data.attributes[t] = r.toJSON(e.data);
		}
		let r = {}, i = !1;
		for (let t in this.morphAttributes) {
			let n = this.morphAttributes[t], a = [];
			for (let t = 0, r = n.length; t < r; t++) {
				let r = n[t];
				a.push(r.toJSON(e.data));
			}
			a.length > 0 && (r[t] = a, i = !0);
		}
		i && (e.data.morphAttributes = r, e.data.morphTargetsRelative = this.morphTargetsRelative);
		let a = this.groups;
		a.length > 0 && (e.data.groups = JSON.parse(JSON.stringify(a)));
		let o = this.boundingSphere;
		return o !== null && (e.data.boundingSphere = o.toJSON()), e;
	}
	clone() {
		return new this.constructor().copy(this);
	}
	copy(e) {
		this.index = null, this.attributes = {}, this.morphAttributes = {}, this.groups = [], this.boundingBox = null, this.boundingSphere = null;
		let t = {};
		this.name = e.name;
		let n = e.index;
		n !== null && this.setIndex(n.clone());
		let r = e.attributes;
		for (let e in r) {
			let n = r[e];
			this.setAttribute(e, n.clone(t));
		}
		let i = e.morphAttributes;
		for (let e in i) {
			let n = [], r = i[e];
			for (let e = 0, i = r.length; e < i; e++) n.push(r[e].clone(t));
			this.morphAttributes[e] = n;
		}
		this.morphTargetsRelative = e.morphTargetsRelative;
		let a = e.groups;
		for (let e = 0, t = a.length; e < t; e++) {
			let t = a[e];
			this.addGroup(t.start, t.count, t.materialIndex);
		}
		let o = e.boundingBox;
		o !== null && (this.boundingBox = o.clone());
		let s = e.boundingSphere;
		return s !== null && (this.boundingSphere = s.clone()), this.drawRange.start = e.drawRange.start, this.drawRange.count = e.drawRange.count, this.userData = e.userData, this._transformed = e._transformed, this;
	}
	dispose() {
		this.dispatchEvent({ type: "dispose" });
	}
}, Za = class {
	constructor(e, t) {
		this.isInterleavedBuffer = !0, this.array = e, this.stride = t, this.count = e === void 0 ? 0 : e.length / t, this.usage = zn, this.updateRanges = [], this.version = 0, this.uuid = xr();
	}
	onUploadCallback() {}
	set needsUpdate(e) {
		e === !0 && this.version++;
	}
	setUsage(e) {
		return this.usage = e, this;
	}
	addUpdateRange(e, t) {
		this.updateRanges.push({
			start: e,
			count: t
		});
	}
	clearUpdateRanges() {
		this.updateRanges.length = 0;
	}
	copy(e) {
		return this.array = new e.array.constructor(e.array), this.count = e.count, this.stride = e.stride, this.usage = e.usage, this;
	}
	copyAt(e, t, n) {
		e *= this.stride, n *= t.stride;
		for (let r = 0, i = this.stride; r < i; r++) this.array[e + r] = t.array[n + r];
		return this;
	}
	set(e, t = 0) {
		return this.array.set(e, t), this;
	}
	clone(e) {
		e.arrayBuffers === void 0 && (e.arrayBuffers = {}), this.array.buffer._uuid === void 0 && (this.array.buffer._uuid = xr()), e.arrayBuffers[this.array.buffer._uuid] === void 0 && (e.arrayBuffers[this.array.buffer._uuid] = this.array.slice(0).buffer);
		let t = new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]), n = new this.constructor(t, this.stride);
		return n.setUsage(this.usage), n;
	}
	onUpload(e) {
		return this.onUploadCallback = e, this;
	}
	toJSON(e) {
		return e.arrayBuffers === void 0 && (e.arrayBuffers = {}), this.array.buffer._uuid === void 0 && (this.array.buffer._uuid = xr()), e.arrayBuffers[this.array.buffer._uuid] === void 0 && (e.arrayBuffers[this.array.buffer._uuid] = Array.from(new Uint32Array(this.array.buffer))), {
			uuid: this.uuid,
			buffer: this.array.buffer._uuid,
			type: this.array.constructor.name,
			stride: this.stride
		};
	}
}, Qa = /*@__PURE__*/ new U(), $a = class e {
	constructor(e, t, n, r = !1) {
		this.isInterleavedBufferAttribute = !0, this.name = "", this.data = e, this.itemSize = t, this.offset = n, this.normalized = r;
	}
	get count() {
		return this.data.count;
	}
	get array() {
		return this.data.array;
	}
	set needsUpdate(e) {
		this.data.needsUpdate = e;
	}
	applyMatrix4(e) {
		for (let t = 0, n = this.data.count; t < n; t++) Qa.fromBufferAttribute(this, t), Qa.applyMatrix4(e), this.setXYZ(t, Qa.x, Qa.y, Qa.z);
		return this;
	}
	applyNormalMatrix(e) {
		for (let t = 0, n = this.count; t < n; t++) Qa.fromBufferAttribute(this, t), Qa.applyNormalMatrix(e), this.setXYZ(t, Qa.x, Qa.y, Qa.z);
		return this;
	}
	transformDirection(e) {
		for (let t = 0, n = this.count; t < n; t++) Qa.fromBufferAttribute(this, t), Qa.transformDirection(e), this.setXYZ(t, Qa.x, Qa.y, Qa.z);
		return this;
	}
	getComponent(e, t) {
		let n = this.array[e * this.data.stride + this.offset + t];
		return this.normalized && (n = Br(n, this.array)), n;
	}
	setComponent(e, t, n) {
		return this.normalized && (n = V(n, this.array)), this.data.array[e * this.data.stride + this.offset + t] = n, this;
	}
	setX(e, t) {
		return this.normalized && (t = V(t, this.array)), this.data.array[e * this.data.stride + this.offset] = t, this;
	}
	setY(e, t) {
		return this.normalized && (t = V(t, this.array)), this.data.array[e * this.data.stride + this.offset + 1] = t, this;
	}
	setZ(e, t) {
		return this.normalized && (t = V(t, this.array)), this.data.array[e * this.data.stride + this.offset + 2] = t, this;
	}
	setW(e, t) {
		return this.normalized && (t = V(t, this.array)), this.data.array[e * this.data.stride + this.offset + 3] = t, this;
	}
	getX(e) {
		let t = this.data.array[e * this.data.stride + this.offset];
		return this.normalized && (t = Br(t, this.array)), t;
	}
	getY(e) {
		let t = this.data.array[e * this.data.stride + this.offset + 1];
		return this.normalized && (t = Br(t, this.array)), t;
	}
	getZ(e) {
		let t = this.data.array[e * this.data.stride + this.offset + 2];
		return this.normalized && (t = Br(t, this.array)), t;
	}
	getW(e) {
		let t = this.data.array[e * this.data.stride + this.offset + 3];
		return this.normalized && (t = Br(t, this.array)), t;
	}
	setXY(e, t, n) {
		return e = e * this.data.stride + this.offset, this.normalized && (t = V(t, this.array), n = V(n, this.array)), this.data.array[e + 0] = t, this.data.array[e + 1] = n, this;
	}
	setXYZ(e, t, n, r) {
		return e = e * this.data.stride + this.offset, this.normalized && (t = V(t, this.array), n = V(n, this.array), r = V(r, this.array)), this.data.array[e + 0] = t, this.data.array[e + 1] = n, this.data.array[e + 2] = r, this;
	}
	setXYZW(e, t, n, r, i) {
		return e = e * this.data.stride + this.offset, this.normalized && (t = V(t, this.array), n = V(n, this.array), r = V(r, this.array), i = V(i, this.array)), this.data.array[e + 0] = t, this.data.array[e + 1] = n, this.data.array[e + 2] = r, this.data.array[e + 3] = i, this;
	}
	clone(t) {
		if (t === void 0) {
			dr("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");
			let e = [];
			for (let t = 0; t < this.count; t++) {
				let n = t * this.data.stride + this.offset;
				for (let t = 0; t < this.itemSize; t++) e.push(this.data.array[n + t]);
			}
			return new Y(new this.array.constructor(e), this.itemSize, this.normalized);
		} else return t.interleavedBuffers === void 0 && (t.interleavedBuffers = {}), t.interleavedBuffers[this.data.uuid] === void 0 && (t.interleavedBuffers[this.data.uuid] = this.data.clone(t)), new e(t.interleavedBuffers[this.data.uuid], this.itemSize, this.offset, this.normalized);
	}
	toJSON(e) {
		if (e === void 0) {
			dr("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");
			let e = [];
			for (let t = 0; t < this.count; t++) {
				let n = t * this.data.stride + this.offset;
				for (let t = 0; t < this.itemSize; t++) e.push(this.data.array[n + t]);
			}
			return {
				itemSize: this.itemSize,
				type: this.array.constructor.name,
				array: e,
				normalized: this.normalized
			};
		} else return e.interleavedBuffers === void 0 && (e.interleavedBuffers = {}), e.interleavedBuffers[this.data.uuid] === void 0 && (e.interleavedBuffers[this.data.uuid] = this.data.toJSON(e)), {
			isInterleavedBufferAttribute: !0,
			itemSize: this.itemSize,
			data: this.data.uuid,
			offset: this.offset,
			normalized: this.normalized
		};
	}
}, eo = 0, to = class extends gr {
	constructor() {
		super(), this.isMaterial = !0, Object.defineProperty(this, "id", { value: eo++ }), this.uuid = xr(), this.name = "", this.type = "Material", this.blending = 1, this.side = 0, this.vertexColors = !1, this.opacity = 1, this.transparent = !1, this.alphaHash = !1, this.blendSrc = 204, this.blendDst = 205, this.blendEquation = 100, this.blendSrcAlpha = null, this.blendDstAlpha = null, this.blendEquationAlpha = null, this.blendColor = new J(0, 0, 0), this.blendAlpha = 0, this.depthFunc = 3, this.depthTest = !0, this.depthWrite = !0, this.stencilWriteMask = 255, this.stencilFunc = 519, this.stencilRef = 0, this.stencilFuncMask = 255, this.stencilFail = Mn, this.stencilZFail = Mn, this.stencilZPass = Mn, this.stencilWrite = !1, this.clippingPlanes = null, this.clipIntersection = !1, this.clipShadows = !1, this.shadowSide = null, this.colorWrite = !0, this.precision = null, this.polygonOffset = !1, this.polygonOffsetFactor = 0, this.polygonOffsetUnits = 0, this.dithering = !1, this.alphaToCoverage = !1, this.premultipliedAlpha = !1, this.forceSinglePass = !1, this.allowOverride = !0, this.visible = !0, this.toneMapped = !0, this.userData = {}, this.version = 0, this._alphaTest = 0;
	}
	get alphaTest() {
		return this._alphaTest;
	}
	set alphaTest(e) {
		this._alphaTest > 0 != e > 0 && this.version++, this._alphaTest = e;
	}
	onBeforeRender() {}
	onBeforeCompile() {}
	customProgramCacheKey() {
		return this.onBeforeCompile.toString();
	}
	setValues(e) {
		if (e !== void 0) for (let t in e) {
			let n = e[t];
			if (n === void 0) {
				R(`Material: parameter '${t}' has value of undefined.`);
				continue;
			}
			let r = this[t];
			if (r === void 0) {
				R(`Material: '${t}' is not a property of THREE.${this.type}.`);
				continue;
			}
			r && r.isColor ? r.set(n) : r && r.isVector2 && n && n.isVector2 || r && r.isEuler && n && n.isEuler || r && r.isVector3 && n && n.isVector3 ? r.copy(n) : this[t] = n;
		}
	}
	toJSON(e) {
		let t = e === void 0 || typeof e == "string";
		t && (e = {
			textures: {},
			images: {}
		});
		let n = { metadata: {
			version: 4.7,
			type: "Material",
			generator: "Material.toJSON"
		} };
		n.uuid = this.uuid, n.type = this.type, this.name !== "" && (n.name = this.name), this.color && this.color.isColor && (n.color = this.color.getHex()), this.roughness !== void 0 && (n.roughness = this.roughness), this.metalness !== void 0 && (n.metalness = this.metalness), this.sheen !== void 0 && (n.sheen = this.sheen), this.sheenColor && this.sheenColor.isColor && (n.sheenColor = this.sheenColor.getHex()), this.sheenRoughness !== void 0 && (n.sheenRoughness = this.sheenRoughness), this.emissive && this.emissive.isColor && (n.emissive = this.emissive.getHex()), this.emissiveIntensity !== void 0 && this.emissiveIntensity !== 1 && (n.emissiveIntensity = this.emissiveIntensity), this.specular && this.specular.isColor && (n.specular = this.specular.getHex()), this.specularIntensity !== void 0 && (n.specularIntensity = this.specularIntensity), this.specularColor && this.specularColor.isColor && (n.specularColor = this.specularColor.getHex()), this.shininess !== void 0 && (n.shininess = this.shininess), this.clearcoat !== void 0 && (n.clearcoat = this.clearcoat), this.clearcoatRoughness !== void 0 && (n.clearcoatRoughness = this.clearcoatRoughness), this.clearcoatMap && this.clearcoatMap.isTexture && (n.clearcoatMap = this.clearcoatMap.toJSON(e).uuid), this.clearcoatRoughnessMap && this.clearcoatRoughnessMap.isTexture && (n.clearcoatRoughnessMap = this.clearcoatRoughnessMap.toJSON(e).uuid), this.clearcoatNormalMap && this.clearcoatNormalMap.isTexture && (n.clearcoatNormalMap = this.clearcoatNormalMap.toJSON(e).uuid, n.clearcoatNormalScale = this.clearcoatNormalScale.toArray()), this.sheenColorMap && this.sheenColorMap.isTexture && (n.sheenColorMap = this.sheenColorMap.toJSON(e).uuid), this.sheenRoughnessMap && this.sheenRoughnessMap.isTexture && (n.sheenRoughnessMap = this.sheenRoughnessMap.toJSON(e).uuid), this.dispersion !== void 0 && (n.dispersion = this.dispersion), this.iridescence !== void 0 && (n.iridescence = this.iridescence), this.iridescenceIOR !== void 0 && (n.iridescenceIOR = this.iridescenceIOR), this.iridescenceThicknessRange !== void 0 && (n.iridescenceThicknessRange = this.iridescenceThicknessRange), this.iridescenceMap && this.iridescenceMap.isTexture && (n.iridescenceMap = this.iridescenceMap.toJSON(e).uuid), this.iridescenceThicknessMap && this.iridescenceThicknessMap.isTexture && (n.iridescenceThicknessMap = this.iridescenceThicknessMap.toJSON(e).uuid), this.anisotropy !== void 0 && (n.anisotropy = this.anisotropy), this.anisotropyRotation !== void 0 && (n.anisotropyRotation = this.anisotropyRotation), this.anisotropyMap && this.anisotropyMap.isTexture && (n.anisotropyMap = this.anisotropyMap.toJSON(e).uuid), this.map && this.map.isTexture && (n.map = this.map.toJSON(e).uuid), this.matcap && this.matcap.isTexture && (n.matcap = this.matcap.toJSON(e).uuid), this.alphaMap && this.alphaMap.isTexture && (n.alphaMap = this.alphaMap.toJSON(e).uuid), this.lightMap && this.lightMap.isTexture && (n.lightMap = this.lightMap.toJSON(e).uuid, n.lightMapIntensity = this.lightMapIntensity), this.aoMap && this.aoMap.isTexture && (n.aoMap = this.aoMap.toJSON(e).uuid, n.aoMapIntensity = this.aoMapIntensity), this.bumpMap && this.bumpMap.isTexture && (n.bumpMap = this.bumpMap.toJSON(e).uuid, n.bumpScale = this.bumpScale), this.normalMap && this.normalMap.isTexture && (n.normalMap = this.normalMap.toJSON(e).uuid, n.normalMapType = this.normalMapType, n.normalScale = this.normalScale.toArray()), this.displacementMap && this.displacementMap.isTexture && (n.displacementMap = this.displacementMap.toJSON(e).uuid, n.displacementScale = this.displacementScale, n.displacementBias = this.displacementBias), this.roughnessMap && this.roughnessMap.isTexture && (n.roughnessMap = this.roughnessMap.toJSON(e).uuid), this.metalnessMap && this.metalnessMap.isTexture && (n.metalnessMap = this.metalnessMap.toJSON(e).uuid), this.emissiveMap && this.emissiveMap.isTexture && (n.emissiveMap = this.emissiveMap.toJSON(e).uuid), this.specularMap && this.specularMap.isTexture && (n.specularMap = this.specularMap.toJSON(e).uuid), this.specularIntensityMap && this.specularIntensityMap.isTexture && (n.specularIntensityMap = this.specularIntensityMap.toJSON(e).uuid), this.specularColorMap && this.specularColorMap.isTexture && (n.specularColorMap = this.specularColorMap.toJSON(e).uuid), this.envMap && this.envMap.isTexture && (n.envMap = this.envMap.toJSON(e).uuid, this.combine !== void 0 && (n.combine = this.combine)), this.envMapRotation !== void 0 && (n.envMapRotation = this.envMapRotation.toArray()), this.envMapIntensity !== void 0 && (n.envMapIntensity = this.envMapIntensity), this.reflectivity !== void 0 && (n.reflectivity = this.reflectivity), this.refractionRatio !== void 0 && (n.refractionRatio = this.refractionRatio), this.gradientMap && this.gradientMap.isTexture && (n.gradientMap = this.gradientMap.toJSON(e).uuid), this.transmission !== void 0 && (n.transmission = this.transmission), this.transmissionMap && this.transmissionMap.isTexture && (n.transmissionMap = this.transmissionMap.toJSON(e).uuid), this.thickness !== void 0 && (n.thickness = this.thickness), this.thicknessMap && this.thicknessMap.isTexture && (n.thicknessMap = this.thicknessMap.toJSON(e).uuid), this.attenuationDistance !== void 0 && this.attenuationDistance !== Infinity && (n.attenuationDistance = this.attenuationDistance), this.attenuationColor !== void 0 && (n.attenuationColor = this.attenuationColor.getHex()), this.size !== void 0 && (n.size = this.size), this.shadowSide !== null && (n.shadowSide = this.shadowSide), this.sizeAttenuation !== void 0 && (n.sizeAttenuation = this.sizeAttenuation), this.blending !== 1 && (n.blending = this.blending), this.side !== 0 && (n.side = this.side), this.vertexColors === !0 && (n.vertexColors = !0), this.opacity < 1 && (n.opacity = this.opacity), this.transparent === !0 && (n.transparent = !0), this.blendSrc !== 204 && (n.blendSrc = this.blendSrc), this.blendDst !== 205 && (n.blendDst = this.blendDst), this.blendEquation !== 100 && (n.blendEquation = this.blendEquation), this.blendSrcAlpha !== null && (n.blendSrcAlpha = this.blendSrcAlpha), this.blendDstAlpha !== null && (n.blendDstAlpha = this.blendDstAlpha), this.blendEquationAlpha !== null && (n.blendEquationAlpha = this.blendEquationAlpha), this.blendColor && this.blendColor.isColor && (n.blendColor = this.blendColor.getHex()), this.blendAlpha !== 0 && (n.blendAlpha = this.blendAlpha), this.depthFunc !== 3 && (n.depthFunc = this.depthFunc), this.depthTest === !1 && (n.depthTest = this.depthTest), this.depthWrite === !1 && (n.depthWrite = this.depthWrite), this.colorWrite === !1 && (n.colorWrite = this.colorWrite), this.stencilWriteMask !== 255 && (n.stencilWriteMask = this.stencilWriteMask), this.stencilFunc !== 519 && (n.stencilFunc = this.stencilFunc), this.stencilRef !== 0 && (n.stencilRef = this.stencilRef), this.stencilFuncMask !== 255 && (n.stencilFuncMask = this.stencilFuncMask), this.stencilFail !== 7680 && (n.stencilFail = this.stencilFail), this.stencilZFail !== 7680 && (n.stencilZFail = this.stencilZFail), this.stencilZPass !== 7680 && (n.stencilZPass = this.stencilZPass), this.stencilWrite === !0 && (n.stencilWrite = this.stencilWrite), this.rotation !== void 0 && this.rotation !== 0 && (n.rotation = this.rotation), this.polygonOffset === !0 && (n.polygonOffset = !0), this.polygonOffsetFactor !== 0 && (n.polygonOffsetFactor = this.polygonOffsetFactor), this.polygonOffsetUnits !== 0 && (n.polygonOffsetUnits = this.polygonOffsetUnits), this.linewidth !== void 0 && this.linewidth !== 1 && (n.linewidth = this.linewidth), this.dashSize !== void 0 && (n.dashSize = this.dashSize), this.gapSize !== void 0 && (n.gapSize = this.gapSize), this.scale !== void 0 && (n.scale = this.scale), this.dithering === !0 && (n.dithering = !0), this.alphaTest > 0 && (n.alphaTest = this.alphaTest), this.alphaHash === !0 && (n.alphaHash = !0), this.alphaToCoverage === !0 && (n.alphaToCoverage = !0), this.premultipliedAlpha === !0 && (n.premultipliedAlpha = !0), this.forceSinglePass === !0 && (n.forceSinglePass = !0), this.allowOverride === !1 && (n.allowOverride = !1), this.wireframe === !0 && (n.wireframe = !0), this.wireframeLinewidth > 1 && (n.wireframeLinewidth = this.wireframeLinewidth), this.wireframeLinecap !== "round" && (n.wireframeLinecap = this.wireframeLinecap), this.wireframeLinejoin !== "round" && (n.wireframeLinejoin = this.wireframeLinejoin), this.flatShading === !0 && (n.flatShading = !0), this.visible === !1 && (n.visible = !1), this.toneMapped === !1 && (n.toneMapped = !1), this.fog === !1 && (n.fog = !1), Object.keys(this.userData).length > 0 && (n.userData = this.userData);
		function r(e) {
			let t = [];
			for (let n in e) {
				let r = e[n];
				delete r.metadata, t.push(r);
			}
			return t;
		}
		if (t) {
			let t = r(e.textures), i = r(e.images);
			t.length > 0 && (n.textures = t), i.length > 0 && (n.images = i);
		}
		return n;
	}
	fromJSON(e, t) {
		if (e.uuid !== void 0 && (this.uuid = e.uuid), e.name !== void 0 && (this.name = e.name), e.color !== void 0 && this.color !== void 0 && this.color.setHex(e.color), e.roughness !== void 0 && (this.roughness = e.roughness), e.metalness !== void 0 && (this.metalness = e.metalness), e.sheen !== void 0 && (this.sheen = e.sheen), e.sheenColor !== void 0 && (this.sheenColor = new J().setHex(e.sheenColor)), e.sheenRoughness !== void 0 && (this.sheenRoughness = e.sheenRoughness), e.emissive !== void 0 && this.emissive !== void 0 && this.emissive.setHex(e.emissive), e.specular !== void 0 && this.specular !== void 0 && this.specular.setHex(e.specular), e.specularIntensity !== void 0 && (this.specularIntensity = e.specularIntensity), e.specularColor !== void 0 && this.specularColor !== void 0 && this.specularColor.setHex(e.specularColor), e.shininess !== void 0 && (this.shininess = e.shininess), e.clearcoat !== void 0 && (this.clearcoat = e.clearcoat), e.clearcoatRoughness !== void 0 && (this.clearcoatRoughness = e.clearcoatRoughness), e.dispersion !== void 0 && (this.dispersion = e.dispersion), e.iridescence !== void 0 && (this.iridescence = e.iridescence), e.iridescenceIOR !== void 0 && (this.iridescenceIOR = e.iridescenceIOR), e.iridescenceThicknessRange !== void 0 && (this.iridescenceThicknessRange = e.iridescenceThicknessRange), e.transmission !== void 0 && (this.transmission = e.transmission), e.thickness !== void 0 && (this.thickness = e.thickness), e.attenuationDistance !== void 0 && (this.attenuationDistance = e.attenuationDistance), e.attenuationColor !== void 0 && this.attenuationColor !== void 0 && this.attenuationColor.setHex(e.attenuationColor), e.anisotropy !== void 0 && (this.anisotropy = e.anisotropy), e.anisotropyRotation !== void 0 && (this.anisotropyRotation = e.anisotropyRotation), e.fog !== void 0 && (this.fog = e.fog), e.flatShading !== void 0 && (this.flatShading = e.flatShading), e.blending !== void 0 && (this.blending = e.blending), e.combine !== void 0 && (this.combine = e.combine), e.side !== void 0 && (this.side = e.side), e.shadowSide !== void 0 && (this.shadowSide = e.shadowSide), e.opacity !== void 0 && (this.opacity = e.opacity), e.transparent !== void 0 && (this.transparent = e.transparent), e.alphaTest !== void 0 && (this.alphaTest = e.alphaTest), e.alphaHash !== void 0 && (this.alphaHash = e.alphaHash), e.depthFunc !== void 0 && (this.depthFunc = e.depthFunc), e.depthTest !== void 0 && (this.depthTest = e.depthTest), e.depthWrite !== void 0 && (this.depthWrite = e.depthWrite), e.colorWrite !== void 0 && (this.colorWrite = e.colorWrite), e.blendSrc !== void 0 && (this.blendSrc = e.blendSrc), e.blendDst !== void 0 && (this.blendDst = e.blendDst), e.blendEquation !== void 0 && (this.blendEquation = e.blendEquation), e.blendSrcAlpha !== void 0 && (this.blendSrcAlpha = e.blendSrcAlpha), e.blendDstAlpha !== void 0 && (this.blendDstAlpha = e.blendDstAlpha), e.blendEquationAlpha !== void 0 && (this.blendEquationAlpha = e.blendEquationAlpha), e.blendColor !== void 0 && this.blendColor !== void 0 && this.blendColor.setHex(e.blendColor), e.blendAlpha !== void 0 && (this.blendAlpha = e.blendAlpha), e.stencilWriteMask !== void 0 && (this.stencilWriteMask = e.stencilWriteMask), e.stencilFunc !== void 0 && (this.stencilFunc = e.stencilFunc), e.stencilRef !== void 0 && (this.stencilRef = e.stencilRef), e.stencilFuncMask !== void 0 && (this.stencilFuncMask = e.stencilFuncMask), e.stencilFail !== void 0 && (this.stencilFail = e.stencilFail), e.stencilZFail !== void 0 && (this.stencilZFail = e.stencilZFail), e.stencilZPass !== void 0 && (this.stencilZPass = e.stencilZPass), e.stencilWrite !== void 0 && (this.stencilWrite = e.stencilWrite), e.wireframe !== void 0 && (this.wireframe = e.wireframe), e.wireframeLinewidth !== void 0 && (this.wireframeLinewidth = e.wireframeLinewidth), e.wireframeLinecap !== void 0 && (this.wireframeLinecap = e.wireframeLinecap), e.wireframeLinejoin !== void 0 && (this.wireframeLinejoin = e.wireframeLinejoin), e.rotation !== void 0 && (this.rotation = e.rotation), e.linewidth !== void 0 && (this.linewidth = e.linewidth), e.dashSize !== void 0 && (this.dashSize = e.dashSize), e.gapSize !== void 0 && (this.gapSize = e.gapSize), e.scale !== void 0 && (this.scale = e.scale), e.polygonOffset !== void 0 && (this.polygonOffset = e.polygonOffset), e.polygonOffsetFactor !== void 0 && (this.polygonOffsetFactor = e.polygonOffsetFactor), e.polygonOffsetUnits !== void 0 && (this.polygonOffsetUnits = e.polygonOffsetUnits), e.dithering !== void 0 && (this.dithering = e.dithering), e.alphaToCoverage !== void 0 && (this.alphaToCoverage = e.alphaToCoverage), e.premultipliedAlpha !== void 0 && (this.premultipliedAlpha = e.premultipliedAlpha), e.forceSinglePass !== void 0 && (this.forceSinglePass = e.forceSinglePass), e.allowOverride !== void 0 && (this.allowOverride = e.allowOverride), e.visible !== void 0 && (this.visible = e.visible), e.toneMapped !== void 0 && (this.toneMapped = e.toneMapped), e.userData !== void 0 && (this.userData = e.userData), e.vertexColors !== void 0 && (typeof e.vertexColors == "number" ? this.vertexColors = e.vertexColors > 0 : this.vertexColors = e.vertexColors), e.size !== void 0 && (this.size = e.size), e.sizeAttenuation !== void 0 && (this.sizeAttenuation = e.sizeAttenuation), e.map !== void 0 && (this.map = t[e.map] || null), e.matcap !== void 0 && (this.matcap = t[e.matcap] || null), e.alphaMap !== void 0 && (this.alphaMap = t[e.alphaMap] || null), e.bumpMap !== void 0 && (this.bumpMap = t[e.bumpMap] || null), e.bumpScale !== void 0 && (this.bumpScale = e.bumpScale), e.normalMap !== void 0 && (this.normalMap = t[e.normalMap] || null), e.normalMapType !== void 0 && (this.normalMapType = e.normalMapType), e.normalScale !== void 0) {
			let t = e.normalScale;
			Array.isArray(t) === !1 && (t = [t, t]), this.normalScale = new H().fromArray(t);
		}
		return e.displacementMap !== void 0 && (this.displacementMap = t[e.displacementMap] || null), e.displacementScale !== void 0 && (this.displacementScale = e.displacementScale), e.displacementBias !== void 0 && (this.displacementBias = e.displacementBias), e.roughnessMap !== void 0 && (this.roughnessMap = t[e.roughnessMap] || null), e.metalnessMap !== void 0 && (this.metalnessMap = t[e.metalnessMap] || null), e.emissiveMap !== void 0 && (this.emissiveMap = t[e.emissiveMap] || null), e.emissiveIntensity !== void 0 && (this.emissiveIntensity = e.emissiveIntensity), e.specularMap !== void 0 && (this.specularMap = t[e.specularMap] || null), e.specularIntensityMap !== void 0 && (this.specularIntensityMap = t[e.specularIntensityMap] || null), e.specularColorMap !== void 0 && (this.specularColorMap = t[e.specularColorMap] || null), e.envMap !== void 0 && (this.envMap = t[e.envMap] || null), e.envMapRotation !== void 0 && this.envMapRotation.fromArray(e.envMapRotation), e.envMapIntensity !== void 0 && (this.envMapIntensity = e.envMapIntensity), e.reflectivity !== void 0 && (this.reflectivity = e.reflectivity), e.refractionRatio !== void 0 && (this.refractionRatio = e.refractionRatio), e.lightMap !== void 0 && (this.lightMap = t[e.lightMap] || null), e.lightMapIntensity !== void 0 && (this.lightMapIntensity = e.lightMapIntensity), e.aoMap !== void 0 && (this.aoMap = t[e.aoMap] || null), e.aoMapIntensity !== void 0 && (this.aoMapIntensity = e.aoMapIntensity), e.gradientMap !== void 0 && (this.gradientMap = t[e.gradientMap] || null), e.clearcoatMap !== void 0 && (this.clearcoatMap = t[e.clearcoatMap] || null), e.clearcoatRoughnessMap !== void 0 && (this.clearcoatRoughnessMap = t[e.clearcoatRoughnessMap] || null), e.clearcoatNormalMap !== void 0 && (this.clearcoatNormalMap = t[e.clearcoatNormalMap] || null), e.clearcoatNormalScale !== void 0 && (this.clearcoatNormalScale = new H().fromArray(e.clearcoatNormalScale)), e.iridescenceMap !== void 0 && (this.iridescenceMap = t[e.iridescenceMap] || null), e.iridescenceThicknessMap !== void 0 && (this.iridescenceThicknessMap = t[e.iridescenceThicknessMap] || null), e.transmissionMap !== void 0 && (this.transmissionMap = t[e.transmissionMap] || null), e.thicknessMap !== void 0 && (this.thicknessMap = t[e.thicknessMap] || null), e.anisotropyMap !== void 0 && (this.anisotropyMap = t[e.anisotropyMap] || null), e.sheenColorMap !== void 0 && (this.sheenColorMap = t[e.sheenColorMap] || null), e.sheenRoughnessMap !== void 0 && (this.sheenRoughnessMap = t[e.sheenRoughnessMap] || null), this;
	}
	clone() {
		return new this.constructor().copy(this);
	}
	copy(e) {
		this.name = e.name, this.blending = e.blending, this.side = e.side, this.vertexColors = e.vertexColors, this.opacity = e.opacity, this.transparent = e.transparent, this.blendSrc = e.blendSrc, this.blendDst = e.blendDst, this.blendEquation = e.blendEquation, this.blendSrcAlpha = e.blendSrcAlpha, this.blendDstAlpha = e.blendDstAlpha, this.blendEquationAlpha = e.blendEquationAlpha, this.blendColor.copy(e.blendColor), this.blendAlpha = e.blendAlpha, this.depthFunc = e.depthFunc, this.depthTest = e.depthTest, this.depthWrite = e.depthWrite, this.stencilWriteMask = e.stencilWriteMask, this.stencilFunc = e.stencilFunc, this.stencilRef = e.stencilRef, this.stencilFuncMask = e.stencilFuncMask, this.stencilFail = e.stencilFail, this.stencilZFail = e.stencilZFail, this.stencilZPass = e.stencilZPass, this.stencilWrite = e.stencilWrite;
		let t = e.clippingPlanes, n = null;
		if (t !== null) {
			let e = t.length;
			n = Array(e);
			for (let r = 0; r !== e; ++r) n[r] = t[r].clone();
		}
		return this.clippingPlanes = n, this.clipIntersection = e.clipIntersection, this.clipShadows = e.clipShadows, this.shadowSide = e.shadowSide, this.colorWrite = e.colorWrite, this.precision = e.precision, this.polygonOffset = e.polygonOffset, this.polygonOffsetFactor = e.polygonOffsetFactor, this.polygonOffsetUnits = e.polygonOffsetUnits, this.dithering = e.dithering, this.alphaTest = e.alphaTest, this.alphaHash = e.alphaHash, this.alphaToCoverage = e.alphaToCoverage, this.premultipliedAlpha = e.premultipliedAlpha, this.forceSinglePass = e.forceSinglePass, this.allowOverride = e.allowOverride, this.visible = e.visible, this.toneMapped = e.toneMapped, this.userData = JSON.parse(JSON.stringify(e.userData)), this;
	}
	dispose() {
		this.dispatchEvent({ type: "dispose" });
	}
	set needsUpdate(e) {
		e === !0 && this.version++;
	}
}, no = class extends to {
	constructor(e) {
		super(), this.isSpriteMaterial = !0, this.type = "SpriteMaterial", this.color = new J(16777215), this.map = null, this.alphaMap = null, this.rotation = 0, this.sizeAttenuation = !0, this.transparent = !0, this.fog = !0, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.color.copy(e.color), this.map = e.map, this.alphaMap = e.alphaMap, this.rotation = e.rotation, this.sizeAttenuation = e.sizeAttenuation, this.fog = e.fog, this;
	}
}, ro, io = /*@__PURE__*/ new U(), ao = /*@__PURE__*/ new U(), oo = /*@__PURE__*/ new U(), so = /*@__PURE__*/ new H(), co = /*@__PURE__*/ new H(), lo = /*@__PURE__*/ new K(), uo = /*@__PURE__*/ new U(), fo = /*@__PURE__*/ new U(), po = /*@__PURE__*/ new U(), mo = /*@__PURE__*/ new H(), ho = /*@__PURE__*/ new H(), go = /*@__PURE__*/ new H(), _o = class extends q {
	constructor(e = new no()) {
		if (super(), this.isSprite = !0, this.type = "Sprite", ro === void 0) {
			ro = new Z();
			let e = new Za(new Float32Array([
				-.5,
				-.5,
				0,
				0,
				0,
				.5,
				-.5,
				0,
				1,
				0,
				.5,
				.5,
				0,
				1,
				1,
				-.5,
				.5,
				0,
				0,
				1
			]), 5);
			ro.setIndex([
				0,
				1,
				2,
				0,
				2,
				3
			]), ro.setAttribute("position", new $a(e, 3, 0, !1)), ro.setAttribute("uv", new $a(e, 2, 3, !1));
		}
		this.geometry = ro, this.material = e, this.center = new H(.5, .5), this.count = 1;
	}
	raycast(e, t) {
		e.camera === null && z("Sprite: \"Raycaster.camera\" needs to be set in order to raycast against sprites."), ao.setFromMatrixScale(this.matrixWorld), lo.copy(e.camera.matrixWorld), this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse, this.matrixWorld), oo.setFromMatrixPosition(this.modelViewMatrix), e.camera.isPerspectiveCamera && this.material.sizeAttenuation === !1 && ao.multiplyScalar(-oo.z);
		let n = this.material.rotation, r, i;
		n !== 0 && (i = Math.cos(n), r = Math.sin(n));
		let a = this.center;
		vo(uo.set(-.5, -.5, 0), oo, a, ao, r, i), vo(fo.set(.5, -.5, 0), oo, a, ao, r, i), vo(po.set(.5, .5, 0), oo, a, ao, r, i), mo.set(0, 0), ho.set(1, 0), go.set(1, 1);
		let o = e.ray.intersectTriangle(uo, fo, po, !1, io);
		if (o === null && (vo(fo.set(-.5, .5, 0), oo, a, ao, r, i), ho.set(0, 1), o = e.ray.intersectTriangle(uo, po, fo, !1, io), o === null)) return;
		let s = e.ray.origin.distanceTo(io);
		s < e.near || s > e.far || t.push({
			distance: s,
			point: io.clone(),
			uv: ca.getInterpolation(io, uo, fo, po, mo, ho, go, new H()),
			face: null,
			object: this
		});
	}
	copy(e, t) {
		return super.copy(e, t), e.center !== void 0 && this.center.copy(e.center), this.material = e.material, this;
	}
};
function vo(e, t, n, r, i, a) {
	so.subVectors(e, n).addScalar(.5).multiply(r), i === void 0 ? co.copy(so) : (co.x = a * so.x - i * so.y, co.y = i * so.x + a * so.y), e.copy(t), e.x += co.x, e.y += co.y, e.applyMatrix4(lo);
}
var yo = /*@__PURE__*/ new U(), bo = /*@__PURE__*/ new U(), xo = class extends q {
	constructor() {
		super(), this.isLOD = !0, this._currentLevel = 0, this.type = "LOD", Object.defineProperties(this, { levels: {
			enumerable: !0,
			value: []
		} }), this.autoUpdate = !0;
	}
	copy(e) {
		super.copy(e, !1);
		let t = e.levels;
		for (let e = 0, n = t.length; e < n; e++) {
			let n = t[e];
			this.addLevel(n.object.clone(), n.distance, n.hysteresis);
		}
		return this.autoUpdate = e.autoUpdate, this;
	}
	addLevel(e, t = 0, n = 0) {
		t = Math.abs(t);
		let r = this.levels, i;
		for (i = 0; i < r.length && !(t < r[i].distance); i++);
		return r.splice(i, 0, {
			distance: t,
			hysteresis: n,
			object: e
		}), this.add(e), this;
	}
	removeLevel(e) {
		let t = this.levels;
		for (let n = 0; n < t.length; n++) if (t[n].distance === e) {
			let e = t.splice(n, 1);
			return this.remove(e[0].object), !0;
		}
		return !1;
	}
	getCurrentLevel() {
		return this._currentLevel;
	}
	getObjectForDistance(e) {
		let t = this.levels;
		if (t.length > 0) {
			let n, r;
			for (n = 1, r = t.length; n < r; n++) {
				let r = t[n].distance;
				if (t[n].object.visible && (r -= r * t[n].hysteresis), e < r) break;
			}
			return t[n - 1].object;
		}
		return null;
	}
	raycast(e, t) {
		if (this.levels.length > 0) {
			yo.setFromMatrixPosition(this.matrixWorld);
			let n = e.ray.origin.distanceTo(yo);
			this.getObjectForDistance(n).raycast(e, t);
		}
	}
	update(e) {
		let t = this.levels;
		if (t.length > 1) {
			yo.setFromMatrixPosition(e.matrixWorld), bo.setFromMatrixPosition(this.matrixWorld);
			let n = yo.distanceTo(bo) / e.zoom;
			t[0].object.visible = !0;
			let r, i;
			for (r = 1, i = t.length; r < i; r++) {
				let e = t[r].distance;
				if (t[r].object.visible && (e -= e * t[r].hysteresis), n >= e) t[r - 1].object.visible = !1, t[r].object.visible = !0;
				else break;
			}
			for (this._currentLevel = r - 1; r < i; r++) t[r].object.visible = !1;
		}
	}
	toJSON(e) {
		let t = super.toJSON(e);
		this.autoUpdate === !1 && (t.object.autoUpdate = !1), t.object.levels = [];
		let n = this.levels;
		for (let e = 0, r = n.length; e < r; e++) {
			let r = n[e];
			t.object.levels.push({
				object: r.object.uuid,
				distance: r.distance,
				hysteresis: r.hysteresis
			});
		}
		return t;
	}
}, So = /*@__PURE__*/ new U(), Co = /*@__PURE__*/ new U(), wo = /*@__PURE__*/ new U(), To = /*@__PURE__*/ new U(), Eo = /*@__PURE__*/ new U(), Do = /*@__PURE__*/ new U(), Oo = /*@__PURE__*/ new U(), ko = class {
	constructor(e = new U(), t = new U(0, 0, -1)) {
		this.origin = e, this.direction = t;
	}
	set(e, t) {
		return this.origin.copy(e), this.direction.copy(t), this;
	}
	copy(e) {
		return this.origin.copy(e.origin), this.direction.copy(e.direction), this;
	}
	at(e, t) {
		return t.copy(this.origin).addScaledVector(this.direction, e);
	}
	lookAt(e) {
		return this.direction.copy(e).sub(this.origin).normalize(), this;
	}
	recast(e) {
		return this.origin.copy(this.at(e, So)), this;
	}
	closestPointToPoint(e, t) {
		t.subVectors(e, this.origin);
		let n = t.dot(this.direction);
		return n < 0 ? t.copy(this.origin) : t.copy(this.origin).addScaledVector(this.direction, n);
	}
	distanceToPoint(e) {
		return Math.sqrt(this.distanceSqToPoint(e));
	}
	distanceSqToPoint(e) {
		let t = So.subVectors(e, this.origin).dot(this.direction);
		return t < 0 ? this.origin.distanceToSquared(e) : (So.copy(this.origin).addScaledVector(this.direction, t), So.distanceToSquared(e));
	}
	distanceSqToSegment(e, t, n, r) {
		Co.copy(e).add(t).multiplyScalar(.5), wo.copy(t).sub(e).normalize(), To.copy(this.origin).sub(Co);
		let i = e.distanceTo(t) * .5, a = -this.direction.dot(wo), o = To.dot(this.direction), s = -To.dot(wo), c = To.lengthSq(), l = Math.abs(1 - a * a), u, d, f, p;
		if (l > 0) if (u = a * s - o, d = a * o - s, p = i * l, u >= 0) if (d >= -p) if (d <= p) {
			let e = 1 / l;
			u *= e, d *= e, f = u * (u + a * d + 2 * o) + d * (a * u + d + 2 * s) + c;
		} else d = i, u = Math.max(0, -(a * d + o)), f = -u * u + d * (d + 2 * s) + c;
		else d = -i, u = Math.max(0, -(a * d + o)), f = -u * u + d * (d + 2 * s) + c;
		else d <= -p ? (u = Math.max(0, -(-a * i + o)), d = u > 0 ? -i : Math.min(Math.max(-i, -s), i), f = -u * u + d * (d + 2 * s) + c) : d <= p ? (u = 0, d = Math.min(Math.max(-i, -s), i), f = d * (d + 2 * s) + c) : (u = Math.max(0, -(a * i + o)), d = u > 0 ? i : Math.min(Math.max(-i, -s), i), f = -u * u + d * (d + 2 * s) + c);
		else d = a > 0 ? -i : i, u = Math.max(0, -(a * d + o)), f = -u * u + d * (d + 2 * s) + c;
		return n && n.copy(this.origin).addScaledVector(this.direction, u), r && r.copy(Co).addScaledVector(wo, d), f;
	}
	intersectSphere(e, t) {
		So.subVectors(e.center, this.origin);
		let n = So.dot(this.direction), r = So.dot(So) - n * n, i = e.radius * e.radius;
		if (r > i) return null;
		let a = Math.sqrt(i - r), o = n - a, s = n + a;
		return s < 0 ? null : o < 0 ? this.at(s, t) : this.at(o, t);
	}
	intersectsSphere(e) {
		return e.radius < 0 ? !1 : this.distanceSqToPoint(e.center) <= e.radius * e.radius;
	}
	distanceToPlane(e) {
		let t = e.normal.dot(this.direction);
		if (t === 0) return e.distanceToPoint(this.origin) === 0 ? 0 : null;
		let n = -(this.origin.dot(e.normal) + e.constant) / t;
		return n >= 0 ? n : null;
	}
	intersectPlane(e, t) {
		let n = this.distanceToPlane(e);
		return n === null ? null : this.at(n, t);
	}
	intersectsPlane(e) {
		let t = e.distanceToPoint(this.origin);
		return t === 0 || e.normal.dot(this.direction) * t < 0;
	}
	intersectBox(e, t) {
		let n, r, i, a, o, s, c = 1 / this.direction.x, l = 1 / this.direction.y, u = 1 / this.direction.z, d = this.origin;
		return c >= 0 ? (n = (e.min.x - d.x) * c, r = (e.max.x - d.x) * c) : (n = (e.max.x - d.x) * c, r = (e.min.x - d.x) * c), l >= 0 ? (i = (e.min.y - d.y) * l, a = (e.max.y - d.y) * l) : (i = (e.max.y - d.y) * l, a = (e.min.y - d.y) * l), n > a || i > r || ((i > n || isNaN(n)) && (n = i), (a < r || isNaN(r)) && (r = a), u >= 0 ? (o = (e.min.z - d.z) * u, s = (e.max.z - d.z) * u) : (o = (e.max.z - d.z) * u, s = (e.min.z - d.z) * u), n > s || o > r) || ((o > n || n !== n) && (n = o), (s < r || r !== r) && (r = s), r < 0) ? null : this.at(n >= 0 ? n : r, t);
	}
	intersectsBox(e) {
		return this.intersectBox(e, So) !== null;
	}
	intersectTriangle(e, t, n, r, i) {
		Eo.subVectors(t, e), Do.subVectors(n, e), Oo.crossVectors(Eo, Do);
		let a = this.direction.dot(Oo), o;
		if (a > 0) {
			if (r) return null;
			o = 1;
		} else if (a < 0) o = -1, a = -a;
		else return null;
		To.subVectors(this.origin, e);
		let s = o * this.direction.dot(Do.crossVectors(To, Do));
		if (s < 0) return null;
		let c = o * this.direction.dot(Eo.cross(To));
		if (c < 0 || s + c > a) return null;
		let l = -o * To.dot(Oo);
		return l < 0 ? null : this.at(l / a, i);
	}
	applyMatrix4(e) {
		return this.origin.applyMatrix4(e), this.direction.transformDirection(e), this;
	}
	equals(e) {
		return e.origin.equals(this.origin) && e.direction.equals(this.direction);
	}
	clone() {
		return new this.constructor().copy(this);
	}
}, Ao = class extends to {
	constructor(e) {
		super(), this.isMeshBasicMaterial = !0, this.type = "MeshBasicMaterial", this.color = new J(16777215), this.map = null, this.lightMap = null, this.lightMapIntensity = 1, this.aoMap = null, this.aoMapIntensity = 1, this.specularMap = null, this.alphaMap = null, this.envMap = null, this.envMapRotation = new xi(), this.combine = 0, this.reflectivity = 1, this.refractionRatio = .98, this.wireframe = !1, this.wireframeLinewidth = 1, this.wireframeLinecap = "round", this.wireframeLinejoin = "round", this.fog = !0, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.color.copy(e.color), this.map = e.map, this.lightMap = e.lightMap, this.lightMapIntensity = e.lightMapIntensity, this.aoMap = e.aoMap, this.aoMapIntensity = e.aoMapIntensity, this.specularMap = e.specularMap, this.alphaMap = e.alphaMap, this.envMap = e.envMap, this.envMapRotation.copy(e.envMapRotation), this.combine = e.combine, this.reflectivity = e.reflectivity, this.refractionRatio = e.refractionRatio, this.wireframe = e.wireframe, this.wireframeLinewidth = e.wireframeLinewidth, this.wireframeLinecap = e.wireframeLinecap, this.wireframeLinejoin = e.wireframeLinejoin, this.fog = e.fog, this;
	}
}, jo = /*@__PURE__*/ new K(), Mo = /*@__PURE__*/ new ko(), No = /*@__PURE__*/ new Ua(), Po = /*@__PURE__*/ new U(), Fo = /*@__PURE__*/ new U(), Io = /*@__PURE__*/ new U(), Lo = /*@__PURE__*/ new U(), Ro = /*@__PURE__*/ new U(), zo = /*@__PURE__*/ new U(), Bo = /*@__PURE__*/ new U(), Vo = /*@__PURE__*/ new U(), Ho = class extends q {
	constructor(e = new Z(), t = new Ao()) {
		super(), this.isMesh = !0, this.type = "Mesh", this.geometry = e, this.material = t, this.morphTargetDictionary = void 0, this.morphTargetInfluences = void 0, this.count = 1, this.updateMorphTargets();
	}
	copy(e, t) {
		return super.copy(e, t), e.morphTargetInfluences !== void 0 && (this.morphTargetInfluences = e.morphTargetInfluences.slice()), e.morphTargetDictionary !== void 0 && (this.morphTargetDictionary = Object.assign({}, e.morphTargetDictionary)), this.material = Array.isArray(e.material) ? e.material.slice() : e.material, this.geometry = e.geometry, this;
	}
	updateMorphTargets() {
		let e = this.geometry.morphAttributes, t = Object.keys(e);
		if (t.length > 0) {
			let n = e[t[0]];
			if (n !== void 0) {
				this.morphTargetInfluences = [], this.morphTargetDictionary = {};
				for (let e = 0, t = n.length; e < t; e++) {
					let t = n[e].name || String(e);
					this.morphTargetInfluences.push(0), this.morphTargetDictionary[t] = e;
				}
			}
		}
	}
	getVertexPosition(e, t) {
		let n = this.geometry, r = n.attributes.position, i = n.morphAttributes.position, a = n.morphTargetsRelative;
		t.fromBufferAttribute(r, e);
		let o = this.morphTargetInfluences;
		if (i && o) {
			zo.set(0, 0, 0);
			for (let n = 0, r = i.length; n < r; n++) {
				let r = o[n], s = i[n];
				r !== 0 && (Ro.fromBufferAttribute(s, e), a ? zo.addScaledVector(Ro, r) : zo.addScaledVector(Ro.sub(t), r));
			}
			t.add(zo);
		}
		return t;
	}
	raycast(e, t) {
		let n = this.geometry, r = this.material, i = this.matrixWorld;
		r !== void 0 && (n.boundingSphere === null && n.computeBoundingSphere(), No.copy(n.boundingSphere), No.applyMatrix4(i), Mo.copy(e.ray).recast(e.near), !(No.containsPoint(Mo.origin) === !1 && (Mo.intersectSphere(No, Po) === null || Mo.origin.distanceToSquared(Po) > (e.far - e.near) ** 2)) && (jo.copy(i).invert(), Mo.copy(e.ray).applyMatrix4(jo), !(n.boundingBox !== null && Mo.intersectsBox(n.boundingBox) === !1) && this._computeIntersections(e, t, Mo)));
	}
	_computeIntersections(e, t, n) {
		let r, i = this.geometry, a = this.material, o = i.index, s = i.attributes.position, c = i.attributes.uv, l = i.attributes.uv1, u = i.attributes.normal, d = i.groups, f = i.drawRange;
		if (o !== null) if (Array.isArray(a)) for (let i = 0, s = d.length; i < s; i++) {
			let s = d[i], p = a[s.materialIndex], m = Math.max(s.start, f.start), h = Math.min(o.count, Math.min(s.start + s.count, f.start + f.count));
			for (let i = m, a = h; i < a; i += 3) {
				let a = o.getX(i), d = o.getX(i + 1), f = o.getX(i + 2);
				r = Wo(this, p, e, n, c, l, u, a, d, f), r && (r.faceIndex = Math.floor(i / 3), r.face.materialIndex = s.materialIndex, t.push(r));
			}
		}
		else {
			let i = Math.max(0, f.start), s = Math.min(o.count, f.start + f.count);
			for (let d = i, f = s; d < f; d += 3) {
				let i = o.getX(d), s = o.getX(d + 1), f = o.getX(d + 2);
				r = Wo(this, a, e, n, c, l, u, i, s, f), r && (r.faceIndex = Math.floor(d / 3), t.push(r));
			}
		}
		else if (s !== void 0) if (Array.isArray(a)) for (let i = 0, o = d.length; i < o; i++) {
			let o = d[i], p = a[o.materialIndex], m = Math.max(o.start, f.start), h = Math.min(s.count, Math.min(o.start + o.count, f.start + f.count));
			for (let i = m, a = h; i < a; i += 3) {
				let a = i, s = i + 1, d = i + 2;
				r = Wo(this, p, e, n, c, l, u, a, s, d), r && (r.faceIndex = Math.floor(i / 3), r.face.materialIndex = o.materialIndex, t.push(r));
			}
		}
		else {
			let i = Math.max(0, f.start), o = Math.min(s.count, f.start + f.count);
			for (let s = i, d = o; s < d; s += 3) {
				let i = s, o = s + 1, d = s + 2;
				r = Wo(this, a, e, n, c, l, u, i, o, d), r && (r.faceIndex = Math.floor(s / 3), t.push(r));
			}
		}
	}
};
function Uo(e, t, n, r, i, a, o, s) {
	let c;
	if (c = t.side === 1 ? r.intersectTriangle(o, a, i, !0, s) : r.intersectTriangle(i, a, o, t.side === 0, s), c === null) return null;
	Vo.copy(s), Vo.applyMatrix4(e.matrixWorld);
	let l = n.ray.origin.distanceTo(Vo);
	return l < n.near || l > n.far ? null : {
		distance: l,
		point: Vo.clone(),
		object: e
	};
}
function Wo(e, t, n, r, i, a, o, s, c, l) {
	e.getVertexPosition(s, Fo), e.getVertexPosition(c, Io), e.getVertexPosition(l, Lo);
	let u = Uo(e, t, n, r, Fo, Io, Lo, Bo);
	if (u) {
		let e = new U();
		ca.getBarycoord(Bo, Fo, Io, Lo, e), i && (u.uv = ca.getInterpolatedAttribute(i, s, c, l, e, new H())), a && (u.uv1 = ca.getInterpolatedAttribute(a, s, c, l, e, new H())), o && (u.normal = ca.getInterpolatedAttribute(o, s, c, l, e, new U()), u.normal.dot(r.direction) > 0 && u.normal.multiplyScalar(-1));
		let t = {
			a: s,
			b: c,
			c: l,
			normal: new U(),
			materialIndex: 0
		};
		ca.getNormal(Fo, Io, Lo, t.normal), u.face = t, u.barycoord = e;
	}
	return u;
}
var Go = /*@__PURE__*/ new ai(), Ko = /*@__PURE__*/ new ai(), qo = /*@__PURE__*/ new ai(), Jo = /*@__PURE__*/ new ai(), Yo = /*@__PURE__*/ new K(), Xo = /*@__PURE__*/ new U(), Zo = /*@__PURE__*/ new Ua(), Qo = /*@__PURE__*/ new K(), $o = /*@__PURE__*/ new ko(), es = class extends Ho {
	constructor(e, t) {
		super(e, t), this.isSkinnedMesh = !0, this.type = "SkinnedMesh", this.bindMode = We, this.bindMatrix = new K(), this.bindMatrixInverse = new K(), this.boundingBox = null, this.boundingSphere = null;
	}
	computeBoundingBox() {
		let e = this.geometry;
		this.boundingBox === null && (this.boundingBox = new la()), this.boundingBox.makeEmpty();
		let t = e.getAttribute("position");
		for (let e = 0; e < t.count; e++) this.getVertexPosition(e, Xo), this.boundingBox.expandByPoint(Xo);
	}
	computeBoundingSphere() {
		let e = this.geometry;
		this.boundingSphere === null && (this.boundingSphere = new Ua()), this.boundingSphere.makeEmpty();
		let t = e.getAttribute("position");
		for (let e = 0; e < t.count; e++) this.getVertexPosition(e, Xo), this.boundingSphere.expandByPoint(Xo);
	}
	copy(e, t) {
		return super.copy(e, t), this.bindMode = e.bindMode, this.bindMatrix.copy(e.bindMatrix), this.bindMatrixInverse.copy(e.bindMatrixInverse), this.skeleton = e.skeleton, e.boundingBox !== null && (this.boundingBox = e.boundingBox.clone()), e.boundingSphere !== null && (this.boundingSphere = e.boundingSphere.clone()), this;
	}
	raycast(e, t) {
		let n = this.material, r = this.matrixWorld;
		n !== void 0 && (this.boundingSphere === null && this.computeBoundingSphere(), Zo.copy(this.boundingSphere), Zo.applyMatrix4(r), e.ray.intersectsSphere(Zo) !== !1 && (Qo.copy(r).invert(), $o.copy(e.ray).applyMatrix4(Qo), !(this.boundingBox !== null && $o.intersectsBox(this.boundingBox) === !1) && this._computeIntersections(e, t, $o)));
	}
	getVertexPosition(e, t) {
		return super.getVertexPosition(e, t), this.applyBoneTransform(e, t), t;
	}
	bind(e, t) {
		this.skeleton = e, t === void 0 && (this.updateMatrixWorld(!0), this.skeleton.calculateInverses(), t = this.matrixWorld), this.bindMatrix.copy(t), this.bindMatrixInverse.copy(t).invert();
	}
	pose() {
		this.skeleton.pose();
	}
	normalizeSkinWeights() {
		let e = new ai(), t = this.geometry.attributes.skinWeight;
		for (let n = 0, r = t.count; n < r; n++) {
			e.fromBufferAttribute(t, n);
			let r = 1 / e.manhattanLength();
			r === Infinity ? e.set(1, 0, 0, 0) : e.multiplyScalar(r), t.setXYZW(n, e.x, e.y, e.z, e.w);
		}
	}
	updateMatrixWorld(e) {
		super.updateMatrixWorld(e), this.bindMode === "attached" ? this.bindMatrixInverse.copy(this.matrixWorld).invert() : this.bindMode === "detached" ? this.bindMatrixInverse.copy(this.bindMatrix).invert() : R("SkinnedMesh: Unrecognized bindMode: " + this.bindMode);
	}
	applyBoneTransform(e, t) {
		let n = this.skeleton, r = this.geometry;
		Ko.fromBufferAttribute(r.attributes.skinIndex, e), qo.fromBufferAttribute(r.attributes.skinWeight, e), t.isVector4 ? (Go.copy(t), t.set(0, 0, 0, 0)) : (Go.set(...t, 1), t.set(0, 0, 0)), Go.applyMatrix4(this.bindMatrix);
		for (let e = 0; e < 4; e++) {
			let r = qo.getComponent(e);
			if (r !== 0) {
				let i = Ko.getComponent(e);
				Yo.multiplyMatrices(n.bones[i].matrixWorld, n.boneInverses[i]), t.addScaledVector(Jo.copy(Go).applyMatrix4(Yo), r);
			}
		}
		return t.isVector4 && (t.w = Go.w), t.applyMatrix4(this.bindMatrixInverse);
	}
}, ts = class extends q {
	constructor() {
		super(), this.isBone = !0, this.type = "Bone";
	}
}, ns = class extends ii {
	constructor(e = null, t = 1, n = 1, r, i, a, o, s, c = Ye, l = Ye, u, d) {
		super(null, a, o, s, c, l, r, i, u, d), this.isDataTexture = !0, this.image = {
			data: e,
			width: t,
			height: n
		}, this.generateMipmaps = !1, this.flipY = !1, this.unpackAlignment = 1;
	}
}, rs = /*@__PURE__*/ new K(), is = /*@__PURE__*/ new K(), as = class e {
	constructor(e = [], t = []) {
		this.uuid = xr(), this.bones = e.slice(0), this.boneInverses = t, this.boneMatrices = null, this.boneTexture = null, this.init();
	}
	init() {
		let e = this.bones, t = this.boneInverses;
		if (this.boneMatrices = new Float32Array(e.length * 16), t.length === 0) this.calculateInverses();
		else if (e.length !== t.length) {
			R("Skeleton: Number of inverse bone matrices does not match amount of bones."), this.boneInverses = [];
			for (let e = 0, t = this.bones.length; e < t; e++) this.boneInverses.push(new K());
		}
	}
	calculateInverses() {
		this.boneInverses.length = 0;
		for (let e = 0, t = this.bones.length; e < t; e++) {
			let t = new K();
			this.bones[e] && t.copy(this.bones[e].matrixWorld).invert(), this.boneInverses.push(t);
		}
	}
	pose() {
		for (let e = 0, t = this.bones.length; e < t; e++) {
			let t = this.bones[e];
			t && t.matrixWorld.copy(this.boneInverses[e]).invert();
		}
		for (let e = 0, t = this.bones.length; e < t; e++) {
			let t = this.bones[e];
			t && (t.parent && t.parent.isBone ? (t.matrix.copy(t.parent.matrixWorld).invert(), t.matrix.multiply(t.matrixWorld)) : t.matrix.copy(t.matrixWorld), t.matrix.decompose(t.position, t.quaternion, t.scale));
		}
	}
	update() {
		let e = this.bones, t = this.boneInverses, n = this.boneMatrices, r = this.boneTexture;
		for (let r = 0, i = e.length; r < i; r++) {
			let i = e[r] ? e[r].matrixWorld : is;
			rs.multiplyMatrices(i, t[r]), rs.toArray(n, r * 16);
		}
		r !== null && (r.needsUpdate = !0);
	}
	clone() {
		return new e(this.bones, this.boneInverses);
	}
	computeBoneTexture() {
		let e = Math.sqrt(this.bones.length * 4);
		e = Math.ceil(e / 4) * 4, e = Math.max(e, 4);
		let t = new Float32Array(e * e * 4);
		t.set(this.boneMatrices);
		let n = new ns(t, e, e, bt, dt);
		return n.needsUpdate = !0, this.boneMatrices = t, this.boneTexture = n, this;
	}
	getBoneByName(e) {
		for (let t = 0, n = this.bones.length; t < n; t++) {
			let n = this.bones[t];
			if (n.name === e) return n;
		}
	}
	dispose() {
		this.boneTexture !== null && (this.boneTexture.dispose(), this.boneTexture = null);
	}
	fromJSON(e, t) {
		this.uuid = e.uuid;
		for (let n = 0, r = e.bones.length; n < r; n++) {
			let r = e.bones[n], i = t[r];
			i === void 0 && (R("Skeleton: No bone found with UUID:", r), i = new ts()), this.bones.push(i), this.boneInverses.push(new K().fromArray(e.boneInverses[n]));
		}
		return this.init(), this;
	}
	toJSON() {
		let e = {
			metadata: {
				version: 4.7,
				type: "Skeleton",
				generator: "Skeleton.toJSON"
			},
			bones: [],
			boneInverses: []
		};
		e.uuid = this.uuid;
		let t = this.bones, n = this.boneInverses;
		for (let r = 0, i = t.length; r < i; r++) {
			let i = t[r];
			e.bones.push(i.uuid);
			let a = n[r];
			e.boneInverses.push(a.toArray());
		}
		return e;
	}
}, os = class extends Y {
	constructor(e, t, n, r = 1) {
		super(e, t, n), this.isInstancedBufferAttribute = !0, this.meshPerAttribute = r;
	}
	copy(e) {
		return super.copy(e), this.meshPerAttribute = e.meshPerAttribute, this;
	}
	toJSON() {
		let e = super.toJSON();
		return e.meshPerAttribute = this.meshPerAttribute, e.isInstancedBufferAttribute = !0, e;
	}
}, ss = /*@__PURE__*/ new K(), cs = /*@__PURE__*/ new K(), ls = [], us = /*@__PURE__*/ new la(), ds = /*@__PURE__*/ new K(), fs = /*@__PURE__*/ new Ho(), ps = /*@__PURE__*/ new Ua(), ms = class extends Ho {
	constructor(e, t, n) {
		super(e, t), this.isInstancedMesh = !0, this.instanceMatrix = new os(new Float32Array(n * 16), 16), this.instanceColor = null, this.morphTexture = null, this.count = n, this.boundingBox = null, this.boundingSphere = null;
		for (let e = 0; e < n; e++) this.setMatrixAt(e, ds);
	}
	computeBoundingBox() {
		let e = this.geometry, t = this.count;
		this.boundingBox === null && (this.boundingBox = new la()), e.boundingBox === null && e.computeBoundingBox(), this.boundingBox.makeEmpty();
		for (let n = 0; n < t; n++) this.getMatrixAt(n, ss), us.copy(e.boundingBox).applyMatrix4(ss), this.boundingBox.union(us);
	}
	computeBoundingSphere() {
		let e = this.geometry, t = this.count;
		this.boundingSphere === null && (this.boundingSphere = new Ua()), e.boundingSphere === null && e.computeBoundingSphere(), this.boundingSphere.makeEmpty();
		for (let n = 0; n < t; n++) this.getMatrixAt(n, ss), ps.copy(e.boundingSphere).applyMatrix4(ss), this.boundingSphere.union(ps);
	}
	copy(e, t) {
		return super.copy(e, t), this.instanceMatrix.copy(e.instanceMatrix), e.morphTexture !== null && (this.morphTexture = e.morphTexture.clone()), e.instanceColor !== null && (this.instanceColor = e.instanceColor.clone()), this.count = e.count, e.boundingBox !== null && (this.boundingBox = e.boundingBox.clone()), e.boundingSphere !== null && (this.boundingSphere = e.boundingSphere.clone()), this;
	}
	getColorAt(e, t) {
		return this.instanceColor === null ? t.setRGB(1, 1, 1) : t.fromArray(this.instanceColor.array, e * 3);
	}
	getMatrixAt(e, t) {
		return t.fromArray(this.instanceMatrix.array, e * 16);
	}
	getMorphAt(e, t) {
		let n = t.morphTargetInfluences, r = this.morphTexture.source.data.data, i = e * (n.length + 1) + 1;
		for (let e = 0; e < n.length; e++) n[e] = r[i + e];
	}
	raycast(e, t) {
		let n = this.matrixWorld, r = this.count;
		if (fs.geometry = this.geometry, fs.material = this.material, fs.material !== void 0 && (this.boundingSphere === null && this.computeBoundingSphere(), ps.copy(this.boundingSphere), ps.applyMatrix4(n), e.ray.intersectsSphere(ps) !== !1)) for (let i = 0; i < r; i++) {
			this.getMatrixAt(i, ss), cs.multiplyMatrices(n, ss), fs.matrixWorld = cs, fs.raycast(e, ls);
			for (let e = 0, n = ls.length; e < n; e++) {
				let n = ls[e];
				n.instanceId = i, n.object = this, t.push(n);
			}
			ls.length = 0;
		}
	}
	setColorAt(e, t) {
		return this.instanceColor === null && (this.instanceColor = new os(new Float32Array(this.instanceMatrix.count * 3).fill(1), 3)), t.toArray(this.instanceColor.array, e * 3), this;
	}
	setMatrixAt(e, t) {
		return t.toArray(this.instanceMatrix.array, e * 16), this;
	}
	setMorphAt(e, t) {
		let n = t.morphTargetInfluences, r = n.length + 1;
		this.morphTexture === null && (this.morphTexture = new ns(new Float32Array(r * this.count), r, this.count, Ct, dt));
		let i = this.morphTexture.source.data.data, a = 0;
		for (let e = 0; e < n.length; e++) a += n[e];
		let o = this.geometry.morphTargetsRelative ? 1 : 1 - a, s = r * e;
		return i[s] = o, i.set(n, s + 1), this;
	}
	updateMorphTargets() {}
	dispose() {
		this.dispatchEvent({ type: "dispose" }), this.morphTexture !== null && (this.morphTexture.dispose(), this.morphTexture = null);
	}
}, hs = /*@__PURE__*/ new U(), gs = /*@__PURE__*/ new U(), _s = /*@__PURE__*/ new W(), vs = class {
	constructor(e = new U(1, 0, 0), t = 0) {
		this.isPlane = !0, this.normal = e, this.constant = t;
	}
	set(e, t) {
		return this.normal.copy(e), this.constant = t, this;
	}
	setComponents(e, t, n, r) {
		return this.normal.set(e, t, n), this.constant = r, this;
	}
	setFromNormalAndCoplanarPoint(e, t) {
		return this.normal.copy(e), this.constant = -t.dot(this.normal), this;
	}
	setFromCoplanarPoints(e, t, n) {
		let r = hs.subVectors(n, t).cross(gs.subVectors(e, t)).normalize();
		return this.setFromNormalAndCoplanarPoint(r, e), this;
	}
	copy(e) {
		return this.normal.copy(e.normal), this.constant = e.constant, this;
	}
	normalize() {
		let e = 1 / this.normal.length();
		return this.normal.multiplyScalar(e), this.constant *= e, this;
	}
	negate() {
		return this.constant *= -1, this.normal.negate(), this;
	}
	distanceToPoint(e) {
		return this.normal.dot(e) + this.constant;
	}
	distanceToSphere(e) {
		return this.distanceToPoint(e.center) - e.radius;
	}
	projectPoint(e, t) {
		return t.copy(e).addScaledVector(this.normal, -this.distanceToPoint(e));
	}
	intersectLine(e, t, n = !0) {
		let r = e.delta(hs), i = this.normal.dot(r);
		if (i === 0) return this.distanceToPoint(e.start) === 0 ? t.copy(e.start) : null;
		let a = -(e.start.dot(this.normal) + this.constant) / i;
		return n === !0 && (a < 0 || a > 1) ? null : t.copy(e.start).addScaledVector(r, a);
	}
	intersectsLine(e) {
		let t = this.distanceToPoint(e.start), n = this.distanceToPoint(e.end);
		return t < 0 && n > 0 || n < 0 && t > 0;
	}
	intersectsBox(e) {
		return e.intersectsPlane(this);
	}
	intersectsSphere(e) {
		return e.intersectsPlane(this);
	}
	coplanarPoint(e) {
		return e.copy(this.normal).multiplyScalar(-this.constant);
	}
	applyMatrix4(e, t) {
		let n = t || _s.getNormalMatrix(e), r = this.coplanarPoint(hs).applyMatrix4(e), i = this.normal.applyMatrix3(n).normalize();
		return this.constant = -r.dot(i), this;
	}
	translate(e) {
		return this.constant -= e.dot(this.normal), this;
	}
	equals(e) {
		return e.normal.equals(this.normal) && e.constant === this.constant;
	}
	clone() {
		return new this.constructor().copy(this);
	}
}, ys = /*@__PURE__*/ new Ua(), bs = /*@__PURE__*/ new H(.5, .5), xs = /*@__PURE__*/ new U(), Ss = class {
	constructor(e = new vs(), t = new vs(), n = new vs(), r = new vs(), i = new vs(), a = new vs()) {
		this.planes = [
			e,
			t,
			n,
			r,
			i,
			a
		];
	}
	set(e, t, n, r, i, a) {
		let o = this.planes;
		return o[0].copy(e), o[1].copy(t), o[2].copy(n), o[3].copy(r), o[4].copy(i), o[5].copy(a), this;
	}
	copy(e) {
		let t = this.planes;
		for (let n = 0; n < 6; n++) t[n].copy(e.planes[n]);
		return this;
	}
	setFromProjectionMatrix(e, t = Yn, n = !1) {
		let r = this.planes, i = e.elements, a = i[0], o = i[1], s = i[2], c = i[3], l = i[4], u = i[5], d = i[6], f = i[7], p = i[8], m = i[9], h = i[10], g = i[11], _ = i[12], v = i[13], y = i[14], b = i[15];
		if (r[0].setComponents(c - a, f - l, g - p, b - _).normalize(), r[1].setComponents(c + a, f + l, g + p, b + _).normalize(), r[2].setComponents(c + o, f + u, g + m, b + v).normalize(), r[3].setComponents(c - o, f - u, g - m, b - v).normalize(), n) r[4].setComponents(s, d, h, y).normalize(), r[5].setComponents(c - s, f - d, g - h, b - y).normalize();
		else if (r[4].setComponents(c - s, f - d, g - h, b - y).normalize(), t === 2e3) r[5].setComponents(c + s, f + d, g + h, b + y).normalize();
		else if (t === 2001) r[5].setComponents(s, d, h, y).normalize();
		else throw Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: " + t);
		return this;
	}
	intersectsObject(e) {
		if (e.boundingSphere !== void 0) e.boundingSphere === null && e.computeBoundingSphere(), ys.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);
		else {
			let t = e.geometry;
			t.boundingSphere === null && t.computeBoundingSphere(), ys.copy(t.boundingSphere).applyMatrix4(e.matrixWorld);
		}
		return this.intersectsSphere(ys);
	}
	intersectsSprite(e) {
		return ys.center.set(0, 0, 0), ys.radius = .7071067811865476 + bs.distanceTo(e.center), ys.applyMatrix4(e.matrixWorld), this.intersectsSphere(ys);
	}
	intersectsSphere(e) {
		let t = this.planes, n = e.center, r = -e.radius;
		for (let e = 0; e < 6; e++) if (t[e].distanceToPoint(n) < r) return !1;
		return !0;
	}
	intersectsBox(e) {
		let t = this.planes;
		for (let n = 0; n < 6; n++) {
			let r = t[n];
			if (xs.x = r.normal.x > 0 ? e.max.x : e.min.x, xs.y = r.normal.y > 0 ? e.max.y : e.min.y, xs.z = r.normal.z > 0 ? e.max.z : e.min.z, r.distanceToPoint(xs) < 0) return !1;
		}
		return !0;
	}
	containsPoint(e) {
		let t = this.planes;
		for (let n = 0; n < 6; n++) if (t[n].distanceToPoint(e) < 0) return !1;
		return !0;
	}
	clone() {
		return new this.constructor().copy(this);
	}
}, Cs = /*@__PURE__*/ new K(), ws = class e {
	constructor() {
		this.coordinateSystem = Yn, this._frustums = [], this._count = 0;
	}
	setFromArrayCamera(e) {
		let t = e.cameras, n = this._frustums;
		for (let e = 0; e < t.length; e++) {
			let r = t[e];
			Cs.multiplyMatrices(r.projectionMatrix, r.matrixWorldInverse), n[e] === void 0 && (n[e] = new Ss()), n[e].setFromProjectionMatrix(Cs, r.coordinateSystem, r.reversedDepth);
		}
		return this._count = t.length, this;
	}
	intersectsObject(e) {
		let t = this._frustums;
		for (let n = 0; n < this._count; n++) if (t[n].intersectsObject(e)) return !0;
		return !1;
	}
	intersectsSprite(e) {
		let t = this._frustums;
		for (let n = 0; n < this._count; n++) if (t[n].intersectsSprite(e)) return !0;
		return !1;
	}
	intersectsSphere(e) {
		let t = this._frustums;
		for (let n = 0; n < this._count; n++) if (t[n].intersectsSphere(e)) return !0;
		return !1;
	}
	intersectsBox(e) {
		let t = this._frustums;
		for (let n = 0; n < this._count; n++) if (t[n].intersectsBox(e)) return !0;
		return !1;
	}
	containsPoint(e) {
		let t = this._frustums;
		for (let n = 0; n < this._count; n++) if (t[n].containsPoint(e)) return !0;
		return !1;
	}
	copy(e) {
		this.coordinateSystem = e.coordinateSystem;
		let t = this._frustums, n = e._frustums;
		for (let r = 0; r < e._count; r++) t[r] === void 0 && (t[r] = new Ss()), t[r].copy(n[r]);
		return this._count = e._count, this;
	}
	clone() {
		return new e().copy(this);
	}
};
function Ts(e, t) {
	return e - t;
}
function Es(e, t) {
	return e.z - t.z;
}
function Ds(e, t) {
	return t.z - e.z;
}
var Os = class {
	constructor() {
		this.index = 0, this.pool = [], this.list = [];
	}
	push(e, t, n, r) {
		let i = this.pool, a = this.list;
		this.index >= i.length && i.push({
			start: -1,
			count: -1,
			z: -1,
			index: -1
		});
		let o = i[this.index];
		a.push(o), this.index++, o.start = e, o.count = t, o.z = n, o.index = r;
	}
	reset() {
		this.list.length = 0, this.index = 0;
	}
}, ks = /*@__PURE__*/ new K(), As = /*@__PURE__*/ new J(1, 1, 1), js = /*@__PURE__*/ new Ss(), Ms = /*@__PURE__*/ new ws(), Ns = /*@__PURE__*/ new la(), Ps = /*@__PURE__*/ new Ua(), Fs = /*@__PURE__*/ new U(), Is = /*@__PURE__*/ new U(), Ls = /*@__PURE__*/ new U(), Rs = /*@__PURE__*/ new Os(), zs = /*@__PURE__*/ new Ho(), Bs = [];
function Vs(e, t, n = 0) {
	let r = t.itemSize;
	if (e.isInterleavedBufferAttribute || e.array.constructor !== t.array.constructor) {
		let i = e.count;
		for (let a = 0; a < i; a++) for (let i = 0; i < r; i++) t.setComponent(a + n, i, e.getComponent(a, i));
	} else t.array.set(e.array, n * r);
	t.needsUpdate = !0;
}
function Hs(e, t) {
	if (e.constructor !== t.constructor) {
		let n = Math.min(e.length, t.length);
		for (let r = 0; r < n; r++) t[r] = e[r];
	} else {
		let n = Math.min(e.length, t.length);
		t.set(new e.constructor(e.buffer, 0, n));
	}
}
var Us = class extends Ho {
	constructor(e, t, n = t * 2, r) {
		super(new Z(), r), this.isBatchedMesh = !0, this.perObjectFrustumCulled = !0, this.sortObjects = !0, this.boundingBox = null, this.boundingSphere = null, this.customSort = null, this._instanceInfo = [], this._geometryInfo = [], this._availableInstanceIds = [], this._availableGeometryIds = [], this._nextIndexStart = 0, this._nextVertexStart = 0, this._geometryCount = 0, this._visibilityChanged = !0, this._geometryInitialized = !1, this._maxInstanceCount = e, this._maxVertexCount = t, this._maxIndexCount = n, this._multiDrawCounts = new Int32Array(e), this._multiDrawStarts = new Int32Array(e), this._multiDrawCount = 0, this._matricesTexture = null, this._indirectTexture = null, this._colorsTexture = null, this._initMatricesTexture(), this._initIndirectTexture();
	}
	get maxInstanceCount() {
		return this._maxInstanceCount;
	}
	get instanceCount() {
		return this._instanceInfo.length - this._availableInstanceIds.length;
	}
	get unusedVertexCount() {
		return this._maxVertexCount - this._nextVertexStart;
	}
	get unusedIndexCount() {
		return this._maxIndexCount - this._nextIndexStart;
	}
	_initMatricesTexture() {
		let e = Math.sqrt(this._maxInstanceCount * 4);
		e = Math.ceil(e / 4) * 4, e = Math.max(e, 4);
		let t = new ns(new Float32Array(e * e * 4), e, e, bt, dt);
		this._matricesTexture = t;
	}
	_initIndirectTexture() {
		let e = Math.sqrt(this._maxInstanceCount);
		e = Math.ceil(e);
		let t = new ns(new Uint32Array(e * e), e, e, wt, ut);
		this._indirectTexture = t;
	}
	_initColorsTexture() {
		let e = Math.sqrt(this._maxInstanceCount);
		e = Math.ceil(e);
		let t = new ns(new Float32Array(e * e * 4).fill(1), e, e, bt, dt);
		t.colorSpace = G.workingColorSpace, this._colorsTexture = t;
	}
	_initializeGeometry(e) {
		let t = this.geometry, n = this._maxVertexCount, r = this._maxIndexCount;
		if (this._geometryInitialized === !1) {
			for (let r in e.attributes) {
				let { array: i, itemSize: a, normalized: o } = e.getAttribute(r), s = new Y(new i.constructor(n * a), a, o);
				t.setAttribute(r, s);
			}
			if (e.getIndex() !== null) {
				let e = n > 65535 ? new Uint32Array(r) : new Uint16Array(r);
				t.setIndex(new Y(e, 1));
			}
			this._geometryInitialized = !0;
		}
	}
	_validateGeometry(e) {
		let t = this.geometry;
		if (!!e.getIndex() != !!t.getIndex()) throw Error("THREE.BatchedMesh: All geometries must consistently have \"index\".");
		for (let n in t.attributes) {
			if (!e.hasAttribute(n)) throw Error(`THREE.BatchedMesh: Added geometry missing "${n}". All geometries must have consistent attributes.`);
			let r = e.getAttribute(n), i = t.getAttribute(n);
			if (r.itemSize !== i.itemSize || r.normalized !== i.normalized) throw Error("THREE.BatchedMesh: All attributes must have a consistent itemSize and normalized value.");
		}
	}
	validateInstanceId(e) {
		let t = this._instanceInfo;
		if (e < 0 || e >= t.length || t[e].active === !1) throw Error(`THREE.BatchedMesh: Invalid instanceId ${e}. Instance is either out of range or has been deleted.`);
	}
	validateGeometryId(e) {
		let t = this._geometryInfo;
		if (e < 0 || e >= t.length || t[e].active === !1) throw Error(`THREE.BatchedMesh: Invalid geometryId ${e}. Geometry is either out of range or has been deleted.`);
	}
	setCustomSort(e) {
		return this.customSort = e, this;
	}
	computeBoundingBox() {
		this.boundingBox === null && (this.boundingBox = new la());
		let e = this.boundingBox, t = this._instanceInfo;
		e.makeEmpty();
		for (let n = 0, r = t.length; n < r; n++) {
			if (t[n].active === !1) continue;
			let r = t[n].geometryIndex;
			this.getMatrixAt(n, ks), this.getBoundingBoxAt(r, Ns).applyMatrix4(ks), e.union(Ns);
		}
	}
	computeBoundingSphere() {
		this.boundingSphere === null && (this.boundingSphere = new Ua());
		let e = this.boundingSphere, t = this._instanceInfo;
		e.makeEmpty();
		for (let n = 0, r = t.length; n < r; n++) {
			if (t[n].active === !1) continue;
			let r = t[n].geometryIndex;
			this.getMatrixAt(n, ks), this.getBoundingSphereAt(r, Ps).applyMatrix4(ks), e.union(Ps);
		}
	}
	addInstance(e) {
		if (this._instanceInfo.length >= this.maxInstanceCount && this._availableInstanceIds.length === 0) throw Error("THREE.BatchedMesh: Maximum item count reached.");
		let t = {
			visible: !0,
			active: !0,
			geometryIndex: e
		}, n = null;
		this._availableInstanceIds.length > 0 ? (this._availableInstanceIds.sort(Ts), n = this._availableInstanceIds.shift(), this._instanceInfo[n] = t) : (n = this._instanceInfo.length, this._instanceInfo.push(t));
		let r = this._matricesTexture;
		ks.identity().toArray(r.image.data, n * 16), r.needsUpdate = !0;
		let i = this._colorsTexture;
		return i && (As.toArray(i.image.data, n * 4), i.needsUpdate = !0), this._visibilityChanged = !0, n;
	}
	addGeometry(e, t = -1, n = -1) {
		this._initializeGeometry(e), this._validateGeometry(e);
		let r = {
			vertexStart: -1,
			vertexCount: -1,
			reservedVertexCount: -1,
			indexStart: -1,
			indexCount: -1,
			reservedIndexCount: -1,
			start: -1,
			count: -1,
			boundingBox: null,
			boundingSphere: null,
			active: !0
		}, i = this._geometryInfo;
		r.vertexStart = this._nextVertexStart, r.reservedVertexCount = t === -1 ? e.getAttribute("position").count : t;
		let a = e.getIndex();
		if (a !== null && (r.indexStart = this._nextIndexStart, r.reservedIndexCount = n === -1 ? a.count : n), r.indexStart !== -1 && r.indexStart + r.reservedIndexCount > this._maxIndexCount || r.vertexStart + r.reservedVertexCount > this._maxVertexCount) throw Error("THREE.BatchedMesh: Reserved space request exceeds the maximum buffer size.");
		let o;
		return this._availableGeometryIds.length > 0 ? (this._availableGeometryIds.sort(Ts), o = this._availableGeometryIds.shift(), i[o] = r) : (o = this._geometryCount, this._geometryCount++, i.push(r)), this.setGeometryAt(o, e), this._nextIndexStart = r.indexStart + r.reservedIndexCount, this._nextVertexStart = r.vertexStart + r.reservedVertexCount, o;
	}
	setGeometryAt(e, t) {
		if (e >= this._geometryCount) throw Error("THREE.BatchedMesh: Maximum geometry count reached.");
		this._validateGeometry(t);
		let n = this.geometry, r = n.getIndex() !== null, i = n.getIndex(), a = t.getIndex(), o = this._geometryInfo[e];
		if (r && a.count > o.reservedIndexCount || t.attributes.position.count > o.reservedVertexCount) throw Error("THREE.BatchedMesh: Reserved space not large enough for provided geometry.");
		let s = o.vertexStart, c = o.reservedVertexCount;
		o.vertexCount = t.getAttribute("position").count;
		for (let e in n.attributes) {
			let r = t.getAttribute(e), i = n.getAttribute(e);
			Vs(r, i, s);
			let a = r.itemSize;
			for (let e = r.count, t = c; e < t; e++) {
				let t = s + e;
				for (let e = 0; e < a; e++) i.setComponent(t, e, 0);
			}
			i.needsUpdate = !0, i.addUpdateRange(s * a, c * a);
		}
		if (r) {
			let e = o.indexStart, n = o.reservedIndexCount;
			o.indexCount = t.getIndex().count;
			for (let t = 0; t < a.count; t++) i.setX(e + t, s + a.getX(t));
			for (let t = a.count, r = n; t < r; t++) i.setX(e + t, s);
			i.needsUpdate = !0, i.addUpdateRange(e, o.reservedIndexCount);
		}
		return o.start = r ? o.indexStart : o.vertexStart, o.count = r ? o.indexCount : o.vertexCount, o.boundingBox = null, t.boundingBox !== null && (o.boundingBox = t.boundingBox.clone()), o.boundingSphere = null, t.boundingSphere !== null && (o.boundingSphere = t.boundingSphere.clone()), this._visibilityChanged = !0, e;
	}
	deleteGeometry(e) {
		let t = this._geometryInfo;
		if (e >= t.length || t[e].active === !1) return this;
		let n = this._instanceInfo;
		for (let t = 0, r = n.length; t < r; t++) n[t].active && n[t].geometryIndex === e && this.deleteInstance(t);
		return t[e].active = !1, this._availableGeometryIds.push(e), this._visibilityChanged = !0, this;
	}
	deleteInstance(e) {
		return this.validateInstanceId(e), this._instanceInfo[e].active = !1, this._availableInstanceIds.push(e), this._visibilityChanged = !0, this;
	}
	optimize() {
		let e = 0, t = 0, n = this._geometryInfo, r = n.map((e, t) => t).sort((e, t) => n[e].vertexStart - n[t].vertexStart), i = this.geometry;
		for (let a = 0, o = n.length; a < o; a++) {
			let o = n[r[a]];
			if (o.active !== !1) {
				if (i.index !== null) {
					if (o.indexStart !== t) {
						let { indexStart: n, vertexStart: r, reservedIndexCount: a } = o, s = i.index, c = s.array, l = e - r;
						for (let e = n; e < n + a; e++) c[e] = c[e] + l;
						s.array.copyWithin(t, n, n + a), s.addUpdateRange(t, a), s.needsUpdate = !0, o.indexStart = t;
					}
					t += o.reservedIndexCount;
				}
				if (o.vertexStart !== e) {
					let { vertexStart: t, reservedVertexCount: n } = o, r = i.attributes;
					for (let i in r) {
						let a = r[i], { array: o, itemSize: s } = a;
						o.copyWithin(e * s, t * s, (t + n) * s), a.addUpdateRange(e * s, n * s), a.needsUpdate = !0;
					}
					o.vertexStart = e;
				}
				e += o.reservedVertexCount, o.start = i.index ? o.indexStart : o.vertexStart;
			}
		}
		return this._nextIndexStart = t, this._nextVertexStart = e, this._visibilityChanged = !0, this;
	}
	getBoundingBoxAt(e, t) {
		if (e >= this._geometryCount) return null;
		let n = this.geometry, r = this._geometryInfo[e];
		if (r.boundingBox === null) {
			let e = new la(), t = n.index, i = n.attributes.position;
			for (let n = r.start, a = r.start + r.count; n < a; n++) {
				let r = n;
				t && (r = t.getX(r)), e.expandByPoint(Fs.fromBufferAttribute(i, r));
			}
			r.boundingBox = e;
		}
		return t.copy(r.boundingBox), t;
	}
	getBoundingSphereAt(e, t) {
		if (e >= this._geometryCount) return null;
		let n = this.geometry, r = this._geometryInfo[e];
		if (r.boundingSphere === null) {
			let t = new Ua();
			this.getBoundingBoxAt(e, Ns), Ns.getCenter(t.center);
			let i = n.index, a = n.attributes.position, o = 0;
			for (let e = r.start, n = r.start + r.count; e < n; e++) {
				let n = e;
				i && (n = i.getX(n)), Fs.fromBufferAttribute(a, n), o = Math.max(o, t.center.distanceToSquared(Fs));
			}
			t.radius = Math.sqrt(o), r.boundingSphere = t;
		}
		return t.copy(r.boundingSphere), t;
	}
	setMatrixAt(e, t) {
		this.validateInstanceId(e);
		let n = this._matricesTexture, r = this._matricesTexture.image.data;
		return t.toArray(r, e * 16), n.needsUpdate = !0, this;
	}
	getMatrixAt(e, t) {
		return this.validateInstanceId(e), t.fromArray(this._matricesTexture.image.data, e * 16);
	}
	setColorAt(e, t) {
		return this.validateInstanceId(e), this._colorsTexture === null && this._initColorsTexture(), t.toArray(this._colorsTexture.image.data, e * 4), this._colorsTexture.needsUpdate = !0, this;
	}
	getColorAt(e, t) {
		return this.validateInstanceId(e), this._colorsTexture === null ? t.isVector4 ? t.set(1, 1, 1, 1) : t.setRGB(1, 1, 1) : t.fromArray(this._colorsTexture.image.data, e * 4);
	}
	setVisibleAt(e, t) {
		return this.validateInstanceId(e), this._instanceInfo[e].visible === t ? this : (this._instanceInfo[e].visible = t, this._visibilityChanged = !0, this);
	}
	getVisibleAt(e) {
		return this.validateInstanceId(e), this._instanceInfo[e].visible;
	}
	setGeometryIdAt(e, t) {
		return this.validateInstanceId(e), this.validateGeometryId(t), this._instanceInfo[e].geometryIndex = t, this;
	}
	getGeometryIdAt(e) {
		return this.validateInstanceId(e), this._instanceInfo[e].geometryIndex;
	}
	getGeometryRangeAt(e, t = {}) {
		this.validateGeometryId(e);
		let n = this._geometryInfo[e];
		return t.vertexStart = n.vertexStart, t.vertexCount = n.vertexCount, t.reservedVertexCount = n.reservedVertexCount, t.indexStart = n.indexStart, t.indexCount = n.indexCount, t.reservedIndexCount = n.reservedIndexCount, t.start = n.start, t.count = n.count, t;
	}
	setInstanceCount(e) {
		let t = this._availableInstanceIds, n = this._instanceInfo;
		for (t.sort(Ts); t[t.length - 1] === n.length - 1;) n.pop(), t.pop();
		if (e < n.length) throw Error(`THREE.BatchedMesh: Instance ids outside the range ${e} are being used. Cannot shrink instance count.`);
		let r = new Int32Array(e), i = new Int32Array(e);
		Hs(this._multiDrawCounts, r), Hs(this._multiDrawStarts, i), this._multiDrawCounts = r, this._multiDrawStarts = i, this._maxInstanceCount = e;
		let a = this._indirectTexture, o = this._matricesTexture, s = this._colorsTexture;
		a.dispose(), this._initIndirectTexture(), Hs(a.image.data, this._indirectTexture.image.data), o.dispose(), this._initMatricesTexture(), Hs(o.image.data, this._matricesTexture.image.data), s && (s.dispose(), this._initColorsTexture(), Hs(s.image.data, this._colorsTexture.image.data));
	}
	setGeometrySize(e, t) {
		let n = [...this._geometryInfo].filter((e) => e.active);
		if (Math.max(...n.map((e) => e.vertexStart + e.reservedVertexCount)) > e) throw Error(`THREE.BatchedMesh: Geometry vertex values are being used outside the range ${t}. Cannot shrink further.`);
		if (this.geometry.index && Math.max(...n.map((e) => e.indexStart + e.reservedIndexCount)) > t) throw Error(`THREE.BatchedMesh: Geometry index values are being used outside the range ${t}. Cannot shrink further.`);
		let r = this.geometry;
		r.dispose(), this._maxVertexCount = e, this._maxIndexCount = t, this._geometryInitialized && (this._geometryInitialized = !1, this.geometry = new Z(), this._initializeGeometry(r));
		let i = this.geometry;
		r.index && Hs(r.index.array, i.index.array);
		for (let e in r.attributes) Hs(r.attributes[e].array, i.attributes[e].array);
	}
	raycast(e, t) {
		let n = this._instanceInfo, r = this._geometryInfo, i = this.matrixWorld, a = this.geometry;
		zs.material = this.material, zs.geometry.index = a.index, zs.geometry.attributes = a.attributes, zs.geometry.boundingBox === null && (zs.geometry.boundingBox = new la()), zs.geometry.boundingSphere === null && (zs.geometry.boundingSphere = new Ua());
		for (let a = 0, o = n.length; a < o; a++) {
			if (!n[a].visible || !n[a].active) continue;
			let o = n[a].geometryIndex, s = r[o];
			zs.geometry.setDrawRange(s.start, s.count), this.getMatrixAt(a, zs.matrixWorld).premultiply(i), this.getBoundingBoxAt(o, zs.geometry.boundingBox), this.getBoundingSphereAt(o, zs.geometry.boundingSphere), zs.raycast(e, Bs);
			for (let e = 0, n = Bs.length; e < n; e++) {
				let n = Bs[e];
				n.object = this, n.batchId = a, t.push(n);
			}
			Bs.length = 0;
		}
		zs.material = null, zs.geometry.index = null, zs.geometry.attributes = {}, zs.geometry.setDrawRange(0, Infinity);
	}
	copy(e) {
		return super.copy(e), this.geometry = e.geometry.clone(), this.perObjectFrustumCulled = e.perObjectFrustumCulled, this.sortObjects = e.sortObjects, this.boundingBox = e.boundingBox === null ? null : e.boundingBox.clone(), this.boundingSphere = e.boundingSphere === null ? null : e.boundingSphere.clone(), this._geometryInfo = e._geometryInfo.map((e) => ({
			...e,
			boundingBox: e.boundingBox === null ? null : e.boundingBox.clone(),
			boundingSphere: e.boundingSphere === null ? null : e.boundingSphere.clone()
		})), this._instanceInfo = e._instanceInfo.map((e) => ({ ...e })), this._availableInstanceIds = e._availableInstanceIds.slice(), this._availableGeometryIds = e._availableGeometryIds.slice(), this._nextIndexStart = e._nextIndexStart, this._nextVertexStart = e._nextVertexStart, this._geometryCount = e._geometryCount, this._maxInstanceCount = e._maxInstanceCount, this._maxVertexCount = e._maxVertexCount, this._maxIndexCount = e._maxIndexCount, this._geometryInitialized = e._geometryInitialized, this._multiDrawCounts = e._multiDrawCounts.slice(), this._multiDrawStarts = e._multiDrawStarts.slice(), this._indirectTexture = e._indirectTexture.clone(), this._indirectTexture.image.data = this._indirectTexture.image.data.slice(), this._matricesTexture = e._matricesTexture.clone(), this._matricesTexture.image.data = this._matricesTexture.image.data.slice(), this._colorsTexture !== null && (this._colorsTexture = e._colorsTexture.clone(), this._colorsTexture.image.data = this._colorsTexture.image.data.slice()), this;
	}
	dispose() {
		this.geometry.dispose(), this._matricesTexture.dispose(), this._matricesTexture = null, this._indirectTexture.dispose(), this._indirectTexture = null, this._colorsTexture !== null && (this._colorsTexture.dispose(), this._colorsTexture = null);
	}
	onBeforeRender(e, t, n, r, i) {
		if (!this._visibilityChanged && !this.perObjectFrustumCulled && !this.sortObjects) return;
		let a = r.getIndex(), o = a === null ? 1 : a.array.BYTES_PER_ELEMENT, s = 1;
		i.wireframe && (s = 2, o = r.attributes.position.count > 65535 ? 4 : 2);
		let c = this._instanceInfo, l = this._multiDrawStarts, u = this._multiDrawCounts, d = this._geometryInfo, f = this.perObjectFrustumCulled, p = this._indirectTexture, m = p.image.data, h = n.isArrayCamera ? Ms : js;
		f && (n.isArrayCamera ? h.setFromArrayCamera(n) : (ks.multiplyMatrices(n.projectionMatrix, n.matrixWorldInverse).multiply(this.matrixWorld), h.setFromProjectionMatrix(ks, n.coordinateSystem, n.reversedDepth)));
		let g = 0;
		if (this.sortObjects) {
			ks.copy(this.matrixWorld).invert(), Fs.setFromMatrixPosition(n.matrixWorld).applyMatrix4(ks), Is.set(0, 0, -1).transformDirection(n.matrixWorld).transformDirection(ks);
			for (let e = 0, t = c.length; e < t; e++) if (c[e].visible && c[e].active) {
				let t = c[e].geometryIndex;
				this.getMatrixAt(e, ks), this.getBoundingSphereAt(t, Ps).applyMatrix4(ks);
				let n = !1;
				if (f && (n = !h.intersectsSphere(Ps)), !n) {
					let n = d[t], r = Ls.subVectors(Ps.center, Fs).dot(Is);
					Rs.push(n.start, n.count, r, e);
				}
			}
			let e = Rs.list, t = this.customSort;
			t === null ? e.sort(i.transparent ? Ds : Es) : t.call(this, e, n);
			for (let t = 0, n = e.length; t < n; t++) {
				let n = e[t];
				l[g] = n.start * o * s, u[g] = n.count * s, m[g] = n.index, g++;
			}
			Rs.reset();
		} else for (let e = 0, t = c.length; e < t; e++) if (c[e].visible && c[e].active) {
			let t = c[e].geometryIndex, n = !1;
			if (f && (this.getMatrixAt(e, ks), this.getBoundingSphereAt(t, Ps).applyMatrix4(ks), n = !h.intersectsSphere(Ps)), !n) {
				let n = d[t];
				l[g] = n.start * o * s, u[g] = n.count * s, m[g] = e, g++;
			}
		}
		p.needsUpdate = !0, this._multiDrawCount = g, this._visibilityChanged = !1;
	}
	onBeforeShadow(e, t, n, r, i, a) {
		this.onBeforeRender(e, null, r, i, a);
	}
}, Ws = class extends to {
	constructor(e) {
		super(), this.isLineBasicMaterial = !0, this.type = "LineBasicMaterial", this.color = new J(16777215), this.map = null, this.linewidth = 1, this.linecap = "round", this.linejoin = "round", this.fog = !0, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.color.copy(e.color), this.map = e.map, this.linewidth = e.linewidth, this.linecap = e.linecap, this.linejoin = e.linejoin, this.fog = e.fog, this;
	}
}, Gs = /*@__PURE__*/ new U(), Ks = /*@__PURE__*/ new U(), qs = /*@__PURE__*/ new K(), Js = /*@__PURE__*/ new ko(), Ys = /*@__PURE__*/ new Ua(), Xs = /*@__PURE__*/ new U(), Zs = /*@__PURE__*/ new U(), Qs = class extends q {
	constructor(e = new Z(), t = new Ws()) {
		super(), this.isLine = !0, this.type = "Line", this.geometry = e, this.material = t, this.morphTargetDictionary = void 0, this.morphTargetInfluences = void 0, this.updateMorphTargets();
	}
	copy(e, t) {
		return super.copy(e, t), this.material = Array.isArray(e.material) ? e.material.slice() : e.material, this.geometry = e.geometry, this;
	}
	computeLineDistances() {
		let e = this.geometry;
		if (e.index === null) {
			let t = e.attributes.position, n = [0];
			for (let e = 1, r = t.count; e < r; e++) Gs.fromBufferAttribute(t, e - 1), Ks.fromBufferAttribute(t, e), n[e] = n[e - 1], n[e] += Gs.distanceTo(Ks);
			e.setAttribute("lineDistance", new X(n, 1));
		} else R("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");
		return this;
	}
	raycast(e, t) {
		let n = this.geometry, r = this.matrixWorld, i = e.params.Line.threshold, a = n.drawRange;
		if (n.boundingSphere === null && n.computeBoundingSphere(), Ys.copy(n.boundingSphere), Ys.applyMatrix4(r), Ys.radius += i, e.ray.intersectsSphere(Ys) === !1) return;
		qs.copy(r).invert(), Js.copy(e.ray).applyMatrix4(qs);
		let o = i / ((this.scale.x + this.scale.y + this.scale.z) / 3), s = o * o, c = this.isLineSegments ? 2 : 1, l = n.index, u = n.attributes.position;
		if (l !== null) {
			let n = Math.max(0, a.start), r = Math.min(l.count, a.start + a.count);
			for (let i = n, a = r - 1; i < a; i += c) {
				let n = l.getX(i), r = l.getX(i + 1), a = $s(this, e, Js, s, n, r, i);
				a && t.push(a);
			}
			if (this.isLineLoop) {
				let i = l.getX(r - 1), a = l.getX(n), o = $s(this, e, Js, s, i, a, r - 1);
				o && t.push(o);
			}
		} else {
			let n = Math.max(0, a.start), r = Math.min(u.count, a.start + a.count);
			for (let i = n, a = r - 1; i < a; i += c) {
				let n = $s(this, e, Js, s, i, i + 1, i);
				n && t.push(n);
			}
			if (this.isLineLoop) {
				let i = $s(this, e, Js, s, r - 1, n, r - 1);
				i && t.push(i);
			}
		}
	}
	updateMorphTargets() {
		let e = this.geometry.morphAttributes, t = Object.keys(e);
		if (t.length > 0) {
			let n = e[t[0]];
			if (n !== void 0) {
				this.morphTargetInfluences = [], this.morphTargetDictionary = {};
				for (let e = 0, t = n.length; e < t; e++) {
					let t = n[e].name || String(e);
					this.morphTargetInfluences.push(0), this.morphTargetDictionary[t] = e;
				}
			}
		}
	}
};
function $s(e, t, n, r, i, a, o) {
	let s = e.geometry.attributes.position;
	if (Gs.fromBufferAttribute(s, i), Ks.fromBufferAttribute(s, a), n.distanceSqToSegment(Gs, Ks, Xs, Zs) > r) return;
	Xs.applyMatrix4(e.matrixWorld);
	let c = t.ray.origin.distanceTo(Xs);
	if (!(c < t.near || c > t.far)) return {
		distance: c,
		point: Zs.clone().applyMatrix4(e.matrixWorld),
		index: o,
		face: null,
		faceIndex: null,
		barycoord: null,
		object: e
	};
}
var ec = /*@__PURE__*/ new U(), tc = /*@__PURE__*/ new U(), nc = class extends Qs {
	constructor(e, t) {
		super(e, t), this.isLineSegments = !0, this.type = "LineSegments";
	}
	computeLineDistances() {
		let e = this.geometry;
		if (e.index === null) {
			let t = e.attributes.position, n = [];
			for (let e = 0, r = t.count; e < r; e += 2) ec.fromBufferAttribute(t, e), tc.fromBufferAttribute(t, e + 1), n[e] = e === 0 ? 0 : n[e - 1], n[e + 1] = n[e] + ec.distanceTo(tc);
			e.setAttribute("lineDistance", new X(n, 1));
		} else R("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");
		return this;
	}
}, rc = class extends Qs {
	constructor(e, t) {
		super(e, t), this.isLineLoop = !0, this.type = "LineLoop";
	}
}, ic = class extends to {
	constructor(e) {
		super(), this.isPointsMaterial = !0, this.type = "PointsMaterial", this.color = new J(16777215), this.map = null, this.alphaMap = null, this.size = 1, this.sizeAttenuation = !0, this.fog = !0, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.color.copy(e.color), this.map = e.map, this.alphaMap = e.alphaMap, this.size = e.size, this.sizeAttenuation = e.sizeAttenuation, this.fog = e.fog, this;
	}
}, ac = /*@__PURE__*/ new K(), oc = /*@__PURE__*/ new ko(), sc = /*@__PURE__*/ new Ua(), cc = /*@__PURE__*/ new U(), lc = class extends q {
	constructor(e = new Z(), t = new ic()) {
		super(), this.isPoints = !0, this.type = "Points", this.geometry = e, this.material = t, this.morphTargetDictionary = void 0, this.morphTargetInfluences = void 0, this.updateMorphTargets();
	}
	copy(e, t) {
		return super.copy(e, t), this.material = Array.isArray(e.material) ? e.material.slice() : e.material, this.geometry = e.geometry, this;
	}
	raycast(e, t) {
		let n = this.geometry, r = this.matrixWorld, i = e.params.Points.threshold, a = n.drawRange;
		if (n.boundingSphere === null && n.computeBoundingSphere(), sc.copy(n.boundingSphere), sc.applyMatrix4(r), sc.radius += i, e.ray.intersectsSphere(sc) === !1) return;
		ac.copy(r).invert(), oc.copy(e.ray).applyMatrix4(ac);
		let o = i / ((this.scale.x + this.scale.y + this.scale.z) / 3), s = o * o, c = n.index, l = n.attributes.position;
		if (c !== null) {
			let n = Math.max(0, a.start), i = Math.min(c.count, a.start + a.count);
			for (let a = n, o = i; a < o; a++) {
				let n = c.getX(a);
				cc.fromBufferAttribute(l, n), uc(cc, n, s, r, e, t, this);
			}
		} else {
			let n = Math.max(0, a.start), i = Math.min(l.count, a.start + a.count);
			for (let a = n, o = i; a < o; a++) cc.fromBufferAttribute(l, a), uc(cc, a, s, r, e, t, this);
		}
	}
	updateMorphTargets() {
		let e = this.geometry.morphAttributes, t = Object.keys(e);
		if (t.length > 0) {
			let n = e[t[0]];
			if (n !== void 0) {
				this.morphTargetInfluences = [], this.morphTargetDictionary = {};
				for (let e = 0, t = n.length; e < t; e++) {
					let t = n[e].name || String(e);
					this.morphTargetInfluences.push(0), this.morphTargetDictionary[t] = e;
				}
			}
		}
	}
};
function uc(e, t, n, r, i, a, o) {
	let s = oc.distanceSqToPoint(e);
	if (s < n) {
		let n = new U();
		oc.closestPointToPoint(e, n), n.applyMatrix4(r);
		let c = i.ray.origin.distanceTo(n);
		if (c < i.near || c > i.far) return;
		a.push({
			distance: c,
			distanceToRay: Math.sqrt(s),
			point: n,
			index: t,
			face: null,
			faceIndex: null,
			barycoord: null,
			object: o
		});
	}
}
var dc = class extends ii {
	constructor(e, t, n, r, i = et, a = et, o, s, c) {
		super(e, t, n, r, i, a, o, s, c), this.isVideoTexture = !0, this.generateMipmaps = !1, this._requestVideoFrameCallbackId = 0;
		let l = this;
		function u() {
			l.needsUpdate = !0, l._requestVideoFrameCallbackId = e.requestVideoFrameCallback(u);
		}
		"requestVideoFrameCallback" in e && (this._requestVideoFrameCallbackId = e.requestVideoFrameCallback(u));
	}
	clone() {
		return new this.constructor(this.image).copy(this);
	}
	update() {
		let e = this.image;
		!("requestVideoFrameCallback" in e) && e.readyState >= e.HAVE_CURRENT_DATA && (this.needsUpdate = !0);
	}
	dispose() {
		this._requestVideoFrameCallbackId !== 0 && (this.source.data.cancelVideoFrameCallback(this._requestVideoFrameCallbackId), this._requestVideoFrameCallbackId = 0), super.dispose();
	}
}, fc = class extends dc {
	constructor(e, t, n, r, i, a, o, s) {
		super({}, e, t, n, r, i, a, o, s), this.isVideoFrameTexture = !0;
	}
	update() {}
	clone() {
		return new this.constructor().copy(this);
	}
	setFrame(e) {
		this.image = e, this.needsUpdate = !0;
	}
}, pc = class extends ii {
	constructor(e, t) {
		super({
			width: e,
			height: t
		}), this.isFramebufferTexture = !0, this.magFilter = Ye, this.minFilter = Ye, this.generateMipmaps = !1, this.needsUpdate = !0;
	}
}, mc = class extends ii {
	constructor(e, t, n, r, i, a, o, s, c, l, u, d) {
		super(null, a, o, s, c, l, r, i, u, d), this.isCompressedTexture = !0, this.image = {
			width: t,
			height: n
		}, this.mipmaps = e, this.flipY = !1, this.generateMipmaps = !1;
	}
}, hc = class extends mc {
	constructor(e, t, n, r, i, a) {
		super(e, t, n, i, a), this.isCompressedArrayTexture = !0, this.image.depth = r, this.wrapR = qe, this.layerUpdates = /* @__PURE__ */ new Set();
	}
	addLayerUpdate(e) {
		this.layerUpdates.add(e);
	}
	clearLayerUpdates() {
		this.layerUpdates.clear();
	}
}, gc = class extends mc {
	constructor(e, t, n) {
		super(void 0, e[0].width, e[0].height, t, n, 301), this.isCompressedCubeTexture = !0, this.isCubeTexture = !0, this.image = e;
	}
}, _c = class extends ii {
	constructor(e = [], t = 301, n, r, i, a, o, s, c, l) {
		super(e, t, n, r, i, a, o, s, c, l), this.isCubeTexture = !0, this.flipY = !1;
	}
	get images() {
		return this.image;
	}
	set images(e) {
		this.image = e;
	}
}, vc = class extends ii {
	constructor(e, t, n, r, i, a, o, s, c) {
		super(e, t, n, r, i, a, o, s, c), this.isCanvasTexture = !0, this.needsUpdate = !0;
	}
}, yc = class extends ii {
	constructor(e, t, n, r, i, a, o, s, c) {
		super(e, t, n, r, i, a, o, s, c), this.isHTMLTexture = !0, this.generateMipmaps = !1, this.needsUpdate = !0;
		let l = e ? e.parentNode : null;
		l !== null && "requestPaint" in l && (l.onpaint = () => {
			this.needsUpdate = !0;
		}, l.requestPaint());
	}
	dispose() {
		let e = this.image ? this.image.parentNode : null;
		e !== null && "onpaint" in e && (e.onpaint = null), super.dispose();
	}
}, bc = class extends ii {
	constructor(e, t, n = ut, r, i, a, o = Ye, s = Ye, c, l = xt, u = 1) {
		if (l !== 1026 && l !== 1027) throw Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");
		super({
			width: e,
			height: t,
			depth: u
		}, r, i, a, o, s, l, n, c), this.isDepthTexture = !0, this.flipY = !1, this.generateMipmaps = !1, this.compareFunction = null;
	}
	copy(e) {
		return super.copy(e), this.source = new ei(Object.assign({}, e.image)), this.compareFunction = e.compareFunction, this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return this.compareFunction !== null && (t.compareFunction = this.compareFunction), t;
	}
}, xc = class extends bc {
	constructor(e, t = ut, n = 301, r, i, a = Ye, o = Ye, s, c = xt) {
		let l = {
			width: e,
			height: e,
			depth: 1
		}, u = [
			l,
			l,
			l,
			l,
			l,
			l
		];
		super(e, e, t, n, r, i, a, o, s, c), this.image = u, this.isCubeDepthTexture = !0, this.isCubeTexture = !0;
	}
	get images() {
		return this.image;
	}
	set images(e) {
		this.image = e;
	}
}, Sc = class extends ii {
	constructor(e = null) {
		super(), this.sourceTexture = e, this.isExternalTexture = !0;
	}
	copy(e) {
		return super.copy(e), this.sourceTexture = e.sourceTexture, this;
	}
}, Cc = class e extends Z {
	constructor(e = 1, t = 1, n = 1, r = 1, i = 1, a = 1) {
		super(), this.type = "BoxGeometry", this.parameters = {
			width: e,
			height: t,
			depth: n,
			widthSegments: r,
			heightSegments: i,
			depthSegments: a
		};
		let o = this;
		r = Math.floor(r), i = Math.floor(i), a = Math.floor(a);
		let s = [], c = [], l = [], u = [], d = 0, f = 0;
		p("z", "y", "x", -1, -1, n, t, e, a, i, 0), p("z", "y", "x", 1, -1, n, t, -e, a, i, 1), p("x", "z", "y", 1, 1, e, n, t, r, a, 2), p("x", "z", "y", 1, -1, e, n, -t, r, a, 3), p("x", "y", "z", 1, -1, e, t, n, r, i, 4), p("x", "y", "z", -1, -1, e, t, -n, r, i, 5), this.setIndex(s), this.setAttribute("position", new X(c, 3)), this.setAttribute("normal", new X(l, 3)), this.setAttribute("uv", new X(u, 2));
		function p(e, t, n, r, i, a, p, m, h, g, _) {
			let v = a / h, y = p / g, b = a / 2, x = p / 2, S = m / 2, C = h + 1, w = g + 1, T = 0, E = 0, D = new U();
			for (let a = 0; a < w; a++) {
				let o = a * y - x;
				for (let s = 0; s < C; s++) D[e] = (s * v - b) * r, D[t] = o * i, D[n] = S, c.push(D.x, D.y, D.z), D[e] = 0, D[t] = 0, D[n] = m > 0 ? 1 : -1, l.push(D.x, D.y, D.z), u.push(s / h), u.push(1 - a / g), T += 1;
			}
			for (let e = 0; e < g; e++) for (let t = 0; t < h; t++) {
				let n = d + t + C * e, r = d + t + C * (e + 1), i = d + (t + 1) + C * (e + 1), a = d + (t + 1) + C * e;
				s.push(n, r, a), s.push(r, i, a), E += 6;
			}
			o.addGroup(f, E, _), f += E, d += T;
		}
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.width, t.height, t.depth, t.widthSegments, t.heightSegments, t.depthSegments);
	}
}, wc = class e extends Z {
	constructor(e = 1, t = 1, n = 4, r = 8, i = 1) {
		super(), this.type = "CapsuleGeometry", this.parameters = {
			radius: e,
			height: t,
			capSegments: n,
			radialSegments: r,
			heightSegments: i
		}, t = Math.max(0, t), n = Math.max(1, Math.floor(n)), r = Math.max(3, Math.floor(r)), i = Math.max(1, Math.floor(i));
		let a = [], o = [], s = [], c = [], l = t / 2, u = Math.PI / 2 * e, d = t, f = 2 * u + d, p = n * 2 + i, m = r + 1, h = new U(), g = new U();
		for (let _ = 0; _ <= p; _++) {
			let v = 0, y = 0, b = 0, x = 0;
			if (_ <= n) {
				let t = _ / n, r = t * Math.PI / 2;
				y = -l - e * Math.cos(r), b = e * Math.sin(r), x = -e * Math.cos(r), v = t * u;
			} else if (_ <= n + i) {
				let r = (_ - n) / i;
				y = -l + r * t, b = e, x = 0, v = u + r * d;
			} else {
				let t = (_ - n - i) / n, r = t * Math.PI / 2;
				y = l + e * Math.sin(r), b = e * Math.cos(r), x = e * Math.sin(r), v = u + d + t * u;
			}
			let S = Math.max(0, Math.min(1, v / f)), C = 0;
			_ === 0 ? C = .5 / r : _ === p && (C = -.5 / r);
			for (let e = 0; e <= r; e++) {
				let t = e / r, n = t * Math.PI * 2, i = Math.sin(n), a = Math.cos(n);
				g.x = -b * a, g.y = y, g.z = b * i, o.push(g.x, g.y, g.z), h.set(-b * a, x, b * i), h.normalize(), s.push(h.x, h.y, h.z), c.push(t + C, S);
			}
			if (_ > 0) {
				let e = (_ - 1) * m;
				for (let t = 0; t < r; t++) {
					let n = e + t, r = e + t + 1, i = _ * m + t, o = _ * m + t + 1;
					a.push(n, r, i), a.push(r, o, i);
				}
			}
		}
		this.setIndex(a), this.setAttribute("position", new X(o, 3)), this.setAttribute("normal", new X(s, 3)), this.setAttribute("uv", new X(c, 2));
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.radius, t.height, t.capSegments, t.radialSegments, t.heightSegments);
	}
}, Tc = class e extends Z {
	constructor(e = 1, t = 32, n = 0, r = Math.PI * 2) {
		super(), this.type = "CircleGeometry", this.parameters = {
			radius: e,
			segments: t,
			thetaStart: n,
			thetaLength: r
		}, t = Math.max(3, t);
		let i = [], a = [], o = [], s = [], c = new U(), l = new H();
		a.push(0, 0, 0), o.push(0, 0, 1), s.push(.5, .5);
		for (let i = 0, u = 3; i <= t; i++, u += 3) {
			let d = n + i / t * r;
			c.x = e * Math.cos(d), c.y = e * Math.sin(d), a.push(c.x, c.y, c.z), o.push(0, 0, 1), l.x = (a[u] / e + 1) / 2, l.y = (a[u + 1] / e + 1) / 2, s.push(l.x, l.y);
		}
		for (let e = 1; e <= t; e++) i.push(e, e + 1, 0);
		this.setIndex(i), this.setAttribute("position", new X(a, 3)), this.setAttribute("normal", new X(o, 3)), this.setAttribute("uv", new X(s, 2));
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.radius, t.segments, t.thetaStart, t.thetaLength);
	}
}, Ec = class e extends Z {
	constructor(e = 1, t = 1, n = 1, r = 32, i = 1, a = !1, o = 0, s = Math.PI * 2) {
		super(), this.type = "CylinderGeometry", this.parameters = {
			radiusTop: e,
			radiusBottom: t,
			height: n,
			radialSegments: r,
			heightSegments: i,
			openEnded: a,
			thetaStart: o,
			thetaLength: s
		};
		let c = this;
		r = Math.floor(r), i = Math.floor(i);
		let l = [], u = [], d = [], f = [], p = 0, m = [], h = n / 2, g = 0;
		_(), a === !1 && (e > 0 && v(!0), t > 0 && v(!1)), this.setIndex(l), this.setAttribute("position", new X(u, 3)), this.setAttribute("normal", new X(d, 3)), this.setAttribute("uv", new X(f, 2));
		function _() {
			let a = new U(), _ = new U(), v = 0, y = (t - e) / n;
			for (let c = 0; c <= i; c++) {
				let l = [], g = c / i, v = g * (t - e) + e;
				for (let e = 0; e <= r; e++) {
					let t = e / r, i = t * s + o, c = Math.sin(i), m = Math.cos(i);
					_.x = v * c, _.y = -g * n + h, _.z = v * m, u.push(_.x, _.y, _.z), a.set(c, y, m).normalize(), d.push(a.x, a.y, a.z), f.push(t, 1 - g), l.push(p++);
				}
				m.push(l);
			}
			for (let n = 0; n < r; n++) for (let r = 0; r < i; r++) {
				let a = m[r][n], o = m[r + 1][n], s = m[r + 1][n + 1], c = m[r][n + 1];
				(e > 0 || r !== 0) && (l.push(a, o, c), v += 3), (t > 0 || r !== i - 1) && (l.push(o, s, c), v += 3);
			}
			c.addGroup(g, v, 0), g += v;
		}
		function v(n) {
			let i = p, a = new H(), m = new U(), _ = 0, v = n === !0 ? e : t, y = n === !0 ? 1 : -1;
			for (let e = 1; e <= r; e++) u.push(0, h * y, 0), d.push(0, y, 0), f.push(.5, .5), p++;
			let b = p;
			for (let e = 0; e <= r; e++) {
				let t = e / r * s + o, n = Math.cos(t), i = Math.sin(t);
				m.x = v * i, m.y = h * y, m.z = v * n, u.push(m.x, m.y, m.z), d.push(0, y, 0), a.x = n * .5 + .5, a.y = i * .5 * y + .5, f.push(a.x, a.y), p++;
			}
			for (let e = 0; e < r; e++) {
				let t = i + e, r = b + e;
				n === !0 ? l.push(r, r + 1, t) : l.push(r + 1, r, t), _ += 3;
			}
			c.addGroup(g, _, n === !0 ? 1 : 2), g += _;
		}
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.radiusTop, t.radiusBottom, t.height, t.radialSegments, t.heightSegments, t.openEnded, t.thetaStart, t.thetaLength);
	}
}, Dc = class e extends Ec {
	constructor(e = 1, t = 1, n = 32, r = 1, i = !1, a = 0, o = Math.PI * 2) {
		super(0, e, t, n, r, i, a, o), this.type = "ConeGeometry", this.parameters = {
			radius: e,
			height: t,
			radialSegments: n,
			heightSegments: r,
			openEnded: i,
			thetaStart: a,
			thetaLength: o
		};
	}
	static fromJSON(t) {
		return new e(t.radius, t.height, t.radialSegments, t.heightSegments, t.openEnded, t.thetaStart, t.thetaLength);
	}
}, Oc = class e extends Z {
	constructor(e = [], t = [], n = 1, r = 0) {
		super(), this.type = "PolyhedronGeometry", this.parameters = {
			vertices: e,
			indices: t,
			radius: n,
			detail: r
		};
		let i = [], a = [];
		o(r), c(n), l(), this.setAttribute("position", new X(i, 3)), this.setAttribute("normal", new X(i.slice(), 3)), this.setAttribute("uv", new X(a, 2)), r === 0 ? this.computeVertexNormals() : this.normalizeNormals();
		function o(e) {
			let n = new U(), r = new U(), i = new U();
			for (let a = 0; a < t.length; a += 3) f(t[a + 0], n), f(t[a + 1], r), f(t[a + 2], i), s(n, r, i, e);
		}
		function s(e, t, n, r) {
			let i = r + 1, a = [];
			for (let r = 0; r <= i; r++) {
				a[r] = [];
				let o = e.clone().lerp(n, r / i), s = t.clone().lerp(n, r / i), c = i - r;
				for (let e = 0; e <= c; e++) e === 0 && r === i ? a[r][e] = o : a[r][e] = o.clone().lerp(s, e / c);
			}
			for (let e = 0; e < i; e++) for (let t = 0; t < 2 * (i - e) - 1; t++) {
				let n = Math.floor(t / 2);
				t % 2 == 0 ? (d(a[e][n + 1]), d(a[e + 1][n]), d(a[e][n])) : (d(a[e][n + 1]), d(a[e + 1][n + 1]), d(a[e + 1][n]));
			}
		}
		function c(e) {
			let t = new U();
			for (let n = 0; n < i.length; n += 3) t.x = i[n + 0], t.y = i[n + 1], t.z = i[n + 2], t.normalize().multiplyScalar(e), i[n + 0] = t.x, i[n + 1] = t.y, i[n + 2] = t.z;
		}
		function l() {
			let e = new U();
			for (let t = 0; t < i.length; t += 3) {
				e.x = i[t + 0], e.y = i[t + 1], e.z = i[t + 2];
				let n = h(e) / 2 / Math.PI + .5, r = g(e) / Math.PI + .5;
				a.push(n, 1 - r);
			}
			p(), u();
		}
		function u() {
			for (let e = 0; e < a.length; e += 6) {
				let t = a[e + 0], n = a[e + 2], r = a[e + 4];
				Math.max(t, n, r) > .9 && Math.min(t, n, r) < .1 && (t < .2 && (a[e + 0] += 1), n < .2 && (a[e + 2] += 1), r < .2 && (a[e + 4] += 1));
			}
		}
		function d(e) {
			i.push(e.x, e.y, e.z);
		}
		function f(t, n) {
			let r = t * 3;
			n.x = e[r + 0], n.y = e[r + 1], n.z = e[r + 2];
		}
		function p() {
			let e = new U(), t = new U(), n = new U(), r = new U(), o = new H(), s = new H(), c = new H();
			for (let l = 0, u = 0; l < i.length; l += 9, u += 6) {
				e.set(i[l + 0], i[l + 1], i[l + 2]), t.set(i[l + 3], i[l + 4], i[l + 5]), n.set(i[l + 6], i[l + 7], i[l + 8]), o.set(a[u + 0], a[u + 1]), s.set(a[u + 2], a[u + 3]), c.set(a[u + 4], a[u + 5]), r.copy(e).add(t).add(n).divideScalar(3);
				let d = h(r);
				m(o, u + 0, e, d), m(s, u + 2, t, d), m(c, u + 4, n, d);
			}
		}
		function m(e, t, n, r) {
			r < 0 && e.x === 1 && (a[t] = e.x - 1), n.x === 0 && n.z === 0 && (a[t] = r / 2 / Math.PI + .5);
		}
		function h(e) {
			return Math.atan2(e.z, -e.x);
		}
		function g(e) {
			return Math.atan2(-e.y, Math.sqrt(e.x * e.x + e.z * e.z));
		}
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.vertices, t.indices, t.radius, t.detail);
	}
}, kc = class e extends Oc {
	constructor(e = 1, t = 0) {
		let n = (1 + Math.sqrt(5)) / 2, r = 1 / n, i = [
			-1,
			-1,
			-1,
			-1,
			-1,
			1,
			-1,
			1,
			-1,
			-1,
			1,
			1,
			1,
			-1,
			-1,
			1,
			-1,
			1,
			1,
			1,
			-1,
			1,
			1,
			1,
			0,
			-r,
			-n,
			0,
			-r,
			n,
			0,
			r,
			-n,
			0,
			r,
			n,
			-r,
			-n,
			0,
			-r,
			n,
			0,
			r,
			-n,
			0,
			r,
			n,
			0,
			-n,
			0,
			-r,
			n,
			0,
			-r,
			-n,
			0,
			r,
			n,
			0,
			r
		];
		super(i, [
			3,
			11,
			7,
			3,
			7,
			15,
			3,
			15,
			13,
			7,
			19,
			17,
			7,
			17,
			6,
			7,
			6,
			15,
			17,
			4,
			8,
			17,
			8,
			10,
			17,
			10,
			6,
			8,
			0,
			16,
			8,
			16,
			2,
			8,
			2,
			10,
			0,
			12,
			1,
			0,
			1,
			18,
			0,
			18,
			16,
			6,
			10,
			2,
			6,
			2,
			13,
			6,
			13,
			15,
			2,
			16,
			18,
			2,
			18,
			3,
			2,
			3,
			13,
			18,
			1,
			9,
			18,
			9,
			11,
			18,
			11,
			3,
			4,
			14,
			12,
			4,
			12,
			0,
			4,
			0,
			8,
			11,
			9,
			5,
			11,
			5,
			19,
			11,
			19,
			7,
			19,
			5,
			14,
			19,
			14,
			4,
			19,
			4,
			17,
			1,
			12,
			14,
			1,
			14,
			5,
			1,
			5,
			9
		], e, t), this.type = "DodecahedronGeometry", this.parameters = {
			radius: e,
			detail: t
		};
	}
	static fromJSON(t) {
		return new e(t.radius, t.detail);
	}
}, Ac = /*@__PURE__*/ new U(), jc = /*@__PURE__*/ new U(), Mc = /*@__PURE__*/ new U(), Nc = /*@__PURE__*/ new ca(), Pc = class extends Z {
	constructor(e = null, t = 1) {
		if (super(), this.type = "EdgesGeometry", this.parameters = {
			geometry: e,
			thresholdAngle: t
		}, e !== null) {
			let n = 10 ** 4, r = Math.cos(yr * t), i = e.getIndex(), a = e.getAttribute("position"), o = i ? i.count : a.count, s = [
				0,
				0,
				0
			], c = [
				"a",
				"b",
				"c"
			], l = [
				,
				,
				,
			], u = {}, d = [];
			for (let e = 0; e < o; e += 3) {
				i ? (s[0] = i.getX(e), s[1] = i.getX(e + 1), s[2] = i.getX(e + 2)) : (s[0] = e, s[1] = e + 1, s[2] = e + 2);
				let { a: t, b: o, c: f } = Nc;
				if (t.fromBufferAttribute(a, s[0]), o.fromBufferAttribute(a, s[1]), f.fromBufferAttribute(a, s[2]), Nc.getNormal(Mc), l[0] = `${Math.round(t.x * n)},${Math.round(t.y * n)},${Math.round(t.z * n)}`, l[1] = `${Math.round(o.x * n)},${Math.round(o.y * n)},${Math.round(o.z * n)}`, l[2] = `${Math.round(f.x * n)},${Math.round(f.y * n)},${Math.round(f.z * n)}`, !(l[0] === l[1] || l[1] === l[2] || l[2] === l[0])) for (let e = 0; e < 3; e++) {
					let t = (e + 1) % 3, n = l[e], i = l[t], a = Nc[c[e]], o = Nc[c[t]], f = `${n}_${i}`, p = `${i}_${n}`;
					p in u && u[p] ? (Mc.dot(u[p].normal) <= r && (d.push(a.x, a.y, a.z), d.push(o.x, o.y, o.z)), u[p] = null) : f in u || (u[f] = {
						index0: s[e],
						index1: s[t],
						normal: Mc.clone()
					});
				}
			}
			for (let e in u) if (u[e]) {
				let { index0: t, index1: n } = u[e];
				Ac.fromBufferAttribute(a, t), jc.fromBufferAttribute(a, n), d.push(Ac.x, Ac.y, Ac.z), d.push(jc.x, jc.y, jc.z);
			}
			this.setAttribute("position", new X(d, 3));
		}
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
}, Fc = class {
	constructor() {
		this.type = "Curve", this.arcLengthDivisions = 200, this.needsUpdate = !1, this.cacheArcLengths = null;
	}
	getPoint() {
		R("Curve: .getPoint() not implemented.");
	}
	getPointAt(e, t) {
		let n = this.getUtoTmapping(e);
		return this.getPoint(n, t);
	}
	getPoints(e = 5) {
		let t = [];
		for (let n = 0; n <= e; n++) t.push(this.getPoint(n / e));
		return t;
	}
	getSpacedPoints(e = 5) {
		let t = [];
		for (let n = 0; n <= e; n++) t.push(this.getPointAt(n / e));
		return t;
	}
	getLength() {
		let e = this.getLengths();
		return e[e.length - 1];
	}
	getLengths(e = this.arcLengthDivisions) {
		if (this.cacheArcLengths && this.cacheArcLengths.length === e + 1 && !this.needsUpdate) return this.cacheArcLengths;
		this.needsUpdate = !1;
		let t = [], n, r = this.getPoint(0), i = 0;
		t.push(0);
		for (let a = 1; a <= e; a++) n = this.getPoint(a / e), i += n.distanceTo(r), t.push(i), r = n;
		return this.cacheArcLengths = t, t;
	}
	updateArcLengths() {
		this.needsUpdate = !0, this.getLengths();
	}
	getUtoTmapping(e, t = null) {
		let n = this.getLengths(), r = 0, i = n.length, a;
		a = t || e * n[i - 1];
		let o = 0, s = i - 1, c;
		for (; o <= s;) if (r = Math.floor(o + (s - o) / 2), c = n[r] - a, c < 0) o = r + 1;
		else if (c > 0) s = r - 1;
		else {
			s = r;
			break;
		}
		if (r = s, n[r] === a) return r / (i - 1);
		let l = n[r], u = n[r + 1] - l, d = (a - l) / u;
		return (r + d) / (i - 1);
	}
	getTangent(e, t) {
		let n = 1e-4, r = e - n, i = e + n;
		r < 0 && (r = 0), i > 1 && (i = 1);
		let a = this.getPoint(r), o = this.getPoint(i), s = t || (a.isVector2 ? new H() : new U());
		return s.copy(o).sub(a).normalize(), s;
	}
	getTangentAt(e, t) {
		let n = this.getUtoTmapping(e);
		return this.getTangent(n, t);
	}
	computeFrenetFrames(e, t = !1) {
		let n = new U(), r = [], i = [], a = [], o = new U(), s = new K();
		for (let t = 0; t <= e; t++) {
			let n = t / e;
			r[t] = this.getTangentAt(n, new U());
		}
		i[0] = new U(), a[0] = new U();
		let c = Number.MAX_VALUE, l = Math.abs(r[0].x), u = Math.abs(r[0].y), d = Math.abs(r[0].z);
		l <= c && (c = l, n.set(1, 0, 0)), u <= c && (c = u, n.set(0, 1, 0)), d <= c && n.set(0, 0, 1), o.crossVectors(r[0], n).normalize(), i[0].crossVectors(r[0], o), a[0].crossVectors(r[0], i[0]);
		for (let t = 1; t <= e; t++) {
			if (i[t] = i[t - 1].clone(), a[t] = a[t - 1].clone(), o.crossVectors(r[t - 1], r[t]), o.length() > 2 ** -52) {
				o.normalize();
				let e = Math.acos(B(r[t - 1].dot(r[t]), -1, 1));
				i[t].applyMatrix4(s.makeRotationAxis(o, e));
			}
			a[t].crossVectors(r[t], i[t]);
		}
		if (t === !0) {
			let t = Math.acos(B(i[0].dot(i[e]), -1, 1));
			t /= e, r[0].dot(o.crossVectors(i[0], i[e])) > 0 && (t = -t);
			for (let n = 1; n <= e; n++) i[n].applyMatrix4(s.makeRotationAxis(r[n], t * n)), a[n].crossVectors(r[n], i[n]);
		}
		return {
			tangents: r,
			normals: i,
			binormals: a
		};
	}
	clone() {
		return new this.constructor().copy(this);
	}
	copy(e) {
		return this.arcLengthDivisions = e.arcLengthDivisions, this;
	}
	toJSON() {
		let e = { metadata: {
			version: 4.7,
			type: "Curve",
			generator: "Curve.toJSON"
		} };
		return e.arcLengthDivisions = this.arcLengthDivisions, e.type = this.type, e;
	}
	fromJSON(e) {
		return this.arcLengthDivisions = e.arcLengthDivisions, this;
	}
}, Ic = class extends Fc {
	constructor(e = 0, t = 0, n = 1, r = 1, i = 0, a = Math.PI * 2, o = !1, s = 0) {
		super(), this.isEllipseCurve = !0, this.type = "EllipseCurve", this.aX = e, this.aY = t, this.xRadius = n, this.yRadius = r, this.aStartAngle = i, this.aEndAngle = a, this.aClockwise = o, this.aRotation = s;
	}
	getPoint(e, t = new H()) {
		let n = t, r = Math.PI * 2, i = this.aEndAngle - this.aStartAngle, a = Math.abs(i) < 2 ** -52;
		for (; i < 0;) i += r;
		for (; i > r;) i -= r;
		i < 2 ** -52 && (i = a ? 0 : r), this.aClockwise === !0 && !a && (i === r ? i = -r : i -= r);
		let o = this.aStartAngle + e * i, s = this.aX + this.xRadius * Math.cos(o), c = this.aY + this.yRadius * Math.sin(o);
		if (this.aRotation !== 0) {
			let e = Math.cos(this.aRotation), t = Math.sin(this.aRotation), n = s - this.aX, r = c - this.aY;
			s = n * e - r * t + this.aX, c = n * t + r * e + this.aY;
		}
		return n.set(s, c);
	}
	copy(e) {
		return super.copy(e), this.aX = e.aX, this.aY = e.aY, this.xRadius = e.xRadius, this.yRadius = e.yRadius, this.aStartAngle = e.aStartAngle, this.aEndAngle = e.aEndAngle, this.aClockwise = e.aClockwise, this.aRotation = e.aRotation, this;
	}
	toJSON() {
		let e = super.toJSON();
		return e.aX = this.aX, e.aY = this.aY, e.xRadius = this.xRadius, e.yRadius = this.yRadius, e.aStartAngle = this.aStartAngle, e.aEndAngle = this.aEndAngle, e.aClockwise = this.aClockwise, e.aRotation = this.aRotation, e;
	}
	fromJSON(e) {
		return super.fromJSON(e), this.aX = e.aX, this.aY = e.aY, this.xRadius = e.xRadius, this.yRadius = e.yRadius, this.aStartAngle = e.aStartAngle, this.aEndAngle = e.aEndAngle, this.aClockwise = e.aClockwise, this.aRotation = e.aRotation, this;
	}
}, Lc = class extends Ic {
	constructor(e, t, n, r, i, a) {
		super(e, t, n, n, r, i, a), this.isArcCurve = !0, this.type = "ArcCurve";
	}
};
function Rc() {
	let e = 0, t = 0, n = 0, r = 0;
	function i(i, a, o, s) {
		e = i, t = o, n = -3 * i + 3 * a - 2 * o - s, r = 2 * i - 2 * a + o + s;
	}
	return {
		initCatmullRom: function(e, t, n, r, a) {
			i(t, n, a * (n - e), a * (r - t));
		},
		initNonuniformCatmullRom: function(e, t, n, r, a, o, s) {
			let c = (t - e) / a - (n - e) / (a + o) + (n - t) / o, l = (n - t) / o - (r - t) / (o + s) + (r - n) / s;
			c *= o, l *= o, i(t, n, c, l);
		},
		calc: function(i) {
			let a = i * i, o = a * i;
			return e + t * i + n * a + r * o;
		}
	};
}
var zc = /*@__PURE__*/ new U(), Bc = /*@__PURE__*/ new U(), Vc = /*@__PURE__*/ new Rc(), Hc = /*@__PURE__*/ new Rc(), Uc = /*@__PURE__*/ new Rc(), Wc = class extends Fc {
	constructor(e = [], t = !1, n = "centripetal", r = .5) {
		super(), this.isCatmullRomCurve3 = !0, this.type = "CatmullRomCurve3", this.points = e, this.closed = t, this.curveType = n, this.tension = r;
	}
	getPoint(e, t = new U()) {
		let n = t, r = this.points, i = r.length, a = (i - +!this.closed) * e, o = Math.floor(a), s = a - o;
		this.closed ? o += o > 0 ? 0 : (Math.floor(Math.abs(o) / i) + 1) * i : s === 0 && o === i - 1 && (o = i - 2, s = 1);
		let c, l;
		this.closed || o > 0 ? c = r[(o - 1) % i] : (Bc.subVectors(r[0], r[1]).add(r[0]), c = Bc);
		let u = r[o % i], d = r[(o + 1) % i];
		if (this.closed || o + 2 < i ? l = r[(o + 2) % i] : (zc.subVectors(r[i - 1], r[i - 2]).add(r[i - 1]), l = zc), this.curveType === "centripetal" || this.curveType === "chordal") {
			let e = this.curveType === "chordal" ? .5 : .25, t = c.distanceToSquared(u) ** +e, n = u.distanceToSquared(d) ** +e, r = d.distanceToSquared(l) ** +e;
			n < 1e-4 && (n = 1), t < 1e-4 && (t = n), r < 1e-4 && (r = n), Vc.initNonuniformCatmullRom(c.x, u.x, d.x, l.x, t, n, r), Hc.initNonuniformCatmullRom(c.y, u.y, d.y, l.y, t, n, r), Uc.initNonuniformCatmullRom(c.z, u.z, d.z, l.z, t, n, r);
		} else this.curveType === "catmullrom" && (Vc.initCatmullRom(c.x, u.x, d.x, l.x, this.tension), Hc.initCatmullRom(c.y, u.y, d.y, l.y, this.tension), Uc.initCatmullRom(c.z, u.z, d.z, l.z, this.tension));
		return n.set(Vc.calc(s), Hc.calc(s), Uc.calc(s)), n;
	}
	copy(e) {
		super.copy(e), this.points = [];
		for (let t = 0, n = e.points.length; t < n; t++) {
			let n = e.points[t];
			this.points.push(n.clone());
		}
		return this.closed = e.closed, this.curveType = e.curveType, this.tension = e.tension, this;
	}
	toJSON() {
		let e = super.toJSON();
		e.points = [];
		for (let t = 0, n = this.points.length; t < n; t++) {
			let n = this.points[t];
			e.points.push(n.toArray());
		}
		return e.closed = this.closed, e.curveType = this.curveType, e.tension = this.tension, e;
	}
	fromJSON(e) {
		super.fromJSON(e), this.points = [];
		for (let t = 0, n = e.points.length; t < n; t++) {
			let n = e.points[t];
			this.points.push(new U().fromArray(n));
		}
		return this.closed = e.closed, this.curveType = e.curveType, this.tension = e.tension, this;
	}
};
function Gc(e, t, n, r, i) {
	let a = (r - t) * .5, o = (i - n) * .5, s = e * e, c = e * s;
	return (2 * n - 2 * r + a + o) * c + (-3 * n + 3 * r - 2 * a - o) * s + a * e + n;
}
function Kc(e, t) {
	let n = 1 - e;
	return n * n * t;
}
function qc(e, t) {
	return 2 * (1 - e) * e * t;
}
function Jc(e, t) {
	return e * e * t;
}
function Yc(e, t, n, r) {
	return Kc(e, t) + qc(e, n) + Jc(e, r);
}
function Xc(e, t) {
	let n = 1 - e;
	return n * n * n * t;
}
function Zc(e, t) {
	let n = 1 - e;
	return 3 * n * n * e * t;
}
function Qc(e, t) {
	return 3 * (1 - e) * e * e * t;
}
function $c(e, t) {
	return e * e * e * t;
}
function el(e, t, n, r, i) {
	return Xc(e, t) + Zc(e, n) + Qc(e, r) + $c(e, i);
}
var tl = class extends Fc {
	constructor(e = new H(), t = new H(), n = new H(), r = new H()) {
		super(), this.isCubicBezierCurve = !0, this.type = "CubicBezierCurve", this.v0 = e, this.v1 = t, this.v2 = n, this.v3 = r;
	}
	getPoint(e, t = new H()) {
		let n = t, r = this.v0, i = this.v1, a = this.v2, o = this.v3;
		return n.set(el(e, r.x, i.x, a.x, o.x), el(e, r.y, i.y, a.y, o.y)), n;
	}
	copy(e) {
		return super.copy(e), this.v0.copy(e.v0), this.v1.copy(e.v1), this.v2.copy(e.v2), this.v3.copy(e.v3), this;
	}
	toJSON() {
		let e = super.toJSON();
		return e.v0 = this.v0.toArray(), e.v1 = this.v1.toArray(), e.v2 = this.v2.toArray(), e.v3 = this.v3.toArray(), e;
	}
	fromJSON(e) {
		return super.fromJSON(e), this.v0.fromArray(e.v0), this.v1.fromArray(e.v1), this.v2.fromArray(e.v2), this.v3.fromArray(e.v3), this;
	}
}, nl = class extends Fc {
	constructor(e = new U(), t = new U(), n = new U(), r = new U()) {
		super(), this.isCubicBezierCurve3 = !0, this.type = "CubicBezierCurve3", this.v0 = e, this.v1 = t, this.v2 = n, this.v3 = r;
	}
	getPoint(e, t = new U()) {
		let n = t, r = this.v0, i = this.v1, a = this.v2, o = this.v3;
		return n.set(el(e, r.x, i.x, a.x, o.x), el(e, r.y, i.y, a.y, o.y), el(e, r.z, i.z, a.z, o.z)), n;
	}
	copy(e) {
		return super.copy(e), this.v0.copy(e.v0), this.v1.copy(e.v1), this.v2.copy(e.v2), this.v3.copy(e.v3), this;
	}
	toJSON() {
		let e = super.toJSON();
		return e.v0 = this.v0.toArray(), e.v1 = this.v1.toArray(), e.v2 = this.v2.toArray(), e.v3 = this.v3.toArray(), e;
	}
	fromJSON(e) {
		return super.fromJSON(e), this.v0.fromArray(e.v0), this.v1.fromArray(e.v1), this.v2.fromArray(e.v2), this.v3.fromArray(e.v3), this;
	}
}, rl = class extends Fc {
	constructor(e = new H(), t = new H()) {
		super(), this.isLineCurve = !0, this.type = "LineCurve", this.v1 = e, this.v2 = t;
	}
	getPoint(e, t = new H()) {
		let n = t;
		return e === 1 ? n.copy(this.v2) : (n.copy(this.v2).sub(this.v1), n.multiplyScalar(e).add(this.v1)), n;
	}
	getPointAt(e, t) {
		return this.getPoint(e, t);
	}
	getTangent(e, t = new H()) {
		return t.subVectors(this.v2, this.v1).normalize();
	}
	getTangentAt(e, t) {
		return this.getTangent(e, t);
	}
	copy(e) {
		return super.copy(e), this.v1.copy(e.v1), this.v2.copy(e.v2), this;
	}
	toJSON() {
		let e = super.toJSON();
		return e.v1 = this.v1.toArray(), e.v2 = this.v2.toArray(), e;
	}
	fromJSON(e) {
		return super.fromJSON(e), this.v1.fromArray(e.v1), this.v2.fromArray(e.v2), this;
	}
}, il = class extends Fc {
	constructor(e = new U(), t = new U()) {
		super(), this.isLineCurve3 = !0, this.type = "LineCurve3", this.v1 = e, this.v2 = t;
	}
	getPoint(e, t = new U()) {
		let n = t;
		return e === 1 ? n.copy(this.v2) : (n.copy(this.v2).sub(this.v1), n.multiplyScalar(e).add(this.v1)), n;
	}
	getPointAt(e, t) {
		return this.getPoint(e, t);
	}
	getTangent(e, t = new U()) {
		return t.subVectors(this.v2, this.v1).normalize();
	}
	getTangentAt(e, t) {
		return this.getTangent(e, t);
	}
	copy(e) {
		return super.copy(e), this.v1.copy(e.v1), this.v2.copy(e.v2), this;
	}
	toJSON() {
		let e = super.toJSON();
		return e.v1 = this.v1.toArray(), e.v2 = this.v2.toArray(), e;
	}
	fromJSON(e) {
		return super.fromJSON(e), this.v1.fromArray(e.v1), this.v2.fromArray(e.v2), this;
	}
}, al = class extends Fc {
	constructor(e = new H(), t = new H(), n = new H()) {
		super(), this.isQuadraticBezierCurve = !0, this.type = "QuadraticBezierCurve", this.v0 = e, this.v1 = t, this.v2 = n;
	}
	getPoint(e, t = new H()) {
		let n = t, r = this.v0, i = this.v1, a = this.v2;
		return n.set(Yc(e, r.x, i.x, a.x), Yc(e, r.y, i.y, a.y)), n;
	}
	copy(e) {
		return super.copy(e), this.v0.copy(e.v0), this.v1.copy(e.v1), this.v2.copy(e.v2), this;
	}
	toJSON() {
		let e = super.toJSON();
		return e.v0 = this.v0.toArray(), e.v1 = this.v1.toArray(), e.v2 = this.v2.toArray(), e;
	}
	fromJSON(e) {
		return super.fromJSON(e), this.v0.fromArray(e.v0), this.v1.fromArray(e.v1), this.v2.fromArray(e.v2), this;
	}
}, ol = class extends Fc {
	constructor(e = new U(), t = new U(), n = new U()) {
		super(), this.isQuadraticBezierCurve3 = !0, this.type = "QuadraticBezierCurve3", this.v0 = e, this.v1 = t, this.v2 = n;
	}
	getPoint(e, t = new U()) {
		let n = t, r = this.v0, i = this.v1, a = this.v2;
		return n.set(Yc(e, r.x, i.x, a.x), Yc(e, r.y, i.y, a.y), Yc(e, r.z, i.z, a.z)), n;
	}
	copy(e) {
		return super.copy(e), this.v0.copy(e.v0), this.v1.copy(e.v1), this.v2.copy(e.v2), this;
	}
	toJSON() {
		let e = super.toJSON();
		return e.v0 = this.v0.toArray(), e.v1 = this.v1.toArray(), e.v2 = this.v2.toArray(), e;
	}
	fromJSON(e) {
		return super.fromJSON(e), this.v0.fromArray(e.v0), this.v1.fromArray(e.v1), this.v2.fromArray(e.v2), this;
	}
}, sl = class extends Fc {
	constructor(e = []) {
		super(), this.isSplineCurve = !0, this.type = "SplineCurve", this.points = e;
	}
	getPoint(e, t = new H()) {
		let n = t, r = this.points, i = (r.length - 1) * e, a = Math.floor(i), o = i - a, s = r[a === 0 ? a : a - 1], c = r[a], l = r[a > r.length - 2 ? r.length - 1 : a + 1], u = r[a > r.length - 3 ? r.length - 1 : a + 2];
		return n.set(Gc(o, s.x, c.x, l.x, u.x), Gc(o, s.y, c.y, l.y, u.y)), n;
	}
	copy(e) {
		super.copy(e), this.points = [];
		for (let t = 0, n = e.points.length; t < n; t++) {
			let n = e.points[t];
			this.points.push(n.clone());
		}
		return this;
	}
	toJSON() {
		let e = super.toJSON();
		e.points = [];
		for (let t = 0, n = this.points.length; t < n; t++) {
			let n = this.points[t];
			e.points.push(n.toArray());
		}
		return e;
	}
	fromJSON(e) {
		super.fromJSON(e), this.points = [];
		for (let t = 0, n = e.points.length; t < n; t++) {
			let n = e.points[t];
			this.points.push(new H().fromArray(n));
		}
		return this;
	}
}, cl = /*#__PURE__*/ Object.freeze({
	__proto__: null,
	ArcCurve: Lc,
	CatmullRomCurve3: Wc,
	CubicBezierCurve: tl,
	CubicBezierCurve3: nl,
	EllipseCurve: Ic,
	LineCurve: rl,
	LineCurve3: il,
	QuadraticBezierCurve: al,
	QuadraticBezierCurve3: ol,
	SplineCurve: sl
}), ll = class extends Fc {
	constructor() {
		super(), this.type = "CurvePath", this.curves = [], this.autoClose = !1;
	}
	add(e) {
		this.curves.push(e);
	}
	closePath() {
		let e = this.curves[0].getPoint(0), t = this.curves[this.curves.length - 1].getPoint(1);
		if (!e.equals(t)) {
			let n = e.isVector2 === !0 ? "LineCurve" : "LineCurve3";
			this.curves.push(new cl[n](t, e));
		}
		return this;
	}
	getPoint(e, t) {
		let n = e * this.getLength(), r = this.getCurveLengths(), i = 0;
		for (; i < r.length;) {
			if (r[i] >= n) {
				let e = r[i] - n, a = this.curves[i], o = a.getLength(), s = o === 0 ? 0 : 1 - e / o;
				return a.getPointAt(s, t);
			}
			i++;
		}
		return null;
	}
	getLength() {
		let e = this.getCurveLengths();
		return e[e.length - 1];
	}
	updateArcLengths() {
		this.needsUpdate = !0, this.cacheLengths = null, this.getCurveLengths();
	}
	getCurveLengths() {
		if (this.cacheLengths && this.cacheLengths.length === this.curves.length) return this.cacheLengths;
		let e = [], t = 0;
		for (let n = 0, r = this.curves.length; n < r; n++) t += this.curves[n].getLength(), e.push(t);
		return this.cacheLengths = e, e;
	}
	getSpacedPoints(e = 40) {
		let t = [];
		for (let n = 0; n <= e; n++) t.push(this.getPoint(n / e));
		return this.autoClose && t.push(t[0]), t;
	}
	getPoints(e = 12) {
		let t = [], n;
		for (let r = 0, i = this.curves; r < i.length; r++) {
			let a = i[r], o = a.isEllipseCurve ? e * 2 : a.isLineCurve || a.isLineCurve3 ? 1 : a.isSplineCurve ? e * a.points.length : e, s = a.getPoints(o);
			for (let e = 0; e < s.length; e++) {
				let r = s[e];
				n && n.equals(r) || (t.push(r), n = r);
			}
		}
		return this.autoClose && t.length > 1 && !t[t.length - 1].equals(t[0]) && t.push(t[0]), t;
	}
	copy(e) {
		super.copy(e), this.curves = [];
		for (let t = 0, n = e.curves.length; t < n; t++) {
			let n = e.curves[t];
			this.curves.push(n.clone());
		}
		return this.autoClose = e.autoClose, this;
	}
	toJSON() {
		let e = super.toJSON();
		e.autoClose = this.autoClose, e.curves = [];
		for (let t = 0, n = this.curves.length; t < n; t++) {
			let n = this.curves[t];
			e.curves.push(n.toJSON());
		}
		return e;
	}
	fromJSON(e) {
		super.fromJSON(e), this.autoClose = e.autoClose, this.curves = [];
		for (let t = 0, n = e.curves.length; t < n; t++) {
			let n = e.curves[t];
			this.curves.push(new cl[n.type]().fromJSON(n));
		}
		return this;
	}
}, ul = class extends ll {
	constructor(e) {
		super(), this.type = "Path", this.currentPoint = new H(), e && this.setFromPoints(e);
	}
	setFromPoints(e) {
		this.moveTo(e[0].x, e[0].y);
		for (let t = 1, n = e.length; t < n; t++) this.lineTo(e[t].x, e[t].y);
		return this;
	}
	moveTo(e, t) {
		return this.currentPoint.set(e, t), this;
	}
	lineTo(e, t) {
		let n = new rl(this.currentPoint.clone(), new H(e, t));
		return this.curves.push(n), this.currentPoint.set(e, t), this;
	}
	quadraticCurveTo(e, t, n, r) {
		let i = new al(this.currentPoint.clone(), new H(e, t), new H(n, r));
		return this.curves.push(i), this.currentPoint.set(n, r), this;
	}
	bezierCurveTo(e, t, n, r, i, a) {
		let o = new tl(this.currentPoint.clone(), new H(e, t), new H(n, r), new H(i, a));
		return this.curves.push(o), this.currentPoint.set(i, a), this;
	}
	splineThru(e) {
		let t = new sl([this.currentPoint.clone()].concat(e));
		return this.curves.push(t), this.currentPoint.copy(e[e.length - 1]), this;
	}
	arc(e, t, n, r, i, a) {
		let o = this.currentPoint.x, s = this.currentPoint.y;
		return this.absarc(e + o, t + s, n, r, i, a), this;
	}
	absarc(e, t, n, r, i, a) {
		return this.absellipse(e, t, n, n, r, i, a), this;
	}
	ellipse(e, t, n, r, i, a, o, s) {
		let c = this.currentPoint.x, l = this.currentPoint.y;
		return this.absellipse(e + c, t + l, n, r, i, a, o, s), this;
	}
	absellipse(e, t, n, r, i, a, o, s) {
		let c = new Ic(e, t, n, r, i, a, o, s);
		if (this.curves.length > 0) {
			let e = c.getPoint(0);
			e.equals(this.currentPoint) || this.lineTo(e.x, e.y);
		}
		this.curves.push(c);
		let l = c.getPoint(1);
		return this.currentPoint.copy(l), this;
	}
	copy(e) {
		return super.copy(e), this.currentPoint.copy(e.currentPoint), this;
	}
	toJSON() {
		let e = super.toJSON();
		return e.currentPoint = this.currentPoint.toArray(), e;
	}
	fromJSON(e) {
		return super.fromJSON(e), this.currentPoint.fromArray(e.currentPoint), this;
	}
}, dl = class extends ul {
	constructor(e) {
		super(e), this.uuid = xr(), this.type = "Shape", this.holes = [];
	}
	getPointsHoles(e) {
		let t = [];
		for (let n = 0, r = this.holes.length; n < r; n++) t[n] = this.holes[n].getPoints(e);
		return t;
	}
	extractPoints(e) {
		return {
			shape: this.getPoints(e),
			holes: this.getPointsHoles(e)
		};
	}
	copy(e) {
		super.copy(e), this.holes = [];
		for (let t = 0, n = e.holes.length; t < n; t++) {
			let n = e.holes[t];
			this.holes.push(n.clone());
		}
		return this;
	}
	toJSON() {
		let e = super.toJSON();
		e.uuid = this.uuid, e.holes = [];
		for (let t = 0, n = this.holes.length; t < n; t++) {
			let n = this.holes[t];
			e.holes.push(n.toJSON());
		}
		return e;
	}
	fromJSON(e) {
		super.fromJSON(e), this.uuid = e.uuid, this.holes = [];
		for (let t = 0, n = e.holes.length; t < n; t++) {
			let n = e.holes[t];
			this.holes.push(new ul().fromJSON(n));
		}
		return this;
	}
};
function fl(e, t, n = 2) {
	let r = t && t.length, i = r ? t[0] * n : e.length, a = pl(e, 0, i, n, !0), o = [];
	if (!a || a.next === a.prev) return o;
	let s, c, l;
	if (r && (a = bl(e, t, a, n)), e.length > 80 * n) {
		s = e[0], c = e[1];
		let t = s, r = c;
		for (let a = n; a < i; a += n) {
			let n = e[a], i = e[a + 1];
			n < s && (s = n), i < c && (c = i), n > t && (t = n), i > r && (r = i);
		}
		l = Math.max(t - s, r - c), l = l === 0 ? 0 : 32767 / l;
	}
	return hl(a, o, n, s, c, l, 0), o;
}
function pl(e, t, n, r, i) {
	let a;
	if (i === Wl(e, t, n, r) > 0) for (let i = t; i < n; i += r) a = Vl(i / r | 0, e[i], e[i + 1], a);
	else for (let i = n - r; i >= t; i -= r) a = Vl(i / r | 0, e[i], e[i + 1], a);
	return a && Nl(a, a.next) && (Hl(a), a = a.next), a;
}
function ml(e, t) {
	if (!e) return e;
	t ||= e;
	let n = e, r;
	do
		if (r = !1, !n.steiner && (Nl(n, n.next) || Ml(n.prev, n, n.next) === 0)) {
			if (Hl(n), n = t = n.prev, n === n.next) break;
			r = !0;
		} else n = n.next;
	while (r || n !== t);
	return t;
}
function hl(e, t, n, r, i, a, o) {
	if (!e) return;
	!o && a && Tl(e, r, i, a);
	let s = e;
	for (; e.prev !== e.next;) {
		let c = e.prev, l = e.next;
		if (a ? _l(e, r, i, a) : gl(e)) {
			t.push(c.i, e.i, l.i), Hl(e), e = l.next, s = l.next;
			continue;
		}
		if (e = l, e === s) {
			o ? o === 1 ? (e = vl(ml(e), t), hl(e, t, n, r, i, a, 2)) : o === 2 && yl(e, t, n, r, i, a) : hl(ml(e), t, n, r, i, a, 1);
			break;
		}
	}
}
function gl(e) {
	let t = e.prev, n = e, r = e.next;
	if (Ml(t, n, r) >= 0) return !1;
	let i = t.x, a = n.x, o = r.x, s = t.y, c = n.y, l = r.y, u = Math.min(i, a, o), d = Math.min(s, c, l), f = Math.max(i, a, o), p = Math.max(s, c, l), m = r.next;
	for (; m !== t;) {
		if (m.x >= u && m.x <= f && m.y >= d && m.y <= p && Al(i, s, a, c, o, l, m.x, m.y) && Ml(m.prev, m, m.next) >= 0) return !1;
		m = m.next;
	}
	return !0;
}
function _l(e, t, n, r) {
	let i = e.prev, a = e, o = e.next;
	if (Ml(i, a, o) >= 0) return !1;
	let s = i.x, c = a.x, l = o.x, u = i.y, d = a.y, f = o.y, p = Math.min(s, c, l), m = Math.min(u, d, f), h = Math.max(s, c, l), g = Math.max(u, d, f), _ = Dl(p, m, t, n, r), v = Dl(h, g, t, n, r), y = e.prevZ, b = e.nextZ;
	for (; y && y.z >= _ && b && b.z <= v;) {
		if (y.x >= p && y.x <= h && y.y >= m && y.y <= g && y !== i && y !== o && Al(s, u, c, d, l, f, y.x, y.y) && Ml(y.prev, y, y.next) >= 0 || (y = y.prevZ, b.x >= p && b.x <= h && b.y >= m && b.y <= g && b !== i && b !== o && Al(s, u, c, d, l, f, b.x, b.y) && Ml(b.prev, b, b.next) >= 0)) return !1;
		b = b.nextZ;
	}
	for (; y && y.z >= _;) {
		if (y.x >= p && y.x <= h && y.y >= m && y.y <= g && y !== i && y !== o && Al(s, u, c, d, l, f, y.x, y.y) && Ml(y.prev, y, y.next) >= 0) return !1;
		y = y.prevZ;
	}
	for (; b && b.z <= v;) {
		if (b.x >= p && b.x <= h && b.y >= m && b.y <= g && b !== i && b !== o && Al(s, u, c, d, l, f, b.x, b.y) && Ml(b.prev, b, b.next) >= 0) return !1;
		b = b.nextZ;
	}
	return !0;
}
function vl(e, t) {
	let n = e;
	do {
		let r = n.prev, i = n.next.next;
		!Nl(r, i) && Pl(r, n, n.next, i) && Rl(r, i) && Rl(i, r) && (t.push(r.i, n.i, i.i), Hl(n), Hl(n.next), n = e = i), n = n.next;
	} while (n !== e);
	return ml(n);
}
function yl(e, t, n, r, i, a) {
	let o = e;
	do {
		let e = o.next.next;
		for (; e !== o.prev;) {
			if (o.i !== e.i && jl(o, e)) {
				let s = Bl(o, e);
				o = ml(o, o.next), s = ml(s, s.next), hl(o, t, n, r, i, a, 0), hl(s, t, n, r, i, a, 0);
				return;
			}
			e = e.next;
		}
		o = o.next;
	} while (o !== e);
}
function bl(e, t, n, r) {
	let i = [];
	for (let n = 0, a = t.length; n < a; n++) {
		let o = pl(e, t[n] * r, n < a - 1 ? t[n + 1] * r : e.length, r, !1);
		o === o.next && (o.steiner = !0), i.push(Ol(o));
	}
	i.sort(xl);
	for (let e = 0; e < i.length; e++) n = Sl(i[e], n);
	return n;
}
function xl(e, t) {
	let n = e.x - t.x;
	return n === 0 && (n = e.y - t.y, n === 0 && (n = (e.next.y - e.y) / (e.next.x - e.x) - (t.next.y - t.y) / (t.next.x - t.x))), n;
}
function Sl(e, t) {
	let n = Cl(e, t);
	if (!n) return t;
	let r = Bl(n, e);
	return ml(r, r.next), ml(n, n.next);
}
function Cl(e, t) {
	let n = t, r = e.x, i = e.y, a = -Infinity, o;
	if (Nl(e, n)) return n;
	do {
		if (Nl(e, n.next)) return n.next;
		if (i <= n.y && i >= n.next.y && n.next.y !== n.y) {
			let e = n.x + (i - n.y) * (n.next.x - n.x) / (n.next.y - n.y);
			if (e <= r && e > a && (a = e, o = n.x < n.next.x ? n : n.next, e === r)) return o;
		}
		n = n.next;
	} while (n !== t);
	if (!o) return null;
	let s = o, c = o.x, l = o.y, u = Infinity;
	n = o;
	do {
		if (r >= n.x && n.x >= c && r !== n.x && kl(i < l ? r : a, i, c, l, i < l ? a : r, i, n.x, n.y)) {
			let t = Math.abs(i - n.y) / (r - n.x);
			Rl(n, e) && (t < u || t === u && (n.x > o.x || n.x === o.x && wl(o, n))) && (o = n, u = t);
		}
		n = n.next;
	} while (n !== s);
	return o;
}
function wl(e, t) {
	return Ml(e.prev, e, t.prev) < 0 && Ml(t.next, e, e.next) < 0;
}
function Tl(e, t, n, r) {
	let i = e;
	do
		i.z === 0 && (i.z = Dl(i.x, i.y, t, n, r)), i.prevZ = i.prev, i.nextZ = i.next, i = i.next;
	while (i !== e);
	i.prevZ.nextZ = null, i.prevZ = null, El(i);
}
function El(e) {
	let t, n = 1;
	do {
		let r = e, i;
		e = null;
		let a = null;
		for (t = 0; r;) {
			t++;
			let o = r, s = 0;
			for (let e = 0; e < n && (s++, o = o.nextZ, o); e++);
			let c = n;
			for (; s > 0 || c > 0 && o;) s !== 0 && (c === 0 || !o || r.z <= o.z) ? (i = r, r = r.nextZ, s--) : (i = o, o = o.nextZ, c--), a ? a.nextZ = i : e = i, i.prevZ = a, a = i;
			r = o;
		}
		a.nextZ = null, n *= 2;
	} while (t > 1);
	return e;
}
function Dl(e, t, n, r, i) {
	return e = (e - n) * i | 0, t = (t - r) * i | 0, e = (e | e << 8) & 16711935, e = (e | e << 4) & 252645135, e = (e | e << 2) & 858993459, e = (e | e << 1) & 1431655765, t = (t | t << 8) & 16711935, t = (t | t << 4) & 252645135, t = (t | t << 2) & 858993459, t = (t | t << 1) & 1431655765, e | t << 1;
}
function Ol(e) {
	let t = e, n = e;
	do
		(t.x < n.x || t.x === n.x && t.y < n.y) && (n = t), t = t.next;
	while (t !== e);
	return n;
}
function kl(e, t, n, r, i, a, o, s) {
	return (i - o) * (t - s) >= (e - o) * (a - s) && (e - o) * (r - s) >= (n - o) * (t - s) && (n - o) * (a - s) >= (i - o) * (r - s);
}
function Al(e, t, n, r, i, a, o, s) {
	return !(e === o && t === s) && kl(e, t, n, r, i, a, o, s);
}
function jl(e, t) {
	return e.next.i !== t.i && e.prev.i !== t.i && !Ll(e, t) && (Rl(e, t) && Rl(t, e) && zl(e, t) && (Ml(e.prev, e, t.prev) || Ml(e, t.prev, t)) || Nl(e, t) && Ml(e.prev, e, e.next) > 0 && Ml(t.prev, t, t.next) > 0);
}
function Ml(e, t, n) {
	return (t.y - e.y) * (n.x - t.x) - (t.x - e.x) * (n.y - t.y);
}
function Nl(e, t) {
	return e.x === t.x && e.y === t.y;
}
function Pl(e, t, n, r) {
	let i = Il(Ml(e, t, n)), a = Il(Ml(e, t, r)), o = Il(Ml(n, r, e)), s = Il(Ml(n, r, t));
	return !!(i !== a && o !== s || i === 0 && Fl(e, n, t) || a === 0 && Fl(e, r, t) || o === 0 && Fl(n, e, r) || s === 0 && Fl(n, t, r));
}
function Fl(e, t, n) {
	return t.x <= Math.max(e.x, n.x) && t.x >= Math.min(e.x, n.x) && t.y <= Math.max(e.y, n.y) && t.y >= Math.min(e.y, n.y);
}
function Il(e) {
	return e > 0 ? 1 : e < 0 ? -1 : 0;
}
function Ll(e, t) {
	let n = e;
	do {
		if (n.i !== e.i && n.next.i !== e.i && n.i !== t.i && n.next.i !== t.i && Pl(n, n.next, e, t)) return !0;
		n = n.next;
	} while (n !== e);
	return !1;
}
function Rl(e, t) {
	return Ml(e.prev, e, e.next) < 0 ? Ml(e, t, e.next) >= 0 && Ml(e, e.prev, t) >= 0 : Ml(e, t, e.prev) < 0 || Ml(e, e.next, t) < 0;
}
function zl(e, t) {
	let n = e, r = !1, i = (e.x + t.x) / 2, a = (e.y + t.y) / 2;
	do
		n.y > a != n.next.y > a && n.next.y !== n.y && i < (n.next.x - n.x) * (a - n.y) / (n.next.y - n.y) + n.x && (r = !r), n = n.next;
	while (n !== e);
	return r;
}
function Bl(e, t) {
	let n = Ul(e.i, e.x, e.y), r = Ul(t.i, t.x, t.y), i = e.next, a = t.prev;
	return e.next = t, t.prev = e, n.next = i, i.prev = n, r.next = n, n.prev = r, a.next = r, r.prev = a, r;
}
function Vl(e, t, n, r) {
	let i = Ul(e, t, n);
	return r ? (i.next = r.next, i.prev = r, r.next.prev = i, r.next = i) : (i.prev = i, i.next = i), i;
}
function Hl(e) {
	e.next.prev = e.prev, e.prev.next = e.next, e.prevZ && (e.prevZ.nextZ = e.nextZ), e.nextZ && (e.nextZ.prevZ = e.prevZ);
}
function Ul(e, t, n) {
	return {
		i: e,
		x: t,
		y: n,
		prev: null,
		next: null,
		z: 0,
		prevZ: null,
		nextZ: null,
		steiner: !1
	};
}
function Wl(e, t, n, r) {
	let i = 0;
	for (let a = t, o = n - r; a < n; a += r) i += (e[o] - e[a]) * (e[a + 1] + e[o + 1]), o = a;
	return i;
}
var Gl = class {
	static triangulate(e, t, n = 2) {
		return fl(e, t, n);
	}
}, Kl = class e {
	static area(e) {
		let t = e.length, n = 0;
		for (let r = t - 1, i = 0; i < t; r = i++) n += e[r].x * e[i].y - e[i].x * e[r].y;
		return n * .5;
	}
	static isClockWise(t) {
		return e.area(t) < 0;
	}
	static triangulateShape(e, t) {
		let n = [], r = [], i = [];
		ql(e), Jl(n, e);
		let a = e.length;
		t.forEach(ql);
		for (let e = 0; e < t.length; e++) r.push(a), a += t[e].length, Jl(n, t[e]);
		let o = Gl.triangulate(n, r);
		for (let e = 0; e < o.length; e += 3) i.push(o.slice(e, e + 3));
		return i;
	}
};
function ql(e) {
	let t = e.length;
	t > 2 && e[t - 1].equals(e[0]) && e.pop();
}
function Jl(e, t) {
	for (let n = 0; n < t.length; n++) e.push(t[n].x), e.push(t[n].y);
}
var Yl = class e extends Z {
	constructor(e = new dl([
		new H(.5, .5),
		new H(-.5, .5),
		new H(-.5, -.5),
		new H(.5, -.5)
	]), t = {}) {
		super(), this.type = "ExtrudeGeometry", this.parameters = {
			shapes: e,
			options: t
		}, e = Array.isArray(e) ? e : [e];
		let n = this, r = [], i = [];
		for (let t = 0, n = e.length; t < n; t++) {
			let n = e[t];
			a(n);
		}
		this.setAttribute("position", new X(r, 3)), this.setAttribute("uv", new X(i, 2)), this.computeVertexNormals();
		function a(e) {
			let a = [], o = t.curveSegments === void 0 ? 12 : t.curveSegments, s = t.steps === void 0 ? 1 : t.steps, c = t.depth === void 0 ? 1 : t.depth, l = t.bevelEnabled === void 0 ? !0 : t.bevelEnabled, u = t.bevelThickness === void 0 ? .2 : t.bevelThickness, d = t.bevelSize === void 0 ? u - .1 : t.bevelSize, f = t.bevelOffset === void 0 ? 0 : t.bevelOffset, p = t.bevelSegments === void 0 ? 3 : t.bevelSegments, m = t.extrudePath, h = t.UVGenerator === void 0 ? Xl : t.UVGenerator, g, _ = !1, v, y, b, x;
			if (m) {
				g = m.getSpacedPoints(s), _ = !0, l = !1;
				let e = m.isCatmullRomCurve3 ? m.closed : !1;
				v = m.computeFrenetFrames(s, e), y = new U(), b = new U(), x = new U();
			}
			l || (p = 0, u = 0, d = 0, f = 0);
			let S = e.extractPoints(o), C = S.shape, w = S.holes;
			if (!Kl.isClockWise(C)) {
				C = C.reverse();
				for (let e = 0, t = w.length; e < t; e++) {
					let t = w[e];
					Kl.isClockWise(t) && (w[e] = t.reverse());
				}
			}
			function T(e) {
				let t = e[0];
				for (let n = 1; n <= e.length; n++) {
					let r = n % e.length, i = e[r], a = i.x - t.x, o = i.y - t.y, s = a * a + o * o, c = Math.max(Math.abs(i.x), Math.abs(i.y), Math.abs(t.x), Math.abs(t.y));
					if (s <= 10000000000000001e-36 * c * c) {
						e.splice(r, 1), n--;
						continue;
					}
					t = i;
				}
			}
			T(C), w.forEach(T);
			let E = w.length, D = C;
			for (let e = 0; e < E; e++) {
				let t = w[e];
				C = C.concat(t);
			}
			function O(e, t, n) {
				return t || z("ExtrudeGeometry: vec does not exist"), e.clone().addScaledVector(t, n);
			}
			let k = C.length;
			function A(e, t, n) {
				let r, i, a, o = e.x - t.x, s = e.y - t.y, c = n.x - e.x, l = n.y - e.y, u = o * o + s * s, d = o * l - s * c;
				if (Math.abs(d) > 2 ** -52) {
					let d = Math.sqrt(u), f = Math.sqrt(c * c + l * l), p = t.x - s / d, m = t.y + o / d, h = n.x - l / f, g = n.y + c / f, _ = ((h - p) * l - (g - m) * c) / (o * l - s * c);
					r = p + o * _ - e.x, i = m + s * _ - e.y;
					let v = r * r + i * i;
					if (v <= 2) return new H(r, i);
					a = Math.sqrt(v / 2);
				} else {
					let e = !1;
					o > 2 ** -52 ? c > 2 ** -52 && (e = !0) : o < -(2 ** -52) ? c < -(2 ** -52) && (e = !0) : Math.sign(s) === Math.sign(l) && (e = !0), e ? (r = -s, i = o, a = Math.sqrt(u)) : (r = o, i = s, a = Math.sqrt(u / 2));
				}
				return new H(r / a, i / a);
			}
			let ee = [];
			for (let e = 0, t = D.length, n = t - 1, r = e + 1; e < t; e++, n++, r++) n === t && (n = 0), r === t && (r = 0), ee[e] = A(D[e], D[n], D[r]);
			let te = [], j, ne = ee.concat();
			for (let e = 0, t = E; e < t; e++) {
				let t = w[e];
				j = [];
				for (let e = 0, n = t.length, r = n - 1, i = e + 1; e < n; e++, r++, i++) r === n && (r = 0), i === n && (i = 0), j[e] = A(t[e], t[r], t[i]);
				te.push(j), ne = ne.concat(j);
			}
			let re;
			if (p === 0) re = Kl.triangulateShape(D, w);
			else {
				let e = [], t = [];
				for (let n = 0; n < p; n++) {
					let r = n / p, i = u * Math.cos(r * Math.PI / 2), a = d * Math.sin(r * Math.PI / 2) + f;
					for (let t = 0, n = D.length; t < n; t++) {
						let n = O(D[t], ee[t], a);
						N(n.x, n.y, -i), r === 0 && e.push(n);
					}
					for (let e = 0, n = E; e < n; e++) {
						let n = w[e];
						j = te[e];
						let o = [];
						for (let e = 0, t = n.length; e < t; e++) {
							let t = O(n[e], j[e], a);
							N(t.x, t.y, -i), r === 0 && o.push(t);
						}
						r === 0 && t.push(o);
					}
				}
				re = Kl.triangulateShape(e, t);
			}
			let M = re.length, ie = d + f;
			for (let e = 0; e < k; e++) {
				let t = l ? O(C[e], ne[e], ie) : C[e];
				_ ? (b.copy(v.normals[0]).multiplyScalar(t.x), y.copy(v.binormals[0]).multiplyScalar(t.y), x.copy(g[0]).add(b).add(y), N(x.x, x.y, x.z)) : N(t.x, t.y, 0);
			}
			for (let e = 1; e <= s; e++) for (let t = 0; t < k; t++) {
				let n = l ? O(C[t], ne[t], ie) : C[t];
				_ ? (b.copy(v.normals[e]).multiplyScalar(n.x), y.copy(v.binormals[e]).multiplyScalar(n.y), x.copy(g[e]).add(b).add(y), N(x.x, x.y, x.z)) : N(n.x, n.y, c / s * e);
			}
			for (let e = p - 1; e >= 0; e--) {
				let t = e / p, n = u * Math.cos(t * Math.PI / 2), r = d * Math.sin(t * Math.PI / 2) + f;
				for (let e = 0, t = D.length; e < t; e++) {
					let t = O(D[e], ee[e], r);
					N(t.x, t.y, c + n);
				}
				for (let e = 0, t = w.length; e < t; e++) {
					let t = w[e];
					j = te[e];
					for (let e = 0, i = t.length; e < i; e++) {
						let i = O(t[e], j[e], r);
						_ ? N(i.x, i.y + g[s - 1].y, g[s - 1].x + n) : N(i.x, i.y, c + n);
					}
				}
			}
			ae(), oe();
			function ae() {
				let e = r.length / 3;
				if (l) {
					let e = 0, t = k * e;
					for (let e = 0; e < M; e++) {
						let n = re[e];
						ce(n[2] + t, n[1] + t, n[0] + t);
					}
					e = s + p * 2, t = k * e;
					for (let e = 0; e < M; e++) {
						let n = re[e];
						ce(n[0] + t, n[1] + t, n[2] + t);
					}
				} else {
					for (let e = 0; e < M; e++) {
						let t = re[e];
						ce(t[2], t[1], t[0]);
					}
					for (let e = 0; e < M; e++) {
						let t = re[e];
						ce(t[0] + k * s, t[1] + k * s, t[2] + k * s);
					}
				}
				n.addGroup(e, r.length / 3 - e, 0);
			}
			function oe() {
				let e = r.length / 3, t = 0;
				se(D, t), t += D.length;
				for (let e = 0, n = w.length; e < n; e++) {
					let n = w[e];
					se(n, t), t += n.length;
				}
				n.addGroup(e, r.length / 3 - e, 1);
			}
			function se(e, t) {
				let n = e.length;
				for (; --n >= 0;) {
					let r = n, i = n - 1;
					i < 0 && (i = e.length - 1);
					for (let e = 0, n = s + p * 2; e < n; e++) {
						let n = k * e, a = k * (e + 1);
						le(t + r + n, t + i + n, t + i + a, t + r + a);
					}
				}
			}
			function N(e, t, n) {
				a.push(e), a.push(t), a.push(n);
			}
			function ce(e, t, i) {
				ue(e), ue(t), ue(i);
				let a = r.length / 3, o = h.generateTopUV(n, r, a - 3, a - 2, a - 1);
				de(o[0]), de(o[1]), de(o[2]);
			}
			function le(e, t, i, a) {
				ue(e), ue(t), ue(a), ue(t), ue(i), ue(a);
				let o = r.length / 3, s = h.generateSideWallUV(n, r, o - 6, o - 3, o - 2, o - 1);
				de(s[0]), de(s[1]), de(s[3]), de(s[1]), de(s[2]), de(s[3]);
			}
			function ue(e) {
				r.push(a[e * 3 + 0]), r.push(a[e * 3 + 1]), r.push(a[e * 3 + 2]);
			}
			function de(e) {
				i.push(e.x), i.push(e.y);
			}
		}
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	toJSON() {
		let e = super.toJSON(), t = this.parameters.shapes, n = this.parameters.options;
		return Zl(t, n, e);
	}
	static fromJSON(t, n) {
		let r = [];
		for (let e = 0, i = t.shapes.length; e < i; e++) {
			let i = n[t.shapes[e]];
			r.push(i);
		}
		let i = t.options.extrudePath;
		return i !== void 0 && (t.options.extrudePath = new cl[i.type]().fromJSON(i)), new e(r, t.options);
	}
}, Xl = {
	generateTopUV: function(e, t, n, r, i) {
		let a = t[n * 3], o = t[n * 3 + 1], s = t[r * 3], c = t[r * 3 + 1], l = t[i * 3], u = t[i * 3 + 1];
		return [
			new H(a, o),
			new H(s, c),
			new H(l, u)
		];
	},
	generateSideWallUV: function(e, t, n, r, i, a) {
		let o = t[n * 3], s = t[n * 3 + 1], c = t[n * 3 + 2], l = t[r * 3], u = t[r * 3 + 1], d = t[r * 3 + 2], f = t[i * 3], p = t[i * 3 + 1], m = t[i * 3 + 2], h = t[a * 3], g = t[a * 3 + 1], _ = t[a * 3 + 2];
		return Math.abs(s - u) < Math.abs(o - l) ? [
			new H(o, 1 - c),
			new H(l, 1 - d),
			new H(f, 1 - m),
			new H(h, 1 - _)
		] : [
			new H(s, 1 - c),
			new H(u, 1 - d),
			new H(p, 1 - m),
			new H(g, 1 - _)
		];
	}
};
function Zl(e, t, n) {
	if (n.shapes = [], Array.isArray(e)) for (let t = 0, r = e.length; t < r; t++) {
		let r = e[t];
		n.shapes.push(r.uuid);
	}
	else n.shapes.push(e.uuid);
	return n.options = Object.assign({}, t), t.extrudePath !== void 0 && (n.options.extrudePath = t.extrudePath.toJSON()), n;
}
var Ql = class e extends Oc {
	constructor(e = 1, t = 0) {
		let n = (1 + Math.sqrt(5)) / 2, r = [
			-1,
			n,
			0,
			1,
			n,
			0,
			-1,
			-n,
			0,
			1,
			-n,
			0,
			0,
			-1,
			n,
			0,
			1,
			n,
			0,
			-1,
			-n,
			0,
			1,
			-n,
			n,
			0,
			-1,
			n,
			0,
			1,
			-n,
			0,
			-1,
			-n,
			0,
			1
		];
		super(r, [
			0,
			11,
			5,
			0,
			5,
			1,
			0,
			1,
			7,
			0,
			7,
			10,
			0,
			10,
			11,
			1,
			5,
			9,
			5,
			11,
			4,
			11,
			10,
			2,
			10,
			7,
			6,
			7,
			1,
			8,
			3,
			9,
			4,
			3,
			4,
			2,
			3,
			2,
			6,
			3,
			6,
			8,
			3,
			8,
			9,
			4,
			9,
			5,
			2,
			4,
			11,
			6,
			2,
			10,
			8,
			6,
			7,
			9,
			8,
			1
		], e, t), this.type = "IcosahedronGeometry", this.parameters = {
			radius: e,
			detail: t
		};
	}
	static fromJSON(t) {
		return new e(t.radius, t.detail);
	}
}, $l = class e extends Z {
	constructor(e = [
		new H(0, -.5),
		new H(.5, 0),
		new H(0, .5)
	], t = 12, n = 0, r = Math.PI * 2) {
		super(), this.type = "LatheGeometry", this.parameters = {
			points: e,
			segments: t,
			phiStart: n,
			phiLength: r
		}, t = Math.floor(t), r = B(r, 0, Math.PI * 2);
		let i = [], a = [], o = [], s = [], c = [], l = 1 / t, u = new U(), d = new H(), f = new U(), p = new U(), m = new U(), h = 0, g = 0;
		for (let t = 0; t <= e.length - 1; t++) switch (t) {
			case 0:
				h = e[t + 1].x - e[t].x, g = e[t + 1].y - e[t].y, f.x = g * 1, f.y = -h, f.z = g * 0, m.copy(f), f.normalize(), s.push(f.x, f.y, f.z);
				break;
			case e.length - 1:
				s.push(m.x, m.y, m.z);
				break;
			default: h = e[t + 1].x - e[t].x, g = e[t + 1].y - e[t].y, f.x = g * 1, f.y = -h, f.z = g * 0, p.copy(f), f.x += m.x, f.y += m.y, f.z += m.z, f.normalize(), s.push(f.x, f.y, f.z), m.copy(p);
		}
		for (let i = 0; i <= t; i++) {
			let f = n + i * l * r, p = Math.sin(f), m = Math.cos(f);
			for (let n = 0; n <= e.length - 1; n++) {
				u.x = e[n].x * p, u.y = e[n].y, u.z = e[n].x * m, a.push(u.x, u.y, u.z), d.x = i / t, d.y = n / (e.length - 1), o.push(d.x, d.y);
				let r = s[3 * n + 0] * p, l = s[3 * n + 1], f = s[3 * n + 0] * m;
				c.push(r, l, f);
			}
		}
		for (let n = 0; n < t; n++) for (let t = 0; t < e.length - 1; t++) {
			let r = t + n * e.length, a = r, o = r + e.length, s = r + e.length + 1, c = r + 1;
			i.push(a, o, c), i.push(s, c, o);
		}
		this.setIndex(i), this.setAttribute("position", new X(a, 3)), this.setAttribute("uv", new X(o, 2)), this.setAttribute("normal", new X(c, 3));
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.points, t.segments, t.phiStart, t.phiLength);
	}
}, eu = class e extends Oc {
	constructor(e = 1, t = 0) {
		super([
			1,
			0,
			0,
			-1,
			0,
			0,
			0,
			1,
			0,
			0,
			-1,
			0,
			0,
			0,
			1,
			0,
			0,
			-1
		], [
			0,
			2,
			4,
			0,
			4,
			3,
			0,
			3,
			5,
			0,
			5,
			2,
			1,
			2,
			5,
			1,
			5,
			3,
			1,
			3,
			4,
			1,
			4,
			2
		], e, t), this.type = "OctahedronGeometry", this.parameters = {
			radius: e,
			detail: t
		};
	}
	static fromJSON(t) {
		return new e(t.radius, t.detail);
	}
}, tu = class e extends Z {
	constructor(e = 1, t = 1, n = 1, r = 1) {
		super(), this.type = "PlaneGeometry", this.parameters = {
			width: e,
			height: t,
			widthSegments: n,
			heightSegments: r
		};
		let i = e / 2, a = t / 2, o = Math.floor(n), s = Math.floor(r), c = o + 1, l = s + 1, u = e / o, d = t / s, f = [], p = [], m = [], h = [];
		for (let e = 0; e < l; e++) {
			let t = e * d - a;
			for (let n = 0; n < c; n++) {
				let r = n * u - i;
				p.push(r, -t, 0), m.push(0, 0, 1), h.push(n / o), h.push(1 - e / s);
			}
		}
		for (let e = 0; e < s; e++) for (let t = 0; t < o; t++) {
			let n = t + c * e, r = t + c * (e + 1), i = t + 1 + c * (e + 1), a = t + 1 + c * e;
			f.push(n, r, a), f.push(r, i, a);
		}
		this.setIndex(f), this.setAttribute("position", new X(p, 3)), this.setAttribute("normal", new X(m, 3)), this.setAttribute("uv", new X(h, 2));
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.width, t.height, t.widthSegments, t.heightSegments);
	}
}, nu = class e extends Z {
	constructor(e = .5, t = 1, n = 32, r = 1, i = 0, a = Math.PI * 2) {
		super(), this.type = "RingGeometry", this.parameters = {
			innerRadius: e,
			outerRadius: t,
			thetaSegments: n,
			phiSegments: r,
			thetaStart: i,
			thetaLength: a
		}, n = Math.max(3, n), r = Math.max(1, r);
		let o = [], s = [], c = [], l = [], u = e, d = (t - e) / r, f = new U(), p = new H();
		for (let e = 0; e <= r; e++) {
			for (let e = 0; e <= n; e++) {
				let r = i + e / n * a;
				f.x = u * Math.cos(r), f.y = u * Math.sin(r), s.push(f.x, f.y, f.z), c.push(0, 0, 1), p.x = (f.x / t + 1) / 2, p.y = (f.y / t + 1) / 2, l.push(p.x, p.y);
			}
			u += d;
		}
		for (let e = 0; e < r; e++) {
			let t = e * (n + 1);
			for (let e = 0; e < n; e++) {
				let r = e + t, i = r, a = r + n + 1, s = r + n + 2, c = r + 1;
				o.push(i, a, c), o.push(a, s, c);
			}
		}
		this.setIndex(o), this.setAttribute("position", new X(s, 3)), this.setAttribute("normal", new X(c, 3)), this.setAttribute("uv", new X(l, 2));
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.innerRadius, t.outerRadius, t.thetaSegments, t.phiSegments, t.thetaStart, t.thetaLength);
	}
}, ru = class e extends Z {
	constructor(e = new dl([
		new H(0, .5),
		new H(-.5, -.5),
		new H(.5, -.5)
	]), t = 12) {
		super(), this.type = "ShapeGeometry", this.parameters = {
			shapes: e,
			curveSegments: t
		};
		let n = [], r = [], i = [], a = [], o = 0, s = 0;
		if (Array.isArray(e) === !1) c(e);
		else for (let t = 0; t < e.length; t++) c(e[t]), this.addGroup(o, s, t), o += s, s = 0;
		this.setIndex(n), this.setAttribute("position", new X(r, 3)), this.setAttribute("normal", new X(i, 3)), this.setAttribute("uv", new X(a, 2));
		function c(e) {
			let o = r.length / 3, c = e.extractPoints(t), l = c.shape, u = c.holes;
			Kl.isClockWise(l) === !1 && (l = l.reverse());
			for (let e = 0, t = u.length; e < t; e++) {
				let t = u[e];
				Kl.isClockWise(t) === !0 && (u[e] = t.reverse());
			}
			let d = Kl.triangulateShape(l, u);
			for (let e = 0, t = u.length; e < t; e++) {
				let t = u[e];
				l = l.concat(t);
			}
			for (let e = 0, t = l.length; e < t; e++) {
				let t = l[e];
				r.push(t.x, t.y, 0), i.push(0, 0, 1), a.push(t.x, t.y);
			}
			for (let e = 0, t = d.length; e < t; e++) {
				let t = d[e], r = t[0] + o, i = t[1] + o, a = t[2] + o;
				n.push(r, i, a), s += 3;
			}
		}
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	toJSON() {
		let e = super.toJSON(), t = this.parameters.shapes;
		return iu(t, e);
	}
	static fromJSON(t, n) {
		let r = [];
		for (let e = 0, i = t.shapes.length; e < i; e++) {
			let i = n[t.shapes[e]];
			r.push(i);
		}
		return new e(r, t.curveSegments);
	}
};
function iu(e, t) {
	if (t.shapes = [], Array.isArray(e)) for (let n = 0, r = e.length; n < r; n++) {
		let r = e[n];
		t.shapes.push(r.uuid);
	}
	else t.shapes.push(e.uuid);
	return t;
}
var au = class e extends Z {
	constructor(e = 1, t = 32, n = 16, r = 0, i = Math.PI * 2, a = 0, o = Math.PI) {
		super(), this.type = "SphereGeometry", this.parameters = {
			radius: e,
			widthSegments: t,
			heightSegments: n,
			phiStart: r,
			phiLength: i,
			thetaStart: a,
			thetaLength: o
		}, t = Math.max(3, Math.floor(t)), n = Math.max(2, Math.floor(n));
		let s = Math.min(a + o, Math.PI), c = 0, l = [], u = new U(), d = new U(), f = [], p = [], m = [], h = [];
		for (let f = 0; f <= n; f++) {
			let g = [], _ = f / n, v = a + _ * o, y = e * Math.cos(v), b = Math.sqrt(e * e - y * y), x = 0;
			f === 0 && a === 0 ? x = .5 / t : f === n && s === Math.PI && (x = -.5 / t);
			for (let e = 0; e <= t; e++) {
				let n = e / t, a = r + n * i;
				u.x = -b * Math.cos(a), u.y = y, u.z = b * Math.sin(a), p.push(u.x, u.y, u.z), d.copy(u).normalize(), m.push(d.x, d.y, d.z), h.push(n + x, 1 - _), g.push(c++);
			}
			l.push(g);
		}
		for (let e = 0; e < n; e++) for (let r = 0; r < t; r++) {
			let t = l[e][r + 1], i = l[e][r], o = l[e + 1][r], c = l[e + 1][r + 1];
			(e !== 0 || a > 0) && f.push(t, i, c), (e !== n - 1 || s < Math.PI) && f.push(i, o, c);
		}
		this.setIndex(f), this.setAttribute("position", new X(p, 3)), this.setAttribute("normal", new X(m, 3)), this.setAttribute("uv", new X(h, 2));
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.radius, t.widthSegments, t.heightSegments, t.phiStart, t.phiLength, t.thetaStart, t.thetaLength);
	}
}, ou = class e extends Oc {
	constructor(e = 1, t = 0) {
		super([
			1,
			1,
			1,
			-1,
			-1,
			1,
			-1,
			1,
			-1,
			1,
			-1,
			-1
		], [
			2,
			1,
			0,
			0,
			3,
			2,
			1,
			3,
			0,
			2,
			3,
			1
		], e, t), this.type = "TetrahedronGeometry", this.parameters = {
			radius: e,
			detail: t
		};
	}
	static fromJSON(t) {
		return new e(t.radius, t.detail);
	}
}, su = class e extends Z {
	constructor(e = 1, t = .4, n = 12, r = 48, i = Math.PI * 2, a = 0, o = Math.PI * 2) {
		super(), this.type = "TorusGeometry", this.parameters = {
			radius: e,
			tube: t,
			radialSegments: n,
			tubularSegments: r,
			arc: i,
			thetaStart: a,
			thetaLength: o
		}, n = Math.floor(n), r = Math.floor(r);
		let s = [], c = [], l = [], u = [], d = new U(), f = new U(), p = new U();
		for (let s = 0; s <= n; s++) {
			let m = a + s / n * o;
			for (let a = 0; a <= r; a++) {
				let o = a / r * i;
				f.x = (e + t * Math.cos(m)) * Math.cos(o), f.y = (e + t * Math.cos(m)) * Math.sin(o), f.z = t * Math.sin(m), c.push(f.x, f.y, f.z), d.x = e * Math.cos(o), d.y = e * Math.sin(o), p.subVectors(f, d).normalize(), l.push(p.x, p.y, p.z), u.push(a / r), u.push(s / n);
			}
		}
		for (let e = 1; e <= n; e++) for (let t = 1; t <= r; t++) {
			let n = (r + 1) * e + t - 1, i = (r + 1) * (e - 1) + t - 1, a = (r + 1) * (e - 1) + t, o = (r + 1) * e + t;
			s.push(n, i, o), s.push(i, a, o);
		}
		this.setIndex(s), this.setAttribute("position", new X(c, 3)), this.setAttribute("normal", new X(l, 3)), this.setAttribute("uv", new X(u, 2));
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.radius, t.tube, t.radialSegments, t.tubularSegments, t.arc);
	}
}, cu = class e extends Z {
	constructor(e = 1, t = .4, n = 64, r = 8, i = 2, a = 3) {
		super(), this.type = "TorusKnotGeometry", this.parameters = {
			radius: e,
			tube: t,
			tubularSegments: n,
			radialSegments: r,
			p: i,
			q: a
		}, n = Math.floor(n), r = Math.floor(r);
		let o = [], s = [], c = [], l = [], u = new U(), d = new U(), f = new U(), p = new U(), m = new U(), h = new U(), g = new U();
		for (let o = 0; o <= n; ++o) {
			let v = o / n * i * Math.PI * 2;
			_(v, i, a, e, f), _(v + .01, i, a, e, p), h.subVectors(p, f), g.addVectors(p, f), m.crossVectors(h, g), g.crossVectors(m, h), m.normalize(), g.normalize();
			for (let e = 0; e <= r; ++e) {
				let i = e / r * Math.PI * 2, a = -t * Math.cos(i), p = t * Math.sin(i);
				u.x = f.x + (a * g.x + p * m.x), u.y = f.y + (a * g.y + p * m.y), u.z = f.z + (a * g.z + p * m.z), s.push(u.x, u.y, u.z), d.subVectors(u, f).normalize(), c.push(d.x, d.y, d.z), l.push(o / n), l.push(e / r);
			}
		}
		for (let e = 1; e <= n; e++) for (let t = 1; t <= r; t++) {
			let n = (r + 1) * (e - 1) + (t - 1), i = (r + 1) * e + (t - 1), a = (r + 1) * e + t, s = (r + 1) * (e - 1) + t;
			o.push(n, i, s), o.push(i, a, s);
		}
		this.setIndex(o), this.setAttribute("position", new X(s, 3)), this.setAttribute("normal", new X(c, 3)), this.setAttribute("uv", new X(l, 2));
		function _(e, t, n, r, i) {
			let a = Math.cos(e), o = Math.sin(e), s = n / t * e, c = Math.cos(s);
			i.x = r * (2 + c) * .5 * a, i.y = r * (2 + c) * o * .5, i.z = r * Math.sin(s) * .5;
		}
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	static fromJSON(t) {
		return new e(t.radius, t.tube, t.tubularSegments, t.radialSegments, t.p, t.q);
	}
}, lu = class e extends Z {
	constructor(e = new ol(new U(-1, -1, 0), new U(-1, 1, 0), new U(1, 1, 0)), t = 64, n = 1, r = 8, i = !1) {
		super(), this.type = "TubeGeometry", this.parameters = {
			path: e,
			tubularSegments: t,
			radius: n,
			radialSegments: r,
			closed: i
		};
		let a = e.computeFrenetFrames(t, i);
		this.tangents = a.tangents, this.normals = a.normals, this.binormals = a.binormals;
		let o = new U(), s = new U(), c = new H(), l = new U(), u = [], d = [], f = [], p = [];
		m(), this.setIndex(p), this.setAttribute("position", new X(u, 3)), this.setAttribute("normal", new X(d, 3)), this.setAttribute("uv", new X(f, 2));
		function m() {
			for (let e = 0; e < t; e++) h(e);
			h(i === !1 ? t : 0), _(), g();
		}
		function h(i) {
			l = e.getPointAt(i / t, l);
			let c = a.normals[i], f = a.binormals[i];
			for (let e = 0; e <= r; e++) {
				let t = e / r * Math.PI * 2, i = Math.sin(t), a = -Math.cos(t);
				s.x = a * c.x + i * f.x, s.y = a * c.y + i * f.y, s.z = a * c.z + i * f.z, s.normalize(), d.push(s.x, s.y, s.z), o.x = l.x + n * s.x, o.y = l.y + n * s.y, o.z = l.z + n * s.z, u.push(o.x, o.y, o.z);
			}
		}
		function g() {
			for (let e = 1; e <= t; e++) for (let t = 1; t <= r; t++) {
				let n = (r + 1) * (e - 1) + (t - 1), i = (r + 1) * e + (t - 1), a = (r + 1) * e + t, o = (r + 1) * (e - 1) + t;
				p.push(n, i, o), p.push(i, a, o);
			}
		}
		function _() {
			for (let e = 0; e <= t; e++) for (let n = 0; n <= r; n++) c.x = e / t, c.y = n / r, f.push(c.x, c.y);
		}
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
	toJSON() {
		let e = super.toJSON();
		return e.path = this.parameters.path.toJSON(), e;
	}
	static fromJSON(t) {
		return new e(new cl[t.path.type]().fromJSON(t.path), t.tubularSegments, t.radius, t.radialSegments, t.closed);
	}
}, uu = class extends Z {
	constructor(e = null) {
		if (super(), this.type = "WireframeGeometry", this.parameters = { geometry: e }, e !== null) {
			let t = [], n = /* @__PURE__ */ new Set(), r = new U(), i = new U();
			if (e.index !== null) {
				let a = e.attributes.position, o = e.index, s = e.groups;
				s.length === 0 && (s = [{
					start: 0,
					count: o.count,
					materialIndex: 0
				}]);
				for (let e = 0, c = s.length; e < c; ++e) {
					let c = s[e], l = c.start, u = c.count;
					for (let e = l, s = l + u; e < s; e += 3) for (let s = 0; s < 3; s++) {
						let c = o.getX(e + s), l = o.getX(e + (s + 1) % 3);
						r.fromBufferAttribute(a, c), i.fromBufferAttribute(a, l), du(r, i, n) === !0 && (t.push(r.x, r.y, r.z), t.push(i.x, i.y, i.z));
					}
				}
			} else {
				let a = e.attributes.position;
				for (let e = 0, o = a.count / 3; e < o; e++) for (let o = 0; o < 3; o++) {
					let s = 3 * e + o, c = 3 * e + (o + 1) % 3;
					r.fromBufferAttribute(a, s), i.fromBufferAttribute(a, c), du(r, i, n) === !0 && (t.push(r.x, r.y, r.z), t.push(i.x, i.y, i.z));
				}
			}
			this.setAttribute("position", new X(t, 3));
		}
	}
	copy(e) {
		return super.copy(e), this.parameters = Object.assign({}, e.parameters), this;
	}
};
function du(e, t, n) {
	let r = `${e.x},${e.y},${e.z}-${t.x},${t.y},${t.z}`, i = `${t.x},${t.y},${t.z}-${e.x},${e.y},${e.z}`;
	return n.has(r) === !0 || n.has(i) === !0 ? !1 : (n.add(r), n.add(i), !0);
}
var fu = /*#__PURE__*/ Object.freeze({
	__proto__: null,
	BoxGeometry: Cc,
	CapsuleGeometry: wc,
	CircleGeometry: Tc,
	ConeGeometry: Dc,
	CylinderGeometry: Ec,
	DodecahedronGeometry: kc,
	EdgesGeometry: Pc,
	ExtrudeGeometry: Yl,
	IcosahedronGeometry: Ql,
	LatheGeometry: $l,
	OctahedronGeometry: eu,
	PlaneGeometry: tu,
	PolyhedronGeometry: Oc,
	RingGeometry: nu,
	ShapeGeometry: ru,
	SphereGeometry: au,
	TetrahedronGeometry: ou,
	TorusGeometry: su,
	TorusKnotGeometry: cu,
	TubeGeometry: lu,
	WireframeGeometry: uu
}), pu = class extends to {
	constructor(e) {
		super(), this.isShadowMaterial = !0, this.type = "ShadowMaterial", this.color = new J(0), this.transparent = !0, this.fog = !0, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.color.copy(e.color), this.fog = e.fog, this;
	}
};
function mu(e) {
	let t = {};
	for (let n in e) {
		t[n] = {};
		for (let r in e[n]) {
			let i = e[n][r];
			if (gu(i)) i.isRenderTargetTexture ? (R("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."), t[n][r] = null) : t[n][r] = i.clone();
			else if (Array.isArray(i)) if (gu(i[0])) {
				let e = [];
				for (let t = 0, n = i.length; t < n; t++) e[t] = i[t].clone();
				t[n][r] = e;
			} else t[n][r] = i.slice();
			else t[n][r] = i;
		}
	}
	return t;
}
function hu(e) {
	let t = {};
	for (let n = 0; n < e.length; n++) {
		let r = mu(e[n]);
		for (let e in r) t[e] = r[e];
	}
	return t;
}
function gu(e) {
	return e && (e.isColor || e.isMatrix3 || e.isMatrix4 || e.isVector2 || e.isVector3 || e.isVector4 || e.isTexture || e.isQuaternion);
}
function _u(e) {
	let t = [];
	for (let n = 0; n < e.length; n++) t.push(e[n].clone());
	return t;
}
function vu(e) {
	let t = e.getRenderTarget();
	return t === null ? e.outputColorSpace : t.isXRRenderTarget === !0 ? t.texture.colorSpace : G.workingColorSpace;
}
var yu = {
	clone: mu,
	merge: hu
}, bu = "void main() {\n	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}", xu = "void main() {\n	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );\n}", Su = class extends to {
	constructor(e) {
		super(), this.isShaderMaterial = !0, this.type = "ShaderMaterial", this.defines = {}, this.uniforms = {}, this.uniformsGroups = [], this.vertexShader = bu, this.fragmentShader = xu, this.linewidth = 1, this.wireframe = !1, this.wireframeLinewidth = 1, this.fog = !1, this.lights = !1, this.clipping = !1, this.forceSinglePass = !0, this.extensions = {
			clipCullDistance: !1,
			multiDraw: !1
		}, this.defaultAttributeValues = {
			color: [
				1,
				1,
				1
			],
			uv: [0, 0],
			uv1: [0, 0]
		}, this.index0AttributeName = void 0, this.uniformsNeedUpdate = !1, this.glslVersion = null, e !== void 0 && this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.fragmentShader = e.fragmentShader, this.vertexShader = e.vertexShader, this.uniforms = mu(e.uniforms), this.uniformsGroups = _u(e.uniformsGroups), this.defines = Object.assign({}, e.defines), this.wireframe = e.wireframe, this.wireframeLinewidth = e.wireframeLinewidth, this.fog = e.fog, this.lights = e.lights, this.clipping = e.clipping, this.extensions = Object.assign({}, e.extensions), this.glslVersion = e.glslVersion, this.defaultAttributeValues = Object.assign({}, e.defaultAttributeValues), this.index0AttributeName = e.index0AttributeName, this.uniformsNeedUpdate = e.uniformsNeedUpdate, this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		t.glslVersion = this.glslVersion, t.uniforms = {};
		for (let n in this.uniforms) {
			let r = this.uniforms[n].value;
			r && r.isTexture ? t.uniforms[n] = {
				type: "t",
				value: r.toJSON(e).uuid
			} : r && r.isColor ? t.uniforms[n] = {
				type: "c",
				value: r.getHex()
			} : r && r.isVector2 ? t.uniforms[n] = {
				type: "v2",
				value: r.toArray()
			} : r && r.isVector3 ? t.uniforms[n] = {
				type: "v3",
				value: r.toArray()
			} : r && r.isVector4 ? t.uniforms[n] = {
				type: "v4",
				value: r.toArray()
			} : r && r.isMatrix3 ? t.uniforms[n] = {
				type: "m3",
				value: r.toArray()
			} : r && r.isMatrix4 ? t.uniforms[n] = {
				type: "m4",
				value: r.toArray()
			} : t.uniforms[n] = { value: r };
		}
		Object.keys(this.defines).length > 0 && (t.defines = this.defines), t.vertexShader = this.vertexShader, t.fragmentShader = this.fragmentShader, t.lights = this.lights, t.clipping = this.clipping;
		let n = {};
		for (let e in this.extensions) this.extensions[e] === !0 && (n[e] = !0);
		return Object.keys(n).length > 0 && (t.extensions = n), t;
	}
	fromJSON(e, t) {
		if (super.fromJSON(e, t), e.uniforms !== void 0) for (let n in e.uniforms) {
			let r = e.uniforms[n];
			switch (this.uniforms[n] = {}, r.type) {
				case "t":
					this.uniforms[n].value = t[r.value] || null;
					break;
				case "c":
					this.uniforms[n].value = new J().setHex(r.value);
					break;
				case "v2":
					this.uniforms[n].value = new H().fromArray(r.value);
					break;
				case "v3":
					this.uniforms[n].value = new U().fromArray(r.value);
					break;
				case "v4":
					this.uniforms[n].value = new ai().fromArray(r.value);
					break;
				case "m3":
					this.uniforms[n].value = new W().fromArray(r.value);
					break;
				case "m4":
					this.uniforms[n].value = new K().fromArray(r.value);
					break;
				default: this.uniforms[n].value = r.value;
			}
		}
		if (e.defines !== void 0 && (this.defines = e.defines), e.vertexShader !== void 0 && (this.vertexShader = e.vertexShader), e.fragmentShader !== void 0 && (this.fragmentShader = e.fragmentShader), e.glslVersion !== void 0 && (this.glslVersion = e.glslVersion), e.extensions !== void 0) for (let t in e.extensions) this.extensions[t] = e.extensions[t];
		return e.lights !== void 0 && (this.lights = e.lights), e.clipping !== void 0 && (this.clipping = e.clipping), this;
	}
}, Cu = class extends Su {
	constructor(e) {
		super(e), this.isRawShaderMaterial = !0, this.type = "RawShaderMaterial";
	}
}, wu = class extends to {
	constructor(e) {
		super(), this.isMeshStandardMaterial = !0, this.type = "MeshStandardMaterial", this.defines = { STANDARD: "" }, this.color = new J(16777215), this.roughness = 1, this.metalness = 0, this.map = null, this.lightMap = null, this.lightMapIntensity = 1, this.aoMap = null, this.aoMapIntensity = 1, this.emissive = new J(0), this.emissiveIntensity = 1, this.emissiveMap = null, this.bumpMap = null, this.bumpScale = 1, this.normalMap = null, this.normalMapType = 0, this.normalScale = new H(1, 1), this.displacementMap = null, this.displacementScale = 1, this.displacementBias = 0, this.roughnessMap = null, this.metalnessMap = null, this.alphaMap = null, this.envMap = null, this.envMapRotation = new xi(), this.envMapIntensity = 1, this.wireframe = !1, this.wireframeLinewidth = 1, this.wireframeLinecap = "round", this.wireframeLinejoin = "round", this.flatShading = !1, this.fog = !0, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.defines = { STANDARD: "" }, this.color.copy(e.color), this.roughness = e.roughness, this.metalness = e.metalness, this.map = e.map, this.lightMap = e.lightMap, this.lightMapIntensity = e.lightMapIntensity, this.aoMap = e.aoMap, this.aoMapIntensity = e.aoMapIntensity, this.emissive.copy(e.emissive), this.emissiveMap = e.emissiveMap, this.emissiveIntensity = e.emissiveIntensity, this.bumpMap = e.bumpMap, this.bumpScale = e.bumpScale, this.normalMap = e.normalMap, this.normalMapType = e.normalMapType, this.normalScale.copy(e.normalScale), this.displacementMap = e.displacementMap, this.displacementScale = e.displacementScale, this.displacementBias = e.displacementBias, this.roughnessMap = e.roughnessMap, this.metalnessMap = e.metalnessMap, this.alphaMap = e.alphaMap, this.envMap = e.envMap, this.envMapRotation.copy(e.envMapRotation), this.envMapIntensity = e.envMapIntensity, this.wireframe = e.wireframe, this.wireframeLinewidth = e.wireframeLinewidth, this.wireframeLinecap = e.wireframeLinecap, this.wireframeLinejoin = e.wireframeLinejoin, this.flatShading = e.flatShading, this.fog = e.fog, this;
	}
}, Tu = class extends wu {
	constructor(e) {
		super(), this.isMeshPhysicalMaterial = !0, this.defines = {
			STANDARD: "",
			PHYSICAL: ""
		}, this.type = "MeshPhysicalMaterial", this.anisotropyRotation = 0, this.anisotropyMap = null, this.clearcoatMap = null, this.clearcoatRoughness = 0, this.clearcoatRoughnessMap = null, this.clearcoatNormalScale = new H(1, 1), this.clearcoatNormalMap = null, this.ior = 1.5, Object.defineProperty(this, "reflectivity", {
			get: function() {
				return B(2.5 * (this.ior - 1) / (this.ior + 1), 0, 1);
			},
			set: function(e) {
				this.ior = (1 + .4 * e) / (1 - .4 * e);
			}
		}), this.iridescenceMap = null, this.iridescenceIOR = 1.3, this.iridescenceThicknessRange = [100, 400], this.iridescenceThicknessMap = null, this.sheenColor = new J(0), this.sheenColorMap = null, this.sheenRoughness = 1, this.sheenRoughnessMap = null, this.transmissionMap = null, this.thickness = 0, this.thicknessMap = null, this.attenuationDistance = Infinity, this.attenuationColor = new J(1, 1, 1), this.specularIntensity = 1, this.specularIntensityMap = null, this.specularColor = new J(1, 1, 1), this.specularColorMap = null, this._anisotropy = 0, this._clearcoat = 0, this._dispersion = 0, this._iridescence = 0, this._sheen = 0, this._transmission = 0, this.setValues(e);
	}
	get anisotropy() {
		return this._anisotropy;
	}
	set anisotropy(e) {
		this._anisotropy > 0 != e > 0 && this.version++, this._anisotropy = e;
	}
	get clearcoat() {
		return this._clearcoat;
	}
	set clearcoat(e) {
		this._clearcoat > 0 != e > 0 && this.version++, this._clearcoat = e;
	}
	get iridescence() {
		return this._iridescence;
	}
	set iridescence(e) {
		this._iridescence > 0 != e > 0 && this.version++, this._iridescence = e;
	}
	get dispersion() {
		return this._dispersion;
	}
	set dispersion(e) {
		this._dispersion > 0 != e > 0 && this.version++, this._dispersion = e;
	}
	get sheen() {
		return this._sheen;
	}
	set sheen(e) {
		this._sheen > 0 != e > 0 && this.version++, this._sheen = e;
	}
	get transmission() {
		return this._transmission;
	}
	set transmission(e) {
		this._transmission > 0 != e > 0 && this.version++, this._transmission = e;
	}
	copy(e) {
		return super.copy(e), this.defines = {
			STANDARD: "",
			PHYSICAL: ""
		}, this.anisotropy = e.anisotropy, this.anisotropyRotation = e.anisotropyRotation, this.anisotropyMap = e.anisotropyMap, this.clearcoat = e.clearcoat, this.clearcoatMap = e.clearcoatMap, this.clearcoatRoughness = e.clearcoatRoughness, this.clearcoatRoughnessMap = e.clearcoatRoughnessMap, this.clearcoatNormalMap = e.clearcoatNormalMap, this.clearcoatNormalScale.copy(e.clearcoatNormalScale), this.dispersion = e.dispersion, this.ior = e.ior, this.iridescence = e.iridescence, this.iridescenceMap = e.iridescenceMap, this.iridescenceIOR = e.iridescenceIOR, this.iridescenceThicknessRange = [...e.iridescenceThicknessRange], this.iridescenceThicknessMap = e.iridescenceThicknessMap, this.sheen = e.sheen, this.sheenColor.copy(e.sheenColor), this.sheenColorMap = e.sheenColorMap, this.sheenRoughness = e.sheenRoughness, this.sheenRoughnessMap = e.sheenRoughnessMap, this.transmission = e.transmission, this.transmissionMap = e.transmissionMap, this.thickness = e.thickness, this.thicknessMap = e.thicknessMap, this.attenuationDistance = e.attenuationDistance, this.attenuationColor.copy(e.attenuationColor), this.specularIntensity = e.specularIntensity, this.specularIntensityMap = e.specularIntensityMap, this.specularColor.copy(e.specularColor), this.specularColorMap = e.specularColorMap, this;
	}
}, Eu = class extends to {
	constructor(e) {
		super(), this.isMeshPhongMaterial = !0, this.type = "MeshPhongMaterial", this.color = new J(16777215), this.specular = new J(1118481), this.shininess = 30, this.map = null, this.lightMap = null, this.lightMapIntensity = 1, this.aoMap = null, this.aoMapIntensity = 1, this.emissive = new J(0), this.emissiveIntensity = 1, this.emissiveMap = null, this.bumpMap = null, this.bumpScale = 1, this.normalMap = null, this.normalMapType = 0, this.normalScale = new H(1, 1), this.displacementMap = null, this.displacementScale = 1, this.displacementBias = 0, this.specularMap = null, this.alphaMap = null, this.envMap = null, this.envMapRotation = new xi(), this.combine = 0, this.reflectivity = 1, this.envMapIntensity = 1, this.refractionRatio = .98, this.wireframe = !1, this.wireframeLinewidth = 1, this.wireframeLinecap = "round", this.wireframeLinejoin = "round", this.flatShading = !1, this.fog = !0, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.color.copy(e.color), this.specular.copy(e.specular), this.shininess = e.shininess, this.map = e.map, this.lightMap = e.lightMap, this.lightMapIntensity = e.lightMapIntensity, this.aoMap = e.aoMap, this.aoMapIntensity = e.aoMapIntensity, this.emissive.copy(e.emissive), this.emissiveMap = e.emissiveMap, this.emissiveIntensity = e.emissiveIntensity, this.bumpMap = e.bumpMap, this.bumpScale = e.bumpScale, this.normalMap = e.normalMap, this.normalMapType = e.normalMapType, this.normalScale.copy(e.normalScale), this.displacementMap = e.displacementMap, this.displacementScale = e.displacementScale, this.displacementBias = e.displacementBias, this.specularMap = e.specularMap, this.alphaMap = e.alphaMap, this.envMap = e.envMap, this.envMapRotation.copy(e.envMapRotation), this.combine = e.combine, this.reflectivity = e.reflectivity, this.envMapIntensity = e.envMapIntensity, this.refractionRatio = e.refractionRatio, this.wireframe = e.wireframe, this.wireframeLinewidth = e.wireframeLinewidth, this.wireframeLinecap = e.wireframeLinecap, this.wireframeLinejoin = e.wireframeLinejoin, this.flatShading = e.flatShading, this.fog = e.fog, this;
	}
}, Du = class extends to {
	constructor(e) {
		super(), this.isMeshToonMaterial = !0, this.defines = { TOON: "" }, this.type = "MeshToonMaterial", this.color = new J(16777215), this.map = null, this.gradientMap = null, this.lightMap = null, this.lightMapIntensity = 1, this.aoMap = null, this.aoMapIntensity = 1, this.emissive = new J(0), this.emissiveIntensity = 1, this.emissiveMap = null, this.bumpMap = null, this.bumpScale = 1, this.normalMap = null, this.normalMapType = 0, this.normalScale = new H(1, 1), this.displacementMap = null, this.displacementScale = 1, this.displacementBias = 0, this.alphaMap = null, this.wireframe = !1, this.wireframeLinewidth = 1, this.wireframeLinecap = "round", this.wireframeLinejoin = "round", this.fog = !0, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.color.copy(e.color), this.map = e.map, this.gradientMap = e.gradientMap, this.lightMap = e.lightMap, this.lightMapIntensity = e.lightMapIntensity, this.aoMap = e.aoMap, this.aoMapIntensity = e.aoMapIntensity, this.emissive.copy(e.emissive), this.emissiveMap = e.emissiveMap, this.emissiveIntensity = e.emissiveIntensity, this.bumpMap = e.bumpMap, this.bumpScale = e.bumpScale, this.normalMap = e.normalMap, this.normalMapType = e.normalMapType, this.normalScale.copy(e.normalScale), this.displacementMap = e.displacementMap, this.displacementScale = e.displacementScale, this.displacementBias = e.displacementBias, this.alphaMap = e.alphaMap, this.wireframe = e.wireframe, this.wireframeLinewidth = e.wireframeLinewidth, this.wireframeLinecap = e.wireframeLinecap, this.wireframeLinejoin = e.wireframeLinejoin, this.fog = e.fog, this;
	}
}, Ou = class extends to {
	constructor(e) {
		super(), this.isMeshNormalMaterial = !0, this.type = "MeshNormalMaterial", this.bumpMap = null, this.bumpScale = 1, this.normalMap = null, this.normalMapType = 0, this.normalScale = new H(1, 1), this.displacementMap = null, this.displacementScale = 1, this.displacementBias = 0, this.wireframe = !1, this.wireframeLinewidth = 1, this.flatShading = !1, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.bumpMap = e.bumpMap, this.bumpScale = e.bumpScale, this.normalMap = e.normalMap, this.normalMapType = e.normalMapType, this.normalScale.copy(e.normalScale), this.displacementMap = e.displacementMap, this.displacementScale = e.displacementScale, this.displacementBias = e.displacementBias, this.wireframe = e.wireframe, this.wireframeLinewidth = e.wireframeLinewidth, this.flatShading = e.flatShading, this;
	}
}, ku = class extends to {
	constructor(e) {
		super(), this.isMeshLambertMaterial = !0, this.type = "MeshLambertMaterial", this.color = new J(16777215), this.map = null, this.lightMap = null, this.lightMapIntensity = 1, this.aoMap = null, this.aoMapIntensity = 1, this.emissive = new J(0), this.emissiveIntensity = 1, this.emissiveMap = null, this.bumpMap = null, this.bumpScale = 1, this.normalMap = null, this.normalMapType = 0, this.normalScale = new H(1, 1), this.displacementMap = null, this.displacementScale = 1, this.displacementBias = 0, this.specularMap = null, this.alphaMap = null, this.envMap = null, this.envMapRotation = new xi(), this.combine = 0, this.reflectivity = 1, this.envMapIntensity = 1, this.refractionRatio = .98, this.wireframe = !1, this.wireframeLinewidth = 1, this.wireframeLinecap = "round", this.wireframeLinejoin = "round", this.flatShading = !1, this.fog = !0, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.color.copy(e.color), this.map = e.map, this.lightMap = e.lightMap, this.lightMapIntensity = e.lightMapIntensity, this.aoMap = e.aoMap, this.aoMapIntensity = e.aoMapIntensity, this.emissive.copy(e.emissive), this.emissiveMap = e.emissiveMap, this.emissiveIntensity = e.emissiveIntensity, this.bumpMap = e.bumpMap, this.bumpScale = e.bumpScale, this.normalMap = e.normalMap, this.normalMapType = e.normalMapType, this.normalScale.copy(e.normalScale), this.displacementMap = e.displacementMap, this.displacementScale = e.displacementScale, this.displacementBias = e.displacementBias, this.specularMap = e.specularMap, this.alphaMap = e.alphaMap, this.envMap = e.envMap, this.envMapRotation.copy(e.envMapRotation), this.combine = e.combine, this.reflectivity = e.reflectivity, this.envMapIntensity = e.envMapIntensity, this.refractionRatio = e.refractionRatio, this.wireframe = e.wireframe, this.wireframeLinewidth = e.wireframeLinewidth, this.wireframeLinecap = e.wireframeLinecap, this.wireframeLinejoin = e.wireframeLinejoin, this.flatShading = e.flatShading, this.fog = e.fog, this;
	}
}, Au = class extends to {
	constructor(e) {
		super(), this.isMeshDepthMaterial = !0, this.type = "MeshDepthMaterial", this.depthPacking = wn, this.map = null, this.alphaMap = null, this.displacementMap = null, this.displacementScale = 1, this.displacementBias = 0, this.wireframe = !1, this.wireframeLinewidth = 1, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.depthPacking = e.depthPacking, this.map = e.map, this.alphaMap = e.alphaMap, this.displacementMap = e.displacementMap, this.displacementScale = e.displacementScale, this.displacementBias = e.displacementBias, this.wireframe = e.wireframe, this.wireframeLinewidth = e.wireframeLinewidth, this;
	}
}, ju = class extends to {
	constructor(e) {
		super(), this.isMeshDistanceMaterial = !0, this.type = "MeshDistanceMaterial", this.map = null, this.alphaMap = null, this.displacementMap = null, this.displacementScale = 1, this.displacementBias = 0, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.map = e.map, this.alphaMap = e.alphaMap, this.displacementMap = e.displacementMap, this.displacementScale = e.displacementScale, this.displacementBias = e.displacementBias, this;
	}
}, Mu = class extends to {
	constructor(e) {
		super(), this.isMeshMatcapMaterial = !0, this.defines = { MATCAP: "" }, this.type = "MeshMatcapMaterial", this.color = new J(16777215), this.matcap = null, this.map = null, this.bumpMap = null, this.bumpScale = 1, this.normalMap = null, this.normalMapType = 0, this.normalScale = new H(1, 1), this.displacementMap = null, this.displacementScale = 1, this.displacementBias = 0, this.alphaMap = null, this.wireframe = !1, this.wireframeLinewidth = 1, this.flatShading = !1, this.fog = !0, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.defines = { MATCAP: "" }, this.color.copy(e.color), this.matcap = e.matcap, this.map = e.map, this.bumpMap = e.bumpMap, this.bumpScale = e.bumpScale, this.normalMap = e.normalMap, this.normalMapType = e.normalMapType, this.normalScale.copy(e.normalScale), this.displacementMap = e.displacementMap, this.displacementScale = e.displacementScale, this.displacementBias = e.displacementBias, this.alphaMap = e.alphaMap, this.wireframe = e.wireframe, this.wireframeLinewidth = e.wireframeLinewidth, this.flatShading = e.flatShading, this.fog = e.fog, this;
	}
}, Nu = class extends Ws {
	constructor(e) {
		super(), this.isLineDashedMaterial = !0, this.type = "LineDashedMaterial", this.scale = 1, this.dashSize = 3, this.gapSize = 1, this.setValues(e);
	}
	copy(e) {
		return super.copy(e), this.scale = e.scale, this.dashSize = e.dashSize, this.gapSize = e.gapSize, this;
	}
};
function Pu(e, t) {
	return !e || e.constructor === t ? e : typeof t.BYTES_PER_ELEMENT == "number" ? new t(e) : Array.prototype.slice.call(e);
}
function Fu(e) {
	function t(t, n) {
		return e[t] - e[n];
	}
	let n = e.length, r = Array(n);
	for (let e = 0; e !== n; ++e) r[e] = e;
	return r.sort(t), r;
}
function Iu(e, t, n) {
	let r = e.length, i = new e.constructor(r);
	for (let a = 0, o = 0; o !== r; ++a) {
		let r = n[a] * t;
		for (let n = 0; n !== t; ++n) i[o++] = e[r + n];
	}
	return i;
}
function Lu(e, t, n, r) {
	let i = 1, a = e[0];
	for (; a !== void 0 && a[r] === void 0;) a = e[i++];
	if (a === void 0) return;
	let o = a[r];
	if (o !== void 0) if (Array.isArray(o)) do
		o = a[r], o !== void 0 && (t.push(a.time), n.push(...o)), a = e[i++];
	while (a !== void 0);
	else if (o.toArray !== void 0) do
		o = a[r], o !== void 0 && (t.push(a.time), o.toArray(n, n.length)), a = e[i++];
	while (a !== void 0);
	else do
		o = a[r], o !== void 0 && (t.push(a.time), n.push(o)), a = e[i++];
	while (a !== void 0);
}
function Ru(e, t, n, r, i = 30) {
	let a = e.clone();
	a.name = t;
	let o = [];
	for (let e = 0; e < a.tracks.length; ++e) {
		let t = a.tracks[e], s = t.getValueSize(), c = [], l = [];
		for (let e = 0; e < t.times.length; ++e) {
			let a = t.times[e] * i;
			if (!(a < n || a >= r)) {
				c.push(t.times[e]);
				for (let n = 0; n < s; ++n) l.push(t.values[e * s + n]);
			}
		}
		c.length !== 0 && (t.times = Pu(c, t.times.constructor), t.values = Pu(l, t.values.constructor), o.push(t));
	}
	a.tracks = o;
	let s = Infinity;
	for (let e = 0; e < a.tracks.length; ++e) s > a.tracks[e].times[0] && (s = a.tracks[e].times[0]);
	for (let e = 0; e < a.tracks.length; ++e) a.tracks[e].shift(-1 * s);
	return a.resetDuration(), a;
}
function zu(e, t = 0, n = e, r = 30) {
	r <= 0 && (r = 30);
	let i = n.tracks.length, a = t / r;
	for (let t = 0; t < i; ++t) {
		let r = n.tracks[t], i = r.ValueTypeName;
		if (i === "bool" || i === "string") continue;
		let o = e.tracks.find(function(e) {
			return e.name === r.name && e.ValueTypeName === i;
		});
		if (o === void 0) continue;
		let s = 0, c = r.getValueSize();
		r.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline && (s = c / 3);
		let l = 0, u = o.getValueSize();
		o.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline && (l = u / 3);
		let d = r.times.length - 1, f;
		if (a <= r.times[0]) {
			let e = s, t = c - s;
			f = r.values.slice(e, t);
		} else if (a >= r.times[d]) {
			let e = d * c + s, t = e + c - s;
			f = r.values.slice(e, t);
		} else {
			let e = r.createInterpolant(), t = s, n = c - s;
			e.evaluate(a), f = e.resultBuffer.slice(t, n);
		}
		i === "quaternion" && new Hr().fromArray(f).normalize().conjugate().toArray(f);
		let p = o.times.length;
		for (let e = 0; e < p; ++e) {
			let t = e * u + l;
			if (i === "quaternion") Hr.multiplyQuaternionsFlat(o.values, t, f, 0, o.values, t);
			else {
				let e = u - l * 2;
				for (let n = 0; n < e; ++n) o.values[t + n] -= f[n];
			}
		}
	}
	return e.blendMode = Cn, e;
}
var Bu = class {
	static convertArray(e, t) {
		return Pu(e, t);
	}
	static isTypedArray(e) {
		return ir(e);
	}
	static getKeyframeOrder(e) {
		return Fu(e);
	}
	static sortedArray(e, t, n) {
		return Iu(e, t, n);
	}
	static flattenJSON(e, t, n, r) {
		Lu(e, t, n, r);
	}
	static subclip(e, t, n, r, i = 30) {
		return Ru(e, t, n, r, i);
	}
	static makeClipAdditive(e, t = 0, n = e, r = 30) {
		return zu(e, t, n, r);
	}
}, Vu = class {
	constructor(e, t, n, r) {
		this.parameterPositions = e, this._cachedIndex = 0, this.resultBuffer = r === void 0 ? new t.constructor(n) : r, this.sampleValues = t, this.valueSize = n, this.settings = null, this.DefaultSettings_ = {};
	}
	evaluate(e) {
		let t = this.parameterPositions, n = this._cachedIndex, r = t[n], i = t[n - 1];
		validate_interval: {
			seek: {
				let a;
				linear_scan: {
					forward_scan: if (!(e < r)) {
						for (let a = n + 2;;) {
							if (r === void 0) {
								if (e < i) break forward_scan;
								return n = t.length, this._cachedIndex = n, this.copySampleValue_(n - 1);
							}
							if (n === a) break;
							if (i = r, r = t[++n], e < r) break seek;
						}
						a = t.length;
						break linear_scan;
					}
					if (!(e >= i)) {
						let o = t[1];
						e < o && (n = 2, i = o);
						for (let a = n - 2;;) {
							if (i === void 0) return this._cachedIndex = 0, this.copySampleValue_(0);
							if (n === a) break;
							if (r = i, i = t[--n - 1], e >= i) break seek;
						}
						a = n, n = 0;
						break linear_scan;
					}
					break validate_interval;
				}
				for (; n < a;) {
					let r = n + a >>> 1;
					e < t[r] ? a = r : n = r + 1;
				}
				if (r = t[n], i = t[n - 1], i === void 0) return this._cachedIndex = 0, this.copySampleValue_(0);
				if (r === void 0) return n = t.length, this._cachedIndex = n, this.copySampleValue_(n - 1);
			}
			this._cachedIndex = n, this.intervalChanged_(n, i, r);
		}
		return this.interpolate_(n, i, e, r);
	}
	getSettings_() {
		return this.settings || this.DefaultSettings_;
	}
	copySampleValue_(e) {
		let t = this.resultBuffer, n = this.sampleValues, r = this.valueSize, i = e * r;
		for (let e = 0; e !== r; ++e) t[e] = n[i + e];
		return t;
	}
	interpolate_() {
		throw Error("THREE.Interpolant: Call to abstract method.");
	}
	intervalChanged_() {}
}, Hu = class extends Vu {
	constructor(e, t, n, r) {
		super(e, t, n, r), this._weightPrev = -0, this._offsetPrev = -0, this._weightNext = -0, this._offsetNext = -0, this.DefaultSettings_ = {
			endingStart: yn,
			endingEnd: yn
		};
	}
	intervalChanged_(e, t, n) {
		let r = this.parameterPositions, i = e - 2, a = e + 1, o = r[i], s = r[a];
		if (o === void 0) switch (this.getSettings_().endingStart) {
			case bn:
				i = e, o = 2 * t - n;
				break;
			case xn:
				i = r.length - 2, o = t + r[i] - r[i + 1];
				break;
			default: i = e, o = n;
		}
		if (s === void 0) switch (this.getSettings_().endingEnd) {
			case bn:
				a = e, s = 2 * n - t;
				break;
			case xn:
				a = 1, s = n + r[1] - r[0];
				break;
			default: a = e - 1, s = t;
		}
		let c = (n - t) * .5, l = this.valueSize;
		this._weightPrev = c / (t - o), this._weightNext = c / (s - n), this._offsetPrev = i * l, this._offsetNext = a * l;
	}
	interpolate_(e, t, n, r) {
		let i = this.resultBuffer, a = this.sampleValues, o = this.valueSize, s = e * o, c = s - o, l = this._offsetPrev, u = this._offsetNext, d = this._weightPrev, f = this._weightNext, p = (n - t) / (r - t), m = p * p, h = m * p, g = -d * h + 2 * d * m - d * p, _ = (1 + d) * h + (-1.5 - 2 * d) * m + (-.5 + d) * p + 1, v = (-1 - f) * h + (1.5 + f) * m + .5 * p, y = f * h - f * m;
		for (let e = 0; e !== o; ++e) i[e] = g * a[l + e] + _ * a[c + e] + v * a[s + e] + y * a[u + e];
		return i;
	}
}, Uu = class extends Vu {
	constructor(e, t, n, r) {
		super(e, t, n, r);
	}
	interpolate_(e, t, n, r) {
		let i = this.resultBuffer, a = this.sampleValues, o = this.valueSize, s = e * o, c = s - o, l = (n - t) / (r - t), u = 1 - l;
		for (let e = 0; e !== o; ++e) i[e] = a[c + e] * u + a[s + e] * l;
		return i;
	}
}, Wu = class extends Vu {
	constructor(e, t, n, r) {
		super(e, t, n, r);
	}
	interpolate_(e) {
		return this.copySampleValue_(e - 1);
	}
}, Gu = class extends Vu {
	interpolate_(e, t, n, r) {
		let i = this.resultBuffer, a = this.sampleValues, o = this.valueSize, s = e * o, c = s - o, l = this.inTangents, u = this.outTangents;
		if (!l || !u) {
			let e = (n - t) / (r - t), l = 1 - e;
			for (let t = 0; t !== o; ++t) i[t] = a[c + t] * l + a[s + t] * e;
			return i;
		}
		let d = o * 2, f = e - 1;
		for (let p = 0; p !== o; ++p) {
			let o = a[c + p], m = a[s + p], h = f * d + p * 2, g = u[h], _ = u[h + 1], v = e * d + p * 2, y = l[v], b = l[v + 1], x = (n - t) / (r - t), S, C, w, T, E;
			for (let e = 0; e < 8; e++) {
				S = x * x, C = S * x, w = 1 - x, T = w * w, E = T * w;
				let e = E * t + 3 * T * x * g + 3 * w * S * y + C * r - n;
				if (Math.abs(e) < 1e-10) break;
				let i = 3 * T * (g - t) + 6 * w * x * (y - g) + 3 * S * (r - y);
				if (Math.abs(i) < 1e-10) break;
				x -= e / i, x = Math.max(0, Math.min(1, x));
			}
			i[p] = E * o + 3 * T * x * _ + 3 * w * S * b + C * m;
		}
		return i;
	}
}, Ku = class {
	constructor(e, t, n, r) {
		if (e === void 0) throw Error("THREE.KeyframeTrack: track name is undefined");
		if (t === void 0 || t.length === 0) throw Error("THREE.KeyframeTrack: no keyframes in track named " + e);
		this.name = e, this.times = Pu(t, this.TimeBufferType), this.values = Pu(n, this.ValueBufferType), this.setInterpolation(r || this.DefaultInterpolation);
	}
	static toJSON(e) {
		let t = e.constructor, n;
		if (t.toJSON !== this.toJSON) n = t.toJSON(e);
		else {
			n = {
				name: e.name,
				times: Pu(e.times, Array),
				values: Pu(e.values, Array)
			};
			let t = e.getInterpolation();
			t !== e.DefaultInterpolation && (n.interpolation = t);
		}
		return n.type = e.ValueTypeName, n;
	}
	InterpolantFactoryMethodDiscrete(e) {
		return new Wu(this.times, this.values, this.getValueSize(), e);
	}
	InterpolantFactoryMethodLinear(e) {
		return new Uu(this.times, this.values, this.getValueSize(), e);
	}
	InterpolantFactoryMethodSmooth(e) {
		return new Hu(this.times, this.values, this.getValueSize(), e);
	}
	InterpolantFactoryMethodBezier(e) {
		let t = new Gu(this.times, this.values, this.getValueSize(), e);
		return this.settings && (t.inTangents = this.settings.inTangents, t.outTangents = this.settings.outTangents), t;
	}
	setInterpolation(e) {
		let t;
		switch (e) {
			case hn:
				t = this.InterpolantFactoryMethodDiscrete;
				break;
			case gn:
				t = this.InterpolantFactoryMethodLinear;
				break;
			case _n:
				t = this.InterpolantFactoryMethodSmooth;
				break;
			case vn:
				t = this.InterpolantFactoryMethodBezier;
				break;
		}
		if (t === void 0) {
			let t = "unsupported interpolation for " + this.ValueTypeName + " keyframe track named " + this.name;
			if (this.createInterpolant === void 0) if (e !== this.DefaultInterpolation) this.setInterpolation(this.DefaultInterpolation);
			else throw Error(t);
			return R("KeyframeTrack:", t), this;
		}
		return this.createInterpolant = t, this;
	}
	getInterpolation() {
		switch (this.createInterpolant) {
			case this.InterpolantFactoryMethodDiscrete: return hn;
			case this.InterpolantFactoryMethodLinear: return gn;
			case this.InterpolantFactoryMethodSmooth: return _n;
			case this.InterpolantFactoryMethodBezier: return vn;
		}
	}
	getValueSize() {
		return this.values.length / this.times.length;
	}
	shift(e) {
		if (e !== 0) {
			let t = this.times;
			for (let n = 0, r = t.length; n !== r; ++n) t[n] += e;
		}
		return this;
	}
	scale(e) {
		if (e !== 1) {
			let t = this.times;
			for (let n = 0, r = t.length; n !== r; ++n) t[n] *= e;
		}
		return this;
	}
	trim(e, t) {
		let n = this.times, r = n.length, i = 0, a = r - 1;
		for (; i !== r && n[i] < e;) ++i;
		for (; a !== -1 && n[a] > t;) --a;
		if (++a, i !== 0 || a !== r) {
			i >= a && (a = Math.max(a, 1), i = a - 1);
			let e = this.getValueSize();
			this.times = n.slice(i, a), this.values = this.values.slice(i * e, a * e);
		}
		return this;
	}
	validate() {
		let e = !0, t = this.getValueSize();
		t - Math.floor(t) !== 0 && (z("KeyframeTrack: Invalid value size in track.", this), e = !1);
		let n = this.times, r = this.values, i = n.length;
		i === 0 && (z("KeyframeTrack: Track is empty.", this), e = !1);
		let a = null;
		for (let t = 0; t !== i; t++) {
			let r = n[t];
			if (typeof r == "number" && isNaN(r)) {
				z("KeyframeTrack: Time is not a valid number.", this, t, r), e = !1;
				break;
			}
			if (a !== null && a > r) {
				z("KeyframeTrack: Out of order keys.", this, t, r, a), e = !1;
				break;
			}
			a = r;
		}
		if (r !== void 0 && ir(r)) for (let t = 0, n = r.length; t !== n; ++t) {
			let n = r[t];
			if (isNaN(n)) {
				z("KeyframeTrack: Value is not a valid number.", this, t, n), e = !1;
				break;
			}
		}
		return e;
	}
	optimize() {
		let e = this.times.slice(), t = this.values.slice(), n = this.getValueSize(), r = this.getInterpolation() === _n, i = e.length - 1, a = 1;
		for (let o = 1; o < i; ++o) {
			let i = !1, s = e[o];
			if (s !== e[o + 1] && (o !== 1 || s !== e[0])) if (r) i = !0;
			else {
				let e = o * n, r = e - n, a = e + n;
				for (let o = 0; o !== n; ++o) {
					let n = t[e + o];
					if (n !== t[r + o] || n !== t[a + o]) {
						i = !0;
						break;
					}
				}
			}
			if (i) {
				if (o !== a) {
					e[a] = e[o];
					let r = o * n, i = a * n;
					for (let e = 0; e !== n; ++e) t[i + e] = t[r + e];
				}
				++a;
			}
		}
		if (i > 0) {
			e[a] = e[i];
			for (let e = i * n, r = a * n, o = 0; o !== n; ++o) t[r + o] = t[e + o];
			++a;
		}
		return a === e.length ? (this.times = e, this.values = t) : (this.times = e.slice(0, a), this.values = t.slice(0, a * n)), this;
	}
	clone() {
		let e = this.times.slice(), t = this.values.slice(), n = this.constructor, r = new n(this.name, e, t);
		return r.createInterpolant = this.createInterpolant, r;
	}
};
Ku.prototype.ValueTypeName = "", Ku.prototype.TimeBufferType = Float32Array, Ku.prototype.ValueBufferType = Float32Array, Ku.prototype.DefaultInterpolation = gn;
var qu = class extends Ku {
	constructor(e, t, n) {
		super(e, t, n);
	}
};
qu.prototype.ValueTypeName = "bool", qu.prototype.ValueBufferType = Array, qu.prototype.DefaultInterpolation = hn, qu.prototype.InterpolantFactoryMethodLinear = void 0, qu.prototype.InterpolantFactoryMethodSmooth = void 0;
var Ju = class extends Ku {
	constructor(e, t, n, r) {
		super(e, t, n, r);
	}
};
Ju.prototype.ValueTypeName = "color";
var Yu = class extends Ku {
	constructor(e, t, n, r) {
		super(e, t, n, r);
	}
};
Yu.prototype.ValueTypeName = "number";
var Xu = class extends Vu {
	constructor(e, t, n, r) {
		super(e, t, n, r);
	}
	interpolate_(e, t, n, r) {
		let i = this.resultBuffer, a = this.sampleValues, o = this.valueSize, s = (n - t) / (r - t), c = e * o;
		for (let e = c + o; c !== e; c += 4) Hr.slerpFlat(i, 0, a, c - o, a, c, s);
		return i;
	}
}, Zu = class extends Ku {
	constructor(e, t, n, r) {
		super(e, t, n, r);
	}
	InterpolantFactoryMethodLinear(e) {
		return new Xu(this.times, this.values, this.getValueSize(), e);
	}
};
Zu.prototype.ValueTypeName = "quaternion", Zu.prototype.InterpolantFactoryMethodSmooth = void 0;
var Qu = class extends Ku {
	constructor(e, t, n) {
		super(e, t, n);
	}
};
Qu.prototype.ValueTypeName = "string", Qu.prototype.ValueBufferType = Array, Qu.prototype.DefaultInterpolation = hn, Qu.prototype.InterpolantFactoryMethodLinear = void 0, Qu.prototype.InterpolantFactoryMethodSmooth = void 0;
var $u = class extends Ku {
	constructor(e, t, n, r) {
		super(e, t, n, r);
	}
};
$u.prototype.ValueTypeName = "vector";
var ed = class {
	constructor(e = "", t = -1, n = [], r = Sn) {
		this.name = e, this.tracks = n, this.duration = t, this.blendMode = r, this.uuid = xr(), this.userData = {}, this.duration < 0 && this.resetDuration();
	}
	static parse(e) {
		let t = [], n = e.tracks, r = 1 / (e.fps || 1);
		for (let e = 0, i = n.length; e !== i; ++e) t.push(nd(n[e]).scale(r));
		let i = new this(e.name, e.duration, t, e.blendMode);
		return i.uuid = e.uuid, i.userData = JSON.parse(e.userData || "{}"), i;
	}
	static toJSON(e) {
		let t = [], n = e.tracks, r = {
			name: e.name,
			duration: e.duration,
			tracks: t,
			uuid: e.uuid,
			blendMode: e.blendMode,
			userData: JSON.stringify(e.userData)
		};
		for (let e = 0, r = n.length; e !== r; ++e) t.push(Ku.toJSON(n[e]));
		return r;
	}
	static CreateFromMorphTargetSequence(e, t, n, r) {
		let i = t.length, a = [];
		for (let e = 0; e < i; e++) {
			let o = [], s = [];
			o.push((e + i - 1) % i, e, (e + 1) % i), s.push(0, 1, 0);
			let c = Fu(o);
			o = Iu(o, 1, c), s = Iu(s, 1, c), !r && o[0] === 0 && (o.push(i), s.push(s[0])), a.push(new Yu(".morphTargetInfluences[" + t[e].name + "]", o, s).scale(1 / n));
		}
		return new this(e, -1, a);
	}
	static findByName(e, t) {
		let n = e;
		if (!Array.isArray(e)) {
			let t = e;
			n = t.geometry && t.geometry.animations || t.animations;
		}
		for (let e = 0; e < n.length; e++) if (n[e].name === t) return n[e];
		return null;
	}
	static CreateClipsFromMorphTargetSequences(e, t, n) {
		let r = {}, i = /^([\w-]*?)([\d]+)$/;
		for (let t = 0, n = e.length; t < n; t++) {
			let n = e[t], a = n.name.match(i);
			if (a && a.length > 1) {
				let e = a[1], t = r[e];
				t || (r[e] = t = []), t.push(n);
			}
		}
		let a = [];
		for (let e in r) a.push(this.CreateFromMorphTargetSequence(e, r[e], t, n));
		return a;
	}
	resetDuration() {
		let e = this.tracks, t = 0;
		for (let n = 0, r = e.length; n !== r; ++n) {
			let e = this.tracks[n];
			t = Math.max(t, e.times[e.times.length - 1]);
		}
		return this.duration = t, this;
	}
	trim() {
		for (let e = 0; e < this.tracks.length; e++) this.tracks[e].trim(0, this.duration);
		return this;
	}
	validate() {
		let e = !0;
		for (let t = 0; t < this.tracks.length; t++) e &&= this.tracks[t].validate();
		return e;
	}
	optimize() {
		for (let e = 0; e < this.tracks.length; e++) this.tracks[e].optimize();
		return this;
	}
	clone() {
		let e = [];
		for (let t = 0; t < this.tracks.length; t++) e.push(this.tracks[t].clone());
		let t = new this.constructor(this.name, this.duration, e, this.blendMode);
		return t.userData = JSON.parse(JSON.stringify(this.userData)), t;
	}
	toJSON() {
		return this.constructor.toJSON(this);
	}
};
function td(e) {
	switch (e.toLowerCase()) {
		case "scalar":
		case "double":
		case "float":
		case "number":
		case "integer": return Yu;
		case "vector":
		case "vector2":
		case "vector3":
		case "vector4": return $u;
		case "color": return Ju;
		case "quaternion": return Zu;
		case "bool":
		case "boolean": return qu;
		case "string": return Qu;
	}
	throw Error("THREE.KeyframeTrack: Unsupported typeName: " + e);
}
function nd(e) {
	if (e.type === void 0) throw Error("THREE.KeyframeTrack: track type undefined, can not parse");
	let t = td(e.type);
	if (e.times === void 0) {
		let t = [], n = [];
		Lu(e.keys, t, n, "value"), e.times = t, e.values = n;
	}
	return t.parse === void 0 ? new t(e.name, e.times, e.values, e.interpolation) : t.parse(e);
}
var rd = {
	enabled: !1,
	files: {},
	add: function(e, t) {
		this.enabled !== !1 && (id(e) || (this.files[e] = t));
	},
	get: function(e) {
		if (this.enabled !== !1 && !id(e)) return this.files[e];
	},
	remove: function(e) {
		delete this.files[e];
	},
	clear: function() {
		this.files = {};
	}
};
function id(e) {
	try {
		let t = e.slice(e.indexOf(":") + 1);
		return new URL(t).protocol === "blob:";
	} catch {
		return !1;
	}
}
var ad = class {
	constructor(e, t, n) {
		let r = this, i = !1, a = 0, o = 0, s, c = [];
		this.onStart = void 0, this.onLoad = e, this.onProgress = t, this.onError = n, this._abortController = null, this.itemStart = function(e) {
			o++, i === !1 && r.onStart !== void 0 && r.onStart(e, a, o), i = !0;
		}, this.itemEnd = function(e) {
			a++, r.onProgress !== void 0 && r.onProgress(e, a, o), a === o && (i = !1, r.onLoad !== void 0 && r.onLoad());
		}, this.itemError = function(e) {
			r.onError !== void 0 && r.onError(e);
		}, this.resolveURL = function(e) {
			return e = e.normalize("NFC"), s ? s(e) : e;
		}, this.setURLModifier = function(e) {
			return s = e, this;
		}, this.addHandler = function(e, t) {
			return c.push(e, t), this;
		}, this.removeHandler = function(e) {
			let t = c.indexOf(e);
			return t !== -1 && c.splice(t, 2), this;
		}, this.getHandler = function(e) {
			for (let t = 0, n = c.length; t < n; t += 2) {
				let n = c[t], r = c[t + 1];
				if (n.global && (n.lastIndex = 0), n.test(e)) return r;
			}
			return null;
		}, this.abort = function() {
			return this.abortController.abort(), this._abortController = null, this;
		};
	}
	get abortController() {
		return this._abortController ||= new AbortController(), this._abortController;
	}
}, od = /*@__PURE__*/ new ad(), sd = class {
	constructor(e) {
		this.manager = e === void 0 ? od : e, this.crossOrigin = "anonymous", this.withCredentials = !1, this.path = "", this.resourcePath = "", this.requestHeader = {}, typeof __THREE_DEVTOOLS__ < "u" && __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", { detail: this }));
	}
	load() {}
	loadAsync(e, t) {
		let n = this;
		return new Promise(function(r, i) {
			n.load(e, r, t, i);
		});
	}
	parse() {}
	setCrossOrigin(e) {
		return this.crossOrigin = e, this;
	}
	setWithCredentials(e) {
		return this.withCredentials = e, this;
	}
	setPath(e) {
		return this.path = e, this;
	}
	setResourcePath(e) {
		return this.resourcePath = e, this;
	}
	setRequestHeader(e) {
		return this.requestHeader = e, this;
	}
	abort() {
		return this;
	}
};
sd.DEFAULT_MATERIAL_NAME = "__DEFAULT";
var cd = {}, ld = class extends Error {
	constructor(e, t) {
		super(e), this.response = t;
	}
}, ud = class extends sd {
	constructor(e) {
		super(e), this.mimeType = "", this.responseType = "", this._abortController = new AbortController();
	}
	load(e, t, n, r) {
		e === void 0 && (e = ""), this.path !== void 0 && (e = this.path + e), e = this.manager.resolveURL(e);
		let i = rd.get(`file:${e}`);
		if (i !== void 0) {
			this.manager.itemStart(e), setTimeout(() => {
				t && t(i), this.manager.itemEnd(e);
			}, 0);
			return;
		}
		if (cd[e] !== void 0) {
			cd[e].push({
				onLoad: t,
				onProgress: n,
				onError: r
			});
			return;
		}
		cd[e] = [], cd[e].push({
			onLoad: t,
			onProgress: n,
			onError: r
		});
		let a = new Request(e, {
			headers: new Headers(this.requestHeader),
			credentials: this.withCredentials ? "include" : "same-origin",
			signal: typeof AbortSignal.any == "function" ? AbortSignal.any([this._abortController.signal, this.manager.abortController.signal]) : this._abortController.signal
		}), o = this.mimeType, s = this.responseType;
		fetch(a).then((t) => {
			if (t.status === 200 || t.status === 0) {
				if (t.status === 0 && R("FileLoader: HTTP Status 0 received."), typeof ReadableStream > "u" || t.body === void 0 || t.body.getReader === void 0) return t;
				let n = cd[e], r = t.body.getReader(), i = t.headers.get("X-File-Size") || t.headers.get("Content-Length"), a = i ? parseInt(i) : 0, o = a !== 0, s = 0, c = new ReadableStream({ start(e) {
					t();
					function t() {
						r.read().then(({ done: r, value: i }) => {
							if (r) e.close();
							else {
								s += i.byteLength;
								let r = new ProgressEvent("progress", {
									lengthComputable: o,
									loaded: s,
									total: a
								});
								for (let e = 0, t = n.length; e < t; e++) {
									let t = n[e];
									t.onProgress && t.onProgress(r);
								}
								e.enqueue(i), t();
							}
						}, (t) => {
							e.error(t);
						});
					}
				} });
				return new Response(c);
			} else throw new ld(`fetch for "${t.url}" responded with ${t.status}: ${t.statusText}`, t);
		}).then((e) => {
			switch (s) {
				case "arraybuffer": return e.arrayBuffer();
				case "blob": return e.blob();
				case "document": return e.text().then((e) => new DOMParser().parseFromString(e, o));
				case "json": return e.json();
				default:
					if (o === "") return e.text();
					{
						let t = /charset="?([^;"\s]*)"?/i.exec(o), n = t && t[1] ? t[1].toLowerCase() : void 0, r = new TextDecoder(n);
						return e.arrayBuffer().then((e) => r.decode(e));
					}
			}
		}).then((t) => {
			rd.add(`file:${e}`, t);
			let n = cd[e];
			delete cd[e];
			for (let e = 0, r = n.length; e < r; e++) {
				let r = n[e];
				r.onLoad && r.onLoad(t);
			}
		}).catch((t) => {
			let n = cd[e];
			if (n === void 0) throw this.manager.itemError(e), t;
			delete cd[e];
			for (let e = 0, r = n.length; e < r; e++) {
				let r = n[e];
				r.onError && r.onError(t);
			}
			this.manager.itemError(e);
		}).finally(() => {
			this.manager.itemEnd(e);
		}), this.manager.itemStart(e);
	}
	setResponseType(e) {
		return this.responseType = e, this;
	}
	setMimeType(e) {
		return this.mimeType = e, this;
	}
	abort() {
		return this._abortController.abort(), this._abortController = new AbortController(), this;
	}
}, dd = class extends sd {
	constructor(e) {
		super(e);
	}
	load(e, t, n, r) {
		let i = this, a = new ud(this.manager);
		a.setPath(this.path), a.setRequestHeader(this.requestHeader), a.setWithCredentials(this.withCredentials), a.load(e, function(n) {
			try {
				t(i.parse(JSON.parse(n)));
			} catch (t) {
				r ? r(t) : z(t), i.manager.itemError(e);
			}
		}, n, r);
	}
	parse(e) {
		let t = [];
		for (let n = 0; n < e.length; n++) {
			let r = ed.parse(e[n]);
			t.push(r);
		}
		return t;
	}
}, fd = class extends sd {
	constructor(e) {
		super(e);
	}
	load(e, t, n, r) {
		let i = this, a = [], o = new mc(), s = new ud(this.manager);
		s.setPath(this.path), s.setResponseType("arraybuffer"), s.setRequestHeader(this.requestHeader), s.setWithCredentials(i.withCredentials);
		let c = 0;
		function l(l) {
			s.load(e[l], function(e) {
				let n = i.parse(e, !0);
				a[l] = {
					width: n.width,
					height: n.height,
					format: n.format,
					mipmaps: n.mipmaps
				}, c += 1, c === 6 && (n.mipmapCount === 1 && (o.minFilter = et), o.image = a, o.format = n.format, o.needsUpdate = !0, t && t(o));
			}, n, r);
		}
		if (Array.isArray(e)) for (let t = 0, n = e.length; t < n; ++t) l(t);
		else s.load(e, function(e) {
			let n = i.parse(e, !0);
			if (n.isCubemap) {
				let e = n.mipmaps.length / n.mipmapCount;
				for (let t = 0; t < e; t++) {
					a[t] = { mipmaps: [] };
					for (let e = 0; e < n.mipmapCount; e++) a[t].mipmaps.push(n.mipmaps[t * n.mipmapCount + e]), a[t].format = n.format, a[t].width = n.width, a[t].height = n.height;
				}
				o.image = a;
			} else o.image.width = n.width, o.image.height = n.height, o.mipmaps = n.mipmaps;
			n.mipmapCount === 1 && (o.minFilter = et), o.format = n.format, o.needsUpdate = !0, t && t(o);
		}, n, r);
		return o;
	}
}, pd = /* @__PURE__ */ new WeakMap(), md = class extends sd {
	constructor(e) {
		super(e);
	}
	load(e, t, n, r) {
		this.path !== void 0 && (e = this.path + e), e = this.manager.resolveURL(e);
		let i = this, a = rd.get(`image:${e}`);
		if (a !== void 0) {
			if (a.complete === !0) i.manager.itemStart(e), setTimeout(function() {
				t && t(a), i.manager.itemEnd(e);
			}, 0);
			else {
				let e = pd.get(a);
				e === void 0 && (e = [], pd.set(a, e)), e.push({
					onLoad: t,
					onError: r
				});
			}
			return a;
		}
		let o = ar("img");
		function s() {
			l(), t && t(this);
			let n = pd.get(this) || [];
			for (let e = 0; e < n.length; e++) {
				let t = n[e];
				t.onLoad && t.onLoad(this);
			}
			pd.delete(this), i.manager.itemEnd(e);
		}
		function c(t) {
			l(), r && r(t), rd.remove(`image:${e}`);
			let n = pd.get(this) || [];
			for (let e = 0; e < n.length; e++) {
				let r = n[e];
				r.onError && r.onError(t);
			}
			pd.delete(this), i.manager.itemError(e), i.manager.itemEnd(e);
		}
		function l() {
			o.removeEventListener("load", s, !1), o.removeEventListener("error", c, !1);
		}
		return o.addEventListener("load", s, !1), o.addEventListener("error", c, !1), e.slice(0, 5) !== "data:" && this.crossOrigin !== void 0 && (o.crossOrigin = this.crossOrigin), rd.add(`image:${e}`, o), i.manager.itemStart(e), o.src = e, o;
	}
}, hd = class extends sd {
	constructor(e) {
		super(e);
	}
	load(e, t, n, r) {
		let i = new _c();
		i.colorSpace = On;
		let a = new md(this.manager);
		a.setCrossOrigin(this.crossOrigin), a.setPath(this.path);
		let o = 0;
		function s(n) {
			a.load(e[n], function(e) {
				i.images[n] = e, o++, o === 6 && (i.needsUpdate = !0, t && t(i));
			}, void 0, r);
		}
		for (let t = 0; t < e.length; ++t) s(t);
		return i;
	}
}, gd = class extends sd {
	constructor(e) {
		super(e);
	}
	load(e, t, n, r) {
		let i = this, a = new ns(), o = new ud(this.manager);
		return o.setResponseType("arraybuffer"), o.setRequestHeader(this.requestHeader), o.setPath(this.path), o.setWithCredentials(i.withCredentials), o.load(e, function(e) {
			let n;
			try {
				n = i.parse(e);
			} catch (e) {
				r === void 0 ? z(e) : r(e);
				return;
			}
			i._applyTexData(a, n), t && t(a, n);
		}, n, r), a;
	}
	createDataTexture(e) {
		let t = new ns();
		return this._applyTexData(t, this.parse(e)), t;
	}
	_applyTexData(e, t) {
		t.image === void 0 ? t.data !== void 0 && (e.image.width = t.width, e.image.height = t.height, e.image.data = t.data) : e.image = t.image, e.wrapS = t.wrapS === void 0 ? qe : t.wrapS, e.wrapT = t.wrapT === void 0 ? qe : t.wrapT, e.magFilter = t.magFilter === void 0 ? et : t.magFilter, e.minFilter = t.minFilter === void 0 ? et : t.minFilter, e.anisotropy = t.anisotropy === void 0 ? 1 : t.anisotropy, t.colorSpace !== void 0 && (e.colorSpace = t.colorSpace), t.flipY !== void 0 && (e.flipY = t.flipY), t.format !== void 0 && (e.format = t.format), t.type !== void 0 && (e.type = t.type), t.mipmaps !== void 0 && (e.mipmaps = t.mipmaps, e.minFilter = rt), t.mipmapCount === 1 && (e.minFilter = et), t.generateMipmaps !== void 0 && (e.generateMipmaps = t.generateMipmaps), e.needsUpdate = !0;
	}
}, _d = class extends sd {
	constructor(e) {
		super(e);
	}
	load(e, t, n, r) {
		let i = new ii(), a = new md(this.manager);
		return a.setCrossOrigin(this.crossOrigin), a.setPath(this.path), a.load(e, function(e) {
			i.image = e, i.needsUpdate = !0, t !== void 0 && t(i);
		}, n, r), i;
	}
}, vd = class extends q {
	constructor(e, t = 1) {
		super(), this.isLight = !0, this.type = "Light", this.color = new J(e), this.intensity = t;
	}
	dispose() {
		this.dispatchEvent({ type: "dispose" });
	}
	copy(e, t) {
		return super.copy(e, t), this.color.copy(e.color), this.intensity = e.intensity, this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return t.object.color = this.color.getHex(), t.object.intensity = this.intensity, t;
	}
}, yd = class extends vd {
	constructor(e, t, n) {
		super(e, n), this.isHemisphereLight = !0, this.type = "HemisphereLight", this.position.copy(q.DEFAULT_UP), this.updateMatrix(), this.groundColor = new J(t);
	}
	copy(e, t) {
		return super.copy(e, t), this.groundColor.copy(e.groundColor), this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return t.object.groundColor = this.groundColor.getHex(), t;
	}
}, bd = /*@__PURE__*/ new K(), xd = /*@__PURE__*/ new U(), Sd = /*@__PURE__*/ new U(), Cd = class {
	constructor(e) {
		this.camera = e, this.intensity = 1, this.bias = 0, this.biasNode = null, this.normalBias = 0, this.radius = 1, this.blurSamples = 8, this.mapSize = new H(512, 512), this.mapType = at, this.map = null, this.mapPass = null, this.matrix = new K(), this.autoUpdate = !0, this.needsUpdate = !1, this._frustum = new Ss(), this._frameExtents = new H(1, 1), this._viewportCount = 1, this._viewports = [new ai(0, 0, 1, 1)];
	}
	getViewportCount() {
		return this._viewportCount;
	}
	getFrustum() {
		return this._frustum;
	}
	updateMatrices(e) {
		let t = this.camera, n = this.matrix;
		xd.setFromMatrixPosition(e.matrixWorld), t.position.copy(xd), Sd.setFromMatrixPosition(e.target.matrixWorld), t.lookAt(Sd), t.updateMatrixWorld(), bd.multiplyMatrices(t.projectionMatrix, t.matrixWorldInverse), this._frustum.setFromProjectionMatrix(bd, t.coordinateSystem, t.reversedDepth), t.coordinateSystem === 2001 || t.reversedDepth ? n.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, 1, 0, 0, 0, 0, 1) : n.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1), n.multiply(bd);
	}
	getViewport(e) {
		return this._viewports[e];
	}
	getFrameExtents() {
		return this._frameExtents;
	}
	dispose() {
		this.map && this.map.dispose(), this.mapPass && this.mapPass.dispose();
	}
	copy(e) {
		return this.camera = e.camera.clone(), this.intensity = e.intensity, this.bias = e.bias, this.radius = e.radius, this.autoUpdate = e.autoUpdate, this.needsUpdate = e.needsUpdate, this.normalBias = e.normalBias, this.blurSamples = e.blurSamples, this.mapSize.copy(e.mapSize), this.biasNode = e.biasNode, this;
	}
	clone() {
		return new this.constructor().copy(this);
	}
	toJSON() {
		let e = {};
		return this.intensity !== 1 && (e.intensity = this.intensity), this.bias !== 0 && (e.bias = this.bias), this.normalBias !== 0 && (e.normalBias = this.normalBias), this.radius !== 1 && (e.radius = this.radius), (this.mapSize.x !== 512 || this.mapSize.y !== 512) && (e.mapSize = this.mapSize.toArray()), e.camera = this.camera.toJSON(!1).object, delete e.camera.matrix, e;
	}
}, wd = /*@__PURE__*/ new U(), Td = /*@__PURE__*/ new Hr(), Ed = /*@__PURE__*/ new U(), Dd = class extends q {
	constructor() {
		super(), this.isCamera = !0, this.type = "Camera", this.matrixWorldInverse = new K(), this.projectionMatrix = new K(), this.projectionMatrixInverse = new K(), this.coordinateSystem = Yn, this._reversedDepth = !1;
	}
	get reversedDepth() {
		return this._reversedDepth;
	}
	copy(e, t) {
		return super.copy(e, t), this.matrixWorldInverse.copy(e.matrixWorldInverse), this.projectionMatrix.copy(e.projectionMatrix), this.projectionMatrixInverse.copy(e.projectionMatrixInverse), this.coordinateSystem = e.coordinateSystem, this;
	}
	getWorldDirection(e) {
		return super.getWorldDirection(e).negate();
	}
	updateMatrixWorld(e) {
		super.updateMatrixWorld(e), this.matrixWorld.decompose(wd, Td, Ed), Ed.x === 1 && Ed.y === 1 && Ed.z === 1 ? this.matrixWorldInverse.copy(this.matrixWorld).invert() : this.matrixWorldInverse.compose(wd, Td, Ed.set(1, 1, 1)).invert();
	}
	updateWorldMatrix(e, t, n = !1) {
		super.updateWorldMatrix(e, t, n), this.matrixWorld.decompose(wd, Td, Ed), Ed.x === 1 && Ed.y === 1 && Ed.z === 1 ? this.matrixWorldInverse.copy(this.matrixWorld).invert() : this.matrixWorldInverse.compose(wd, Td, Ed.set(1, 1, 1)).invert();
	}
	clone() {
		return new this.constructor().copy(this);
	}
}, Od = /*@__PURE__*/ new U(), kd = /*@__PURE__*/ new H(), Ad = /*@__PURE__*/ new H(), jd = class extends Dd {
	constructor(e = 50, t = 1, n = .1, r = 2e3) {
		super(), this.isPerspectiveCamera = !0, this.type = "PerspectiveCamera", this.fov = e, this.zoom = 1, this.near = n, this.far = r, this.focus = 10, this.aspect = t, this.view = null, this.filmGauge = 35, this.filmOffset = 0, this.updateProjectionMatrix();
	}
	copy(e, t) {
		return super.copy(e, t), this.fov = e.fov, this.zoom = e.zoom, this.near = e.near, this.far = e.far, this.focus = e.focus, this.aspect = e.aspect, this.view = e.view === null ? null : Object.assign({}, e.view), this.filmGauge = e.filmGauge, this.filmOffset = e.filmOffset, this;
	}
	setFocalLength(e) {
		let t = .5 * this.getFilmHeight() / e;
		this.fov = br * 2 * Math.atan(t), this.updateProjectionMatrix();
	}
	getFocalLength() {
		let e = Math.tan(yr * .5 * this.fov);
		return .5 * this.getFilmHeight() / e;
	}
	getEffectiveFOV() {
		return br * 2 * Math.atan(Math.tan(yr * .5 * this.fov) / this.zoom);
	}
	getFilmWidth() {
		return this.filmGauge * Math.min(this.aspect, 1);
	}
	getFilmHeight() {
		return this.filmGauge / Math.max(this.aspect, 1);
	}
	getViewBounds(e, t, n) {
		Od.set(-1, -1, .5).applyMatrix4(this.projectionMatrixInverse), t.set(Od.x, Od.y).multiplyScalar(-e / Od.z), Od.set(1, 1, .5).applyMatrix4(this.projectionMatrixInverse), n.set(Od.x, Od.y).multiplyScalar(-e / Od.z);
	}
	getViewSize(e, t) {
		return this.getViewBounds(e, kd, Ad), t.subVectors(Ad, kd);
	}
	setViewOffset(e, t, n, r, i, a) {
		this.aspect = e / t, this.view === null && (this.view = {
			enabled: !0,
			fullWidth: 1,
			fullHeight: 1,
			offsetX: 0,
			offsetY: 0,
			width: 1,
			height: 1
		}), this.view.enabled = !0, this.view.fullWidth = e, this.view.fullHeight = t, this.view.offsetX = n, this.view.offsetY = r, this.view.width = i, this.view.height = a, this.updateProjectionMatrix();
	}
	clearViewOffset() {
		this.view !== null && (this.view.enabled = !1), this.updateProjectionMatrix();
	}
	updateProjectionMatrix() {
		let e = this.near, t = e * Math.tan(yr * .5 * this.fov) / this.zoom, n = 2 * t, r = this.aspect * n, i = -.5 * r, a = this.view;
		if (this.view !== null && this.view.enabled) {
			let e = a.fullWidth, o = a.fullHeight;
			i += a.offsetX * r / e, t -= a.offsetY * n / o, r *= a.width / e, n *= a.height / o;
		}
		let o = this.filmOffset;
		o !== 0 && (i += e * o / this.getFilmWidth()), this.projectionMatrix.makePerspective(i, i + r, t, t - n, e, this.far, this.coordinateSystem, this.reversedDepth), this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return t.object.fov = this.fov, t.object.zoom = this.zoom, t.object.near = this.near, t.object.far = this.far, t.object.focus = this.focus, t.object.aspect = this.aspect, this.view !== null && (t.object.view = Object.assign({}, this.view)), t.object.filmGauge = this.filmGauge, t.object.filmOffset = this.filmOffset, t;
	}
}, Md = class extends Cd {
	constructor() {
		super(new jd(50, 1, .5, 500)), this.isSpotLightShadow = !0, this.focus = 1, this.aspect = 1;
	}
	updateMatrices(e) {
		let t = this.camera, n = br * 2 * e.angle * this.focus, r = this.mapSize.width / this.mapSize.height * this.aspect, i = e.distance || t.far;
		(n !== t.fov || r !== t.aspect || i !== t.far) && (t.fov = n, t.aspect = r, t.far = i, t.updateProjectionMatrix()), super.updateMatrices(e);
	}
	copy(e) {
		return super.copy(e), this.focus = e.focus, this;
	}
}, Nd = class extends vd {
	constructor(e, t, n = 0, r = Math.PI / 3, i = 0, a = 2) {
		super(e, t), this.isSpotLight = !0, this.type = "SpotLight", this.position.copy(q.DEFAULT_UP), this.updateMatrix(), this.target = new q(), this.distance = n, this.angle = r, this.penumbra = i, this.decay = a, this.map = null, this.shadow = new Md();
	}
	get power() {
		return this.intensity * Math.PI;
	}
	set power(e) {
		this.intensity = e / Math.PI;
	}
	dispose() {
		super.dispose(), this.shadow.dispose();
	}
	copy(e, t) {
		return super.copy(e, t), this.distance = e.distance, this.angle = e.angle, this.penumbra = e.penumbra, this.decay = e.decay, this.target = e.target.clone(), this.map = e.map, this.shadow = e.shadow.clone(), this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return t.object.distance = this.distance, t.object.angle = this.angle, t.object.decay = this.decay, t.object.penumbra = this.penumbra, t.object.target = this.target.uuid, this.map && this.map.isTexture && (t.object.map = this.map.toJSON(e).uuid), t.object.shadow = this.shadow.toJSON(), t;
	}
}, Pd = class extends Cd {
	constructor() {
		super(new jd(90, 1, .5, 500)), this.isPointLightShadow = !0;
	}
}, Fd = class extends vd {
	constructor(e, t, n = 0, r = 2) {
		super(e, t), this.isPointLight = !0, this.type = "PointLight", this.distance = n, this.decay = r, this.shadow = new Pd();
	}
	get power() {
		return this.intensity * 4 * Math.PI;
	}
	set power(e) {
		this.intensity = e / (4 * Math.PI);
	}
	dispose() {
		super.dispose(), this.shadow.dispose();
	}
	copy(e, t) {
		return super.copy(e, t), this.distance = e.distance, this.decay = e.decay, this.shadow = e.shadow.clone(), this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return t.object.distance = this.distance, t.object.decay = this.decay, t.object.shadow = this.shadow.toJSON(), t;
	}
}, Id = class extends Dd {
	constructor(e = -1, t = 1, n = 1, r = -1, i = .1, a = 2e3) {
		super(), this.isOrthographicCamera = !0, this.type = "OrthographicCamera", this.zoom = 1, this.view = null, this.left = e, this.right = t, this.top = n, this.bottom = r, this.near = i, this.far = a, this.updateProjectionMatrix();
	}
	copy(e, t) {
		return super.copy(e, t), this.left = e.left, this.right = e.right, this.top = e.top, this.bottom = e.bottom, this.near = e.near, this.far = e.far, this.zoom = e.zoom, this.view = e.view === null ? null : Object.assign({}, e.view), this;
	}
	setViewOffset(e, t, n, r, i, a) {
		this.view === null && (this.view = {
			enabled: !0,
			fullWidth: 1,
			fullHeight: 1,
			offsetX: 0,
			offsetY: 0,
			width: 1,
			height: 1
		}), this.view.enabled = !0, this.view.fullWidth = e, this.view.fullHeight = t, this.view.offsetX = n, this.view.offsetY = r, this.view.width = i, this.view.height = a, this.updateProjectionMatrix();
	}
	clearViewOffset() {
		this.view !== null && (this.view.enabled = !1), this.updateProjectionMatrix();
	}
	updateProjectionMatrix() {
		let e = (this.right - this.left) / (2 * this.zoom), t = (this.top - this.bottom) / (2 * this.zoom), n = (this.right + this.left) / 2, r = (this.top + this.bottom) / 2, i = n - e, a = n + e, o = r + t, s = r - t;
		if (this.view !== null && this.view.enabled) {
			let e = (this.right - this.left) / this.view.fullWidth / this.zoom, t = (this.top - this.bottom) / this.view.fullHeight / this.zoom;
			i += e * this.view.offsetX, a = i + e * this.view.width, o -= t * this.view.offsetY, s = o - t * this.view.height;
		}
		this.projectionMatrix.makeOrthographic(i, a, o, s, this.near, this.far, this.coordinateSystem, this.reversedDepth), this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return t.object.zoom = this.zoom, t.object.left = this.left, t.object.right = this.right, t.object.top = this.top, t.object.bottom = this.bottom, t.object.near = this.near, t.object.far = this.far, this.view !== null && (t.object.view = Object.assign({}, this.view)), t;
	}
}, Ld = class extends Cd {
	constructor() {
		super(new Id(-5, 5, 5, -5, .5, 500)), this.isDirectionalLightShadow = !0;
	}
}, Rd = class extends vd {
	constructor(e, t) {
		super(e, t), this.isDirectionalLight = !0, this.type = "DirectionalLight", this.position.copy(q.DEFAULT_UP), this.updateMatrix(), this.target = new q(), this.shadow = new Ld();
	}
	dispose() {
		super.dispose(), this.shadow.dispose();
	}
	copy(e) {
		return super.copy(e), this.target = e.target.clone(), this.shadow = e.shadow.clone(), this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return t.object.shadow = this.shadow.toJSON(), t.object.target = this.target.uuid, t;
	}
}, zd = class extends vd {
	constructor(e, t) {
		super(e, t), this.isAmbientLight = !0, this.type = "AmbientLight";
	}
}, Bd = class extends vd {
	constructor(e, t, n = 10, r = 10) {
		super(e, t), this.isRectAreaLight = !0, this.type = "RectAreaLight", this.width = n, this.height = r;
	}
	get power() {
		return this.intensity * this.width * this.height * Math.PI;
	}
	set power(e) {
		this.intensity = e / (this.width * this.height * Math.PI);
	}
	copy(e) {
		return super.copy(e), this.width = e.width, this.height = e.height, this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return t.object.width = this.width, t.object.height = this.height, t;
	}
}, Vd = class {
	constructor() {
		this.isSphericalHarmonics3 = !0, this.coefficients = [];
		for (let e = 0; e < 9; e++) this.coefficients.push(new U());
	}
	set(e) {
		for (let t = 0; t < 9; t++) this.coefficients[t].copy(e[t]);
		return this;
	}
	zero() {
		for (let e = 0; e < 9; e++) this.coefficients[e].set(0, 0, 0);
		return this;
	}
	getAt(e, t) {
		let n = e.x, r = e.y, i = e.z, a = this.coefficients;
		return t.copy(a[0]).multiplyScalar(.282095), t.addScaledVector(a[1], .488603 * r), t.addScaledVector(a[2], .488603 * i), t.addScaledVector(a[3], .488603 * n), t.addScaledVector(a[4], n * r * 1.092548), t.addScaledVector(a[5], r * i * 1.092548), t.addScaledVector(a[6], .315392 * (3 * i * i - 1)), t.addScaledVector(a[7], n * i * 1.092548), t.addScaledVector(a[8], .546274 * (n * n - r * r)), t;
	}
	getIrradianceAt(e, t) {
		let n = e.x, r = e.y, i = e.z, a = this.coefficients;
		return t.copy(a[0]).multiplyScalar(.886227), t.addScaledVector(a[1], 2 * .511664 * r), t.addScaledVector(a[2], 2 * .511664 * i), t.addScaledVector(a[3], 2 * .511664 * n), t.addScaledVector(a[4], 2 * .429043 * n * r), t.addScaledVector(a[5], 2 * .429043 * r * i), t.addScaledVector(a[6], .743125 * i * i - .247708), t.addScaledVector(a[7], 2 * .429043 * n * i), t.addScaledVector(a[8], .429043 * (n * n - r * r)), t;
	}
	add(e) {
		for (let t = 0; t < 9; t++) this.coefficients[t].add(e.coefficients[t]);
		return this;
	}
	addScaledSH(e, t) {
		for (let n = 0; n < 9; n++) this.coefficients[n].addScaledVector(e.coefficients[n], t);
		return this;
	}
	scale(e) {
		for (let t = 0; t < 9; t++) this.coefficients[t].multiplyScalar(e);
		return this;
	}
	lerp(e, t) {
		for (let n = 0; n < 9; n++) this.coefficients[n].lerp(e.coefficients[n], t);
		return this;
	}
	equals(e) {
		for (let t = 0; t < 9; t++) if (!this.coefficients[t].equals(e.coefficients[t])) return !1;
		return !0;
	}
	copy(e) {
		return this.set(e.coefficients);
	}
	clone() {
		return new this.constructor().copy(this);
	}
	fromArray(e, t = 0) {
		let n = this.coefficients;
		for (let r = 0; r < 9; r++) n[r].fromArray(e, t + r * 3);
		return this;
	}
	toArray(e = [], t = 0) {
		let n = this.coefficients;
		for (let r = 0; r < 9; r++) n[r].toArray(e, t + r * 3);
		return e;
	}
	static getBasisAt(e, t) {
		let n = e.x, r = e.y, i = e.z;
		t[0] = .282095, t[1] = .488603 * r, t[2] = .488603 * i, t[3] = .488603 * n, t[4] = 1.092548 * n * r, t[5] = 1.092548 * r * i, t[6] = .315392 * (3 * i * i - 1), t[7] = 1.092548 * n * i, t[8] = .546274 * (n * n - r * r);
	}
}, Hd = class extends vd {
	constructor(e = new Vd(), t = 1) {
		super(void 0, t), this.isLightProbe = !0, this.sh = e;
	}
	copy(e) {
		return super.copy(e), this.sh.copy(e.sh), this;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return t.object.sh = this.sh.toArray(), t;
	}
}, Ud = {}, Wd = class e extends sd {
	constructor(e) {
		super(e), this.textures = {};
	}
	load(e, t, n, r) {
		let i = this, a = new ud(i.manager);
		a.setPath(i.path), a.setRequestHeader(i.requestHeader), a.setWithCredentials(i.withCredentials), a.load(e, function(n) {
			try {
				t(i.parse(JSON.parse(n)));
			} catch (t) {
				r ? r(t) : z(t), i.manager.itemError(e);
			}
		}, n, r);
	}
	parse(e) {
		let t = this.createMaterialFromType(e.type);
		return t.fromJSON(e, this.textures), t;
	}
	setTextures(e) {
		return this.textures = e, this;
	}
	createMaterialFromType(t) {
		return e.createMaterialFromType(t);
	}
	static createMaterialFromType(e) {
		let t = {
			ShadowMaterial: pu,
			SpriteMaterial: no,
			RawShaderMaterial: Cu,
			ShaderMaterial: Su,
			PointsMaterial: ic,
			MeshPhysicalMaterial: Tu,
			MeshStandardMaterial: wu,
			MeshPhongMaterial: Eu,
			MeshToonMaterial: Du,
			MeshNormalMaterial: Ou,
			MeshLambertMaterial: ku,
			MeshDepthMaterial: Au,
			MeshDistanceMaterial: ju,
			MeshBasicMaterial: Ao,
			MeshMatcapMaterial: Mu,
			LineDashedMaterial: Nu,
			LineBasicMaterial: Ws,
			Material: to,
			...Ud
		}[e], n;
		return t === void 0 ? (pr(`MaterialLoader: Unknown material type "${e}". Use .registerMaterial() before starting the deserialization process.`), n = new to()) : n = new t(), n;
	}
	static registerMaterial(e, t) {
		Ud[e] = t;
	}
}, Gd = class {
	static extractUrlBase(e) {
		let t = e.lastIndexOf("/");
		return t === -1 ? "./" : e.slice(0, t + 1);
	}
	static resolveURL(e, t) {
		return typeof e != "string" || e === "" ? "" : (/^https?:\/\//i.test(t) && /^\//.test(e) && (t = t.replace(/(^https?:\/\/[^\/]+).*/i, "$1")), /^(https?:)?\/\//i.test(e) || /^data:.*,.*$/i.test(e) || /^blob:.*$/i.test(e) ? e : t + e);
	}
}, Kd = class extends Z {
	constructor() {
		super(), this.isInstancedBufferGeometry = !0, this.type = "InstancedBufferGeometry", this.instanceCount = Infinity;
	}
	copy(e) {
		return super.copy(e), this.instanceCount = e.instanceCount, this;
	}
	toJSON() {
		let e = super.toJSON();
		return e.instanceCount = this.instanceCount, e.isInstancedBufferGeometry = !0, e;
	}
}, qd = class extends sd {
	constructor(e) {
		super(e);
	}
	load(e, t, n, r) {
		let i = this, a = new ud(i.manager);
		a.setPath(i.path), a.setRequestHeader(i.requestHeader), a.setWithCredentials(i.withCredentials), a.load(e, function(n) {
			try {
				t(i.parse(JSON.parse(n)));
			} catch (t) {
				r ? r(t) : z(t), i.manager.itemError(e);
			}
		}, n, r);
	}
	parse(e) {
		let t = {}, n = {};
		function r(e, n) {
			if (t[n] !== void 0) return t[n];
			let r = e.interleavedBuffers[n], a = i(e, r.buffer), o = new Za(rr(r.type, a), r.stride);
			return o.uuid = r.uuid, t[n] = o, o;
		}
		function i(e, t) {
			if (n[t] !== void 0) return n[t];
			let r = e.arrayBuffers[t], i = new Uint32Array(r).buffer;
			return n[t] = i, i;
		}
		let a = e.isInstancedBufferGeometry ? new Kd() : new Z(), o = e.data.index;
		if (o !== void 0) {
			let e = rr(o.type, o.array);
			a.setIndex(new Y(e, 1));
		}
		let s = e.data.attributes;
		for (let t in s) {
			let n = s[t], i;
			if (n.isInterleavedBufferAttribute) i = new $a(r(e.data, n.data), n.itemSize, n.offset, n.normalized);
			else {
				let e = rr(n.type, n.array);
				i = new (n.isInstancedBufferAttribute ? os : Y)(e, n.itemSize, n.normalized);
			}
			n.name !== void 0 && (i.name = n.name), n.usage !== void 0 && i.setUsage(n.usage), a.setAttribute(t, i);
		}
		let c = e.data.morphAttributes;
		if (c) for (let t in c) {
			let n = c[t], i = [];
			for (let t = 0, a = n.length; t < a; t++) {
				let a = n[t], o;
				o = a.isInterleavedBufferAttribute ? new $a(r(e.data, a.data), a.itemSize, a.offset, a.normalized) : new Y(rr(a.type, a.array), a.itemSize, a.normalized), a.name !== void 0 && (o.name = a.name), i.push(o);
			}
			a.morphAttributes[t] = i;
		}
		e.data.morphTargetsRelative && (a.morphTargetsRelative = !0);
		let l = e.data.groups || e.data.drawcalls || e.data.offsets;
		if (l !== void 0) for (let e = 0, t = l.length; e !== t; ++e) {
			let t = l[e];
			a.addGroup(t.start, t.count, t.materialIndex);
		}
		let u = e.data.boundingSphere;
		return u !== void 0 && (a.boundingSphere = new Ua().fromJSON(u)), e.name && (a.name = e.name), e.userData && (a.userData = e.userData), a;
	}
}, Jd = {}, Yd = class extends sd {
	constructor(e) {
		super(e);
	}
	load(e, t, n, r) {
		let i = this, a = this.path === "" ? Gd.extractUrlBase(e) : this.path;
		this.resourcePath = this.resourcePath || a;
		let o = new ud(this.manager);
		o.setPath(this.path), o.setRequestHeader(this.requestHeader), o.setWithCredentials(this.withCredentials), o.load(e, function(n) {
			let a = null;
			try {
				a = JSON.parse(n);
			} catch (t) {
				r !== void 0 && r(t), z("ObjectLoader: Can't parse " + e + ".", t.message);
				return;
			}
			let o = a.metadata;
			if (o === void 0 || o.type === void 0 || o.type.toLowerCase() === "geometry") {
				r !== void 0 && r(/* @__PURE__ */ Error("THREE.ObjectLoader: Can't load " + e)), z("ObjectLoader: Can't load " + e);
				return;
			}
			i.parse(a, t);
		}, n, r);
	}
	async loadAsync(e, t) {
		let n = this, r = this.path === "" ? Gd.extractUrlBase(e) : this.path;
		this.resourcePath = this.resourcePath || r;
		let i = new ud(this.manager);
		i.setPath(this.path), i.setRequestHeader(this.requestHeader), i.setWithCredentials(this.withCredentials);
		let a = await i.loadAsync(e, t), o;
		try {
			o = JSON.parse(a);
		} catch (t) {
			throw Error("THREE.ObjectLoader: Can't parse " + e + ". " + t.message);
		}
		let s = o.metadata;
		if (s === void 0 || s.type === void 0 || s.type.toLowerCase() === "geometry") throw Error("THREE.ObjectLoader: Can't load " + e);
		return await n.parseAsync(o);
	}
	parse(e, t) {
		let n = this.parseAnimations(e.animations), r = this.parseShapes(e.shapes), i = this.parseGeometries(e.geometries, r), a = this.parseImages(e.images, function() {
			t !== void 0 && t(c);
		}), o = this.parseTextures(e.textures, a), s = this.parseMaterials(e.materials, o), c = this.parseObject(e.object, i, s, o, n), l = this.parseSkeletons(e.skeletons, c);
		if (this.bindSkeletons(c, l), this.bindLightTargets(c), t !== void 0) {
			let e = !1;
			for (let t in a) if (a[t].data instanceof HTMLImageElement) {
				e = !0;
				break;
			}
			e === !1 && t(c);
		}
		return c;
	}
	async parseAsync(e) {
		let t = this.parseAnimations(e.animations), n = this.parseShapes(e.shapes), r = this.parseGeometries(e.geometries, n), i = await this.parseImagesAsync(e.images), a = this.parseTextures(e.textures, i), o = this.parseMaterials(e.materials, a), s = this.parseObject(e.object, r, o, a, t), c = this.parseSkeletons(e.skeletons, s);
		return this.bindSkeletons(s, c), this.bindLightTargets(s), s;
	}
	static registerGeometry(e, t) {
		Jd[e] = t;
	}
	parseShapes(e) {
		let t = {};
		if (e !== void 0) for (let n = 0, r = e.length; n < r; n++) {
			let r = new dl().fromJSON(e[n]);
			t[r.uuid] = r;
		}
		return t;
	}
	parseSkeletons(e, t) {
		let n = {}, r = {};
		if (t.traverse(function(e) {
			e.isBone && (r[e.uuid] = e);
		}), e !== void 0) for (let t = 0, i = e.length; t < i; t++) {
			let i = new as().fromJSON(e[t], r);
			n[i.uuid] = i;
		}
		return n;
	}
	parseGeometries(e, t) {
		let n = {};
		if (e !== void 0) {
			let r = new qd();
			for (let i = 0, a = e.length; i < a; i++) {
				let a, o = e[i];
				switch (o.type) {
					case "BufferGeometry":
					case "InstancedBufferGeometry":
						a = r.parse(o);
						break;
					default: o.type in fu ? a = fu[o.type].fromJSON(o, t) : o.type in Jd ? a = Jd[o.type].fromJSON(o, t) : R(`ObjectLoader: Unknown geometry type "${o.type}". Use .registerGeometry() before starting the deserialization process.`);
				}
				a.uuid = o.uuid, o.name !== void 0 && (a.name = o.name), o.userData !== void 0 && (a.userData = o.userData), n[o.uuid] = a;
			}
		}
		return n;
	}
	parseMaterials(e, t) {
		let n = {}, r = {};
		if (e !== void 0) {
			let i = new Wd();
			i.setTextures(t);
			for (let t = 0, a = e.length; t < a; t++) {
				let a = e[t];
				n[a.uuid] === void 0 && (n[a.uuid] = i.parse(a)), r[a.uuid] = n[a.uuid];
			}
		}
		return r;
	}
	parseAnimations(e) {
		let t = {};
		if (e !== void 0) for (let n = 0; n < e.length; n++) {
			let r = e[n], i = ed.parse(r);
			t[i.uuid] = i;
		}
		return t;
	}
	parseImages(e, t) {
		let n = this, r = {}, i;
		function a(e) {
			return e = n.manager.resolveURL(e), n.manager.itemStart(e), i.load(e, function() {
				n.manager.itemEnd(e);
			}, void 0, function() {
				n.manager.itemError(e), n.manager.itemEnd(e);
			});
		}
		function o(e) {
			if (typeof e == "string") {
				let t = e;
				return a(/^(\/\/)|([a-z]+:(\/\/)?)/i.test(t) ? t : n.resourcePath + t);
			} else if (e.data) return {
				data: rr(e.type, e.data),
				width: e.width,
				height: e.height
			};
			else return null;
		}
		if (e !== void 0 && e.length > 0) {
			i = new md(new ad(t)), i.setCrossOrigin(this.crossOrigin);
			for (let t = 0, n = e.length; t < n; t++) {
				let n = e[t], i = n.url;
				if (Array.isArray(i)) {
					let e = [];
					for (let t = 0, n = i.length; t < n; t++) {
						let n = i[t], r = o(n);
						r !== null && (r instanceof HTMLImageElement ? e.push(r) : e.push(new ns(r.data, r.width, r.height)));
					}
					r[n.uuid] = new ei(e);
				} else {
					let e = o(n.url);
					r[n.uuid] = new ei(e);
				}
			}
		}
		return r;
	}
	async parseImagesAsync(e) {
		let t = this, n = {}, r;
		async function i(e) {
			if (typeof e == "string") {
				let n = e, i = /^(\/\/)|([a-z]+:(\/\/)?)/i.test(n) ? n : t.resourcePath + n;
				return await r.loadAsync(i);
			} else if (e.data) return {
				data: rr(e.type, e.data),
				width: e.width,
				height: e.height
			};
			else return null;
		}
		if (e !== void 0 && e.length > 0) {
			r = new md(this.manager), r.setCrossOrigin(this.crossOrigin);
			for (let t = 0, r = e.length; t < r; t++) {
				let r = e[t], a = r.url;
				if (Array.isArray(a)) {
					let e = [];
					for (let t = 0, n = a.length; t < n; t++) {
						let n = a[t], r = await i(n);
						r !== null && (r instanceof HTMLImageElement ? e.push(r) : e.push(new ns(r.data, r.width, r.height)));
					}
					n[r.uuid] = new ei(e);
				} else {
					let e = await i(r.url);
					n[r.uuid] = new ei(e);
				}
			}
		}
		return n;
	}
	parseTextures(e, t) {
		function n(e, t) {
			return typeof e == "number" ? e : (R("ObjectLoader.parseTexture: Constant should be in numeric form.", e), t[e]);
		}
		let r = {};
		if (e !== void 0) for (let i = 0, a = e.length; i < a; i++) {
			let a = e[i];
			a.image === void 0 && R("ObjectLoader: No \"image\" specified for", a.uuid), t[a.image] === void 0 && R("ObjectLoader: Undefined image", a.image);
			let o = t[a.image], s = o.data, c;
			Array.isArray(s) ? (c = new _c(), s.length === 6 && (c.needsUpdate = !0)) : (c = s && s.data ? new ns() : new ii(), s && (c.needsUpdate = !0)), c.source = o, c.uuid = a.uuid, a.name !== void 0 && (c.name = a.name), a.mapping !== void 0 && (c.mapping = n(a.mapping, Xd)), a.channel !== void 0 && (c.channel = a.channel), a.offset !== void 0 && c.offset.fromArray(a.offset), a.repeat !== void 0 && c.repeat.fromArray(a.repeat), a.center !== void 0 && c.center.fromArray(a.center), a.rotation !== void 0 && (c.rotation = a.rotation), a.wrap !== void 0 && (c.wrapS = n(a.wrap[0], Zd), c.wrapT = n(a.wrap[1], Zd)), a.format !== void 0 && (c.format = a.format), a.internalFormat !== void 0 && (c.internalFormat = a.internalFormat), a.type !== void 0 && (c.type = a.type), a.colorSpace !== void 0 && (c.colorSpace = a.colorSpace), a.minFilter !== void 0 && (c.minFilter = n(a.minFilter, Qd)), a.magFilter !== void 0 && (c.magFilter = n(a.magFilter, Qd)), a.anisotropy !== void 0 && (c.anisotropy = a.anisotropy), a.flipY !== void 0 && (c.flipY = a.flipY), a.generateMipmaps !== void 0 && (c.generateMipmaps = a.generateMipmaps), a.premultiplyAlpha !== void 0 && (c.premultiplyAlpha = a.premultiplyAlpha), a.unpackAlignment !== void 0 && (c.unpackAlignment = a.unpackAlignment), a.compareFunction !== void 0 && (c.compareFunction = a.compareFunction), a.normalized !== void 0 && (c.normalized = a.normalized), a.userData !== void 0 && (c.userData = a.userData), r[a.uuid] = c;
		}
		return r;
	}
	parseObject(e, t, n, r, i) {
		let a;
		function o(e) {
			return t[e] === void 0 && R("ObjectLoader: Undefined geometry", e), t[e];
		}
		function s(e) {
			if (e !== void 0) {
				if (Array.isArray(e)) {
					let t = [];
					for (let r = 0, i = e.length; r < i; r++) {
						let i = e[r];
						n[i] === void 0 && R("ObjectLoader: Undefined material", i), t.push(n[i]);
					}
					return t;
				}
				return n[e] === void 0 && R("ObjectLoader: Undefined material", e), n[e];
			}
		}
		function c(e) {
			return r[e] === void 0 && R("ObjectLoader: Undefined texture", e), r[e];
		}
		let l, u;
		switch (e.type) {
			case "Scene":
				a = new Ji(), e.background !== void 0 && (Number.isInteger(e.background) ? a.background = new J(e.background) : a.background = c(e.background)), e.environment !== void 0 && (a.environment = c(e.environment)), e.fog !== void 0 && (e.fog.type === "Fog" ? a.fog = new qi(e.fog.color, e.fog.near, e.fog.far) : e.fog.type === "FogExp2" && (a.fog = new Ki(e.fog.color, e.fog.density)), e.fog.name !== "" && (a.fog.name = e.fog.name)), e.backgroundBlurriness !== void 0 && (a.backgroundBlurriness = e.backgroundBlurriness), e.backgroundIntensity !== void 0 && (a.backgroundIntensity = e.backgroundIntensity), e.backgroundRotation !== void 0 && a.backgroundRotation.fromArray(e.backgroundRotation), e.environmentIntensity !== void 0 && (a.environmentIntensity = e.environmentIntensity), e.environmentRotation !== void 0 && a.environmentRotation.fromArray(e.environmentRotation);
				break;
			case "PerspectiveCamera":
				a = new jd(e.fov, e.aspect, e.near, e.far), e.focus !== void 0 && (a.focus = e.focus), e.zoom !== void 0 && (a.zoom = e.zoom), e.filmGauge !== void 0 && (a.filmGauge = e.filmGauge), e.filmOffset !== void 0 && (a.filmOffset = e.filmOffset), e.view !== void 0 && (a.view = Object.assign({}, e.view));
				break;
			case "OrthographicCamera":
				a = new Id(e.left, e.right, e.top, e.bottom, e.near, e.far), e.zoom !== void 0 && (a.zoom = e.zoom), e.view !== void 0 && (a.view = Object.assign({}, e.view));
				break;
			case "AmbientLight":
				a = new zd(e.color, e.intensity);
				break;
			case "DirectionalLight":
				a = new Rd(e.color, e.intensity), a.target = e.target || "";
				break;
			case "PointLight":
				a = new Fd(e.color, e.intensity, e.distance, e.decay);
				break;
			case "RectAreaLight":
				a = new Bd(e.color, e.intensity, e.width, e.height);
				break;
			case "SpotLight":
				a = new Nd(e.color, e.intensity, e.distance, e.angle, e.penumbra, e.decay), a.target = e.target || "";
				break;
			case "HemisphereLight":
				a = new yd(e.color, e.groundColor, e.intensity);
				break;
			case "LightProbe":
				a = new Hd(new Vd().fromArray(e.sh), e.intensity);
				break;
			case "SkinnedMesh":
				l = o(e.geometry), u = s(e.material), a = new es(l, u), e.bindMode !== void 0 && (a.bindMode = e.bindMode), e.bindMatrix !== void 0 && a.bindMatrix.fromArray(e.bindMatrix), e.skeleton !== void 0 && (a.skeleton = e.skeleton);
				break;
			case "Mesh":
				l = o(e.geometry), u = s(e.material), a = new Ho(l, u);
				break;
			case "InstancedMesh":
				l = o(e.geometry), u = s(e.material);
				let t = e.count, n = e.instanceMatrix, r = e.instanceColor;
				a = new ms(l, u, t), a.instanceMatrix = new os(new Float32Array(n.array), 16), r !== void 0 && (a.instanceColor = new os(new Float32Array(r.array), r.itemSize));
				break;
			case "BatchedMesh":
				l = o(e.geometry), u = s(e.material), a = new Us(e.maxInstanceCount, e.maxVertexCount, e.maxIndexCount, u), a.geometry = l, a.perObjectFrustumCulled = e.perObjectFrustumCulled, a.sortObjects = e.sortObjects, a._drawRanges = e.drawRanges, a._reservedRanges = e.reservedRanges, a._geometryInfo = e.geometryInfo.map((e) => {
					let t = null, n = null;
					return e.boundingBox !== void 0 && (t = new la().fromJSON(e.boundingBox)), e.boundingSphere !== void 0 && (n = new Ua().fromJSON(e.boundingSphere)), {
						...e,
						boundingBox: t,
						boundingSphere: n
					};
				}), a._instanceInfo = e.instanceInfo, a._availableInstanceIds = e._availableInstanceIds, a._availableGeometryIds = e._availableGeometryIds, a._nextIndexStart = e.nextIndexStart, a._nextVertexStart = e.nextVertexStart, a._geometryCount = e.geometryCount, a._maxInstanceCount = e.maxInstanceCount, a._maxVertexCount = e.maxVertexCount, a._maxIndexCount = e.maxIndexCount, a._geometryInitialized = e.geometryInitialized, a._matricesTexture = c(e.matricesTexture.uuid), a._indirectTexture = c(e.indirectTexture.uuid), e.colorsTexture !== void 0 && (a._colorsTexture = c(e.colorsTexture.uuid)), e.boundingSphere !== void 0 && (a.boundingSphere = new Ua().fromJSON(e.boundingSphere)), e.boundingBox !== void 0 && (a.boundingBox = new la().fromJSON(e.boundingBox));
				break;
			case "LOD":
				a = new xo();
				break;
			case "Line":
				a = new Qs(o(e.geometry), s(e.material));
				break;
			case "LineLoop":
				a = new rc(o(e.geometry), s(e.material));
				break;
			case "LineSegments":
				a = new nc(o(e.geometry), s(e.material));
				break;
			case "PointCloud":
			case "Points":
				a = new lc(o(e.geometry), s(e.material));
				break;
			case "Sprite":
				a = new _o(s(e.material));
				break;
			case "Group":
				a = new Ri();
				break;
			case "Bone":
				a = new ts();
				break;
			default: a = new q();
		}
		if (a.uuid = e.uuid, e.name !== void 0 && (a.name = e.name), e.matrix === void 0 ? (e.position !== void 0 && a.position.fromArray(e.position), e.rotation !== void 0 && a.rotation.fromArray(e.rotation), e.quaternion !== void 0 && a.quaternion.fromArray(e.quaternion), e.scale !== void 0 && a.scale.fromArray(e.scale)) : (a.matrix.fromArray(e.matrix), e.matrixAutoUpdate !== void 0 && (a.matrixAutoUpdate = e.matrixAutoUpdate), a.matrixAutoUpdate && a.matrix.decompose(a.position, a.quaternion, a.scale)), e.up !== void 0 && a.up.fromArray(e.up), e.pivot !== void 0 && (a.pivot = new U().fromArray(e.pivot)), e.morphTargetDictionary !== void 0 && (a.morphTargetDictionary = Object.assign({}, e.morphTargetDictionary)), e.morphTargetInfluences !== void 0 && (a.morphTargetInfluences = e.morphTargetInfluences.slice()), e.castShadow !== void 0 && (a.castShadow = e.castShadow), e.receiveShadow !== void 0 && (a.receiveShadow = e.receiveShadow), e.shadow && (e.shadow.intensity !== void 0 && (a.shadow.intensity = e.shadow.intensity), e.shadow.bias !== void 0 && (a.shadow.bias = e.shadow.bias), e.shadow.normalBias !== void 0 && (a.shadow.normalBias = e.shadow.normalBias), e.shadow.radius !== void 0 && (a.shadow.radius = e.shadow.radius), e.shadow.mapSize !== void 0 && a.shadow.mapSize.fromArray(e.shadow.mapSize), e.shadow.camera !== void 0 && (a.shadow.camera = this.parseObject(e.shadow.camera))), e.visible !== void 0 && (a.visible = e.visible), e.frustumCulled !== void 0 && (a.frustumCulled = e.frustumCulled), e.renderOrder !== void 0 && (a.renderOrder = e.renderOrder), e.static !== void 0 && (a.static = e.static), e.userData !== void 0 && (a.userData = e.userData), e.layers !== void 0 && (a.layers.mask = e.layers), e.children !== void 0) {
			let o = e.children;
			for (let e = 0; e < o.length; e++) a.add(this.parseObject(o[e], t, n, r, i));
		}
		if (e.animations !== void 0) {
			let t = e.animations;
			for (let e = 0; e < t.length; e++) {
				let n = t[e];
				a.animations.push(i[n]);
			}
		}
		if (e.type === "LOD") {
			e.autoUpdate !== void 0 && (a.autoUpdate = e.autoUpdate);
			let t = e.levels;
			for (let e = 0; e < t.length; e++) {
				let n = t[e], r = a.getObjectByProperty("uuid", n.object);
				r !== void 0 && a.addLevel(r, n.distance, n.hysteresis);
			}
		}
		return a;
	}
	bindSkeletons(e, t) {
		Object.keys(t).length !== 0 && e.traverse(function(e) {
			if (e.isSkinnedMesh === !0 && e.skeleton !== void 0) {
				let n = t[e.skeleton];
				n === void 0 ? R("ObjectLoader: No skeleton found with UUID:", e.skeleton) : e.bind(n, e.bindMatrix);
			}
		});
	}
	bindLightTargets(e) {
		e.traverse(function(t) {
			if (t.isDirectionalLight || t.isSpotLight) {
				let n = t.target, r = e.getObjectByProperty("uuid", n);
				r === void 0 ? t.target = new q() : t.target = r;
			}
		});
	}
}, Xd = {
	UVMapping: 300,
	CubeReflectionMapping: 301,
	CubeRefractionMapping: 302,
	EquirectangularReflectionMapping: 303,
	EquirectangularRefractionMapping: 304,
	CubeUVReflectionMapping: 306
}, Zd = {
	RepeatWrapping: Ke,
	ClampToEdgeWrapping: qe,
	MirroredRepeatWrapping: Je
}, Qd = {
	NearestFilter: Ye,
	NearestMipmapNearestFilter: Xe,
	NearestMipmapLinearFilter: Qe,
	LinearFilter: et,
	LinearMipmapNearestFilter: tt,
	LinearMipmapLinearFilter: rt
}, $d = /* @__PURE__ */ new WeakMap(), ef = class extends sd {
	constructor(e) {
		super(e), this.isImageBitmapLoader = !0, typeof createImageBitmap > "u" && R("ImageBitmapLoader: createImageBitmap() not supported."), typeof fetch > "u" && R("ImageBitmapLoader: fetch() not supported."), this.options = { premultiplyAlpha: "none" }, this._abortController = new AbortController();
	}
	setOptions(e) {
		return this.options = e, this;
	}
	load(e, t, n, r) {
		e === void 0 && (e = ""), this.path !== void 0 && (e = this.path + e), e = this.manager.resolveURL(e);
		let i = this, a = rd.get(`image-bitmap:${e}`);
		if (a !== void 0) {
			if (i.manager.itemStart(e), a.then) {
				a.then((n) => {
					$d.has(a) === !0 ? (r && r($d.get(a)), i.manager.itemError(e), i.manager.itemEnd(e)) : (t && t(n), i.manager.itemEnd(e));
				});
				return;
			}
			setTimeout(function() {
				t && t(a), i.manager.itemEnd(e);
			}, 0);
			return;
		}
		let o = {};
		o.credentials = this.crossOrigin === "anonymous" ? "same-origin" : "include", o.headers = this.requestHeader, o.signal = typeof AbortSignal.any == "function" ? AbortSignal.any([this._abortController.signal, this.manager.abortController.signal]) : this._abortController.signal;
		let s = fetch(e, o).then(function(e) {
			return e.blob();
		}).then(function(e) {
			return createImageBitmap(e, Object.assign(i.options, { colorSpaceConversion: "none" }));
		}).then(function(n) {
			rd.add(`image-bitmap:${e}`, n), t && t(n), i.manager.itemEnd(e);
		}).catch(function(t) {
			r && r(t), $d.set(s, t), rd.remove(`image-bitmap:${e}`), i.manager.itemError(e), i.manager.itemEnd(e);
		});
		rd.add(`image-bitmap:${e}`, s), i.manager.itemStart(e);
	}
	abort() {
		return this._abortController.abort(), this._abortController = new AbortController(), this;
	}
}, tf, nf = class {
	static getContext() {
		return tf === void 0 && (tf = new (window.AudioContext || window.webkitAudioContext)()), tf;
	}
	static setContext(e) {
		tf = e;
	}
}, rf = class extends sd {
	constructor(e) {
		super(e);
	}
	load(e, t, n, r) {
		let i = this, a = new ud(this.manager);
		a.setResponseType("arraybuffer"), a.setPath(this.path), a.setRequestHeader(this.requestHeader), a.setWithCredentials(this.withCredentials), a.load(e, function(n) {
			try {
				let r = n.slice(0), a = nf.getContext(), s = e + "#decode";
				i.manager.itemStart(s), a.decodeAudioData(r, function(e) {
					t(e), i.manager.itemEnd(s);
				}).catch(function(e) {
					o(e), i.manager.itemEnd(s);
				});
			} catch (e) {
				o(e);
			}
		}, n, r);
		function o(t) {
			r ? r(t) : z(t), i.manager.itemError(e);
		}
	}
}, af = /*@__PURE__*/ new K(), of = /*@__PURE__*/ new K(), sf = /*@__PURE__*/ new K(), cf = class {
	constructor() {
		this.type = "StereoCamera", this.aspect = 1, this.eyeSep = .064, this.cameraL = new jd(), this.cameraL.layers.enable(1), this.cameraL.matrixAutoUpdate = !1, this.cameraR = new jd(), this.cameraR.layers.enable(2), this.cameraR.matrixAutoUpdate = !1, this._cache = {
			focus: null,
			fov: null,
			aspect: null,
			near: null,
			far: null,
			zoom: null,
			eyeSep: null
		};
	}
	update(e) {
		let t = this._cache;
		if (t.focus !== e.focus || t.fov !== e.fov || t.aspect !== e.aspect * this.aspect || t.near !== e.near || t.far !== e.far || t.zoom !== e.zoom || t.eyeSep !== this.eyeSep) {
			t.focus = e.focus, t.fov = e.fov, t.aspect = e.aspect * this.aspect, t.near = e.near, t.far = e.far, t.zoom = e.zoom, t.eyeSep = this.eyeSep, sf.copy(e.projectionMatrix);
			let n = t.eyeSep / 2, r = n * t.near / t.focus, i = t.near * Math.tan(yr * t.fov * .5) / t.zoom, a, o;
			of.elements[12] = -n, af.elements[12] = n, a = -i * t.aspect + r, o = i * t.aspect + r, sf.elements[0] = 2 * t.near / (o - a), sf.elements[8] = (o + a) / (o - a), this.cameraL.projectionMatrix.copy(sf), a = -i * t.aspect - r, o = i * t.aspect - r, sf.elements[0] = 2 * t.near / (o - a), sf.elements[8] = (o + a) / (o - a), this.cameraR.projectionMatrix.copy(sf);
		}
		this.cameraL.matrix.copy(e.matrixWorld).multiply(of), this.cameraL.matrixWorldNeedsUpdate = !0, this.cameraR.matrix.copy(e.matrixWorld).multiply(af), this.cameraR.matrixWorldNeedsUpdate = !0;
	}
}, lf = -90, uf = 1, df = class extends q {
	constructor(e, t, n) {
		super(), this.type = "CubeCamera", this.renderTarget = n, this.coordinateSystem = null, this.activeMipmapLevel = 0;
		let r = new jd(lf, uf, e, t);
		r.layers = this.layers, this.add(r);
		let i = new jd(lf, uf, e, t);
		i.layers = this.layers, this.add(i);
		let a = new jd(lf, uf, e, t);
		a.layers = this.layers, this.add(a);
		let o = new jd(lf, uf, e, t);
		o.layers = this.layers, this.add(o);
		let s = new jd(lf, uf, e, t);
		s.layers = this.layers, this.add(s);
		let c = new jd(lf, uf, e, t);
		c.layers = this.layers, this.add(c);
	}
	updateCoordinateSystem() {
		let e = this.coordinateSystem, t = this.children.concat(), [n, r, i, a, o, s] = t;
		for (let e of t) this.remove(e);
		if (e === 2e3) n.up.set(0, 1, 0), n.lookAt(1, 0, 0), r.up.set(0, 1, 0), r.lookAt(-1, 0, 0), i.up.set(0, 0, -1), i.lookAt(0, 1, 0), a.up.set(0, 0, 1), a.lookAt(0, -1, 0), o.up.set(0, 1, 0), o.lookAt(0, 0, 1), s.up.set(0, 1, 0), s.lookAt(0, 0, -1);
		else if (e === 2001) n.up.set(0, -1, 0), n.lookAt(-1, 0, 0), r.up.set(0, -1, 0), r.lookAt(1, 0, 0), i.up.set(0, 0, 1), i.lookAt(0, 1, 0), a.up.set(0, 0, -1), a.lookAt(0, -1, 0), o.up.set(0, -1, 0), o.lookAt(0, 0, 1), s.up.set(0, -1, 0), s.lookAt(0, 0, -1);
		else throw Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: " + e);
		for (let e of t) this.add(e), e.updateMatrixWorld();
	}
	update(e, t) {
		this.parent === null && this.updateMatrixWorld();
		let { renderTarget: n, activeMipmapLevel: r } = this;
		this.coordinateSystem !== e.coordinateSystem && (this.coordinateSystem = e.coordinateSystem, this.updateCoordinateSystem());
		let [i, a, o, s, c, l] = this.children, u = e.getRenderTarget(), d = e.getActiveCubeFace(), f = e.getActiveMipmapLevel(), p = e.xr.enabled;
		e.xr.enabled = !1;
		let m = n.texture.generateMipmaps;
		n.texture.generateMipmaps = !1;
		let h = !1;
		h = e.isWebGLRenderer === !0 ? e.state.buffers.depth.getReversed() : e.reversedDepthBuffer, e.setRenderTarget(n, 0, r), h && e.autoClear === !1 && e.clearDepth(), e.render(t, i), e.setRenderTarget(n, 1, r), h && e.autoClear === !1 && e.clearDepth(), e.render(t, a), e.setRenderTarget(n, 2, r), h && e.autoClear === !1 && e.clearDepth(), e.render(t, o), e.setRenderTarget(n, 3, r), h && e.autoClear === !1 && e.clearDepth(), e.render(t, s), e.setRenderTarget(n, 4, r), h && e.autoClear === !1 && e.clearDepth(), e.render(t, c), n.texture.generateMipmaps = m, e.setRenderTarget(n, 5, r), h && e.autoClear === !1 && e.clearDepth(), e.render(t, l), e.setRenderTarget(u, d, f), e.xr.enabled = p, n.texture.needsPMREMUpdate = !0;
	}
}, ff = class extends jd {
	constructor(e = []) {
		super(), this.isArrayCamera = !0, this.isMultiViewCamera = !1, this.cameras = e;
	}
}, pf = class {
	constructor() {
		this._previousTime = 0, this._currentTime = 0, this._startTime = performance.now(), this._delta = 0, this._elapsed = 0, this._timescale = 1, this._document = null, this._pageVisibilityHandler = null;
	}
	connect(e) {
		this._document = e, e.hidden !== void 0 && (this._pageVisibilityHandler = mf.bind(this), e.addEventListener("visibilitychange", this._pageVisibilityHandler, !1));
	}
	disconnect() {
		this._pageVisibilityHandler !== null && (this._document.removeEventListener("visibilitychange", this._pageVisibilityHandler), this._pageVisibilityHandler = null), this._document = null;
	}
	getDelta() {
		return this._delta / 1e3;
	}
	getElapsed() {
		return this._elapsed / 1e3;
	}
	getTimescale() {
		return this._timescale;
	}
	setTimescale(e) {
		return this._timescale = e, this;
	}
	reset() {
		return this._currentTime = performance.now() - this._startTime, this;
	}
	dispose() {
		this.disconnect();
	}
	update(e) {
		return this._pageVisibilityHandler !== null && this._document.hidden === !0 ? this._delta = 0 : (this._previousTime = this._currentTime, this._currentTime = (e === void 0 ? performance.now() : e) - this._startTime, this._delta = (this._currentTime - this._previousTime) * this._timescale, this._elapsed += this._delta), this;
	}
};
function mf() {
	this._document.hidden === !1 && this.reset();
}
var hf = /*@__PURE__*/ new U(), gf = /*@__PURE__*/ new Hr(), _f = /*@__PURE__*/ new U(), vf = /*@__PURE__*/ new U(), yf = /*@__PURE__*/ new U(), bf = class extends q {
	constructor() {
		super(), this.type = "AudioListener", this.context = nf.getContext(), this.gain = this.context.createGain(), this.gain.connect(this.context.destination), this.filter = null, this.timeDelta = 0, this._timer = new pf();
	}
	getInput() {
		return this.gain;
	}
	removeFilter() {
		return this.filter !== null && (this.gain.disconnect(this.filter), this.filter.disconnect(this.context.destination), this.gain.connect(this.context.destination), this.filter = null), this;
	}
	getFilter() {
		return this.filter;
	}
	setFilter(e) {
		return this.filter === null ? this.gain.disconnect(this.context.destination) : (this.gain.disconnect(this.filter), this.filter.disconnect(this.context.destination)), this.filter = e, this.gain.connect(this.filter), this.filter.connect(this.context.destination), this;
	}
	getMasterVolume() {
		return this.gain.gain.value;
	}
	setMasterVolume(e) {
		return this.gain.gain.setTargetAtTime(e, this.context.currentTime, .01), this;
	}
	updateMatrixWorld(e) {
		super.updateMatrixWorld(e), this._timer.update();
		let t = this.context.listener;
		if (this.timeDelta = this._timer.getDelta(), this.matrixWorld.decompose(hf, gf, _f), vf.set(0, 0, -1).applyQuaternion(gf), yf.set(0, 1, 0).applyQuaternion(gf), t.positionX) {
			let e = this.context.currentTime + this.timeDelta;
			t.positionX.linearRampToValueAtTime(hf.x, e), t.positionY.linearRampToValueAtTime(hf.y, e), t.positionZ.linearRampToValueAtTime(hf.z, e), t.forwardX.linearRampToValueAtTime(vf.x, e), t.forwardY.linearRampToValueAtTime(vf.y, e), t.forwardZ.linearRampToValueAtTime(vf.z, e), t.upX.linearRampToValueAtTime(yf.x, e), t.upY.linearRampToValueAtTime(yf.y, e), t.upZ.linearRampToValueAtTime(yf.z, e);
		} else t.setPosition(hf.x, hf.y, hf.z), t.setOrientation(vf.x, vf.y, vf.z, yf.x, yf.y, yf.z);
	}
}, xf = class extends q {
	constructor(e) {
		super(), this.type = "Audio", this.listener = e, this.context = e.context, this.gain = this.context.createGain(), this.gain.connect(e.getInput()), this.autoplay = !1, this.buffer = null, this.detune = 0, this.loop = !1, this.loopStart = 0, this.loopEnd = 0, this.offset = 0, this.duration = void 0, this.playbackRate = 1, this.isPlaying = !1, this.hasPlaybackControl = !0, this.source = null, this.sourceType = "empty", this._startedAt = 0, this._progress = 0, this._connected = !1, this.filters = [];
	}
	getOutput() {
		return this.gain;
	}
	setNodeSource(e) {
		return this.hasPlaybackControl = !1, this.sourceType = "audioNode", this.source = e, this.connect(), this;
	}
	setMediaElementSource(e) {
		return this.hasPlaybackControl = !1, this.sourceType = "mediaNode", this.source = this.context.createMediaElementSource(e), this.connect(), this;
	}
	setMediaStreamSource(e) {
		return this.hasPlaybackControl = !1, this.sourceType = "mediaStreamNode", this.source = this.context.createMediaStreamSource(e), this.connect(), this;
	}
	setBuffer(e) {
		return this.buffer = e, this.sourceType = "buffer", this.autoplay && this.play(), this;
	}
	play(e = 0) {
		if (this.isPlaying === !0) {
			R("Audio: Audio is already playing.");
			return;
		}
		if (this.hasPlaybackControl === !1) {
			R("Audio: this Audio has no playback control.");
			return;
		}
		this._startedAt = this.context.currentTime + e;
		let t = this.context.createBufferSource();
		return t.buffer = this.buffer, t.loop = this.loop, t.loopStart = this.loopStart, t.loopEnd = this.loopEnd, t.onended = this.onEnded.bind(this), t.start(this._startedAt, this._progress + this.offset, this.duration), this.isPlaying = !0, this.source = t, this.setDetune(this.detune), this.setPlaybackRate(this.playbackRate), this.connect();
	}
	pause() {
		if (this.hasPlaybackControl === !1) {
			R("Audio: this Audio has no playback control.");
			return;
		}
		return this.isPlaying === !0 && (this._progress += Math.max(this.context.currentTime - this._startedAt, 0) * this.playbackRate, this.loop === !0 && (this._progress %= this.duration || this.buffer.duration), this.source.stop(), this.source.onended = null, this.isPlaying = !1), this;
	}
	stop(e = 0) {
		if (this.hasPlaybackControl === !1) {
			R("Audio: this Audio has no playback control.");
			return;
		}
		return this._progress = 0, this.source !== null && (this.source.stop(this.context.currentTime + e), this.source.onended = null), this.isPlaying = !1, this;
	}
	connect() {
		if (this.filters.length > 0) {
			this.source.connect(this.filters[0]);
			for (let e = 1, t = this.filters.length; e < t; e++) this.filters[e - 1].connect(this.filters[e]);
			this.filters[this.filters.length - 1].connect(this.getOutput());
		} else this.source.connect(this.getOutput());
		return this._connected = !0, this;
	}
	disconnect() {
		if (this._connected !== !1) {
			if (this.filters.length > 0) {
				this.source.disconnect(this.filters[0]);
				for (let e = 1, t = this.filters.length; e < t; e++) this.filters[e - 1].disconnect(this.filters[e]);
				this.filters[this.filters.length - 1].disconnect(this.getOutput());
			} else this.source.disconnect(this.getOutput());
			return this._connected = !1, this;
		}
	}
	getFilters() {
		return this.filters;
	}
	setFilters(e) {
		return e ||= [], this._connected === !0 ? (this.disconnect(), this.filters = e.slice(), this.connect()) : this.filters = e.slice(), this;
	}
	setDetune(e) {
		return this.detune = e, this.isPlaying === !0 && this.source.detune !== void 0 && this.source.detune.setTargetAtTime(this.detune, this.context.currentTime, .01), this;
	}
	getDetune() {
		return this.detune;
	}
	getFilter() {
		return this.getFilters()[0];
	}
	setFilter(e) {
		return this.setFilters(e ? [e] : []);
	}
	setPlaybackRate(e) {
		if (this.hasPlaybackControl === !1) {
			R("Audio: this Audio has no playback control.");
			return;
		}
		return this.playbackRate = e, this.isPlaying === !0 && this.source.playbackRate.setTargetAtTime(this.playbackRate, this.context.currentTime, .01), this;
	}
	getPlaybackRate() {
		return this.playbackRate;
	}
	onEnded() {
		this.isPlaying = !1, this._progress = 0;
	}
	getLoop() {
		return this.hasPlaybackControl === !1 ? (R("Audio: this Audio has no playback control."), !1) : this.loop;
	}
	setLoop(e) {
		if (this.hasPlaybackControl === !1) {
			R("Audio: this Audio has no playback control.");
			return;
		}
		return this.loop = e, this.isPlaying === !0 && (this.source.loop = this.loop), this;
	}
	setLoopStart(e) {
		return this.loopStart = e, this;
	}
	setLoopEnd(e) {
		return this.loopEnd = e, this;
	}
	getVolume() {
		return this.gain.gain.value;
	}
	setVolume(e) {
		return this.gain.gain.setTargetAtTime(e, this.context.currentTime, .01), this;
	}
	copy(e, t) {
		return super.copy(e, t), e.sourceType === "buffer" ? (this.autoplay = e.autoplay, this.buffer = e.buffer, this.detune = e.detune, this.loop = e.loop, this.loopStart = e.loopStart, this.loopEnd = e.loopEnd, this.offset = e.offset, this.duration = e.duration, this.playbackRate = e.playbackRate, this.hasPlaybackControl = e.hasPlaybackControl, this.sourceType = e.sourceType, this.filters = e.filters.slice(), this) : (R("Audio: Audio source type cannot be copied."), this);
	}
	clone(e) {
		return new this.constructor(this.listener).copy(this, e);
	}
}, Sf = /*@__PURE__*/ new U(), Cf = /*@__PURE__*/ new Hr(), wf = /*@__PURE__*/ new U(), Tf = /*@__PURE__*/ new U(), Ef = class extends xf {
	constructor(e) {
		super(e), this.panner = this.context.createPanner(), this.panner.panningModel = "HRTF", this.panner.connect(this.gain);
	}
	connect() {
		return super.connect(), this.panner.connect(this.gain), this;
	}
	disconnect() {
		return super.disconnect(), this.panner.disconnect(this.gain), this;
	}
	getOutput() {
		return this.panner;
	}
	getRefDistance() {
		return this.panner.refDistance;
	}
	setRefDistance(e) {
		return this.panner.refDistance = e, this;
	}
	getRolloffFactor() {
		return this.panner.rolloffFactor;
	}
	setRolloffFactor(e) {
		return this.panner.rolloffFactor = e, this;
	}
	getDistanceModel() {
		return this.panner.distanceModel;
	}
	setDistanceModel(e) {
		return this.panner.distanceModel = e, this;
	}
	getMaxDistance() {
		return this.panner.maxDistance;
	}
	setMaxDistance(e) {
		return this.panner.maxDistance = e, this;
	}
	setDirectionalCone(e, t, n) {
		return this.panner.coneInnerAngle = e, this.panner.coneOuterAngle = t, this.panner.coneOuterGain = n, this;
	}
	updateMatrixWorld(e) {
		if (super.updateMatrixWorld(e), this.hasPlaybackControl === !0 && this.isPlaying === !1) return;
		this.matrixWorld.decompose(Sf, Cf, wf), Tf.set(0, 0, 1).applyQuaternion(Cf);
		let t = this.panner;
		if (t.positionX) {
			let e = this.context.currentTime + this.listener.timeDelta;
			t.positionX.linearRampToValueAtTime(Sf.x, e), t.positionY.linearRampToValueAtTime(Sf.y, e), t.positionZ.linearRampToValueAtTime(Sf.z, e), t.orientationX.linearRampToValueAtTime(Tf.x, e), t.orientationY.linearRampToValueAtTime(Tf.y, e), t.orientationZ.linearRampToValueAtTime(Tf.z, e);
		} else t.setPosition(Sf.x, Sf.y, Sf.z), t.setOrientation(Tf.x, Tf.y, Tf.z);
	}
}, Df = class {
	constructor(e, t = 2048) {
		this.analyser = e.context.createAnalyser(), this.analyser.fftSize = t, this.data = new Uint8Array(this.analyser.frequencyBinCount), e.getOutput().connect(this.analyser);
	}
	getFrequencyData() {
		return this.analyser.getByteFrequencyData(this.data), this.data;
	}
	getAverageFrequency() {
		let e = 0, t = this.getFrequencyData();
		for (let n = 0; n < t.length; n++) e += t[n];
		return e / t.length;
	}
}, Of = class {
	constructor(e, t, n) {
		this.binding = e, this.valueSize = n;
		let r, i, a;
		switch (t) {
			case "quaternion":
				r = this._slerp, i = this._slerpAdditive, a = this._setAdditiveIdentityQuaternion, this.buffer = new Float64Array(n * 6), this._workIndex = 5;
				break;
			case "string":
			case "bool":
				r = this._select, i = this._select, a = this._setAdditiveIdentityOther, this.buffer = Array(n * 5);
				break;
			default: r = this._lerp, i = this._lerpAdditive, a = this._setAdditiveIdentityNumeric, this.buffer = new Float64Array(n * 5);
		}
		this._mixBufferRegion = r, this._mixBufferRegionAdditive = i, this._setIdentity = a, this._origIndex = 3, this._addIndex = 4, this.cumulativeWeight = 0, this.cumulativeWeightAdditive = 0, this.useCount = 0, this.referenceCount = 0;
	}
	accumulate(e, t) {
		let n = this.buffer, r = this.valueSize, i = e * r + r, a = this.cumulativeWeight;
		if (a === 0) {
			for (let e = 0; e !== r; ++e) n[i + e] = n[e];
			a = t;
		} else {
			a += t;
			let e = t / a;
			this._mixBufferRegion(n, i, 0, e, r);
		}
		this.cumulativeWeight = a;
	}
	accumulateAdditive(e) {
		let t = this.buffer, n = this.valueSize, r = n * this._addIndex;
		this.cumulativeWeightAdditive === 0 && this._setIdentity(), this._mixBufferRegionAdditive(t, r, 0, e, n), this.cumulativeWeightAdditive += e;
	}
	apply(e) {
		let t = this.valueSize, n = this.buffer, r = e * t + t, i = this.cumulativeWeight, a = this.cumulativeWeightAdditive, o = this.binding;
		if (this.cumulativeWeight = 0, this.cumulativeWeightAdditive = 0, i < 1) {
			let e = t * this._origIndex;
			this._mixBufferRegion(n, r, e, 1 - i, t);
		}
		a > 0 && this._mixBufferRegionAdditive(n, r, this._addIndex * t, 1, t);
		for (let e = t, i = t + t; e !== i; ++e) if (n[e] !== n[e + t]) {
			o.setValue(n, r);
			break;
		}
	}
	saveOriginalState() {
		let e = this.binding, t = this.buffer, n = this.valueSize, r = n * this._origIndex;
		e.getValue(t, r);
		for (let e = n, i = r; e !== i; ++e) t[e] = t[r + e % n];
		this._setIdentity(), this.cumulativeWeight = 0, this.cumulativeWeightAdditive = 0;
	}
	restoreOriginalState() {
		let e = this.valueSize * 3;
		this.binding.setValue(this.buffer, e);
	}
	_setAdditiveIdentityNumeric() {
		let e = this._addIndex * this.valueSize, t = e + this.valueSize;
		for (let n = e; n < t; n++) this.buffer[n] = 0;
	}
	_setAdditiveIdentityQuaternion() {
		this._setAdditiveIdentityNumeric(), this.buffer[this._addIndex * this.valueSize + 3] = 1;
	}
	_setAdditiveIdentityOther() {
		let e = this._origIndex * this.valueSize, t = this._addIndex * this.valueSize;
		for (let n = 0; n < this.valueSize; n++) this.buffer[t + n] = this.buffer[e + n];
	}
	_select(e, t, n, r, i) {
		if (r >= .5) for (let r = 0; r !== i; ++r) e[t + r] = e[n + r];
	}
	_slerp(e, t, n, r) {
		Hr.slerpFlat(e, t, e, t, e, n, r);
	}
	_slerpAdditive(e, t, n, r, i) {
		let a = this._workIndex * i;
		Hr.multiplyQuaternionsFlat(e, a, e, t, e, n), Hr.slerpFlat(e, t, e, t, e, a, r);
	}
	_lerp(e, t, n, r, i) {
		let a = 1 - r;
		for (let o = 0; o !== i; ++o) {
			let i = t + o;
			e[i] = e[i] * a + e[n + o] * r;
		}
	}
	_lerpAdditive(e, t, n, r, i) {
		for (let a = 0; a !== i; ++a) {
			let i = t + a;
			e[i] = e[i] + e[n + a] * r;
		}
	}
}, kf = "\\[\\]\\.:\\/", Af = /* @__PURE__ */ RegExp("[\\[\\]\\.:\\/]", "g"), jf = "[^\\[\\]\\.:\\/]", Mf = "[^" + kf.replace("\\.", "") + "]", Nf = /*@__PURE__*/ "((?:WC+[\\/:])*)".replace("WC", jf), Pf = /*@__PURE__*/ "(WCOD+)?".replace("WCOD", Mf), Ff = /*@__PURE__*/ "(?:\\.(WC+)(?:\\[(.+)\\])?)?".replace("WC", jf), If = /*@__PURE__*/ "\\.(WC+)(?:\\[(.+)\\])?".replace("WC", jf), Lf = RegExp("^" + Nf + Pf + Ff + If + "$"), Rf = [
	"material",
	"materials",
	"bones",
	"map"
], zf = class {
	constructor(e, t, n) {
		let r = n || Bf.parseTrackName(t);
		this._targetGroup = e, this._bindings = e.subscribe_(t, r);
	}
	getValue(e, t) {
		this.bind();
		let n = this._targetGroup.nCachedObjects_, r = this._bindings[n];
		r !== void 0 && r.getValue(e, t);
	}
	setValue(e, t) {
		let n = this._bindings;
		for (let r = this._targetGroup.nCachedObjects_, i = n.length; r !== i; ++r) n[r].setValue(e, t);
	}
	bind() {
		let e = this._bindings;
		for (let t = this._targetGroup.nCachedObjects_, n = e.length; t !== n; ++t) e[t].bind();
	}
	unbind() {
		let e = this._bindings;
		for (let t = this._targetGroup.nCachedObjects_, n = e.length; t !== n; ++t) e[t].unbind();
	}
}, Bf = class e {
	constructor(t, n, r) {
		this.path = n, this.parsedPath = r || e.parseTrackName(n), this.node = e.findNode(t, this.parsedPath.nodeName), this.rootNode = t, this.getValue = this._getValue_unbound, this.setValue = this._setValue_unbound;
	}
	static create(t, n, r) {
		return t && t.isAnimationObjectGroup ? new e.Composite(t, n, r) : new e(t, n, r);
	}
	static sanitizeNodeName(e) {
		return e.replace(/\s/g, "_").replace(Af, "");
	}
	static parseTrackName(e) {
		let t = Lf.exec(e);
		if (t === null) throw Error("THREE.PropertyBinding: Cannot parse trackName: " + e);
		let n = {
			nodeName: t[2],
			objectName: t[3],
			objectIndex: t[4],
			propertyName: t[5],
			propertyIndex: t[6]
		}, r = n.nodeName && n.nodeName.lastIndexOf(".");
		if (r !== void 0 && r !== -1) {
			let e = n.nodeName.substring(r + 1);
			Rf.indexOf(e) !== -1 && (n.nodeName = n.nodeName.substring(0, r), n.objectName = e);
		}
		if (n.propertyName === null || n.propertyName.length === 0) throw Error("THREE.PropertyBinding: can not parse propertyName from trackName: " + e);
		return n;
	}
	static findNode(e, t) {
		if (t === void 0 || t === "" || t === "." || t === -1 || t === e.name || t === e.uuid) return e;
		if (e.skeleton) {
			let n = e.skeleton.getBoneByName(t);
			if (n !== void 0) return n;
		}
		if (e.children) {
			let n = function(e) {
				for (let r = 0; r < e.length; r++) {
					let i = e[r];
					if (i.name === t || i.uuid === t) return i;
					let a = n(i.children);
					if (a) return a;
				}
				return null;
			}, r = n(e.children);
			if (r) return r;
		}
		return null;
	}
	_getValue_unavailable() {}
	_setValue_unavailable() {}
	_getValue_direct(e, t) {
		e[t] = this.targetObject[this.propertyName];
	}
	_getValue_array(e, t) {
		let n = this.resolvedProperty;
		for (let r = 0, i = n.length; r !== i; ++r) e[t++] = n[r];
	}
	_getValue_arrayElement(e, t) {
		e[t] = this.resolvedProperty[this.propertyIndex];
	}
	_getValue_toArray(e, t) {
		this.resolvedProperty.toArray(e, t);
	}
	_setValue_direct(e, t) {
		this.targetObject[this.propertyName] = e[t];
	}
	_setValue_direct_setNeedsUpdate(e, t) {
		this.targetObject[this.propertyName] = e[t], this.targetObject.needsUpdate = !0;
	}
	_setValue_direct_setMatrixWorldNeedsUpdate(e, t) {
		this.targetObject[this.propertyName] = e[t], this.targetObject.matrixWorldNeedsUpdate = !0;
	}
	_setValue_array(e, t) {
		let n = this.resolvedProperty;
		for (let r = 0, i = n.length; r !== i; ++r) n[r] = e[t++];
	}
	_setValue_array_setNeedsUpdate(e, t) {
		let n = this.resolvedProperty;
		for (let r = 0, i = n.length; r !== i; ++r) n[r] = e[t++];
		this.targetObject.needsUpdate = !0;
	}
	_setValue_array_setMatrixWorldNeedsUpdate(e, t) {
		let n = this.resolvedProperty;
		for (let r = 0, i = n.length; r !== i; ++r) n[r] = e[t++];
		this.targetObject.matrixWorldNeedsUpdate = !0;
	}
	_setValue_arrayElement(e, t) {
		this.resolvedProperty[this.propertyIndex] = e[t];
	}
	_setValue_arrayElement_setNeedsUpdate(e, t) {
		this.resolvedProperty[this.propertyIndex] = e[t], this.targetObject.needsUpdate = !0;
	}
	_setValue_arrayElement_setMatrixWorldNeedsUpdate(e, t) {
		this.resolvedProperty[this.propertyIndex] = e[t], this.targetObject.matrixWorldNeedsUpdate = !0;
	}
	_setValue_fromArray(e, t) {
		this.resolvedProperty.fromArray(e, t);
	}
	_setValue_fromArray_setNeedsUpdate(e, t) {
		this.resolvedProperty.fromArray(e, t), this.targetObject.needsUpdate = !0;
	}
	_setValue_fromArray_setMatrixWorldNeedsUpdate(e, t) {
		this.resolvedProperty.fromArray(e, t), this.targetObject.matrixWorldNeedsUpdate = !0;
	}
	_getValue_unbound(e, t) {
		this.bind(), this.getValue(e, t);
	}
	_setValue_unbound(e, t) {
		this.bind(), this.setValue(e, t);
	}
	bind() {
		let t = this.node, n = this.parsedPath, r = n.objectName, i = n.propertyName, a = n.propertyIndex;
		if (t || (t = e.findNode(this.rootNode, n.nodeName), this.node = t), this.getValue = this._getValue_unavailable, this.setValue = this._setValue_unavailable, !t) {
			R("PropertyBinding: No target node found for track: " + this.path + ".");
			return;
		}
		if (r) {
			let e = n.objectIndex;
			switch (r) {
				case "materials":
					if (!t.material) {
						z("PropertyBinding: Can not bind to material as node does not have a material.", this);
						return;
					}
					if (!t.material.materials) {
						z("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.", this);
						return;
					}
					t = t.material.materials;
					break;
				case "bones":
					if (!t.skeleton) {
						z("PropertyBinding: Can not bind to bones as node does not have a skeleton.", this);
						return;
					}
					t = t.skeleton.bones;
					for (let n = 0; n < t.length; n++) if (t[n].name === e) {
						e = n;
						break;
					}
					break;
				case "map":
					if ("map" in t) {
						t = t.map;
						break;
					}
					if (!t.material) {
						z("PropertyBinding: Can not bind to material as node does not have a material.", this);
						return;
					}
					if (!t.material.map) {
						z("PropertyBinding: Can not bind to material.map as node.material does not have a map.", this);
						return;
					}
					t = t.material.map;
					break;
				default:
					if (t[r] === void 0) {
						z("PropertyBinding: Can not bind to objectName of node undefined.", this);
						return;
					}
					t = t[r];
			}
			if (e !== void 0) {
				if (t[e] === void 0) {
					z("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.", this, t);
					return;
				}
				t = t[e];
			}
		}
		let o = t[i];
		if (o === void 0) {
			let e = n.nodeName;
			z("PropertyBinding: Trying to update property for track: " + e + "." + i + " but it wasn't found.", t);
			return;
		}
		let s = this.Versioning.None;
		this.targetObject = t, t.isMaterial === !0 ? s = this.Versioning.NeedsUpdate : t.isObject3D === !0 && (s = this.Versioning.MatrixWorldNeedsUpdate);
		let c = this.BindingType.Direct;
		if (a !== void 0) {
			if (i === "morphTargetInfluences") {
				if (!t.geometry) {
					z("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.", this);
					return;
				}
				if (!t.geometry.morphAttributes) {
					z("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.", this);
					return;
				}
				t.morphTargetDictionary[a] !== void 0 && (a = t.morphTargetDictionary[a]);
			}
			c = this.BindingType.ArrayElement, this.resolvedProperty = o, this.propertyIndex = a;
		} else o.fromArray !== void 0 && o.toArray !== void 0 ? (c = this.BindingType.HasFromToArray, this.resolvedProperty = o) : Array.isArray(o) ? (c = this.BindingType.EntireArray, this.resolvedProperty = o) : this.propertyName = i;
		this.getValue = this.GetterByBindingType[c], this.setValue = this.SetterByBindingTypeAndVersioning[c][s];
	}
	unbind() {
		this.node = null, this.getValue = this._getValue_unbound, this.setValue = this._setValue_unbound;
	}
};
Bf.Composite = zf, Bf.prototype.BindingType = {
	Direct: 0,
	EntireArray: 1,
	ArrayElement: 2,
	HasFromToArray: 3
}, Bf.prototype.Versioning = {
	None: 0,
	NeedsUpdate: 1,
	MatrixWorldNeedsUpdate: 2
}, Bf.prototype.GetterByBindingType = [
	Bf.prototype._getValue_direct,
	Bf.prototype._getValue_array,
	Bf.prototype._getValue_arrayElement,
	Bf.prototype._getValue_toArray
], Bf.prototype.SetterByBindingTypeAndVersioning = [
	[
		Bf.prototype._setValue_direct,
		Bf.prototype._setValue_direct_setNeedsUpdate,
		Bf.prototype._setValue_direct_setMatrixWorldNeedsUpdate
	],
	[
		Bf.prototype._setValue_array,
		Bf.prototype._setValue_array_setNeedsUpdate,
		Bf.prototype._setValue_array_setMatrixWorldNeedsUpdate
	],
	[
		Bf.prototype._setValue_arrayElement,
		Bf.prototype._setValue_arrayElement_setNeedsUpdate,
		Bf.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate
	],
	[
		Bf.prototype._setValue_fromArray,
		Bf.prototype._setValue_fromArray_setNeedsUpdate,
		Bf.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate
	]
];
var Vf = class {
	constructor() {
		this.isAnimationObjectGroup = !0, this.uuid = xr(), this._objects = Array.prototype.slice.call(arguments), this.nCachedObjects_ = 0;
		let e = {};
		this._indicesByUUID = e;
		for (let t = 0, n = arguments.length; t !== n; ++t) e[arguments[t].uuid] = t;
		this._paths = [], this._parsedPaths = [], this._bindings = [], this._bindingsIndicesByPath = {};
		let t = this;
		this.stats = {
			objects: {
				get total() {
					return t._objects.length;
				},
				get inUse() {
					return this.total - t.nCachedObjects_;
				}
			},
			get bindingsPerObject() {
				return t._bindings.length;
			}
		};
	}
	add() {
		let e = this._objects, t = this._indicesByUUID, n = this._paths, r = this._parsedPaths, i = this._bindings, a = i.length, o, s = e.length, c = this.nCachedObjects_;
		for (let l = 0, u = arguments.length; l !== u; ++l) {
			let u = arguments[l], d = u.uuid, f = t[d];
			if (f === void 0) {
				f = s++, t[d] = f, e.push(u);
				for (let e = 0, t = a; e !== t; ++e) i[e].push(new Bf(u, n[e], r[e]));
			} else if (f < c) {
				o = e[f];
				let s = --c, l = e[s];
				t[l.uuid] = f, e[f] = l, t[d] = s, e[s] = u;
				for (let e = 0, t = a; e !== t; ++e) {
					let t = i[e], a = t[s], o = t[f];
					t[f] = a, o === void 0 && (o = new Bf(u, n[e], r[e])), t[s] = o;
				}
			} else e[f] !== o && z("AnimationObjectGroup: Different objects with the same UUID detected. Clean the caches or recreate your infrastructure when reloading scenes.");
		}
		this.nCachedObjects_ = c;
	}
	remove() {
		let e = this._objects, t = this._indicesByUUID, n = this._bindings, r = n.length, i = this.nCachedObjects_;
		for (let a = 0, o = arguments.length; a !== o; ++a) {
			let o = arguments[a], s = o.uuid, c = t[s];
			if (c !== void 0 && c >= i) {
				let a = i++, l = e[a];
				t[l.uuid] = c, e[c] = l, t[s] = a, e[a] = o;
				for (let e = 0, t = r; e !== t; ++e) {
					let t = n[e], r = t[a], i = t[c];
					t[c] = r, t[a] = i;
				}
			}
		}
		this.nCachedObjects_ = i;
	}
	uncache() {
		let e = this._objects, t = this._indicesByUUID, n = this._bindings, r = n.length, i = this.nCachedObjects_, a = e.length;
		for (let o = 0, s = arguments.length; o !== s; ++o) {
			let s = arguments[o].uuid, c = t[s];
			if (c !== void 0) if (delete t[s], c < i) {
				let o = --i, s = e[o], l = --a, u = e[l];
				t[s.uuid] = c, e[c] = s, t[u.uuid] = o, e[o] = u, e.pop();
				for (let e = 0, t = r; e !== t; ++e) {
					let t = n[e], r = t[o], i = t[l];
					t[c] = r, t[o] = i, t.pop();
				}
			} else {
				let i = --a, o = e[i];
				i > 0 && (t[o.uuid] = c), e[c] = o, e.pop();
				for (let e = 0, t = r; e !== t; ++e) {
					let t = n[e];
					t[c] = t[i], t.pop();
				}
			}
		}
		this.nCachedObjects_ = i;
	}
	subscribe_(e, t) {
		let n = this._bindingsIndicesByPath, r = n[e], i = this._bindings;
		if (r !== void 0) return i[r];
		let a = this._paths, o = this._parsedPaths, s = this._objects, c = s.length, l = this.nCachedObjects_, u = Array(c);
		r = i.length, n[e] = r, a.push(e), o.push(t), i.push(u);
		for (let n = l, r = s.length; n !== r; ++n) {
			let r = s[n];
			u[n] = new Bf(r, e, t);
		}
		return u;
	}
	unsubscribe_(e) {
		let t = this._bindingsIndicesByPath, n = t[e];
		if (n !== void 0) {
			let r = this._paths, i = this._parsedPaths, a = this._bindings, o = a.length - 1, s = a[o], c = e[o];
			t[c] = n, a[n] = s, a.pop(), i[n] = i[o], i.pop(), r[n] = r[o], r.pop();
		}
	}
}, Hf = class {
	constructor(e, t, n = null, r = t.blendMode) {
		this._mixer = e, this._clip = t, this._localRoot = n, this.blendMode = r;
		let i = t.tracks, a = i.length, o = Array(a), s = {
			endingStart: yn,
			endingEnd: yn
		};
		for (let e = 0; e !== a; ++e) {
			let t = i[e].createInterpolant(null);
			o[e] = t, t.settings = s;
		}
		this._interpolantSettings = s, this._interpolants = o, this._propertyBindings = Array(a), this._cacheIndex = null, this._byClipCacheIndex = null, this._timeScaleInterpolant = null, this._restoreTimeScale = null, this._weightInterpolant = null, this.loop = pn, this._loopCount = -1, this._startTime = null, this.time = 0, this.timeScale = 1, this._effectiveTimeScale = 1, this.weight = 1, this._effectiveWeight = 1, this.repetitions = Infinity, this.paused = !1, this.enabled = !0, this.clampWhenFinished = !1, this.zeroSlopeAtStart = !0, this.zeroSlopeAtEnd = !0;
	}
	play() {
		return this._mixer._activateAction(this), this;
	}
	stop() {
		return this._mixer._deactivateAction(this), this.reset();
	}
	reset() {
		return this.paused = !1, this.enabled = !0, this.time = 0, this._loopCount = -1, this._startTime = null, this.stopFading().stopWarping();
	}
	isRunning() {
		return this.enabled && !this.paused && this.timeScale !== 0 && this._startTime === null && this._mixer._isActiveAction(this);
	}
	isScheduled() {
		return this._mixer._isActiveAction(this);
	}
	startAt(e) {
		return this._startTime = e, this;
	}
	setLoop(e, t) {
		return this.loop = e, this.repetitions = t, this;
	}
	setEffectiveWeight(e) {
		return this.weight = e, this._effectiveWeight = this.enabled ? e : 0, this.stopFading();
	}
	getEffectiveWeight() {
		return this._effectiveWeight;
	}
	fadeIn(e) {
		return this._scheduleFading(e, 0, 1);
	}
	fadeOut(e) {
		return this._scheduleFading(e, 1, 0);
	}
	crossFadeFrom(e, t, n = !1) {
		if (e.fadeOut(t), this.fadeIn(t), n === !0) {
			let n = this._clip.duration, r = e._clip.duration, i = r / n, a = n / r;
			e._restoreTimeScale = e.timeScale, this._restoreTimeScale = this.timeScale, e.warp(1, i, t), this.warp(a, 1, t);
		}
		return this;
	}
	crossFadeTo(e, t, n = !1) {
		return e.crossFadeFrom(this, t, n);
	}
	stopFading() {
		let e = this._weightInterpolant;
		return e !== null && (this._weightInterpolant = null, this._mixer._takeBackControlInterpolant(e)), this;
	}
	setEffectiveTimeScale(e) {
		return this.timeScale = e, this._effectiveTimeScale = this.paused ? 0 : e, this.stopWarping();
	}
	getEffectiveTimeScale() {
		return this._effectiveTimeScale;
	}
	setDuration(e) {
		return this.timeScale = this._clip.duration / e, this.stopWarping();
	}
	syncWith(e) {
		return this.time = e.time, this.timeScale = e.timeScale, this.stopWarping();
	}
	halt(e) {
		return this.warp(this._effectiveTimeScale, 0, e);
	}
	warp(e, t, n) {
		let r = this._mixer, i = r.time, a = this.timeScale, o = this._timeScaleInterpolant;
		o === null && (o = r._lendControlInterpolant(), this._timeScaleInterpolant = o);
		let s = o.parameterPositions, c = o.sampleValues;
		return s[0] = i, s[1] = i + n, c[0] = e / a, c[1] = t / a, this;
	}
	stopWarping() {
		let e = this._timeScaleInterpolant;
		return e !== null && (this._timeScaleInterpolant = null, this._mixer._takeBackControlInterpolant(e)), this._restoreTimeScale = null, this;
	}
	getMixer() {
		return this._mixer;
	}
	getClip() {
		return this._clip;
	}
	getRoot() {
		return this._localRoot || this._mixer._root;
	}
	_update(e, t, n, r) {
		if (!this.enabled) {
			this._updateWeight(e);
			return;
		}
		let i = this._startTime;
		if (i !== null) {
			let r = (e - i) * n;
			r < 0 || n === 0 ? t = 0 : (this._startTime = null, t = n * r);
		}
		t *= this._updateTimeScale(e);
		let a = this._updateTime(t), o = this._updateWeight(e);
		if (o > 0) {
			let e = this._interpolants, t = this._propertyBindings;
			switch (this.blendMode) {
				case Cn:
					for (let n = 0, r = e.length; n !== r; ++n) e[n].evaluate(a), t[n].accumulateAdditive(o);
					break;
				case Sn:
				default: for (let n = 0, i = e.length; n !== i; ++n) e[n].evaluate(a), t[n].accumulate(r, o);
			}
		}
	}
	_updateWeight(e) {
		let t = 0;
		if (this.enabled) {
			t = this.weight;
			let n = this._weightInterpolant;
			if (n !== null) {
				let r = n.evaluate(e)[0];
				t *= r, e > n.parameterPositions[1] && (this.stopFading(), r === 0 && (this.enabled = !1));
			}
		}
		return this._effectiveWeight = t, t;
	}
	_updateTimeScale(e) {
		let t = 0;
		if (!this.paused) {
			t = this.timeScale;
			let n = this._timeScaleInterpolant;
			if (n !== null) {
				let r = n.evaluate(e)[0];
				t *= r, e > n.parameterPositions[1] && (t === 0 ? this.paused = !0 : (this._restoreTimeScale !== null && (t = this._restoreTimeScale), this.timeScale = t), this.stopWarping());
			}
		}
		return this._effectiveTimeScale = t, t;
	}
	_updateTime(e) {
		let t = this._clip.duration, n = this.loop, r = this.time + e, i = this._loopCount, a = n === mn;
		if (e === 0) return i === -1 ? r : a && (i & 1) == 1 ? t - r : r;
		if (n === 2200) {
			i === -1 && (this._loopCount = 0, this._setEndings(!0, !0, !1));
			handle_stop: {
				if (r >= t) r = t;
				else if (r < 0) r = 0;
				else {
					this.time = r;
					break handle_stop;
				}
				this.clampWhenFinished ? this.paused = !0 : this.enabled = !1, this.time = r, this._mixer.dispatchEvent({
					type: "finished",
					action: this,
					direction: e < 0 ? -1 : 1
				});
			}
		} else {
			if (i === -1 && (e >= 0 ? (i = 0, this._setEndings(!0, this.repetitions === 0, a)) : this._setEndings(this.repetitions === 0, !0, a)), r >= t || r < 0) {
				let n = Math.floor(r / t);
				r -= t * n, i += Math.abs(n);
				let o = this.repetitions - i;
				if (o <= 0) this.clampWhenFinished ? this.paused = !0 : this.enabled = !1, r = e > 0 ? t : 0, this.time = r, this._mixer.dispatchEvent({
					type: "finished",
					action: this,
					direction: e > 0 ? 1 : -1
				});
				else {
					if (o === 1) {
						let t = e < 0;
						this._setEndings(t, !t, a);
					} else this._setEndings(!1, !1, a);
					this._loopCount = i, this.time = r, this._mixer.dispatchEvent({
						type: "loop",
						action: this,
						loopDelta: n
					});
				}
			} else this._loopCount = i, this.time = r;
			if (a && (i & 1) == 1) return t - r;
		}
		return r;
	}
	_setEndings(e, t, n) {
		let r = this._interpolantSettings;
		n ? (r.endingStart = bn, r.endingEnd = bn) : (e ? r.endingStart = this.zeroSlopeAtStart ? bn : yn : r.endingStart = xn, t ? r.endingEnd = this.zeroSlopeAtEnd ? bn : yn : r.endingEnd = xn);
	}
	_scheduleFading(e, t, n) {
		let r = this._mixer, i = r.time, a = this._weightInterpolant;
		a === null && (a = r._lendControlInterpolant(), this._weightInterpolant = a);
		let o = a.parameterPositions, s = a.sampleValues;
		return o[0] = i, s[0] = t, o[1] = i + e, s[1] = n, this;
	}
}, Uf = /* @__PURE__ */ new Float32Array(1), Wf = class extends gr {
	constructor(e) {
		super(), this._root = e, this._initMemoryManager(), this._accuIndex = 0, this.time = 0, this.timeScale = 1, typeof __THREE_DEVTOOLS__ < "u" && __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", { detail: this }));
	}
	_bindAction(e, t) {
		let n = e._localRoot || this._root, r = e._clip.tracks, i = r.length, a = e._propertyBindings, o = e._interpolants, s = n.uuid, c = this._bindingsByRootAndName, l = c[s];
		l === void 0 && (l = {}, c[s] = l);
		for (let e = 0; e !== i; ++e) {
			let i = r[e], c = i.name, u = l[c];
			if (u !== void 0) ++u.referenceCount, a[e] = u;
			else {
				if (u = a[e], u !== void 0) {
					u._cacheIndex === null && (++u.referenceCount, this._addInactiveBinding(u, s, c));
					continue;
				}
				let r = t && t._propertyBindings[e].binding.parsedPath;
				u = new Of(Bf.create(n, c, r), i.ValueTypeName, i.getValueSize()), ++u.referenceCount, this._addInactiveBinding(u, s, c), a[e] = u;
			}
			o[e].resultBuffer = u.buffer;
		}
	}
	_activateAction(e) {
		if (!this._isActiveAction(e)) {
			if (e._cacheIndex === null) {
				let t = (e._localRoot || this._root).uuid, n = e._clip.uuid, r = this._actionsByClip[n];
				this._bindAction(e, r && r.knownActions[0]), this._addInactiveAction(e, n, t);
			}
			let t = e._propertyBindings;
			for (let e = 0, n = t.length; e !== n; ++e) {
				let n = t[e];
				n.useCount++ === 0 && (this._lendBinding(n), n.saveOriginalState());
			}
			this._lendAction(e);
		}
	}
	_deactivateAction(e) {
		if (this._isActiveAction(e)) {
			let t = e._propertyBindings;
			for (let e = 0, n = t.length; e !== n; ++e) {
				let n = t[e];
				--n.useCount === 0 && (n.restoreOriginalState(), this._takeBackBinding(n));
			}
			this._takeBackAction(e);
		}
	}
	_initMemoryManager() {
		this._actions = [], this._nActiveActions = 0, this._actionsByClip = {}, this._bindings = [], this._nActiveBindings = 0, this._bindingsByRootAndName = {}, this._controlInterpolants = [], this._nActiveControlInterpolants = 0;
		let e = this;
		this.stats = {
			actions: {
				get total() {
					return e._actions.length;
				},
				get inUse() {
					return e._nActiveActions;
				}
			},
			bindings: {
				get total() {
					return e._bindings.length;
				},
				get inUse() {
					return e._nActiveBindings;
				}
			},
			controlInterpolants: {
				get total() {
					return e._controlInterpolants.length;
				},
				get inUse() {
					return e._nActiveControlInterpolants;
				}
			}
		};
	}
	_isActiveAction(e) {
		let t = e._cacheIndex;
		return t !== null && t < this._nActiveActions;
	}
	_addInactiveAction(e, t, n) {
		let r = this._actions, i = this._actionsByClip, a = i[t];
		if (a === void 0) a = {
			knownActions: [e],
			actionByRoot: {}
		}, e._byClipCacheIndex = 0, i[t] = a;
		else {
			let t = a.knownActions;
			e._byClipCacheIndex = t.length, t.push(e);
		}
		e._cacheIndex = r.length, r.push(e), a.actionByRoot[n] = e;
	}
	_removeInactiveAction(e) {
		let t = this._actions, n = t[t.length - 1], r = e._cacheIndex;
		n._cacheIndex = r, t[r] = n, t.pop(), e._cacheIndex = null;
		let i = e._clip.uuid, a = this._actionsByClip, o = a[i], s = o.knownActions, c = s[s.length - 1], l = e._byClipCacheIndex;
		c._byClipCacheIndex = l, s[l] = c, s.pop(), e._byClipCacheIndex = null;
		let u = o.actionByRoot, d = (e._localRoot || this._root).uuid;
		delete u[d], s.length === 0 && delete a[i], this._removeInactiveBindingsForAction(e);
	}
	_removeInactiveBindingsForAction(e) {
		let t = e._propertyBindings;
		for (let e = 0, n = t.length; e !== n; ++e) {
			let n = t[e];
			--n.referenceCount === 0 && this._removeInactiveBinding(n);
		}
	}
	_lendAction(e) {
		let t = this._actions, n = e._cacheIndex, r = this._nActiveActions++, i = t[r];
		e._cacheIndex = r, t[r] = e, i._cacheIndex = n, t[n] = i;
	}
	_takeBackAction(e) {
		let t = this._actions, n = e._cacheIndex, r = --this._nActiveActions, i = t[r];
		e._cacheIndex = r, t[r] = e, i._cacheIndex = n, t[n] = i;
	}
	_addInactiveBinding(e, t, n) {
		let r = this._bindingsByRootAndName, i = this._bindings, a = r[t];
		a === void 0 && (a = {}, r[t] = a), a[n] = e, e._cacheIndex = i.length, i.push(e);
	}
	_removeInactiveBinding(e) {
		let t = this._bindings, n = e.binding, r = n.rootNode.uuid, i = n.path, a = this._bindingsByRootAndName, o = a[r], s = t[t.length - 1], c = e._cacheIndex;
		s._cacheIndex = c, t[c] = s, t.pop(), delete o[i], Object.keys(o).length === 0 && delete a[r];
	}
	_lendBinding(e) {
		let t = this._bindings, n = e._cacheIndex, r = this._nActiveBindings++, i = t[r];
		e._cacheIndex = r, t[r] = e, i._cacheIndex = n, t[n] = i;
	}
	_takeBackBinding(e) {
		let t = this._bindings, n = e._cacheIndex, r = --this._nActiveBindings, i = t[r];
		e._cacheIndex = r, t[r] = e, i._cacheIndex = n, t[n] = i;
	}
	_lendControlInterpolant() {
		let e = this._controlInterpolants, t = this._nActiveControlInterpolants++, n = e[t];
		return n === void 0 && (n = new Uu(/* @__PURE__ */ new Float32Array(2), /* @__PURE__ */ new Float32Array(2), 1, Uf), n.__cacheIndex = t, e[t] = n), n;
	}
	_takeBackControlInterpolant(e) {
		let t = this._controlInterpolants, n = e.__cacheIndex, r = --this._nActiveControlInterpolants, i = t[r];
		e.__cacheIndex = r, t[r] = e, i.__cacheIndex = n, t[n] = i;
	}
	clipAction(e, t, n) {
		let r = t || this._root, i = r.uuid, a = typeof e == "string" ? ed.findByName(r, e) : e, o = a === null ? e : a.uuid, s = this._actionsByClip[o], c = null;
		if (n === void 0 && (n = a === null ? Sn : a.blendMode), s !== void 0) {
			let e = s.actionByRoot[i];
			if (e !== void 0 && e.blendMode === n) return e;
			c = s.knownActions[0], a === null && (a = c._clip);
		}
		if (a === null) return null;
		let l = new Hf(this, a, t, n);
		return this._bindAction(l, c), this._addInactiveAction(l, o, i), l;
	}
	existingAction(e, t) {
		let n = t || this._root, r = n.uuid, i = typeof e == "string" ? ed.findByName(n, e) : e, a = i ? i.uuid : e, o = this._actionsByClip[a];
		return o === void 0 ? null : o.actionByRoot[r] || null;
	}
	stopAllAction() {
		let e = this._actions, t = this._nActiveActions;
		for (let n = t - 1; n >= 0; --n) e[n].stop();
		return this;
	}
	update(e) {
		e *= this.timeScale;
		let t = this._actions, n = this._nActiveActions, r = this.time += e, i = Math.sign(e), a = this._accuIndex ^= 1;
		for (let o = 0; o !== n; ++o) t[o]._update(r, e, i, a);
		let o = this._bindings, s = this._nActiveBindings;
		for (let e = 0; e !== s; ++e) o[e].apply(a);
		return this;
	}
	setTime(e) {
		this.time = 0;
		for (let e = 0; e < this._actions.length; e++) this._actions[e].time = 0;
		return this.update(e);
	}
	getRoot() {
		return this._root;
	}
	uncacheClip(e) {
		let t = this._actions, n = e.uuid, r = this._actionsByClip, i = r[n];
		if (i !== void 0) {
			let e = i.knownActions;
			for (let n = 0, r = e.length; n !== r; ++n) {
				let r = e[n];
				this._deactivateAction(r);
				let i = r._cacheIndex, a = t[t.length - 1];
				r._cacheIndex = null, r._byClipCacheIndex = null, a._cacheIndex = i, t[i] = a, t.pop(), this._removeInactiveBindingsForAction(r);
			}
			delete r[n];
		}
	}
	uncacheRoot(e) {
		let t = e.uuid, n = this._actionsByClip;
		for (let e in n) {
			let r = n[e].actionByRoot[t];
			r !== void 0 && (this._deactivateAction(r), this._removeInactiveAction(r));
		}
		let r = this._bindingsByRootAndName[t];
		if (r !== void 0) for (let e in r) {
			let t = r[e];
			t.restoreOriginalState(), this._removeInactiveBinding(t);
		}
	}
	uncacheAction(e, t) {
		let n = this.existingAction(e, t);
		n !== null && (this._deactivateAction(n), this._removeInactiveAction(n));
	}
}, Gf = class extends oi {
	constructor(e = 1, t = 1, n = 1, r = {}) {
		super(e, t, r), this.isRenderTarget3D = !0, this.depth = n, this.texture = new ui(null, e, t, n), this._setTextureOptions(r), this.texture.isRenderTargetTexture = !0;
	}
}, Kf = class e {
	constructor(e) {
		this.value = e;
	}
	clone() {
		return new e(this.value.clone === void 0 ? this.value : this.value.clone());
	}
}, qf = 0, Jf = class extends gr {
	constructor() {
		super(), this.isUniformsGroup = !0, Object.defineProperty(this, "id", { value: qf++ }), this.name = "", this.usage = zn, this.uniforms = [];
	}
	add(e) {
		return this.uniforms.push(e), this;
	}
	remove(e) {
		let t = this.uniforms.indexOf(e);
		return t !== -1 && this.uniforms.splice(t, 1), this;
	}
	setName(e) {
		return this.name = e, this;
	}
	setUsage(e) {
		return this.usage = e, this;
	}
	dispose() {
		this.dispatchEvent({ type: "dispose" });
	}
	copy(e) {
		this.name = e.name, this.usage = e.usage;
		let t = e.uniforms;
		this.uniforms.length = 0;
		for (let e = 0, n = t.length; e < n; e++) {
			let n = Array.isArray(t[e]) ? t[e] : [t[e]];
			for (let e = 0; e < n.length; e++) this.uniforms.push(n[e].clone());
		}
		return this;
	}
	clone() {
		return new this.constructor().copy(this);
	}
}, Yf = class extends Za {
	constructor(e, t, n = 1) {
		super(e, t), this.isInstancedInterleavedBuffer = !0, this.meshPerAttribute = n;
	}
	copy(e) {
		return super.copy(e), this.meshPerAttribute = e.meshPerAttribute, this;
	}
	clone(e) {
		let t = super.clone(e);
		return t.meshPerAttribute = this.meshPerAttribute, t;
	}
	toJSON(e) {
		let t = super.toJSON(e);
		return t.isInstancedInterleavedBuffer = !0, t.meshPerAttribute = this.meshPerAttribute, t;
	}
}, Xf = class {
	constructor(e, t, n, r, i, a = !1) {
		this.isGLBufferAttribute = !0, this.name = "", this.buffer = e, this.type = t, this.itemSize = n, this.elementSize = r, this.count = i, this.normalized = a, this.version = 0;
	}
	set needsUpdate(e) {
		e === !0 && this.version++;
	}
	setBuffer(e) {
		return this.buffer = e, this;
	}
	setType(e, t) {
		return this.type = e, this.elementSize = t, this;
	}
	setItemSize(e) {
		return this.itemSize = e, this;
	}
	setCount(e) {
		return this.count = e, this;
	}
}, Zf = /*@__PURE__*/ new K(), Qf = class {
	constructor(e, t, n = 0, r = Infinity) {
		this.ray = new ko(e, t), this.near = n, this.far = r, this.camera = null, this.layers = new Si(), this.params = {
			Mesh: {},
			Line: { threshold: 1 },
			LOD: {},
			Points: { threshold: 1 },
			Sprite: {}
		};
	}
	set(e, t) {
		this.ray.set(e, t);
	}
	setFromCamera(e, t) {
		t.isPerspectiveCamera ? (this.ray.origin.setFromMatrixPosition(t.matrixWorld), this.ray.direction.set(e.x, e.y, .5).unproject(t).sub(this.ray.origin).normalize(), this.camera = t) : t.isOrthographicCamera ? (this.ray.origin.set(e.x, e.y, t.projectionMatrix.elements[14]).unproject(t), this.ray.direction.set(0, 0, -1).transformDirection(t.matrixWorld), this.camera = t) : z("Raycaster: Unsupported camera type: " + t.type);
	}
	setFromXRController(e) {
		return Zf.identity().extractRotation(e.matrixWorld), this.ray.origin.setFromMatrixPosition(e.matrixWorld), this.ray.direction.set(0, 0, -1).applyMatrix4(Zf), this;
	}
	intersectObject(e, t = !0, n = []) {
		return ep(e, this, n, t), n.sort($f), n;
	}
	intersectObjects(e, t = !0, n = []) {
		for (let r = 0, i = e.length; r < i; r++) ep(e[r], this, n, t);
		return n.sort($f), n;
	}
};
function $f(e, t) {
	return e.distance - t.distance;
}
function ep(e, t, n, r) {
	let i = !0;
	if (e.layers.test(t.layers) && e.raycast(t, n) === !1 && (i = !1), i === !0 && r === !0) {
		let r = e.children;
		for (let e = 0, i = r.length; e < i; e++) ep(r[e], t, n, !0);
	}
}
var tp = class {
	constructor(e = !0) {
		this.autoStart = e, this.startTime = 0, this.oldTime = 0, this.elapsedTime = 0, this.running = !1, R("Clock: This module has been deprecated. Please use THREE.Timer instead.");
	}
	start() {
		this.startTime = performance.now(), this.oldTime = this.startTime, this.elapsedTime = 0, this.running = !0;
	}
	stop() {
		this.getElapsedTime(), this.running = !1, this.autoStart = !1;
	}
	getElapsedTime() {
		return this.getDelta(), this.elapsedTime;
	}
	getDelta() {
		let e = 0;
		if (this.autoStart && !this.running) return this.start(), 0;
		if (this.running) {
			let t = performance.now();
			e = (t - this.oldTime) / 1e3, this.oldTime = t, this.elapsedTime += e;
		}
		return e;
	}
}, np = class {
	constructor(e = 1, t = 0, n = 0) {
		this.radius = e, this.phi = t, this.theta = n;
	}
	set(e, t, n) {
		return this.radius = e, this.phi = t, this.theta = n, this;
	}
	copy(e) {
		return this.radius = e.radius, this.phi = e.phi, this.theta = e.theta, this;
	}
	makeSafe() {
		let e = 1e-6;
		return this.phi = B(this.phi, e, Math.PI - e), this;
	}
	setFromVector3(e) {
		return this.setFromCartesianCoords(e.x, e.y, e.z);
	}
	setFromCartesianCoords(e, t, n) {
		return this.radius = Math.sqrt(e * e + t * t + n * n), this.radius === 0 ? (this.theta = 0, this.phi = 0) : (this.theta = Math.atan2(e, n), this.phi = Math.acos(B(t / this.radius, -1, 1))), this;
	}
	clone() {
		return new this.constructor().copy(this);
	}
}, rp = class {
	constructor(e = 1, t = 0, n = 0) {
		this.radius = e, this.theta = t, this.y = n;
	}
	set(e, t, n) {
		return this.radius = e, this.theta = t, this.y = n, this;
	}
	copy(e) {
		return this.radius = e.radius, this.theta = e.theta, this.y = e.y, this;
	}
	setFromVector3(e) {
		return this.setFromCartesianCoords(e.x, e.y, e.z);
	}
	setFromCartesianCoords(e, t, n) {
		return this.radius = Math.sqrt(e * e + n * n), this.theta = Math.atan2(e, n), this.y = t, this;
	}
	clone() {
		return new this.constructor().copy(this);
	}
}, ip = class e {
	static {
		e.prototype.isMatrix2 = !0;
	}
	constructor(e, t, n, r) {
		this.elements = [
			1,
			0,
			0,
			1
		], e !== void 0 && this.set(e, t, n, r);
	}
	identity() {
		return this.set(1, 0, 0, 1), this;
	}
	fromArray(e, t = 0) {
		for (let n = 0; n < 4; n++) this.elements[n] = e[n + t];
		return this;
	}
	set(e, t, n, r) {
		let i = this.elements;
		return i[0] = e, i[2] = t, i[1] = n, i[3] = r, this;
	}
}, ap = /*@__PURE__*/ new H(), op = class {
	constructor(e = new H(Infinity, Infinity), t = new H(-Infinity, -Infinity)) {
		this.isBox2 = !0, this.min = e, this.max = t;
	}
	set(e, t) {
		return this.min.copy(e), this.max.copy(t), this;
	}
	setFromPoints(e) {
		this.makeEmpty();
		for (let t = 0, n = e.length; t < n; t++) this.expandByPoint(e[t]);
		return this;
	}
	setFromCenterAndSize(e, t) {
		let n = ap.copy(t).multiplyScalar(.5);
		return this.min.copy(e).sub(n), this.max.copy(e).add(n), this;
	}
	clone() {
		return new this.constructor().copy(this);
	}
	copy(e) {
		return this.min.copy(e.min), this.max.copy(e.max), this;
	}
	makeEmpty() {
		return this.min.x = this.min.y = Infinity, this.max.x = this.max.y = -Infinity, this;
	}
	isEmpty() {
		return this.max.x < this.min.x || this.max.y < this.min.y;
	}
	getCenter(e) {
		return this.isEmpty() ? e.set(0, 0) : e.addVectors(this.min, this.max).multiplyScalar(.5);
	}
	getSize(e) {
		return this.isEmpty() ? e.set(0, 0) : e.subVectors(this.max, this.min);
	}
	expandByPoint(e) {
		return this.min.min(e), this.max.max(e), this;
	}
	expandByVector(e) {
		return this.min.sub(e), this.max.add(e), this;
	}
	expandByScalar(e) {
		return this.min.addScalar(-e), this.max.addScalar(e), this;
	}
	containsPoint(e) {
		return e.x >= this.min.x && e.x <= this.max.x && e.y >= this.min.y && e.y <= this.max.y;
	}
	containsBox(e) {
		return this.min.x <= e.min.x && e.max.x <= this.max.x && this.min.y <= e.min.y && e.max.y <= this.max.y;
	}
	getParameter(e, t) {
		return t.set((e.x - this.min.x) / (this.max.x - this.min.x), (e.y - this.min.y) / (this.max.y - this.min.y));
	}
	intersectsBox(e) {
		return e.max.x >= this.min.x && e.min.x <= this.max.x && e.max.y >= this.min.y && e.min.y <= this.max.y;
	}
	clampPoint(e, t) {
		return t.copy(e).clamp(this.min, this.max);
	}
	distanceToPoint(e) {
		return this.clampPoint(e, ap).distanceTo(e);
	}
	intersect(e) {
		return this.min.max(e.min), this.max.min(e.max), this.isEmpty() && this.makeEmpty(), this;
	}
	union(e) {
		return this.min.min(e.min), this.max.max(e.max), this;
	}
	translate(e) {
		return this.min.add(e), this.max.add(e), this;
	}
	equals(e) {
		return e.min.equals(this.min) && e.max.equals(this.max);
	}
}, sp = /*@__PURE__*/ new U(), cp = /*@__PURE__*/ new U(), lp = /*@__PURE__*/ new U(), up = /*@__PURE__*/ new U(), dp = /*@__PURE__*/ new U(), fp = /*@__PURE__*/ new U(), pp = /*@__PURE__*/ new U(), mp = class {
	constructor(e = new U(), t = new U()) {
		this.start = e, this.end = t;
	}
	set(e, t) {
		return this.start.copy(e), this.end.copy(t), this;
	}
	copy(e) {
		return this.start.copy(e.start), this.end.copy(e.end), this;
	}
	getCenter(e) {
		return e.addVectors(this.start, this.end).multiplyScalar(.5);
	}
	delta(e) {
		return e.subVectors(this.end, this.start);
	}
	distanceSq() {
		return this.start.distanceToSquared(this.end);
	}
	distance() {
		return this.start.distanceTo(this.end);
	}
	at(e, t) {
		return this.delta(t).multiplyScalar(e).add(this.start);
	}
	closestPointToPointParameter(e, t) {
		sp.subVectors(e, this.start), cp.subVectors(this.end, this.start);
		let n = cp.dot(cp);
		if (n === 0) return 0;
		let r = cp.dot(sp) / n;
		return t && (r = B(r, 0, 1)), r;
	}
	closestPointToPoint(e, t, n) {
		let r = this.closestPointToPointParameter(e, t);
		return this.delta(n).multiplyScalar(r).add(this.start);
	}
	distanceSqToLine3(e, t = fp, n = pp) {
		let r = 1e-8 * 1e-8, i, a, o = this.start, s = e.start, c = this.end, l = e.end;
		lp.subVectors(c, o), up.subVectors(l, s), dp.subVectors(o, s);
		let u = lp.dot(lp), d = up.dot(up), f = up.dot(dp);
		if (u <= r && d <= r) return t.copy(o), n.copy(s), t.sub(n), t.dot(t);
		if (u <= r) i = 0, a = f / d, a = B(a, 0, 1);
		else {
			let e = lp.dot(dp);
			if (d <= r) a = 0, i = B(-e / u, 0, 1);
			else {
				let t = lp.dot(up), n = u * d - t * t;
				i = n === 0 ? 0 : B((t * f - e * d) / n, 0, 1), a = (t * i + f) / d, a < 0 ? (a = 0, i = B(-e / u, 0, 1)) : a > 1 && (a = 1, i = B((t - e) / u, 0, 1));
			}
		}
		return t.copy(o).addScaledVector(lp, i), n.copy(s).addScaledVector(up, a), t.distanceToSquared(n);
	}
	applyMatrix4(e) {
		return this.start.applyMatrix4(e), this.end.applyMatrix4(e), this;
	}
	equals(e) {
		return e.start.equals(this.start) && e.end.equals(this.end);
	}
	clone() {
		return new this.constructor().copy(this);
	}
}, hp = /*@__PURE__*/ new U(), gp = class extends q {
	constructor(e, t) {
		super(), this.light = e, this.matrixAutoUpdate = !1, this.color = t, this.type = "SpotLightHelper";
		let n = new Z(), r = [
			0,
			0,
			0,
			0,
			0,
			1,
			0,
			0,
			0,
			1,
			0,
			1,
			0,
			0,
			0,
			-1,
			0,
			1,
			0,
			0,
			0,
			0,
			1,
			1,
			0,
			0,
			0,
			0,
			-1,
			1
		];
		for (let e = 0, t = 1; e < 32; e++, t++) {
			let n = e / 32 * Math.PI * 2, i = t / 32 * Math.PI * 2;
			r.push(Math.cos(n), Math.sin(n), 1, Math.cos(i), Math.sin(i), 1);
		}
		n.setAttribute("position", new X(r, 3));
		let i = new Ws({
			fog: !1,
			toneMapped: !1
		});
		this.cone = new nc(n, i), this.add(this.cone), this.update();
	}
	dispose() {
		this.cone.geometry.dispose(), this.cone.material.dispose();
	}
	update() {
		this.light.updateWorldMatrix(!0, !1), this.light.target.updateWorldMatrix(!0, !1), this.parent ? (this.parent.updateWorldMatrix(!0), this.matrix.copy(this.parent.matrixWorld).invert().multiply(this.light.matrixWorld)) : this.matrix.copy(this.light.matrixWorld), this.matrixWorldNeedsUpdate = !0;
		let e = this.light.distance ? this.light.distance : 1e3, t = e * Math.tan(this.light.angle);
		this.cone.scale.set(t, t, e), hp.setFromMatrixPosition(this.light.target.matrixWorld), this.cone.lookAt(hp), this.color === void 0 ? this.cone.material.color.copy(this.light.color) : this.cone.material.color.set(this.color);
	}
}, _p = /*@__PURE__*/ new U(), vp = /*@__PURE__*/ new K(), yp = /*@__PURE__*/ new K(), bp = class extends nc {
	constructor(e) {
		let t = xp(e), n = new Z(), r = [], i = [];
		for (let e = 0; e < t.length; e++) {
			let n = t[e];
			n.parent && n.parent.isBone && (r.push(0, 0, 0), r.push(0, 0, 0), i.push(0, 0, 0), i.push(0, 0, 0));
		}
		n.setAttribute("position", new X(r, 3)), n.setAttribute("color", new X(i, 3));
		let a = new Ws({
			vertexColors: !0,
			depthTest: !1,
			depthWrite: !1,
			toneMapped: !1,
			transparent: !0
		});
		super(n, a), this.isSkeletonHelper = !0, this.type = "SkeletonHelper", this.root = e, this.bones = t, this.matrix = e.matrixWorld, this.matrixAutoUpdate = !1;
		let o = new J(255), s = new J(65280);
		this.setColors(o, s);
	}
	updateMatrixWorld(e) {
		let t = this.bones, n = this.geometry, r = n.getAttribute("position");
		yp.copy(this.root.matrixWorld).invert();
		for (let e = 0, n = 0; e < t.length; e++) {
			let i = t[e];
			i.parent && i.parent.isBone && (vp.multiplyMatrices(yp, i.matrixWorld), _p.setFromMatrixPosition(vp), r.setXYZ(n, _p.x, _p.y, _p.z), vp.multiplyMatrices(yp, i.parent.matrixWorld), _p.setFromMatrixPosition(vp), r.setXYZ(n + 1, _p.x, _p.y, _p.z), n += 2);
		}
		n.getAttribute("position").needsUpdate = !0, super.updateMatrixWorld(e);
	}
	setColors(e, t) {
		let n = this.geometry.getAttribute("color");
		for (let r = 0; r < n.count; r += 2) n.setXYZ(r, e.r, e.g, e.b), n.setXYZ(r + 1, t.r, t.g, t.b);
		return n.needsUpdate = !0, this;
	}
	dispose() {
		this.geometry.dispose(), this.material.dispose();
	}
};
function xp(e) {
	let t = [];
	e.isBone === !0 && t.push(e);
	for (let n = 0; n < e.children.length; n++) t.push(...xp(e.children[n]));
	return t;
}
var Sp = class extends Ho {
	constructor(e, t, n) {
		let r = new au(t, 4, 2), i = new Ao({
			wireframe: !0,
			fog: !1,
			toneMapped: !1
		});
		super(r, i), this.light = e, this.color = n, this.type = "PointLightHelper", this.matrix = this.light.matrixWorld, this.matrixAutoUpdate = !1, this.update();
	}
	dispose() {
		this.geometry.dispose(), this.material.dispose();
	}
	update() {
		this.matrixWorldNeedsUpdate = !0, this.light.updateWorldMatrix(!0, !1), this.color === void 0 ? this.material.color.copy(this.light.color) : this.material.color.set(this.color);
	}
}, Cp = /*@__PURE__*/ new U(), wp = /*@__PURE__*/ new J(), Tp = /*@__PURE__*/ new J(), Ep = class extends q {
	constructor(e, t, n) {
		super(), this.light = e, this.matrix = e.matrixWorld, this.matrixAutoUpdate = !1, this.color = n, this.type = "HemisphereLightHelper";
		let r = new eu(t);
		r.rotateY(Math.PI * .5), this.material = new Ao({
			wireframe: !0,
			fog: !1,
			toneMapped: !1
		}), this.color === void 0 && (this.material.vertexColors = !0);
		let i = r.getAttribute("position"), a = new Float32Array(i.count * 3);
		r.setAttribute("color", new Y(a, 3)), this.add(new Ho(r, this.material)), this.update();
	}
	dispose() {
		this.children[0].geometry.dispose(), this.children[0].material.dispose();
	}
	update() {
		let e = this.children[0];
		if (this.color !== void 0) this.material.color.set(this.color);
		else {
			let t = e.geometry.getAttribute("color");
			wp.copy(this.light.color), Tp.copy(this.light.groundColor);
			for (let e = 0, n = t.count; e < n; e++) {
				let r = e < n / 2 ? wp : Tp;
				t.setXYZ(e, r.r, r.g, r.b);
			}
			t.needsUpdate = !0;
		}
		this.matrixWorldNeedsUpdate = !0, this.light.updateWorldMatrix(!0, !1), e.lookAt(Cp.setFromMatrixPosition(this.light.matrixWorld).negate());
	}
}, Dp = class extends nc {
	constructor(e = 10, t = 10, n = 4473924, r = 8947848) {
		n = new J(n), r = new J(r);
		let i = t / 2, a = e / t, o = e / 2, s = [], c = [];
		for (let e = 0, l = 0, u = -o; e <= t; e++, u += a) {
			s.push(-o, 0, u, o, 0, u), s.push(u, 0, -o, u, 0, o);
			let t = e === i ? n : r;
			t.toArray(c, l), l += 3, t.toArray(c, l), l += 3, t.toArray(c, l), l += 3, t.toArray(c, l), l += 3;
		}
		let l = new Z();
		l.setAttribute("position", new X(s, 3)), l.setAttribute("color", new X(c, 3));
		let u = new Ws({
			vertexColors: !0,
			toneMapped: !1
		});
		super(l, u), this.type = "GridHelper";
	}
	dispose() {
		this.geometry.dispose(), this.material.dispose();
	}
}, Op = class extends nc {
	constructor(e = 10, t = 16, n = 8, r = 64, i = 4473924, a = 8947848) {
		i = new J(i), a = new J(a);
		let o = [], s = [];
		if (t > 1) for (let n = 0; n < t; n++) {
			let r = n / t * (Math.PI * 2), c = Math.sin(r) * e, l = Math.cos(r) * e;
			o.push(0, 0, 0), o.push(c, 0, l);
			let u = n & 1 ? i : a;
			s.push(u.r, u.g, u.b), s.push(u.r, u.g, u.b);
		}
		for (let t = 0; t < n; t++) {
			let c = t & 1 ? i : a, l = e - e / n * t;
			for (let e = 0; e < r; e++) {
				let t = e / r * (Math.PI * 2), n = Math.sin(t) * l, i = Math.cos(t) * l;
				o.push(n, 0, i), s.push(c.r, c.g, c.b), t = (e + 1) / r * (Math.PI * 2), n = Math.sin(t) * l, i = Math.cos(t) * l, o.push(n, 0, i), s.push(c.r, c.g, c.b);
			}
		}
		let c = new Z();
		c.setAttribute("position", new X(o, 3)), c.setAttribute("color", new X(s, 3));
		let l = new Ws({
			vertexColors: !0,
			toneMapped: !1
		});
		super(c, l), this.type = "PolarGridHelper";
	}
	dispose() {
		this.geometry.dispose(), this.material.dispose();
	}
}, kp = /*@__PURE__*/ new U(), Ap = /*@__PURE__*/ new U(), jp = /*@__PURE__*/ new U(), Mp = class extends q {
	constructor(e, t, n) {
		super(), this.light = e, this.matrix = e.matrixWorld, this.matrixAutoUpdate = !1, this.color = n, this.type = "DirectionalLightHelper", t === void 0 && (t = 1);
		let r = new Z();
		r.setAttribute("position", new X([
			-t,
			t,
			0,
			t,
			t,
			0,
			t,
			-t,
			0,
			-t,
			-t,
			0,
			-t,
			t,
			0
		], 3));
		let i = new Ws({
			fog: !1,
			toneMapped: !1
		});
		this.lightPlane = new Qs(r, i), this.add(this.lightPlane), r = new Z(), r.setAttribute("position", new X([
			0,
			0,
			0,
			0,
			0,
			1
		], 3)), this.targetLine = new Qs(r, i), this.add(this.targetLine), this.update();
	}
	dispose() {
		this.lightPlane.geometry.dispose(), this.lightPlane.material.dispose(), this.targetLine.geometry.dispose(), this.targetLine.material.dispose();
	}
	update() {
		this.matrixWorldNeedsUpdate = !0, this.light.updateWorldMatrix(!0, !1), this.light.target.updateWorldMatrix(!0, !1), kp.setFromMatrixPosition(this.light.matrixWorld), Ap.setFromMatrixPosition(this.light.target.matrixWorld), jp.subVectors(Ap, kp), this.lightPlane.lookAt(Ap), this.color === void 0 ? (this.lightPlane.material.color.copy(this.light.color), this.targetLine.material.color.copy(this.light.color)) : (this.lightPlane.material.color.set(this.color), this.targetLine.material.color.set(this.color)), this.targetLine.lookAt(Ap), this.targetLine.scale.z = jp.length();
	}
}, Np = /*@__PURE__*/ new U(), Pp = /*@__PURE__*/ new Dd(), Fp = class extends nc {
	constructor(e) {
		let t = new Z(), n = new Ws({
			color: 16777215,
			vertexColors: !0,
			toneMapped: !1
		}), r = [], i = [], a = {};
		o("n1", "n2"), o("n2", "n4"), o("n4", "n3"), o("n3", "n1"), o("f1", "f2"), o("f2", "f4"), o("f4", "f3"), o("f3", "f1"), o("n1", "f1"), o("n2", "f2"), o("n3", "f3"), o("n4", "f4"), o("p", "n1"), o("p", "n2"), o("p", "n3"), o("p", "n4"), o("u1", "u2"), o("u2", "u3"), o("u3", "u1"), o("c", "t"), o("p", "c"), o("cn1", "cn2"), o("cn3", "cn4"), o("cf1", "cf2"), o("cf3", "cf4");
		function o(e, t) {
			s(e), s(t);
		}
		function s(e) {
			r.push(0, 0, 0), i.push(0, 0, 0), a[e] === void 0 && (a[e] = []), a[e].push(r.length / 3 - 1);
		}
		t.setAttribute("position", new X(r, 3)), t.setAttribute("color", new X(i, 3)), super(t, n), this.type = "CameraHelper", this.camera = e, this.camera.updateProjectionMatrix && this.camera.updateProjectionMatrix(), this.matrix = e.matrixWorld, this.matrixAutoUpdate = !1, this.pointMap = a, this.update();
		let c = new J(16755200), l = new J(16711680), u = new J(43775), d = new J(16777215), f = new J(3355443);
		this.setColors(c, l, u, d, f);
	}
	setColors(e, t, n, r, i) {
		let a = this.geometry.getAttribute("color");
		return a.setXYZ(0, e.r, e.g, e.b), a.setXYZ(1, e.r, e.g, e.b), a.setXYZ(2, e.r, e.g, e.b), a.setXYZ(3, e.r, e.g, e.b), a.setXYZ(4, e.r, e.g, e.b), a.setXYZ(5, e.r, e.g, e.b), a.setXYZ(6, e.r, e.g, e.b), a.setXYZ(7, e.r, e.g, e.b), a.setXYZ(8, e.r, e.g, e.b), a.setXYZ(9, e.r, e.g, e.b), a.setXYZ(10, e.r, e.g, e.b), a.setXYZ(11, e.r, e.g, e.b), a.setXYZ(12, e.r, e.g, e.b), a.setXYZ(13, e.r, e.g, e.b), a.setXYZ(14, e.r, e.g, e.b), a.setXYZ(15, e.r, e.g, e.b), a.setXYZ(16, e.r, e.g, e.b), a.setXYZ(17, e.r, e.g, e.b), a.setXYZ(18, e.r, e.g, e.b), a.setXYZ(19, e.r, e.g, e.b), a.setXYZ(20, e.r, e.g, e.b), a.setXYZ(21, e.r, e.g, e.b), a.setXYZ(22, e.r, e.g, e.b), a.setXYZ(23, e.r, e.g, e.b), a.setXYZ(24, t.r, t.g, t.b), a.setXYZ(25, t.r, t.g, t.b), a.setXYZ(26, t.r, t.g, t.b), a.setXYZ(27, t.r, t.g, t.b), a.setXYZ(28, t.r, t.g, t.b), a.setXYZ(29, t.r, t.g, t.b), a.setXYZ(30, t.r, t.g, t.b), a.setXYZ(31, t.r, t.g, t.b), a.setXYZ(32, n.r, n.g, n.b), a.setXYZ(33, n.r, n.g, n.b), a.setXYZ(34, n.r, n.g, n.b), a.setXYZ(35, n.r, n.g, n.b), a.setXYZ(36, n.r, n.g, n.b), a.setXYZ(37, n.r, n.g, n.b), a.setXYZ(38, r.r, r.g, r.b), a.setXYZ(39, r.r, r.g, r.b), a.setXYZ(40, i.r, i.g, i.b), a.setXYZ(41, i.r, i.g, i.b), a.setXYZ(42, i.r, i.g, i.b), a.setXYZ(43, i.r, i.g, i.b), a.setXYZ(44, i.r, i.g, i.b), a.setXYZ(45, i.r, i.g, i.b), a.setXYZ(46, i.r, i.g, i.b), a.setXYZ(47, i.r, i.g, i.b), a.setXYZ(48, i.r, i.g, i.b), a.setXYZ(49, i.r, i.g, i.b), a.needsUpdate = !0, this;
	}
	update() {
		let e = this.geometry, t = this.pointMap, n, r;
		if (Pp.projectionMatrixInverse.copy(this.camera.projectionMatrixInverse), this.camera.reversedDepth === !0) n = 1, r = 0;
		else if (this.camera.coordinateSystem === 2e3) n = -1, r = 1;
		else if (this.camera.coordinateSystem === 2001) n = 0, r = 1;
		else throw Error("THREE.CameraHelper.update(): Invalid coordinate system: " + this.camera.coordinateSystem);
		Ip("c", t, e, Pp, 0, 0, n), Ip("t", t, e, Pp, 0, 0, r), Ip("n1", t, e, Pp, -1, -1, n), Ip("n2", t, e, Pp, 1, -1, n), Ip("n3", t, e, Pp, -1, 1, n), Ip("n4", t, e, Pp, 1, 1, n), Ip("f1", t, e, Pp, -1, -1, r), Ip("f2", t, e, Pp, 1, -1, r), Ip("f3", t, e, Pp, -1, 1, r), Ip("f4", t, e, Pp, 1, 1, r), Ip("u1", t, e, Pp, 1 * .7, 1 * 1.1, n), Ip("u2", t, e, Pp, -1 * .7, 1 * 1.1, n), Ip("u3", t, e, Pp, 0, 2, n), Ip("cf1", t, e, Pp, -1, 0, r), Ip("cf2", t, e, Pp, 1, 0, r), Ip("cf3", t, e, Pp, 0, -1, r), Ip("cf4", t, e, Pp, 0, 1, r), Ip("cn1", t, e, Pp, -1, 0, n), Ip("cn2", t, e, Pp, 1, 0, n), Ip("cn3", t, e, Pp, 0, -1, n), Ip("cn4", t, e, Pp, 0, 1, n), e.getAttribute("position").needsUpdate = !0;
	}
	dispose() {
		this.geometry.dispose(), this.material.dispose();
	}
};
function Ip(e, t, n, r, i, a, o) {
	Np.set(i, a, o).unproject(r);
	let s = t[e];
	if (s !== void 0) {
		let e = n.getAttribute("position");
		for (let t = 0, n = s.length; t < n; t++) e.setXYZ(s[t], Np.x, Np.y, Np.z);
	}
}
var Lp = /*@__PURE__*/ new la(), Rp = class extends nc {
	constructor(e, t = 16776960) {
		let n = new Uint16Array([
			0,
			1,
			1,
			2,
			2,
			3,
			3,
			0,
			4,
			5,
			5,
			6,
			6,
			7,
			7,
			4,
			0,
			4,
			1,
			5,
			2,
			6,
			3,
			7
		]), r = /* @__PURE__ */ new Float32Array(24), i = new Z();
		i.setIndex(new Y(n, 1)), i.setAttribute("position", new Y(r, 3)), super(i, new Ws({
			color: t,
			toneMapped: !1
		})), this.object = e, this.type = "BoxHelper", this.matrixAutoUpdate = !1, this.update();
	}
	update() {
		if (this.object !== void 0 && Lp.setFromObject(this.object), Lp.isEmpty()) return;
		let e = Lp.min, t = Lp.max, n = this.geometry.attributes.position, r = n.array;
		r[0] = t.x, r[1] = t.y, r[2] = t.z, r[3] = e.x, r[4] = t.y, r[5] = t.z, r[6] = e.x, r[7] = e.y, r[8] = t.z, r[9] = t.x, r[10] = e.y, r[11] = t.z, r[12] = t.x, r[13] = t.y, r[14] = e.z, r[15] = e.x, r[16] = t.y, r[17] = e.z, r[18] = e.x, r[19] = e.y, r[20] = e.z, r[21] = t.x, r[22] = e.y, r[23] = e.z, n.needsUpdate = !0, this.geometry.computeBoundingSphere();
	}
	setFromObject(e) {
		return this.object = e, this.update(), this;
	}
	copy(e, t) {
		return super.copy(e, t), this.object = e.object, this;
	}
	dispose() {
		this.geometry.dispose(), this.material.dispose();
	}
}, zp = class extends nc {
	constructor(e, t = 16776960) {
		let n = new Uint16Array([
			0,
			1,
			1,
			2,
			2,
			3,
			3,
			0,
			4,
			5,
			5,
			6,
			6,
			7,
			7,
			4,
			0,
			4,
			1,
			5,
			2,
			6,
			3,
			7
		]), r = [
			1,
			1,
			1,
			-1,
			1,
			1,
			-1,
			-1,
			1,
			1,
			-1,
			1,
			1,
			1,
			-1,
			-1,
			1,
			-1,
			-1,
			-1,
			-1,
			1,
			-1,
			-1
		], i = new Z();
		i.setIndex(new Y(n, 1)), i.setAttribute("position", new X(r, 3)), super(i, new Ws({
			color: t,
			toneMapped: !1
		})), this.box = e, this.type = "Box3Helper", this.geometry.computeBoundingSphere();
	}
	updateMatrixWorld(e) {
		let t = this.box;
		t.isEmpty() || (t.getCenter(this.position), t.getSize(this.scale), this.scale.multiplyScalar(.5), super.updateMatrixWorld(e));
	}
	dispose() {
		this.geometry.dispose(), this.material.dispose();
	}
}, Bp = class extends Qs {
	constructor(e, t = 1, n = 16776960) {
		let r = n, i = [
			1,
			-1,
			0,
			-1,
			1,
			0,
			-1,
			-1,
			0,
			1,
			1,
			0,
			-1,
			1,
			0,
			-1,
			-1,
			0,
			1,
			-1,
			0,
			1,
			1,
			0
		], a = new Z();
		a.setAttribute("position", new X(i, 3)), a.computeBoundingSphere(), super(a, new Ws({
			color: r,
			toneMapped: !1
		})), this.type = "PlaneHelper", this.plane = e, this.size = t;
		let o = [
			1,
			1,
			0,
			-1,
			1,
			0,
			-1,
			-1,
			0,
			1,
			1,
			0,
			-1,
			-1,
			0,
			1,
			-1,
			0
		], s = new Z();
		s.setAttribute("position", new X(o, 3)), s.computeBoundingSphere(), this.add(new Ho(s, new Ao({
			color: r,
			opacity: .2,
			transparent: !0,
			depthWrite: !1,
			toneMapped: !1
		})));
	}
	updateMatrixWorld(e) {
		this.position.set(0, 0, 0), this.scale.set(.5 * this.size, .5 * this.size, 1), this.lookAt(this.plane.normal), this.translateZ(-this.plane.constant), super.updateMatrixWorld(e);
	}
	dispose() {
		this.geometry.dispose(), this.material.dispose(), this.children[0].geometry.dispose(), this.children[0].material.dispose();
	}
}, Vp = /*@__PURE__*/ new U(), Hp, Up, Wp = class extends q {
	constructor(e = new U(0, 0, 1), t = new U(0, 0, 0), n = 1, r = 16776960, i = n * .2, a = i * .2) {
		super(), this.type = "ArrowHelper", Hp === void 0 && (Hp = new Z(), Hp.setAttribute("position", new X([
			0,
			0,
			0,
			0,
			1,
			0
		], 3)), Up = new Dc(.5, 1, 5, 1), Up.translate(0, -.5, 0)), this.position.copy(t), this.line = new Qs(Hp, new Ws({
			color: r,
			toneMapped: !1
		})), this.line.matrixAutoUpdate = !1, this.add(this.line), this.cone = new Ho(Up, new Ao({
			color: r,
			toneMapped: !1
		})), this.cone.matrixAutoUpdate = !1, this.add(this.cone), this.setDirection(e), this.setLength(n, i, a);
	}
	setDirection(e) {
		if (e.y > .99999) this.quaternion.set(0, 0, 0, 1);
		else if (e.y < -.99999) this.quaternion.set(1, 0, 0, 0);
		else {
			Vp.set(e.z, 0, -e.x).normalize();
			let t = Math.acos(e.y);
			this.quaternion.setFromAxisAngle(Vp, t);
		}
	}
	setLength(e, t = e * .2, n = t * .2) {
		this.line.scale.set(1, Math.max(1e-4, e - t), 1), this.line.updateMatrix(), this.cone.scale.set(n, t, n), this.cone.position.y = e, this.cone.updateMatrix();
	}
	setColor(e) {
		this.line.material.color.set(e), this.cone.material.color.set(e);
	}
	copy(e) {
		return super.copy(e, !1), this.line.copy(e.line), this.cone.copy(e.cone), this;
	}
	dispose() {
		this.line.geometry.dispose(), this.line.material.dispose(), this.cone.geometry.dispose(), this.cone.material.dispose();
	}
}, Gp = class extends nc {
	constructor(e = 1) {
		let t = [
			0,
			0,
			0,
			e,
			0,
			0,
			0,
			0,
			0,
			0,
			e,
			0,
			0,
			0,
			0,
			0,
			0,
			e
		], n = [
			1,
			0,
			0,
			1,
			.6,
			0,
			0,
			1,
			0,
			.6,
			1,
			0,
			0,
			0,
			1,
			0,
			.6,
			1
		], r = new Z();
		r.setAttribute("position", new X(t, 3)), r.setAttribute("color", new X(n, 3));
		let i = new Ws({
			vertexColors: !0,
			toneMapped: !1
		});
		super(r, i), this.type = "AxesHelper";
	}
	setColors(e, t, n) {
		let r = new J(), i = this.geometry.attributes.color.array;
		return r.set(e), r.toArray(i, 0), r.toArray(i, 3), r.set(t), r.toArray(i, 6), r.toArray(i, 9), r.set(n), r.toArray(i, 12), r.toArray(i, 15), this.geometry.attributes.color.needsUpdate = !0, this;
	}
	dispose() {
		this.geometry.dispose(), this.material.dispose();
	}
}, Kp = class {
	constructor() {
		this.type = "ShapePath", this.color = new J(), this.subPaths = [], this.currentPath = null, this.userData = {};
	}
	moveTo(e, t) {
		return this.currentPath = new ul(), this.subPaths.push(this.currentPath), this.currentPath.moveTo(e, t), this;
	}
	lineTo(e, t) {
		return this.currentPath.lineTo(e, t), this;
	}
	quadraticCurveTo(e, t, n, r) {
		return this.currentPath.quadraticCurveTo(e, t, n, r), this;
	}
	bezierCurveTo(e, t, n, r, i, a) {
		return this.currentPath.bezierCurveTo(e, t, n, r, i, a), this;
	}
	splineThru(e) {
		return this.currentPath.splineThru(e), this;
	}
	toShapes() {
		function e(e, t) {
			let n = !1, r = t.length;
			for (let i = 0, a = r - 1; i < r; a = i++) {
				let r = t[i], o = t[a];
				r.y > e.y != o.y > e.y && e.x < (o.x - r.x) * (e.y - r.y) / (o.y - r.y) + r.x && (n = !n);
			}
			return n;
		}
		function t(t, n) {
			let r = n.getCenter(new H());
			if (e(r, t)) return r;
			let i = r.y, a = [], o = t.length;
			for (let e = 0; e < o; e++) {
				let n = t[e], r = t[(e + 1) % o];
				if (n.y > i != r.y > i) {
					let e = n.x + (i - n.y) * (r.x - n.x) / (r.y - n.y);
					a.push(e);
				}
			}
			return a.length > 1 && (a.sort((e, t) => e - t), r.x = (a[0] + a[1]) / 2), r;
		}
		let n = this.userData.style && this.userData.style.fillRule || "nonzero";
		n !== "nonzero" && n !== "evenodd" && (R("Fill-rule \"" + n + "\" is not supported, falling back to \"nonzero\"."), n = "nonzero");
		let r = n === "nonzero" ? ((e) => e !== 0) : ((e) => (e & 1) != 0), i = [];
		for (let e of this.subPaths) {
			let n = e.getPoints();
			if (n.length < 3) continue;
			let r = Kl.area(n);
			if (r === 0) continue;
			let a = new op();
			for (let e = 0; e < n.length; e++) a.expandByPoint(n[e]);
			i.push({
				subPath: e,
				points: n,
				boundingBox: a,
				interiorPoint: t(n, a),
				absArea: Math.abs(r),
				winding: r < 0 ? -1 : 1,
				container: null,
				exclude: !1,
				role: null
			});
		}
		i.sort((e, t) => t.absArea - e.absArea);
		for (let t = 0; t < i.length; t++) {
			let n = i[t], a = 0;
			for (let r = t - 1; r >= 0; r--) {
				let t = i[r];
				if (t.boundingBox.containsPoint(n.interiorPoint) && e(n.interiorPoint, t.points)) {
					n.container = t.exclude ? t.container : t, a = t.winding, n.winding += a;
					break;
				}
			}
			r(n.winding) === r(a) && (n.exclude = !0);
		}
		for (let e of i) e.exclude || (e.role = e.container === null || e.container.role === "hole" ? "outer" : "hole");
		let a = [], o = /* @__PURE__ */ new Map();
		for (let e of i) {
			if (e.exclude || e.role !== "outer") continue;
			let t = new dl();
			t.curves = e.subPath.curves, a.push(t), o.set(e, t);
		}
		for (let e of i) {
			if (e.exclude || e.role !== "hole") continue;
			let t = o.get(e.container);
			if (!t) continue;
			let n = new ul();
			n.curves = e.subPath.curves, t.holes.push(n);
		}
		return a;
	}
}, qp = class extends gr {
	constructor(e, t = null) {
		super(), this.object = e, this.domElement = t, this.enabled = !0, this.state = -1, this.keys = {}, this.mouseButtons = {
			LEFT: null,
			MIDDLE: null,
			RIGHT: null
		}, this.touches = {
			ONE: null,
			TWO: null
		};
	}
	connect(e) {
		if (e === void 0) {
			R("Controls: connect() now requires an element.");
			return;
		}
		this.domElement !== null && this.disconnect(), this.domElement = e;
	}
	disconnect() {}
	dispose() {}
	update() {}
};
function Jp(e, t) {
	let n = e.image && e.image.width ? e.image.width / e.image.height : 1;
	return n > t ? (e.repeat.x = 1, e.repeat.y = n / t, e.offset.x = 0, e.offset.y = (1 - e.repeat.y) / 2) : (e.repeat.x = t / n, e.repeat.y = 1, e.offset.x = (1 - e.repeat.x) / 2, e.offset.y = 0), e;
}
function Yp(e, t) {
	let n = e.image && e.image.width ? e.image.width / e.image.height : 1;
	return n > t ? (e.repeat.x = t / n, e.repeat.y = 1, e.offset.x = (1 - e.repeat.x) / 2, e.offset.y = 0) : (e.repeat.x = 1, e.repeat.y = n / t, e.offset.x = 0, e.offset.y = (1 - e.repeat.y) / 2), e;
}
function Xp(e) {
	return e.repeat.x = 1, e.repeat.y = 1, e.offset.x = 0, e.offset.y = 0, e;
}
function Zp(e, t, n, r) {
	let i = Qp(r);
	switch (n) {
		case vt: return e * t;
		case Ct: return e * t / i.components * i.byteLength;
		case wt: return e * t / i.components * i.byteLength;
		case Tt: return e * t * 2 / i.components * i.byteLength;
		case Et: return e * t * 2 / i.components * i.byteLength;
		case yt: return e * t * 3 / i.components * i.byteLength;
		case bt: return e * t * 4 / i.components * i.byteLength;
		case Ot: return e * t * 4 / i.components * i.byteLength;
		case kt:
		case At: return Math.floor((e + 3) / 4) * Math.floor((t + 3) / 4) * 8;
		case jt:
		case Mt: return Math.floor((e + 3) / 4) * Math.floor((t + 3) / 4) * 16;
		case Pt:
		case It: return Math.max(e, 16) * Math.max(t, 8) / 4;
		case Nt:
		case Ft: return Math.max(e, 8) * Math.max(t, 8) / 2;
		case Lt:
		case Rt:
		case Bt:
		case Vt: return Math.floor((e + 3) / 4) * Math.floor((t + 3) / 4) * 8;
		case zt:
		case Ht:
		case Ut: return Math.floor((e + 3) / 4) * Math.floor((t + 3) / 4) * 16;
		case Wt: return Math.floor((e + 3) / 4) * Math.floor((t + 3) / 4) * 16;
		case Gt: return Math.floor((e + 4) / 5) * Math.floor((t + 3) / 4) * 16;
		case Kt: return Math.floor((e + 4) / 5) * Math.floor((t + 4) / 5) * 16;
		case qt: return Math.floor((e + 5) / 6) * Math.floor((t + 4) / 5) * 16;
		case Jt: return Math.floor((e + 5) / 6) * Math.floor((t + 5) / 6) * 16;
		case Yt: return Math.floor((e + 7) / 8) * Math.floor((t + 4) / 5) * 16;
		case Xt: return Math.floor((e + 7) / 8) * Math.floor((t + 5) / 6) * 16;
		case Zt: return Math.floor((e + 7) / 8) * Math.floor((t + 7) / 8) * 16;
		case Qt: return Math.floor((e + 9) / 10) * Math.floor((t + 4) / 5) * 16;
		case $t: return Math.floor((e + 9) / 10) * Math.floor((t + 5) / 6) * 16;
		case en: return Math.floor((e + 9) / 10) * Math.floor((t + 7) / 8) * 16;
		case tn: return Math.floor((e + 9) / 10) * Math.floor((t + 9) / 10) * 16;
		case nn: return Math.floor((e + 11) / 12) * Math.floor((t + 9) / 10) * 16;
		case rn: return Math.floor((e + 11) / 12) * Math.floor((t + 11) / 12) * 16;
		case an:
		case on:
		case sn: return Math.ceil(e / 4) * Math.ceil(t / 4) * 16;
		case cn:
		case ln: return Math.ceil(e / 4) * Math.ceil(t / 4) * 8;
		case un:
		case dn: return Math.ceil(e / 4) * Math.ceil(t / 4) * 16;
	}
	throw Error(`Unable to determine texture byte length for ${n} format.`);
}
function Qp(e) {
	switch (e) {
		case at:
		case ot: return {
			byteLength: 1,
			components: 1
		};
		case ct:
		case st:
		case ft: return {
			byteLength: 2,
			components: 1
		};
		case pt:
		case mt: return {
			byteLength: 2,
			components: 4
		};
		case ut:
		case lt:
		case dt: return {
			byteLength: 4,
			components: 1
		};
		case gt:
		case _t: return {
			byteLength: 4,
			components: 3
		};
	}
	throw Error(`THREE.TextureUtils: Unknown texture type ${e}.`);
}
var $p = class {
	static contain(e, t) {
		return Jp(e, t);
	}
	static cover(e, t) {
		return Yp(e, t);
	}
	static fill(e) {
		return Xp(e);
	}
	static getByteLength(e, t, n, r) {
		return Zp(e, t, n, r);
	}
};
typeof __THREE_DEVTOOLS__ < "u" && __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register", { detail: { revision: "185" } })), typeof window < "u" && (window.__THREE__ ? R("WARNING: Multiple instances of Three.js being imported.") : window.__THREE__ = "185");
//#endregion
//#region ../../node_modules/three/build/three.module.js
var em = /* @__PURE__ */ e({
	ACESFilmicToneMapping: () => 4,
	AddEquation: () => 100,
	AddOperation: () => 2,
	AdditiveAnimationBlendMode: () => Cn,
	AdditiveBlending: () => 2,
	AgXToneMapping: () => 6,
	AlphaFormat: () => vt,
	AlwaysCompare: () => 519,
	AlwaysDepth: () => 1,
	AlwaysStencilFunc: () => 519,
	AmbientLight: () => zd,
	AnimationAction: () => Hf,
	AnimationClip: () => ed,
	AnimationLoader: () => dd,
	AnimationMixer: () => Wf,
	AnimationObjectGroup: () => Vf,
	AnimationUtils: () => Bu,
	ArcCurve: () => Lc,
	ArrayCamera: () => ff,
	ArrowHelper: () => Wp,
	AttachedBindMode: () => We,
	Audio: () => xf,
	AudioAnalyser: () => Df,
	AudioContext: () => nf,
	AudioListener: () => bf,
	AudioLoader: () => rf,
	AxesHelper: () => Gp,
	BackSide: () => 1,
	BasicDepthPacking: () => wn,
	BasicShadowMap: () => 0,
	BatchedMesh: () => Us,
	BezierInterpolant: () => Gu,
	Bone: () => ts,
	BooleanKeyframeTrack: () => qu,
	Box2: () => op,
	Box3: () => la,
	Box3Helper: () => zp,
	BoxGeometry: () => Cc,
	BoxHelper: () => Rp,
	BufferAttribute: () => Y,
	BufferGeometry: () => Z,
	BufferGeometryLoader: () => qd,
	ByteType: () => ot,
	Cache: () => rd,
	Camera: () => Dd,
	CameraHelper: () => Fp,
	CanvasTexture: () => vc,
	CapsuleGeometry: () => wc,
	CatmullRomCurve3: () => Wc,
	CineonToneMapping: () => 3,
	CircleGeometry: () => Tc,
	ClampToEdgeWrapping: () => qe,
	Clock: () => tp,
	Color: () => J,
	ColorKeyframeTrack: () => Ju,
	ColorManagement: () => G,
	Compatibility: () => er,
	CompressedArrayTexture: () => hc,
	CompressedCubeTexture: () => gc,
	CompressedTexture: () => mc,
	CompressedTextureLoader: () => fd,
	ConeGeometry: () => Dc,
	ConstantAlphaFactor: () => 213,
	ConstantColorFactor: () => 211,
	Controls: () => qp,
	CubeCamera: () => df,
	CubeDepthTexture: () => xc,
	CubeReflectionMapping: () => 301,
	CubeRefractionMapping: () => 302,
	CubeTexture: () => _c,
	CubeTextureLoader: () => hd,
	CubeUVReflectionMapping: () => 306,
	CubicBezierCurve: () => tl,
	CubicBezierCurve3: () => nl,
	CubicInterpolant: () => Hu,
	CullFaceBack: () => 1,
	CullFaceFront: () => 2,
	CullFaceFrontBack: () => 3,
	CullFaceNone: () => 0,
	Curve: () => Fc,
	CurvePath: () => ll,
	CustomBlending: () => 5,
	CustomToneMapping: () => 5,
	CylinderGeometry: () => Ec,
	Cylindrical: () => rp,
	Data3DTexture: () => ui,
	DataArrayTexture: () => ci,
	DataTexture: () => ns,
	DataTextureLoader: () => gd,
	DataUtils: () => Oa,
	DecrementStencilOp: () => Fn,
	DecrementWrapStencilOp: () => Ln,
	DefaultLoadingManager: () => od,
	DepthFormat: () => xt,
	DepthStencilFormat: () => St,
	DepthTexture: () => bc,
	DetachedBindMode: () => Ge,
	DirectionalLight: () => Rd,
	DirectionalLightHelper: () => Mp,
	DiscreteInterpolant: () => Wu,
	DodecahedronGeometry: () => kc,
	DoubleSide: () => 2,
	DstAlphaFactor: () => 206,
	DstColorFactor: () => 208,
	DynamicCopyUsage: () => Kn,
	DynamicDrawUsage: () => Bn,
	DynamicReadUsage: () => Un,
	EdgesGeometry: () => Pc,
	EllipseCurve: () => Ic,
	EqualCompare: () => 514,
	EqualDepth: () => 4,
	EqualStencilFunc: () => 514,
	EquirectangularReflectionMapping: () => 303,
	EquirectangularRefractionMapping: () => 304,
	Euler: () => xi,
	EventDispatcher: () => gr,
	ExternalTexture: () => Sc,
	ExtrudeGeometry: () => Yl,
	FileLoader: () => ud,
	Float16BufferAttribute: () => za,
	Float32BufferAttribute: () => X,
	FloatType: () => dt,
	Fog: () => qi,
	FogExp2: () => Ki,
	FramebufferTexture: () => pc,
	FrontSide: () => 0,
	Frustum: () => Ss,
	FrustumArray: () => ws,
	GLBufferAttribute: () => Xf,
	GLSL1: () => "100",
	GLSL3: () => Jn,
	GreaterCompare: () => 516,
	GreaterDepth: () => 6,
	GreaterEqualCompare: () => 518,
	GreaterEqualDepth: () => 5,
	GreaterEqualStencilFunc: () => 518,
	GreaterStencilFunc: () => 516,
	GridHelper: () => Dp,
	Group: () => Ri,
	HTMLTexture: () => yc,
	HalfFloatType: () => ft,
	HemisphereLight: () => yd,
	HemisphereLightHelper: () => Ep,
	IcosahedronGeometry: () => Ql,
	ImageBitmapLoader: () => ef,
	ImageLoader: () => md,
	ImageUtils: () => Qr,
	IncrementStencilOp: () => Pn,
	IncrementWrapStencilOp: () => In,
	InstancedBufferAttribute: () => os,
	InstancedBufferGeometry: () => Kd,
	InstancedInterleavedBuffer: () => Yf,
	InstancedMesh: () => ms,
	Int16BufferAttribute: () => Fa,
	Int32BufferAttribute: () => La,
	Int8BufferAttribute: () => Ma,
	IntType: () => lt,
	InterleavedBuffer: () => Za,
	InterleavedBufferAttribute: () => $a,
	Interpolant: () => Vu,
	InterpolateBezier: () => vn,
	InterpolateDiscrete: () => hn,
	InterpolateLinear: () => gn,
	InterpolateSmooth: () => _n,
	InterpolationSamplingMode: () => $n,
	InterpolationSamplingType: () => Qn,
	InvertStencilOp: () => Rn,
	KeepStencilOp: () => Mn,
	KeyframeTrack: () => Ku,
	LOD: () => xo,
	LatheGeometry: () => $l,
	Layers: () => Si,
	LessCompare: () => 513,
	LessDepth: () => 2,
	LessEqualCompare: () => 515,
	LessEqualDepth: () => 3,
	LessEqualStencilFunc: () => 515,
	LessStencilFunc: () => 513,
	Light: () => vd,
	LightProbe: () => Hd,
	Line: () => Qs,
	Line3: () => mp,
	LineBasicMaterial: () => Ws,
	LineCurve: () => rl,
	LineCurve3: () => il,
	LineDashedMaterial: () => Nu,
	LineLoop: () => rc,
	LineSegments: () => nc,
	LinearFilter: () => et,
	LinearInterpolant: () => Uu,
	LinearMipMapLinearFilter: () => it,
	LinearMipMapNearestFilter: () => nt,
	LinearMipmapLinearFilter: () => rt,
	LinearMipmapNearestFilter: () => tt,
	LinearSRGBColorSpace: () => kn,
	LinearToneMapping: () => 1,
	LinearTransfer: () => An,
	Loader: () => sd,
	LoaderUtils: () => Gd,
	LoadingManager: () => ad,
	LoopOnce: () => fn,
	LoopPingPong: () => mn,
	LoopRepeat: () => pn,
	MOUSE: () => He,
	Material: () => to,
	MaterialBlending: () => 6,
	MaterialLoader: () => Wd,
	MathUtils: () => Vr,
	Matrix2: () => ip,
	Matrix3: () => W,
	Matrix4: () => K,
	MaxEquation: () => 104,
	Mesh: () => Ho,
	MeshBasicMaterial: () => Ao,
	MeshDepthMaterial: () => Au,
	MeshDistanceMaterial: () => ju,
	MeshLambertMaterial: () => ku,
	MeshMatcapMaterial: () => Mu,
	MeshNormalMaterial: () => Ou,
	MeshPhongMaterial: () => Eu,
	MeshPhysicalMaterial: () => Tu,
	MeshStandardMaterial: () => wu,
	MeshToonMaterial: () => Du,
	MinEquation: () => 103,
	MirroredRepeatWrapping: () => Je,
	MixOperation: () => 1,
	MultiplyBlending: () => 4,
	MultiplyOperation: () => 0,
	NearestFilter: () => Ye,
	NearestMipMapLinearFilter: () => $e,
	NearestMipMapNearestFilter: () => Ze,
	NearestMipmapLinearFilter: () => Qe,
	NearestMipmapNearestFilter: () => Xe,
	NeutralToneMapping: () => 7,
	NeverCompare: () => 512,
	NeverDepth: () => 0,
	NeverStencilFunc: () => 512,
	NoBlending: () => 0,
	NoColorSpace: () => "",
	NoNormalPacking: () => "",
	NoToneMapping: () => 0,
	NormalAnimationBlendMode: () => Sn,
	NormalBlending: () => 1,
	NormalGAPacking: () => "ga",
	NormalRGPacking: () => "rg",
	NotEqualCompare: () => 517,
	NotEqualDepth: () => 7,
	NotEqualStencilFunc: () => 517,
	NumberKeyframeTrack: () => Yu,
	Object3D: () => q,
	ObjectLoader: () => Yd,
	ObjectSpaceNormalMap: () => 1,
	OctahedronGeometry: () => eu,
	OneFactor: () => 201,
	OneMinusConstantAlphaFactor: () => 214,
	OneMinusConstantColorFactor: () => 212,
	OneMinusDstAlphaFactor: () => 207,
	OneMinusDstColorFactor: () => 209,
	OneMinusSrcAlphaFactor: () => 205,
	OneMinusSrcColorFactor: () => 203,
	OrthographicCamera: () => Id,
	PCFShadowMap: () => 1,
	PCFSoftShadowMap: () => 2,
	PMREMGenerator: () => Cm,
	Path: () => ul,
	PerspectiveCamera: () => jd,
	Plane: () => vs,
	PlaneGeometry: () => tu,
	PlaneHelper: () => Bp,
	PointLight: () => Fd,
	PointLightHelper: () => Sp,
	Points: () => lc,
	PointsMaterial: () => ic,
	PolarGridHelper: () => Op,
	PolyhedronGeometry: () => Oc,
	PositionalAudio: () => Ef,
	PropertyBinding: () => Bf,
	PropertyMixer: () => Of,
	QuadraticBezierCurve: () => al,
	QuadraticBezierCurve3: () => ol,
	Quaternion: () => Hr,
	QuaternionKeyframeTrack: () => Zu,
	QuaternionLinearInterpolant: () => Xu,
	R11_EAC_Format: () => Bt,
	RED_GREEN_RGTC2_Format: () => un,
	RED_RGTC1_Format: () => cn,
	REVISION: () => "185",
	RG11_EAC_Format: () => Ht,
	RGBADepthPacking: () => Tn,
	RGBAFormat: () => bt,
	RGBAIntegerFormat: () => Ot,
	RGBA_ASTC_10x10_Format: () => tn,
	RGBA_ASTC_10x5_Format: () => Qt,
	RGBA_ASTC_10x6_Format: () => $t,
	RGBA_ASTC_10x8_Format: () => en,
	RGBA_ASTC_12x10_Format: () => nn,
	RGBA_ASTC_12x12_Format: () => rn,
	RGBA_ASTC_4x4_Format: () => Wt,
	RGBA_ASTC_5x4_Format: () => Gt,
	RGBA_ASTC_5x5_Format: () => Kt,
	RGBA_ASTC_6x5_Format: () => qt,
	RGBA_ASTC_6x6_Format: () => Jt,
	RGBA_ASTC_8x5_Format: () => Yt,
	RGBA_ASTC_8x6_Format: () => Xt,
	RGBA_ASTC_8x8_Format: () => Zt,
	RGBA_BPTC_Format: () => an,
	RGBA_ETC2_EAC_Format: () => zt,
	RGBA_PVRTC_2BPPV1_Format: () => It,
	RGBA_PVRTC_4BPPV1_Format: () => Ft,
	RGBA_S3TC_DXT1_Format: () => At,
	RGBA_S3TC_DXT3_Format: () => jt,
	RGBA_S3TC_DXT5_Format: () => Mt,
	RGBDepthPacking: () => En,
	RGBFormat: () => yt,
	RGBIntegerFormat: () => Dt,
	RGB_BPTC_SIGNED_Format: () => on,
	RGB_BPTC_UNSIGNED_Format: () => sn,
	RGB_ETC1_Format: () => Lt,
	RGB_ETC2_Format: () => Rt,
	RGB_PVRTC_2BPPV1_Format: () => Pt,
	RGB_PVRTC_4BPPV1_Format: () => Nt,
	RGB_S3TC_DXT1_Format: () => kt,
	RGDepthPacking: () => Dn,
	RGFormat: () => Tt,
	RGIntegerFormat: () => Et,
	RawShaderMaterial: () => Cu,
	Ray: () => ko,
	Raycaster: () => Qf,
	RectAreaLight: () => Bd,
	RedFormat: () => Ct,
	RedIntegerFormat: () => wt,
	ReinhardToneMapping: () => 2,
	RenderTarget: () => oi,
	RenderTarget3D: () => Gf,
	RepeatWrapping: () => Ke,
	ReplaceStencilOp: () => Nn,
	ReverseSubtractEquation: () => 102,
	RingGeometry: () => nu,
	SIGNED_R11_EAC_Format: () => Vt,
	SIGNED_RED_GREEN_RGTC2_Format: () => dn,
	SIGNED_RED_RGTC1_Format: () => ln,
	SIGNED_RG11_EAC_Format: () => Ut,
	SRGBColorSpace: () => On,
	SRGBTransfer: () => jn,
	Scene: () => Ji,
	ShaderChunk: () => Q,
	ShaderLib: () => rm,
	ShaderMaterial: () => Su,
	ShadowMaterial: () => pu,
	Shape: () => dl,
	ShapeGeometry: () => ru,
	ShapePath: () => Kp,
	ShapeUtils: () => Kl,
	ShortType: () => st,
	Skeleton: () => as,
	SkeletonHelper: () => bp,
	SkinnedMesh: () => es,
	Source: () => ei,
	Sphere: () => Ua,
	SphereGeometry: () => au,
	Spherical: () => np,
	SphericalHarmonics3: () => Vd,
	SplineCurve: () => sl,
	SpotLight: () => Nd,
	SpotLightHelper: () => gp,
	Sprite: () => _o,
	SpriteMaterial: () => no,
	SrcAlphaFactor: () => 204,
	SrcAlphaSaturateFactor: () => 210,
	SrcColorFactor: () => 202,
	StaticCopyUsage: () => Gn,
	StaticDrawUsage: () => zn,
	StaticReadUsage: () => Hn,
	StereoCamera: () => cf,
	StreamCopyUsage: () => qn,
	StreamDrawUsage: () => Vn,
	StreamReadUsage: () => Wn,
	StringKeyframeTrack: () => Qu,
	SubtractEquation: () => 101,
	SubtractiveBlending: () => 3,
	TOUCH: () => Ue,
	TangentSpaceNormalMap: () => 0,
	TetrahedronGeometry: () => ou,
	Texture: () => ii,
	TextureLoader: () => _d,
	TextureUtils: () => $p,
	Timer: () => pf,
	TimestampQuery: () => Zn,
	TorusGeometry: () => su,
	TorusKnotGeometry: () => cu,
	Triangle: () => ca,
	TriangleFanDrawMode: () => 2,
	TriangleStripDrawMode: () => 1,
	TrianglesDrawMode: () => 0,
	TubeGeometry: () => lu,
	UVMapping: () => 300,
	Uint16BufferAttribute: () => Ia,
	Uint32BufferAttribute: () => Ra,
	Uint8BufferAttribute: () => Na,
	Uint8ClampedBufferAttribute: () => Pa,
	Uniform: () => Kf,
	UniformsGroup: () => Jf,
	UniformsLib: () => $,
	UniformsUtils: () => yu,
	UnsignedByteType: () => at,
	UnsignedInt101111Type: () => _t,
	UnsignedInt248Type: () => ht,
	UnsignedInt5999Type: () => gt,
	UnsignedIntType: () => ut,
	UnsignedShort4444Type: () => pt,
	UnsignedShort5551Type: () => mt,
	UnsignedShortType: () => ct,
	VSMShadowMap: () => 3,
	Vector2: () => H,
	Vector3: () => U,
	Vector4: () => ai,
	VectorKeyframeTrack: () => $u,
	VideoFrameTexture: () => fc,
	VideoTexture: () => dc,
	WebGL3DRenderTarget: () => di,
	WebGLArrayRenderTarget: () => li,
	WebGLCoordinateSystem: () => Yn,
	WebGLCubeRenderTarget: () => Mm,
	WebGLRenderTarget: () => si,
	WebGLRenderer: () => g_,
	WebGLUtils: () => i_,
	WebGPUCoordinateSystem: () => Xn,
	WebXRController: () => Bi,
	WireframeGeometry: () => uu,
	WrapAroundEnding: () => xn,
	ZeroCurvatureEnding: () => yn,
	ZeroFactor: () => 200,
	ZeroSlopeEnding: () => bn,
	ZeroStencilOp: () => 0,
	createCanvasElement: () => or,
	error: () => z,
	getConsoleFunction: () => ur,
	log: () => dr,
	setConsoleFunction: () => lr,
	warn: () => R,
	warnOnce: () => pr
});
function tm() {
	let e = null, t = !1, n = null, r = null;
	function i(t, a) {
		n(t, a), r = e.requestAnimationFrame(i);
	}
	return {
		start: function() {
			t !== !0 && n !== null && e !== null && (r = e.requestAnimationFrame(i), t = !0);
		},
		stop: function() {
			e !== null && e.cancelAnimationFrame(r), t = !1;
		},
		setAnimationLoop: function(e) {
			n = e;
		},
		setContext: function(t) {
			e = t;
		}
	};
}
function nm(e) {
	let t = /* @__PURE__ */ new WeakMap();
	function n(t, n) {
		let r = t.array, i = t.usage, a = r.byteLength, o = e.createBuffer();
		e.bindBuffer(n, o), e.bufferData(n, r, i), t.onUploadCallback();
		let s;
		if (r instanceof Float32Array) s = e.FLOAT;
		else if (typeof Float16Array < "u" && r instanceof Float16Array) s = e.HALF_FLOAT;
		else if (r instanceof Uint16Array) s = t.isFloat16BufferAttribute ? e.HALF_FLOAT : e.UNSIGNED_SHORT;
		else if (r instanceof Int16Array) s = e.SHORT;
		else if (r instanceof Uint32Array) s = e.UNSIGNED_INT;
		else if (r instanceof Int32Array) s = e.INT;
		else if (r instanceof Int8Array) s = e.BYTE;
		else if (r instanceof Uint8Array) s = e.UNSIGNED_BYTE;
		else if (r instanceof Uint8ClampedArray) s = e.UNSIGNED_BYTE;
		else throw Error("THREE.WebGLAttributes: Unsupported buffer data format: " + r);
		return {
			buffer: o,
			type: s,
			bytesPerElement: r.BYTES_PER_ELEMENT,
			version: t.version,
			size: a
		};
	}
	function r(t, n, r) {
		let i = n.array, a = n.updateRanges;
		if (e.bindBuffer(r, t), a.length === 0) e.bufferSubData(r, 0, i);
		else {
			a.sort((e, t) => e.start - t.start);
			let t = 0;
			for (let e = 1; e < a.length; e++) {
				let n = a[t], r = a[e];
				r.start <= n.start + n.count + 1 ? n.count = Math.max(n.count, r.start + r.count - n.start) : (++t, a[t] = r);
			}
			a.length = t + 1;
			for (let t = 0, n = a.length; t < n; t++) {
				let n = a[t];
				e.bufferSubData(r, n.start * i.BYTES_PER_ELEMENT, i, n.start, n.count);
			}
			n.clearUpdateRanges();
		}
		n.onUploadCallback();
	}
	function i(e) {
		return e.isInterleavedBufferAttribute && (e = e.data), t.get(e);
	}
	function a(n) {
		n.isInterleavedBufferAttribute && (n = n.data);
		let r = t.get(n);
		r && (e.deleteBuffer(r.buffer), t.delete(n));
	}
	function o(e, i) {
		if (e.isInterleavedBufferAttribute && (e = e.data), e.isGLBufferAttribute) {
			let n = t.get(e);
			(!n || n.version < e.version) && t.set(e, {
				buffer: e.buffer,
				type: e.type,
				bytesPerElement: e.elementSize,
				version: e.version
			});
			return;
		}
		let a = t.get(e);
		if (a === void 0) t.set(e, n(e, i));
		else if (a.version < e.version) {
			if (a.size !== e.array.byteLength) throw Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");
			r(a.buffer, e, i), a.version = e.version;
		}
	}
	return {
		get: i,
		remove: a,
		update: o
	};
}
var Q = {
	alphahash_fragment: "#ifdef USE_ALPHAHASH\n	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;\n#endif",
	alphahash_pars_fragment: "#ifdef USE_ALPHAHASH\n	const float ALPHA_HASH_SCALE = 0.05;\n	float hash2D( vec2 value ) {\n		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );\n	}\n	float hash3D( vec3 value ) {\n		return hash2D( vec2( hash2D( value.xy ), value.z ) );\n	}\n	float getAlphaHashThreshold( vec3 position ) {\n		float maxDeriv = max(\n			length( dFdx( position.xyz ) ),\n			length( dFdy( position.xyz ) )\n		);\n		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );\n		vec2 pixScales = vec2(\n			exp2( floor( log2( pixScale ) ) ),\n			exp2( ceil( log2( pixScale ) ) )\n		);\n		vec2 alpha = vec2(\n			hash3D( floor( pixScales.x * position.xyz ) ),\n			hash3D( floor( pixScales.y * position.xyz ) )\n		);\n		float lerpFactor = fract( log2( pixScale ) );\n		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;\n		float a = min( lerpFactor, 1.0 - lerpFactor );\n		vec3 cases = vec3(\n			x * x / ( 2.0 * a * ( 1.0 - a ) ),\n			( x - 0.5 * a ) / ( 1.0 - a ),\n			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )\n		);\n		float threshold = ( x < ( 1.0 - a ) )\n			? ( ( x < a ) ? cases.x : cases.y )\n			: cases.z;\n		return clamp( threshold , 1.0e-6, 1.0 );\n	}\n#endif",
	alphamap_fragment: "#ifdef USE_ALPHAMAP\n	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;\n#endif",
	alphamap_pars_fragment: "#ifdef USE_ALPHAMAP\n	uniform sampler2D alphaMap;\n#endif",
	alphatest_fragment: "#ifdef USE_ALPHATEST\n	#ifdef ALPHA_TO_COVERAGE\n	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );\n	if ( diffuseColor.a == 0.0 ) discard;\n	#else\n	if ( diffuseColor.a < alphaTest ) discard;\n	#endif\n#endif",
	alphatest_pars_fragment: "#ifdef USE_ALPHATEST\n	uniform float alphaTest;\n#endif",
	aomap_fragment: "#ifdef USE_AOMAP\n	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;\n	reflectedLight.indirectDiffuse *= ambientOcclusion;\n	#if defined( USE_CLEARCOAT ) \n		clearcoatSpecularIndirect *= ambientOcclusion;\n	#endif\n	#if defined( USE_SHEEN ) \n		sheenSpecularIndirect *= ambientOcclusion;\n	#endif\n	#if defined( USE_ENVMAP ) && defined( STANDARD )\n		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );\n		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );\n	#endif\n#endif",
	aomap_pars_fragment: "#ifdef USE_AOMAP\n	uniform sampler2D aoMap;\n	uniform float aoMapIntensity;\n#endif",
	batching_pars_vertex: "#ifdef USE_BATCHING\n	#if ! defined( GL_ANGLE_multi_draw )\n	#define gl_DrawID _gl_DrawID\n	uniform int _gl_DrawID;\n	#endif\n	uniform highp sampler2D batchingTexture;\n	uniform highp usampler2D batchingIdTexture;\n	mat4 getBatchingMatrix( const in float i ) {\n		int size = textureSize( batchingTexture, 0 ).x;\n		int j = int( i ) * 4;\n		int x = j % size;\n		int y = j / size;\n		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );\n		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );\n		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );\n		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );\n		return mat4( v1, v2, v3, v4 );\n	}\n	float getIndirectIndex( const in int i ) {\n		int size = textureSize( batchingIdTexture, 0 ).x;\n		int x = i % size;\n		int y = i / size;\n		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );\n	}\n#endif\n#ifdef USE_BATCHING_COLOR\n	uniform sampler2D batchingColorTexture;\n	vec4 getBatchingColor( const in float i ) {\n		int size = textureSize( batchingColorTexture, 0 ).x;\n		int j = int( i );\n		int x = j % size;\n		int y = j / size;\n		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );\n	}\n#endif",
	batching_vertex: "#ifdef USE_BATCHING\n	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );\n#endif",
	begin_vertex: "vec3 transformed = vec3( position );\n#ifdef USE_ALPHAHASH\n	vPosition = vec3( position );\n#endif",
	beginnormal_vertex: "vec3 objectNormal = vec3( normal );\n#ifdef USE_TANGENT\n	vec3 objectTangent = vec3( tangent.xyz );\n#endif",
	bsdfs: "float G_BlinnPhong_Implicit( ) {\n	return 0.25;\n}\nfloat D_BlinnPhong( const in float shininess, const in float dotNH ) {\n	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );\n}\nvec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {\n	vec3 halfDir = normalize( lightDir + viewDir );\n	float dotNH = saturate( dot( normal, halfDir ) );\n	float dotVH = saturate( dot( viewDir, halfDir ) );\n	vec3 F = F_Schlick( specularColor, 1.0, dotVH );\n	float G = G_BlinnPhong_Implicit( );\n	float D = D_BlinnPhong( shininess, dotNH );\n	return F * ( G * D );\n} // validated",
	iridescence_fragment: "#ifdef USE_IRIDESCENCE\n	const mat3 XYZ_TO_REC709 = mat3(\n		 3.2404542, -0.9692660,  0.0556434,\n		-1.5371385,  1.8760108, -0.2040259,\n		-0.4985314,  0.0415560,  1.0572252\n	);\n	vec3 Fresnel0ToIor( vec3 fresnel0 ) {\n		vec3 sqrtF0 = sqrt( fresnel0 );\n		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );\n	}\n	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {\n		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );\n	}\n	float IorToFresnel0( float transmittedIor, float incidentIor ) {\n		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));\n	}\n	vec3 evalSensitivity( float OPD, vec3 shift ) {\n		float phase = 2.0 * PI * OPD * 1.0e-9;\n		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );\n		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );\n		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );\n		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );\n		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );\n		xyz /= 1.0685e-7;\n		vec3 rgb = XYZ_TO_REC709 * xyz;\n		return rgb;\n	}\n	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {\n		vec3 I;\n		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );\n		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );\n		float cosTheta2Sq = 1.0 - sinTheta2Sq;\n		if ( cosTheta2Sq < 0.0 ) {\n			return vec3( 1.0 );\n		}\n		float cosTheta2 = sqrt( cosTheta2Sq );\n		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );\n		float R12 = F_Schlick( R0, 1.0, cosTheta1 );\n		float T121 = 1.0 - R12;\n		float phi12 = 0.0;\n		if ( iridescenceIOR < outsideIOR ) phi12 = PI;\n		float phi21 = PI - phi12;\n		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );\n		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );\n		vec3 phi23 = vec3( 0.0 );\n		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;\n		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;\n		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;\n		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;\n		vec3 phi = vec3( phi21 ) + phi23;\n		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );\n		vec3 r123 = sqrt( R123 );\n		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );\n		vec3 C0 = R12 + Rs;\n		I = C0;\n		vec3 Cm = Rs - T121;\n		for ( int m = 1; m <= 2; ++ m ) {\n			Cm *= r123;\n			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );\n			I += Cm * Sm;\n		}\n		return max( I, vec3( 0.0 ) );\n	}\n#endif",
	bumpmap_pars_fragment: "#ifdef USE_BUMPMAP\n	uniform sampler2D bumpMap;\n	uniform float bumpScale;\n	vec2 dHdxy_fwd() {\n		vec2 dSTdx = dFdx( vBumpMapUv );\n		vec2 dSTdy = dFdy( vBumpMapUv );\n		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;\n		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;\n		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;\n		return vec2( dBx, dBy );\n	}\n	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {\n		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );\n		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );\n		vec3 vN = surf_norm;\n		vec3 R1 = cross( vSigmaY, vN );\n		vec3 R2 = cross( vN, vSigmaX );\n		float fDet = dot( vSigmaX, R1 ) * faceDirection;\n		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );\n		return normalize( abs( fDet ) * surf_norm - vGrad );\n	}\n#endif",
	clipping_planes_fragment: "#if NUM_CLIPPING_PLANES > 0\n	vec4 plane;\n	#ifdef ALPHA_TO_COVERAGE\n		float distanceToPlane, distanceGradient;\n		float clipOpacity = 1.0;\n		#pragma unroll_loop_start\n		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {\n			plane = clippingPlanes[ i ];\n			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;\n			distanceGradient = fwidth( distanceToPlane ) / 2.0;\n			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );\n			if ( clipOpacity == 0.0 ) discard;\n		}\n		#pragma unroll_loop_end\n		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES\n			float unionClipOpacity = 1.0;\n			#pragma unroll_loop_start\n			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {\n				plane = clippingPlanes[ i ];\n				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;\n				distanceGradient = fwidth( distanceToPlane ) / 2.0;\n				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );\n			}\n			#pragma unroll_loop_end\n			clipOpacity *= 1.0 - unionClipOpacity;\n		#endif\n		diffuseColor.a *= clipOpacity;\n		if ( diffuseColor.a == 0.0 ) discard;\n	#else\n		#pragma unroll_loop_start\n		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {\n			plane = clippingPlanes[ i ];\n			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;\n		}\n		#pragma unroll_loop_end\n		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES\n			bool clipped = true;\n			#pragma unroll_loop_start\n			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {\n				plane = clippingPlanes[ i ];\n				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;\n			}\n			#pragma unroll_loop_end\n			if ( clipped ) discard;\n		#endif\n	#endif\n#endif",
	clipping_planes_pars_fragment: "#if NUM_CLIPPING_PLANES > 0\n	varying vec3 vClipPosition;\n	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];\n#endif",
	clipping_planes_pars_vertex: "#if NUM_CLIPPING_PLANES > 0\n	varying vec3 vClipPosition;\n#endif",
	clipping_planes_vertex: "#if NUM_CLIPPING_PLANES > 0\n	vClipPosition = - mvPosition.xyz;\n#endif",
	color_fragment: "#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )\n	diffuseColor *= vColor;\n#endif",
	color_pars_fragment: "#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )\n	varying vec4 vColor;\n#endif",
	color_pars_vertex: "#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )\n	varying vec4 vColor;\n#endif",
	color_vertex: "#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )\n	vColor = vec4( 1.0 );\n#endif\n#ifdef USE_COLOR_ALPHA\n	vColor *= color;\n#elif defined( USE_COLOR )\n	vColor.rgb *= color;\n#endif\n#ifdef USE_INSTANCING_COLOR\n	vColor.rgb *= instanceColor.rgb;\n#endif\n#ifdef USE_BATCHING_COLOR\n	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );\n#endif",
	common: "#define PI 3.141592653589793\n#define PI2 6.283185307179586\n#define PI_HALF 1.5707963267948966\n#define RECIPROCAL_PI 0.3183098861837907\n#define RECIPROCAL_PI2 0.15915494309189535\n#define EPSILON 1e-6\n#ifndef saturate\n#define saturate( a ) clamp( a, 0.0, 1.0 )\n#endif\n#define whiteComplement( a ) ( 1.0 - saturate( a ) )\nfloat pow2( const in float x ) { return x*x; }\nvec3 pow2( const in vec3 x ) { return x*x; }\nfloat pow3( const in float x ) { return x*x*x; }\nfloat pow4( const in float x ) { float x2 = x*x; return x2*x2; }\nfloat max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }\nfloat average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }\nhighp float rand( const in vec2 uv ) {\n	const highp float a = 12.9898, b = 78.233, c = 43758.5453;\n	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );\n	return fract( sin( sn ) * c );\n}\n#ifdef HIGH_PRECISION\n	float precisionSafeLength( vec3 v ) { return length( v ); }\n#else\n	float precisionSafeLength( vec3 v ) {\n		float maxComponent = max3( abs( v ) );\n		return length( v / maxComponent ) * maxComponent;\n	}\n#endif\nstruct IncidentLight {\n	vec3 color;\n	vec3 direction;\n	bool visible;\n};\nstruct ReflectedLight {\n	vec3 directDiffuse;\n	vec3 directSpecular;\n	vec3 indirectDiffuse;\n	vec3 indirectSpecular;\n};\n#ifdef USE_ALPHAHASH\n	varying vec3 vPosition;\n#endif\nvec3 transformDirection( in vec3 dir, in mat4 matrix ) {\n	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );\n}\n#define inverseTransformDirection transformDirectionByInverseViewMatrix\nvec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {\n	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );\n}\nvec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {\n	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );\n}\nbool isPerspectiveMatrix( mat4 m ) {\n	return m[ 2 ][ 3 ] == - 1.0;\n}\nvec2 equirectUv( in vec3 dir ) {\n	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;\n	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;\n	return vec2( u, v );\n}\nvec3 BRDF_Lambert( const in vec3 diffuseColor ) {\n	return RECIPROCAL_PI * diffuseColor;\n}\nvec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {\n	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );\n	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );\n}\nfloat F_Schlick( const in float f0, const in float f90, const in float dotVH ) {\n	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );\n	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );\n} // validated",
	cube_uv_reflection_fragment: "#ifdef ENVMAP_TYPE_CUBE_UV\n	#define cubeUV_minMipLevel 4.0\n	#define cubeUV_minTileSize 16.0\n	float getFace( vec3 direction ) {\n		vec3 absDirection = abs( direction );\n		float face = - 1.0;\n		if ( absDirection.x > absDirection.z ) {\n			if ( absDirection.x > absDirection.y )\n				face = direction.x > 0.0 ? 0.0 : 3.0;\n			else\n				face = direction.y > 0.0 ? 1.0 : 4.0;\n		} else {\n			if ( absDirection.z > absDirection.y )\n				face = direction.z > 0.0 ? 2.0 : 5.0;\n			else\n				face = direction.y > 0.0 ? 1.0 : 4.0;\n		}\n		return face;\n	}\n	vec2 getUV( vec3 direction, float face ) {\n		vec2 uv;\n		if ( face == 0.0 ) {\n			uv = vec2( direction.z, direction.y ) / abs( direction.x );\n		} else if ( face == 1.0 ) {\n			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );\n		} else if ( face == 2.0 ) {\n			uv = vec2( - direction.x, direction.y ) / abs( direction.z );\n		} else if ( face == 3.0 ) {\n			uv = vec2( - direction.z, direction.y ) / abs( direction.x );\n		} else if ( face == 4.0 ) {\n			uv = vec2( - direction.x, direction.z ) / abs( direction.y );\n		} else {\n			uv = vec2( direction.x, direction.y ) / abs( direction.z );\n		}\n		return 0.5 * ( uv + 1.0 );\n	}\n	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {\n		float face = getFace( direction );\n		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );\n		mipInt = max( mipInt, cubeUV_minMipLevel );\n		float faceSize = exp2( mipInt );\n		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;\n		if ( face > 2.0 ) {\n			uv.y += faceSize;\n			face -= 3.0;\n		}\n		uv.x += face * faceSize;\n		uv.x += filterInt * 3.0 * cubeUV_minTileSize;\n		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );\n		uv.x *= CUBEUV_TEXEL_WIDTH;\n		uv.y *= CUBEUV_TEXEL_HEIGHT;\n		#ifdef texture2DGradEXT\n			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;\n		#else\n			return texture2D( envMap, uv ).rgb;\n		#endif\n	}\n	#define cubeUV_r0 1.0\n	#define cubeUV_m0 - 2.0\n	#define cubeUV_r1 0.8\n	#define cubeUV_m1 - 1.0\n	#define cubeUV_r4 0.4\n	#define cubeUV_m4 2.0\n	#define cubeUV_r5 0.305\n	#define cubeUV_m5 3.0\n	#define cubeUV_r6 0.21\n	#define cubeUV_m6 4.0\n	float roughnessToMip( float roughness ) {\n		float mip = 0.0;\n		if ( roughness >= cubeUV_r1 ) {\n			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;\n		} else if ( roughness >= cubeUV_r4 ) {\n			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;\n		} else if ( roughness >= cubeUV_r5 ) {\n			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;\n		} else if ( roughness >= cubeUV_r6 ) {\n			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;\n		} else {\n			mip = - 2.0 * log2( 1.16 * roughness );		}\n		return mip;\n	}\n	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {\n		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );\n		float mipF = fract( mip );\n		float mipInt = floor( mip );\n		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );\n		if ( mipF == 0.0 ) {\n			return vec4( color0, 1.0 );\n		} else {\n			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );\n			return vec4( mix( color0, color1, mipF ), 1.0 );\n		}\n	}\n#endif",
	defaultnormal_vertex: "vec3 transformedNormal = objectNormal;\n#ifdef USE_TANGENT\n	vec3 transformedTangent = objectTangent;\n#endif\n#ifdef USE_BATCHING\n	mat3 bm = mat3( batchingMatrix );\n	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );\n	transformedNormal = bm * transformedNormal;\n	#ifdef USE_TANGENT\n		transformedTangent = bm * transformedTangent;\n	#endif\n#endif\n#ifdef USE_INSTANCING\n	mat3 im = mat3( instanceMatrix );\n	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );\n	transformedNormal = im * transformedNormal;\n	#ifdef USE_TANGENT\n		transformedTangent = im * transformedTangent;\n	#endif\n#endif\ntransformedNormal = normalMatrix * transformedNormal;\n#ifdef FLIP_SIDED\n	transformedNormal = - transformedNormal;\n#endif\n#ifdef USE_TANGENT\n	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;\n#endif",
	displacementmap_pars_vertex: "#ifdef USE_DISPLACEMENTMAP\n	uniform sampler2D displacementMap;\n	uniform float displacementScale;\n	uniform float displacementBias;\n#endif",
	displacementmap_vertex: "#ifdef USE_DISPLACEMENTMAP\n	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );\n#endif",
	emissivemap_fragment: "#ifdef USE_EMISSIVEMAP\n	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );\n	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE\n		emissiveColor = sRGBTransferEOTF( emissiveColor );\n	#endif\n	totalEmissiveRadiance *= emissiveColor.rgb;\n#endif",
	emissivemap_pars_fragment: "#ifdef USE_EMISSIVEMAP\n	uniform sampler2D emissiveMap;\n#endif",
	colorspace_fragment: "gl_FragColor = linearToOutputTexel( gl_FragColor );",
	colorspace_pars_fragment: "vec4 LinearTransferOETF( in vec4 value ) {\n	return value;\n}\nvec4 sRGBTransferEOTF( in vec4 value ) {\n	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );\n}\nvec4 sRGBTransferOETF( in vec4 value ) {\n	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );\n}",
	envmap_fragment: "#ifdef USE_ENVMAP\n	#ifdef ENV_WORLDPOS\n		vec3 cameraToFrag;\n		if ( isOrthographic ) {\n			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );\n		} else {\n			cameraToFrag = normalize( vWorldPosition - cameraPosition );\n		}\n		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );\n		#ifdef ENVMAP_MODE_REFLECTION\n			vec3 reflectVec = reflect( cameraToFrag, worldNormal );\n		#else\n			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );\n		#endif\n	#else\n		vec3 reflectVec = vReflect;\n	#endif\n	#ifdef ENVMAP_TYPE_CUBE\n		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );\n		#ifdef ENVMAP_BLENDING_MULTIPLY\n			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );\n		#elif defined( ENVMAP_BLENDING_MIX )\n			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );\n		#elif defined( ENVMAP_BLENDING_ADD )\n			outgoingLight += envColor.xyz * specularStrength * reflectivity;\n		#endif\n	#endif\n#endif",
	envmap_common_pars_fragment: "#ifdef USE_ENVMAP\n	uniform float envMapIntensity;\n	uniform mat3 envMapRotation;\n	#ifdef ENVMAP_TYPE_CUBE\n		uniform samplerCube envMap;\n	#else\n		uniform sampler2D envMap;\n	#endif\n#endif",
	envmap_pars_fragment: "#ifdef USE_ENVMAP\n	uniform float reflectivity;\n	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )\n		#define ENV_WORLDPOS\n	#endif\n	#ifdef ENV_WORLDPOS\n		varying vec3 vWorldPosition;\n		uniform float refractionRatio;\n	#else\n		varying vec3 vReflect;\n	#endif\n#endif",
	envmap_pars_vertex: "#ifdef USE_ENVMAP\n	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )\n		#define ENV_WORLDPOS\n	#endif\n	#ifdef ENV_WORLDPOS\n		\n		varying vec3 vWorldPosition;\n	#else\n		varying vec3 vReflect;\n		uniform float refractionRatio;\n	#endif\n#endif",
	envmap_physical_pars_fragment: "#ifdef USE_ENVMAP\n	vec3 getIBLIrradiance( const in vec3 normal ) {\n		#ifdef ENVMAP_TYPE_CUBE_UV\n			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );\n			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );\n			return PI * envMapColor.rgb * envMapIntensity;\n		#else\n			return vec3( 0.0 );\n		#endif\n	}\n	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {\n		#ifdef ENVMAP_TYPE_CUBE_UV\n			vec3 reflectVec = reflect( - viewDir, normal );\n			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );\n			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );\n			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );\n			return envMapColor.rgb * envMapIntensity;\n		#else\n			return vec3( 0.0 );\n		#endif\n	}\n	#ifdef USE_ANISOTROPY\n		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {\n			#ifdef ENVMAP_TYPE_CUBE_UV\n				vec3 bentNormal = cross( bitangent, viewDir );\n				bentNormal = normalize( cross( bentNormal, bitangent ) );\n				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );\n				return getIBLRadiance( viewDir, bentNormal, roughness );\n			#else\n				return vec3( 0.0 );\n			#endif\n		}\n	#endif\n#endif",
	envmap_vertex: "#ifdef USE_ENVMAP\n	#ifdef ENV_WORLDPOS\n		vWorldPosition = worldPosition.xyz;\n	#else\n		vec3 cameraToVertex;\n		if ( isOrthographic ) {\n			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );\n		} else {\n			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );\n		}\n		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );\n		#ifdef ENVMAP_MODE_REFLECTION\n			vReflect = reflect( cameraToVertex, worldNormal );\n		#else\n			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );\n		#endif\n	#endif\n#endif",
	fog_vertex: "#ifdef USE_FOG\n	vFogDepth = - mvPosition.z;\n#endif",
	fog_pars_vertex: "#ifdef USE_FOG\n	varying float vFogDepth;\n#endif",
	fog_fragment: "#ifdef USE_FOG\n	#ifdef FOG_EXP2\n		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );\n	#else\n		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );\n	#endif\n	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif",
	fog_pars_fragment: "#ifdef USE_FOG\n	uniform vec3 fogColor;\n	varying float vFogDepth;\n	#ifdef FOG_EXP2\n		uniform float fogDensity;\n	#else\n		uniform float fogNear;\n		uniform float fogFar;\n	#endif\n#endif",
	gradientmap_pars_fragment: "#ifdef USE_GRADIENTMAP\n	uniform sampler2D gradientMap;\n#endif\nvec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {\n	float dotNL = dot( normal, lightDirection );\n	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );\n	#ifdef USE_GRADIENTMAP\n		return vec3( texture2D( gradientMap, coord ).r );\n	#else\n		vec2 fw = fwidth( coord ) * 0.5;\n		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );\n	#endif\n}",
	lightmap_pars_fragment: "#ifdef USE_LIGHTMAP\n	uniform sampler2D lightMap;\n	uniform float lightMapIntensity;\n#endif",
	lights_lambert_fragment: "LambertMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;\nmaterial.specularStrength = specularStrength;",
	lights_lambert_pars_fragment: "varying vec3 vViewPosition;\nstruct LambertMaterial {\n	vec3 diffuseColor;\n	float specularStrength;\n};\nvoid RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {\n	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n	vec3 irradiance = dotNL * directLight.color;\n	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\nvoid RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\n#define RE_Direct				RE_Direct_Lambert\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert",
	lights_pars_begin: "uniform bool receiveShadow;\nuniform vec3 ambientLightColor;\n#if defined( USE_LIGHT_PROBES )\n	uniform vec3 lightProbe[ 9 ];\n#endif\nvec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {\n	float x = normal.x, y = normal.y, z = normal.z;\n	vec3 result = shCoefficients[ 0 ] * 0.886227;\n	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;\n	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;\n	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;\n	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;\n	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;\n	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );\n	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;\n	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );\n	return result;\n}\nvec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {\n	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );\n	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );\n	return irradiance;\n}\nvec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {\n	vec3 irradiance = ambientLightColor;\n	return irradiance;\n}\nfloat getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {\n	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );\n	if ( cutoffDistance > 0.0 ) {\n		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );\n	}\n	return distanceFalloff;\n}\nfloat getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {\n	return smoothstep( coneCosine, penumbraCosine, angleCosine );\n}\n#if NUM_DIR_LIGHTS > 0\n	struct DirectionalLight {\n		vec3 direction;\n		vec3 color;\n	};\n	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];\n	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {\n		light.color = directionalLight.color;\n		light.direction = directionalLight.direction;\n		light.visible = true;\n	}\n#endif\n#if NUM_POINT_LIGHTS > 0\n	struct PointLight {\n		vec3 position;\n		vec3 color;\n		float distance;\n		float decay;\n	};\n	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];\n	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {\n		vec3 lVector = pointLight.position - geometryPosition;\n		light.direction = normalize( lVector );\n		float lightDistance = length( lVector );\n		light.color = pointLight.color;\n		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );\n		light.visible = ( light.color != vec3( 0.0 ) );\n	}\n#endif\n#if NUM_SPOT_LIGHTS > 0\n	struct SpotLight {\n		vec3 position;\n		vec3 direction;\n		vec3 color;\n		float distance;\n		float decay;\n		float coneCos;\n		float penumbraCos;\n	};\n	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];\n	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {\n		vec3 lVector = spotLight.position - geometryPosition;\n		light.direction = normalize( lVector );\n		float angleCos = dot( light.direction, spotLight.direction );\n		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );\n		if ( spotAttenuation > 0.0 ) {\n			float lightDistance = length( lVector );\n			light.color = spotLight.color * spotAttenuation;\n			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );\n			light.visible = ( light.color != vec3( 0.0 ) );\n		} else {\n			light.color = vec3( 0.0 );\n			light.visible = false;\n		}\n	}\n#endif\n#if NUM_RECT_AREA_LIGHTS > 0\n	struct RectAreaLight {\n		vec3 color;\n		vec3 position;\n		vec3 halfWidth;\n		vec3 halfHeight;\n	};\n	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;\n	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];\n#endif\n#if NUM_HEMI_LIGHTS > 0\n	struct HemisphereLight {\n		vec3 direction;\n		vec3 skyColor;\n		vec3 groundColor;\n	};\n	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];\n	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {\n		float dotNL = dot( normal, hemiLight.direction );\n		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;\n		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );\n		return irradiance;\n	}\n#endif\n#include <lightprobes_pars_fragment>",
	lights_toon_fragment: "ToonMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;",
	lights_toon_pars_fragment: "varying vec3 vViewPosition;\nstruct ToonMaterial {\n	vec3 diffuseColor;\n};\nvoid RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {\n	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;\n	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\nvoid RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\n#define RE_Direct				RE_Direct_Toon\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon",
	lights_phong_fragment: "BlinnPhongMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;\nmaterial.specularColor = specular;\nmaterial.specularShininess = shininess;\nmaterial.specularStrength = specularStrength;",
	lights_phong_pars_fragment: "varying vec3 vViewPosition;\nstruct BlinnPhongMaterial {\n	vec3 diffuseColor;\n	vec3 specularColor;\n	float specularShininess;\n	float specularStrength;\n};\nvoid RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {\n	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n	vec3 irradiance = dotNL * directLight.color;\n	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;\n}\nvoid RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}\n#define RE_Direct				RE_Direct_BlinnPhong\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong",
	lights_physical_fragment: "PhysicalMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;\nmaterial.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );\nmaterial.metalness = metalnessFactor;\nvec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );\nfloat geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );\nmaterial.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;\nmaterial.roughness = min( material.roughness, 1.0 );\n#ifdef IOR\n	material.ior = ior;\n	#ifdef USE_SPECULAR\n		float specularIntensityFactor = specularIntensity;\n		vec3 specularColorFactor = specularColor;\n		#ifdef USE_SPECULAR_COLORMAP\n			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;\n		#endif\n		#ifdef USE_SPECULAR_INTENSITYMAP\n			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;\n		#endif\n		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );\n	#else\n		float specularIntensityFactor = 1.0;\n		vec3 specularColorFactor = vec3( 1.0 );\n		material.specularF90 = 1.0;\n	#endif\n	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;\n	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );\n#else\n	material.specularColor = vec3( 0.04 );\n	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );\n	material.specularF90 = 1.0;\n#endif\n#ifdef USE_CLEARCOAT\n	material.clearcoat = clearcoat;\n	material.clearcoatRoughness = clearcoatRoughness;\n	material.clearcoatF0 = vec3( 0.04 );\n	material.clearcoatF90 = 1.0;\n	#ifdef USE_CLEARCOATMAP\n		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;\n	#endif\n	#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;\n	#endif\n	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );\n	material.clearcoatRoughness += geometryRoughness;\n	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );\n#endif\n#ifdef USE_DISPERSION\n	material.dispersion = dispersion;\n#endif\n#ifdef USE_IRIDESCENCE\n	material.iridescence = iridescence;\n	material.iridescenceIOR = iridescenceIOR;\n	#ifdef USE_IRIDESCENCEMAP\n		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;\n	#endif\n	#ifdef USE_IRIDESCENCE_THICKNESSMAP\n		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;\n	#else\n		material.iridescenceThickness = iridescenceThicknessMaximum;\n	#endif\n#endif\n#ifdef USE_SHEEN\n	material.sheenColor = sheenColor;\n	#ifdef USE_SHEEN_COLORMAP\n		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;\n	#endif\n	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );\n	#ifdef USE_SHEEN_ROUGHNESSMAP\n		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;\n	#endif\n#endif\n#ifdef USE_ANISOTROPY\n	#ifdef USE_ANISOTROPYMAP\n		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );\n		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;\n		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;\n	#else\n		vec2 anisotropyV = anisotropyVector;\n	#endif\n	material.anisotropy = length( anisotropyV );\n	if( material.anisotropy == 0.0 ) {\n		anisotropyV = vec2( 1.0, 0.0 );\n	} else {\n		anisotropyV /= material.anisotropy;\n		material.anisotropy = saturate( material.anisotropy );\n	}\n	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );\n	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;\n	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;\n#endif",
	lights_physical_pars_fragment: "uniform sampler2D dfgLUT;\nstruct PhysicalMaterial {\n	vec3 diffuseColor;\n	vec3 diffuseContribution;\n	vec3 specularColor;\n	vec3 specularColorBlended;\n	float roughness;\n	float metalness;\n	float specularF90;\n	float dispersion;\n	#ifdef USE_CLEARCOAT\n		float clearcoat;\n		float clearcoatRoughness;\n		vec3 clearcoatF0;\n		float clearcoatF90;\n	#endif\n	#ifdef USE_IRIDESCENCE\n		float iridescence;\n		float iridescenceIOR;\n		float iridescenceThickness;\n		vec3 iridescenceFresnel;\n		vec3 iridescenceF0;\n		vec3 iridescenceFresnelDielectric;\n		vec3 iridescenceFresnelMetallic;\n	#endif\n	#ifdef USE_SHEEN\n		vec3 sheenColor;\n		float sheenRoughness;\n	#endif\n	#ifdef IOR\n		float ior;\n	#endif\n	#ifdef USE_TRANSMISSION\n		float transmission;\n		float transmissionAlpha;\n		float thickness;\n		float attenuationDistance;\n		vec3 attenuationColor;\n	#endif\n	#ifdef USE_ANISOTROPY\n		float anisotropy;\n		float alphaT;\n		vec3 anisotropyT;\n		vec3 anisotropyB;\n	#endif\n};\nvec3 clearcoatSpecularDirect = vec3( 0.0 );\nvec3 clearcoatSpecularIndirect = vec3( 0.0 );\nvec3 sheenSpecularDirect = vec3( 0.0 );\nvec3 sheenSpecularIndirect = vec3(0.0 );\nvec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {\n    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );\n    float x2 = x * x;\n    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );\n    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );\n}\nfloat V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {\n	float a2 = pow2( alpha );\n	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );\n	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );\n	return 0.5 / max( gv + gl, EPSILON );\n}\nfloat D_GGX( const in float alpha, const in float dotNH ) {\n	float a2 = pow2( alpha );\n	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;\n	return RECIPROCAL_PI * a2 / pow2( denom );\n}\n#ifdef USE_ANISOTROPY\n	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {\n		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );\n		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );\n		return 0.5 / max( gv + gl, EPSILON );\n	}\n	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {\n		float a2 = alphaT * alphaB;\n		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );\n		highp float v2 = dot( v, v );\n		float w2 = a2 / v2;\n		return RECIPROCAL_PI * a2 * pow2 ( w2 );\n	}\n#endif\n#ifdef USE_CLEARCOAT\n	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {\n		vec3 f0 = material.clearcoatF0;\n		float f90 = material.clearcoatF90;\n		float roughness = material.clearcoatRoughness;\n		float alpha = pow2( roughness );\n		vec3 halfDir = normalize( lightDir + viewDir );\n		float dotNL = saturate( dot( normal, lightDir ) );\n		float dotNV = saturate( dot( normal, viewDir ) );\n		float dotNH = saturate( dot( normal, halfDir ) );\n		float dotVH = saturate( dot( viewDir, halfDir ) );\n		vec3 F = F_Schlick( f0, f90, dotVH );\n		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );\n		float D = D_GGX( alpha, dotNH );\n		return F * ( V * D );\n	}\n#endif\nvec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {\n	vec3 f0 = material.specularColorBlended;\n	float f90 = material.specularF90;\n	float roughness = material.roughness;\n	float alpha = pow2( roughness );\n	vec3 halfDir = normalize( lightDir + viewDir );\n	float dotNL = saturate( dot( normal, lightDir ) );\n	float dotNV = saturate( dot( normal, viewDir ) );\n	float dotNH = saturate( dot( normal, halfDir ) );\n	float dotVH = saturate( dot( viewDir, halfDir ) );\n	vec3 F = F_Schlick( f0, f90, dotVH );\n	#ifdef USE_IRIDESCENCE\n		F = mix( F, material.iridescenceFresnel, material.iridescence );\n	#endif\n	#ifdef USE_ANISOTROPY\n		float dotTL = dot( material.anisotropyT, lightDir );\n		float dotTV = dot( material.anisotropyT, viewDir );\n		float dotTH = dot( material.anisotropyT, halfDir );\n		float dotBL = dot( material.anisotropyB, lightDir );\n		float dotBV = dot( material.anisotropyB, viewDir );\n		float dotBH = dot( material.anisotropyB, halfDir );\n		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );\n		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );\n	#else\n		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );\n		float D = D_GGX( alpha, dotNH );\n	#endif\n	return F * ( V * D );\n}\nvec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {\n	const float LUT_SIZE = 64.0;\n	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;\n	const float LUT_BIAS = 0.5 / LUT_SIZE;\n	float dotNV = saturate( dot( N, V ) );\n	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );\n	uv = uv * LUT_SCALE + LUT_BIAS;\n	return uv;\n}\nfloat LTC_ClippedSphereFormFactor( const in vec3 f ) {\n	float l = length( f );\n	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );\n}\nvec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {\n	float x = dot( v1, v2 );\n	float y = abs( x );\n	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;\n	float b = 3.4175940 + ( 4.1616724 + y ) * y;\n	float v = a / b;\n	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;\n	return cross( v1, v2 ) * theta_sintheta;\n}\nvec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {\n	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];\n	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];\n	vec3 lightNormal = cross( v1, v2 );\n	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );\n	vec3 T1, T2;\n	T1 = normalize( V - N * dot( V, N ) );\n	T2 = - cross( N, T1 );\n	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );\n	vec3 coords[ 4 ];\n	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );\n	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );\n	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );\n	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );\n	coords[ 0 ] = normalize( coords[ 0 ] );\n	coords[ 1 ] = normalize( coords[ 1 ] );\n	coords[ 2 ] = normalize( coords[ 2 ] );\n	coords[ 3 ] = normalize( coords[ 3 ] );\n	vec3 vectorFormFactor = vec3( 0.0 );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );\n	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );\n	return vec3( result );\n}\n#if defined( USE_SHEEN )\nfloat D_Charlie( float roughness, float dotNH ) {\n	float alpha = pow2( roughness );\n	float invAlpha = 1.0 / alpha;\n	float cos2h = dotNH * dotNH;\n	float sin2h = max( 1.0 - cos2h, 0.0078125 );\n	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );\n}\nfloat V_Neubelt( float dotNV, float dotNL ) {\n	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );\n}\nvec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {\n	vec3 halfDir = normalize( lightDir + viewDir );\n	float dotNL = saturate( dot( normal, lightDir ) );\n	float dotNV = saturate( dot( normal, viewDir ) );\n	float dotNH = saturate( dot( normal, halfDir ) );\n	float D = D_Charlie( sheenRoughness, dotNH );\n	float V = V_Neubelt( dotNV, dotNL );\n	return sheenColor * ( D * V );\n}\n#endif\nfloat IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {\n	float dotNV = saturate( dot( normal, viewDir ) );\n	float r2 = roughness * roughness;\n	float rInv = 1.0 / ( roughness + 0.1 );\n	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;\n	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;\n	float DG = exp( a * dotNV + b );\n	return saturate( DG );\n}\nvec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {\n	float dotNV = saturate( dot( normal, viewDir ) );\n	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;\n	return specularColor * fab.x + specularF90 * fab.y;\n}\n#ifdef USE_IRIDESCENCE\nvoid computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {\n#else\nvoid computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {\n#endif\n	float dotNV = saturate( dot( normal, viewDir ) );\n	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;\n	#ifdef USE_IRIDESCENCE\n		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );\n	#else\n		vec3 Fr = specularColor;\n	#endif\n	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;\n	float Ess = fab.x + fab.y;\n	float Ems = 1.0 - Ess;\n	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );\n	singleScatter += FssEss;\n	multiScatter += Fms * Ems;\n}\nvec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {\n	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );\n	float dotNL = saturate( dot( normal, lightDir ) );\n	float dotNV = saturate( dot( normal, viewDir ) );\n	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;\n	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;\n	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;\n	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;\n	float Ess_V = dfgV.x + dfgV.y;\n	float Ess_L = dfgL.x + dfgL.y;\n	float Ems_V = 1.0 - Ess_V;\n	float Ems_L = 1.0 - Ess_L;\n	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;\n	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );\n	float compensationFactor = Ems_V * Ems_L;\n	vec3 multiScatter = Fms * compensationFactor;\n	return singleScatter + multiScatter;\n}\n#if NUM_RECT_AREA_LIGHTS > 0\n	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n		vec3 normal = geometryNormal;\n		vec3 viewDir = geometryViewDir;\n		vec3 position = geometryPosition;\n		vec3 lightPos = rectAreaLight.position;\n		vec3 halfWidth = rectAreaLight.halfWidth;\n		vec3 halfHeight = rectAreaLight.halfHeight;\n		vec3 lightColor = rectAreaLight.color;\n		float roughness = material.roughness;\n		vec3 rectCoords[ 4 ];\n		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;\n		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;\n		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;\n		vec2 uv = LTC_Uv( normal, viewDir, roughness );\n		vec4 t1 = texture2D( ltc_1, uv );\n		vec4 t2 = texture2D( ltc_2, uv );\n		mat3 mInv = mat3(\n			vec3( t1.x, 0, t1.y ),\n			vec3(    0, 1,    0 ),\n			vec3( t1.z, 0, t1.w )\n		);\n		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );\n		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );\n		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );\n		#ifdef USE_CLEARCOAT\n			vec3 Ncc = geometryClearcoatNormal;\n			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );\n			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );\n			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );\n			mat3 mInvClearcoat = mat3(\n				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),\n				vec3(             0, 1,             0 ),\n				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )\n			);\n			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;\n			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );\n		#endif\n	}\n#endif\nvoid RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n	vec3 irradiance = dotNL * directLight.color;\n	#ifdef USE_CLEARCOAT\n		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );\n		vec3 ccIrradiance = dotNLcc * directLight.color;\n		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );\n	#endif\n	#ifdef USE_SHEEN\n \n 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );\n \n 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );\n 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );\n \n 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );\n \n 		irradiance *= sheenEnergyComp;\n \n 	#endif\n	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );\n	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );\n}\nvoid RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );\n	#ifdef USE_SHEEN\n		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );\n		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;\n		diffuse *= sheenEnergyComp;\n	#endif\n	reflectedLight.indirectDiffuse += diffuse;\n}\nvoid RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {\n	#ifdef USE_CLEARCOAT\n		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );\n	#endif\n	#ifdef USE_SHEEN\n		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;\n 	#endif\n	vec3 singleScatteringDielectric = vec3( 0.0 );\n	vec3 multiScatteringDielectric = vec3( 0.0 );\n	vec3 singleScatteringMetallic = vec3( 0.0 );\n	vec3 multiScatteringMetallic = vec3( 0.0 );\n	#ifdef USE_IRIDESCENCE\n		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );\n		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );\n	#else\n		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );\n		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );\n	#endif\n	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );\n	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );\n	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;\n	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );\n	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;\n	vec3 indirectSpecular = radiance * singleScattering;\n	indirectSpecular += multiScattering * cosineWeightedIrradiance;\n	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;\n	#ifdef USE_SHEEN\n		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );\n		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;\n		indirectSpecular *= sheenEnergyComp;\n		indirectDiffuse *= sheenEnergyComp;\n	#endif\n	reflectedLight.indirectSpecular += indirectSpecular;\n	reflectedLight.indirectDiffuse += indirectDiffuse;\n}\n#define RE_Direct				RE_Direct_Physical\n#define RE_Direct_RectArea		RE_Direct_RectArea_Physical\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical\n#define RE_IndirectSpecular		RE_IndirectSpecular_Physical\nfloat computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {\n	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );\n}",
	lights_fragment_begin: "\nvec3 geometryPosition = - vViewPosition;\nvec3 geometryNormal = normal;\nvec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );\nvec3 geometryClearcoatNormal = vec3( 0.0 );\n#ifdef USE_CLEARCOAT\n	geometryClearcoatNormal = clearcoatNormal;\n#endif\n#ifdef USE_IRIDESCENCE\n	float dotNVi = saturate( dot( normal, geometryViewDir ) );\n	if ( material.iridescenceThickness == 0.0 ) {\n		material.iridescence = 0.0;\n	} else {\n		material.iridescence = saturate( material.iridescence );\n	}\n	if ( material.iridescence > 0.0 ) {\n		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );\n		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );\n		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );\n		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );\n	}\n#endif\nIncidentLight directLight;\n#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )\n	PointLight pointLight;\n	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0\n	PointLightShadow pointLightShadow;\n	#endif\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\n		pointLight = pointLights[ i ];\n		getPointLightInfo( pointLight, geometryPosition, directLight );\n		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )\n		pointLightShadow = pointLightShadows[ i ];\n		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;\n		#endif\n		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )\n	SpotLight spotLight;\n	vec4 spotColor;\n	vec3 spotLightCoord;\n	bool inSpotLightMap;\n	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0\n	SpotLightShadow spotLightShadow;\n	#endif\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\n		spotLight = spotLights[ i ];\n		getSpotLightInfo( spotLight, geometryPosition, directLight );\n		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )\n		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX\n		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS\n		#else\n		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )\n		#endif\n		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )\n			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;\n			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );\n			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );\n			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;\n		#endif\n		#undef SPOT_LIGHT_MAP_INDEX\n		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n		spotLightShadow = spotLightShadows[ i ];\n		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;\n		#endif\n		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )\n	DirectionalLight directionalLight;\n	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0\n	DirectionalLightShadow directionalLightShadow;\n	#endif\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n		directionalLight = directionalLights[ i ];\n		getDirectionalLightInfo( directionalLight, directLight );\n		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )\n		directionalLightShadow = directionalLightShadows[ i ];\n		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n		#endif\n		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )\n	RectAreaLight rectAreaLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {\n		rectAreaLight = rectAreaLights[ i ];\n		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if defined( RE_IndirectDiffuse )\n	vec3 iblIrradiance = vec3( 0.0 );\n	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );\n	#if defined( USE_LIGHT_PROBES )\n		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );\n	#endif\n	#if ( NUM_HEMI_LIGHTS > 0 )\n		#pragma unroll_loop_start\n		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {\n			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );\n		}\n		#pragma unroll_loop_end\n	#endif\n	#ifdef USE_LIGHT_PROBES_GRID\n		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;\n		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );\n		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );\n	#endif\n#endif\n#if defined( RE_IndirectSpecular )\n	vec3 radiance = vec3( 0.0 );\n	vec3 clearcoatRadiance = vec3( 0.0 );\n#endif",
	lights_fragment_maps: "#if defined( RE_IndirectDiffuse )\n	#ifdef USE_LIGHTMAP\n		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );\n		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;\n		irradiance += lightMapIrradiance;\n	#endif\n	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )\n		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )\n			iblIrradiance += getIBLIrradiance( geometryNormal );\n		#endif\n	#endif\n#endif\n#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )\n	#ifdef USE_ANISOTROPY\n		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );\n	#else\n		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );\n	#endif\n	#ifdef USE_CLEARCOAT\n		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );\n	#endif\n#endif",
	lights_fragment_end: "#if defined( RE_IndirectDiffuse )\n	#if defined( LAMBERT ) || defined( PHONG )\n		irradiance += iblIrradiance;\n	#endif\n	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n#endif\n#if defined( RE_IndirectSpecular )\n	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\n#endif",
	lightprobes_pars_fragment: "#ifdef USE_LIGHT_PROBES_GRID\nuniform highp sampler3D probesSH;\nuniform vec3 probesMin;\nuniform vec3 probesMax;\nuniform vec3 probesResolution;\nvec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {\n	vec3 res = probesResolution;\n	vec3 gridRange = probesMax - probesMin;\n	vec3 resMinusOne = res - 1.0;\n	vec3 probeSpacing = gridRange / resMinusOne;\n	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;\n	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );\n	uvw = uvw * resMinusOne / res + 0.5 / res;\n	float nz          = res.z;\n	float paddedSlices = nz + 2.0;\n	float atlasDepth  = 7.0 * paddedSlices;\n	float uvZBase     = uvw.z * nz + 1.0;\n	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );\n	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );\n	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );\n	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );\n	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );\n	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );\n	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );\n	vec3 c0 = s0.xyz;\n	vec3 c1 = vec3( s0.w, s1.xy );\n	vec3 c2 = vec3( s1.zw, s2.x );\n	vec3 c3 = s2.yzw;\n	vec3 c4 = s3.xyz;\n	vec3 c5 = vec3( s3.w, s4.xy );\n	vec3 c6 = vec3( s4.zw, s5.x );\n	vec3 c7 = s5.yzw;\n	vec3 c8 = s6.xyz;\n	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;\n	vec3 result = c0 * 0.886227;\n	result += c1 * 2.0 * 0.511664 * y;\n	result += c2 * 2.0 * 0.511664 * z;\n	result += c3 * 2.0 * 0.511664 * x;\n	result += c4 * 2.0 * 0.429043 * x * y;\n	result += c5 * 2.0 * 0.429043 * y * z;\n	result += c6 * ( 0.743125 * z * z - 0.247708 );\n	result += c7 * 2.0 * 0.429043 * x * z;\n	result += c8 * 0.429043 * ( x * x - y * y );\n	return max( result, vec3( 0.0 ) );\n}\n#endif",
	logdepthbuf_fragment: "#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )\n	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;\n#endif",
	logdepthbuf_pars_fragment: "#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )\n	uniform float logDepthBufFC;\n	varying float vFragDepth;\n	varying float vIsPerspective;\n#endif",
	logdepthbuf_pars_vertex: "#ifdef USE_LOGARITHMIC_DEPTH_BUFFER\n	varying float vFragDepth;\n	varying float vIsPerspective;\n#endif",
	logdepthbuf_vertex: "#ifdef USE_LOGARITHMIC_DEPTH_BUFFER\n	vFragDepth = 1.0 + gl_Position.w;\n	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );\n#endif",
	map_fragment: "#ifdef USE_MAP\n	vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n	#ifdef DECODE_VIDEO_TEXTURE\n		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );\n	#endif\n	diffuseColor *= sampledDiffuseColor;\n#endif",
	map_pars_fragment: "#ifdef USE_MAP\n	uniform sampler2D map;\n#endif",
	map_particle_fragment: "#if defined( USE_MAP ) || defined( USE_ALPHAMAP )\n	#if defined( USE_POINTS_UV )\n		vec2 uv = vUv;\n	#else\n		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;\n	#endif\n#endif\n#ifdef USE_MAP\n	diffuseColor *= texture2D( map, uv );\n#endif\n#ifdef USE_ALPHAMAP\n	diffuseColor.a *= texture2D( alphaMap, uv ).g;\n#endif",
	map_particle_pars_fragment: "#if defined( USE_POINTS_UV )\n	varying vec2 vUv;\n#else\n	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )\n		uniform mat3 uvTransform;\n	#endif\n#endif\n#ifdef USE_MAP\n	uniform sampler2D map;\n#endif\n#ifdef USE_ALPHAMAP\n	uniform sampler2D alphaMap;\n#endif",
	metalnessmap_fragment: "float metalnessFactor = metalness;\n#ifdef USE_METALNESSMAP\n	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );\n	metalnessFactor *= texelMetalness.b;\n#endif",
	metalnessmap_pars_fragment: "#ifdef USE_METALNESSMAP\n	uniform sampler2D metalnessMap;\n#endif",
	morphinstance_vertex: "#ifdef USE_INSTANCING_MORPH\n	float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;\n	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;\n	}\n#endif",
	morphcolor_vertex: "#if defined( USE_MORPHCOLORS )\n	vColor *= morphTargetBaseInfluence;\n	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n		#if defined( USE_COLOR_ALPHA )\n			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];\n		#elif defined( USE_COLOR )\n			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];\n		#endif\n	}\n#endif",
	morphnormal_vertex: "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];\n	}\n#endif",
	morphtarget_pars_vertex: "#ifdef USE_MORPHTARGETS\n	#ifndef USE_INSTANCING_MORPH\n		uniform float morphTargetBaseInfluence;\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n	#endif\n	uniform sampler2DArray morphTargetsTexture;\n	uniform ivec2 morphTargetsTextureSize;\n	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {\n		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;\n		int y = texelIndex / morphTargetsTextureSize.x;\n		int x = texelIndex - y * morphTargetsTextureSize.x;\n		ivec3 morphUV = ivec3( x, y, morphTargetIndex );\n		return texelFetch( morphTargetsTexture, morphUV, 0 );\n	}\n#endif",
	morphtarget_vertex: "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];\n	}\n#endif",
	normal_fragment_begin: "float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;\n#ifdef FLAT_SHADED\n	vec3 fdx = dFdx( vViewPosition );\n	vec3 fdy = dFdy( vViewPosition );\n	vec3 normal = normalize( cross( fdx, fdy ) );\n#else\n	vec3 normal = normalize( vNormal );\n	#ifdef DOUBLE_SIDED\n		normal *= faceDirection;\n	#endif\n#endif\n#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )\n	#ifdef USE_TANGENT\n		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );\n	#else\n		mat3 tbn = getTangentFrame( - vViewPosition, normal,\n		#if defined( USE_NORMALMAP )\n			vNormalMapUv\n		#elif defined( USE_CLEARCOAT_NORMALMAP )\n			vClearcoatNormalMapUv\n		#else\n			vUv\n		#endif\n		);\n	#endif\n	#ifdef DOUBLE_SIDED\n		tbn[0] *= faceDirection;\n		tbn[1] *= faceDirection;\n	#endif\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	#ifdef USE_TANGENT\n		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );\n	#else\n		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );\n	#endif\n	#ifdef DOUBLE_SIDED\n		tbn2[0] *= faceDirection;\n		tbn2[1] *= faceDirection;\n	#endif\n#endif\nvec3 nonPerturbedNormal = normal;",
	normal_fragment_maps: "#ifdef USE_NORMALMAP_OBJECTSPACE\n	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;\n	#ifdef FLIP_SIDED\n		normal = - normal;\n	#endif\n	#ifdef DOUBLE_SIDED\n		normal = normal * faceDirection;\n	#endif\n	normal = normalize( normalMatrix * normal );\n#elif defined( USE_NORMALMAP_TANGENTSPACE )\n	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;\n	#if defined( USE_PACKED_NORMALMAP )\n		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );\n	#endif\n	mapN.xy *= normalScale;\n	normal = normalize( tbn * mapN );\n#elif defined( USE_BUMPMAP )\n	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );\n#endif",
	normal_pars_fragment: "#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n	#ifdef USE_TANGENT\n		varying vec3 vTangent;\n		varying vec3 vBitangent;\n	#endif\n#endif",
	normal_pars_vertex: "#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n	#ifdef USE_TANGENT\n		varying vec3 vTangent;\n		varying vec3 vBitangent;\n	#endif\n#endif",
	normal_vertex: "#ifndef FLAT_SHADED\n	vNormal = normalize( transformedNormal );\n	#ifdef USE_TANGENT\n		vTangent = normalize( transformedTangent );\n		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );\n		#ifdef FLIP_SIDED\n			vBitangent = - vBitangent;\n		#endif\n	#endif\n#endif",
	normalmap_pars_fragment: "#ifdef USE_NORMALMAP\n	uniform sampler2D normalMap;\n	uniform vec2 normalScale;\n#endif\n#ifdef USE_NORMALMAP_OBJECTSPACE\n	uniform mat3 normalMatrix;\n#endif\n#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )\n	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {\n		vec3 q0 = dFdx( eye_pos.xyz );\n		vec3 q1 = dFdy( eye_pos.xyz );\n		vec2 st0 = dFdx( uv.st );\n		vec2 st1 = dFdy( uv.st );\n		vec3 N = surf_norm;\n		vec3 q1perp = cross( q1, N );\n		vec3 q0perp = cross( N, q0 );\n		vec3 T = q1perp * st0.x + q0perp * st1.x;\n		vec3 B = q1perp * st0.y + q0perp * st1.y;\n		float det = max( dot( T, T ), dot( B, B ) );\n		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );\n		return mat3( T * scale, B * scale, N );\n	}\n#endif",
	clearcoat_normal_fragment_begin: "#ifdef USE_CLEARCOAT\n	vec3 clearcoatNormal = nonPerturbedNormal;\n#endif",
	clearcoat_normal_fragment_maps: "#ifdef USE_CLEARCOAT_NORMALMAP\n	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;\n	clearcoatMapN.xy *= clearcoatNormalScale;\n	clearcoatNormal = normalize( tbn2 * clearcoatMapN );\n#endif",
	clearcoat_pars_fragment: "#ifdef USE_CLEARCOATMAP\n	uniform sampler2D clearcoatMap;\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	uniform sampler2D clearcoatNormalMap;\n	uniform vec2 clearcoatNormalScale;\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n	uniform sampler2D clearcoatRoughnessMap;\n#endif",
	iridescence_pars_fragment: "#ifdef USE_IRIDESCENCEMAP\n	uniform sampler2D iridescenceMap;\n#endif\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n	uniform sampler2D iridescenceThicknessMap;\n#endif",
	opaque_fragment: "#ifdef OPAQUE\ndiffuseColor.a = 1.0;\n#endif\n#ifdef USE_TRANSMISSION\ndiffuseColor.a *= material.transmissionAlpha;\n#endif\ngl_FragColor = vec4( outgoingLight, diffuseColor.a );",
	packing: "vec3 packNormalToRGB( const in vec3 normal ) {\n	return normalize( normal ) * 0.5 + 0.5;\n}\nvec3 unpackRGBToNormal( const in vec3 rgb ) {\n	return 2.0 * rgb.xyz - 1.0;\n}\nconst float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;\nconst float Inv255 = 1. / 255.;\nconst vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );\nconst vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );\nconst vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );\nconst vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );\nvec4 packDepthToRGBA( const in float v ) {\n	if( v <= 0.0 )\n		return vec4( 0., 0., 0., 0. );\n	if( v >= 1.0 )\n		return vec4( 1., 1., 1., 1. );\n	float vuf;\n	float af = modf( v * PackFactors.a, vuf );\n	float bf = modf( vuf * ShiftRight8, vuf );\n	float gf = modf( vuf * ShiftRight8, vuf );\n	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );\n}\nvec3 packDepthToRGB( const in float v ) {\n	if( v <= 0.0 )\n		return vec3( 0., 0., 0. );\n	if( v >= 1.0 )\n		return vec3( 1., 1., 1. );\n	float vuf;\n	float bf = modf( v * PackFactors.b, vuf );\n	float gf = modf( vuf * ShiftRight8, vuf );\n	return vec3( vuf * Inv255, gf * PackUpscale, bf );\n}\nvec2 packDepthToRG( const in float v ) {\n	if( v <= 0.0 )\n		return vec2( 0., 0. );\n	if( v >= 1.0 )\n		return vec2( 1., 1. );\n	float vuf;\n	float gf = modf( v * 256., vuf );\n	return vec2( vuf * Inv255, gf );\n}\nfloat unpackRGBAToDepth( const in vec4 v ) {\n	return dot( v, UnpackFactors4 );\n}\nfloat unpackRGBToDepth( const in vec3 v ) {\n	return dot( v, UnpackFactors3 );\n}\nfloat unpackRGToDepth( const in vec2 v ) {\n	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;\n}\nvec4 pack2HalfToRGBA( const in vec2 v ) {\n	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );\n	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );\n}\nvec2 unpackRGBATo2Half( const in vec4 v ) {\n	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );\n}\nfloat viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {\n	return ( viewZ + near ) / ( near - far );\n}\nfloat orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {\n	#ifdef USE_REVERSED_DEPTH_BUFFER\n	\n		return depth * ( far - near ) - far;\n	#else\n		return depth * ( near - far ) - near;\n	#endif\n}\nfloat viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {\n	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );\n}\nfloat perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {\n	\n	#ifdef USE_REVERSED_DEPTH_BUFFER\n		return ( near * far ) / ( ( near - far ) * depth - near );\n	#else\n		return ( near * far ) / ( ( far - near ) * depth - far );\n	#endif\n}",
	premultiplied_alpha_fragment: "#ifdef PREMULTIPLIED_ALPHA\n	gl_FragColor.rgb *= gl_FragColor.a;\n#endif",
	project_vertex: "vec4 mvPosition = vec4( transformed, 1.0 );\n#ifdef USE_BATCHING\n	mvPosition = batchingMatrix * mvPosition;\n#endif\n#ifdef USE_INSTANCING\n	mvPosition = instanceMatrix * mvPosition;\n#endif\nmvPosition = modelViewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;",
	dithering_fragment: "#ifdef DITHERING\n	gl_FragColor.rgb = dithering( gl_FragColor.rgb );\n#endif",
	dithering_pars_fragment: "#ifdef DITHERING\n	vec3 dithering( vec3 color ) {\n		float grid_position = rand( gl_FragCoord.xy );\n		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );\n		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );\n		return color + dither_shift_RGB;\n	}\n#endif",
	roughnessmap_fragment: "float roughnessFactor = roughness;\n#ifdef USE_ROUGHNESSMAP\n	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );\n	roughnessFactor *= texelRoughness.g;\n#endif",
	roughnessmap_pars_fragment: "#ifdef USE_ROUGHNESSMAP\n	uniform sampler2D roughnessMap;\n#endif",
	shadowmap_pars_fragment: "#if NUM_SPOT_LIGHT_COORDS > 0\n	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];\n#endif\n#if NUM_SPOT_LIGHT_MAPS > 0\n	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];\n#endif\n#ifdef USE_SHADOWMAP\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n		#if defined( SHADOWMAP_TYPE_PCF )\n			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];\n		#else\n			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];\n		#endif\n		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];\n		struct DirectionalLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n		#if defined( SHADOWMAP_TYPE_PCF )\n			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];\n		#else\n			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];\n		#endif\n		struct SpotLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n		#if defined( SHADOWMAP_TYPE_PCF )\n			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];\n		#elif defined( SHADOWMAP_TYPE_BASIC )\n			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];\n		#endif\n		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];\n		struct PointLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n			float shadowCameraNear;\n			float shadowCameraFar;\n		};\n		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];\n	#endif\n	#if defined( SHADOWMAP_TYPE_PCF )\n		float interleavedGradientNoise( vec2 position ) {\n			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );\n		}\n		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {\n			const float goldenAngle = 2.399963229728653;\n			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );\n			float theta = float( sampleIndex ) * goldenAngle + phi;\n			return vec2( cos( theta ), sin( theta ) ) * r;\n		}\n	#endif\n	#if defined( SHADOWMAP_TYPE_PCF )\n		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {\n			float shadow = 1.0;\n			shadowCoord.xyz /= shadowCoord.w;\n			shadowCoord.z += shadowBias;\n			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;\n			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;\n			if ( frustumTest ) {\n				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;\n				float radius = shadowRadius * texelSize.x;\n				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;\n				shadow = (\n					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +\n					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +\n					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +\n					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +\n					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )\n				) * 0.2;\n			}\n			return mix( 1.0, shadow, shadowIntensity );\n		}\n	#elif defined( SHADOWMAP_TYPE_VSM )\n		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {\n			float shadow = 1.0;\n			shadowCoord.xyz /= shadowCoord.w;\n			#ifdef USE_REVERSED_DEPTH_BUFFER\n				shadowCoord.z -= shadowBias;\n			#else\n				shadowCoord.z += shadowBias;\n			#endif\n			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;\n			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;\n			if ( frustumTest ) {\n				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;\n				float mean = distribution.x;\n				float variance = distribution.y * distribution.y;\n				#ifdef USE_REVERSED_DEPTH_BUFFER\n					float hard_shadow = step( mean, shadowCoord.z );\n				#else\n					float hard_shadow = step( shadowCoord.z, mean );\n				#endif\n				\n				if ( hard_shadow == 1.0 ) {\n					shadow = 1.0;\n				} else {\n					variance = max( variance, 0.0000001 );\n					float d = shadowCoord.z - mean;\n					float p_max = variance / ( variance + d * d );\n					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );\n					shadow = max( hard_shadow, p_max );\n				}\n			}\n			return mix( 1.0, shadow, shadowIntensity );\n		}\n	#else\n		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {\n			float shadow = 1.0;\n			shadowCoord.xyz /= shadowCoord.w;\n			#ifdef USE_REVERSED_DEPTH_BUFFER\n				shadowCoord.z -= shadowBias;\n			#else\n				shadowCoord.z += shadowBias;\n			#endif\n			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;\n			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;\n			if ( frustumTest ) {\n				float depth = texture2D( shadowMap, shadowCoord.xy ).r;\n				#ifdef USE_REVERSED_DEPTH_BUFFER\n					shadow = step( depth, shadowCoord.z );\n				#else\n					shadow = step( shadowCoord.z, depth );\n				#endif\n			}\n			return mix( 1.0, shadow, shadowIntensity );\n		}\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n	#if defined( SHADOWMAP_TYPE_PCF )\n	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {\n		float shadow = 1.0;\n		vec3 lightToPosition = shadowCoord.xyz;\n		vec3 bd3D = normalize( lightToPosition );\n		vec3 absVec = abs( lightToPosition );\n		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );\n		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {\n			#ifdef USE_REVERSED_DEPTH_BUFFER\n				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );\n				dp -= shadowBias;\n			#else\n				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );\n				dp += shadowBias;\n			#endif\n			float texelSize = shadowRadius / shadowMapSize.x;\n			vec3 absDir = abs( bd3D );\n			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );\n			tangent = normalize( cross( bd3D, tangent ) );\n			vec3 bitangent = cross( bd3D, tangent );\n			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;\n			vec2 sample0 = vogelDiskSample( 0, 5, phi );\n			vec2 sample1 = vogelDiskSample( 1, 5, phi );\n			vec2 sample2 = vogelDiskSample( 2, 5, phi );\n			vec2 sample3 = vogelDiskSample( 3, 5, phi );\n			vec2 sample4 = vogelDiskSample( 4, 5, phi );\n			shadow = (\n				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +\n				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +\n				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +\n				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +\n				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )\n			) * 0.2;\n		}\n		return mix( 1.0, shadow, shadowIntensity );\n	}\n	#elif defined( SHADOWMAP_TYPE_BASIC )\n	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {\n		float shadow = 1.0;\n		vec3 lightToPosition = shadowCoord.xyz;\n		vec3 absVec = abs( lightToPosition );\n		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );\n		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {\n			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );\n			dp += shadowBias;\n			vec3 bd3D = normalize( lightToPosition );\n			float depth = textureCube( shadowMap, bd3D ).r;\n			#ifdef USE_REVERSED_DEPTH_BUFFER\n				depth = 1.0 - depth;\n			#endif\n			shadow = step( dp, depth );\n		}\n		return mix( 1.0, shadow, shadowIntensity );\n	}\n	#endif\n	#endif\n#endif",
	shadowmap_pars_vertex: "#if NUM_SPOT_LIGHT_COORDS > 0\n	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];\n	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];\n#endif\n#ifdef USE_SHADOWMAP\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];\n		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];\n		struct DirectionalLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n		struct SpotLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];\n		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];\n		struct PointLightShadow {\n			float shadowIntensity;\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n			float shadowCameraNear;\n			float shadowCameraFar;\n		};\n		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];\n	#endif\n#endif",
	shadowmap_vertex: "#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )\n	#ifdef HAS_NORMAL\n		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );\n	#else\n		vec3 shadowWorldNormal = vec3( 0.0 );\n	#endif\n	vec4 shadowWorldPosition;\n#endif\n#if defined( USE_SHADOWMAP )\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n		#pragma unroll_loop_start\n		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {\n			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );\n			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;\n		}\n		#pragma unroll_loop_end\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n		#pragma unroll_loop_start\n		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {\n			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );\n			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;\n		}\n		#pragma unroll_loop_end\n	#endif\n#endif\n#if NUM_SPOT_LIGHT_COORDS > 0\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {\n		shadowWorldPosition = worldPosition;\n		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;\n		#endif\n		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;\n	}\n	#pragma unroll_loop_end\n#endif",
	shadowmask_pars_fragment: "float getShadowMask() {\n	float shadow = 1.0;\n	#ifdef USE_SHADOWMAP\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n	DirectionalLightShadow directionalLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {\n		directionalLight = directionalLightShadows[ i ];\n		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n	}\n	#pragma unroll_loop_end\n	#endif\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n	SpotLightShadow spotLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {\n		spotLight = spotLightShadows[ i ];\n		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;\n	}\n	#pragma unroll_loop_end\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )\n	PointLightShadow pointLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {\n		pointLight = pointLightShadows[ i ];\n		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;\n	}\n	#pragma unroll_loop_end\n	#endif\n	#endif\n	return shadow;\n}",
	skinbase_vertex: "#ifdef USE_SKINNING\n	mat4 boneMatX = getBoneMatrix( skinIndex.x );\n	mat4 boneMatY = getBoneMatrix( skinIndex.y );\n	mat4 boneMatZ = getBoneMatrix( skinIndex.z );\n	mat4 boneMatW = getBoneMatrix( skinIndex.w );\n#endif",
	skinning_pars_vertex: "#ifdef USE_SKINNING\n	uniform mat4 bindMatrix;\n	uniform mat4 bindMatrixInverse;\n	uniform highp sampler2D boneTexture;\n	mat4 getBoneMatrix( const in float i ) {\n		int size = textureSize( boneTexture, 0 ).x;\n		int j = int( i ) * 4;\n		int x = j % size;\n		int y = j / size;\n		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );\n		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );\n		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );\n		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );\n		return mat4( v1, v2, v3, v4 );\n	}\n#endif",
	skinning_vertex: "#ifdef USE_SKINNING\n	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );\n	vec4 skinned = vec4( 0.0 );\n	skinned += boneMatX * skinVertex * skinWeight.x;\n	skinned += boneMatY * skinVertex * skinWeight.y;\n	skinned += boneMatZ * skinVertex * skinWeight.z;\n	skinned += boneMatW * skinVertex * skinWeight.w;\n	transformed = ( bindMatrixInverse * skinned ).xyz;\n#endif",
	skinnormal_vertex: "#ifdef USE_SKINNING\n	mat4 skinMatrix = mat4( 0.0 );\n	skinMatrix += skinWeight.x * boneMatX;\n	skinMatrix += skinWeight.y * boneMatY;\n	skinMatrix += skinWeight.z * boneMatZ;\n	skinMatrix += skinWeight.w * boneMatW;\n	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;\n	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;\n	#ifdef USE_TANGENT\n		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;\n	#endif\n#endif",
	specularmap_fragment: "float specularStrength;\n#ifdef USE_SPECULARMAP\n	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );\n	specularStrength = texelSpecular.r;\n#else\n	specularStrength = 1.0;\n#endif",
	specularmap_pars_fragment: "#ifdef USE_SPECULARMAP\n	uniform sampler2D specularMap;\n#endif",
	tonemapping_fragment: "#if defined( TONE_MAPPING )\n	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );\n#endif",
	tonemapping_pars_fragment: "#ifndef saturate\n#define saturate( a ) clamp( a, 0.0, 1.0 )\n#endif\nuniform float toneMappingExposure;\nvec3 LinearToneMapping( vec3 color ) {\n	return saturate( toneMappingExposure * color );\n}\nvec3 ReinhardToneMapping( vec3 color ) {\n	color *= toneMappingExposure;\n	return saturate( color / ( vec3( 1.0 ) + color ) );\n}\nvec3 CineonToneMapping( vec3 color ) {\n	color *= toneMappingExposure;\n	color = max( vec3( 0.0 ), color - 0.004 );\n	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );\n}\nvec3 RRTAndODTFit( vec3 v ) {\n	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;\n	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;\n	return a / b;\n}\nvec3 ACESFilmicToneMapping( vec3 color ) {\n	const mat3 ACESInputMat = mat3(\n		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),\n		vec3( 0.04823, 0.01566, 0.83777 )\n	);\n	const mat3 ACESOutputMat = mat3(\n		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),\n		vec3( -0.07367, -0.00605,  1.07602 )\n	);\n	color *= toneMappingExposure / 0.6;\n	color = ACESInputMat * color;\n	color = RRTAndODTFit( color );\n	color = ACESOutputMat * color;\n	return saturate( color );\n}\nconst mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(\n	vec3( 1.6605, - 0.1246, - 0.0182 ),\n	vec3( - 0.5876, 1.1329, - 0.1006 ),\n	vec3( - 0.0728, - 0.0083, 1.1187 )\n);\nconst mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(\n	vec3( 0.6274, 0.0691, 0.0164 ),\n	vec3( 0.3293, 0.9195, 0.0880 ),\n	vec3( 0.0433, 0.0113, 0.8956 )\n);\nvec3 agxDefaultContrastApprox( vec3 x ) {\n	vec3 x2 = x * x;\n	vec3 x4 = x2 * x2;\n	return + 15.5 * x4 * x2\n		- 40.14 * x4 * x\n		+ 31.96 * x4\n		- 6.868 * x2 * x\n		+ 0.4298 * x2\n		+ 0.1191 * x\n		- 0.00232;\n}\nvec3 AgXToneMapping( vec3 color ) {\n	const mat3 AgXInsetMatrix = mat3(\n		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),\n		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),\n		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )\n	);\n	const mat3 AgXOutsetMatrix = mat3(\n		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),\n		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),\n		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )\n	);\n	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;\n	color *= toneMappingExposure;\n	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;\n	color = AgXInsetMatrix * color;\n	color = max( color, 1e-10 );	color = log2( color );\n	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );\n	color = clamp( color, 0.0, 1.0 );\n	color = agxDefaultContrastApprox( color );\n	color = AgXOutsetMatrix * color;\n	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );\n	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;\n	color = clamp( color, 0.0, 1.0 );\n	return color;\n}\nvec3 NeutralToneMapping( vec3 color ) {\n	const float StartCompression = 0.8 - 0.04;\n	const float Desaturation = 0.15;\n	color *= toneMappingExposure;\n	float x = min( color.r, min( color.g, color.b ) );\n	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;\n	color -= offset;\n	float peak = max( color.r, max( color.g, color.b ) );\n	if ( peak < StartCompression ) return color;\n	float d = 1. - StartCompression;\n	float newPeak = 1. - d * d / ( peak + d - StartCompression );\n	color *= newPeak / peak;\n	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );\n	return mix( color, vec3( newPeak ), g );\n}\nvec3 CustomToneMapping( vec3 color ) { return color; }",
	transmission_fragment: "#ifdef USE_TRANSMISSION\n	material.transmission = transmission;\n	material.transmissionAlpha = 1.0;\n	material.thickness = thickness;\n	material.attenuationDistance = attenuationDistance;\n	material.attenuationColor = attenuationColor;\n	#ifdef USE_TRANSMISSIONMAP\n		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;\n	#endif\n	#ifdef USE_THICKNESSMAP\n		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;\n	#endif\n	vec3 pos = vWorldPosition;\n	vec3 v = normalize( cameraPosition - pos );\n	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );\n	vec4 transmitted = getIBLVolumeRefraction(\n		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,\n		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,\n		material.attenuationColor, material.attenuationDistance );\n	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );\n	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );\n#endif",
	transmission_pars_fragment: "#ifdef USE_TRANSMISSION\n	uniform float transmission;\n	uniform float thickness;\n	uniform float attenuationDistance;\n	uniform vec3 attenuationColor;\n	#ifdef USE_TRANSMISSIONMAP\n		uniform sampler2D transmissionMap;\n	#endif\n	#ifdef USE_THICKNESSMAP\n		uniform sampler2D thicknessMap;\n	#endif\n	uniform vec2 transmissionSamplerSize;\n	uniform sampler2D transmissionSamplerMap;\n	uniform mat4 modelMatrix;\n	uniform mat4 projectionMatrix;\n	varying vec3 vWorldPosition;\n	float w0( float a ) {\n		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );\n	}\n	float w1( float a ) {\n		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );\n	}\n	float w2( float a ){\n		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );\n	}\n	float w3( float a ) {\n		return ( 1.0 / 6.0 ) * ( a * a * a );\n	}\n	float g0( float a ) {\n		return w0( a ) + w1( a );\n	}\n	float g1( float a ) {\n		return w2( a ) + w3( a );\n	}\n	float h0( float a ) {\n		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );\n	}\n	float h1( float a ) {\n		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );\n	}\n	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {\n		uv = uv * texelSize.zw + 0.5;\n		vec2 iuv = floor( uv );\n		vec2 fuv = fract( uv );\n		float g0x = g0( fuv.x );\n		float g1x = g1( fuv.x );\n		float h0x = h0( fuv.x );\n		float h1x = h1( fuv.x );\n		float h0y = h0( fuv.y );\n		float h1y = h1( fuv.y );\n		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;\n		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;\n		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;\n		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;\n		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +\n			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );\n	}\n	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {\n		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );\n		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );\n		vec2 fLodSizeInv = 1.0 / fLodSize;\n		vec2 cLodSizeInv = 1.0 / cLodSize;\n		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );\n		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );\n		return mix( fSample, cSample, fract( lod ) );\n	}\n	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {\n		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );\n		vec3 modelScale;\n		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );\n		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );\n		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );\n		return normalize( refractionVector ) * thickness * modelScale;\n	}\n	float applyIorToRoughness( const in float roughness, const in float ior ) {\n		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );\n	}\n	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {\n		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );\n		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );\n	}\n	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {\n		if ( isinf( attenuationDistance ) ) {\n			return vec3( 1.0 );\n		} else {\n			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;\n			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;\n		}\n	}\n	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,\n		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,\n		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,\n		const in vec3 attenuationColor, const in float attenuationDistance ) {\n		vec4 transmittedLight;\n		vec3 transmittance;\n		#ifdef USE_DISPERSION\n			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;\n			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );\n			for ( int i = 0; i < 3; i ++ ) {\n				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );\n				vec3 refractedRayExit = position + transmissionRay;\n				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );\n				vec2 refractionCoords = ndcPos.xy / ndcPos.w;\n				refractionCoords += 1.0;\n				refractionCoords /= 2.0;\n				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );\n				transmittedLight[ i ] = transmissionSample[ i ];\n				transmittedLight.a += transmissionSample.a;\n				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];\n			}\n			transmittedLight.a /= 3.0;\n		#else\n			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );\n			vec3 refractedRayExit = position + transmissionRay;\n			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );\n			vec2 refractionCoords = ndcPos.xy / ndcPos.w;\n			refractionCoords += 1.0;\n			refractionCoords /= 2.0;\n			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );\n			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );\n		#endif\n		vec3 attenuatedColor = transmittance * transmittedLight.rgb;\n		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );\n		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;\n		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );\n	}\n#endif",
	uv_pars_fragment: "#if defined( USE_UV ) || defined( USE_ANISOTROPY )\n	varying vec2 vUv;\n#endif\n#ifdef USE_MAP\n	varying vec2 vMapUv;\n#endif\n#ifdef USE_ALPHAMAP\n	varying vec2 vAlphaMapUv;\n#endif\n#ifdef USE_LIGHTMAP\n	varying vec2 vLightMapUv;\n#endif\n#ifdef USE_AOMAP\n	varying vec2 vAoMapUv;\n#endif\n#ifdef USE_BUMPMAP\n	varying vec2 vBumpMapUv;\n#endif\n#ifdef USE_NORMALMAP\n	varying vec2 vNormalMapUv;\n#endif\n#ifdef USE_EMISSIVEMAP\n	varying vec2 vEmissiveMapUv;\n#endif\n#ifdef USE_METALNESSMAP\n	varying vec2 vMetalnessMapUv;\n#endif\n#ifdef USE_ROUGHNESSMAP\n	varying vec2 vRoughnessMapUv;\n#endif\n#ifdef USE_ANISOTROPYMAP\n	varying vec2 vAnisotropyMapUv;\n#endif\n#ifdef USE_CLEARCOATMAP\n	varying vec2 vClearcoatMapUv;\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	varying vec2 vClearcoatNormalMapUv;\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n	varying vec2 vClearcoatRoughnessMapUv;\n#endif\n#ifdef USE_IRIDESCENCEMAP\n	varying vec2 vIridescenceMapUv;\n#endif\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n	varying vec2 vIridescenceThicknessMapUv;\n#endif\n#ifdef USE_SHEEN_COLORMAP\n	varying vec2 vSheenColorMapUv;\n#endif\n#ifdef USE_SHEEN_ROUGHNESSMAP\n	varying vec2 vSheenRoughnessMapUv;\n#endif\n#ifdef USE_SPECULARMAP\n	varying vec2 vSpecularMapUv;\n#endif\n#ifdef USE_SPECULAR_COLORMAP\n	varying vec2 vSpecularColorMapUv;\n#endif\n#ifdef USE_SPECULAR_INTENSITYMAP\n	varying vec2 vSpecularIntensityMapUv;\n#endif\n#ifdef USE_TRANSMISSIONMAP\n	uniform mat3 transmissionMapTransform;\n	varying vec2 vTransmissionMapUv;\n#endif\n#ifdef USE_THICKNESSMAP\n	uniform mat3 thicknessMapTransform;\n	varying vec2 vThicknessMapUv;\n#endif",
	uv_pars_vertex: "#if defined( USE_UV ) || defined( USE_ANISOTROPY )\n	varying vec2 vUv;\n#endif\n#ifdef USE_MAP\n	uniform mat3 mapTransform;\n	varying vec2 vMapUv;\n#endif\n#ifdef USE_ALPHAMAP\n	uniform mat3 alphaMapTransform;\n	varying vec2 vAlphaMapUv;\n#endif\n#ifdef USE_LIGHTMAP\n	uniform mat3 lightMapTransform;\n	varying vec2 vLightMapUv;\n#endif\n#ifdef USE_AOMAP\n	uniform mat3 aoMapTransform;\n	varying vec2 vAoMapUv;\n#endif\n#ifdef USE_BUMPMAP\n	uniform mat3 bumpMapTransform;\n	varying vec2 vBumpMapUv;\n#endif\n#ifdef USE_NORMALMAP\n	uniform mat3 normalMapTransform;\n	varying vec2 vNormalMapUv;\n#endif\n#ifdef USE_DISPLACEMENTMAP\n	uniform mat3 displacementMapTransform;\n	varying vec2 vDisplacementMapUv;\n#endif\n#ifdef USE_EMISSIVEMAP\n	uniform mat3 emissiveMapTransform;\n	varying vec2 vEmissiveMapUv;\n#endif\n#ifdef USE_METALNESSMAP\n	uniform mat3 metalnessMapTransform;\n	varying vec2 vMetalnessMapUv;\n#endif\n#ifdef USE_ROUGHNESSMAP\n	uniform mat3 roughnessMapTransform;\n	varying vec2 vRoughnessMapUv;\n#endif\n#ifdef USE_ANISOTROPYMAP\n	uniform mat3 anisotropyMapTransform;\n	varying vec2 vAnisotropyMapUv;\n#endif\n#ifdef USE_CLEARCOATMAP\n	uniform mat3 clearcoatMapTransform;\n	varying vec2 vClearcoatMapUv;\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	uniform mat3 clearcoatNormalMapTransform;\n	varying vec2 vClearcoatNormalMapUv;\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n	uniform mat3 clearcoatRoughnessMapTransform;\n	varying vec2 vClearcoatRoughnessMapUv;\n#endif\n#ifdef USE_SHEEN_COLORMAP\n	uniform mat3 sheenColorMapTransform;\n	varying vec2 vSheenColorMapUv;\n#endif\n#ifdef USE_SHEEN_ROUGHNESSMAP\n	uniform mat3 sheenRoughnessMapTransform;\n	varying vec2 vSheenRoughnessMapUv;\n#endif\n#ifdef USE_IRIDESCENCEMAP\n	uniform mat3 iridescenceMapTransform;\n	varying vec2 vIridescenceMapUv;\n#endif\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n	uniform mat3 iridescenceThicknessMapTransform;\n	varying vec2 vIridescenceThicknessMapUv;\n#endif\n#ifdef USE_SPECULARMAP\n	uniform mat3 specularMapTransform;\n	varying vec2 vSpecularMapUv;\n#endif\n#ifdef USE_SPECULAR_COLORMAP\n	uniform mat3 specularColorMapTransform;\n	varying vec2 vSpecularColorMapUv;\n#endif\n#ifdef USE_SPECULAR_INTENSITYMAP\n	uniform mat3 specularIntensityMapTransform;\n	varying vec2 vSpecularIntensityMapUv;\n#endif\n#ifdef USE_TRANSMISSIONMAP\n	uniform mat3 transmissionMapTransform;\n	varying vec2 vTransmissionMapUv;\n#endif\n#ifdef USE_THICKNESSMAP\n	uniform mat3 thicknessMapTransform;\n	varying vec2 vThicknessMapUv;\n#endif",
	uv_vertex: "#if defined( USE_UV ) || defined( USE_ANISOTROPY )\n	vUv = vec3( uv, 1 ).xy;\n#endif\n#ifdef USE_MAP\n	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_ALPHAMAP\n	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_LIGHTMAP\n	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_AOMAP\n	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_BUMPMAP\n	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_NORMALMAP\n	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_DISPLACEMENTMAP\n	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_EMISSIVEMAP\n	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_METALNESSMAP\n	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_ROUGHNESSMAP\n	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_ANISOTROPYMAP\n	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_CLEARCOATMAP\n	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_IRIDESCENCEMAP\n	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_IRIDESCENCE_THICKNESSMAP\n	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_SHEEN_COLORMAP\n	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_SHEEN_ROUGHNESSMAP\n	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_SPECULARMAP\n	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_SPECULAR_COLORMAP\n	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_SPECULAR_INTENSITYMAP\n	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_TRANSMISSIONMAP\n	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;\n#endif\n#ifdef USE_THICKNESSMAP\n	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;\n#endif",
	worldpos_vertex: "#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0\n	vec4 worldPosition = vec4( transformed, 1.0 );\n	#ifdef USE_BATCHING\n		worldPosition = batchingMatrix * worldPosition;\n	#endif\n	#ifdef USE_INSTANCING\n		worldPosition = instanceMatrix * worldPosition;\n	#endif\n	worldPosition = modelMatrix * worldPosition;\n#endif",
	background_vert: "varying vec2 vUv;\nuniform mat3 uvTransform;\nvoid main() {\n	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;\n	gl_Position = vec4( position.xy, 1.0, 1.0 );\n}",
	background_frag: "uniform sampler2D t2D;\nuniform float backgroundIntensity;\nvarying vec2 vUv;\nvoid main() {\n	vec4 texColor = texture2D( t2D, vUv );\n	#ifdef DECODE_VIDEO_TEXTURE\n		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );\n	#endif\n	texColor.rgb *= backgroundIntensity;\n	gl_FragColor = texColor;\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n}",
	backgroundCube_vert: "varying vec3 vWorldDirection;\n#include <common>\nvoid main() {\n	vWorldDirection = transformDirection( position, modelMatrix );\n	#include <begin_vertex>\n	#include <project_vertex>\n	gl_Position.z = gl_Position.w;\n}",
	backgroundCube_frag: "#ifdef ENVMAP_TYPE_CUBE\n	uniform samplerCube envMap;\n#elif defined( ENVMAP_TYPE_CUBE_UV )\n	uniform sampler2D envMap;\n#endif\nuniform float backgroundBlurriness;\nuniform float backgroundIntensity;\nuniform mat3 backgroundRotation;\nvarying vec3 vWorldDirection;\n#include <cube_uv_reflection_fragment>\nvoid main() {\n	#ifdef ENVMAP_TYPE_CUBE\n		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );\n	#elif defined( ENVMAP_TYPE_CUBE_UV )\n		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );\n	#else\n		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );\n	#endif\n	texColor.rgb *= backgroundIntensity;\n	gl_FragColor = texColor;\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n}",
	cube_vert: "varying vec3 vWorldDirection;\n#include <common>\nvoid main() {\n	vWorldDirection = transformDirection( position, modelMatrix );\n	#include <begin_vertex>\n	#include <project_vertex>\n	gl_Position.z = gl_Position.w;\n}",
	cube_frag: "uniform samplerCube tCube;\nuniform float tFlip;\nuniform float opacity;\nvarying vec3 vWorldDirection;\nvoid main() {\n	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );\n	gl_FragColor = texColor;\n	gl_FragColor.a *= opacity;\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n}",
	depth_vert: "#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvarying vec2 vHighPrecisionZW;\nvoid main() {\n	#include <uv_vertex>\n	#include <batching_vertex>\n	#include <skinbase_vertex>\n	#include <morphinstance_vertex>\n	#ifdef USE_DISPLACEMENTMAP\n		#include <beginnormal_vertex>\n		#include <morphnormal_vertex>\n		#include <skinnormal_vertex>\n	#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vHighPrecisionZW = gl_Position.zw;\n}",
	depth_frag: "#if DEPTH_PACKING == 3200\n	uniform float opacity;\n#endif\n#include <common>\n#include <packing>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvarying vec2 vHighPrecisionZW;\nvoid main() {\n	vec4 diffuseColor = vec4( 1.0 );\n	#include <clipping_planes_fragment>\n	#if DEPTH_PACKING == 3200\n		diffuseColor.a = opacity;\n	#endif\n	#include <map_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <logdepthbuf_fragment>\n	#ifdef USE_REVERSED_DEPTH_BUFFER\n		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];\n	#else\n		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;\n	#endif\n	#if DEPTH_PACKING == 3200\n		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );\n	#elif DEPTH_PACKING == 3201\n		gl_FragColor = packDepthToRGBA( fragCoordZ );\n	#elif DEPTH_PACKING == 3202\n		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );\n	#elif DEPTH_PACKING == 3203\n		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );\n	#endif\n}",
	distance_vert: "#define DISTANCE\nvarying vec3 vWorldPosition;\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <batching_vertex>\n	#include <skinbase_vertex>\n	#include <morphinstance_vertex>\n	#ifdef USE_DISPLACEMENTMAP\n		#include <beginnormal_vertex>\n		#include <morphnormal_vertex>\n		#include <skinnormal_vertex>\n	#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <worldpos_vertex>\n	#include <clipping_planes_vertex>\n	vWorldPosition = worldPosition.xyz;\n}",
	distance_frag: "#define DISTANCE\nuniform vec3 referencePosition;\nuniform float nearDistance;\nuniform float farDistance;\nvarying vec3 vWorldPosition;\n#include <common>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( 1.0 );\n	#include <clipping_planes_fragment>\n	#include <map_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	float dist = length( vWorldPosition - referencePosition );\n	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );\n	dist = saturate( dist );\n	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );\n}",
	equirect_vert: "varying vec3 vWorldDirection;\n#include <common>\nvoid main() {\n	vWorldDirection = transformDirection( position, modelMatrix );\n	#include <begin_vertex>\n	#include <project_vertex>\n}",
	equirect_frag: "uniform sampler2D tEquirect;\nvarying vec3 vWorldDirection;\n#include <common>\nvoid main() {\n	vec3 direction = normalize( vWorldDirection );\n	vec2 sampleUV = equirectUv( direction );\n	gl_FragColor = texture2D( tEquirect, sampleUV );\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n}",
	linedashed_vert: "uniform float scale;\nattribute float lineDistance;\nvarying float vLineDistance;\n#include <common>\n#include <uv_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	vLineDistance = scale * lineDistance;\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphinstance_vertex>\n	#include <morphcolor_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <fog_vertex>\n}",
	linedashed_frag: "uniform vec3 diffuse;\nuniform float opacity;\nuniform float dashSize;\nuniform float totalSize;\nvarying float vLineDistance;\n#include <common>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <fog_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	if ( mod( vLineDistance, totalSize ) > dashSize ) {\n		discard;\n	}\n	vec3 outgoingLight = vec3( 0.0 );\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	outgoingLight = diffuseColor.rgb;\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n}",
	meshbasic_vert: "#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphinstance_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )\n		#include <beginnormal_vertex>\n		#include <morphnormal_vertex>\n		#include <skinbase_vertex>\n		#include <skinnormal_vertex>\n		#include <defaultnormal_vertex>\n	#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <worldpos_vertex>\n	#include <envmap_vertex>\n	#include <fog_vertex>\n}",
	meshbasic_frag: "uniform vec3 diffuse;\nuniform float opacity;\n#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n#endif\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_pars_fragment>\n#include <fog_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <specularmap_fragment>\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	#ifdef USE_LIGHTMAP\n		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );\n		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;\n	#else\n		reflectedLight.indirectDiffuse += vec3( 1.0 );\n	#endif\n	#include <aomap_fragment>\n	reflectedLight.indirectDiffuse *= diffuseColor.rgb;\n	vec3 outgoingLight = reflectedLight.indirectDiffuse;\n	#include <envmap_fragment>\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}",
	meshlambert_vert: "#define LAMBERT\nvarying vec3 vViewPosition;\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphinstance_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vViewPosition = - mvPosition.xyz;\n	#include <worldpos_vertex>\n	#include <envmap_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}",
	meshlambert_frag: "#define LAMBERT\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform float opacity;\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <cube_uv_reflection_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_pars_fragment>\n#include <envmap_physical_pars_fragment>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <normal_pars_fragment>\n#include <lights_lambert_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <specularmap_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <emissivemap_fragment>\n	#include <lights_lambert_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n	#include <aomap_fragment>\n	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;\n	#include <envmap_fragment>\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}",
	meshmatcap_vert: "#define MATCAP\nvarying vec3 vViewPosition;\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <color_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphinstance_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <fog_vertex>\n	vViewPosition = - mvPosition.xyz;\n}",
	meshmatcap_frag: "#define MATCAP\nuniform vec3 diffuse;\nuniform float opacity;\nuniform sampler2D matcap;\nvarying vec3 vViewPosition;\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <fog_pars_fragment>\n#include <normal_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	vec3 viewDir = normalize( vViewPosition );\n	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );\n	vec3 y = cross( viewDir, x );\n	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;\n	#ifdef USE_MATCAP\n		vec4 matcapColor = texture2D( matcap, uv );\n	#else\n		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );\n	#endif\n	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}",
	meshnormal_vert: "#define NORMAL\n#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )\n	varying vec3 vViewPosition;\n#endif\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphinstance_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )\n	vViewPosition = - mvPosition.xyz;\n#endif\n}",
	meshnormal_frag: "#define NORMAL\nuniform float opacity;\n#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )\n	varying vec3 vViewPosition;\n#endif\n#include <uv_pars_fragment>\n#include <normal_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );\n	#include <clipping_planes_fragment>\n	#include <logdepthbuf_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );\n	#ifdef OPAQUE\n		gl_FragColor.a = 1.0;\n	#endif\n}",
	meshphong_vert: "#define PHONG\nvarying vec3 vViewPosition;\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphinstance_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vViewPosition = - mvPosition.xyz;\n	#include <worldpos_vertex>\n	#include <envmap_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}",
	meshphong_frag: "#define PHONG\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform vec3 specular;\nuniform float shininess;\nuniform float opacity;\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <cube_uv_reflection_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_pars_fragment>\n#include <envmap_physical_pars_fragment>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <normal_pars_fragment>\n#include <lights_phong_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <specularmap_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <emissivemap_fragment>\n	#include <lights_phong_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n	#include <aomap_fragment>\n	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;\n	#include <envmap_fragment>\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}",
	meshphysical_vert: "#define STANDARD\nvarying vec3 vViewPosition;\n#ifdef USE_TRANSMISSION\n	varying vec3 vWorldPosition;\n#endif\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphinstance_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vViewPosition = - mvPosition.xyz;\n	#include <worldpos_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n#ifdef USE_TRANSMISSION\n	vWorldPosition = worldPosition.xyz;\n#endif\n}",
	meshphysical_frag: "#define STANDARD\n#ifdef PHYSICAL\n	#define IOR\n	#define USE_SPECULAR\n#endif\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform float roughness;\nuniform float metalness;\nuniform float opacity;\n#ifdef IOR\n	uniform float ior;\n#endif\n#ifdef USE_SPECULAR\n	uniform float specularIntensity;\n	uniform vec3 specularColor;\n	#ifdef USE_SPECULAR_COLORMAP\n		uniform sampler2D specularColorMap;\n	#endif\n	#ifdef USE_SPECULAR_INTENSITYMAP\n		uniform sampler2D specularIntensityMap;\n	#endif\n#endif\n#ifdef USE_CLEARCOAT\n	uniform float clearcoat;\n	uniform float clearcoatRoughness;\n#endif\n#ifdef USE_DISPERSION\n	uniform float dispersion;\n#endif\n#ifdef USE_IRIDESCENCE\n	uniform float iridescence;\n	uniform float iridescenceIOR;\n	uniform float iridescenceThicknessMinimum;\n	uniform float iridescenceThicknessMaximum;\n#endif\n#ifdef USE_SHEEN\n	uniform vec3 sheenColor;\n	uniform float sheenRoughness;\n	#ifdef USE_SHEEN_COLORMAP\n		uniform sampler2D sheenColorMap;\n	#endif\n	#ifdef USE_SHEEN_ROUGHNESSMAP\n		uniform sampler2D sheenRoughnessMap;\n	#endif\n#endif\n#ifdef USE_ANISOTROPY\n	uniform vec2 anisotropyVector;\n	#ifdef USE_ANISOTROPYMAP\n		uniform sampler2D anisotropyMap;\n	#endif\n#endif\nvarying vec3 vViewPosition;\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <iridescence_fragment>\n#include <cube_uv_reflection_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_physical_pars_fragment>\n#include <fog_pars_fragment>\n#include <lights_pars_begin>\n#include <normal_pars_fragment>\n#include <lights_physical_pars_fragment>\n#include <transmission_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <clearcoat_pars_fragment>\n#include <iridescence_pars_fragment>\n#include <roughnessmap_pars_fragment>\n#include <metalnessmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <roughnessmap_fragment>\n	#include <metalnessmap_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <clearcoat_normal_fragment_begin>\n	#include <clearcoat_normal_fragment_maps>\n	#include <emissivemap_fragment>\n	#include <lights_physical_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n	#include <aomap_fragment>\n	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;\n	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;\n	#include <transmission_fragment>\n	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;\n	#ifdef USE_SHEEN\n \n		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;\n \n 	#endif\n	#ifdef USE_CLEARCOAT\n		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );\n		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );\n		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;\n	#endif\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}",
	meshtoon_vert: "#define TOON\nvarying vec3 vViewPosition;\n#include <common>\n#include <batching_pars_vertex>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <normal_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <morphinstance_vertex>\n	#include <morphcolor_vertex>\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <normal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vViewPosition = - mvPosition.xyz;\n	#include <worldpos_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}",
	meshtoon_frag: "#define TOON\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform float opacity;\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <gradientmap_pars_fragment>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <normal_pars_fragment>\n#include <lights_toon_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <emissivemap_fragment>\n	#include <lights_toon_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n	#include <aomap_fragment>\n	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}",
	points_vert: "uniform float size;\nuniform float scale;\n#include <common>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\n#ifdef USE_POINTS_UV\n	varying vec2 vUv;\n	uniform mat3 uvTransform;\n#endif\nvoid main() {\n	#ifdef USE_POINTS_UV\n		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;\n	#endif\n	#include <color_vertex>\n	#include <morphinstance_vertex>\n	#include <morphcolor_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <project_vertex>\n	gl_PointSize = size;\n	#ifdef USE_SIZEATTENUATION\n		bool isPerspective = isPerspectiveMatrix( projectionMatrix );\n		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );\n	#endif\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <worldpos_vertex>\n	#include <fog_vertex>\n}",
	points_frag: "uniform vec3 diffuse;\nuniform float opacity;\n#include <common>\n#include <color_pars_fragment>\n#include <map_particle_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <fog_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	vec3 outgoingLight = vec3( 0.0 );\n	#include <logdepthbuf_fragment>\n	#include <map_particle_fragment>\n	#include <color_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	outgoingLight = diffuseColor.rgb;\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n}",
	shadow_vert: "#include <common>\n#include <batching_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <shadowmap_pars_vertex>\nvoid main() {\n	#include <batching_vertex>\n	#include <beginnormal_vertex>\n	#include <morphinstance_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <worldpos_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}",
	shadow_frag: "uniform vec3 color;\nuniform float opacity;\n#include <common>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <logdepthbuf_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>\nvoid main() {\n	#include <logdepthbuf_fragment>\n	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n}",
	sprite_vert: "uniform float rotation;\nuniform vec2 center;\n#include <common>\n#include <uv_pars_vertex>\n#include <fog_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	vec4 mvPosition = modelViewMatrix[ 3 ];\n	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );\n	#ifndef USE_SIZEATTENUATION\n		bool isPerspective = isPerspectiveMatrix( projectionMatrix );\n		if ( isPerspective ) scale *= - mvPosition.z;\n	#endif\n	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;\n	vec2 rotatedPosition;\n	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;\n	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;\n	mvPosition.xy += rotatedPosition;\n	gl_Position = projectionMatrix * mvPosition;\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <fog_vertex>\n}",
	sprite_frag: "uniform vec3 diffuse;\nuniform float opacity;\n#include <common>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <alphahash_pars_fragment>\n#include <fog_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <clipping_planes_fragment>\n	vec3 outgoingLight = vec3( 0.0 );\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <alphahash_fragment>\n	outgoingLight = diffuseColor.rgb;\n	#include <opaque_fragment>\n	#include <tonemapping_fragment>\n	#include <colorspace_fragment>\n	#include <fog_fragment>\n}"
}, $ = {
	common: {
		diffuse: { value: /*@__PURE__*/ new J(16777215) },
		opacity: { value: 1 },
		map: { value: null },
		mapTransform: { value: /*@__PURE__*/ new W() },
		alphaMap: { value: null },
		alphaMapTransform: { value: /*@__PURE__*/ new W() },
		alphaTest: { value: 0 }
	},
	specularmap: {
		specularMap: { value: null },
		specularMapTransform: { value: /*@__PURE__*/ new W() }
	},
	envmap: {
		envMap: { value: null },
		envMapRotation: { value: /*@__PURE__*/ new W() },
		reflectivity: { value: 1 },
		ior: { value: 1.5 },
		refractionRatio: { value: .98 },
		dfgLUT: { value: null }
	},
	aomap: {
		aoMap: { value: null },
		aoMapIntensity: { value: 1 },
		aoMapTransform: { value: /*@__PURE__*/ new W() }
	},
	lightmap: {
		lightMap: { value: null },
		lightMapIntensity: { value: 1 },
		lightMapTransform: { value: /*@__PURE__*/ new W() }
	},
	bumpmap: {
		bumpMap: { value: null },
		bumpMapTransform: { value: /*@__PURE__*/ new W() },
		bumpScale: { value: 1 }
	},
	normalmap: {
		normalMap: { value: null },
		normalMapTransform: { value: /*@__PURE__*/ new W() },
		normalScale: { value: /*@__PURE__*/ new H(1, 1) }
	},
	displacementmap: {
		displacementMap: { value: null },
		displacementMapTransform: { value: /*@__PURE__*/ new W() },
		displacementScale: { value: 1 },
		displacementBias: { value: 0 }
	},
	emissivemap: {
		emissiveMap: { value: null },
		emissiveMapTransform: { value: /*@__PURE__*/ new W() }
	},
	metalnessmap: {
		metalnessMap: { value: null },
		metalnessMapTransform: { value: /*@__PURE__*/ new W() }
	},
	roughnessmap: {
		roughnessMap: { value: null },
		roughnessMapTransform: { value: /*@__PURE__*/ new W() }
	},
	gradientmap: { gradientMap: { value: null } },
	fog: {
		fogDensity: { value: 25e-5 },
		fogNear: { value: 1 },
		fogFar: { value: 2e3 },
		fogColor: { value: /*@__PURE__*/ new J(16777215) }
	},
	lights: {
		ambientLightColor: { value: [] },
		lightProbe: { value: [] },
		directionalLights: {
			value: [],
			properties: {
				direction: {},
				color: {}
			}
		},
		directionalLightShadows: {
			value: [],
			properties: {
				shadowIntensity: 1,
				shadowBias: {},
				shadowNormalBias: {},
				shadowRadius: {},
				shadowMapSize: {}
			}
		},
		directionalShadowMatrix: { value: [] },
		spotLights: {
			value: [],
			properties: {
				color: {},
				position: {},
				direction: {},
				distance: {},
				coneCos: {},
				penumbraCos: {},
				decay: {}
			}
		},
		spotLightShadows: {
			value: [],
			properties: {
				shadowIntensity: 1,
				shadowBias: {},
				shadowNormalBias: {},
				shadowRadius: {},
				shadowMapSize: {}
			}
		},
		spotLightMap: { value: [] },
		spotLightMatrix: { value: [] },
		pointLights: {
			value: [],
			properties: {
				color: {},
				position: {},
				decay: {},
				distance: {}
			}
		},
		pointLightShadows: {
			value: [],
			properties: {
				shadowIntensity: 1,
				shadowBias: {},
				shadowNormalBias: {},
				shadowRadius: {},
				shadowMapSize: {},
				shadowCameraNear: {},
				shadowCameraFar: {}
			}
		},
		pointShadowMatrix: { value: [] },
		hemisphereLights: {
			value: [],
			properties: {
				direction: {},
				skyColor: {},
				groundColor: {}
			}
		},
		rectAreaLights: {
			value: [],
			properties: {
				color: {},
				position: {},
				width: {},
				height: {}
			}
		},
		ltc_1: { value: null },
		ltc_2: { value: null },
		probesSH: { value: null },
		probesMin: { value: /*@__PURE__*/ new U() },
		probesMax: { value: /*@__PURE__*/ new U() },
		probesResolution: { value: /*@__PURE__*/ new U() }
	},
	points: {
		diffuse: { value: /*@__PURE__*/ new J(16777215) },
		opacity: { value: 1 },
		size: { value: 1 },
		scale: { value: 1 },
		map: { value: null },
		alphaMap: { value: null },
		alphaMapTransform: { value: /*@__PURE__*/ new W() },
		alphaTest: { value: 0 },
		uvTransform: { value: /*@__PURE__*/ new W() }
	},
	sprite: {
		diffuse: { value: /*@__PURE__*/ new J(16777215) },
		opacity: { value: 1 },
		center: { value: /*@__PURE__*/ new H(.5, .5) },
		rotation: { value: 0 },
		map: { value: null },
		mapTransform: { value: /*@__PURE__*/ new W() },
		alphaMap: { value: null },
		alphaMapTransform: { value: /*@__PURE__*/ new W() },
		alphaTest: { value: 0 }
	}
}, rm = {
	basic: {
		uniforms: /*@__PURE__*/ hu([
			$.common,
			$.specularmap,
			$.envmap,
			$.aomap,
			$.lightmap,
			$.fog
		]),
		vertexShader: Q.meshbasic_vert,
		fragmentShader: Q.meshbasic_frag
	},
	lambert: {
		uniforms: /*@__PURE__*/ hu([
			$.common,
			$.specularmap,
			$.envmap,
			$.aomap,
			$.lightmap,
			$.emissivemap,
			$.bumpmap,
			$.normalmap,
			$.displacementmap,
			$.fog,
			$.lights,
			{
				emissive: { value: /*@__PURE__*/ new J(0) },
				envMapIntensity: { value: 1 }
			}
		]),
		vertexShader: Q.meshlambert_vert,
		fragmentShader: Q.meshlambert_frag
	},
	phong: {
		uniforms: /*@__PURE__*/ hu([
			$.common,
			$.specularmap,
			$.envmap,
			$.aomap,
			$.lightmap,
			$.emissivemap,
			$.bumpmap,
			$.normalmap,
			$.displacementmap,
			$.fog,
			$.lights,
			{
				emissive: { value: /*@__PURE__*/ new J(0) },
				specular: { value: /*@__PURE__*/ new J(1118481) },
				shininess: { value: 30 },
				envMapIntensity: { value: 1 }
			}
		]),
		vertexShader: Q.meshphong_vert,
		fragmentShader: Q.meshphong_frag
	},
	standard: {
		uniforms: /*@__PURE__*/ hu([
			$.common,
			$.envmap,
			$.aomap,
			$.lightmap,
			$.emissivemap,
			$.bumpmap,
			$.normalmap,
			$.displacementmap,
			$.roughnessmap,
			$.metalnessmap,
			$.fog,
			$.lights,
			{
				emissive: { value: /*@__PURE__*/ new J(0) },
				roughness: { value: 1 },
				metalness: { value: 0 },
				envMapIntensity: { value: 1 }
			}
		]),
		vertexShader: Q.meshphysical_vert,
		fragmentShader: Q.meshphysical_frag
	},
	toon: {
		uniforms: /*@__PURE__*/ hu([
			$.common,
			$.aomap,
			$.lightmap,
			$.emissivemap,
			$.bumpmap,
			$.normalmap,
			$.displacementmap,
			$.gradientmap,
			$.fog,
			$.lights,
			{ emissive: { value: /*@__PURE__*/ new J(0) } }
		]),
		vertexShader: Q.meshtoon_vert,
		fragmentShader: Q.meshtoon_frag
	},
	matcap: {
		uniforms: /*@__PURE__*/ hu([
			$.common,
			$.bumpmap,
			$.normalmap,
			$.displacementmap,
			$.fog,
			{ matcap: { value: null } }
		]),
		vertexShader: Q.meshmatcap_vert,
		fragmentShader: Q.meshmatcap_frag
	},
	points: {
		uniforms: /*@__PURE__*/ hu([$.points, $.fog]),
		vertexShader: Q.points_vert,
		fragmentShader: Q.points_frag
	},
	dashed: {
		uniforms: /*@__PURE__*/ hu([
			$.common,
			$.fog,
			{
				scale: { value: 1 },
				dashSize: { value: 1 },
				totalSize: { value: 2 }
			}
		]),
		vertexShader: Q.linedashed_vert,
		fragmentShader: Q.linedashed_frag
	},
	depth: {
		uniforms: /*@__PURE__*/ hu([$.common, $.displacementmap]),
		vertexShader: Q.depth_vert,
		fragmentShader: Q.depth_frag
	},
	normal: {
		uniforms: /*@__PURE__*/ hu([
			$.common,
			$.bumpmap,
			$.normalmap,
			$.displacementmap,
			{ opacity: { value: 1 } }
		]),
		vertexShader: Q.meshnormal_vert,
		fragmentShader: Q.meshnormal_frag
	},
	sprite: {
		uniforms: /*@__PURE__*/ hu([$.sprite, $.fog]),
		vertexShader: Q.sprite_vert,
		fragmentShader: Q.sprite_frag
	},
	background: {
		uniforms: {
			uvTransform: { value: /*@__PURE__*/ new W() },
			t2D: { value: null },
			backgroundIntensity: { value: 1 }
		},
		vertexShader: Q.background_vert,
		fragmentShader: Q.background_frag
	},
	backgroundCube: {
		uniforms: {
			envMap: { value: null },
			backgroundBlurriness: { value: 0 },
			backgroundIntensity: { value: 1 },
			backgroundRotation: { value: /*@__PURE__*/ new W() }
		},
		vertexShader: Q.backgroundCube_vert,
		fragmentShader: Q.backgroundCube_frag
	},
	cube: {
		uniforms: {
			tCube: { value: null },
			tFlip: { value: -1 },
			opacity: { value: 1 }
		},
		vertexShader: Q.cube_vert,
		fragmentShader: Q.cube_frag
	},
	equirect: {
		uniforms: { tEquirect: { value: null } },
		vertexShader: Q.equirect_vert,
		fragmentShader: Q.equirect_frag
	},
	distance: {
		uniforms: /*@__PURE__*/ hu([
			$.common,
			$.displacementmap,
			{
				referencePosition: { value: /*@__PURE__*/ new U() },
				nearDistance: { value: 1 },
				farDistance: { value: 1e3 }
			}
		]),
		vertexShader: Q.distance_vert,
		fragmentShader: Q.distance_frag
	},
	shadow: {
		uniforms: /*@__PURE__*/ hu([
			$.lights,
			$.fog,
			{
				color: { value: /*@__PURE__*/ new J(0) },
				opacity: { value: 1 }
			}
		]),
		vertexShader: Q.shadow_vert,
		fragmentShader: Q.shadow_frag
	}
};
rm.physical = {
	uniforms: /*@__PURE__*/ hu([rm.standard.uniforms, {
		clearcoat: { value: 0 },
		clearcoatMap: { value: null },
		clearcoatMapTransform: { value: /*@__PURE__*/ new W() },
		clearcoatNormalMap: { value: null },
		clearcoatNormalMapTransform: { value: /*@__PURE__*/ new W() },
		clearcoatNormalScale: { value: /*@__PURE__*/ new H(1, 1) },
		clearcoatRoughness: { value: 0 },
		clearcoatRoughnessMap: { value: null },
		clearcoatRoughnessMapTransform: { value: /*@__PURE__*/ new W() },
		dispersion: { value: 0 },
		iridescence: { value: 0 },
		iridescenceMap: { value: null },
		iridescenceMapTransform: { value: /*@__PURE__*/ new W() },
		iridescenceIOR: { value: 1.3 },
		iridescenceThicknessMinimum: { value: 100 },
		iridescenceThicknessMaximum: { value: 400 },
		iridescenceThicknessMap: { value: null },
		iridescenceThicknessMapTransform: { value: /*@__PURE__*/ new W() },
		sheen: { value: 0 },
		sheenColor: { value: /*@__PURE__*/ new J(0) },
		sheenColorMap: { value: null },
		sheenColorMapTransform: { value: /*@__PURE__*/ new W() },
		sheenRoughness: { value: 1 },
		sheenRoughnessMap: { value: null },
		sheenRoughnessMapTransform: { value: /*@__PURE__*/ new W() },
		transmission: { value: 0 },
		transmissionMap: { value: null },
		transmissionMapTransform: { value: /*@__PURE__*/ new W() },
		transmissionSamplerSize: { value: /*@__PURE__*/ new H() },
		transmissionSamplerMap: { value: null },
		thickness: { value: 0 },
		thicknessMap: { value: null },
		thicknessMapTransform: { value: /*@__PURE__*/ new W() },
		attenuationDistance: { value: 0 },
		attenuationColor: { value: /*@__PURE__*/ new J(0) },
		specularColor: { value: /*@__PURE__*/ new J(1, 1, 1) },
		specularColorMap: { value: null },
		specularColorMapTransform: { value: /*@__PURE__*/ new W() },
		specularIntensity: { value: 1 },
		specularIntensityMap: { value: null },
		specularIntensityMapTransform: { value: /*@__PURE__*/ new W() },
		anisotropyVector: { value: /*@__PURE__*/ new H() },
		anisotropyMap: { value: null },
		anisotropyMapTransform: { value: /*@__PURE__*/ new W() }
	}]),
	vertexShader: Q.meshphysical_vert,
	fragmentShader: Q.meshphysical_frag
};
var im = {
	r: 0,
	b: 0,
	g: 0
}, am = /*@__PURE__*/ new K(), om = /*@__PURE__*/ new W();
om.set(-1, 0, 0, 0, 1, 0, 0, 0, 1);
function sm(e, t, n, r, i, a) {
	let o = new J(0), s = i === !0 ? 0 : 1, c, l, u = null, d = 0, f = null;
	function p(e) {
		let n = e.isScene === !0 ? e.background : null;
		if (n && n.isTexture) {
			let r = e.backgroundBlurriness > 0;
			n = t.get(n, r);
		}
		return n;
	}
	function m(t) {
		let r = !1, i = p(t);
		i === null ? g(o, s) : i && i.isColor && (g(i, 1), r = !0);
		let c = e.xr.getEnvironmentBlendMode();
		c === "additive" ? n.buffers.color.setClear(0, 0, 0, 1, a) : c === "alpha-blend" && n.buffers.color.setClear(0, 0, 0, 0, a), (e.autoClear || r) && (n.buffers.depth.setTest(!0), n.buffers.depth.setMask(!0), n.buffers.color.setMask(!0), e.clear(e.autoClearColor, e.autoClearDepth, e.autoClearStencil));
	}
	function h(t, n) {
		let i = p(n);
		i && (i.isCubeTexture || i.mapping === 306) ? (l === void 0 && (l = new Ho(new Cc(1, 1, 1), new Su({
			name: "BackgroundCubeMaterial",
			uniforms: mu(rm.backgroundCube.uniforms),
			vertexShader: rm.backgroundCube.vertexShader,
			fragmentShader: rm.backgroundCube.fragmentShader,
			side: 1,
			depthTest: !1,
			depthWrite: !1,
			fog: !1,
			allowOverride: !1
		})), l.geometry.deleteAttribute("normal"), l.geometry.deleteAttribute("uv"), l.onBeforeRender = function(e, t, n) {
			this.matrixWorld.copyPosition(n.matrixWorld);
		}, Object.defineProperty(l.material, "envMap", { get: function() {
			return this.uniforms.envMap.value;
		} }), r.update(l)), l.material.uniforms.envMap.value = i, l.material.uniforms.backgroundBlurriness.value = n.backgroundBlurriness, l.material.uniforms.backgroundIntensity.value = n.backgroundIntensity, l.material.uniforms.backgroundRotation.value.setFromMatrix4(am.makeRotationFromEuler(n.backgroundRotation)).transpose(), i.isCubeTexture && i.isRenderTargetTexture === !1 && l.material.uniforms.backgroundRotation.value.premultiply(om), l.material.toneMapped = G.getTransfer(i.colorSpace) !== jn, (u !== i || d !== i.version || f !== e.toneMapping) && (l.material.needsUpdate = !0, u = i, d = i.version, f = e.toneMapping), l.layers.enableAll(), t.unshift(l, l.geometry, l.material, 0, 0, null)) : i && i.isTexture && (c === void 0 && (c = new Ho(new tu(2, 2), new Su({
			name: "BackgroundMaterial",
			uniforms: mu(rm.background.uniforms),
			vertexShader: rm.background.vertexShader,
			fragmentShader: rm.background.fragmentShader,
			side: 0,
			depthTest: !1,
			depthWrite: !1,
			fog: !1,
			allowOverride: !1
		})), c.geometry.deleteAttribute("normal"), Object.defineProperty(c.material, "map", { get: function() {
			return this.uniforms.t2D.value;
		} }), r.update(c)), c.material.uniforms.t2D.value = i, c.material.uniforms.backgroundIntensity.value = n.backgroundIntensity, c.material.toneMapped = G.getTransfer(i.colorSpace) !== jn, i.matrixAutoUpdate === !0 && i.updateMatrix(), c.material.uniforms.uvTransform.value.copy(i.matrix), (u !== i || d !== i.version || f !== e.toneMapping) && (c.material.needsUpdate = !0, u = i, d = i.version, f = e.toneMapping), c.layers.enableAll(), t.unshift(c, c.geometry, c.material, 0, 0, null));
	}
	function g(t, r) {
		t.getRGB(im, vu(e)), n.buffers.color.setClear(im.r, im.g, im.b, r, a);
	}
	function _() {
		l !== void 0 && (l.geometry.dispose(), l.material.dispose(), l = void 0), c !== void 0 && (c.geometry.dispose(), c.material.dispose(), c = void 0);
	}
	return {
		getClearColor: function() {
			return o;
		},
		setClearColor: function(e, t = 1) {
			o.set(e), s = t, g(o, s);
		},
		getClearAlpha: function() {
			return s;
		},
		setClearAlpha: function(e) {
			s = e, g(o, s);
		},
		render: m,
		addToRenderList: h,
		dispose: _
	};
}
function cm(e, t) {
	let n = e.getParameter(e.MAX_VERTEX_ATTRIBS), r = {}, i = f(null), a = i, o = !1;
	function s(n, r, i, s, c) {
		let u = !1, f = d(n, s, i, r);
		a !== f && (a = f, l(a.object)), u = p(n, s, i, c), u && m(n, s, i, c), c !== null && t.update(c, e.ELEMENT_ARRAY_BUFFER), (u || o) && (o = !1, b(n, r, i, s), c !== null && e.bindBuffer(e.ELEMENT_ARRAY_BUFFER, t.get(c).buffer));
	}
	function c() {
		return e.createVertexArray();
	}
	function l(t) {
		return e.bindVertexArray(t);
	}
	function u(t) {
		return e.deleteVertexArray(t);
	}
	function d(e, t, n, i) {
		let a = i.wireframe === !0, o = r[t.id];
		o === void 0 && (o = {}, r[t.id] = o);
		let s = e.isInstancedMesh === !0 ? e.id : 0, l = o[s];
		l === void 0 && (l = {}, o[s] = l);
		let u = l[n.id];
		u === void 0 && (u = {}, l[n.id] = u);
		let d = u[a];
		return d === void 0 && (d = f(c()), u[a] = d), d;
	}
	function f(e) {
		let t = [], r = [], i = [];
		for (let e = 0; e < n; e++) t[e] = 0, r[e] = 0, i[e] = 0;
		return {
			geometry: null,
			program: null,
			wireframe: !1,
			newAttributes: t,
			enabledAttributes: r,
			attributeDivisors: i,
			object: e,
			attributes: {},
			index: null
		};
	}
	function p(e, t, n, r) {
		let i = a.attributes, o = t.attributes, s = 0, c = n.getAttributes();
		for (let t in c) if (c[t].location >= 0) {
			let n = i[t], r = o[t];
			if (r === void 0 && (t === "instanceMatrix" && e.instanceMatrix && (r = e.instanceMatrix), t === "instanceColor" && e.instanceColor && (r = e.instanceColor)), n === void 0 || n.attribute !== r || r && n.data !== r.data) return !0;
			s++;
		}
		return a.attributesNum !== s || a.index !== r;
	}
	function m(e, t, n, r) {
		let i = {}, o = t.attributes, s = 0, c = n.getAttributes();
		for (let t in c) if (c[t].location >= 0) {
			let n = o[t];
			n === void 0 && (t === "instanceMatrix" && e.instanceMatrix && (n = e.instanceMatrix), t === "instanceColor" && e.instanceColor && (n = e.instanceColor));
			let r = {};
			r.attribute = n, n && n.data && (r.data = n.data), i[t] = r, s++;
		}
		a.attributes = i, a.attributesNum = s, a.index = r;
	}
	function h() {
		let e = a.newAttributes;
		for (let t = 0, n = e.length; t < n; t++) e[t] = 0;
	}
	function g(e) {
		_(e, 0);
	}
	function _(t, n) {
		let r = a.newAttributes, i = a.enabledAttributes, o = a.attributeDivisors;
		r[t] = 1, i[t] === 0 && (e.enableVertexAttribArray(t), i[t] = 1), o[t] !== n && (e.vertexAttribDivisor(t, n), o[t] = n);
	}
	function v() {
		let t = a.newAttributes, n = a.enabledAttributes;
		for (let r = 0, i = n.length; r < i; r++) n[r] !== t[r] && (e.disableVertexAttribArray(r), n[r] = 0);
	}
	function y(t, n, r, i, a, o, s) {
		s === !0 ? e.vertexAttribIPointer(t, n, r, a, o) : e.vertexAttribPointer(t, n, r, i, a, o);
	}
	function b(n, r, i, a) {
		h();
		let o = a.attributes, s = i.getAttributes(), c = r.defaultAttributeValues;
		for (let r in s) {
			let i = s[r];
			if (i.location >= 0) {
				let s = o[r];
				if (s === void 0 && (r === "instanceMatrix" && n.instanceMatrix && (s = n.instanceMatrix), r === "instanceColor" && n.instanceColor && (s = n.instanceColor)), s !== void 0) {
					let r = s.normalized, o = s.itemSize, c = t.get(s);
					if (c === void 0) continue;
					let l = c.buffer, u = c.type, d = c.bytesPerElement, f = u === e.INT || u === e.UNSIGNED_INT || s.gpuType === 1013;
					if (s.isInterleavedBufferAttribute) {
						let t = s.data, c = t.stride, p = s.offset;
						if (t.isInstancedInterleavedBuffer) {
							for (let e = 0; e < i.locationSize; e++) _(i.location + e, t.meshPerAttribute);
							n.isInstancedMesh !== !0 && a._maxInstanceCount === void 0 && (a._maxInstanceCount = t.meshPerAttribute * t.count);
						} else for (let e = 0; e < i.locationSize; e++) g(i.location + e);
						e.bindBuffer(e.ARRAY_BUFFER, l);
						for (let e = 0; e < i.locationSize; e++) y(i.location + e, o / i.locationSize, u, r, c * d, (p + o / i.locationSize * e) * d, f);
					} else {
						if (s.isInstancedBufferAttribute) {
							for (let e = 0; e < i.locationSize; e++) _(i.location + e, s.meshPerAttribute);
							n.isInstancedMesh !== !0 && a._maxInstanceCount === void 0 && (a._maxInstanceCount = s.meshPerAttribute * s.count);
						} else for (let e = 0; e < i.locationSize; e++) g(i.location + e);
						e.bindBuffer(e.ARRAY_BUFFER, l);
						for (let e = 0; e < i.locationSize; e++) y(i.location + e, o / i.locationSize, u, r, o * d, o / i.locationSize * e * d, f);
					}
				} else if (c !== void 0) {
					let t = c[r];
					if (t !== void 0) switch (t.length) {
						case 2:
							e.vertexAttrib2fv(i.location, t);
							break;
						case 3:
							e.vertexAttrib3fv(i.location, t);
							break;
						case 4:
							e.vertexAttrib4fv(i.location, t);
							break;
						default: e.vertexAttrib1fv(i.location, t);
					}
				}
			}
		}
		v();
	}
	function x() {
		T();
		for (let e in r) {
			let t = r[e];
			for (let e in t) {
				let n = t[e];
				for (let e in n) {
					let t = n[e];
					for (let e in t) u(t[e].object), delete t[e];
					delete n[e];
				}
			}
			delete r[e];
		}
	}
	function S(e) {
		if (r[e.id] === void 0) return;
		let t = r[e.id];
		for (let e in t) {
			let n = t[e];
			for (let e in n) {
				let t = n[e];
				for (let e in t) u(t[e].object), delete t[e];
				delete n[e];
			}
		}
		delete r[e.id];
	}
	function C(e) {
		for (let t in r) {
			let n = r[t];
			for (let t in n) {
				let r = n[t];
				if (r[e.id] === void 0) continue;
				let i = r[e.id];
				for (let e in i) u(i[e].object), delete i[e];
				delete r[e.id];
			}
		}
	}
	function w(e) {
		for (let t in r) {
			let n = r[t], i = e.isInstancedMesh === !0 ? e.id : 0, a = n[i];
			if (a !== void 0) {
				for (let e in a) {
					let t = a[e];
					for (let e in t) u(t[e].object), delete t[e];
					delete a[e];
				}
				delete n[i], Object.keys(n).length === 0 && delete r[t];
			}
		}
	}
	function T() {
		E(), o = !0, a !== i && (a = i, l(a.object));
	}
	function E() {
		i.geometry = null, i.program = null, i.wireframe = !1;
	}
	return {
		setup: s,
		reset: T,
		resetDefaultState: E,
		dispose: x,
		releaseStatesOfGeometry: S,
		releaseStatesOfObject: w,
		releaseStatesOfProgram: C,
		initAttributes: h,
		enableAttribute: g,
		disableUnusedAttributes: v
	};
}
function lm(e, t, n) {
	let r;
	function i(e) {
		r = e;
	}
	function a(t, i) {
		e.drawArrays(r, t, i), n.update(i, r, 1);
	}
	function o(t, i, a) {
		a !== 0 && (e.drawArraysInstanced(r, t, i, a), n.update(i, r, a));
	}
	function s(e, i, a) {
		if (a === 0) return;
		t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(r, e, 0, i, 0, a);
		let o = 0;
		for (let e = 0; e < a; e++) o += i[e];
		n.update(o, r, 1);
	}
	this.setMode = i, this.render = a, this.renderInstances = o, this.renderMultiDraw = s;
}
function um(e, t, n, r) {
	let i;
	function a() {
		if (i !== void 0) return i;
		if (t.has("EXT_texture_filter_anisotropic") === !0) {
			let n = t.get("EXT_texture_filter_anisotropic");
			i = e.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
		} else i = 0;
		return i;
	}
	function o(t) {
		return !(t !== 1023 && r.convert(t) !== e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT));
	}
	function s(n) {
		let i = n === 1016 && (t.has("EXT_color_buffer_half_float") || t.has("EXT_color_buffer_float"));
		return !(n !== 1009 && r.convert(n) !== e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE) && n !== 1015 && !i);
	}
	function c(t) {
		if (t === "highp") {
			if (e.getShaderPrecisionFormat(e.VERTEX_SHADER, e.HIGH_FLOAT).precision > 0 && e.getShaderPrecisionFormat(e.FRAGMENT_SHADER, e.HIGH_FLOAT).precision > 0) return "highp";
			t = "mediump";
		}
		return t === "mediump" && e.getShaderPrecisionFormat(e.VERTEX_SHADER, e.MEDIUM_FLOAT).precision > 0 && e.getShaderPrecisionFormat(e.FRAGMENT_SHADER, e.MEDIUM_FLOAT).precision > 0 ? "mediump" : "lowp";
	}
	let l = n.precision === void 0 ? "highp" : n.precision, u = c(l);
	u !== l && (R("WebGLRenderer:", l, "not supported, using", u, "instead."), l = u);
	let d = n.logarithmicDepthBuffer === !0, f = n.reversedDepthBuffer === !0 && t.has("EXT_clip_control");
	n.reversedDepthBuffer === !0 && f === !1 && R("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");
	let p = e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS), m = e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS), h = e.getParameter(e.MAX_TEXTURE_SIZE), g = e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE), _ = e.getParameter(e.MAX_VERTEX_ATTRIBS), v = e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS), y = e.getParameter(e.MAX_VARYING_VECTORS), b = e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS), x = e.getParameter(e.MAX_SAMPLES), S = e.getParameter(e.SAMPLES);
	return {
		isWebGL2: !0,
		getMaxAnisotropy: a,
		getMaxPrecision: c,
		textureFormatReadable: o,
		textureTypeReadable: s,
		precision: l,
		logarithmicDepthBuffer: d,
		reversedDepthBuffer: f,
		maxTextures: p,
		maxVertexTextures: m,
		maxTextureSize: h,
		maxCubemapSize: g,
		maxAttributes: _,
		maxVertexUniforms: v,
		maxVaryings: y,
		maxFragmentUniforms: b,
		maxSamples: x,
		samples: S
	};
}
function dm(e) {
	let t = this, n = null, r = 0, i = !1, a = !1, o = new vs(), s = new W(), c = {
		value: null,
		needsUpdate: !1
	};
	this.uniform = c, this.numPlanes = 0, this.numIntersection = 0, this.init = function(e, t) {
		let n = e.length !== 0 || t || r !== 0 || i;
		return i = t, r = e.length, n;
	}, this.beginShadows = function() {
		a = !0, u(null);
	}, this.endShadows = function() {
		a = !1;
	}, this.setGlobalState = function(e, t) {
		n = u(e, t, 0);
	}, this.setState = function(t, o, s) {
		let d = t.clippingPlanes, f = t.clipIntersection, p = t.clipShadows, m = e.get(t);
		if (!i || d === null || d.length === 0 || a && !p) a ? u(null) : l();
		else {
			let e = a ? 0 : r, t = e * 4, i = m.clippingState || null;
			c.value = i, i = u(d, o, t, s);
			for (let e = 0; e !== t; ++e) i[e] = n[e];
			m.clippingState = i, this.numIntersection = f ? this.numPlanes : 0, this.numPlanes += e;
		}
	};
	function l() {
		c.value !== n && (c.value = n, c.needsUpdate = r > 0), t.numPlanes = r, t.numIntersection = 0;
	}
	function u(e, n, r, i) {
		let a = e === null ? 0 : e.length, l = null;
		if (a !== 0) {
			if (l = c.value, i !== !0 || l === null) {
				let t = r + a * 4, i = n.matrixWorldInverse;
				s.getNormalMatrix(i), (l === null || l.length < t) && (l = new Float32Array(t));
				for (let t = 0, n = r; t !== a; ++t, n += 4) o.copy(e[t]).applyMatrix4(i, s), o.normal.toArray(l, n), l[n + 3] = o.constant;
			}
			c.value = l, c.needsUpdate = !0;
		}
		return t.numPlanes = a, t.numIntersection = 0, l;
	}
}
var fm = 4, pm = [
	.125,
	.215,
	.35,
	.446,
	.526,
	.582
], mm = 20, hm = 256, gm = /*@__PURE__*/ new Id(), _m = /*@__PURE__*/ new J(), vm = null, ym = 0, bm = 0, xm = !1, Sm = /*@__PURE__*/ new U(), Cm = class {
	constructor(e) {
		this._renderer = e, this._pingPongRenderTarget = null, this._lodMax = 0, this._cubeSize = 0, this._sizeLods = [], this._sigmas = [], this._lodMeshes = [], this._backgroundBox = null, this._cubemapMaterial = null, this._equirectMaterial = null, this._blurMaterial = null, this._ggxMaterial = null;
	}
	fromScene(e, t = 0, n = .1, r = 100, i = {}) {
		let { size: a = 256, position: o = Sm } = i;
		vm = this._renderer.getRenderTarget(), ym = this._renderer.getActiveCubeFace(), bm = this._renderer.getActiveMipmapLevel(), xm = this._renderer.xr.enabled, this._renderer.xr.enabled = !1, this._setSize(a);
		let s = this._allocateTargets();
		return s.depthBuffer = !0, this._sceneToCubeUV(e, n, r, s, o), t > 0 && this._blur(s, 0, 0, t), this._applyPMREM(s), this._cleanup(s), s;
	}
	fromEquirectangular(e, t = null) {
		return this._fromTexture(e, t);
	}
	fromCubemap(e, t = null) {
		return this._fromTexture(e, t);
	}
	compileCubemapShader() {
		this._cubemapMaterial === null && (this._cubemapMaterial = Am(), this._compileMaterial(this._cubemapMaterial));
	}
	compileEquirectangularShader() {
		this._equirectMaterial === null && (this._equirectMaterial = km(), this._compileMaterial(this._equirectMaterial));
	}
	dispose() {
		this._dispose(), this._cubemapMaterial !== null && this._cubemapMaterial.dispose(), this._equirectMaterial !== null && this._equirectMaterial.dispose(), this._backgroundBox !== null && (this._backgroundBox.geometry.dispose(), this._backgroundBox.material.dispose());
	}
	_setSize(e) {
		this._lodMax = Math.floor(Math.log2(e)), this._cubeSize = 2 ** this._lodMax;
	}
	_dispose() {
		this._blurMaterial !== null && this._blurMaterial.dispose(), this._ggxMaterial !== null && this._ggxMaterial.dispose(), this._pingPongRenderTarget !== null && this._pingPongRenderTarget.dispose();
		for (let e = 0; e < this._lodMeshes.length; e++) this._lodMeshes[e].geometry.dispose();
	}
	_cleanup(e) {
		this._renderer.setRenderTarget(vm, ym, bm), this._renderer.xr.enabled = xm, e.scissorTest = !1, Em(e, 0, 0, e.width, e.height);
	}
	_fromTexture(e, t) {
		e.mapping === 301 || e.mapping === 302 ? this._setSize(e.image.length === 0 ? 16 : e.image[0].width || e.image[0].image.width) : this._setSize(e.image.width / 4), vm = this._renderer.getRenderTarget(), ym = this._renderer.getActiveCubeFace(), bm = this._renderer.getActiveMipmapLevel(), xm = this._renderer.xr.enabled, this._renderer.xr.enabled = !1;
		let n = t || this._allocateTargets();
		return this._textureToCubeUV(e, n), this._applyPMREM(n), this._cleanup(n), n;
	}
	_allocateTargets() {
		let e = 3 * Math.max(this._cubeSize, 112), t = 4 * this._cubeSize, n = {
			magFilter: et,
			minFilter: et,
			generateMipmaps: !1,
			type: ft,
			format: bt,
			colorSpace: kn,
			depthBuffer: !1
		}, r = Tm(e, t, n);
		if (this._pingPongRenderTarget === null || this._pingPongRenderTarget.width !== e || this._pingPongRenderTarget.height !== t) {
			this._pingPongRenderTarget !== null && this._dispose(), this._pingPongRenderTarget = Tm(e, t, n);
			let { _lodMax: r } = this;
			({lodMeshes: this._lodMeshes, sizeLods: this._sizeLods, sigmas: this._sigmas} = wm(r)), this._blurMaterial = Om(r, e, t), this._ggxMaterial = Dm(r, e, t);
		}
		return r;
	}
	_compileMaterial(e) {
		let t = new Ho(new Z(), e);
		this._renderer.compile(t, gm);
	}
	_sceneToCubeUV(e, t, n, r, i) {
		let a = new jd(90, 1, t, n), o = [
			1,
			-1,
			1,
			1,
			1,
			1
		], s = [
			1,
			1,
			1,
			-1,
			-1,
			-1
		], c = this._renderer, l = c.autoClear, u = c.toneMapping;
		c.getClearColor(_m), c.toneMapping = 0, c.autoClear = !1, c.state.buffers.depth.getReversed() && (c.setRenderTarget(r), c.clearDepth(), c.setRenderTarget(null)), this._backgroundBox === null && (this._backgroundBox = new Ho(new Cc(), new Ao({
			name: "PMREM.Background",
			side: 1,
			depthWrite: !1,
			depthTest: !1
		})));
		let d = this._backgroundBox, f = d.material, p = !1, m = e.background;
		m ? m.isColor && (f.color.copy(m), e.background = null, p = !0) : (f.color.copy(_m), p = !0);
		for (let t = 0; t < 6; t++) {
			let n = t % 3;
			n === 0 ? (a.up.set(0, o[t], 0), a.position.set(i.x, i.y, i.z), a.lookAt(i.x + s[t], i.y, i.z)) : n === 1 ? (a.up.set(0, 0, o[t]), a.position.set(i.x, i.y, i.z), a.lookAt(i.x, i.y + s[t], i.z)) : (a.up.set(0, o[t], 0), a.position.set(i.x, i.y, i.z), a.lookAt(i.x, i.y, i.z + s[t]));
			let l = this._cubeSize;
			Em(r, n * l, t > 2 ? l : 0, l, l), c.setRenderTarget(r), p && c.render(d, a), c.render(e, a);
		}
		c.toneMapping = u, c.autoClear = l, e.background = m;
	}
	_textureToCubeUV(e, t) {
		let n = this._renderer, r = e.mapping === 301 || e.mapping === 302;
		r ? (this._cubemapMaterial === null && (this._cubemapMaterial = Am()), this._cubemapMaterial.uniforms.flipEnvMap.value = e.isRenderTargetTexture === !1 ? -1 : 1) : this._equirectMaterial === null && (this._equirectMaterial = km());
		let i = r ? this._cubemapMaterial : this._equirectMaterial, a = this._lodMeshes[0];
		a.material = i;
		let o = i.uniforms;
		o.envMap.value = e;
		let s = this._cubeSize;
		Em(t, 0, 0, 3 * s, 2 * s), n.setRenderTarget(t), n.render(a, gm);
	}
	_applyPMREM(e) {
		let t = this._renderer, n = t.autoClear;
		t.autoClear = !1;
		let r = this._lodMeshes.length;
		for (let t = 1; t < r; t++) this._applyGGXFilter(e, t - 1, t);
		t.autoClear = n;
	}
	_applyGGXFilter(e, t, n) {
		let r = this._renderer, i = this._pingPongRenderTarget, a = this._ggxMaterial, o = this._lodMeshes[n];
		o.material = a;
		let s = a.uniforms, c = n / (this._lodMeshes.length - 1), l = t / (this._lodMeshes.length - 1), u = Math.sqrt(c * c - l * l) * (0 + c * 1.25), { _lodMax: d } = this, f = this._sizeLods[n], p = 3 * f * (n > d - fm ? n - d + fm : 0), m = 4 * (this._cubeSize - f);
		s.envMap.value = e.texture, s.roughness.value = u, s.mipInt.value = d - t, Em(i, p, m, 3 * f, 2 * f), r.setRenderTarget(i), r.render(o, gm), s.envMap.value = i.texture, s.roughness.value = 0, s.mipInt.value = d - n, Em(e, p, m, 3 * f, 2 * f), r.setRenderTarget(e), r.render(o, gm);
	}
	_blur(e, t, n, r, i) {
		let a = this._pingPongRenderTarget;
		this._halfBlur(e, a, t, n, r, "latitudinal", i), this._halfBlur(a, e, n, n, r, "longitudinal", i);
	}
	_halfBlur(e, t, n, r, i, a, o) {
		let s = this._renderer, c = this._blurMaterial;
		a !== "latitudinal" && a !== "longitudinal" && z("blur direction must be either latitudinal or longitudinal!");
		let l = this._lodMeshes[r];
		l.material = c;
		let u = c.uniforms, d = this._sizeLods[n] - 1, f = isFinite(i) ? Math.PI / (2 * d) : 2 * Math.PI / (2 * mm - 1), p = i / f, m = isFinite(i) ? 1 + Math.floor(3 * p) : mm;
		m > mm && R(`sigmaRadians, ${i}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${mm}`);
		let h = [], g = 0;
		for (let e = 0; e < mm; ++e) {
			let t = e / p, n = Math.exp(-t * t / 2);
			h.push(n), e === 0 ? g += n : e < m && (g += 2 * n);
		}
		for (let e = 0; e < h.length; e++) h[e] = h[e] / g;
		u.envMap.value = e.texture, u.samples.value = m, u.weights.value = h, u.latitudinal.value = a === "latitudinal", o && (u.poleAxis.value = o);
		let { _lodMax: _ } = this;
		u.dTheta.value = f, u.mipInt.value = _ - n;
		let v = this._sizeLods[r];
		Em(t, 3 * v * (r > _ - fm ? r - _ + fm : 0), 4 * (this._cubeSize - v), 3 * v, 2 * v), s.setRenderTarget(t), s.render(l, gm);
	}
};
function wm(e) {
	let t = [], n = [], r = [], i = e, a = e - fm + 1 + pm.length;
	for (let o = 0; o < a; o++) {
		let a = 2 ** i;
		t.push(a);
		let s = 1 / a;
		o > e - fm ? s = pm[o - e + fm - 1] : o === 0 && (s = 0), n.push(s);
		let c = 1 / (a - 2), l = -c, u = 1 + c, d = [
			l,
			l,
			u,
			l,
			u,
			u,
			l,
			l,
			u,
			u,
			l,
			u
		], f = /* @__PURE__ */ new Float32Array(108), p = /* @__PURE__ */ new Float32Array(72), m = /* @__PURE__ */ new Float32Array(36);
		for (let e = 0; e < 6; e++) {
			let t = e % 3 * 2 / 3 - 1, n = e > 2 ? 0 : -1, r = [
				t,
				n,
				0,
				t + 2 / 3,
				n,
				0,
				t + 2 / 3,
				n + 1,
				0,
				t,
				n,
				0,
				t + 2 / 3,
				n + 1,
				0,
				t,
				n + 1,
				0
			];
			f.set(r, 18 * e), p.set(d, 12 * e);
			let i = [
				e,
				e,
				e,
				e,
				e,
				e
			];
			m.set(i, 6 * e);
		}
		let h = new Z();
		h.setAttribute("position", new Y(f, 3)), h.setAttribute("uv", new Y(p, 2)), h.setAttribute("faceIndex", new Y(m, 1)), r.push(new Ho(h, null)), i > fm && i--;
	}
	return {
		lodMeshes: r,
		sizeLods: t,
		sigmas: n
	};
}
function Tm(e, t, n) {
	let r = new si(e, t, n);
	return r.texture.mapping = 306, r.texture.name = "PMREM.cubeUv", r.scissorTest = !0, r;
}
function Em(e, t, n, r, i) {
	e.viewport.set(t, n, r, i), e.scissor.set(t, n, r, i);
}
function Dm(e, t, n) {
	return new Su({
		name: "PMREMGGXConvolution",
		defines: {
			GGX_SAMPLES: hm,
			CUBEUV_TEXEL_WIDTH: 1 / t,
			CUBEUV_TEXEL_HEIGHT: 1 / n,
			CUBEUV_MAX_MIP: `${e}.0`
		},
		uniforms: {
			envMap: { value: null },
			roughness: { value: 0 },
			mipInt: { value: 0 }
		},
		vertexShader: jm(),
		fragmentShader: "\n\n			precision highp float;\n			precision highp int;\n\n			varying vec3 vOutputDirection;\n\n			uniform sampler2D envMap;\n			uniform float roughness;\n			uniform float mipInt;\n\n			#define ENVMAP_TYPE_CUBE_UV\n			#include <cube_uv_reflection_fragment>\n\n			#define PI 3.14159265359\n\n			// Van der Corput radical inverse\n			float radicalInverse_VdC(uint bits) {\n				bits = (bits << 16u) | (bits >> 16u);\n				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);\n				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);\n				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);\n				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);\n				return float(bits) * 2.3283064365386963e-10; // / 0x100000000\n			}\n\n			// Hammersley sequence\n			vec2 hammersley(uint i, uint N) {\n				return vec2(float(i) / float(N), radicalInverse_VdC(i));\n			}\n\n			// GGX VNDF importance sampling (Eric Heitz 2018)\n			// \"Sampling the GGX Distribution of Visible Normals\"\n			// https://jcgt.org/published/0007/04/01/\n			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {\n				float alpha = roughness * roughness;\n\n				// Section 4.1: Orthonormal basis\n				vec3 T1 = vec3(1.0, 0.0, 0.0);\n				vec3 T2 = cross(V, T1);\n\n				// Section 4.2: Parameterization of projected area\n				float r = sqrt(Xi.x);\n				float phi = 2.0 * PI * Xi.y;\n				float t1 = r * cos(phi);\n				float t2 = r * sin(phi);\n				float s = 0.5 * (1.0 + V.z);\n				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;\n\n				// Section 4.3: Reprojection onto hemisphere\n				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;\n\n				// Section 3.4: Transform back to ellipsoid configuration\n				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));\n			}\n\n			void main() {\n				vec3 N = normalize(vOutputDirection);\n				vec3 V = N; // Assume view direction equals normal for pre-filtering\n\n				vec3 prefilteredColor = vec3(0.0);\n				float totalWeight = 0.0;\n\n				// For very low roughness, just sample the environment directly\n				if (roughness < 0.001) {\n					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);\n					return;\n				}\n\n				// Tangent space basis for VNDF sampling\n				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);\n				vec3 tangent = normalize(cross(up, N));\n				vec3 bitangent = cross(N, tangent);\n\n				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {\n					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));\n\n					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)\n					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);\n\n					// Transform H back to world space\n					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);\n					vec3 L = normalize(2.0 * dot(V, H) * H - V);\n\n					float NdotL = max(dot(N, L), 0.0);\n\n					if(NdotL > 0.0) {\n						// Sample environment at fixed mip level\n						// VNDF importance sampling handles the distribution filtering\n						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);\n\n						// Weight by NdotL for the split-sum approximation\n						// VNDF PDF naturally accounts for the visible microfacet distribution\n						prefilteredColor += sampleColor * NdotL;\n						totalWeight += NdotL;\n					}\n				}\n\n				if (totalWeight > 0.0) {\n					prefilteredColor = prefilteredColor / totalWeight;\n				}\n\n				gl_FragColor = vec4(prefilteredColor, 1.0);\n			}\n		",
		blending: 0,
		depthTest: !1,
		depthWrite: !1
	});
}
function Om(e, t, n) {
	let r = new Float32Array(mm), i = new U(0, 1, 0);
	return new Su({
		name: "SphericalGaussianBlur",
		defines: {
			n: mm,
			CUBEUV_TEXEL_WIDTH: 1 / t,
			CUBEUV_TEXEL_HEIGHT: 1 / n,
			CUBEUV_MAX_MIP: `${e}.0`
		},
		uniforms: {
			envMap: { value: null },
			samples: { value: 1 },
			weights: { value: r },
			latitudinal: { value: !1 },
			dTheta: { value: 0 },
			mipInt: { value: 0 },
			poleAxis: { value: i }
		},
		vertexShader: jm(),
		fragmentShader: "\n\n			precision mediump float;\n			precision mediump int;\n\n			varying vec3 vOutputDirection;\n\n			uniform sampler2D envMap;\n			uniform int samples;\n			uniform float weights[ n ];\n			uniform bool latitudinal;\n			uniform float dTheta;\n			uniform float mipInt;\n			uniform vec3 poleAxis;\n\n			#define ENVMAP_TYPE_CUBE_UV\n			#include <cube_uv_reflection_fragment>\n\n			vec3 getSample( float theta, vec3 axis ) {\n\n				float cosTheta = cos( theta );\n				// Rodrigues' axis-angle rotation\n				vec3 sampleDirection = vOutputDirection * cosTheta\n					+ cross( axis, vOutputDirection ) * sin( theta )\n					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );\n\n				return bilinearCubeUV( envMap, sampleDirection, mipInt );\n\n			}\n\n			void main() {\n\n				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );\n\n				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {\n\n					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );\n\n				}\n\n				axis = normalize( axis );\n\n				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );\n				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );\n\n				for ( int i = 1; i < n; i++ ) {\n\n					if ( i >= samples ) {\n\n						break;\n\n					}\n\n					float theta = dTheta * float( i );\n					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );\n					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );\n\n				}\n\n			}\n		",
		blending: 0,
		depthTest: !1,
		depthWrite: !1
	});
}
function km() {
	return new Su({
		name: "EquirectangularToCubeUV",
		uniforms: { envMap: { value: null } },
		vertexShader: jm(),
		fragmentShader: "\n\n			precision mediump float;\n			precision mediump int;\n\n			varying vec3 vOutputDirection;\n\n			uniform sampler2D envMap;\n\n			#include <common>\n\n			void main() {\n\n				vec3 outputDirection = normalize( vOutputDirection );\n				vec2 uv = equirectUv( outputDirection );\n\n				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );\n\n			}\n		",
		blending: 0,
		depthTest: !1,
		depthWrite: !1
	});
}
function Am() {
	return new Su({
		name: "CubemapToCubeUV",
		uniforms: {
			envMap: { value: null },
			flipEnvMap: { value: -1 }
		},
		vertexShader: jm(),
		fragmentShader: "\n\n			precision mediump float;\n			precision mediump int;\n\n			uniform float flipEnvMap;\n\n			varying vec3 vOutputDirection;\n\n			uniform samplerCube envMap;\n\n			void main() {\n\n				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );\n\n			}\n		",
		blending: 0,
		depthTest: !1,
		depthWrite: !1
	});
}
function jm() {
	return "\n\n		precision mediump float;\n		precision mediump int;\n\n		attribute float faceIndex;\n\n		varying vec3 vOutputDirection;\n\n		// RH coordinate system; PMREM face-indexing convention\n		vec3 getDirection( vec2 uv, float face ) {\n\n			uv = 2.0 * uv - 1.0;\n\n			vec3 direction = vec3( uv, 1.0 );\n\n			if ( face == 0.0 ) {\n\n				direction = direction.zyx; // ( 1, v, u ) pos x\n\n			} else if ( face == 1.0 ) {\n\n				direction = direction.xzy;\n				direction.xz *= -1.0; // ( -u, 1, -v ) pos y\n\n			} else if ( face == 2.0 ) {\n\n				direction.x *= -1.0; // ( -u, v, 1 ) pos z\n\n			} else if ( face == 3.0 ) {\n\n				direction = direction.zyx;\n				direction.xz *= -1.0; // ( -1, v, -u ) neg x\n\n			} else if ( face == 4.0 ) {\n\n				direction = direction.xzy;\n				direction.xy *= -1.0; // ( -u, -1, v ) neg y\n\n			} else if ( face == 5.0 ) {\n\n				direction.z *= -1.0; // ( u, v, -1 ) neg z\n\n			}\n\n			return direction;\n\n		}\n\n		void main() {\n\n			vOutputDirection = getDirection( uv, faceIndex );\n			gl_Position = vec4( position, 1.0 );\n\n		}\n	";
}
var Mm = class extends si {
	constructor(e = 1, t = {}) {
		super(e, e, t), this.isWebGLCubeRenderTarget = !0;
		let n = {
			width: e,
			height: e,
			depth: 1
		}, r = [
			n,
			n,
			n,
			n,
			n,
			n
		];
		this.texture = new _c(r), this._setTextureOptions(t), this.texture.isRenderTargetTexture = !0;
	}
	fromEquirectangularTexture(e, t) {
		this.texture.type = t.type, this.texture.colorSpace = t.colorSpace, this.texture.generateMipmaps = t.generateMipmaps, this.texture.minFilter = t.minFilter, this.texture.magFilter = t.magFilter;
		let n = {
			uniforms: { tEquirect: { value: null } },
			vertexShader: "\n\n				varying vec3 vWorldDirection;\n\n				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {\n\n					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );\n\n				}\n\n				void main() {\n\n					vWorldDirection = transformDirection( position, modelMatrix );\n\n					#include <begin_vertex>\n					#include <project_vertex>\n\n				}\n			",
			fragmentShader: "\n\n				uniform sampler2D tEquirect;\n\n				varying vec3 vWorldDirection;\n\n				#include <common>\n\n				void main() {\n\n					vec3 direction = normalize( vWorldDirection );\n\n					vec2 sampleUV = equirectUv( direction );\n\n					gl_FragColor = texture2D( tEquirect, sampleUV );\n\n				}\n			"
		}, r = new Cc(5, 5, 5), i = new Su({
			name: "CubemapFromEquirect",
			uniforms: mu(n.uniforms),
			vertexShader: n.vertexShader,
			fragmentShader: n.fragmentShader,
			side: 1,
			blending: 0
		});
		i.uniforms.tEquirect.value = t;
		let a = new Ho(r, i), o = t.minFilter;
		return t.minFilter === 1008 && (t.minFilter = et), new df(1, 10, this).update(e, a), t.minFilter = o, a.geometry.dispose(), a.material.dispose(), this;
	}
	clear(e, t = !0, n = !0, r = !0) {
		let i = e.getRenderTarget();
		for (let i = 0; i < 6; i++) e.setRenderTarget(this, i), e.clear(t, n, r);
		e.setRenderTarget(i);
	}
};
function Nm(e) {
	let t = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap(), r = null;
	function i(e, t = !1) {
		return e == null ? null : t ? o(e) : a(e);
	}
	function a(n) {
		if (n && n.isTexture) {
			let r = n.mapping;
			if (r === 303 || r === 304) if (t.has(n)) {
				let e = t.get(n).texture;
				return s(e, n.mapping);
			} else {
				let r = n.image;
				if (r && r.height > 0) {
					let i = new Mm(r.height);
					return i.fromEquirectangularTexture(e, n), t.set(n, i), n.addEventListener("dispose", l), s(i.texture, n.mapping);
				} else return null;
			}
		}
		return n;
	}
	function o(t) {
		if (t && t.isTexture) {
			let i = t.mapping, a = i === 303 || i === 304, o = i === 301 || i === 302;
			if (a || o) {
				let i = n.get(t), s = i === void 0 ? 0 : i.texture.pmremVersion;
				if (t.isRenderTargetTexture && t.pmremVersion !== s) return r === null && (r = new Cm(e)), i = a ? r.fromEquirectangular(t, i) : r.fromCubemap(t, i), i.texture.pmremVersion = t.pmremVersion, n.set(t, i), i.texture;
				if (i !== void 0) return i.texture;
				{
					let s = t.image;
					return a && s && s.height > 0 || o && s && c(s) ? (r === null && (r = new Cm(e)), i = a ? r.fromEquirectangular(t) : r.fromCubemap(t), i.texture.pmremVersion = t.pmremVersion, n.set(t, i), t.addEventListener("dispose", u), i.texture) : null;
				}
			}
		}
		return t;
	}
	function s(e, t) {
		return t === 303 ? e.mapping = 301 : t === 304 && (e.mapping = 302), e;
	}
	function c(e) {
		let t = 0;
		for (let n = 0; n < 6; n++) e[n] !== void 0 && t++;
		return t === 6;
	}
	function l(e) {
		let n = e.target;
		n.removeEventListener("dispose", l);
		let r = t.get(n);
		r !== void 0 && (t.delete(n), r.dispose());
	}
	function u(e) {
		let t = e.target;
		t.removeEventListener("dispose", u);
		let r = n.get(t);
		r !== void 0 && (n.delete(t), r.dispose());
	}
	function d() {
		t = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap(), r !== null && (r.dispose(), r = null);
	}
	return {
		get: i,
		dispose: d
	};
}
function Pm(e) {
	let t = {};
	function n(n) {
		if (t[n] !== void 0) return t[n];
		let r = e.getExtension(n);
		return t[n] = r, r;
	}
	return {
		has: function(e) {
			return n(e) !== null;
		},
		init: function() {
			n("EXT_color_buffer_float"), n("WEBGL_clip_cull_distance"), n("OES_texture_float_linear"), n("EXT_color_buffer_half_float"), n("WEBGL_multisampled_render_to_texture"), n("WEBGL_render_shared_exponent");
		},
		get: function(e) {
			let t = n(e);
			return t === null && pr("WebGLRenderer: " + e + " extension not supported."), t;
		}
	};
}
function Fm(e, t, n, r) {
	let i = {}, a = /* @__PURE__ */ new WeakMap();
	function o(e) {
		let s = e.target;
		s.index !== null && t.remove(s.index);
		for (let e in s.attributes) t.remove(s.attributes[e]);
		s.removeEventListener("dispose", o), delete i[s.id];
		let c = a.get(s);
		c && (t.remove(c), a.delete(s)), r.releaseStatesOfGeometry(s), s.isInstancedBufferGeometry === !0 && delete s._maxInstanceCount, n.memory.geometries--;
	}
	function s(e, t) {
		return i[t.id] === !0 ? t : (t.addEventListener("dispose", o), i[t.id] = !0, n.memory.geometries++, t);
	}
	function c(n) {
		let r = n.attributes;
		for (let n in r) t.update(r[n], e.ARRAY_BUFFER);
	}
	function l(e) {
		let n = [], r = e.index, i = e.attributes.position, o = 0;
		if (i === void 0) return;
		if (r !== null) {
			let e = r.array;
			o = r.version;
			for (let t = 0, r = e.length; t < r; t += 3) {
				let r = e[t + 0], i = e[t + 1], a = e[t + 2];
				n.push(r, i, i, a, a, r);
			}
		} else {
			let e = i.array;
			o = i.version;
			for (let t = 0, r = e.length / 3 - 1; t < r; t += 3) {
				let e = t + 0, r = t + 1, i = t + 2;
				n.push(e, r, r, i, i, e);
			}
		}
		let s = new (i.count >= 65535 ? Ra : Ia)(n, 1);
		s.version = o;
		let c = a.get(e);
		c && t.remove(c), a.set(e, s);
	}
	function u(e) {
		let t = a.get(e);
		if (t) {
			let n = e.index;
			n !== null && t.version < n.version && l(e);
		} else l(e);
		return a.get(e);
	}
	return {
		get: s,
		update: c,
		getWireframeAttribute: u
	};
}
function Im(e, t, n) {
	let r;
	function i(e) {
		r = e;
	}
	let a, o;
	function s(e) {
		a = e.type, o = e.bytesPerElement;
	}
	function c(t, i) {
		e.drawElements(r, i, a, t * o), n.update(i, r, 1);
	}
	function l(t, i, s) {
		s !== 0 && (e.drawElementsInstanced(r, i, a, t * o, s), n.update(i, r, s));
	}
	function u(e, i, o) {
		if (o === 0) return;
		t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(r, i, 0, a, e, 0, o);
		let s = 0;
		for (let e = 0; e < o; e++) s += i[e];
		n.update(s, r, 1);
	}
	this.setMode = i, this.setIndex = s, this.render = c, this.renderInstances = l, this.renderMultiDraw = u;
}
function Lm(e) {
	let t = {
		geometries: 0,
		textures: 0
	}, n = {
		frame: 0,
		calls: 0,
		triangles: 0,
		points: 0,
		lines: 0
	};
	function r(t, r, i) {
		switch (n.calls++, r) {
			case e.TRIANGLES:
				n.triangles += t / 3 * i;
				break;
			case e.LINES:
				n.lines += t / 2 * i;
				break;
			case e.LINE_STRIP:
				n.lines += i * (t - 1);
				break;
			case e.LINE_LOOP:
				n.lines += i * t;
				break;
			case e.POINTS:
				n.points += i * t;
				break;
			default:
				z("WebGLInfo: Unknown draw mode:", r);
				break;
		}
	}
	function i() {
		n.calls = 0, n.triangles = 0, n.points = 0, n.lines = 0;
	}
	return {
		memory: t,
		render: n,
		programs: null,
		autoReset: !0,
		reset: i,
		update: r
	};
}
function Rm(e, t, n) {
	let r = /* @__PURE__ */ new WeakMap(), i = new ai();
	function a(a, o, s) {
		let c = a.morphTargetInfluences, l = o.morphAttributes.position || o.morphAttributes.normal || o.morphAttributes.color, u = l === void 0 ? 0 : l.length, d = r.get(o);
		if (d === void 0 || d.count !== u) {
			d !== void 0 && d.texture.dispose();
			let e = o.morphAttributes.position !== void 0, n = o.morphAttributes.normal !== void 0, a = o.morphAttributes.color !== void 0, s = o.morphAttributes.position || [], c = o.morphAttributes.normal || [], l = o.morphAttributes.color || [], f = 0;
			e === !0 && (f = 1), n === !0 && (f = 2), a === !0 && (f = 3);
			let p = o.attributes.position.count * f, m = 1;
			p > t.maxTextureSize && (m = Math.ceil(p / t.maxTextureSize), p = t.maxTextureSize);
			let h = new Float32Array(p * m * 4 * u), g = new ci(h, p, m, u);
			g.type = dt, g.needsUpdate = !0;
			let _ = f * 4;
			for (let t = 0; t < u; t++) {
				let r = s[t], o = c[t], u = l[t], d = p * m * 4 * t;
				for (let t = 0; t < r.count; t++) {
					let s = t * _;
					e === !0 && (i.fromBufferAttribute(r, t), h[d + s + 0] = i.x, h[d + s + 1] = i.y, h[d + s + 2] = i.z, h[d + s + 3] = 0), n === !0 && (i.fromBufferAttribute(o, t), h[d + s + 4] = i.x, h[d + s + 5] = i.y, h[d + s + 6] = i.z, h[d + s + 7] = 0), a === !0 && (i.fromBufferAttribute(u, t), h[d + s + 8] = i.x, h[d + s + 9] = i.y, h[d + s + 10] = i.z, h[d + s + 11] = u.itemSize === 4 ? i.w : 1);
				}
			}
			d = {
				count: u,
				texture: g,
				size: new H(p, m)
			}, r.set(o, d);
			function v() {
				g.dispose(), r.delete(o), o.removeEventListener("dispose", v);
			}
			o.addEventListener("dispose", v);
		}
		if (a.isInstancedMesh === !0 && a.morphTexture !== null) s.getUniforms().setValue(e, "morphTexture", a.morphTexture, n);
		else {
			let t = 0;
			for (let e = 0; e < c.length; e++) t += c[e];
			let n = o.morphTargetsRelative ? 1 : 1 - t;
			s.getUniforms().setValue(e, "morphTargetBaseInfluence", n), s.getUniforms().setValue(e, "morphTargetInfluences", c);
		}
		s.getUniforms().setValue(e, "morphTargetsTexture", d.texture, n), s.getUniforms().setValue(e, "morphTargetsTextureSize", d.size);
	}
	return { update: a };
}
function zm(e, t, n, r, i) {
	let a = /* @__PURE__ */ new WeakMap();
	function o(r) {
		let o = i.render.frame, s = r.geometry, l = t.get(r, s);
		if (a.get(l) !== o && (t.update(l), a.set(l, o)), r.isInstancedMesh && (r.hasEventListener("dispose", c) === !1 && r.addEventListener("dispose", c), a.get(r) !== o && (n.update(r.instanceMatrix, e.ARRAY_BUFFER), r.instanceColor !== null && n.update(r.instanceColor, e.ARRAY_BUFFER), a.set(r, o))), r.isSkinnedMesh) {
			let e = r.skeleton;
			a.get(e) !== o && (e.update(), a.set(e, o));
		}
		return l;
	}
	function s() {
		a = /* @__PURE__ */ new WeakMap();
	}
	function c(e) {
		let t = e.target;
		t.removeEventListener("dispose", c), r.releaseStatesOfObject(t), n.remove(t.instanceMatrix), t.instanceColor !== null && n.remove(t.instanceColor);
	}
	return {
		update: o,
		dispose: s
	};
}
var Bm = {
	1: "LINEAR_TONE_MAPPING",
	2: "REINHARD_TONE_MAPPING",
	3: "CINEON_TONE_MAPPING",
	4: "ACES_FILMIC_TONE_MAPPING",
	6: "AGX_TONE_MAPPING",
	7: "NEUTRAL_TONE_MAPPING",
	5: "CUSTOM_TONE_MAPPING"
};
function Vm(e, t, n, r, i, a) {
	let o = new si(t, n, {
		type: e,
		depthBuffer: i,
		stencilBuffer: a,
		samples: r ? 4 : 0,
		depthTexture: i ? new bc(t, n) : void 0
	}), s = new si(t, n, {
		type: ft,
		depthBuffer: !1,
		stencilBuffer: !1
	}), c = new Z();
	c.setAttribute("position", new X([
		-1,
		3,
		0,
		-1,
		-1,
		0,
		3,
		-1,
		0
	], 3)), c.setAttribute("uv", new X([
		0,
		2,
		0,
		0,
		2,
		0
	], 2));
	let l = new Cu({
		uniforms: { tDiffuse: { value: null } },
		vertexShader: "\n			precision highp float;\n\n			uniform mat4 modelViewMatrix;\n			uniform mat4 projectionMatrix;\n\n			attribute vec3 position;\n			attribute vec2 uv;\n\n			varying vec2 vUv;\n\n			void main() {\n				vUv = uv;\n				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n			}",
		fragmentShader: "\n			precision highp float;\n\n			uniform sampler2D tDiffuse;\n\n			varying vec2 vUv;\n\n			#include <tonemapping_pars_fragment>\n			#include <colorspace_pars_fragment>\n\n			void main() {\n				gl_FragColor = texture2D( tDiffuse, vUv );\n\n				#ifdef LINEAR_TONE_MAPPING\n					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );\n				#elif defined( REINHARD_TONE_MAPPING )\n					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );\n				#elif defined( CINEON_TONE_MAPPING )\n					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );\n				#elif defined( ACES_FILMIC_TONE_MAPPING )\n					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );\n				#elif defined( AGX_TONE_MAPPING )\n					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );\n				#elif defined( NEUTRAL_TONE_MAPPING )\n					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );\n				#elif defined( CUSTOM_TONE_MAPPING )\n					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );\n				#endif\n\n				#ifdef SRGB_TRANSFER\n					gl_FragColor = sRGBTransferOETF( gl_FragColor );\n				#endif\n			}",
		depthTest: !1,
		depthWrite: !1
	}), u = new Ho(c, l), d = new Id(-1, 1, 1, -1, 0, 1), f = null, p = null, m = !1, h, g = null, _ = [], v = !1;
	this.setSize = function(e, t) {
		o.setSize(e, t), s.setSize(e, t);
		for (let n = 0; n < _.length; n++) {
			let r = _[n];
			r.setSize && r.setSize(e, t);
		}
	}, this.setEffects = function(e) {
		_ = e, v = _.length > 0 && _[0].isRenderPass === !0;
		let t = o.width, n = o.height;
		for (let e = 0; e < _.length; e++) {
			let r = _[e];
			r.setSize && r.setSize(t, n);
		}
	}, this.begin = function(e, t) {
		if (m || e.toneMapping === 0 && _.length === 0) return !1;
		if (g = t, t !== null) {
			let e = t.width, n = t.height;
			(o.width !== e || o.height !== n) && this.setSize(e, n);
		}
		return v === !1 && e.setRenderTarget(o), h = e.toneMapping, e.toneMapping = 0, !0;
	}, this.hasRenderPass = function() {
		return v;
	}, this.end = function(e, t) {
		e.toneMapping = h, m = !0;
		let n = o, r = s;
		for (let i = 0; i < _.length; i++) {
			let a = _[i];
			if (a.enabled !== !1 && (a.render(e, r, n, t), a.needsSwap !== !1)) {
				let e = n;
				n = r, r = e;
			}
		}
		if (f !== e.outputColorSpace || p !== e.toneMapping) {
			f = e.outputColorSpace, p = e.toneMapping, l.defines = {}, G.getTransfer(f) === "srgb" && (l.defines.SRGB_TRANSFER = "");
			let t = Bm[p];
			t && (l.defines[t] = ""), l.needsUpdate = !0;
		}
		l.uniforms.tDiffuse.value = n.texture, e.setRenderTarget(g), e.render(u, d), g = null, m = !1;
	}, this.isCompositing = function() {
		return m;
	}, this.dispose = function() {
		o.depthTexture && o.depthTexture.dispose(), o.dispose(), s.dispose(), c.dispose(), l.dispose();
	};
}
var Hm = /*@__PURE__*/ new ii(), Um = /*@__PURE__*/ new bc(1, 1), Wm = /*@__PURE__*/ new ci(), Gm = /*@__PURE__*/ new ui(), Km = /*@__PURE__*/ new _c(), qm = [], Jm = [], Ym = /* @__PURE__ */ new Float32Array(16), Xm = /* @__PURE__ */ new Float32Array(9), Zm = /* @__PURE__ */ new Float32Array(4);
function Qm(e, t, n) {
	let r = e[0];
	if (r <= 0 || r > 0) return e;
	let i = t * n, a = qm[i];
	if (a === void 0 && (a = new Float32Array(i), qm[i] = a), t !== 0) {
		r.toArray(a, 0);
		for (let r = 1, i = 0; r !== t; ++r) i += n, e[r].toArray(a, i);
	}
	return a;
}
function $m(e, t) {
	if (e.length !== t.length) return !1;
	for (let n = 0, r = e.length; n < r; n++) if (e[n] !== t[n]) return !1;
	return !0;
}
function eh(e, t) {
	for (let n = 0, r = t.length; n < r; n++) e[n] = t[n];
}
function th(e, t) {
	let n = Jm[t];
	n === void 0 && (n = new Int32Array(t), Jm[t] = n);
	for (let r = 0; r !== t; ++r) n[r] = e.allocateTextureUnit();
	return n;
}
function nh(e, t) {
	let n = this.cache;
	n[0] !== t && (e.uniform1f(this.addr, t), n[0] = t);
}
function rh(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y) && (e.uniform2f(this.addr, t.x, t.y), n[0] = t.x, n[1] = t.y);
	else {
		if ($m(n, t)) return;
		e.uniform2fv(this.addr, t), eh(n, t);
	}
}
function ih(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y || n[2] !== t.z) && (e.uniform3f(this.addr, t.x, t.y, t.z), n[0] = t.x, n[1] = t.y, n[2] = t.z);
	else if (t.r !== void 0) (n[0] !== t.r || n[1] !== t.g || n[2] !== t.b) && (e.uniform3f(this.addr, t.r, t.g, t.b), n[0] = t.r, n[1] = t.g, n[2] = t.b);
	else {
		if ($m(n, t)) return;
		e.uniform3fv(this.addr, t), eh(n, t);
	}
}
function ah(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y || n[2] !== t.z || n[3] !== t.w) && (e.uniform4f(this.addr, t.x, t.y, t.z, t.w), n[0] = t.x, n[1] = t.y, n[2] = t.z, n[3] = t.w);
	else {
		if ($m(n, t)) return;
		e.uniform4fv(this.addr, t), eh(n, t);
	}
}
function oh(e, t) {
	let n = this.cache, r = t.elements;
	if (r === void 0) {
		if ($m(n, t)) return;
		e.uniformMatrix2fv(this.addr, !1, t), eh(n, t);
	} else {
		if ($m(n, r)) return;
		Zm.set(r), e.uniformMatrix2fv(this.addr, !1, Zm), eh(n, r);
	}
}
function sh(e, t) {
	let n = this.cache, r = t.elements;
	if (r === void 0) {
		if ($m(n, t)) return;
		e.uniformMatrix3fv(this.addr, !1, t), eh(n, t);
	} else {
		if ($m(n, r)) return;
		Xm.set(r), e.uniformMatrix3fv(this.addr, !1, Xm), eh(n, r);
	}
}
function ch(e, t) {
	let n = this.cache, r = t.elements;
	if (r === void 0) {
		if ($m(n, t)) return;
		e.uniformMatrix4fv(this.addr, !1, t), eh(n, t);
	} else {
		if ($m(n, r)) return;
		Ym.set(r), e.uniformMatrix4fv(this.addr, !1, Ym), eh(n, r);
	}
}
function lh(e, t) {
	let n = this.cache;
	n[0] !== t && (e.uniform1i(this.addr, t), n[0] = t);
}
function uh(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y) && (e.uniform2i(this.addr, t.x, t.y), n[0] = t.x, n[1] = t.y);
	else {
		if ($m(n, t)) return;
		e.uniform2iv(this.addr, t), eh(n, t);
	}
}
function dh(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y || n[2] !== t.z) && (e.uniform3i(this.addr, t.x, t.y, t.z), n[0] = t.x, n[1] = t.y, n[2] = t.z);
	else {
		if ($m(n, t)) return;
		e.uniform3iv(this.addr, t), eh(n, t);
	}
}
function fh(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y || n[2] !== t.z || n[3] !== t.w) && (e.uniform4i(this.addr, t.x, t.y, t.z, t.w), n[0] = t.x, n[1] = t.y, n[2] = t.z, n[3] = t.w);
	else {
		if ($m(n, t)) return;
		e.uniform4iv(this.addr, t), eh(n, t);
	}
}
function ph(e, t) {
	let n = this.cache;
	n[0] !== t && (e.uniform1ui(this.addr, t), n[0] = t);
}
function mh(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y) && (e.uniform2ui(this.addr, t.x, t.y), n[0] = t.x, n[1] = t.y);
	else {
		if ($m(n, t)) return;
		e.uniform2uiv(this.addr, t), eh(n, t);
	}
}
function hh(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y || n[2] !== t.z) && (e.uniform3ui(this.addr, t.x, t.y, t.z), n[0] = t.x, n[1] = t.y, n[2] = t.z);
	else {
		if ($m(n, t)) return;
		e.uniform3uiv(this.addr, t), eh(n, t);
	}
}
function gh(e, t) {
	let n = this.cache;
	if (t.x !== void 0) (n[0] !== t.x || n[1] !== t.y || n[2] !== t.z || n[3] !== t.w) && (e.uniform4ui(this.addr, t.x, t.y, t.z, t.w), n[0] = t.x, n[1] = t.y, n[2] = t.z, n[3] = t.w);
	else {
		if ($m(n, t)) return;
		e.uniform4uiv(this.addr, t), eh(n, t);
	}
}
function _h(e, t, n) {
	let r = this.cache, i = n.allocateTextureUnit();
	r[0] !== i && (e.uniform1i(this.addr, i), r[0] = i);
	let a;
	this.type === e.SAMPLER_2D_SHADOW ? (Um.compareFunction = n.isReversedDepthBuffer() ? 518 : 515, a = Um) : a = Hm, n.setTexture2D(t || a, i);
}
function vh(e, t, n) {
	let r = this.cache, i = n.allocateTextureUnit();
	r[0] !== i && (e.uniform1i(this.addr, i), r[0] = i), n.setTexture3D(t || Gm, i);
}
function yh(e, t, n) {
	let r = this.cache, i = n.allocateTextureUnit();
	r[0] !== i && (e.uniform1i(this.addr, i), r[0] = i), n.setTextureCube(t || Km, i);
}
function bh(e, t, n) {
	let r = this.cache, i = n.allocateTextureUnit();
	r[0] !== i && (e.uniform1i(this.addr, i), r[0] = i), n.setTexture2DArray(t || Wm, i);
}
function xh(e) {
	switch (e) {
		case 5126: return nh;
		case 35664: return rh;
		case 35665: return ih;
		case 35666: return ah;
		case 35674: return oh;
		case 35675: return sh;
		case 35676: return ch;
		case 5124:
		case 35670: return lh;
		case 35667:
		case 35671: return uh;
		case 35668:
		case 35672: return dh;
		case 35669:
		case 35673: return fh;
		case 5125: return ph;
		case 36294: return mh;
		case 36295: return hh;
		case 36296: return gh;
		case 35678:
		case 36198:
		case 36298:
		case 36306:
		case 35682: return _h;
		case 35679:
		case 36299:
		case 36307: return vh;
		case 35680:
		case 36300:
		case 36308:
		case 36293: return yh;
		case 36289:
		case 36303:
		case 36311:
		case 36292: return bh;
	}
}
function Sh(e, t) {
	e.uniform1fv(this.addr, t);
}
function Ch(e, t) {
	let n = Qm(t, this.size, 2);
	e.uniform2fv(this.addr, n);
}
function wh(e, t) {
	let n = Qm(t, this.size, 3);
	e.uniform3fv(this.addr, n);
}
function Th(e, t) {
	let n = Qm(t, this.size, 4);
	e.uniform4fv(this.addr, n);
}
function Eh(e, t) {
	let n = Qm(t, this.size, 4);
	e.uniformMatrix2fv(this.addr, !1, n);
}
function Dh(e, t) {
	let n = Qm(t, this.size, 9);
	e.uniformMatrix3fv(this.addr, !1, n);
}
function Oh(e, t) {
	let n = Qm(t, this.size, 16);
	e.uniformMatrix4fv(this.addr, !1, n);
}
function kh(e, t) {
	e.uniform1iv(this.addr, t);
}
function Ah(e, t) {
	e.uniform2iv(this.addr, t);
}
function jh(e, t) {
	e.uniform3iv(this.addr, t);
}
function Mh(e, t) {
	e.uniform4iv(this.addr, t);
}
function Nh(e, t) {
	e.uniform1uiv(this.addr, t);
}
function Ph(e, t) {
	e.uniform2uiv(this.addr, t);
}
function Fh(e, t) {
	e.uniform3uiv(this.addr, t);
}
function Ih(e, t) {
	e.uniform4uiv(this.addr, t);
}
function Lh(e, t, n) {
	let r = this.cache, i = t.length, a = th(n, i);
	$m(r, a) || (e.uniform1iv(this.addr, a), eh(r, a));
	let o;
	o = this.type === e.SAMPLER_2D_SHADOW ? Um : Hm;
	for (let e = 0; e !== i; ++e) n.setTexture2D(t[e] || o, a[e]);
}
function Rh(e, t, n) {
	let r = this.cache, i = t.length, a = th(n, i);
	$m(r, a) || (e.uniform1iv(this.addr, a), eh(r, a));
	for (let e = 0; e !== i; ++e) n.setTexture3D(t[e] || Gm, a[e]);
}
function zh(e, t, n) {
	let r = this.cache, i = t.length, a = th(n, i);
	$m(r, a) || (e.uniform1iv(this.addr, a), eh(r, a));
	for (let e = 0; e !== i; ++e) n.setTextureCube(t[e] || Km, a[e]);
}
function Bh(e, t, n) {
	let r = this.cache, i = t.length, a = th(n, i);
	$m(r, a) || (e.uniform1iv(this.addr, a), eh(r, a));
	for (let e = 0; e !== i; ++e) n.setTexture2DArray(t[e] || Wm, a[e]);
}
function Vh(e) {
	switch (e) {
		case 5126: return Sh;
		case 35664: return Ch;
		case 35665: return wh;
		case 35666: return Th;
		case 35674: return Eh;
		case 35675: return Dh;
		case 35676: return Oh;
		case 5124:
		case 35670: return kh;
		case 35667:
		case 35671: return Ah;
		case 35668:
		case 35672: return jh;
		case 35669:
		case 35673: return Mh;
		case 5125: return Nh;
		case 36294: return Ph;
		case 36295: return Fh;
		case 36296: return Ih;
		case 35678:
		case 36198:
		case 36298:
		case 36306:
		case 35682: return Lh;
		case 35679:
		case 36299:
		case 36307: return Rh;
		case 35680:
		case 36300:
		case 36308:
		case 36293: return zh;
		case 36289:
		case 36303:
		case 36311:
		case 36292: return Bh;
	}
}
var Hh = class {
	constructor(e, t, n) {
		this.id = e, this.addr = n, this.cache = [], this.type = t.type, this.setValue = xh(t.type);
	}
}, Uh = class {
	constructor(e, t, n) {
		this.id = e, this.addr = n, this.cache = [], this.type = t.type, this.size = t.size, this.setValue = Vh(t.type);
	}
}, Wh = class {
	constructor(e) {
		this.id = e, this.seq = [], this.map = {};
	}
	setValue(e, t, n) {
		let r = this.seq;
		for (let i = 0, a = r.length; i !== a; ++i) {
			let a = r[i];
			a.setValue(e, t[a.id], n);
		}
	}
}, Gh = /(\w+)(\])?(\[|\.)?/g;
function Kh(e, t) {
	e.seq.push(t), e.map[t.id] = t;
}
function qh(e, t, n) {
	let r = e.name, i = r.length;
	for (Gh.lastIndex = 0;;) {
		let a = Gh.exec(r), o = Gh.lastIndex, s = a[1], c = a[2] === "]", l = a[3];
		if (c && (s |= 0), l === void 0 || l === "[" && o + 2 === i) {
			Kh(n, l === void 0 ? new Hh(s, e, t) : new Uh(s, e, t));
			break;
		} else {
			let e = n.map[s];
			e === void 0 && (e = new Wh(s), Kh(n, e)), n = e;
		}
	}
}
var Jh = class {
	constructor(e, t) {
		this.seq = [], this.map = {};
		let n = e.getProgramParameter(t, e.ACTIVE_UNIFORMS);
		for (let r = 0; r < n; ++r) {
			let n = e.getActiveUniform(t, r);
			qh(n, e.getUniformLocation(t, n.name), this);
		}
		let r = [], i = [];
		for (let t of this.seq) t.type === e.SAMPLER_2D_SHADOW || t.type === e.SAMPLER_CUBE_SHADOW || t.type === e.SAMPLER_2D_ARRAY_SHADOW ? r.push(t) : i.push(t);
		r.length > 0 && (this.seq = r.concat(i));
	}
	setValue(e, t, n, r) {
		let i = this.map[t];
		i !== void 0 && i.setValue(e, n, r);
	}
	setOptional(e, t, n) {
		let r = t[n];
		r !== void 0 && this.setValue(e, n, r);
	}
	static upload(e, t, n, r) {
		for (let i = 0, a = t.length; i !== a; ++i) {
			let a = t[i], o = n[a.id];
			o.needsUpdate !== !1 && a.setValue(e, o.value, r);
		}
	}
	static seqWithValue(e, t) {
		let n = [];
		for (let r = 0, i = e.length; r !== i; ++r) {
			let i = e[r];
			i.id in t && n.push(i);
		}
		return n;
	}
};
function Yh(e, t, n) {
	let r = e.createShader(t);
	return e.shaderSource(r, n), e.compileShader(r), r;
}
var Xh = 37297, Zh = 0;
function Qh(e, t) {
	let n = e.split("\n"), r = [], i = Math.max(t - 6, 0), a = Math.min(t + 6, n.length);
	for (let e = i; e < a; e++) {
		let i = e + 1;
		r.push(`${i === t ? ">" : " "} ${i}: ${n[e]}`);
	}
	return r.join("\n");
}
var $h = /*@__PURE__*/ new W();
function eg(e) {
	G._getMatrix($h, G.workingColorSpace, e);
	let t = `mat3( ${$h.elements.map((e) => e.toFixed(4))} )`;
	switch (G.getTransfer(e)) {
		case An: return [t, "LinearTransferOETF"];
		case jn: return [t, "sRGBTransferOETF"];
		default: return R("WebGLProgram: Unsupported color space: ", e), [t, "LinearTransferOETF"];
	}
}
function tg(e, t, n) {
	let r = e.getShaderParameter(t, e.COMPILE_STATUS), i = (e.getShaderInfoLog(t) || "").trim();
	if (r && i === "") return "";
	let a = /ERROR: 0:(\d+)/.exec(i);
	if (a) {
		let r = parseInt(a[1]);
		return n.toUpperCase() + "\n\n" + i + "\n\n" + Qh(e.getShaderSource(t), r);
	} else return i;
}
function ng(e, t) {
	let n = eg(t);
	return [
		`vec4 ${e}( vec4 value ) {`,
		`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,
		"}"
	].join("\n");
}
var rg = {
	1: "Linear",
	2: "Reinhard",
	3: "Cineon",
	4: "ACESFilmic",
	6: "AgX",
	7: "Neutral",
	5: "Custom"
};
function ig(e, t) {
	let n = rg[t];
	return n === void 0 ? (R("WebGLProgram: Unsupported toneMapping:", t), "vec3 " + e + "( vec3 color ) { return LinearToneMapping( color ); }") : "vec3 " + e + "( vec3 color ) { return " + n + "ToneMapping( color ); }";
}
var ag = /*@__PURE__*/ new U();
function og() {
	return G.getLuminanceCoefficients(ag), [
		"float luminance( const in vec3 rgb ) {",
		`	const vec3 weights = vec3( ${ag.x.toFixed(4)}, ${ag.y.toFixed(4)}, ${ag.z.toFixed(4)} );`,
		"	return dot( weights, rgb );",
		"}"
	].join("\n");
}
function sg(e) {
	return [e.extensionClipCullDistance ? "#extension GL_ANGLE_clip_cull_distance : require" : "", e.extensionMultiDraw ? "#extension GL_ANGLE_multi_draw : require" : ""].filter(ug).join("\n");
}
function cg(e) {
	let t = [];
	for (let n in e) {
		let r = e[n];
		r !== !1 && t.push("#define " + n + " " + r);
	}
	return t.join("\n");
}
function lg(e, t) {
	let n = {}, r = e.getProgramParameter(t, e.ACTIVE_ATTRIBUTES);
	for (let i = 0; i < r; i++) {
		let r = e.getActiveAttrib(t, i), a = r.name, o = 1;
		r.type === e.FLOAT_MAT2 && (o = 2), r.type === e.FLOAT_MAT3 && (o = 3), r.type === e.FLOAT_MAT4 && (o = 4), n[a] = {
			type: r.type,
			location: e.getAttribLocation(t, a),
			locationSize: o
		};
	}
	return n;
}
function ug(e) {
	return e !== "";
}
function dg(e, t) {
	let n = t.numSpotLightShadows + t.numSpotLightMaps - t.numSpotLightShadowsWithMaps;
	return e.replace(/NUM_DIR_LIGHTS/g, t.numDirLights).replace(/NUM_SPOT_LIGHTS/g, t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g, t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g, n).replace(/NUM_RECT_AREA_LIGHTS/g, t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g, t.numPointLights).replace(/NUM_HEMI_LIGHTS/g, t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g, t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g, t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g, t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g, t.numPointLightShadows);
}
function fg(e, t) {
	return e.replace(/NUM_CLIPPING_PLANES/g, t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g, t.numClippingPlanes - t.numClipIntersection);
}
var pg = /^[ \t]*#include +<([\w\d./]+)>/gm;
function mg(e) {
	return e.replace(pg, gg);
}
var hg = /* @__PURE__ */ new Map();
function gg(e, t) {
	let n = Q[t];
	if (n === void 0) {
		let e = hg.get(t);
		if (e !== void 0) n = Q[e], R("WebGLRenderer: Shader chunk \"%s\" has been deprecated. Use \"%s\" instead.", t, e);
		else throw Error("THREE.WebGLProgram: Can not resolve #include <" + t + ">");
	}
	return mg(n);
}
var _g = /#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;
function vg(e) {
	return e.replace(_g, yg);
}
function yg(e, t, n, r) {
	let i = "";
	for (let e = parseInt(t); e < parseInt(n); e++) i += r.replace(/\[\s*i\s*\]/g, "[ " + e + " ]").replace(/UNROLLED_LOOP_INDEX/g, e);
	return i;
}
function bg(e) {
	let t = `precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;
	return e.precision === "highp" ? t += "\n#define HIGH_PRECISION" : e.precision === "mediump" ? t += "\n#define MEDIUM_PRECISION" : e.precision === "lowp" && (t += "\n#define LOW_PRECISION"), t;
}
var xg = {
	1: "SHADOWMAP_TYPE_PCF",
	3: "SHADOWMAP_TYPE_VSM"
};
function Sg(e) {
	return xg[e.shadowMapType] || "SHADOWMAP_TYPE_BASIC";
}
var Cg = {
	301: "ENVMAP_TYPE_CUBE",
	302: "ENVMAP_TYPE_CUBE",
	306: "ENVMAP_TYPE_CUBE_UV"
};
function wg(e) {
	return e.envMap === !1 ? "ENVMAP_TYPE_CUBE" : Cg[e.envMapMode] || "ENVMAP_TYPE_CUBE";
}
var Tg = { 302: "ENVMAP_MODE_REFRACTION" };
function Eg(e) {
	return e.envMap === !1 ? "ENVMAP_MODE_REFLECTION" : Tg[e.envMapMode] || "ENVMAP_MODE_REFLECTION";
}
var Dg = {
	0: "ENVMAP_BLENDING_MULTIPLY",
	1: "ENVMAP_BLENDING_MIX",
	2: "ENVMAP_BLENDING_ADD"
};
function Og(e) {
	return e.envMap === !1 ? "ENVMAP_BLENDING_NONE" : Dg[e.combine] || "ENVMAP_BLENDING_NONE";
}
function kg(e) {
	let t = e.envMapCubeUVHeight;
	if (t === null) return null;
	let n = Math.log2(t) - 2, r = 1 / t;
	return {
		texelWidth: 1 / (3 * Math.max(2 ** n, 112)),
		texelHeight: r,
		maxMip: n
	};
}
function Ag(e, t, n, r) {
	let i = e.getContext(), a = n.defines, o = n.vertexShader, s = n.fragmentShader, c = Sg(n), l = wg(n), u = Eg(n), d = Og(n), f = kg(n), p = sg(n), m = cg(a), h = i.createProgram(), g, _, v = n.glslVersion ? "#version " + n.glslVersion + "\n" : "";
	n.isRawShaderMaterial ? (g = [
		"#define SHADER_TYPE " + n.shaderType,
		"#define SHADER_NAME " + n.shaderName,
		m
	].filter(ug).join("\n"), g.length > 0 && (g += "\n"), _ = [
		"#define SHADER_TYPE " + n.shaderType,
		"#define SHADER_NAME " + n.shaderName,
		m
	].filter(ug).join("\n"), _.length > 0 && (_ += "\n")) : (g = [
		bg(n),
		"#define SHADER_TYPE " + n.shaderType,
		"#define SHADER_NAME " + n.shaderName,
		m,
		n.extensionClipCullDistance ? "#define USE_CLIP_DISTANCE" : "",
		n.batching ? "#define USE_BATCHING" : "",
		n.batchingColor ? "#define USE_BATCHING_COLOR" : "",
		n.instancing ? "#define USE_INSTANCING" : "",
		n.instancingColor ? "#define USE_INSTANCING_COLOR" : "",
		n.instancingMorph ? "#define USE_INSTANCING_MORPH" : "",
		n.useFog && n.fog ? "#define USE_FOG" : "",
		n.useFog && n.fogExp2 ? "#define FOG_EXP2" : "",
		n.map ? "#define USE_MAP" : "",
		n.envMap ? "#define USE_ENVMAP" : "",
		n.envMap ? "#define " + u : "",
		n.lightMap ? "#define USE_LIGHTMAP" : "",
		n.aoMap ? "#define USE_AOMAP" : "",
		n.bumpMap ? "#define USE_BUMPMAP" : "",
		n.normalMap ? "#define USE_NORMALMAP" : "",
		n.normalMapObjectSpace ? "#define USE_NORMALMAP_OBJECTSPACE" : "",
		n.normalMapTangentSpace ? "#define USE_NORMALMAP_TANGENTSPACE" : "",
		n.displacementMap ? "#define USE_DISPLACEMENTMAP" : "",
		n.emissiveMap ? "#define USE_EMISSIVEMAP" : "",
		n.anisotropy ? "#define USE_ANISOTROPY" : "",
		n.anisotropyMap ? "#define USE_ANISOTROPYMAP" : "",
		n.clearcoatMap ? "#define USE_CLEARCOATMAP" : "",
		n.clearcoatRoughnessMap ? "#define USE_CLEARCOAT_ROUGHNESSMAP" : "",
		n.clearcoatNormalMap ? "#define USE_CLEARCOAT_NORMALMAP" : "",
		n.iridescenceMap ? "#define USE_IRIDESCENCEMAP" : "",
		n.iridescenceThicknessMap ? "#define USE_IRIDESCENCE_THICKNESSMAP" : "",
		n.specularMap ? "#define USE_SPECULARMAP" : "",
		n.specularColorMap ? "#define USE_SPECULAR_COLORMAP" : "",
		n.specularIntensityMap ? "#define USE_SPECULAR_INTENSITYMAP" : "",
		n.roughnessMap ? "#define USE_ROUGHNESSMAP" : "",
		n.metalnessMap ? "#define USE_METALNESSMAP" : "",
		n.alphaMap ? "#define USE_ALPHAMAP" : "",
		n.alphaHash ? "#define USE_ALPHAHASH" : "",
		n.transmission ? "#define USE_TRANSMISSION" : "",
		n.transmissionMap ? "#define USE_TRANSMISSIONMAP" : "",
		n.thicknessMap ? "#define USE_THICKNESSMAP" : "",
		n.sheenColorMap ? "#define USE_SHEEN_COLORMAP" : "",
		n.sheenRoughnessMap ? "#define USE_SHEEN_ROUGHNESSMAP" : "",
		n.mapUv ? "#define MAP_UV " + n.mapUv : "",
		n.alphaMapUv ? "#define ALPHAMAP_UV " + n.alphaMapUv : "",
		n.lightMapUv ? "#define LIGHTMAP_UV " + n.lightMapUv : "",
		n.aoMapUv ? "#define AOMAP_UV " + n.aoMapUv : "",
		n.emissiveMapUv ? "#define EMISSIVEMAP_UV " + n.emissiveMapUv : "",
		n.bumpMapUv ? "#define BUMPMAP_UV " + n.bumpMapUv : "",
		n.normalMapUv ? "#define NORMALMAP_UV " + n.normalMapUv : "",
		n.displacementMapUv ? "#define DISPLACEMENTMAP_UV " + n.displacementMapUv : "",
		n.metalnessMapUv ? "#define METALNESSMAP_UV " + n.metalnessMapUv : "",
		n.roughnessMapUv ? "#define ROUGHNESSMAP_UV " + n.roughnessMapUv : "",
		n.anisotropyMapUv ? "#define ANISOTROPYMAP_UV " + n.anisotropyMapUv : "",
		n.clearcoatMapUv ? "#define CLEARCOATMAP_UV " + n.clearcoatMapUv : "",
		n.clearcoatNormalMapUv ? "#define CLEARCOAT_NORMALMAP_UV " + n.clearcoatNormalMapUv : "",
		n.clearcoatRoughnessMapUv ? "#define CLEARCOAT_ROUGHNESSMAP_UV " + n.clearcoatRoughnessMapUv : "",
		n.iridescenceMapUv ? "#define IRIDESCENCEMAP_UV " + n.iridescenceMapUv : "",
		n.iridescenceThicknessMapUv ? "#define IRIDESCENCE_THICKNESSMAP_UV " + n.iridescenceThicknessMapUv : "",
		n.sheenColorMapUv ? "#define SHEEN_COLORMAP_UV " + n.sheenColorMapUv : "",
		n.sheenRoughnessMapUv ? "#define SHEEN_ROUGHNESSMAP_UV " + n.sheenRoughnessMapUv : "",
		n.specularMapUv ? "#define SPECULARMAP_UV " + n.specularMapUv : "",
		n.specularColorMapUv ? "#define SPECULAR_COLORMAP_UV " + n.specularColorMapUv : "",
		n.specularIntensityMapUv ? "#define SPECULAR_INTENSITYMAP_UV " + n.specularIntensityMapUv : "",
		n.transmissionMapUv ? "#define TRANSMISSIONMAP_UV " + n.transmissionMapUv : "",
		n.thicknessMapUv ? "#define THICKNESSMAP_UV " + n.thicknessMapUv : "",
		n.vertexTangents && n.flatShading === !1 ? "#define USE_TANGENT" : "",
		n.vertexNormals ? "#define HAS_NORMAL" : "",
		n.vertexColors ? "#define USE_COLOR" : "",
		n.vertexAlphas ? "#define USE_COLOR_ALPHA" : "",
		n.vertexUv1s ? "#define USE_UV1" : "",
		n.vertexUv2s ? "#define USE_UV2" : "",
		n.vertexUv3s ? "#define USE_UV3" : "",
		n.pointsUvs ? "#define USE_POINTS_UV" : "",
		n.flatShading ? "#define FLAT_SHADED" : "",
		n.skinning ? "#define USE_SKINNING" : "",
		n.morphTargets ? "#define USE_MORPHTARGETS" : "",
		n.morphNormals && n.flatShading === !1 ? "#define USE_MORPHNORMALS" : "",
		n.morphColors ? "#define USE_MORPHCOLORS" : "",
		n.morphTargetsCount > 0 ? "#define MORPHTARGETS_TEXTURE_STRIDE " + n.morphTextureStride : "",
		n.morphTargetsCount > 0 ? "#define MORPHTARGETS_COUNT " + n.morphTargetsCount : "",
		n.doubleSided ? "#define DOUBLE_SIDED" : "",
		n.flipSided ? "#define FLIP_SIDED" : "",
		n.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
		n.shadowMapEnabled ? "#define " + c : "",
		n.sizeAttenuation ? "#define USE_SIZEATTENUATION" : "",
		n.numLightProbes > 0 ? "#define USE_LIGHT_PROBES" : "",
		n.logarithmicDepthBuffer ? "#define USE_LOGARITHMIC_DEPTH_BUFFER" : "",
		n.reversedDepthBuffer ? "#define USE_REVERSED_DEPTH_BUFFER" : "",
		"uniform mat4 modelMatrix;",
		"uniform mat4 modelViewMatrix;",
		"uniform mat4 projectionMatrix;",
		"uniform mat4 viewMatrix;",
		"uniform mat3 normalMatrix;",
		"uniform vec3 cameraPosition;",
		"uniform bool isOrthographic;",
		"#ifdef USE_INSTANCING",
		"	attribute mat4 instanceMatrix;",
		"#endif",
		"#ifdef USE_INSTANCING_COLOR",
		"	attribute vec3 instanceColor;",
		"#endif",
		"#ifdef USE_INSTANCING_MORPH",
		"	uniform sampler2D morphTexture;",
		"#endif",
		"attribute vec3 position;",
		"attribute vec3 normal;",
		"attribute vec2 uv;",
		"#ifdef USE_UV1",
		"	attribute vec2 uv1;",
		"#endif",
		"#ifdef USE_UV2",
		"	attribute vec2 uv2;",
		"#endif",
		"#ifdef USE_UV3",
		"	attribute vec2 uv3;",
		"#endif",
		"#ifdef USE_TANGENT",
		"	attribute vec4 tangent;",
		"#endif",
		"#if defined( USE_COLOR_ALPHA )",
		"	attribute vec4 color;",
		"#elif defined( USE_COLOR )",
		"	attribute vec3 color;",
		"#endif",
		"#ifdef USE_SKINNING",
		"	attribute vec4 skinIndex;",
		"	attribute vec4 skinWeight;",
		"#endif",
		"\n"
	].filter(ug).join("\n"), _ = [
		bg(n),
		"#define SHADER_TYPE " + n.shaderType,
		"#define SHADER_NAME " + n.shaderName,
		m,
		n.useFog && n.fog ? "#define USE_FOG" : "",
		n.useFog && n.fogExp2 ? "#define FOG_EXP2" : "",
		n.alphaToCoverage ? "#define ALPHA_TO_COVERAGE" : "",
		n.map ? "#define USE_MAP" : "",
		n.matcap ? "#define USE_MATCAP" : "",
		n.envMap ? "#define USE_ENVMAP" : "",
		n.envMap ? "#define " + l : "",
		n.envMap ? "#define " + u : "",
		n.envMap ? "#define " + d : "",
		f ? "#define CUBEUV_TEXEL_WIDTH " + f.texelWidth : "",
		f ? "#define CUBEUV_TEXEL_HEIGHT " + f.texelHeight : "",
		f ? "#define CUBEUV_MAX_MIP " + f.maxMip + ".0" : "",
		n.lightMap ? "#define USE_LIGHTMAP" : "",
		n.aoMap ? "#define USE_AOMAP" : "",
		n.bumpMap ? "#define USE_BUMPMAP" : "",
		n.normalMap ? "#define USE_NORMALMAP" : "",
		n.normalMapObjectSpace ? "#define USE_NORMALMAP_OBJECTSPACE" : "",
		n.normalMapTangentSpace ? "#define USE_NORMALMAP_TANGENTSPACE" : "",
		n.packedNormalMap ? "#define USE_PACKED_NORMALMAP" : "",
		n.emissiveMap ? "#define USE_EMISSIVEMAP" : "",
		n.anisotropy ? "#define USE_ANISOTROPY" : "",
		n.anisotropyMap ? "#define USE_ANISOTROPYMAP" : "",
		n.clearcoat ? "#define USE_CLEARCOAT" : "",
		n.clearcoatMap ? "#define USE_CLEARCOATMAP" : "",
		n.clearcoatRoughnessMap ? "#define USE_CLEARCOAT_ROUGHNESSMAP" : "",
		n.clearcoatNormalMap ? "#define USE_CLEARCOAT_NORMALMAP" : "",
		n.dispersion ? "#define USE_DISPERSION" : "",
		n.iridescence ? "#define USE_IRIDESCENCE" : "",
		n.iridescenceMap ? "#define USE_IRIDESCENCEMAP" : "",
		n.iridescenceThicknessMap ? "#define USE_IRIDESCENCE_THICKNESSMAP" : "",
		n.specularMap ? "#define USE_SPECULARMAP" : "",
		n.specularColorMap ? "#define USE_SPECULAR_COLORMAP" : "",
		n.specularIntensityMap ? "#define USE_SPECULAR_INTENSITYMAP" : "",
		n.roughnessMap ? "#define USE_ROUGHNESSMAP" : "",
		n.metalnessMap ? "#define USE_METALNESSMAP" : "",
		n.alphaMap ? "#define USE_ALPHAMAP" : "",
		n.alphaTest ? "#define USE_ALPHATEST" : "",
		n.alphaHash ? "#define USE_ALPHAHASH" : "",
		n.sheen ? "#define USE_SHEEN" : "",
		n.sheenColorMap ? "#define USE_SHEEN_COLORMAP" : "",
		n.sheenRoughnessMap ? "#define USE_SHEEN_ROUGHNESSMAP" : "",
		n.transmission ? "#define USE_TRANSMISSION" : "",
		n.transmissionMap ? "#define USE_TRANSMISSIONMAP" : "",
		n.thicknessMap ? "#define USE_THICKNESSMAP" : "",
		n.vertexTangents && n.flatShading === !1 ? "#define USE_TANGENT" : "",
		n.vertexColors || n.instancingColor ? "#define USE_COLOR" : "",
		n.vertexAlphas || n.batchingColor ? "#define USE_COLOR_ALPHA" : "",
		n.vertexUv1s ? "#define USE_UV1" : "",
		n.vertexUv2s ? "#define USE_UV2" : "",
		n.vertexUv3s ? "#define USE_UV3" : "",
		n.pointsUvs ? "#define USE_POINTS_UV" : "",
		n.gradientMap ? "#define USE_GRADIENTMAP" : "",
		n.flatShading ? "#define FLAT_SHADED" : "",
		n.doubleSided ? "#define DOUBLE_SIDED" : "",
		n.flipSided ? "#define FLIP_SIDED" : "",
		n.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
		n.shadowMapEnabled ? "#define " + c : "",
		n.premultipliedAlpha ? "#define PREMULTIPLIED_ALPHA" : "",
		n.numLightProbes > 0 ? "#define USE_LIGHT_PROBES" : "",
		n.numLightProbeGrids > 0 ? "#define USE_LIGHT_PROBES_GRID" : "",
		n.decodeVideoTexture ? "#define DECODE_VIDEO_TEXTURE" : "",
		n.decodeVideoTextureEmissive ? "#define DECODE_VIDEO_TEXTURE_EMISSIVE" : "",
		n.logarithmicDepthBuffer ? "#define USE_LOGARITHMIC_DEPTH_BUFFER" : "",
		n.reversedDepthBuffer ? "#define USE_REVERSED_DEPTH_BUFFER" : "",
		"uniform mat4 viewMatrix;",
		"uniform vec3 cameraPosition;",
		"uniform bool isOrthographic;",
		n.toneMapping === 0 ? "" : "#define TONE_MAPPING",
		n.toneMapping === 0 ? "" : Q.tonemapping_pars_fragment,
		n.toneMapping === 0 ? "" : ig("toneMapping", n.toneMapping),
		n.dithering ? "#define DITHERING" : "",
		n.opaque ? "#define OPAQUE" : "",
		Q.colorspace_pars_fragment,
		ng("linearToOutputTexel", n.outputColorSpace),
		og(),
		n.useDepthPacking ? "#define DEPTH_PACKING " + n.depthPacking : "",
		"\n"
	].filter(ug).join("\n")), o = mg(o), o = dg(o, n), o = fg(o, n), s = mg(s), s = dg(s, n), s = fg(s, n), o = vg(o), s = vg(s), n.isRawShaderMaterial !== !0 && (v = "#version 300 es\n", g = [
		p,
		"#define attribute in",
		"#define varying out",
		"#define texture2D texture"
	].join("\n") + "\n" + g, _ = [
		"#define varying in",
		n.glslVersion === "300 es" ? "" : "layout(location = 0) out highp vec4 pc_fragColor;",
		n.glslVersion === "300 es" ? "" : "#define gl_FragColor pc_fragColor",
		"#define gl_FragDepthEXT gl_FragDepth",
		"#define texture2D texture",
		"#define textureCube texture",
		"#define texture2DProj textureProj",
		"#define texture2DLodEXT textureLod",
		"#define texture2DProjLodEXT textureProjLod",
		"#define textureCubeLodEXT textureLod",
		"#define texture2DGradEXT textureGrad",
		"#define texture2DProjGradEXT textureProjGrad",
		"#define textureCubeGradEXT textureGrad"
	].join("\n") + "\n" + _);
	let y = v + g + o, b = v + _ + s, x = Yh(i, i.VERTEX_SHADER, y), S = Yh(i, i.FRAGMENT_SHADER, b);
	i.attachShader(h, x), i.attachShader(h, S), n.index0AttributeName === void 0 ? n.hasPositionAttribute === !0 && i.bindAttribLocation(h, 0, "position") : i.bindAttribLocation(h, 0, n.index0AttributeName), i.linkProgram(h);
	function C(t) {
		if (e.debug.checkShaderErrors) {
			let n = i.getProgramInfoLog(h) || "", r = i.getShaderInfoLog(x) || "", a = i.getShaderInfoLog(S) || "", o = n.trim(), s = r.trim(), c = a.trim(), l = !0, u = !0;
			if (i.getProgramParameter(h, i.LINK_STATUS) === !1) if (l = !1, typeof e.debug.onShaderError == "function") e.debug.onShaderError(i, h, x, S);
			else {
				let e = tg(i, x, "vertex"), n = tg(i, S, "fragment");
				z("WebGLProgram: Shader Error " + i.getError() + " - VALIDATE_STATUS " + i.getProgramParameter(h, i.VALIDATE_STATUS) + "\n\nMaterial Name: " + t.name + "\nMaterial Type: " + t.type + "\n\nProgram Info Log: " + o + "\n" + e + "\n" + n);
			}
			else o === "" ? (s === "" || c === "") && (u = !1) : R("WebGLProgram: Program Info Log:", o);
			u && (t.diagnostics = {
				runnable: l,
				programLog: o,
				vertexShader: {
					log: s,
					prefix: g
				},
				fragmentShader: {
					log: c,
					prefix: _
				}
			});
		}
		i.deleteShader(x), i.deleteShader(S), w = new Jh(i, h), T = lg(i, h);
	}
	let w;
	this.getUniforms = function() {
		return w === void 0 && C(this), w;
	};
	let T;
	this.getAttributes = function() {
		return T === void 0 && C(this), T;
	};
	let E = n.rendererExtensionParallelShaderCompile === !1;
	return this.isReady = function() {
		return E === !1 && (E = i.getProgramParameter(h, Xh)), E;
	}, this.destroy = function() {
		r.releaseStatesOfProgram(this), i.deleteProgram(h), this.program = void 0;
	}, this.type = n.shaderType, this.name = n.shaderName, this.id = Zh++, this.cacheKey = t, this.usedTimes = 1, this.program = h, this.vertexShader = x, this.fragmentShader = S, this;
}
var jg = 0, Mg = class {
	constructor() {
		this.shaderCache = /* @__PURE__ */ new Map(), this.materialCache = /* @__PURE__ */ new Map();
	}
	update(e, t, n) {
		let r = this._getShaderCacheForMaterial(e);
		return r.has(t) === !1 && (r.add(t), t.usedTimes++), r.has(n) === !1 && (r.add(n), n.usedTimes++), this;
	}
	remove(e) {
		let t = this.materialCache.get(e);
		for (let e of t) e.usedTimes--, e.usedTimes === 0 && this.shaderCache.delete(e.code);
		return this.materialCache.delete(e), this;
	}
	getVertexShaderStage(e) {
		return this._getShaderStage(e.vertexShader);
	}
	getFragmentShaderStage(e) {
		return this._getShaderStage(e.fragmentShader);
	}
	dispose() {
		this.shaderCache.clear(), this.materialCache.clear();
	}
	_getShaderCacheForMaterial(e) {
		let t = this.materialCache, n = t.get(e);
		return n === void 0 && (n = /* @__PURE__ */ new Set(), t.set(e, n)), n;
	}
	_getShaderStage(e) {
		let t = this.shaderCache, n = t.get(e);
		return n === void 0 && (n = new Ng(e), t.set(e, n)), n;
	}
}, Ng = class {
	constructor(e) {
		this.id = jg++, this.code = e, this.usedTimes = 0;
	}
};
function Pg(e) {
	return e === 1030 || e === 37490 || e === 36285;
}
function Fg(e, t, n, r, i, a) {
	let o = new Si(), s = new Mg(), c = /* @__PURE__ */ new Set(), l = [], u = /* @__PURE__ */ new Map(), d = r.logarithmicDepthBuffer, f = r.precision, p = {
		MeshDepthMaterial: "depth",
		MeshDistanceMaterial: "distance",
		MeshNormalMaterial: "normal",
		MeshBasicMaterial: "basic",
		MeshLambertMaterial: "lambert",
		MeshPhongMaterial: "phong",
		MeshToonMaterial: "toon",
		MeshStandardMaterial: "physical",
		MeshPhysicalMaterial: "physical",
		MeshMatcapMaterial: "matcap",
		LineBasicMaterial: "basic",
		LineDashedMaterial: "dashed",
		PointsMaterial: "points",
		ShadowMaterial: "shadow",
		SpriteMaterial: "sprite"
	};
	function m(e) {
		return c.add(e), e === 0 ? "uv" : `uv${e}`;
	}
	function h(i, o, l, u, h, g) {
		let _ = u.fog, v = h.geometry, y = i.isMeshStandardMaterial || i.isMeshLambertMaterial || i.isMeshPhongMaterial ? u.environment : null, b = i.isMeshStandardMaterial || i.isMeshLambertMaterial && !i.envMap || i.isMeshPhongMaterial && !i.envMap, x = t.get(i.envMap || y, b), S = x && x.mapping === 306 ? x.image.height : null, C = p[i.type];
		i.precision !== null && (f = r.getMaxPrecision(i.precision), f !== i.precision && R("WebGLProgram.getParameters:", i.precision, "not supported, using", f, "instead."));
		let w = v.morphAttributes.position || v.morphAttributes.normal || v.morphAttributes.color, T = w === void 0 ? 0 : w.length, E = 0;
		v.morphAttributes.position !== void 0 && (E = 1), v.morphAttributes.normal !== void 0 && (E = 2), v.morphAttributes.color !== void 0 && (E = 3);
		let D, O, k, A;
		if (C) {
			let e = rm[C];
			D = e.vertexShader, O = e.fragmentShader;
		} else {
			D = i.vertexShader, O = i.fragmentShader;
			let e = s.getVertexShaderStage(i), t = s.getFragmentShaderStage(i);
			s.update(i, e, t), k = e.id, A = t.id;
		}
		let ee = e.getRenderTarget(), te = e.state.buffers.depth.getReversed(), j = h.isInstancedMesh === !0, ne = h.isBatchedMesh === !0, re = !!i.map, M = !!i.matcap, ie = !!x, ae = !!i.aoMap, oe = !!i.lightMap, se = !!i.bumpMap && i.wireframe === !1, N = !!i.normalMap, ce = !!i.displacementMap, le = !!i.emissiveMap, ue = !!i.metalnessMap, de = !!i.roughnessMap, fe = i.anisotropy > 0, pe = i.clearcoat > 0, me = i.dispersion > 0, he = i.iridescence > 0, ge = i.sheen > 0, _e = i.transmission > 0, ve = fe && !!i.anisotropyMap, ye = pe && !!i.clearcoatMap, be = pe && !!i.clearcoatNormalMap, xe = pe && !!i.clearcoatRoughnessMap, Se = he && !!i.iridescenceMap, Ce = he && !!i.iridescenceThicknessMap, P = ge && !!i.sheenColorMap, we = ge && !!i.sheenRoughnessMap, Te = !!i.specularMap, Ee = !!i.specularColorMap, F = !!i.specularIntensityMap, De = _e && !!i.transmissionMap, I = _e && !!i.thicknessMap, L = !!i.gradientMap, Oe = !!i.alphaMap, ke = i.alphaTest > 0, Ae = !!i.alphaHash, je = !!i.extensions, Me = 0;
		i.toneMapped && (ee === null || ee.isXRRenderTarget === !0) && (Me = e.toneMapping);
		let Ne = {
			shaderID: C,
			shaderType: i.type,
			shaderName: i.name,
			vertexShader: D,
			fragmentShader: O,
			defines: i.defines,
			customVertexShaderID: k,
			customFragmentShaderID: A,
			isRawShaderMaterial: i.isRawShaderMaterial === !0,
			glslVersion: i.glslVersion,
			precision: f,
			batching: ne,
			batchingColor: ne && h._colorsTexture !== null,
			instancing: j,
			instancingColor: j && h.instanceColor !== null,
			instancingMorph: j && h.morphTexture !== null,
			outputColorSpace: ee === null ? e.outputColorSpace : ee.isXRRenderTarget === !0 ? ee.texture.colorSpace : G.workingColorSpace,
			alphaToCoverage: !!i.alphaToCoverage,
			map: re,
			matcap: M,
			envMap: ie,
			envMapMode: ie && x.mapping,
			envMapCubeUVHeight: S,
			aoMap: ae,
			lightMap: oe,
			bumpMap: se,
			normalMap: N,
			displacementMap: ce,
			emissiveMap: le,
			normalMapObjectSpace: N && i.normalMapType === 1,
			normalMapTangentSpace: N && i.normalMapType === 0,
			packedNormalMap: N && i.normalMapType === 0 && Pg(i.normalMap.format),
			metalnessMap: ue,
			roughnessMap: de,
			anisotropy: fe,
			anisotropyMap: ve,
			clearcoat: pe,
			clearcoatMap: ye,
			clearcoatNormalMap: be,
			clearcoatRoughnessMap: xe,
			dispersion: me,
			iridescence: he,
			iridescenceMap: Se,
			iridescenceThicknessMap: Ce,
			sheen: ge,
			sheenColorMap: P,
			sheenRoughnessMap: we,
			specularMap: Te,
			specularColorMap: Ee,
			specularIntensityMap: F,
			transmission: _e,
			transmissionMap: De,
			thicknessMap: I,
			gradientMap: L,
			opaque: i.transparent === !1 && i.blending === 1 && i.alphaToCoverage === !1,
			alphaMap: Oe,
			alphaTest: ke,
			alphaHash: Ae,
			combine: i.combine,
			mapUv: re && m(i.map.channel),
			aoMapUv: ae && m(i.aoMap.channel),
			lightMapUv: oe && m(i.lightMap.channel),
			bumpMapUv: se && m(i.bumpMap.channel),
			normalMapUv: N && m(i.normalMap.channel),
			displacementMapUv: ce && m(i.displacementMap.channel),
			emissiveMapUv: le && m(i.emissiveMap.channel),
			metalnessMapUv: ue && m(i.metalnessMap.channel),
			roughnessMapUv: de && m(i.roughnessMap.channel),
			anisotropyMapUv: ve && m(i.anisotropyMap.channel),
			clearcoatMapUv: ye && m(i.clearcoatMap.channel),
			clearcoatNormalMapUv: be && m(i.clearcoatNormalMap.channel),
			clearcoatRoughnessMapUv: xe && m(i.clearcoatRoughnessMap.channel),
			iridescenceMapUv: Se && m(i.iridescenceMap.channel),
			iridescenceThicknessMapUv: Ce && m(i.iridescenceThicknessMap.channel),
			sheenColorMapUv: P && m(i.sheenColorMap.channel),
			sheenRoughnessMapUv: we && m(i.sheenRoughnessMap.channel),
			specularMapUv: Te && m(i.specularMap.channel),
			specularColorMapUv: Ee && m(i.specularColorMap.channel),
			specularIntensityMapUv: F && m(i.specularIntensityMap.channel),
			transmissionMapUv: De && m(i.transmissionMap.channel),
			thicknessMapUv: I && m(i.thicknessMap.channel),
			alphaMapUv: Oe && m(i.alphaMap.channel),
			vertexTangents: !!v.attributes.tangent && (N || fe),
			vertexNormals: !!v.attributes.normal,
			vertexColors: i.vertexColors,
			vertexAlphas: i.vertexColors === !0 && !!v.attributes.color && v.attributes.color.itemSize === 4,
			pointsUvs: h.isPoints === !0 && !!v.attributes.uv && (re || Oe),
			fog: !!_,
			useFog: i.fog === !0,
			fogExp2: !!_ && _.isFogExp2,
			flatShading: i.wireframe === !1 && (i.flatShading === !0 || v.attributes.normal === void 0 && N === !1 && (i.isMeshLambertMaterial || i.isMeshPhongMaterial || i.isMeshStandardMaterial || i.isMeshPhysicalMaterial)),
			sizeAttenuation: i.sizeAttenuation === !0,
			logarithmicDepthBuffer: d,
			reversedDepthBuffer: te,
			skinning: h.isSkinnedMesh === !0,
			hasPositionAttribute: v.attributes.position !== void 0,
			morphTargets: v.morphAttributes.position !== void 0,
			morphNormals: v.morphAttributes.normal !== void 0,
			morphColors: v.morphAttributes.color !== void 0,
			morphTargetsCount: T,
			morphTextureStride: E,
			numDirLights: o.directional.length,
			numPointLights: o.point.length,
			numSpotLights: o.spot.length,
			numSpotLightMaps: o.spotLightMap.length,
			numRectAreaLights: o.rectArea.length,
			numHemiLights: o.hemi.length,
			numDirLightShadows: o.directionalShadowMap.length,
			numPointLightShadows: o.pointShadowMap.length,
			numSpotLightShadows: o.spotShadowMap.length,
			numSpotLightShadowsWithMaps: o.numSpotLightShadowsWithMaps,
			numLightProbes: o.numLightProbes,
			numLightProbeGrids: g.length,
			numClippingPlanes: a.numPlanes,
			numClipIntersection: a.numIntersection,
			dithering: i.dithering,
			shadowMapEnabled: e.shadowMap.enabled && l.length > 0,
			shadowMapType: e.shadowMap.type,
			toneMapping: Me,
			decodeVideoTexture: re && i.map.isVideoTexture === !0 && G.getTransfer(i.map.colorSpace) === "srgb",
			decodeVideoTextureEmissive: le && i.emissiveMap.isVideoTexture === !0 && G.getTransfer(i.emissiveMap.colorSpace) === "srgb",
			premultipliedAlpha: i.premultipliedAlpha,
			doubleSided: i.side === 2,
			flipSided: i.side === 1,
			useDepthPacking: i.depthPacking >= 0,
			depthPacking: i.depthPacking || 0,
			index0AttributeName: i.index0AttributeName,
			extensionClipCullDistance: je && i.extensions.clipCullDistance === !0 && n.has("WEBGL_clip_cull_distance"),
			extensionMultiDraw: (je && i.extensions.multiDraw === !0 || ne) && n.has("WEBGL_multi_draw"),
			rendererExtensionParallelShaderCompile: n.has("KHR_parallel_shader_compile"),
			customProgramCacheKey: i.customProgramCacheKey()
		};
		return Ne.vertexUv1s = c.has(1), Ne.vertexUv2s = c.has(2), Ne.vertexUv3s = c.has(3), c.clear(), Ne;
	}
	function g(t) {
		let n = [];
		if (t.shaderID ? n.push(t.shaderID) : (n.push(t.customVertexShaderID), n.push(t.customFragmentShaderID)), t.defines !== void 0) for (let e in t.defines) n.push(e), n.push(t.defines[e]);
		return t.isRawShaderMaterial === !1 && (_(n, t), v(n, t), n.push(e.outputColorSpace)), n.push(t.customProgramCacheKey), n.join();
	}
	function _(e, t) {
		e.push(t.precision), e.push(t.outputColorSpace), e.push(t.envMapMode), e.push(t.envMapCubeUVHeight), e.push(t.mapUv), e.push(t.alphaMapUv), e.push(t.lightMapUv), e.push(t.aoMapUv), e.push(t.bumpMapUv), e.push(t.normalMapUv), e.push(t.displacementMapUv), e.push(t.emissiveMapUv), e.push(t.metalnessMapUv), e.push(t.roughnessMapUv), e.push(t.anisotropyMapUv), e.push(t.clearcoatMapUv), e.push(t.clearcoatNormalMapUv), e.push(t.clearcoatRoughnessMapUv), e.push(t.iridescenceMapUv), e.push(t.iridescenceThicknessMapUv), e.push(t.sheenColorMapUv), e.push(t.sheenRoughnessMapUv), e.push(t.specularMapUv), e.push(t.specularColorMapUv), e.push(t.specularIntensityMapUv), e.push(t.transmissionMapUv), e.push(t.thicknessMapUv), e.push(t.combine), e.push(t.fogExp2), e.push(t.sizeAttenuation), e.push(t.morphTargetsCount), e.push(t.morphAttributeCount), e.push(t.numDirLights), e.push(t.numPointLights), e.push(t.numSpotLights), e.push(t.numSpotLightMaps), e.push(t.numHemiLights), e.push(t.numRectAreaLights), e.push(t.numDirLightShadows), e.push(t.numPointLightShadows), e.push(t.numSpotLightShadows), e.push(t.numSpotLightShadowsWithMaps), e.push(t.numLightProbes), e.push(t.shadowMapType), e.push(t.toneMapping), e.push(t.numClippingPlanes), e.push(t.numClipIntersection), e.push(t.depthPacking);
	}
	function v(e, t) {
		o.disableAll(), t.instancing && o.enable(0), t.instancingColor && o.enable(1), t.instancingMorph && o.enable(2), t.matcap && o.enable(3), t.envMap && o.enable(4), t.normalMapObjectSpace && o.enable(5), t.normalMapTangentSpace && o.enable(6), t.clearcoat && o.enable(7), t.iridescence && o.enable(8), t.alphaTest && o.enable(9), t.vertexColors && o.enable(10), t.vertexAlphas && o.enable(11), t.vertexUv1s && o.enable(12), t.vertexUv2s && o.enable(13), t.vertexUv3s && o.enable(14), t.vertexTangents && o.enable(15), t.anisotropy && o.enable(16), t.alphaHash && o.enable(17), t.batching && o.enable(18), t.dispersion && o.enable(19), t.batchingColor && o.enable(20), t.gradientMap && o.enable(21), t.packedNormalMap && o.enable(22), t.vertexNormals && o.enable(23), e.push(o.mask), o.disableAll(), t.fog && o.enable(0), t.useFog && o.enable(1), t.flatShading && o.enable(2), t.logarithmicDepthBuffer && o.enable(3), t.reversedDepthBuffer && o.enable(4), t.skinning && o.enable(5), t.morphTargets && o.enable(6), t.morphNormals && o.enable(7), t.morphColors && o.enable(8), t.premultipliedAlpha && o.enable(9), t.shadowMapEnabled && o.enable(10), t.doubleSided && o.enable(11), t.flipSided && o.enable(12), t.useDepthPacking && o.enable(13), t.dithering && o.enable(14), t.transmission && o.enable(15), t.sheen && o.enable(16), t.opaque && o.enable(17), t.pointsUvs && o.enable(18), t.decodeVideoTexture && o.enable(19), t.decodeVideoTextureEmissive && o.enable(20), t.alphaToCoverage && o.enable(21), t.numLightProbeGrids > 0 && o.enable(22), t.hasPositionAttribute && o.enable(23), e.push(o.mask);
	}
	function y(e) {
		let t = p[e.type], n;
		if (t) {
			let e = rm[t];
			n = yu.clone(e.uniforms);
		} else n = e.uniforms;
		return n;
	}
	function b(t, n) {
		let r = u.get(n);
		return r === void 0 ? (r = new Ag(e, n, t, i), l.push(r), u.set(n, r)) : ++r.usedTimes, r;
	}
	function x(e) {
		if (--e.usedTimes === 0) {
			let t = l.indexOf(e);
			l[t] = l[l.length - 1], l.pop(), u.delete(e.cacheKey), e.destroy();
		}
	}
	function S(e) {
		s.remove(e);
	}
	function C() {
		s.dispose();
	}
	return {
		getParameters: h,
		getProgramCacheKey: g,
		getUniforms: y,
		acquireProgram: b,
		releaseProgram: x,
		releaseShaderCache: S,
		programs: l,
		dispose: C
	};
}
function Ig() {
	let e = /* @__PURE__ */ new WeakMap();
	function t(t) {
		return e.has(t);
	}
	function n(t) {
		let n = e.get(t);
		return n === void 0 && (n = {}, e.set(t, n)), n;
	}
	function r(t) {
		e.delete(t);
	}
	function i(t, n, r) {
		e.get(t)[n] = r;
	}
	function a() {
		e = /* @__PURE__ */ new WeakMap();
	}
	return {
		has: t,
		get: n,
		remove: r,
		update: i,
		dispose: a
	};
}
function Lg(e, t) {
	return e.groupOrder === t.groupOrder ? e.renderOrder === t.renderOrder ? e.material.id === t.material.id ? e.materialVariant === t.materialVariant ? e.z === t.z ? e.id - t.id : e.z - t.z : e.materialVariant - t.materialVariant : e.material.id - t.material.id : e.renderOrder - t.renderOrder : e.groupOrder - t.groupOrder;
}
function Rg(e, t) {
	return e.groupOrder === t.groupOrder ? e.renderOrder === t.renderOrder ? e.z === t.z ? e.id - t.id : t.z - e.z : e.renderOrder - t.renderOrder : e.groupOrder - t.groupOrder;
}
function zg() {
	let e = [], t = 0, n = [], r = [], i = [];
	function a() {
		t = 0, n.length = 0, r.length = 0, i.length = 0;
	}
	function o(e) {
		let t = 0;
		return e.isInstancedMesh && (t += 2), e.isSkinnedMesh && (t += 1), t;
	}
	function s(n, r, i, a, s, c) {
		let l = e[t];
		return l === void 0 ? (l = {
			id: n.id,
			object: n,
			geometry: r,
			material: i,
			materialVariant: o(n),
			groupOrder: a,
			renderOrder: n.renderOrder,
			z: s,
			group: c
		}, e[t] = l) : (l.id = n.id, l.object = n, l.geometry = r, l.material = i, l.materialVariant = o(n), l.groupOrder = a, l.renderOrder = n.renderOrder, l.z = s, l.group = c), t++, l;
	}
	function c(e, t, a, o, c, l) {
		let u = s(e, t, a, o, c, l);
		a.transmission > 0 ? r.push(u) : a.transparent === !0 ? i.push(u) : n.push(u);
	}
	function l(e, t, a, o, c, l) {
		let u = s(e, t, a, o, c, l);
		a.transmission > 0 ? r.unshift(u) : a.transparent === !0 ? i.unshift(u) : n.unshift(u);
	}
	function u(e, t, a) {
		n.length > 1 && n.sort(e || Lg), r.length > 1 && r.sort(t || Rg), i.length > 1 && i.sort(t || Rg), a && (n.reverse(), r.reverse(), i.reverse());
	}
	function d() {
		for (let n = t, r = e.length; n < r; n++) {
			let t = e[n];
			if (t.id === null) break;
			t.id = null, t.object = null, t.geometry = null, t.material = null, t.group = null;
		}
	}
	return {
		opaque: n,
		transmissive: r,
		transparent: i,
		init: a,
		push: c,
		unshift: l,
		finish: d,
		sort: u
	};
}
function Bg() {
	let e = /* @__PURE__ */ new WeakMap();
	function t(t, n) {
		let r = e.get(t), i;
		return r === void 0 ? (i = new zg(), e.set(t, [i])) : n >= r.length ? (i = new zg(), r.push(i)) : i = r[n], i;
	}
	function n() {
		e = /* @__PURE__ */ new WeakMap();
	}
	return {
		get: t,
		dispose: n
	};
}
function Vg() {
	let e = {};
	return { get: function(t) {
		if (e[t.id] !== void 0) return e[t.id];
		let n;
		switch (t.type) {
			case "DirectionalLight":
				n = {
					direction: new U(),
					color: new J()
				};
				break;
			case "SpotLight":
				n = {
					position: new U(),
					direction: new U(),
					color: new J(),
					distance: 0,
					coneCos: 0,
					penumbraCos: 0,
					decay: 0
				};
				break;
			case "PointLight":
				n = {
					position: new U(),
					color: new J(),
					distance: 0,
					decay: 0
				};
				break;
			case "HemisphereLight":
				n = {
					direction: new U(),
					skyColor: new J(),
					groundColor: new J()
				};
				break;
			case "RectAreaLight":
				n = {
					color: new J(),
					position: new U(),
					halfWidth: new U(),
					halfHeight: new U()
				};
				break;
		}
		return e[t.id] = n, n;
	} };
}
function Hg() {
	let e = {};
	return { get: function(t) {
		if (e[t.id] !== void 0) return e[t.id];
		let n;
		switch (t.type) {
			case "DirectionalLight":
				n = {
					shadowIntensity: 1,
					shadowBias: 0,
					shadowNormalBias: 0,
					shadowRadius: 1,
					shadowMapSize: new H()
				};
				break;
			case "SpotLight":
				n = {
					shadowIntensity: 1,
					shadowBias: 0,
					shadowNormalBias: 0,
					shadowRadius: 1,
					shadowMapSize: new H()
				};
				break;
			case "PointLight":
				n = {
					shadowIntensity: 1,
					shadowBias: 0,
					shadowNormalBias: 0,
					shadowRadius: 1,
					shadowMapSize: new H(),
					shadowCameraNear: 1,
					shadowCameraFar: 1e3
				};
				break;
		}
		return e[t.id] = n, n;
	} };
}
var Ug = 0;
function Wg(e, t) {
	return (t.castShadow ? 2 : 0) - (e.castShadow ? 2 : 0) + +!!t.map - !!e.map;
}
function Gg(e) {
	let t = new Vg(), n = Hg(), r = {
		version: 0,
		hash: {
			directionalLength: -1,
			pointLength: -1,
			spotLength: -1,
			rectAreaLength: -1,
			hemiLength: -1,
			numDirectionalShadows: -1,
			numPointShadows: -1,
			numSpotShadows: -1,
			numSpotMaps: -1,
			numLightProbes: -1
		},
		ambient: [
			0,
			0,
			0
		],
		probe: [],
		directional: [],
		directionalShadow: [],
		directionalShadowMap: [],
		directionalShadowMatrix: [],
		spot: [],
		spotLightMap: [],
		spotShadow: [],
		spotShadowMap: [],
		spotLightMatrix: [],
		rectArea: [],
		rectAreaLTC1: null,
		rectAreaLTC2: null,
		point: [],
		pointShadow: [],
		pointShadowMap: [],
		pointShadowMatrix: [],
		hemi: [],
		numSpotLightShadowsWithMaps: 0,
		numLightProbes: 0
	};
	for (let e = 0; e < 9; e++) r.probe.push(new U());
	let i = new U(), a = new K(), o = new K();
	function s(i) {
		let a = 0, o = 0, s = 0;
		for (let e = 0; e < 9; e++) r.probe[e].set(0, 0, 0);
		let c = 0, l = 0, u = 0, d = 0, f = 0, p = 0, m = 0, h = 0, g = 0, _ = 0, v = 0;
		i.sort(Wg);
		for (let e = 0, y = i.length; e < y; e++) {
			let y = i[e], b = y.color, x = y.intensity, S = y.distance, C = null;
			if (y.shadow && y.shadow.map && (C = y.shadow.map.texture.format === 1030 ? y.shadow.map.texture : y.shadow.map.depthTexture || y.shadow.map.texture), y.isAmbientLight) a += b.r * x, o += b.g * x, s += b.b * x;
			else if (y.isLightProbe) {
				for (let e = 0; e < 9; e++) r.probe[e].addScaledVector(y.sh.coefficients[e], x);
				v++;
			} else if (y.isDirectionalLight) {
				let e = t.get(y);
				if (e.color.copy(y.color).multiplyScalar(y.intensity), y.castShadow) {
					let e = y.shadow, t = n.get(y);
					t.shadowIntensity = e.intensity, t.shadowBias = e.bias, t.shadowNormalBias = e.normalBias, t.shadowRadius = e.radius, t.shadowMapSize = e.mapSize, r.directionalShadow[c] = t, r.directionalShadowMap[c] = C, r.directionalShadowMatrix[c] = y.shadow.matrix, p++;
				}
				r.directional[c] = e, c++;
			} else if (y.isSpotLight) {
				let e = t.get(y);
				e.position.setFromMatrixPosition(y.matrixWorld), e.color.copy(b).multiplyScalar(x), e.distance = S, e.coneCos = Math.cos(y.angle), e.penumbraCos = Math.cos(y.angle * (1 - y.penumbra)), e.decay = y.decay, r.spot[u] = e;
				let i = y.shadow;
				if (y.map && (r.spotLightMap[g] = y.map, g++, i.updateMatrices(y), y.castShadow && _++), r.spotLightMatrix[u] = i.matrix, y.castShadow) {
					let e = n.get(y);
					e.shadowIntensity = i.intensity, e.shadowBias = i.bias, e.shadowNormalBias = i.normalBias, e.shadowRadius = i.radius, e.shadowMapSize = i.mapSize, r.spotShadow[u] = e, r.spotShadowMap[u] = C, h++;
				}
				u++;
			} else if (y.isRectAreaLight) {
				let e = t.get(y);
				e.color.copy(b).multiplyScalar(x), e.halfWidth.set(y.width * .5, 0, 0), e.halfHeight.set(0, y.height * .5, 0), r.rectArea[d] = e, d++;
			} else if (y.isPointLight) {
				let e = t.get(y);
				if (e.color.copy(y.color).multiplyScalar(y.intensity), e.distance = y.distance, e.decay = y.decay, y.castShadow) {
					let e = y.shadow, t = n.get(y);
					t.shadowIntensity = e.intensity, t.shadowBias = e.bias, t.shadowNormalBias = e.normalBias, t.shadowRadius = e.radius, t.shadowMapSize = e.mapSize, t.shadowCameraNear = e.camera.near, t.shadowCameraFar = e.camera.far, r.pointShadow[l] = t, r.pointShadowMap[l] = C, r.pointShadowMatrix[l] = y.shadow.matrix, m++;
				}
				r.point[l] = e, l++;
			} else if (y.isHemisphereLight) {
				let e = t.get(y);
				e.skyColor.copy(y.color).multiplyScalar(x), e.groundColor.copy(y.groundColor).multiplyScalar(x), r.hemi[f] = e, f++;
			}
		}
		d > 0 && (e.has("OES_texture_float_linear") === !0 ? (r.rectAreaLTC1 = $.LTC_FLOAT_1, r.rectAreaLTC2 = $.LTC_FLOAT_2) : (r.rectAreaLTC1 = $.LTC_HALF_1, r.rectAreaLTC2 = $.LTC_HALF_2)), r.ambient[0] = a, r.ambient[1] = o, r.ambient[2] = s;
		let y = r.hash;
		(y.directionalLength !== c || y.pointLength !== l || y.spotLength !== u || y.rectAreaLength !== d || y.hemiLength !== f || y.numDirectionalShadows !== p || y.numPointShadows !== m || y.numSpotShadows !== h || y.numSpotMaps !== g || y.numLightProbes !== v) && (r.directional.length = c, r.spot.length = u, r.rectArea.length = d, r.point.length = l, r.hemi.length = f, r.directionalShadow.length = p, r.directionalShadowMap.length = p, r.pointShadow.length = m, r.pointShadowMap.length = m, r.spotShadow.length = h, r.spotShadowMap.length = h, r.directionalShadowMatrix.length = p, r.pointShadowMatrix.length = m, r.spotLightMatrix.length = h + g - _, r.spotLightMap.length = g, r.numSpotLightShadowsWithMaps = _, r.numLightProbes = v, y.directionalLength = c, y.pointLength = l, y.spotLength = u, y.rectAreaLength = d, y.hemiLength = f, y.numDirectionalShadows = p, y.numPointShadows = m, y.numSpotShadows = h, y.numSpotMaps = g, y.numLightProbes = v, r.version = Ug++);
	}
	function c(e, t) {
		let n = 0, s = 0, c = 0, l = 0, u = 0, d = t.matrixWorldInverse;
		for (let t = 0, f = e.length; t < f; t++) {
			let f = e[t];
			if (f.isDirectionalLight) {
				let e = r.directional[n];
				e.direction.setFromMatrixPosition(f.matrixWorld), i.setFromMatrixPosition(f.target.matrixWorld), e.direction.sub(i), e.direction.transformDirection(d), n++;
			} else if (f.isSpotLight) {
				let e = r.spot[c];
				e.position.setFromMatrixPosition(f.matrixWorld), e.position.applyMatrix4(d), e.direction.setFromMatrixPosition(f.matrixWorld), i.setFromMatrixPosition(f.target.matrixWorld), e.direction.sub(i), e.direction.transformDirection(d), c++;
			} else if (f.isRectAreaLight) {
				let e = r.rectArea[l];
				e.position.setFromMatrixPosition(f.matrixWorld), e.position.applyMatrix4(d), o.identity(), a.copy(f.matrixWorld), a.premultiply(d), o.extractRotation(a), e.halfWidth.set(f.width * .5, 0, 0), e.halfHeight.set(0, f.height * .5, 0), e.halfWidth.applyMatrix4(o), e.halfHeight.applyMatrix4(o), l++;
			} else if (f.isPointLight) {
				let e = r.point[s];
				e.position.setFromMatrixPosition(f.matrixWorld), e.position.applyMatrix4(d), s++;
			} else if (f.isHemisphereLight) {
				let e = r.hemi[u];
				e.direction.setFromMatrixPosition(f.matrixWorld), e.direction.transformDirection(d), u++;
			}
		}
	}
	return {
		setup: s,
		setupView: c,
		state: r
	};
}
function Kg(e) {
	let t = new Gg(e), n = [], r = [], i = [];
	function a(e) {
		d.camera = e, n.length = 0, r.length = 0, i.length = 0;
	}
	function o(e) {
		n.push(e);
	}
	function s(e) {
		r.push(e);
	}
	function c(e) {
		i.push(e);
	}
	function l() {
		t.setup(n);
	}
	function u(e) {
		t.setupView(n, e);
	}
	let d = {
		lightsArray: n,
		shadowsArray: r,
		lightProbeGridArray: i,
		camera: null,
		lights: t,
		transmissionRenderTarget: {},
		textureUnits: 0
	};
	return {
		init: a,
		state: d,
		setupLights: l,
		setupLightsView: u,
		pushLight: o,
		pushShadow: s,
		pushLightProbeGrid: c
	};
}
function qg(e) {
	let t = /* @__PURE__ */ new WeakMap();
	function n(n, r = 0) {
		let i = t.get(n), a;
		return i === void 0 ? (a = new Kg(e), t.set(n, [a])) : r >= i.length ? (a = new Kg(e), i.push(a)) : a = i[r], a;
	}
	function r() {
		t = /* @__PURE__ */ new WeakMap();
	}
	return {
		get: n,
		dispose: r
	};
}
var Jg = "void main() {\n	gl_Position = vec4( position, 1.0 );\n}", Yg = "uniform sampler2D shadow_pass;\nuniform vec2 resolution;\nuniform float radius;\nvoid main() {\n	const float samples = float( VSM_SAMPLES );\n	float mean = 0.0;\n	float squared_mean = 0.0;\n	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );\n	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;\n	for ( float i = 0.0; i < samples; i ++ ) {\n		float uvOffset = uvStart + i * uvStride;\n		#ifdef HORIZONTAL_PASS\n			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;\n			mean += distribution.x;\n			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;\n		#else\n			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;\n			mean += depth;\n			squared_mean += depth * depth;\n		#endif\n	}\n	mean = mean / samples;\n	squared_mean = squared_mean / samples;\n	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );\n	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );\n}", Xg = [
	/*@__PURE__*/ new U(1, 0, 0),
	/*@__PURE__*/ new U(-1, 0, 0),
	/*@__PURE__*/ new U(0, 1, 0),
	/*@__PURE__*/ new U(0, -1, 0),
	/*@__PURE__*/ new U(0, 0, 1),
	/*@__PURE__*/ new U(0, 0, -1)
], Zg = [
	/*@__PURE__*/ new U(0, -1, 0),
	/*@__PURE__*/ new U(0, -1, 0),
	/*@__PURE__*/ new U(0, 0, 1),
	/*@__PURE__*/ new U(0, 0, -1),
	/*@__PURE__*/ new U(0, -1, 0),
	/*@__PURE__*/ new U(0, -1, 0)
], Qg = /*@__PURE__*/ new K(), $g = /*@__PURE__*/ new U(), e_ = /*@__PURE__*/ new U();
function t_(e, t, n) {
	let r = new Ss(), i = new H(), a = new H(), o = new ai(), s = new Au(), c = new ju(), l = {}, u = n.maxTextureSize, d = {
		0: 1,
		1: 0,
		2: 2
	}, f = new Su({
		defines: { VSM_SAMPLES: 8 },
		uniforms: {
			shadow_pass: { value: null },
			resolution: { value: new H() },
			radius: { value: 4 }
		},
		vertexShader: Jg,
		fragmentShader: Yg
	}), p = f.clone();
	p.defines.HORIZONTAL_PASS = 1;
	let m = new Z();
	m.setAttribute("position", new Y(new Float32Array([
		-1,
		-1,
		.5,
		3,
		-1,
		.5,
		-1,
		3,
		.5
	]), 3));
	let h = new Ho(m, f), g = this;
	this.enabled = !1, this.autoUpdate = !0, this.needsUpdate = !1, this.type = 1;
	let _ = this.type;
	this.render = function(t, n, s) {
		if (g.enabled === !1 || g.autoUpdate === !1 && g.needsUpdate === !1 || t.length === 0) return;
		this.type === 2 && (R("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."), this.type = 1);
		let c = e.getRenderTarget(), l = e.getActiveCubeFace(), d = e.getActiveMipmapLevel(), f = e.state;
		f.setBlending(0), f.buffers.depth.getReversed() === !0 ? f.buffers.color.setClear(0, 0, 0, 0) : f.buffers.color.setClear(1, 1, 1, 1), f.buffers.depth.setTest(!0), f.setScissorTest(!1);
		let p = _ !== this.type;
		p && n.traverse(function(e) {
			e.material && (Array.isArray(e.material) ? e.material.forEach((e) => e.needsUpdate = !0) : e.material.needsUpdate = !0);
		});
		for (let c = 0, l = t.length; c < l; c++) {
			let l = t[c], d = l.shadow;
			if (d === void 0) {
				R("WebGLShadowMap:", l, "has no shadow.");
				continue;
			}
			if (d.autoUpdate === !1 && d.needsUpdate === !1) continue;
			i.copy(d.mapSize);
			let m = d.getFrameExtents();
			i.multiply(m), a.copy(d.mapSize), (i.x > u || i.y > u) && (i.x > u && (a.x = Math.floor(u / m.x), i.x = a.x * m.x, d.mapSize.x = a.x), i.y > u && (a.y = Math.floor(u / m.y), i.y = a.y * m.y, d.mapSize.y = a.y));
			let h = e.state.buffers.depth.getReversed();
			if (d.camera._reversedDepth = h, d.map === null || p === !0) {
				if (d.map !== null && (d.map.depthTexture !== null && (d.map.depthTexture.dispose(), d.map.depthTexture = null), d.map.dispose()), this.type === 3) {
					if (l.isPointLight) {
						R("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");
						continue;
					}
					d.map = new si(i.x, i.y, {
						format: Tt,
						type: ft,
						minFilter: et,
						magFilter: et,
						generateMipmaps: !1
					}), d.map.texture.name = l.name + ".shadowMap", d.map.depthTexture = new bc(i.x, i.y, dt), d.map.depthTexture.name = l.name + ".shadowMapDepth", d.map.depthTexture.format = xt, d.map.depthTexture.compareFunction = null, d.map.depthTexture.minFilter = Ye, d.map.depthTexture.magFilter = Ye;
				} else l.isPointLight ? (d.map = new Mm(i.x), d.map.depthTexture = new xc(i.x, ut)) : (d.map = new si(i.x, i.y), d.map.depthTexture = new bc(i.x, i.y, ut)), d.map.depthTexture.name = l.name + ".shadowMap", d.map.depthTexture.format = xt, this.type === 1 ? (d.map.depthTexture.compareFunction = h ? 518 : 515, d.map.depthTexture.minFilter = et, d.map.depthTexture.magFilter = et) : (d.map.depthTexture.compareFunction = null, d.map.depthTexture.minFilter = Ye, d.map.depthTexture.magFilter = Ye);
				d.camera.updateProjectionMatrix();
			}
			let g = d.map.isWebGLCubeRenderTarget ? 6 : 1;
			for (let t = 0; t < g; t++) {
				if (d.map.isWebGLCubeRenderTarget) e.setRenderTarget(d.map, t), e.clear();
				else {
					t === 0 && (e.setRenderTarget(d.map), e.clear());
					let n = d.getViewport(t);
					o.set(a.x * n.x, a.y * n.y, a.x * n.z, a.y * n.w), f.viewport(o);
				}
				if (l.isPointLight) {
					let e = d.camera, n = d.matrix, r = l.distance || e.far;
					r !== e.far && (e.far = r, e.updateProjectionMatrix()), $g.setFromMatrixPosition(l.matrixWorld), e.position.copy($g), e_.copy(e.position), e_.add(Xg[t]), e.up.copy(Zg[t]), e.lookAt(e_), e.updateMatrixWorld(), n.makeTranslation(-$g.x, -$g.y, -$g.z), Qg.multiplyMatrices(e.projectionMatrix, e.matrixWorldInverse), d._frustum.setFromProjectionMatrix(Qg, e.coordinateSystem, e.reversedDepth);
				} else d.updateMatrices(l);
				r = d.getFrustum(), b(n, s, d.camera, l, this.type);
			}
			d.isPointLightShadow !== !0 && this.type === 3 && v(d, s), d.needsUpdate = !1;
		}
		_ = this.type, g.needsUpdate = !1, e.setRenderTarget(c, l, d);
	};
	function v(n, r) {
		let a = t.update(h);
		f.defines.VSM_SAMPLES !== n.blurSamples && (f.defines.VSM_SAMPLES = n.blurSamples, p.defines.VSM_SAMPLES = n.blurSamples, f.needsUpdate = !0, p.needsUpdate = !0), n.mapPass === null && (n.mapPass = new si(i.x, i.y, {
			format: Tt,
			type: ft
		})), f.uniforms.shadow_pass.value = n.map.depthTexture, f.uniforms.resolution.value = n.mapSize, f.uniforms.radius.value = n.radius, e.setRenderTarget(n.mapPass), e.clear(), e.renderBufferDirect(r, null, a, f, h, null), p.uniforms.shadow_pass.value = n.mapPass.texture, p.uniforms.resolution.value = n.mapSize, p.uniforms.radius.value = n.radius, e.setRenderTarget(n.map), e.clear(), e.renderBufferDirect(r, null, a, p, h, null);
	}
	function y(t, n, r, i) {
		let a = null, o = r.isPointLight === !0 ? t.customDistanceMaterial : t.customDepthMaterial;
		if (o !== void 0) a = o;
		else if (a = r.isPointLight === !0 ? c : s, e.localClippingEnabled && n.clipShadows === !0 && Array.isArray(n.clippingPlanes) && n.clippingPlanes.length !== 0 || n.displacementMap && n.displacementScale !== 0 || n.alphaMap && n.alphaTest > 0 || n.map && n.alphaTest > 0 || n.alphaToCoverage === !0) {
			let e = a.uuid, t = n.uuid, r = l[e];
			r === void 0 && (r = {}, l[e] = r);
			let i = r[t];
			i === void 0 && (i = a.clone(), r[t] = i, n.addEventListener("dispose", x)), a = i;
		}
		if (a.visible = n.visible, a.wireframe = n.wireframe, i === 3 ? a.side = n.shadowSide === null ? n.side : n.shadowSide : a.side = n.shadowSide === null ? d[n.side] : n.shadowSide, a.alphaMap = n.alphaMap, a.alphaTest = n.alphaToCoverage === !0 ? .5 : n.alphaTest, a.map = n.map, a.clipShadows = n.clipShadows, a.clippingPlanes = n.clippingPlanes, a.clipIntersection = n.clipIntersection, a.displacementMap = n.displacementMap, a.displacementScale = n.displacementScale, a.displacementBias = n.displacementBias, a.wireframeLinewidth = n.wireframeLinewidth, a.linewidth = n.linewidth, r.isPointLight === !0 && a.isMeshDistanceMaterial === !0) {
			let t = e.properties.get(a);
			t.light = r;
		}
		return a;
	}
	function b(n, i, a, o, s) {
		if (n.visible === !1) return;
		if (n.layers.test(i.layers) && (n.isMesh || n.isLine || n.isPoints) && (n.castShadow || n.receiveShadow && s === 3) && (!n.frustumCulled || r.intersectsObject(n))) {
			n.modelViewMatrix.multiplyMatrices(a.matrixWorldInverse, n.matrixWorld);
			let r = t.update(n), c = n.material;
			if (Array.isArray(c)) {
				let t = r.groups;
				for (let l = 0, u = t.length; l < u; l++) {
					let u = t[l], d = c[u.materialIndex];
					if (d && d.visible) {
						let t = y(n, d, o, s);
						n.onBeforeShadow(e, n, i, a, r, t, u), e.renderBufferDirect(a, null, r, t, n, u), n.onAfterShadow(e, n, i, a, r, t, u);
					}
				}
			} else if (c.visible) {
				let t = y(n, c, o, s);
				n.onBeforeShadow(e, n, i, a, r, t, null), e.renderBufferDirect(a, null, r, t, n, null), n.onAfterShadow(e, n, i, a, r, t, null);
			}
		}
		let c = n.children;
		for (let e = 0, t = c.length; e < t; e++) b(c[e], i, a, o, s);
	}
	function x(e) {
		e.target.removeEventListener("dispose", x);
		for (let t in l) {
			let n = l[t], r = e.target.uuid;
			r in n && (n[r].dispose(), delete n[r]);
		}
	}
}
function n_(e, t) {
	function n() {
		let t = !1, n = new ai(), r = null, i = new ai(0, 0, 0, 0);
		return {
			setMask: function(n) {
				r !== n && !t && (e.colorMask(n, n, n, n), r = n);
			},
			setLocked: function(e) {
				t = e;
			},
			setClear: function(t, r, a, o, s) {
				s === !0 && (t *= o, r *= o, a *= o), n.set(t, r, a, o), i.equals(n) === !1 && (e.clearColor(t, r, a, o), i.copy(n));
			},
			reset: function() {
				t = !1, r = null, i.set(-1, 0, 0, 0);
			}
		};
	}
	function r() {
		let n = !1, r = !1, i = null, a = null, o = null;
		return {
			setReversed: function(e) {
				if (r !== e) {
					let n = t.get("EXT_clip_control");
					e ? n.clipControlEXT(n.LOWER_LEFT_EXT, n.ZERO_TO_ONE_EXT) : n.clipControlEXT(n.LOWER_LEFT_EXT, n.NEGATIVE_ONE_TO_ONE_EXT), r = e;
					let i = o;
					o = null, this.setClear(i);
				}
			},
			getReversed: function() {
				return r;
			},
			setTest: function(t) {
				t ? ue(e.DEPTH_TEST) : de(e.DEPTH_TEST);
			},
			setMask: function(t) {
				i !== t && !n && (e.depthMask(t), i = t);
			},
			setFunc: function(t) {
				if (r && (t = hr[t]), a !== t) {
					switch (t) {
						case 0:
							e.depthFunc(e.NEVER);
							break;
						case 1:
							e.depthFunc(e.ALWAYS);
							break;
						case 2:
							e.depthFunc(e.LESS);
							break;
						case 3:
							e.depthFunc(e.LEQUAL);
							break;
						case 4:
							e.depthFunc(e.EQUAL);
							break;
						case 5:
							e.depthFunc(e.GEQUAL);
							break;
						case 6:
							e.depthFunc(e.GREATER);
							break;
						case 7:
							e.depthFunc(e.NOTEQUAL);
							break;
						default: e.depthFunc(e.LEQUAL);
					}
					a = t;
				}
			},
			setLocked: function(e) {
				n = e;
			},
			setClear: function(t) {
				o !== t && (o = t, r && (t = 1 - t), e.clearDepth(t));
			},
			reset: function() {
				n = !1, i = null, a = null, o = null, r = !1;
			}
		};
	}
	function i() {
		let t = !1, n = null, r = null, i = null, a = null, o = null, s = null, c = null, l = null;
		return {
			setTest: function(n) {
				t || (n ? ue(e.STENCIL_TEST) : de(e.STENCIL_TEST));
			},
			setMask: function(r) {
				n !== r && !t && (e.stencilMask(r), n = r);
			},
			setFunc: function(t, n, o) {
				(r !== t || i !== n || a !== o) && (e.stencilFunc(t, n, o), r = t, i = n, a = o);
			},
			setOp: function(t, n, r) {
				(o !== t || s !== n || c !== r) && (e.stencilOp(t, n, r), o = t, s = n, c = r);
			},
			setLocked: function(e) {
				t = e;
			},
			setClear: function(t) {
				l !== t && (e.clearStencil(t), l = t);
			},
			reset: function() {
				t = !1, n = null, r = null, i = null, a = null, o = null, s = null, c = null, l = null;
			}
		};
	}
	let a = new n(), o = new r(), s = new i(), c = /* @__PURE__ */ new WeakMap(), l = /* @__PURE__ */ new WeakMap(), u = {}, d = {}, f = {}, p = /* @__PURE__ */ new WeakMap(), m = [], h = null, g = !1, _ = null, v = null, y = null, b = null, x = null, S = null, C = null, w = new J(0, 0, 0), T = 0, E = !1, D = null, O = null, k = null, A = null, ee = null, te = e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS), j = !1, ne = 0, re = e.getParameter(e.VERSION);
	re.indexOf("WebGL") === -1 ? re.indexOf("OpenGL ES") !== -1 && (ne = parseFloat(/^OpenGL ES (\d)/.exec(re)[1]), j = ne >= 2) : (ne = parseFloat(/^WebGL (\d)/.exec(re)[1]), j = ne >= 1);
	let M = null, ie = {}, ae = e.getParameter(e.SCISSOR_BOX), oe = e.getParameter(e.VIEWPORT), se = new ai().fromArray(ae), N = new ai().fromArray(oe);
	function ce(t, n, r, i) {
		let a = /* @__PURE__ */ new Uint8Array(4), o = e.createTexture();
		e.bindTexture(t, o), e.texParameteri(t, e.TEXTURE_MIN_FILTER, e.NEAREST), e.texParameteri(t, e.TEXTURE_MAG_FILTER, e.NEAREST);
		for (let o = 0; o < r; o++) t === e.TEXTURE_3D || t === e.TEXTURE_2D_ARRAY ? e.texImage3D(n, 0, e.RGBA, 1, 1, i, 0, e.RGBA, e.UNSIGNED_BYTE, a) : e.texImage2D(n + o, 0, e.RGBA, 1, 1, 0, e.RGBA, e.UNSIGNED_BYTE, a);
		return o;
	}
	let le = {};
	le[e.TEXTURE_2D] = ce(e.TEXTURE_2D, e.TEXTURE_2D, 1), le[e.TEXTURE_CUBE_MAP] = ce(e.TEXTURE_CUBE_MAP, e.TEXTURE_CUBE_MAP_POSITIVE_X, 6), le[e.TEXTURE_2D_ARRAY] = ce(e.TEXTURE_2D_ARRAY, e.TEXTURE_2D_ARRAY, 1, 1), le[e.TEXTURE_3D] = ce(e.TEXTURE_3D, e.TEXTURE_3D, 1, 1), a.setClear(0, 0, 0, 1), o.setClear(1), s.setClear(0), ue(e.DEPTH_TEST), o.setFunc(3), ye(!1), be(1), ue(e.CULL_FACE), _e(0);
	function ue(t) {
		u[t] !== !0 && (e.enable(t), u[t] = !0);
	}
	function de(t) {
		u[t] !== !1 && (e.disable(t), u[t] = !1);
	}
	function fe(t, n) {
		return f[t] === n ? !1 : (e.bindFramebuffer(t, n), f[t] = n, t === e.DRAW_FRAMEBUFFER && (f[e.FRAMEBUFFER] = n), t === e.FRAMEBUFFER && (f[e.DRAW_FRAMEBUFFER] = n), !0);
	}
	function pe(t, n) {
		let r = m, i = !1;
		if (t) {
			r = p.get(n), r === void 0 && (r = [], p.set(n, r));
			let a = t.textures;
			if (r.length !== a.length || r[0] !== e.COLOR_ATTACHMENT0) {
				for (let t = 0, n = a.length; t < n; t++) r[t] = e.COLOR_ATTACHMENT0 + t;
				r.length = a.length, i = !0;
			}
		} else r[0] !== e.BACK && (r[0] = e.BACK, i = !0);
		i && e.drawBuffers(r);
	}
	function me(t) {
		return h === t ? !1 : (e.useProgram(t), h = t, !0);
	}
	let he = {
		100: e.FUNC_ADD,
		101: e.FUNC_SUBTRACT,
		102: e.FUNC_REVERSE_SUBTRACT
	};
	he[103] = e.MIN, he[104] = e.MAX;
	let ge = {
		200: e.ZERO,
		201: e.ONE,
		202: e.SRC_COLOR,
		204: e.SRC_ALPHA,
		210: e.SRC_ALPHA_SATURATE,
		208: e.DST_COLOR,
		206: e.DST_ALPHA,
		203: e.ONE_MINUS_SRC_COLOR,
		205: e.ONE_MINUS_SRC_ALPHA,
		209: e.ONE_MINUS_DST_COLOR,
		207: e.ONE_MINUS_DST_ALPHA,
		211: e.CONSTANT_COLOR,
		212: e.ONE_MINUS_CONSTANT_COLOR,
		213: e.CONSTANT_ALPHA,
		214: e.ONE_MINUS_CONSTANT_ALPHA
	};
	function _e(t, n, r, i, a, o, s, c, l, u) {
		if (t === 0) {
			g === !0 && (de(e.BLEND), g = !1);
			return;
		}
		if (g === !1 && (ue(e.BLEND), g = !0), t !== 5) {
			if (t !== _ || u !== E) {
				if ((v !== 100 || x !== 100) && (e.blendEquation(e.FUNC_ADD), v = 100, x = 100), u) switch (t) {
					case 1:
						e.blendFuncSeparate(e.ONE, e.ONE_MINUS_SRC_ALPHA, e.ONE, e.ONE_MINUS_SRC_ALPHA);
						break;
					case 2:
						e.blendFunc(e.ONE, e.ONE);
						break;
					case 3:
						e.blendFuncSeparate(e.ZERO, e.ONE_MINUS_SRC_COLOR, e.ZERO, e.ONE);
						break;
					case 4:
						e.blendFuncSeparate(e.DST_COLOR, e.ONE_MINUS_SRC_ALPHA, e.ZERO, e.ONE);
						break;
					default:
						z("WebGLState: Invalid blending: ", t);
						break;
				}
				else switch (t) {
					case 1:
						e.blendFuncSeparate(e.SRC_ALPHA, e.ONE_MINUS_SRC_ALPHA, e.ONE, e.ONE_MINUS_SRC_ALPHA);
						break;
					case 2:
						e.blendFuncSeparate(e.SRC_ALPHA, e.ONE, e.ONE, e.ONE);
						break;
					case 3:
						z("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");
						break;
					case 4:
						z("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");
						break;
					default:
						z("WebGLState: Invalid blending: ", t);
						break;
				}
				y = null, b = null, S = null, C = null, w.set(0, 0, 0), T = 0, _ = t, E = u;
			}
			return;
		}
		a ||= n, o ||= r, s ||= i, (n !== v || a !== x) && (e.blendEquationSeparate(he[n], he[a]), v = n, x = a), (r !== y || i !== b || o !== S || s !== C) && (e.blendFuncSeparate(ge[r], ge[i], ge[o], ge[s]), y = r, b = i, S = o, C = s), (c.equals(w) === !1 || l !== T) && (e.blendColor(c.r, c.g, c.b, l), w.copy(c), T = l), _ = t, E = !1;
	}
	function ve(t, n) {
		t.side === 2 ? de(e.CULL_FACE) : ue(e.CULL_FACE);
		let r = t.side === 1;
		n && (r = !r), ye(r), t.blending === 1 && t.transparent === !1 ? _e(0) : _e(t.blending, t.blendEquation, t.blendSrc, t.blendDst, t.blendEquationAlpha, t.blendSrcAlpha, t.blendDstAlpha, t.blendColor, t.blendAlpha, t.premultipliedAlpha), o.setFunc(t.depthFunc), o.setTest(t.depthTest), o.setMask(t.depthWrite), a.setMask(t.colorWrite);
		let i = t.stencilWrite;
		s.setTest(i), i && (s.setMask(t.stencilWriteMask), s.setFunc(t.stencilFunc, t.stencilRef, t.stencilFuncMask), s.setOp(t.stencilFail, t.stencilZFail, t.stencilZPass)), Se(t.polygonOffset, t.polygonOffsetFactor, t.polygonOffsetUnits), t.alphaToCoverage === !0 ? ue(e.SAMPLE_ALPHA_TO_COVERAGE) : de(e.SAMPLE_ALPHA_TO_COVERAGE);
	}
	function ye(t) {
		D !== t && (t ? e.frontFace(e.CW) : e.frontFace(e.CCW), D = t);
	}
	function be(t) {
		t === 0 ? de(e.CULL_FACE) : (ue(e.CULL_FACE), t !== O && (t === 1 ? e.cullFace(e.BACK) : t === 2 ? e.cullFace(e.FRONT) : e.cullFace(e.FRONT_AND_BACK))), O = t;
	}
	function xe(t) {
		t !== k && (j && e.lineWidth(t), k = t);
	}
	function Se(t, n, r) {
		t ? (ue(e.POLYGON_OFFSET_FILL), (A !== n || ee !== r) && (A = n, ee = r, o.getReversed() && (n = -n), e.polygonOffset(n, r))) : de(e.POLYGON_OFFSET_FILL);
	}
	function Ce(t) {
		t ? ue(e.SCISSOR_TEST) : de(e.SCISSOR_TEST);
	}
	function P(t) {
		t === void 0 && (t = e.TEXTURE0 + te - 1), M !== t && (e.activeTexture(t), M = t);
	}
	function we(t, n, r) {
		r === void 0 && (r = M === null ? e.TEXTURE0 + te - 1 : M);
		let i = ie[r];
		i === void 0 && (i = {
			type: void 0,
			texture: void 0
		}, ie[r] = i), (i.type !== t || i.texture !== n) && (M !== r && (e.activeTexture(r), M = r), e.bindTexture(t, n || le[t]), i.type = t, i.texture = n);
	}
	function Te() {
		let t = ie[M];
		t !== void 0 && t.type !== void 0 && (e.bindTexture(t.type, null), t.type = void 0, t.texture = void 0);
	}
	function Ee() {
		try {
			e.compressedTexImage2D(...arguments);
		} catch (e) {
			z("WebGLState:", e);
		}
	}
	function F() {
		try {
			e.compressedTexImage3D(...arguments);
		} catch (e) {
			z("WebGLState:", e);
		}
	}
	function De() {
		try {
			e.texSubImage2D(...arguments);
		} catch (e) {
			z("WebGLState:", e);
		}
	}
	function I() {
		try {
			e.texSubImage3D(...arguments);
		} catch (e) {
			z("WebGLState:", e);
		}
	}
	function L() {
		try {
			e.compressedTexSubImage2D(...arguments);
		} catch (e) {
			z("WebGLState:", e);
		}
	}
	function Oe() {
		try {
			e.compressedTexSubImage3D(...arguments);
		} catch (e) {
			z("WebGLState:", e);
		}
	}
	function ke() {
		try {
			e.texStorage2D(...arguments);
		} catch (e) {
			z("WebGLState:", e);
		}
	}
	function Ae() {
		try {
			e.texStorage3D(...arguments);
		} catch (e) {
			z("WebGLState:", e);
		}
	}
	function je() {
		try {
			e.texImage2D(...arguments);
		} catch (e) {
			z("WebGLState:", e);
		}
	}
	function Me() {
		try {
			e.texImage3D(...arguments);
		} catch (e) {
			z("WebGLState:", e);
		}
	}
	function Ne(t) {
		return d[t] === void 0 ? e.getParameter(t) : d[t];
	}
	function Pe(t, n) {
		d[t] !== n && (e.pixelStorei(t, n), d[t] = n);
	}
	function Fe(t) {
		se.equals(t) === !1 && (e.scissor(t.x, t.y, t.z, t.w), se.copy(t));
	}
	function Ie(t) {
		N.equals(t) === !1 && (e.viewport(t.x, t.y, t.z, t.w), N.copy(t));
	}
	function Le(t, n) {
		let r = l.get(n);
		r === void 0 && (r = /* @__PURE__ */ new WeakMap(), l.set(n, r));
		let i = r.get(t);
		i === void 0 && (i = e.getUniformBlockIndex(n, t.name), r.set(t, i));
	}
	function Re(t, n) {
		let r = l.get(n).get(t);
		c.get(n) !== r && (e.uniformBlockBinding(n, r, t.__bindingPointIndex), c.set(n, r));
	}
	function ze() {
		e.disable(e.BLEND), e.disable(e.CULL_FACE), e.disable(e.DEPTH_TEST), e.disable(e.POLYGON_OFFSET_FILL), e.disable(e.SCISSOR_TEST), e.disable(e.STENCIL_TEST), e.disable(e.SAMPLE_ALPHA_TO_COVERAGE), e.blendEquation(e.FUNC_ADD), e.blendFunc(e.ONE, e.ZERO), e.blendFuncSeparate(e.ONE, e.ZERO, e.ONE, e.ZERO), e.blendColor(0, 0, 0, 0), e.colorMask(!0, !0, !0, !0), e.clearColor(0, 0, 0, 0), e.depthMask(!0), e.depthFunc(e.LESS), o.setReversed(!1), e.clearDepth(1), e.stencilMask(4294967295), e.stencilFunc(e.ALWAYS, 0, 4294967295), e.stencilOp(e.KEEP, e.KEEP, e.KEEP), e.clearStencil(0), e.cullFace(e.BACK), e.frontFace(e.CCW), e.polygonOffset(0, 0), e.activeTexture(e.TEXTURE0), e.bindFramebuffer(e.FRAMEBUFFER, null), e.bindFramebuffer(e.DRAW_FRAMEBUFFER, null), e.bindFramebuffer(e.READ_FRAMEBUFFER, null), e.useProgram(null), e.lineWidth(1), e.scissor(0, 0, e.canvas.width, e.canvas.height), e.viewport(0, 0, e.canvas.width, e.canvas.height), e.pixelStorei(e.PACK_ALIGNMENT, 4), e.pixelStorei(e.UNPACK_ALIGNMENT, 4), e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL, !1), e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !1), e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL, e.BROWSER_DEFAULT_WEBGL), e.pixelStorei(e.PACK_ROW_LENGTH, 0), e.pixelStorei(e.PACK_SKIP_PIXELS, 0), e.pixelStorei(e.PACK_SKIP_ROWS, 0), e.pixelStorei(e.UNPACK_ROW_LENGTH, 0), e.pixelStorei(e.UNPACK_IMAGE_HEIGHT, 0), e.pixelStorei(e.UNPACK_SKIP_PIXELS, 0), e.pixelStorei(e.UNPACK_SKIP_ROWS, 0), e.pixelStorei(e.UNPACK_SKIP_IMAGES, 0), u = {}, d = {}, M = null, ie = {}, f = {}, p = /* @__PURE__ */ new WeakMap(), m = [], h = null, g = !1, _ = null, v = null, y = null, b = null, x = null, S = null, C = null, w = new J(0, 0, 0), T = 0, E = !1, D = null, O = null, k = null, A = null, ee = null, se.set(0, 0, e.canvas.width, e.canvas.height), N.set(0, 0, e.canvas.width, e.canvas.height), a.reset(), o.reset(), s.reset();
	}
	return {
		buffers: {
			color: a,
			depth: o,
			stencil: s
		},
		enable: ue,
		disable: de,
		bindFramebuffer: fe,
		drawBuffers: pe,
		useProgram: me,
		setBlending: _e,
		setMaterial: ve,
		setFlipSided: ye,
		setCullFace: be,
		setLineWidth: xe,
		setPolygonOffset: Se,
		setScissorTest: Ce,
		activeTexture: P,
		bindTexture: we,
		unbindTexture: Te,
		compressedTexImage2D: Ee,
		compressedTexImage3D: F,
		texImage2D: je,
		texImage3D: Me,
		pixelStorei: Pe,
		getParameter: Ne,
		updateUBOMapping: Le,
		uniformBlockBinding: Re,
		texStorage2D: ke,
		texStorage3D: Ae,
		texSubImage2D: De,
		texSubImage3D: I,
		compressedTexSubImage2D: L,
		compressedTexSubImage3D: Oe,
		scissor: Fe,
		viewport: Ie,
		reset: ze
	};
}
function r_(e, t, n, r, i, a, o) {
	let s = t.has("WEBGL_multisampled_render_to_texture") ? t.get("WEBGL_multisampled_render_to_texture") : null, c = typeof navigator > "u" ? !1 : /OculusBrowser/g.test(navigator.userAgent), l = new H(), u = /* @__PURE__ */ new WeakMap(), d = /* @__PURE__ */ new Set(), f, p = /* @__PURE__ */ new WeakMap(), m = !1;
	try {
		m = typeof OffscreenCanvas < "u" && new OffscreenCanvas(1, 1).getContext("2d") !== null;
	} catch {}
	function h(e, t) {
		return m ? new OffscreenCanvas(e, t) : ar("canvas");
	}
	function g(e, t, n) {
		let r = 1, i = Ee(e);
		if ((i.width > n || i.height > n) && (r = n / Math.max(i.width, i.height)), r < 1) if (typeof HTMLImageElement < "u" && e instanceof HTMLImageElement || typeof HTMLCanvasElement < "u" && e instanceof HTMLCanvasElement || typeof ImageBitmap < "u" && e instanceof ImageBitmap || typeof VideoFrame < "u" && e instanceof VideoFrame) {
			let n = Math.floor(r * i.width), a = Math.floor(r * i.height);
			f === void 0 && (f = h(n, a));
			let o = t ? h(n, a) : f;
			return o.width = n, o.height = a, o.getContext("2d").drawImage(e, 0, 0, n, a), R("WebGLRenderer: Texture has been resized from (" + i.width + "x" + i.height + ") to (" + n + "x" + a + ")."), o;
		} else return "data" in e && R("WebGLRenderer: Image in DataTexture is too big (" + i.width + "x" + i.height + ")."), e;
		return e;
	}
	function _(e) {
		return e.generateMipmaps;
	}
	function v(t) {
		e.generateMipmap(t);
	}
	function y(t) {
		return t.isWebGLCubeRenderTarget ? e.TEXTURE_CUBE_MAP : t.isWebGL3DRenderTarget ? e.TEXTURE_3D : t.isWebGLArrayRenderTarget || t.isCompressedArrayTexture ? e.TEXTURE_2D_ARRAY : e.TEXTURE_2D;
	}
	function b(n, r, i, a, o, s = !1) {
		if (n !== null) {
			if (e[n] !== void 0) return e[n];
			R("WebGLRenderer: Attempt to use non-existing WebGL internal format '" + n + "'");
		}
		let c;
		a && (c = t.get("EXT_texture_norm16"), c || R("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));
		let l = r;
		if (r === e.RED && (i === e.FLOAT && (l = e.R32F), i === e.HALF_FLOAT && (l = e.R16F), i === e.UNSIGNED_BYTE && (l = e.R8), i === e.UNSIGNED_SHORT && c && (l = c.R16_EXT), i === e.SHORT && c && (l = c.R16_SNORM_EXT)), r === e.RED_INTEGER && (i === e.UNSIGNED_BYTE && (l = e.R8UI), i === e.UNSIGNED_SHORT && (l = e.R16UI), i === e.UNSIGNED_INT && (l = e.R32UI), i === e.BYTE && (l = e.R8I), i === e.SHORT && (l = e.R16I), i === e.INT && (l = e.R32I)), r === e.RG && (i === e.FLOAT && (l = e.RG32F), i === e.HALF_FLOAT && (l = e.RG16F), i === e.UNSIGNED_BYTE && (l = e.RG8), i === e.UNSIGNED_SHORT && c && (l = c.RG16_EXT), i === e.SHORT && c && (l = c.RG16_SNORM_EXT)), r === e.RG_INTEGER && (i === e.UNSIGNED_BYTE && (l = e.RG8UI), i === e.UNSIGNED_SHORT && (l = e.RG16UI), i === e.UNSIGNED_INT && (l = e.RG32UI), i === e.BYTE && (l = e.RG8I), i === e.SHORT && (l = e.RG16I), i === e.INT && (l = e.RG32I)), r === e.RGB_INTEGER && (i === e.UNSIGNED_BYTE && (l = e.RGB8UI), i === e.UNSIGNED_SHORT && (l = e.RGB16UI), i === e.UNSIGNED_INT && (l = e.RGB32UI), i === e.BYTE && (l = e.RGB8I), i === e.SHORT && (l = e.RGB16I), i === e.INT && (l = e.RGB32I)), r === e.RGBA_INTEGER && (i === e.UNSIGNED_BYTE && (l = e.RGBA8UI), i === e.UNSIGNED_SHORT && (l = e.RGBA16UI), i === e.UNSIGNED_INT && (l = e.RGBA32UI), i === e.BYTE && (l = e.RGBA8I), i === e.SHORT && (l = e.RGBA16I), i === e.INT && (l = e.RGBA32I)), r === e.RGB && (i === e.UNSIGNED_SHORT && c && (l = c.RGB16_EXT), i === e.SHORT && c && (l = c.RGB16_SNORM_EXT), i === e.UNSIGNED_INT_5_9_9_9_REV && (l = e.RGB9_E5), i === e.UNSIGNED_INT_10F_11F_11F_REV && (l = e.R11F_G11F_B10F)), r === e.RGBA) {
			let t = s ? An : G.getTransfer(o);
			i === e.FLOAT && (l = e.RGBA32F), i === e.HALF_FLOAT && (l = e.RGBA16F), i === e.UNSIGNED_BYTE && (l = t === "srgb" ? e.SRGB8_ALPHA8 : e.RGBA8), i === e.UNSIGNED_SHORT && c && (l = c.RGBA16_EXT), i === e.SHORT && c && (l = c.RGBA16_SNORM_EXT), i === e.UNSIGNED_SHORT_4_4_4_4 && (l = e.RGBA4), i === e.UNSIGNED_SHORT_5_5_5_1 && (l = e.RGB5_A1);
		}
		return (l === e.R16F || l === e.R32F || l === e.RG16F || l === e.RG32F || l === e.RGBA16F || l === e.RGBA32F) && t.get("EXT_color_buffer_float"), l;
	}
	function x(t, n) {
		let r;
		return t ? n === null || n === 1014 || n === 1020 ? r = e.DEPTH24_STENCIL8 : n === 1015 ? r = e.DEPTH32F_STENCIL8 : n === 1012 && (r = e.DEPTH24_STENCIL8, R("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")) : n === null || n === 1014 || n === 1020 ? r = e.DEPTH_COMPONENT24 : n === 1015 ? r = e.DEPTH_COMPONENT32F : n === 1012 && (r = e.DEPTH_COMPONENT16), r;
	}
	function S(e, t) {
		return _(e) === !0 || e.isFramebufferTexture && e.minFilter !== 1003 && e.minFilter !== 1006 ? Math.log2(Math.max(t.width, t.height)) + 1 : e.mipmaps !== void 0 && e.mipmaps.length > 0 ? e.mipmaps.length : e.isCompressedTexture && Array.isArray(e.image) ? t.mipmaps.length : 1;
	}
	function C(e) {
		let t = e.target;
		t.removeEventListener("dispose", C), T(t), t.isVideoTexture && u.delete(t), t.isHTMLTexture && d.delete(t);
	}
	function w(e) {
		let t = e.target;
		t.removeEventListener("dispose", w), D(t);
	}
	function T(e) {
		let t = r.get(e);
		if (t.__webglInit === void 0) return;
		let n = e.source, i = p.get(n);
		if (i) {
			let r = i[t.__cacheKey];
			r.usedTimes--, r.usedTimes === 0 && E(e), Object.keys(i).length === 0 && p.delete(n);
		}
		r.remove(e);
	}
	function E(t) {
		let n = r.get(t);
		e.deleteTexture(n.__webglTexture);
		let i = t.source, a = p.get(i);
		delete a[n.__cacheKey], o.memory.textures--;
	}
	function D(t) {
		let n = r.get(t);
		if (t.depthTexture && (t.depthTexture.dispose(), r.remove(t.depthTexture)), t.isWebGLCubeRenderTarget) for (let t = 0; t < 6; t++) {
			if (Array.isArray(n.__webglFramebuffer[t])) for (let r = 0; r < n.__webglFramebuffer[t].length; r++) e.deleteFramebuffer(n.__webglFramebuffer[t][r]);
			else e.deleteFramebuffer(n.__webglFramebuffer[t]);
			n.__webglDepthbuffer && e.deleteRenderbuffer(n.__webglDepthbuffer[t]);
		}
		else {
			if (Array.isArray(n.__webglFramebuffer)) for (let t = 0; t < n.__webglFramebuffer.length; t++) e.deleteFramebuffer(n.__webglFramebuffer[t]);
			else e.deleteFramebuffer(n.__webglFramebuffer);
			if (n.__webglDepthbuffer && e.deleteRenderbuffer(n.__webglDepthbuffer), n.__webglMultisampledFramebuffer && e.deleteFramebuffer(n.__webglMultisampledFramebuffer), n.__webglColorRenderbuffer) for (let t = 0; t < n.__webglColorRenderbuffer.length; t++) n.__webglColorRenderbuffer[t] && e.deleteRenderbuffer(n.__webglColorRenderbuffer[t]);
			n.__webglDepthRenderbuffer && e.deleteRenderbuffer(n.__webglDepthRenderbuffer);
		}
		let i = t.textures;
		for (let t = 0, n = i.length; t < n; t++) {
			let n = r.get(i[t]);
			n.__webglTexture && (e.deleteTexture(n.__webglTexture), o.memory.textures--), r.remove(i[t]);
		}
		r.remove(t);
	}
	let O = 0;
	function k() {
		O = 0;
	}
	function A() {
		return O;
	}
	function ee(e) {
		O = e;
	}
	function te() {
		let e = O;
		return e >= i.maxTextures && R("WebGLTextures: Trying to use " + e + " texture units while this GPU supports only " + i.maxTextures), O += 1, e;
	}
	function j(e) {
		let t = [];
		return t.push(e.wrapS), t.push(e.wrapT), t.push(e.wrapR || 0), t.push(e.magFilter), t.push(e.minFilter), t.push(e.anisotropy), t.push(e.internalFormat), t.push(e.format), t.push(e.type), t.push(e.generateMipmaps), t.push(e.premultiplyAlpha), t.push(e.flipY), t.push(e.unpackAlignment), t.push(e.colorSpace), t.join();
	}
	function ne(t, i) {
		let a = r.get(t);
		if (t.isVideoTexture && we(t), t.isRenderTargetTexture === !1 && t.isExternalTexture !== !0 && t.version > 0 && a.__version !== t.version) {
			let e = t.image;
			if (e === null) R("WebGLRenderer: Texture marked for update but no image data found.");
			else if (e.complete === !1) R("WebGLRenderer: Texture marked for update but image is incomplete");
			else {
				de(a, t, i);
				return;
			}
		} else t.isExternalTexture && (a.__webglTexture = t.sourceTexture ? t.sourceTexture : null);
		n.bindTexture(e.TEXTURE_2D, a.__webglTexture, e.TEXTURE0 + i);
	}
	function re(t, i) {
		let a = r.get(t);
		if (t.isRenderTargetTexture === !1 && t.version > 0 && a.__version !== t.version) {
			de(a, t, i);
			return;
		} else t.isExternalTexture && (a.__webglTexture = t.sourceTexture ? t.sourceTexture : null);
		n.bindTexture(e.TEXTURE_2D_ARRAY, a.__webglTexture, e.TEXTURE0 + i);
	}
	function M(t, i) {
		let a = r.get(t);
		if (t.isRenderTargetTexture === !1 && t.version > 0 && a.__version !== t.version) {
			de(a, t, i);
			return;
		}
		n.bindTexture(e.TEXTURE_3D, a.__webglTexture, e.TEXTURE0 + i);
	}
	function ie(t, i) {
		let a = r.get(t);
		if (t.isCubeDepthTexture !== !0 && t.version > 0 && a.__version !== t.version) {
			fe(a, t, i);
			return;
		}
		n.bindTexture(e.TEXTURE_CUBE_MAP, a.__webglTexture, e.TEXTURE0 + i);
	}
	let ae = {
		[Ke]: e.REPEAT,
		[qe]: e.CLAMP_TO_EDGE,
		[Je]: e.MIRRORED_REPEAT
	}, oe = {
		[Ye]: e.NEAREST,
		[Xe]: e.NEAREST_MIPMAP_NEAREST,
		[Qe]: e.NEAREST_MIPMAP_LINEAR,
		[et]: e.LINEAR,
		[tt]: e.LINEAR_MIPMAP_NEAREST,
		[rt]: e.LINEAR_MIPMAP_LINEAR
	}, se = {
		512: e.NEVER,
		519: e.ALWAYS,
		513: e.LESS,
		515: e.LEQUAL,
		514: e.EQUAL,
		518: e.GEQUAL,
		516: e.GREATER,
		517: e.NOTEQUAL
	};
	function N(n, a) {
		if (a.type === 1015 && t.has("OES_texture_float_linear") === !1 && (a.magFilter === 1006 || a.magFilter === 1007 || a.magFilter === 1005 || a.magFilter === 1008 || a.minFilter === 1006 || a.minFilter === 1007 || a.minFilter === 1005 || a.minFilter === 1008) && R("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."), e.texParameteri(n, e.TEXTURE_WRAP_S, ae[a.wrapS]), e.texParameteri(n, e.TEXTURE_WRAP_T, ae[a.wrapT]), (n === e.TEXTURE_3D || n === e.TEXTURE_2D_ARRAY) && e.texParameteri(n, e.TEXTURE_WRAP_R, ae[a.wrapR]), e.texParameteri(n, e.TEXTURE_MAG_FILTER, oe[a.magFilter]), e.texParameteri(n, e.TEXTURE_MIN_FILTER, oe[a.minFilter]), a.compareFunction && (e.texParameteri(n, e.TEXTURE_COMPARE_MODE, e.COMPARE_REF_TO_TEXTURE), e.texParameteri(n, e.TEXTURE_COMPARE_FUNC, se[a.compareFunction])), t.has("EXT_texture_filter_anisotropic") === !0) {
			if (a.magFilter === 1003 || a.minFilter !== 1005 && a.minFilter !== 1008 || a.type === 1015 && t.has("OES_texture_float_linear") === !1) return;
			if (a.anisotropy > 1 || r.get(a).__currentAnisotropy) {
				let o = t.get("EXT_texture_filter_anisotropic");
				e.texParameterf(n, o.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(a.anisotropy, i.getMaxAnisotropy())), r.get(a).__currentAnisotropy = a.anisotropy;
			}
		}
	}
	function ce(t, n) {
		let r = !1;
		t.__webglInit === void 0 && (t.__webglInit = !0, n.addEventListener("dispose", C));
		let i = n.source, a = p.get(i);
		a === void 0 && (a = {}, p.set(i, a));
		let s = j(n);
		if (s !== t.__cacheKey) {
			a[s] === void 0 && (a[s] = {
				texture: e.createTexture(),
				usedTimes: 0
			}, o.memory.textures++, r = !0), a[s].usedTimes++;
			let i = a[t.__cacheKey];
			i !== void 0 && (a[t.__cacheKey].usedTimes--, i.usedTimes === 0 && E(n)), t.__cacheKey = s, t.__webglTexture = a[s].texture;
		}
		return r;
	}
	function le(e, t, n) {
		return Math.floor(Math.floor(e / n) / t);
	}
	function ue(t, r, i, a) {
		let o = t.updateRanges;
		if (o.length === 0) n.texSubImage2D(e.TEXTURE_2D, 0, 0, 0, r.width, r.height, i, a, r.data);
		else {
			o.sort((e, t) => e.start - t.start);
			let s = 0;
			for (let e = 1; e < o.length; e++) {
				let t = o[s], n = o[e], i = t.start + t.count, a = le(n.start, r.width, 4), c = le(t.start, r.width, 4);
				n.start <= i + 1 && a === c && le(n.start + n.count - 1, r.width, 4) === a ? t.count = Math.max(t.count, n.start + n.count - t.start) : (++s, o[s] = n);
			}
			o.length = s + 1;
			let c = n.getParameter(e.UNPACK_ROW_LENGTH), l = n.getParameter(e.UNPACK_SKIP_PIXELS), u = n.getParameter(e.UNPACK_SKIP_ROWS);
			n.pixelStorei(e.UNPACK_ROW_LENGTH, r.width);
			for (let t = 0, s = o.length; t < s; t++) {
				let s = o[t], c = Math.floor(s.start / 4), l = Math.ceil(s.count / 4), u = c % r.width, d = Math.floor(c / r.width), f = l;
				n.pixelStorei(e.UNPACK_SKIP_PIXELS, u), n.pixelStorei(e.UNPACK_SKIP_ROWS, d), n.texSubImage2D(e.TEXTURE_2D, 0, u, d, f, 1, i, a, r.data);
			}
			t.clearUpdateRanges(), n.pixelStorei(e.UNPACK_ROW_LENGTH, c), n.pixelStorei(e.UNPACK_SKIP_PIXELS, l), n.pixelStorei(e.UNPACK_SKIP_ROWS, u);
		}
	}
	function de(t, o, s) {
		let c = e.TEXTURE_2D;
		(o.isDataArrayTexture || o.isCompressedArrayTexture) && (c = e.TEXTURE_2D_ARRAY), o.isData3DTexture && (c = e.TEXTURE_3D);
		let l = ce(t, o), u = o.source;
		n.bindTexture(c, t.__webglTexture, e.TEXTURE0 + s);
		let f = r.get(u);
		if (u.version !== f.__version || l === !0) {
			if (n.activeTexture(e.TEXTURE0 + s), !(typeof ImageBitmap < "u" && o.image instanceof ImageBitmap)) {
				let t = G.getPrimaries(G.workingColorSpace), r = o.colorSpace === "" ? null : G.getPrimaries(o.colorSpace), i = o.colorSpace === "" || t === r ? e.NONE : e.BROWSER_DEFAULT_WEBGL;
				n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL, o.flipY), n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL, o.premultiplyAlpha), n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL, i);
			}
			n.pixelStorei(e.UNPACK_ALIGNMENT, o.unpackAlignment);
			let t = g(o.image, !1, i.maxTextureSize);
			t = Te(o, t);
			let r = a.convert(o.format, o.colorSpace), p = a.convert(o.type), m = b(o.internalFormat, r, p, o.normalized, o.colorSpace, o.isVideoTexture);
			N(c, o);
			let h, y = o.mipmaps, C = o.isVideoTexture !== !0, w = f.__version === void 0 || l === !0, T = u.dataReady, E = S(o, t);
			if (o.isDepthTexture) m = x(o.format === St, o.type), w && (C ? n.texStorage2D(e.TEXTURE_2D, 1, m, t.width, t.height) : n.texImage2D(e.TEXTURE_2D, 0, m, t.width, t.height, 0, r, p, null));
			else if (o.isDataTexture) if (y.length > 0) {
				C && w && n.texStorage2D(e.TEXTURE_2D, E, m, y[0].width, y[0].height);
				for (let t = 0, i = y.length; t < i; t++) h = y[t], C ? T && n.texSubImage2D(e.TEXTURE_2D, t, 0, 0, h.width, h.height, r, p, h.data) : n.texImage2D(e.TEXTURE_2D, t, m, h.width, h.height, 0, r, p, h.data);
				o.generateMipmaps = !1;
			} else C ? (w && n.texStorage2D(e.TEXTURE_2D, E, m, t.width, t.height), T && ue(o, t, r, p)) : n.texImage2D(e.TEXTURE_2D, 0, m, t.width, t.height, 0, r, p, t.data);
			else if (o.isCompressedTexture) if (o.isCompressedArrayTexture) {
				C && w && n.texStorage3D(e.TEXTURE_2D_ARRAY, E, m, y[0].width, y[0].height, t.depth);
				for (let i = 0, a = y.length; i < a; i++) if (h = y[i], o.format !== 1023) if (r !== null) if (C) {
					if (T) if (o.layerUpdates.size > 0) {
						let t = Zp(h.width, h.height, o.format, o.type);
						for (let a of o.layerUpdates) {
							let o = h.data.subarray(a * t / h.data.BYTES_PER_ELEMENT, (a + 1) * t / h.data.BYTES_PER_ELEMENT);
							n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY, i, 0, 0, a, h.width, h.height, 1, r, o);
						}
						o.clearLayerUpdates();
					} else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY, i, 0, 0, 0, h.width, h.height, t.depth, r, h.data);
				} else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY, i, m, h.width, h.height, t.depth, 0, h.data, 0, 0);
				else R("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");
				else C ? T && n.texSubImage3D(e.TEXTURE_2D_ARRAY, i, 0, 0, 0, h.width, h.height, t.depth, r, p, h.data) : n.texImage3D(e.TEXTURE_2D_ARRAY, i, m, h.width, h.height, t.depth, 0, r, p, h.data);
			} else {
				C && w && n.texStorage2D(e.TEXTURE_2D, E, m, y[0].width, y[0].height);
				for (let t = 0, i = y.length; t < i; t++) h = y[t], o.format === 1023 ? C ? T && n.texSubImage2D(e.TEXTURE_2D, t, 0, 0, h.width, h.height, r, p, h.data) : n.texImage2D(e.TEXTURE_2D, t, m, h.width, h.height, 0, r, p, h.data) : r === null ? R("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()") : C ? T && n.compressedTexSubImage2D(e.TEXTURE_2D, t, 0, 0, h.width, h.height, r, h.data) : n.compressedTexImage2D(e.TEXTURE_2D, t, m, h.width, h.height, 0, h.data);
			}
			else if (o.isDataArrayTexture) if (C) {
				if (w && n.texStorage3D(e.TEXTURE_2D_ARRAY, E, m, t.width, t.height, t.depth), T) if (o.layerUpdates.size > 0) {
					let i = Zp(t.width, t.height, o.format, o.type);
					for (let a of o.layerUpdates) {
						let o = t.data.subarray(a * i / t.data.BYTES_PER_ELEMENT, (a + 1) * i / t.data.BYTES_PER_ELEMENT);
						n.texSubImage3D(e.TEXTURE_2D_ARRAY, 0, 0, 0, a, t.width, t.height, 1, r, p, o);
					}
					o.clearLayerUpdates();
				} else n.texSubImage3D(e.TEXTURE_2D_ARRAY, 0, 0, 0, 0, t.width, t.height, t.depth, r, p, t.data);
			} else n.texImage3D(e.TEXTURE_2D_ARRAY, 0, m, t.width, t.height, t.depth, 0, r, p, t.data);
			else if (o.isData3DTexture) C ? (w && n.texStorage3D(e.TEXTURE_3D, E, m, t.width, t.height, t.depth), T && n.texSubImage3D(e.TEXTURE_3D, 0, 0, 0, 0, t.width, t.height, t.depth, r, p, t.data)) : n.texImage3D(e.TEXTURE_3D, 0, m, t.width, t.height, t.depth, 0, r, p, t.data);
			else if (o.isFramebufferTexture) {
				if (w) if (C) n.texStorage2D(e.TEXTURE_2D, E, m, t.width, t.height);
				else {
					let i = t.width, a = t.height;
					for (let t = 0; t < E; t++) n.texImage2D(e.TEXTURE_2D, t, m, i, a, 0, r, p, null), i >>= 1, a >>= 1;
				}
			} else if (o.isHTMLTexture) {
				if ("texElementImage2D" in e) {
					let n = e.canvas;
					if (n.hasAttribute("layoutsubtree") || n.setAttribute("layoutsubtree", "true"), t.parentNode !== n) {
						n.appendChild(t), d.add(o), n.onpaint = (e) => {
							let t = e.changedElements;
							for (let e of d) t.includes(e.image) && (e.needsUpdate = !0);
						}, n.requestPaint();
						return;
					}
					if (e.texElementImage2D.length === 3) e.texElementImage2D(e.TEXTURE_2D, e.RGBA8, t);
					else {
						let n = e.RGBA, r = e.RGBA, i = e.UNSIGNED_BYTE;
						e.texElementImage2D(e.TEXTURE_2D, 0, n, r, i, t);
					}
					e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE);
				}
			} else if (y.length > 0) {
				if (C && w) {
					let t = Ee(y[0]);
					n.texStorage2D(e.TEXTURE_2D, E, m, t.width, t.height);
				}
				for (let t = 0, i = y.length; t < i; t++) h = y[t], C ? T && n.texSubImage2D(e.TEXTURE_2D, t, 0, 0, r, p, h) : n.texImage2D(e.TEXTURE_2D, t, m, r, p, h);
				o.generateMipmaps = !1;
			} else if (C) {
				if (w) {
					let r = Ee(t);
					n.texStorage2D(e.TEXTURE_2D, E, m, r.width, r.height);
				}
				T && n.texSubImage2D(e.TEXTURE_2D, 0, 0, 0, r, p, t);
			} else n.texImage2D(e.TEXTURE_2D, 0, m, r, p, t);
			_(o) && v(c), f.__version = u.version, o.onUpdate && o.onUpdate(o);
		}
		t.__version = o.version;
	}
	function fe(t, o, s) {
		if (o.image.length !== 6) return;
		let c = ce(t, o), l = o.source;
		n.bindTexture(e.TEXTURE_CUBE_MAP, t.__webglTexture, e.TEXTURE0 + s);
		let u = r.get(l);
		if (l.version !== u.__version || c === !0) {
			n.activeTexture(e.TEXTURE0 + s);
			let t = G.getPrimaries(G.workingColorSpace), r = o.colorSpace === "" ? null : G.getPrimaries(o.colorSpace), d = o.colorSpace === "" || t === r ? e.NONE : e.BROWSER_DEFAULT_WEBGL;
			n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL, o.flipY), n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL, o.premultiplyAlpha), n.pixelStorei(e.UNPACK_ALIGNMENT, o.unpackAlignment), n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL, d);
			let f = o.isCompressedTexture || o.image[0].isCompressedTexture, p = o.image[0] && o.image[0].isDataTexture, m = [];
			for (let e = 0; e < 6; e++) !f && !p ? m[e] = g(o.image[e], !0, i.maxCubemapSize) : m[e] = p ? o.image[e].image : o.image[e], m[e] = Te(o, m[e]);
			let h = m[0], y = a.convert(o.format, o.colorSpace), x = a.convert(o.type), C = b(o.internalFormat, y, x, o.normalized, o.colorSpace), w = o.isVideoTexture !== !0, T = u.__version === void 0 || c === !0, E = l.dataReady, D = S(o, h);
			N(e.TEXTURE_CUBE_MAP, o);
			let O;
			if (f) {
				w && T && n.texStorage2D(e.TEXTURE_CUBE_MAP, D, C, h.width, h.height);
				for (let t = 0; t < 6; t++) {
					O = m[t].mipmaps;
					for (let r = 0; r < O.length; r++) {
						let i = O[r];
						o.format === 1023 ? w ? E && n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r, 0, 0, i.width, i.height, y, x, i.data) : n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r, C, i.width, i.height, 0, y, x, i.data) : y === null ? R("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()") : w ? E && n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r, 0, 0, i.width, i.height, y, i.data) : n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r, C, i.width, i.height, 0, i.data);
					}
				}
			} else {
				if (O = o.mipmaps, w && T) {
					O.length > 0 && D++;
					let t = Ee(m[0]);
					n.texStorage2D(e.TEXTURE_CUBE_MAP, D, C, t.width, t.height);
				}
				for (let t = 0; t < 6; t++) if (p) {
					w ? E && n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, 0, 0, 0, m[t].width, m[t].height, y, x, m[t].data) : n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, 0, C, m[t].width, m[t].height, 0, y, x, m[t].data);
					for (let r = 0; r < O.length; r++) {
						let i = O[r].image[t].image;
						w ? E && n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r + 1, 0, 0, i.width, i.height, y, x, i.data) : n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r + 1, C, i.width, i.height, 0, y, x, i.data);
					}
				} else {
					w ? E && n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, 0, 0, 0, y, x, m[t]) : n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, 0, C, y, x, m[t]);
					for (let r = 0; r < O.length; r++) {
						let i = O[r];
						w ? E && n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r + 1, 0, 0, y, x, i.image[t]) : n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + t, r + 1, C, y, x, i.image[t]);
					}
				}
			}
			_(o) && v(e.TEXTURE_CUBE_MAP), u.__version = l.version, o.onUpdate && o.onUpdate(o);
		}
		t.__version = o.version;
	}
	function pe(t, i, o, c, l, u) {
		let d = a.convert(o.format, o.colorSpace), f = a.convert(o.type), p = b(o.internalFormat, d, f, o.normalized, o.colorSpace), m = r.get(i), h = r.get(o);
		if (h.__renderTarget = i, !m.__hasExternalTextures) {
			let t = Math.max(1, i.width >> u), r = Math.max(1, i.height >> u);
			l === e.TEXTURE_3D || l === e.TEXTURE_2D_ARRAY ? n.texImage3D(l, u, p, t, r, i.depth, 0, d, f, null) : n.texImage2D(l, u, p, t, r, 0, d, f, null);
		}
		n.bindFramebuffer(e.FRAMEBUFFER, t), P(i) ? s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER, c, l, h.__webglTexture, 0, Ce(i)) : (l === e.TEXTURE_2D || l >= e.TEXTURE_CUBE_MAP_POSITIVE_X && l <= e.TEXTURE_CUBE_MAP_NEGATIVE_Z) && e.framebufferTexture2D(e.FRAMEBUFFER, c, l, h.__webglTexture, u), n.bindFramebuffer(e.FRAMEBUFFER, null);
	}
	function me(t, n, r) {
		if (e.bindRenderbuffer(e.RENDERBUFFER, t), n.depthBuffer) {
			let i = n.depthTexture, a = i && i.isDepthTexture ? i.type : null, o = x(n.stencilBuffer, a), c = n.stencilBuffer ? e.DEPTH_STENCIL_ATTACHMENT : e.DEPTH_ATTACHMENT;
			P(n) ? s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER, Ce(n), o, n.width, n.height) : r ? e.renderbufferStorageMultisample(e.RENDERBUFFER, Ce(n), o, n.width, n.height) : e.renderbufferStorage(e.RENDERBUFFER, o, n.width, n.height), e.framebufferRenderbuffer(e.FRAMEBUFFER, c, e.RENDERBUFFER, t);
		} else {
			let t = n.textures;
			for (let i = 0; i < t.length; i++) {
				let o = t[i], c = a.convert(o.format, o.colorSpace), l = a.convert(o.type), u = b(o.internalFormat, c, l, o.normalized, o.colorSpace);
				P(n) ? s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER, Ce(n), u, n.width, n.height) : r ? e.renderbufferStorageMultisample(e.RENDERBUFFER, Ce(n), u, n.width, n.height) : e.renderbufferStorage(e.RENDERBUFFER, u, n.width, n.height);
			}
		}
		e.bindRenderbuffer(e.RENDERBUFFER, null);
	}
	function he(t, i, o) {
		let c = i.isWebGLCubeRenderTarget === !0;
		if (n.bindFramebuffer(e.FRAMEBUFFER, t), !(i.depthTexture && i.depthTexture.isDepthTexture)) throw Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");
		let l = r.get(i.depthTexture);
		if (l.__renderTarget = i, (!l.__webglTexture || i.depthTexture.image.width !== i.width || i.depthTexture.image.height !== i.height) && (i.depthTexture.image.width = i.width, i.depthTexture.image.height = i.height, i.depthTexture.needsUpdate = !0), c) {
			if (l.__webglInit === void 0 && (l.__webglInit = !0, i.depthTexture.addEventListener("dispose", C)), l.__webglTexture === void 0) {
				l.__webglTexture = e.createTexture(), n.bindTexture(e.TEXTURE_CUBE_MAP, l.__webglTexture), N(e.TEXTURE_CUBE_MAP, i.depthTexture);
				let t = a.convert(i.depthTexture.format), r = a.convert(i.depthTexture.type), o;
				i.depthTexture.format === 1026 ? o = e.DEPTH_COMPONENT24 : i.depthTexture.format === 1027 && (o = e.DEPTH24_STENCIL8);
				for (let n = 0; n < 6; n++) e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X + n, 0, o, i.width, i.height, 0, t, r, null);
			}
		} else ne(i.depthTexture, 0);
		let u = l.__webglTexture, d = Ce(i), f = c ? e.TEXTURE_CUBE_MAP_POSITIVE_X + o : e.TEXTURE_2D, p = i.depthTexture.format === 1027 ? e.DEPTH_STENCIL_ATTACHMENT : e.DEPTH_ATTACHMENT;
		if (i.depthTexture.format === 1026) P(i) ? s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER, p, f, u, 0, d) : e.framebufferTexture2D(e.FRAMEBUFFER, p, f, u, 0);
		else if (i.depthTexture.format === 1027) P(i) ? s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER, p, f, u, 0, d) : e.framebufferTexture2D(e.FRAMEBUFFER, p, f, u, 0);
		else throw Error("THREE.WebGLTextures: Unknown depthTexture format.");
	}
	function ge(t) {
		let i = r.get(t), a = t.isWebGLCubeRenderTarget === !0;
		if (i.__boundDepthTexture !== t.depthTexture) {
			let e = t.depthTexture;
			if (i.__depthDisposeCallback && i.__depthDisposeCallback(), e) {
				let t = () => {
					delete i.__boundDepthTexture, delete i.__depthDisposeCallback, e.removeEventListener("dispose", t);
				};
				e.addEventListener("dispose", t), i.__depthDisposeCallback = t;
			}
			i.__boundDepthTexture = e;
		}
		if (t.depthTexture && !i.__autoAllocateDepthBuffer) if (a) for (let e = 0; e < 6; e++) he(i.__webglFramebuffer[e], t, e);
		else {
			let e = t.texture.mipmaps;
			e && e.length > 0 ? he(i.__webglFramebuffer[0], t, 0) : he(i.__webglFramebuffer, t, 0);
		}
		else if (a) {
			i.__webglDepthbuffer = [];
			for (let r = 0; r < 6; r++) if (n.bindFramebuffer(e.FRAMEBUFFER, i.__webglFramebuffer[r]), i.__webglDepthbuffer[r] === void 0) i.__webglDepthbuffer[r] = e.createRenderbuffer(), me(i.__webglDepthbuffer[r], t, !1);
			else {
				let n = t.stencilBuffer ? e.DEPTH_STENCIL_ATTACHMENT : e.DEPTH_ATTACHMENT, a = i.__webglDepthbuffer[r];
				e.bindRenderbuffer(e.RENDERBUFFER, a), e.framebufferRenderbuffer(e.FRAMEBUFFER, n, e.RENDERBUFFER, a);
			}
		} else {
			let r = t.texture.mipmaps;
			if (r && r.length > 0 ? n.bindFramebuffer(e.FRAMEBUFFER, i.__webglFramebuffer[0]) : n.bindFramebuffer(e.FRAMEBUFFER, i.__webglFramebuffer), i.__webglDepthbuffer === void 0) i.__webglDepthbuffer = e.createRenderbuffer(), me(i.__webglDepthbuffer, t, !1);
			else {
				let n = t.stencilBuffer ? e.DEPTH_STENCIL_ATTACHMENT : e.DEPTH_ATTACHMENT, r = i.__webglDepthbuffer;
				e.bindRenderbuffer(e.RENDERBUFFER, r), e.framebufferRenderbuffer(e.FRAMEBUFFER, n, e.RENDERBUFFER, r);
			}
		}
		n.bindFramebuffer(e.FRAMEBUFFER, null);
	}
	function _e(t, n, i) {
		let a = r.get(t);
		n !== void 0 && pe(a.__webglFramebuffer, t, t.texture, e.COLOR_ATTACHMENT0, e.TEXTURE_2D, 0), i !== void 0 && ge(t);
	}
	function ve(t) {
		let i = t.texture, s = r.get(t), c = r.get(i);
		t.addEventListener("dispose", w);
		let l = t.textures, u = t.isWebGLCubeRenderTarget === !0, d = l.length > 1;
		if (d || (c.__webglTexture === void 0 && (c.__webglTexture = e.createTexture()), c.__version = i.version, o.memory.textures++), u) {
			s.__webglFramebuffer = [];
			for (let t = 0; t < 6; t++) if (i.mipmaps && i.mipmaps.length > 0) {
				s.__webglFramebuffer[t] = [];
				for (let n = 0; n < i.mipmaps.length; n++) s.__webglFramebuffer[t][n] = e.createFramebuffer();
			} else s.__webglFramebuffer[t] = e.createFramebuffer();
		} else {
			if (i.mipmaps && i.mipmaps.length > 0) {
				s.__webglFramebuffer = [];
				for (let t = 0; t < i.mipmaps.length; t++) s.__webglFramebuffer[t] = e.createFramebuffer();
			} else s.__webglFramebuffer = e.createFramebuffer();
			if (d) for (let t = 0, n = l.length; t < n; t++) {
				let n = r.get(l[t]);
				n.__webglTexture === void 0 && (n.__webglTexture = e.createTexture(), o.memory.textures++);
			}
			if (t.samples > 0 && P(t) === !1) {
				s.__webglMultisampledFramebuffer = e.createFramebuffer(), s.__webglColorRenderbuffer = [], n.bindFramebuffer(e.FRAMEBUFFER, s.__webglMultisampledFramebuffer);
				for (let n = 0; n < l.length; n++) {
					let r = l[n];
					s.__webglColorRenderbuffer[n] = e.createRenderbuffer(), e.bindRenderbuffer(e.RENDERBUFFER, s.__webglColorRenderbuffer[n]);
					let i = a.convert(r.format, r.colorSpace), o = a.convert(r.type), c = b(r.internalFormat, i, o, r.normalized, r.colorSpace, t.isXRRenderTarget === !0), u = Ce(t);
					e.renderbufferStorageMultisample(e.RENDERBUFFER, u, c, t.width, t.height), e.framebufferRenderbuffer(e.FRAMEBUFFER, e.COLOR_ATTACHMENT0 + n, e.RENDERBUFFER, s.__webglColorRenderbuffer[n]);
				}
				e.bindRenderbuffer(e.RENDERBUFFER, null), t.depthBuffer && (s.__webglDepthRenderbuffer = e.createRenderbuffer(), me(s.__webglDepthRenderbuffer, t, !0)), n.bindFramebuffer(e.FRAMEBUFFER, null);
			}
		}
		if (u) {
			n.bindTexture(e.TEXTURE_CUBE_MAP, c.__webglTexture), N(e.TEXTURE_CUBE_MAP, i);
			for (let n = 0; n < 6; n++) if (i.mipmaps && i.mipmaps.length > 0) for (let r = 0; r < i.mipmaps.length; r++) pe(s.__webglFramebuffer[n][r], t, i, e.COLOR_ATTACHMENT0, e.TEXTURE_CUBE_MAP_POSITIVE_X + n, r);
			else pe(s.__webglFramebuffer[n], t, i, e.COLOR_ATTACHMENT0, e.TEXTURE_CUBE_MAP_POSITIVE_X + n, 0);
			_(i) && v(e.TEXTURE_CUBE_MAP), n.unbindTexture();
		} else if (d) {
			for (let i = 0, a = l.length; i < a; i++) {
				let a = l[i], o = r.get(a), c = e.TEXTURE_2D;
				(t.isWebGL3DRenderTarget || t.isWebGLArrayRenderTarget) && (c = t.isWebGL3DRenderTarget ? e.TEXTURE_3D : e.TEXTURE_2D_ARRAY), n.bindTexture(c, o.__webglTexture), N(c, a), pe(s.__webglFramebuffer, t, a, e.COLOR_ATTACHMENT0 + i, c, 0), _(a) && v(c);
			}
			n.unbindTexture();
		} else {
			let r = e.TEXTURE_2D;
			if ((t.isWebGL3DRenderTarget || t.isWebGLArrayRenderTarget) && (r = t.isWebGL3DRenderTarget ? e.TEXTURE_3D : e.TEXTURE_2D_ARRAY), n.bindTexture(r, c.__webglTexture), N(r, i), i.mipmaps && i.mipmaps.length > 0) for (let n = 0; n < i.mipmaps.length; n++) pe(s.__webglFramebuffer[n], t, i, e.COLOR_ATTACHMENT0, r, n);
			else pe(s.__webglFramebuffer, t, i, e.COLOR_ATTACHMENT0, r, 0);
			_(i) && v(r), n.unbindTexture();
		}
		t.depthBuffer && ge(t);
	}
	function ye(e) {
		let t = e.textures;
		for (let i = 0, a = t.length; i < a; i++) {
			let a = t[i];
			if (_(a)) {
				let t = y(e), i = r.get(a).__webglTexture;
				n.bindTexture(t, i), v(t), n.unbindTexture();
			}
		}
	}
	let be = [], xe = [];
	function Se(t) {
		if (t.samples > 0) {
			if (P(t) === !1) {
				let i = t.textures, a = t.width, o = t.height, s = e.COLOR_BUFFER_BIT, l = t.stencilBuffer ? e.DEPTH_STENCIL_ATTACHMENT : e.DEPTH_ATTACHMENT, u = r.get(t), d = i.length > 1;
				if (d) for (let t = 0; t < i.length; t++) n.bindFramebuffer(e.FRAMEBUFFER, u.__webglMultisampledFramebuffer), e.framebufferRenderbuffer(e.FRAMEBUFFER, e.COLOR_ATTACHMENT0 + t, e.RENDERBUFFER, null), n.bindFramebuffer(e.FRAMEBUFFER, u.__webglFramebuffer), e.framebufferTexture2D(e.DRAW_FRAMEBUFFER, e.COLOR_ATTACHMENT0 + t, e.TEXTURE_2D, null, 0);
				n.bindFramebuffer(e.READ_FRAMEBUFFER, u.__webglMultisampledFramebuffer);
				let f = t.texture.mipmaps;
				f && f.length > 0 ? n.bindFramebuffer(e.DRAW_FRAMEBUFFER, u.__webglFramebuffer[0]) : n.bindFramebuffer(e.DRAW_FRAMEBUFFER, u.__webglFramebuffer);
				for (let n = 0; n < i.length; n++) {
					if (t.resolveDepthBuffer && (t.depthBuffer && (s |= e.DEPTH_BUFFER_BIT), t.stencilBuffer && t.resolveStencilBuffer && (s |= e.STENCIL_BUFFER_BIT)), d) {
						e.framebufferRenderbuffer(e.READ_FRAMEBUFFER, e.COLOR_ATTACHMENT0, e.RENDERBUFFER, u.__webglColorRenderbuffer[n]);
						let t = r.get(i[n]).__webglTexture;
						e.framebufferTexture2D(e.DRAW_FRAMEBUFFER, e.COLOR_ATTACHMENT0, e.TEXTURE_2D, t, 0);
					}
					e.blitFramebuffer(0, 0, a, o, 0, 0, a, o, s, e.NEAREST), c === !0 && (be.length = 0, xe.length = 0, be.push(e.COLOR_ATTACHMENT0 + n), t.depthBuffer && t.resolveDepthBuffer === !1 && (be.push(l), xe.push(l), e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER, xe)), e.invalidateFramebuffer(e.READ_FRAMEBUFFER, be));
				}
				if (n.bindFramebuffer(e.READ_FRAMEBUFFER, null), n.bindFramebuffer(e.DRAW_FRAMEBUFFER, null), d) for (let t = 0; t < i.length; t++) {
					n.bindFramebuffer(e.FRAMEBUFFER, u.__webglMultisampledFramebuffer), e.framebufferRenderbuffer(e.FRAMEBUFFER, e.COLOR_ATTACHMENT0 + t, e.RENDERBUFFER, u.__webglColorRenderbuffer[t]);
					let a = r.get(i[t]).__webglTexture;
					n.bindFramebuffer(e.FRAMEBUFFER, u.__webglFramebuffer), e.framebufferTexture2D(e.DRAW_FRAMEBUFFER, e.COLOR_ATTACHMENT0 + t, e.TEXTURE_2D, a, 0);
				}
				n.bindFramebuffer(e.DRAW_FRAMEBUFFER, u.__webglMultisampledFramebuffer);
			} else if (t.depthBuffer && t.resolveDepthBuffer === !1 && c) {
				let n = t.stencilBuffer ? e.DEPTH_STENCIL_ATTACHMENT : e.DEPTH_ATTACHMENT;
				e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER, [n]);
			}
		}
	}
	function Ce(e) {
		return Math.min(i.maxSamples, e.samples);
	}
	function P(e) {
		let n = r.get(e);
		return e.samples > 0 && t.has("WEBGL_multisampled_render_to_texture") === !0 && n.__useRenderToTexture !== !1;
	}
	function we(e) {
		let t = o.render.frame;
		u.get(e) !== t && (u.set(e, t), e.update());
	}
	function Te(e, t) {
		let n = e.colorSpace, r = e.format, i = e.type;
		return e.isCompressedTexture === !0 || e.isVideoTexture === !0 || n !== "srgb-linear" && n !== "" && (G.getTransfer(n) === "srgb" ? (r !== 1023 || i !== 1009) && R("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.") : z("WebGLTextures: Unsupported texture color space:", n)), t;
	}
	function Ee(e) {
		return typeof HTMLImageElement < "u" && e instanceof HTMLImageElement ? (l.width = e.naturalWidth || e.width, l.height = e.naturalHeight || e.height) : typeof VideoFrame < "u" && e instanceof VideoFrame ? (l.width = e.displayWidth, l.height = e.displayHeight) : (l.width = e.width, l.height = e.height), l;
	}
	this.allocateTextureUnit = te, this.resetTextureUnits = k, this.getTextureUnits = A, this.setTextureUnits = ee, this.setTexture2D = ne, this.setTexture2DArray = re, this.setTexture3D = M, this.setTextureCube = ie, this.rebindTextures = _e, this.setupRenderTarget = ve, this.updateRenderTargetMipmap = ye, this.updateMultisampleRenderTarget = Se, this.setupDepthRenderbuffer = ge, this.setupFrameBufferTexture = pe, this.useMultisampledRTT = P, this.isReversedDepthBuffer = function() {
		return n.buffers.depth.getReversed();
	};
}
function i_(e, t) {
	function n(n, r = "") {
		let i, a = G.getTransfer(r);
		if (n === 1009) return e.UNSIGNED_BYTE;
		if (n === 1017) return e.UNSIGNED_SHORT_4_4_4_4;
		if (n === 1018) return e.UNSIGNED_SHORT_5_5_5_1;
		if (n === 35902) return e.UNSIGNED_INT_5_9_9_9_REV;
		if (n === 35899) return e.UNSIGNED_INT_10F_11F_11F_REV;
		if (n === 1010) return e.BYTE;
		if (n === 1011) return e.SHORT;
		if (n === 1012) return e.UNSIGNED_SHORT;
		if (n === 1013) return e.INT;
		if (n === 1014) return e.UNSIGNED_INT;
		if (n === 1015) return e.FLOAT;
		if (n === 1016) return e.HALF_FLOAT;
		if (n === 1021) return e.ALPHA;
		if (n === 1022) return e.RGB;
		if (n === 1023) return e.RGBA;
		if (n === 1026) return e.DEPTH_COMPONENT;
		if (n === 1027) return e.DEPTH_STENCIL;
		if (n === 1028) return e.RED;
		if (n === 1029) return e.RED_INTEGER;
		if (n === 1030) return e.RG;
		if (n === 1031) return e.RG_INTEGER;
		if (n === 1033) return e.RGBA_INTEGER;
		if (n === 33776 || n === 33777 || n === 33778 || n === 33779) if (a === "srgb") if (i = t.get("WEBGL_compressed_texture_s3tc_srgb"), i !== null) {
			if (n === 33776) return i.COMPRESSED_SRGB_S3TC_DXT1_EXT;
			if (n === 33777) return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;
			if (n === 33778) return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;
			if (n === 33779) return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT;
		} else return null;
		else if (i = t.get("WEBGL_compressed_texture_s3tc"), i !== null) {
			if (n === 33776) return i.COMPRESSED_RGB_S3TC_DXT1_EXT;
			if (n === 33777) return i.COMPRESSED_RGBA_S3TC_DXT1_EXT;
			if (n === 33778) return i.COMPRESSED_RGBA_S3TC_DXT3_EXT;
			if (n === 33779) return i.COMPRESSED_RGBA_S3TC_DXT5_EXT;
		} else return null;
		if (n === 35840 || n === 35841 || n === 35842 || n === 35843) if (i = t.get("WEBGL_compressed_texture_pvrtc"), i !== null) {
			if (n === 35840) return i.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;
			if (n === 35841) return i.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;
			if (n === 35842) return i.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;
			if (n === 35843) return i.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG;
		} else return null;
		if (n === 36196 || n === 37492 || n === 37496 || n === 37488 || n === 37489 || n === 37490 || n === 37491) if (i = t.get("WEBGL_compressed_texture_etc"), i !== null) {
			if (n === 36196 || n === 37492) return a === "srgb" ? i.COMPRESSED_SRGB8_ETC2 : i.COMPRESSED_RGB8_ETC2;
			if (n === 37496) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC : i.COMPRESSED_RGBA8_ETC2_EAC;
			if (n === 37488) return i.COMPRESSED_R11_EAC;
			if (n === 37489) return i.COMPRESSED_SIGNED_R11_EAC;
			if (n === 37490) return i.COMPRESSED_RG11_EAC;
			if (n === 37491) return i.COMPRESSED_SIGNED_RG11_EAC;
		} else return null;
		if (n === 37808 || n === 37809 || n === 37810 || n === 37811 || n === 37812 || n === 37813 || n === 37814 || n === 37815 || n === 37816 || n === 37817 || n === 37818 || n === 37819 || n === 37820 || n === 37821) if (i = t.get("WEBGL_compressed_texture_astc"), i !== null) {
			if (n === 37808) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR : i.COMPRESSED_RGBA_ASTC_4x4_KHR;
			if (n === 37809) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR : i.COMPRESSED_RGBA_ASTC_5x4_KHR;
			if (n === 37810) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR : i.COMPRESSED_RGBA_ASTC_5x5_KHR;
			if (n === 37811) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR : i.COMPRESSED_RGBA_ASTC_6x5_KHR;
			if (n === 37812) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR : i.COMPRESSED_RGBA_ASTC_6x6_KHR;
			if (n === 37813) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR : i.COMPRESSED_RGBA_ASTC_8x5_KHR;
			if (n === 37814) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR : i.COMPRESSED_RGBA_ASTC_8x6_KHR;
			if (n === 37815) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR : i.COMPRESSED_RGBA_ASTC_8x8_KHR;
			if (n === 37816) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR : i.COMPRESSED_RGBA_ASTC_10x5_KHR;
			if (n === 37817) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR : i.COMPRESSED_RGBA_ASTC_10x6_KHR;
			if (n === 37818) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR : i.COMPRESSED_RGBA_ASTC_10x8_KHR;
			if (n === 37819) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR : i.COMPRESSED_RGBA_ASTC_10x10_KHR;
			if (n === 37820) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR : i.COMPRESSED_RGBA_ASTC_12x10_KHR;
			if (n === 37821) return a === "srgb" ? i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR : i.COMPRESSED_RGBA_ASTC_12x12_KHR;
		} else return null;
		if (n === 36492 || n === 36494 || n === 36495) if (i = t.get("EXT_texture_compression_bptc"), i !== null) {
			if (n === 36492) return a === "srgb" ? i.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT : i.COMPRESSED_RGBA_BPTC_UNORM_EXT;
			if (n === 36494) return i.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;
			if (n === 36495) return i.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT;
		} else return null;
		if (n === 36283 || n === 36284 || n === 36285 || n === 36286) if (i = t.get("EXT_texture_compression_rgtc"), i !== null) {
			if (n === 36283) return i.COMPRESSED_RED_RGTC1_EXT;
			if (n === 36284) return i.COMPRESSED_SIGNED_RED_RGTC1_EXT;
			if (n === 36285) return i.COMPRESSED_RED_GREEN_RGTC2_EXT;
			if (n === 36286) return i.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT;
		} else return null;
		return n === 1020 ? e.UNSIGNED_INT_24_8 : e[n] === void 0 ? null : e[n];
	}
	return { convert: n };
}
var a_ = "\nvoid main() {\n\n	gl_Position = vec4( position, 1.0 );\n\n}", o_ = "\nuniform sampler2DArray depthColor;\nuniform float depthWidth;\nuniform float depthHeight;\n\nvoid main() {\n\n	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );\n\n	if ( coord.x >= 1.0 ) {\n\n		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;\n\n	} else {\n\n		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;\n\n	}\n\n}", s_ = class {
	constructor() {
		this.texture = null, this.mesh = null, this.depthNear = 0, this.depthFar = 0;
	}
	init(e, t) {
		if (this.texture === null) {
			let n = new Sc(e.texture);
			(e.depthNear !== t.depthNear || e.depthFar !== t.depthFar) && (this.depthNear = e.depthNear, this.depthFar = e.depthFar), this.texture = n;
		}
	}
	getMesh(e) {
		if (this.texture !== null && this.mesh === null) {
			let t = e.cameras[0].viewport, n = new Su({
				vertexShader: a_,
				fragmentShader: o_,
				uniforms: {
					depthColor: { value: this.texture },
					depthWidth: { value: t.z },
					depthHeight: { value: t.w }
				}
			});
			this.mesh = new Ho(new tu(20, 20), n);
		}
		return this.mesh;
	}
	reset() {
		this.texture = null, this.mesh = null;
	}
	getDepthTexture() {
		return this.texture;
	}
}, c_ = class extends gr {
	constructor(e, t) {
		super();
		let n = this, r = null, i = 1, a = null, o = "local-floor", s = 1, c = null, l = null, u = null, d = null, f = null, p = null, m = typeof XRWebGLBinding < "u", h = new s_(), g = {}, _ = t.getContextAttributes(), v = null, y = null, b = [], x = [], S = new H(), C = null, w = new jd();
		w.viewport = new ai();
		let T = new jd();
		T.viewport = new ai();
		let E = [w, T], D = new ff(), O = null, k = null;
		this.cameraAutoUpdate = !0, this.enabled = !1, this.isPresenting = !1, this.getController = function(e) {
			let t = b[e];
			return t === void 0 && (t = new Bi(), b[e] = t), t.getTargetRaySpace();
		}, this.getControllerGrip = function(e) {
			let t = b[e];
			return t === void 0 && (t = new Bi(), b[e] = t), t.getGripSpace();
		}, this.getHand = function(e) {
			let t = b[e];
			return t === void 0 && (t = new Bi(), b[e] = t), t.getHandSpace();
		};
		function A(e) {
			let t = x.indexOf(e.inputSource);
			if (t === -1) return;
			let n = b[t];
			n !== void 0 && (n.update(e.inputSource, e.frame, c || a), n.dispatchEvent({
				type: e.type,
				data: e.inputSource
			}));
		}
		function ee() {
			r.removeEventListener("select", A), r.removeEventListener("selectstart", A), r.removeEventListener("selectend", A), r.removeEventListener("squeeze", A), r.removeEventListener("squeezestart", A), r.removeEventListener("squeezeend", A), r.removeEventListener("end", ee), r.removeEventListener("inputsourceschange", te);
			for (let e = 0; e < b.length; e++) {
				let t = x[e];
				t !== null && (x[e] = null, b[e].disconnect(t));
			}
			O = null, k = null, h.reset();
			for (let e in g) delete g[e];
			e.setRenderTarget(v), f = null, d = null, u = null, r = null, y = null, se.stop(), n.isPresenting = !1, e.setPixelRatio(C), e.setSize(S.width, S.height, !1), n.dispatchEvent({ type: "sessionend" });
		}
		this.setFramebufferScaleFactor = function(e) {
			i = e, n.isPresenting === !0 && R("WebXRManager: Cannot change framebuffer scale while presenting.");
		}, this.setReferenceSpaceType = function(e) {
			o = e, n.isPresenting === !0 && R("WebXRManager: Cannot change reference space type while presenting.");
		}, this.getReferenceSpace = function() {
			return c || a;
		}, this.setReferenceSpace = function(e) {
			c = e;
		}, this.getBaseLayer = function() {
			return d === null ? f : d;
		}, this.getBinding = function() {
			return u === null && m && (u = new XRWebGLBinding(r, t)), u;
		}, this.getFrame = function() {
			return p;
		}, this.getSession = function() {
			return r;
		}, this.setSession = async function(l) {
			if (r = l, r !== null) {
				if (v = e.getRenderTarget(), r.addEventListener("select", A), r.addEventListener("selectstart", A), r.addEventListener("selectend", A), r.addEventListener("squeeze", A), r.addEventListener("squeezestart", A), r.addEventListener("squeezeend", A), r.addEventListener("end", ee), r.addEventListener("inputsourceschange", te), _.xrCompatible !== !0 && await t.makeXRCompatible(), C = e.getPixelRatio(), e.getSize(S), m && "createProjectionLayer" in XRWebGLBinding.prototype) {
					let n = null, a = null, o = null;
					_.depth && (o = _.stencil ? t.DEPTH24_STENCIL8 : t.DEPTH_COMPONENT24, n = _.stencil ? St : xt, a = _.stencil ? ht : ut);
					let s = {
						colorFormat: t.RGBA8,
						depthFormat: o,
						scaleFactor: i
					};
					u = this.getBinding(), d = u.createProjectionLayer(s), r.updateRenderState({ layers: [d] }), e.setPixelRatio(1), e.setSize(d.textureWidth, d.textureHeight, !1), y = new si(d.textureWidth, d.textureHeight, {
						format: bt,
						type: at,
						depthTexture: new bc(d.textureWidth, d.textureHeight, a, void 0, void 0, void 0, void 0, void 0, void 0, n),
						stencilBuffer: _.stencil,
						colorSpace: e.outputColorSpace,
						samples: _.antialias ? 4 : 0,
						resolveDepthBuffer: d.ignoreDepthValues === !1,
						resolveStencilBuffer: d.ignoreDepthValues === !1
					});
				} else {
					let n = {
						antialias: _.antialias,
						alpha: !0,
						depth: _.depth,
						stencil: _.stencil,
						framebufferScaleFactor: i
					};
					f = new XRWebGLLayer(r, t, n), r.updateRenderState({ baseLayer: f }), e.setPixelRatio(1), e.setSize(f.framebufferWidth, f.framebufferHeight, !1), y = new si(f.framebufferWidth, f.framebufferHeight, {
						format: bt,
						type: at,
						colorSpace: e.outputColorSpace,
						stencilBuffer: _.stencil,
						resolveDepthBuffer: f.ignoreDepthValues === !1,
						resolveStencilBuffer: f.ignoreDepthValues === !1
					});
				}
				y.isXRRenderTarget = !0, this.setFoveation(s), c = null, a = await r.requestReferenceSpace(o), se.setContext(r), se.start(), n.isPresenting = !0, n.dispatchEvent({ type: "sessionstart" });
			}
		}, this.getEnvironmentBlendMode = function() {
			if (r !== null) return r.environmentBlendMode;
		}, this.getDepthTexture = function() {
			return h.getDepthTexture();
		};
		function te(e) {
			for (let t = 0; t < e.removed.length; t++) {
				let n = e.removed[t], r = x.indexOf(n);
				r >= 0 && (x[r] = null, b[r].disconnect(n));
			}
			for (let t = 0; t < e.added.length; t++) {
				let n = e.added[t], r = x.indexOf(n);
				if (r === -1) {
					for (let e = 0; e < b.length; e++) if (e >= x.length) {
						x.push(n), r = e;
						break;
					} else if (x[e] === null) {
						x[e] = n, r = e;
						break;
					}
					if (r === -1) break;
				}
				let i = b[r];
				i && i.connect(n);
			}
		}
		let j = new U(), ne = new U();
		function re(e, t, n) {
			j.setFromMatrixPosition(t.matrixWorld), ne.setFromMatrixPosition(n.matrixWorld);
			let r = j.distanceTo(ne), i = t.projectionMatrix.elements, a = n.projectionMatrix.elements, o = i[14] / (i[10] - 1), s = i[14] / (i[10] + 1), c = (i[9] + 1) / i[5], l = (i[9] - 1) / i[5], u = (i[8] - 1) / i[0], d = (a[8] + 1) / a[0], f = o * u, p = o * d, m = r / (-u + d), h = m * -u;
			if (t.matrixWorld.decompose(e.position, e.quaternion, e.scale), e.translateX(h), e.translateZ(m), e.matrixWorld.compose(e.position, e.quaternion, e.scale), e.matrixWorldInverse.copy(e.matrixWorld).invert(), i[10] === -1) e.projectionMatrix.copy(t.projectionMatrix), e.projectionMatrixInverse.copy(t.projectionMatrixInverse);
			else {
				let t = o + m, n = s + m, i = f - h, a = p + (r - h), u = c * s / n * t, d = l * s / n * t;
				e.projectionMatrix.makePerspective(i, a, u, d, t, n), e.projectionMatrixInverse.copy(e.projectionMatrix).invert();
			}
		}
		function M(e, t) {
			t === null ? e.matrixWorld.copy(e.matrix) : e.matrixWorld.multiplyMatrices(t.matrixWorld, e.matrix), e.matrixWorldInverse.copy(e.matrixWorld).invert();
		}
		this.updateCamera = function(e) {
			if (r === null) return;
			let t = e.near, n = e.far;
			h.texture !== null && (h.depthNear > 0 && (t = h.depthNear), h.depthFar > 0 && (n = h.depthFar)), D.near = T.near = w.near = t, D.far = T.far = w.far = n, (O !== D.near || k !== D.far) && (r.updateRenderState({
				depthNear: D.near,
				depthFar: D.far
			}), O = D.near, k = D.far), D.layers.mask = e.layers.mask | 6, w.layers.mask = D.layers.mask & -5, T.layers.mask = D.layers.mask & -3;
			let i = e.parent, a = D.cameras;
			M(D, i);
			for (let e = 0; e < a.length; e++) M(a[e], i);
			a.length === 2 ? re(D, w, T) : D.projectionMatrix.copy(w.projectionMatrix), ie(e, D, i);
		};
		function ie(e, t, n) {
			n === null ? e.matrix.copy(t.matrixWorld) : (e.matrix.copy(n.matrixWorld), e.matrix.invert(), e.matrix.multiply(t.matrixWorld)), e.matrix.decompose(e.position, e.quaternion, e.scale), e.updateMatrixWorld(!0), e.projectionMatrix.copy(t.projectionMatrix), e.projectionMatrixInverse.copy(t.projectionMatrixInverse), e.isPerspectiveCamera && (e.fov = br * 2 * Math.atan(1 / e.projectionMatrix.elements[5]), e.zoom = 1);
		}
		this.getCamera = function() {
			return D;
		}, this.getFoveation = function() {
			if (!(d === null && f === null)) return s;
		}, this.setFoveation = function(e) {
			s = e, d !== null && (d.fixedFoveation = e), f !== null && f.fixedFoveation !== void 0 && (f.fixedFoveation = e);
		}, this.hasDepthSensing = function() {
			return h.texture !== null;
		}, this.getDepthSensingMesh = function() {
			return h.getMesh(D);
		}, this.getCameraTexture = function(e) {
			return g[e];
		};
		let ae = null;
		function oe(t, i) {
			if (l = i.getViewerPose(c || a), p = i, l !== null) {
				let t = l.views;
				f !== null && (e.setRenderTargetFramebuffer(y, f.framebuffer), e.setRenderTarget(y));
				let i = !1;
				t.length !== D.cameras.length && (D.cameras.length = 0, i = !0);
				for (let n = 0; n < t.length; n++) {
					let r = t[n], a = null;
					if (f !== null) a = f.getViewport(r);
					else {
						let t = u.getViewSubImage(d, r);
						a = t.viewport, n === 0 && (e.setRenderTargetTextures(y, t.colorTexture, t.depthStencilTexture), e.setRenderTarget(y));
					}
					let o = E[n];
					o === void 0 && (o = new jd(), o.layers.enable(n), o.viewport = new ai(), E[n] = o), o.matrix.fromArray(r.transform.matrix), o.matrix.decompose(o.position, o.quaternion, o.scale), o.projectionMatrix.fromArray(r.projectionMatrix), o.projectionMatrixInverse.copy(o.projectionMatrix).invert(), o.viewport.set(a.x, a.y, a.width, a.height), n === 0 && (D.matrix.copy(o.matrix), D.matrix.decompose(D.position, D.quaternion, D.scale)), i === !0 && D.cameras.push(o);
				}
				let a = r.enabledFeatures;
				if (a && a.includes("depth-sensing") && r.depthUsage == "gpu-optimized" && m) {
					u = n.getBinding();
					let e = u.getDepthInformation(t[0]);
					e && e.isValid && e.texture && h.init(e, r.renderState);
				}
				if (a && a.includes("camera-access") && m) {
					e.state.unbindTexture(), u = n.getBinding();
					for (let e = 0; e < t.length; e++) {
						let n = t[e].camera;
						if (n) {
							let e = g[n];
							e || (e = new Sc(), g[n] = e);
							let t = u.getCameraImage(n);
							e.sourceTexture = t;
						}
					}
				}
			}
			for (let e = 0; e < b.length; e++) {
				let t = x[e], n = b[e];
				t !== null && n !== void 0 && n.update(t, i, c || a);
			}
			ae && ae(t, i), i.detectedPlanes && n.dispatchEvent({
				type: "planesdetected",
				data: i
			}), p = null;
		}
		let se = new tm();
		se.setAnimationLoop(oe), this.setAnimationLoop = function(e) {
			ae = e;
		}, this.dispose = function() {};
	}
}, l_ = /*@__PURE__*/ new K(), u_ = /*@__PURE__*/ new W();
u_.set(-1, 0, 0, 0, 1, 0, 0, 0, 1);
function d_(e, t) {
	function n(e, t) {
		e.matrixAutoUpdate === !0 && e.updateMatrix(), t.value.copy(e.matrix);
	}
	function r(t, n) {
		n.color.getRGB(t.fogColor.value, vu(e)), n.isFog ? (t.fogNear.value = n.near, t.fogFar.value = n.far) : n.isFogExp2 && (t.fogDensity.value = n.density);
	}
	function i(e, t, n, r, i) {
		t.isNodeMaterial ? t.uniformsNeedUpdate = !1 : t.isMeshBasicMaterial ? a(e, t) : t.isMeshLambertMaterial ? (a(e, t), t.envMap && (e.envMapIntensity.value = t.envMapIntensity)) : t.isMeshToonMaterial ? (a(e, t), d(e, t)) : t.isMeshPhongMaterial ? (a(e, t), u(e, t), t.envMap && (e.envMapIntensity.value = t.envMapIntensity)) : t.isMeshStandardMaterial ? (a(e, t), f(e, t), t.isMeshPhysicalMaterial && p(e, t, i)) : t.isMeshMatcapMaterial ? (a(e, t), m(e, t)) : t.isMeshDepthMaterial ? a(e, t) : t.isMeshDistanceMaterial ? (a(e, t), h(e, t)) : t.isMeshNormalMaterial ? a(e, t) : t.isLineBasicMaterial ? (o(e, t), t.isLineDashedMaterial && s(e, t)) : t.isPointsMaterial ? c(e, t, n, r) : t.isSpriteMaterial ? l(e, t) : t.isShadowMaterial ? (e.color.value.copy(t.color), e.opacity.value = t.opacity) : t.isShaderMaterial && (t.uniformsNeedUpdate = !1);
	}
	function a(e, r) {
		e.opacity.value = r.opacity, r.color && e.diffuse.value.copy(r.color), r.emissive && e.emissive.value.copy(r.emissive).multiplyScalar(r.emissiveIntensity), r.map && (e.map.value = r.map, n(r.map, e.mapTransform)), r.alphaMap && (e.alphaMap.value = r.alphaMap, n(r.alphaMap, e.alphaMapTransform)), r.bumpMap && (e.bumpMap.value = r.bumpMap, n(r.bumpMap, e.bumpMapTransform), e.bumpScale.value = r.bumpScale, r.side === 1 && (e.bumpScale.value *= -1)), r.normalMap && (e.normalMap.value = r.normalMap, n(r.normalMap, e.normalMapTransform), e.normalScale.value.copy(r.normalScale), r.side === 1 && e.normalScale.value.negate()), r.displacementMap && (e.displacementMap.value = r.displacementMap, n(r.displacementMap, e.displacementMapTransform), e.displacementScale.value = r.displacementScale, e.displacementBias.value = r.displacementBias), r.emissiveMap && (e.emissiveMap.value = r.emissiveMap, n(r.emissiveMap, e.emissiveMapTransform)), r.specularMap && (e.specularMap.value = r.specularMap, n(r.specularMap, e.specularMapTransform)), r.alphaTest > 0 && (e.alphaTest.value = r.alphaTest);
		let i = t.get(r), a = i.envMap, o = i.envMapRotation;
		a && (e.envMap.value = a, e.envMapRotation.value.setFromMatrix4(l_.makeRotationFromEuler(o)).transpose(), a.isCubeTexture && a.isRenderTargetTexture === !1 && e.envMapRotation.value.premultiply(u_), e.reflectivity.value = r.reflectivity, e.ior.value = r.ior, e.refractionRatio.value = r.refractionRatio), r.lightMap && (e.lightMap.value = r.lightMap, e.lightMapIntensity.value = r.lightMapIntensity, n(r.lightMap, e.lightMapTransform)), r.aoMap && (e.aoMap.value = r.aoMap, e.aoMapIntensity.value = r.aoMapIntensity, n(r.aoMap, e.aoMapTransform));
	}
	function o(e, t) {
		e.diffuse.value.copy(t.color), e.opacity.value = t.opacity, t.map && (e.map.value = t.map, n(t.map, e.mapTransform));
	}
	function s(e, t) {
		e.dashSize.value = t.dashSize, e.totalSize.value = t.dashSize + t.gapSize, e.scale.value = t.scale;
	}
	function c(e, t, r, i) {
		e.diffuse.value.copy(t.color), e.opacity.value = t.opacity, e.size.value = t.size * r, e.scale.value = i * .5, t.map && (e.map.value = t.map, n(t.map, e.uvTransform)), t.alphaMap && (e.alphaMap.value = t.alphaMap, n(t.alphaMap, e.alphaMapTransform)), t.alphaTest > 0 && (e.alphaTest.value = t.alphaTest);
	}
	function l(e, t) {
		e.diffuse.value.copy(t.color), e.opacity.value = t.opacity, e.rotation.value = t.rotation, t.map && (e.map.value = t.map, n(t.map, e.mapTransform)), t.alphaMap && (e.alphaMap.value = t.alphaMap, n(t.alphaMap, e.alphaMapTransform)), t.alphaTest > 0 && (e.alphaTest.value = t.alphaTest);
	}
	function u(e, t) {
		e.specular.value.copy(t.specular), e.shininess.value = Math.max(t.shininess, 1e-4);
	}
	function d(e, t) {
		t.gradientMap && (e.gradientMap.value = t.gradientMap);
	}
	function f(e, t) {
		e.metalness.value = t.metalness, t.metalnessMap && (e.metalnessMap.value = t.metalnessMap, n(t.metalnessMap, e.metalnessMapTransform)), e.roughness.value = t.roughness, t.roughnessMap && (e.roughnessMap.value = t.roughnessMap, n(t.roughnessMap, e.roughnessMapTransform)), t.envMap && (e.envMapIntensity.value = t.envMapIntensity);
	}
	function p(e, t, r) {
		e.ior.value = t.ior, t.sheen > 0 && (e.sheenColor.value.copy(t.sheenColor).multiplyScalar(t.sheen), e.sheenRoughness.value = t.sheenRoughness, t.sheenColorMap && (e.sheenColorMap.value = t.sheenColorMap, n(t.sheenColorMap, e.sheenColorMapTransform)), t.sheenRoughnessMap && (e.sheenRoughnessMap.value = t.sheenRoughnessMap, n(t.sheenRoughnessMap, e.sheenRoughnessMapTransform))), t.clearcoat > 0 && (e.clearcoat.value = t.clearcoat, e.clearcoatRoughness.value = t.clearcoatRoughness, t.clearcoatMap && (e.clearcoatMap.value = t.clearcoatMap, n(t.clearcoatMap, e.clearcoatMapTransform)), t.clearcoatRoughnessMap && (e.clearcoatRoughnessMap.value = t.clearcoatRoughnessMap, n(t.clearcoatRoughnessMap, e.clearcoatRoughnessMapTransform)), t.clearcoatNormalMap && (e.clearcoatNormalMap.value = t.clearcoatNormalMap, n(t.clearcoatNormalMap, e.clearcoatNormalMapTransform), e.clearcoatNormalScale.value.copy(t.clearcoatNormalScale), t.side === 1 && e.clearcoatNormalScale.value.negate())), t.dispersion > 0 && (e.dispersion.value = t.dispersion), t.iridescence > 0 && (e.iridescence.value = t.iridescence, e.iridescenceIOR.value = t.iridescenceIOR, e.iridescenceThicknessMinimum.value = t.iridescenceThicknessRange[0], e.iridescenceThicknessMaximum.value = t.iridescenceThicknessRange[1], t.iridescenceMap && (e.iridescenceMap.value = t.iridescenceMap, n(t.iridescenceMap, e.iridescenceMapTransform)), t.iridescenceThicknessMap && (e.iridescenceThicknessMap.value = t.iridescenceThicknessMap, n(t.iridescenceThicknessMap, e.iridescenceThicknessMapTransform))), t.transmission > 0 && (e.transmission.value = t.transmission, e.transmissionSamplerMap.value = r.texture, e.transmissionSamplerSize.value.set(r.width, r.height), t.transmissionMap && (e.transmissionMap.value = t.transmissionMap, n(t.transmissionMap, e.transmissionMapTransform)), e.thickness.value = t.thickness, t.thicknessMap && (e.thicknessMap.value = t.thicknessMap, n(t.thicknessMap, e.thicknessMapTransform)), e.attenuationDistance.value = t.attenuationDistance, e.attenuationColor.value.copy(t.attenuationColor)), t.anisotropy > 0 && (e.anisotropyVector.value.set(t.anisotropy * Math.cos(t.anisotropyRotation), t.anisotropy * Math.sin(t.anisotropyRotation)), t.anisotropyMap && (e.anisotropyMap.value = t.anisotropyMap, n(t.anisotropyMap, e.anisotropyMapTransform))), e.specularIntensity.value = t.specularIntensity, e.specularColor.value.copy(t.specularColor), t.specularColorMap && (e.specularColorMap.value = t.specularColorMap, n(t.specularColorMap, e.specularColorMapTransform)), t.specularIntensityMap && (e.specularIntensityMap.value = t.specularIntensityMap, n(t.specularIntensityMap, e.specularIntensityMapTransform));
	}
	function m(e, t) {
		t.matcap && (e.matcap.value = t.matcap);
	}
	function h(e, n) {
		let r = t.get(n).light;
		e.referencePosition.value.setFromMatrixPosition(r.matrixWorld), e.nearDistance.value = r.shadow.camera.near, e.farDistance.value = r.shadow.camera.far;
	}
	return {
		refreshFogUniforms: r,
		refreshMaterialUniforms: i
	};
}
function f_(e, t, n, r) {
	let i = {}, a = {}, o = [], s = e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);
	function c(e, t) {
		let n = t.program;
		r.uniformBlockBinding(e, n);
	}
	function l(e, n) {
		let o = i[e.id];
		o === void 0 && (g(e), o = u(e), i[e.id] = o, e.addEventListener("dispose", v));
		let s = n.program;
		r.updateUBOMapping(e, s);
		let c = t.render.frame;
		a[e.id] !== c && (f(e), a[e.id] = c);
	}
	function u(t) {
		let n = d();
		t.__bindingPointIndex = n;
		let r = e.createBuffer(), i = t.__size, a = t.usage;
		return e.bindBuffer(e.UNIFORM_BUFFER, r), e.bufferData(e.UNIFORM_BUFFER, i, a), e.bindBuffer(e.UNIFORM_BUFFER, null), e.bindBufferBase(e.UNIFORM_BUFFER, n, r), r;
	}
	function d() {
		for (let e = 0; e < s; e++) if (o.indexOf(e) === -1) return o.push(e), e;
		return z("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."), 0;
	}
	function f(t) {
		let n = i[t.id], r = t.uniforms, a = t.__cache;
		e.bindBuffer(e.UNIFORM_BUFFER, n);
		for (let e = 0, t = r.length; e < t; e++) {
			let t = r[e];
			if (Array.isArray(t)) for (let n = 0, r = t.length; n < r; n++) p(t[n], e, n, a);
			else p(t, e, 0, a);
		}
		e.bindBuffer(e.UNIFORM_BUFFER, null);
	}
	function p(t, n, r, i) {
		if (h(t, n, r, i) === !0) {
			let n = t.__offset, r = t.value;
			if (Array.isArray(r)) {
				let e = 0;
				for (let n = 0; n < r.length; n++) {
					let i = r[n], a = _(i);
					m(i, t.__data, e), typeof i != "number" && typeof i != "boolean" && !i.isMatrix3 && !ArrayBuffer.isView(i) && (e += a.storage / Float32Array.BYTES_PER_ELEMENT);
				}
			} else m(r, t.__data, 0);
			e.bufferSubData(e.UNIFORM_BUFFER, n, t.__data);
		}
	}
	function m(e, t, n) {
		typeof e == "number" || typeof e == "boolean" ? t[0] = e : e.isMatrix3 ? (t[0] = e.elements[0], t[1] = e.elements[1], t[2] = e.elements[2], t[3] = 0, t[4] = e.elements[3], t[5] = e.elements[4], t[6] = e.elements[5], t[7] = 0, t[8] = e.elements[6], t[9] = e.elements[7], t[10] = e.elements[8], t[11] = 0) : ArrayBuffer.isView(e) ? t.set(new e.constructor(e.buffer, e.byteOffset, t.length)) : e.toArray(t, n);
	}
	function h(e, t, n, r) {
		let i = e.value, a = t + "_" + n;
		if (r[a] === void 0) return typeof i == "number" || typeof i == "boolean" ? r[a] = i : ArrayBuffer.isView(i) ? r[a] = i.slice() : r[a] = i.clone(), !0;
		{
			let e = r[a];
			if (typeof i == "number" || typeof i == "boolean") {
				if (e !== i) return r[a] = i, !0;
			} else if (ArrayBuffer.isView(i)) return !0;
			else if (e.equals(i) === !1) return e.copy(i), !0;
		}
		return !1;
	}
	function g(e) {
		let t = e.uniforms, n = 0;
		for (let e = 0, r = t.length; e < r; e++) {
			let r = Array.isArray(t[e]) ? t[e] : [t[e]];
			for (let e = 0, t = r.length; e < t; e++) {
				let t = r[e], i = Array.isArray(t.value) ? t.value : [t.value];
				for (let e = 0, r = i.length; e < r; e++) {
					let r = i[e], a = _(r), o = n % 16, s = o % a.boundary, c = o + s;
					n += s, c !== 0 && 16 - c < a.storage && (n += 16 - c), t.__data = new Float32Array(a.storage / Float32Array.BYTES_PER_ELEMENT), t.__offset = n, n += a.storage;
				}
			}
		}
		let r = n % 16;
		return r > 0 && (n += 16 - r), e.__size = n, e.__cache = {}, this;
	}
	function _(e) {
		let t = {
			boundary: 0,
			storage: 0
		};
		return typeof e == "number" || typeof e == "boolean" ? (t.boundary = 4, t.storage = 4) : e.isVector2 ? (t.boundary = 8, t.storage = 8) : e.isVector3 || e.isColor ? (t.boundary = 16, t.storage = 12) : e.isVector4 ? (t.boundary = 16, t.storage = 16) : e.isMatrix3 ? (t.boundary = 48, t.storage = 48) : e.isMatrix4 ? (t.boundary = 64, t.storage = 64) : e.isTexture ? R("WebGLRenderer: Texture samplers can not be part of an uniforms group.") : ArrayBuffer.isView(e) ? (t.boundary = 16, t.storage = e.byteLength) : R("WebGLRenderer: Unsupported uniform value type.", e), t;
	}
	function v(t) {
		let n = t.target;
		n.removeEventListener("dispose", v);
		let r = o.indexOf(n.__bindingPointIndex);
		o.splice(r, 1), e.deleteBuffer(i[n.id]), delete i[n.id], delete a[n.id];
	}
	function y() {
		for (let t in i) e.deleteBuffer(i[t]);
		o = [], i = {}, a = {};
	}
	return {
		bind: c,
		update: l,
		dispose: y
	};
}
var p_ = new Uint16Array([
	12469,
	15057,
	12620,
	14925,
	13266,
	14620,
	13807,
	14376,
	14323,
	13990,
	14545,
	13625,
	14713,
	13328,
	14840,
	12882,
	14931,
	12528,
	14996,
	12233,
	15039,
	11829,
	15066,
	11525,
	15080,
	11295,
	15085,
	10976,
	15082,
	10705,
	15073,
	10495,
	13880,
	14564,
	13898,
	14542,
	13977,
	14430,
	14158,
	14124,
	14393,
	13732,
	14556,
	13410,
	14702,
	12996,
	14814,
	12596,
	14891,
	12291,
	14937,
	11834,
	14957,
	11489,
	14958,
	11194,
	14943,
	10803,
	14921,
	10506,
	14893,
	10278,
	14858,
	9960,
	14484,
	14039,
	14487,
	14025,
	14499,
	13941,
	14524,
	13740,
	14574,
	13468,
	14654,
	13106,
	14743,
	12678,
	14818,
	12344,
	14867,
	11893,
	14889,
	11509,
	14893,
	11180,
	14881,
	10751,
	14852,
	10428,
	14812,
	10128,
	14765,
	9754,
	14712,
	9466,
	14764,
	13480,
	14764,
	13475,
	14766,
	13440,
	14766,
	13347,
	14769,
	13070,
	14786,
	12713,
	14816,
	12387,
	14844,
	11957,
	14860,
	11549,
	14868,
	11215,
	14855,
	10751,
	14825,
	10403,
	14782,
	10044,
	14729,
	9651,
	14666,
	9352,
	14599,
	9029,
	14967,
	12835,
	14966,
	12831,
	14963,
	12804,
	14954,
	12723,
	14936,
	12564,
	14917,
	12347,
	14900,
	11958,
	14886,
	11569,
	14878,
	11247,
	14859,
	10765,
	14828,
	10401,
	14784,
	10011,
	14727,
	9600,
	14660,
	9289,
	14586,
	8893,
	14508,
	8533,
	15111,
	12234,
	15110,
	12234,
	15104,
	12216,
	15092,
	12156,
	15067,
	12010,
	15028,
	11776,
	14981,
	11500,
	14942,
	11205,
	14902,
	10752,
	14861,
	10393,
	14812,
	9991,
	14752,
	9570,
	14682,
	9252,
	14603,
	8808,
	14519,
	8445,
	14431,
	8145,
	15209,
	11449,
	15208,
	11451,
	15202,
	11451,
	15190,
	11438,
	15163,
	11384,
	15117,
	11274,
	15055,
	10979,
	14994,
	10648,
	14932,
	10343,
	14871,
	9936,
	14803,
	9532,
	14729,
	9218,
	14645,
	8742,
	14556,
	8381,
	14461,
	8020,
	14365,
	7603,
	15273,
	10603,
	15272,
	10607,
	15267,
	10619,
	15256,
	10631,
	15231,
	10614,
	15182,
	10535,
	15118,
	10389,
	15042,
	10167,
	14963,
	9787,
	14883,
	9447,
	14800,
	9115,
	14710,
	8665,
	14615,
	8318,
	14514,
	7911,
	14411,
	7507,
	14279,
	7198,
	15314,
	9675,
	15313,
	9683,
	15309,
	9712,
	15298,
	9759,
	15277,
	9797,
	15229,
	9773,
	15166,
	9668,
	15084,
	9487,
	14995,
	9274,
	14898,
	8910,
	14800,
	8539,
	14697,
	8234,
	14590,
	7790,
	14479,
	7409,
	14367,
	7067,
	14178,
	6621,
	15337,
	8619,
	15337,
	8631,
	15333,
	8677,
	15325,
	8769,
	15305,
	8871,
	15264,
	8940,
	15202,
	8909,
	15119,
	8775,
	15022,
	8565,
	14916,
	8328,
	14804,
	8009,
	14688,
	7614,
	14569,
	7287,
	14448,
	6888,
	14321,
	6483,
	14088,
	6171,
	15350,
	7402,
	15350,
	7419,
	15347,
	7480,
	15340,
	7613,
	15322,
	7804,
	15287,
	7973,
	15229,
	8057,
	15148,
	8012,
	15046,
	7846,
	14933,
	7611,
	14810,
	7357,
	14682,
	7069,
	14552,
	6656,
	14421,
	6316,
	14251,
	5948,
	14007,
	5528,
	15356,
	5942,
	15356,
	5977,
	15353,
	6119,
	15348,
	6294,
	15332,
	6551,
	15302,
	6824,
	15249,
	7044,
	15171,
	7122,
	15070,
	7050,
	14949,
	6861,
	14818,
	6611,
	14679,
	6349,
	14538,
	6067,
	14398,
	5651,
	14189,
	5311,
	13935,
	4958,
	15359,
	4123,
	15359,
	4153,
	15356,
	4296,
	15353,
	4646,
	15338,
	5160,
	15311,
	5508,
	15263,
	5829,
	15188,
	6042,
	15088,
	6094,
	14966,
	6001,
	14826,
	5796,
	14678,
	5543,
	14527,
	5287,
	14377,
	4985,
	14133,
	4586,
	13869,
	4257,
	15360,
	1563,
	15360,
	1642,
	15358,
	2076,
	15354,
	2636,
	15341,
	3350,
	15317,
	4019,
	15273,
	4429,
	15203,
	4732,
	15105,
	4911,
	14981,
	4932,
	14836,
	4818,
	14679,
	4621,
	14517,
	4386,
	14359,
	4156,
	14083,
	3795,
	13808,
	3437,
	15360,
	122,
	15360,
	137,
	15358,
	285,
	15355,
	636,
	15344,
	1274,
	15322,
	2177,
	15281,
	2765,
	15215,
	3223,
	15120,
	3451,
	14995,
	3569,
	14846,
	3567,
	14681,
	3466,
	14511,
	3305,
	14344,
	3121,
	14037,
	2800,
	13753,
	2467,
	15360,
	0,
	15360,
	1,
	15359,
	21,
	15355,
	89,
	15346,
	253,
	15325,
	479,
	15287,
	796,
	15225,
	1148,
	15133,
	1492,
	15008,
	1749,
	14856,
	1882,
	14685,
	1886,
	14506,
	1783,
	14324,
	1608,
	13996,
	1398,
	13702,
	1183
]), m_ = null;
function h_() {
	return m_ === null && (m_ = new ns(p_, 16, 16, Tt, ft), m_.name = "DFG_LUT", m_.minFilter = et, m_.magFilter = et, m_.wrapS = qe, m_.wrapT = qe, m_.generateMipmaps = !1, m_.needsUpdate = !0), m_;
}
var g_ = class {
	constructor(e = {}) {
		let { canvas: t = or(), context: n = null, depth: r = !0, stencil: i = !1, alpha: a = !1, antialias: o = !1, premultipliedAlpha: s = !0, preserveDrawingBuffer: c = !1, powerPreference: l = "default", failIfMajorPerformanceCaveat: u = !1, reversedDepthBuffer: d = !1, outputBufferType: f = at } = e;
		this.isWebGLRenderer = !0;
		let p;
		if (n !== null) {
			if (typeof WebGLRenderingContext < "u" && n instanceof WebGLRenderingContext) throw Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");
			p = n.getContextAttributes().alpha;
		} else p = a;
		let m = f, h = /* @__PURE__ */ new Set([
			Ot,
			Et,
			wt
		]), g = /* @__PURE__ */ new Set([
			at,
			ut,
			ct,
			ht,
			pt,
			mt
		]), _ = /* @__PURE__ */ new Uint32Array(4), v = /* @__PURE__ */ new Int32Array(4), y = new U(), b = null, x = null, S = [], C = [], w = null;
		this.domElement = t, this.debug = {
			checkShaderErrors: !0,
			onShaderError: null
		}, this.autoClear = !0, this.autoClearColor = !0, this.autoClearDepth = !0, this.autoClearStencil = !0, this.sortObjects = !0, this.clippingPlanes = [], this.localClippingEnabled = !1, this.toneMapping = 0, this.toneMappingExposure = 1, this.transmissionResolutionScale = 1;
		let T = this, E = !1, D = null, O = null, k = null, A = null;
		this._outputColorSpace = On;
		let ee = 0, te = 0, j = null, ne = -1, re = null, M = new ai(), ie = new ai(), ae = null, oe = new J(0), se = 0, N = t.width, ce = t.height, le = 1, ue = null, de = null, fe = new ai(0, 0, N, ce), pe = new ai(0, 0, N, ce), me = !1, he = new Ss(), ge = !1, _e = !1, ve = new K(), ye = new U(), be = new ai(), xe = {
			background: null,
			fog: null,
			environment: null,
			overrideMaterial: null,
			isScene: !0
		}, Se = !1;
		function Ce() {
			return j === null ? le : 1;
		}
		let P = n;
		function we(e, n) {
			return t.getContext(e, n);
		}
		try {
			let e = {
				alpha: !0,
				depth: r,
				stencil: i,
				antialias: o,
				premultipliedAlpha: s,
				preserveDrawingBuffer: c,
				powerPreference: l,
				failIfMajorPerformanceCaveat: u
			};
			if ("setAttribute" in t && t.setAttribute("data-engine", "three.js r185"), t.addEventListener("webglcontextlost", qe, !1), t.addEventListener("webglcontextrestored", Je, !1), t.addEventListener("webglcontextcreationerror", Ye, !1), P === null) {
				let t = "webgl2";
				if (P = we(t, e), P === null) throw we(t) ? Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.") : Error("THREE.WebGLRenderer: Error creating WebGL context.");
			}
		} catch (e) {
			throw z("WebGLRenderer: " + e.message), e;
		}
		let Te, Ee, F, De, I, L, Oe, ke, Ae, je, Me, Ne, Pe, Fe, Ie, Le, Re, ze, Be, Ve, He, Ue, We;
		function Ge() {
			Te = new Pm(P), Te.init(), He = new i_(P, Te), Ee = new um(P, Te, e, He), F = new n_(P, Te), Ee.reversedDepthBuffer && d && F.buffers.depth.setReversed(!0), O = P.createFramebuffer(), k = P.createFramebuffer(), A = P.createFramebuffer(), De = new Lm(P), I = new Ig(), L = new r_(P, Te, F, I, Ee, He, De), Oe = new Nm(T), ke = new nm(P), Ue = new cm(P, ke), Ae = new Fm(P, ke, De, Ue), je = new zm(P, Ae, ke, Ue, De), ze = new Rm(P, Ee, L), Ie = new dm(I), Me = new Fg(T, Oe, Te, Ee, Ue, Ie), Ne = new d_(T, I), Pe = new Bg(), Fe = new qg(Te), Re = new sm(T, Oe, F, je, p, s), Le = new t_(T, je, Ee), We = new f_(P, De, Ee, F), Be = new lm(P, Te, De), Ve = new Im(P, Te, De), De.programs = Me.programs, T.capabilities = Ee, T.extensions = Te, T.properties = I, T.renderLists = Pe, T.shadowMap = Le, T.state = F, T.info = De;
		}
		Ge(), m !== 1009 && (w = new Vm(m, t.width, t.height, o, r, i));
		let Ke = new c_(T, P);
		this.xr = Ke, this.getContext = function() {
			return P;
		}, this.getContextAttributes = function() {
			return P.getContextAttributes();
		}, this.forceContextLoss = function() {
			let e = Te.get("WEBGL_lose_context");
			e && e.loseContext();
		}, this.forceContextRestore = function() {
			let e = Te.get("WEBGL_lose_context");
			e && e.restoreContext();
		}, this.getPixelRatio = function() {
			return le;
		}, this.setPixelRatio = function(e) {
			e !== void 0 && (le = e, this.setSize(N, ce, !1));
		}, this.getSize = function(e) {
			return e.set(N, ce);
		}, this.setSize = function(e, n, r = !0) {
			if (Ke.isPresenting) {
				R("WebGLRenderer: Can't change size while VR device is presenting.");
				return;
			}
			N = e, ce = n, t.width = Math.floor(e * le), t.height = Math.floor(n * le), r === !0 && (t.style.width = e + "px", t.style.height = n + "px"), w !== null && w.setSize(t.width, t.height), this.setViewport(0, 0, e, n);
		}, this.getDrawingBufferSize = function(e) {
			return e.set(N * le, ce * le).floor();
		}, this.setDrawingBufferSize = function(e, n, r) {
			N = e, ce = n, le = r, t.width = Math.floor(e * r), t.height = Math.floor(n * r), this.setViewport(0, 0, e, n);
		}, this.setEffects = function(e) {
			if (m === 1009) {
				z("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");
				return;
			}
			if (e) {
				for (let t = 0; t < e.length; t++) if (e[t].isOutputPass === !0) {
					R("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");
					break;
				}
			}
			w.setEffects(e || []);
		}, this.getCurrentViewport = function(e) {
			return e.copy(M);
		}, this.getViewport = function(e) {
			return e.copy(fe);
		}, this.setViewport = function(e, t, n, r) {
			e.isVector4 ? fe.set(e.x, e.y, e.z, e.w) : fe.set(e, t, n, r), F.viewport(M.copy(fe).multiplyScalar(le).round());
		}, this.getScissor = function(e) {
			return e.copy(pe);
		}, this.setScissor = function(e, t, n, r) {
			e.isVector4 ? pe.set(e.x, e.y, e.z, e.w) : pe.set(e, t, n, r), F.scissor(ie.copy(pe).multiplyScalar(le).round());
		}, this.getScissorTest = function() {
			return me;
		}, this.setScissorTest = function(e) {
			F.setScissorTest(me = e);
		}, this.setOpaqueSort = function(e) {
			ue = e;
		}, this.setTransparentSort = function(e) {
			de = e;
		}, this.getClearColor = function(e) {
			return e.copy(Re.getClearColor());
		}, this.setClearColor = function() {
			Re.setClearColor(...arguments);
		}, this.getClearAlpha = function() {
			return Re.getClearAlpha();
		}, this.setClearAlpha = function() {
			Re.setClearAlpha(...arguments);
		}, this.clear = function(e = !0, t = !0, n = !0) {
			let r = 0;
			if (e) {
				let e = !1;
				if (j !== null) {
					let t = j.texture.format;
					e = h.has(t);
				}
				if (e) {
					let e = j.texture.type, t = g.has(e), n = Re.getClearColor(), r = Re.getClearAlpha(), i = n.r, a = n.g, o = n.b;
					t ? (_[0] = i, _[1] = a, _[2] = o, _[3] = r, P.clearBufferuiv(P.COLOR, 0, _)) : (v[0] = i, v[1] = a, v[2] = o, v[3] = r, P.clearBufferiv(P.COLOR, 0, v));
				} else r |= P.COLOR_BUFFER_BIT;
			}
			t && (r |= P.DEPTH_BUFFER_BIT, this.state.buffers.depth.setMask(!0)), n && (r |= P.STENCIL_BUFFER_BIT, this.state.buffers.stencil.setMask(4294967295)), r !== 0 && P.clear(r);
		}, this.clearColor = function() {
			this.clear(!0, !1, !1);
		}, this.clearDepth = function() {
			this.clear(!1, !0, !1);
		}, this.clearStencil = function() {
			this.clear(!1, !1, !0);
		}, this.setNodesHandler = function(e) {
			e.setRenderer(this), D = e;
		}, this.dispose = function() {
			t.removeEventListener("webglcontextlost", qe, !1), t.removeEventListener("webglcontextrestored", Je, !1), t.removeEventListener("webglcontextcreationerror", Ye, !1), Re.dispose(), Pe.dispose(), Fe.dispose(), I.dispose(), Oe.dispose(), je.dispose(), Ue.dispose(), We.dispose(), Me.dispose(), Ke.dispose(), Ke.removeEventListener("sessionstart", nt), Ke.removeEventListener("sessionend", it), ot.stop();
		};
		function qe(e) {
			e.preventDefault(), dr("WebGLRenderer: Context Lost."), E = !0;
		}
		function Je() {
			dr("WebGLRenderer: Context Restored."), E = !1;
			let e = De.autoReset, t = Le.enabled, n = Le.autoUpdate, r = Le.needsUpdate, i = Le.type;
			Ge(), De.autoReset = e, Le.enabled = t, Le.autoUpdate = n, Le.needsUpdate = r, Le.type = i;
		}
		function Ye(e) {
			z("WebGLRenderer: A WebGL context could not be created. Reason: ", e.statusMessage);
		}
		function Xe(e) {
			let t = e.target;
			t.removeEventListener("dispose", Xe), Ze(t);
		}
		function Ze(e) {
			Qe(e), I.remove(e);
		}
		function Qe(e) {
			let t = I.get(e).programs;
			t !== void 0 && (t.forEach(function(e) {
				Me.releaseProgram(e);
			}), e.isShaderMaterial && Me.releaseShaderCache(e));
		}
		this.renderBufferDirect = function(e, t, n, r, i, a) {
			t === null && (t = xe);
			let o = i.isMesh && i.matrixWorld.determinantAffine() < 0, s = St(e, t, n, r, i);
			F.setMaterial(r, o);
			let c = n.index, l = 1;
			if (r.wireframe === !0) {
				if (c = Ae.getWireframeAttribute(n), c === void 0) return;
				l = 2;
			}
			let u = n.drawRange, d = n.attributes.position, f = u.start * l, p = (u.start + u.count) * l;
			a !== null && (f = Math.max(f, a.start * l), p = Math.min(p, (a.start + a.count) * l)), c === null ? d != null && (f = Math.max(f, 0), p = Math.min(p, d.count)) : (f = Math.max(f, 0), p = Math.min(p, c.count));
			let m = p - f;
			if (m < 0 || m === Infinity) return;
			Ue.setup(i, r, s, n, c);
			let h, g = Be;
			if (c !== null && (h = ke.get(c), g = Ve, g.setIndex(h)), i.isMesh) r.wireframe === !0 ? (F.setLineWidth(r.wireframeLinewidth * Ce()), g.setMode(P.LINES)) : g.setMode(P.TRIANGLES);
			else if (i.isLine) {
				let e = r.linewidth;
				e === void 0 && (e = 1), F.setLineWidth(e * Ce()), i.isLineSegments ? g.setMode(P.LINES) : i.isLineLoop ? g.setMode(P.LINE_LOOP) : g.setMode(P.LINE_STRIP);
			} else i.isPoints ? g.setMode(P.POINTS) : i.isSprite && g.setMode(P.TRIANGLES);
			if (i.isBatchedMesh) if (Te.get("WEBGL_multi_draw")) g.renderMultiDraw(i._multiDrawStarts, i._multiDrawCounts, i._multiDrawCount);
			else {
				let e = i._multiDrawStarts, t = i._multiDrawCounts, n = i._multiDrawCount, a = c ? ke.get(c).bytesPerElement : 1, o = I.get(r).currentProgram.getUniforms();
				for (let r = 0; r < n; r++) o.setValue(P, "_gl_DrawID", r), g.render(e[r] / a, t[r]);
			}
			else if (i.isInstancedMesh) g.renderInstances(f, m, i.count);
			else if (n.isInstancedBufferGeometry) {
				let e = n._maxInstanceCount === void 0 ? Infinity : n._maxInstanceCount, t = Math.min(n.instanceCount, e);
				g.renderInstances(f, m, t);
			} else g.render(f, m);
		};
		function $e(e, t, n) {
			e.transparent === !0 && e.side === 2 && e.forceSinglePass === !1 ? (e.side = 1, e.needsUpdate = !0, vt(e, t, n), e.side = 0, e.needsUpdate = !0, vt(e, t, n), e.side = 2) : vt(e, t, n);
		}
		this.compile = function(e, t, n = null) {
			n === null && (n = e), x = Fe.get(n), x.init(t), C.push(x), n.traverseVisible(function(e) {
				e.isLight && e.layers.test(t.layers) && (x.pushLight(e), e.castShadow && x.pushShadow(e));
			}), e !== n && e.traverseVisible(function(e) {
				e.isLight && e.layers.test(t.layers) && (x.pushLight(e), e.castShadow && x.pushShadow(e));
			}), x.setupLights();
			let r = /* @__PURE__ */ new Set();
			return e.traverse(function(e) {
				if (!(e.isMesh || e.isPoints || e.isLine || e.isSprite)) return;
				let t = e.material;
				if (t) if (Array.isArray(t)) for (let i = 0; i < t.length; i++) {
					let a = t[i];
					$e(a, n, e), r.add(a);
				}
				else $e(t, n, e), r.add(t);
			}), x = C.pop(), r;
		}, this.compileAsync = function(e, t, n = null) {
			let r = this.compile(e, t, n);
			return new Promise((t) => {
				function n() {
					if (r.forEach(function(e) {
						I.get(e).currentProgram.isReady() && r.delete(e);
					}), r.size === 0) {
						t(e);
						return;
					}
					setTimeout(n, 10);
				}
				Te.get("KHR_parallel_shader_compile") === null ? setTimeout(n, 10) : n();
			});
		};
		let et = null;
		function tt(e) {
			et && et(e);
		}
		function nt() {
			ot.stop();
		}
		function it() {
			ot.start();
		}
		let ot = new tm();
		ot.setAnimationLoop(tt), typeof self < "u" && ot.setContext(self), this.setAnimationLoop = function(e) {
			et = e, Ke.setAnimationLoop(e), e === null ? ot.stop() : ot.start();
		}, Ke.addEventListener("sessionstart", nt), Ke.addEventListener("sessionend", it), this.render = function(e, t) {
			if (t !== void 0 && t.isCamera !== !0) {
				z("WebGLRenderer.render: camera is not an instance of THREE.Camera.");
				return;
			}
			if (E === !0) return;
			D !== null && D.renderStart(e, t);
			let n = Ke.enabled === !0 && Ke.isPresenting === !0, r = w !== null && (j === null || n) && w.begin(T, j);
			if (e.matrixWorldAutoUpdate === !0 && e.updateMatrixWorld(), t.parent === null && t.matrixWorldAutoUpdate === !0 && t.updateMatrixWorld(), Ke.enabled === !0 && Ke.isPresenting === !0 && (w === null || w.isCompositing() === !1) && (Ke.cameraAutoUpdate === !0 && Ke.updateCamera(t), t = Ke.getCamera()), e.isScene === !0 && e.onBeforeRender(T, e, t, j), x = Fe.get(e, C.length), x.init(t), x.state.textureUnits = L.getTextureUnits(), C.push(x), ve.multiplyMatrices(t.projectionMatrix, t.matrixWorldInverse), he.setFromProjectionMatrix(ve, Yn, t.reversedDepth), _e = this.localClippingEnabled, ge = Ie.init(this.clippingPlanes, _e), b = Pe.get(e, S.length), b.init(), S.push(b), Ke.enabled === !0 && Ke.isPresenting === !0) {
				let e = T.xr.getDepthSensingMesh();
				e !== null && st(e, t, -Infinity, T.sortObjects);
			}
			st(e, t, 0, T.sortObjects), b.finish(), T.sortObjects === !0 && b.sort(ue, de, t.reversedDepth), Se = Ke.enabled === !1 || Ke.isPresenting === !1 || Ke.hasDepthSensing() === !1, Se && Re.addToRenderList(b, e), this.info.render.frame++, this.info.autoReset === !0 && this.info.reset(), ge === !0 && Ie.beginShadows();
			let i = x.state.shadowsArray;
			if (Le.render(i, e, t), ge === !0 && Ie.endShadows(), (r && w.hasRenderPass()) === !1) {
				let n = b.opaque, r = b.transmissive;
				if (x.setupLights(), t.isArrayCamera) {
					let i = t.cameras;
					if (r.length > 0) for (let t = 0, a = i.length; t < a; t++) {
						let a = i[t];
						dt(n, r, e, a);
					}
					Se && Re.render(e);
					for (let t = 0, n = i.length; t < n; t++) {
						let n = i[t];
						lt(b, e, n, n.viewport);
					}
				} else r.length > 0 && dt(n, r, e, t), Se && Re.render(e), lt(b, e, t);
			}
			j !== null && te === 0 && (L.updateMultisampleRenderTarget(j), L.updateRenderTargetMipmap(j)), r && w.end(T), e.isScene === !0 && e.onAfterRender(T, e, t), Ue.resetDefaultState(), ne = -1, re = null, C.pop(), C.length > 0 ? (x = C[C.length - 1], L.setTextureUnits(x.state.textureUnits), ge === !0 && Ie.setGlobalState(T.clippingPlanes, x.state.camera)) : x = null, S.pop(), b = S.length > 0 ? S[S.length - 1] : null, D !== null && D.renderEnd();
		};
		function st(e, t, n, r) {
			if (e.visible === !1) return;
			if (e.layers.test(t.layers)) {
				if (e.isGroup) n = e.renderOrder;
				else if (e.isLOD) e.autoUpdate === !0 && e.update(t);
				else if (e.isLightProbeGrid) x.pushLightProbeGrid(e);
				else if (e.isLight) x.pushLight(e), e.castShadow && x.pushShadow(e);
				else if (e.isSprite) {
					if (!e.frustumCulled || he.intersectsSprite(e)) {
						r && be.setFromMatrixPosition(e.matrixWorld).applyMatrix4(ve);
						let t = je.update(e), i = e.material;
						i.visible && b.push(e, t, i, n, be.z, null);
					}
				} else if ((e.isMesh || e.isLine || e.isPoints) && (!e.frustumCulled || he.intersectsObject(e))) {
					let t = je.update(e), i = e.material;
					if (r && (e.boundingSphere === void 0 ? (t.boundingSphere === null && t.computeBoundingSphere(), be.copy(t.boundingSphere.center)) : (e.boundingSphere === null && e.computeBoundingSphere(), be.copy(e.boundingSphere.center)), be.applyMatrix4(e.matrixWorld).applyMatrix4(ve)), Array.isArray(i)) {
						let r = t.groups;
						for (let a = 0, o = r.length; a < o; a++) {
							let o = r[a], s = i[o.materialIndex];
							s && s.visible && b.push(e, t, s, n, be.z, o);
						}
					} else i.visible && b.push(e, t, i, n, be.z, null);
				}
			}
			let i = e.children;
			for (let e = 0, a = i.length; e < a; e++) st(i[e], t, n, r);
		}
		function lt(e, t, n, r) {
			let { opaque: i, transmissive: a, transparent: o } = e;
			x.setupLightsView(n), ge === !0 && Ie.setGlobalState(T.clippingPlanes, n), r && F.viewport(M.copy(r)), i.length > 0 && gt(i, t, n), a.length > 0 && gt(a, t, n), o.length > 0 && gt(o, t, n), F.buffers.depth.setTest(!0), F.buffers.depth.setMask(!0), F.buffers.color.setMask(!0), F.setPolygonOffset(!1);
		}
		function dt(e, t, n, r) {
			if ((n.isScene === !0 ? n.overrideMaterial : null) !== null) return;
			if (x.state.transmissionRenderTarget[r.id] === void 0) {
				let e = Te.has("EXT_color_buffer_half_float") || Te.has("EXT_color_buffer_float");
				x.state.transmissionRenderTarget[r.id] = new si(1, 1, {
					generateMipmaps: !0,
					type: e ? ft : at,
					minFilter: rt,
					samples: Math.max(4, Ee.samples),
					stencilBuffer: i,
					resolveDepthBuffer: !1,
					resolveStencilBuffer: !1,
					colorSpace: G.workingColorSpace
				});
			}
			let a = x.state.transmissionRenderTarget[r.id], o = r.viewport || M;
			a.setSize(o.z * T.transmissionResolutionScale, o.w * T.transmissionResolutionScale);
			let s = T.getRenderTarget(), c = T.getActiveCubeFace(), l = T.getActiveMipmapLevel();
			T.setRenderTarget(a), T.getClearColor(oe), se = T.getClearAlpha(), se < 1 && T.setClearColor(16777215, .5), T.clear(), Se && Re.render(n);
			let u = T.toneMapping;
			T.toneMapping = 0;
			let d = r.viewport;
			if (r.viewport !== void 0 && (r.viewport = void 0), x.setupLightsView(r), ge === !0 && Ie.setGlobalState(T.clippingPlanes, r), gt(e, n, r), L.updateMultisampleRenderTarget(a), L.updateRenderTargetMipmap(a), Te.has("WEBGL_multisampled_render_to_texture") === !1) {
				let e = !1;
				for (let i = 0, a = t.length; i < a; i++) {
					let { object: a, geometry: o, material: s, group: c } = t[i];
					if (s.side === 2 && a.layers.test(r.layers)) {
						let t = s.side;
						s.side = 1, s.needsUpdate = !0, _t(a, n, r, o, s, c), s.side = t, s.needsUpdate = !0, e = !0;
					}
				}
				e === !0 && (L.updateMultisampleRenderTarget(a), L.updateRenderTargetMipmap(a));
			}
			T.setRenderTarget(s, c, l), T.setClearColor(oe, se), d !== void 0 && (r.viewport = d), T.toneMapping = u;
		}
		function gt(e, t, n) {
			let r = t.isScene === !0 ? t.overrideMaterial : null;
			for (let i = 0, a = e.length; i < a; i++) {
				let a = e[i], { object: o, geometry: s, group: c } = a, l = a.material;
				l.allowOverride === !0 && r !== null && (l = r), o.layers.test(n.layers) && _t(o, t, n, s, l, c);
			}
		}
		function _t(e, t, n, r, i, a) {
			e.onBeforeRender(T, t, n, r, i, a), e.modelViewMatrix.multiplyMatrices(n.matrixWorldInverse, e.matrixWorld), e.normalMatrix.getNormalMatrix(e.modelViewMatrix), i.onBeforeRender(T, t, n, r, e, a), i.transparent === !0 && i.side === 2 && i.forceSinglePass === !1 ? (i.side = 1, i.needsUpdate = !0, T.renderBufferDirect(n, t, r, i, e, a), i.side = 0, i.needsUpdate = !0, T.renderBufferDirect(n, t, r, i, e, a), i.side = 2) : T.renderBufferDirect(n, t, r, i, e, a), e.onAfterRender(T, t, n, r, i, a);
		}
		function vt(e, t, n) {
			t.isScene !== !0 && (t = xe);
			let r = I.get(e), i = x.state.lights, a = x.state.shadowsArray, o = i.state.version, s = Me.getParameters(e, i.state, a, t, n, x.state.lightProbeGridArray), c = Me.getProgramCacheKey(s), l = r.programs;
			r.environment = e.isMeshStandardMaterial || e.isMeshLambertMaterial || e.isMeshPhongMaterial ? t.environment : null, r.fog = t.fog;
			let u = e.isMeshStandardMaterial || e.isMeshLambertMaterial && !e.envMap || e.isMeshPhongMaterial && !e.envMap;
			r.envMap = Oe.get(e.envMap || r.environment, u), r.envMapRotation = r.environment !== null && e.envMap === null ? t.environmentRotation : e.envMapRotation, l === void 0 && (e.addEventListener("dispose", Xe), l = /* @__PURE__ */ new Map(), r.programs = l);
			let d = l.get(c);
			if (d !== void 0) {
				if (r.currentProgram === d && r.lightsStateVersion === o) return bt(e, s), d;
			} else s.uniforms = Me.getUniforms(e), D !== null && e.isNodeMaterial && D.build(e, n, s), e.onBeforeCompile(s, T), d = Me.acquireProgram(s, c), l.set(c, d), r.uniforms = s.uniforms;
			let f = r.uniforms;
			return (!e.isShaderMaterial && !e.isRawShaderMaterial || e.clipping === !0) && (f.clippingPlanes = Ie.uniform), bt(e, s), r.needsLights = Tt(e), r.lightsStateVersion = o, r.needsLights && (f.ambientLightColor.value = i.state.ambient, f.lightProbe.value = i.state.probe, f.directionalLights.value = i.state.directional, f.directionalLightShadows.value = i.state.directionalShadow, f.spotLights.value = i.state.spot, f.spotLightShadows.value = i.state.spotShadow, f.rectAreaLights.value = i.state.rectArea, f.ltc_1.value = i.state.rectAreaLTC1, f.ltc_2.value = i.state.rectAreaLTC2, f.pointLights.value = i.state.point, f.pointLightShadows.value = i.state.pointShadow, f.hemisphereLights.value = i.state.hemi, f.directionalShadowMatrix.value = i.state.directionalShadowMatrix, f.spotLightMatrix.value = i.state.spotLightMatrix, f.spotLightMap.value = i.state.spotLightMap, f.pointShadowMatrix.value = i.state.pointShadowMatrix), r.lightProbeGrid = x.state.lightProbeGridArray.length > 0, r.currentProgram = d, r.uniformsList = null, d;
		}
		function yt(e) {
			if (e.uniformsList === null) {
				let t = e.currentProgram.getUniforms();
				e.uniformsList = Jh.seqWithValue(t.seq, e.uniforms);
			}
			return e.uniformsList;
		}
		function bt(e, t) {
			let n = I.get(e);
			n.outputColorSpace = t.outputColorSpace, n.batching = t.batching, n.batchingColor = t.batchingColor, n.instancing = t.instancing, n.instancingColor = t.instancingColor, n.instancingMorph = t.instancingMorph, n.skinning = t.skinning, n.morphTargets = t.morphTargets, n.morphNormals = t.morphNormals, n.morphColors = t.morphColors, n.morphTargetsCount = t.morphTargetsCount, n.numClippingPlanes = t.numClippingPlanes, n.numIntersection = t.numClipIntersection, n.vertexAlphas = t.vertexAlphas, n.vertexTangents = t.vertexTangents, n.toneMapping = t.toneMapping;
		}
		function xt(e, t) {
			if (e.length === 0) return null;
			if (e.length === 1) return e[0].texture === null ? null : e[0];
			y.setFromMatrixPosition(t.matrixWorld);
			for (let t = 0, n = e.length; t < n; t++) {
				let n = e[t];
				if (n.texture !== null && n.boundingBox.containsPoint(y)) return n;
			}
			return null;
		}
		function St(e, t, n, r, i) {
			t.isScene !== !0 && (t = xe), L.resetTextureUnits();
			let a = t.fog, o = r.isMeshStandardMaterial || r.isMeshLambertMaterial || r.isMeshPhongMaterial ? t.environment : null, s = j === null ? T.outputColorSpace : j.isXRRenderTarget === !0 ? j.texture.colorSpace : G.workingColorSpace, c = r.isMeshStandardMaterial || r.isMeshLambertMaterial && !r.envMap || r.isMeshPhongMaterial && !r.envMap, l = Oe.get(r.envMap || o, c), u = r.vertexColors === !0 && !!n.attributes.color && n.attributes.color.itemSize === 4, d = !!n.attributes.tangent && (!!r.normalMap || r.anisotropy > 0), f = !!n.morphAttributes.position, p = !!n.morphAttributes.normal, m = !!n.morphAttributes.color, h = 0;
			r.toneMapped && (j === null || j.isXRRenderTarget === !0) && (h = T.toneMapping);
			let g = n.morphAttributes.position || n.morphAttributes.normal || n.morphAttributes.color, _ = g === void 0 ? 0 : g.length, v = I.get(r), y = x.state.lights;
			if (ge === !0 && (_e === !0 || e !== re)) {
				let t = e === re && r.id === ne;
				Ie.setState(r, e, t);
			}
			let b = !1;
			r.version === v.__version ? v.needsLights && v.lightsStateVersion !== y.state.version ? b = !0 : v.outputColorSpace === s ? i.isBatchedMesh && v.batching === !1 || !i.isBatchedMesh && v.batching === !0 || i.isBatchedMesh && v.batchingColor === !0 && i.colorTexture === null || i.isBatchedMesh && v.batchingColor === !1 && i.colorTexture !== null || i.isInstancedMesh && v.instancing === !1 || !i.isInstancedMesh && v.instancing === !0 || i.isSkinnedMesh && v.skinning === !1 || !i.isSkinnedMesh && v.skinning === !0 || i.isInstancedMesh && v.instancingColor === !0 && i.instanceColor === null || i.isInstancedMesh && v.instancingColor === !1 && i.instanceColor !== null || i.isInstancedMesh && v.instancingMorph === !0 && i.morphTexture === null || i.isInstancedMesh && v.instancingMorph === !1 && i.morphTexture !== null ? b = !0 : v.envMap === l ? r.fog === !0 && v.fog !== a || v.numClippingPlanes !== void 0 && (v.numClippingPlanes !== Ie.numPlanes || v.numIntersection !== Ie.numIntersection) ? b = !0 : v.vertexAlphas === u && v.vertexTangents === d && v.morphTargets === f && v.morphNormals === p && v.morphColors === m && v.toneMapping === h && v.morphTargetsCount === _ ? !!v.lightProbeGrid != x.state.lightProbeGridArray.length > 0 && (b = !0) : b = !0 : b = !0 : b = !0 : (b = !0, v.__version = r.version);
			let S = v.currentProgram;
			b === !0 && (S = vt(r, t, i), D && r.isNodeMaterial && D.onUpdateProgram(r, S, v));
			let C = !1, w = !1, E = !1, O = S.getUniforms(), k = v.uniforms;
			if (F.useProgram(S.program) && (C = !0, w = !0, E = !0), r.id !== ne && (ne = r.id, w = !0), v.needsLights) {
				let e = xt(x.state.lightProbeGridArray, i);
				v.lightProbeGrid !== e && (v.lightProbeGrid = e, w = !0);
			}
			if (C || re !== e) {
				F.buffers.depth.getReversed() && e.reversedDepth !== !0 && (e._reversedDepth = !0, e.updateProjectionMatrix()), O.setValue(P, "projectionMatrix", e.projectionMatrix), O.setValue(P, "viewMatrix", e.matrixWorldInverse);
				let t = O.map.cameraPosition;
				t !== void 0 && t.setValue(P, ye.setFromMatrixPosition(e.matrixWorld)), Ee.logarithmicDepthBuffer && O.setValue(P, "logDepthBufFC", 2 / (Math.log(e.far + 1) / Math.LN2)), (r.isMeshPhongMaterial || r.isMeshToonMaterial || r.isMeshLambertMaterial || r.isMeshBasicMaterial || r.isMeshStandardMaterial || r.isShaderMaterial) && O.setValue(P, "isOrthographic", e.isOrthographicCamera === !0), re !== e && (re = e, w = !0, E = !0);
			}
			if (v.needsLights && (y.state.directionalShadowMap.length > 0 && O.setValue(P, "directionalShadowMap", y.state.directionalShadowMap, L), y.state.spotShadowMap.length > 0 && O.setValue(P, "spotShadowMap", y.state.spotShadowMap, L), y.state.pointShadowMap.length > 0 && O.setValue(P, "pointShadowMap", y.state.pointShadowMap, L)), i.isSkinnedMesh) {
				O.setOptional(P, i, "bindMatrix"), O.setOptional(P, i, "bindMatrixInverse");
				let e = i.skeleton;
				e && (e.boneTexture === null && e.computeBoneTexture(), O.setValue(P, "boneTexture", e.boneTexture, L));
			}
			i.isBatchedMesh && (O.setOptional(P, i, "batchingTexture"), O.setValue(P, "batchingTexture", i._matricesTexture, L), O.setOptional(P, i, "batchingIdTexture"), O.setValue(P, "batchingIdTexture", i._indirectTexture, L), O.setOptional(P, i, "batchingColorTexture"), i._colorsTexture !== null && O.setValue(P, "batchingColorTexture", i._colorsTexture, L));
			let A = n.morphAttributes;
			if ((A.position !== void 0 || A.normal !== void 0 || A.color !== void 0) && ze.update(i, n, S), (w || v.receiveShadow !== i.receiveShadow) && (v.receiveShadow = i.receiveShadow, O.setValue(P, "receiveShadow", i.receiveShadow)), (r.isMeshStandardMaterial || r.isMeshLambertMaterial || r.isMeshPhongMaterial) && r.envMap === null && t.environment !== null && (k.envMapIntensity.value = t.environmentIntensity), k.dfgLUT !== void 0 && (k.dfgLUT.value = h_()), w) {
				if (O.setValue(P, "toneMappingExposure", T.toneMappingExposure), v.needsLights && Ct(k, E), a && r.fog === !0 && Ne.refreshFogUniforms(k, a), Ne.refreshMaterialUniforms(k, r, le, ce, x.state.transmissionRenderTarget[e.id]), v.needsLights && v.lightProbeGrid) {
					let e = v.lightProbeGrid;
					k.probesSH.value = e.texture, k.probesMin.value.copy(e.boundingBox.min), k.probesMax.value.copy(e.boundingBox.max), k.probesResolution.value.copy(e.resolution);
				}
				Jh.upload(P, yt(v), k, L);
			}
			if (r.isShaderMaterial && r.uniformsNeedUpdate === !0 && (Jh.upload(P, yt(v), k, L), r.uniformsNeedUpdate = !1), r.isSpriteMaterial && O.setValue(P, "center", i.center), O.setValue(P, "modelViewMatrix", i.modelViewMatrix), O.setValue(P, "normalMatrix", i.normalMatrix), O.setValue(P, "modelMatrix", i.matrixWorld), r.uniformsGroups !== void 0) {
				let e = r.uniformsGroups;
				for (let t = 0, n = e.length; t < n; t++) {
					let n = e[t];
					We.update(n, S), We.bind(n, S);
				}
			}
			return S;
		}
		function Ct(e, t) {
			e.ambientLightColor.needsUpdate = t, e.lightProbe.needsUpdate = t, e.directionalLights.needsUpdate = t, e.directionalLightShadows.needsUpdate = t, e.pointLights.needsUpdate = t, e.pointLightShadows.needsUpdate = t, e.spotLights.needsUpdate = t, e.spotLightShadows.needsUpdate = t, e.rectAreaLights.needsUpdate = t, e.hemisphereLights.needsUpdate = t;
		}
		function Tt(e) {
			return e.isMeshLambertMaterial || e.isMeshToonMaterial || e.isMeshPhongMaterial || e.isMeshStandardMaterial || e.isShadowMaterial || e.isShaderMaterial && e.lights === !0;
		}
		this.getActiveCubeFace = function() {
			return ee;
		}, this.getActiveMipmapLevel = function() {
			return te;
		}, this.getRenderTarget = function() {
			return j;
		}, this.setRenderTargetTextures = function(e, t, n) {
			let r = I.get(e);
			r.__autoAllocateDepthBuffer = e.resolveDepthBuffer === !1, r.__autoAllocateDepthBuffer === !1 && (r.__useRenderToTexture = !1), I.get(e.texture).__webglTexture = t, I.get(e.depthTexture).__webglTexture = r.__autoAllocateDepthBuffer ? void 0 : n, r.__hasExternalTextures = !0;
		}, this.setRenderTargetFramebuffer = function(e, t) {
			let n = I.get(e);
			n.__webglFramebuffer = t, n.__useDefaultFramebuffer = t === void 0;
		}, this.setRenderTarget = function(e, t = 0, n = 0) {
			j = e, ee = t, te = n;
			let r = null, i = !1, a = !1;
			if (e) {
				let o = I.get(e);
				if (o.__useDefaultFramebuffer !== void 0) {
					F.bindFramebuffer(P.FRAMEBUFFER, o.__webglFramebuffer), M.copy(e.viewport), ie.copy(e.scissor), ae = e.scissorTest, F.viewport(M), F.scissor(ie), F.setScissorTest(ae), ne = -1;
					return;
				} else if (o.__webglFramebuffer === void 0) L.setupRenderTarget(e);
				else if (o.__hasExternalTextures) L.rebindTextures(e, I.get(e.texture).__webglTexture, I.get(e.depthTexture).__webglTexture);
				else if (e.depthBuffer) {
					let t = e.depthTexture;
					if (o.__boundDepthTexture !== t) {
						if (t !== null && I.has(t) && (e.width !== t.image.width || e.height !== t.image.height)) throw Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");
						L.setupDepthRenderbuffer(e);
					}
				}
				let s = e.texture;
				(s.isData3DTexture || s.isDataArrayTexture || s.isCompressedArrayTexture) && (a = !0);
				let c = I.get(e).__webglFramebuffer;
				e.isWebGLCubeRenderTarget ? (r = Array.isArray(c[t]) ? c[t][n] : c[t], i = !0) : r = e.samples > 0 && L.useMultisampledRTT(e) === !1 ? I.get(e).__webglMultisampledFramebuffer : Array.isArray(c) ? c[n] : c, M.copy(e.viewport), ie.copy(e.scissor), ae = e.scissorTest;
			} else M.copy(fe).multiplyScalar(le).floor(), ie.copy(pe).multiplyScalar(le).floor(), ae = me;
			if (n !== 0 && (r = O), F.bindFramebuffer(P.FRAMEBUFFER, r) && F.drawBuffers(e, r), F.viewport(M), F.scissor(ie), F.setScissorTest(ae), i) {
				let r = I.get(e.texture);
				P.framebufferTexture2D(P.FRAMEBUFFER, P.COLOR_ATTACHMENT0, P.TEXTURE_CUBE_MAP_POSITIVE_X + t, r.__webglTexture, n);
			} else if (a) {
				let r = t;
				for (let t = 0; t < e.textures.length; t++) {
					let i = I.get(e.textures[t]);
					P.framebufferTextureLayer(P.FRAMEBUFFER, P.COLOR_ATTACHMENT0 + t, i.__webglTexture, n, r);
				}
			} else if (e !== null && n !== 0) {
				let t = I.get(e.texture);
				P.framebufferTexture2D(P.FRAMEBUFFER, P.COLOR_ATTACHMENT0, P.TEXTURE_2D, t.__webglTexture, n);
			}
			ne = -1;
		}, this.readRenderTargetPixels = function(e, t, n, r, i, a, o, s = 0) {
			if (!(e && e.isWebGLRenderTarget)) {
				z("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");
				return;
			}
			let c = I.get(e).__webglFramebuffer;
			if (e.isWebGLCubeRenderTarget && o !== void 0 && (c = c[o]), c) {
				F.bindFramebuffer(P.FRAMEBUFFER, c);
				try {
					let o = e.textures[s], c = o.format, l = o.type;
					if (e.textures.length > 1 && P.readBuffer(P.COLOR_ATTACHMENT0 + s), !Ee.textureFormatReadable(c)) {
						z("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");
						return;
					}
					if (!Ee.textureTypeReadable(l)) {
						z("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");
						return;
					}
					t >= 0 && t <= e.width - r && n >= 0 && n <= e.height - i && P.readPixels(t, n, r, i, He.convert(c), He.convert(l), a);
				} finally {
					let e = j === null ? null : I.get(j).__webglFramebuffer;
					F.bindFramebuffer(P.FRAMEBUFFER, e);
				}
			}
		}, this.readRenderTargetPixelsAsync = async function(e, t, n, r, i, a, o, s = 0) {
			if (!(e && e.isWebGLRenderTarget)) throw Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");
			let c = I.get(e).__webglFramebuffer;
			if (e.isWebGLCubeRenderTarget && o !== void 0 && (c = c[o]), c) if (t >= 0 && t <= e.width - r && n >= 0 && n <= e.height - i) {
				F.bindFramebuffer(P.FRAMEBUFFER, c);
				let o = e.textures[s], l = o.format, u = o.type;
				if (e.textures.length > 1 && P.readBuffer(P.COLOR_ATTACHMENT0 + s), !Ee.textureFormatReadable(l)) throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");
				if (!Ee.textureTypeReadable(u)) throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");
				let d = P.createBuffer();
				P.bindBuffer(P.PIXEL_PACK_BUFFER, d), P.bufferData(P.PIXEL_PACK_BUFFER, a.byteLength, P.STREAM_READ), P.readPixels(t, n, r, i, He.convert(l), He.convert(u), 0);
				let f = j === null ? null : I.get(j).__webglFramebuffer;
				F.bindFramebuffer(P.FRAMEBUFFER, f);
				let p = P.fenceSync(P.SYNC_GPU_COMMANDS_COMPLETE, 0);
				return P.flush(), await mr(P, p, 4), P.bindBuffer(P.PIXEL_PACK_BUFFER, d), P.getBufferSubData(P.PIXEL_PACK_BUFFER, 0, a), P.deleteBuffer(d), P.deleteSync(p), a;
			} else throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.");
		}, this.copyFramebufferToTexture = function(e, t = null, n = 0) {
			let r = 2 ** -n, i = Math.floor(e.image.width * r), a = Math.floor(e.image.height * r), o = t === null ? 0 : t.x, s = t === null ? 0 : t.y;
			L.setTexture2D(e, 0), P.copyTexSubImage2D(P.TEXTURE_2D, n, 0, 0, o, s, i, a), F.unbindTexture();
		}, this.copyTextureToTexture = function(e, t, n = null, r = null, i = 0, a = 0) {
			let o, s, c, l, u, d, f, p, m, h = e.isCompressedTexture ? e.mipmaps[a] : e.image;
			if (n !== null) o = n.max.x - n.min.x, s = n.max.y - n.min.y, c = n.isBox3 ? n.max.z - n.min.z : 1, l = n.min.x, u = n.min.y, d = n.isBox3 ? n.min.z : 0;
			else {
				let t = 2 ** -i;
				o = Math.floor(h.width * t), s = Math.floor(h.height * t), c = e.isDataArrayTexture ? h.depth : e.isData3DTexture ? Math.floor(h.depth * t) : 1, l = 0, u = 0, d = 0;
			}
			r === null ? (f = 0, p = 0, m = 0) : (f = r.x, p = r.y, m = r.z);
			let g = He.convert(t.format), _ = He.convert(t.type), v;
			t.isData3DTexture ? (L.setTexture3D(t, 0), v = P.TEXTURE_3D) : t.isDataArrayTexture || t.isCompressedArrayTexture ? (L.setTexture2DArray(t, 0), v = P.TEXTURE_2D_ARRAY) : (L.setTexture2D(t, 0), v = P.TEXTURE_2D), F.activeTexture(P.TEXTURE0), F.pixelStorei(P.UNPACK_FLIP_Y_WEBGL, t.flipY), F.pixelStorei(P.UNPACK_PREMULTIPLY_ALPHA_WEBGL, t.premultiplyAlpha), F.pixelStorei(P.UNPACK_ALIGNMENT, t.unpackAlignment);
			let y = F.getParameter(P.UNPACK_ROW_LENGTH), b = F.getParameter(P.UNPACK_IMAGE_HEIGHT), x = F.getParameter(P.UNPACK_SKIP_PIXELS), S = F.getParameter(P.UNPACK_SKIP_ROWS), C = F.getParameter(P.UNPACK_SKIP_IMAGES);
			F.pixelStorei(P.UNPACK_ROW_LENGTH, h.width), F.pixelStorei(P.UNPACK_IMAGE_HEIGHT, h.height), F.pixelStorei(P.UNPACK_SKIP_PIXELS, l), F.pixelStorei(P.UNPACK_SKIP_ROWS, u), F.pixelStorei(P.UNPACK_SKIP_IMAGES, d);
			let w = e.isDataArrayTexture || e.isData3DTexture, T = t.isDataArrayTexture || t.isData3DTexture;
			if (e.isDepthTexture) {
				let n = I.get(e), r = I.get(t), h = I.get(n.__renderTarget), g = I.get(r.__renderTarget);
				F.bindFramebuffer(P.READ_FRAMEBUFFER, h.__webglFramebuffer), F.bindFramebuffer(P.DRAW_FRAMEBUFFER, g.__webglFramebuffer);
				for (let n = 0; n < c; n++) w && (P.framebufferTextureLayer(P.READ_FRAMEBUFFER, P.COLOR_ATTACHMENT0, I.get(e).__webglTexture, i, d + n), P.framebufferTextureLayer(P.DRAW_FRAMEBUFFER, P.COLOR_ATTACHMENT0, I.get(t).__webglTexture, a, m + n)), P.blitFramebuffer(l, u, o, s, f, p, o, s, P.DEPTH_BUFFER_BIT, P.NEAREST);
				F.bindFramebuffer(P.READ_FRAMEBUFFER, null), F.bindFramebuffer(P.DRAW_FRAMEBUFFER, null);
			} else if (i !== 0 || e.isRenderTargetTexture || I.has(e)) {
				let n = I.get(e), r = I.get(t);
				F.bindFramebuffer(P.READ_FRAMEBUFFER, k), F.bindFramebuffer(P.DRAW_FRAMEBUFFER, A);
				for (let e = 0; e < c; e++) w ? P.framebufferTextureLayer(P.READ_FRAMEBUFFER, P.COLOR_ATTACHMENT0, n.__webglTexture, i, d + e) : P.framebufferTexture2D(P.READ_FRAMEBUFFER, P.COLOR_ATTACHMENT0, P.TEXTURE_2D, n.__webglTexture, i), T ? P.framebufferTextureLayer(P.DRAW_FRAMEBUFFER, P.COLOR_ATTACHMENT0, r.__webglTexture, a, m + e) : P.framebufferTexture2D(P.DRAW_FRAMEBUFFER, P.COLOR_ATTACHMENT0, P.TEXTURE_2D, r.__webglTexture, a), i === 0 ? T ? P.copyTexSubImage3D(v, a, f, p, m + e, l, u, o, s) : P.copyTexSubImage2D(v, a, f, p, l, u, o, s) : P.blitFramebuffer(l, u, o, s, f, p, o, s, P.COLOR_BUFFER_BIT, P.NEAREST);
				F.bindFramebuffer(P.READ_FRAMEBUFFER, null), F.bindFramebuffer(P.DRAW_FRAMEBUFFER, null);
			} else T ? e.isDataTexture || e.isData3DTexture ? P.texSubImage3D(v, a, f, p, m, o, s, c, g, _, h.data) : t.isCompressedArrayTexture ? P.compressedTexSubImage3D(v, a, f, p, m, o, s, c, g, h.data) : P.texSubImage3D(v, a, f, p, m, o, s, c, g, _, h) : e.isDataTexture ? P.texSubImage2D(P.TEXTURE_2D, a, f, p, o, s, g, _, h.data) : e.isCompressedTexture ? P.compressedTexSubImage2D(P.TEXTURE_2D, a, f, p, h.width, h.height, g, h.data) : P.texSubImage2D(P.TEXTURE_2D, a, f, p, o, s, g, _, h);
			F.pixelStorei(P.UNPACK_ROW_LENGTH, y), F.pixelStorei(P.UNPACK_IMAGE_HEIGHT, b), F.pixelStorei(P.UNPACK_SKIP_PIXELS, x), F.pixelStorei(P.UNPACK_SKIP_ROWS, S), F.pixelStorei(P.UNPACK_SKIP_IMAGES, C), a === 0 && t.generateMipmaps && P.generateMipmap(v), F.unbindTexture();
		}, this.initRenderTarget = function(e) {
			I.get(e).__webglFramebuffer === void 0 && L.setupRenderTarget(e);
		}, this.initTexture = function(e) {
			e.isCubeTexture ? L.setTextureCube(e, 0) : e.isData3DTexture ? L.setTexture3D(e, 0) : e.isDataArrayTexture || e.isCompressedArrayTexture ? L.setTexture2DArray(e, 0) : L.setTexture2D(e, 0), F.unbindTexture();
		}, this.resetState = function() {
			ee = 0, te = 0, j = null, F.reset(), Ue.reset();
		}, typeof __THREE_DEVTOOLS__ < "u" && __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", { detail: this }));
	}
	get coordinateSystem() {
		return Yn;
	}
	get outputColorSpace() {
		return this._outputColorSpace;
	}
	set outputColorSpace(e) {
		this._outputColorSpace = e;
		let t = this.getContext();
		t.drawingBufferColorSpace = G._getDrawingBufferColorSpace(e), t.unpackColorSpace = G._getUnpackColorSpace();
	}
};
//#endregion
//#region src/services/service-validation-report.ts
function __(e, t, n, r) {
	e.error(t, n, {
		refs: r.refs,
		context: { path: r.path }
	});
}
//#endregion
//#region src/ace/adapters/named-colors.ts
var v_ = {
	aliceblue: [
		240,
		248,
		255
	],
	antiquewhite: [
		250,
		235,
		215
	],
	aqua: [
		0,
		255,
		255
	],
	aquamarine: [
		127,
		255,
		212
	],
	azure: [
		240,
		255,
		255
	],
	beige: [
		245,
		245,
		220
	],
	bisque: [
		255,
		228,
		196
	],
	black: [
		0,
		0,
		0
	],
	blanchedalmond: [
		255,
		235,
		205
	],
	blue: [
		0,
		0,
		255
	],
	blueviolet: [
		138,
		43,
		226
	],
	brown: [
		165,
		42,
		42
	],
	burlywood: [
		222,
		184,
		135
	],
	cadetblue: [
		95,
		158,
		160
	],
	chartreuse: [
		127,
		255,
		0
	],
	chocolate: [
		210,
		105,
		30
	],
	coral: [
		255,
		127,
		80
	],
	cornflowerblue: [
		100,
		149,
		237
	],
	cornsilk: [
		255,
		248,
		220
	],
	crimson: [
		220,
		20,
		60
	],
	cyan: [
		0,
		255,
		255
	],
	darkblue: [
		0,
		0,
		139
	],
	darkcyan: [
		0,
		139,
		139
	],
	darkgoldenrod: [
		184,
		134,
		11
	],
	darkgray: [
		169,
		169,
		169
	],
	darkgrey: [
		169,
		169,
		169
	],
	darkgreen: [
		0,
		100,
		0
	],
	darkkhaki: [
		189,
		183,
		107
	],
	darkmagenta: [
		139,
		0,
		139
	],
	darkolivegreen: [
		85,
		107,
		47
	],
	darkorange: [
		255,
		140,
		0
	],
	darkorchid: [
		153,
		50,
		204
	],
	darkred: [
		139,
		0,
		0
	],
	darksalmon: [
		233,
		150,
		122
	],
	darkseagreen: [
		143,
		188,
		143
	],
	darkslateblue: [
		72,
		61,
		139
	],
	darkslategray: [
		47,
		79,
		79
	],
	darkslategrey: [
		47,
		79,
		79
	],
	darkturquoise: [
		0,
		206,
		209
	],
	darkviolet: [
		148,
		0,
		211
	],
	deeppink: [
		255,
		20,
		147
	],
	deepskyblue: [
		0,
		191,
		255
	],
	dimgray: [
		105,
		105,
		105
	],
	dimgrey: [
		105,
		105,
		105
	],
	dodgerblue: [
		30,
		144,
		255
	],
	firebrick: [
		178,
		34,
		34
	],
	floralwhite: [
		255,
		250,
		240
	],
	forestgreen: [
		34,
		139,
		34
	],
	fuchsia: [
		255,
		0,
		255
	],
	gainsboro: [
		220,
		220,
		220
	],
	ghostwhite: [
		248,
		248,
		255
	],
	gold: [
		255,
		215,
		0
	],
	goldenrod: [
		218,
		165,
		32
	],
	gray: [
		128,
		128,
		128
	],
	grey: [
		128,
		128,
		128
	],
	green: [
		0,
		128,
		0
	],
	greenyellow: [
		173,
		255,
		47
	],
	honeydew: [
		240,
		255,
		240
	],
	hotpink: [
		255,
		105,
		180
	],
	indianred: [
		205,
		92,
		92
	],
	indigo: [
		75,
		0,
		130
	],
	ivory: [
		255,
		255,
		240
	],
	khaki: [
		240,
		230,
		140
	],
	lavender: [
		230,
		230,
		250
	],
	lavenderblush: [
		255,
		240,
		245
	],
	lawngreen: [
		124,
		252,
		0
	],
	lemonchiffon: [
		255,
		250,
		205
	],
	lightblue: [
		173,
		216,
		230
	],
	lightcoral: [
		240,
		128,
		128
	],
	lightcyan: [
		224,
		255,
		255
	],
	lightgoldenrodyellow: [
		250,
		250,
		210
	],
	lightgray: [
		211,
		211,
		211
	],
	lightgrey: [
		211,
		211,
		211
	],
	lightgreen: [
		144,
		238,
		144
	],
	lightpink: [
		255,
		182,
		193
	],
	lightsalmon: [
		255,
		160,
		122
	],
	lightseagreen: [
		32,
		178,
		170
	],
	lightskyblue: [
		135,
		206,
		250
	],
	lightslategray: [
		119,
		136,
		153
	],
	lightslategrey: [
		119,
		136,
		153
	],
	lightsteelblue: [
		176,
		196,
		222
	],
	lightyellow: [
		255,
		255,
		224
	],
	lime: [
		0,
		255,
		0
	],
	limegreen: [
		50,
		205,
		50
	],
	linen: [
		250,
		240,
		230
	],
	magenta: [
		255,
		0,
		255
	],
	maroon: [
		128,
		0,
		0
	],
	mediumaquamarine: [
		102,
		205,
		170
	],
	mediumblue: [
		0,
		0,
		205
	],
	mediumorchid: [
		186,
		85,
		211
	],
	mediumpurple: [
		147,
		112,
		219
	],
	mediumseagreen: [
		60,
		179,
		113
	],
	mediumslateblue: [
		123,
		104,
		238
	],
	mediumspringgreen: [
		0,
		250,
		154
	],
	mediumturquoise: [
		72,
		209,
		204
	],
	mediumvioletred: [
		199,
		21,
		133
	],
	midnightblue: [
		25,
		25,
		112
	],
	mintcream: [
		245,
		255,
		250
	],
	mistyrose: [
		255,
		228,
		225
	],
	moccasin: [
		255,
		228,
		181
	],
	navajowhite: [
		255,
		222,
		173
	],
	navy: [
		0,
		0,
		128
	],
	oldlace: [
		253,
		245,
		230
	],
	olive: [
		128,
		128,
		0
	],
	olivedrab: [
		107,
		142,
		35
	],
	orange: [
		255,
		165,
		0
	],
	orangered: [
		255,
		69,
		0
	],
	orchid: [
		218,
		112,
		214
	],
	palegoldenrod: [
		238,
		232,
		170
	],
	palegreen: [
		152,
		251,
		152
	],
	paleturquoise: [
		175,
		238,
		238
	],
	palevioletred: [
		219,
		112,
		147
	],
	papayawhip: [
		255,
		239,
		213
	],
	peachpuff: [
		255,
		218,
		185
	],
	peru: [
		205,
		133,
		63
	],
	pink: [
		255,
		192,
		203
	],
	plum: [
		221,
		160,
		221
	],
	powderblue: [
		176,
		224,
		230
	],
	purple: [
		128,
		0,
		128
	],
	rebeccapurple: [
		102,
		51,
		153
	],
	red: [
		255,
		0,
		0
	],
	rosybrown: [
		188,
		143,
		143
	],
	royalblue: [
		65,
		105,
		225
	],
	saddlebrown: [
		139,
		69,
		19
	],
	salmon: [
		250,
		128,
		114
	],
	sandybrown: [
		244,
		164,
		96
	],
	seagreen: [
		46,
		139,
		87
	],
	seashell: [
		255,
		245,
		238
	],
	sienna: [
		160,
		82,
		45
	],
	silver: [
		192,
		192,
		192
	],
	skyblue: [
		135,
		206,
		235
	],
	slateblue: [
		106,
		90,
		205
	],
	slategray: [
		112,
		128,
		144
	],
	slategrey: [
		112,
		128,
		144
	],
	snow: [
		255,
		250,
		250
	],
	springgreen: [
		0,
		255,
		127
	],
	steelblue: [
		70,
		130,
		180
	],
	tan: [
		210,
		180,
		140
	],
	teal: [
		0,
		128,
		128
	],
	thistle: [
		216,
		191,
		216
	],
	tomato: [
		255,
		99,
		71
	],
	turquoise: [
		64,
		224,
		208
	],
	violet: [
		238,
		130,
		238
	],
	wheat: [
		245,
		222,
		179
	],
	white: [
		255,
		255,
		255
	],
	whitesmoke: [
		245,
		245,
		245
	],
	yellow: [
		255,
		255,
		0
	],
	yellowgreen: [
		154,
		205,
		50
	]
};
//#endregion
//#region src/ace/adapters/color-adapter.ts
function y_(e) {
	let t = e.trim().toLowerCase();
	if (t.length === 0) throw Error("ace: color value must not be empty.");
	if (t === "transparent") return b_([
		0,
		0,
		0
	], 0);
	let n = v_[t];
	if (n !== void 0) return b_(n, 1);
	if (t.startsWith("#")) return x_(t);
	let r = /^(rgba?|RGBA?)\((.*)\)$/.exec(t);
	if (r !== null) return S_(r[2]);
	let i = /^oklch\((.*)\)$/.exec(t);
	if (i !== null) return C_(i[1]);
	throw Error(`ace: unsupported color value "${e}".`);
}
function b_(e, t) {
	return {
		kind: "color",
		space: "srgb",
		coords: e.map((e) => e / 255),
		alpha: t
	};
}
function x_(e) {
	let t = e.slice(1);
	if (![
		3,
		4,
		6,
		8
	].includes(t.length) || !/^[\da-f]+$/i.test(t)) throw Error(`ace: invalid hexadecimal color "${e}".`);
	let n = t.length <= 4 ? [...t].map((e) => `${e}${e}`).join("") : t;
	return b_([
		Number.parseInt(n.slice(0, 2), 16),
		Number.parseInt(n.slice(2, 4), 16),
		Number.parseInt(n.slice(4, 6), 16)
	], n.length === 8 ? Number.parseInt(n.slice(6, 8), 16) / 255 : 1);
}
function S_(e) {
	let t = e.split(",").map((e) => e.trim());
	if (t.length >= 3 && t.length <= 4) return b_(t.slice(0, 3).map(O_), t[3] === void 0 ? 1 : k_(t[3]));
	let [n, r] = D_(e), i = n.trim().split(/\s+/).filter(Boolean);
	if (i.length !== 3) throw Error(`ace: invalid rgb color "${e}".`);
	return b_(i.map(O_), r === void 0 ? 1 : k_(r));
}
function C_(e) {
	let [t, n] = D_(e), r = t.trim().split(/\s+/).filter(Boolean);
	if (r.length !== 3) throw Error(`ace: invalid oklch color "${e}".`);
	return {
		kind: "color",
		space: "oklch",
		coords: [
			w_(r[0]),
			T_(r[1]),
			E_(r[2])
		],
		alpha: n === void 0 ? 1 : k_(n)
	};
}
function w_(e) {
	let t = e.trim();
	if (t.endsWith("%")) {
		let n = t.slice(0, -1).trim();
		if (!M_.test(n)) throw Error(`ace: invalid oklch lightness "${e}".`);
		let r = Number(n);
		if (!Number.isFinite(r)) throw Error(`ace: invalid oklch lightness "${e}".`);
		return A_(r / 100, 0, 1);
	}
	if (!M_.test(t)) throw Error(`ace: invalid oklch lightness "${e}".`);
	let n = Number(t);
	if (!Number.isFinite(n)) throw Error(`ace: invalid oklch lightness "${e}".`);
	return A_(n, 0, 1);
}
function T_(e) {
	let t = e.trim();
	if (t.endsWith("%")) {
		let n = t.slice(0, -1).trim();
		if (!M_.test(n)) throw Error(`ace: invalid oklch chroma "${e}".`);
		let r = Number(n);
		if (!Number.isFinite(r)) throw Error(`ace: invalid oklch chroma "${e}".`);
		return Math.max(0, r / 100 * .4);
	}
	if (!M_.test(t)) throw Error(`ace: invalid oklch chroma "${e}".`);
	let n = Number(t);
	if (!Number.isFinite(n)) throw Error(`ace: invalid oklch chroma "${e}".`);
	return Math.max(0, n);
}
function E_(e) {
	let t = e.trim(), n = N_.exec(t);
	if (n !== null) {
		let t = Number(n[1]);
		if (!Number.isFinite(t)) throw Error(`ace: invalid oklch hue "${e}".`);
		let r = n[2].toLowerCase(), i = r === "grad" ? t * .9 : r === "rad" ? t * 180 / Math.PI : r === "turn" ? t * 360 : t;
		if (!Number.isFinite(i)) throw Error(`ace: invalid oklch hue "${e}".`);
		return j_(i);
	}
	if (!M_.test(t)) throw Error(`ace: invalid oklch hue "${e}".`);
	let r = Number(t);
	if (!Number.isFinite(r)) throw Error(`ace: invalid oklch hue "${e}".`);
	return j_(r);
}
function D_(e) {
	let t = e.indexOf("/");
	if (t < 0) return [e, void 0];
	let n = e.slice(t + 1).trim();
	if (e.indexOf("/", t + 1) >= 0 || n.length === 0) throw Error(`ace: invalid color alpha "${n}".`);
	return [e.slice(0, t), n];
}
function O_(e) {
	let t = e.trim();
	if (t.endsWith("%")) {
		let n = t.slice(0, -1).trim();
		if (!M_.test(n)) throw Error(`ace: invalid rgb channel "${e}".`);
		return A_(Number(n), 0, 100) / 100 * 255;
	}
	if (!M_.test(t)) throw Error(`ace: invalid rgb channel "${e}".`);
	return A_(Number(t), 0, 255);
}
function k_(e) {
	let t = e.trim();
	if (t.endsWith("%")) {
		let n = t.slice(0, -1).trim();
		if (!M_.test(n)) throw Error(`ace: invalid color alpha "${e}".`);
		return A_(Number(n), 0, 100) / 100;
	}
	if (!M_.test(t)) throw Error(`ace: invalid color alpha "${e}".`);
	return A_(Number(t), 0, 1);
}
function A_(e, t, n) {
	return Math.min(n, Math.max(t, e));
}
function j_(e) {
	let t = e % 360;
	return t === 0 ? 0 : t < 0 ? t + 360 : t;
}
var M_ = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i, N_ = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)$/i, P_ = (e, t, n) => e < t ? t : e > n ? n : e, F_ = (e) => e, I_ = (e = 1.68) => {
	let t = +e;
	return (e) => e ** +t;
}, L_ = Math.PI / 2, R_ = Math.PI * 2, z_ = (e) => 1 - Math.cos(e * L_), B_ = (e) => 1 - Math.sqrt(1 - e * e), V_ = (e) => e ? 2 ** (10 * e - 10) : 0, H_ = (e) => {
	let t, n = 4;
	for (; e < ((t = 2 ** --n) - 1) / 11;);
	return 1 / 4 ** (3 - n) - 7.5625 * ((t * 3 - 2) / 22 - e) ** 2;
}, U_ = (e = 1.7) => {
	let t = +e;
	return (e) => (t + 1) * e * e * e - t * e * e;
}, W_ = (e = 1, t = .3) => {
	let n = P_(+e, 1, 10), r = P_(+t, 1e-11, 2), i = r / R_ * Math.asin(1 / n), a = R_ / r;
	return (e) => e === 0 || e === 1 ? e : -n * 2 ** (-10 * (1 - e)) * Math.sin((1 - e - i) * a);
}, G_ = {
	in: (e) => (t) => e(t),
	out: (e) => (t) => 1 - e(1 - t),
	inOut: (e) => (t) => t < .5 ? e(t * 2) / 2 : 1 - e(t * -2 + 2) / 2,
	outIn: (e) => (t) => t < .5 ? (1 - e(1 - t * 2)) / 2 : (e(t * 2 - 1) + 1) / 2
}, K_ = {
	Quad: I_(2),
	Cubic: I_(3),
	Quart: I_(4),
	Quint: I_(5),
	Sine: z_,
	Circ: B_,
	Expo: V_,
	Bounce: H_
}, q_ = {
	"": I_,
	Back: U_,
	Elastic: W_
}, J_ = /* @__PURE__ */ new Set();
(() => {
	let e = {
		linear: F_,
		none: F_
	};
	for (let t of Object.keys(G_)) {
		let n = G_[t];
		for (let r in K_) e[t + r] = n(K_[r]);
		for (let r in q_) {
			let i = q_[r], a = t + r;
			e[a] = (...e) => n(i(...e)), J_.add(a);
		}
	}
	return e;
})();
//#endregion
//#region src/ace/adapters/transform-adapter.ts
var Y_ = Object.freeze([
	"perspective",
	"translateX",
	"translateY",
	"translateZ",
	"rotate",
	"rotateX",
	"rotateY",
	"rotateZ",
	"rotate3d",
	"scale",
	"scaleX",
	"scaleY",
	"scaleZ",
	"skew",
	"skewX",
	"skewY",
	"matrix",
	"matrix3d"
]);
new Set(Y_), Math.PI / 180, Math.PI / 200, Math.PI * 2, Object.freeze({
	reorderOnMove: !0,
	reorderOnAdd: !0,
	reorderOnRemove: !0
});
var X_ = {
	name: "attr",
	validate: (e, t) => {
		l(e) || __(t.diagnostics, "AUTHOR_ATTR_INVALID", "attr must be a plain object.", t);
	}
}, Z_ = {
	name: "className",
	validate: (e, t) => {
		if (e !== void 0 && typeof e != "string") {
			if (l(e)) {
				for (let n of Object.keys(e)) if (n !== "add" && n !== "remove") {
					__(t.diagnostics, "AUTHOR_CLASS_NAME_INVALID", "className only accepts add and remove keys.", t);
					return;
				}
				e.add !== void 0 && typeof e.add != "string" && __(t.diagnostics, "AUTHOR_CLASS_NAME_INVALID", "className.add must be a string.", t), e.remove !== void 0 && typeof e.remove != "string" && __(t.diagnostics, "AUTHOR_CLASS_NAME_INVALID", "className.remove must be a string.", t);
				return;
			}
			__(t.diagnostics, "AUTHOR_CLASS_NAME_INVALID", "className must be a string or a plain add/remove object.", t);
		}
	}
}, Q_ = {
	name: "content",
	validate: (e, t) => {
		typeof e == "string" || typeof e == "number" || __(t.diagnostics, "AUTHOR_CONTENT_INVALID", "content must be a string or number in SceneDoc; HTMLElement values are runtime-only.", t);
	}
}, $_ = [
	"color",
	"backgroundColor",
	"borderColor"
], ev = (e, t) => {
	l(e) || __(t.diagnostics, "AUTHOR_STYLE_INVALID", "style must be a plain object.", t);
}, tv = (e, t) => {
	if (t.target === "action" && l(e) && !iv(e)) {
		if (!("to" in e)) {
			nv(t);
			return;
		}
		e.from !== void 0 && !rv(e.from) && nv(t), rv(e.to) || nv(t);
		return;
	}
	rv(e) || nv(t);
};
function nv(e) {
	__(e.diagnostics, "AUTHOR_STYLE_COLOR_INVALID", "style color properties accept named colors, hexadecimal colors, rgb(), rgba() and oklch() values.", e);
}
function rv(e) {
	if (iv(e)) return !0;
	if (typeof e != "string") return !1;
	try {
		return y_(e), !0;
	} catch {
		return !1;
	}
}
function iv(e) {
	return l(e) ? e.kind === "color" && (e.space === "srgb" || e.space === "oklch") && Array.isArray(e.coords) && e.coords.every((e) => typeof e == "number" && Number.isFinite(e)) && typeof e.alpha == "number" && Number.isFinite(e.alpha) : !1;
}
var av = (e) => {
	if (!l(e)) return e;
	let t = { ...e };
	for (let e of $_) e in t && (t[e] = ov(t[e]));
	return t;
};
function ov(e) {
	if (typeof e == "string") return y_(e);
	if (!l(e) || iv(e)) return e;
	let t = { ...e };
	return typeof t.from == "string" && (t.from = y_(t.from)), typeof t.to == "string" && (t.to = y_(t.to)), t;
}
var sv = {
	name: "style",
	validate: ev,
	sanitize: av,
	properties: $_.map((e) => ({
		name: e,
		validate: tv
	})),
	allowUnknownProperties: !0
};
({ ...X_ }), { ...Z_ }, { ...Q_ }, { ...sv };
//#endregion
//#region ../demos/scene-export/engine-config.ts
var cv = ke.libraries?.register?.[0], lv = ee.libraries?.register?.[0];
if (cv === void 0 || lv === void 0) throw Error("The scene export demo requires the existing Rive and Three.js library definitions.");
var uv = {
	components: { register: [
		...ke.components?.register ?? [],
		...ee.components?.register ?? [],
		ge
	] },
	libraries: { register: [{
		...cv,
		module: "@rive-app/canvas",
		delivery: { mode: "package" }
	}, {
		...lv,
		module: "three",
		delivery: { mode: "package" }
	}] }
}, dv = {
	...Ce,
	...re
};
//#endregion
export { uv as engineCapabilities, dv as preloadStrategies };
