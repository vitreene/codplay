//#region ../codplay/src/runtime/preload/preload-cache.ts
var e = class {
	entries = /* @__PURE__ */ new Map();
	get(e) {
		return this.entries.get(e)?.entry;
	}
	claim(e, t) {
		let n = this.entries.get(e);
		if (n !== void 0) return n.owners.add(t), n.entry;
	}
	start(e, t, n, r) {
		let i = {
			url: e,
			status: "loading",
			promise: n
		};
		return this.entries.set(e, {
			entry: i,
			owners: /* @__PURE__ */ new Set([t]),
			controller: r
		}), i;
	}
	markReady(e, t, n, r) {
		let i = this.entries.get(e);
		if (i?.entry !== t) return;
		let a = r === void 0 ? n : {
			metadata: n,
			media: r
		};
		i.entry = {
			url: e,
			status: "ready",
			promise: Promise.resolve(a),
			metadata: n,
			media: r
		};
	}
	markError(e, t, n) {
		let r = this.entries.get(e);
		r?.entry === t && (r.entry = {
			url: e,
			status: "error",
			promise: Promise.resolve(),
			error: n
		});
	}
	release(e, t) {
		for (let n of t) {
			let t = this.entries.get(n);
			t !== void 0 && (t.owners.delete(e), !(t.owners.size > 0) && (t.entry.status === "loading" && t.controller.abort(), t.entry.media?.release(), this.entries.delete(n)));
		}
	}
};
function t() {
	return new e();
}
//#endregion
//#region ../codplay/src/runtime/preload/preload-media-resource.ts
function n(e, t) {
	let n, r = !1, i = 1, a = !1, o = () => {
		if (a) return;
		a = !0, e.pause();
		let t = e.parentNode;
		t !== null && t.removeChild(e), e.removeAttribute("src");
	}, s = {
		type: t,
		retain: () => {
			a || (i += 1);
		},
		release: () => {
			i !== 0 && (--i, i === 0 && o());
		},
		take: () => {
			if (a || r) return;
			r = !0, i += 1;
			let t = {
				node: e,
				release: () => {
					if (n !== t) return;
					n = void 0;
					let r = e.parentNode;
					r !== null && r.removeChild(e), s.release();
				}
			};
			return n = t, t;
		}
	};
	return s;
}
function r(e) {
	e.style.cssText = "";
}
//#endregion
//#region ../codplay/src/runtime/preload/preload-strategies.ts
function i() {
	if (typeof DOMException < "u") return new DOMException("Aborted", "AbortError");
	let e = /* @__PURE__ */ Error("Aborted");
	return e.name = "AbortError", e;
}
function a(e, t) {
	return new Promise((n, r) => {
		let i = setTimeout(() => r(/* @__PURE__ */ Error(`Preload timeout after ${t}ms`)), t);
		e.then((e) => {
			clearTimeout(i), n(e);
		}, (e) => {
			clearTimeout(i), r(e);
		});
	});
}
function o(e, t) {
	return new Promise((n, r) => {
		if (t.aborted) {
			r(i());
			return;
		}
		if (globalThis.Image === void 0) {
			r(/* @__PURE__ */ Error("Image preload requires a browser Image implementation."));
			return;
		}
		let a = new globalThis.Image(), o = !1, s = () => t.removeEventListener("abort", u), c = () => {
			o || (o = !0, s(), n({ type: "image" }));
		}, l = (e) => {
			o || (o = !0, s(), r(Error(e)));
		}, u = () => {
			o || (o = !0, s(), r(i()));
		};
		t.addEventListener("abort", u, { once: !0 }), a.onload = () => {
			let t = a.decode;
			if (typeof t != "function") {
				c();
				return;
			}
			Promise.resolve().then(() => t.call(a)).then(() => c(), () => l(`Failed to decode image: ${e}`));
		}, a.onerror = () => {
			l(`Failed to load image: ${e}`);
		}, a.src = e;
	});
}
function s(e, t) {
	return new Promise((r, a) => {
		if (t.aborted) {
			a(i());
			return;
		}
		if (globalThis.Audio === void 0) {
			a(/* @__PURE__ */ Error("Audio preload requires a browser Audio implementation."));
			return;
		}
		let o = new globalThis.Audio(), s = n(o, "audio");
		o.preload = "auto";
		let c = () => {
			o.removeEventListener("canplaythrough", l), o.removeEventListener("error", u), t.removeEventListener("abort", d);
		}, l = () => {
			c();
			let e = Number.isFinite(o.duration) ? Math.max(0, o.duration * 1e3) : void 0;
			r({
				metadata: {
					type: "audio",
					...e === void 0 ? {} : { durationMs: e }
				},
				media: s
			});
		}, u = () => {
			c(), s.release(), a(/* @__PURE__ */ Error(`Failed to load audio: ${e}`));
		}, d = () => {
			c(), s.release(), a(i());
		};
		o.addEventListener("canplaythrough", l), o.addEventListener("error", u), t.addEventListener("abort", d, { once: !0 }), o.src = e, o.load();
	});
}
function c(e, t) {
	return new Promise((r, a) => {
		if (t.aborted) {
			a(i());
			return;
		}
		if (globalThis.document === void 0) {
			a(/* @__PURE__ */ Error("Video preload requires a browser document."));
			return;
		}
		let o = globalThis.document.createElement("video");
		o.preload = "auto", o.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none";
		let s = globalThis.document.body ?? globalThis.document.documentElement;
		if (s === null) {
			a(/* @__PURE__ */ Error("Video preload requires a document mount point."));
			return;
		}
		s.appendChild(o);
		let c = n(o, "video"), l = () => {
			o.removeEventListener("canplaythrough", u), o.removeEventListener("error", d), t.removeEventListener("abort", f);
		}, u = () => {
			l();
			let e = Number.isFinite(o.duration) ? Math.max(0, o.duration * 1e3) : void 0;
			r({
				metadata: {
					type: "video",
					...e === void 0 ? {} : { durationMs: e }
				},
				media: c
			});
		}, d = () => {
			l(), c.release(), a(/* @__PURE__ */ Error(`Failed to load video: ${e}`));
		}, f = () => {
			l(), c.release(), a(i());
		};
		o.addEventListener("canplaythrough", u), o.addEventListener("error", d), t.addEventListener("abort", f, { once: !0 }), o.src = e, o.load();
	});
}
function l(e, t) {
	if (t.aborted) return Promise.reject(i());
	if (globalThis.FontFace === void 0 || globalThis.document === void 0 || globalThis.document.fonts === void 0) return Promise.reject(/* @__PURE__ */ Error("Font preload requires the browser FontFace API."));
	let n = e.split("/").pop()?.split(".")[0] ?? "codplay-preloaded-font", r = new globalThis.FontFace(n, `url(${e})`);
	return globalThis.document.fonts.add(r), r.load().then(() => void 0);
}
var u = "data-codplay-scope", d = 0;
function f(e) {
	let t = e.getAttribute(u);
	if (t !== null && t.length > 0) return `[${u}="${t}"]`;
	d += 1;
	let n = `cp-scope-${d}`;
	return e.setAttribute(u, n), `[${u}="${n}"]`;
}
function p(e, t, n) {
	return n == null ? new Promise((n, r) => {
		if (t.aborted) {
			r(i());
			return;
		}
		if (globalThis.document === void 0) {
			r(/* @__PURE__ */ Error("CSS preload requires a browser document."));
			return;
		}
		let a = globalThis.document.createElement("link");
		a.rel = "stylesheet", a.href = e;
		let o = () => t.removeEventListener("abort", s), s = () => {
			o(), a.remove(), r(i());
		};
		t.addEventListener("abort", s, { once: !0 }), a.onload = () => {
			o(), n();
		}, a.onerror = () => {
			o(), r(/* @__PURE__ */ Error(`Failed to load CSS: ${e}`));
		}, globalThis.document.head.appendChild(a);
	}) : h(e, t, n);
}
function m(e, t) {
	if (globalThis.document === void 0) throw Error("CSS preload requires a browser document.");
	return `@scope (${f(t)}) {\n${e}\n}`;
}
async function h(e, t, n) {
	if (t.aborted) throw i();
	let r = await fetch(e, { signal: t });
	if (!r.ok) throw Error(`Failed to load CSS: ${e}`);
	let a = await r.text();
	if (globalThis.document === void 0) throw Error("CSS preload requires a browser document.");
	let o = globalThis.document.createElement("style");
	o.textContent = m(a, n), globalThis.document.head.appendChild(o);
}
//#endregion
//#region ../codplay/src/runtime/preload/create-runtime-preload.ts
var g = 1e4;
function _(e) {
	let t = Array.isArray(e) ? e : [e], n = /* @__PURE__ */ new Map();
	for (let e of t) for (let t of e.entries) n.has(t.url) || n.set(t.url, t);
	return { entries: [...n.values()] };
}
function v(e = {}) {
	let n = e.cache ?? t(), r = Symbol("codplay-preload-owner"), i = new Map(Object.entries(e.strategies ?? {})), u = {
		status: "idle",
		loadedCount: 0,
		totalCount: 0
	}, d, f = /* @__PURE__ */ new Map();
	function h(e) {
		if (y(e), globalThis.document === void 0) throw Error("Inline CSS preload requires a browser document.");
		let t = globalThis.document.head;
		if (t === null) throw Error("Inline CSS preload requires a document head.");
		let n = f.get(e.slot) ?? globalThis.document.createElement("style");
		n.setAttribute("data-codplay-preload-css-slot", e.slot), n.textContent = m(e.cssText, e.container), n.parentNode === null && t.appendChild(n), f.set(e.slot, n);
	}
	function v(e) {
		let t = e === void 0 ? [...f.keys()] : [e];
		for (let e of t) {
			let t = f.get(e);
			t !== void 0 && (t.remove(), f.delete(e));
		}
	}
	function b(e, t, n, r) {
		let u = e.type === "image" ? o(e.url, n) : e.type === "audio" ? s(e.url, n) : e.type === "video" ? c(e.url, n) : e.type === "font" ? l(e.url, n) : e.type === "css" ? p(e.url, n, r) : void 0;
		if (u !== void 0) return a(u, t);
		let d = i.get(e.type);
		return d === void 0 ? Promise.reject(/* @__PURE__ */ Error(`No preload strategy registered for resource type "${e.type}"`)) : a(d(e.url, n), t);
	}
	function ee() {
		let e = d;
		e !== void 0 && (e.controller.abort(), n.release(r, [...e.pendingUrls]), d = void 0);
	}
	async function S(e) {
		ee();
		let t = _(e.manifest), i = e.options ?? {}, a = i.mode ?? "broadcast", o = i.timeout ?? g;
		if (!Number.isFinite(o) || o <= 0) throw Error("Preload timeout must be a finite positive number.");
		let s = new AbortController(), c = /* @__PURE__ */ new Set();
		d = {
			controller: s,
			pendingUrls: c
		}, u.status = "loading", u.loadedCount = 0, u.totalCount = t.entries.length;
		let l = Array(t.entries.length), f = [], p = {}, m = {};
		if (t.entries.length === 0) return u.status = "ready", d = void 0, {
			ok: !0,
			data: {
				loaded: [],
				skipped: [],
				metadata: {}
			}
		};
		let h = await Promise.allSettled(t.entries.map(async (e, t) => {
			let a = n.claim(e.url, r);
			if (a?.status === "ready") {
				l[t] = "skipped", a.metadata !== void 0 && (p[e.url] = a.metadata), a.media !== void 0 && (m[e.url] = a.media), u.loadedCount += 1;
				return;
			}
			if (a?.status === "loading") {
				c.add(e.url);
				try {
					let n = x(await a.promise);
					n.metadata !== void 0 && (p[e.url] = n.metadata), n.media !== void 0 && (m[e.url] = n.media), l[t] = "loaded", u.loadedCount += 1;
					return;
				} catch (t) {
					throw n.release(r, [e.url]), t;
				} finally {
					c.delete(e.url);
				}
			}
			a?.status === "error" && (n.release(r, [e.url]), a = void 0);
			let s = new AbortController(), d = b(e, o, s.signal, i.container), f = n.start(e.url, r, d, s);
			c.add(e.url);
			try {
				let r = x(await d);
				n.markReady(e.url, f, r.metadata, r.media), r.metadata !== void 0 && (p[e.url] = r.metadata), r.media !== void 0 && (m[e.url] = r.media), c.delete(e.url), l[t] = "loaded", u.loadedCount += 1;
			} catch (t) {
				c.delete(e.url);
				let i = t instanceof Error ? t.message : String(t);
				throw n.markError(e.url, f, i), n.release(r, [e.url]), t;
			}
		}));
		if (s.signal.aborted || d?.controller !== s) return u.status = "idle", {
			ok: !1,
			error: {
				code: "RUNTIME_PRELOAD_CANCELLED",
				message: "Preload was cancelled."
			}
		};
		for (let e = 0; e < h.length; e += 1) {
			let n = h[e];
			if (n.status !== "rejected") continue;
			let r = t.entries[e], i = n.reason instanceof Error ? n.reason.message : String(n.reason);
			te(n.reason) || f.push({
				code: "RUNTIME_PRELOAD_RESOURCE_UNAVAILABLE",
				message: `Resource unavailable: ${r.url}`,
				details: {
					url: r.url,
					error: i
				}
			});
		}
		return d = void 0, a === "author" && f.length > 0 ? (u.status = "error", {
			ok: !1,
			error: {
				code: "RUNTIME_PRELOAD_RESOURCES_UNAVAILABLE",
				message: `${f.length} resource(s) could not be loaded.`,
				details: f
			}
		}) : (u.status = "ready", {
			ok: !0,
			data: {
				loaded: t.entries.filter((e, t) => l[t] === "loaded").map((e) => e.url),
				skipped: t.entries.filter((e, t) => l[t] === "skipped").map((e) => e.url),
				metadata: p,
				media: Object.keys(m).length === 0 ? void 0 : m,
				warnings: f.length > 0 ? f : void 0
			}
		});
	}
	return {
		css: {
			set: h,
			clear: v
		},
		get state() {
			return { ...u };
		},
		load: S,
		cancel() {
			ee(), u.status = "idle";
		},
		release(e) {
			n.release(r, e);
		},
		registerStrategy(e, t) {
			if (e.trim().length === 0) throw Error("Preload strategy type must not be empty.");
			i.set(e, t);
		}
	};
}
function y(e) {
	if (typeof e != "object" || !e) throw Error("Inline CSS preload input must be an object.");
	if (typeof e.slot != "string" || e.slot.trim() === "") throw Error("Inline CSS preload slot must not be empty.");
	if (typeof e.cssText != "string") throw Error("Inline CSS preload cssText must be a string.");
	if (!b(e.container)) throw Error("Inline CSS preload container must be an Element.");
}
function b(e) {
	if (typeof e != "object" || !e) return !1;
	let t = e;
	return t.nodeType === 1 && typeof t.setAttribute == "function";
}
function x(e) {
	return e === void 0 ? {} : ee(e) ? e : { metadata: e };
}
function ee(e) {
	return typeof e == "object" && !!e && "media" in e && typeof e.media == "object" && e.media !== null && typeof e.media.take == "function";
}
function te(e) {
	return e instanceof Error && e.name === "AbortError";
}
//#endregion
//#region ../codplay/src/runtime/time/clock.ts
function S(e, t) {
	return e() - t;
}
var C = class {
	nowProvider;
	originMs;
	baseMs = 0;
	constructor(e = () => Date.now()) {
		this.nowProvider = e, this.originMs = this.nowProvider();
	}
	nowMs() {
		return this.baseMs + S(this.nowProvider, this.originMs);
	}
	reset(e = 0) {
		this.originMs = this.nowProvider(), this.baseMs = e;
	}
};
//#endregion
//#region ../codplay/src/runtime/time/ticker.ts
function ne() {
	if (typeof globalThis.MessageChannel != "function") return null;
	let e = new globalThis.MessageChannel(), t = /* @__PURE__ */ new Map(), n = [], r = 1;
	return e.port1.onmessage = () => {
		let e = n.shift();
		if (e === void 0) return;
		let r = t.get(e);
		r !== void 0 && (t.delete(e), r());
	}, {
		request: (i) => {
			let a = r;
			return r += 1, t.set(a, i), n.push(a), e.port2.postMessage(a), a;
		},
		cancel: (e) => {
			t.delete(e);
		}
	};
}
function re() {
	if (typeof globalThis.requestAnimationFrame == "function" && typeof globalThis.cancelAnimationFrame == "function") return {
		request: (e) => globalThis.requestAnimationFrame(() => e()),
		cancel: (e) => globalThis.cancelAnimationFrame(e)
	};
	let e = ne();
	if (e !== null) return e;
	throw Error("TimeTicker requires requestAnimationFrame or MessageChannel support");
}
function ie() {
	if (globalThis.document === void 0) return null;
	let e = globalThis.document;
	return {
		isHidden: () => e.hidden,
		subscribe: (t) => (e.addEventListener("visibilitychange", t), () => e.removeEventListener("visibilitychange", t))
	};
}
var ae = class {
	clock;
	frameDurationMs;
	marginMs;
	scheduler;
	requestId = null;
	running = !1;
	lastTickMs = 0;
	scheduledTickMs = 0;
	tickHandler = null;
	pausedByVisibility = !1;
	pauseOnDocumentHidden;
	visibilityController;
	visibilityUnsubscribe = null;
	constructor(e = {}) {
		this.clock = e.clock ?? new C(), this.frameDurationMs = Math.max(1, e.intervalMs ?? 16), this.marginMs = e.marginMs ?? 0, this.scheduler = e.scheduler ?? re(), this.pauseOnDocumentHidden = e.pauseOnDocumentHidden ?? !0, this.visibilityController = e.visibilityController ?? ie();
	}
	runTick(e) {
		let t = this.clock.nowMs(), n = this.lastTickMs;
		e({
			prevMs: n,
			nowMs: t,
			deltaMs: Math.max(0, t - n),
			marginMs: this.marginMs
		}), this.lastTickMs = t;
	}
	shouldEmitTick(e) {
		return e >= this.scheduledTickMs;
	}
	updateScheduledTick(e) {
		let t = e - this.scheduledTickMs;
		this.scheduledTickMs += t < this.frameDurationMs ? this.frameDurationMs : t;
	}
	cancelScheduledFrame() {
		this.requestId !== null && (this.scheduler.cancel(this.requestId), this.requestId = null);
	}
	resetTimingAnchor() {
		this.lastTickMs = this.clock.nowMs(), this.scheduledTickMs = this.lastTickMs + this.frameDurationMs;
	}
	loop = () => {
		if (!this.running || this.tickHandler === null) return;
		let e = this.clock.nowMs();
		this.shouldEmitTick(e) && (this.runTick(this.tickHandler), this.updateScheduledTick(e)), this.requestId = this.scheduler.request(this.loop);
	};
	start(e) {
		if (!this.running) {
			if (this.running = !0, this.pausedByVisibility = !1, this.tickHandler = e, this.attachVisibilityListener(), this.isVisibilityPaused()) {
				this.pausedByVisibility = !0;
				return;
			}
			this.resetTimingAnchor(), this.requestId = this.scheduler.request(this.loop);
		}
	}
	stop() {
		this.running && (this.running = !1, this.pausedByVisibility = !1, this.tickHandler = null, this.cancelScheduledFrame(), this.detachVisibilityListener());
	}
	isRunning() {
		return this.running;
	}
	isVisibilityPaused() {
		return !this.pauseOnDocumentHidden || this.visibilityController === null ? !1 : this.visibilityController.isHidden();
	}
	attachVisibilityListener() {
		!this.pauseOnDocumentHidden || this.visibilityController === null || this.visibilityUnsubscribe !== null || (this.visibilityUnsubscribe = this.visibilityController.subscribe(() => this.handleVisibilityChange()));
	}
	detachVisibilityListener() {
		this.visibilityUnsubscribe !== null && (this.visibilityUnsubscribe(), this.visibilityUnsubscribe = null);
	}
	handleVisibilityChange() {
		if (this.running) {
			if (this.isVisibilityPaused()) {
				this.pausedByVisibility = !0, this.cancelScheduledFrame();
				return;
			}
			!this.pausedByVisibility || this.tickHandler === null || (this.pausedByVisibility = !1, this.resetTimingAnchor(), this.requestId = this.scheduler.request(this.loop));
		}
	}
}, oe = "html", se = class {
	components = /* @__PURE__ */ new Map();
	services = /* @__PURE__ */ new Map();
	modules = /* @__PURE__ */ new Map();
	libraries = /* @__PURE__ */ new Map();
	locked = !1;
	registerComponent(e, t = "foreign") {
		if (this.assertOpen(), le(e), this.components.has(e.type)) throw Error(`Runtime component already registered: ${e.type}`);
		this.components.set(e.type, {
			...e,
			origin: t
		});
	}
	overrideComponent(e, t = "foreign") {
		if (this.assertOpen(), le(e), !this.components.has(e.type)) throw Error(`Runtime component is not registered: ${e.type}`);
		this.components.set(e.type, {
			...e,
			origin: t
		});
	}
	registerService(e, t = "foreign") {
		if (this.assertOpen(), this.services.has(e.name)) throw Error(`Runtime service already registered: ${e.name}`);
		this.services.set(e.name, {
			...e,
			origin: t
		});
	}
	overrideService(e, t = "foreign") {
		if (this.assertOpen(), !this.services.has(e.name)) throw Error(`Runtime service is not registered: ${e.name}`);
		this.services.set(e.name, {
			...e,
			origin: t
		});
	}
	registerModule(e, t = "foreign") {
		if (this.assertOpen(), this.modules.has(e.id)) throw Error(`Runtime module already registered: ${e.id}`);
		this.modules.set(e.id, {
			...e,
			origin: t
		});
	}
	overrideModule(e, t = "foreign") {
		if (this.assertOpen(), !this.modules.has(e.id)) throw Error(`Runtime module is not registered: ${e.id}`);
		this.modules.set(e.id, {
			...e,
			origin: t
		});
	}
	registerLibrary(e, t = "foreign") {
		if (this.assertOpen(), ue(e), this.libraries.has(e.id)) throw Error(`Runtime library already registered: ${e.id}`);
		this.libraries.set(e.id, {
			...e,
			origin: t
		});
	}
	overrideLibrary(e, t = "foreign") {
		if (this.assertOpen(), ue(e), !this.libraries.has(e.id)) throw Error(`Runtime library is not registered: ${e.id}`);
		this.libraries.set(e.id, {
			...e,
			origin: t
		});
	}
	lock() {
		this.locked = !0;
	}
	isLocked() {
		return this.locked;
	}
	getComponent(e) {
		return this.components.get(e);
	}
	resolveComponentAvailability(e, t) {
		return ce[this.components.get(e)?.runtimeProfile ?? "placed"](t);
	}
	getComponentSurfaces(e, t, n, r) {
		return this.components.get(e)?.surfaces?.(t, n, r) ?? {};
	}
	getComponentTargetPublication(e, t, n, r) {
		return this.components.get(e)?.targetProvider?.(t, n, r);
	}
	getService(e) {
		return this.services.get(e);
	}
	getModule(e) {
		return this.modules.get(e);
	}
	getLibrary(e) {
		return this.libraries.get(e);
	}
	hasComponent(e) {
		return this.components.has(e);
	}
	getMountablePartIds(e, t) {
		let n = this.components.get(e);
		return n === void 0 ? [] : t === void 0 ? n.mountableParts ?? [] : n.mountablePartResolver?.(t) ?? n.mountableParts ?? [];
	}
	hasService(e) {
		return this.services.has(e);
	}
	hasModule(e) {
		return this.modules.has(e);
	}
	hasLibrary(e) {
		return this.libraries.has(e);
	}
	getComponents() {
		return [...this.components.values()];
	}
	getServices() {
		return [...this.services.values()];
	}
	getModules() {
		return [...this.modules.values()];
	}
	getLibraries() {
		return [...this.libraries.values()];
	}
	validationSnapshot() {
		return {
			components: new Map([...this.components.entries()].map(([e, t]) => [e, {
				type: t.type,
				services: [...t.component.declaredServices],
				modules: [...t.modules],
				libraries: [...t.libraries ?? []],
				validateInitial: t.validateInitial,
				validateAction: t.validateAction,
				validatePerso: t.validatePerso,
				sanitizeInitial: t.sanitizeInitial,
				sanitizeAction: t.sanitizeAction
			}])),
			services: new Map([...this.services.entries()].map(([e, t]) => [e, fe(t)])),
			libraries: new Set(this.libraries.keys())
		};
	}
	createComponent(e, t, n, r, i) {
		let a = this.requireComponent(e), o = this.createComponentServices(n, r);
		for (let e of a.modules) if (!i.has(e)) throw Error(`Runtime component module is not available: ${e}`);
		let s = new a.component({
			...t,
			services: o
		});
		return de(e, o.declaredNames(), a.component.declaredServices), s;
	}
	createComponentServices(e, t) {
		let n = /* @__PURE__ */ new Map(), r = [];
		return {
			declare: (i) => {
				for (let a of i) {
					if (r.includes(a)) throw Error(`Runtime component service is declared more than once: ${a}`);
					let i = this.services.get(a);
					if (i === void 0) throw Error(`Runtime component service is not registered: ${a}`);
					if (!i.materializers.includes(t.id)) throw Error(`Runtime service "${a}" is not available for materializer "${t.id}"`);
					n.set(a, i.create({
						...e,
						materializerId: t.id,
						materializerContext: t.context
					})), r.push(a);
				}
			},
			get: (e) => {
				let t = n.get(e);
				if (t === void 0) throw Error(`Runtime component service was not declared: ${e}`);
				return t;
			},
			apply: (e, t) => {
				for (let i of r) {
					let r = t[i];
					r !== void 0 && n.get(i)?.apply(e, r);
				}
			},
			declaredNames: () => [...r]
		};
	}
	requireComponent(e) {
		let t = this.components.get(e);
		if (t === void 0) throw Error(`Runtime component class is not registered: ${e}`);
		return t;
	}
	assertOpen() {
		if (this.locked) throw Error("Runtime capability catalog is locked.");
	}
}, ce = {
	placed: (e) => e,
	attached: () => !0
};
function le(e) {
	if (typeof e.validateInitial != "function") throw Error(`Runtime component "${e.type}" must declare validateInitial.`);
	if (!Array.isArray(e.component.declaredServices)) throw Error(`Runtime component "${e.type}" must declare its services.`);
	if (new Set(e.component.declaredServices).size !== e.component.declaredServices.length) throw Error(`Runtime component "${e.type}" declares a service more than once.`);
}
function ue(e) {
	if (e.id.trim().length === 0) throw Error("Runtime library id must not be empty.");
	if (typeof e.load != "function") throw Error(`Runtime library "${e.id}" must declare load.`);
	if (e.release !== void 0 && typeof e.release != "function") throw Error(`Runtime library "${e.id}" must declare a callable release.`);
}
function de(e, t, n) {
	if (t.length !== n.length || t.some((e, t) => e !== n[t])) throw Error(`Runtime component "${e}" did not declare its services in the expected order.`);
}
function fe(e) {
	let { name: t, validate: n, sanitize: r, properties: i, allowUnknownProperties: a } = e;
	return {
		name: t,
		validate: n,
		sanitize: r,
		properties: i,
		allowUnknownProperties: a
	};
}
//#endregion
//#region ../codplay/src/runtime/components/base-component.ts
var pe = class {
	perso;
	services;
	captureSources;
	constructor(e) {
		this.perso = e.perso, this.services = e.services, this.captureSources = e.captureSources;
	}
	initialize() {}
	destroy() {}
	beforeSeek() {}
	afterSeek() {}
	onSequenceEnd() {}
	onReset() {}
}, w = class extends pe {
	node = null;
	parts = [];
	constructor(e) {
		super(e);
	}
	_materialize(e, t) {
		this.node = e, this.parts = t.map((e) => ({ ...e }));
	}
	getPartsSnapshot() {
		return this.parts.map((e) => ({ ...e }));
	}
	getPart(e) {
		return this.parts.find((t) => t.partId === e)?.nodeRef;
	}
}, me = "cp-img-inner", he = class e extends w {
	static declaredServices = [
		"className",
		"style",
		"attr"
	];
	imageBySource = /* @__PURE__ */ new Map();
	activeSource = null;
	constructor(t) {
		super(t), this.services.declare(e.declaredServices);
	}
	render() {
		return "<div class=\"codplay-image-root\"></div>";
	}
	update(e) {
		if (this.node === null) throw Error(`Image component is not materialized: ${this.perso.id}`);
		this.services.apply(this.node, {
			className: e.state.className,
			style: e.state.style,
			attr: e.state.attr
		}), e.state.src !== void 0 && this.setActiveSource(e.state.src);
		let t = this.activeSource === null ? void 0 : this.imageBySource.get(this.activeSource);
		t !== void 0 && this.applyImageState(t, e.state);
	}
	ensureImage(e) {
		let t = this.imageBySource.get(e);
		if (t !== void 0) return t;
		let n = ge();
		return _e(n, e), this.applyImageState(n, this.perso.initial), this.imageBySource.set(e, n), n;
	}
	applyImageState(e, t) {
		t.alt !== void 0 && ve(e, t.alt), t.img !== void 0 && this.services.apply(e, {
			className: t.img.className,
			style: t.img.style,
			attr: t.img.attr
		}), this.services.apply(e, { className: { add: me } });
	}
	setActiveSource(e) {
		let t = this.node, n = this.ensureImage(e), r = this.activeSource === null ? void 0 : this.imageBySource.get(this.activeSource);
		be(r) && r !== n && r.parentNode === t && xe(r), ye(t) && be(n) && n.parentNode !== t && t.appendChild(n), this.activeSource = e;
	}
};
function ge() {
	return globalThis.document === void 0 ? {
		tagName: "IMG",
		parentNode: null,
		style: {},
		attributes: {}
	} : globalThis.document.createElement("img");
}
function _e(e, t) {
	if (typeof e != "object" || !e) return;
	let n = e;
	"src" in n ? n.src = t : n.setAttribute?.("src", t);
}
function ve(e, t) {
	if (typeof e != "object" || !e) return;
	let n = e;
	"alt" in n ? n.alt = t : n.setAttribute?.("alt", t);
}
function ye(e) {
	return typeof e == "object" && !!e && "appendChild" in e && typeof e.appendChild == "function";
}
function be(e) {
	return typeof e == "object" && !!e && "parentNode" in e;
}
function xe(e) {
	if (typeof e.remove == "function") {
		e.remove();
		return;
	}
	let t = e.parentNode;
	if (typeof t == "object" && t && "removeChild" in t) {
		let n = t.removeChild;
		n?.(e);
	}
}
//#endregion
//#region ../codplay/src/shared/is-plain-record.ts
function T(e) {
	if (typeof e != "object" || !e || Array.isArray(e)) return !1;
	let t = Object.getPrototypeOf(e);
	return t === Object.prototype || t === null;
}
//#endregion
//#region ../codplay/src/shared/numbers/is-finite-number.ts
function E(e) {
	return typeof e == "number" && Number.isFinite(e);
}
//#endregion
//#region ../codplay/src/shared/ordering/compare-number-path.ts
function Se(e, t) {
	let n = Math.min(e.length, t.length);
	for (let r = 0; r < n; r += 1) {
		let n = e[r] - t[r];
		if (n !== 0) return n;
	}
	return e.length - t.length;
}
//#endregion
//#region ../codplay/src/shared/values/clone-value.ts
function Ce(e) {
	if (Array.isArray(e)) return e.map((e) => Ce(e));
	if (!T(e)) return e;
	let t = {};
	for (let [n, r] of Object.entries(e)) t[n] = Ce(r);
	return t;
}
function D(e) {
	return e === void 0 ? {} : Ce(e);
}
//#endregion
//#region ../codplay/src/runtime/components/component-validation.ts
function O(e, t, n, r) {
	e.diagnostics.error(t, n, {
		refs: e.refs,
		context: { path: r === void 0 ? e.path : `${e.path}.${r}` }
	});
}
function k(e) {
	return T(e);
}
function we(e) {
	return typeof e == "string" && /^[A-Za-z][A-Za-z0-9-]*$/.test(e);
}
//#endregion
//#region ../codplay/src/runtime/components/image/image-validation.ts
var Te = (e, t) => {
	if (!k(e)) {
		O(t, "AUTHOR_IMAGE_INITIAL_INVALID", "img initial state must be a plain object.");
		return;
	}
	De(e, t, "initial");
}, Ee = (e, t) => {
	T(e) && De(e, t, "action");
};
function De(e, t, n) {
	"fitMode" in e && O(t, "AUTHOR_IMAGE_FIT_MODE_REMOVED", "img.fitMode is not part of the V2 contract; use img.style.objectFit.", "fitMode"), e.src !== void 0 && typeof e.src != "string" && O(t, "AUTHOR_IMAGE_SRC_INVALID", `img ${n} src must be a string.`, "src"), e.alt !== void 0 && typeof e.alt != "string" && O(t, "AUTHOR_IMAGE_ALT_INVALID", `img ${n} alt must be a string.`, "alt"), e.img !== void 0 && !T(e.img) && O(t, "AUTHOR_IMAGE_PART_INVALID", "img.img must be a plain object.", "img"), Oe(e.replace, t);
}
function Oe(e, t) {
	if (!(e === void 0 || e === "fade" || e === "fade-in")) {
		if (!T(e)) {
			O(t, "AUTHOR_IMAGE_REPLACE_INVALID", "img.replace must be \"fade\", \"fade-in\", or an object with a supported transition.", "replace");
			return;
		}
		e.transition !== "fade" && e.transition !== "fade-in" && O(t, "AUTHOR_IMAGE_REPLACE_TRANSITION_INVALID", "img.replace.transition must be \"fade\" or \"fade-in\".", "replace.transition"), e.duration !== void 0 && (typeof e.duration != "number" || !Number.isFinite(e.duration) || e.duration < 0) && O(t, "AUTHOR_IMAGE_REPLACE_DURATION_INVALID", "img.replace.duration must be a finite non-negative number.", "replace.duration");
	}
}
//#endregion
//#region ../codplay/src/runtime/components/input/input-visual-state.ts
function ke(e) {
	return e === "revealed-correct" ? "correct" : e === "revealed-incorrect" ? "incorrect" : e === "revealed-missed-correct" ? "missed-correct" : null;
}
function Ae(e) {
	let t = [`input--${e.visualState}`];
	return Me(e) && t.push("input--selected"), e.disabled && t.push("input--disabled"), t;
}
function je(e) {
	let t = [`input__control--${e.visualState}`];
	Me(e) && t.push("is-selected"), e.disabled && t.push("is-disabled");
	let n = ke(e.visualState);
	return n !== null && t.push(`is-${n}`), t;
}
function Me(e) {
	return e.checked || e.visualState === "selected" || e.visualState.startsWith("revealed-");
}
//#endregion
//#region ../codplay/src/runtime/components/input/input-state.ts
function Ne(e, t) {
	let n = e.selectedAnswerIds, r = e.correctAnswerIds, i = e.disableAnswers, a = e.showCorrection, o = e.selectionIcon, s = e.correctionIcon, c = e.inputType, l = e.id ?? t, u = e.value, d = u !== void 0 && (n.includes(String(u)) || n.includes(l)), f = e.checked ?? d, p = r.includes(String(u ?? l)), m = e.visualState ?? Pe(d, p, i, a);
	return {
		inputType: c,
		id: l,
		name: e.name,
		value: u,
		label: e.label,
		hint: e.hint,
		checked: f,
		disabled: e.disabled ?? i,
		placeholder: e.placeholder,
		min: e.min,
		max: e.max,
		step: e.step,
		form: e.form,
		required: e.required,
		readOnly: e.readOnly,
		selectedAnswerIds: n,
		correctAnswerIds: r,
		disableAnswers: i,
		showCorrection: a,
		selectionIcon: o,
		correctionIcon: s,
		visualState: m
	};
}
function Pe(e, t, n, r) {
	return r ? e && t ? "revealed-correct" : e ? "revealed-incorrect" : t ? "revealed-missed-correct" : n ? "disabled" : "idle" : e ? "selected" : n ? "disabled" : "idle";
}
function Fe(e) {
	if (!e.showCorrection) return "";
	let t = ke(e.visualState);
	return t === "correct" ? e.correctionIcon.correctContent ?? e.correctionIcon.content ?? "+" : t === "incorrect" ? e.correctionIcon.incorrectContent ?? e.correctionIcon.content ?? "-" : t === "missed-correct" ? e.correctionIcon.missedCorrectContent ?? e.correctionIcon.correctContent ?? e.correctionIcon.content ?? "+" : "";
}
function Ie(e) {
	return e.checked || e.visualState === "selected" || e.visualState.startsWith("revealed-");
}
//#endregion
//#region ../codplay/src/runtime/components/input/input-component.ts
var Le = {
	control: "control",
	label: "label",
	hint: "hint"
}, Re = class e extends w {
	static declaredServices = [
		"className",
		"style",
		"attr",
		"content"
	];
	constructor(t) {
		super(t), this.services.declare(e.declaredServices);
	}
	render() {
		return Ve(this.perso.storyId, this.perso.id);
	}
	update(e) {
		if (this.node === null) throw Error(`Input component is not materialized: ${this.perso.id}`);
		let t = Ne(e.state, `${this.perso.id}__control`), n = this.lastState;
		this.lastState = t, this.services.apply(this.node, {
			className: e.state.className,
			style: e.state.style,
			attr: {
				...T(e.state.attr) ? e.state.attr : {},
				id: this.perso.id
			}
		}), this.applyState(t, n);
	}
	setValue(e) {
		let t = this.getPart(Le.control);
		if (!ze(t)) throw Error(`Input component control is not materialized: ${this.perso.id}`);
		t.value = String(e);
	}
	lastState = null;
	applyState(e, t) {
		let n = this.node, r = this.getPart(Le.control), i = this.getPart(Le.label), a = this.getPart(He(this.perso.storyId, this.perso.id)), o = this.getPart(Ue(this.perso.storyId, this.perso.id)), s = this.getPart(Le.hint);
		this.services.apply(n, { className: {
			add: Ae(e).join(" "),
			remove: t === null ? void 0 : Ae(t).join(" ")
		} }), this.applyControl(r, e, t), this.services.apply(i, {
			className: "input__label",
			content: e.label
		}), this.services.apply(s, {
			className: "input__hint",
			content: e.hint
		}), this.applySelectionIcon(a, e, t), this.applyCorrectionIcon(o, e, t);
	}
	applyControl(e, t, n) {
		this.services.apply(e, { className: {
			add: ["input__control", ...je(t)].join(" "),
			remove: n === null ? void 0 : je(n).join(" ")
		} }), ze(e) && (e.type = t.inputType, e.id = t.id, e.name = t.name ?? "", e.value = t.value === void 0 ? "" : String(t.value), e.checked = t.checked, e.disabled = t.disabled, e.placeholder = t.placeholder ?? "", e.min = t.min === void 0 ? "" : String(t.min), e.max = t.max === void 0 ? "" : String(t.max), e.step = t.step === void 0 ? "" : String(t.step), e.required = t.required, e.readOnly = t.readOnly, t.form === void 0 ? e.removeAttribute?.("form") : e.setAttribute?.("form", t.form));
	}
	applySelectionIcon(e, t, n) {
		e !== void 0 && (this.services.apply(e, {
			className: {
				add: [
					"input__selection-icon",
					t.selectionIcon.className,
					Ie(t) ? "is-selected" : "is-idle"
				].filter(Boolean).join(" "),
				remove: n === null ? void 0 : [n.selectionIcon.className, Ie(n) ? "is-selected" : "is-idle"].filter(Boolean).join(" ")
			},
			style: t.selectionIcon.style,
			attr: t.selectionIcon.attr
		}), !Be(e) && this.services.apply(e, { content: Ie(t) ? t.selectionIcon.content ?? "" : "" }));
	}
	applyCorrectionIcon(e, t, n) {
		if (e === void 0) return;
		let r = n === null ? "idle" : ke(n.visualState) ?? "idle", i = ke(t.visualState) ?? "idle";
		this.services.apply(e, {
			className: {
				add: [
					"input__correction-icon",
					t.correctionIcon.className,
					`is-${i}`
				].filter(Boolean).join(" "),
				remove: n === null ? void 0 : [n.correctionIcon.className, `is-${r}`].filter(Boolean).join(" ")
			},
			style: t.correctionIcon.style,
			attr: t.correctionIcon.attr
		}), !Be(e) && this.services.apply(e, { content: Fe(t) });
	}
};
function ze(e) {
	return typeof e == "object" && !!e && "type" in e && "value" in e;
}
function Be(e) {
	if (typeof e != "object" || !e || !("childNodes" in e)) return !1;
	let t = e.childNodes;
	return typeof t?.length == "number" && t.length > 0;
}
function Ve(e, t) {
	return `
    <label>
      <input data-part="${Le.control}" />
      <span data-part="${Le.label}"></span>
      <span data-part="${He(e, t)}" aria-hidden="true"></span>
      <span data-part="${Ue(e, t)}" aria-hidden="true"></span>
      <span data-part="${Le.hint}"></span>
    </label>
  `;
}
function He(e, t) {
	return `${e}:${t}__selection-icon-slot`;
}
function Ue(e, t) {
	return `${e}:${t}__correction-icon-slot`;
}
//#endregion
//#region ../codplay/src/runtime/components/input/input-validation.ts
var We = (e, t) => {
	if (!k(e)) {
		O(t, "AUTHOR_INPUT_INITIAL_INVALID", "input initial state must be a plain object.");
		return;
	}
	Je(e, t);
}, Ge = (e, t) => {
	T(e) && Je(e, t);
};
function Ke(e) {
	let t = { ...e };
	return t.inputType = Ze(e.inputType, "text"), (e.id === void 0 || e.id === "") && delete t.id, e.name === void 0 && delete t.name, e.value !== void 0 && (t.value = e.value), t.label = Xe(e.label), t.hint = Xe(e.hint), e.checked === void 0 && delete t.checked, e.disabled === void 0 && delete t.disabled, e.placeholder === void 0 && delete t.placeholder, e.min === void 0 && delete t.min, e.max === void 0 && delete t.max, e.step === void 0 && delete t.step, e.form === void 0 && delete t.form, t.required = e.required === !0, t.readOnly = e.readOnly === !0, t.selectedAnswerIds = Qe(e.selectedAnswerIds), t.correctAnswerIds = Qe(e.correctAnswerIds), t.disableAnswers = e.disableAnswers === !0, t.showCorrection = e.showCorrection === !0, t.selectionIcon = $e(e.selectionIcon, !0), t.correctionIcon = et(e.correctionIcon, !0), e.visualState === void 0 && delete t.visualState, t;
}
function qe(e) {
	let t = { ...e };
	return t.inputType !== void 0 && (t.inputType = Ze(t.inputType, "text")), t.id === "" && delete t.id, t.label !== void 0 && (t.label = Xe(t.label)), t.hint !== void 0 && (t.hint = Xe(t.hint)), t.selectedAnswerIds !== void 0 && (t.selectedAnswerIds = Qe(t.selectedAnswerIds)), t.correctAnswerIds !== void 0 && (t.correctAnswerIds = Qe(t.correctAnswerIds)), t.selectionIcon !== void 0 && (t.selectionIcon = $e(t.selectionIcon, !1)), t.correctionIcon !== void 0 && (t.correctionIcon = et(t.correctionIcon, !1)), t;
}
function Je(e, t) {
	for (let n of [
		"inputType",
		"id",
		"name",
		"placeholder",
		"form"
	]) e[n] !== void 0 && typeof e[n] != "string" && O(t, "AUTHOR_INPUT_FIELD_INVALID", `input.${n} must be a string.`, n);
	for (let n of [
		"value",
		"label",
		"hint",
		"min",
		"max",
		"step"
	]) e[n] !== void 0 && !tt(e[n]) && O(t, "AUTHOR_INPUT_FIELD_INVALID", `input.${n} must be a string or number.`, n);
	for (let n of [
		"checked",
		"disabled",
		"required",
		"readOnly",
		"disableAnswers",
		"showCorrection"
	]) e[n] !== void 0 && typeof e[n] != "boolean" && O(t, "AUTHOR_INPUT_FIELD_INVALID", `input.${n} must be a boolean.`, n);
	for (let n of ["selectedAnswerIds", "correctAnswerIds"]) {
		let r = e[n];
		r !== void 0 && (!Array.isArray(r) || !r.every((e) => typeof e == "string")) && O(t, "AUTHOR_INPUT_ANSWER_IDS_INVALID", `input.${n} must be a string array.`, n);
	}
	e.visualState !== void 0 && !nt(e.visualState) && O(t, "AUTHOR_INPUT_VISUAL_STATE_INVALID", "input.visualState is not supported.", "visualState"), Ye(e.selectionIcon, t, "selectionIcon"), Ye(e.correctionIcon, t, "correctionIcon");
}
function Ye(e, t, n) {
	if (e !== void 0) {
		if (!T(e)) {
			O(t, "AUTHOR_INPUT_PART_INVALID", `input.${n} must be a plain object.`, n);
			return;
		}
		e.content !== void 0 && !tt(e.content) && O(t, "AUTHOR_INPUT_PART_INVALID", `input.${n}.content must be a string or number.`, `${n}.content`);
		for (let r of [
			"className",
			"style",
			"attr"
		]) e[r] !== void 0 && (r === "className" ? !rt(e[r]) : !T(e[r])) && O(t, "AUTHOR_INPUT_PART_INVALID", `input.${n}.${r} has an invalid value.`, `${n}.${r}`);
		for (let r of [
			"correctContent",
			"incorrectContent",
			"missedCorrectContent"
		]) e[r] !== void 0 && !tt(e[r]) && O(t, "AUTHOR_INPUT_PART_INVALID", `input.${n}.${r} must be a string or number.`, `${n}.${r}`);
	}
}
function Xe(e) {
	return tt(e) ? String(e) : "";
}
function Ze(e, t) {
	return typeof e == "string" && e.length > 0 ? e : t;
}
function Qe(e) {
	return Array.isArray(e) ? e.filter((e) => typeof e == "string" && e.length > 0) : [];
}
function $e(e, t) {
	if (!T(e)) return {};
	let n = {};
	return (t || e.className !== void 0) && (n.className = e.className), (t || e.style !== void 0) && (n.style = e.style), (t || e.attr !== void 0) && (n.attr = e.attr), e.content !== void 0 && (n.content = String(e.content)), n;
}
function et(e, t) {
	let n = $e(e, t);
	if (!T(e)) return n;
	let r = { ...n };
	for (let t of [
		"correctContent",
		"incorrectContent",
		"missedCorrectContent"
	]) e[t] !== void 0 && (r[t] = String(e[t]));
	return r;
}
function tt(e) {
	return typeof e == "string" || typeof e == "number";
}
function nt(e) {
	return e === "idle" || e === "selected" || e === "disabled" || e === "revealed-correct" || e === "revealed-incorrect" || e === "revealed-missed-correct";
}
function rt(e) {
	return typeof e == "string" ? !0 : T(e) && (e.add === void 0 || typeof e.add == "string") && (e.remove === void 0 || typeof e.remove == "string");
}
//#endregion
//#region ../codplay/src/runtime/components/layout/layout-flow-reservation.ts
var it = class {
	parts;
	observer;
	partsInDocumentOrder = null;
	width = null;
	scheduled = !1;
	destroyed = !1;
	constructor(e, t, n) {
		this.parts = t.map((e) => {
			let t = n(e.partId);
			if (!(t instanceof HTMLElement)) throw Error(`Layout flow part is not an HTML element: ${e.partId}`);
			return {
				node: t,
				paragraph: null,
				nextSibling: null,
				blockSize: e.blockSize
			};
		}), this.observer = typeof ResizeObserver > "u" ? null : new ResizeObserver((e) => {
			let t = e[0]?.contentRect.width;
			t === void 0 || t === this.width || (this.width = t, this.schedule());
		}), this.observer?.observe(e), this.schedule();
	}
	refresh() {
		this.schedule();
	}
	destroy() {
		this.destroyed = !0, this.observer?.disconnect();
	}
	schedule() {
		this.scheduled || this.destroyed || (this.scheduled = !0, queueMicrotask(() => {
			this.scheduled = !1, this.destroyed || this.reflow();
		}));
	}
	reflow() {
		if (!this.captureConnectedParts()) return;
		let e = this.partsInDocumentOrder;
		for (let t of [...e].reverse()) t.paragraph !== null && t.paragraph.insertBefore(t.node, t.nextSibling);
		let t = new Set(e.flatMap((e) => e.paragraph === null ? [] : [e.paragraph]));
		for (let e of t) e.normalize();
		for (let t of e) t.nextSibling = t.node.nextSibling;
		for (let t of e) t.node.style.display = "inline", t.node.style.float = "none", t.node.style.width = "0", t.node.style.height = "0", t.node.style.padding = "0", t.node.style.margin = "0";
		for (let t of e) this.placeAfterLine(t);
	}
	captureConnectedParts() {
		if (this.partsInDocumentOrder !== null) return !0;
		for (let e of this.parts) if (!e.node.isConnected || e.node.parentElement === null) return !1;
		for (let e of this.parts) e.paragraph = e.node.parentElement, e.nextSibling = e.node.nextSibling;
		return this.partsInDocumentOrder = [...this.parts].sort(at), !0;
	}
	placeAfterLine(e) {
		if (e.paragraph === null) return;
		let t = e.node.getClientRects()[0]?.top;
		if (t === void 0) return;
		let n = this.findNextLine(e, t);
		if (n === null) e.paragraph.append(e.node);
		else {
			let t = n.node.splitText(n.offset);
			t.parentNode?.insertBefore(e.node, t);
		}
		e.node.style.display = "block", e.node.style.float = "left", e.node.style.width = "100%", e.node.style.height = "0", e.node.style.paddingBottom = e.blockSize;
	}
	findNextLine(e, t) {
		if (e.paragraph === null) return null;
		let n = e.paragraph.ownerDocument.createTreeWalker(e.paragraph, NodeFilter.SHOW_TEXT), r = e.paragraph.ownerDocument.createRange(), i = n.nextNode();
		for (; i !== null;) {
			if (!e.node.contains(i) && (e.node.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) {
				let e = i;
				for (let n = 0; n < e.length; n += 1) {
					r.setStart(e, n), r.setEnd(e, n + 1);
					let i = r.getClientRects()[0]?.top;
					if (i !== void 0 && i > t + 1) return {
						node: e,
						offset: n
					};
				}
			}
			i = n.nextNode();
		}
		return null;
	}
};
function at(e, t) {
	return e.node === t.node ? 0 : e.node.compareDocumentPosition(t.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}
//#endregion
//#region ../codplay/src/runtime/components/layout/layout-component.ts
var ot = class e extends w {
	static declaredServices = [
		"className",
		"style",
		"attr"
	];
	flowReservation = null;
	constructor(t) {
		super(t), this.services.declare(e.declaredServices);
	}
	render() {
		return this.perso.initial.markup;
	}
	initialize() {
		let e = this.perso.initial.flowReservations;
		if (!(e === void 0 || e.length === 0)) {
			if (!(this.node instanceof HTMLElement)) throw Error(`Layout root is not an HTML element: ${this.perso.id}`);
			this.flowReservation = new it(this.node, e, (e) => this.getPart(e));
		}
	}
	update(e) {
		if (this.node === null) throw Error(`Layout component is not materialized: ${this.perso.id}`);
		this.services.apply(this.node, e.state);
	}
	afterSeek() {
		this.flowReservation?.refresh();
	}
	onReset() {
		this.flowReservation?.refresh();
	}
	destroy() {
		this.flowReservation?.destroy(), this.flowReservation = null;
	}
}, st = (e, t) => {
	(!k(e) || typeof e.markup != "string" || e.markup.trim().length === 0) && O(t, "AUTHOR_LAYOUT_MARKUP_INVALID", "layout.markup must be a non-empty string.", "markup"), !(!k(e) || e.flowReservations === void 0) && (!Array.isArray(e.flowReservations) || e.flowReservations.some((e) => !k(e) || typeof e.partId != "string" || e.partId.length === 0 || typeof e.blockSize != "string" || e.blockSize.length === 0)) && O(t, "AUTHOR_LAYOUT_FLOW_RESERVATION_INVALID", "layout.flowReservations must list existing part ids and CSS block sizes.", "flowReservations");
}, ct = class e extends w {
	static declaredServices = [
		"className",
		"style",
		"attr"
	];
	constructor(t) {
		super(t), this.services.declare(e.declaredServices);
	}
	render() {
		let e = this.perso.initial.tag;
		return `<${e}></${e}>`;
	}
	update(e) {
		if (this.node === null) throw Error(`List component is not materialized: ${this.perso.id}`);
		this.services.apply(this.node, {
			className: e.state.className,
			style: e.state.style,
			attr: e.state.attr
		});
	}
}, lt = (e, t) => {
	if (!k(e)) {
		O(t, "AUTHOR_LIST_INITIAL_INVALID", "list initial state must be a plain object.");
		return;
	}
	if (e.tag !== void 0 && (typeof e.tag != "string" || e.tag.trim().length > 0 && !we(e.tag)) && O(t, "AUTHOR_LIST_TAG_INVALID", "list.tag must be a valid HTML tag name.", "tag"), e.config !== void 0) {
		if (!k(e.config)) {
			O(t, "AUTHOR_LIST_CONFIG_INVALID", "list.config must be a plain object.", "config");
			return;
		}
		for (let n of [
			"reorderOnMove",
			"reorderOnAdd",
			"reorderOnRemove"
		]) {
			let r = e.config[n];
			r !== void 0 && typeof r != "boolean" && O(t, "AUTHOR_LIST_CONFIG_INVALID", `list.config.${n} must be a boolean.`, `config.${n}`);
		}
	}
};
function ut(e) {
	let t = typeof e.tag == "string" && e.tag.trim().length > 0 ? e.tag : "section";
	return {
		...e,
		tag: t
	};
}
//#endregion
//#region ../codplay/src/runtime/components/media/media-component.ts
var dt = 40, ft = class e extends w {
	static declaredServices = [
		"className",
		"style",
		"attr"
	];
	mediaBySrc = /* @__PURE__ */ new Map();
	activeSrc = null;
	resourceMetadata;
	resourceMedia;
	mediaLeases = /* @__PURE__ */ new Map();
	playbackWindow = {
		startMs: 0,
		endMs: null
	};
	playbackRate = 1;
	constructor(t) {
		super(t), this.services.declare(e.declaredServices), this.resourceMetadata = t.resourceMetadata ?? /* @__PURE__ */ new Map(), this.resourceMedia = t.resourceMedia ?? /* @__PURE__ */ new Map();
	}
	render() {
		return "<div class=\"codplay-media-root\"></div>";
	}
	update(e) {
		if (this.node === null) throw Error(`Media component is not materialized: ${this.perso.id}`);
		this.services.apply(this.node, {
			className: e.state.className,
			style: e.state.style,
			attr: e.state.attr
		}), this.ensureStaticSourceNodes(), this.setActiveSource(e.state.src);
		let t = this.activeMediaNode();
		t !== void 0 && this.applyMediaPartState(t, e.state.video);
	}
	ensureStaticSourceNodes() {
		for (let e of this.staticSrcs()) this.ensureNodeForSource(e);
	}
	setActiveSource(e) {
		let t = this.node;
		if (!bt(t)) return;
		let n = this.ensureNodeForSource(e);
		if (!xt(n)) return;
		let r = this.activeSrc === null ? void 0 : this.mediaBySrc.get(this.activeSrc);
		xt(r) && r !== n && r.parentNode === t && t.removeChild(r), n.parentNode !== t && t.appendChild(n), this.activeSrc !== e && (this.playbackWindow = {
			startMs: 0,
			endMs: null
		}), this.activeSrc = e;
	}
	ensureNodeForSource(e) {
		let t = this.mediaBySrc.get(e);
		if (t !== void 0) return t;
		let n = mt(e, this.perso.initial.tag, this.resourceMetadata.get(e)), i = this.resourceMedia.get(e), a = i?.type === n ? i.take() : void 0, o = a?.node ?? pt(n);
		return a === void 0 ? ht(o, e) : (r(a.node), this.mediaLeases.set(e, a)), this.perso.initial.controls === !0 && gt(o), this.applyMediaPartState(o, this.perso.initial.video), _t(o, this.playbackRate), this.mediaBySrc.set(e, o), o;
	}
	seekTo(e) {
		let t = this.activeMediaNode();
		if (!St(t)) return;
		let n = this.clampPlaybackMs(e) / 1e3, r = t.currentTime;
		Math.abs(r - n) * 1e3 <= dt || (t.currentTime = n);
	}
	play() {
		let e = this.activeMediaNode();
		if (!St(e) || typeof e.play != "function") return;
		let t = e.play();
		t !== void 0 && typeof t.then == "function" && t.catch(() => void 0);
	}
	pause() {
		let e = this.activeMediaNode();
		St(e) && e.pause?.();
	}
	destroy() {
		for (let e of this.mediaLeases.values()) e.release();
		this.mediaLeases.clear(), this.mediaBySrc.clear(), this.activeSrc = null;
	}
	stopAt(e) {
		this.seekTo(e), this.pause();
	}
	getCurrentTimeMs() {
		let e = this.activeMediaNode();
		return St(e) && Number.isFinite(e.currentTime) ? this.clampPlaybackMs(e.currentTime * 1e3) : 0;
	}
	getDurationMs() {
		let e = this.activeSrc === null ? void 0 : this.resourceMetadata.get(this.activeSrc);
		return e?.durationMs !== void 0 && Number.isFinite(e.durationMs) ? Math.max(0, e.durationMs) : null;
	}
	setPlaybackWindow(e, t) {
		this.playbackWindow = {
			startMs: Math.max(0, e),
			endMs: t === null ? null : Math.max(e, t)
		};
	}
	setRate(e) {
		this.playbackRate = e;
		for (let t of this.mediaBySrc.values()) _t(t, e);
	}
	applyTransition(e, t) {
		let n = this.activeMediaNode();
		if (!St(n)) return;
		let r = e.from ?? {}, i = e.to ?? {}, a = Math.min(1, Math.max(0, t)), o = /* @__PURE__ */ new Set([...Object.keys(r), ...Object.keys(i)]);
		for (let e of o) {
			let t = r[e], o = i[e], s = vt(t, o, a);
			s !== void 0 && yt(n, e, s);
		}
	}
	isPaused() {
		let e = this.activeMediaNode();
		return !St(e) || e.paused !== !1;
	}
	activeMediaNode() {
		return this.activeSrc === null ? void 0 : this.mediaBySrc.get(this.activeSrc);
	}
	applyMediaPartState(e, t) {
		t !== void 0 && this.services.apply(e, {
			className: t.className,
			style: t.style,
			attr: t.attr
		});
	}
	clampPlaybackMs(e) {
		let t = Math.max(this.playbackWindow.startMs, e);
		return this.playbackWindow.endMs === null ? t : Math.min(this.playbackWindow.endMs, t);
	}
	staticSrcs() {
		let e = /* @__PURE__ */ new Set();
		typeof this.perso.initial.src == "string" && e.add(this.perso.initial.src);
		for (let t of Object.values(this.perso.actions ?? {})) !T(t) || typeof t.src != "string" || e.add(t.src);
		return [...e];
	}
};
function pt(e) {
	if (globalThis.document !== void 0) return globalThis.document.createElement(e);
	let t = {
		tagName: e.toUpperCase(),
		parentNode: null,
		src: "",
		currentTime: 0,
		duration: NaN,
		paused: !0,
		volume: 1,
		muted: !1,
		playbackRate: 1,
		play: () => void 0,
		pause: () => void 0
	};
	return t.play = () => {
		t.paused = !1;
	}, t.pause = () => {
		t.paused = !0;
	}, t;
}
function mt(e, t, n) {
	return n?.type === "audio" ? "audio" : n?.type === "video" ? "video" : t === void 0 ? /\.(?:aac|flac|m4a|mp3|oga|ogg|wav)(?:$|[?#])/i.test(e) ? "audio" : "video" : t;
}
function ht(e, t) {
	typeof e != "object" || !e || (e.src = t);
}
function gt(e) {
	typeof e != "object" || !e || e.setAttribute?.("controls", "");
}
function _t(e, t) {
	typeof e != "object" || !e || (e.playbackRate = t);
}
function vt(e, t, n) {
	return typeof e == "number" && typeof t == "number" ? e + (t - e) * n : n <= 0 && e !== void 0 ? e : n >= 1 && t !== void 0 ? t : t ?? e;
}
function yt(e, t, n) {
	if (!(typeof e != "object" || !e) && !(t === "currentTime" || t === "src" || t === "playbackRate")) {
		if (t === "volume" && typeof n == "number") {
			e.volume = Math.min(1, Math.max(0, n));
			return;
		}
		if (t === "muted" && typeof n == "boolean") {
			e.muted = n;
			return;
		}
		t in e && (e[t] = n);
	}
}
function bt(e) {
	return typeof e == "object" && !!e && "appendChild" in e && typeof e.appendChild == "function" && "removeChild" in e && typeof e.removeChild == "function";
}
function xt(e) {
	return typeof e == "object" && !!e && "parentNode" in e;
}
function St(e) {
	return typeof e == "object" && !!e && "currentTime" in e && typeof e.currentTime == "number" && "duration" in e && typeof e.duration == "number" && "paused" in e && typeof e.paused == "boolean";
}
//#endregion
//#region ../codplay/src/services/service-validation-report.ts
function A(e, t, n, r) {
	e.error(t, n, {
		refs: r.refs,
		context: { path: r.path }
	});
}
//#endregion
//#region ../codplay/src/runtime/components/media/media-validation.ts
var Ct = (e, t) => {
	if (!T(e) || typeof e.src != "string" || e.src.length === 0) {
		A(t.diagnostics, "AUTHOR_MEDIA_SRC_INVALID", "media.src must be a non-empty string.", t);
		return;
	}
	e.tag !== void 0 && e.tag !== "video" && e.tag !== "audio" && A(t.diagnostics, "AUTHOR_MEDIA_TAG_INVALID", "media.tag only accepts \"video\" or \"audio\".", t), e.controls !== void 0 && typeof e.controls != "boolean" && A(t.diagnostics, "AUTHOR_MEDIA_CONTROLS_INVALID", "media.controls must be a boolean.", t), "master" in e && A(t.diagnostics, "AUTHOR_MEDIA_MASTER_REMOVED", "media.master has been replaced by media.sync.", t), e.sync !== void 0 && e.sync !== "auto" && e.sync !== "master" && e.sync !== "independent" && A(t.diagnostics, "AUTHOR_MEDIA_SYNC_INVALID", "media.sync only accepts \"auto\", \"master\" or \"independent\".", t), Tt(e.video, t, "video");
}, wt = (e, t) => {
	T(e) && (("sync" in e || "master" in e) && A(t.diagnostics, "AUTHOR_MEDIA_SYNC_INITIAL_ONLY", "media.sync is an initial configuration and cannot be changed by an action.", t), e.src !== void 0 && (typeof e.src != "string" || e.src.length === 0) && A(t.diagnostics, "AUTHOR_MEDIA_SRC_INVALID", "media action src must be a non-empty string.", t), Tt(e.video, t, "video"), Et(e.broadcast, t));
};
function Tt(e, t, n) {
	e === void 0 || T(e) || A(t.diagnostics, "AUTHOR_MEDIA_PART_INVALID", `media.${n} must be a plain object.`, t);
}
function Et(e, t) {
	if (e === void 0) return;
	if (!T(e)) {
		A(t.diagnostics, "AUTHOR_MEDIA_BROADCAST_INVALID", "media action broadcast must be an object.", t);
		return;
	}
	e.type !== "START" && e.type !== "PAUSE" && e.type !== "STOP" && A(t.diagnostics, "AUTHOR_MEDIA_BROADCAST_TYPE_INVALID", "media action broadcast.type must be START, PAUSE or STOP.", t);
	for (let n of ["startAt", "endAt"]) {
		let r = e[n];
		r !== void 0 && (typeof r != "number" || !Number.isFinite(r) || r < 0) && A(t.diagnostics, "AUTHOR_MEDIA_BROADCAST_POSITION_INVALID", `media action broadcast.${n} must be a finite non-negative number.`, t);
	}
	if (typeof e.startAt == "number" && typeof e.endAt == "number" && e.endAt < e.startAt && A(t.diagnostics, "AUTHOR_MEDIA_BROADCAST_WINDOW_INVALID", "media action broadcast.endAt must not be before startAt.", t), e.transition === void 0) return;
	if (!T(e.transition)) {
		A(t.diagnostics, "AUTHOR_MEDIA_BROADCAST_TRANSITION_INVALID", "media action broadcast.transition must be an object.", t);
		return;
	}
	let n = e.transition;
	n.duration !== void 0 && (typeof n.duration != "number" || !Number.isFinite(n.duration) || n.duration < 0) && A(t.diagnostics, "AUTHOR_MEDIA_BROADCAST_TRANSITION_DURATION_INVALID", "media action broadcast.transition.duration must be a finite non-negative number.", t);
	for (let e of ["from", "to"]) n[e] !== void 0 && !T(n[e]) && A(t.diagnostics, "AUTHOR_MEDIA_BROADCAST_TRANSITION_VALUES_INVALID", `media action broadcast.transition.${e} must be an object.`, t);
}
//#endregion
//#region ../codplay/src/ace/adapters/named-colors.ts
var Dt = {
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
}, Ot = /^(?:#|rgba?\(|hsla?\(|hwb\(|lab\(|lch\(|oklab\(|oklch\(|color\()/i;
function kt(e) {
	let t = e.trim().toLowerCase();
	return t === "transparent" || Object.prototype.hasOwnProperty.call(Dt, t) || Ot.test(t);
}
function At(e) {
	let t = e.trim().toLowerCase();
	if (t.length === 0) throw Error("ace: color value must not be empty.");
	if (t === "transparent") return jt([
		0,
		0,
		0
	], 0);
	let n = Dt[t];
	if (n !== void 0) return jt(n, 1);
	if (t.startsWith("#")) return Mt(t);
	let r = /^(rgba?|RGBA?)\((.*)\)$/.exec(t);
	if (r !== null) return Nt(r[2]);
	let i = /^oklch\((.*)\)$/.exec(t);
	if (i !== null) return Pt(i[1]);
	throw Error(`ace: unsupported color value "${e}".`);
}
function jt(e, t) {
	return {
		kind: "color",
		space: "srgb",
		coords: e.map((e) => e / 255),
		alpha: t
	};
}
function Mt(e) {
	let t = e.slice(1);
	if (![
		3,
		4,
		6,
		8
	].includes(t.length) || !/^[\da-f]+$/i.test(t)) throw Error(`ace: invalid hexadecimal color "${e}".`);
	let n = t.length <= 4 ? [...t].map((e) => `${e}${e}`).join("") : t;
	return jt([
		Number.parseInt(n.slice(0, 2), 16),
		Number.parseInt(n.slice(2, 4), 16),
		Number.parseInt(n.slice(4, 6), 16)
	], n.length === 8 ? Number.parseInt(n.slice(6, 8), 16) / 255 : 1);
}
function Nt(e) {
	let t = e.split(",").map((e) => e.trim());
	if (t.length >= 3 && t.length <= 4) return jt(t.slice(0, 3).map(zt), t[3] === void 0 ? 1 : Bt(t[3]));
	let [n, r] = Rt(e), i = n.trim().split(/\s+/).filter(Boolean);
	if (i.length !== 3) throw Error(`ace: invalid rgb color "${e}".`);
	return jt(i.map(zt), r === void 0 ? 1 : Bt(r));
}
function Pt(e) {
	let [t, n] = Rt(e), r = t.trim().split(/\s+/).filter(Boolean);
	if (r.length !== 3) throw Error(`ace: invalid oklch color "${e}".`);
	return {
		kind: "color",
		space: "oklch",
		coords: [
			Ft(r[0]),
			It(r[1]),
			Lt(r[2])
		],
		alpha: n === void 0 ? 1 : Bt(n)
	};
}
function Ft(e) {
	let t = e.trim();
	if (t.endsWith("%")) {
		let n = t.slice(0, -1).trim();
		if (!j.test(n)) throw Error(`ace: invalid oklch lightness "${e}".`);
		let r = Number(n);
		if (!Number.isFinite(r)) throw Error(`ace: invalid oklch lightness "${e}".`);
		return Vt(r / 100, 0, 1);
	}
	if (!j.test(t)) throw Error(`ace: invalid oklch lightness "${e}".`);
	let n = Number(t);
	if (!Number.isFinite(n)) throw Error(`ace: invalid oklch lightness "${e}".`);
	return Vt(n, 0, 1);
}
function It(e) {
	let t = e.trim();
	if (t.endsWith("%")) {
		let n = t.slice(0, -1).trim();
		if (!j.test(n)) throw Error(`ace: invalid oklch chroma "${e}".`);
		let r = Number(n);
		if (!Number.isFinite(r)) throw Error(`ace: invalid oklch chroma "${e}".`);
		return Math.max(0, r / 100 * .4);
	}
	if (!j.test(t)) throw Error(`ace: invalid oklch chroma "${e}".`);
	let n = Number(t);
	if (!Number.isFinite(n)) throw Error(`ace: invalid oklch chroma "${e}".`);
	return Math.max(0, n);
}
function Lt(e) {
	let t = e.trim(), n = Ut.exec(t);
	if (n !== null) {
		let t = Number(n[1]);
		if (!Number.isFinite(t)) throw Error(`ace: invalid oklch hue "${e}".`);
		let r = n[2].toLowerCase(), i = r === "grad" ? t * .9 : r === "rad" ? t * 180 / Math.PI : r === "turn" ? t * 360 : t;
		if (!Number.isFinite(i)) throw Error(`ace: invalid oklch hue "${e}".`);
		return Ht(i);
	}
	if (!j.test(t)) throw Error(`ace: invalid oklch hue "${e}".`);
	let r = Number(t);
	if (!Number.isFinite(r)) throw Error(`ace: invalid oklch hue "${e}".`);
	return Ht(r);
}
function Rt(e) {
	let t = e.indexOf("/");
	if (t < 0) return [e, void 0];
	let n = e.slice(t + 1).trim();
	if (e.indexOf("/", t + 1) >= 0 || n.length === 0) throw Error(`ace: invalid color alpha "${n}".`);
	return [e.slice(0, t), n];
}
function zt(e) {
	let t = e.trim();
	if (t.endsWith("%")) {
		let n = t.slice(0, -1).trim();
		if (!j.test(n)) throw Error(`ace: invalid rgb channel "${e}".`);
		return Vt(Number(n), 0, 100) / 100 * 255;
	}
	if (!j.test(t)) throw Error(`ace: invalid rgb channel "${e}".`);
	return Vt(Number(t), 0, 255);
}
function Bt(e) {
	let t = e.trim();
	if (t.endsWith("%")) {
		let n = t.slice(0, -1).trim();
		if (!j.test(n)) throw Error(`ace: invalid color alpha "${e}".`);
		return Vt(Number(n), 0, 100) / 100;
	}
	if (!j.test(t)) throw Error(`ace: invalid color alpha "${e}".`);
	return Vt(Number(t), 0, 1);
}
function Vt(e, t, n) {
	return Math.min(n, Math.max(t, e));
}
function Ht(e) {
	let t = e % 360;
	return t === 0 ? 0 : t < 0 ? t + 360 : t;
}
var j = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i, Ut = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)$/i, Wt = /^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)([a-z]+|%)$/i, Gt = /[-+]?\d*\.?\d+(?:e[-+]?\d+)?/g, Kt = /^(#|rgb|hsl|oklch)/i, qt = () => ({
	kind: "number",
	number: 0,
	unit: null,
	operator: null,
	numbers: null,
	strings: null
}), Jt = (e) => {
	let t = qt();
	if (e == null || e === "") return t;
	let n = +e;
	if (!Number.isNaN(n)) return t.number = n, t;
	let r = String(e);
	r[1] === "=" && (t.operator = r[0], r = r.slice(2));
	let i = r.includes(" ") ? null : Wt.exec(r);
	return i ? (t.kind = "unit", t.number = +i[1], t.unit = i[2], t) : t.operator ? (t.number = +r, t) : Kt.test(r) ? (t.kind = "color", t) : (t.kind = "complex", t.numbers = (r.match(Gt) ?? []).map(Number), t.strings = r.split(Gt), t);
}, Yt = (e, t, n) => n === "-" ? e - t : n === "+" ? e + t : e * t, Xt = (e, t, n) => n === 1 ? t : n === 0 ? e : e + (t - e) * n, Zt = (e, t, n) => e === "unit" ? `${t}${n}` : t, Qt = (e, t, n) => e < t ? t : e > n ? n : e, $t = (e) => e, en = (e = 1.68) => {
	let t = +e;
	return (e) => e ** +t;
}, tn = Math.PI / 2, nn = Math.PI * 2, rn = (e) => 1 - Math.cos(e * tn), an = (e) => 1 - Math.sqrt(1 - e * e), on = (e) => e ? 2 ** (10 * e - 10) : 0, sn = (e) => {
	let t, n = 4;
	for (; e < ((t = 2 ** --n) - 1) / 11;);
	return 1 / 4 ** (3 - n) - 7.5625 * ((t * 3 - 2) / 22 - e) ** 2;
}, cn = (e = 1.7) => {
	let t = +e;
	return (e) => (t + 1) * e * e * e - t * e * e;
}, ln = (e = 1, t = .3) => {
	let n = Qt(+e, 1, 10), r = Qt(+t, 1e-11, 2), i = r / nn * Math.asin(1 / n), a = nn / r;
	return (e) => e === 0 || e === 1 ? e : -n * 2 ** (-10 * (1 - e)) * Math.sin((1 - e - i) * a);
}, un = {
	in: (e) => (t) => e(t),
	out: (e) => (t) => 1 - e(1 - t),
	inOut: (e) => (t) => t < .5 ? e(t * 2) / 2 : 1 - e(t * -2 + 2) / 2,
	outIn: (e) => (t) => t < .5 ? (1 - e(1 - t * 2)) / 2 : (e(t * 2 - 1) + 1) / 2
}, dn = {
	Quad: en(2),
	Cubic: en(3),
	Quart: en(4),
	Quint: en(5),
	Sine: rn,
	Circ: an,
	Expo: on,
	Bounce: sn
}, fn = {
	"": en,
	Back: cn,
	Elastic: ln
}, pn = /* @__PURE__ */ new Set(), mn = (() => {
	let e = {
		linear: $t,
		none: $t
	};
	for (let t of Object.keys(un)) {
		let n = un[t];
		for (let r in dn) e[t + r] = n(dn[r]);
		for (let r in fn) {
			let i = fn[r], a = t + r;
			e[a] = (...e) => n(i(...e)), pn.add(a);
		}
	}
	return e;
})(), hn = /* @__PURE__ */ new Map(), gn = (e) => {
	let t = hn.get(e);
	if (t) return t;
	let n = e.indexOf("("), r;
	if (n <= -1) {
		let t = mn[e];
		if (t === void 0) throw Error(`ace: courbe d'easing inconnue « ${e} »`);
		r = pn.has(e) ? t() : t;
	} else {
		let t = e.slice(0, n), i = mn[t];
		if (i === void 0) throw Error(`ace: courbe d'easing inconnue « ${t} »`);
		r = i(...e.slice(n + 1, -1).split(","));
	}
	return hn.set(e, r), r;
}, _n = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, vn = (e) => {
	if (typeof e != "object" || !e || Array.isArray(e)) return !1;
	let t = e;
	return t.kind === "color" && (t.space === "srgb" || t.space === "oklch") && Array.isArray(t.coords) && typeof t.alpha == "number";
}, yn = (e) => typeof e == "object" && !!e && !Array.isArray(e) && !vn(e), bn = (e) => typeof e == "string" && kt(e) ? At(e) : e, xn = (e, t) => {
	let n = Jt(e), r = Jt(t);
	if (n.kind === "color" || r.kind === "color") throw Error("ace: une couleur ne peut pas etre preparee comme un nombre");
	if (n.kind !== "number" && n.kind !== "unit" || r.kind !== "number" && r.kind !== "unit") throw Error("ace: cette valeur textuelle doit etre preparee comme chaine composee");
	if (n.operator) throw Error("ace: from ne peut pas etre une valeur relative");
	if (n.unit !== r.unit) throw Error("ace: from et to doivent employer la meme unite");
	return {
		kind: "number",
		from: n.number,
		to: r.operator ? Yt(n.number, r.number, r.operator) : r.number,
		unit: n.unit
	};
}, Sn = (e, t) => {
	let n = e.matchAll(_n), r = t.matchAll(_n), i = [], a = 0;
	for (;;) {
		let e = n.next(), o = r.next();
		if (e.done || o.done) break;
		let s = e.value, c = o.value;
		c.index > a && i.push(t.slice(a, c.index)), s[0] === c[0] ? i.push(c[0]) : i.push(xn(+s[0], +c[0])), a = c.index + c[0].length;
	}
	return (a < t.length || i.length === 0) && i.push(t.slice(a)), {
		kind: "string",
		parts: i
	};
}, Cn = (e, t) => {
	if (e.space !== t.space) throw Error("ace: from et to doivent employer le meme espace de couleur");
	if (e.coords.length !== t.coords.length) throw Error("ace: from et to doivent avoir le meme nombre de coordonnees couleur");
	return {
		kind: "color",
		space: e.space,
		from: [...e.coords],
		to: [...t.coords],
		fromAlpha: e.alpha,
		toAlpha: t.alpha,
		hue: e.space === "oklch" ? "shorter" : null
	};
}, wn = (e, t) => {
	let n = bn(e), r = bn(t);
	if (vn(n) || vn(r)) {
		if (!vn(n) || !vn(r)) throw Error("ace: from et to doivent etre deux couleurs ou deux valeurs de meme nature");
		return Cn(n, r);
	}
	if (Array.isArray(n) || Array.isArray(r)) {
		if (!Array.isArray(n) || !Array.isArray(r)) throw Error("ace: from et to doivent etre deux tableaux ou deux valeurs de meme nature");
		let e = [], t = Math.min(n.length, r.length);
		for (let i = 0; i < t; i++) e.push(wn(n[i], r[i]));
		for (let n = t; n < r.length; n++) e.push({
			kind: "constant",
			value: r[n]
		});
		return {
			kind: "array",
			values: e
		};
	}
	if (yn(n) || yn(r)) {
		if (!yn(n) || !yn(r)) throw Error("ace: from et to doivent etre deux objets ou deux valeurs de meme nature");
		let e = {};
		for (let [t, i] of Object.entries(r)) e[t] = t in n ? wn(n[t], i) : {
			kind: "constant",
			value: i
		};
		return {
			kind: "object",
			values: e
		};
	}
	if ((typeof n == "number" || typeof n == "string") && (typeof r == "number" || typeof r == "string")) {
		let e = Jt(n), t = Jt(r);
		return e.kind === "complex" || t.kind === "complex" ? Sn(String(n), String(r)) : xn(n, r);
	}
	return {
		kind: "constant",
		value: r
	};
}, Tn = (e, t, n, r) => {
	if (Number.isNaN(e)) return t;
	if (Number.isNaN(t)) return e;
	let i = t - e, a = (i + 540) % 360 - 180;
	return e + (r === "shorter" ? a : r === "longer" ? a <= 0 ? a + 360 : a - 360 : r === "increasing" ? (i % 360 + 360) % 360 : -((-i % 360 + 360) % 360)) * n;
}, En = (e, t) => {
	if (e.kind === "constant") return e.value;
	if (e.kind === "number") return Zt(e.unit === null ? "number" : "unit", Xt(e.from, e.to, t), e.unit);
	if (e.kind === "color") {
		let n = e.from.map((n, r) => e.space === "oklch" && r === 2 && e.hue ? Tn(n, e.to[r], t, e.hue) : Xt(n, e.to[r], t));
		return {
			kind: "color",
			space: e.space,
			coords: n,
			alpha: Xt(e.fromAlpha, e.toAlpha, t)
		};
	}
	return e.kind === "string" ? e.parts.map((e) => typeof e == "string" ? e : En(e, t)).join("") : e.kind === "array" ? e.values.map((e) => En(e, t)) : Object.fromEntries(Object.entries(e.values).map(([e, n]) => [e, En(n, t)]));
}, Dn = (e, t) => wn(e, t), On = (e, t) => En(e, t), kn = "arc-length", An = 100, jn = (e, t) => {
	let n = 1 - t;
	return [2 * n * t * e[0] + t * t, 2 * n * t * e[1]];
}, Mn = (e, t = {}) => {
	let n = t.traversal ?? kn, r = [], i = [0, 0];
	for (let t of e.segments) {
		if (t.kind === "line") {
			if (Un(i, t.to)) continue;
			let e = [...t.to];
			r.push({
				kind: "line",
				to: e,
				length: Wn(i, e)
			}), i = e;
			continue;
		}
		if (Un(i, t.to)) continue;
		let e = Bn(i, t);
		if (e === null) {
			let e = [...t.to];
			r.push({
				kind: "line",
				to: e,
				length: Wn(i, e)
			}), i = e;
			continue;
		}
		r.push(e), i = e.to;
	}
	if (r.length === 0) throw Error("ACE path must contain at least one non-empty segment.");
	let a = r.reduce((e, t) => e + t.length, 0);
	return {
		kind: "segments",
		segments: r,
		traversal: n,
		lengths: n === kn ? Hn(r, a) : null
	};
}, Nn = (e, t) => {
	if (t <= 0 || t >= 1) return t;
	let n = 0, r = e.length - 1;
	for (; n < r;) {
		let i = Math.floor((n + r) / 2);
		e[i] < t ? n = i + 1 : r = i;
	}
	let i = n, a = i - 1, o = e[a], s = e[i];
	return (a + (t - o) / (s - o)) / An;
}, Pn = (e, t, n, r) => {
	if (e.kind === "quadratic") {
		let i = e.lengths ? Nn(e.lengths, r) : r, [a, o] = jn(e.control, i);
		return zn([a, o], t, n);
	}
	return zn(In(e, r), t, n);
};
function Fn(e) {
	return !Jn(e) || e.kind !== "quadratic" && e.kind !== "segments" || e.traversal !== "parameter" && e.traversal !== "arc-length" || e.lengths !== null && (!Array.isArray(e.lengths) || !e.lengths.every(E)) ? !1 : e.kind === "quadratic" ? qn(e.control) : Array.isArray(e.segments) && e.segments.length > 0 && e.segments.every(Kn);
}
function In(e, t) {
	let n = e.segments;
	if (t <= 0) return [0, 0];
	if (t >= 1) return n[n.length - 1].to;
	let r, i;
	if (e.lengths !== null) {
		let n = e.lengths.findIndex((e) => t <= e);
		n < 0 && (n = e.lengths.length - 1);
		let a = n === 0 ? 0 : e.lengths[n - 1], o = e.lengths[n];
		r = n, i = (t - a) / (o - a);
	} else {
		let e = t * n.length;
		r = Math.min(n.length - 1, Math.floor(e)), i = e - r;
	}
	let a = n[r];
	return Ln(a, r === 0 ? [0, 0] : n[r - 1].to, i);
}
function Ln(e, t, n) {
	if (e.kind === "line") return Gn(t, e.to, n);
	if (n <= 0) return t;
	if (n >= 1) return e.to;
	let r = Rn(e, n), i = Rn(e, 0), a = Rn(e, 1);
	return [r[0] + (1 - n) * (t[0] - i[0]) + n * (e.to[0] - a[0]), r[1] + (1 - n) * (t[1] - i[1]) + n * (e.to[1] - a[1])];
}
function Rn(e, t) {
	let n = e.startAngle + e.deltaAngle * t, r = e.rotation * Math.PI / 180, i = Math.cos(r), a = Math.sin(r), o = e.radius[0] * Math.cos(n), s = e.radius[1] * Math.sin(n);
	return [e.center[0] + i * o - a * s, e.center[1] + a * o + i * s];
}
function zn(e, t, n) {
	let r = n[0] - t[0], i = n[1] - t[1];
	return [t[0] + e[0] * r - e[1] * i, t[1] + e[0] * i + e[1] * r];
}
function Bn(e, t) {
	let n = Math.abs(t.radius[0]), r = Math.abs(t.radius[1]);
	if (n === 0 || r === 0) return null;
	let i = t.rotation * Math.PI / 180, a = Math.cos(i), o = Math.sin(i), s = (e[0] - t.to[0]) / 2, c = (e[1] - t.to[1]) / 2, l = a * s + o * c, u = -o * s + a * c, d = l * l / (n * n) + u * u / (r * r);
	if (d > 1) {
		let e = Math.sqrt(d);
		n *= e, r *= e;
	}
	let f = n * n * r * r - n * n * u * u - r * r * l * l, p = n * n * u * u + r * r * l * l, m = p === 0 ? 0 : (t.largeArc === t.sweep ? -1 : 1) * Math.sqrt(Math.max(0, f / p)), h = m * n * u / r, g = m * -r * l / n, _ = [a * h - o * g + (e[0] + t.to[0]) / 2, o * h + a * g + (e[1] + t.to[1]) / 2], v = [(l - h) / n, (u - g) / r], y = [(-l - h) / n, (-u - g) / r], b = Math.atan2(v[1], v[0]), x = Math.atan2(v[0] * y[1] - v[1] * y[0], v[0] * y[0] + v[1] * y[1]);
	!t.sweep && x > 0 && (x -= Math.PI * 2), t.sweep && x < 0 && (x += Math.PI * 2);
	let ee = {
		kind: "arc",
		to: [...t.to],
		center: _,
		radius: [n, r],
		rotation: t.rotation,
		startAngle: b,
		deltaAngle: x
	};
	return {
		...ee,
		length: Vn(ee, e)
	};
}
function Vn(e, t) {
	let n = t, r = 0;
	for (let i = 1; i <= An; i += 1) {
		let a = Ln(e, t, i / An);
		r += Wn(n, a), n = a;
	}
	return r;
}
function Hn(e, t) {
	let n = 0;
	return e.map((e) => (n += e.length, n / t));
}
function Un(e, t) {
	return e[0] === t[0] && e[1] === t[1];
}
function Wn(e, t) {
	return Math.hypot(t[0] - e[0], t[1] - e[1]);
}
function Gn(e, t, n) {
	return [e[0] + (t[0] - e[0]) * n, e[1] + (t[1] - e[1]) * n];
}
function Kn(e) {
	return !Jn(e) || !qn(e.to) || !E(e.length) ? !1 : e.kind === "line" ? !0 : e.kind === "arc" && qn(e.center) && qn(e.radius) && E(e.rotation) && E(e.startAngle) && E(e.deltaAngle);
}
function qn(e) {
	return Array.isArray(e) && e.length === 2 && e.every(E);
}
function Jn(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
//#endregion
//#region ../codplay/src/ace/tween.ts
var Yn = 1e3, Xn = "out(2)", Zn = (e, t, n) => e < t ? t : e > n ? n : e, Qn = (e) => Array.isArray(e) && e.length === 2 && typeof e[0] == "number" && typeof e[1] == "number" ? [e[0], e[1]] : null, $n = (e) => e === !0 || e === Infinity || typeof e == "number" && e < 0 ? Infinity : typeof e == "number" ? e + 1 : 1, er = (e) => {
	let t = e.duration ?? Yn;
	if (!Number.isFinite(t) || t <= 0) throw Error("ace: duration doit etre un nombre strictement positif");
	let n = e.delay ?? 0, r = e.loopDelay ?? 0, i = $n(e.loop), a = i === Infinity ? Infinity : (t + r) * i - r, o = typeof e.ease == "function" ? e.ease : gn(e.ease ?? Xn), s = e.path ? Qn(e.from) : null, c = e.path ? Qn(e.to) : null;
	if (e.path && (!s || !c)) throw Error("ace: une trajectoire exige deux points numeriques [x, y]");
	return {
		interval: Dn(e.from, e.to),
		duration: t,
		delay: n,
		iterationCount: i,
		loopDelay: r,
		reversed: e.reversed ?? !1,
		alternate: e.alternate ?? !1,
		ease: o,
		totalDuration: a,
		path: e.path ?? null,
		fromPoint: s,
		toPoint: c
	};
}, tr = (e, t) => {
	let n = Zn(t - e.delay, -e.delay, e.totalDuration), r = n >= e.totalDuration, i = 0, a = n;
	if (e.iterationCount > 1) {
		let t = e.duration + (r ? 0 : e.loopDelay);
		i = Zn(Math.floor(n / t), 0, e.iterationCount), r && i--, a = n - i * t || 0;
	}
	let o = e.reversed !== (e.alternate && i % 2 == 1), s = Zn(r ? o ? 0 : e.duration : o ? e.duration - a : a, 0, e.duration) / e.duration;
	return e.ease(s);
}, nr = (e, t) => e.path && e.fromPoint && e.toPoint ? Pn(e.path, e.fromPoint, e.toPoint, tr(e, t)) : On(e.interval, tr(e, t)), rr = "resolved", ir = "deferred", ar = {
	x: "translateX",
	y: "translateY",
	z: "translateZ"
}, or = Object.freeze([
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
]), sr = new Set(or);
function cr(e) {
	let t = ar[e] ?? e;
	return sr.has(t) ? t : void 0;
}
function lr(e) {
	return e !== "rotate3d" && e !== "matrix" && e !== "matrix3d";
}
function ur() {
	return or;
}
function dr(e, t) {
	if (mr(e)) {
		let e = Jt(t);
		if (e.operator !== null || e.kind !== "number" && e.kind !== "unit") throw Error(`ace: cannot materialize a transform identity from "${t}".`);
		return e.unit === null ? 0 : `0${e.unit}`;
	}
	if (hr(e)) {
		let e = Jt(t);
		if (e.operator !== null || e.kind !== "number") throw Error("ace: scale identity requires a unitless numeric reference.");
		return 1;
	}
}
function fr(e) {
	let t = pr(e.property, e.from, e.to);
	if (t.status === ir) throw Error(`ace: transform "${e.property}" requires a runtime from before preparation.`);
	return er({
		...e,
		from: t.value
	});
}
function pr(e, t, n) {
	if (t !== void 0) return {
		status: rr,
		value: t
	};
	if (typeof n != "number" && typeof n != "string") return {
		status: ir,
		property: e,
		to: n
	};
	let r = dr(e, n);
	return r === void 0 ? {
		status: ir,
		property: e,
		to: n
	} : {
		status: rr,
		value: r
	};
}
function mr(e) {
	return e === "translateX" || e === "translateY" || e === "translateZ" || e === "rotate" || e === "rotateX" || e === "rotateY" || e === "rotateZ" || e === "skew" || e === "skewX" || e === "skewY";
}
function hr(e) {
	return e === "scale" || e === "scaleX" || e === "scaleY" || e === "scaleZ";
}
//#endregion
//#region ../codplay/src/ace/svg-path.ts
var gr = /* @__PURE__ */ new Set([
	"M",
	"m",
	"L",
	"l",
	"A",
	"a"
]), _r = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
function vr(e, t = {}) {
	let n = t.precision ?? 2;
	if (!Number.isInteger(n) || n < 0) throw Error("SVG path precision must be a non-negative integer.");
	let r = yr(e);
	return xr(Mn({ segments: br(r.segments, r.start, r.end, n) }, { traversal: t.traversal }), n);
}
function yr(e) {
	let t = Sr(e), n = 0, r, i = [0, 0], a, o = [];
	for (; n < t.length;) {
		if (Tr(t[n]) && (r = t[n++]), r === void 0) throw Error("SVG path must start with a command.");
		if (!gr.has(r.toUpperCase())) throw Error(`SVG path command is unsupported: ${r}`);
		let e = r.toUpperCase(), s = r === r.toLowerCase(), c = e === "A" ? 7 : 2, l = Cr(t, n, c);
		if (n += c, e === "M") {
			if (a !== void 0) throw Error("SVG path must contain one subpath.");
			i = wr(l[0], l[1], i, s), a = i, r = s ? "l" : "L";
			continue;
		}
		if (e === "L") {
			let e = wr(l[0], l[1], i, s);
			o.push({
				kind: "line",
				to: e
			}), i = e;
			continue;
		}
		let u = wr(l[5], l[6], i, s);
		if (l[0] < 0 || l[1] < 0) throw Error("SVG arc radii must be non-negative.");
		if (!Er(l[3]) || !Er(l[4])) throw Error("SVG arc flags must be 0 or 1.");
		o.push({
			kind: "arc",
			to: u,
			radius: [l[0], l[1]],
			rotation: l[2],
			largeArc: l[3] === 1,
			sweep: l[4] === 1
		}), i = u;
	}
	if (a === void 0) throw Error("SVG path is missing its move command.");
	if (o.length === 0 || Dr(a, i)) throw Error("SVG path must contain a non-empty trajectory.");
	return {
		start: a,
		end: i,
		segments: o
	};
}
function br(e, t, n, r) {
	let i = n[0] - t[0], a = n[1] - t[1], o = i * i + a * a;
	if (o === 0) throw Error("SVG path start and end must be different.");
	let s = Math.sqrt(o), c = Math.atan2(a, i) * 180 / Math.PI, l = (e) => [M(((e[0] - t[0]) * i + (e[1] - t[1]) * a) / o, r), M((-(e[0] - t[0]) * a + (e[1] - t[1]) * i) / o, r)];
	return e.map((t, n) => {
		let i = n === e.length - 1;
		return t.kind === "line" ? {
			kind: "line",
			to: i ? [1, 0] : l(t.to)
		} : {
			kind: "arc",
			to: i ? [1, 0] : l(t.to),
			radius: [M(t.radius[0] / s, r), M(t.radius[1] / s, r)],
			rotation: M(t.rotation - c, r),
			largeArc: t.largeArc,
			sweep: t.sweep
		};
	});
}
function xr(e, t) {
	if (e.kind === "quadratic") return e;
	let n = e.segments.map((e) => e.kind === "line" ? {
		...e,
		to: Or(e.to, t),
		length: M(e.length, t)
	} : {
		...e,
		to: Or(e.to, t),
		center: Or(e.center, t),
		radius: Or(e.radius, t),
		rotation: M(e.rotation, t),
		startAngle: M(e.startAngle, t),
		deltaAngle: M(e.deltaAngle, t),
		length: M(e.length, t)
	}), r = e.lengths === null ? null : e.lengths.map((n, r) => r === e.lengths.length - 1 ? 1 : M(n, t));
	return {
		...e,
		segments: n,
		lengths: r
	};
}
function Sr(e) {
	let t = e.match(_r) ?? [], n = e.replace(_r, "").replace(/[\s,]/g, "");
	if (n.length > 0) throw Error(`SVG path contains invalid syntax: ${n}`);
	return t;
}
function Cr(e, t, n) {
	if (t + n > e.length || e.slice(t, t + n).some(Tr)) throw Error("SVG path command has incomplete arguments.");
	return e.slice(t, t + n).map((e) => {
		let t = Number(e);
		if (!Number.isFinite(t)) throw Error(`SVG path number is invalid: ${e}`);
		return t;
	});
}
function wr(e, t, n, r) {
	return r ? [n[0] + e, n[1] + t] : [e, t];
}
function Tr(e) {
	return e !== void 0 && /^[a-zA-Z]$/.test(e);
}
function Er(e) {
	return e === 0 || e === 1;
}
function Dr(e, t) {
	return e[0] === t[0] && e[1] === t[1];
}
function M(e, t) {
	let n = 10 ** t, r = Math.round(e * n) / n;
	return Object.is(r, -0) ? 0 : r;
}
function Or(e, t) {
	return [M(e[0], t), M(e[1], t)];
}
Math.PI / 180, Math.PI / 200, Math.PI * 2;
//#endregion
//#region ../codplay/src/ace/matrix-2d.ts
var N = (e, t) => ({
	a: e.a * t.a + e.c * t.b,
	b: e.b * t.a + e.d * t.b,
	c: e.a * t.c + e.c * t.d,
	d: e.b * t.c + e.d * t.d,
	e: e.a * t.e + e.c * t.f + e.e,
	f: e.b * t.e + e.d * t.f + e.f
}), kr = (e) => {
	let t = e.a * e.d - e.b * e.c;
	if (Math.abs(t) < 1e-8) return null;
	let n = 1 / t;
	return {
		a: e.d * n,
		b: -e.b * n,
		c: -e.c * n,
		d: e.a * n,
		e: (e.c * e.f - e.d * e.e) * n,
		f: (e.b * e.e - e.a * e.f) * n
	};
};
//#endregion
//#region ../codplay/src/runtime/components/polygon/polygon-geometry.ts
function Ar(e) {
	return Math.max(0, Math.min(1, e));
}
function jr(e) {
	let t = e.inner !== null && e.inner > 0 && e.inner < e.outer ? e.sides * 2 : e.sides, n = e.inflexion, r = typeof n == "number" ? Array.from({ length: t }, () => n) : Array.from({ length: t }, (e, t) => n[t] ?? 0);
	return {
		sides: e.sides,
		inner: e.inner,
		outer: e.outer,
		rotationDeg: e.rotationDeg,
		inflexion: r
	};
}
function Mr(e) {
	let { sides: t, inner: n, outer: r, rotationDeg: i } = e, a = n !== null && n > 0 && n < r, o = a ? t * 2 : t, s = i * Math.PI / 180, c = [];
	for (let e = 0; e < o; e += 1) {
		let t = s + Math.PI * 2 * e / o, i = a && e % 2 == 1 ? n : r;
		c.push({
			x: 50 + Math.cos(t) * i,
			y: 50 + Math.sin(t) * i
		});
	}
	return c;
}
function Nr(e, t) {
	if (e.length === 0) return [];
	if (e.length === 1) return Array.from({ length: t }, () => ({ ...e[0] }));
	let n = [], r = 0;
	for (let t = 0; t < e.length; t += 1) {
		let i = e[t], a = e[(t + 1) % e.length], o = Math.hypot(a.x - i.x, a.y - i.y);
		n.push(o), r += o;
	}
	if (r === 0) return Array.from({ length: t }, () => ({ ...e[0] }));
	let i = [];
	for (let a = 0; a < t; a += 1) {
		let o = a / t * r, s = 0;
		for (let t = 0; t < e.length; t += 1) {
			let r = n[t], a = s + r;
			if (o <= a || t === e.length - 1) {
				let n = r === 0 ? 0 : (o - s) / r, a = e[t], c = e[(t + 1) % e.length];
				i.push({
					x: a.x + (c.x - a.x) * n,
					y: a.y + (c.y - a.y) * n
				});
				break;
			}
			s = a;
		}
	}
	return i;
}
function Pr(e, t, n) {
	let r = Ar(n);
	return e.map((e, n) => ({
		x: e.x + (t[n].x - e.x) * r,
		y: e.y + (t[n].y - e.y) * r
	}));
}
function Fr(e, t, n) {
	if (n === 0) return `L ${t.x.toFixed(3)} ${t.y.toFixed(3)}`;
	let r = Math.hypot(t.x - e.x, t.y - e.y);
	if (r === 0) return `L ${t.x.toFixed(3)} ${t.y.toFixed(3)}`;
	let i = (r * r / 4 + n * n) / (2 * Math.abs(n)), a = +(Math.abs(n) > r / 2), o = +(n > 0);
	return `A ${i.toFixed(3)} ${i.toFixed(3)} 0 ${a} ${o} ${t.x.toFixed(3)} ${t.y.toFixed(3)}`;
}
function Ir(e, t) {
	if (e.length === 0) return "";
	let n = e[0], r = [`M ${n.x.toFixed(3)} ${n.y.toFixed(3)}`];
	for (let n = 0; n < e.length; n += 1) r.push(Fr(e[n], e[(n + 1) % e.length], t[n] ?? 0));
	return r.push("Z"), r.join(" ");
}
function Lr(e) {
	let t = jr(e);
	return Ir(Mr(t), t.inflexion);
}
function Rr(e) {
	let t = Pr(Nr(Mr(jr(e.from)), e.sampleCount), Nr(Mr(jr(e.to)), e.sampleCount), e.progress);
	return Ir(t, Array.from({ length: t.length }, () => 0));
}
function zr(e, t) {
	return Br(e.sides, t.sides) && Br(e.inner, t.inner) && Br(e.outer, t.outer) && Br(e.rotationDeg, t.rotationDeg) && Br(e.inflexion, t.inflexion);
}
function Br(e, t) {
	return Object.is(e, t) ? !0 : Array.isArray(e) || Array.isArray(t) ? Array.isArray(e) && Array.isArray(t) && e.length === t.length && e.every((e, n) => Br(e, t[n])) : !1;
}
//#endregion
//#region ../codplay/src/runtime/components/polygon/polygon-types.ts
function Vr(e) {
	return e.sides !== void 0 || e.inner !== void 0 || e.outer !== void 0 || e.rotationDeg !== void 0 || e.inflexion !== void 0;
}
//#endregion
//#region ../codplay/src/runtime/components/polygon/polygon-component.ts
var Hr = {
	path: "path",
	content: "content"
}, Ur = "http://www.w3.org/2000/svg", Wr = /* @__PURE__ */ new Set([
	"sides",
	"inner",
	"outer",
	"inflexion",
	"diameter"
]), Gr = class e extends w {
	static declaredServices = [
		"className",
		"style",
		"attr",
		"content"
	];
	logicalShapeState = null;
	activeMorph = null;
	constructor(t) {
		super(t), this.services.declare(e.declaredServices);
	}
	render() {
		return `
      <svg viewBox="0 0 100 100" xmlns="${Ur}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path data-part="${Hr.path}" fill="currentColor" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"></path>
        <text data-part="${Hr.content}" x="50" y="50" text-anchor="middle" dominant-baseline="middle" fill="var(--polygon-label-color, currentColor)" style="pointer-events:none"></text>
      </svg>
    `;
	}
	update(e) {
		if (this.node === null) throw Error(`Polygon component is not materialized: ${this.perso.id}`);
		let t = Kr(e.state, e.activeActions), n = t.state, r = this.perso.initial, i = Yr(r), a = this.logicalShapeState ?? i, o = Yr(n, a), s = $r(n.diameter, $r(r.diameter, void 0));
		this.services.apply(this.node, {
			className: e.state.className,
			style: ei(e.state.style, s),
			attr: e.state.attr
		}), this.services.apply(this.getPart(Hr.content), { content: t.deriveSidesContent ? String(o.sides) : n.content === void 0 ? "" : String(n.content) });
		let c = !zr(a, o), l = ni(e.activeActions, e.state.morph, e.timeMs);
		c && l !== void 0 ? this.activeMorph = ri(a, o, l) : c ? this.activeMorph = null : this.activeMorph === null && l !== void 0 && (this.activeMorph = ri(a, o, l)), this.logicalShapeState = o;
		let u = this.getPart(Hr.path);
		if (e.registerAnimation !== void 0 && this.activeMorph !== null) {
			let t = this.activeMorph, n = {
				id: `polygon-morph:${t.key}`,
				startAt: t.startAt,
				endAt: t.startAt + t.delayMs + t.duration,
				sample: (e) => {
					let n = ii(t, e);
					return {
						value: n,
						apply: () => this.services.apply(u, { attr: { d: n } })
					};
				}
			};
			e.registerAnimation(n);
			return;
		}
		let d = this.activeMorph === null ? Lr(o) : ii(this.activeMorph, e.timeMs);
		this.services.apply(u, { attr: { d } });
	}
};
function Kr(e, t) {
	let n = { ...e }, r = !1;
	for (let e of t ?? []) {
		let t = qr(e.name);
		t === void 0 || e.action.value === void 0 || (n[t] = e.action.value, t === "sides" && (e.action.content === void 0 ? r = !0 : (n.content = e.action.content, r = !1)));
	}
	return {
		state: n,
		deriveSidesContent: r
	};
}
function qr(e) {
	let t = e.startsWith("polygon:") ? e.slice(8) : "";
	return Wr.has(t) ? t : void 0;
}
var Jr = {
	sides: 3,
	inner: null,
	outer: 40,
	rotationDeg: -90,
	inflexion: 0
};
function Yr(e, t = Jr) {
	let n = Math.max(1, Xr(e.outer, t.outer));
	return {
		sides: Math.max(3, Math.round(Xr(e.sides, t.sides))),
		inner: Zr(e.inner, t.inner, n),
		outer: n,
		rotationDeg: Xr(e.rotationDeg, t.rotationDeg),
		inflexion: Qr(e.inflexion, t.inflexion)
	};
}
function Xr(e, t) {
	return ti(e) ?? t;
}
function Zr(e, t, n) {
	if (e == null) return e === null ? null : t;
	let r = ti(e);
	if (r === void 0) return t;
	let i = Math.round(r);
	return i <= 0 ? null : Math.min(n, i);
}
function Qr(e, t) {
	if (e === void 0) return t;
	if (!Array.isArray(e)) return Xr(e, typeof t == "number" ? t : 0);
	let n = (e) => typeof t == "number" ? t : t[e] ?? 0;
	return e.map((e, t) => Xr(e, n(t)));
}
function $r(e, t) {
	if (e === void 0) return t;
	let n = ti(e);
	return n === void 0 ? t : Math.max(0, n);
}
function ei(e, t) {
	let n = T(e) ? { ...e } : {};
	return t !== void 0 && (n.width = `${t}px`, n.height = `${t}px`), Object.keys(n).length === 0 ? void 0 : n;
}
function ti(e) {
	if (typeof e != "number" && typeof e != "string") return;
	let t = Number(e);
	return Number.isFinite(t) ? t : void 0;
}
function ni(e, t, n) {
	let r = [...e ?? []].reverse().find((e) => e.action.morph !== void 0 && Vr(e.action));
	return r === void 0 ? t === void 0 ? void 0 : {
		options: t,
		startAt: n,
		key: `direct:${n}`
	} : {
		options: r.action.morph,
		startAt: r.startAt,
		key: r.eventId ?? `${r.name}:${r.startAt}`
	};
}
function ri(e, t, n) {
	return {
		from: e,
		to: t,
		startAt: n.startAt,
		duration: n.options.duration,
		delayMs: n.options.delayMs,
		ease: gn(n.options.ease),
		sampleCount: n.options.sampleCount,
		key: n.key
	};
}
function ii(e, t) {
	let n = t - e.startAt - e.delayMs, r = e.duration === 0 ? 1 : Math.max(0, Math.min(1, n / e.duration));
	return r <= 0 ? Lr(e.from) : r >= 1 ? Lr(e.to) : Rr({
		from: e.from,
		to: e.to,
		progress: e.ease(r),
		sampleCount: e.sampleCount
	});
}
//#endregion
//#region ../codplay/src/runtime/components/polygon/polygon-validation.ts
var ai = 3, oi = 40, si = -90, ci = 700, li = 0, ui = 96, di = (e, t) => {
	if (!k(e)) {
		O(t, "AUTHOR_POLYGON_INITIAL_INVALID", "polygon initial state must be a plain object.");
		return;
	}
	hi(e, t);
}, fi = (e, t) => {
	T(e) && hi(e, t);
};
function pi(e) {
	let t = { ...e }, n = vi(e.sides === void 0 ? ai : e.sides), r = yi(e.outer === void 0 ? oi : e.outer), i = e.inner === void 0 || e.inner === null ? null : xi(e.inner, r);
	return t.sides = n, t.outer = r, t.inner = i, t.rotationDeg = e.rotationDeg === void 0 ? si : e.rotationDeg, e.diameter !== void 0 && (t.diameter = bi(e.diameter)), t.inflexion = Ci(e.inflexion, Si(n, i, r)), e.morph !== void 0 && (t.morph = Ti(e.morph)), t;
}
function mi(e) {
	let t = { ...e };
	return t.sides === void 0 ? delete t.sides : t.sides = vi(t.sides), t.outer === void 0 ? delete t.outer : t.outer = yi(t.outer), t.inner === void 0 ? delete t.inner : t.inner === null ? t.inner = null : t.inner = xi(t.inner, t.outer), t.rotationDeg === void 0 && delete t.rotationDeg, t.diameter === void 0 ? delete t.diameter : t.diameter = bi(t.diameter), t.inflexion !== void 0 && (t.inflexion = wi(t.inflexion)), t.morph !== void 0 && (t.morph = Ti(t.morph)), t;
}
function hi(e, t) {
	P(e.sides, "sides", t), P(e.inner, "inner", t, !0), P(e.outer, "outer", t), P(e.rotationDeg, "rotationDeg", t), P(e.diameter, "diameter", t), gi(e.inflexion, t), e.morph !== void 0 && _i(e.morph, t);
}
function P(e, t, n, r = !1) {
	e === void 0 || r && e === null || typeof e == "number" && Number.isFinite(e) || O(n, `AUTHOR_POLYGON_${t.toUpperCase()}_INVALID`, `polygon.${t} must be a finite number.`, t);
}
function gi(e, t) {
	if (e !== void 0) {
		if (Array.isArray(e)) {
			e.forEach((e, n) => P(e, `inflexion[${n}]`, t));
			return;
		}
		P(e, "inflexion", t);
	}
}
function _i(e, t) {
	if (typeof e != "boolean") {
		if (!T(e)) {
			O(t, "AUTHOR_POLYGON_MORPH_INVALID", "polygon.morph must be a boolean or plain object.", "morph");
			return;
		}
		P(e.duration, "morph.duration", t), P(e.delayMs, "morph.delayMs", t), P(e.precision, "morph.precision", t), P(e.sampleCount, "morph.sampleCount", t);
		for (let n of ["ease", "easing"]) e[n] !== void 0 && typeof e[n] != "string" && O(t, "AUTHOR_POLYGON_MORPH_INVALID", `polygon.morph.${n} must be a string.`, `morph.${n}`);
	}
}
function vi(e) {
	return Math.max(3, Math.round(e));
}
function yi(e) {
	return Math.max(1, e);
}
function bi(e) {
	return Math.max(0, e);
}
function xi(e, t) {
	return t === void 0 ? Math.max(0, e) : Math.max(0, Math.min(t, e));
}
function Si(e, t, n) {
	return t !== null && t > 0 && t < n ? e * 2 : e;
}
function Ci(e, t) {
	if (Array.isArray(e)) return Array.from({ length: t }, (t, n) => e[n] ?? 0);
	let n = e === void 0 ? 0 : e;
	return Array.from({ length: t }, () => n);
}
function wi(e) {
	return Array.isArray(e) ? e.map((e) => e) : e;
}
function Ti(e) {
	let t = typeof e == "object" && e ? e : {}, n = typeof t.ease == "string" ? t.ease : typeof t.easing == "string" ? t.easing : "linear";
	return {
		duration: t.duration === void 0 ? ci : Math.max(0, t.duration),
		delayMs: t.delayMs === void 0 ? li : Math.max(0, t.delayMs),
		ease: n,
		sampleCount: t.sampleCount === void 0 ? ui : Math.max(8, Math.round(t.sampleCount))
	};
}
//#endregion
//#region ../codplay/src/runtime/components/tag/tag-component.ts
var Ei = class e extends w {
	static declaredServices = [
		"className",
		"style",
		"attr",
		"content"
	];
	constructor(t) {
		super(t), this.services.declare(e.declaredServices);
	}
	render() {
		let e = this.perso.initial.tag;
		return `<${e}></${e}>`;
	}
	update(e) {
		if (this.node === null) throw Error(`Tag component is not materialized: ${this.perso.id}`);
		let t = e.state.tag === "output" && e.state.value !== void 0 ? e.state.value : e.state.content;
		this.services.apply(this.node, {
			className: e.state.className,
			style: e.state.style,
			attr: e.state.attr,
			content: t
		});
	}
}, Di = (e, t) => {
	if (!k(e)) {
		O(t, "AUTHOR_TAG_INITIAL_INVALID", "tag initial state must be a plain object.");
		return;
	}
	e.tag !== void 0 && !we(e.tag) && O(t, "AUTHOR_TAG_NAME_INVALID", "tag must be a valid HTML tag name.", "tag");
};
function Oi(e) {
	return {
		...e,
		tag: e.tag === void 0 ? "div" : e.tag
	};
}
//#endregion
//#region ../codplay/src/runtime/components/slot/slot-component.ts
var ki = class e extends w {
	static declaredServices = [
		"className",
		"style",
		"attr"
	];
	constructor(t) {
		super(t), this.services.declare(e.declaredServices);
	}
	render() {
		let e = this.perso.initial.tag ?? "div";
		return `<${e}></${e}>`;
	}
	update(e) {
		if (this.node === null) throw Error(`Foreign content component is not materialized: ${this.perso.id}`);
		this.services.apply(this.node, {
			className: e.state.className,
			style: e.state.style,
			attr: e.state.attr
		});
	}
}, Ai = (e, t) => {
	if (!k(e)) {
		O(t, "AUTHOR_SLOT_INITIAL_INVALID", "slot initial state must be a plain object.");
		return;
	}
	e.tag !== void 0 && !we(e.tag) && O(t, "AUTHOR_SLOT_TAG_INVALID", "slot.tag must be a valid HTML tag name.", "tag"), e.name !== void 0 && O(t, "AUTHOR_SLOT_NAME_ROOT_ONLY", "slot.name is a perso-root property and cannot be declared in initial state.", "name"), e.content !== void 0 && !Pi(e.content) && O(t, "AUTHOR_SLOT_CONTENT_INVALID", "slot.content must be a JSON-compatible foreign reference.", "content"), Fi(e.replace, t);
}, ji = (e, t) => {
	if (!k(e)) {
		O(t, "AUTHOR_SLOT_ACTION_INVALID", "slot action must be a plain object.");
		return;
	}
	e.tag !== void 0 && !we(e.tag) && O(t, "AUTHOR_SLOT_TAG_INVALID", "slot.tag must be a valid HTML tag name.", "tag"), e.name !== void 0 && O(t, "AUTHOR_SLOT_NAME_IMMUTABLE", "slot.name is immutable and cannot be changed by an action.", "name"), e.content !== void 0 && !Pi(e.content) && O(t, "AUTHOR_SLOT_CONTENT_INVALID", "slot.content must be a JSON-compatible foreign reference.", "content"), Fi(e.replace, t);
}, Mi = (e, t) => {
	(typeof e.name != "string" || e.name.trim().length === 0) && t.diagnostics.error("AUTHOR_SLOT_NAME_REQUIRED", "A slot perso must declare a non-empty root name.", {
		refs: t.refs,
		context: {
			path: `${t.path}.name`,
			type: "slot"
		}
	});
};
function Ni(e) {
	return {
		...e,
		tag: e.tag === void 0 ? "div" : e.tag
	};
}
function Pi(e) {
	return e === null || typeof e == "string" || typeof e == "number" || typeof e == "boolean" ? Number.isFinite(e) || typeof e != "number" : Array.isArray(e) ? e.every(Pi) : k(e) ? Object.values(e).every(Pi) : !1;
}
function Fi(e, t) {
	if (e !== void 0 && !(e === "fade" || e === "fade-in")) {
		if (!k(e)) {
			O(t, "AUTHOR_SLOT_REPLACE_INVALID", "slot.replace must be \"fade\", \"fade-in\", or an object with a supported transition.", "replace");
			return;
		}
		e.transition !== "fade" && e.transition !== "fade-in" && O(t, "AUTHOR_SLOT_REPLACE_TRANSITION_INVALID", "slot.replace.transition must be \"fade\" or \"fade-in\".", "replace.transition"), e.duration !== void 0 && (typeof e.duration != "number" || !Number.isFinite(e.duration) || e.duration < 0) && O(t, "AUTHOR_SLOT_REPLACE_DURATION_INVALID", "slot.replace.duration must be a finite non-negative number.", "replace.duration");
	}
}
//#endregion
//#region ../codplay/src/runtime/targets/runtime-target-registry.ts
var Ii = class {
	entries = /* @__PURE__ */ new Map();
	publish(e, t) {
		Li(e);
		let n = Ri(e), r = {
			token: Symbol(n),
			value: t,
			available: !1
		};
		return this.entries.set(n, r), {
			setAvailable: (e) => {
				this.entries.get(n)?.token === r.token && (r.available = e);
			},
			release: () => {
				this.entries.get(n)?.token === r.token && this.entries.delete(n);
			}
		};
	}
	resolve(e) {
		Li(e);
		let t = this.entries.get(Ri(e));
		return t?.available === !0 ? t.value : void 0;
	}
	clear() {
		this.entries.clear();
	}
};
function Li(e) {
	if (e.host.trim().length === 0) throw Error("Runtime target host identity must not be empty.");
	if (e.target !== void 0 && e.target.trim().length === 0) throw Error("Runtime target identity must not be empty.");
}
function Ri(e) {
	return JSON.stringify([e.host, e.target ?? null]);
}
//#endregion
//#region ../codplay/src/runtime/components/runtime-component-runtime.ts
var zi = class {
	mounted = /* @__PURE__ */ new Map();
	stateRevisions = /* @__PURE__ */ new Map();
	lastStates = /* @__PURE__ */ new Map();
	lastActions = /* @__PURE__ */ new Map();
	lastTargets = /* @__PURE__ */ new Map();
	animations = /* @__PURE__ */ new Map();
	externalAnimations = /* @__PURE__ */ new Map();
	targetRegistry = new Ii();
	options;
	moduleServices = /* @__PURE__ */ new Map();
	constructor(e) {
		this.options = e;
	}
	setModuleServices(e) {
		this.moduleServices = e;
	}
	getComponentSurfaces() {
		return {
			getSurface: (e, t) => this.mounted.get(e)?.surfaces[t],
			getInputSurface: (e) => this.mounted.get(e)?.surfaces.input,
			getForeignContentSurface: (e) => this.mounted.get(e)?.surfaces.foreignContent,
			getReplaceSurface: (e) => this.mounted.get(e)?.surfaces.replace
		};
	}
	prepareExternalPresentation(e) {
		this.cancelExternalPresentation(e.componentId);
		for (let t of this.moduleServices.values()) {
			let n = t.prepareExternalPresentation?.(e);
			if (n === void 0) continue;
			this.externalAnimations.set(e.componentId, {
				animation: n.animation,
				hasValue: !1,
				lastValue: void 0,
				lastTimeMs: void 0,
				presentation: n
			});
			let r = !1;
			return {
				start: () => {
					if (!r) {
						r = !0;
						try {
							n.start(), this.presentExternalAnimations(e.componentId, e.timeMs);
						} catch (t) {
							throw this.cancelExternalPresentation(e.componentId, n), t;
						}
					}
				},
				cancel: () => this.cancelExternalPresentation(e.componentId, n)
			};
		}
	}
	getStateRevision(e) {
		return this.stateRevisions.get(e);
	}
	sync(e, t = !1, n = {}) {
		let r = n.phase ?? "normal";
		r !== "normal" && this.cancelAllExternalPresentations();
		let i = Object.values(e.persos);
		for (let t of i) this.mounted.has(t.key) || this.mountComponent(e, t.key);
		for (let e of i) {
			let t = this.mounted.get(e.key);
			t !== void 0 && t.targetRegistration?.setAvailable(this.options.catalog.resolveComponentAvailability(e.type, e.placement.mounted));
		}
		for (let n of i) {
			let i = this.mounted.get(n.key);
			if (i === void 0) continue;
			let a = Vi(n.actions), o = this.resolveTarget(i), s = this.hasTargetChanged(n.key, o);
			(r === "geometry-capture" || t || this.hasStateChanged(n.key, n.state) || !Ui(this.lastActions.get(n.key), a) || s) && (this.applyComponentUpdate(i, n.key, {
				state: n.state,
				timeMs: e.timeMs,
				target: o,
				activeActions: n.actions
			}, r), this.lastActions.set(n.key, a), this.recordStateRevision(n.key, n.state)), this.lastTargets.set(n.key, o);
		}
	}
	presentAt(e) {
		let t = [], n = 0;
		for (let [e, r] of this.animations) for (let i of r) t.push({
			componentId: e,
			active: i,
			external: !1,
			registrationOrder: n
		}), n += 1;
		for (let [e, r] of this.externalAnimations) t.push({
			componentId: e,
			active: r,
			external: !0,
			registrationOrder: n
		}), n += 1;
		t.sort((e, t) => {
			let n = Hi(e.active.animation) - Hi(t.active.animation);
			return n === 0 ? e.registrationOrder - t.registrationOrder : n;
		});
		for (let n of t) if (this.presentAnimationEntries([n.active], e), n.external) {
			let e = this.externalAnimations.get(n.componentId);
			e === n.active && e.lastTimeMs !== void 0 && e.lastTimeMs >= e.animation.endAt && this.externalAnimations.delete(n.componentId);
		}
	}
	updateLive(e, t, n) {
		let r = this.mounted.get(e);
		if (r === void 0) throw Error(`Runtime component is not mounted: ${e}`);
		this.hasStateChanged(e, t) && (this.applyComponentUpdate(r, e, {
			state: t,
			timeMs: n,
			target: this.lastTargets.get(e)
		}, "normal"), this.recordStateRevision(e, t));
	}
	destroy() {
		this.cancelAllExternalPresentations();
		for (let e of this.mounted.values()) e.targetRegistration?.release(), e.component.destroy(), e.handle?.destroy();
		this.mounted.clear(), this.stateRevisions.clear(), this.lastStates.clear(), this.lastActions.clear(), this.lastTargets.clear(), this.targetRegistry.clear(), this.animations.clear(), this.externalAnimations.clear();
	}
	beforeSeek() {
		for (let e of this.mounted.values()) e.component.beforeSeek();
	}
	afterSeek() {
		for (let e of this.mounted.values()) e.component.afterSeek();
	}
	onSequenceEnd() {
		for (let e of this.mounted.values()) e.component.onSequenceEnd();
	}
	onReset() {
		for (let e of this.mounted.values()) e.component.onReset();
	}
	applyComponentUpdate(e, t, n, r) {
		let i = [], a = {
			...e.identity,
			persoId: e.persoId,
			state: n.state,
			timeMs: n.timeMs,
			activeActions: n.activeActions ?? [],
			phase: r,
			registerAnimation: (e) => i.push(e)
		};
		try {
			for (let e of this.moduleServices.values()) e.beforeComponentUpdate?.(a);
			e.component.update({
				...n,
				registerAnimation: (e) => i.push(e)
			});
			for (let e of this.moduleServices.values()) e.afterComponentUpdate?.(a);
		} catch (e) {
			for (let t of this.moduleServices.values()) t.onComponentUpdateError?.(a, e);
			throw e;
		}
		if (i.length === 0) {
			this.animations.delete(t);
			return;
		}
		this.animations.set(t, i.map((e) => {
			let n = this.animations.get(t)?.find((t) => t.animation.id === e.id && t.animation.startAt === e.startAt && t.animation.endAt === e.endAt);
			return n === void 0 ? {
				animation: e,
				hasValue: !1,
				lastValue: void 0,
				lastTimeMs: void 0
			} : {
				...n,
				animation: e
			};
		}));
	}
	presentExternalAnimations(e, t) {
		let n = this.externalAnimations.get(e);
		n !== void 0 && (this.presentAnimationEntries([n], t), n.lastTimeMs !== void 0 && n.lastTimeMs >= n.animation.endAt && this.externalAnimations.delete(e));
	}
	presentAnimationEntries(e, t) {
		for (let n of e) {
			if (n.lastTimeMs !== void 0 && n.lastTimeMs >= n.animation.endAt && t >= n.lastTimeMs) {
				n.lastTimeMs = t;
				continue;
			}
			let e = n.animation.sample(t);
			e !== void 0 && (!n.hasValue || !Ui(n.lastValue, e.value)) && (e.apply(), n.lastValue = e.value, n.hasValue = !0), n.lastTimeMs = t;
		}
	}
	cancelExternalPresentation(e, t) {
		let n = this.externalAnimations.get(e);
		if (n === void 0) {
			t?.cancel();
			return;
		}
		if (t !== void 0 && n.presentation !== t) {
			t.cancel();
			return;
		}
		this.externalAnimations.delete(e), n.presentation.cancel();
	}
	cancelAllExternalPresentations() {
		for (let [e, t] of this.externalAnimations) this.externalAnimations.delete(e), t.presentation.cancel();
	}
	hasStateChanged(e, t) {
		let n = this.lastStates.get(e);
		return n === void 0 || !Ui(n, t);
	}
	hasTargetChanged(e, t) {
		return !this.lastTargets.has(e) || !Object.is(this.lastTargets.get(e), t);
	}
	resolveTarget(e) {
		if (e.relation !== void 0) return this.targetRegistry.resolve(e.relation);
	}
	mountComponent(e, t) {
		let n = e.persos[t];
		if (n === void 0) throw Error(`Runtime component perso is missing: ${t}`);
		let r = e.scene.scene.stories[n.storyId]?.persos.find((e) => e.id === n.persoId);
		if (r === void 0) throw Error(`Compiled component perso is missing: ${t}`);
		let i = {
			componentId: n.key,
			storyId: n.storyId,
			componentType: n.type
		}, a = this.options.catalog.createComponent(n.type, {
			perso: {
				id: n.persoId,
				storyId: n.storyId,
				initial: r.initial,
				actions: r.actions
			},
			resourceMetadata: this.options.resourceMetadata,
			resourceMedia: this.options.resourceMedia,
			runtime: this.options.runtime,
			captureSources: this.options.captureSources
		}, i, this.options.materializer, this.moduleServices), o, s, c;
		try {
			a instanceof w && (o = this.options.materializer.materializeComponent(a, i, r.initial, this.options.catalog.getMountablePartIds(n.type, i), this.moduleServices)), a.initialize();
			let e = this.options.catalog.getComponentSurfaces(n.type, a, i, this.options.materializer), t = a instanceof w ? this.options.materializer.getReplaceSurface?.(n.key) : void 0;
			s = t === void 0 ? e : {
				...e,
				replace: t
			};
			let l = this.options.catalog.getComponentTargetPublication(n.type, a, i, this.options.materializer);
			if (l !== void 0) {
				let e = Bi(r.rel, n.persoId, l.scope);
				e !== void 0 && (c = this.targetRegistry.publish(e, l.value), c.setAvailable(this.options.catalog.resolveComponentAvailability(n.type, n.placement.mounted)));
			}
		} catch (e) {
			throw c?.release(), o?.destroy(), a.destroy(), e;
		}
		let l = {
			identity: i,
			persoId: n.persoId,
			relation: r.rel,
			component: a,
			surfaces: s,
			handle: o,
			targetRegistration: c
		};
		return this.mounted.set(n.key, l), l;
	}
	recordStateRevision(e, t) {
		let n = this.lastStates.get(e);
		n !== void 0 && Ui(n, t) || (this.lastStates.set(e, t), this.stateRevisions.set(e, (this.stateRevisions.get(e) ?? 0) + 1));
	}
};
function Bi(e, t, n) {
	if ((n ?? "target") === "host") return { host: t };
	if (e?.host !== void 0) return {
		host: e.host,
		target: t
	};
}
function Vi(e) {
	return (e ?? []).map(({ elapsedMs: e, ...t }) => t);
}
function Hi(e) {
	return +(e.presentationPhase === "commit");
}
function Ui(e, t) {
	if (Object.is(e, t)) return !0;
	if (e === null || t === null || typeof e != "object" || typeof t != "object") return !1;
	if (Array.isArray(e) || Array.isArray(t)) return !Array.isArray(e) || !Array.isArray(t) || e.length !== t.length ? !1 : e.every((e, n) => Ui(e, t[n]));
	let n = e, r = t, i = Object.keys(n), a = Object.keys(r);
	return i.length === a.length ? i.every((e) => Object.prototype.hasOwnProperty.call(r, e) && Ui(n[e], r[e])) : !1;
}
var Wi = "outlet", Gi = "anchor", Ki = "perso", qi = "markup", Ji = class {
	components = /* @__PURE__ */ new Map();
	targets = /* @__PURE__ */ new Map();
	registerComponent(e) {
		if (e.componentId.length === 0) throw Error("Markup component ID must not be empty.");
		if (e.storyId.length === 0) throw Error("Markup story ID must not be empty.");
		if (e.componentType.length === 0) throw Error("Markup component type must not be empty.");
		if (this.components.has(e.componentId)) throw Error(`Markup component is already registered: ${e.componentId}`);
		let t = /* @__PURE__ */ new Set();
		for (let n of e.parts) if (Zi(e, n, t), this.targets.has(n.id)) throw Error(`Markup mount target ID is already registered: ${n.id}`);
		let n = {
			...e,
			parts: e.parts.map((e) => ({ ...e }))
		};
		this.components.set(e.componentId, n);
		for (let e of n.parts) this.targets.set(e.id, e);
	}
	unregisterComponent(e) {
		let t = this.components.get(e);
		if (t !== void 0) {
			this.components.delete(e);
			for (let e of t.parts) this.targets.delete(e.id);
		}
	}
	resolveTarget(e) {
		return this.targets.get(e);
	}
	getComponentParts(e) {
		return [...this.components.get(e)?.parts ?? []];
	}
	getAllTargets() {
		return [...this.targets.values()];
	}
	clear() {
		this.components.clear(), this.targets.clear();
	}
};
function Yi() {
	return {
		id: qi,
		create: () => {
			let e = new Ji();
			return {
				registerComponent: (t) => e.registerComponent(t),
				unregisterComponent: (t) => e.unregisterComponent(t),
				resolveTarget: (t) => e.resolveTarget(t),
				getComponentParts: (t) => e.getComponentParts(t),
				getAllTargets: () => e.getAllTargets(),
				getMountTargets: () => e.getAllTargets().map(Xi),
				destroy: () => e.clear()
			};
		}
	};
}
function Xi(e) {
	return {
		id: e.id,
		kind: e.kind === "anchor" ? Gi : Wi,
		storyId: e.storyId,
		ownerId: e.ownerId
	};
}
function Zi(e, t, n) {
	if (t.id.length === 0) throw Error("Markup mount target ID must not be empty.");
	if (t.partId.length === 0) throw Error("Markup part ID must not be empty.");
	if (t.kind !== "outlet" && t.kind !== "anchor") throw Error(`Invalid markup mount target kind: ${t.kind}`);
	if (t.ownerId !== e.componentId) throw Error(`Markup mount target owner does not match component: ${t.id}`);
	if (t.storyId !== e.storyId) throw Error(`Markup mount target story does not match component: ${t.id}`);
	if (t.componentType !== e.componentType) throw Error(`Markup mount target type does not match component: ${t.id}`);
	if (n.has(t.id)) throw Error(`Markup mount target ID is duplicated: ${t.id}`);
	n.add(t.id);
}
var Qi = "AUTHOR_MOVE_COMMAND_INVALID", $i = "AUTHOR_MOVE_CONFLICT_SAME_TICK", ea = "AUTHOR_MOVE_LAST_INVALID_SAME_TICK", ta = "mount", na = "unmount", ra = "move";
//#endregion
//#region ../codplay/src/runtime/move/move-state.ts
function ia(e, t) {
	let n = /* @__PURE__ */ new Set([...Object.keys(e.persos), ...Object.keys(t.persos)]), r = [];
	for (let i of n) {
		let n = e.persos[i]?.placement, a = t.persos[i]?.placement, o = n?.mounted === !0, s = a?.mounted === !0, c = n?.targetId, l = a?.targetId;
		!o && !s || o === s && c === l && n?.kind === a?.kind && n?.mode === a?.mode && n?.reparent === a?.reparent && n?.reorder === a?.reorder && n?.source === a?.source || r.push({
			operation: o ? s ? ra : na : ta,
			persoKey: i,
			fromTargetId: c,
			toTargetId: l,
			mountedBefore: o,
			mountedAfter: s,
			fromPlacement: n,
			toPlacement: a,
			reparent: a?.reparent
		});
	}
	return r;
}
//#endregion
//#region ../codplay/src/scene/config/scene-build.ts
var F = {
	rootToken: "@root",
	detachToken: "@off",
	schemaVersion: "codplay.v2.scene.v1",
	logicalLengthUnit: "cqw",
	resourceTypeByExtension: {
		".riv": "rive",
		".mp4": "video",
		".webm": "video",
		".ogv": "video",
		".mp3": "audio",
		".wav": "audio",
		".ogg": "audio",
		".aac": "audio",
		".png": "image",
		".jpg": "image",
		".jpeg": "image",
		".webp": "image",
		".gif": "image",
		".svg": "image",
		".avif": "image",
		".woff": "font",
		".woff2": "font",
		".ttf": "font",
		".otf": "font",
		".css": "css"
	}
}, aa = "unspecified", oa = "root", sa = "parent", ca = "invalid", la = "initial", ua = "move";
//#endregion
//#region ../codplay/src/runtime/move/move-policy.ts
function da(e, t) {
	let n = fa(e, !1), r = [];
	n.kind === "invalid" && r.push({
		code: Qi,
		message: "Initial move command is invalid."
	});
	let i = /* @__PURE__ */ new Map(), a = [];
	for (let e of t) {
		if (!Object.prototype.hasOwnProperty.call(e.action, "move")) continue;
		let t = e.eventSeq === void 0 ? `time:${e.startAt}` : `event:${e.eventSeq}`;
		i.has(t) || (a.push(t), i.set(t, [])), i.get(t)?.push(fa(e.action.move, !0));
	}
	for (let e of a) {
		let t = i.get(e) ?? [], a = t.at(-1);
		a === void 0 || a.kind === "invalid" || (t.length > 1 && r.push({
			code: $i,
			message: `Multiple move commands target one perso in ${e}.`
		}), n = a);
	}
	for (let e of a) i.get(e)?.at(-1)?.kind === "invalid" && r.push({
		code: ea,
		message: `The last move command is invalid in ${e}; no move from this tick applies.`
	});
	return {
		placement: n,
		issues: r
	};
}
function fa(e, t) {
	let n = t ? ua : la;
	if (e === void 0) return {
		kind: aa,
		source: n
	};
	if (typeof e == "string") return ga(e, n, void 0, void 0, void 0, t);
	if (!T(e)) return {
		kind: ca,
		source: n
	};
	let r = e;
	if (typeof r.target != "string") return {
		kind: ca,
		source: n
	};
	let i = t ? ya(r.mode) : void 0;
	if (t && r.mode !== void 0 && i === void 0) return {
		kind: ca,
		source: n
	};
	let a = _a(r.reparent);
	return a === ma || r.resize !== void 0 && !ha(r.resize) || Object.prototype.hasOwnProperty.call(r, "flipMode") || va(r.transition) === pa ? {
		kind: ca,
		source: n
	} : ga(r.target, n, i, a, r.reorder, t);
}
var pa = Symbol("invalid move transition"), ma = Symbol("invalid move reparent");
function ha(e) {
	if (!T(e)) return !1;
	let t = e;
	return (t.width === void 0 || t.width === "auto" || t.width === "preserve" || t.width === "container") && (t.height === void 0 || t.height === "auto" || t.height === "preserve" || t.height === "container");
}
function ga(e, t, n, r, i, a = !1) {
	if (r === ma) return {
		kind: ca,
		source: t
	};
	let o = typeof i == "boolean" ? i : void 0;
	return e === F.rootToken ? {
		kind: oa,
		mode: n,
		reparent: r,
		source: t
	} : e === F.detachToken ? {
		kind: "off",
		mode: n,
		reparent: r,
		source: t
	} : {
		kind: sa,
		targetId: e,
		mode: n ?? (a ? "auto" : void 0),
		reparent: r,
		source: t,
		reorder: o
	};
}
function _a(e) {
	if (e !== void 0) return typeof e == "boolean" ? e : ma;
}
function va(e) {
	if (e === void 0) return;
	if (!T(e)) return pa;
	let t = e;
	return t.duration !== void 0 && (typeof t.duration != "number" || !Number.isFinite(t.duration) || t.duration <= 0) || t.delay !== void 0 && (typeof t.delay != "number" || !Number.isFinite(t.delay) || t.delay < 0) || t.ease !== void 0 && typeof t.ease != "string" || t.path !== void 0 && !Fn(t.path) || Object.prototype.hasOwnProperty.call(t, "traversal") || Object.prototype.hasOwnProperty.call(t, "pathAnchor") ? pa : {
		duration: t.duration,
		delay: t.delay,
		ease: t.ease,
		path: t.path
	};
}
function ya(e) {
	if (e !== void 0 && (typeof e == "number" && Number.isFinite(e) || e === "auto" || e === "first" || e === "last" || e === "append" || e === "prepend")) return e;
}
//#endregion
//#region ../codplay/src/runtime/player/structural-timeline.ts
var ba = class {
	initial;
	snapshots;
	constructor(e, t, n, r, i = []) {
		let a = Sa(e, t, n, r, i);
		this.initial = a.initial, this.snapshots = a.snapshots;
	}
	resolveAt(e) {
		let t = this.initial;
		for (let n of this.snapshots) {
			if (n.timeMs > e) break;
			t = n;
		}
		return t;
	}
	resolveBefore(e) {
		let t = this.initial;
		for (let n of this.snapshots) {
			if (n.timeMs >= e) break;
			t = n;
		}
		return t;
	}
	getBoundaries() {
		return this.snapshots;
	}
};
function xa(e) {
	let t = /* @__PURE__ */ new Set();
	Na(e.scene.eventimes ?? [], 0, t);
	for (let n of Object.values(e.scene.stories)) Na(n.eventimes ?? [], 0, t);
	return [...t].sort((e, t) => e - t);
}
function Sa(e, t, n, r, i = []) {
	let a = n(0), o = ja(a.graph.childrenByTarget), s = Aa(0, o), c = [], l = Ca(e, i);
	l[0] !== 0 && c.push(s);
	for (let e of l) {
		let n = t(e), i = ia(a, n);
		o = r === void 0 ? wa(o, n, i) : r(o, n, i), c.push(Aa(e, o)), a = n;
	}
	return Object.freeze({
		initial: s,
		snapshots: Object.freeze(c)
	});
}
function Ca(e, t) {
	return [.../* @__PURE__ */ new Set([...xa(e), ...t.filter((e) => Number.isFinite(e) && e >= 0)])].sort((e, t) => e - t);
}
function wa(e, t, n, r) {
	let i = new Map(Object.entries(e).map(([e, t]) => [e, [...t]]));
	for (let e of n) {
		let t = e.fromTargetId, n = e.toTargetId, a = t !== void 0 && t === n, o = t === void 0 ? -1 : (i.get(t) ?? []).indexOf(e.persoKey), s = e.operation === "mount" || !a ? "add" : "move", c = r?.shouldReorder(s, n, e.toPlacement?.mode, e.toPlacement?.reorder) ?? e.toPlacement?.reorder !== !1, l = t === void 0 || a ? c : r?.shouldReorder("remove", t, e.toPlacement?.mode, e.toPlacement?.reorder) ?? !0;
		if (r?.onDelta?.(e, {
			sameTarget: a,
			targetReordered: c,
			sourceReordered: l
		}), t !== void 0 && (!a || c) && ka(i, t, e.persoKey), !(!e.mountedAfter || n === void 0)) {
			if (a && !c && o >= 0) {
				Oa(i, n, e.persoKey, o);
				continue;
			}
			Da(i, n, e.persoKey, c ? e.toPlacement?.mode : void 0);
		}
	}
	if (Ta(i, t), r?.resolveTargetOrder === void 0) for (let e of n) e.fromTargetId !== void 0 && (e.operation === "unmount" || e.fromTargetId !== e.toTargetId) && (r?.shouldReorder("remove", e.fromTargetId, e.toPlacement?.mode, e.toPlacement?.reorder) ?? !0) && Ea(i, t, e.fromTargetId);
	else for (let [e, n] of i) i.set(e, [...r.resolveTargetOrder(e, n, t)]);
	return Ma(i);
}
function Ta(e, t) {
	let n = /* @__PURE__ */ new Set([...e.keys(), ...Object.keys(t.graph.childrenByTarget)]);
	for (let r of n) {
		let n = t.graph.childrenByTarget[r] ?? [], i = new Set(n), a = (e.get(r) ?? []).filter((e) => i.has(e));
		for (let e of n) a.includes(e) || a.push(e);
		e.set(r, a);
	}
}
function Ea(e, t, n) {
	let r = e.get(n);
	if (r !== void 0) for (let i of [...r]) {
		let a = t.persos[i]?.placement.mode;
		a === "first" || a === "prepend" ? (ka(e, n, i), Oa(e, n, i, 0)) : (a === "last" || a === "append") && (ka(e, n, i), Oa(e, n, i, r.length));
	}
}
function Da(e, t, n, r) {
	let i = e.get(t) ?? [];
	e.set(t, i), !i.includes(n) && (r === "first" || r === "prepend" ? Oa(e, t, n, 0) : typeof r == "number" && Number.isFinite(r) ? Oa(e, t, n, r) : (r === "auto" || r === "last" || r === "append" || r === void 0) && Oa(e, t, n, i.length));
}
function Oa(e, t, n, r) {
	let i = e.get(t) ?? [], a = i.indexOf(n);
	a >= 0 && i.splice(a, 1), i.splice(Math.max(0, Math.min(Math.trunc(r), i.length)), 0, n), e.set(t, i);
}
function ka(e, t, n) {
	let r = e.get(t);
	if (r === void 0) return;
	let i = r.indexOf(n);
	i >= 0 && r.splice(i, 1);
}
function Aa(e, t) {
	let n = Object.freeze(Object.fromEntries(Object.entries(t).map(([e, t]) => [e, Object.freeze([...t])])));
	return Object.freeze({
		timeMs: e,
		revision: JSON.stringify(n),
		childrenByTarget: n
	});
}
function ja(e) {
	return Object.fromEntries(Object.entries(e).map(([e, t]) => [e, [...t]]));
}
function Ma(e) {
	let t = [...e].map(([e, t]) => [e, Object.freeze([...t])]);
	return Object.freeze(Object.fromEntries(t));
}
function Na(e, t, n) {
	for (let r of e) {
		let e = t + r.startAt;
		n.add(e), Na(r.events ?? [], e, n);
	}
}
//#endregion
//#region ../codplay/src/runtime/capabilities/list/list-capability.ts
var Pa = "list", Fa = Object.freeze({
	reorderOnMove: !0,
	reorderOnAdd: !0,
	reorderOnRemove: !0
}), Ia = class {
	reorderConfigByTargetId = /* @__PURE__ */ new Map();
	persistentPlacementByPersoKey = /* @__PURE__ */ new Map();
	targetsToReorder = /* @__PURE__ */ new Set();
	nextPlacementOrder = 1;
	constructor(e) {
		for (let t of Object.values(e.scene.stories)) for (let e of t.persos) e.type !== "list" && e.list === void 0 || this.registerList(e.id, Ra(e.initial));
	}
	registerList(e, t = {}) {
		if (e.trim().length === 0) throw Error("List target ID must not be empty.");
		this.reorderConfigByTargetId.set(e, za(t));
	}
	getReorderConfig(e) {
		return this.reorderConfigByTargetId.get(e) ?? Fa;
	}
	resolveStructuralOrder(e, t, n) {
		this.targetsToReorder.clear();
		let r = {
			shouldReorder: (e, t, n, r) => t === void 0 ? r !== !1 : this.shouldApplyReorder(e, t, n, r),
			onDelta: (e, t) => this.updatePersistentPlacement(e, t),
			resolveTargetOrder: (e, t) => this.resolvePersistentOrder(e, t)
		};
		try {
			return wa(e, t, n, r);
		} finally {
			this.targetsToReorder.clear();
		}
	}
	clear() {
		this.reorderConfigByTargetId.clear(), this.resetStructuralHistory();
	}
	resetStructuralHistory() {
		this.persistentPlacementByPersoKey.clear(), this.targetsToReorder.clear(), this.nextPlacementOrder = 1;
	}
	updatePersistentPlacement(e, t) {
		let n = e.toTargetId, r = e.fromTargetId !== void 0 && e.fromTargetId !== n;
		if (t.targetReordered && n !== void 0 && this.reorderConfigByTargetId.has(n) && this.targetsToReorder.add(n), t.sourceReordered && e.fromTargetId !== void 0 && (e.operation === "unmount" || r) && this.reorderConfigByTargetId.has(e.fromTargetId) && this.targetsToReorder.add(e.fromTargetId), (e.operation === "unmount" || r) && this.persistentPlacementByPersoKey.delete(e.persoKey), !t.targetReordered || n === void 0 || !this.reorderConfigByTargetId.has(n)) return;
		let i = e.toPlacement?.mode;
		if (i !== "first" && i !== "last") {
			this.persistentPlacementByPersoKey.delete(e.persoKey);
			return;
		}
		this.persistentPlacementByPersoKey.set(e.persoKey, {
			targetId: n,
			mode: i,
			insertedOrder: this.nextPlacementOrder
		}), this.nextPlacementOrder += 1;
	}
	resolvePersistentOrder(e, t) {
		if (!this.reorderConfigByTargetId.has(e) || !this.targetsToReorder.has(e)) return t;
		let n = [...this.persistentPlacementByPersoKey.entries()].filter(([n, r]) => r.targetId === e && r.mode === "first" && t.includes(n)).sort((e, t) => e[1].insertedOrder - t[1].insertedOrder).map(([e]) => e), r = [...this.persistentPlacementByPersoKey.entries()].filter(([n, r]) => r.targetId === e && r.mode === "last" && t.includes(n)).sort((e, t) => e[1].insertedOrder - t[1].insertedOrder).map(([e]) => e), i = /* @__PURE__ */ new Set([...n, ...r]), a = t.filter((e) => !i.has(e));
		return [
			...n,
			...a,
			...r
		];
	}
	shouldApplyReorder(e, t, n, r) {
		if (n !== "auto") return r !== !1;
		if (r === !1) return !1;
		let i = this.getReorderConfig(t);
		return e === "move" ? i.reorderOnMove : e === "add" ? i.reorderOnAdd : i.reorderOnRemove;
	}
};
function La() {
	return {
		id: Pa,
		create: ({ compiledScene: e }) => {
			let t = new Ia(e);
			return {
				getReorderConfig: (e) => t.getReorderConfig(e),
				resetStructuralOrder: () => t.resetStructuralHistory(),
				resolveStructuralOrder: (e, n, r) => t.resolveStructuralOrder(e, n, r),
				destroy: () => t.clear()
			};
		}
	};
}
function Ra(e) {
	return T(e.config) ? e.config : {};
}
function za(e) {
	return Object.freeze({
		reorderOnMove: e.reorderOnMove !== !1,
		reorderOnAdd: e.reorderOnAdd !== !1,
		reorderOnRemove: e.reorderOnRemove !== !1
	});
}
//#endregion
//#region ../codplay/src/runtime/config/strap-scope.ts
var I = "scene", Ba = "story", Va = "global", Ha = "strap";
//#endregion
//#region ../codplay/src/runtime/player/pipeline/action-sequence.ts
function Ua(e) {
	return Array.isArray(e) && e.length > 0 && e.every(Wa);
}
function Wa(e) {
	if (!T(e)) return !1;
	let t = e;
	return T(t.action) ? (t.durationMs === void 0 || qa(t.durationMs)) && (t.startAt === void 0 || qa(t.startAt)) : !1;
}
function Ga(e) {
	if (!T(e)) return !1;
	let t = e;
	return Ja(t.duration) && Ya(t.fn);
}
function Ka(e) {
	let t = [], n = 0;
	for (let r of e) {
		let e = r.startAt ?? n;
		t.push({
			offsetMs: e,
			action: r.action
		});
		let i = Ga(r.action) ? r.action.duration : 0;
		n = e + (r.durationMs ?? i);
	}
	return t;
}
function qa(e) {
	return typeof e == "number" && Number.isFinite(e) && e >= 0;
}
function Ja(e) {
	return typeof e == "number" && Number.isFinite(e) && e > 0;
}
function Ya(e) {
	return T(e) && typeof e.ref == "string" && e.ref.length > 0;
}
//#endregion
//#region ../codplay/src/runtime/player/pipeline/action-resolution.ts
function Xa(e, t) {
	return Ua(e) ? e : T(e) ? t === void 0 ? e : {
		...e,
		...t
	} : (e === null || e === !0) && t !== void 0 ? t : null;
}
//#endregion
//#region ../codplay/src/runtime/player/eventime.ts
function Za(e, t, n, r) {
	return `compiled:${e}:${n ?? "scene"}:${t}:${r.join(".")}`;
}
//#endregion
//#region ../codplay/src/runtime/player/pipeline/strap-collections.ts
function Qa(e) {
	return e === void 0 ? [] : Array.isArray(e) ? e : Object.keys(e);
}
function $a(e, t, n) {
	if (e === void 0) return {};
	if (Array.isArray(e)) return t;
	let r = {};
	for (let [t, i] of Object.entries(e)) {
		let e = n[i.ref];
		e !== void 0 && (r[t] = e);
	}
	return r;
}
function eo(e, t = {
	scene: {},
	stories: {}
}, n = {}) {
	let r = [], i = $a(e.scene.straps, t.scene, n);
	for (let t of Qa(e.scene.straps)) i[t] === void 0 && r.push({
		code: "AUTHOR_SCENE_STRAP_MISSING",
		message: `Scene strap is declared but not available: ${t}`,
		scope: I,
		strapName: t
	});
	for (let [i, a] of Object.entries(e.scene.stories)) {
		let e = $a(a.straps, t.stories[i] ?? {}, n);
		for (let t of Qa(a.straps)) e[t] === void 0 && r.push({
			code: "AUTHOR_STORY_STRAP_MISSING",
			message: `Story strap is declared but not available: ${t}`,
			scope: Ba,
			storyId: i,
			strapName: t
		});
	}
	return r;
}
//#endregion
//#region ../codplay/src/runtime/player/pipeline/tracks.ts
function to(e) {
	let t = {}, n = [];
	io(Va, void 0, t, n);
	for (let r of Object.values(e.scene.stories)) {
		io(r.id, void 0, t, n), r.trackId !== void 0 && io(r.trackId, void 0, t, n);
		for (let e of Qa(r.straps)) io(ro(r.id, e), void 0, t, n);
	}
	for (let r of Qa(e.scene.straps)) io(ro(void 0, r), void 0, t, n);
	for (let [r, i] of Object.entries(e.scene.tracks)) io(r, i, t, n);
	for (let r of Object.values(e.scene.stories)) for (let [e, i] of Object.entries(r.tracks ?? {})) io(e, i, t, n);
	return {
		order: n,
		tracks: t
	};
}
function no(e) {
	return e.trackId ?? e.id;
}
function ro(e, t) {
	return `${Ha}-${e ?? "scene"}-${t}`;
}
function io(e, t, n, r) {
	let i = n[e], a = T(t) ? t : null;
	if (i === void 0) {
		r.push(e), n[e] = {
			id: e,
			order: r.length - 1,
			active: typeof a?.active == "boolean" ? a.active : !0,
			role: typeof a?.role == "string" ? a.role : void 0
		};
		return;
	}
	n[e] = {
		...i,
		active: typeof a?.active == "boolean" ? a.active : i.active,
		role: typeof a?.role == "string" ? a.role : i.role
	};
}
//#endregion
//#region ../codplay/src/runtime/player/pipeline/compiled-eventimes.ts
function ao(e, t, n, r = 0, i = [], a = "scene", o) {
	return e.flatMap((e, s) => {
		let c = r + e.startAt, l = [...i, s];
		return [{
			event: e,
			startAt: c,
			trackId: t,
			trackOrder: n,
			...o === void 0 ? {} : { storyId: o },
			declarationPath: l,
			eventId: Za(a, t, o, l)
		}, ...ao(e.events ?? [], t, n, c, l, a, o)];
	});
}
function oo(e) {
	let t = to(e), n = [], r = t.tracks.global?.order ?? 0;
	n.push(...ao(e.scene.eventimes ?? [], Va, r, 0, [], "scene", void 0));
	for (let r of Object.values(e.scene.stories)) {
		let e = no(r), i = t.tracks[e]?.order ?? 0;
		n.push(...ao(r.eventimes ?? [], e, i, 0, [], "story", r.id));
	}
	return n.sort(so).map((e) => ({
		eventId: e.eventId,
		trackId: e.trackId,
		name: e.event.name,
		applyAtMs: e.startAt,
		...e.storyId === void 0 ? {} : { storyId: e.storyId },
		...e.event.visibility === void 0 ? {} : { visibility: e.event.visibility },
		...e.event.data === void 0 ? {} : { data: e.event.data }
	}));
}
function so(e, t) {
	return e.startAt - t.startAt || e.trackOrder - t.trackOrder || Se(e.declarationPath, t.declarationPath);
}
//#endregion
//#region ../codplay/src/runtime/player/pipeline/materialize.ts
function co(e, t, n, r = {}) {
	return uo(e, t, !0, n, r);
}
function lo(e, t, n, r = {}) {
	return uo(e, t, !1, n, r);
}
function uo(e, t, n, r, i = {}) {
	Eo(t);
	let a = {}, o = i.includeMoveOccurrences === !1 ? void 0 : [], s = r?.registry ?? to(e), c = D(e.scene.state);
	if (r !== void 0) for (let e of r.getStateUpdates(I, void 0, t, n, i.includePersistOnly !== !1)) Do(c, e.update);
	let l = {};
	for (let [c, u] of Object.entries(e.scene.stories)) {
		let d = D(u.state);
		if (r !== void 0) for (let e of r.getStateUpdates(Ba, c, t, n, i.includePersistOnly !== !1)) Do(d, e.update);
		l[c] = d;
		let f = no(u), p = s.tracks[f];
		if (p === void 0) throw Error(`Materialize track is not registered: ${f}`);
		let m = r?.getLatestStoryReset(c, t, n, i.includePersistOnly !== !1), h = [
			...To(r, "global", s.tracks.global?.active ?? !0) ? ao(e.scene.eventimes ?? [], Va, s.tracks.global?.order ?? 0, 0, [], "scene").filter((e) => !bo(e, r)) : [],
			...To(r, f, p.active) ? ao(u.eventimes ?? [], f, p.order, 0, [], "story", c).filter((e) => !bo(e, r)) : [],
			...xo(r, c, t, n, i.includePersistOnly !== !1)
		].filter((e) => m === void 0 || Co(e, m));
		for (let e of u.persos) {
			let r = `${c}:${e.id}`, i = fo(h, e.actions, t, n);
			if (o !== void 0) for (let e of i) Object.prototype.hasOwnProperty.call(e.action, "move") && o.push(Object.freeze({
				itemId: r,
				action: e
			}));
			a[r] = {
				key: r,
				storyId: c,
				persoId: e.id,
				type: e.type,
				initial: e.initial,
				actions: i
			};
		}
	}
	return {
		scene: e,
		timeMs: t,
		tracks: s,
		sceneState: c,
		storyStates: l,
		persos: a,
		...o === void 0 ? {} : { moveOccurrences: Object.freeze(o) }
	};
}
function fo(e, t, n, r) {
	let i = [...e].sort(yo), a = [];
	for (let e = 0; e < i.length; e += 1) {
		let o = i[e];
		if (o.event.name === "tween:stop") continue;
		let s = Xa(t[o.event.name], o.event.data);
		if (s === null) continue;
		if (Ua(s)) {
			let t = Ka(s);
			for (let s = 0; s < t.length; s += 1) {
				let c = t[s], l = o.startAt + c.offsetMs;
				if ((Ga(c.action) ? ho(i, e, o.event.name, n, r) : mo(i, e, o.event.name, l, n, r)) || Ga(c.action) && go(i, e, l, n, r)) continue;
				let u = po(o, l, c.action, n, r, s);
				u !== null && a.push(u);
			}
			continue;
		}
		if (Ga(s) && (ho(i, e, o.event.name, n, r) || go(i, e, o.startAt, n, r))) continue;
		let c = po(o, o.startAt, s, n, r);
		c !== null && a.push(c);
	}
	return a.sort(vo);
}
function po(e, t, n, r, i, a) {
	return t > r || !i && t === r ? null : {
		name: e.event.name,
		startAt: t,
		elapsedMs: r - t,
		trackId: e.trackId,
		trackOrder: e.trackOrder,
		eventId: a === void 0 ? e.eventSeq === void 0 && e.event.name !== "sequence:end" ? void 0 : e.eventId : _o(e, `${e.event.name}:sequence:${a}`),
		eventSeq: e.eventSeq,
		declarationPath: a === void 0 ? e.declarationPath : [...e.declarationPath, a],
		eventData: e.event.data,
		action: n
	};
}
function mo(e, t, n, r, i, a) {
	for (let o = t + 1; o < e.length; o += 1) {
		let t = e[o];
		if (t.startAt > r) break;
		if (!(t.startAt > i || !a && t.startAt === i) && t.event.name === n) return !0;
	}
	return !1;
}
function ho(e, t, n, r, i) {
	for (let a = t + 1; a < e.length; a += 1) {
		let t = e[a];
		if (t.startAt > r || !i && t.startAt === r) break;
		if (t.event.name === n) return !0;
	}
	return !1;
}
function go(e, t, n, r, i) {
	for (let a = t + 1; a < e.length; a += 1) {
		let t = e[a];
		if (!(t.startAt < n)) {
			if (t.startAt > r || !i && t.startAt === r) return !1;
			if (t.event.name === "tween:stop") return !0;
		}
	}
	return !1;
}
function _o(e, t) {
	return `${e.eventSeq === void 0 && e.event.name !== "sequence:end" ? `${e.event.name}@${e.startAt}:${e.declarationPath.join(".")}` : e.eventId}:${t}`;
}
function vo(e, t) {
	return e.startAt - t.startAt || e.trackOrder - t.trackOrder || Se(e.declarationPath, t.declarationPath);
}
function yo(e, t) {
	return e.startAt - t.startAt || e.trackOrder - t.trackOrder || Se(e.declarationPath, t.declarationPath);
}
function bo(e, t) {
	return t === void 0 || e.event.name !== "sequence:end" ? !1 : t.getEvents(e.trackId).some((t) => t.eventId === e.eventId);
}
function xo(e, t, n, r, i) {
	if (e === void 0) return [];
	let a = e.getLatestStoryReset(t, n, r, i);
	return e.getEventsForStory(t, n, r).filter((t) => {
		let a = e.registry.tracks[t.trackId];
		return (t.applyAtMs < n || r && t.applyAtMs === n) && (i || t.mode !== "persist-only") && a !== void 0 && e.isTrackActive(t.trackId);
	}).filter((e) => a === void 0 || wo(e, a)).map((t) => So(t, t.trackId, e.registry.tracks[t.trackId]?.order ?? 0));
}
function So(e, t, n) {
	return {
		event: {
			name: e.name,
			startAt: e.applyAtMs,
			visibility: e.visibility,
			data: e.data
		},
		startAt: e.applyAtMs,
		trackId: t,
		trackOrder: n,
		eventId: e.eventId,
		eventSeq: e.eventSeq,
		declarationPath: [2 ** 53 - 1, e.eventSeq]
	};
}
function Co(e, t) {
	return e.startAt > t.applyAtMs ? !0 : e.startAt < t.applyAtMs ? !1 : e.eventSeq !== void 0 && e.eventSeq > t.eventSeq;
}
function wo(e, t) {
	return e.applyAtMs > t.applyAtMs || e.applyAtMs === t.applyAtMs && e.eventSeq > t.eventSeq;
}
function To(e, t, n) {
	return e === void 0 ? n : e.isTrackActive(t);
}
function Eo(e) {
	if (!Number.isFinite(e) || e < 0) throw Error("Materialize time must be a finite non-negative number.");
}
function Do(e, t) {
	if (t !== void 0) for (let [n, r] of Object.entries(t)) e[n] = Ce(r);
}
//#endregion
//#region ../codplay/src/scene/compiled/length.ts
var Oo = /* @__PURE__ */ new Set([
	"x",
	"y",
	"width",
	"height"
]);
function ko(e) {
	if (typeof e != "object" || !e || Array.isArray(e)) return !1;
	let t = e;
	return t.kind === "length" && t.unit === F.logicalLengthUnit && typeof t.value == "number" && Number.isFinite(t.value);
}
function Ao(e) {
	let t = {};
	for (let [n, r] of Object.entries(e)) t[n] = Oo.has(n) ? Mo(r) : r;
	return t;
}
function jo(e) {
	if (Array.isArray(e)) return e.map((e) => jo(e));
	if (!T(e)) return e;
	let t = e, n = { ...t };
	return T(t.style) && (n.style = Ao(t.style)), (T(t.action) || Array.isArray(t.action)) && (n.action = jo(t.action)), n;
}
function Mo(e) {
	if (typeof e == "number") return No(e);
	if (ko(e) || !T(e) || !("from" in e) && !("to" in e)) return e;
	let t = {};
	for (let [n, r] of Object.entries(e)) t[n] = n === "from" || n === "to" ? No(r) : r;
	return t;
}
function No(e) {
	return typeof e != "number" || !Number.isFinite(e) ? e : {
		kind: "length",
		unit: F.logicalLengthUnit,
		value: e
	};
}
//#endregion
//#region ../codplay/src/scene/compiled/function-extractor.ts
function Po(e, t, n = Fo(), r = []) {
	if (e === void 0) return null;
	if (typeof e == "function") return L(e, t, n, r);
	if (e === null || typeof e == "string" || typeof e == "number" || typeof e == "boolean") return e;
	if (Array.isArray(e)) return e.map((e, i) => Po(e, `${t}[${i}]`, n, [...r, i]));
	if (T(e)) {
		let i = {};
		for (let [a, o] of Object.entries(e)) o !== void 0 && (i[a] = Po(o, `${t}.${a}`, n, [...r, a]));
		return i;
	}
	throw Error(`Unsupported compiled value at ${t}.`);
}
function L(e, t, n, r = []) {
	let i = `fn:${n.nextId}:${Ro(t)}`;
	return n.nextId += 1, n.functions[i] = e, n.functionReferences.push({
		ref: i,
		path: [...r]
	}), { ref: i };
}
function Fo() {
	return {
		functions: {},
		functionReferences: [],
		nextId: 0
	};
}
function Io(e) {
	return Object.freeze({ ...e.functions });
}
function Lo(e) {
	return Object.freeze(e.functionReferences.map((e) => Object.freeze({
		ref: e.ref,
		path: Object.freeze([...e.path])
	})));
}
function R(e, t, n, r = []) {
	if (e !== void 0) return Po(e, t, n, r);
}
function Ro(e) {
	return e.replace(/[^a-zA-Z0-9_.:[\]-]/g, "_");
}
//#endregion
//#region ../codplay/src/diagnostics/diagnostic-collector.ts
var zo = "warning", Bo = "error", z = class {
	entries = [];
	seenKeys = /* @__PURE__ */ new Set();
	deduplicate;
	output;
	constructor(e = {}) {
		this.deduplicate = e.deduplicate ?? !0, this.output = e.output ?? Vo;
	}
	add(e) {
		let t = {
			severity: e.severity,
			code: e.code,
			message: e.message,
			details: e.details
		}, n = e.dedupeKey ?? Ho(t);
		return this.deduplicate && this.seenKeys.has(n) ? null : (this.seenKeys.add(n), this.entries.push(t), this.output(t), t);
	}
	warning(e, t, n, r) {
		return this.add({
			severity: zo,
			code: e,
			message: t,
			details: n,
			dedupeKey: r
		});
	}
	error(e, t, n, r) {
		return this.add({
			severity: Bo,
			code: e,
			message: t,
			details: n,
			dedupeKey: r
		});
	}
	report() {
		let e = this.entries.map(Uo);
		return {
			all: e,
			warnings: e.filter((e) => e.severity === "warning"),
			errors: e.filter((e) => e.severity === "error")
		};
	}
	hasErrors() {
		return this.entries.some((e) => e.severity === "error");
	}
	clear() {
		this.entries.length = 0, this.seenKeys.clear();
	}
};
function Vo(e) {
	let t = e.details === void 0 ? "" : ` ${JSON.stringify(e.details)}`;
	console.log(`[${e.severity}] ${e.code}: ${e.message}${t}`);
}
function Ho(e) {
	return JSON.stringify({
		severity: e.severity,
		code: e.code,
		refs: e.details?.refs ?? null
	});
}
function Uo(e) {
	return {
		severity: e.severity,
		code: e.code,
		message: e.message,
		details: e.details === void 0 ? void 0 : {
			refs: e.details.refs === void 0 ? void 0 : { ...e.details.refs },
			context: e.details.context === void 0 ? void 0 : { ...e.details.context }
		}
	};
}
//#endregion
//#region ../codplay/src/scene/normalization/normalize-scene-doc.ts
function Wo(e) {
	return Array.isArray(e) ? e.map(Wo) : T(e) ? Object.fromEntries(Object.entries(e).map(([e, t]) => [e, Wo(t)])) : e;
}
function B(e) {
	return e === void 0 ? void 0 : Wo(e);
}
function Go(e) {
	let t = T(e.actions) ? Wo(e.actions) : {};
	return t[e.id] = null, {
		...e,
		initial: B(e.initial) ?? {},
		actions: t,
		list: B(e.list),
		emit: e.emit === void 0 ? void 0 : Wo(e.emit)
	};
}
function Ko(e) {
	return {
		...e,
		initial: B(e.initial),
		persos: e.persos.map(Go),
		tracks: B(e.tracks) ?? {},
		straps: Jo(e.straps),
		listen: e.listen === void 0 ? [] : e.listen.map(Wo),
		eventimes: e.eventimes?.map(Wo),
		state: B(e.state)
	};
}
function qo(e) {
	let t = Object.fromEntries(Object.entries(e.stories).map(([e, t]) => [e, Ko(t)]));
	return {
		...e,
		initial: B(e.initial),
		stories: t,
		straps: Jo(e.straps),
		listen: e.listen === void 0 ? [] : e.listen.map(Wo),
		eventimes: e.eventimes?.map(Wo),
		state: B(e.state),
		tracks: B(e.tracks) ?? {},
		defaults: B(e.defaults)
	};
}
function Jo(e) {
	if (e !== void 0) return Array.isArray(e) ? e.length === 0 ? void 0 : [...e] : Object.fromEntries(Object.entries(e));
}
//#endregion
//#region ../codplay/src/services/config/validation-targets.ts
var Yo = "initial", Xo = "action", Zo = {
	type: ["type"],
	initial: ["initial"],
	actions: ["actions"],
	services: ["services"]
};
//#endregion
//#region ../codplay/src/scene/validation/perso-validation.ts
function V(e) {
	return e.join(".");
}
function Qo(e) {
	let t = [{
		target: Yo,
		value: e.initial,
		path: Zo.initial
	}];
	for (let [n, r] of Object.entries(e.actions ?? {})) n === e.id && r === null || t.push({
		target: Xo,
		value: r,
		path: [...Zo.actions, n],
		actionName: n
	});
	return t;
}
//#endregion
//#region ../codplay/src/scene/validation/validation-warnings.ts
function $o(e) {
	let t = e.kind === "component" ? "AUTHOR_COMPONENT_VALIDATOR_MISSING" : "AUTHOR_SERVICE_VALIDATOR_MISSING";
	e.diagnostics.warning(t, `No ${e.kind} validator is registered for "${e.name}".`, {
		refs: e.refs,
		context: {
			capability: e.name,
			path: e.path
		}
	}, `${t}:${e.name}:${e.refs.persoId ?? ""}:${e.path}`);
}
//#endregion
//#region ../codplay/src/scene/rel.ts
function es(e) {
	return !T(e) || !ts(e.host) ? !1 : e.target === void 0 || ts(e.target);
}
function ts(e) {
	return typeof e == "string" && e.trim().length > 0;
}
//#endregion
//#region ../codplay/src/scene/validation/rel-validation.ts
function ns(e, t) {
	!T(e) || e.rel === void 0 || es(e.rel) || t.diagnostics.warning("AUTHOR_REL_INVALID", "initial.rel must contain a non-empty host id and an optional target id.", {
		refs: t.refs,
		context: { path: `${t.path}.rel` }
	});
}
function rs(e, t) {
	if (T(e)) {
		is(e.rel, t, `${t.path}.rel`);
		return;
	}
	Array.isArray(e) && e.forEach((e, n) => {
		!T(e) || !T(e.action) || is(e.action.rel, t, `${t.path}[${n}].action.rel`);
	});
}
function is(e, t, n) {
	e !== void 0 && t.diagnostics.warning("AUTHOR_REL_ACTION_IGNORED", "rel is immutable and cannot be changed by an action; the action value is ignored.", {
		refs: t.refs,
		context: { path: n }
	});
}
//#endregion
//#region ../codplay/src/scene/validation/validate-perso-with-capabilities.ts
function as(e, t, n) {
	let r = e.components.get(t.type), i = { persoId: t.id };
	if (r === void 0) {
		n.error("AUTHOR_COMPONENT_TYPE_UNKNOWN", `No component definition is registered for "${t.type}".`, {
			refs: i,
			context: {
				type: t.type,
				path: V(Zo.type)
			}
		});
		return;
	}
	r.validatePerso?.(t, cs(Yo, t.validationPath ?? `persos.${t.id}`, {
		...i,
		...t.storyId === void 0 ? {} : { storyId: t.storyId }
	}, n));
	let a = Qo(t);
	for (let e of a) e.target === "initial" ? ns(e.value, cs(e.target, V(e.path), i, n, e.actionName)) : rs(e.value, cs(e.target, V(e.path), i, n, e.actionName)), os(e.target === "initial" ? r.validateInitial : r.validateAction, e, i, n);
	for (let t of r.services) {
		let r = e.services.get(t);
		if (r === void 0) {
			n.error("AUTHOR_SERVICE_UNKNOWN", `No service definition is registered for "${t}".`, {
				refs: i,
				context: {
					service: t,
					path: V([...Zo.services, t])
				}
			});
			continue;
		}
		if (r.validate === void 0 && r.properties === void 0) {
			$o({
				kind: "service",
				name: t,
				refs: i,
				path: V([...Zo.services, t]),
				diagnostics: n
			});
			continue;
		}
		for (let e of a) ss(r, e, i, n);
	}
	for (let a of r.libraries ?? []) e.libraries.has(a) || n.warning("AUTHOR_LIBRARY_UNKNOWN", `No engine library is registered for "${a}".`, {
		refs: i,
		context: {
			library: a,
			component: t.type,
			path: `${t.validationPath ?? `persos.${t.id}`}.libraries`
		}
	});
}
function os(e, t, n, r) {
	e !== void 0 && e(t.value, cs(t.target, V(t.path), n, r, t.actionName));
}
function ss(e, t, n, r) {
	if (!T(t.value) || !(e.name in t.value)) return;
	let i = V([...t.path, e.name]), a = t.value[e.name], o = cs(t.target, i, n, r, t.actionName);
	if (e.validate?.(a, o), !T(a) || e.properties === void 0) return;
	let s = new Map(e.properties.map((e) => [e.name, e]));
	for (let [i, o] of Object.entries(a)) {
		let a = s.get(i);
		if (a === void 0) {
			e.allowUnknownProperties === !1 && r.error("AUTHOR_PROPERTY_UNKNOWN", `Property "${i}" is not declared in service "${e.name}".`, {
				refs: n,
				context: {
					path: V([
						...t.path,
						e.name,
						i
					]),
					service: e.name
				}
			});
			continue;
		}
		a.validate?.(o, cs(t.target, V([
			...t.path,
			e.name,
			i
		]), n, r, t.actionName));
	}
}
function cs(e, t, n, r, i) {
	return {
		target: e,
		path: t,
		refs: n,
		diagnostics: r,
		actionName: i
	};
}
//#endregion
//#region ../codplay/src/scene/validation/compiled-scene-validation-engine.ts
var ls = class {
	catalog;
	constructor(e) {
		this.catalog = e;
	}
	validate(e, t) {
		for (let n of e.persos) as(this.catalog, n, t);
	}
	servicesFor(e) {
		return this.catalog.components.get(e)?.services ?? [];
	}
	modulesFor(e) {
		return this.catalog.components.get(e)?.modules ?? [];
	}
	librariesFor(e) {
		return this.catalog.components.get(e)?.libraries ?? [];
	}
	sanitizeInitial(e, t) {
		return this.sanitizeServices(e, this.sanitize(e, "sanitizeInitial", t));
	}
	sanitizeAction(e, t) {
		return this.sanitizeServices(e, this.sanitize(e, "sanitizeAction", t));
	}
	sanitize(e, t, n) {
		let r = this.catalog.components.get(e)?.[t];
		return r === void 0 ? n : r(n);
	}
	sanitizeServices(e, t) {
		let n = t;
		for (let t of this.servicesFor(e)) {
			let e = this.catalog.services.get(t)?.sanitize;
			if (e === void 0 || !T(n) || !(t in n)) continue;
			let r = e(n[t]);
			r !== n[t] && (n = {
				...n,
				[t]: r
			});
		}
		return n;
	}
}, us = "shape", ds = "semantic", fs = [
	us,
	ds,
	"capability"
], ps = class {
	rules = [];
	register(e) {
		if (this.rules.some((t) => t.id === e.id)) throw Error(`Guard rule already registered: ${e.id}`);
		this.rules.push(e);
	}
	run(e, t) {
		for (let n of fs) for (let r of this.rules) r.phase === n && r.run(e, {
			...t,
			phase: n
		});
	}
}, ms = {
	root: ["scene"],
	id: ["id"],
	stories: ["stories"],
	storyId: [
		"stories",
		"<storyId>",
		"id"
	],
	storyPersos: [
		"stories",
		"<storyId>",
		"persos"
	],
	persoId: [
		"stories",
		"<storyId>",
		"persos",
		"<persoId>",
		"id"
	],
	persoType: [
		"stories",
		"<storyId>",
		"persos",
		"<persoId>",
		"type"
	],
	tracks: ["tracks"],
	actions: [
		"stories",
		"<storyId>",
		"persos",
		"<persoId>",
		"actions"
	]
};
//#endregion
//#region ../codplay/src/scene/validation/validation-paths.ts
function hs(e, t = {}) {
	return e.map((e) => t[e] ?? e).join(".");
}
//#endregion
//#region ../codplay/src/scene/validation/scene-guard-engine.ts
var gs = class {
	pipeline = new ps();
	constructor() {
		this.pipeline.register({
			id: "scene.identity",
			phase: us,
			run: (e, t) => {
				e.id.trim().length === 0 && t.diagnostics.error("AUTHOR_SCENE_ID_INVALID", "scene.id must not be empty.", {
					refs: t.refs,
					context: { path: hs(ms.id) }
				});
			}
		}), this.pipeline.register({
			id: "scene.tracks",
			phase: us,
			run: (e, t) => {
				T(e.tracks) || t.diagnostics.error("AUTHOR_SCENE_TRACKS_INVALID", "scene.tracks must be a plain object.", {
					refs: t.refs,
					context: { path: hs(ms.tracks) }
				});
			}
		}), this.pipeline.register({
			id: "scene.stories",
			phase: ds,
			run: (e, t) => {
				for (let [n, r] of Object.entries(e.stories)) {
					let e = {
						...t.refs,
						storyId: r.id
					}, i = hs(ms.storyId, { "<storyId>": n });
					(r.id.trim().length === 0 || r.id !== n) && t.diagnostics.error("AUTHOR_STORY_ID_INVALID", "story.id must match its scene key.", {
						refs: e,
						context: { path: i }
					});
					for (let i of r.persos) {
						let r = {
							...e,
							persoId: i.id
						}, a = {
							"<storyId>": n,
							"<persoId>": i.id
						};
						i.id.trim().length === 0 && t.diagnostics.error("AUTHOR_PERSO_ID_INVALID", "perso.id must not be empty.", {
							refs: r,
							context: { path: hs(ms.persoId, a) }
						}), i.type.trim().length === 0 && t.diagnostics.error("AUTHOR_PERSO_TYPE_INVALID", "perso.type must not be empty.", {
							refs: r,
							context: { path: hs(ms.persoType, a) }
						}), i.actions[i.id] !== null && t.diagnostics.error("AUTHOR_PERSO_SELF_ACTION_INVALID", "perso.actions[id] must be null.", {
							refs: r,
							context: { path: hs(ms.actions, a) }
						});
					}
				}
			}
		});
	}
	validate(e, t) {
		this.pipeline.run(e, {
			path: hs(ms.root),
			refs: { sceneId: e.id },
			diagnostics: t
		});
	}
};
//#endregion
//#region ../codplay/src/scene/compiled/capture-compiler.ts
function _s(e, t, n, r = []) {
	if (e !== void 0) return Object.fromEntries(Object.entries(e).map(([e, i]) => {
		if (e === "observe") {
			if (Array.isArray(i)) throw Error("emit.observe accepts one declaration.");
			return [e, ys(i, `${t}.observe`, n, [...r, e])];
		}
		return [e, Array.isArray(i) ? i.map((i, a) => vs(i, `${t}.${e}[${a}]`, n, [
			...r,
			e,
			a
		])) : vs(i, `${t}.${e}`, n, [...r, e])];
	}));
}
function vs(e, t, n, r) {
	if (!("event" in e)) throw Error(`Scroll observation must be declared directly as emit.observe: ${t}`);
	let i = {
		...e.ref === void 0 ? {} : { ref: e.ref },
		...e.keyCode === void 0 ? {} : { keyCode: e.keyCode },
		...e.preventDefault === void 0 ? {} : { preventDefault: e.preventDefault },
		data: e.data === void 0 ? void 0 : R(e.data, `${t}.data`, n, [...r, "data"])
	};
	return e.capture === void 0 ? {
		...i,
		event: xs(e.event, `${t}.event`, n, [...r, "event"])
	} : {
		...i,
		event: Ss(e.event, `${t}.event`, n, [...r, "event"]),
		capture: Cs(e.capture, `${t}.capture`, n, [...r, "capture"])
	};
}
function ys(e, t, n, r) {
	return {
		...e.root === void 0 ? {} : { root: e.root },
		...e.initial === void 0 ? {} : { initial: e.initial },
		...e.liveAction === void 0 ? {} : { liveAction: e.liveAction },
		...e.zone === void 0 ? {} : { zone: { ...e.zone } },
		...e.enter === void 0 ? {} : { enter: e.enter.map((e, i) => bs(e, `${t}.enter[${i}]`, n, [
			...r,
			"enter",
			i
		])) },
		...e.leave === void 0 ? {} : { leave: e.leave.map((e, i) => bs(e, `${t}.leave[${i}]`, n, [
			...r,
			"leave",
			i
		])) }
	};
}
function bs(e, t, n, r) {
	return {
		...xs(e, t, n, r),
		...e.once === !0 ? { once: !0 } : {}
	};
}
function xs(e, t, n, r) {
	return {
		name: e.name,
		...e.data === void 0 ? {} : { data: R(e.data, `${t}.data`, n, [...r, "data"]) },
		...e.visibility === void 0 ? {} : { visibility: e.visibility },
		...e.mode === void 0 ? {} : { mode: e.mode }
	};
}
function Ss(e, t, n, r) {
	return {
		name: e.name,
		...e.data === void 0 ? {} : { data: R(e.data, `${t}.data`, n, [...r, "data"]) },
		...e.visibility === void 0 ? {} : { visibility: e.visibility },
		...e.mode === void 0 ? {} : { mode: e.mode }
	};
}
function Cs(e, t, n, r) {
	return {
		trackOn: e.trackOn === void 0 ? void 0 : [...e.trackOn],
		endOn: e.endOn === void 0 ? void 0 : [...e.endOn],
		stateScope: e.stateScope,
		initCaptureStateRef: e.initCaptureState === void 0 ? void 0 : L(e.initCaptureState, `${t}.initCaptureState`, n, [...r, "initCaptureState"]),
		trackCommandRef: e.trackCommand === void 0 ? void 0 : L(e.trackCommand, `${t}.trackCommand`, n, [...r, "trackCommand"]),
		endEmit: e.endEmit === void 0 ? void 0 : Ss(e.endEmit, `${t}.endEmit`, n, [...r, "endEmit"]),
		endCaptureRef: e.endCapture === void 0 ? void 0 : L(e.endCapture, `${t}.endCapture`, n, [...r, "endCapture"])
	};
}
//#endregion
//#region ../codplay/src/scene/compiled/move-path-compiler.ts
function ws(e, t) {
	if (Array.isArray(e)) return e.map((e, n) => ws(e, `${t}[${n}]`));
	if (!T(e)) return e;
	let n = e.action === void 0 ? e : {
		...e,
		action: ws(e.action, `${t}.action`)
	}, r = n.move;
	if (!T(r)) return n;
	if (Object.prototype.hasOwnProperty.call(r, "flipMode")) throw Error(`${t}.move.flipMode was replaced by the boolean reparent property.`);
	if (r.reparent !== void 0 && typeof r.reparent != "boolean") throw Error(`${t}.move.reparent must be a boolean.`);
	if (r.resize !== void 0 && Ts(r.resize, `${t}.move.resize`), !T(r.transition)) return n;
	if (Object.prototype.hasOwnProperty.call(r.transition, "traversal")) throw Error(`${t}.move.transition.traversal is an internal integration option and must be omitted.`);
	if (Object.prototype.hasOwnProperty.call(r.transition, "pathAnchor")) throw Error(`${t}.move.transition.pathAnchor is an internal integration option and must be omitted.`);
	if (r.transition.path === void 0) return n;
	if (typeof r.transition.path != "string") throw Error(`${t}.move.transition.path must be an SVG path d string.`);
	let i;
	try {
		i = vr(r.transition.path, { precision: 2 });
	} catch (e) {
		throw Error(`${t}.move.transition.path: ${e instanceof Error ? e.message : "SVG path is invalid."}`);
	}
	return {
		...n,
		move: {
			...r,
			transition: {
				...r.transition,
				path: i
			}
		}
	};
}
function Ts(e, t) {
	if (!T(e)) throw Error(`${t} must be an object.`);
	for (let n of ["width", "height"]) {
		let r = e[n];
		if (r !== void 0 && r !== "auto" && r !== "preserve" && r !== "container") throw Error(`${t}.${n} must be auto, preserve or container.`);
	}
}
//#endregion
//#region ../codplay/src/scene/compiled/semantic-validator.ts
function Es(e, t) {
	As(e, t), ks(e, t);
	let n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
	for (let [i, a] of Object.entries(e.scene.stories)) Ms(e, i, a, n, r, t);
	Ns(e, n, t), js(e, t), Ds(e, t), Ps(e, r, t), Is(e, t);
}
function Ds(e, t) {
	for (let n of Object.values(e.scene.stories)) for (let r of n.persos) {
		let i = r.emit?.observe;
		if (i === void 0 || Array.isArray(i)) continue;
		let a = i;
		if (a.liveAction === void 0) continue;
		let o = r.actions[a.liveAction], s = e.actionTargetIndex[a.liveAction] ?? [];
		(!(s.length === 1 && s[0]?.storyId === n.id && s[0]?.persoId === r.id) || !Os(o)) && t.error("COMPILED_SCROLL_OBSERVATION_LIVE_ACTION_INVALID", `Compiled emit.observe.liveAction must identify only a TweenAction on its observed perso: ${a.liveAction}.`, { context: {
			sceneId: e.scene.id,
			storyId: n.id,
			persoId: r.id,
			actionName: a.liveAction
		} });
	}
}
function Os(e) {
	return !T(e) || !T(e.fn) ? !1 : typeof e.fn.ref == "string" && e.fn.ref.length > 0 && typeof e.duration == "number" && Number.isFinite(e.duration) && e.duration > 0;
}
function ks(e, t) {
	for (let n of e.scene.listen) n.active !== void 0 && t.error("COMPILED_SCENE_LISTEN_ACTIVE_INVALID", "Scene-level listen rules cannot declare story isolation with active.", { context: {
		sceneId: e.scene.id,
		eventName: n.on
	} });
	let n = {};
	for (let [r, i] of Object.entries(e.scene.stories)) {
		let a = {};
		for (let [n, o] of i.listen.entries()) if (o.active === !0) {
			if (a[o.on] !== void 0) {
				t.error("COMPILED_STORY_ACTIVATION_DUPLICATE", `Story activation is declared more than once for the event: ${o.on}.`, { context: {
					sceneId: e.scene.id,
					storyId: r,
					eventName: o.on
				} });
				continue;
			}
			a[o.on] = n;
		}
		n[r] = a;
	}
	if (Object.values(n).some((e) => Object.keys(e).length > 0) && e.storyActivationIndex === void 0) {
		t.error("COMPILED_STORY_ACTIVATION_INDEX_MISSING", "CompiledScene storyActivationIndex is required when a story declares active: true.", { context: { sceneId: e.scene.id } });
		return;
	}
	if (e.storyActivationIndex === void 0) return;
	let r = new Set(Object.keys(e.storyActivationIndex)), i = new Set(Object.keys(n));
	if (!Ls(r, i)) {
		t.error("COMPILED_STORY_ACTIVATION_INDEX_INCONSISTENT", "CompiledScene storyActivationIndex must contain exactly the compiled story ids.", { context: { sceneId: e.scene.id } });
		return;
	}
	for (let r of i) {
		let i = e.storyActivationIndex[r], a = n[r] ?? {};
		(i === void 0 || !Rs(i, a)) && t.error("COMPILED_STORY_ACTIVATION_INDEX_INCONSISTENT", `CompiledScene storyActivationIndex does not match story.listen for: ${r}.`, { context: {
			sceneId: e.scene.id,
			storyId: r
		} });
	}
}
function As(e, t) {
	e.scene.id.trim().length === 0 && t.error("COMPILED_SCENE_ID_INVALID", "CompiledScene scene.id must not be empty."), Number.isNaN(Date.parse(e.createdAt)) && t.error("COMPILED_SCENE_CREATED_AT_INVALID", "CompiledScene createdAt must be a valid date string.");
}
function js(e, t) {
	let n = e.actionTargetIndex;
	if (n === void 0) {
		t.error("COMPILED_ACTION_TARGET_INDEX_MISSING", "CompiledScene actionTargetIndex is required.", { context: { sceneId: e.scene.id } });
		return;
	}
	let r = {};
	for (let t of Object.values(e.scene.stories)) for (let e of t.persos) for (let n of Object.keys(e.actions)) (r[n] ?? (r[n] = [])).push(`${t.id}\u0000${e.id}`);
	let i = Object.keys(n);
	if (!Ls(new Set(i), new Set(Object.keys(r)))) {
		t.error("COMPILED_ACTION_TARGET_INDEX_INCONSISTENT", "CompiledScene actionTargetIndex must contain exactly the action names declared by compiled persos.", { context: { sceneId: e.scene.id } });
		return;
	}
	for (let [i, a] of Object.entries(n)) {
		let n = /* @__PURE__ */ new Set();
		for (let r of a) {
			let a = e.scene.stories[r.storyId], o = a?.persos.find((e) => e.id === r.persoId);
			if (a === void 0 || o === void 0 || !(i in o.actions)) {
				t.error("COMPILED_ACTION_TARGET_INDEX_INVALID", `CompiledScene actionTargetIndex references a target without the action: ${i}.`, { context: {
					sceneId: e.scene.id,
					actionName: i,
					storyId: r.storyId,
					persoId: r.persoId
				} });
				continue;
			}
			n.add(`${r.storyId}\u0000${r.persoId}`);
		}
		Ls(n, new Set(r[i])) || t.error("COMPILED_ACTION_TARGET_INDEX_INCONSISTENT", `CompiledScene actionTargetIndex targets do not match the compiled action: ${i}.`, { context: {
			sceneId: e.scene.id,
			actionName: i
		} });
	}
}
function Ms(e, t, n, r, i, a) {
	(t.trim().length === 0 || n.id.trim().length === 0 || n.id !== t) && a.error("COMPILED_STORY_ID_INVALID", `CompiledScene story id must match its non-empty map key: ${t}.`, { context: {
		sceneId: e.scene.id,
		storyId: n.id,
		storyKey: t
	} }), n.trackId !== void 0 && n.trackId.trim().length === 0 && a.error("COMPILED_STORY_TRACK_ID_INVALID", `CompiledScene story trackId must not be empty: ${n.id}.`, { context: {
		sceneId: e.scene.id,
		storyId: n.id
	} });
	let o = /* @__PURE__ */ new Map();
	for (let t of n.persos) {
		if (t.id.trim().length === 0 && a.error("COMPILED_PERSO_ID_INVALID", "CompiledScene perso.id must not be empty.", { context: {
			sceneId: e.scene.id,
			storyId: n.id
		} }), r.has(t.id) && a.error("COMPILED_PERSO_ID_DUPLICATE", `CompiledScene perso.id is not unique in the scene: ${t.id}.`, { context: {
			sceneId: e.scene.id,
			storyId: n.id,
			persoId: t.id
		} }), r.add(t.id), t.type.trim().length === 0 && a.error("COMPILED_PERSO_TYPE_INVALID", `CompiledScene perso.type must not be empty: ${t.id}.`, { context: {
			sceneId: e.scene.id,
			storyId: n.id,
			persoId: t.id
		} }), i.add(t.type), t.type === "slot") if (t.name === void 0 || t.name.trim().length === 0) a.error("COMPILED_SLOT_NAME_INVALID", `CompiledScene slot perso must declare a non-empty root name: ${t.id}.`, { context: {
			sceneId: e.scene.id,
			storyId: n.id,
			persoId: t.id
		} });
		else {
			let r = o.get(t.name);
			r === void 0 ? o.set(t.name, t.id) : a.error("COMPILED_SLOT_NAME_DUPLICATE", `CompiledScene slot name is duplicated in story ${n.id}: ${t.name}.`, { context: {
				sceneId: e.scene.id,
				storyId: n.id,
				persoId: t.id,
				previousPersoId: r
			} });
		}
		(!(t.id in t.actions) || t.actions[t.id] !== null) && a.error("COMPILED_PERSO_SELF_ACTION_INVALID", `CompiledScene perso.actions[${t.id}] must be the canonical null self-action.`, { context: {
			sceneId: e.scene.id,
			storyId: n.id,
			persoId: t.id
		} });
	}
}
function Ns(e, t, n) {
	let r = /* @__PURE__ */ new Set();
	for (let i of e.rootNodeIds) i.trim().length === 0 && n.error("COMPILED_ROOT_ID_INVALID", "CompiledScene rootNodeIds cannot contain an empty id."), r.has(i) && n.error("COMPILED_ROOT_ID_DUPLICATE", `CompiledScene rootNodeIds contains a duplicate id: ${i}.`), t.has(i) || n.error("COMPILED_ROOT_ID_UNKNOWN", `CompiledScene rootNodeIds references an unknown perso: ${i}.`), r.add(i);
}
function Ps(e, t, n) {
	Fs(e.requirements.components, "components", e, n), Fs(e.requirements.services, "services", e, n), Fs(e.requirements.modules, "modules", e, n), Fs(e.requirements.resources, "resources", e, n), Fs(e.requirements.libraries ?? [], "libraries", e, n), Ls(new Set(e.requirements.components), t) || n.error("COMPILED_REQUIREMENTS_COMPONENTS_INCONSISTENT", "CompiledScene requirements.components must match the component types used by its persos.", { context: { sceneId: e.scene.id } });
}
function Fs(e, t, n, r) {
	let i = /* @__PURE__ */ new Set();
	for (let a of e) a.trim().length === 0 && r.error("COMPILED_REQUIREMENT_NAME_INVALID", `CompiledScene requirements.${t} cannot contain an empty name.`, { context: {
		sceneId: n.scene.id,
		kind: t
	} }), i.has(a) && r.error("COMPILED_REQUIREMENT_DUPLICATE", `CompiledScene requirements.${t} contains a duplicate name: ${a}.`, { context: {
		sceneId: n.scene.id,
		kind: t,
		value: a
	} }), i.add(a);
}
function Is(e, t) {
	let n = /* @__PURE__ */ new Set();
	for (let r of e.resources.entries) (r.url.trim().length === 0 || r.type.trim().length === 0) && t.error("COMPILED_RESOURCE_INVALID", "CompiledScene resources must have non-empty url and type fields.", { context: {
		sceneId: e.scene.id,
		url: r.url
	} }), n.has(r.url) && t.error("COMPILED_RESOURCE_DUPLICATE", `CompiledScene resources contains a duplicate url: ${r.url}.`, { context: {
		sceneId: e.scene.id,
		url: r.url
	} }), n.add(r.url);
	Ls(n, new Set(e.requirements.resources)) || t.error("COMPILED_REQUIREMENTS_RESOURCES_INCONSISTENT", "CompiledScene requirements.resources must match resources.entries.", { context: { sceneId: e.scene.id } });
}
function Ls(e, t) {
	if (e.size !== t.size) return !1;
	for (let n of e) if (!t.has(n)) return !1;
	return !0;
}
function Rs(e, t) {
	let n = Object.keys(e), r = Object.keys(t);
	return n.length === r.length ? n.every((n) => e[n] === t[n]) : !1;
}
//#endregion
//#region ../codplay/src/scene/compiled/rel-target-validation.ts
function zs(e, t) {
	let n = /* @__PURE__ */ new Set();
	for (let t of Object.values(e.scene.stories)) for (let e of t.persos) n.add(e.id);
	for (let [r, i] of Object.entries(e.scene.stories)) for (let a of i.persos) {
		let i = a.rel;
		i === void 0 || n.has(i.host) || t.warning("AUTHOR_REL_HOST_UNKNOWN", `rel.host does not identify a component in the compiled scene: ${i.host}.`, {
			refs: {
				sceneId: e.scene.id,
				storyId: r,
				persoId: a.id
			},
			context: {
				host: i.host,
				target: i.target
			}
		});
	}
}
//#endregion
//#region ../codplay/src/scene/compiled/scroll-observation-validation.ts
var Bs = /* @__PURE__ */ new Set([
	"rootMargin",
	"scrollMargin",
	"threshold",
	"trackVisibility"
]), Vs = /* @__PURE__ */ new Set([
	"name",
	"data",
	"visibility",
	"mode",
	"once"
]), Hs = /* @__PURE__ */ new Set([
	"root",
	"initial",
	"liveAction",
	"zone",
	"enter",
	"leave"
]);
function Us(e, t) {
	for (let [n, r] of Object.entries(e.stories)) {
		let i = new Set(r.persos.filter((e) => e.type === "scroll-container").map((e) => e.id));
		for (let a of r.persos) for (let [r, o] of Object.entries(a.emit ?? {})) {
			if (r === "observe") {
				Ws(o, {
					sceneId: e.id,
					storyId: n,
					persoId: a.id,
					persoActions: a.actions,
					path: "emit.observe",
					scrollContainerIds: i
				}, t);
				continue;
			}
			for (let [i, s] of Js(o).entries()) T(s) && (Object.keys(s).some((e) => [
				"root",
				"zone",
				"enter",
				"leave"
			].includes(e)) && t.error("AUTHOR_SCROLL_OBSERVATION_INVALID", "A scroll observation must be declared directly at emit.observe.", {
				refs: {
					sceneId: e.id,
					storyId: n,
					persoId: a.id
				},
				context: { path: `emit.${r}${Array.isArray(o) ? `[${i}]` : ""}` }
			}), a.type === "scroll-container" && r === "scroll" && s.capture !== void 0 && T(s.capture) && s.capture.trackCommand === void 0 && t.warning("AUTHOR_SCROLL_CAPTURE_TRACK_COMMAND_MISSING", "Scroll capture has no trackCommand; it will record no live progress action.", {
				refs: {
					sceneId: e.id,
					storyId: n,
					persoId: a.id
				},
				context: { path: `emit.scroll${Array.isArray(o) ? `[${i}]` : ""}.capture.trackCommand` }
			}));
		}
	}
}
function Ws(e, t, n) {
	let r = {
		sceneId: t.sceneId,
		storyId: t.storyId,
		persoId: t.persoId
	}, i = (e, i, a = "") => {
		n.error(e, i, {
			refs: r,
			context: { path: `${t.path}${a}` }
		});
	};
	if (!T(e)) {
		i("AUTHOR_SCROLL_OBSERVATION_INVALID", "emit.observe must be one plain object.");
		return;
	}
	for (let t of Object.keys(e)) Hs.has(t) || i("AUTHOR_SCROLL_OBSERVATION_OPTION_INVALID", `emit.observe.${t} is not supported.`, `.${t}`);
	if (e.root === void 0 ? t.scrollContainerIds.size === 0 && i("AUTHOR_SCROLL_OBSERVATION_SCOPE_INVALID", "emit.observe requires a scroll-container in the same story.", "") : typeof e.root != "string" || e.root.trim().length === 0 ? i("AUTHOR_SCROLL_OBSERVATION_ROOT_INVALID", "emit.observe.root must be a non-empty scroll-container persona id.", ".root") : t.scrollContainerIds.has(e.root) || i("AUTHOR_SCROLL_OBSERVATION_ROOT_INVALID", "emit.observe.root must identify a scroll-container in the same story.", ".root"), e.initial !== void 0 && e.initial !== "enter" && e.initial !== "leave" && i("AUTHOR_SCROLL_OBSERVATION_INITIAL_INVALID", "emit.observe.initial must be enter or leave.", ".initial"), e.liveAction !== void 0) {
		let n = typeof e.liveAction == "string" ? t.persoActions[e.liveAction] : void 0;
		(typeof e.liveAction != "string" || e.liveAction.trim().length === 0 || !Gs(n)) && i("AUTHOR_SCROLL_OBSERVATION_ACTION_INVALID", "emit.observe.liveAction must name a TweenAction with a function declared in actions on the observed perso.", ".liveAction");
	}
	if (e.zone !== void 0) if (!T(e.zone)) i("AUTHOR_SCROLL_OBSERVATION_ZONE_INVALID", "emit.observe.zone must be a plain object.", ".zone");
	else {
		for (let t of Object.keys(e.zone)) Bs.has(t) || i("AUTHOR_SCROLL_OBSERVATION_ZONE_OPTION_INVALID", `emit.observe.zone.${t} is not supported.`, `.zone.${t}`);
		Ks(e.zone.rootMargin, "rootMargin", i), Ks(e.zone.scrollMargin, "scrollMargin", i);
		let t = e.zone.threshold;
		t !== void 0 && !(t === void 0 ? [] : Array.isArray(t) ? t : [t]).every((e) => typeof e == "number" && Number.isFinite(e) && e >= 0 && e <= 1) && i("AUTHOR_SCROLL_OBSERVATION_THRESHOLD_INVALID", "emit.observe.zone.threshold must be a number or an array of finite numbers from 0 to 1.", ".zone.threshold"), e.zone.trackVisibility !== void 0 && typeof e.zone.trackVisibility != "boolean" && i("AUTHOR_SCROLL_OBSERVATION_VISIBILITY_INVALID", "emit.observe.zone.trackVisibility must be a boolean.", ".zone.trackVisibility");
	}
	qs(e.enter, "enter", i), qs(e.leave, "leave", i);
}
function Gs(e) {
	return T(e) && typeof e.fn == "function" && typeof e.duration == "number" && Number.isFinite(e.duration) && e.duration > 0;
}
function Ks(e, t, n) {
	if (e === void 0) return;
	let r = typeof e == "string" ? e.trim().split(/\s+/) : [];
	r.length >= 1 && r.length <= 4 && r.every((e) => /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:px|%)$/.test(e)) || n("AUTHOR_SCROLL_OBSERVATION_MARGIN_INVALID", `emit.observe.zone.${t} must contain one to four pixel or percent lengths.`, `.zone.${t}`);
}
function qs(e, t, n) {
	if (e !== void 0) {
		if (!Array.isArray(e)) {
			n("AUTHOR_SCROLL_OBSERVATION_EVENTS_INVALID", `emit.observe.${t} must be an array of events.`, `.${t}`);
			return;
		}
		e.forEach((e, r) => {
			(!T(e) || Object.keys(e).some((e) => !Vs.has(e)) || typeof e.name != "string" || e.once !== void 0 && e.once !== !0 || e.name.trim().length === 0 || e.visibility !== void 0 && ![
				"story",
				"scene",
				"public"
			].includes(String(e.visibility)) || e.mode !== void 0 && !["apply-now", "persist-only"].includes(String(e.mode))) && n("AUTHOR_SCROLL_OBSERVATION_EVENT_INVALID", `emit.observe.${t}[${r}] must use the existing ordinary event shape.`, `.${t}[${r}]`);
		});
	}
}
function Js(e) {
	return Array.isArray(e) ? e : [e];
}
//#endregion
//#region ../codplay/src/scene/compiled/capture-event-validation.ts
var Ys = /* @__PURE__ */ new Set([
	"story",
	"scene",
	"public"
]);
function Xs(e, t) {
	for (let [n, r] of Object.entries(e.stories)) for (let i of r.persos) for (let [r, a] of Object.entries(i.emit ?? {})) r !== "observe" && (Array.isArray(a) ? a : [a]).forEach((o, s) => {
		if (!T(o) || !T(o.capture)) return;
		let c = `emit.${r}${Array.isArray(a) ? `[${s}]` : ""}`;
		Zs(o.event, `${c}.event`, e.id, n, i.id, t), o.capture.endEmit !== void 0 && Zs(o.capture.endEmit, `${c}.capture.endEmit`, e.id, n, i.id, t);
	});
}
function Zs(e, t, n, r, i, a) {
	let o = (e, o, s = "") => {
		a.error(e, o, {
			refs: {
				sceneId: n,
				storyId: r,
				persoId: i
			},
			context: { path: `${t}${s}` }
		}, `${n}:${r}:${i}:${t}${s}:${e}`);
	};
	if (!T(e)) {
		o("AUTHOR_CAPTURE_EVENT_INVALID", "Capture event must be a plain object.");
		return;
	}
	Object.hasOwn(e, "cascade") && o("AUTHOR_CAPTURE_EVENT_SCOPE_LEGACY", "Capture events use named visibility; cascade is not supported.", ".cascade"), e.visibility !== void 0 && !Ys.has(String(e.visibility)) && o("AUTHOR_CAPTURE_EVENT_VISIBILITY_INVALID", "Capture event visibility must be story, scene, or public.", ".visibility");
}
//#endregion
//#region ../codplay/src/scene/compiled/scene-builder.ts
var Qs = class {
	guardEngine = new gs();
	validationEngine;
	options;
	constructor(e, t = {}) {
		this.validationEngine = new ls(e), this.options = t;
	}
	build(e) {
		let t = new z({ output: this.options.diagnosticOutput }), n = qo(e);
		this.guardEngine.validate(n, t);
		let r = nc(n);
		if (Us(r, t), Xs(r, t), this.validationEngine.validate({ persos: rc(r) }, t), t.hasErrors()) return {
			ok: !1,
			diagnostics: t.report()
		};
		try {
			let n = Fo(), i = ic(r, n, this.validationEngine), a = this.options.export ? Lo(n) : void 0;
			a !== void 0 && $s(e, n.functions, a, t);
			let o = this.options.export ? gc(r, i, this.options.preloadManifest, this.options.preloadResourceOccurrences ?? [], t) : void 0;
			if (t.hasErrors()) return {
				ok: !1,
				diagnostics: t.report()
			};
			let s = o?.entries ?? Rc(r), c = {
				schemaVersion: this.options.schemaVersion ?? F.schemaVersion,
				createdAt: this.options.createdAt ?? (/* @__PURE__ */ new Date()).toISOString(),
				scene: i,
				resources: { entries: s },
				rootNodeIds: pc(r),
				requirements: hc(r, this.validationEngine, s),
				actionTargetIndex: tc(i),
				storyActivationIndex: fc(i)
			};
			return Es(c, t), zs(c, t), t.hasErrors() ? {
				ok: !1,
				diagnostics: t.report()
			} : (Vc(c), o !== void 0 && Vc(o.references), a !== void 0 && Vc(a), {
				ok: !0,
				compiledScene: c,
				functions: Io(n),
				...o === void 0 ? {} : { resourceReferences: o.references },
				...a === void 0 ? {} : { functionReferences: a },
				diagnostics: t.report()
			});
		} catch (e) {
			return t.error("COMPILED_VALUE_UNSUPPORTED", e instanceof Error ? e.message : "One scene value cannot be compiled.", { context: { sceneId: n.id } }), {
				ok: !1,
				diagnostics: t.report()
			};
		}
	}
};
function $s(e, t, n, r) {
	let i = /* @__PURE__ */ new Set();
	for (let a of n) {
		let n = ec(e, a.path);
		(i.has(a.ref) || typeof n != "function" || t[a.ref] !== n) && r.error("CODPLAY_EXPORT_FUNCTION_REFERENCE_UNSUPPORTED", `Compiled function reference does not resolve to its exact source function: ${a.ref}.`, { context: {
			sceneId: e.id,
			functionRef: a.ref,
			path: a.path
		} }), i.add(a.ref);
	}
	i.size !== Object.keys(t).length && r.error("CODPLAY_EXPORT_FUNCTION_REFERENCE_UNSUPPORTED", "Compiled function references do not cover the complete function collection.", { context: {
		sceneId: e.id,
		expected: Object.keys(t).length,
		received: i.size
	} });
}
function ec(e, t) {
	let n = e;
	for (let e of t) {
		if (typeof e == "number") {
			if (!Array.isArray(n) || e < 0 || e >= n.length) return;
			n = n[e];
			continue;
		}
		if (typeof n != "object" && typeof n != "function" || n === null || !Object.hasOwn(n, e)) return;
		n = n[e];
	}
	return n;
}
function tc(e) {
	let t = {};
	for (let n of Object.values(e.stories)) for (let e of n.persos) for (let r of Object.keys(e.actions)) (t[r] ?? (t[r] = [])).push({
		storyId: n.id,
		persoId: e.id
	});
	return t;
}
function nc(e) {
	return {
		...e,
		stories: Object.fromEntries(Object.entries(e.stories).filter(([, e]) => e.disabled !== !0))
	};
}
function rc(e) {
	return Object.values(e.stories).flatMap((e) => e.persos.map((t, n) => ({
		...t,
		storyId: e.id,
		validationPath: `stories.${e.id}.persos[${n}]`
	})));
}
function ic(e, t, n) {
	return {
		id: e.id,
		name: e.name,
		stories: Object.fromEntries(Object.entries(e.stories).map(([e, r]) => [e, ac(r, `scene.stories.${e}`, t, n, ["stories", e])])),
		initial: R(e.initial, "scene.initial", t, ["initial"]),
		straps: oc(e.straps, "scene.straps", t, ["straps"]),
		listen: e.listen.map((e, n) => dc(e, `scene.listen[${n}]`, t, ["listen", n])),
		eventimes: e.eventimes?.map((e, n) => Po(e, `scene.eventimes[${n}]`, t, ["eventimes", n])),
		state: R(e.state, "scene.state", t, ["state"]),
		tracks: R(e.tracks, "scene.tracks", t, ["tracks"]) ?? {},
		defaults: R(e.defaults, "scene.defaults", t, ["defaults"]),
		init: e.init === void 0 ? void 0 : L(e.init, "scene.init", t, ["init"]),
		onStart: e.onStart === void 0 ? void 0 : L(e.onStart, "scene.onStart", t, ["onStart"]),
		onSequenceEnd: e.onSequenceEnd === void 0 ? void 0 : L(e.onSequenceEnd, "scene.onSequenceEnd", t, ["onSequenceEnd"])
	};
}
function ac(e, t, n, r, i) {
	return {
		id: e.id,
		name: e.name,
		trackId: e.trackId,
		initial: R(e.initial, `${t}.initial`, n, [...i, "initial"]),
		persos: e.persos.map((e, a) => sc(e, `${t}.persos[${a}]`, n, r, [
			...i,
			"persos",
			a
		])),
		tracks: R(e.tracks, `${t}.tracks`, n, [...i, "tracks"]),
		straps: oc(e.straps, `${t}.straps`, n, [...i, "straps"]),
		listen: e.listen.map((e, r) => dc(e, `${t}.listen[${r}]`, n, [
			...i,
			"listen",
			r
		])),
		eventimes: e.eventimes?.map((e, r) => Po(e, `${t}.eventimes[${r}]`, n, [
			...i,
			"eventimes",
			r
		])),
		state: R(e.state, `${t}.state`, n, [...i, "state"]),
		init: e.init === void 0 ? void 0 : L(e.init, `${t}.init`, n, [...i, "init"])
	};
}
function oc(e, t, n, r) {
	if (e !== void 0) return Array.isArray(e) ? [...e] : Object.fromEntries(Object.entries(e).map(([e, i]) => [e, L(i, `${t}.${e}`, n, [...r, e])]));
}
function sc(e, t, n, r, i) {
	let a = r.sanitizeInitial(e.type, e.initial), o = jo(R(ws(lc(a), `${t}.initial`), `${t}.initial`, n, [...i, "initial"]) ?? {}), s = cc(a.rel, `${t}.initial.rel`, n, [
		...i,
		"initial",
		"rel"
	]);
	return {
		id: e.id,
		name: e.name,
		type: e.type,
		initial: o,
		rel: s,
		actions: Object.fromEntries(Object.entries(e.actions).map(([a, o]) => [a, jo(Po(ws(uc(T(o) ? r.sanitizeAction(e.type, o) : o), `${t}.actions.${a}`), `${t}.actions.${a}`, n, [
			...i,
			"actions",
			a
		]))])),
		list: R(e.list, `${t}.list`, n, [...i, "list"]),
		emit: _s(e.emit, `${t}.emit`, n, [...i, "emit"])
	};
}
function cc(e, t, n, r) {
	if (es(e)) return R(e, t, n, r);
}
function lc(e) {
	if (!("rel" in e)) return e;
	let { rel: t, ...n } = e;
	return n;
}
function uc(e) {
	if (T(e)) {
		if (!("rel" in e)) return e;
		let { rel: t, ...n } = e;
		return n;
	}
	return Array.isArray(e) ? e.map((e) => {
		if (!T(e) || !T(e.action) || !("rel" in e.action)) return e;
		let { rel: t, ...n } = e.action;
		return {
			...e,
			action: n
		};
	}) : e;
}
function dc(e, t, n, r) {
	return {
		on: e.on,
		active: e.active,
		reset: e.reset,
		transform: e.transform?.map((e, i) => L(e, `${t}.transform[${i}]`, n, [
			...r,
			"transform",
			i
		])),
		emit: e.emit?.map((e, i) => Po(e, `${t}.emit[${i}]`, n, [
			...r,
			"emit",
			i
		])),
		straps: e.straps
	};
}
function fc(e) {
	return Object.fromEntries(Object.entries(e.stories).map(([e, t]) => [e, Object.fromEntries(t.listen.flatMap((e, t) => e.active === !0 ? [[e.on, t]] : []))]));
}
function pc(e) {
	let t = [];
	for (let n of Object.values(e.stories)) for (let e of n.persos) [e.initial, ...Object.values(e.actions).filter(T)].some(mc) && !t.includes(e.id) && t.push(e.id);
	return t;
}
function mc(e) {
	return e.move === F.rootToken ? !0 : T(e.move) && e.move.target === F.rootToken;
}
function hc(e, t, n = Rc(e)) {
	let r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
	for (let n of Object.values(e.stories)) for (let e of n.persos) {
		r.add(e.type);
		for (let n of t.servicesFor(e.type)) i.add(n);
		for (let n of t.modulesFor(e.type)) a.add(n);
		for (let n of t.librariesFor(e.type)) o.add(n);
	}
	return {
		components: [...r],
		services: [...i],
		modules: [...a],
		libraries: [...o],
		resources: n.map((e) => e.url)
	};
}
function gc(e, t, n, r, i) {
	let a = /* @__PURE__ */ new Map(), o = [];
	for (let [t, n] of Object.entries(e.stories)) for (let [r, s] of n.persos.entries()) {
		let n = [
			"scene",
			"stories",
			t,
			"persos",
			r
		];
		if (xc(e.id, s.initial, [...n, "initial"], s, t, i, a, o), s.type === "img") Fc(e.id, s.initial.src, "image", [
			...n,
			"initial",
			"src"
		], s, t, i, a, o), Nc(e.id, s.initial.img, [
			...n,
			"initial",
			"img"
		], s, t, i, a, o), Sc(e.id, s, t, n, i, a, o, (n, r) => {
			Fc(e.id, n.src, "image", [...r, "src"], s, t, i, a, o), Nc(e.id, n.img, [...r, "img"], s, t, i, a, o);
		});
		else if (s.type === "media") Fc(e.id, s.initial.src, void 0, [
			...n,
			"initial",
			"src"
		], s, t, i, a, o), Pc(e.id, s.initial.video, [
			...n,
			"initial",
			"video"
		], s, t, i), Sc(e.id, s, t, n, i, a, o, (n, r) => {
			Fc(e.id, n.src, void 0, [...r, "src"], s, t, i, a, o), Pc(e.id, n.video, [...r, "video"], s, t, i);
		});
		else if (s.type === "rive") Fc(e.id, s.initial.src, "rive", [
			...n,
			"initial",
			"src"
		], s, t, i, a, o);
		else if (s.type === "tag") {
			let r = typeof s.initial.tag == "string" ? s.initial.tag.toLowerCase() : "", c = r === "img" ? "image" : r === "audio" || r === "video" ? r : void 0;
			jc(e.id, s.initial, [...n, "initial"], r, c, s, t, i, a, o), Sc(e.id, s, t, n, i, a, o, (n, l) => {
				jc(e.id, n, l, r, c, s, t, i, a, o);
			});
		}
	}
	return _c(e, t, n, r, i, a, o), {
		entries: [...a.values()],
		references: o
	};
}
function _c(e, t, n, r, i, a, o) {
	let s = /* @__PURE__ */ new Set(), c = /* @__PURE__ */ new Set(), l = vc(e.id, n, i), u = yc(e.id, r, i);
	for (let n of u) {
		if (!T(n)) {
			bc(e.id, i, n, "Preload resource occurrence must be an object.");
			continue;
		}
		let r = Number.isInteger(n.entryIndex) && n.entryIndex >= 0 ? n.entryIndex : void 0, u = typeof n.storyId == "string" ? n.storyId : void 0, d = typeof n.persoId == "string" ? n.persoId : void 0, f = Array.isArray(n.path) ? n.path : void 0, p = r === void 0 ? void 0 : l[r];
		if (r !== void 0 && p !== void 0 && c.add(r), r === void 0 || u === void 0 || d === void 0 || f === void 0) {
			bc(e.id, i, n, "Preload resource occurrence must identify a manifest entry, story, perso and path.", p);
			continue;
		}
		let m = {
			entryIndex: r,
			storyId: u,
			persoId: d,
			path: f
		}, h = Object.entries(e.stories).filter(([, e]) => e.id === u), g = h[0]?.[1], _ = h[0]?.[0], v = g?.persos.flatMap((e, t) => e.id === d ? [{
			perso: e,
			index: t
		}] : []) ?? [], y = v[0];
		if (h.length !== 1 || g === void 0 || _ === void 0 || v.length !== 1 || y === void 0) {
			bc(e.id, i, n, "Preload resource occurrence must identify exactly one active story and perso.", p);
			continue;
		}
		if (!T(p) || typeof p.url != "string" || p.url.length === 0 || typeof p.type != "string" || p.type.length === 0 || !T(p.policy) || !Array.isArray(m.path) || m.path.length === 0 || m.path.some((e) => typeof e != "string" && (typeof e != "number" || !Number.isInteger(e) || e < 0))) {
			bc(e.id, i, n, "Preload resource occurrence does not identify a valid preload-manifest entry.", p);
			continue;
		}
		if (Lc(p.url)) {
			bc(e.id, i, n, "Only local preload resource paths are supported by this export step.", p);
			continue;
		}
		let b = ec(y.perso, m.path), x = [
			"stories",
			_,
			"persos",
			y.index,
			...m.path
		], ee = ["scene", ...x], te = ec(t, x);
		if (b !== p.url || te !== p.url) {
			bc(e.id, i, n, "Preload resource occurrence does not resolve to the same authored and compiled URL.", p);
			continue;
		}
		let S = JSON.stringify(ee);
		if (s.has(S)) {
			bc(e.id, i, n, "A compiled resource occurrence is declared more than once.", p);
			continue;
		}
		s.add(S);
		let C = a.get(p.url);
		if (C !== void 0 && C.type !== p.type) {
			bc(e.id, i, n, "One resource URL is declared with conflicting preload types.", p);
			continue;
		}
		C === void 0 && a.set(p.url, p), o.push({
			url: p.url,
			type: p.type,
			path: ee
		});
	}
	for (let [t, n] of l.entries()) {
		if (!T(n) || typeof n.url != "string" || typeof n.type != "string" || n.type.length === 0 || !T(n.policy)) {
			i.error("CODPLAY_EXPORT_PRELOAD_RESOURCE_REFERENCE_UNSUPPORTED", "Preload manifest entry is malformed.", {
				refs: { sceneId: e.id },
				context: {
					sceneId: e.id,
					entryIndex: t
				}
			}, `export-preload-resource-malformed:${t}`);
			continue;
		}
		[
			"image",
			"audio",
			"video",
			"rive",
			"font",
			"css"
		].includes(n.type) || c.has(t) || i.error("CODPLAY_EXPORT_PRELOAD_RESOURCE_REFERENCE_UNSUPPORTED", "Custom preload resource has no exact component occurrence declaration.", {
			refs: { sceneId: e.id },
			context: {
				sceneId: e.id,
				entryIndex: t,
				url: n.url,
				type: n.type
			}
		}, `export-preload-resource-unmapped:${t}`);
	}
}
function vc(e, t, n) {
	return t === void 0 ? [] : !T(t) || !Array.isArray(t.entries) ? (n.error("CODPLAY_EXPORT_PRELOAD_RESOURCE_REFERENCE_UNSUPPORTED", "Preload manifest must contain an entries array.", {
		refs: { sceneId: e },
		context: { sceneId: e }
	}, "export-preload-manifest-invalid"), []) : t.entries;
}
function yc(e, t, n) {
	return t === void 0 ? [] : Array.isArray(t) ? t : (n.error("CODPLAY_EXPORT_PRELOAD_RESOURCE_REFERENCE_UNSUPPORTED", "Preload resource occurrences must be an array.", {
		refs: { sceneId: e },
		context: { sceneId: e }
	}, "export-preload-occurrences-invalid"), []);
}
function bc(e, t, n, r, i) {
	let a = T(n) ? n : void 0, o = typeof a?.storyId == "string" ? a.storyId : void 0, s = typeof a?.persoId == "string" ? a.persoId : void 0, c = Array.isArray(a?.path) ? a.path : void 0, l = a?.entryIndex, u = typeof l == "number" && Number.isInteger(l) ? l : void 0, d = T(i) ? i : void 0;
	t.error("CODPLAY_EXPORT_PRELOAD_RESOURCE_REFERENCE_UNSUPPORTED", r, {
		refs: {
			sceneId: e,
			...o === void 0 ? {} : { storyId: o },
			...s === void 0 ? {} : { persoId: s }
		},
		context: {
			sceneId: e,
			...o === void 0 ? {} : { storyId: o },
			...s === void 0 ? {} : { persoId: s },
			...c === void 0 ? {} : { path: [...c] },
			...u === void 0 ? {} : { entryIndex: u },
			...typeof d?.url == "string" ? { url: d.url } : {},
			...typeof d?.type == "string" ? { type: d.type } : {}
		}
	}, `export-preload-resource:${u ?? "invalid"}:${o ?? "unknown"}:${s ?? "unknown"}:${c?.join(".") ?? "unknown"}`);
}
function xc(e, t, n, r, i, a, o, s) {
	typeof t.markup == "string" && /<\s*(?:img|audio|video|source|track|script|style|link|iframe|frame|embed|object|image|use)\b|\b(?:src|srcset|poster)\s*=|url\s*\(/i.test(t.markup) && H(e, a, r, i, [...n, "markup"], t.markup, "Markup contains media, CSS or code resources that this export step does not package."), Cc(e, t, n, r, i, a, o, s);
}
function Sc(e, t, n, r, i, a, o, s) {
	Ac(t.actions, [...r, "actions"], (r, c) => {
		xc(e, r, c, t, n, i, a, o), s(r, c);
	});
}
function Cc(e, t, n, r, i, a, o, s) {
	if (Array.isArray(t)) {
		for (let [c, l] of t.entries()) Cc(e, l, [...n, c], r, i, a, o, s);
		return;
	}
	if (T(t)) for (let [c, l] of Object.entries(t)) {
		if (c === "style") {
			wc(e, l, [...n, c], r, i, a, o, s);
			continue;
		}
		(Array.isArray(l) || T(l)) && Cc(e, l, [...n, c], r, i, a, o, s);
	}
}
function wc(e, t, n, r, i, a, o, s) {
	if (typeof t == "string") {
		let c = new Set(s.filter((e) => e.cssValue !== void 0 && kc(e.path, n)).map((e) => `${e.url}\u0000${e.cssValue}`));
		for (let { value: l, raw: u } of Tc(t)) {
			let t = n;
			if (l === "" || l.includes("\\")) {
				H(e, a, r, i, t, l, "Inline CSS resource path is empty or uses unsupported escaping.");
				continue;
			}
			if (l.startsWith("#") || /^data:/i.test(l)) continue;
			if (Lc(l)) {
				H(e, a, r, i, t, l, "Inline CSS resource URLs must be local to the exported scene.");
				continue;
			}
			let d = Ic(l);
			if (d !== "image") {
				H(e, a, r, i, t, l, "Inline CSS url() references must resolve to a supported image file.");
				continue;
			}
			let f = o.get(l);
			if (f !== void 0 && f.type !== d) {
				H(e, a, r, i, t, l, `The same URL is used as both ${f.type} and ${d}.`);
				continue;
			}
			f === void 0 && o.set(l, {
				url: l,
				type: d,
				policy: {
					cache: "default",
					priority: "normal"
				}
			});
			let p = `${l}\u0000${u}`;
			c.has(p) || (s.push({
				url: l,
				type: d,
				path: n,
				cssValue: u
			}), c.add(p));
		}
		return;
	}
	if (Array.isArray(t)) {
		for (let [c, l] of t.entries()) wc(e, l, [...n, c], r, i, a, o, s);
		return;
	}
	if (T(t)) for (let [c, l] of Object.entries(t)) wc(e, l, [...n, c], r, i, a, o, s);
}
function Tc(e) {
	let t = [], n = 0;
	for (; n < e.length;) {
		if (e.startsWith("/*", n)) {
			let t = e.indexOf("*/", n + 2);
			n = t < 0 ? e.length : t + 2;
			continue;
		}
		if (e[n] === "\"" || e[n] === "'") {
			n = Dc(e, n);
			continue;
		}
		if (e.slice(n, n + 3).toLowerCase() === "url" && !Oc(e[n - 1])) {
			let r = n + 3;
			for (; /\s/.test(e[r] ?? "");) r += 1;
			if (e[r] === "(") {
				let i = Ec(e, r);
				if (i === void 0) {
					t.push({
						value: "",
						raw: e.slice(n)
					});
					break;
				}
				let a = e.slice(r + 1, i).trim(), o = a.length >= 2 && (a[0] === "\"" || a[0] === "'") ? a.slice(1, -1) : a;
				t.push({
					value: o,
					raw: e.slice(n, i + 1)
				}), n = i + 1;
				continue;
			}
		}
		n += 1;
	}
	return t;
}
function Ec(e, t) {
	let n = 1, r = t + 1;
	for (; r < e.length;) {
		if (e.startsWith("/*", r)) {
			let t = e.indexOf("*/", r + 2);
			r = t < 0 ? e.length : t + 2;
			continue;
		}
		if (e[r] === "\"" || e[r] === "'") {
			r = Dc(e, r);
			continue;
		}
		if (e[r] === "(" && (n += 1), e[r] === ")" && (--n, n === 0)) return r;
		r += 1;
	}
}
function Dc(e, t) {
	let n = e[t], r = t + 1;
	for (; r < e.length;) {
		if (e[r] === "\\") {
			r += 2;
			continue;
		}
		if (e[r] === n) return r + 1;
		r += 1;
	}
	return e.length;
}
function Oc(e) {
	return e !== void 0 && /[a-z0-9_-]/i.test(e);
}
function kc(e, t) {
	return e.length === t.length && e.every((e, n) => e === t[n]);
}
function Ac(e, t, n) {
	for (let [r, i] of Object.entries(e)) {
		let e = [...t, r];
		if (T(i)) {
			n(i, e);
			continue;
		}
		if (Array.isArray(i)) for (let [t, r] of i.entries()) !T(r) || !T(r.action) || n(r.action, [
			...e,
			t,
			"action"
		]);
	}
}
function jc(e, t, n, r, i, a, o, s, c, l) {
	if (r === "style" || r === "script") {
		H(e, s, a, o, [...n, "tag"], r, `Native ${r} elements are not supported by this media export step.`);
		return;
	}
	if (!T(t.attr)) return;
	let u = t.attr;
	for (let t of r === "video" ? ["poster", "srcset"] : r === "img" || r === "source" ? ["srcset"] : r === "track" ? ["src"] : []) u[t] !== void 0 && H(e, s, a, o, [
		...n,
		"attr",
		t
	], u[t], `Native ${r}.${t} resources are not part of this export step.`);
	for (let t of Mc(r)) u[t] !== void 0 && H(e, s, a, o, [
		...n,
		"attr",
		t
	], u[t], `Native ${r}.${t} resources are not part of this export step.`);
	if (u.src !== void 0) {
		if (r !== "img" && r !== "audio" && r !== "video" && r !== "source") {
			H(e, s, a, o, [
				...n,
				"attr",
				"src"
			], u.src, `Native ${r}.src resources are not part of this export step.`);
			return;
		}
		Fc(e, u.src, i, [
			...n,
			"attr",
			"src"
		], a, o, s, c, l);
	}
}
function Mc(e) {
	return e === "link" ? ["href"] : e === "object" ? ["data"] : e === "iframe" || e === "frame" ? ["srcdoc"] : e === "image" || e === "use" ? ["href", "xlink:href"] : [];
}
function Nc(e, t, n, r, i, a, o, s) {
	!T(t) || !T(t.attr) || (t.attr.srcset !== void 0 && H(e, a, r, i, [
		...n,
		"attr",
		"srcset"
	], t.attr.srcset, "Responsive image srcset resources are not part of this export step."), Fc(e, t.attr.src, "image", [
		...n,
		"attr",
		"src"
	], r, i, a, o, s));
}
function Pc(e, t, n, r, i, a) {
	if (!(!T(t) || !T(t.attr))) for (let o of [
		"src",
		"poster",
		"srcset"
	]) t.attr[o] !== void 0 && H(e, a, r, i, [
		...n,
		"attr",
		o
	], t.attr[o], `media.video.attr.${o} bypasses the managed media source preload path.`);
}
function Fc(e, t, n, r, i, a, o, s, c) {
	if (t === void 0) return;
	if (typeof t != "string" || t.length === 0) {
		H(e, o, i, a, r, t, "Media source must be a non-empty URL string.");
		return;
	}
	if (Lc(t)) {
		H(e, o, i, a, r, t, "Only local media paths are supported by this export step.");
		return;
	}
	let l = Ic(t), u = n ?? l;
	if (u === void 0 || l !== u) {
		H(e, o, i, a, r, t, `Media source must have a supported ${n ?? "audio or video"} file extension.`);
		return;
	}
	s.has(t) || s.set(t, {
		url: t,
		type: u,
		policy: {
			cache: "default",
			priority: "normal"
		}
	}), c.push({
		url: t,
		type: u,
		path: r
	});
}
function Ic(e) {
	let t = e.split(/[?#]/, 1)[0] ?? e, n = t.slice(t.lastIndexOf(".")).toLowerCase();
	if (n === ".flac" || n === ".m4a" || n === ".oga") return "audio";
	let r = F.resourceTypeByExtension[n];
	return r === "image" || r === "audio" || r === "video" || r === "rive" ? r : void 0;
}
function Lc(e) {
	return e.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(e);
}
function H(e, t, n, r, i, a, o) {
	let s = typeof a == "string" ? a : void 0;
	t.error("CODPLAY_EXPORT_MEDIA_REFERENCE_UNSUPPORTED", o, {
		refs: {
			sceneId: e,
			storyId: r,
			persoId: n.id
		},
		context: {
			sceneId: e,
			path: [...i],
			componentType: n.type,
			url: s
		}
	}, `export-media:${r}:${n.id}:${i.join(".")}`);
}
function Rc(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of Object.values(e.stories)) for (let e of n.persos) {
		zc(e.initial, t);
		for (let n of Object.values(e.actions)) T(n) && zc(n, t);
	}
	return [...t.values()];
}
function zc(e, t) {
	if (typeof e.src == "string" && !t.has(e.src)) {
		let n = Bc(e.src);
		n !== void 0 && t.set(e.src, {
			url: e.src,
			type: n,
			policy: {
				cache: "default",
				priority: "normal"
			}
		});
	}
}
function Bc(e) {
	let t = e.split(/[?#]/, 1)[0] ?? e, n = t.slice(t.lastIndexOf(".")).toLowerCase();
	return F.resourceTypeByExtension[n];
}
function Vc(e) {
	if (!(typeof e != "object" || !e || Object.isFrozen(e))) {
		for (let t of Object.values(e)) Vc(t);
		Object.freeze(e);
	}
}
//#endregion
//#region ../codplay/src/scene/compiled/codec.ts
var Hc = class {
	options;
	constructor(e = {}) {
		this.options = e;
	}
	encode(e) {
		if (!Uc(e, this.options.schemaVersion ?? F.schemaVersion)) throw Error("CompiledScene cannot be encoded because its structure is invalid.");
		let t = new z({ output: this.options.diagnosticOutput });
		if (Es(e, t), t.hasErrors()) throw Error("CompiledScene cannot be encoded because its semantics are invalid.");
		return JSON.stringify(e);
	}
	decode(e) {
		let t = new z({ output: this.options.diagnosticOutput }), n;
		try {
			n = JSON.parse(e);
		} catch {
			return t.error("COMPILED_SCENE_JSON_INVALID", "CompiledScene payload is not valid JSON."), {
				ok: !1,
				diagnostics: t.report()
			};
		}
		let r = this.options.schemaVersion ?? F.schemaVersion;
		return Uc(n, r) ? (Es(n, t), t.hasErrors() ? {
			ok: !1,
			diagnostics: t.report()
		} : (pl(n), {
			ok: !0,
			value: n,
			diagnostics: t.report()
		})) : (t.error("COMPILED_SCENE_INVALID", "CompiledScene envelope is invalid."), {
			ok: !1,
			diagnostics: t.report()
		});
	}
};
function Uc(e, t) {
	return !T(e) || !G(e, [
		"schemaVersion",
		"createdAt",
		"scene",
		"resources",
		"rootNodeIds",
		"requirements",
		"actionTargetIndex",
		"storyActivationIndex"
	]) ? !1 : e.schemaVersion === t && typeof e.createdAt == "string" && Kc(e.scene) && ol(e.resources) && W(e.rootNodeIds) && sl(e.requirements) && Gc(e.actionTargetIndex) && (e.storyActivationIndex === void 0 || Wc(e.storyActivationIndex));
}
function Wc(e) {
	return T(e) ? Object.values(e).every((e) => T(e) ? Object.values(e).every((e) => typeof e == "number" && Number.isInteger(e) && e >= 0) : !1) : !1;
}
function Gc(e) {
	return T(e) ? Object.entries(e).every(([e, t]) => e.length === 0 || !Array.isArray(t) ? !1 : t.every((e) => T(e) && G(e, ["storyId", "persoId"]) && typeof e.storyId == "string" && typeof e.persoId == "string")) : !1;
}
function Kc(e) {
	return !T(e) || !G(e, [
		"id",
		"name",
		"stories",
		"initial",
		"straps",
		"listen",
		"eventimes",
		"state",
		"tracks",
		"defaults",
		"init",
		"onStart",
		"onSequenceEnd"
	]) ? !1 : typeof e.id == "string" && (e.name === void 0 || typeof e.name == "string") && fl(e.stories, qc) && (e.initial === void 0 || U(e.initial)) && dl(e.straps) && al(e.listen) && (e.eventimes === void 0 || Array.isArray(e.eventimes) && e.eventimes.every(Jc)) && (e.state === void 0 || U(e.state)) && U(e.tracks) && (e.defaults === void 0 || U(e.defaults)) && ul(e.init) && ul(e.onStart) && ul(e.onSequenceEnd);
}
function qc(e) {
	return !T(e) || !G(e, [
		"id",
		"name",
		"trackId",
		"initial",
		"persos",
		"tracks",
		"straps",
		"listen",
		"eventimes",
		"state",
		"init"
	]) ? !1 : typeof e.id == "string" && (e.name === void 0 || typeof e.name == "string") && (e.trackId === void 0 || typeof e.trackId == "string") && (e.initial === void 0 || U(e.initial)) && Array.isArray(e.persos) && e.persos.every(Yc) && (e.tracks === void 0 || U(e.tracks)) && dl(e.straps) && al(e.listen) && (e.eventimes === void 0 || Array.isArray(e.eventimes) && e.eventimes.every(Jc)) && (e.state === void 0 || U(e.state)) && ul(e.init);
}
function Jc(e) {
	return T(e) && G(e, [
		"name",
		"startAt",
		"visibility",
		"data",
		"events"
	]) && typeof e.name == "string" && typeof e.startAt == "number" && Number.isFinite(e.startAt) && e.startAt >= 0 && (e.visibility === void 0 || e.visibility === "story" || e.visibility === "scene" || e.visibility === "public") && (e.data === void 0 || U(e.data)) && (e.events === void 0 || Array.isArray(e.events) && e.events.every(Jc));
}
function Yc(e) {
	return !T(e) || !G(e, [
		"id",
		"name",
		"type",
		"initial",
		"rel",
		"actions",
		"list",
		"emit"
	]) ? !1 : typeof e.id == "string" && (e.name === void 0 || typeof e.name == "string") && typeof e.type == "string" && U(e.initial) && (e.rel === void 0 || Xc(e.rel)) && U(e.actions) && Object.values(e.actions).every(cl) && (e.list === void 0 || U(e.list)) && (e.emit === void 0 || Qc(e.emit));
}
function Xc(e) {
	return !T(e) || !Zc(e.host) || e.target !== void 0 && !Zc(e.target) ? !1 : Object.entries(e).every(([e, t]) => e === "host" || e === "target" || cl(t));
}
function Zc(e) {
	return typeof e == "string" && e.trim().length > 0;
}
function Qc(e) {
	return T(e) && Object.entries(e).every(([e, t]) => e === "observe" ? el(t) : Array.isArray(t) ? t.every($c) : $c(t));
}
function $c(e) {
	return !T(e) || !G(e, [
		"ref",
		"keyCode",
		"preventDefault",
		"event",
		"data",
		"capture"
	]) || e.ref !== void 0 && typeof e.ref != "string" || e.keyCode !== void 0 && typeof e.keyCode != "string" || e.preventDefault !== void 0 && typeof e.preventDefault != "boolean" || e.data !== void 0 && !U(e.data) ? !1 : e.capture === void 0 ? nl(e.event) : rl(e.event) && il(e.capture);
}
function el(e) {
	return !T(e) || !G(e, [
		"root",
		"initial",
		"liveAction",
		"zone",
		"enter",
		"leave"
	]) || e.root !== void 0 && typeof e.root != "string" || e.initial !== void 0 && e.initial !== "enter" && e.initial !== "leave" || e.liveAction !== void 0 && (typeof e.liveAction != "string" || e.liveAction.trim().length === 0) || e.zone !== void 0 && (!T(e.zone) || !G(e.zone, [
		"rootMargin",
		"scrollMargin",
		"threshold",
		"trackVisibility"
	]) || e.zone.rootMargin !== void 0 && typeof e.zone.rootMargin != "string" || e.zone.scrollMargin !== void 0 && typeof e.zone.scrollMargin != "string" || e.zone.threshold !== void 0 && !(Array.isArray(e.zone.threshold) ? e.zone.threshold : [e.zone.threshold]).every((e) => typeof e == "number" && Number.isFinite(e) && e >= 0 && e <= 1) || e.zone.trackVisibility !== void 0 && typeof e.zone.trackVisibility != "boolean") ? !1 : (e.enter === void 0 || Array.isArray(e.enter) && e.enter.every(tl)) && (e.leave === void 0 || Array.isArray(e.leave) && e.leave.every(tl));
}
function tl(e) {
	return T(e) && G(e, [
		"name",
		"data",
		"visibility",
		"mode",
		"once"
	]) && typeof e.name == "string" && (e.data === void 0 || U(e.data)) && (e.visibility === void 0 || e.visibility === "story" || e.visibility === "scene" || e.visibility === "public") && (e.mode === void 0 || e.mode === "apply-now" || e.mode === "persist-only") && (e.once === void 0 || e.once === !0);
}
function nl(e) {
	return T(e) && G(e, [
		"name",
		"data",
		"visibility",
		"mode"
	]) && typeof e.name == "string" && (e.data === void 0 || U(e.data)) && (e.visibility === void 0 || e.visibility === "story" || e.visibility === "scene" || e.visibility === "public") && (e.mode === void 0 || e.mode === "apply-now" || e.mode === "persist-only");
}
function rl(e) {
	return T(e) && G(e, [
		"name",
		"data",
		"visibility",
		"mode"
	]) && typeof e.name == "string" && (e.data === void 0 || U(e.data)) && (e.visibility === void 0 || e.visibility === "story" || e.visibility === "scene" || e.visibility === "public") && (e.mode === void 0 || e.mode === "apply-now" || e.mode === "persist-only");
}
function il(e) {
	return !T(e) || !G(e, [
		"trackOn",
		"endOn",
		"stateScope",
		"initCaptureStateRef",
		"trackCommandRef",
		"endEmit",
		"endCaptureRef"
	]) ? !1 : (e.trackOn === void 0 || W(e.trackOn)) && (e.endOn === void 0 || W(e.endOn)) && (e.stateScope === void 0 || e.stateScope === "scene" || e.stateScope === "story") && ul(e.initCaptureStateRef) && ul(e.trackCommandRef) && (e.endEmit === void 0 || rl(e.endEmit)) && ul(e.endCaptureRef);
}
function al(e) {
	return Array.isArray(e) && e.every((e) => !T(e) || !G(e, [
		"on",
		"active",
		"reset",
		"transform",
		"emit",
		"straps"
	]) ? !1 : typeof e.on == "string" && (e.active === void 0 || typeof e.active == "boolean") && (e.reset === void 0 || typeof e.reset == "boolean") && (e.transform === void 0 || Array.isArray(e.transform) && e.transform.every(ll)) && (e.emit === void 0 || Array.isArray(e.emit) && e.emit.every(U)) && (e.straps === void 0 || W(e.straps)));
}
function ol(e) {
	return !T(e) || !G(e, ["entries"]) || !Array.isArray(e.entries) ? !1 : e.entries.every((e) => !T(e) || !G(e, [
		"url",
		"type",
		"policy"
	]) || !T(e.policy) ? !1 : typeof e.url == "string" && typeof e.type == "string" && G(e.policy, [
		"cache",
		"version",
		"hash",
		"priority"
	]) && (e.policy.cache === "default" || e.policy.cache === "no-store" || e.policy.cache === "immutable") && (e.policy.version === void 0 || typeof e.policy.version == "string") && (e.policy.hash === void 0 || typeof e.policy.hash == "string") && (e.policy.priority === void 0 || e.policy.priority === "high" || e.policy.priority === "normal" || e.policy.priority === "low"));
}
function sl(e) {
	return !T(e) || !G(e, [
		"components",
		"services",
		"modules",
		"resources",
		"libraries"
	]) ? !1 : W(e.components) && W(e.services) && W(e.modules) && W(e.resources) && (e.libraries === void 0 || W(e.libraries));
}
function cl(e) {
	return e === null || typeof e == "string" || typeof e == "boolean" ? !0 : typeof e == "number" ? Number.isFinite(e) : Array.isArray(e) ? e.every(cl) : U(e) || ll(e);
}
function U(e) {
	return T(e) && Object.values(e).every(cl);
}
function ll(e) {
	return T(e) && G(e, ["ref"]) && typeof e.ref == "string" && e.ref.length > 0;
}
function ul(e) {
	return e === void 0 || ll(e);
}
function dl(e) {
	return e === void 0 || W(e) || T(e) && Object.values(e).every(ll);
}
function W(e) {
	return Array.isArray(e) && e.every((e) => typeof e == "string");
}
function fl(e, t) {
	return T(e) && Object.values(e).every(t);
}
function G(e, t) {
	return Object.keys(e).every((e) => t.includes(e));
}
function pl(e) {
	if (!(typeof e != "object" || !e || Object.isFrozen(e))) {
		for (let t of Object.values(e)) pl(t);
		Object.freeze(e);
	}
}
//#endregion
//#region ../codplay/src/runtime/player/pipeline/style-timing.ts
function ml(e) {
	if (!T(e) || !("to" in e)) return;
	let t = hl(e.loop) ? e.loop : void 0, n = e.alternate === !0, r = er({
		from: 0,
		to: 1,
		duration: typeof e.duration == "number" ? e.duration : void 0,
		delay: typeof e.delay == "number" ? e.delay : void 0,
		...t === void 0 ? {} : { loop: t },
		alternate: n,
		ease: typeof e.ease == "string" ? e.ease : void 0
	});
	return Object.freeze({
		duration: r.duration,
		delay: r.delay,
		ease: typeof e.ease == "string" ? e.ease : "out(2)",
		totalDuration: r.totalDuration,
		...t === void 0 ? {} : { loop: t },
		...n ? { alternate: !0 } : {}
	});
}
function hl(e) {
	return typeof e == "boolean" || e === Infinity || typeof e == "number" && Number.isFinite(e) && e >= 0;
}
//#endregion
//#region ../codplay/src/runtime/player/pipeline/resolve.ts
function gl(e, t = {}) {
	let n = {};
	for (let r of Object.values(e.persos)) n[r.key] = {
		key: r.key,
		storyId: r.storyId,
		persoId: r.persoId,
		type: r.type,
		state: yl(r, t),
		actions: r.actions,
		...vl(r)
	};
	return {
		scene: e.scene,
		timeMs: e.timeMs,
		sceneState: e.sceneState,
		storyStates: e.storyStates,
		moveOccurrences: e.moveOccurrences,
		persos: n
	};
}
function _l(e, t, n, r = {}) {
	let i = Xa(t, n);
	if (i === null) return;
	if (Ua(i)) throw Error("Live capture actions cannot target an ActionSequence.");
	let a = D(e);
	return bl(a, i, 0, r), a;
}
function vl(e) {
	let t = da(e.initial.move, e.actions);
	return {
		placement: t.placement,
		moveIssues: t.issues
	};
}
function yl(e, t) {
	let n = D(e.initial);
	for (let r of e.actions) bl(n, r.action, r.elapsedMs, t);
	return n;
}
function bl(e, t, n, r) {
	if (Ga(t)) {
		let i = Sl(t, n, r);
		if (i === void 0) return;
		xl(e, i, n);
		return;
	}
	xl(e, t, n);
}
function xl(e, t, n) {
	for (let [n, r] of Object.entries(t)) if (!(n === "className" || n === "style")) {
		if (n === "attr" || n === "move") {
			e[n] = Ce(r);
			continue;
		}
		if (T(r) && T(e[n])) {
			e[n] = {
				...e[n],
				...D(r)
			};
			continue;
		}
		e[n] = Ce(r);
	}
	if (T(t.className) && (e.className = jl(e.className, t.className)), !T(t.style)) return;
	let r = T(e.style) ? { ...e.style } : {};
	for (let [e, i] of Object.entries(t.style)) r[e] = wl(e, r[e], i, n);
	e.style = r;
}
function Sl(e, t, n) {
	if (!Ga(e)) return;
	let r = n[e.fn.ref];
	if (r === void 0) throw Error(`TweenAction function is not available: ${e.fn.ref}`);
	let i = Cl(t / e.duration, 0, 1), a = gn(typeof e.ease == "string" ? e.ease : "linear")(i), o;
	try {
		o = r({
			progress: a,
			data: e
		});
	} catch (t) {
		throw Error(`TweenAction function failed: ${e.fn.ref}: ${t instanceof Error ? t.message : "unknown error"}`);
	}
	if (o !== void 0) {
		if (!T(o)) throw Error(`TweenAction function must return a record or undefined: ${e.fn.ref}`);
		return o;
	}
}
function Cl(e, t, n) {
	return Math.min(n, Math.max(t, e));
}
function wl(e, t, n, r) {
	if (El(n, t)) return Tl(e, t, n, r);
	let i = Ol(e);
	if (i !== void 0) return Dl(i, t, n, r);
	if (!T(n) || !("to" in n)) return n;
	let a = n.to;
	if (!kl(a)) throw Error("Resolve only supports scalar or color style tweens.");
	let o = n.from ?? t;
	if (!kl(o)) throw Error("Resolve requires an explicit or materialized tween from.");
	let s = ml(n);
	if (s === void 0) throw Error("Resolve requires a style tween declaration.");
	return nr(er({
		from: o,
		to: a,
		...s
	}), r);
}
function Tl(e, t, n, r) {
	let i = n.to;
	if (!ko(i)) throw Error(`RUNTIME_STYLE_LENGTH_INCOMPATIBLE: property ${e} mixes a cqw length with a CSS value.`);
	let a = n.from ?? t;
	if (!ko(a)) throw Error(`RUNTIME_STYLE_LENGTH_INCOMPATIBLE: property ${e} mixes a cqw length with a CSS value.`);
	if (a.unit !== i.unit) throw Error(`RUNTIME_STYLE_LENGTH_INCOMPATIBLE: property ${e} uses incompatible length units.`);
	let o = ml(n);
	if (o === void 0) throw Error("Resolve requires a style tween declaration.");
	let s = nr(er({
		from: `${a.value}${a.unit}`,
		to: `${i.value}${i.unit}`,
		...o
	}), r), c = typeof s == "number" ? s : Number.parseFloat(String(s));
	if (!Number.isFinite(c)) throw Error(`RUNTIME_STYLE_LENGTH_INCOMPATIBLE: property ${e} produced an invalid cqw value.`);
	return {
		kind: "length",
		unit: i.unit,
		value: c
	};
}
function El(e, t) {
	return !T(e) || !("to" in e) ? !1 : ko(e.to) || ko(e.from) || ko(t);
}
function Dl(e, t, n, r) {
	if (!T(n) || !("to" in n)) return n;
	if (!Ml(n.to)) throw Error(`Transform channel ${e} requires a scalar target.`);
	let i = n.from === void 0 ? Ml(t) ? t : void 0 : Ml(n.from) ? n.from : void 0;
	if (n.from !== void 0 && i === void 0) throw Error(`Transform channel ${e} requires a scalar from value.`);
	let a = ml(n);
	if (a === void 0) throw Error("Resolve requires a transform tween declaration.");
	return nr(fr({
		property: e,
		from: i,
		to: n.to,
		...a
	}), r);
}
function Ol(e) {
	let t = cr(e);
	return t !== void 0 && lr(t) ? t : void 0;
}
function kl(e) {
	return Ml(e) || Al(e);
}
function Al(e) {
	if (!T(e)) return !1;
	let t = e;
	return t.kind === "color" && (t.space === "srgb" || t.space === "oklch") && Array.isArray(t.coords) && t.coords.every((e) => typeof e == "number") && typeof t.alpha == "number";
}
function jl(e, t) {
	let n = new Set(typeof e == "string" ? e.split(/\s+/).filter(Boolean) : []);
	if (typeof t.remove == "string") for (let e of t.remove.split(/\s+/).filter(Boolean)) n.delete(e);
	if (typeof t.add == "string") for (let e of t.add.split(/\s+/).filter(Boolean)) n.add(e);
	return [...n].join(" ");
}
function Ml(e) {
	return typeof e == "string" || typeof e == "number";
}
//#endregion
//#region ../codplay/src/runtime/player/pipeline/snapshot.ts
function Nl(e, t) {
	if (t === void 0 || t.timeMs !== e.timeMs) return e;
	let n = new Map(t.patches.map((e) => [`${e.storyId}\u0000${e.persoId}`, e])), r = {};
	for (let t of Object.values(e.persos)) {
		let e = n.get(`${t.storyId}\u0000${t.persoId}`);
		if (e === void 0) {
			r[t.key] = t;
			continue;
		}
		let i = D(t.state), a = T(i.style) ? D(i.style) : {};
		r[t.key] = {
			...t,
			state: {
				...i,
				style: {
					...a,
					...D(e.state.style)
				}
			}
		};
	}
	return {
		...e,
		persos: r
	};
}
//#endregion
//#region ../codplay/src/runtime/player/pipeline/mount-targets.ts
var Pl = class e {
	targets = /* @__PURE__ */ new Map();
	static fromScene(t, n = []) {
		let r = new e();
		for (let e of Object.values(t.scene.stories)) for (let t of e.persos) r.register({
			id: t.id,
			kind: Ki,
			storyId: e.id
		});
		for (let e of n) r.register(e);
		return r;
	}
	register(e) {
		if (e.id.length === 0) throw Error("Mount target ID must not be empty.");
		if (this.targets.has(e.id)) throw Error(`Mount target ID is duplicated: ${e.id}`);
		this.targets.set(e.id, { ...e });
	}
	resolve(e) {
		return this.targets.get(e);
	}
	resolveStoryRoot(e) {
		let t = [...this.targets.values()].filter((t) => t.kind === "root" && t.storyId === e);
		if (t.length > 1) throw Error(`Story root target is duplicated: ${e}`);
		return t[0];
	}
	getAll() {
		return [...this.targets.values()];
	}
};
//#endregion
//#region ../codplay/src/runtime/player/pipeline/presentation-graph.ts
function Fl(e, t) {
	let n = {}, r = {}, i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map(), o = [];
	for (let t of Object.values(e)) {
		let s = t.placement, c = Rl(t, e);
		if (n[t.key] = c, r[t.key] = s.targetId, !s.mounted) continue;
		if (s.targetId === void 0 || s.target === void 0) throw Error(`Mounted perso has no resolved target: ${t.key}`);
		if (s.target.id !== s.targetId) throw Error(`Solved target identity diverges from placement: ${t.key}`);
		if (c !== void 0 && t.placement.target?.kind === "perso" && (e[c] === void 0 || e[c]?.placement.mounted !== !0)) throw Error(`Mounted perso parent is missing from the solved graph: ${t.key} -> ${c}`);
		let l = c !== void 0 && e[c]?.placement.mounted === !0 ? c : void 0;
		n[t.key] = l, r[t.key] = s.targetId;
		let u = i.get(s.targetId) ?? [];
		if (u.push(t.key), i.set(s.targetId, u), l === void 0) o.push(t.key);
		else {
			let e = a.get(l) ?? [];
			e.push(t.key), a.set(l, e);
		}
	}
	zl(n);
	let s = Il(Object.fromEntries([...i.entries()].map(([e, t]) => [e, Object.freeze([...t])])), t), c = Object.fromEntries([...a.entries()].map(([e, t]) => [e, Object.freeze([...t])])), l = Bl(n, r, s, c);
	return Object.freeze({
		revision: l,
		parentByPerso: Object.freeze(n),
		targetByPerso: Object.freeze(r),
		childrenByTarget: Object.freeze(s),
		childrenByParent: Object.freeze(c),
		rootPersoKeys: Object.freeze([...o])
	});
}
function Il(e, t) {
	if (t === void 0) return Object.freeze({ ...e });
	let n = {};
	for (let [r, i] of Object.entries(e)) {
		let e = t[r] ?? i, a = new Set(i), o = /* @__PURE__ */ new Set();
		for (let t of e) {
			if (!a.has(t)) throw Error(`Structural order places ${t} outside target: ${r}`);
			if (o.has(t)) throw Error(`Structural order duplicates item: ${t}`);
			o.add(t);
		}
		if (o.size !== a.size) throw Error(`Structural order is incomplete for target: ${r}`);
		n[r] = Object.freeze([...e]);
	}
	for (let n of Object.keys(t)) if (!Object.prototype.hasOwnProperty.call(e, n) && (t[n]?.length ?? 0) > 0) throw Error(`Structural order references an empty target: ${n}`);
	return Object.freeze(n);
}
function Ll(e, t) {
	let n = { ...e.graph.childrenByTarget };
	if (t === void 0) return n;
	for (let [r, i] of Object.entries(t)) {
		let t = /* @__PURE__ */ new Set();
		for (let n of i) {
			if (t.has(n)) throw Error(`Presentation order contains a duplicate child: ${n}`);
			t.add(n);
			let i = e.persos[n];
			if (i === void 0 || i.placement.mounted !== !0) throw Error(`Presentation order references an unmounted child: ${n}`);
			if (e.graph.targetByPerso[n] !== r) throw Error(`Presentation order places ${n} outside its solved target: ${r}`);
		}
		let a = e.graph.childrenByTarget[r] ?? [];
		if (a.length !== i.length || a.some((e) => !t.has(e))) throw Error(`Presentation order is incomplete for target: ${r}`);
		n[r] = Object.freeze([...i]);
	}
	return Object.freeze(n);
}
function Rl(e, t) {
	if (e.placement.target?.kind === "perso") return e.placement.parentKey;
	if (e.placement.target?.kind === "outlet" || e.placement.target?.kind === "anchor") {
		let n = e.placement.target.ownerId;
		return n === void 0 ? void 0 : t[n] === void 0 ? Object.values(t).find((e) => e.persoId === n)?.key : n;
	}
}
function zl(e) {
	let t = /* @__PURE__ */ new Set();
	for (let n of Object.keys(e)) {
		let r = /* @__PURE__ */ new Set(), i = n;
		for (; i !== void 0;) {
			if (r.has(i)) throw Error(`Solved graph parent cycle detected: ${i}`);
			if (t.has(i)) break;
			r.add(i), i = e[i];
		}
		for (let e of r) t.add(e);
	}
}
function Bl(e, t, n, r) {
	return JSON.stringify({
		parentByPerso: Object.entries(e),
		targetByPerso: Object.entries(t),
		childrenByTarget: Object.entries(n),
		childrenByParent: Object.entries(r)
	});
}
//#endregion
//#region ../codplay/src/runtime/player/pipeline/solve.ts
function Vl(e, t = {}) {
	let n = Pl.fromScene(e.scene, t.mountTargets), r = {}, i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
	for (let t of Object.values(e.persos)) i.set(t.persoId, t.key);
	for (let t of Object.values(e.persos)) a.set(t.key, t.key);
	for (let t of Object.values(e.persos)) {
		let e = Hl(t, n, i, a);
		r[t.key] = {
			...t,
			placement: e
		};
	}
	Wl(r);
	let o = Ul(r), s = Fl(o, t.childrenByTarget);
	return {
		scene: e.scene,
		timeMs: e.timeMs,
		sceneState: e.sceneState,
		storyStates: e.storyStates,
		persos: o,
		graph: s,
		moveIssues: Object.values(o).flatMap((e) => e.moveIssues),
		moveOccurrences: e.moveOccurrences
	};
}
function Hl(e, t, n, r) {
	switch (e.placement.kind) {
		case oa: {
			let n = t.resolveStoryRoot(e.storyId);
			return {
				kind: oa,
				mounted: n !== void 0,
				targetId: n?.id,
				target: n,
				mode: e.placement.mode,
				reparent: e.placement.reparent,
				source: e.placement.source
			};
		}
		case "off": return {
			kind: "off",
			mounted: !1,
			mode: e.placement.mode,
			reparent: e.placement.reparent,
			source: e.placement.source
		};
		case sa: {
			let i = t.resolve(e.placement.targetId);
			return {
				kind: sa,
				mounted: i !== void 0,
				targetId: e.placement.targetId,
				target: i,
				parentKey: i === void 0 ? void 0 : i.kind === "perso" ? n.get(i.id) : i.kind === "outlet" || i.kind === "anchor" ? r.get(i.ownerId ?? "") ?? n.get(i.ownerId ?? "") : void 0,
				mode: e.placement.mode,
				reparent: e.placement.reparent,
				reorder: e.placement.reorder,
				source: e.placement.source
			};
		}
		case ca: return {
			kind: ca,
			mounted: !1,
			source: e.placement.source
		};
		case aa: return {
			kind: aa,
			mounted: !1,
			source: e.placement.source
		};
	}
}
function Ul(e) {
	let t = /* @__PURE__ */ new Map(), n = (r, i = /* @__PURE__ */ new Set()) => {
		let a = t.get(r);
		if (a !== void 0) return a;
		if (i.has(r)) throw Error(`Mount hierarchy cycle detected at: ${r}`);
		i.add(r);
		let o = e[r], s = o !== void 0 && o.placement.mounted && (o.placement.parentKey === void 0 || n(o.placement.parentKey, i));
		return i.delete(r), t.set(r, s), s;
	};
	return Object.fromEntries(Object.values(e).map((e) => [e.key, {
		...e,
		placement: {
			...e.placement,
			mounted: n(e.key)
		}
	}]));
}
function Wl(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
	for (let t of Object.values(e)) r(t.key);
	function r(i) {
		if (n.has(i)) return;
		if (t.has(i)) throw Error(`Mount hierarchy cycle detected at: ${i}`);
		t.add(i);
		let a = e[i]?.placement.parentKey;
		a !== void 0 && r(a), t.delete(i), n.add(i);
	}
}
var Gl = "runtime:state:update", Kl = class {
	scene;
	registry;
	activeTrackIds;
	eventsByTrack = /* @__PURE__ */ new Map();
	isolatedStoryIds;
	activationPeriodsByStory = /* @__PURE__ */ new Map();
	currentIsolation;
	eventIds = /* @__PURE__ */ new Set();
	nextEventSeq = 0;
	nextActivationId = 0;
	nextGeneratedEventId = 0;
	revision = 0;
	constructor(e) {
		this.scene = e, this.registry = to(e), this.activeTrackIds = new Map(Object.values(this.registry.tracks).map((e) => [e.id, e.active])), this.isolatedStoryIds = new Set(Object.values(e.scene.stories).filter((e) => e.listen.some((e) => e.active !== void 0)).map((e) => e.id));
	}
	isTrackActive(e) {
		return this.activeTrackIds.get(e) === !0;
	}
	reset() {
		for (let e of Object.values(this.registry.tracks)) this.activeTrackIds.set(e.id, e.active);
		this.eventsByTrack.clear(), this.activationPeriodsByStory.clear(), this.currentIsolation = void 0, this.eventIds.clear(), this.nextEventSeq = 0, this.nextActivationId = 0, this.nextGeneratedEventId = 0, this.revision += 1;
	}
	appendLiveEvent(e) {
		if (!this.registry.tracks[e.trackId]) return {
			ok: !1,
			code: "RUNTIME_TRACK_UNKNOWN",
			message: `Track is not declared: ${e.trackId}`
		};
		if (this.eventIds.has(e.eventId)) return {
			ok: !1,
			code: "RUNTIME_EVENT_DUPLICATE",
			message: `Event is already appended: ${e.eventId}`
		};
		if (!Number.isFinite(e.applyAtMs)) return {
			ok: !1,
			code: "RUNTIME_EVENT_TIME_INVALID",
			message: "Runtime event time must be finite."
		};
		if (e.storyIsolation !== void 0 && (e.storyId === void 0 || !this.isolatedStoryIds.has(e.storyId))) return {
			ok: !1,
			code: "RUNTIME_STORY_ISOLATION_TARGET_INVALID",
			message: "Story isolation transitions require an isolated declared story target."
		};
		e.storyId !== void 0 && this.isStoryIsolationEnabled(e.storyId) && this.reconcileStoryIsolationAt(e.applyAtMs);
		let t = this.nextEventSeq, n = this.applyStoryIsolationTransition(e.storyId, e.storyIsolation, e.applyAtMs, t), { storyIsolation: r, ...i } = e, a = {
			...i,
			eventSeq: t,
			...n === void 0 ? {} : { activationId: n }
		};
		this.nextEventSeq += 1, this.eventIds.add(e.eventId);
		let o = this.eventsByTrack.get(e.trackId) ?? [];
		return o.push(a), o.sort((e, t) => e.applyAtMs - t.applyAtMs || e.eventSeq - t.eventSeq), this.eventsByTrack.set(e.trackId, o), this.revision += 1, {
			ok: !0,
			data: a
		};
	}
	appendAnchoredEventimes(e) {
		if (!this.registry.tracks[e.trackId]) return {
			ok: !1,
			code: "RUNTIME_TRACK_UNKNOWN",
			message: `Track is not declared: ${e.trackId}`
		};
		if (!Number.isFinite(e.anchorMs)) return {
			ok: !1,
			code: "RUNTIME_EVENT_ANCHOR_INVALID",
			message: "Eventime anchor must be finite."
		};
		let t = Xl(e.eventimes, e.anchorMs), n = [];
		for (let r of t) {
			let t = this.appendLiveEvent({
				eventId: this.createGeneratedEventId(e.trackId, e.storyId),
				trackId: e.trackId,
				storyId: e.storyId,
				name: r.name,
				applyAtMs: r.applyAtMs,
				data: r.data,
				cascade: e.cascade,
				context: e.context,
				meta: e.meta,
				mode: e.mode,
				visibility: r.visibility
			});
			if (!t.ok) return t;
			n.push(t.data);
		}
		return {
			ok: !0,
			data: {
				appendedCount: n.length,
				events: n
			}
		};
	}
	appendStrapOutput(e) {
		if (e.scope === "story" && e.storyId === void 0) return {
			ok: !1,
			code: "RUNTIME_STRAP_STORY_ID_MISSING",
			message: "Story strap output requires storyId."
		};
		if (!Number.isFinite(e.anchorMs)) return {
			ok: !1,
			code: "RUNTIME_EVENT_ANCHOR_INVALID",
			message: "Strap output anchor must be finite."
		};
		let t = ro(e.scope === "story" ? e.storyId : void 0, e.strapName);
		if (!this.registry.tracks[t]) return {
			ok: !1,
			code: "RUNTIME_STRAP_TRACK_UNKNOWN",
			message: `Strap track is not declared: ${t}`
		};
		for (let t of e.output.planned) if (!Number.isFinite(t.offsetMs) || t.offsetMs < 0) return {
			ok: !1,
			code: "RUNTIME_STRAP_OFFSET_INVALID",
			message: "Planned strap offset must be finite and non-negative."
		};
		let n = [], r = [], i = [], a = e.storyId;
		for (let o of e.output.events) {
			let s = o.storyId ?? a, c = this.resolveStoryIsolationAction(s, o.name), l = this.currentIsolation?.storyId, u = this.appendStrapEvent(o, t, a, e.scope === I, e.anchorMs, e.mode, c);
			if (!u.ok) return u;
			n.push(u.data), r.push(u.data), c !== void 0 && l !== void 0 && (c === "activate" || l === s) && i.push(l);
		}
		for (let r of e.output.updates) {
			let i = this.appendStateUpdate(r, t, e.scope, e.storyId, e.anchorMs, e.mode);
			if (!i.ok) return i;
			n.push(i.data);
		}
		for (let r of e.output.planned) {
			if (r.step.event !== void 0) {
				let i = this.appendStrapEvent(r.step.event, t, a, e.scope === I, e.anchorMs + r.offsetMs, e.mode);
				if (!i.ok) return i;
				n.push(i.data);
			}
			if (r.step.update !== void 0) {
				let i = this.appendStateUpdate(r.step.update, t, e.scope, e.storyId, e.anchorMs + r.offsetMs, e.mode);
				if (!i.ok) return i;
				n.push(i.data);
			}
		}
		return {
			ok: !0,
			data: {
				trackId: t,
				events: n,
				immediateEvents: r,
				isolationClosedStoryIds: Object.freeze([...new Set(i)]),
				materializedUpdateCount: e.output.updates.length + e.output.planned.filter((e) => e.step.update !== void 0).length
			}
		};
	}
	applyControlEvent(e, t) {
		let n = Zl(t);
		if (n === null) return {
			ok: !1,
			code: "RUNTIME_TRACK_CONTROL_INVALID",
			message: "Track control requires data.trackIds."
		};
		if (e === "track:activate") return this.setTrackActivity(n, !0);
		if (e === "track:deactivate") return this.setTrackActivity(n, !1);
		if (e === "track:toggle") {
			let e = [], t = [], r = [];
			for (let i of n) {
				let n = this.activeTrackIds.get(i);
				n === void 0 ? r.push(i) : n ? (this.activeTrackIds.set(i, !1), t.push(i)) : (this.activeTrackIds.set(i, !0), e.push(i));
			}
			return (e.length > 0 || t.length > 0) && (this.revision += 1), {
				ok: !0,
				data: {
					activated: e,
					deactivated: t,
					ignored: r
				}
			};
		}
		return {
			ok: !1,
			code: "RUNTIME_TRACK_CONTROL_UNKNOWN",
			message: `Unknown track control: ${e}`
		};
	}
	getEvents(e) {
		return this.eventsByTrack.get(e) ?? [];
	}
	getEventsForStory(e, t, n = !0) {
		return this.getAllEvents().filter((r) => r.storyId === e && (t === void 0 ? this.isStoryEventEligible(e, r) : this.isStoryEventEligibleAt(e, r, t, n)) || r.cascade === !0 || r.trackId === "global");
	}
	isStoryIsolationEnabled(e) {
		return this.isolatedStoryIds.has(e);
	}
	isStoryIsolationActive(e) {
		return this.currentIsolation?.storyId === e;
	}
	getActiveStoryIsolationStoryId() {
		return this.currentIsolation?.storyId;
	}
	reconcileStoryIsolationAt(e) {
		if (!Number.isFinite(e)) return;
		let t;
		for (let n of this.activationPeriodsByStory.values()) for (let r of n) r.openedAt.applyAtMs > e || r.closedAt !== void 0 && r.closedAt.applyAtMs <= e || (t === void 0 || ql(r.openedAt, t.openedAt) > 0) && (t = r);
		this.currentIsolation = t;
	}
	isStoryEventEligible(e, t) {
		if (t.storyId !== e || !this.isStoryIsolationEnabled(e)) return !0;
		if (t.activationId === void 0) return !1;
		let n = this.activationPeriodsByStory.get(e)?.find((e) => e.activationId === t.activationId);
		if (n === void 0) return !1;
		let r = {
			applyAtMs: t.applyAtMs,
			eventSeq: t.eventSeq
		};
		return ql(r, n.openedAt) >= 0 && (n.closedAt === void 0 || ql(r, n.closedAt) <= 0);
	}
	isStoryEventEligibleAt(e, t, n, r = !0) {
		if (!this.isStoryEventEligible(e, t)) return !1;
		if (t.storyId !== e || !this.isStoryIsolationEnabled(e)) return !0;
		let i = this.findStoryActivationPeriod(e, t.activationId);
		return i === void 0 || i.openedAt.applyAtMs > n ? !1 : i.closedAt === void 0 || i.closedAt.applyAtMs > n ? !0 : i.closedAt.applyAtMs < n ? !1 : !r;
	}
	isStoryResetEvent(e, t) {
		return (t.storyId === e || t.storyId === void 0 && t.visibility === "scene") && (t.storyId !== e || this.isStoryEventEligible(e, t)) && Jl(this.scene.scene.stories[e]?.listen ?? [], t);
	}
	getLatestStoryReset(e, t, n = !0, r = !0) {
		return this.getStoryResetBoundaries(e, r, t, n).filter((e) => e.applyAtMs < t || n && e.applyAtMs === t).at(-1);
	}
	getStoryResetBoundaries(e, t = !0, n, r = !0) {
		let i = this.scene.scene.stories[e];
		return i === void 0 || !i.listen.some((e) => e.reset === !0) ? [] : this.getAllEvents().filter((t) => this.isStoryResetEvent(e, t)).filter((e) => t || e.mode !== "persist-only").filter((e) => this.isTrackActive(e.trackId)).filter((t) => n === void 0 || this.isStoryEventEligibleAt(e, t, n, r)).sort((e, t) => e.applyAtMs - t.applyAtMs || e.eventSeq - t.eventSeq).map((e) => ({
			applyAtMs: e.applyAtMs,
			eventSeq: e.eventSeq
		}));
	}
	getAllEvents() {
		return [...this.eventsByTrack.values()].flatMap((e) => e);
	}
	getRevision() {
		return this.revision;
	}
	getEventTimes() {
		return [...new Set(this.getAllEvents().filter((e) => e.storyId === void 0 || this.isStoryEventEligible(e.storyId, e)).map((e) => e.applyAtMs))].sort((e, t) => e - t);
	}
	getStateUpdates(e, t, n, r = !0, i = !0) {
		let a = e === "story" && t !== void 0 ? this.getLatestStoryReset(t, n, r, i) : void 0;
		return this.getAllEvents().filter((a) => a.update !== void 0 && a.stateScope === e && (i || a.mode !== "persist-only") && this.isTrackActive(a.trackId) && (e !== "story" || t === void 0 || this.isStoryEventEligibleAt(t, a, n, r)) && (a.applyAtMs < n || r && a.applyAtMs === n) && (e !== "story" || a.storyId === t)).filter((e) => a === void 0 || Yl(e, a)).sort((e, t) => e.applyAtMs - t.applyAtMs || e.eventSeq - t.eventSeq);
	}
	setTrackActivity(e, t) {
		let n = [], r = [];
		for (let i of e) {
			if (!this.activeTrackIds.has(i)) {
				r.push(i);
				continue;
			}
			this.activeTrackIds.set(i, t), n.push(i);
		}
		return n.length > 0 && (this.revision += 1), {
			ok: !0,
			data: t ? {
				activated: n,
				deactivated: [],
				ignored: r
			} : {
				activated: [],
				deactivated: n,
				ignored: r
			}
		};
	}
	applyStoryIsolationTransition(e, t, n, r) {
		if (e === void 0 || !this.isStoryIsolationEnabled(e)) return;
		let i = {
			applyAtMs: n,
			eventSeq: r
		};
		if (t === "activate") {
			this.closeCurrentIsolation(i);
			let t = {
				storyId: e,
				activationId: this.createActivationId(e),
				openedAt: i
			}, n = this.activationPeriodsByStory.get(e) ?? [];
			return n.push(t), this.activationPeriodsByStory.set(e, n), this.currentIsolation = t, t.activationId;
		}
		let a = this.currentIsolation;
		return t === "deactivate" ? a?.storyId === e ? (a.closedAt = i, this.currentIsolation = void 0, a.activationId) : void 0 : this.currentIsolation?.storyId === e ? this.currentIsolation.activationId : void 0;
	}
	closeCurrentIsolation(e) {
		this.currentIsolation !== void 0 && (this.currentIsolation.closedAt = e, this.currentIsolation = void 0);
	}
	createActivationId(e) {
		let t = this.nextActivationId;
		return this.nextActivationId += 1, `story-isolation:${e}:${t}`;
	}
	findStoryActivationPeriod(e, t) {
		if (t !== void 0) return this.activationPeriodsByStory.get(e)?.find((e) => e.activationId === t);
	}
	createGeneratedEventId(e, t) {
		let n = this.nextGeneratedEventId;
		return this.nextGeneratedEventId += 1, `runtime-event:${e}:${t ?? "scene"}:${n}`;
	}
	appendStrapEvent(e, t, n, r, i, a, o) {
		return this.appendLiveEvent({
			eventId: this.createGeneratedEventId(t, n ?? "scene"),
			trackId: t,
			storyId: e.storyId ?? n,
			name: e.name,
			applyAtMs: i,
			data: e.data,
			cascade: e.cascade ?? (e.storyId === void 0 ? r : !1),
			visibility: e.visibility,
			mode: a,
			storyIsolation: o
		});
	}
	resolveStoryIsolationAction(e, t) {
		if (e === void 0 || !this.isStoryIsolationEnabled(e)) return;
		let n = this.scene.scene.stories[e]?.listen ?? [];
		if (n.some((e) => e.on === t && e.active === !0)) return "activate";
		if (n.some((e) => e.on === t && e.active === !1)) return "deactivate";
	}
	appendStateUpdate(e, t, n, r, i, a) {
		return this.appendLiveEvent({
			eventId: this.createGeneratedEventId(t, r ?? n),
			trackId: t,
			storyId: n === "story" ? r : void 0,
			name: Gl,
			applyAtMs: i,
			update: e,
			stateScope: n,
			mode: a
		});
	}
};
function ql(e, t) {
	return e.applyAtMs - t.applyAtMs || e.eventSeq - t.eventSeq;
}
function Jl(e, t) {
	return e.some((e) => e.reset === !0 && e.on === t.name);
}
function Yl(e, t) {
	return e.applyAtMs > t.applyAtMs || e.applyAtMs === t.applyAtMs && e.eventSeq > t.eventSeq;
}
function Xl(e, t) {
	return e.flatMap((e) => {
		let n = t + e.startAt;
		return [{
			name: e.name,
			applyAtMs: n,
			data: e.data,
			visibility: e.visibility
		}, ...Xl(e.events ?? [], n)];
	});
}
function Zl(e) {
	return !T(e) || !Array.isArray(e.trackIds) ? null : e.trackIds.every((e) => typeof e == "string") ? e.trackIds : null;
}
var Ql = "persist-only";
//#endregion
//#region ../codplay/src/runtime/player/pipeline/planned-helpers.ts
function $l() {
	return {
		wait: (e, t) => eu(e, t, 0),
		delay: (e, t) => eu(e, t, 0),
		repeat: (e, t) => (tu(e.eachMs, "repeat eachMs"), nu(e.times), Array.from({ length: e.times }, (n, r) => eu(e.eachMs * r, t, r)).flat()),
		stagger: (e, t) => {
			tu(e.stepMs, "stagger stepMs");
			let n = e.count ?? (Array.isArray(t) ? t.length : 1);
			return nu(n), Array.from({ length: n }, (n, r) => {
				let i = Array.isArray(t) ? t[r] : t;
				return i === void 0 ? [] : eu(e.stepMs * r, i, r);
			}).flat();
		},
		sequence: (e) => {
			let t = 0, n = [];
			for (let r of e) {
				let e = r.startAt ?? t;
				tu(e, "sequence startAt"), n.push({
					offsetMs: e,
					step: r.step
				}), t = e + (r.durationMs ?? 0);
			}
			return n;
		}
	};
}
function eu(e, t, n) {
	tu(e, "planned offsetMs");
	let r = typeof t == "function" ? t({
		index: n,
		elapsedMs: e,
		currentTimeMs: e,
		startedAtMs: 0
	}) : t;
	return r === void 0 ? [] : (Array.isArray(r) ? r : [r]).map((t) => ({
		offsetMs: e,
		step: t
	}));
}
function tu(e, t) {
	if (!Number.isFinite(e) || e < 0) throw Error(`${t} must be finite and non-negative.`);
}
function nu(e) {
	if (!Number.isInteger(e) || e < 0) throw Error("planned count must be a finite non-negative integer.");
}
//#endregion
//#region ../codplay/src/runtime/player/pipeline/strap-executor.ts
async function ru(e, t, n) {
	let r = [], i = [], a = [], o = [], s = [], c = {
		...n.context ?? {},
		planned: $l()
	};
	for (let l of e) {
		let e = t[l];
		if (e === void 0) {
			s.push({
				code: "RUNTIME_STRAP_MISSING",
				message: `Strap is not available: ${l}`,
				strapName: l
			});
			continue;
		}
		try {
			iu(await e({
				...n,
				context: c,
				strapName: l
			}), r, i, a, o);
		} catch (e) {
			s.push({
				code: "RUNTIME_STRAP_FAILED",
				message: e instanceof Error ? e.message : `Strap failed: ${l}`,
				strapName: l
			});
		}
	}
	return {
		events: r,
		updates: i,
		planned: a,
		warnings: o,
		issues: s
	};
}
function iu(e, t, n, r, i) {
	if (e === void 0) return;
	if (Array.isArray(e)) {
		for (let a of e) iu(a, t, n, r, i);
		return;
	}
	let a = e;
	if (au(a)) {
		r.push(a);
		return;
	}
	Array.isArray(a.events) && t.push(...a.events), a.update !== void 0 && n.push(a.update), Array.isArray(a.warnings) && i.push(...a.warnings);
}
function au(e) {
	return typeof e == "object" && !!e && "offsetMs" in e && typeof e.offsetMs == "number" && "step" in e;
}
//#endregion
//#region ../codplay/src/runtime/player/pipeline/listen.ts
async function ou(e) {
	if (e.rules.length === 0) return {
		events: [e.event],
		straps: [],
		issues: []
	};
	let t = [], n = [], r = [], i = !1;
	for (let a of e.rules) {
		if (a.on !== e.event.name) continue;
		i = !0;
		let o = su(a, e.event, e.functions ?? {});
		r.push(...o.issues);
		let s = a.straps ?? [];
		if (s.length === 0) n.push({
			ruleName: a.on,
			strapNames: [],
			result: {
				events: [],
				updates: [],
				planned: [],
				warnings: [],
				issues: []
			}
		});
		else for (let t of s) {
			let r = await ru([t], e.straps ?? {}, {
				event: {
					name: e.event.name,
					data: e.event.data,
					eventId: e.event.eventId,
					eventSeq: e.event.eventSeq,
					applyAtMs: e.event.applyAtMs,
					cascade: e.event.cascade
				},
				state: e.state ?? {},
				meta: e.meta ?? {},
				context: e.context
			});
			n.push({
				ruleName: a.on,
				strapNames: [t],
				result: r
			});
		}
		t.push(...o.events), t.push(...cu(a, e.event));
	}
	return {
		events: i ? t : [],
		straps: n,
		issues: r
	};
}
function su(e, t, n) {
	let r = [], i = [];
	for (let a of e.transform ?? []) {
		let o = n[a.ref];
		if (o === void 0) {
			i.push({
				code: "RUNTIME_LISTEN_FUNCTION_MISSING",
				message: `Listen transform function is not available: ${a.ref}`,
				ruleName: e.on,
				functionRef: a.ref
			});
			continue;
		}
		let s;
		try {
			s = o({ ...t });
		} catch (t) {
			i.push({
				code: "RUNTIME_LISTEN_TRANSFORM_FAILED",
				message: t instanceof Error ? t.message : `Listen transform failed: ${a.ref}`,
				ruleName: e.on,
				functionRef: a.ref
			});
			continue;
		}
		if (s !== void 0) {
			if (!Array.isArray(s)) {
				i.push({
					code: "RUNTIME_LISTEN_TRANSFORM_INVALID",
					message: `Listen transform must return an array of events or undefined: ${a.ref}`,
					ruleName: e.on,
					functionRef: a.ref
				});
				continue;
			}
			for (let n = 0; n < s.length; n += 1) {
				let o = s[n];
				if (!T(o) || typeof o.name != "string" || o.name.trim().length === 0) {
					i.push({
						code: "RUNTIME_LISTEN_TRANSFORM_EVENT_INVALID",
						message: `Listen transform event at index ${n} must contain a non-empty name: ${a.ref}`,
						ruleName: e.on,
						functionRef: a.ref
					});
					continue;
				}
				if (o.data !== void 0 && !T(o.data)) {
					i.push({
						code: "RUNTIME_LISTEN_TRANSFORM_EVENT_INVALID",
						message: `Listen transform event data at index ${n} must be a record: ${a.ref}`,
						ruleName: e.on,
						functionRef: a.ref
					});
					continue;
				}
				r.push({
					...t,
					name: o.name,
					data: o.data,
					visibility: lu(o.visibility) ? o.visibility : t.visibility
				});
			}
		}
	}
	return {
		events: r,
		issues: i
	};
}
function cu(e, t) {
	return (e.emit ?? []).map((e) => ({
		...t,
		name: typeof e.name == "string" ? e.name : t.name,
		data: T(e.data) ? e.data : t.data,
		cascade: typeof e.cascade == "boolean" ? e.cascade : t.cascade,
		visibility: lu(e.visibility) ? e.visibility : t.visibility
	}));
}
function lu(e) {
	return e === "story" || e === "scene" || e === "public";
}
//#endregion
//#region ../codplay/src/runtime/player/pipeline/runtime-state-store.ts
var uu = class {
	sceneState;
	storyStates = /* @__PURE__ */ new Map();
	constructor(e) {
		this.sceneState = D(e.scene.state);
		for (let [t, n] of Object.entries(e.scene.stories)) this.storyStates.set(t, D(n.state));
	}
	snapshot(e, t) {
		if (e === "scene") return du(D(this.sceneState));
		if (t === void 0) throw Error("Story state snapshot requires storyId.");
		return du(D(this.storyStates.get(t)));
	}
	applyUpdate(e, t, n) {
		let r = this.getMutableTarget(e, n);
		for (let [e, n] of Object.entries(t)) r[e] = Ce(n);
		return this.snapshot(e, n);
	}
	replace(e, t, n) {
		let r = this.getMutableTarget(e, n);
		for (let e of Object.keys(r)) delete r[e];
		for (let [e, n] of Object.entries(t)) r[e] = Ce(n);
	}
	getMutableTarget(e, t) {
		if (e === "scene") return this.sceneState;
		if (t === void 0) throw Error("Story state update requires storyId.");
		let n = this.storyStates.get(t);
		if (n !== void 0) return n;
		let r = {};
		return this.storyStates.set(t, r), r;
	}
};
function du(e) {
	for (let t of Object.values(e)) Array.isArray(t) ? fu(t) : T(t) && du(t);
	return Object.freeze(e);
}
function fu(e) {
	for (let t of e) Array.isArray(t) ? fu(t) : T(t) && du(t);
	Object.freeze(e);
}
//#endregion
//#region ../codplay/src/runtime/player/pipeline/runtime-event-dispatcher.ts
var pu = class {
	scene;
	journal;
	strapCollections;
	functions;
	stateStore;
	maxCascadeDepth;
	eventIdFactory;
	storyRulesByEvent = /* @__PURE__ */ new Map();
	storyActivationRulesByEvent = /* @__PURE__ */ new Map();
	sceneRulesByEvent;
	nextGeneratedEventId = 0;
	constructor(e) {
		this.scene = e.scene, this.journal = e.journal, this.functions = e.functions ?? {};
		let t = e.strapCollections ?? {
			scene: {},
			stories: {}
		};
		this.strapCollections = {
			scene: $a(this.scene.scene.straps, t.scene, this.functions),
			stories: Object.fromEntries(Object.entries(this.scene.scene.stories).map(([e, n]) => [e, $a(n.straps, t.stories[e] ?? {}, this.functions)]))
		}, this.stateStore = e.stateStore, this.maxCascadeDepth = e.maxCascadeDepth ?? 32, this.eventIdFactory = e.eventIdFactory, this.sceneRulesByEvent = hu(this.scene.scene.listen);
		for (let [e, t] of Object.entries(this.scene.scene.stories)) {
			let n = hu(t.listen);
			this.storyRulesByEvent.set(e, n);
			let r = /* @__PURE__ */ new Map(), i = this.scene.storyActivationIndex?.[e];
			if (i !== void 0) for (let [e, n] of Object.entries(i)) {
				let i = t.listen[n];
				i?.active === !0 && r.set(e, i);
			}
			else for (let e of t.listen) e.active === !0 && !r.has(e.on) && r.set(e.on, e);
			for (let e of t.listen) e.active === !0 && !r.has(e.on) && r.set(e.on, e);
			this.storyActivationRulesByEvent.set(e, r);
		}
	}
	async dispatch(e, t) {
		let n = {
			ok: !0,
			events: [],
			straps: [],
			issues: [],
			resetStoryIds: [],
			isolationClosedStoryIds: []
		};
		return e.name.trim().length === 0 ? (n.ok = !1, n.issues.push({
			code: "RUNTIME_EVENT_NAME_INVALID",
			message: "Runtime event name must not be empty."
		}), n) : (t === void 0 ? await this.route(e, 0, n) : (n.events.push(t), await this.routeAppendedEvent(t, 0, n)), {
			...n,
			resetStoryIds: Object.freeze([...new Set(n.resetStoryIds)]),
			isolationClosedStoryIds: Object.freeze([...new Set(n.isolationClosedStoryIds)])
		});
	}
	async route(e, t, n) {
		if (t > this.maxCascadeDepth) {
			n.issues.push({
				code: "RUNTIME_EVENT_CASCADE_LIMIT",
				message: `Runtime event cascade exceeded the maximum depth of ${this.maxCascadeDepth}.`,
				eventName: e.name,
				depth: t
			});
			return;
		}
		let r = this.resolveTarget(e, n, t);
		if (r === void 0) return;
		let i = this.selectPipeline(e, r), a = this.resolveStoryIsolationAction(e, r, i);
		this.journal.reconcileStoryIsolationAt(e.applyAtMs);
		let o = this.journal.getActiveStoryIsolationStoryId(), s = this.journal.appendLiveEvent({
			eventId: e.eventId ?? this.createGeneratedEventId(),
			trackId: r.trackId,
			storyId: r.storyId,
			name: e.name,
			applyAtMs: e.applyAtMs,
			data: e.data,
			visibility: e.visibility,
			context: e.context,
			meta: e.meta,
			mode: e.mode,
			storyIsolation: a
		});
		if (!s.ok) {
			n.ok = !1, n.issues.push({
				code: s.code,
				message: s.message,
				eventName: e.name,
				depth: t
			});
			return;
		}
		n.events.push(s.data), a !== void 0 && o !== void 0 && (a === "activate" || o === r.storyId) && n.isolationClosedStoryIds.push(o), this.collectResetStoryIds(s.data, n), await this.processAppendedEvent(e, r, s.data, t, n, i);
	}
	async processAppendedEvent(e, t, n, r, i, a) {
		if (mu(e.name)) {
			let t = this.journal.applyControlEvent(e.name, e.data);
			t.ok || (i.ok = !1, i.issues.push({
				code: t.code,
				message: t.message,
				eventName: e.name,
				depth: r
			}));
		}
		let o = a ?? this.selectPipeline(e, t);
		if (o === void 0 || o.scope === "story" && o.storyId !== void 0 && !this.journal.isStoryEventEligible(o.storyId, n)) return;
		let s = {
			eventId: n.eventId,
			eventSeq: n.eventSeq,
			name: n.name,
			applyAtMs: n.applyAtMs,
			trackId: n.trackId,
			storyId: n.storyId,
			data: n.data,
			context: n.context,
			meta: n.meta,
			visibility: n.visibility
		}, c = await ou({
			rules: o.rules,
			event: s,
			functions: this.functions,
			straps: o.straps,
			state: this.readState(o.scope, o.storyId),
			meta: n.meta ?? e.meta,
			context: n.context ?? e.context
		});
		for (let t of c.issues) i.issues.push(this.toDispatchIssue(t, e.name, r));
		i.straps.push(...c.straps);
		for (let t of c.straps) {
			for (let n of t.result.issues) i.issues.push({
				...n,
				eventName: e.name,
				ruleName: t.ruleName,
				depth: r
			});
			for (let n of t.result.warnings) i.issues.push({
				code: "RUNTIME_STRAP_WARNING",
				message: n,
				eventName: e.name,
				ruleName: t.ruleName,
				depth: r
			});
			let n = t.strapNames[0];
			if (n === void 0) continue;
			let a = this.journal.appendStrapOutput({
				scope: o.scope === "story" ? Ba : I,
				storyId: o.storyId,
				strapName: n,
				anchorMs: e.applyAtMs,
				output: t.result,
				mode: e.mode
			});
			if (!a.ok) {
				i.ok = !1, i.issues.push({
					code: a.code,
					message: a.message,
					eventName: e.name,
					ruleName: t.ruleName,
					strapName: n,
					depth: r
				});
				continue;
			}
			i.events.push(...a.data.events), i.isolationClosedStoryIds.push(...a.data.isolationClosedStoryIds), this.applyImmediateStateUpdates(a.data.events, e.applyAtMs, e.mode !== Ql);
			for (let e of a.data.immediateEvents) await this.routeAppendedEvent(e, r + 1, i);
		}
		await this.routeDeclaredEmissions(o, c.events, e, r, i);
	}
	async routeAppendedEvent(e, t, n) {
		if (t > this.maxCascadeDepth) {
			n.issues.push({
				code: "RUNTIME_EVENT_CASCADE_LIMIT",
				message: `Runtime event cascade exceeded the maximum depth of ${this.maxCascadeDepth}.`,
				eventName: e.name,
				depth: t
			});
			return;
		}
		if (e.update !== void 0) return;
		let r = {
			name: e.name,
			applyAtMs: e.applyAtMs,
			eventId: e.eventId,
			trackId: e.trackId,
			storyId: e.storyId,
			data: e.data,
			visibility: e.visibility,
			context: e.context,
			meta: e.meta,
			mode: e.mode
		}, i = {
			trackId: e.trackId,
			storyId: e.visibility === "scene" || e.visibility === "public" ? void 0 : e.storyId,
			visibility: e.visibility
		}, a = this.selectPipeline(r, i);
		this.collectResetStoryIds(e, n), await this.processAppendedEvent(r, i, e, t, n, a);
	}
	collectResetStoryIds(e, t) {
		for (let n of Object.keys(this.scene.scene.stories)) this.journal.isStoryResetEvent(n, e) && t.resetStoryIds.push(n);
	}
	resolveTarget(e, t, n) {
		if (e.visibility !== void 0) {
			if (e.visibility === "story") {
				if (e.storyId === void 0) {
					t.ok = !1, t.issues.push({
						code: "RUNTIME_EVENT_STORY_ID_MISSING",
						message: "Story-visible runtime event requires storyId.",
						eventName: e.name,
						depth: n
					});
					return;
				}
				let r = this.scene.scene.stories[e.storyId];
				if (r === void 0) {
					t.ok = !1, t.issues.push({
						code: "RUNTIME_STORY_UNKNOWN",
						message: `Runtime event story is not declared: ${e.storyId}`,
						eventName: e.name,
						depth: n
					});
					return;
				}
				return {
					trackId: e.trackId ?? no(r),
					storyId: r.id,
					visibility: e.visibility
				};
			}
			return {
				trackId: e.trackId ?? "global",
				storyId: void 0,
				visibility: e.visibility
			};
		}
		if (e.storyId !== void 0) {
			let r = this.scene.scene.stories[e.storyId];
			if (r === void 0) {
				t.ok = !1, t.issues.push({
					code: "RUNTIME_STORY_UNKNOWN",
					message: `Runtime event story is not declared: ${e.storyId}`,
					eventName: e.name,
					depth: n
				});
				return;
			}
			return {
				trackId: e.trackId ?? no(r),
				storyId: r.id,
				visibility: e.visibility
			};
		}
		return {
			trackId: e.trackId ?? "global",
			storyId: void 0,
			visibility: e.visibility
		};
	}
	selectPipeline(e, t) {
		if (t.storyId !== void 0) {
			let n = this.storyRulesByEvent.get(t.storyId)?.get(e.name) ?? [];
			if (n.length > 0) return {
				scope: "story",
				storyId: t.storyId,
				rules: n,
				straps: this.strapCollections.stories[t.storyId] ?? {}
			};
		}
		let n = this.sceneRulesByEvent.get(e.name) ?? [];
		if (n.length !== 0) return {
			scope: "scene",
			rules: n,
			straps: this.strapCollections.scene
		};
	}
	resolveStoryIsolationAction(e, t, n) {
		if (!(t.storyId === void 0 || n?.scope !== "story")) return this.storyActivationRulesByEvent.get(t.storyId)?.has(e.name) ? "activate" : n.rules.some((e) => e.active === !1) ? "deactivate" : void 0;
	}
	async routeDeclaredEmissions(e, t, n, r, i) {
		for (let a of t) {
			let t = a.visibility ?? n.visibility;
			await this.route({
				name: a.name,
				applyAtMs: a.applyAtMs,
				data: a.data,
				storyId: t === "story" ? e.storyId : t === "scene" || t === "public" ? void 0 : e.scope === "story" ? e.storyId : void 0,
				visibility: t,
				context: a.context ?? n.context,
				meta: a.meta ?? n.meta,
				mode: n.mode
			}, r + 1, i);
		}
	}
	readState(e, t) {
		return this.stateStore === void 0 ? {} : this.stateStore.snapshot(e === "story" ? Ba : I, t);
	}
	applyImmediateStateUpdates(e, t, n) {
		if (!(this.stateStore === void 0 || !n)) for (let n of e) n.update === void 0 || n.applyAtMs > t || n.stateScope === void 0 || this.stateStore.applyUpdate(n.stateScope, n.update, n.storyId);
	}
	toDispatchIssue(e, t, n) {
		return {
			...e,
			eventName: t,
			depth: n
		};
	}
	createGeneratedEventId() {
		if (this.eventIdFactory !== void 0) return this.eventIdFactory();
		let e = this.nextGeneratedEventId;
		return this.nextGeneratedEventId += 1, `runtime-dispatch:${this.scene.scene.id}:${e}`;
	}
};
function mu(e) {
	return e === "track:activate" || e === "track:deactivate" || e === "track:toggle";
}
function hu(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = t.get(n.on) ?? [];
		e.push(n), t.set(n.on, e);
	}
	return t;
}
//#endregion
//#region ../codplay/src/runtime/player/pipeline/scene-evaluation.ts
function gu(e, t) {
	let n = /* @__PURE__ */ new Set();
	for (let t of Object.values(e.scene.stories)) bu(e.scene.eventimes ?? [], 0, t.persos, n), bu(t.eventimes ?? [], 0, t.persos, n);
	for (let r of t?.getAllEvents() ?? []) if (!(r.storyId !== void 0 && t !== void 0 && !t.isStoryEventEligible(r.storyId, r))) {
		n.add(r.applyAtMs);
		for (let t of Object.values(e.scene.stories)) r.storyId === void 0 && r.cascade !== !0 && r.trackId !== "global" || r.storyId !== void 0 && r.storyId !== t.id && r.cascade !== !0 && r.trackId !== "global" || xu(t.persos, r.name, r.applyAtMs, n);
	}
	return [...n].sort((e, t) => e - t);
}
function _u(e) {
	return Object.values(e.persos).some((e) => (e.actions ?? []).some((e) => yu(e.action, e.elapsedMs)));
}
function vu(e, t, n) {
	return n <= t ? n < t : e.some((e) => e > t && e <= n);
}
function yu(e, t) {
	if (Ga(e)) return t < e.duration;
	let n = e.style;
	return T(n) ? Object.values(n).some((e) => {
		let n = ml(e);
		return n !== void 0 && t < n.delay + n.totalDuration;
	}) : !1;
}
function bu(e, t, n, r) {
	for (let i of e) {
		let e = t + i.startAt;
		r.add(e), xu(n, i.name, e, r), bu(i.events ?? [], e, n, r);
	}
}
function xu(e, t, n, r) {
	for (let i of e) {
		let e = i.actions[t];
		if (Ua(e)) for (let t of Ka(e)) r.add(n + t.offsetMs);
	}
}
//#endregion
//#region ../codplay/src/runtime/capabilities/media-sync/media-sync-state.ts
function Su(e, t) {
	let n = /* @__PURE__ */ new Set(), r = to(e.scene);
	for (let i of Object.values(e.persos)) {
		if (i.type !== "media") continue;
		n.add(i.key);
		let a = Cu(e.scene, i), o = no({ id: i.storyId }), s = r.tracks[o]?.active ?? !0, c = t.get(i.key);
		c === void 0 ? t.set(i.key, {
			runtimeItemId: i.key,
			storyId: i.storyId,
			trackId: o,
			trackActive: s,
			sync: a,
			logicalState: "idle",
			sequenceStartMs: null,
			sourceStartMs: 0,
			sourceEndMs: null,
			frozenMediaMs: 0,
			activationOrder: 0,
			needsResync: !1,
			transition: null
		}) : (c.storyId = i.storyId, c.trackId = o, c.trackActive = s, c.sync = a);
	}
	for (let e of t.keys()) n.has(e) || t.delete(e);
}
function Cu(e, t) {
	return (e.scene.stories[t.storyId]?.persos.find((e) => e.id === t.persoId))?.initial.sync ?? "auto";
}
//#endregion
//#region ../codplay/src/runtime/capabilities/media-sync/media-sync-broadcasts.ts
function wu(e) {
	let t = [], n = to(e.scene);
	for (let r of Object.values(e.persos)) if (r.type === "media") for (let e of r.actions ?? []) {
		let i = Eu(e.action);
		i !== null && t.push({
			persoKey: r.key,
			trackId: e.trackId,
			trackActive: n.tracks[e.trackId]?.active ?? !0,
			action: e,
			broadcast: i
		});
	}
	return t.sort(Ou);
}
function Tu(e, t) {
	let n = Object.values(e.persos).filter((e) => e.type === "media").map((t) => `${t.key}:${Cu(e.scene, t)}`).sort();
	return JSON.stringify([n, t.map((e) => [
		e.persoKey,
		e.trackId,
		e.action.startAt,
		e.action.eventId,
		e.action.declarationPath,
		e.broadcast
	])]);
}
function Eu(e) {
	let t = e.broadcast;
	if (!T(t)) return null;
	let n = t, r = n.type;
	return r !== "START" && r !== "PAUSE" && r !== "STOP" ? null : {
		type: r,
		startAt: typeof n.startAt == "number" ? n.startAt : void 0,
		endAt: typeof n.endAt == "number" ? n.endAt : void 0,
		transition: Du(n.transition)
	};
}
function Du(e) {
	if (!T(e)) return;
	let t = e.duration;
	return {
		from: T(e.from) ? e.from : void 0,
		to: T(e.to) ? e.to : void 0,
		duration: typeof t == "number" && Number.isFinite(t) && t >= 0 ? t : void 0
	};
}
function Ou(e, t) {
	return e.action.startAt - t.action.startAt || e.action.trackOrder - t.action.trackOrder || Se(e.action.declarationPath, t.action.declarationPath) || e.persoKey.localeCompare(t.persoKey);
}
function ku(e) {
	return JSON.stringify([
		e.persoKey,
		e.trackId,
		e.trackActive,
		e.action.startAt,
		e.action.eventId,
		e.action.eventSeq,
		e.action.declarationPath,
		e.broadcast
	]);
}
function Au(e, t) {
	if (t.size <= e.size) return !1;
	for (let n of e) if (!t.has(n)) return !1;
	return !0;
}
//#endregion
//#region ../codplay/src/runtime/capabilities/media-sync/media-sync-playback.ts
var ju = 150;
function Mu(e, t, n, r, i) {
	if (e === void 0) return;
	e.trackId = t.trackId, e.trackActive = t.trackActive;
	let a = r(e.runtimeItemId);
	if (t.broadcast.type === "START") {
		e.sync === "master" && Nu(e, t.action.startAt, n, r), e.logicalState = "playing", e.sequenceStartMs = t.action.startAt, e.sourceStartMs = Uu(t.broadcast.startAt ?? 0), e.sourceEndMs = t.broadcast.endAt === void 0 ? null : Math.max(e.sourceStartMs, Uu(t.broadcast.endAt)), e.frozenMediaMs = e.sourceStartMs, e.activationOrder = i(), e.needsResync = !0, e.transition = t.broadcast.transition ?? null, a?.setPlaybackWindow?.(e.sourceStartMs, a === void 0 ? e.sourceEndMs : Hu(e, a)), e.sync === "independent" && (a?.seekTo(e.sourceStartMs), a?.play(), e.needsResync = !1);
		return;
	}
	if (t.broadcast.type === "PAUSE") {
		e.frozenMediaMs = e.sync === "independent" ? a?.getCurrentTimeMs() ?? e.frozenMediaMs : Bu(e, t.action.startAt, r), e.logicalState = "paused", e.needsResync = !0, e.sync === "independent" && (a?.pause(), e.needsResync = !1);
		return;
	}
	e.frozenMediaMs = 0, e.sourceStartMs = 0, e.sourceEndMs = null, e.logicalState = "stopped", e.needsResync = !0, a?.setPlaybackWindow?.(0, null), e.sync === "independent" && (a?.stopAt(0), e.needsResync = !1);
}
function Nu(e, t, n, r) {
	for (let i of n.values()) i === e || i.sync !== "master" || i.logicalState !== "playing" || (i.frozenMediaMs = Bu(i, t, r), i.logicalState = "paused", i.needsResync = !0, r(i.runtimeItemId)?.pause());
}
function Pu(e, t, n, r) {
	for (let i of e) Mu(t.get(i.persoKey), i, t, n, r);
}
function Fu(e, t, n, r) {
	for (let i of n.values()) {
		let n = r(i.runtimeItemId);
		if (n === void 0 || (Vu(i, e, n), i.sync === "independent")) continue;
		if (i.logicalState === "idle") {
			i.needsResync &&= (n.stopAt(0), !1);
			continue;
		}
		if (i.logicalState === "stopped") {
			(i.needsResync || !n.isPaused()) && (n.stopAt(i.frozenMediaMs), i.needsResync = !1);
			continue;
		}
		if (i.logicalState === "paused") {
			(i.needsResync || Gu(n.getCurrentTimeMs(), i.frozenMediaMs)) && n.seekTo(i.frozenMediaMs), n.isPaused() || n.pause(), i.needsResync = !1;
			continue;
		}
		let a = Bu(i, e, r), o = Hu(i, n), s = t === "playing" && !i.needsResync && o !== null && n.isPaused() && n.getCurrentTimeMs() >= o;
		if (o !== null && (a >= o || s)) {
			i.logicalState = "stopped", i.frozenMediaMs = o, n.stopAt(o), i.needsResync = !1;
			continue;
		}
		t === "playing" ? (i.needsResync && n.seekTo(a), n.isPaused() && n.play()) : ((i.needsResync || Gu(n.getCurrentTimeMs(), a)) && n.seekTo(a), n.isPaused() || n.pause(), i.frozenMediaMs = a), i.needsResync = !1;
	}
}
function Iu(e, t, n) {
	for (let r of t.values()) r.sync !== "independent" && (r.logicalState === "idle" || r.logicalState === "stopped" || (r.frozenMediaMs = Bu(r, e, n), r.logicalState = "paused", r.needsResync = !0, n(r.runtimeItemId)?.pause()));
}
function Lu(e, t, n) {
	let r = [...t.values()].filter((e) => e.sync === "master" && e.logicalState === "playing").filter((e) => e.trackActive).sort((e, t) => t.activationOrder - e.activationOrder)[0];
	if (r === void 0 || r.sequenceStartMs === null) return e;
	let i = n(r.runtimeItemId);
	if (i === void 0 || i.isPaused()) return e;
	let a = i.getCurrentTimeMs(), o = Hu(r, i);
	if (o !== null && a >= o) return e;
	let s = r.sequenceStartMs + (a - r.sourceStartMs);
	return Number.isFinite(s) && s >= 0 ? s : e;
}
function Ru(e, t) {
	for (let n of e.values()) {
		if (n.sync === "independent") continue;
		let e = t(n.runtimeItemId);
		n.logicalState !== "idle" && e?.pause(), e?.setPlaybackWindow?.(0, null), n.logicalState = "idle", n.sequenceStartMs = null, n.sourceStartMs = 0, n.sourceEndMs = null, n.frozenMediaMs = 0, n.activationOrder = 0, n.needsResync = !1, n.transition = null;
	}
}
function zu(e, t, n, r) {
	Ru(t, n), Pu(e, t, n, r);
}
function Bu(e, t, n) {
	if (e.sequenceStartMs === null) return e.frozenMediaMs;
	let r = e.sourceStartMs + (t - e.sequenceStartMs), i = n(e.runtimeItemId), a = e.sourceEndMs ?? (i === void 0 ? null : i.getDurationMs());
	return Wu(r, e.sourceStartMs, a);
}
function Vu(e, t, n) {
	if (e.transition === null || n.applyTransition === void 0) return;
	let r = e.transition.duration ?? 0, i = r <= 0 || e.sequenceStartMs === null ? e.sequenceStartMs === null || t < e.sequenceStartMs ? 0 : 1 : Math.min(1, Math.max(0, (t - e.sequenceStartMs) / r));
	n.applyTransition(e.transition, i);
}
function Hu(e, t) {
	let n = t.getDurationMs();
	return e.sourceEndMs === null ? n : n === null ? e.sourceEndMs : Math.min(e.sourceEndMs, n);
}
function Uu(e) {
	return Math.max(0, e);
}
function Wu(e, t, n) {
	let r = Math.max(0, t);
	return n === null ? Math.max(r, e) : Math.min(n, Math.max(r, e));
}
function Gu(e, t) {
	return Math.abs(e - t) > ju;
}
//#endregion
//#region ../codplay/src/runtime/capabilities/media-sync/media-sync-capability.ts
var Ku = "media-sync";
function qu() {
	return {
		id: Ku,
		create: (e) => Ju(e)
	};
}
function Ju(e) {
	let t = e.componentSurfaces === void 0 ? () => void 0 : (t) => e.componentSurfaces?.getSurface(t, "media"), n = /* @__PURE__ */ new Map(), r, i = /* @__PURE__ */ new Set(), a = 1, o = !1, s = !1, c;
	return {
		initializeScene: (e) => Su(e, n),
		onScenePresented: (e, l) => {
			Su(e, n);
			let u = wu(e), d = Tu(e, u), f = new Set(u.map(ku)), p = u.filter((e) => !i.has(ku(e))), m = u.filter((e) => n.get(e.persoKey)?.sync !== "independent");
			c !== void 0 && e.timeMs < c && (s = !0);
			let h = r === void 0 || s, g = s;
			if (h ? (a = 1, zu(m, n, t, () => a++), s = !1, o = !0) : d !== r && Au(i, f) ? Pu(p.filter((e) => n.get(e.persoKey)?.sync !== "independent"), n, t, () => a++) : d !== r && (a = 1, zu(m, n, t, () => a++), o = !0), g || Pu(p.filter((e) => n.get(e.persoKey)?.sync === "independent"), n, t, () => a++), r = d, i = f, c = e.timeMs, o) {
				for (let e of n.values()) e.sync !== "independent" && (e.needsResync = !0);
				o = !1;
			}
			Fu(e.timeMs, l, n, t);
		},
		onPlaybackStateChange: (e, r) => {
			Fu(r, e, n, t);
		},
		onRateChange: (e) => {
			for (let r of n.values()) r.sync !== "independent" && t(r.runtimeItemId)?.setRate?.(e);
		},
		resolveTimelineMs: (e) => Lu(e, n, t),
		beforeSeek: (e) => {
			Iu(e, n, t);
		},
		prepareSeek: () => {
			let e = o, t = s;
			return {
				commit: () => {
					o = !0, s = !0;
				},
				abort: () => {
					o = e, s = t;
				}
			};
		},
		destroy: () => {
			for (let e of n.values()) {
				let n = t(e.runtimeItemId);
				n !== void 0 && n.stopAt(e.frozenMediaMs);
			}
			n.clear(), r = void 0, i = /* @__PURE__ */ new Set(), a = 1, s = !1, c = void 0;
		}
	};
}
//#endregion
//#region ../codplay/src/runtime/capabilities/replace/replace-capability.ts
var Yu = "replace";
function Xu() {
	return {
		id: Yu,
		create: (e) => Zu(e)
	};
}
function Zu(e) {
	let t = e.componentSurfaces === void 0 ? (e) => void 0 : (t) => e.componentSurfaces?.getReplaceSurface?.(t), n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map(), i = 1;
	function a(e) {
		let t = n.get(e);
		t !== void 0 && (t.session.cancel(), n.delete(e));
	}
	function o(e) {
		let i = $u(e.activeActions);
		if (e.phase === "geometry-capture") {
			a(e.componentId), i === void 0 ? r.delete(e.componentId) : r.set(e.componentId, i.key);
			return;
		}
		let o = n.get(e.componentId);
		if (i === void 0) {
			a(e.componentId), r.delete(e.componentId);
			return;
		}
		if (o?.key === i.key || r.get(e.componentId) === i.key) return;
		a(e.componentId);
		let s = t(e.componentId)?.begin(i.command.transition);
		s !== void 0 && (r.set(e.componentId, i.key), n.set(e.componentId, {
			key: i.key,
			session: s
		}));
	}
	function s(e) {
		let t = $u(e.activeActions), r = n.get(e.componentId);
		e.phase === "geometry-capture" || t === void 0 || r?.key !== t.key || (r.animation === void 0 && (r.session.start(), r.animation = td({
			componentId: e.componentId,
			key: t.key,
			startAt: t.action.startAt,
			command: t.command,
			session: r.session,
			sessions: n,
			sessionId: i++
		})), e.registerAnimation(r.animation));
	}
	function c(e) {
		if (e.kind !== "replace") return;
		let r = Qu(e.options);
		if (r === void 0) return;
		a(e.componentId);
		let o = t(e.componentId)?.begin(r.transition);
		if (o === void 0) return;
		let s = i++, c = `external:${s}`;
		n.set(e.componentId, {
			key: c,
			session: o
		});
		let l = td({
			componentId: e.componentId,
			key: c,
			startAt: e.timeMs,
			command: r,
			session: o,
			sessions: n,
			sessionId: s
		});
		return n.get(e.componentId).animation = l, {
			start: o.start,
			animation: l,
			cancel: () => {
				n.get(e.componentId)?.session === o ? a(e.componentId) : o.cancel();
			}
		};
	}
	function l(e) {
		a(e.componentId);
	}
	function u() {
		for (let e of [...n.keys()]) a(e);
		r.clear();
	}
	function d() {
		u(), n.clear(), r.clear(), i = 1;
	}
	return {
		beforeComponentUpdate: o,
		afterComponentUpdate: s,
		prepareExternalPresentation: c,
		onComponentUpdateError: l,
		beforeSeek: u,
		destroy: d
	};
}
function Qu(e) {
	if (e === "fade" || e === "fade-in") return {
		transition: e,
		duration: 300
	};
	if (!rd(e) || !id(e.transition)) return;
	let t = e.duration;
	if (t === void 0) return {
		transition: e.transition,
		duration: 300
	};
	if (!(typeof t != "number" || !Number.isFinite(t) || t < 0)) return {
		transition: e.transition,
		duration: t
	};
}
function $u(e) {
	let t;
	for (let n of e) {
		if (!nd(n.action)) continue;
		let e = Qu(n.action.replace);
		e !== void 0 && (t = {
			key: ed(n),
			action: n,
			command: e
		});
	}
	return t;
}
function ed(e) {
	return `${e.eventId ?? e.name}:${e.startAt}`;
}
function td(e) {
	let t = e.startAt + e.command.duration;
	return {
		id: `replace:${e.componentId}:${e.key}:${e.sessionId}`,
		startAt: e.startAt,
		endAt: t,
		sample: (n) => {
			if (n < e.startAt) return;
			if (n >= t) return {
				value: "complete",
				apply: () => {
					e.session.finish(), e.sessions.get(e.componentId)?.session === e.session && e.sessions.delete(e.componentId);
				}
			};
			let r = t === e.startAt ? 1 : (n - e.startAt) / (t - e.startAt), i = Math.min(1, Math.max(0, r));
			return {
				value: i,
				apply: () => e.session.sample(i)
			};
		}
	};
}
function nd(e) {
	return e.content !== void 0 || e.src !== void 0;
}
function rd(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function id(e) {
	return e === "fade" || e === "fade-in";
}
var ad = {
	name: "attr",
	validate: (e, t) => {
		T(e) || A(t.diagnostics, "AUTHOR_ATTR_INVALID", "attr must be a plain object.", t);
	}
};
//#endregion
//#region ../codplay/src/services/html-materializer-service-types.ts
function od(e) {
	if (typeof e != "object" || !e) return !1;
	let t = e;
	return t.style !== void 0 && typeof t.style.setProperty == "function" && typeof t.setAttribute == "function" && typeof t.removeAttribute == "function";
}
function sd(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function cd(e, t) {
	if (!ko(e)) return;
	let n = Number.isFinite(t.numericLengthScale) ? t.numericLengthScale : 1;
	return `${e.value * n}px`;
}
function ld(e, t, n) {
	let r = e.style, i = e.style.getPropertyValue;
	(t.startsWith("--") || t.includes("-") ? i?.call(e.style, t) : r[t]) !== n && (t.startsWith("--") || t.includes("-") ? e.style.setProperty(t, n) : r[t] = n);
}
//#endregion
//#region ../codplay/src/services/attr/html-attr-service.ts
function ud(e) {
	let t = /* @__PURE__ */ new WeakMap();
	return { apply: (n, r) => {
		if (!od(n) || !sd(r)) return;
		let i = n, a = t.get(i) ?? /* @__PURE__ */ new Set();
		for (let t of a) t in r || (dd(e, n, t, void 0), n.removeAttribute(t));
		a.clear();
		for (let [t, i] of Object.entries(r)) {
			let r = i === !1 || i == null ? void 0 : i === !0 ? "" : String(i);
			e?.deferredAccessibilityAttributes !== void 0 && pd(t, i) ? dd(e, n, t, r) : (dd(e, n, t, void 0), r === void 0 ? n.removeAttribute(t) : n.setAttribute(t, r)), a.add(t);
		}
		t.set(i, a);
	} };
}
function dd(e, t, n, r) {
	if (!fd(n)) return;
	let i = e?.deferredAccessibilityAttributes;
	if (i === void 0) return;
	let a = i.get(t) ?? /* @__PURE__ */ new Map();
	r === void 0 ? a.delete(n) : a.set(n, r), a.size === 0 ? i.delete(t) : i.set(t, a);
}
function fd(e) {
	return e === "aria-hidden" || e === "inert";
}
function pd(e, t) {
	return e === "aria-hidden" && (t === !0 || t === "true") || e === "inert" && (t === !0 || t === "" || t === "true");
}
var md = {
	name: "className",
	validate: (e, t) => {
		if (e !== void 0 && typeof e != "string") {
			if (T(e)) {
				for (let n of Object.keys(e)) if (n !== "add" && n !== "remove") {
					A(t.diagnostics, "AUTHOR_CLASS_NAME_INVALID", "className only accepts add and remove keys.", t);
					return;
				}
				e.add !== void 0 && typeof e.add != "string" && A(t.diagnostics, "AUTHOR_CLASS_NAME_INVALID", "className.add must be a string.", t), e.remove !== void 0 && typeof e.remove != "string" && A(t.diagnostics, "AUTHOR_CLASS_NAME_INVALID", "className.remove must be a string.", t);
				return;
			}
			A(t.diagnostics, "AUTHOR_CLASS_NAME_INVALID", "className must be a string or a plain add/remove object.", t);
		}
	}
};
//#endregion
//#region ../codplay/src/services/class-name/html-class-name-service.ts
function hd() {
	return { apply: (e, t) => {
		if (!od(e)) return;
		if (typeof t == "string") {
			vd(e, t);
			return;
		}
		if (!gd(t)) return;
		let n = new Set(_d(e).split(/\s+/).filter(Boolean));
		for (let e of (t.add ?? "").split(/\s+/).filter(Boolean)) n.add(e);
		for (let e of (t.remove ?? "").split(/\s+/).filter(Boolean)) n.delete(e);
		vd(e, [...n].join(" "));
	} };
}
function gd(e) {
	if (typeof e != "object" || !e || Array.isArray(e)) return !1;
	let t = e;
	return (t.add === void 0 || typeof t.add == "string") && (t.remove === void 0 || typeof t.remove == "string");
}
function _d(e) {
	return yd(e) ? e.getAttribute?.("class") ?? "" : typeof e.className == "string" ? e.className : "";
}
function vd(e, t) {
	if (yd(e)) {
		t.length === 0 ? e.removeAttribute("class") : e.setAttribute("class", t);
		return;
	}
	"className" in e ? e.className = t : e.setAttribute("class", t);
}
function yd(e) {
	return e.namespaceURI === "http://www.w3.org/2000/svg";
}
//#endregion
//#region ../codplay/src/services/content/content-service.ts
function bd(e) {
	return typeof HTMLElement < "u" && e instanceof HTMLElement;
}
var xd = {
	name: "content",
	validate: (e, t) => {
		typeof e == "string" || typeof e == "number" || A(t.diagnostics, "AUTHOR_CONTENT_INVALID", "content must be a string or number in SceneDoc; HTMLElement values are runtime-only.", t);
	}
};
//#endregion
//#region ../codplay/src/services/content/html-content-service.ts
function Sd() {
	return { apply: (e, t) => {
		if (od(e)) {
			if (typeof t == "string" || typeof t == "number") {
				let n = String(t);
				(!(e.childNodes?.length === 1 && e.firstChild?.nodeType === 3) || e.textContent !== n) && (e.textContent = n);
				return;
			}
			if (!(!bd(t) || t === e)) {
				if (typeof e.replaceChildren == "function") {
					e.replaceChildren(t);
					return;
				}
				e.textContent = "", e.appendChild?.(t);
			}
		}
	} };
}
//#endregion
//#region ../codplay/src/services/style/style-service.ts
var Cd = [
	"color",
	"backgroundColor",
	"borderColor"
], wd = (e, t) => {
	T(e) || A(t.diagnostics, "AUTHOR_STYLE_INVALID", "style must be a plain object.", t);
}, Td = (e, t) => {
	if (t.target === "action" && T(e) && !Od(e)) {
		if (!("to" in e)) {
			Ed(t);
			return;
		}
		e.from !== void 0 && !Dd(e.from) && Ed(t), Dd(e.to) || Ed(t);
		return;
	}
	Dd(e) || Ed(t);
};
function Ed(e) {
	A(e.diagnostics, "AUTHOR_STYLE_COLOR_INVALID", "style color properties accept named colors, hexadecimal colors, rgb(), rgba() and oklch() values.", e);
}
function Dd(e) {
	if (Od(e)) return !0;
	if (typeof e != "string") return !1;
	try {
		return At(e), !0;
	} catch {
		return !1;
	}
}
function Od(e) {
	return T(e) ? e.kind === "color" && (e.space === "srgb" || e.space === "oklch") && Array.isArray(e.coords) && e.coords.every((e) => typeof e == "number" && Number.isFinite(e)) && typeof e.alpha == "number" && Number.isFinite(e.alpha) : !1;
}
var kd = (e) => {
	if (!T(e)) return e;
	let t = { ...e };
	for (let e of Cd) e in t && (t[e] = Ad(t[e]));
	return t;
};
function Ad(e) {
	if (typeof e == "string") return At(e);
	if (!T(e) || Od(e)) return e;
	let t = { ...e };
	return typeof t.from == "string" && (t.from = At(t.from)), typeof t.to == "string" && (t.to = At(t.to)), t;
}
var jd = {
	name: "style",
	validate: wd,
	sanitize: kd,
	properties: Cd.map((e) => ({
		name: e,
		validate: Td
	})),
	allowUnknownProperties: !0
};
//#endregion
//#region ../codplay/src/services/style/html-transform-service.ts
function Md() {
	return {
		channels: /* @__PURE__ */ new Map(),
		rawTransform: void 0
	};
}
function Nd(e, t, n, r, i) {
	if (n === "translate") return ld(t, n, Ld(r, i)), !0;
	if (n === "transform") return e.rawTransform = Wd(r), !0;
	let a = zd(n);
	return a === void 0 ? !1 : (e.channels.set(a, Bd(a, r, i)), !0);
}
function Pd(e, t, n) {
	if (n === "translate") return ld(t, n, ""), !0;
	if (n === "transform") return e.rawTransform = void 0, !0;
	let r = zd(n);
	return r === void 0 ? !1 : (e.channels.delete(r), !0);
}
function Fd(e) {
	return e.channels.size > 0 || e.rawTransform !== void 0;
}
function Id(e, t) {
	if (!Fd(t)) {
		ld(e, "transform", "");
		return;
	}
	ld(e, "transform", [Rd(t.channels), t.rawTransform].filter((e) => e !== void 0 && e.length > 0).join(" "));
}
function Ld(e, t) {
	let n = cd(e, t);
	if (n !== void 0) return n;
	if (typeof e == "number") return `${Ud(e, t)}px`;
	if (typeof e != "string") return String(e);
	let r = e.trim().split(/\s+/).filter(Boolean);
	return r.length === 0 || r.length > 3 || !r.every((e) => /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(e)) ? e : r.map((e) => `${Ud(Number(e), t)}px`).join(" ");
}
function Rd(e) {
	if (e.size === 0) return;
	let t = e.has("translateX"), n = e.has("translateY"), r = t && n ? `translate(${e.get("translateX")}, ${e.get("translateY")})` : void 0;
	return ur().flatMap((t) => {
		if (t === "translateX") {
			if (r !== void 0) return [r];
			let n = e.get(t);
			return n === void 0 ? [] : [`translateX(${n})`];
		}
		if (t === "translateY") {
			if (r !== void 0) return [];
			let n = e.get(t);
			return n === void 0 ? [] : [`translateY(${n})`];
		}
		let n = e.get(t);
		return n === void 0 ? [] : [`${t}(${n})`];
	}).join(" ");
}
function zd(e) {
	let t = cr(e);
	return t !== void 0 && lr(t) ? t : void 0;
}
function Bd(e, t, n) {
	let r = cd(t, n);
	return r === void 0 ? typeof t == "number" && Vd(e) ? `${t}deg` : typeof t != "number" || !Hd(e) ? String(t) : `${Ud(t, n)}px` : r;
}
function Vd(e) {
	return e === "rotate" || e === "rotateX" || e === "rotateY" || e === "rotateZ" || e === "skew" || e === "skewX" || e === "skewY";
}
function Hd(e) {
	return e === "perspective" || e === "translateX" || e === "translateY" || e === "translateZ";
}
function Ud(e, t) {
	return e * (Number.isFinite(t.numericLengthScale) ? t.numericLengthScale : 1);
}
function Wd(e) {
	return e == null ? void 0 : String(e);
}
//#endregion
//#region ../codplay/src/services/style/html-style-service.ts
function Gd(e) {
	let t = /* @__PURE__ */ new WeakMap();
	return { apply: (n, r) => {
		if (!od(n) || !sd(r)) return;
		let i = n, a = t.get(i) ?? {
			managedProperties: /* @__PURE__ */ new Set(),
			transformState: Md()
		}, { managedProperties: o, transformState: s } = a, c = Fd(s);
		for (let e of o) e in r || Pd(s, n, e) || ld(n, e, "");
		o.clear();
		for (let [t, i] of Object.entries(r)) {
			if (i == null) {
				Pd(s, n, t) || ld(n, t, ""), o.add(t);
				continue;
			}
			Nd(s, n, t, i, e) || ld(n, t, Kd(i, e)), o.add(t);
		}
		(c || Fd(s)) && Id(n, s), t.set(i, a);
	} };
}
function Kd(e, t) {
	let n = cd(e, t);
	if (n !== void 0) return n;
	if (!sd(e) || e.kind !== "color" || !Array.isArray(e.coords) || typeof e.alpha != "number") return String(e);
	let r = e.coords;
	if (!r.every((e) => typeof e == "number")) return String(e);
	if (e.space === "srgb" && r.length >= 3) {
		let t = e.alpha === 1 ? "1" : e.alpha.toFixed(3);
		return `rgba(${Math.round(r[0] * 255)}, ${Math.round(r[1] * 255)}, ${Math.round(r[2] * 255)}, ${t})`;
	}
	return e.space === "oklch" && r.length >= 3 ? `oklch(${r[0]} ${r[1]} ${r[2]} / ${e.alpha})` : String(e);
}
//#endregion
//#region ../codplay/src/runtime/runner-html/service-definitions.ts
var qd = {
	...ad,
	materializers: [oe],
	create: (e) => ud(Zd(e))
}, Jd = {
	...md,
	materializers: [oe],
	create: () => hd()
}, Yd = {
	...xd,
	materializers: [oe],
	create: () => Sd()
}, Xd = {
	...jd,
	materializers: [oe],
	create: (e) => Gd(Zd(e))
};
function Zd(e) {
	if (e.materializerId !== "html") throw Error(`HTML service received an unexpected materializer: ${e.materializerId}`);
	if (!Qd(e.materializerContext)) throw Error("HTML materializer context is invalid.");
	return e.materializerContext;
}
function Qd(e) {
	return typeof e == "object" && !!e && "numericLengthScale" in e && typeof e.numericLengthScale == "number";
}
//#endregion
//#region ../codplay/src/runtime/catalog/create-core-runtime-catalog.ts
function $d() {
	let e = new se();
	return e.registerService(qd, "core"), e.registerService(Jd, "core"), e.registerService(Yd, "core"), e.registerService(Xd, "core"), e.registerModule({
		...Yi(),
		origin: "core"
	}, "core"), e.registerModule({
		...La(),
		origin: "core"
	}, "core"), e.registerModule({
		...qu(),
		origin: "core"
	}, "core"), e.registerModule({
		...Xu(),
		origin: "core"
	}, "core"), e.registerComponent(ef, "core"), e.registerComponent(tf, "core"), e.registerComponent(nf, "core"), e.registerComponent(af, "core"), e.registerComponent(of, "core"), e.registerComponent(sf, "core"), e.registerComponent(cf, "core"), e.registerComponent(lf, "core"), e;
}
var ef = {
	type: "tag",
	component: Ei,
	modules: [],
	validateInitial: Di,
	sanitizeInitial: Oi
}, tf = {
	type: "img",
	component: he,
	modules: ["replace"],
	validateInitial: Te,
	validateAction: Ee
}, nf = {
	type: "input",
	component: Re,
	modules: ["markup"],
	validateInitial: We,
	validateAction: Ge,
	sanitizeInitial: Ke,
	sanitizeAction: qe,
	surfaces: (e) => e instanceof Re ? { input: e } : {},
	mountablePartResolver: (e) => [He(e.storyId, rf(e)), Ue(e.storyId, rf(e))]
};
function rf(e) {
	let t = `${e.storyId}:`;
	return e.componentId.startsWith(t) ? e.componentId.slice(t.length) : e.componentId;
}
var af = {
	type: "layout",
	component: ot,
	modules: ["markup"],
	validateInitial: st,
	mountableParts: "all"
}, of = {
	type: "media",
	component: ft,
	modules: ["media-sync"],
	validateInitial: Ct,
	validateAction: wt,
	surfaces: (e) => e instanceof ft ? { media: e } : {}
}, sf = {
	type: "list",
	component: ct,
	modules: ["list"],
	validateInitial: lt,
	sanitizeInitial: ut
}, cf = {
	type: "polygon",
	component: Gr,
	modules: [],
	validateInitial: di,
	validateAction: fi,
	sanitizeInitial: pi,
	sanitizeAction: mi
}, lf = {
	type: "slot",
	component: ki,
	modules: ["replace"],
	validateInitial: Ai,
	validateAction: ji,
	validatePerso: Mi,
	sanitizeInitial: Ni,
	surfaces: (e, t, n) => t === void 0 || n?.getForeignContentSurface === void 0 ? {} : { foreignContent: n.getForeignContentSurface(t.componentId) }
};
//#endregion
//#region ../codplay/src/runtime/engine/capability-diagnostics.ts
function uf(e, t, n, r) {
	for (let i of t) n.has(i) || r.error(`RUNTIME_${e.toUpperCase()}_UNAVAILABLE`, `Runtime ${e} "${i}" is not available in the engine.`, { context: {
		capability: i,
		kind: e
	} });
}
//#endregion
//#region ../codplay/src/runtime/idle/runtime-idle.ts
var df = 3e4, ff = "sequence:end";
function pf(e) {
	if (e === !1) return !1;
	let t = e?.durationMs ?? 3e4;
	if (!Number.isFinite(t) || t <= 0) throw Error("Runtime idle durationMs must be a finite positive number.");
	let n = e?.event ?? { name: "sequence:end" };
	if (n.name.trim().length === 0) throw Error("Runtime idle event name must not be empty.");
	if (n.visibility !== void 0 && n.visibility !== "story" && n.visibility !== "scene" && n.visibility !== "public") throw Error(`Runtime idle event visibility is invalid: ${n.visibility}`);
	if (n.visibility === "story" && n.storyId === void 0) throw Error("Runtime idle story-visible event requires storyId.");
	if (n.visibility !== "story" && n.storyId !== void 0) throw Error("Runtime idle storyId is only valid for story-visible events.");
	return {
		durationMs: t,
		event: {
			name: n.name,
			data: n.data === void 0 ? void 0 : Ce(n.data),
			visibility: n.visibility,
			storyId: n.storyId
		}
	};
}
var mf = class {
	elapsedMs = 0;
	thresholdReached = !1;
	options;
	constructor(e) {
		this.options = e;
	}
	reset() {
		this.elapsedMs = 0, this.thresholdReached = !1;
	}
	advance(e) {
		return this.options === !1 || this.thresholdReached || e <= 0 || (this.elapsedMs += e, this.elapsedMs < this.options.durationMs) ? !1 : (this.thresholdReached = !0, !0);
	}
	getEvent() {
		return this.options === !1 ? void 0 : this.options.event;
	}
}, hf = class {
	catalog;
	resources = /* @__PURE__ */ new Set();
	preparedLibraries = /* @__PURE__ */ new Map();
	loadingLibraries = /* @__PURE__ */ new Map();
	instances = /* @__PURE__ */ new Map();
	idle;
	componentRuntimeContext = { getLibrary: (e) => this.requirePreparedLibrary(e) };
	lastNowMs;
	ticker = null;
	running = !1;
	paused = !1;
	stopped = !1;
	destroyed = !1;
	clockMode = "idle";
	constructor(e, t = {}) {
		this.catalog = e, this.idle = pf(t.idle), this.registerResources(t.resources ?? []);
	}
	registerResources(e) {
		this.assertUsable();
		for (let t of e) this.resources.add(t);
	}
	async prepareScene(e) {
		this.assertUsable(), await Promise.all((e.requirements.libraries ?? []).map((e) => this.prepareLibrary(e)));
	}
	getComponentRuntimeContext() {
		return this.componentRuntimeContext;
	}
	validateRequirements(e, t) {
		uf("component", e.components, new Set(this.catalog.getComponents().map((e) => e.type)), t), uf("service", e.services, new Set(this.catalog.getServices().map((e) => e.name)), t), uf("module", e.modules, new Set(this.catalog.getModules().map((e) => e.id)), t), uf("library", e.libraries ?? [], new Set(this.preparedLibraries.keys()), t), uf("resource", e.resources, this.resources, t);
	}
	registerInstance(e, t, n) {
		if (this.assertUsable(), this.instances.has(e)) throw Error(`Runtime instance already registered: ${e}`);
		this.instances.set(e, {
			onFrame: t,
			seekParticipant: n
		});
	}
	unregisterInstance(e) {
		this.instances.delete(e);
	}
	createModuleServiceInstances(e, t, n, r = {}) {
		let i = /* @__PURE__ */ new Map();
		for (let a of n) {
			let n = this.catalog.getModule(a);
			if (n === void 0) throw Error(`Runtime module service capability is unavailable: ${a}`);
			i.set(a, n.create({
				playerId: e,
				compiledScene: t,
				...r
			}));
		}
		return i;
	}
	advance(e, t = 0) {
		if (this.assertUsable(), this.clockMode === "ticker" && this.ticker?.isRunning()) throw Error("External engine frames cannot be used while an engine ticker is active.");
		if (!Number.isFinite(e)) throw Error("Engine time must be finite.");
		let n = this.lastNowMs === void 0 ? 0 : e - this.lastNowMs;
		if (n < 0) throw Error("Engine time must be monotonic.");
		if (this.stopped) {
			this.lastNowMs = e;
			return;
		}
		this.clockMode === "ticker" && (this.running = !1, this.ticker = null), this.clockMode = "external";
		let r = this.lastNowMs ?? e;
		if (this.paused) {
			this.lastNowMs = e;
			return;
		}
		this.dispatchFrame({
			prevMs: r,
			nowMs: e,
			deltaMs: n,
			marginMs: t
		});
	}
	start(e) {
		if (this.assertUsable(), !this.running) {
			if (this.clockMode === "external") {
				if (e !== void 0) throw Error("An engine driven by external frames cannot start an owned ticker.");
				this.stopped = !1, this.paused = !1;
				return;
			}
			this.stopped = !1, this.clockMode = "ticker", this.ticker = e ?? this.ticker ?? new ae(), this.paused = !1, this.running = !0, this.ticker.start((e) => this.advanceTick(e));
		}
	}
	stop() {
		this.destroyed || (this.running = !1, this.ticker?.stop(), this.ticker = null, this.lastNowMs = void 0, this.paused = !1, this.stopped = !0);
	}
	pause() {
		this.assertUsable(), this.stopped = !1, this.paused = !0, this.running && (this.running = !1, this.ticker?.stop());
	}
	isPaused() {
		return this.paused;
	}
	isRunning() {
		return this.running;
	}
	getCurrentNowMs() {
		return this.lastNowMs ?? 0;
	}
	getIdleOptions() {
		return this.idle;
	}
	seek(e) {
		if (this.assertUsable(), e.length === 0) throw Error("Engine seek requires at least one target.");
		let t = e.map((t) => {
			if (!Number.isFinite(t.timeMs) || t.timeMs < 0) throw Error(`Engine seek time must be a finite positive number: ${t.instanceId}.`);
			if (e.filter((e) => e.instanceId === t.instanceId).length > 1) throw Error(`Engine seek target is duplicated: ${t.instanceId}`);
			let n = this.instances.get(t.instanceId);
			if (n === void 0 || n.seekParticipant === void 0) throw Error(`Engine instance cannot seek: ${t.instanceId}`);
			return {
				target: t,
				participant: n.seekParticipant
			};
		}), n = [];
		try {
			for (let { target: e, participant: r } of t) n.push({ participant: r }), r.validateSeek(e.timeMs);
		} catch (e) {
			throw _f(n), e;
		}
		let r = Object.fromEntries(t.map(({ target: e, participant: t }) => [e.instanceId, t.getSeekDiagnostics?.() ?? gf()])), i = [];
		try {
			for (let { participant: e } of t) i.push({ participant: e }), e.prepareSeek();
		} catch (e) {
			throw _f(i), e;
		}
		try {
			for (let { target: e, participant: n } of t) n.commitSeek(e.timeMs);
			for (let { participant: e } of t) e.presentSeek();
		} catch (e) {
			throw vf(t), e;
		}
		return {
			ok: !0,
			diagnostics: r
		};
	}
	advanceTick(e) {
		if (this.assertUsable(), this.clockMode !== "ticker") throw Error("Owned ticker frame received while the engine is not in ticker mode.");
		if (!Number.isFinite(e.prevMs) || !Number.isFinite(e.nowMs) || !Number.isFinite(e.deltaMs)) throw Error("Ticker frame time must be finite.");
		if (e.nowMs < e.prevMs || e.deltaMs < 0) throw Error("Ticker frame time must be monotonic.");
		if (this.lastNowMs !== void 0 && e.nowMs < this.lastNowMs) throw Error("Engine time must be monotonic.");
		if (this.paused) {
			this.lastNowMs = e.nowMs;
			return;
		}
		this.dispatchFrame(e);
	}
	dispatchFrame(e) {
		this.lastNowMs = e.nowMs;
		for (let t of this.instances.values()) t.onFrame(e);
	}
	destroy() {
		if (!this.destroyed) {
			this.stop(), this.instances.clear(), this.resources.clear();
			for (let [e, t] of this.preparedLibraries) this.catalog.getLibrary(e)?.release?.(t);
			this.preparedLibraries.clear(), this.loadingLibraries.clear(), this.destroyed = !0;
		}
	}
	prepareLibrary(e) {
		if (this.preparedLibraries.has(e)) return Promise.resolve();
		let t = this.loadingLibraries.get(e);
		if (t !== void 0) return t;
		let n = this.catalog.getLibrary(e);
		if (n === void 0) return Promise.reject(/* @__PURE__ */ Error(`Runtime library is not registered: ${e}`));
		let r = Promise.resolve().then(() => n.load()).then((t) => {
			this.preparedLibraries.set(e, t);
		}).catch((t) => {
			throw this.loadingLibraries.delete(e), t;
		});
		return this.loadingLibraries.set(e, r), r;
	}
	requirePreparedLibrary(e) {
		if (!this.preparedLibraries.has(e)) throw Error(`Runtime library is not prepared: ${e}`);
		return this.preparedLibraries.get(e);
	}
	assertUsable() {
		if (this.destroyed) throw Error("Runtime engine has been destroyed.");
	}
};
function gf() {
	return {
		all: [],
		warnings: [],
		errors: []
	};
}
function _f(e) {
	for (let { participant: t } of [...e].reverse()) try {
		t.abortSeek?.();
	} catch {}
}
function vf(e) {
	for (let { participant: t } of [...e].reverse()) try {
		t.rollbackSeek();
	} catch {}
}
//#endregion
//#region ../codplay/src/facade/diagnostic-channel.ts
var yf = class {
	listeners = /* @__PURE__ */ new Set();
	output;
	parent;
	constructor(e, t) {
		this.output = e, this.parent = t;
	}
	onDiagnostic(e) {
		return this.listeners.add(e), () => {
			this.listeners.delete(e);
		};
	}
	publish(e) {
		for (let t of [...this.listeners]) try {
			t(e);
		} catch {}
		try {
			this.output?.(e);
		} catch {}
		try {
			this.parent?.publish(e);
		} catch {}
	}
	publishReport(e, t) {
		for (let n of e.all) this.publish(bf(n, t));
	}
};
function bf(e, t) {
	if (t === void 0) return e;
	let n = e.details === void 0 ? { refs: t } : {
		...e.details,
		refs: {
			...e.details.refs ?? {},
			...t
		}
	};
	return {
		...e,
		details: n
	};
}
function K(e, t, n, r) {
	e.publish({
		severity: "error",
		code: t,
		message: n instanceof Error ? n.message : String(n),
		details: r === void 0 ? void 0 : { refs: r }
	});
}
//#endregion
//#region ../codplay/src/facade/engine-facade/capability-registry.ts
function xf(e, t) {
	wf(e, t.components), Tf(e, t.services), Ef(e, t.modules), Df(e, t.libraries);
}
var Sf = class {
	catalog;
	diagnostics;
	isDestroyed;
	constructor(e, t, n) {
		this.catalog = e, this.diagnostics = t, this.isDestroyed = n;
	}
	createRegistries() {
		return {
			components: this.createComponentRegistry(),
			services: this.createServiceRegistry(),
			modules: this.createModuleRegistry(),
			libraries: this.createLibraryRegistry()
		};
	}
	lock() {
		this.catalog.isLocked() || this.catalog.lock();
	}
	createComponentRegistry() {
		return this.createRegistry("component", (e) => e.type, (e) => this.catalog.registerComponent(e, "foreign"), (e) => this.catalog.overrideComponent(e, "foreign"));
	}
	createServiceRegistry() {
		return this.createRegistry("service", (e) => e.name, (e) => this.catalog.registerService(e, "foreign"), (e) => this.catalog.overrideService(e, "foreign"));
	}
	createModuleRegistry() {
		return this.createRegistry("module", (e) => e.id, (e) => this.catalog.registerModule(e, "foreign"), (e) => this.catalog.overrideModule(e, "foreign"));
	}
	createLibraryRegistry() {
		return this.createRegistry("library", (e) => e.id, (e) => this.catalog.registerLibrary(e, "foreign"), (e) => this.catalog.overrideLibrary(e, "foreign"));
	}
	createRegistry(e, t, n, r) {
		return {
			register: (r) => this.apply(e, "register", t(r), () => n(r)),
			override: (n) => this.apply(e, "override", t(n), () => r(n))
		};
	}
	apply(e, t, n, r) {
		let i = `CODPLAY_${e.toUpperCase()}_${t.toUpperCase()}_FAILED`;
		try {
			if (this.isDestroyed()) throw Error("CodPlay owner has been destroyed.");
			return r(), {
				ok: !0,
				status: t === "register" ? "registered" : "overridden"
			};
		} catch (r) {
			let a = r instanceof Error ? r.message : String(r), o = {
				family: e,
				operation: t,
				key: n
			}, s = {
				code: i,
				message: a,
				details: o
			};
			return this.diagnostics.publish({
				severity: "error",
				code: i,
				message: a,
				details: { context: o }
			}), {
				ok: !1,
				error: s
			};
		}
	}
};
function Cf(e, t, n) {
	for (let n of e?.register ?? []) t(n);
	for (let t of e?.override ?? []) n(t);
}
function wf(e, t) {
	Cf(t, (t) => e.registerComponent(t, "foreign"), (t) => e.overrideComponent(t, "foreign"));
}
function Tf(e, t) {
	Cf(t, (t) => e.registerService(t, "foreign"), (t) => e.overrideService(t, "foreign"));
}
function Ef(e, t) {
	Cf(t, (t) => e.registerModule(t, "foreign"), (t) => e.overrideModule(t, "foreign"));
}
function Df(e, t) {
	Cf(t, (t) => e.registerLibrary(t, "foreign"), (t) => e.overrideLibrary(t, "foreign"));
}
//#endregion
//#region ../codplay/src/facade/engine-facade/clock-controller.ts
var Of = class {
	playingInstanceIds = /* @__PURE__ */ new Set();
	runtimeEngine;
	defaultTicker;
	diagnostics;
	isDestroyed;
	externalClockMode = !1;
	constructor(e, t, n, r) {
		this.runtimeEngine = e, this.defaultTicker = t, this.diagnostics = n, this.isDestroyed = r;
	}
	start() {
		this.run("CODPLAY_ENGINE_START_FAILED", () => {
			this.runtimeEngine.start(this.externalClockMode ? void 0 : this.defaultTicker);
		});
	}
	pause() {
		this.run("CODPLAY_ENGINE_PAUSE_FAILED", () => this.runtimeEngine.pause());
	}
	stop() {
		this.run("CODPLAY_ENGINE_STOP_FAILED", () => this.runtimeEngine.stop());
	}
	advance(e, t = 0) {
		this.run("CODPLAY_ENGINE_ADVANCE_FAILED", () => {
			this.runtimeEngine.advance(e, t), this.externalClockMode = !0;
		});
	}
	removeInstance(e) {
		this.playingInstanceIds.delete(e), this.pauseWhenIdle();
	}
	syncPlayback(e, t) {
		if (!this.isDestroyed()) {
			if (t === "playing" ? this.playingInstanceIds.add(e) : this.playingInstanceIds.delete(e), this.playingInstanceIds.size > 0) {
				this.run("CODPLAY_ENGINE_AUTO_START_FAILED", () => {
					this.runtimeEngine.start(this.externalClockMode ? void 0 : this.defaultTicker);
				});
				return;
			}
			this.pauseWhenIdle();
		}
	}
	destroy() {
		this.playingInstanceIds.clear(), this.runtimeEngine.destroy();
	}
	run(e, t) {
		if (!this.isDestroyed()) try {
			t();
		} catch (t) {
			K(this.diagnostics, e, t);
		}
	}
	pauseWhenIdle() {
		this.playingInstanceIds.size > 0 || this.isDestroyed() || this.run("CODPLAY_ENGINE_AUTO_PAUSE_FAILED", () => this.runtimeEngine.pause());
	}
}, kf = class {
	listeners = /* @__PURE__ */ new Set();
	diagnostics;
	constructor(e) {
		this.diagnostics = e;
	}
	createPublicRegistry(e) {
		return {
			emit: e,
			onEvent: (e) => (this.listeners.add(e), () => {
				this.listeners.delete(e);
			})
		};
	}
	forward(e) {
		for (let t of this.listeners) try {
			t(e);
		} catch (t) {
			K(this.diagnostics, "CODPLAY_EVENT_LISTENER_FAILED", t, {
				instanceId: e.instanceId,
				eventId: e.eventId
			});
		}
	}
	destroy() {
		this.listeners.clear();
	}
}, Af = "idle", jf = "ready", Mf = "playing", Nf = "paused", Pf = "destroyed";
//#endregion
//#region ../codplay/src/runtime/telco/runtime-telco.ts
function Ff(e) {
	if (e.durationMs !== void 0 && (!Number.isFinite(e.durationMs) || e.durationMs <= 0)) throw Error("Runtime telco durationMs must be a finite positive number.");
	let t = e.target, n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), i = !1, a = 0, o = null, s = !1, c = !1, l;
	function u(t) {
		if (e.durationMs !== void 0) return e.durationMs;
		let n = e.target.getDurationMs?.();
		return n === void 0 || !Number.isFinite(n) || n < 0 ? t : Math.max(t, n);
	}
	function d() {
		let n = t.getLifecycleState(), r = Math.max(0, t.getCurrentTimeMs());
		return {
			status: n,
			timelineMs: r,
			durationMs: u(r),
			rate: t.getRate(),
			initialized: n !== "idle" && n !== "destroyed",
			sequenceEnded: t.getSequenceEnded?.() === !0 || e.durationMs !== void 0 && r >= e.durationMs,
			runtimeRevision: a
		};
	}
	l = (() => {
		let e = d();
		return {
			status: e.status,
			sequenceEnded: e.sequenceEnded
		};
	})();
	function f() {
		let e = d();
		return {
			timelineMs: e.timelineMs,
			durationMs: e.durationMs
		};
	}
	function p() {
		a += 1;
		let e = d();
		l = {
			status: e.status,
			sequenceEnded: e.sequenceEnded
		};
		for (let t of n) t(e);
	}
	function m() {
		if (c) return;
		let n = d();
		(l?.status !== n.status || l.sequenceEnded !== n.sequenceEnded) && (p(), n = d());
		for (let e of [...r]) try {
			e(n);
		} catch {}
		if (e.durationMs === void 0 || n.status !== "playing" || !n.sequenceEnded || s) return;
		let i = e.durationMs;
		s = !0, queueMicrotask(() => {
			if (s = !1, c) return;
			let e = d();
			e.status !== "playing" || !e.sequenceEnded || (t.pause(), t.seek(i).ok && p());
		});
	}
	function h() {
		c || o !== null || r.size === 0 && n.size === 0 || (o = t.subscribe(m));
	}
	function g() {
		o?.(), o = null;
	}
	function _(e) {
		return {
			ok: !1,
			error: {
				code: "TELCO_COMMAND_FAILED",
				message: e instanceof Error ? e.message : "Runtime telco command failed."
			}
		};
	}
	async function v(e) {
		if (c) return {
			ok: !1,
			error: {
				code: "TELCO_DESTROYED",
				message: "Runtime telco has been destroyed."
			}
		};
		if (i) return {
			ok: !1,
			error: {
				code: "TELCO_COMMAND_IN_FLIGHT",
				message: "Another telco command is in flight."
			}
		};
		i = !0, p();
		try {
			return e(), { ok: !0 };
		} catch (e) {
			return _(e);
		} finally {
			i = !1, p();
		}
	}
	function y() {
		t.getLifecycleState() === "playing" && t.pause();
	}
	function b(n) {
		if (!Number.isFinite(n) || n < 0) throw Error("Runtime telco seek time must be finite and non-negative.");
		if (!t.seek(e.durationMs === void 0 ? n : Math.min(n, e.durationMs)).ok) throw Error("Runtime telco seek was rejected.");
	}
	return {
		getState: d,
		getProgress: f,
		get rate() {
			return t.getRate();
		},
		get commandInFlight() {
			return i;
		},
		play: () => v(() => {
			let e = d();
			if (e.status !== "playing") {
				if (e.status === "destroyed" || e.status === "idle") throw Error(`Runtime telco cannot play from ${e.status} state.`);
				e.sequenceEnded && t.getSequenceEnded?.() !== !0 && b(0), t.play();
			}
		}),
		pause: () => v(y),
		reset: () => v(() => t.reset()),
		setRate: (e) => {
			if (c) throw Error("Runtime telco has been destroyed.");
			if (!Number.isFinite(e) || e <= 0) throw Error("Runtime telco rate must be a finite positive number.");
			t.setRate(e), p();
		},
		togglePlay: () => v(() => {
			if (t.getLifecycleState() === "playing") y();
			else {
				let e = d();
				if (e.status === "destroyed" || e.status === "idle") throw Error(`Runtime telco cannot play from ${e.status} state.`);
				e.sequenceEnded && t.getSequenceEnded?.() !== !0 && b(0), t.play();
			}
		}),
		seek: (e) => v(() => {
			y(), b(e);
		}),
		rewind: () => v(() => {
			y(), b(0);
		}),
		onChange(e) {
			return n.add(e), h(), () => {
				n.delete(e), n.size === 0 && r.size === 0 && g();
			};
		},
		onProgress(e) {
			return r.add(e), h(), () => {
				r.delete(e), r.size === 0 && n.size === 0 && g();
			};
		},
		destroy() {
			c = !0, g(), n.clear(), r.clear();
		}
	};
}
//#endregion
//#region ../codplay/src/facade/public-event.ts
function If(e, t) {
	return {
		instanceId: e,
		eventId: t.eventId,
		eventSeq: t.eventSeq,
		name: t.name,
		timeMs: t.applyAtMs,
		visibility: "public",
		data: t.data,
		context: t.context,
		meta: t.meta
	};
}
//#endregion
//#region ../codplay/src/facade/instance-facade.ts
var Lf = class {
	instanceId;
	telco;
	projection;
	events;
	diagnostic;
	snapshot;
	presentation;
	player;
	runner;
	instanceRoot;
	diagnostics;
	eventListeners;
	traceListeners;
	destroyTelco;
	destroyHost;
	destroyed = !1;
	constructor(e) {
		this.instanceId = e.instanceId, this.player = e.player, this.runner = e.runner, this.instanceRoot = e.root, this.diagnostics = e.diagnostics, this.eventListeners = e.eventListeners, this.traceListeners = e.traceListeners, this.destroyHost = e.destroy;
		let t = Uf(e);
		this.telco = t.api, this.destroyTelco = t.destroy, this.projection = Rf(this.player, this.diagnostics, this.instanceId, () => this.destroyed), this.events = Wf(this.player, this.diagnostics, this.instanceId, this.eventListeners), this.snapshot = Vf(this.player, this.diagnostics, this.instanceId, () => this.destroyed), this.presentation = Bf(e.runner, () => this.destroyed), this.diagnostic = {
			onDiagnostic: (e) => this.diagnostics.onDiagnostic(e),
			onTrace: (e) => (this.traceListeners.add(e), () => {
				this.traceListeners.delete(e);
			})
		}, this.onPublicEvent = e.onPublicEvent;
	}
	onPublicEvent;
	getMaterializedRoots() {
		return this.destroyed ? void 0 : this.runner.getMaterializedRoots();
	}
	setMountContainer(e) {
		if (!this.destroyed) return this.runner.setMountContainer(e ?? this.instanceRoot), this.runner.getMaterializedRoots();
	}
	getForeignContentHostRoot(e) {
		if (this.destroyed) return;
		let t = this.runner.getPersoNode(`${e.storyId}:${e.persoId}`);
		return zf(t) ? t : void 0;
	}
	getForeignContentSurface(e) {
		if (!this.destroyed) return this.runner.getComponentSurface(`${e.storyId}:${e.persoId}`, "foreignContent");
	}
	prepareForeignMountReplacement(e, t) {
		if (!this.destroyed) return this.runner.prepareExternalPresentation(`${e.storyId}:${e.persoId}`, "replace", t);
	}
	handlePublicEvent(e) {
		if (this.destroyed) return;
		let t = If(this.instanceId, e);
		for (let n of this.eventListeners) try {
			n(t);
		} catch (t) {
			K(this.diagnostics, "CODPLAY_EVENT_LISTENER_FAILED", t, {
				instanceId: this.instanceId,
				eventId: e.eventId
			});
		}
		this.onPublicEvent(t);
	}
	destroyInternal() {
		this.destroyed || (this.destroyed = !0, this.eventListeners.clear(), this.traceListeners.clear(), this.destroyTelco(), this.destroyHost());
	}
};
function Rf(e, t, n, r) {
	return { setInputValue: (i, a) => {
		if (r()) return {
			ok: !1,
			code: "INSTANCE_DESTROYED"
		};
		let o = e.projectInputValue(i, a);
		return o.ok || K(t, `CODPLAY_PROJECTION_${o.code}`, `Input projection rejected: ${o.code}.`, { instanceId: n }), o;
	} };
}
function zf(e) {
	return typeof HTMLElement < "u" && e instanceof HTMLElement;
}
function Bf(e, t) {
	return { get: () => {
		if (t()) return null;
		let n = e.getPresentationFrame();
		return n === void 0 ? null : {
			timeMs: n.timeMs,
			items: Object.freeze([...n.items.values()].map((e) => Object.freeze({
				itemId: e.itemId,
				pose: Object.freeze({
					origin: Object.freeze({
						x: e.pose.origin.x,
						y: e.pose.origin.y
					}),
					matrix: Object.freeze({
						a: e.pose.matrix.a,
						b: e.pose.matrix.b,
						c: e.pose.matrix.c,
						d: e.pose.matrix.d
					}),
					localWidth: e.pose.localWidth,
					localHeight: e.pose.localHeight
				}),
				representation: e.representation,
				...e.activeSegmentId === void 0 ? {} : { activeSegmentId: e.activeSegmentId },
				progress: e.progress
			})))
		};
	} };
}
function Vf(e, t, n, r) {
	return {
		get: () => {
			if (r()) return null;
			let t = e.getSnapshot();
			return t === void 0 ? null : {
				timeMs: t.timeMs,
				states: t.states.map((e) => ({
					target: {
						storyId: e.storyId,
						persoId: e.persoId
					},
					state: e.state
				}))
			};
		},
		set: (i) => {
			if (r()) return {
				ok: !1,
				code: "INSTANCE_DESTROYED"
			};
			try {
				let r = e.setSnapshot(i.map((e) => ({
					storyId: e.target.storyId,
					persoId: e.target.persoId,
					timeMs: e.timeMs,
					state: e.state
				})));
				return Hf(t, n, r), r;
			} catch (e) {
				throw K(t, "CODPLAY_SNAPSHOT_SET_FAILED", e, { instanceId: n }), e;
			}
		},
		clear: () => {
			if (!r()) try {
				e.clearSnapshot();
			} catch (e) {
				throw K(t, "CODPLAY_SNAPSHOT_CLEAR_FAILED", e, { instanceId: n }), e;
			}
		}
	};
}
function Hf(e, t, n) {
	n.ok || K(e, `CODPLAY_SNAPSHOT_${n.code}`, `Snapshot operation rejected: ${n.code}.`, { instanceId: t });
}
function Uf(e) {
	let t = Ff({ target: {
		getLifecycleState: () => e.player.getLifecycleState(),
		getCurrentTimeMs: () => e.player.getCurrentTimeMs(),
		getSequenceEnded: () => e.player.hasSequenceEnded(),
		getDurationMs: () => e.player.getDiscoveredDurationMs(),
		getRate: () => e.player.getRate(),
		subscribe: (t) => e.player.subscribeTransport(t),
		play: () => {
			e.runner.play(), e.onPlaybackStateChange("playing");
		},
		pause: () => {
			e.runner.pause(), e.onPlaybackStateChange("paused");
		},
		reset: () => {
			e.runner.reset(), e.onPlaybackStateChange("paused");
		},
		setRate: (t) => e.runner.setRate(t),
		seek: (t) => {
			let n = e.runner.seek(t);
			return Kf(e.diagnostics, e.instanceId, n.diagnostics), { ok: n.ok };
		}
	} }), n = e.player.getLifecycleState(), r = e.player.subscribeTransport(() => {
		let t = e.player.getLifecycleState();
		t !== n && (n = t, t === "paused" && e.onPlaybackStateChange("paused"));
	});
	return {
		api: {
			get commandInFlight() {
				return t.commandInFlight;
			},
			get rate() {
				return t.rate;
			},
			getState: () => qf(e.instanceId, t.getState()),
			getProgress: () => {
				let e = t.getState();
				return {
					timelineMs: e.timelineMs,
					durationMs: e.durationMs
				};
			},
			play: () => Gf(t.play(), e.diagnostics, e.instanceId),
			pause: () => Gf(t.pause(), e.diagnostics, e.instanceId),
			reset: () => Gf(t.reset(), e.diagnostics, e.instanceId),
			togglePlay: () => Gf(t.togglePlay(), e.diagnostics, e.instanceId),
			setRate: (n) => {
				try {
					t.setRate(n);
				} catch (t) {
					K(e.diagnostics, "CODPLAY_TELCO_RATE_FAILED", t, { instanceId: e.instanceId });
				}
			},
			seek: (n) => Gf(t.seek(n), e.diagnostics, e.instanceId),
			rewind: () => Gf(t.rewind(), e.diagnostics, e.instanceId),
			onChange: (n) => t.onChange((t) => {
				try {
					n(qf(e.instanceId, t));
				} catch (t) {
					K(e.diagnostics, "CODPLAY_TELCO_LISTENER_FAILED", t, { instanceId: e.instanceId });
				}
			}),
			onProgress: (n) => t.onProgress((t) => n(qf(e.instanceId, t)))
		},
		destroy: () => {
			r(), t.destroy();
		}
	};
}
function Wf(e, t, n, r) {
	return {
		emit: async (r, i) => {
			try {
				await e.emitEventime(r, i);
			} catch (e) {
				K(t, "CODPLAY_EVENTIME_EMIT_FAILED", e, { instanceId: n });
			}
		},
		onEvent: (e) => (r.add(e), () => {
			r.delete(e);
		})
	};
}
async function Gf(e, t, n) {
	let r = await e;
	r.ok || K(t, r.error.code, r.error.message, { instanceId: n });
}
function Kf(e, t, n) {
	e.publishReport(n, { instanceId: t });
}
function qf(e, t) {
	return {
		instanceId: e,
		...t
	};
}
//#endregion
//#region ../codplay/src/runtime/player/render-sync.ts
var Jf = class {
	adapters;
	lastNowMs = null;
	constructor(e) {
		this.adapters = e;
	}
	tick(e, t, n) {
		let r = this.lastNowMs === null ? 0 : e - this.lastNowMs;
		this.lastNowMs = e;
		let i = {
			nowMs: e,
			deltaMs: r,
			timelineMs: t,
			timelineDeltaMs: r * n,
			rate: n
		};
		for (let e of this.adapters) try {
			e.tick(i);
		} catch {}
	}
	prepareSeek() {
		for (let e of this.adapters) try {
			e.prepareSeek?.();
		} catch {}
	}
	seek(e, t) {
		this.lastNowMs = e;
		let n = {
			nowMs: e,
			timelineMs: t
		};
		for (let e of this.adapters) try {
			e.seek(n);
		} catch {}
	}
	pause() {
		for (let e of this.adapters) try {
			e.pause?.();
		} catch {}
	}
	resume() {
		this.lastNowMs = null;
		for (let e of this.adapters) try {
			e.resume?.();
		} catch {}
	}
	rateChange(e) {
		for (let t of this.adapters) try {
			t.rateChange?.(e);
		} catch {}
	}
	stop() {
		this.lastNowMs = null;
		for (let e of this.adapters) try {
			e.stop?.();
		} catch {}
	}
}, Yf = class e {
	declaration;
	startedAtMs;
	samples = [];
	captureState;
	status = "active";
	constructor(e, t, n) {
		this.declaration = e, this.startedAtMs = n, this.captureState = D(t);
	}
	static open(t) {
		let n = t.declaration.endEmit === void 0 ? void 0 : Xf(t.declaration.endEmit);
		if (n !== void 0) return {
			ok: !1,
			code: "RUNTIME_CAPTURE_EVENT_INVALID",
			message: n
		};
		let r = D(t.state), i = {};
		if (t.declaration.initCaptureState !== void 0) try {
			let e = t.declaration.initCaptureState({ state: rp(r) });
			if (e === !1) return {
				ok: !1,
				code: "RUNTIME_CAPTURE_REJECTED",
				message: "Capture initialization rejected the session."
			};
			i = D(e);
		} catch (e) {
			return {
				ok: !1,
				code: "RUNTIME_CAPTURE_INIT_FAILED",
				message: e instanceof Error ? e.message : "Capture initialization failed."
			};
		}
		return {
			ok: !0,
			session: new e(t.declaration, i, t.startedAtMs ?? 0)
		};
	}
	getStatus() {
		return this.status;
	}
	getCaptureState() {
		return rp(D(this.captureState));
	}
	getSamples() {
		return [...this.samples];
	}
	track(e) {
		if (this.status !== "active") return this.failure("RUNTIME_CAPTURE_CLOSED", "Capture session is no longer active.");
		this.samples.push(e);
		let t = this.declaration.trackCommand;
		if (t === void 0) return {
			ok: !0,
			updateState: void 0,
			captureState: this.getCaptureState(),
			sampleCount: this.samples.length
		};
		try {
			let n = t({
				sample: e,
				samples: this.getSamples(),
				captureState: this.getCaptureState()
			});
			return n?.captureState !== void 0 && (this.captureState = D(n.captureState)), {
				ok: !0,
				actions: n?.actions === void 0 ? void 0 : n.actions.map(ep),
				updateState: n?.updateState === void 0 ? void 0 : D(n.updateState),
				captureState: this.getCaptureState(),
				sampleCount: this.samples.length
			};
		} catch (e) {
			return this.failure("RUNTIME_CAPTURE_TRACK_FAILED", e instanceof Error ? e.message : "Capture tracking failed.");
		}
	}
	end(e, t = {}, n = this.startedAtMs, r) {
		if (this.status !== "active") return this.failure("RUNTIME_CAPTURE_CLOSED", "Capture session is no longer active.");
		if (!Number.isFinite(n) || n < this.startedAtMs) return this.failure("RUNTIME_CAPTURE_END_TIME_INVALID", "Capture end time must not precede its start time.");
		this.status = "ended";
		let i = rp(D(e)), a = rp(D(r ?? this.captureState)), o = this.getSamples(), s = [], c, l;
		if (this.declaration.endCapture !== void 0) {
			let e;
			try {
				e = this.declaration.endCapture({
					samples: o,
					captureState: a,
					state: i,
					meta: t
				});
			} catch (e) {
				return this.failure("RUNTIME_CAPTURE_END_FAILED", e instanceof Error ? e.message : "Capture end failed.");
			}
			let n = e?.events === void 0 ? [] : e.events;
			if (!Array.isArray(n)) return this.failure("RUNTIME_CAPTURE_END_EVENT_INVALID", "Capture end events must be an array.");
			for (let e of n) {
				let t = Xf(e);
				if (t !== void 0) return this.failure("RUNTIME_CAPTURE_END_EVENT_INVALID", t);
			}
			s = n, c = e?.duration, l = e?.durationMode;
		}
		let u = tp(l, c, this.startedAtMs, n), d = n - u, f = s.map((e) => Zf(e, d, l === "value" ? void 0 : u)), p = this.declaration.endEmit === void 0 ? void 0 : Qf(this.declaration.endEmit, a, n);
		return {
			ok: !0,
			events: [...f, ...p === void 0 ? [] : [p]],
			endCaptureEvents: f,
			endEmitEvent: p,
			samples: o,
			captureState: a,
			startedAtMs: this.startedAtMs,
			endedAtMs: n,
			resolvedDurationMs: u,
			endCaptureApplyAtMs: f.length === 0 ? void 0 : d,
			warnings: f.length > 0 || p !== void 0 ? [] : [{
				code: "CAPTURE_REPLAY_NOT_IDENTICAL",
				message: "Capture has no persistent end event; replay and seek may differ."
			}]
		};
	}
	cancel() {
		this.status === "active" && (this.status = "cancelled");
	}
	failure(e, t) {
		return {
			ok: !1,
			code: e,
			message: t
		};
	}
};
function Xf(e) {
	if (!T(e)) return "Capture event must be a plain object.";
	if (Object.hasOwn(e, "cascade")) return "Capture events use named visibility; cascade is not supported.";
	if (e.visibility !== void 0 && e.visibility !== "story" && e.visibility !== "scene" && e.visibility !== "public") return "Capture event visibility must be story, scene, or public.";
}
function Zf(e, t, n) {
	let r = $f(e);
	return {
		...r,
		data: n === void 0 ? r.data : np(r.data, n),
		source: "endCapture",
		applyAtMs: t,
		mode: Ql
	};
}
function Qf(e, t, n) {
	let r = e.data === void 0 ? D(t) : { ...D(e.data) };
	return r.captureState = D(t), {
		...e,
		data: r,
		source: "endEmit",
		applyAtMs: n,
		mode: e.mode ?? "apply-now"
	};
}
function $f(e) {
	return {
		...e,
		data: e.data === void 0 ? void 0 : D(e.data)
	};
}
function ep(e) {
	return {
		name: e.name,
		data: e.data === void 0 ? void 0 : D(e.data)
	};
}
function tp(e, t, n, r) {
	return e === "value" ? t ?? 200 : e === "capture" ? Math.max(1, r - n) : 200;
}
function np(e, t) {
	let n = e?.style;
	if (!T(n)) return e;
	let r = {};
	for (let [e, i] of Object.entries(n)) r[e] = T(i) && "to" in i && !("duration" in i) ? {
		...i,
		duration: t
	} : i;
	return {
		...e,
		style: r
	};
}
function rp(e) {
	for (let t of Object.values(e)) ip(t);
	return Object.freeze(e);
}
function ip(e) {
	if (Array.isArray(e)) {
		for (let t of e) ip(t);
		Object.freeze(e);
		return;
	}
	if (T(e)) {
		for (let t of Object.values(e)) ip(t);
		Object.freeze(e);
	}
}
//#endregion
//#region ../codplay/src/runtime/capture/compiled-capture.ts
function ap(e, t) {
	return {
		trackOn: e.trackOn,
		endOn: e.endOn,
		stateScope: e.stateScope,
		initCaptureState: e.initCaptureStateRef === void 0 ? void 0 : op(e.initCaptureStateRef.ref, t),
		trackCommand: e.trackCommandRef === void 0 ? void 0 : op(e.trackCommandRef.ref, t),
		endEmit: e.endEmit,
		endCapture: e.endCaptureRef === void 0 ? void 0 : op(e.endCaptureRef.ref, t)
	};
}
function op(e, t) {
	let n = t[e];
	if (n === void 0) throw Error(`Capture function is not available: ${e}`);
	return n;
}
//#endregion
//#region ../codplay/src/runtime/capture/capture-event-target.ts
function sp(e, t) {
	return e.visibility === "scene" || e.visibility === "public" ? { visibility: e.visibility } : {
		storyId: t,
		...e.visibility === void 0 ? {} : { visibility: e.visibility }
	};
}
//#endregion
//#region ../codplay/src/runtime/capture/capture-source-circuit.ts
var cp = class {
	player;
	rules = /* @__PURE__ */ new Map();
	identities = /* @__PURE__ */ new Map();
	sessions = /* @__PURE__ */ new Set();
	onError;
	nextCaptureId = 0;
	accepting = !0;
	destroyed = !1;
	constructor(e) {
		this.player = e.player, this.onError = e.onError, this.indexRules(e.compiledScene);
	}
	open(e, t = {}) {
		return !this.accepting || this.destroyed ? [] : (this.rules.get(dp(e.storyId, e.persoId, e.source)) ?? []).map((n) => {
			let r = new lp({
				captureId: `${e.storyId}:${e.persoId}:${e.source}:${this.nextCaptureId++}`,
				rule: n,
				input: e,
				callbacks: t,
				player: this.player,
				reportError: (e) => this.reportError(e, n),
				onClose: () => this.sessions.delete(r)
			});
			return this.sessions.add(r), r.start(), r;
		});
	}
	getEventTypes(e) {
		let t = /* @__PURE__ */ new Set();
		for (let n of this.rules.values()) for (let r of n) if (r.source === e) {
			t.add(e);
			for (let e of r.declaration.trackOn ?? ["pointermove"]) e.startsWith("pointer") && t.add(e);
			for (let e of r.declaration.endOn ?? ["pointerup"]) e.startsWith("pointer") && t.add(e);
		}
		return [...t];
	}
	resolveIdentity(e) {
		return this.identities.get(e);
	}
	hasRules(e) {
		return (this.rules.get(dp(e.storyId, e.persoId, e.source))?.length ?? 0) > 0;
	}
	cancelAll() {
		for (let e of [...this.sessions]) e.cancel();
	}
	suspend() {
		this.accepting = !1, this.cancelAll();
	}
	resume() {
		this.destroyed || (this.accepting = !0);
	}
	destroy() {
		this.suspend(), this.destroyed = !0;
	}
	indexRules(e) {
		for (let [t, n] of Object.entries(e.scene.stories)) for (let e of n.persos) {
			this.identities.set(`${t}:${e.id}`, {
				storyId: t,
				persoId: e.id
			});
			for (let [n, r] of Object.entries(e.emit ?? {})) {
				let i = up(r).flatMap((r) => r.capture === void 0 ? [] : [{
					storyId: t,
					persoId: e.id,
					source: n,
					event: r.event,
					declaration: r.capture
				}]);
				i.length > 0 && this.rules.set(dp(t, e.id, n), i);
			}
		}
	}
	reportError(e, t) {
		this.onError?.({
			error: e,
			storyId: t.storyId,
			persoId: t.persoId,
			source: t.source
		});
	}
}, lp = class {
	captureId;
	rule;
	input;
	callbacks;
	player;
	reportError;
	onClose;
	pendingSamples = [];
	captureState;
	opening;
	ending;
	endResult;
	endMeta = {};
	resolveCaptureState;
	endRequested = !1;
	started = !1;
	closed = !1;
	cancelled = !1;
	constructor(e) {
		this.captureId = e.captureId, this.rule = e.rule, this.input = e.input, this.callbacks = e.callbacks, this.player = e.player, this.reportError = e.reportError, this.onClose = e.onClose;
	}
	start() {
		this.opening !== void 0 || this.closed || (this.opening = this.openSession());
	}
	getCaptureState() {
		return this.captureState;
	}
	track(e) {
		if (!(this.closed || this.cancelled || this.endRequested)) {
			if (!this.started) {
				this.pendingSamples.push(e);
				return;
			}
			this.trackNow(e);
		}
	}
	route(e) {
		if (this.closed || this.cancelled || this.endRequested) return;
		let t = this.rule.declaration.trackOn ?? ["pointermove"];
		if ((this.rule.declaration.endOn ?? ["pointerup"]).includes(e.eventType)) {
			this.end(e.meta, e.resolveCaptureState);
			return;
		}
		if (t.includes(e.eventType)) {
			if (e.sample === void 0) {
				this.fail(/* @__PURE__ */ Error(`Capture source event has no sample: ${e.eventType}`));
				return;
			}
			this.track(e.sample);
		}
	}
	end(e = {}, t) {
		return this.ending === void 0 ? this.closed || this.cancelled ? Promise.resolve(void 0) : (this.endRequested = !0, this.endMeta = e, this.resolveCaptureState = t, this.ending = (async () => {
			if (await this.opening, this.closed) return this.endResult;
			if (!(this.cancelled || !this.started)) return this.endNow();
		})(), this.ending) : this.ending;
	}
	cancel() {
		if (!(this.closed || this.cancelled)) {
			if (this.cancelled = !0, this.pendingSamples.length = 0, this.started) {
				let e = this.player.cancelCapture(this.captureId);
				!e.ok && e.code !== "RUNTIME_CAPTURE_UNKNOWN" && this.reportError(Error(e.message));
			}
			this.close(!1);
		}
	}
	async openSession() {
		try {
			let e = this.rule.event;
			if (!(await this.player.emit({
				name: e.name,
				applyAtMs: this.player.getCurrentTimeMs(),
				...sp(e, this.rule.storyId),
				data: e.data,
				mode: e.mode,
				context: this.input.eventContext
			})).ok) throw Error(`Capture start event was rejected: ${e.name}`);
			if (this.cancelled || this.closed) return;
			let t = this.player.beginCompiledCapture({
				captureId: this.captureId,
				storyId: this.rule.storyId,
				declaration: this.rule.declaration
			});
			if (!t.ok) throw Error(t.message);
			this.started = !0, this.captureState = t.captureState, this.flushPendingSamples(), this.endRequested && !this.closed && !this.cancelled && await this.endNow();
		} catch (e) {
			this.fail(e);
		}
	}
	flushPendingSamples() {
		for (; this.pendingSamples.length > 0 && !this.closed && !this.cancelled;) {
			let e = this.pendingSamples.shift();
			e !== void 0 && this.trackNow(e);
		}
	}
	trackNow(e) {
		let t = this.player.trackCapture(this.captureId, e);
		if (!t.ok) {
			this.fail(Error(t.message));
			return;
		}
		this.captureState = t.captureState;
		try {
			this.callbacks.onTrack?.({
				captureId: this.captureId,
				storyId: this.rule.storyId,
				persoId: this.rule.persoId,
				sample: e,
				captureState: t.captureState
			});
		} catch (e) {
			this.reportError(e);
		}
	}
	async endNow() {
		if (this.closed || this.cancelled || !this.started) return;
		let e = this.captureState;
		if (e === void 0) {
			this.fail(/* @__PURE__ */ Error(`Capture state is unavailable: ${this.captureId}`));
			return;
		}
		try {
			e = this.resolveCaptureState?.(e) ?? e;
		} catch (e) {
			this.fail(e);
			return;
		}
		this.closed = !0;
		try {
			let t = await this.player.endCapture(this.captureId, this.endMeta, e);
			return t.ok || this.reportError(Error(t.message)), this.endResult = t, this.notifyClose(t.ok), t;
		} catch (e) {
			this.reportError(e), this.endResult = void 0, this.notifyClose(!1);
			return;
		}
	}
	fail(e) {
		if (!(this.closed || this.cancelled)) {
			if (this.reportError(e), this.started) {
				let e = this.player.cancelCapture(this.captureId);
				!e.ok && e.code !== "RUNTIME_CAPTURE_UNKNOWN" && this.reportError(Error(e.message));
			}
			this.close(!1);
		}
	}
	close(e) {
		this.closed || (this.closed = !0, this.notifyClose(e));
	}
	notifyClose(e) {
		this.onClose();
		try {
			this.callbacks.onClose?.({
				captureId: this.captureId,
				storyId: this.rule.storyId,
				persoId: this.rule.persoId,
				completed: e
			});
		} catch (e) {
			this.reportError(e);
		}
	}
};
function up(e) {
	return e === void 0 ? [] : Array.isArray(e) ? e : !fp(e) || !("event" in e) ? [] : [e];
}
function dp(e, t, n) {
	return JSON.stringify([
		e,
		t,
		n
	]);
}
function fp(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
//#endregion
//#region ../codplay/src/runtime/capture/sources/html-pointer-capture-source-adapter.ts
var pp = { capture: !0 }, mp = class {
	captureSources;
	nodes;
	eventTarget;
	onCaptureTrack;
	resolveEndCaptureState;
	onCaptureClose;
	groups = /* @__PURE__ */ new Map();
	listeners = /* @__PURE__ */ new Map();
	destroyed = !1;
	nextGroupId = 0;
	constructor(e) {
		this.captureSources = e.captureSources, this.nodes = e.nodes, this.eventTarget = e.eventTarget, this.onCaptureTrack = e.onCaptureTrack, this.resolveEndCaptureState = e.resolveEndCaptureState, this.onCaptureClose = e.onCaptureClose;
	}
	attach() {
		if (this.destroyed || this.eventTarget === void 0 || this.listeners.size > 0) return;
		let e = new Set(this.captureSources.getEventTypes("pointerdown"));
		for (let t of e) {
			let e = (e) => this.handleSourceEvent(e);
			this.listeners.set(t, e), this.eventTarget.addEventListener(t, e, pp);
		}
	}
	destroy() {
		if (!this.destroyed) {
			if (this.destroyed = !0, this.eventTarget !== void 0) for (let [e, t] of this.listeners) this.eventTarget.removeEventListener(e, t, pp);
			this.listeners.clear();
			for (let e of this.groups.values()) for (let t of e.sessions) t.cancel();
			this.groups.clear();
		}
	}
	handleSourceEvent(e) {
		if (!this.destroyed) {
			for (let t of [...this.groups.values()]) {
				if (!xp(t.pointerId, bp(e))) continue;
				let n = yp(e);
				for (let r of [...t.sessions]) r.route({
					eventType: e.type,
					...n === void 0 ? {} : { sample: n },
					meta: {
						source: "html-pointer",
						eventType: e.type
					},
					resolveCaptureState: (n) => this.resolveEndState(r, t, n, e)
				});
			}
			e.type === "pointerdown" && this.openCaptures(e);
		}
	}
	openCaptures(e) {
		let t = gp(this.nodes, e.target);
		if (t === void 0) return;
		let n = this.captureSources.resolveIdentity(t);
		if (n === void 0) return;
		let r = {
			id: this.nextGroupId++,
			persoKey: t,
			pointerId: bp(e),
			sessions: []
		}, i = /* @__PURE__ */ new Set(), a = this.captureSources.open(hp(n, "pointerdown"), {
			onTrack: (e) => {
				try {
					this.onCaptureTrack?.({
						captureId: e.captureId,
						persoKey: t,
						sample: e.sample,
						captureState: e.captureState
					});
				} catch (e) {
					throw e;
				}
			},
			onClose: (e) => {
				i.add(e.captureId);
				let n = this.groups.get(r.id) ?? r;
				n.sessions = n.sessions.filter((t) => t.captureId !== e.captureId);
				try {
					this.onCaptureClose?.({
						captureId: e.captureId,
						persoKey: t,
						completed: e.completed
					});
				} finally {
					n.sessions.length === 0 && this.groups.delete(n.id);
				}
			}
		});
		r.sessions.push(...a.filter((e) => !i.has(e.captureId))), r.sessions.length > 0 && this.groups.set(r.id, r);
	}
	resolveEndState(e, t, n, r) {
		return this.resolveEndCaptureState?.({
			captureId: e.captureId,
			persoKey: t.persoKey,
			captureState: n,
			event: r
		});
	}
};
function hp(e, t) {
	return {
		...e,
		source: t
	};
}
function gp(e, t) {
	let n = t, r = /* @__PURE__ */ new Set();
	for (; n != null && !r.has(n);) {
		r.add(n);
		for (let [t, r] of e.persoNodes) for (let e of _p(r)) if (e === n) return t;
		if (!vp(n)) break;
		n = n.parentNode;
	}
}
function _p(e) {
	return e == null ? [] : Array.isArray(e) ? e : [e];
}
function vp(e) {
	return typeof e == "object" && !!e && "parentNode" in e;
}
function yp(e) {
	let t = e;
	if (!(!E(t.clientX) || !E(t.clientY) || !E(t.movementX) || !E(t.movementY))) return {
		clientX: t.clientX,
		clientY: t.clientY,
		movementX: t.movementX,
		movementY: t.movementY
	};
}
function bp(e) {
	let t = e.pointerId;
	return E(t) ? t : void 0;
}
function xp(e, t) {
	return e === void 0 || t === void 0 || e === t;
}
//#endregion
//#region ../codplay/src/runtime/player/live-actions/action-target-index.ts
function Sp(e) {
	let t = /* @__PURE__ */ new Map();
	for (let [n, r] of Object.entries(e.actionTargetIndex)) {
		let i = [];
		for (let t of r) {
			let r = (e.scene.stories[t.storyId]?.persos.find((e) => e.id === t.persoId))?.actions[n];
			r !== void 0 && i.push({
				persoKey: `${t.storyId}:${t.persoId}`,
				actionValue: r
			});
		}
		t.set(n, i);
	}
	return t;
}
//#endregion
//#region ../codplay/src/runtime/player/capture/state-updates.ts
function Cp(e, t, n) {
	e.applyUpdate(t.stateScope === "scene" ? I : Ba, n, t.stateScope === "story" ? t.storyId : void 0);
}
function wp(e, t, n) {
	for (let [r, i] of t) {
		let t = n.get(r);
		t !== void 0 && Cp(e, t, i);
	}
}
function Tp(e, t) {
	for (let t of e.values()) t.session.cancel();
	e.clear(), t.clear();
}
//#endregion
//#region ../codplay/src/runtime/player/live-actions/apply-live-actions.ts
function Ep(e, t, n, r, i) {
	if (e === void 0 || t === void 0) return /* @__PURE__ */ new Set();
	let a = /* @__PURE__ */ new Map();
	for (let t of n.values()) for (let n of t) for (let t of n.targets) {
		let r = e.persos[t.persoKey];
		if (r === void 0) continue;
		let o = _l(a.get(t.persoKey) ?? r.state, t.actionValue, n.action.data, i);
		o !== void 0 && a.set(t.persoKey, o);
	}
	let o = /* @__PURE__ */ new Set([...r, ...a.keys()]);
	for (let n of o) {
		let r = e.persos[n];
		r !== void 0 && t.updateLive(n, a.get(n) ?? r.state, e.timeMs);
	}
	return new Set(a.keys());
}
//#endregion
//#region ../codplay/src/runtime/player/runtime-player/capture-controller.ts
var Dp = class {
	captureSessions = /* @__PURE__ */ new Map();
	liveCaptureStateUpdates = /* @__PURE__ */ new Map();
	context;
	constructor(e) {
		this.context = e;
	}
	begin(e) {
		if (this.context.requireCaptureState(), e.captureId.trim().length === 0) return {
			ok: !1,
			code: "RUNTIME_CAPTURE_ID_INVALID",
			message: "Capture id must not be empty."
		};
		if (this.captureSessions.has(e.captureId)) return {
			ok: !1,
			code: "RUNTIME_CAPTURE_DUPLICATE",
			message: `Capture session is already open: ${e.captureId}`
		};
		let t = e.declaration.stateScope ?? "story", n = this.context.getStateStore(), r = t === "scene" ? n.snapshot(I) : n.snapshot(Ba, e.storyId), i = Yf.open({
			declaration: e.declaration,
			state: r,
			startedAtMs: this.context.getCurrentTimeMs()
		});
		return i.ok ? (this.captureSessions.set(e.captureId, {
			storyId: e.storyId,
			stateScope: t,
			session: i.session
		}), {
			ok: !0,
			captureId: e.captureId,
			captureState: i.session.getCaptureState()
		}) : i;
	}
	beginCompiled(e) {
		let t;
		try {
			t = ap(e.declaration, this.context.functions);
		} catch (e) {
			return {
				ok: !1,
				code: "RUNTIME_CAPTURE_FUNCTION_UNAVAILABLE",
				message: e instanceof Error ? e.message : "Capture function is not available."
			};
		}
		return this.begin({
			captureId: e.captureId,
			storyId: e.storyId,
			declaration: t
		});
	}
	track(e, t) {
		let n = this.captureSessions.get(e);
		if (n === void 0) return Op(e);
		let r = n.session.track(t);
		if (!r.ok) return r;
		if (r.updateState !== void 0) {
			let t = {
				...this.liveCaptureStateUpdates.get(e) ?? {},
				...r.updateState
			};
			this.liveCaptureStateUpdates.set(e, t), Cp(this.context.getStateStore(), n, r.updateState);
		}
		try {
			this.context.liveActions.setLiveActions(e, r.actions);
		} catch (e) {
			return {
				ok: !1,
				code: "RUNTIME_CAPTURE_LIVE_APPLY_FAILED",
				message: e instanceof Error ? e.message : "Live capture application failed."
			};
		}
		return r;
	}
	async end(e, t = {}, n) {
		let r = this.captureSessions.get(e);
		if (r === void 0) return Op(e);
		let i = this.context.getStateStore(), a = r.stateScope === "scene" ? i.snapshot(I) : i.snapshot(Ba, r.storyId), o = r.session.end(a, t, this.context.getCurrentTimeMs(), n);
		if (this.context.liveActions.setLiveActions(e, void 0), !o.ok) return this.removeCapture(e), this.context.synchronizeState(), o;
		let s = [], c = o.endCaptureEvents.length > 0;
		try {
			for (let e of o.endCaptureEvents) s.push(await this.context.emitEvent({
				name: e.name,
				applyAtMs: e.applyAtMs,
				...sp(e, r.storyId),
				data: e.data,
				mode: e.mode,
				meta: t
			}, !1));
			if (o.endEmitEvent !== void 0) {
				let e = o.endEmitEvent;
				s.push(await this.context.emitEvent({
					name: e.name,
					applyAtMs: e.applyAtMs,
					...sp(e, r.storyId),
					data: e.data,
					mode: e.mode,
					meta: t
				}, c || e.mode === "persist-only" ? !1 : void 0));
			}
		} finally {
			this.removeCapture(e), this.context.synchronizeState();
		}
		return {
			...o,
			dispatchResults: s
		};
	}
	cancel(e) {
		let t = this.captureSessions.get(e);
		return t === void 0 ? Op(e) : (t.session.cancel(), this.removeCapture(e), this.context.synchronizeState(), { ok: !0 });
	}
	cancelAll() {
		this.context.liveActions.removeSources(this.captureSessions.keys()), Tp(this.captureSessions, this.liveCaptureStateUpdates);
	}
	removeCapture(e) {
		this.captureSessions.delete(e), this.context.liveActions.setLiveActions(e, void 0), this.liveCaptureStateUpdates.delete(e);
	}
};
function Op(e) {
	return {
		ok: !1,
		code: "RUNTIME_CAPTURE_UNKNOWN",
		message: `Capture session is not open: ${e}`
	};
}
//#endregion
//#region ../codplay/src/runtime/player/live-actions/live-action-controller.ts
var kp = class {
	compiledTargets;
	context;
	sourceActions = /* @__PURE__ */ new Map();
	livePersoKeys = /* @__PURE__ */ new Set();
	constructor(e) {
		this.context = e, this.compiledTargets = Sp(e.compiledScene);
	}
	setLiveActions(e, t) {
		if (t === void 0 || t.length === 0) {
			if (!this.sourceActions.has(e)) return;
			this.sourceActions.delete(e);
		} else this.sourceActions.set(e, t.map((e) => ({
			action: e,
			targets: this.compiledTargets.get(e.name) ?? []
		})));
		this.reapply();
	}
	removeSources(e) {
		let t = !1;
		for (let n of e) t = this.sourceActions.delete(n) || t;
		t && this.reapply();
	}
	reapply(e) {
		this.livePersoKeys = Ep(e ?? this.context.getSolvedScene(), this.context.componentRuntime, this.sourceActions, this.livePersoKeys, this.context.functions);
	}
	clear() {
		this.sourceActions.clear(), this.livePersoKeys.clear();
	}
};
//#endregion
//#region ../codplay/src/runtime/player/modules/runtime-player-modules.ts
function Ap(e, t) {
	for (let n of e.values()) n.initializeScene?.(t);
}
function jp(e, t, n) {
	for (let r of e.values()) r.onScenePresented?.(t, n);
}
function Mp(e, t, n) {
	for (let r of e.values()) r.onPlaybackStateChange?.(t, n);
}
function Np(e, t) {
	for (let n of e.values()) n.onRateChange?.(t);
}
function Pp(e, t) {
	let n = t;
	for (let t of e.values()) {
		let e = t.resolveTimelineMs?.(n);
		e !== void 0 && Number.isFinite(e) && e >= 0 && (n = e);
	}
	return n;
}
function Fp(e, t, n, r) {
	let i = t, a = !1;
	for (let t of e.values()) {
		let e = t.resolveStructuralOrder;
		e !== void 0 && (i = e(i, n, r), a = !0);
	}
	return a ? i : wa(i, n, r);
}
function Ip(e, t, n, r = /* @__PURE__ */ new Set(), i = t === void 0 ? [] : ia(t, n)) {
	if (t !== void 0) for (let t of i) for (let n of e.values()) r.has(n) || n.onMoveDelta?.(t);
}
function Lp(e) {
	for (let { handle: t } of [...e].reverse()) t.abort?.();
	e.length = 0;
}
//#endregion
//#region ../codplay/src/runtime/player/runtime-player/eventime-routing.ts
function Rp(e, t) {
	if (t.scope === "scene") {
		if (t.storyId !== void 0) throw Error("Scene eventime target must not contain storyId.");
		return { trackId: t.trackId ?? "global" };
	}
	if (t.storyId === void 0) throw Error("Story eventime target requires storyId.");
	let n = e.scene.stories[t.storyId];
	if (n === void 0) throw Error(`Eventime story is not declared: ${t.storyId}`);
	return {
		trackId: t.trackId ?? n.trackId ?? n.id,
		storyId: n.id
	};
}
function zp(e, t, n) {
	return n.scope !== "story" || n.storyId === void 0 || t.startAt !== void 0 && t.startAt !== 0 || t.events !== void 0 && t.events.length > 0 || t.visibility === "scene" || t.visibility === "public" ? !1 : e.scene.stories[n.storyId]?.listen.some((e) => e.on === t.name) === !0;
}
function Bp(e, t) {
	if (e.name.trim().length === 0) throw Error("Eventime name must not be empty.");
	let n = e.startAt ?? (t ? 0 : void 0);
	if (n === void 0 || !Number.isFinite(n) || n < 0) throw Error("Eventime startAt must be finite and non-negative; only the root may omit it.");
	if (e.visibility !== void 0 && e.visibility !== "story" && e.visibility !== "scene" && e.visibility !== "public") throw Error(`Eventime visibility is invalid: ${e.visibility}`);
	let r = e.events?.map((e) => Bp(e, !1).eventime);
	return {
		eventime: {
			name: e.name,
			startAt: n,
			visibility: e.visibility,
			data: e.data === void 0 ? void 0 : D(e.data),
			events: r
		},
		mode: e.mode
	};
}
function Vp(e) {
	return e.startAt === void 0 && (e.events === void 0 || e.events.length === 0) && (e.name === "track:activate" || e.name === "track:deactivate" || e.name === "track:toggle");
}
//#endregion
//#region ../codplay/src/runtime/player/runtime-player/sequence-end.ts
var Hp = "sequence:end";
function Up(e, t, n, r, i = 0, a = []) {
	return e.flatMap((e, o) => {
		let s = i + e.startAt, c = [...a, o];
		return [...e.name === "sequence:end" ? [{
			kind: "compiled",
			event: e,
			applyAtMs: s,
			trackId: n,
			...r === void 0 ? {} : { storyId: r },
			eventId: Za(t, n, r, c)
		}] : [], ...Up(e.events ?? [], t, n, r, s, c)];
	});
}
function Wp(e, t) {
	return e.applyAtMs === t.applyAtMs ? e.kind === "journal" && t.kind === "journal" ? e.event.eventSeq - t.event.eventSeq : e.kind === "journal" ? 1 : t.kind === "journal" ? -1 : e.eventId.localeCompare(t.eventId) : e.applyAtMs - t.applyAtMs;
}
function Gp(e, t, n) {
	return e > n ? !1 : t === void 0 ? e === n : e >= t;
}
//#endregion
//#region ../codplay/src/runtime/player/runtime-player/event-controller.ts
var Kp = class {
	context;
	compiledTraceEvents;
	nextCompiledTraceIndex = 0;
	nextRuntimeEventId = 0;
	observedPublicEventIds = /* @__PURE__ */ new Set();
	observedTraceEventIds = /* @__PURE__ */ new Set();
	constructor(e) {
		this.context = e, this.compiledTraceEvents = oo(e.compiledScene);
	}
	resetForReplay() {
		this.observedPublicEventIds.clear(), this.observedTraceEventIds.clear(), this.nextCompiledTraceIndex = 0;
	}
	async emit(e) {
		return this.emitEvent(e);
	}
	async emitEventime(e, t) {
		let { state: n } = this.context;
		this.context.requireState("ready", "playing", "paused"), this.context.requireSequenceActive("emitEventime");
		let r = Bp(e, !0), i = Rp(this.context.compiledScene, t);
		if (zp(this.context.compiledScene, e, t) || Vp(e)) {
			let t = await this.emitEvent({
				name: e.name,
				applyAtMs: n.currentTimeMs,
				trackId: i.trackId,
				storyId: i.storyId,
				visibility: r.eventime.visibility,
				data: r.eventime.data,
				mode: r.mode
			});
			if (!t.ok) throw Error(t.issues.map((e) => e.message).join(" "));
			return { events: t.events };
		}
		let a = this.context.trackJournal.appendAnchoredEventimes({
			trackId: i.trackId,
			storyId: i.storyId,
			anchorMs: n.currentTimeMs,
			eventimes: [r.eventime],
			mode: r.mode
		});
		if (!a.ok) throw Error(a.message);
		this.context.idleMonitor.reset(), n.includePersistOnlyInCurrent = r.mode !== Ql, r.mode === "persist-only" && this.context.sceneState.synchronize(n.currentTimeMs, !1), this.notifyTraceEvents(a.data.events), this.context.journalChangeListener?.();
		let o = r.mode === "persist-only" ? [] : this.resolvePresentedResetStoryIds(a.data.events);
		if (o.length > 0 && n.solvedScene !== void 0) {
			let e = n.solvedScene, t = this.context.sceneState.reconstruct(n.currentTimeMs, n.includePersistOnlyInCurrent, n.snapshotContribution), r = ia(e, t);
			this.context.sceneState.synchronizeFromScene(t), Ip(this.context.moduleServiceInstances, e, t, /* @__PURE__ */ new Set(), r), n.solvedScene = t, this.context.presentation.present(t, {
				previousScene: e,
				moveDeltas: r,
				resetStoryIds: o
			}), this.context.notifyTransportObservers();
		}
		return a.data;
	}
	async emitEvent(e, t, n = !0, r, i, a) {
		let { state: o } = this.context;
		this.context.requireState("ready", "playing", "paused"), this.context.requireSequenceActive("emit");
		let s = {
			...e,
			applyAtMs: e.applyAtMs ?? o.currentTimeMs
		};
		o.lifecycle === "playing" && s.mode !== "persist-only" && s.name === "sequence:end" && (o.sequenceEndPending = !0), this.context.sceneState.synchronize(o.currentTimeMs, o.includePersistOnlyInCurrent);
		let c = new pu({
			scene: this.context.compiledScene,
			journal: this.context.trackJournal,
			strapCollections: this.context.strapCollections,
			functions: this.context.functions,
			stateStore: this.context.stateStore,
			eventIdFactory: () => this.createRuntimeEventId()
		});
		try {
			let e = await c.dispatch(s, r);
			if (this.notifyTraceEvents(r === void 0 ? e.events : e.events.filter((e) => e.eventId !== r.eventId)), n && e.events.length > 0 && this.context.idleMonitor.reset(), t === void 0 ? s.mode === "persist-only" && (o.includePersistOnlyInCurrent = !1) : o.includePersistOnlyInCurrent = t, this.context.sceneState.synchronize(o.currentTimeMs, o.includePersistOnlyInCurrent), s.mode === "persist-only") return o.sequenceEndPending = !1, e;
			let l = this.resolveSequenceEndEventTime(e.events, o.currentTimeMs);
			o.lifecycle === "playing" && l !== void 0 && (o.currentTimeMs = Math.min(o.currentTimeMs, l));
			let u = this.context.sceneState.reconstruct(o.currentTimeMs, o.includePersistOnlyInCurrent, o.snapshotContribution), d = o.solvedScene, f = d === void 0 ? [] : ia(d, u), p = this.resolvePresentedResetStoryIds(e.events), m = e.isolationClosedStoryIds ?? [];
			return Ip(this.context.moduleServiceInstances, d, u, /* @__PURE__ */ new Set(), f), o.solvedScene = u, this.context.presentation.present(u, {
				previousScene: d,
				moveDeltas: f,
				...p.length === 0 ? {} : { resetStoryIds: p },
				...m.length === 0 ? {} : { isolationClosedStoryIds: m }
			}), i !== void 0 && this.context.renderSync.tick(i.nowMs, o.currentTimeMs, o.rate), this.context.notifyTransportObservers(), o.lifecycle === "playing" && l !== void 0 ? (this.notifyPublicEvents(a ?? o.currentTimeMs, o.currentTimeMs), this.finalizeSequenceEnd(l)) : o.sequenceEndPending = !1, e;
		} catch (e) {
			throw o.sequenceEndPending = !1, e;
		}
	}
	onEngineFrame(e) {
		let { state: t } = this.context;
		if (t.lifecycle !== "playing" || t.sequenceEnded || t.sequenceEndPending) return;
		if (t.skipNextDelta) {
			t.skipNextDelta = !1, this.context.renderSync.tick(e.nowMs, t.currentTimeMs, t.rate);
			return;
		}
		let n = t.currentTimeMs;
		if (t.currentTimeMs += e.deltaMs * t.rate, this.context.idleMonitor.advance(e.deltaMs) && this.dispatchIdleEvent(), t.sequenceEndPending) return;
		t.currentTimeMs = Pp(this.context.moduleServiceInstances, t.currentTimeMs), t.discoveredDurationMs = Math.max(t.discoveredDurationMs, t.currentTimeMs);
		let r = this.findSequenceEndBetween(n, t.currentTimeMs);
		if (r !== void 0) {
			t.currentTimeMs = r.applyAtMs, t.discoveredDurationMs = Math.max(t.discoveredDurationMs, t.currentTimeMs), this.dispatchReachedSequenceEnd(r, e, n).catch((e) => {
				this.reportAutomaticSequenceEndFailure(e);
			});
			return;
		}
		let i = this.context.sceneState.resolveFrame(n, t.currentTimeMs, t.includePersistOnlyInCurrent, t.solvedScene, t.snapshotContribution), a = i.scene, o = t.solvedScene, s = i.reconstructed && o !== void 0 ? ia(o, a) : [];
		i.reconstructed && (this.context.sceneState.synchronizeFromScene(a), Ip(this.context.moduleServiceInstances, o, a, /* @__PURE__ */ new Set(), s)), t.solvedScene = a, this.context.presentation.present(a, {
			previousScene: o,
			moveDeltas: s
		}), this.notifyReachedCompiledEvents(n, t.currentTimeMs), this.notifyPublicEvents(o?.timeMs ?? t.currentTimeMs, t.currentTimeMs), this.context.renderSync.tick(e.nowMs, t.currentTimeMs, t.rate), this.context.notifyTransportObservers();
	}
	findSequenceEndAt(e) {
		return this.findSequenceEndBetween(void 0, e);
	}
	async dispatchReachedSequenceEnd(e, t, n) {
		this.notifyReachedCompiledEvents(n ?? e.applyAtMs, e.applyAtMs);
		let r = e.kind === "journal" ? e.event : void 0, i = await this.emitEvent(e.kind === "journal" ? {
			name: e.event.name,
			applyAtMs: e.event.applyAtMs,
			eventId: e.event.eventId,
			trackId: e.event.trackId,
			storyId: e.event.storyId,
			data: e.event.data,
			visibility: e.event.visibility,
			context: e.event.context,
			meta: e.event.meta,
			mode: e.event.mode
		} : {
			name: e.event.name,
			applyAtMs: e.applyAtMs,
			eventId: e.eventId,
			trackId: e.trackId,
			storyId: e.storyId,
			data: e.event.data,
			visibility: e.event.visibility
		}, void 0, !1, r, t, n);
		i.ok || this.reportAutomaticSequenceEndFailure(Error(i.issues.map((e) => e.message).join(" ") || "Reached sequence:end was rejected."));
	}
	reportAutomaticSequenceEndFailure(e) {
		new z({ output: this.context.diagnosticOutput }).error("RUNTIME_SEQUENCE_END_FAILED", e instanceof Error ? e.message : "Reached sequence:end failed.", { context: {
			eventName: Hp,
			source: "playback"
		} });
	}
	finalizeSequenceEnd(e) {
		let { state: t } = this.context;
		t.sequenceEnded || (t.sequenceEndPending = !1, t.sequenceEnded = !0, this.context.captureController.cancelAll(), this.context.idleMonitor.reset(), t.currentTimeMs = Math.max(0, Math.min(t.currentTimeMs, e)), t.discoveredDurationMs = Math.max(t.discoveredDurationMs, t.currentTimeMs), this.context.renderSync.pause(), t.lifecycle = "paused", Mp(this.context.moduleServiceInstances, "paused", t.currentTimeMs), this.context.invokeSceneLifecycleHook("onSequenceEnd"), this.context.notifyTransportObservers());
	}
	dispatchIdleEvent() {
		let e = this.context.idleMonitor.getEvent();
		if (e === void 0) return;
		let { state: t } = this.context;
		this.emitEvent({
			name: e.name,
			applyAtMs: t.currentTimeMs,
			data: e.data,
			visibility: e.visibility,
			storyId: e.storyId,
			context: { source: "idle" }
		}, void 0, !1).then((t) => {
			t.ok || new z({ output: this.context.diagnosticOutput }).error("RUNTIME_IDLE_EVENT_FAILED", t.issues.map((e) => e.message).join(" ") || "Configured idle event was rejected.", { context: {
				eventName: e.name,
				source: "idle"
			} });
		}).catch((t) => {
			new z({ output: this.context.diagnosticOutput }).error("RUNTIME_IDLE_EVENT_FAILED", t instanceof Error ? t.message : "Configured idle event failed.", { context: {
				eventName: e.name,
				source: "idle"
			} });
		});
	}
	findSequenceEndBetween(e, t) {
		let n = [], { compiledScene: r, trackJournal: i } = this.context;
		if (i.isTrackActive("global")) for (let a of Up(r.scene.eventimes ?? [], "scene", Va, void 0)) a.kind === "compiled" && (i.getEvents(a.trackId).some((e) => e.eventId === a.eventId) || Gp(a.applyAtMs, e, t) && n.push(a));
		for (let a of Object.values(r.scene.stories)) {
			let r = no(a);
			if (i.isTrackActive(r)) for (let o of Up(a.eventimes ?? [], "story", r, a.id)) o.kind === "compiled" && (i.getEvents(o.trackId).some((e) => e.eventId === o.eventId) || Gp(o.applyAtMs, e, t) && n.push(o));
		}
		for (let r of i.getAllEvents()) r.name !== "sequence:end" || r.mode === "persist-only" || !i.isTrackActive(r.trackId) || Gp(r.applyAtMs, e, t) && n.push({
			kind: "journal",
			event: r,
			applyAtMs: r.applyAtMs
		});
		if (n.length !== 0) return n.sort(Wp)[0];
	}
	resolveSequenceEndEventTime(e, t) {
		let n = e.filter((e) => e.name === "sequence:end" && e.mode !== "persist-only" && e.applyAtMs <= t && this.context.trackJournal.isTrackActive(e.trackId)).map((e) => e.applyAtMs);
		if (n.length !== 0) return Math.min(...n);
	}
	resolvePresentedResetStoryIds(e) {
		let { state: t, compiledScene: n, trackJournal: r } = this.context, i = /* @__PURE__ */ new Set();
		for (let a of e) if (!(a.applyAtMs > t.currentTimeMs || a.mode === "persist-only" || !r.isTrackActive(a.trackId))) for (let e of Object.keys(n.scene.stories)) r.isStoryResetEvent(e, a) && i.add(e);
		return [...i];
	}
	notifyTraceEvents(e) {
		let t = this.context.traceEventListener;
		if (t !== void 0) {
			for (let n of e) if (!this.observedTraceEventIds.has(n.eventId)) {
				this.observedTraceEventIds.add(n.eventId);
				try {
					t(n);
				} catch {}
			}
		}
	}
	notifyReachedCompiledEvents(e, t) {
		let n = [];
		for (; this.nextCompiledTraceIndex < this.compiledTraceEvents.length;) {
			let r = this.compiledTraceEvents[this.nextCompiledTraceIndex];
			if (r.applyAtMs > t) break;
			this.nextCompiledTraceIndex += 1, !(r.applyAtMs < e || r.name === "sequence:end" || !this.context.trackJournal.isTrackActive(r.trackId)) && n.push(r);
		}
		this.notifyTraceEvents(n);
	}
	notifyPublicEvents(e, t) {
		let n = this.context.publicEventListener;
		if (n !== void 0) for (let r of this.context.trackJournal.getAllEvents()) r.visibility !== "public" || r.applyAtMs > t || r.applyAtMs < e || this.observedPublicEventIds.has(r.eventId) || (this.observedPublicEventIds.add(r.eventId), n(r));
	}
	createRuntimeEventId() {
		let e = this.nextRuntimeEventId;
		return this.nextRuntimeEventId += 1, `runtime-dispatch:${this.context.compiledScene.scene.id}:${e}`;
	}
};
//#endregion
//#region ../codplay/src/runtime/player/diagnostics/solved-move-diagnostics.ts
function qp(e, t) {
	for (let n of e.moveIssues) t.warning(n.code, n.message, { refs: { sceneId: e.scene.scene.id } });
}
function Jp(e) {
	let t = new z({ output: () => void 0 });
	return qp(e, t), t.report();
}
function Yp() {
	return {
		all: [],
		warnings: [],
		errors: []
	};
}
//#endregion
//#region ../codplay/src/runtime/player/runtime-player/lifecycle-controller.ts
var Xp = class {
	context;
	constructor(e) {
		this.context = e;
	}
	init() {
		let { context: e } = this, t = new z({ output: e.diagnosticOutput });
		if (e.state.lifecycle !== "idle") return t.error("RUNTIME_PLAYER_STATE_INVALID", "Player can only be initialized from idle state.", { context: { state: e.state.lifecycle } }), {
			ok: !1,
			diagnostics: t.report()
		};
		for (let n of eo(e.compiledScene, e.strapCollections, e.functions)) t.warning(n.code, n.message, { context: {
			scope: n.scope,
			storyId: n.storyId,
			strapName: n.strapName
		} });
		if (e.engine.validateRequirements(e.compiledScene.requirements, t), t.hasErrors()) return {
			ok: !1,
			diagnostics: t.report()
		};
		try {
			let t = e.engine.createModuleServiceInstances(e.id, e.compiledScene, e.compiledScene.requirements.modules, { componentSurfaces: e.componentRuntime?.getComponentSurfaces() });
			e.moduleServiceInstances.clear();
			for (let [n, r] of t) e.moduleServiceInstances.set(n, r);
		} catch (e) {
			return t.error("RUNTIME_MODULE_INIT_FAILED", e instanceof Error ? e.message : "Runtime module initialization failed."), {
				ok: !1,
				diagnostics: t.report()
			};
		}
		if (e.componentRuntime?.setModuleServices(e.moduleServiceInstances), !this.invokeSceneLifecycleHook("init", t)) return {
			ok: !1,
			diagnostics: t.report()
		};
		let n = e.sceneState.reconstructBase(0);
		return e.componentRuntime?.sync(n), Ap(e.moduleServiceInstances, n), Np(e.moduleServiceInstances, e.state.rate), e.state.solvedScene = e.sceneState.reconstruct(0), e.sceneState.synchronizeFromScene(e.state.solvedScene), e.presentation.present(e.state.solvedScene, { moveDeltas: [] }), qp(e.state.solvedScene, t), e.engine.registerInstance(e.id, e.onEngineFrame, {
			validateSeek: (t) => e.seekController.validate(t),
			getSeekDiagnostics: () => e.seekController.getDiagnostics(),
			abortSeek: () => e.seekController.abort(),
			prepareSeek: () => e.renderSync.prepareSeek(),
			commitSeek: (t) => e.seekController.commit(t),
			presentSeek: () => e.seekController.present(),
			rollbackSeek: () => e.seekController.rollback()
		}), e.state.lifecycle = jf, {
			ok: !0,
			diagnostics: t.report()
		};
	}
	play() {
		let { context: e } = this;
		if (e.state.sequenceEnded && this.resetToInitialState(), this.requireState(jf, Nf), e.state.lifecycle === "ready" && !this.invokeSceneLifecycleHook("onStart")) throw Error("RUNTIME_SCENE_LIFECYCLE_FAILED: scene onStart hook failed.");
		e.idleMonitor.reset(), e.state.lifecycle === "paused" && (e.state.skipNextDelta = !0, e.renderSync.resume()), e.state.lifecycle = Mf, Mp(e.moduleServiceInstances, "playing", e.state.currentTimeMs);
		let t = e.eventController.findSequenceEndAt(e.state.currentTimeMs);
		t !== void 0 && (e.state.currentTimeMs = t.applyAtMs, e.state.discoveredDurationMs = Math.max(e.state.discoveredDurationMs, e.state.currentTimeMs), e.eventController.dispatchReachedSequenceEnd(t).catch((t) => e.eventController.reportAutomaticSequenceEndFailure(t)));
	}
	pause() {
		let { context: e } = this;
		this.requireSequenceActive("pause"), this.requireState(Mf), e.renderSync.pause(), e.state.lifecycle = Nf, Mp(e.moduleServiceInstances, "paused", e.state.currentTimeMs);
	}
	reset() {
		let { context: e } = this;
		this.requireState(jf, Nf, Mf), e.state.lifecycle === "playing" && (e.renderSync.pause(), e.state.lifecycle = Nf, Mp(e.moduleServiceInstances, "paused", e.state.currentTimeMs)), this.resetToInitialState();
	}
	setRate(e) {
		let { context: t } = this;
		if (this.requireState(jf, Nf, Mf), !Number.isFinite(e) || e <= 0) throw Error("Player rate must be a finite positive number.");
		t.state.rate = e, t.renderSync.rateChange(e), Np(t.moduleServiceInstances, e);
	}
	getRate() {
		return this.context.state.rate;
	}
	seek(e) {
		let t = new z({ output: () => void 0 });
		try {
			let n = this.context.engine.seek([{
				instanceId: this.context.id,
				timeMs: e
			}]);
			return this.context.idleMonitor.reset(), {
				ok: !0,
				timeMs: e,
				diagnostics: n.diagnostics[this.context.id] ?? t.report()
			};
		} catch (n) {
			return t.error("RUNTIME_SEEK_FAILED", n instanceof Error ? n.message : "Runtime seek failed."), {
				ok: !1,
				timeMs: e,
				diagnostics: t.report()
			};
		}
	}
	destroy() {
		let { context: e } = this;
		if (e.state.lifecycle !== "destroyed") {
			e.captureController.cancelAll(), e.seekController.abort();
			for (let t of e.moduleServiceInstances.values()) t.destroy?.();
			e.moduleServiceInstances.clear(), e.engine.unregisterInstance(e.id), e.renderSync.stop(), e.materializer?.destroy?.(), e.componentRuntime?.destroy(), e.state.lifecycle = Pf;
		}
	}
	requireState(...e) {
		if (!e.includes(this.context.state.lifecycle)) throw Error(`Player cannot perform this operation from ${this.context.state.lifecycle} state.`);
	}
	requireSequenceActive(e) {
		if (this.context.state.sequenceEnded) throw Error(`PLAYER_SEQUENCE_ENDED: ${e} is not allowed after sequence:end.`);
	}
	invokeSceneLifecycleHook(e, t = new z({ output: this.context.diagnosticOutput })) {
		let n = this.context.compiledScene.scene[e];
		if (n === void 0) return !0;
		let r = this.context.functions[n.ref];
		if (r === void 0) return t.error("RUNTIME_SCENE_LIFECYCLE_UNAVAILABLE", `Scene lifecycle function is unavailable: ${e}.`, { context: {
			sceneId: this.context.compiledScene.scene.id,
			hookName: e,
			functionRef: n.ref
		} }), !1;
		try {
			let e = this.context.compiledScene.scene;
			return r(e, { schedule: () => void 0 }), !0;
		} catch (r) {
			return t.error("RUNTIME_SCENE_LIFECYCLE_FAILED", r instanceof Error ? r.message : `Scene lifecycle function failed: ${e}.`, { context: {
				sceneId: this.context.compiledScene.scene.id,
				hookName: e,
				functionRef: n.ref
			} }), !1;
		}
	}
	resetToInitialState() {
		let { context: e } = this, t = e.state.solvedScene;
		if (e.captureController.cancelAll(), e.state.sequenceEnded = !1, e.state.sequenceEndPending = !1, e.idleMonitor.reset(), e.state.currentTimeMs = 0, e.state.discoveredDurationMs = 0, e.trackJournal.reset(), e.trackJournal.reconcileStoryIsolationAt(0), e.state.includePersistOnlyInCurrent = !0, e.state.snapshotContribution = void 0, e.state.skipNextDelta = !0, e.eventController.resetForReplay(), !this.invokeSceneLifecycleHook("init")) throw Error("RUNTIME_SCENE_LIFECYCLE_FAILED: scene init hook failed during replay.");
		let n = e.sceneState.reconstruct(0);
		e.sceneState.synchronizeFromScene(n);
		let r = t === void 0 ? [] : ia(t, n);
		Ip(e.moduleServiceInstances, t, n, /* @__PURE__ */ new Set(), r), e.state.solvedScene = n, e.presentation.present(n, {
			previousScene: t,
			moveDeltas: r,
			componentPhase: "seek"
		}), e.renderSync.seek(e.engine.getCurrentNowMs(), e.state.currentTimeMs), e.state.lifecycle = jf, e.notifyTransportObservers();
	}
};
//#endregion
//#region ../codplay/src/runtime/player/runtime-player/motion-occurrences.ts
function Zp(e, t, n = {}) {
	let r = [], i = e?.timeMs, a = i !== void 0 && t.timeMs < i, o = t.moveOccurrences ?? [], s = e?.moveOccurrences ?? [], c = n.forceActive === !0;
	if (e !== void 0 && s === o && !a && !c) return [];
	let l = new Set(s.map(({ action: e }) => $p(e)));
	for (let { itemId: s, action: u } of o) {
		let o = $p(u);
		if (!(c ? em(u.action.move, u.startAt, t.timeMs) : e === void 0 ? u.startAt === t.timeMs : a ? em(u.action.move, u.startAt, t.timeMs) : u.startAt > (i ?? -Infinity) && u.startAt <= t.timeMs || !l.has(o))) continue;
		let d = Qp(n.resolveBeforeScene?.(u.startAt) ?? e ?? t, s), f = Qp(t, s);
		r.push(Object.freeze({
			itemId: s,
			startAt: u.startAt,
			...u.eventId === void 0 ? {} : { eventId: u.eventId },
			...u.eventSeq === void 0 ? {} : { eventSeq: u.eventSeq },
			declarationPath: Object.freeze([...u.declarationPath]),
			action: u,
			beforeStoryIds: d,
			afterStoryIds: f
		}));
	}
	return Object.freeze(r);
}
function Qp(e, t) {
	let n = e.persos[t];
	if (n === void 0) return Object.freeze([]);
	let r = /* @__PURE__ */ new Set([n.storyId]), i = n.placement.target?.storyId;
	i !== void 0 && r.add(i);
	let a = n.placement.parentKey === void 0 ? void 0 : e.persos[n.placement.parentKey]?.storyId;
	return a !== void 0 && r.add(a), Object.freeze([...r]);
}
function $p(e) {
	return `${e.eventId ?? e.name}:${e.startAt}:${e.declarationPath.join(".")}`;
}
function em(e, t, n) {
	if (!T(e) || !T(e.transition)) return !1;
	let r = e.transition, i = r.duration;
	if (typeof i != "number" || !Number.isFinite(i) || i <= 0) return !1;
	let a = r.delay;
	return n >= t && n <= t + (a === void 0 ? 0 : typeof a == "number" && Number.isFinite(a) && a >= 0 ? a : 0) + i;
}
//#endregion
//#region ../codplay/src/runtime/player/runtime-player/presentation.ts
var tm = class {
	context;
	constructor(e) {
		this.context = e;
	}
	present(e, t) {
		let { componentRuntime: n, materializer: r } = this.context, i = t.componentPhase ?? (t.phase === "geometry-capture" ? "geometry-capture" : "normal");
		n?.sync(e, !1, { phase: i }), jp(this.context.moduleServiceInstances, e, this.context.getLifecycleState() === "playing" ? "playing" : "paused"), i === "normal" && this.context.applyLiveActions(e), n?.presentAt?.(e.timeMs);
		let a = i === "seek" ? {
			...t,
			phase: "geometry-capture"
		} : t, o = a.phase === "geometry-capture" ? [] : Zp(t.previousScene, e, t.forceMotionOccurrences === !0 ? {
			forceActive: !0,
			resolveBeforeScene: (e) => this.context.sceneState.reconstructBeforeBoundary(e, this.context.getIncludePersistOnly())
		} : void 0);
		r?.materializeScene(e, o.length === 0 ? a : {
			...a,
			motionOccurrences: o
		});
	}
	presentForGeometryCapture(e) {
		this.context.componentRuntime?.sync(e, !1, { phase: "geometry-capture" }), this.context.componentRuntime?.presentAt?.(e.timeMs), this.context.materializer?.materializeScene(e, {
			moveDeltas: [],
			phase: "geometry-capture"
		});
	}
	replayForSeek(e) {
		let { componentRuntime: t, materializer: n } = this.context;
		if (t === void 0) return;
		let r = this.context.sceneState.reconstructBeforeBoundary(0, this.context.getIncludePersistOnly());
		t.sync(r, !1, { phase: "geometry-capture" }), n?.materializeScene(r, {
			moveDeltas: [],
			phase: "geometry-capture"
		});
		for (let r of this.context.sceneState.getLogicalEvaluationBoundaries()) {
			if (r <= 0 || r >= e.timeMs) continue;
			let i = this.context.sceneState.reconstruct(r, this.context.getIncludePersistOnly(), this.context.getSnapshotContribution());
			t.presentAt?.(r), t.sync(i, !1, { phase: "seek" }), n?.materializeScene(i, {
				moveDeltas: [],
				phase: "geometry-capture"
			}), t.presentAt?.(r);
		}
	}
}, nm = class {
	context;
	constructor(e) {
		this.context = e;
	}
	presentSceneForGeometryCapture(e) {
		if (!this.context.isReadyForPresentation()) throw Error("Geometry capture requires an initialized runtime player.");
		this.context.presentation.presentForGeometryCapture(e);
	}
	prepareExternalPresentation(e, t, n) {
		if (this.context.isReadyForPresentation()) return this.context.componentRuntime?.prepareExternalPresentation({
			componentId: e,
			kind: t,
			...n === void 0 ? {} : { options: n },
			timeMs: this.context.state.currentTimeMs
		});
	}
	refresh(e = {}) {
		let t = this.context.state.solvedScene;
		if (t === void 0) throw Error("Player has not been initialized.");
		this.context.componentRuntime?.sync(t, !0), this.context.presentation.present(t, {
			previousScene: t,
			moveDeltas: [],
			...e.emitMotionOccurrences === !0 ? { forceMotionOccurrences: !0 } : {}
		});
	}
};
//#endregion
//#region ../codplay/src/runtime/player/scene/scene-reconstruction.ts
function rm(e, t, n, r = !0, i = !0, a, o = !0) {
	let s = {
		includePersistOnly: i,
		includeMoveOccurrences: o
	};
	return Vl(Nl(gl(r ? co(e.compiledScene, t, e.trackJournal, s) : lo(e.compiledScene, t, e.trackJournal, s), e.functions), a), {
		mountTargets: [...e.mountTargets, ...[...e.moduleServiceInstances.values()].flatMap((e) => e.getMountTargets?.() ?? [])],
		...n === void 0 ? {} : { childrenByTarget: n }
	});
}
//#endregion
//#region ../codplay/src/runtime/player/runtime-player/scene-state.ts
var im = class {
	stateStore;
	context;
	structuralTimeline;
	structuralTimelineRevision = -1;
	structuralTimelineIncludesPersistOnly = !0;
	logicalEvaluationBoundariesRevision = -1;
	logicalEvaluationBoundaries = [];
	constructor(e) {
		this.context = e, this.stateStore = new uu(e.compiledScene);
	}
	reconstructBase(e, t = !0, n = !0, r = !0) {
		return this.reconstructBaseScene(e, void 0, t, n, void 0, r);
	}
	reconstruct(e, t = !0, n, r = !0) {
		this.ensureStructuralTimeline(t);
		let i = this.structuralTimeline?.resolveAt(e);
		return this.reconstructBaseScene(e, i?.childrenByTarget, !0, t, n, r);
	}
	reconstructBeforeBoundary(e, t = !0) {
		this.ensureStructuralTimeline(t);
		let n = this.structuralTimeline?.resolveBefore(e);
		return this.reconstructBaseScene(e, n?.childrenByTarget, !1, t, void 0, !0);
	}
	resolveFrame(e, t, n, r, i) {
		return r === void 0 || this.shouldReconstructFrame(e, t, r, i) ? {
			scene: this.reconstruct(t, n, i),
			reconstructed: !0
		} : {
			scene: r.timeMs === t ? r : {
				...r,
				timeMs: t
			},
			reconstructed: !1
		};
	}
	getLogicalEvaluationBoundaries() {
		let e = this.context.trackJournal.getRevision();
		return this.logicalEvaluationBoundariesRevision !== e && (this.logicalEvaluationBoundaries = gu(this.context.compiledScene, this.context.trackJournal), this.logicalEvaluationBoundariesRevision = e), this.logicalEvaluationBoundaries;
	}
	synchronizeFromScene(e) {
		this.stateStore.replace(I, e.sceneState);
		for (let [t, n] of Object.entries(e.storyStates)) this.stateStore.replace(Ba, n, t);
		wp(this.stateStore, this.context.liveCaptureStateUpdates, this.context.captureSessions);
	}
	synchronize(e, t = !0) {
		let n = co(this.context.compiledScene, e, this.context.trackJournal, { includePersistOnly: t });
		this.synchronizeFromScene(n);
	}
	rebuildStructuralTimeline(e) {
		for (let e of this.context.moduleServiceInstances.values()) e.resetStructuralOrder?.();
		this.structuralTimeline = new ba(this.context.compiledScene, (t) => this.reconstructBaseScene(t, void 0, !0, e, void 0, !1), (t) => this.reconstructBaseScene(t, void 0, !1, e, void 0, !1), (e, t, n) => Fp(this.context.moduleServiceInstances, e, t, n), this.context.trackJournal.getEventTimes()), this.structuralTimelineRevision = this.context.trackJournal.getRevision(), this.structuralTimelineIncludesPersistOnly = e;
	}
	ensureStructuralTimeline(e) {
		(this.structuralTimeline === void 0 || this.structuralTimelineRevision !== this.context.trackJournal.getRevision() || this.structuralTimelineIncludesPersistOnly !== e) && this.rebuildStructuralTimeline(e);
	}
	reconstructBaseScene(e, t, n = !0, r = !0, i, a = !0) {
		return rm({
			compiledScene: this.context.compiledScene,
			functions: this.context.functions,
			trackJournal: this.context.trackJournal,
			mountTargets: this.context.mountTargets,
			moduleServiceInstances: this.context.moduleServiceInstances
		}, e, t, n, r, i, a);
	}
	shouldReconstructFrame(e, t, n, r) {
		return t < n.timeMs || r !== void 0 && r.timeMs !== t || this.structuralTimelineRevision !== this.context.trackJournal.getRevision() || _u(n) ? !0 : vu(this.getLogicalEvaluationBoundaries(), e, t);
	}
}, am = class {
	context;
	pendingSolvedScene;
	pendingDiagnostics = Yp();
	pendingModuleSeekHandles = [];
	transaction;
	constructor(e) {
		this.context = e;
	}
	getDiagnostics() {
		return this.pendingDiagnostics;
	}
	validate(e) {
		this.context.requireSequenceActive("seek");
		let t = this.context.getLifecycleState();
		if (t === "idle" || t === "destroyed") throw Error(`Player cannot seek from ${t} state.`);
		if (!Number.isFinite(e) || e < 0) throw Error("Player seek time must be a finite positive number.");
		if (this.transaction !== void 0) throw Error("Player seek transaction is already active.");
		let n = this.context.getSolvedScene();
		this.transaction = {
			previousSolvedScene: n,
			previousTimeMs: this.context.getCurrentTimeMs(),
			previousIncludePersistOnly: this.context.getIncludePersistOnly(),
			previousSkipNextDelta: this.context.getSkipNextDelta(),
			moveDeltas: [],
			preparedInstances: /* @__PURE__ */ new Set(),
			committed: !1
		}, this.context.cancelCaptures();
		for (let e of this.context.moduleServiceInstances.values()) e.beforeSeek?.(this.context.getCurrentTimeMs());
		this.pendingSolvedScene = this.context.sceneState.reconstruct(e, !0, this.context.getSnapshotContribution()), this.pendingDiagnostics = Jp(this.pendingSolvedScene), this.pendingModuleSeekHandles = [];
		try {
			for (let e of this.context.moduleServiceInstances.values()) {
				let t = e.prepareSeek?.(this.pendingSolvedScene);
				t !== void 0 && this.pendingModuleSeekHandles.push({
					instance: e,
					handle: t
				});
			}
		} catch (e) {
			throw Lp(this.pendingModuleSeekHandles), e;
		}
	}
	commit(e) {
		if (this.pendingSolvedScene === void 0 || this.pendingSolvedScene.timeMs !== e) throw Error("Player seek reconstruction is missing.");
		let t = this.transaction;
		if (t === void 0) throw Error("Player seek transaction is missing.");
		let n = t.previousSolvedScene, r = n === void 0 ? [] : ia(n, this.pendingSolvedScene), i = new Set(this.pendingModuleSeekHandles.map((e) => e.instance));
		for (let { handle: e } of this.pendingModuleSeekHandles) e.commit();
		this.context.setSolvedScene(this.pendingSolvedScene), this.context.setIncludePersistOnly(!0), this.context.sceneState.synchronizeFromScene(this.pendingSolvedScene), this.context.setCurrentTimeMs(e), this.context.setDiscoveredDurationMs(Math.max(this.context.getDiscoveredDurationMs(), this.context.getCurrentTimeMs())), this.context.trackJournal.reconcileStoryIsolationAt(e), this.context.setSkipNextDelta(!0), t.moveDeltas = r, t.preparedInstances = i, t.committed = !0;
	}
	present() {
		let e = this.transaction;
		if (e === void 0 || !e.committed) throw Error("Player seek commit is missing.");
		let t = this.context.getSolvedScene();
		if (t === void 0) throw Error("Player seek scene is missing.");
		Ip(this.context.moduleServiceInstances, e.previousSolvedScene, t, e.preparedInstances, e.moveDeltas), this.context.presentation.replayForSeek(t), this.context.presentation.present(t, {
			previousScene: e.previousSolvedScene,
			moveDeltas: e.moveDeltas,
			componentPhase: "seek"
		}), this.context.renderSync.seek(this.context.engine.getCurrentNowMs(), this.context.getCurrentTimeMs()), this.clearTransaction(), this.context.notifyTransportObservers();
	}
	abort() {
		Lp(this.pendingModuleSeekHandles), this.restore(!1);
	}
	rollback() {
		Lp(this.pendingModuleSeekHandles), this.restore(!0);
	}
	restore(e) {
		let t = this.transaction;
		if (t === void 0) return;
		let n = this.context.getSolvedScene();
		try {
			if (this.context.setSolvedScene(t.previousSolvedScene), this.context.setCurrentTimeMs(t.previousTimeMs), this.context.trackJournal.reconcileStoryIsolationAt(t.previousTimeMs), this.context.setIncludePersistOnly(t.previousIncludePersistOnly), this.context.setSkipNextDelta(t.previousSkipNextDelta), t.previousSolvedScene === void 0 ? this.context.sceneState.synchronize(t.previousTimeMs, t.previousIncludePersistOnly) : this.context.sceneState.synchronizeFromScene(t.previousSolvedScene), e && t.previousSolvedScene !== void 0) {
				let e = n === void 0 ? [] : ia(n, t.previousSolvedScene);
				this.context.presentation.present(t.previousSolvedScene, {
					previousScene: n,
					moveDeltas: e,
					componentPhase: "seek"
				}), this.context.renderSync.seek(this.context.engine.getCurrentNowMs(), this.context.getCurrentTimeMs());
			}
		} finally {
			this.clearTransaction();
		}
	}
	clearTransaction() {
		this.pendingSolvedScene = void 0, this.pendingDiagnostics = Yp(), this.pendingModuleSeekHandles = [], this.transaction = void 0;
	}
};
//#endregion
//#region ../codplay/src/runtime/player/input-projection.ts
function om(e) {
	if (!sm(e.value)) return {
		ok: !1,
		code: "INVALID_VALUE"
	};
	let t = Object.values(e.scene.persos).find((t) => t.storyId === e.target.storyId && t.persoId === e.target.persoId);
	if (t === void 0) return {
		ok: !1,
		code: "TARGET_NOT_PRESENT"
	};
	if (t.type !== "input") return {
		ok: !1,
		code: "TARGET_NOT_INPUT"
	};
	let n = e.componentRuntime?.getComponentSurfaces().getInputSurface?.(t.key);
	return n === void 0 ? {
		ok: !1,
		code: "PROJECTION_UNAVAILABLE"
	} : (n.setValue(e.value), { ok: !0 });
}
function sm(e) {
	return typeof e == "string" || typeof e == "number" && Number.isFinite(e);
}
//#endregion
//#region ../codplay/src/runtime/player/runtime-player/snapshot-values.ts
function cm(e) {
	for (let t of Object.values(e)) um(t);
	return Object.freeze({ ...e });
}
function lm(e) {
	return T(e) ? Object.values(e).every(dm) : !1;
}
function um(e) {
	if (Array.isArray(e)) {
		for (let t of e) um(t);
		Object.freeze(e);
		return;
	}
	if (T(e)) {
		for (let t of Object.values(e)) um(t);
		Object.freeze(e);
	}
}
function dm(e) {
	return e === null || typeof e == "string" || typeof e == "number" || typeof e == "boolean" ? !0 : Array.isArray(e) ? e.every(dm) : T(e) ? Object.values(e).every(dm) : !1;
}
//#endregion
//#region ../codplay/src/runtime/player/runtime-player/snapshot-controller.ts
var fm = class {
	context;
	constructor(e) {
		this.context = e;
	}
	getSnapshot() {
		let { state: e, sceneState: t } = this.context;
		if (e.lifecycle === "idle" || e.lifecycle === "destroyed") return;
		let n = t.reconstruct(e.currentTimeMs, e.includePersistOnlyInCurrent);
		return {
			timeMs: n.timeMs,
			states: Object.freeze(Object.values(n.persos).map((e) => Object.freeze({
				storyId: e.storyId,
				persoId: e.persoId,
				state: cm(e.state)
			})))
		};
	}
	projectInputValue(e, t) {
		let { state: n } = this.context;
		return n.lifecycle === "destroyed" || n.lifecycle === "idle" || n.solvedScene === void 0 ? {
			ok: !1,
			code: "TIME_NOT_PRESENTED"
		} : om({
			scene: n.solvedScene,
			componentRuntime: this.context.componentRuntime,
			target: e,
			value: t
		});
	}
	setSnapshot(e) {
		let { state: t, sceneState: n, presentation: r } = this.context;
		if (t.lifecycle === "destroyed") return {
			ok: !1,
			code: "INSTANCE_DESTROYED"
		};
		if (t.lifecycle === "idle" || t.solvedScene === void 0) return {
			ok: !1,
			code: "TIME_NOT_PRESENTED"
		};
		let i = n.reconstruct(t.currentTimeMs, t.includePersistOnlyInCurrent), a = [];
		for (let n of e) {
			if (!Number.isFinite(n.timeMs) || n.timeMs !== t.currentTimeMs) return {
				ok: !1,
				code: "TIME_NOT_PRESENTED"
			};
			if (!T(n.state) || !T(n.state.style) || Object.keys(n.state).some((e) => e !== "style") || !lm(n.state.style)) return {
				ok: !1,
				code: "INVALID_PATCH"
			};
			if (Object.values(i.persos).find((e) => e.storyId === n.storyId && e.persoId === n.persoId) === void 0) return {
				ok: !1,
				code: "TARGET_NOT_PRESENT"
			};
			a.push({
				storyId: n.storyId,
				persoId: n.persoId,
				timeMs: n.timeMs,
				state: { style: D(Ao(n.state.style)) }
			});
		}
		let o = t.snapshotContribution, s = t.solvedScene;
		t.snapshotContribution = a.length === 0 ? void 0 : {
			timeMs: t.currentTimeMs,
			patches: Object.freeze(a)
		};
		try {
			let e = n.reconstruct(t.currentTimeMs, t.includePersistOnlyInCurrent, t.snapshotContribution);
			return t.solvedScene = e, r.present(e, {
				previousScene: s,
				moveDeltas: []
			}), { ok: !0 };
		} catch (e) {
			throw t.snapshotContribution = o, t.solvedScene = s, e;
		}
	}
	clearSnapshot() {
		let { state: e, sceneState: t, presentation: n } = this.context;
		if (e.snapshotContribution === void 0) return;
		let r = e.snapshotContribution, i = e.solvedScene;
		e.snapshotContribution = void 0;
		try {
			let r = t.reconstruct(e.currentTimeMs, e.includePersistOnlyInCurrent);
			e.solvedScene = r, n.present(r, {
				previousScene: i,
				moveDeltas: []
			});
		} catch (t) {
			throw e.snapshotContribution = r, e.solvedScene = i, t;
		}
	}
	resolveSceneAt(e, t = !0) {
		return this.context.sceneState.reconstruct(e, t, this.context.state.snapshotContribution);
	}
	resolveSceneBeforeBoundary(e, t = !0) {
		return this.context.sceneState.reconstructBeforeBoundary(e, t);
	}
	includesPersistOnlyInCurrent() {
		return this.context.state.includePersistOnlyInCurrent;
	}
}, pm = class {
	lifecycle = Af;
	currentTimeMs = 0;
	discoveredDurationMs = 0;
	rate = 1;
	skipNextDelta = !1;
	solvedScene;
	snapshotContribution;
	includePersistOnlyInCurrent = !0;
	sequenceEnded = !1;
	sequenceEndPending = !1;
}, mm = class {
	id;
	engine;
	compiledScene;
	renderSync;
	strapCollections;
	trackJournal;
	functions;
	stateStore;
	mountTargets;
	materializer;
	componentRuntime;
	state = new pm();
	sceneState;
	presentation;
	liveActionController;
	captureController;
	seekController;
	eventController;
	lifecycleController;
	snapshotController;
	presentationController;
	moduleServiceInstances = /* @__PURE__ */ new Map();
	idleMonitor;
	transportListeners = /* @__PURE__ */ new Set();
	constructor(e, t, n, r = new Jf([]), i, a, o = [], s, c, l = {}, u, d, f, p, m) {
		this.id = e, this.engine = t, this.compiledScene = n, this.renderSync = r, this.strapCollections = i, this.trackJournal = a ?? new Kl(n), this.functions = l, this.mountTargets = o, this.materializer = s, this.componentRuntime = c, this.idleMonitor = new mf(f === void 0 ? t.getIdleOptions() : pf(f)), this.liveActionController = new kp({
			compiledScene: n,
			componentRuntime: c,
			functions: l,
			getSolvedScene: () => this.state.solvedScene
		}), this.captureController = new Dp({
			functions: l,
			getStateStore: () => this.stateStore,
			liveActions: this.liveActionController,
			getCurrentTimeMs: () => this.state.currentTimeMs,
			synchronizeState: () => this.sceneState.synchronize(this.state.currentTimeMs, this.state.includePersistOnlyInCurrent),
			requireCaptureState: () => this.requireState("ready", "playing", "paused"),
			emitEvent: (e, t) => this.eventController.emitEvent(e, t)
		});
		let h = {
			compiledScene: n,
			functions: l,
			trackJournal: this.trackJournal,
			mountTargets: o,
			moduleServiceInstances: this.moduleServiceInstances,
			liveCaptureStateUpdates: this.captureController.liveCaptureStateUpdates,
			captureSessions: this.captureController.captureSessions
		};
		this.sceneState = new im(h), this.stateStore = this.sceneState.stateStore, this.presentation = new tm({
			componentRuntime: c,
			materializer: s,
			moduleServiceInstances: this.moduleServiceInstances,
			sceneState: this.sceneState,
			getLifecycleState: () => this.state.lifecycle,
			getIncludePersistOnly: () => this.state.includePersistOnlyInCurrent,
			getSnapshotContribution: () => this.state.snapshotContribution,
			applyLiveActions: (e) => this.liveActionController.reapply(e)
		}), this.seekController = new am({
			getLifecycleState: () => this.state.lifecycle,
			requireSequenceActive: (e) => this.requireSequenceActive(e),
			getCurrentTimeMs: () => this.state.currentTimeMs,
			setCurrentTimeMs: (e) => {
				this.state.currentTimeMs = e;
			},
			getDiscoveredDurationMs: () => this.state.discoveredDurationMs,
			setDiscoveredDurationMs: (e) => {
				this.state.discoveredDurationMs = e;
			},
			getIncludePersistOnly: () => this.state.includePersistOnlyInCurrent,
			setIncludePersistOnly: (e) => {
				this.state.includePersistOnlyInCurrent = e;
			},
			getSkipNextDelta: () => this.state.skipNextDelta,
			setSkipNextDelta: (e) => {
				this.state.skipNextDelta = e;
			},
			getSolvedScene: () => this.state.solvedScene,
			setSolvedScene: (e) => {
				this.state.solvedScene = e;
			},
			getSnapshotContribution: () => this.state.snapshotContribution,
			trackJournal: this.trackJournal,
			sceneState: this.sceneState,
			moduleServiceInstances: this.moduleServiceInstances,
			presentation: this.presentation,
			renderSync: this.renderSync,
			engine: this.engine,
			cancelCaptures: () => this.captureController.cancelAll(),
			notifyTransportObservers: () => this.notifyTransportObservers()
		}), this.eventController = new Kp({
			state: this.state,
			compiledScene: n,
			strapCollections: i,
			trackJournal: this.trackJournal,
			functions: l,
			stateStore: this.stateStore,
			sceneState: this.sceneState,
			presentation: this.presentation,
			renderSync: this.renderSync,
			moduleServiceInstances: this.moduleServiceInstances,
			captureController: this.captureController,
			idleMonitor: this.idleMonitor,
			diagnosticOutput: u,
			publicEventListener: d,
			traceEventListener: p,
			journalChangeListener: m,
			notifyTransportObservers: () => this.notifyTransportObservers(),
			requireState: (...e) => this.requireState(...e),
			requireSequenceActive: (e) => this.requireSequenceActive(e),
			invokeSceneLifecycleHook: (e, t) => this.lifecycleController.invokeSceneLifecycleHook(e, t)
		}), this.lifecycleController = new Xp({
			id: e,
			state: this.state,
			engine: t,
			compiledScene: n,
			strapCollections: i,
			trackJournal: this.trackJournal,
			functions: l,
			mountTargets: o,
			materializer: s,
			componentRuntime: c,
			stateStore: this.stateStore,
			sceneState: this.sceneState,
			presentation: this.presentation,
			captureController: this.captureController,
			seekController: this.seekController,
			eventController: this.eventController,
			moduleServiceInstances: this.moduleServiceInstances,
			renderSync: r,
			idleMonitor: this.idleMonitor,
			diagnosticOutput: u,
			notifyTransportObservers: () => this.notifyTransportObservers(),
			onEngineFrame: (e) => this.eventController.onEngineFrame(e)
		}), this.snapshotController = new fm({
			state: this.state,
			sceneState: this.sceneState,
			presentation: this.presentation,
			componentRuntime: c,
			getLifecycleState: () => this.state.lifecycle
		}), this.presentationController = new nm({
			state: this.state,
			componentRuntime: c,
			materializer: s,
			presentation: this.presentation,
			isReadyForPresentation: () => this.isReadyForPresentation()
		});
	}
	getLifecycleState() {
		return this.state.lifecycle;
	}
	getCurrentTimeMs() {
		return this.state.currentTimeMs;
	}
	hasSequenceEnded() {
		return this.state.sequenceEnded;
	}
	getDiscoveredDurationMs() {
		let e = Math.max(this.state.discoveredDurationMs, this.state.currentTimeMs);
		for (let t of xa(this.compiledScene)) e = Math.max(e, t);
		for (let t of this.trackJournal.getEventTimes()) e = Math.max(e, t);
		return this.state.discoveredDurationMs = e, e;
	}
	subscribeTransport(e) {
		return this.transportListeners.add(e), () => {
			this.transportListeners.delete(e);
		};
	}
	getSolvedScene() {
		return this.state.solvedScene;
	}
	getSnapshot() {
		return this.snapshotController.getSnapshot();
	}
	projectInputValue(e, t) {
		return this.snapshotController.projectInputValue(e, t);
	}
	setSnapshot(e) {
		return this.snapshotController.setSnapshot(e);
	}
	clearSnapshot() {
		this.snapshotController.clearSnapshot();
	}
	resolveSceneAt(e, t = !0) {
		return this.snapshotController.resolveSceneAt(e, t);
	}
	resolveSceneBeforeBoundary(e, t = !0) {
		return this.snapshotController.resolveSceneBeforeBoundary(e, t);
	}
	includesPersistOnlyInCurrent() {
		return this.snapshotController.includesPersistOnlyInCurrent();
	}
	presentSceneForGeometryCapture(e) {
		this.presentationController.presentSceneForGeometryCapture(e);
	}
	prepareExternalPresentation(e, t, n) {
		return this.presentationController.prepareExternalPresentation(e, t, n);
	}
	init() {
		return this.lifecycleController.init();
	}
	play() {
		this.lifecycleController.play();
	}
	reset() {
		this.lifecycleController.reset();
	}
	pause() {
		this.lifecycleController.pause();
	}
	setRate(e) {
		this.lifecycleController.setRate(e);
	}
	getRate() {
		return this.lifecycleController.getRate();
	}
	seek(e) {
		return this.lifecycleController.seek(e);
	}
	refresh(e = {}) {
		this.presentationController.refresh(e);
	}
	async emit(e) {
		return this.eventController.emit(e);
	}
	async emitEventime(e, t) {
		return this.eventController.emitEventime(e, t);
	}
	beginCapture(e) {
		return this.captureController.begin(e);
	}
	beginCompiledCapture(e) {
		return this.captureController.beginCompiled(e);
	}
	trackCapture(e, t) {
		return this.captureController.track(e, t);
	}
	async endCapture(e, t = {}, n) {
		return this.captureController.end(e, t, n);
	}
	cancelCapture(e) {
		return this.captureController.cancel(e);
	}
	setLiveActions(e, t) {
		this.liveActionController.setLiveActions(e, t);
	}
	destroy() {
		this.lifecycleController.destroy(), this.liveActionController.clear(), this.transportListeners.clear();
	}
	isReadyForPresentation() {
		return this.state.lifecycle !== "idle" && this.state.lifecycle !== "destroyed";
	}
	requireState(...e) {
		if (!e.includes(this.state.lifecycle)) throw Error(`Player cannot perform this operation from ${this.state.lifecycle} state.`);
	}
	requireSequenceActive(e) {
		if (this.state.sequenceEnded) throw Error(`PLAYER_SEQUENCE_ENDED: ${e} is not allowed after sequence:end.`);
	}
	notifyTransportObservers() {
		for (let e of [...this.transportListeners]) e();
	}
};
//#endregion
//#region ../codplay/src/runtime/runner-html/element-guards.ts
function hm(e) {
	return typeof Element < "u" && e instanceof Element && e.ownerDocument !== void 0 && typeof e.getBoundingClientRect == "function";
}
//#endregion
//#region ../codplay/src/runtime/runner-html/markup-materialization.ts
function gm(e, t, n) {
	e.registerComponent({
		...t,
		parts: n.map((e) => ({
			id: e.partId,
			ownerId: t.componentId,
			storyId: t.storyId,
			componentType: t.componentType,
			partId: e.partId,
			kind: e.kind
		}))
	});
}
function _m(e, t) {
	return t.component._materialize(t.rootNode, t.parts), gm(e, t.identity, t.publicParts), () => vm(e, t.identity.componentId);
}
function vm(e, t) {
	e.unregisterComponent(t);
}
function ym(e, t = {}) {
	if (globalThis.document === void 0) throw Error("Template materialization requires a DOM environment.");
	let n = globalThis.document.createElement("template");
	n.innerHTML = e;
	let r = Array.from(n.content.childNodes).filter((e) => !(e.nodeType === 3 && e.textContent?.trim().length === 0));
	if (r.length === 0) throw Error("Compiled template produced no nodes.");
	let i = r.length === 1 ? r[0] : r;
	return {
		rootNode: i,
		parts: bm(i, `${t.partMarkerPrefix ?? "data-"}part`)
	};
}
function bm(e, t) {
	let n = Array.isArray(e) ? e : [e], r = [], i = (e) => {
		if (e instanceof Element && e.hasAttribute("data-part")) {
			let t = e.getAttribute("data-part") ?? "";
			e.removeAttribute("data-part"), r.push({
				partId: t,
				nodeRef: e,
				kind: "outlet"
			});
		}
		if (e.nodeType === 8) {
			let n = xm(e.nodeValue ?? "", t);
			n !== void 0 && r.push({
				partId: n,
				nodeRef: e,
				kind: "anchor"
			});
		}
		for (let t of Array.from(e.childNodes)) i(t);
	};
	for (let e of n) i(e);
	return r;
}
function xm(e, t) {
	let n = e.trim();
	if (!n.startsWith(t)) return;
	let r = n.slice(t.length).trimStart();
	if (!r.startsWith("=")) return;
	let i = r.slice(1).trim();
	if (i.length < 2) return;
	let a = i[0];
	if (!(a !== "\"" && a !== "'") && i[i.length - 1] === a) return i.slice(1, -1);
}
//#endregion
//#region ../codplay/src/runtime/runner-html/transient-node.ts
var Sm = "data-codplay-transient";
function Cm(e) {
	Tm(e) && e.setAttribute(Sm, "");
}
function wm(e) {
	return Tm(e) && e.getAttribute("data-codplay-transient") !== null;
}
function Tm(e) {
	return typeof e == "object" && !!e && "getAttribute" in e && typeof e.getAttribute == "function" && "setAttribute" in e && typeof e.setAttribute == "function" && "removeAttribute" in e && typeof e.removeAttribute == "function";
}
//#endregion
//#region ../codplay/src/runtime/runner-html/replace-presentation-surface.ts
function Em(e) {
	return { begin: (t = "fade") => Dm(e, t) };
}
function Dm(e, t) {
	if (!Nm(e)) return;
	let n = e.parentElement;
	if (n === null) return;
	let r = e.cloneNode(!0);
	if (!Nm(r)) return;
	let i = e.style.visibility, a = e.style.opacity, o = e.style.position, s = n.style.position;
	(s === "" || s === "static") && (n.style.position = "relative"), (o === "" || o === "static") && (e.style.position = "relative"), Am(r), r.style.opacity = a || "1", Om(r, e, n), n.insertBefore(r, e), e.style.visibility = "hidden";
	let c, l = "prepared", u = a;
	return {
		start: () => {
			if (l !== "prepared") return;
			u = e.style.opacity, e.style.visibility = i;
			let t = e.cloneNode(!0);
			if (!Nm(t)) {
				e.style.visibility = "hidden";
				return;
			}
			Am(t), t.style.opacity = "0", Om(t, e, n), n.insertBefore(t, e), c = t, e.style.visibility = "hidden", l = "started";
		},
		sample: (e) => {
			if (l !== "started") return;
			let n = Math.min(1, Math.max(0, e));
			t === "fade" && (r.style.opacity = String(1 - n)), c?.style.setProperty("opacity", String(n));
		},
		finish: () => {
			l === "finished" || l === "cancelled" || (jm(r, n), c !== void 0 && jm(c, n), e.style.visibility = i, e.style.opacity = u, e.style.position = o, Mm(n, s), l = "finished");
		},
		cancel: () => {
			l === "finished" || l === "cancelled" || (jm(r, n), c !== void 0 && jm(c, n), e.style.visibility = i, e.style.opacity = l === "started" ? u : a, e.style.position = o, Mm(n, s), l = "cancelled");
		}
	};
}
function Om(e, t, n) {
	let r = km(t, n);
	e.style.position = "absolute", e.style.left = `${r.left}px`, e.style.top = `${r.top}px`, e.style.width = `${t.offsetWidth}px`, e.style.height = `${t.offsetHeight}px`, e.style.margin = "0", e.style.pointerEvents = "none";
}
function km(e, t) {
	let n = 0, r = 0, i = e;
	for (; i !== null && i !== t;) n += i.offsetLeft, r += i.offsetTop, i = i.offsetParent;
	return {
		left: n,
		top: r
	};
}
function Am(e) {
	Cm(e);
	for (let t of [e, ...Array.from(e.querySelectorAll("*"))]) {
		t.removeAttribute("id");
		for (let e of Array.from(t.attributes)) e.name.toLowerCase().startsWith("on") && t.removeAttribute(e.name);
		t.setAttribute("aria-hidden", "true"), t.style.pointerEvents = "none";
	}
}
function jm(e, t) {
	e.parentNode === t && t.removeChild(e);
}
function Mm(e, t) {
	e.style.position === "relative" && (e.style.position = t);
}
function Nm(e) {
	return globalThis.HTMLElement !== void 0 && e instanceof globalThis.HTMLElement;
}
//#endregion
//#region ../codplay/src/runtime/runner-html/html-element-method/html-element-method.ts
function Pm(e, t, n) {
	let r = Fm(t);
	for (let t of Object.values(e.persos)) {
		if (!t.placement.mounted) continue;
		let e = n.get(t.key);
		if (od(e)) for (let n of t.actions ?? []) {
			if (r.has(Im(t.key, n))) continue;
			let i = Lm(n.action.htmlElementMethod);
			i !== void 0 && Rm(e, i);
		}
	}
}
function Fm(e) {
	let t = /* @__PURE__ */ new Set();
	if (e === void 0) return t;
	for (let n of Object.values(e.persos)) for (let e of n.actions ?? []) e.action.htmlElementMethod !== void 0 && t.add(Im(n.key, e));
	return t;
}
function Im(e, t) {
	return JSON.stringify([
		e,
		t.name,
		t.trackId,
		t.trackOrder,
		t.startAt,
		t.eventId,
		t.eventSeq,
		t.declarationPath
	]);
}
function Lm(e) {
	if (!(!Array.isArray(e) || !e.every((e) => typeof e == "string"))) {
		if (e.length === 1 && e[0] === "focus") return {
			name: "focus",
			preventScroll: !1
		};
		if (e.length === 2 && e[0] === "focus" && e[1] === "preventscroll") return {
			name: "focus",
			preventScroll: !0
		};
		if (e.length === 1 && e[0] === "blur") return { name: "blur" };
	}
}
function Rm(e, t) {
	let n = e;
	if (t.name === "focus") {
		if (typeof n.focus != "function") return;
		t.preventScroll ? n.focus({ preventScroll: !0 }) : n.focus();
		return;
	}
	typeof n.blur == "function" && n.blur();
}
//#endregion
//#region ../codplay/src/runtime/runner-html/component-materializer.ts
var zm = class {
	id = oe;
	context;
	nodes;
	foreignAttachments = /* @__PURE__ */ new Map();
	mountedPersos = /* @__PURE__ */ new Set();
	lastStructuralRevision;
	structureDirty = !0;
	constructor(e, t = { numericLengthScale: 1 }) {
		this.nodes = e, this.context = t, this.context.deferredAccessibilityAttributes ??= /* @__PURE__ */ new Map();
	}
	materializeComponent(e, t, n, r, i) {
		if (!(e instanceof w)) throw Error(`${this.id.toUpperCase()} materializer received a non-markup component: ${t.componentType}`);
		let a = ym(e.render(), { partMarkerPrefix: this.context.partMarkerPrefix }), o = a.rootNode, s = Bm(a.parts, r), c = s.length === 0 ? void 0 : Vm(i, t.componentId);
		this.nodes.persoNodes.set(t.componentId, o), this.nodes.persoParts?.set(t.componentId, a.parts);
		try {
			let n = c === void 0 ? void 0 : _m(c, {
				component: e,
				identity: t,
				rootNode: o,
				parts: a.parts,
				publicParts: s
			});
			n === void 0 && e._materialize(o, a.parts);
			for (let e of s) this.nodes.targetNodes.set(e.partId, e.nodeRef);
			let r = !1;
			return { destroy: () => {
				if (!r) {
					r = !0, n?.(), this.detachForeignContent(t.componentId), Um(o), this.nodes.persoNodes.delete(t.componentId), this.nodes.persoParts?.delete(t.componentId);
					for (let e of s) this.nodes.targetNodes.get(e.partId) === e.nodeRef && this.nodes.targetNodes.delete(e.partId);
				}
			} };
		} catch (e) {
			throw this.detachForeignContent(t.componentId), this.nodes.persoNodes.delete(t.componentId), this.nodes.persoParts?.delete(t.componentId), Um(o), e;
		}
	}
	materializeScene(e, t = { moveDeltas: [] }) {
		try {
			(this.structureDirty || this.lastStructuralRevision !== e.graph.revision) && this.materializeStructure(e), t.phase !== "geometry-capture" && Pm(e, t.previousScene, this.nodes.persoNodes);
		} finally {
			this.flushDeferredAccessibilityAttributes();
		}
	}
	materializeStructure(e) {
		let t = Ll(e), n = new Set(Object.values(e.persos).filter((e) => e.placement.mounted).map((e) => e.key));
		for (let e of this.mountedPersos) n.has(e) || (this.detachForeignContent(e), Km(this.nodes.persoNodes.get(e)));
		let r = /* @__PURE__ */ new Map();
		for (let n of Object.values(t)) for (let t of n) {
			let n = e.persos[t];
			if (n === void 0 || !n.placement.mounted) continue;
			let i = Wm(n, this.nodes);
			if (i === void 0) continue;
			let a = i.reference ?? i.parent, o = r.get(a) ?? {
				...i,
				roots: []
			};
			for (let e of Ym(this.nodes.persoNodes.get(t))) wm(e) || o.roots.push(e);
			r.set(a, o);
		}
		for (let { parent: e, reference: t, roots: n } of r.values()) Gm(e, n, (e) => wm(e) || this.isForeignRoot(e), t);
		this.mountedPersos = n, this.lastStructuralRevision = e.graph.revision, this.structureDirty = !1;
	}
	flushDeferredAccessibilityAttributes() {
		let e = this.context.deferredAccessibilityAttributes;
		if (e !== void 0) {
			for (let [t, n] of e) for (let [e, r] of n) r === void 0 ? t.removeAttribute(e) : t.setAttribute(e, r);
			e.clear();
		}
	}
	invalidateStructure() {
		this.structureDirty = !0;
	}
	getForeignContentSurface(e) {
		return {
			attach: (t, n) => this.attachForeignContent(e, t, n),
			detach: () => this.detachForeignContent(e)
		};
	}
	getReplaceSurface(e) {
		return Em(this.nodes.persoNodes.get(e));
	}
	destroy() {
		for (let e of this.foreignAttachments.keys()) this.detachForeignContent(e);
		for (let e of this.mountedPersos) Km(this.nodes.persoNodes.get(e));
		this.mountedPersos.clear(), this.foreignAttachments.clear(), this.context.deferredAccessibilityAttributes?.clear(), this.lastStructuralRevision = void 0, this.structureDirty = !0;
	}
	attachForeignContent(e, t, n) {
		let r = this.nodes.persoNodes.get(e);
		if (!Xm(r)) throw Error(`Foreign content host is not materialized as an appendable node: ${e}`);
		this.detachForeignContent(e);
		let i = [];
		try {
			let a = n !== void 0 && Zm(r) && q(n) && n.parentNode === r;
			for (let o of t) {
				if (!q(o) || o === r || o === n) throw Error(`Foreign content root is not attachable for component: ${e}`);
				a ? r.insertBefore(o, n) : r.appendChild(o), i.push(o);
			}
			this.foreignAttachments.set(e, i);
		} catch (e) {
			for (let e of i) q(e) && e.parentNode === r && Qm(r) && r.removeChild(e);
			throw e;
		}
	}
	detachForeignContent(e) {
		let t = this.foreignAttachments.get(e);
		if (t === void 0) return;
		let n = this.nodes.persoNodes.get(e);
		if (Qm(n)) for (let e of t) q(e) && e.parentNode === n && n.removeChild(e);
		this.foreignAttachments.delete(e);
	}
	isForeignRoot(e) {
		for (let t of this.foreignAttachments.values()) if (t.includes(e)) return !0;
		return !1;
	}
};
function Bm(e, t) {
	if (t === "all") return e;
	let n = new Set(t);
	return e.filter((e) => n.has(e.partId));
}
function Vm(e, t) {
	let n = e.get(qi);
	if (n === void 0 || !Hm(n)) throw Error(`HTML component requires the markup module: ${t}`);
	return n;
}
function Hm(e) {
	return "registerComponent" in e && "unregisterComponent" in e && typeof e.registerComponent == "function" && typeof e.unregisterComponent == "function";
}
function Um(e) {
	for (let t of Ym(e)) !$m(t) || t.parentNode === null || t.parentNode.removeChild(t);
}
function Wm(e, t) {
	let n = e.placement;
	if (n.target === void 0) return;
	if (n.target.kind === "perso") {
		if (n.parentKey === void 0) return;
		let e = t.persoNodes.get(n.parentKey);
		return e === void 0 ? void 0 : { parent: e };
	}
	let r = t.targetNodes.get(n.target.id);
	if (n.target.kind === "anchor") {
		if (!q(r)) return;
		let e = r.parentNode;
		return e == null ? void 0 : {
			parent: e,
			reference: r
		};
	}
	return r === void 0 ? void 0 : { parent: r };
}
function Gm(e, t, n = wm, r) {
	if (r !== void 0) {
		if (!Zm(e) || !q(r) || r.parentNode !== e) return;
		for (let i of t) !q(i) || i === r || n(i) || e.insertBefore(i, r);
		return;
	}
	for (let r of t) qm(e, r, t, n);
}
function Km(e) {
	for (let t of Ym(e)) Jm(t);
}
function qm(e, t, n, r = wm) {
	if (e === void 0 || t === void 0 || e === t || r(t)) return;
	if (Xm(e)) {
		let i = Array.from(e.children ?? []).filter((e) => !r(e)), a = n.indexOf(t), o = i.indexOf(t);
		if ((q(t) ? t : void 0)?.parentNode === e && a >= 0 && o === a) return;
		let s = n.slice(a + 1).find((n) => n !== t && q(n) && n.parentNode === e && !r(n));
		s !== void 0 && Zm(e) ? e.insertBefore(t, s) : e.appendChild(t);
		return;
	}
	if (!q(e) || !q(t)) return;
	let i = Array.isArray(e.children) ? e.children : [], a = i.filter((e) => !r(e)), o = n.indexOf(t);
	if (t.parentNode === e && o >= 0 && a.indexOf(t) === o) return;
	Jm(t);
	let s = n.slice(o + 1).map((e) => i.indexOf(e)).find((e) => e >= 0), c = [...i];
	s === void 0 ? c.push(t) : c.splice(s, 0, t), e.children = c, t.parentNode = e;
}
function Jm(e) {
	if (!q(e)) return;
	let t = e.parentNode;
	if (t != null) {
		if (Qm(t)) {
			t.removeChild(e);
			return;
		}
		q(t) && Array.isArray(t.children) && (t.children = t.children.filter((t) => t !== e)), e.parentNode = null;
	}
}
function Ym(e) {
	return e == null ? [] : Array.isArray(e) ? e : [e];
}
function Xm(e) {
	return q(e) && typeof e.appendChild == "function";
}
function Zm(e) {
	return q(e) && typeof e.insertBefore == "function";
}
function Qm(e) {
	return q(e) && typeof e.removeChild == "function";
}
function q(e) {
	return typeof e == "object" && !!e;
}
function $m(e) {
	if (typeof e != "object" || !e || !("parentNode" in e)) return !1;
	let t = e.parentNode;
	return t === null || typeof t == "object" && !!t && "removeChild" in t && typeof t.removeChild == "function";
}
//#endregion
//#region ../codplay/src/runtime/runner-html/perso-emit-source-adapter.ts
var eh = !1, th = class {
	player;
	compiledScene;
	nodes;
	eventTarget;
	onDiagnostic;
	rulesByTrigger = /* @__PURE__ */ new Map();
	listeners = /* @__PURE__ */ new Map();
	reportedUnknownRefs = /* @__PURE__ */ new Set();
	pendingDispatch = Promise.resolve();
	destroyed = !1;
	constructor(e) {
		this.player = e.player, this.compiledScene = e.compiledScene, this.nodes = e.nodes, this.eventTarget = e.eventTarget, this.onDiagnostic = e.onDiagnostic, this.indexEmitRules();
	}
	attach() {
		if (!(this.destroyed || this.eventTarget === void 0 || this.listeners.size > 0)) {
			this.validateRefs();
			for (let e of this.rulesByTrigger.keys()) {
				let t = (e) => this.handleNativeEvent(e);
				this.listeners.set(e, t), this.eventTarget.addEventListener(e, t, eh);
			}
		}
	}
	destroy() {
		if (this.destroyed = !0, this.eventTarget !== void 0) for (let [e, t] of this.listeners) this.eventTarget.removeEventListener(e, t, eh);
		this.listeners.clear();
	}
	indexEmitRules() {
		for (let [e, t] of Object.entries(this.compiledScene.scene.stories)) for (let n of t.persos) {
			let t = `${e}:${n.id}`;
			for (let [r, i] of Object.entries(n.emit ?? {})) if (r !== "observe") for (let a of nh(i)) {
				if (a.capture !== void 0 || a.event === void 0) continue;
				let i = {
					storyId: e,
					persoId: n.id,
					persoKey: t,
					trigger: r,
					rule: a
				}, o = this.rulesByTrigger.get(r) ?? [];
				this.rulesByTrigger.set(r, [...o, i]);
			}
		}
	}
	handleNativeEvent(e) {
		if (this.destroyed || this.player.getLifecycleState() !== "playing") return;
		let t = this.resolveMatches(e);
		if (t.length === 0) return;
		for (let n of t) n.rule.preventDefault === !0 && e.preventDefault();
		let n = this.player.getCurrentTimeMs();
		this.pendingDispatch = this.pendingDispatch.then(async () => {
			if (!this.destroyed) for (let r of t) await this.emitMatch(r, e, n);
		}).catch((t) => {
			this.publishDiagnostic({
				severity: "error",
				code: "RUNTIME_EMIT_FAILED",
				message: t instanceof Error ? t.message : String(t),
				details: { context: { trigger: e.type } }
			});
		});
	}
	resolveMatches(e) {
		return (this.rulesByTrigger.get(e.type) ?? []).filter((t) => t.rule.keyCode === void 0 ? this.resolveActionTargets(t).some((t) => ch(e, t)) : sh(e) === t.rule.keyCode);
	}
	async emitMatch(e, t, n) {
		let r = rh(e.rule), i = await this.player.emit({
			name: e.rule.event.name,
			applyAtMs: n,
			storyId: r === "story" ? e.storyId : void 0,
			visibility: r,
			data: ih(e, t),
			context: {
				source: "dom",
				userEvent: e.trigger,
				persoId: e.persoId
			},
			mode: e.rule.event.mode
		});
		if (!(i.ok && i.issues.length === 0)) {
			if (i.issues.length === 0) {
				this.publishDiagnostic({
					severity: "error",
					code: "RUNTIME_EMIT_REJECTED",
					message: `Runtime event was rejected: ${e.rule.event.name}`,
					details: {
						refs: {
							storyId: e.storyId,
							persoId: e.persoId
						},
						context: { trigger: e.trigger }
					}
				});
				return;
			}
			for (let t of i.issues) this.publishDiagnostic({
				severity: "error",
				code: t.code,
				message: t.message,
				details: {
					refs: {
						storyId: e.storyId,
						persoId: e.persoId
					},
					context: {
						trigger: e.trigger,
						eventName: e.rule.event.name,
						depth: t.depth
					}
				}
			});
		}
	}
	resolveActionTargets(e) {
		let t = this.nodes.persoNodes.get(e.persoKey);
		if (e.rule.ref === void 0 || e.rule.ref === "root") return lh(t);
		let n = this.nodes.persoParts.get(e.persoKey)?.find((t) => t.partId === e.rule.ref);
		return n === void 0 ? (this.reportUnknownRef(e), []) : [n.nodeRef];
	}
	validateRefs() {
		for (let e of this.rulesByTrigger.values()) for (let t of e) t.rule.keyCode !== void 0 || t.rule.ref === void 0 || t.rule.ref === "root" || this.nodes.persoParts.get(t.persoKey)?.some((e) => e.partId === t.rule.ref) !== !0 && this.reportUnknownRef(t);
	}
	reportUnknownRef(e) {
		let t = `${e.persoKey}:${e.rule.ref}`;
		this.reportedUnknownRefs.has(t) || (this.reportedUnknownRefs.add(t), this.publishDiagnostic({
			severity: "error",
			code: "AUTHOR_COMPONENT_REF_UNKNOWN",
			message: `Component ref is unknown: ${e.rule.ref}`,
			details: {
				refs: {
					storyId: e.storyId,
					persoId: e.persoId
				},
				context: {
					trigger: e.trigger,
					ref: e.rule.ref
				}
			}
		}));
	}
	publishDiagnostic(e) {
		try {
			this.onDiagnostic?.(e);
		} catch {}
	}
};
function nh(e) {
	return Array.isArray(e) ? e.map((e) => e) : [e];
}
function rh(e) {
	return e.event.visibility ?? "story";
}
function ih(e, t) {
	let n = {
		...e.rule.event.data ?? {},
		...e.rule.data ?? {}
	}, r = ah(t.target);
	return r === void 0 ? n : {
		...n,
		...r
	};
}
function ah(e) {
	if (oh(e)) return { value: e.value };
}
function oh(e) {
	return typeof e == "object" && !!e && "tagName" in e && typeof e.tagName == "string" && /^(INPUT|TEXTAREA|SELECT)$/i.test(e.tagName) && "value" in e && typeof e.value == "string";
}
function sh(e) {
	if (!("code" in e)) return;
	let t = e.code;
	return typeof t == "string" ? t : void 0;
}
function ch(e, t) {
	if (t == null) return !1;
	if ((typeof e.composedPath == "function" ? e.composedPath() : []).some((e) => e === t)) return !0;
	let n = e.target, r = /* @__PURE__ */ new Set();
	for (; n != null && !r.has(n);) {
		if (n === t) return !0;
		if (r.add(n), !uh(n)) break;
		n = n.parentNode;
	}
	return !1;
}
function lh(e) {
	return e == null ? [] : Array.isArray(e) ? e : [e];
}
function uh(e) {
	return typeof e == "object" && !!e && "parentNode" in e;
}
//#endregion
//#region ../codplay/src/runtime/runner-html/motion-container.ts
var dh = class {
	root;
	persoNodes;
	keys = /* @__PURE__ */ new WeakMap();
	nextKey = 1;
	constructor(e, t) {
		this.root = e, this.persoNodes = t, this.elementsByKey.set(this.keyFor(e), e);
	}
	setRoot(e) {
		this.root !== e && (this.root = e, this.elementsByKey.clear(), this.elementsByKey.set(this.keyFor(e), e));
	}
	resolve(e) {
		let t = fh(e);
		if (t.length !== 1) return Object.freeze({
			element: e.root,
			key: this.keyFor(e.root)
		});
		let n = t[0], r = this.storyKey(n), i = mh(e.scenes, n, this.persoNodes) ?? e.root;
		return this.elementsByKey.set(r, i), Object.freeze({
			element: i,
			key: r
		});
	}
	resolveByKey(e) {
		if (e !== void 0) return this.keyFor(this.root) === e ? this.root : this.elementsByKey.get(e);
	}
	clear() {
		this.elementsByKey.clear();
	}
	elementsByKey = /* @__PURE__ */ new Map();
	keyFor(e) {
		let t = this.keys.get(e);
		if (t !== void 0) return t;
		let n = `motion-container-${this.nextKey}`;
		return this.nextKey += 1, this.keys.set(e, n), this.elementsByKey.set(n, e), n;
	}
	storyKey(e) {
		return `motion-story-${e}`;
	}
};
function fh(e) {
	return [...new Set((e.storyIds ?? []).filter((e) => e.length > 0))];
}
function ph(e) {
	return typeof e == "object" && !!e && "nodeType" in e && e.nodeType === 1 && "parentElement" in e;
}
function mh(e, t, n) {
	let r = /* @__PURE__ */ new Set();
	for (let n of e) for (let e of Object.values(n.persos)) {
		if (e.storyId !== t) continue;
		let i = n.graph.parentByPerso[e.key];
		(i === void 0 ? void 0 : n.persos[i])?.storyId === t || e.placement.mounted !== !0 || r.add(e.key);
	}
	let i = [...r].map((e) => n.get(e)).filter(ph);
	return i.length === 1 ? i[0] : void 0;
}
//#endregion
//#region ../codplay/src/runtime/motion/motion-pose.ts
function hh(e, t) {
	let n = kr(xh(e));
	if (n === null) throw Error("Motion graph cannot derive a pose from a singular parent.");
	let r = N(n, xh(t)), i = t.layoutOrigin ?? t.origin, a = N(n, {
		a: 1,
		b: 0,
		c: 0,
		d: 1,
		e: i.x,
		f: i.y
	});
	return {
		origin: [r.e, r.f],
		layoutOrigin: [a.e, a.f],
		matrix: Dh(r),
		width: t.localWidth,
		height: t.localHeight
	};
}
function gh(e) {
	return {
		origin: [e.origin.x, e.origin.y],
		layoutOrigin: [e.layoutOrigin?.x ?? e.origin.x, e.layoutOrigin?.y ?? e.origin.y],
		matrix: Dh(e.matrix),
		width: e.localWidth,
		height: e.localHeight
	};
}
function J(e, t) {
	return Sh(N(xh(e), {
		...t.matrix,
		e: t.origin[0],
		f: t.origin[1]
	}), e.matrix, t.width, t.height);
}
function _h(e, t, n, r) {
	let i = {
		a: kh(e.matrix.a, t.matrix.a, n),
		b: kh(e.matrix.b, t.matrix.b, n),
		c: kh(e.matrix.c, t.matrix.c, n),
		d: kh(e.matrix.d, t.matrix.d, n),
		e: 0,
		f: 0
	}, a = kh(e.localWidth, t.localWidth, n), o = kh(e.localHeight, t.localHeight, n), s = Ch(e), c = Ch(t), l = r === void 0 ? void 0 : Pn(r, s, c, n), u = l === void 0 ? [kh(e.origin.x, t.origin.x, n), kh(e.origin.y, t.origin.y, n)] : wh(l, i, a, o);
	return Sh({
		...i,
		e: u[0],
		f: u[1]
	}, t.parentMatrix, a, o);
}
function vh(e, t, n) {
	if (e.localWidth === t && e.localHeight === n) return e;
	let r = wh(Ch(e), e.matrix, t, n);
	return Sh({
		...e.matrix,
		e: r[0],
		f: r[1]
	}, e.parentMatrix, t, n);
}
function yh(e, t, n, r) {
	let i = Math.min(.999999, Math.max(1e-6, n)), a = 1 / (1 - i), o = {
		a: (e.matrix.a - t.matrix.a * i) * a,
		b: (e.matrix.b - t.matrix.b * i) * a,
		c: (e.matrix.c - t.matrix.c * i) * a,
		d: (e.matrix.d - t.matrix.d * i) * a,
		e: 0,
		f: 0
	}, s = (e.localWidth - t.localWidth * i) * a, c = (e.localHeight - t.localHeight * i) * a, l = Ch(e), u = Ch(t), d = r === void 0 ? [(e.origin.x - t.origin.x * i) * a, (e.origin.y - t.origin.y * i) * a] : Th(r, l[0], l[1], u[0], u[1], i), f = r === void 0 ? d : wh(d, o, s, c);
	return Sh({
		...o,
		e: f[0],
		f: f[1]
	}, e.parentMatrix, s, c);
}
function Y() {
	let e = Oh();
	return {
		rect: {
			left: 0,
			top: 0,
			width: 0,
			height: 0
		},
		origin: {
			x: 0,
			y: 0
		},
		matrix: e,
		parentMatrix: e,
		rotationMatrix: e,
		scaleX: 1,
		scaleY: 1,
		localWidth: 0,
		localHeight: 0,
		frameWidth: 0,
		frameHeight: 0
	};
}
function bh(e, t, n = .001) {
	return Ah(e.origin[0], t.origin[0], n) && Ah(e.origin[1], t.origin[1], n) && Ah(e.matrix.a, t.matrix.a, n) && Ah(e.matrix.b, t.matrix.b, n) && Ah(e.matrix.c, t.matrix.c, n) && Ah(e.matrix.d, t.matrix.d, n) && Ah(e.width, t.width, n) && Ah(e.height, t.height, n);
}
function xh(e) {
	return {
		...e.matrix,
		e: e.origin.x,
		f: e.origin.y
	};
}
function Sh(e, t, n, r) {
	let i = Dh(e), a = Eh(i, n, r), o = Math.max(1e-6, Math.hypot(i.a, i.b)), s = Math.max(1e-6, Math.hypot(i.c, i.d));
	return {
		rect: {
			left: e.e + a.left,
			top: e.f + a.top,
			width: a.width,
			height: a.height
		},
		origin: {
			x: e.e,
			y: e.f
		},
		matrix: i,
		parentMatrix: Dh(t),
		rotationMatrix: {
			a: i.a / o,
			b: i.b / o,
			c: i.c / s,
			d: i.d / s,
			e: 0,
			f: 0
		},
		scaleX: o,
		scaleY: s,
		localWidth: n,
		localHeight: r,
		frameWidth: n * o,
		frameHeight: r * s
	};
}
function Ch(e) {
	return [e.origin.x + e.matrix.a * e.localWidth / 2 + e.matrix.c * e.localHeight / 2, e.origin.y + e.matrix.b * e.localWidth / 2 + e.matrix.d * e.localHeight / 2];
}
function wh(e, t, n, r) {
	return [e[0] - t.a * n / 2 - t.c * r / 2, e[1] - t.b * n / 2 - t.d * r / 2];
}
function Th(e, t, n, r, i, a) {
	let [o, s] = Pn(e, [0, 0], [1, 0], a), c = 1 - o, l = c * c + s * s;
	if (l < 1e-9) return [t, n];
	let u = t - o * r + s * i, d = n - s * r - o * i;
	return [(c * u - s * d) / l, (s * u + c * d) / l];
}
function Eh(e, t, n) {
	let r = [
		[0, 0],
		[e.a * t, e.b * t],
		[e.c * n, e.d * n],
		[e.a * t + e.c * n, e.b * t + e.d * n]
	], i = Math.min(...r.map((e) => e[0])), a = Math.max(...r.map((e) => e[0])), o = Math.min(...r.map((e) => e[1])), s = Math.max(...r.map((e) => e[1]));
	return {
		left: i,
		top: o,
		width: a - i,
		height: s - o
	};
}
function Dh(e) {
	return {
		a: e.a,
		b: e.b,
		c: e.c,
		d: e.d,
		e: 0,
		f: 0
	};
}
function Oh() {
	return {
		a: 1,
		b: 0,
		c: 0,
		d: 1,
		e: 0,
		f: 0
	};
}
function kh(e, t, n) {
	return e + (t - e) * n;
}
function Ah(e, t, n) {
	return Math.abs(e - t) <= n;
}
//#endregion
//#region ../codplay/src/runtime/motion/motion-layout.ts
function jh(e) {
	let t = Fh(e), n = [], r = /* @__PURE__ */ new Map(), i = new Set(e.flatMap((e) => e.intents.map((e) => e.itemId))), a = /* @__PURE__ */ new Map(), o = Y(), s, c = "empty";
	for (let e of t) {
		let t = e.phase === "before" ? e.boundary.afterStart ?? e.boundary.after : e.boundary.after, l = Nh(e.boundary, i, t);
		e.phase === "before" ? (Rh(e.boundary.before, a, l, i, new Set(e.boundary.intents.map((e) => e.itemId))), r.set(e.boundary.id, Bh(e.boundary.before.timeMs, e.boundary.before.revision, e.boundary.before.rootPose ?? o, e.boundary.before.rootKey ?? s, a)), Mh(e.boundary, a, l)) : zh(e.boundary.before, e.snapshot, a, l, i, new Set(e.boundary.intents.map((e) => e.itemId))), e.snapshot.rootPose !== void 0 && (o = e.snapshot.rootPose), e.snapshot.rootKey !== void 0 && (s = e.snapshot.rootKey), c = e.snapshot.revision;
		let u = n.length === 0 ? -Infinity : e.timeMs;
		n.push({
			startAt: u,
			snapshot: Bh(e.timeMs, c, o, s, a)
		});
	}
	return Object.freeze({
		entries: Object.freeze(n),
		beforeByBoundaryId: r
	});
}
function Mh(e, t, n) {
	if (!e.intents.some((e) => e.targetReflow === !0)) return;
	let r = e.afterStart ?? e.after, i = new Set(e.intents.filter((e) => e.targetReflow === !0).map((e) => e.itemId)), a = /* @__PURE__ */ new Set();
	for (let t of e.intents) {
		if (t.targetReflow !== !0) continue;
		let n = e.before.items.get(t.itemId), i = r.items.get(t.itemId);
		n !== void 0 && a.add(n.targetId), i !== void 0 && a.add(i.targetId);
	}
	for (let r of i) {
		let i = e.afterStart?.items.get(r) ?? e.after.items.get(r);
		i !== void 0 && n.has(r) && t.set(r, i);
	}
	for (let n of /* @__PURE__ */ new Set([...e.before.items.keys(), ...r.items.keys()])) {
		if (i.has(n)) continue;
		let o = e.before.items.get(n), s = r.items.get(n);
		if (!(o !== void 0 && a.has(o.targetId) || s !== void 0 && a.has(s.targetId)) || s === void 0) continue;
		if (o === void 0) {
			t.set(n, s);
			continue;
		}
		let c = o.parentItemId === void 0 ? Y() : e.before.items.get(o.parentItemId)?.rootPose ?? t.get(o.parentItemId)?.rootPose;
		t.set(n, {
			...o,
			targetId: s.targetId,
			targetOrder: s.targetOrder,
			localPose: s.localPose,
			rootPose: c === void 0 ? s.rootPose : J(c, s.localPose)
		});
	}
}
function Nh(e, t, n) {
	let r = new Set(e.intents.map((e) => e.itemId)), i = /* @__PURE__ */ new Set();
	for (let t of e.intents) {
		if (t.targetReflow !== !0) continue;
		let r = e.before.items.get(t.itemId), a = n.items.get(t.itemId);
		r !== void 0 && i.add(r.targetId), a !== void 0 && i.add(a.targetId);
	}
	let a = /* @__PURE__ */ new Set();
	for (let o of /* @__PURE__ */ new Set([...e.before.items.keys(), ...n.items.keys()])) {
		let s = e.before.items.get(o), c = n.items.get(o), l = s !== void 0 && i.has(s.targetId) || c !== void 0 && i.has(c.targetId);
		(r.has(o) || l || !t.has(o)) && a.add(o);
	}
	return Ph(e.before, a), Ph(n, a), a;
}
function Ph(e, t) {
	for (let n of [...t]) {
		let r = e.items.get(n)?.parentItemId;
		for (; r !== void 0;) t.add(r), r = e.items.get(r)?.parentItemId;
	}
}
function Fh(e) {
	let t = [];
	return e.forEach((e, n) => {
		t.push({
			timeMs: e.before.timeMs,
			order: n * 2,
			phase: "before",
			boundary: e,
			snapshot: e.before
		}), t.push({
			timeMs: e.after.timeMs,
			order: n * 2 + 1,
			phase: "after",
			boundary: e,
			snapshot: e.after
		});
	}), Object.freeze(t.sort((e, t) => e.timeMs - t.timeMs || e.order - t.order));
}
function Ih(e, t) {
	if (e.entries.length === 0) return Bh(t, `${t}:empty`, Y(), void 0, /* @__PURE__ */ new Map());
	let n = 0, r = e.entries.length - 1;
	for (; n < r;) {
		let i = Math.ceil((n + r) / 2);
		e.entries[i].startAt <= t ? n = i : r = i - 1;
	}
	return e.entries[n].snapshot;
}
function Lh(e, t, n) {
	if (n !== void 0) {
		let t = e.beforeByBoundaryId.get(n);
		if (t !== void 0) return t;
	}
	if (e.entries.length === 0) return Bh(t, `${t}:empty`, Y(), void 0, /* @__PURE__ */ new Map());
	let r = 0, i = e.entries.length - 1;
	for (; r < i;) {
		let n = Math.floor((r + i + 1) / 2);
		e.entries[n].startAt < t ? r = n : i = n - 1;
	}
	return e.entries[r].snapshot;
}
function Rh(e, t, n, r, i) {
	for (let [a, o] of e.items) n.has(a) && (i.has(a) || !r.has(a) || !t.has(a)) && t.set(a, o);
}
function zh(e, t, n, r, i, a) {
	for (let o of e.items.keys()) !r.has(o) || t.items.has(o) || (a.has(o) || !i.has(o)) && n.delete(o);
	for (let [e, o] of t.items) r.has(e) && (a.has(e) || !i.has(e) || !n.has(e)) && n.set(e, o);
}
function Bh(e, t, n, r, i) {
	return Object.freeze({
		timeMs: e,
		revision: `${t}:${e}`,
		rootPose: n,
		...r === void 0 ? {} : { rootKey: r },
		items: new Map(i)
	});
}
//#endregion
//#region ../codplay/src/runtime/motion/motion-graph/graph-finalizer.ts
function Vh(e, t, n, r) {
	let i = e.tracksByItem.get(t);
	if (i === void 0) return;
	let a = i.segmentIndexById.get(n);
	if (a !== void 0) {
		if (r === void 0) {
			i.segments.splice(a, 1), i.segmentsById.delete(n), i.segmentIndexById.delete(n);
			for (let e = a; e < i.segments.length; e += 1) i.segmentIndexById.set(i.segments[e].id, e);
		} else i.segments[a] = r, i.segmentsById.set(n, r);
		i.segments.length === 0 && (e.tracksByItem.delete(t), e.presentationItemIds.delete(t));
	}
}
function Hh(e, t) {
	if (e !== void 0) return "segmentsById" in e ? e.segmentsById.get(t) : e.segments.find((e) => e.id === t);
}
function Uh(e) {
	let t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new WeakMap();
	for (let [r, i] of e.tracksByItem) {
		let e = i.segments.map((e) => Wh(e, n));
		t.set(r, Object.freeze({
			itemId: r,
			segments: Object.freeze(e)
		}));
	}
	let r = Kh(t, e.resetTimesByItem);
	return Object.freeze({
		revision: r,
		tracksByItem: t,
		resetTimesByItem: e.resetTimesByItem,
		presentationItemIds: Object.freeze([...e.presentationItemIds])
	});
}
function Wh(e, t) {
	let n = Gh(e.from, t), r = Gh(e.to, t), i = e.keyframes === void 0 ? void 0 : Object.freeze(e.keyframes.map((e) => Object.freeze({
		...e,
		attachment: Gh(e.attachment, t)
	}))), a = e.retargets === void 0 ? void 0 : Object.freeze(e.retargets.map((e) => Object.freeze({
		...e,
		from: Gh(e.from, t),
		to: Gh(e.to, t)
	})));
	return Object.freeze({
		...e,
		from: n,
		to: r,
		...i === void 0 ? {} : { keyframes: i },
		...a === void 0 ? {} : { retargets: a }
	});
}
function Gh(e, t) {
	let n = t.get(e);
	if (n !== void 0) return n;
	let r = Object.freeze({ ...e });
	return t.set(e, r), r;
}
function Kh(e, t) {
	return JSON.stringify({
		tracks: [...e].map(([e, t]) => [e, t.segments.map((e) => ({
			id: e.id,
			startAt: e.startAt,
			endAt: e.endAt,
			duration: e.duration,
			delay: e.delay,
			ease: e.ease,
			presentationMode: e.presentationMode,
			resize: e.resize,
			targetReflow: e.targetReflow,
			direct: e.direct,
			eventSeq: e.eventSeq,
			from: e.from,
			to: e.to,
			retargets: e.retargets,
			keyframes: e.keyframes,
			materializerOwned: e.materializerOwned,
			path: e.path
		}))]),
		resets: [...t]
	});
}
function qh(e) {
	let t = /* @__PURE__ */ new Map();
	for (let [n, r] of e ?? []) {
		let e = [...r].filter((e) => Number.isFinite(e.timeMs) && Number.isFinite(e.eventSeq)).sort((e, t) => e.timeMs - t.timeMs || e.eventSeq - t.eventSeq).filter((e, t, n) => t === 0 || e.timeMs !== n[t - 1].timeMs || e.eventSeq !== n[t - 1].eventSeq);
		e.length > 0 && t.set(n, Object.freeze(e));
	}
	return t;
}
function Jh(e, t, n) {
	let r = e.get(t);
	if (r === void 0) return;
	let i;
	for (let e of r) {
		if (e.timeMs > n) break;
		i = e;
	}
	return i;
}
function Yh(e, t) {
	return e.startAt > t.timeMs || e.startAt === t.timeMs && e.eventSeq !== void 0 && e.eventSeq > t.eventSeq;
}
//#endregion
//#region ../codplay/src/runtime/motion/motion-graph/graph-pose.ts
function Xh(e, t, n) {
	let r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set();
	for (let i of e.presentationItemIds) {
		let a = t.items.get(i), o = s(i);
		if (a === void 0 || o === void 0) continue;
		let c = e.tracksByItem.get(i), l = Jh(e.resetTimesByItem, i, n), u = xg(c, n, l), d = u === void 0 ? 1 : wg(u, n), f = ug(a, u), p = cg(a, c, u, n, l);
		r.set(i, {
			itemId: i,
			...a.parentItemId === void 0 ? {} : { parentItemId: a.parentItemId },
			targetId: a.targetId,
			targetOrder: a.targetOrder,
			...p?.motionRootKey === void 0 ? {} : { motionRootKey: p.motionRootKey },
			...p?.motionRootPose === void 0 ? {} : { motionRootPose: p.motionRootPose },
			...f === void 0 ? {} : { overlayStacking: f },
			...u?.resize === void 0 ? {} : { resize: u.resize },
			...u?.targetReflow === !0 ? { targetReflow: !0 } : {},
			...u?.direct === !0 ? { direct: !0 } : {},
			pose: o,
			representation: u === void 0 || u.materializerOwned ? "source" : d < 1 ? u.presentationMode : "source",
			...u === void 0 ? {} : { activeSegmentId: u.id },
			progress: d
		});
	}
	return Object.freeze({
		timeMs: n,
		graphRevision: e.revision,
		layoutRevision: t.revision,
		items: r
	});
	function s(r, l) {
		let u = l?.has(r) === !0 ? a.get(l) ?? c(l) : i, d = u.get(r);
		if (d !== void 0) return d;
		if (o.has(r)) throw Error(`Motion graph cycle detected: ${r}`);
		o.add(r);
		try {
			let i = eg(e, t, r, n, (e, t) => e === void 0 ? Y() : s(e, t ?? l), l);
			return i !== void 0 && u.set(r, i), i;
		} finally {
			o.delete(r);
		}
	}
	function c(e) {
		let t = /* @__PURE__ */ new Map();
		return a.set(e, t), t;
	}
}
function Zh(e, t, n) {
	let r = n.kind === "segment" ? n.segmentId : void 0, i = $h(e, t, n.itemId, n.boundary.timeMs, void 0, void 0, r);
	if (i !== void 0 || n.kind !== "segment") return i;
	let a = Hh(e.tracksByItem.get(n.itemId), n.segmentId)?.from.context;
	if (a === void 0) return;
	let o = Qh(a, t, n.itemId);
	return $h(e, t, n.itemId, n.boundary.timeMs, void 0, o, n.segmentId);
}
function Qh(e, t, n) {
	let r = new Map(e), i = r.get(n) ?? t.items.get(n);
	for (; i?.parentItemId !== void 0 && !r.has(i.parentItemId);) {
		let e = t.items.get(i.parentItemId);
		if (e === void 0) break;
		r.set(e.itemId, e), i = e;
	}
	return r;
}
function $h(e, t, n, r, i, a, o) {
	let s = a?.get(n) ?? t.items.get(n);
	if (s === void 0) return;
	let c = eg(e, t, n, r, (n, s) => n === void 0 ? Y() : i?.(n)?.pose ?? $h(e, t, n, r, i, s ?? a, o)?.pose, a, o);
	if (c === void 0) return;
	let l = Jh(e.resetTimesByItem, n, r), u = xg(e.tracksByItem.get(n), r, l, o), d = u === void 0 ? Sg(e.tracksByItem.get(n), r, l, o) : void 0, f = u === void 0 ? d?.side === "from" ? 0 : 1 : wg(u, r), p = ug(s, u);
	return {
		itemId: n,
		...s.parentItemId === void 0 ? {} : { parentItemId: s.parentItemId },
		targetId: s.targetId,
		targetOrder: s.targetOrder,
		...p === void 0 ? {} : { overlayStacking: p },
		...u?.resize === void 0 ? {} : { resize: u.resize },
		...u?.targetReflow === !0 ? { targetReflow: !0 } : {},
		...u?.direct === !0 ? { direct: !0 } : {},
		pose: c,
		representation: u === void 0 || u.materializerOwned ? "source" : f < 1 ? u.presentationMode : "source",
		...u === void 0 ? {} : { activeSegmentId: u.id },
		progress: f
	};
}
function eg(e, t, n, r, i, a, o) {
	let s = a?.get(n) ?? t.items.get(n), c = e.tracksByItem.get(n), l = Jh(e.resetTimesByItem, n, r), u = xg(c, r, l, o);
	if (u === void 0) {
		let e = Sg(c, r, l, o);
		if (e !== void 0) return ig(e.side === "from" ? e.segment.from : Cg(e.segment, r)?.to ?? e.segment.to, t, n, i, e.side === "to" && !e.segment.materializerOwned);
		if (s === void 0) return;
		let u = i(s.parentItemId, a);
		return u === void 0 ? s.rootPose : J(u, s.localPose);
	}
	let d = Cg(u, r), f = d === void 0 ? Tg(u, r) : void 0;
	return f === void 0 ? tg(_h(ig(d?.from ?? u.from, t, n, i, !1), ig(d?.to ?? u.to, t, n, i, !u.materializerOwned && !u.targetReflow), wg(u, r), u.path), u.resize, d?.to ?? u.to, i) : tg(_h(ig(f.from, t, n, i, !1), ig(f.to, t, n, i, !1), f.progress, u.path), u.resize, f.to, i);
}
function tg(e, t, n, r) {
	if (t === void 0) return e;
	let i = t.width === "container" || t.height === "container", a = !i || n.parentItemId === void 0 ? void 0 : r(n.parentItemId, n.context), o = !i || n.parentItemId === void 0 ? void 0 : n.context?.get(n.parentItemId), s = ng(t.width, e.localWidth, n.localPose.width, a?.localWidth, o?.localPose.width), c = ng(t.height, e.localHeight, n.localPose.height, a?.localHeight, o?.localPose.height);
	return s === e.localWidth && c === e.localHeight ? e : vh(e, s, c);
}
function ng(e, t, n, r, i) {
	return e === "preserve" || e !== "container" || r === void 0 || i === void 0 ? t : Math.max(0, r - Math.max(0, i - n));
}
function rg(e, t, n, r, i, a, o) {
	if (i === void 0) return Y();
	let s = t.items.has(i) ? t : n;
	return s.items.has(i) ? $h(e, s, i, a)?.pose : $h(e, r, i, a, void 0, o)?.pose;
}
function ig(e, t, n, r, i) {
	let a = i ? t.items.get(n) : void 0, o = a !== void 0 && a.parentItemId === e.parentItemId && a.targetId === e.targetId ? a.localPose : e.localPose, s = i && e.parentItemId !== void 0 && t.items.has(e.parentItemId) ? void 0 : e.context, c = r(e.parentItemId, s);
	return c === void 0 ? J(Y(), e.fallbackRootPose) : J(c, o);
}
function ag(e, t, n) {
	if (e.items.has(n)) return e;
	let r = new Map(t.items);
	for (let [t, n] of e.items) r.set(t, n);
	return {
		...e,
		revision: `${e.revision}:source:${t.revision}:${n}`,
		items: r
	};
}
function og(e, t, n, r) {
	return {
		...e.parentItemId === void 0 || n === void 0 ? {} : { parentItemId: e.parentItemId },
		targetId: e.targetId,
		targetOrder: e.targetOrder,
		localPose: n === void 0 ? gh(t) : hh(n, t),
		fallbackRootPose: gh(t),
		...e.motionRootKey === void 0 ? {} : { motionRootKey: e.motionRootKey },
		...e.motionRootPose === void 0 && r.rootPose === void 0 ? {} : { motionRootPose: e.motionRootPose ?? r.rootPose },
		context: fg(e, r)
	};
}
function sg(e, t, n = e) {
	return {
		...e.parentItemId === void 0 ? {} : { parentItemId: e.parentItemId },
		targetId: e.targetId,
		targetOrder: e.targetOrder,
		localPose: e.localPose,
		fallbackRootPose: gh(n.rootPose),
		...e.motionRootKey === void 0 && t.rootKey === void 0 ? {} : { motionRootKey: e.motionRootKey ?? t.rootKey },
		...e.motionRootPose === void 0 && t.rootPose === void 0 ? {} : { motionRootPose: e.motionRootPose ?? t.rootPose },
		context: fg(e, t)
	};
}
function cg(e, t, n, r, i) {
	if (n !== void 0) {
		let e = Cg(n, r)?.to ?? n.from;
		if (e.motionRootKey !== void 0 || e.motionRootPose !== void 0) return e;
	}
	let a = Sg(t, r, i);
	if (a !== void 0) {
		let e = a.side === "from" ? a.segment.from : Cg(a.segment, r)?.to ?? a.segment.to;
		if (e.motionRootKey !== void 0 || e.motionRootPose !== void 0) return e;
	}
	if (e.motionRootKey !== void 0 || e.motionRootPose !== void 0) return e;
}
function lg(e, t, n, r) {
	let i = e.startAt + e.delay, a = (t.keyframes ?? []).filter((t) => t.timeMs > i && t.timeMs < e.endAt).map((t) => {
		let n = t.items.get(e.itemId);
		return n === void 0 ? void 0 : {
			at: t.timeMs,
			attachment: sg(n, t)
		};
	}).filter((e) => e !== void 0);
	if (a.length === 0) return;
	let o = [{
		at: e.startAt,
		attachment: n
	}];
	return e.delay > 0 && o.push({
		at: i,
		attachment: n
	}), o.push(...a), o.push({
		at: e.endAt,
		attachment: r
	}), o.sort((e, t) => e.at - t.at);
}
function ug(e, t) {
	if (t === void 0 || t.presentationMode !== "reparent" || t.materializerOwned) return;
	let n = t.from, r = t.to, i = n.parentItemId ?? e.parentItemId;
	return Object.freeze({
		sourceParentItemId: i,
		targetParentItemId: r.parentItemId,
		sourceAncestorItemIds: dg(n, i),
		targetAncestorItemIds: dg(r, r.parentItemId),
		targetId: r.targetId,
		targetOrder: r.targetOrder
	});
}
function dg(e, t) {
	let n = [], r = /* @__PURE__ */ new Set(), i = t;
	for (; i !== void 0;) {
		if (r.has(i)) throw Error(`Motion attachment ancestor cycle detected: ${i}`);
		r.add(i), n.push(i), i = e.context?.get(i)?.parentItemId;
	}
	return Object.freeze(n);
}
function fg(e, t) {
	let n = /* @__PURE__ */ new Map(), r = e;
	for (; r !== void 0 && !n.has(r.itemId);) n.set(r.itemId, r), r = r.parentItemId === void 0 ? void 0 : t.items.get(r.parentItemId);
	return n;
}
function pg(e, t, n, r) {
	let i = t.after.items.get(n);
	if (i !== void 0 && i.parentItemId === e.to.parentItemId && i.targetId === e.to.targetId) return sg(i, t.after);
	let a = t.after.items.get(r) ?? t.afterStart?.items.get(r);
	if (a === void 0) return;
	let o = new Map(e.to.context ?? []), s = a;
	for (; s !== void 0 && !o.has(s.itemId);) o.set(s.itemId, s), s = s.parentItemId === void 0 ? void 0 : t.after.items.get(s.parentItemId) ?? t.afterStart?.items.get(s.parentItemId) ?? o.get(s.parentItemId);
	let c = e.to.parentItemId === r || e.to.parentItemId === void 0 && e.to.targetId === r;
	return {
		...e.to,
		fallbackRootPose: c ? gh(J(a.rootPose, e.to.localPose)) : e.to.fallbackRootPose,
		context: o
	};
}
function mg(e, t, n, r) {
	return n === void 0 ? Y() : $h(e, xg(e.tracksByItem.get(n), r, Jh(e.resetTimesByItem, n, r)) === void 0 ? t.after : t.before, n, r)?.pose ?? t.after.items.get(n)?.rootPose ?? t.afterStart?.items.get(n)?.rootPose;
}
function hg(e, t) {
	return gg(e, t) || !_g(e.rootPose, t.rootPose);
}
function gg(e, t) {
	return e.parentItemId !== t.parentItemId || e.targetId !== t.targetId || !bh(e.localPose, t.localPose);
}
function _g(e, t, n = .001) {
	return vg(e.origin.x, t.origin.x, n) && vg(e.origin.y, t.origin.y, n) && vg(e.matrix.a, t.matrix.a, n) && vg(e.matrix.b, t.matrix.b, n) && vg(e.matrix.c, t.matrix.c, n) && vg(e.matrix.d, t.matrix.d, n) && vg(e.localWidth, t.localWidth, n) && vg(e.localHeight, t.localHeight, n);
}
function vg(e, t, n) {
	return Math.abs(e - t) <= n;
}
function yg(e, t) {
	return e.parentItemId !== t.parentItemId || e.targetId !== t.targetId;
}
function bg(e, t, n) {
	if (e !== void 0) for (let r = e.segments.length - 1; r >= 0; --r) {
		let i = e.segments[r];
		if (!(n !== void 0 && !Yh(i, n)) && t >= i.startAt && t < i.endAt) return i;
	}
}
function xg(e, t, n, r) {
	if (e !== void 0) for (let i = e.segments.length - 1; i >= 0; --i) {
		let a = e.segments[i];
		if (a.id !== r && !(n !== void 0 && !Yh(a, n)) && t >= a.startAt && t <= a.endAt) return a;
	}
}
function Sg(e, t, n, r) {
	if (e === void 0 || e.segments.length === 0) return;
	let i = n === void 0 ? e.segments : e.segments.filter((e) => Yh(e, n)), a = r === void 0 ? i : i.filter((e) => e.id !== r && e.startAt <= t);
	if (a.length === 0) return;
	let o = a[0];
	if (t < o.startAt) return {
		segment: o,
		side: "from"
	};
	for (let e = a.length - 1; e >= 0; --e) {
		let n = a[e];
		if (t > n.endAt) return {
			segment: n,
			side: "to"
		};
	}
}
function Cg(e, t) {
	let n = e.retargets;
	if (n !== void 0) for (let e = n.length - 1; e >= 0; --e) {
		let r = n[e];
		if (r.at <= t) return r;
	}
}
function wg(e, t) {
	if (Cg(e, t) === void 0) {
		let n = Tg(e, t);
		if (n !== void 0) return n.progress;
	}
	return tr(e.tween, t - e.startAt);
}
function Tg(e, t) {
	let n = e.keyframes;
	if (n === void 0 || n.length < 2) return;
	let r = n[0];
	if (t <= r.at) return {
		from: r.attachment,
		to: r.attachment,
		progress: 0
	};
	for (let e = 1; e < n.length; e += 1) {
		let r = n[e], i = n[e - 1];
		if (t > r.at) continue;
		let a = r.at - i.at, o = a <= 0 ? 1 : Math.min(1, Math.max(0, (t - i.at) / a));
		return {
			from: i.attachment,
			to: r.attachment,
			progress: o
		};
	}
	let i = n[n.length - 1];
	return {
		from: i.attachment,
		to: i.attachment,
		progress: 1
	};
}
//#endregion
//#region ../codplay/src/runtime/motion/motion-graph/graph-builder.ts
function Eg(e, t = {}) {
	let n = qh(t.resetTimesByItem), r = jh(e), { graph: i, operations: a } = Dg(e, n);
	for (let e of a) {
		let t = ag(Lh(r, e.boundary.timeMs, e.boundary.id), e.boundary.before, e.itemId), n = t.items.get(e.itemId) ?? (e.kind === "target-retarget" ? void 0 : e.before), a = Zh(i, t, e);
		if (a === void 0 || n === void 0) {
			e.kind === "segment" && Vh(i, e.itemId, e.segmentId, void 0);
			continue;
		}
		if (e.kind === "target-retarget") {
			let r = Hh(i.tracksByItem.get(e.itemId), e.segmentId);
			if (r === void 0) continue;
			let o = pg(r, e.boundary, e.itemId, e.targetItemId);
			if (o === void 0) continue;
			let s = n.parentItemId === void 0 ? Y() : $h(i, t, n.parentItemId, e.boundary.timeMs)?.pose, c = ig(o, e.boundary.after, e.itemId, (t) => mg(i, e.boundary, t, e.boundary.timeMs), !1), l = wg(r, e.boundary.timeMs), u = yh(a.pose, c, l, r.path);
			Vh(i, e.itemId, e.segmentId, {
				...r,
				retargets: [...r.retargets ?? [], {
					at: e.boundary.timeMs,
					from: og(n, u, s, t),
					to: o
				}]
			});
			continue;
		}
		let o = n.parentItemId === void 0 ? Y() : $h(i, t, n.parentItemId, e.boundary.timeMs)?.pose;
		if (e.kind === "retarget") {
			let r = Hh(i.tracksByItem.get(e.itemId), e.segmentId);
			if (r === void 0) continue;
			let s = sg(e.after, e.boundary.after, e.endpointAfter), c = ig(s, e.boundary.after, e.itemId, (t, n) => rg(i, e.boundary.before, e.structuralAfter, e.boundary.after, t, e.boundary.timeMs, n), !1), l = wg(r, e.boundary.timeMs), u = yh(a.pose, c, l, r.path);
			Vh(i, e.itemId, e.segmentId, {
				...r,
				retargets: [...r.retargets ?? [], {
					at: e.boundary.timeMs,
					from: og(n, u, o, t),
					to: s
				}]
			});
			continue;
		}
		let s = Hh(i.tracksByItem.get(e.itemId), e.segmentId);
		if (s === void 0) continue;
		let c = og(n, a.pose, o, t), l = lg(s, e.boundary, c, s.to);
		Vh(i, e.itemId, e.segmentId, {
			...s,
			from: c,
			...l === void 0 ? {} : { keyframes: l }
		});
	}
	return {
		graph: Uh(i),
		naturalLayoutTimeline: r
	};
}
function Dg(e, t) {
	let n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Map(), a = {
		tracksByItem: n,
		presentationItemIds: r,
		resetTimesByItem: t
	}, o = [];
	for (let s of [...e].sort((e, t) => e.timeMs - t.timeMs)) {
		let e = Lg(s.intents);
		if (e === void 0) continue;
		let c = Og(s), l = /* @__PURE__ */ new Set();
		for (let e of c.changedItemIds) for (let t of i.get(e)?.values() ?? []) {
			if (!t.availableAtStart && !s.before.items.has(e) && s.after.items.has(e) || c.directItemIds.has(t.itemId)) continue;
			let r = Hh(n.get(t.itemId), t.segmentId);
			if (r === void 0 || s.timeMs < r.startAt || s.timeMs >= r.endAt) continue;
			let i = Fg(t.itemId, t.segmentId);
			l.has(i) || (l.add(i), o.push({
				kind: "target-retarget",
				boundary: s,
				itemId: t.itemId,
				segmentId: t.segmentId,
				targetItemId: e
			}));
		}
		let u = c.scope;
		for (let d of u.itemIds) {
			if (!u.segmentItemIds.has(d)) continue;
			let f = s.before.items.get(d), p = s.afterStart ?? s.after, m = c.directIntentByItem.get(d), h = m === void 0 ? p.items.get(d) : s.after.items.get(d) ?? p.items.get(d);
			if (f === void 0 || h === void 0 || m === void 0 && !gg(f, h)) continue;
			let g = s.after.items.get(d) ?? h, _ = m ?? e, v = bg(a.tracksByItem.get(d), s.timeMs, Jh(t, d, s.timeMs));
			if (m === void 0 && v !== void 0 && !yg(f, h)) {
				let e = v;
				if (l.has(Fg(d, e.id))) continue;
				o.push({
					kind: "retarget",
					boundary: s,
					itemId: d,
					before: f,
					after: h,
					structuralAfter: p,
					endpointAfter: g,
					segmentId: e.id
				});
				continue;
			}
			let y = `${s.id}:${d}`, b = m?.eventSeq ?? e.eventSeq, x = m === void 0 || v === void 0 ? {
				duration: _.duration,
				delay: _.delay ?? 0,
				endAt: s.timeMs + (_.delay ?? 0) + _.duration
			} : Rg(v, s.timeMs), ee = og(f, f.rootPose, f.parentItemId === void 0 ? Y() : s.before.items.get(f.parentItemId)?.rootPose, s.before), te = sg(h, s.after, g), S = {
				id: y,
				itemId: d,
				startAt: s.timeMs,
				...b === void 0 ? {} : { eventSeq: b },
				endAt: x.endAt,
				duration: x.duration,
				delay: x.delay,
				ease: _.ease,
				tween: er({
					from: 0,
					to: 1,
					duration: x.duration,
					delay: x.delay,
					ease: _.ease
				}),
				presentationMode: yg(f, h) ? "reparent" : m?.presentationMode ?? "local",
				...m?.resize === void 0 ? {} : { resize: m.resize },
				materializerOwned: m?.targetReflow === !1,
				...m?.path === void 0 ? {} : { path: m.path },
				targetReflow: m?.targetReflow === !0 || u.targetContainerItemIds.has(d),
				direct: m !== void 0,
				from: ee,
				to: te,
				boundaryId: s.id
			};
			Pg(i, d, S.startAt);
			let C = n.get(d) ?? {
				itemId: d,
				segments: [],
				segmentsById: /* @__PURE__ */ new Map(),
				segmentIndexById: /* @__PURE__ */ new Map()
			}, ne = C.segments.length;
			C.segments.push(S), C.segmentsById.set(S.id, S), C.segmentIndexById.set(S.id, ne), n.set(d, C), r.add(d), S.targetReflow && Mg(i, S, s.before), o.push({
				kind: "segment",
				boundary: s,
				itemId: d,
				before: f,
				after: h,
				structuralAfter: p,
				endpointAfter: g,
				segmentId: y
			});
		}
	}
	return {
		graph: a,
		operations: o
	};
}
function Og(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set();
	for (let i of e.intents) t.add(i.itemId), n.has(i.itemId) || n.set(i.itemId, i), i.targetReflow === !1 && r.add(i.itemId);
	return {
		directItemIds: t,
		directIntentByItem: n,
		nonReflowDirectItemIds: r,
		changedItemIds: Ig(e, t),
		scope: kg(e, t, r)
	};
}
function kg(e, t, n) {
	let r = new Set(t), i = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set();
	for (let t of e.intents) {
		if (t.targetReflow === !1) continue;
		let n = e.before.items.get(t.itemId), o = e.after.items.get(t.itemId);
		n !== void 0 && a.add(n.targetId), o !== void 0 && a.add(o.targetId), Ag(e.before, n, r, i), Ag(e.after, o, r, i);
	}
	for (let t of e.before.items.values()) a.has(t.targetId) && !n.has(t.itemId) && r.add(t.itemId);
	for (let t of e.after.items.values()) a.has(t.targetId) && !n.has(t.itemId) && r.add(t.itemId);
	let o = new Set(r);
	return jg(e.before, o), jg(e.after, o), {
		itemIds: o,
		segmentItemIds: r,
		targetContainerItemIds: i
	};
}
function Ag(e, t, n, r) {
	let i = t?.parentItemId, a = t?.targetId;
	i === void 0 || a === void 0 || !e.items.has(i) || i !== a && !i.endsWith(`:${a}`) || (n.add(i), r.add(i));
}
function jg(e, t) {
	for (let n of [...t]) {
		let r = e.items.get(n)?.parentItemId;
		for (; r !== void 0 && !t.has(r);) t.add(r), r = e.items.get(r)?.parentItemId;
	}
}
function Mg(e, t, n) {
	let r = Ng(t.to, n), i = t.to.parentItemId ?? t.to.targetId, a = e.get(i) ?? /* @__PURE__ */ new Map();
	a.set(t.id, {
		itemId: t.itemId,
		segmentId: t.id,
		startAt: t.startAt,
		endAt: t.endAt,
		availableAtStart: r
	}), e.set(i, a);
}
function Ng(e, t) {
	let n = e.parentItemId;
	for (; n !== void 0;) {
		let e = t.items.get(n);
		if (e === void 0) return !1;
		n = e.parentItemId;
	}
	return !0;
}
function Pg(e, t, n) {
	for (let [r, i] of e) {
		for (let [e, r] of i) r.itemId !== t || r.startAt > n || r.endAt <= n || i.delete(e);
		i.size === 0 && e.delete(r);
	}
}
function Fg(e, t) {
	return `${e}\u0000${t}`;
}
function Ig(e, t) {
	let n = e.afterStart, r = n === void 0 ? [] : [n];
	return [.../* @__PURE__ */ new Set([
		...e.before.items.keys(),
		...n === void 0 ? [] : n.items.keys(),
		...t
	])].filter((i) => {
		if (t.has(i)) return !0;
		if (n === void 0) return !1;
		let a = e.before.items.get(i);
		return a === void 0 ? r.some((e) => e.items.has(i)) : r.some((e) => {
			let t = e.items.get(i);
			return t === void 0 || hg(a, t);
		});
	});
}
function Lg(e) {
	let t;
	for (let n of e) {
		let e = n.startAt + (n.delay ?? 0) + n.duration, r = t === void 0 ? -Infinity : t.startAt + (t.delay ?? 0) + t.duration;
		(t === void 0 || e > r) && (t = n);
	}
	return t;
}
function Rg(e, t) {
	return {
		duration: Math.max(0, e.endAt - t),
		delay: 0,
		endAt: e.endAt
	};
}
//#endregion
//#region ../codplay/src/runtime/motion/motion-schedule.ts
function zg(e) {
	let t = Vg(e.action?.move), n = e.resolveActionTransition?.(e.action), r = Gg(t, n);
	if (r !== void 0) return Bg({
		id: e.id,
		eventId: e.eventId,
		itemId: e.itemId,
		declarationPath: e.declarationPath,
		startAt: e.startAt,
		...e.eventSeq === void 0 ? {} : { eventSeq: e.eventSeq },
		...e.storyIds === void 0 ? {} : { storyIds: Object.freeze([...new Set(e.storyIds)]) },
		transition: r
	});
}
function Bg(e) {
	let t = e.transition.delay ?? 0, n = t + e.transition.duration, r = Kg([n, ...e.transition.captureOffsetsMs ?? []]);
	return Object.freeze({
		id: e.id,
		eventId: e.eventId,
		itemId: e.itemId,
		declarationPath: Object.freeze([...e.declarationPath]),
		startAt: e.startAt,
		...e.eventSeq === void 0 ? {} : { eventSeq: e.eventSeq },
		...e.storyIds === void 0 ? {} : { storyIds: Object.freeze([...new Set(e.storyIds)]) },
		duration: e.transition.duration,
		delay: t,
		endAt: e.startAt + n,
		ease: e.transition.ease ?? "out(2)",
		presentationMode: qg(e.transition.reparent),
		...e.transition.resize === void 0 ? {} : { resize: e.transition.resize },
		targetReflow: e.transition.targetReflow ?? !1,
		...r.length === 0 ? {} : { keyTimes: Object.freeze(r.map((t) => e.startAt + t)) },
		...e.transition.path === void 0 ? {} : { path: e.transition.path }
	});
}
function Vg(e) {
	if (!T(e)) return;
	let t = e;
	if (!T(t.transition)) return;
	let n = t.transition;
	if (typeof n.duration != "number" || !Number.isFinite(n.duration) || n.duration <= 0 || n.ease !== void 0 && typeof n.ease != "string" || t.reparent !== void 0 && typeof t.reparent != "boolean" || Object.prototype.hasOwnProperty.call(t, "flipMode")) return;
	if (n.path !== void 0 && !Fn(n.path)) throw Error("Move transition path must be prepared by the scene compiler.");
	if (Object.prototype.hasOwnProperty.call(n, "traversal") || Object.prototype.hasOwnProperty.call(n, "pathAnchor")) return;
	let r = Hg(t.resize);
	return Object.freeze({
		duration: n.duration,
		...n.delay === void 0 ? {} : { delay: Wg(n.delay, "Move transition delay") },
		ease: n.ease ?? "out(2)",
		...t.reparent === void 0 ? {} : { reparent: t.reparent },
		...r === void 0 ? {} : { resize: r },
		targetReflow: !0,
		captureOffsetsMs: Object.freeze([n.duration + (n.delay === void 0 ? 0 : n.delay)]),
		...n.path === void 0 ? {} : { path: n.path }
	});
}
function Hg(e) {
	if (e === void 0) return;
	if (!T(e)) throw Error("Move resize must be an object.");
	let t = e, n = Ug(t.width, "width"), r = Ug(t.height, "height");
	return Object.freeze(n === void 0 && r === void 0 ? {} : {
		...n === void 0 ? {} : { width: n },
		...r === void 0 ? {} : { height: r }
	});
}
function Ug(e, t) {
	if (e !== void 0) {
		if (e === "auto" || e === "preserve" || e === "container") return e;
		throw Error(`Move resize ${t} must be auto, preserve or container.`);
	}
}
function Wg(e, t) {
	if (typeof e != "number" || !Number.isFinite(e) || e < 0) throw Error(`${t} must be a finite non-negative number.`);
	return e;
}
function Gg(e, t) {
	return e === void 0 ? t : t === void 0 ? e : Object.freeze({
		...e,
		captureOffsetsMs: Object.freeze(Kg([...e.captureOffsetsMs ?? [], ...t.captureOffsetsMs ?? []]))
	});
}
function Kg(e) {
	return [...new Set(e.filter((e) => Number.isFinite(e)))].sort((e, t) => e - t);
}
function qg(e) {
	return e === !0 ? "reparent" : "local";
}
//#endregion
//#region ../codplay/src/runtime/motion/motion-materializer.ts
var Jg = class {
	id;
	context;
	base;
	presentMotion;
	constructor(e, t) {
		this.base = e, this.id = e.id, this.context = e.context, this.presentMotion = t;
	}
	materializeComponent(e, t, n, r, i) {
		return this.base.materializeComponent(e, t, n, r, i);
	}
	materializeScene(e, t = { moveDeltas: [] }) {
		this.base.materializeScene(e, t), t.phase !== "geometry-capture" && this.presentMotion(e, t);
	}
	getForeignContentSurface(e) {
		return this.base.getForeignContentSurface?.(e);
	}
	getReplaceSurface(e) {
		return this.base.getReplaceSurface?.(e);
	}
	invalidateStructure() {
		this.base.invalidateStructure?.();
	}
	destroy() {
		this.base.destroy?.();
	}
}, Yg = {
	a: 1,
	b: 0,
	c: 0,
	d: 1,
	e: 0,
	f: 0
};
function Xg(e) {
	return {
		...e === void 0 ? {} : { boundaryRoot: e },
		geometries: /* @__PURE__ */ new Map(),
		poses: /* @__PURE__ */ new Map(),
		localBoxes: /* @__PURE__ */ new Map(),
		measuredRects: /* @__PURE__ */ new Map(),
		computedStyles: /* @__PURE__ */ new Map()
	};
}
function Zg(e) {
	if (!e || e === "none") return 0;
	let t = Number.parseFloat(e);
	return Number.isFinite(t) ? e.endsWith("rad") ? t : e.endsWith("grad") ? t * Math.PI / 200 : e.endsWith("turn") ? t * 2 * Math.PI : t * Math.PI / 180 : 0;
}
function Qg(e) {
	if (!e || e === "none") return {
		sx: 1,
		sy: 1
	};
	let t = e.split(/\s+/).map((e) => Number.parseFloat(e)), n = Number.isFinite(t[0]) ? t[0] : 1;
	return {
		sx: n,
		sy: Number.isFinite(t[1]) ? t[1] : n
	};
}
function $g(e, t, n) {
	let r = e.a * e.d - e.b * e.c;
	return Math.abs(r) < 1e-8 ? {
		x: t,
		y: n
	} : {
		x: (e.d * t - e.c * n) / r,
		y: (-e.b * t + e.a * n) / r
	};
}
function e_(e) {
	if (e === "" || e === "none") return { ...Yg };
	let t = e.match(/^matrix\(([^)]+)\)$/);
	if (t !== null) {
		let e = t[1].split(",").map((e) => Number(e.trim()));
		if (e.length === 6 && e.every((e) => Number.isFinite(e))) return {
			a: e[0],
			b: e[1],
			c: e[2],
			d: e[3],
			e: e[4],
			f: e[5]
		};
	}
	let n = e.match(/^matrix3d\(([^)]+)\)$/);
	if (n !== null) {
		let e = n[1].split(",").map((e) => Number(e.trim()));
		if (e.length === 16 && e.every((e) => Number.isFinite(e))) return {
			a: e[0],
			b: e[1],
			c: e[4],
			d: e[5],
			e: e[12],
			f: e[13]
		};
	}
	return { ...Yg };
}
function t_(e) {
	if (e === void 0) return { ...Yg };
	let t = e_(e.transform && e.transform.length > 0 ? e.transform : "none"), { sx: n, sy: r } = Qg(e.scale), i = Zg(e.rotate), a = {
		a: n,
		b: 0,
		c: 0,
		d: r,
		e: 0,
		f: 0
	}, o = Math.cos(i), s = Math.sin(i);
	return N({
		a: o,
		b: s,
		c: -s,
		d: o,
		e: 0,
		f: 0
	}, N(a, t));
}
function n_(e, t) {
	let n = t.localBoxes.get(e);
	if (n !== void 0) return n;
	let r = m_(e, t), i = Number.parseFloat(r?.width ?? ""), a = Number.parseFloat(r?.height ?? ""), o = Number.isFinite(i) && i > 0 ? i : null, s = Number.isFinite(a) && a > 0 ? a : null, c = r_(e, t), l = e instanceof HTMLElement ? {
		width: o ?? (e.offsetWidth > 0 ? e.offsetWidth : null) ?? (e.clientWidth > 0 ? e.clientWidth : null) ?? (c !== void 0 && c.width > 0 ? c.width : null),
		height: s ?? (e.offsetHeight > 0 ? e.offsetHeight : null) ?? (e.clientHeight > 0 ? e.clientHeight : null) ?? (c !== void 0 && c.height > 0 ? c.height : null)
	} : {
		width: o ?? (c !== void 0 && c.width > 0 ? c.width : null),
		height: s ?? (c !== void 0 && c.height > 0 ? c.height : null)
	};
	return t.localBoxes.set(e, l), l;
}
function r_(e, t) {
	if (t.measuredRects.has(e)) return t.measuredRects.get(e);
	let n = e;
	if (typeof n.getBoundingClientRect != "function") {
		t.measuredRects.set(e, void 0);
		return;
	}
	let r = n.getBoundingClientRect(), i = Number.isFinite(r.left) && Number.isFinite(r.top) && Number.isFinite(r.width) && Number.isFinite(r.height) ? {
		left: r.left,
		top: r.top,
		width: r.width,
		height: r.height
	} : void 0;
	return t.measuredRects.set(e, i), i;
}
function i_(e, t) {
	if (e === void 0) return 0;
	let n = Number.parseFloat(e);
	return Number.isFinite(n) ? e.endsWith("%") ? n / 100 * t : n : 0;
}
function a_(e, t) {
	if (!(e instanceof HTMLElement)) return {
		x: 0,
		y: 0
	};
	let n = e.offsetParent instanceof HTMLElement ? e.offsetParent : null, r = o_(e, n);
	if (!(t instanceof HTMLElement) || n === t) return {
		x: r.x + (n === t && t instanceof HTMLElement ? t.clientLeft : 0),
		y: r.y + (n === t && t instanceof HTMLElement ? t.clientTop : 0)
	};
	let i = o_(t, n);
	return {
		x: r.x - i.x + t.clientLeft,
		y: r.y - i.y + t.clientTop
	};
}
function o_(e, t) {
	let n = e.offsetLeft, r = e.offsetTop, i = e.offsetParent instanceof HTMLElement ? e.offsetParent : null;
	for (; i !== null && i !== t;) n += i.offsetLeft, r += i.offsetTop, i = i.offsetParent instanceof HTMLElement ? i.offsetParent : null;
	return {
		x: n,
		y: r
	};
}
function s_(e, t, n) {
	let r = t_(e), i = {
		...r,
		e: 0,
		f: 0
	}, a = e?.translate ?? "none", o = a === "none" ? [] : a.split(/\s+/).filter(Boolean), s = (e?.transformOrigin ?? "").split(/\s+/).filter(Boolean), c = i_(s[0], t / 2), l = i_(s[1], n / 2), u = i_(o[0], t), d = i_(o[1], n);
	return {
		matrix: i,
		displacement: {
			x: r.e + u + c - (i.a * c + i.c * l),
			y: r.f + d + l - (i.b * c + i.d * l)
		}
	};
}
function c_(e, t) {
	let n = t.geometries.get(e);
	if (n !== void 0) return n;
	let r = p_(e, t), i = r === null ? {
		origin: {
			x: 0,
			y: 0
		},
		layoutOrigin: {
			x: 0,
			y: 0
		},
		matrix: { ...Yg }
	} : c_(r, t), a = n_(e, t), o = a.width ?? 0, s = a.height ?? 0, c = a_(e, r), l = s_(m_(e, t), o, s), u = N(i.matrix, l.matrix), d = {
		x: c.x + l.displacement.x,
		y: c.y + l.displacement.y
	}, f = {
		x: i.origin.x + i.matrix.a * d.x + i.matrix.c * d.y,
		y: i.origin.y + i.matrix.b * d.x + i.matrix.d * d.y
	}, p = {
		x: i.origin.x + i.matrix.a * c.x + i.matrix.c * c.y,
		y: i.origin.y + i.matrix.b * c.x + i.matrix.d * c.y
	}, m = {
		origin: l_(e, u, o, s, f, t),
		layoutOrigin: p,
		matrix: u
	};
	return t.geometries.set(e, m), m;
}
function l_(e, t, n, r, i, a) {
	let o = r_(e, a);
	if (o === void 0 || !(Number.isFinite(o.left) && Number.isFinite(o.top) && !(n > 0 && o.width === 0) && !(r > 0 && o.height === 0))) return i;
	let s = u_(t, n, r), c = e.ownerDocument.defaultView?.scrollX ?? 0, l = e.ownerDocument.defaultView?.scrollY ?? 0;
	return {
		x: o.left + c - s.left,
		y: o.top + l - s.top
	};
}
function u_(e, t, n) {
	let r = [
		[0, 0],
		[e.a * t, e.b * t],
		[e.c * n, e.d * n],
		[e.a * t + e.c * n, e.b * t + e.d * n]
	], i = Math.min(...r.map((e) => e[0])), a = Math.max(...r.map((e) => e[0])), o = Math.min(...r.map((e) => e[1])), s = Math.max(...r.map((e) => e[1]));
	return {
		left: i,
		top: o,
		width: a - i,
		height: s - o
	};
}
function d_(e) {
	let t = Math.max(1e-8, Math.hypot(e.a, e.b)), n = Math.max(1e-8, Math.hypot(e.c, e.d));
	return {
		a: e.a / t,
		b: e.b / t,
		c: e.c / n,
		d: e.d / n,
		e: 0,
		f: 0
	};
}
function f_(e, t = Xg()) {
	let n = t.poses.get(e);
	if (n !== void 0) return n;
	let r = c_(e, t), i = p_(e, t), a = i === null ? { ...Yg } : c_(i, t).matrix, o = Math.max(1e-6, Math.hypot(r.matrix.a, r.matrix.b)), s = Math.max(1e-6, Math.hypot(r.matrix.c, r.matrix.d)), c = n_(e, t), l = c.width ?? 0, u = c.height ?? 0, d = u_(r.matrix, l, u), f = e.ownerDocument.defaultView?.scrollX ?? 0, p = e.ownerDocument.defaultView?.scrollY ?? 0, m = {
		rect: {
			left: r.origin.x + d.left - f,
			top: r.origin.y + d.top - p,
			width: d.width,
			height: d.height
		},
		origin: {
			x: r.origin.x - f,
			y: r.origin.y - p
		},
		layoutOrigin: {
			x: r.layoutOrigin.x - f,
			y: r.layoutOrigin.y - p
		},
		matrix: r.matrix,
		parentMatrix: a,
		rotationMatrix: d_(r.matrix),
		scaleX: o,
		scaleY: s,
		localWidth: l,
		localHeight: u,
		frameWidth: l * o,
		frameHeight: u * s
	};
	return t.poses.set(e, m), m;
}
function p_(e, t) {
	return t.boundaryRoot === e ? null : e.parentElement;
}
function m_(e, t) {
	if (t.computedStyles.has(e)) return t.computedStyles.get(e);
	let n = e.ownerDocument.defaultView?.getComputedStyle(e);
	return t.computedStyles.set(e, n), n;
}
//#endregion
//#region ../codplay/src/runtime/runner-html/layout-snapshot.ts
function X(e, t, n, r, i) {
	if (!hm(e)) return __(n);
	let a = Xg(e), o = f_(e, a), s = Y(), c = g_(n, r), l = /* @__PURE__ */ new Map();
	for (let e of Object.values(n.persos)) {
		if (!e.placement.mounted || !c.has(e.key)) continue;
		let n = t.get(e.key);
		hm(n) && l.set(e.key, f_(n, a));
	}
	let u = /* @__PURE__ */ new Map();
	for (let e of c) f(e);
	let d = `${n.graph.revision}:${n.timeMs}:${JSON.stringify([...u.values()].map((e) => [
		e.itemId,
		e.parentItemId,
		e.targetId,
		e.targetOrder,
		e.localPose.origin,
		e.localPose.layoutOrigin,
		e.localPose.matrix,
		e.localPose.width,
		e.localPose.height
	]))}`;
	return Object.freeze({
		timeMs: n.timeMs,
		revision: d,
		rootPose: o,
		...i === void 0 ? {} : { rootKey: i },
		items: u
	});
	function f(e) {
		if (u.has(e)) return;
		let t = l.get(e), r = n.graph.targetByPerso[e];
		if (t === void 0 || r === void 0) return;
		let a = n.graph.parentByPerso[e], c = h_(n, r, e);
		a !== void 0 && f(a);
		let d = a === void 0 ? o : l.get(a), p = hh(d === void 0 ? o : d, t), m = hh(o, t);
		u.set(e, Object.freeze({
			itemId: e,
			...a === void 0 ? {} : { parentItemId: a },
			targetId: r,
			targetOrder: c,
			localPose: p,
			rootPose: J(s, m),
			...i === void 0 ? {} : { motionRootKey: i },
			motionRootPose: o
		}));
	}
}
function h_(e, t, n) {
	let r = e.graph.childrenByTarget[t]?.indexOf(n) ?? -1;
	return r < 0 ? 2 ** 53 - 1 : r;
}
function g_(e, t) {
	if (t === void 0) return new Set(Object.values(e.persos).filter((e) => e.placement.mounted).map((e) => e.key));
	let n = new Set([...t].map((t) => e.persos[t]?.storyId).filter((e) => e !== void 0)), r = /* @__PURE__ */ new Set();
	for (let i of t) {
		e.persos[i]?.placement.mounted && r.add(i);
		let t = e.graph.parentByPerso[i];
		for (; t !== void 0 && !r.has(t);) {
			let i = e.persos[t];
			if (n.size > 0 && (i === void 0 || !n.has(i.storyId))) break;
			i?.placement.mounted && r.add(t), t = e.graph.parentByPerso[t];
		}
	}
	return r;
}
function __(e) {
	return Object.freeze({
		timeMs: e.timeMs,
		revision: `${e.graph.revision}:${e.timeMs}:unmeasured`,
		rootPose: Y(),
		items: /* @__PURE__ */ new Map()
	});
}
//#endregion
//#region ../codplay/src/runtime/runner-html/motion-presentation/geometry.ts
function v_(e, t, n, r) {
	let i = C_(t, n, r);
	e.lastWidth !== r.localWidth && (e.ghost.style.width = `${r.localWidth}px`, e.lastWidth = r.localWidth), e.lastHeight !== r.localHeight && (e.ghost.style.height = `${r.localHeight}px`, e.lastHeight = r.localHeight), !(e.lastMatrix !== void 0 && S_(e.lastMatrix, i)) && (e.ghost.style.transform = `matrix(${i.a}, ${i.b}, ${i.c}, ${i.d}, ${i.e}, ${i.f})`, e.lastMatrix = i);
}
function y_(e, t) {
	let n = t.trim().toLowerCase();
	if (n === "" || n === "none") return !0;
	if (e === "rotate") return /^0(?:deg|grad|rad|turn)?$/.test(n);
	if (e === "scale") {
		let e = n.split(/\s+/);
		return e.length <= 3 && e.every((e) => e === "1");
	}
	let r = n.split(/\s+/);
	return r.length <= 3 && r.every((e) => /^0(?:[a-z%]+)?$/.test(e));
}
function b_(e, t, n) {
	let r = N(n, x_(t));
	return {
		...r,
		e: r.e - e[0],
		f: r.f - e[1]
	};
}
function x_(e) {
	return {
		...e.matrix,
		e: e.origin.x,
		f: e.origin.y
	};
}
function S_(e, t) {
	return e.a === t.a && e.b === t.b && e.c === t.c && e.d === t.d && e.e === t.e && e.f === t.f;
}
function C_(e, t, n) {
	let r = $g(e.matrix, n.origin.x - e.origin.x, n.origin.y - e.origin.y);
	return {
		...N(t, {
			...n.matrix,
			e: 0,
			f: 0
		}),
		e: r.x,
		f: r.y
	};
}
//#endregion
//#region ../codplay/src/runtime/runner-html/motion-presentation/tree.ts
function w_(e, t) {
	let n = [], r = t;
	for (; r !== e;) {
		if (r === null) return;
		let e = r.parentElement;
		if (e === null) return;
		let t = Array.from(e.children).indexOf(r);
		if (t < 0) return;
		n.unshift(t), r = e;
	}
	return n;
}
function T_(e, t) {
	let n = e;
	for (let e of t) {
		let t = n.children[e];
		if (!(t instanceof HTMLElement)) return;
		n = t;
	}
	return n;
}
function E_(e, t, n, r) {
	let i = /* @__PURE__ */ new Set(), a = k_(e, r, t);
	for (; a !== void 0;) {
		if (i.has(a)) throw Error(`Motion presentation cycle detected: ${a}`);
		if (i.add(a), n.has(a)) return a;
		a = k_(e, r, a);
	}
}
function D_(e, t, n) {
	let r = [], i = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set(), o = new Map([...t].map((e, t) => [e, t])), s = [...t].sort((t, r) => A_(e, n, t, r) || o.get(t) - o.get(r));
	for (let e of s) c(e);
	return r;
	function c(o) {
		if (i.has(o)) return;
		if (a.has(o)) throw Error(`Motion presentation cycle detected: ${o}`);
		a.add(o);
		let s = /* @__PURE__ */ new Set(), l = k_(e, n, o);
		for (; l !== void 0 && !t.has(l);) {
			if (s.has(l)) throw Error(`Motion presentation cycle detected: ${l}`);
			s.add(l), l = k_(e, n, l);
		}
		l !== void 0 && c(l), a.delete(o), i.add(o), r.push(o);
	}
}
function O_(e, t, n) {
	let r = new Map([...t].map((e, t) => [e, t])), i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
	for (let e of t) i.set(e, /* @__PURE__ */ new Set()), a.set(e, /* @__PURE__ */ new Set());
	for (let r of t) {
		let i = e.items.get(r), a = i?.overlayStacking === void 0 ? M_(e, n, t, k_(e, n, r)) : [...i.overlayStacking.sourceAncestorItemIds, ...i.overlayStacking.targetAncestorItemIds], o = /* @__PURE__ */ new Set();
		for (let e of a) !t.has(e) || o.has(e) || (o.add(e), c(e, r));
	}
	let o = [...t].filter((e) => i.get(e).size === 0), s = [];
	for (; o.length > 0;) {
		o.sort((t, i) => A_(e, n, t, i, P_) || r.get(t) - r.get(i));
		let t = o.shift();
		s.push(t);
		for (let e of a.get(t)) {
			let n = i.get(e);
			n.delete(t), n.size === 0 && o.push(e);
		}
	}
	if (s.length !== t.size) throw Error("Motion overlay stacking cycle detected.");
	return s;
	function c(e, t) {
		if (e === t) throw Error(`Motion overlay stacking cycle detected: ${t}`);
		let n = i.get(t);
		n.has(e) || (n.add(e), a.get(e).add(t));
	}
}
function k_(e, t, n) {
	let r = e.items.get(n);
	return r === void 0 ? t?.items.get(n)?.parentItemId : r.parentItemId;
}
function A_(e, t, n, r, i = N_) {
	let a = j_(e, t, n, i), o = j_(e, t, r, i), s = Math.min(a.length, o.length);
	for (let e = 0; e < s; e += 1) {
		let t = a[e], n = o[e];
		if (t.itemId !== n.itemId) {
			if (t.parentItemId === n.parentItemId && t.targetId === n.targetId) {
				if (t.targetOrder < n.targetOrder) return -1;
				if (t.targetOrder > n.targetOrder) return 1;
			}
			return 0;
		}
	}
	return a.length < o.length ? -1 : +(a.length > o.length);
}
function j_(e, t, n, r = N_) {
	let i = [], a = /* @__PURE__ */ new Set(), o = n;
	for (; o !== void 0;) {
		if (a.has(o)) throw Error(`Motion presentation cycle detected: ${o}`);
		a.add(o);
		let n = r(e, t, o);
		if (n === void 0) break;
		i.unshift({
			itemId: o,
			...n
		}), o = n.parentItemId;
	}
	return i;
}
function M_(e, t, n, r) {
	let i = [], a = /* @__PURE__ */ new Set(), o = r;
	for (; o !== void 0;) {
		if (a.has(o)) throw Error(`Motion presentation cycle detected: ${o}`);
		a.add(o), n.has(o) && i.push(o), o = k_(e, t, o);
	}
	return i;
}
function N_(e, t, n) {
	let r = e.items.get(n);
	if (r !== void 0) return {
		parentItemId: r.parentItemId,
		targetId: r.targetId,
		targetOrder: r.targetOrder
	};
	let i = t?.items.get(n);
	if (i !== void 0) return {
		parentItemId: i.parentItemId,
		targetId: i.targetId,
		targetOrder: i.targetOrder
	};
}
function P_(e, t, n) {
	let r = e.items.get(n);
	return r?.overlayStacking === void 0 ? N_(e, t, n) : {
		parentItemId: r.overlayStacking.targetParentItemId,
		targetId: r.overlayStacking.targetId,
		targetOrder: r.overlayStacking.targetOrder
	};
}
function F_(e) {
	e !== void 0 && (typeof e.remove == "function" ? e.remove() : e.parentElement?.removeChild(e));
}
function I_(e, t) {
	if (e.length !== t.length) return !1;
	for (let n = 0; n < e.length; n += 1) if (e[n] !== t[n]) return !1;
	return !0;
}
//#endregion
//#region ../codplay/src/runtime/runner-html/motion-style-layer.ts
var L_ = ["width", "height"], R_ = ["min-width", "min-height"], z_ = [
	"transition",
	"transform-origin",
	"translate",
	"rotate",
	"scale",
	"transform"
], B_ = ["visibility"], V_ = "\n[data-codplay-motion-seek] * {\n  transition: none !important;\n  animation: none !important;\n}\n", H_ = /* @__PURE__ */ new WeakSet();
function U_(e) {
	return Z_(e), W_();
}
function W_() {
	let e = /* @__PURE__ */ new WeakMap(), t = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap();
	return {
		applyLocalSize: (t, n, r) => {
			Z(t, "width", `${n}px`, e), Z(t, "height", `${r}px`, e);
		},
		applyPreservedSize: (e, n, r) => {
			n !== void 0 && Z(e, "min-width", `${n}px`, t), r !== void 0 && Z(e, "min-height", `${r}px`, t);
		},
		clearPreservedSize: (e) => {
			Q_(e, R_, t);
		},
		applyLocalTransform: (t, n) => {
			Z(t, "transition", "none", e), Z(t, "transform-origin", "0 0", e), Z(t, "translate", "none", e), Z(t, "rotate", "none", e), Z(t, "scale", "none", e), Z(t, "transform", ov(n), e);
		},
		clearLocal: (t) => {
			Q_(t, L_, e), Q_(t, z_, e);
		},
		applyHidden: (e) => Z(e, "visibility", "hidden", n),
		clearHidden: (e) => Q_(e, B_, n),
		captureTemplate: (r) => G_(r, e, t, n),
		syncTemplate: (r, i) => K_(r, i, (r, i) => {
			!(r instanceof HTMLElement) || !(i instanceof HTMLElement) || (X_(r, i, e), X_(r, i, t), X_(r, i, n));
		})
	};
}
function G_(e, t, n, r) {
	let i = e.cloneNode(!0);
	return Y_(e, i, (e, i) => {
		X_(e, i, t), X_(e, i, n), X_(e, i, r);
	}), i;
}
function K_(e, t, n) {
	return q_(e, t, n);
}
function q_(e, t, n) {
	if (e.tagName !== t.tagName || e.namespaceURI !== t.namespaceURI) return !1;
	let r = new Map(Array.from(e.attributes).map((e) => [e.name, e.value]));
	for (let e of Array.from(t.attributes)) r.has(e.name) || t.removeAttribute(e.name);
	for (let [e, n] of r) t.getAttribute(e) !== n && t.setAttribute(e, n);
	n(e, t);
	let i = Array.from(e.childNodes), a = Array.from(t.childNodes);
	if (i.length !== a.length) return !1;
	for (let e = 0; e < i.length; e += 1) {
		let t = i[e], r = a[e];
		if (t.nodeType !== r.nodeType) return !1;
		if (J_(t) && J_(r)) {
			if (!q_(t, r, n)) return !1;
			continue;
		}
		t.nodeValue !== r.nodeValue && (r.nodeValue = t.nodeValue);
	}
	return !0;
}
function J_(e) {
	return e.nodeType === 1;
}
function Y_(e, t, n) {
	n(e, t);
	let r = Array.from(e.children), i = Array.from(t.children);
	for (let e = 0; e < i.length; e += 1) {
		let t = i[e], a = r[e];
		!(t instanceof HTMLElement) || !(a instanceof HTMLElement) || Y_(a, t, n);
	}
}
function X_(e, t, n) {
	let r = n.get(e);
	if (r !== void 0) for (let [n, i] of r) {
		let r = $_(e, n);
		nv(t, n, iv(r, i.transient) ? i.authored : r);
	}
}
function Z_(e) {
	let t = e.ownerDocument;
	if (t === void 0 || H_.has(t)) return;
	let n = t;
	if (typeof n.createElement != "function") return;
	let r = n.createElement("style");
	r.textContent = V_;
	let i = t.head ?? t.documentElement ?? e;
	typeof i.appendChild == "function" && (i.appendChild(r), H_.add(t));
}
function Z(e, t, n, r) {
	let i = r.get(e);
	i === void 0 && (i = /* @__PURE__ */ new Map(), r.set(e, i));
	let a = i.get(t), o = a?.authored ?? $_(e, t);
	if (a !== void 0) {
		let n = $_(e, t);
		iv(n, a.transient) ? nv(e, t, o) : o = n;
	}
	tv(e, t, n, "important"), i.set(t, {
		authored: o,
		transient: $_(e, t)
	});
}
function Q_(e, t, n) {
	let r = n.get(e);
	if (r !== void 0) {
		for (let n of t) {
			let t = r.get(n);
			t !== void 0 && (iv($_(e, n), t.transient) && nv(e, n, t.authored), r.delete(n));
		}
		r.size === 0 && n.delete(e);
	}
}
function $_(e, t) {
	let n = e.style, r = typeof n.getPropertyValue == "function" ? n.getPropertyValue(t) : ev(n, t), i = typeof n.getPropertyPriority == "function" ? n.getPropertyPriority(t) : "";
	return {
		value: r ?? "",
		priority: i ?? ""
	};
}
function ev(e, t) {
	let n = e[av(t)] ?? e[t];
	return typeof n == "string" ? n : "";
}
function tv(e, t, n, r) {
	let i = e.style;
	if (typeof i.setProperty == "function") {
		i.setProperty(t, n, r);
		return;
	}
	i[av(t)] = n;
}
function nv(e, t, n) {
	if (n.value === "") {
		rv(e, t);
		return;
	}
	tv(e, t, n.value, n.priority);
}
function rv(e, t) {
	let n = e.style;
	if (typeof n.removeProperty == "function") {
		n.removeProperty(t);
		return;
	}
	delete n[av(t)], delete n[t];
}
function iv(e, t) {
	return e.value === t.value && e.priority === t.priority;
}
function av(e) {
	return e.replace(/-([a-z])/g, (e, t) => t.toUpperCase());
}
function ov(e) {
	return `matrix(${e.a}, ${e.b}, ${e.c}, ${e.d}, ${e.e}, ${e.f})`;
}
//#endregion
//#region ../codplay/src/runtime/runner-html/motion-presentation-host/local-presenter.ts
var sv = class {
	localTargets = /* @__PURE__ */ new Map();
	localSizes = /* @__PURE__ */ new Map();
	localTransforms = /* @__PURE__ */ new Map();
	preservedSizes = /* @__PURE__ */ new Map();
	transientStyles;
	constructor(e) {
		this.transientStyles = e;
	}
	prepareNaturalCapture() {
		for (let e of this.localTargets.values()) this.transientStyles.clearLocal(e);
		this.localTargets.clear(), this.localSizes.clear(), this.localTransforms.clear();
		for (let e of this.preservedSizes.values()) this.transientStyles.clearPreservedSize(e.target);
		this.preservedSizes.clear();
	}
	clearTransientPresentation(e) {
		if (e === void 0) {
			this.prepareNaturalCapture();
			return;
		}
		for (let t of e) {
			let e = this.localTargets.get(t);
			e !== void 0 && !this.isLocalTargetStillUsed(t, e) && this.transientStyles.clearLocal(e), this.localTargets.delete(t), this.localSizes.delete(t), this.localTransforms.delete(t);
			let n = this.preservedSizes.get(t);
			n !== void 0 && (this.transientStyles.clearPreservedSize(n.target), this.preservedSizes.delete(t));
		}
	}
	removeInactive(e) {
		for (let [t, n] of [...this.localTargets]) e.has(t) || (this.transientStyles.clearLocal(n), this.localTargets.delete(t), this.localSizes.delete(t), this.localTransforms.delete(t));
	}
	commit(e, t, n, r, i, a) {
		for (let a of t) {
			let t = e.items.get(a), o = t === void 0 ? void 0 : i(a, e, n, r);
			t !== void 0 && o !== void 0 && this.prepare(a, t, o);
		}
		this.syncPreservedSizes(e, n, r, i, a);
		let o = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map();
		for (let n of t) {
			let t = e.items.get(n), i = this.localTargets.get(n);
			t !== void 0 && i !== void 0 && this.apply(n, t, i, e, r, o, s);
		}
	}
	prepare(e, t, n) {
		let r = this.localTargets.get(e);
		r !== void 0 && r !== n && (this.transientStyles.clearLocal(r), this.localSizes.delete(e), this.localTransforms.delete(e));
		let i = this.localSizes.get(e);
		(i?.target !== n || i.width !== t.pose.localWidth || i.height !== t.pose.localHeight) && (this.transientStyles.applyLocalSize(n, t.pose.localWidth, t.pose.localHeight), this.localSizes.set(e, {
			target: n,
			width: t.pose.localWidth,
			height: t.pose.localHeight
		})), this.localTargets.set(e, n);
	}
	syncPreservedSizes(e, t, n, r, i) {
		for (let [a, o] of this.preservedSizes) {
			let s = this.resolvePreservedSize(e.items.get(a), e, t, n, r, i);
			if (s === void 0) {
				this.transientStyles.clearPreservedSize(o.target), this.preservedSizes.delete(a);
				continue;
			}
			s.target === o.target && s.width === o.width && s.height === o.height || (this.transientStyles.clearPreservedSize(o.target), this.transientStyles.applyPreservedSize(s.target, s.width, s.height), this.preservedSizes.set(a, s));
		}
		for (let a of e.items.values()) {
			if (this.preservedSizes.has(a.itemId)) continue;
			let o = this.resolvePreservedSize(a, e, t, n, r, i);
			o !== void 0 && (this.transientStyles.applyPreservedSize(o.target, o.width, o.height), this.preservedSizes.set(a.itemId, o));
		}
	}
	resolvePreservedSize(e, t, n, r, i, a) {
		if (e === void 0 || e.resize === void 0 || e.progress >= 1 && e.activeSegmentId === void 0) return;
		let o = r?.items.get(e.itemId), s = e.resize.width === "preserve" ? o?.localPose.width ?? e.pose.localWidth : void 0, c = e.resize.height === "preserve" ? o?.localPose.height ?? e.pose.localHeight : void 0;
		if (s === void 0 && c === void 0) return;
		let l = e.representation === "reparent" && n.has(e.itemId) ? a(e.itemId) : i(e.itemId, t, n, r);
		if (l !== void 0) return {
			target: l,
			...s === void 0 ? {} : { width: s },
			...c === void 0 ? {} : { height: c }
		};
	}
	apply(e, t, n, r, i, a, o) {
		let s = this.resolveItemRootPose(t, i), c = J(s, gh(t.pose)), l = this.parentCacheKey(t.parentItemId, t, i), u = a.get(l);
		if (u === void 0) {
			let e = this.resolveParentLayoutPose(t.parentItemId, r, i, o, t.motionRootKey), n = kr(x_(J(this.resolveParentRootPose(t.parentItemId, r, i, s), gh(e))));
			if (n === null) throw Error("Motion local parent matrix is singular.");
			u = n, a.set(l, n);
		}
		let d = (i?.items.get(e))?.localPose.layoutOrigin ?? [0, 0];
		if (t.targetReflow === !0 && t.direct !== !0) {
			let r = this.localTransforms.get(e);
			r !== void 0 && (this.transientStyles.clearLocal(r.target), this.localTransforms.delete(e), this.transientStyles.applyLocalSize(n, t.pose.localWidth, t.pose.localHeight));
			return;
		}
		let f = b_(d, c, u), p = this.localTransforms.get(e);
		p?.target === n && S_(p.matrix, f) || (this.transientStyles.applyLocalTransform(n, f), this.localTransforms.set(e, {
			target: n,
			matrix: f
		}));
	}
	resolveParentLayoutPose(e, t, n, r, i) {
		let a = `${i ?? ""}:${e ?? ""}`, o = r.get(a);
		if (o !== void 0) return o;
		if (e === void 0) {
			let e = Y();
			return r.set(a, e), e;
		}
		let s = t.items.get(e);
		if (s !== void 0) return r.set(a, s.pose), s.pose;
		let c = n?.items.get(e);
		if (c === void 0) {
			let e = Y();
			return r.set(a, e), e;
		}
		let l = [c], u = c.parentItemId, d;
		for (; u !== void 0 && (d = t.items.get(u)?.pose, d === void 0);) {
			let e = n?.items.get(u);
			if (e === void 0) break;
			l.push(e), u = e.parentItemId;
		}
		if (d === void 0) return r.set(a, c.rootPose), c.rootPose;
		let f = d;
		for (let e = l.length - 1; e >= 0; --e) f = J(f, l[e].localPose);
		return r.set(a, f), f;
	}
	resolveItemRootPose(e, t) {
		let n = t?.items.get(e.itemId);
		return e.motionRootPose ?? n?.motionRootPose ?? t?.rootPose ?? Y();
	}
	resolveParentRootPose(e, t, n, r) {
		if (e === void 0) return r;
		let i = t.items.get(e);
		return i?.motionRootPose === void 0 ? n?.items.get(e)?.motionRootPose ?? r : i.motionRootPose;
	}
	parentCacheKey(e, t, n) {
		let r = n?.items.get(t.itemId);
		return `${t.motionRootKey ?? r?.motionRootKey ?? n?.rootKey ?? "scene"}:${e ?? "<root>"}`;
	}
	isLocalTargetStillUsed(e, t) {
		for (let [n, r] of this.localTargets) if (n !== e && r === t) return !0;
		return !1;
	}
}, cv = class {
	resources = /* @__PURE__ */ new Map();
	hiddenDescendantClones = /* @__PURE__ */ new Set();
	hiddenDescendantKey = "";
	motionRoots = /* @__PURE__ */ new Map();
	root;
	resolveHandle;
	resolveMotionRoot;
	transientStyles;
	elementPathCache = /* @__PURE__ */ new WeakMap();
	constructor(e, t, n, r) {
		this.root = e, this.resolveHandle = t, this.resolveMotionRoot = n, this.transientStyles = r;
	}
	prepareNaturalCapture() {
		this.clearHiddenDescendantClones(), this.hiddenDescendantKey = "";
		for (let e of this.resources.values()) e.presentationHidden || this.transientStyles.applyHidden(e.ghost), e.presentationHidden = !0, e.sourceHidden && this.transientStyles.clearHidden(e.source), e.sourceHidden = !1;
		for (let e of this.motionRoots.values()) e.overlayOrder = [];
		this.clearElementPathCache();
	}
	clearTransientPresentation(e) {
		if (e !== void 0) {
			this.clearHiddenDescendantClones(), this.hiddenDescendantKey = "";
			for (let t of e) {
				let e = this.resources.get(t);
				e !== void 0 && (this.release(e), this.resources.delete(t));
			}
			this.removeUnusedRootLayers(e), this.clearElementPathCache();
			return;
		}
		for (let e of this.resources.values()) this.release(e);
		this.resources.clear(), this.clearHiddenDescendantClones(), this.hiddenDescendantKey = "";
		for (let e of this.motionRoots.values()) F_(e.overlayLayer), e.overlayLayer = void 0, e.overlayOrder = [];
		this.motionRoots.clear(), this.clearElementPathCache();
	}
	prepareFrame(e, t, n, r) {
		for (let [e, n] of [...this.resources]) t.has(e) || (this.release(n), this.resources.delete(e));
		let i = O_(e, t, r), a = /* @__PURE__ */ new Map();
		for (let t of i) {
			let i = e.items.get(t);
			if (i === void 0) continue;
			let o = this.resolveRootState(i, r);
			if (!hm(o.root)) continue;
			let s = a.get(this.rootToken(o)) ?? [];
			s.push(t), a.set(this.rootToken(o), s), this.ensureOverlay(t, n?.(t), o);
		}
		for (let [e, t] of this.motionRoots) {
			let n = a.get(e) ?? [];
			if (n.length === 0) {
				F_(t.overlayLayer), t.overlayLayer = void 0, t.overlayOrder = [];
				continue;
			}
			this.reconcileOverlayOrder(t, n);
		}
		let o = i.join("\0");
		o !== this.hiddenDescendantKey && (this.clearHiddenDescendantClones(), this.hideIndependentDescendantClones(t), this.hiddenDescendantKey = o), t.size === 0 && (this.hiddenDescendantKey = "");
	}
	applyFrame(e, t, n) {
		for (let r of t) {
			let t = e.items.get(r), i = this.resources.get(r);
			if (t === void 0 || i === void 0) continue;
			let a = this.resolveItemRootPose(t, n), o = kr({
				...a.matrix,
				e: 0,
				f: 0
			});
			if (o === null) throw Error("Motion overlay root matrix is singular.");
			v_(i, a, o, J(a, gh(t.pose)));
		}
		this.showOverlayResources(t);
	}
	sourceFor(e) {
		return this.resources.get(e)?.source;
	}
	resolveLocalTarget(e, t, n, r) {
		let i = this.resolveHandle(e);
		if (i === void 0) return;
		let a = E_(t, e, n, r);
		if (a === void 0) return i;
		let o = this.resolveHandle(a), s = this.resources.get(a);
		if (o === void 0 || s === void 0) return;
		let c = this.findElementPathCached(o, i);
		return c === void 0 ? void 0 : T_(s.ghost, c);
	}
	ensureOverlay(e, t, n) {
		let r = this.resolveHandle(e);
		if (r === void 0) return;
		let i = this.getOverlayLayer(n), a = this.resources.get(e);
		if (a !== void 0 && a.source === r) {
			let e = t === void 0 || a.revision === t;
			if (this.ensureSourceHidden(a), (a.motionRoot !== n.root || a.motionRootKey !== n.key) && (this.ensurePresentationHidden(a), i.appendChild(a.ghost), a.motionRoot = n.root, a.motionRootKey = n.key, a.lastMatrix = void 0), e) return;
			if (this.ensurePresentationHidden(a), this.transientStyles.syncTemplate(r, a.ghost)) {
				this.transientStyles.applyHidden(a.ghost), a.revision = t, a.lastWidth = void 0, a.lastHeight = void 0, a.lastMatrix = void 0, this.hiddenDescendantKey = "", this.configureOverlayGhost(a.ghost), this.reapplyNeutralizedTransformProperties(a);
				return;
			}
			this.hiddenDescendantKey = "", this.release(a);
		} else a !== void 0 && (this.hiddenDescendantKey = "", this.release(a));
		this.transientStyles.applyHidden(r);
		let o = this.transientStyles.captureTemplate(r);
		this.configureOverlayGhost(o), this.transientStyles.applyHidden(o), i.appendChild(o);
		let s = {
			source: r,
			ghost: o,
			motionRoot: n.root,
			...n.key === void 0 ? {} : { motionRootKey: n.key },
			revision: t,
			sourceHidden: !0,
			presentationHidden: !0,
			neutralizedTransformProperties: /* @__PURE__ */ new Set()
		};
		this.resources.set(e, s), this.hiddenDescendantKey = "", this.clearElementPathCache(), this.synchronizeGhostTransformProperties(s);
	}
	getOverlayLayer(e) {
		let t = e.overlayLayer ?? e.root.ownerDocument.createElement("div");
		return e.overlayLayer === void 0 && (t.style.position = "fixed", t.style.left = "0", t.style.top = "0", t.style.width = "100vw", t.style.height = "100vh", t.style.pointerEvents = "none", t.style.zIndex = "20", t.style.transformOrigin = "0 0", e.root.appendChild(t), e.overlayLayer = t), this.alignOverlayLayer(e.root, t), t;
	}
	alignOverlayLayer(e, t) {
		t.style.transform = "none";
		let n = Xg(e), r = f_(e, n), i = f_(t, n), a = kr({
			...i.matrix,
			e: 0,
			f: 0
		});
		if (a === null) throw Error("Motion overlay layer matrix is singular.");
		let o = N(a, {
			...r.matrix,
			e: 0,
			f: 0
		}), s = $g(i.matrix, r.origin.x - i.origin.x, r.origin.y - i.origin.y);
		t.style.transform = `matrix(${o.a}, ${o.b}, ${o.c}, ${o.d}, ${s.x}, ${s.y})`;
	}
	reconcileOverlayOrder(e, t) {
		if (I_(e.overlayOrder, t)) return;
		let n = this.getOverlayLayer(e);
		for (let e of t) {
			let t = this.resources.get(e);
			t !== void 0 && n.appendChild(t.ghost);
		}
		e.overlayOrder = [...t];
	}
	resolveRootState(e, t) {
		let n = t?.items.get(e.itemId), r = e.motionRootKey ?? n?.motionRootKey ?? t?.rootKey, i = this.resolveMotionRoot(r) ?? this.root, a = this.rootToken({
			root: i,
			key: r
		}), o = this.motionRoots.get(a);
		if (o !== void 0) return o;
		let s = {
			root: i,
			...r === void 0 ? {} : { key: r },
			overlayOrder: []
		};
		return this.motionRoots.set(a, s), s;
	}
	rootToken(e) {
		return e.key ?? e.root;
	}
	resolveItemRootPose(e, t) {
		let n = t?.items.get(e.itemId);
		return e.motionRootPose ?? n?.motionRootPose ?? t?.rootPose ?? Y();
	}
	findElementPathCached(e, t) {
		let n = this.elementPathCache.get(e);
		if (n === void 0 && (n = /* @__PURE__ */ new WeakMap(), this.elementPathCache.set(e, n)), n.has(t)) return n.get(t);
		let r = w_(e, t);
		return n.set(t, r), r;
	}
	clearElementPathCache() {
		this.elementPathCache = /* @__PURE__ */ new WeakMap();
	}
	configureOverlayGhost(e) {
		e.style.position = "absolute", e.style.left = "0px", e.style.top = "0px", e.style.margin = "0", e.style.pointerEvents = "none", e.style.minWidth = "0", e.style.minHeight = "0", e.style.boxSizing = "border-box", e.style.transformOrigin = "0 0", e.style.zIndex = "20";
	}
	synchronizeGhostTransformProperties(e) {
		let t = e.source.ownerDocument.defaultView?.getComputedStyle(e.source);
		if (t !== void 0) for (let n of [
			"translate",
			"rotate",
			"scale"
		]) {
			let r = t[n];
			if (y_(n, r)) {
				e.neutralizedTransformProperties.has(n) && (e.ghost.style.removeProperty(n), e.neutralizedTransformProperties.delete(n));
				continue;
			}
			e.ghost.style.setProperty(n, "none"), e.neutralizedTransformProperties.add(n);
		}
	}
	reapplyNeutralizedTransformProperties(e) {
		for (let t of e.neutralizedTransformProperties) e.ghost.style.setProperty(t, "none");
	}
	hideIndependentDescendantClones(e) {
		for (let t of e) {
			let e = this.resolveHandle(t);
			if (e !== void 0) for (let [n, r] of this.resources) {
				if (n === t) continue;
				let i = this.findElementPathCached(r.source, e), a = i === void 0 ? void 0 : T_(r.ghost, i);
				a !== void 0 && (this.transientStyles.applyHidden(a), this.hiddenDescendantClones.add(a));
			}
		}
	}
	clearHiddenDescendantClones() {
		for (let e of this.hiddenDescendantClones) this.transientStyles.clearHidden(e);
		this.hiddenDescendantClones.clear();
	}
	showOverlayResources(e) {
		for (let t of e) {
			let e = this.resources.get(t);
			e === void 0 || !e.presentationHidden || (this.transientStyles.clearHidden(e.ghost), e.presentationHidden = !1);
		}
	}
	removeUnusedRootLayers(e) {
		for (let t of this.motionRoots.values()) t.overlayOrder = t.overlayOrder.filter((t) => !e.has(t)), !(t.overlayOrder.length > 0) && ([...this.resources.values()].some((e) => e.motionRoot === t.root) || (F_(t.overlayLayer), t.overlayLayer = void 0));
	}
	release(e) {
		F_(e.ghost), e.sourceHidden && this.transientStyles.clearHidden(e.source), e.sourceHidden = !1, e.presentationHidden = !0;
	}
	ensureSourceHidden(e) {
		e.sourceHidden ||= (this.transientStyles.applyHidden(e.source), !0);
	}
	ensurePresentationHidden(e) {
		e.presentationHidden ||= (this.transientStyles.applyHidden(e.ghost), !0);
	}
}, lv = class {
	root;
	localPresenter;
	overlayPresenter;
	constructor(e, t, n = () => e) {
		this.root = e;
		let r = U_(e);
		this.localPresenter = new sv(r), this.overlayPresenter = new cv(e, t, n, r);
	}
	prepareNaturalCapture() {
		this.overlayPresenter.prepareNaturalCapture(), this.localPresenter.prepareNaturalCapture();
	}
	prepareSeek() {
		this.root.setAttribute("data-codplay-motion-seek", "");
	}
	completeSeek() {
		this.root.removeAttribute("data-codplay-motion-seek");
	}
	clearTransientPresentation(e) {
		e === void 0 && this.prepareNaturalCapture(), this.overlayPresenter.clearTransientPresentation(e), this.localPresenter.clearTransientPresentation(e);
	}
	commit(e, t, n) {
		let r = new Set([...e.items.values()].filter((e) => e.representation === "reparent").map((e) => e.itemId)), i = new Set(r), a = /* @__PURE__ */ new Set();
		for (let t of e.items.values()) t.representation === "local" && a.add(t.itemId);
		this.localPresenter.removeInactive(a), this.overlayPresenter.prepareFrame(e, i, t, n);
		let o = D_(e, a, n);
		this.localPresenter.commit(e, o, r, n, (e, t, n, r) => this.overlayPresenter.resolveLocalTarget(e, t, n, r), (e) => this.overlayPresenter.sourceFor(e)), this.overlayPresenter.applyFrame(e, i, n);
	}
	destroy() {
		this.completeSeek(), this.clearTransientPresentation();
	}
}, uv = /* @__PURE__ */ new Set(/* @__PURE__ */ "position.inset.insetBlock.insetBlockStart.insetBlockEnd.insetInline.insetInlineStart.insetInlineEnd.top.right.bottom.left.width.height.minWidth.minHeight.maxWidth.maxHeight.margin.marginTop.marginRight.marginBottom.marginLeft.padding.paddingTop.paddingRight.paddingBottom.paddingLeft.gap.rowGap.columnGap.display.flex.flexBasis.flexGrow.flexShrink.gridTemplateColumns.gridTemplateRows".split("."));
function dv(e) {
	if (e === void 0 || !T(e.style)) return;
	let t = [];
	for (let [n, r] of Object.entries(e.style)) {
		if (!Cv(n)) continue;
		let e = ml(r);
		e !== void 0 && t.push(e);
	}
	if (t.length === 0 || t.some((e) => e.totalDuration !== e.duration)) return;
	let n = t.reduce((e, t) => t.delay + t.duration > e.delay + e.duration ? t : e);
	return Object.freeze({
		...n,
		captureOffsetsMs: Object.freeze([...new Set(t.map((e) => e.delay + e.duration))].sort((e, t) => e - t))
	});
}
function fv(e) {
	let t = new Map(e.intents.map((e) => [e.id, e])), n = [...e.intents];
	for (let r = 0; r < n.length; r += 1) {
		let i = n[r];
		if (i === void 0 || i.startAt < 0 || !i.targetReflow) continue;
		let a = e.player.resolveSceneBeforeBoundary(i.startAt, e.includePersistOnly), o = yv(e.player, xv(i, a), i.startAt, i.endAt, e.includePersistOnly, [i], e.resolveActiveMotionEndAt);
		if (o <= i.startAt) continue;
		let s = e.player.resolveSceneBeforeBoundary(o, e.includePersistOnly), c = pv(s, i.itemId);
		if (!(c.size === 0 || !mv(a, s, c))) for (let e of s.moveOccurrences ?? []) {
			let r = e.action;
			if (!c.has(e.itemId) || r.startAt <= i.startAt || r.startAt >= o) continue;
			let l = r.eventId ?? `${e.itemId}:${r.name}:${r.declarationPath.join(".")}`, u = zg({
				id: r.eventId === void 0 ? `motion:${l}:${r.startAt}` : `motion:${l}`,
				eventId: l,
				itemId: e.itemId,
				declarationPath: r.declarationPath,
				startAt: r.startAt,
				eventSeq: r.eventSeq,
				storyIds: hv(a, s, e.itemId),
				action: r.action,
				resolveActionTransition: dv
			});
			u === void 0 || t.has(u.id) || (t.set(u.id, u), n.push(u));
		}
	}
	return Object.freeze([...t.values()].sort((e, t) => e.startAt - t.startAt || e.endAt - t.endAt || _v(e.declarationPath, t.declarationPath)));
}
function pv(e, t) {
	let n = /* @__PURE__ */ new Set(), r = e.graph.parentByPerso[t];
	for (; r !== void 0 && !n.has(r);) n.add(r), r = e.graph.parentByPerso[r];
	return n;
}
function mv(e, t, n) {
	for (let r of n) if (t.persos[r]?.placement.mounted === !0 && e.persos[r]?.placement.mounted !== !0) return !0;
	return !1;
}
function hv(e, t, n) {
	return Object.freeze([.../* @__PURE__ */ new Set([...gv(e, n), ...gv(t, n)])].sort());
}
function gv(e, t) {
	let n = e.persos[t];
	if (n === void 0) return Object.freeze([]);
	let r = /* @__PURE__ */ new Set([n.storyId]), i = n.placement.target?.storyId;
	i !== void 0 && r.add(i);
	let a = n.placement.parentKey === void 0 ? void 0 : e.persos[n.placement.parentKey]?.storyId;
	return a !== void 0 && r.add(a), Object.freeze([...r]);
}
function _v(e, t) {
	let n = Math.min(e.length, t.length);
	for (let r = 0; r < n; r += 1) {
		let n = (e[r] ?? 0) - (t[r] ?? 0);
		if (n !== 0) return n;
	}
	return e.length - t.length;
}
function vv(e, t, n) {
	return Object.freeze([...new Set(e.flatMap((e) => e.keyTimes ?? []))].filter((e) => e > t && e < n && Number.isFinite(e)).sort((e, t) => e - t));
}
function yv(e, t, n, r, i, a, o) {
	let s = e.trackJournal, c = o === void 0 ? r : Math.min(r, ...a.map((e) => o(e.itemId, n, r)).filter((e) => e !== void 0 && Number.isFinite(e) && e > n));
	if (s === void 0) return c;
	for (let e of t) {
		let t = s.getStoryResetBoundaries(e, i).find((e) => e.applyAtMs > n && e.applyAtMs < c);
		t !== void 0 && (c = t.applyAtMs);
	}
	return c;
}
function bv(e) {
	return Object.freeze({
		id: e.id,
		itemId: e.itemId,
		startAt: e.startAt,
		...e.eventSeq === void 0 ? {} : { eventSeq: e.eventSeq },
		duration: e.duration,
		delay: e.delay,
		ease: e.ease,
		presentationMode: e.presentationMode,
		...e.resize === void 0 ? {} : { resize: e.resize },
		targetReflow: e.targetReflow,
		...e.path === void 0 ? {} : { path: e.path }
	});
}
function xv(e, t) {
	let n = e.storyIds ?? [];
	if (n.length > 0) return Object.freeze([...new Set(n)].sort());
	let r = t.persos[e.itemId]?.storyId;
	return Object.freeze(r === void 0 ? [] : [r]);
}
function Sv(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e) {
		if (r.startAt < 0) continue;
		let e = xv(r, t), i = r.targetReflow, a = `${e.length === 1 ? e[0] : "<root>"}:${r.startAt}:${r.endAt}:${i ? "structural" : "pose"}`, o = n.get(a) ?? {
			storyIds: e,
			startAt: r.startAt,
			endAt: r.endAt,
			structural: i,
			intents: []
		};
		o.storyIds = Object.freeze([.../* @__PURE__ */ new Set([...o.storyIds, ...e])]), o.intents.push(r), n.set(a, o);
	}
	return Object.freeze([...n.values()].sort((e, t) => e.startAt - t.startAt || e.endAt - t.endAt).map((e) => Object.freeze({
		storyIds: e.storyIds,
		startAt: e.startAt,
		endAt: e.endAt,
		structural: e.structural,
		intents: Object.freeze([...e.intents])
	})));
}
function Cv(e) {
	if (uv.has(e) || e === "transform" || e === "translate" || e === "rotate" || e === "scale") return !0;
	let t = cr(e);
	return t !== void 0 && lr(t);
}
//#endregion
//#region ../codplay/src/runtime/runner-html/motion-capture/capture-snapshots.ts
function wv(e, t, n) {
	if (t === void 0 || n.size === 0) return e;
	let r = new Map(e.items), i = !1;
	for (let e of n) {
		let n = r.get(e), a = t.items.get(e);
		if (n === void 0 || a === void 0) continue;
		let o = n.parentItemId === void 0 ? void 0 : t.items.get(n.parentItemId)?.pose ?? r.get(n.parentItemId)?.rootPose, s = o === void 0 ? gh(a.pose) : hh(o, a.pose);
		r.set(e, Object.freeze({
			...n,
			localPose: s,
			rootPose: a.pose,
			...a.motionRootKey === void 0 ? {} : { motionRootKey: a.motionRootKey },
			...a.motionRootPose === void 0 ? {} : { motionRootPose: a.motionRootPose }
		})), i = !0;
	}
	return i ? Object.freeze({
		...e,
		revision: `${e.revision}:current-presentation:${t.timeMs}:${t.graphRevision}`,
		items: r
	}) : e;
}
function Tv(e, t) {
	return `${e}:${t}`;
}
function Ev(e, t, n, r) {
	let i = /* @__PURE__ */ new Set();
	for (let r of n) i.add(r.itemId), r.targetReflow && (Dv(e, e.graph.targetByPerso[r.itemId], i), Dv(t, t.graph.targetByPerso[r.itemId], i), Ov(e, e.graph.targetByPerso[r.itemId], i), Ov(t, t.graph.targetByPerso[r.itemId], i));
	return kv(e, i, r), kv(t, i, r), i;
}
function Dv(e, t, n) {
	if (t === void 0) return;
	let r = Object.values(e.persos).find((e) => e.persoId === t && e.placement.mounted);
	r !== void 0 && n.add(r.key);
}
function Ov(e, t, n) {
	if (t !== void 0) for (let r of e.graph.childrenByTarget[t] ?? []) n.add(r);
}
function kv(e, t, n) {
	for (let r of [...t]) {
		let i = e.graph.parentByPerso[r];
		for (; i !== void 0 && !(n.length > 0 && !n.includes(e.persos[i]?.storyId ?? ""));) t.add(i), i = e.graph.parentByPerso[i];
	}
}
function Av(e, t, n) {
	return Object.freeze([...new Set(n.map((e) => e.itemId).filter((n) => e.persos[n]?.placement.mounted !== !0 && t.persos[n]?.placement.mounted === !0 && e.persos[n]?.placement.targetId !== void 0))]);
}
function jv(e, t, n) {
	let r = { ...t.persos }, i = !1;
	for (let a of n) {
		let n = e.persos[a], o = t.persos[a];
		if (n === void 0 || o?.placement.mounted !== !0 || n.placement.targetId === void 0 || n.placement.target === void 0) continue;
		let s = e.graph.parentByPerso[a];
		s !== void 0 && t.persos[s]?.placement.mounted !== !0 || (r[a] = {
			...n,
			placement: {
				...n.placement,
				mounted: !0
			}
		}, i = !0);
	}
	if (i) return {
		...t,
		persos: r,
		graph: Fl(r, Mv(e, t, r))
	};
}
function Mv(e, t, n) {
	let r = new Set(Object.values(n).filter((e) => e.placement.mounted && e.placement.targetId !== void 0).map((e) => e.placement.targetId)), i = {};
	for (let a of r) {
		let r = new Set(Object.values(n).filter((e) => e.placement.mounted && e.placement.targetId === a).map((e) => e.key)), o = [
			...t.graph.childrenByTarget[a] ?? [],
			...e.graph.childrenByTarget[a] ?? [],
			...Object.keys(n)
		];
		i[a] = Object.freeze([...new Set(o)].filter((e) => r.has(e)));
	}
	return Object.freeze(i);
}
function Nv(e, t, n) {
	let r = new Map(e.items), i = Pv(t, n);
	for (let e of i) {
		let n = t.items.get(e);
		n !== void 0 && r.set(e, n);
	}
	return Object.freeze({
		...e,
		revision: `${e.revision}:missing-source:${t.revision}`,
		items: r
	});
}
function Pv(e, t) {
	let n = /* @__PURE__ */ new Set();
	for (let r of t) {
		let t = r;
		for (; t !== void 0 && !n.has(t);) n.add(t), t = e.items.get(t)?.parentItemId;
	}
	return n;
}
//#endregion
//#region ../codplay/src/runtime/runner-html/motion-capture/capture-boundaries.ts
function Fv(e) {
	let t = e.player.getSolvedScene();
	if (t === void 0 || e.intents.length === 0) return [];
	let n = /* @__PURE__ */ new Map(), r = e.resolveActiveMotionEndAt === void 0 ? void 0 : (t, r, i) => {
		let a = `${t}:${r}:${i}`;
		if (n.has(a)) return n.get(a);
		let o = e.resolveActiveMotionEndAt(t, r, i);
		return n.set(a, o), o;
	}, i = fv({
		player: e.player,
		intents: e.intents,
		includePersistOnly: e.includePersistOnly,
		resolveActiveMotionEndAt: r
	}), a = [];
	try {
		for (let n of Sv(i, t)) {
			let t = n.structural ? e.player.resolveSceneBeforeBoundary(n.startAt, e.includePersistOnly) : e.player.resolveSceneAt(n.startAt, e.includePersistOnly), i = n.structural ? e.player.resolveSceneAt(n.startAt, e.includePersistOnly) : void 0, s = yv(e.player, n.storyIds, n.startAt, n.endAt, e.includePersistOnly, n.intents, r), c = e.player.resolveSceneBeforeBoundary(s, e.includePersistOnly), l = vv(n.intents, n.startAt, s).map((t) => Object.freeze({
				timeMs: t,
				scene: e.player.resolveSceneBeforeBoundary(t, e.includePersistOnly)
			})), u = Lv(Ev(t, c, n.intents, n.storyIds), i === void 0 ? [] : Ev(t, i, n.intents, n.storyIds), ...l.map(({ scene: e }) => Ev(t, e, n.intents, n.storyIds))), d = e.resolveMotionContainer?.({
				root: e.root,
				scenes: [
					t,
					...i === void 0 ? [] : [i],
					c
				],
				itemIds: [...new Set(n.intents.map((e) => e.itemId))],
				storyIds: n.storyIds
			}), f = d?.element ?? e.root, p = d?.key;
			e.player.presentSceneForGeometryCapture(t);
			let m = Iv(n, e.firstSnapshots) ?? X(f, e.nodes, t, u, p), h = i === void 0 ? void 0 : o(i, u, f, p), g = [];
			for (let { scene: t } of l) e.player.presentSceneForGeometryCapture(t), g.push(X(f, e.nodes, t, u, p));
			e.player.presentSceneForGeometryCapture(c);
			let _ = n.structural ? Av(t, c, n.intents) : [];
			if (_.length > 0) {
				let n = jv(t, c, _);
				if (n !== void 0) {
					e.player.presentSceneForGeometryCapture(n);
					let t = X(f, e.nodes, n, u, p);
					m = Nv(m, t, _), e.player.presentSceneForGeometryCapture(c);
				}
			}
			let v = X(f, e.nodes, c, u, p), y = n.intents.map(bv);
			a.push(Object.freeze({
				id: `boundary:${n.startAt}:${n.endAt}:${y.map((e) => e.id).join(",")}`,
				timeMs: n.startAt,
				storyIds: n.storyIds,
				before: m,
				...h === void 0 ? {} : { afterStart: h },
				after: v,
				...g.length === 0 ? {} : { keyframes: Object.freeze(g) },
				intents: Object.freeze(y)
			}));
		}
	} finally {
		e.player.presentSceneForGeometryCapture(t);
	}
	return Object.freeze(a);
	function o(t, n, r, i) {
		return e.player.presentSceneForGeometryCapture(t), X(r, e.nodes, t, n, i);
	}
}
function Iv(e, t) {
	if (t !== void 0) for (let n of e.intents) {
		let e = t.get(Tv(n.itemId, n.startAt));
		if (e !== void 0) return e;
	}
}
function Lv(...e) {
	let t = /* @__PURE__ */ new Set();
	for (let n of e) for (let e of n) t.add(e);
	return t;
}
function Rv(e) {
	let t = e.player.getSolvedScene();
	if (t === void 0 || e.intents.length === 0) return [];
	let n = [];
	for (let r of Sv(e.intents, t)) {
		let i = e.player.resolveSceneBeforeBoundary(r.startAt, !1), a = e.resolveMotionContainer?.({
			root: e.root,
			scenes: [i, t],
			itemIds: [...new Set(r.intents.map((e) => e.itemId))],
			storyIds: r.storyIds
		}), o = a?.element ?? e.root, s = a?.key ?? e.first.rootKey, c = Ev(i, t, r.intents, r.storyIds), l = X(o, e.nodes, t, c, s), u = r.intents.map(bv);
		n.push(Object.freeze({
			id: `boundary:live:${r.startAt}:${r.endAt}:${u.map((e) => e.id).join(",")}`,
			timeMs: r.startAt,
			storyIds: r.storyIds,
			before: e.first,
			after: l,
			intents: Object.freeze(u)
		}));
	}
	return Object.freeze(n);
}
//#endregion
//#region ../codplay/src/runtime/runner-html/motion-system.ts
var zv = class {
	graph;
	boundaries = [];
	naturalLayoutTimeline;
	resetTimesByItem = /* @__PURE__ */ new Map();
	currentFrame;
	initialized = !1;
	host;
	resolveSourceRevision;
	constructor(e) {
		let t = Eg([]);
		this.graph = t.graph, this.naturalLayoutTimeline = t.naturalLayoutTimeline, this.host = e.host, this.resolveSourceRevision = e.resolveSourceRevision, this.boundaries = e.boundaries ?? [];
	}
	initialize() {
		this.rebuild(), this.initialized = !0;
	}
	present(e, t) {
		if (!this.initialized) return;
		let n = t ?? Ih(this.naturalLayoutTimeline, e), r = Xh(this.graph, n, e);
		this.host.commit(r, this.resolveSourceRevision, n), this.currentFrame = r;
	}
	getFrame() {
		return this.currentFrame;
	}
	resolveActiveMotionEndAt(e, t) {
		let n = this.currentFrame?.items.get(e)?.activeSegmentId;
		if (n === void 0) return;
		let r = this.graph.tracksByItem.get(e)?.segments.find((e) => e.id === n);
		if (!(r === void 0 || t < r.startAt || t >= r.endAt)) return r.endAt;
	}
	prepareGeometryCapture() {
		this.host.prepareNaturalCapture();
	}
	prepareSeek() {
		this.host.prepareSeek?.();
	}
	completeSeek() {
		this.host.completeSeek?.();
	}
	setBoundaries(e) {
		this.commit(e, this.resetTimesByItem);
	}
	setResetTimesByItem(e) {
		this.commit(this.boundaries, e);
	}
	commit(e, t) {
		this.boundaries = Object.freeze([...e]), this.resetTimesByItem = t, this.initialized && this.rebuild();
	}
	clearTransientPresentation(e) {
		this.host.clearTransientPresentation(e), this.currentFrame = void 0;
	}
	invalidate() {
		this.initialized && this.rebuild();
	}
	destroy() {
		this.host.destroy(), this.initialized = !1, this.currentFrame = void 0;
	}
	rebuild() {
		let e = Eg(this.boundaries, { resetTimesByItem: this.resetTimesByItem });
		this.graph = e.graph, this.naturalLayoutTimeline = e.naturalLayoutTimeline;
	}
}, Bv = class {
	context;
	root;
	motionStoryByItemId;
	motionSystem;
	replayMotionBoundaries = [];
	presentationMotionBoundaries = [];
	rebuildingMotion = !1;
	liveFirstLayouts = /* @__PURE__ */ new Map();
	liveCaptureOccurrences = /* @__PURE__ */ new Map();
	constructor(e) {
		this.context = e, this.root = e.root, this.motionStoryByItemId = Vv(e.compiledScene);
	}
	setRoot(e) {
		this.root !== e && (this.motionSystem?.destroy(), this.motionSystem = void 0, this.clearLiveCaptureState(), this.replayMotionBoundaries = [], this.presentationMotionBoundaries = [], this.root = e, this.context.motionContainerResolver.setRoot(e));
	}
	init() {
		this.motionSystem?.present(this.context.getCurrentTimeMs());
	}
	getPresentationFrame() {
		return this.motionSystem?.getFrame();
	}
	getMotionSystem() {
		return this.motionSystem;
	}
	getPresentationMotionBoundaries() {
		return this.presentationMotionBoundaries;
	}
	hasCapturedMotionBoundaries() {
		return this.replayMotionBoundaries.length > 0 || this.presentationMotionBoundaries.length > 0;
	}
	prepareGeometryCapture() {
		this.motionSystem?.prepareGeometryCapture();
	}
	prepareSeek(e) {
		this.clearLiveCaptureState();
		let t = {
			replayBoundaries: this.replayMotionBoundaries,
			presentationBoundaries: this.presentationMotionBoundaries,
			timeMs: this.context.getCurrentTimeMs()
		};
		return this.motionSystem?.prepareSeek(), this.motionSystem !== void 0 && (this.pruneMotionGroupsBeforeSeek(e), this.presentationMotionBoundaries = this.replayMotionBoundaries, this.motionSystem.commit(this.presentationMotionBoundaries, /* @__PURE__ */ new Map())), Object.freeze(t);
	}
	restoreSeek(e) {
		this.replayMotionBoundaries = e.replayBoundaries, this.presentationMotionBoundaries = e.presentationBoundaries, this.motionSystem !== void 0 && (this.motionSystem.clearTransientPresentation(), this.motionSystem.commit(this.presentationMotionBoundaries, /* @__PURE__ */ new Map()), this.motionSystem.present(e.timeMs));
	}
	completeSeek() {
		this.motionSystem?.completeSeek();
	}
	clearLiveCaptureState() {
		this.liveFirstLayouts.clear(), this.liveCaptureOccurrences.clear();
	}
	beginReset() {
		this.clearLiveCaptureState(), this.motionSystem?.prepareSeek();
	}
	endReset() {
		this.motionSystem?.completeSeek();
	}
	resize() {
		this.hasCapturedMotionBoundaries() && this.invalidateMotionGeometry();
	}
	captureLiveFirstLayout(e, t, n) {
		let r = this.context.getPlayer(), i = r.getSolvedScene() ?? r.resolveSceneBeforeBoundary(n);
		this.motionSystem?.present(n);
		let a = this.motionSystem?.getFrame(), o = i.persos[t]?.storyId, s = this.context.motionContainerResolver.resolve({
			root: this.root,
			scenes: [i],
			itemIds: [t],
			...o === void 0 ? {} : { storyIds: [o] }
		}), c = X(s.element, this.context.nodes.persoNodes, i, /* @__PURE__ */ new Set([t]), s.key);
		this.liveFirstLayouts.set(e, {
			persoKey: t,
			timeMs: n,
			snapshot: c,
			before: i,
			presentationFrame: a
		});
	}
	completeLiveCaptureMotion(e, t) {
		let n = this.liveFirstLayouts.get(e);
		if (this.liveFirstLayouts.delete(e), !t || n === void 0) {
			this.liveCaptureOccurrences.delete(e);
			return;
		}
		let r = this.liveCaptureOccurrences.get(e) ?? [];
		if (this.liveCaptureOccurrences.delete(e), r.length === 0) return;
		let i = Hv(r), a = Gv(i, new Set(this.replayMotionBoundaries.flatMap((e) => e.intents.map((e) => e.id))), this.motionStoryByItemId), o = i.filter((e) => e.itemId === n.persoKey && e.startAt === n.timeMs);
		(a.length > 0 || o.length > 0) && this.motionSystem?.prepareGeometryCapture();
		let s = n.snapshot, c = this.context.getPlayer(), l = c.getSolvedScene();
		if (l !== void 0 && o.length > 0) {
			let e = l.persos[o[0].itemId]?.storyId, t = this.context.motionContainerResolver.resolve({
				root: this.root,
				scenes: [n.before, l],
				itemIds: [...new Set(o.map((e) => e.itemId))],
				storyIds: [...new Set(o.flatMap((e) => e.storyIds ?? []))],
				...e === void 0 ? {} : { storyId: e }
			});
			this.context.presentSceneForGeometryCapture(n.before), s = X(t.element, this.context.nodes.persoNodes, n.before, new Set(o.map((e) => e.itemId)), t.key), s = wv(s, n.presentationFrame, new Set(o.map((e) => e.itemId)));
		}
		let u = a.length === 0 ? [] : Fv({
			player: c,
			root: this.root,
			nodes: this.context.nodes.persoNodes,
			intents: a,
			includePersistOnly: !0,
			resolveMotionContainer: (e) => this.context.motionContainerResolver.resolve(e)
		}), d = [];
		if (o.length > 0) {
			l !== void 0 && u.length === 0 && this.context.presentSceneForGeometryCapture(l);
			let e = Rv({
				player: c,
				root: this.root,
				nodes: this.context.nodes.persoNodes,
				first: s,
				intents: o,
				resolveMotionContainer: (e) => this.context.motionContainerResolver.resolve(e)
			}), t = new Set(o.map((e) => e.id));
			d = e.filter((e) => !e.intents.some((e) => t.has(e.id))), d = [...d, ...e];
		}
		this.replayMotionBoundaries = Jv(this.replayMotionBoundaries, u, this.motionStoryByItemId), this.presentationMotionBoundaries = Jv(this.presentationMotionBoundaries, d, this.motionStoryByItemId), this.commitMotion(), this.motionSystem?.present(c.getCurrentTimeMs());
	}
	presentMotion(e, t) {
		let n = t.motionOccurrences ?? [];
		this.rememberLiveCaptureOccurrences(n);
		let r = t.resetStoryIds ?? [], i = t.isolationClosedStoryIds ?? [], a = [.../* @__PURE__ */ new Set([...r, ...i])], o = n.filter((n) => n.startAt === e.timeMs || t.previousScene?.timeMs === e.timeMs);
		o.length > 0 && this.motionSystem?.present(e.timeMs);
		let s = o.length > 0 ? this.captureCurrentMotionFirstSnapshots(e, o) : void 0;
		a.length > 0 && this.removeMotionGroupsForStories(e, a), n.length > 0 && this.rebuildMotionBoundaries({
			occurrences: n,
			presentationFirstSnapshots: s
		}), this.motionSystem?.present(e.timeMs);
	}
	captureCurrentMotionFirstSnapshots(e, t) {
		let n = this.motionSystem?.getFrame();
		if (n === void 0 || t.length === 0) return;
		let r = t.filter((e) => {
			let t = n.items.get(e.itemId);
			return t?.activeSegmentId !== void 0 && t.progress < 1;
		});
		if (r.length === 0) return;
		let i = this.context.getPlayer(), a = /* @__PURE__ */ new Map();
		this.motionSystem?.prepareGeometryCapture();
		try {
			for (let t of r) {
				let r = Tv(t.itemId, t.startAt);
				if (a.has(r)) continue;
				let o = i.resolveSceneBeforeBoundary(t.startAt, this.context.getPersistOnlyMode()), s = [.../* @__PURE__ */ new Set([...t.beforeStoryIds, ...t.afterStoryIds])], c = this.context.motionContainerResolver.resolve({
					root: this.root,
					scenes: [o, e],
					itemIds: [t.itemId],
					...s.length === 0 ? {} : { storyIds: s }
				});
				this.context.presentSceneForGeometryCapture(o);
				let l = X(c.element, this.context.nodes.persoNodes, o, /* @__PURE__ */ new Set([t.itemId]), c.key);
				a.set(r, wv(l, n, /* @__PURE__ */ new Set([t.itemId])));
			}
		} finally {
			this.context.presentSceneForGeometryCapture(e);
		}
		return a;
	}
	rebuildMotionBoundaries(e = {}) {
		if (this.rebuildingMotion) return;
		let t = e.occurrences ?? [];
		if (t.length === 0) return;
		let n = Hv(t), r = Uv(this.replayMotionBoundaries), i = Uv(this.presentationMotionBoundaries), a = Gv(Kv(n, t, this.motionStoryByItemId), r, this.motionStoryByItemId), o = Gv(Kv(n, t, this.motionStoryByItemId), i, this.motionStoryByItemId), s = a.length > 0, c = o.length > 0;
		if (!(!s && !c)) {
			this.rebuildingMotion = !0;
			try {
				this.motionSystem?.prepareGeometryCapture();
				let t = s && c && e.presentationFirstSnapshots === void 0 && this.context.getPersistOnlyMode() && Wv(a, o), n = (e, t) => Fv({
					player: this.context.getPlayer(),
					root: this.root,
					nodes: this.context.nodes.persoNodes,
					intents: e,
					includePersistOnly: t,
					resolveActiveMotionEndAt: (e, t, n) => this.motionSystem?.resolveActiveMotionEndAt(e, t),
					resolveMotionContainer: (e) => this.context.motionContainerResolver.resolve(e)
				}), r = t ? n(a, !0) : void 0, i = s ? r ?? n(a, !0) : [], l = c ? r ?? Fv({
					player: this.context.getPlayer(),
					root: this.root,
					nodes: this.context.nodes.persoNodes,
					intents: o,
					includePersistOnly: this.context.getPersistOnlyMode(),
					firstSnapshots: e.presentationFirstSnapshots,
					resolveActiveMotionEndAt: (e, t, n) => this.motionSystem?.resolveActiveMotionEndAt(e, t),
					resolveMotionContainer: (e) => this.context.motionContainerResolver.resolve(e)
				}) : [];
				s && (this.replayMotionBoundaries = Jv(this.replayMotionBoundaries, i, this.motionStoryByItemId)), c && (this.presentationMotionBoundaries = Jv(this.presentationMotionBoundaries, l, this.motionStoryByItemId)), this.commitMotion(c);
			} finally {
				this.rebuildingMotion = !1;
			}
		}
	}
	commitMotion(e = !0) {
		let t = this.replayMotionBoundaries.length > 0 || this.presentationMotionBoundaries.length > 0, n = this.motionSystem === void 0, r = this.motionSystem ?? (t ? this.createMotionSystem() : void 0);
		r !== void 0 && (this.motionSystem = r, (n || e) && r.commit(this.presentationMotionBoundaries, /* @__PURE__ */ new Map()), n && r.initialize());
	}
	removeMotionGroupsForStories(e, t) {
		let n = new Set(t);
		if (n.size === 0) return;
		let r = new Set(this.resolveMotionItemIds(e, t)), i = [], a = [], o = (e, t) => {
			for (let i of e) {
				if (Xv(i, this.motionStoryByItemId).some((e) => n.has(e))) {
					for (let e of i.intents) r.add(e.itemId);
					for (let e of i.before.items.keys()) r.add(e);
					for (let e of i.after.items.keys()) r.add(e);
					continue;
				}
				t.push(i);
			}
		};
		o(this.replayMotionBoundaries, i), o(this.presentationMotionBoundaries, a), this.replayMotionBoundaries = Object.freeze(i), this.presentationMotionBoundaries = Object.freeze(a), this.motionSystem !== void 0 && (this.motionSystem.clearTransientPresentation(r), this.motionSystem.commit(this.presentationMotionBoundaries, /* @__PURE__ */ new Map()));
	}
	invalidateMotionGeometry() {
		this.replayMotionBoundaries = [], this.presentationMotionBoundaries = [], this.motionSystem !== void 0 && (this.motionSystem.clearTransientPresentation(), this.motionSystem.commit([], /* @__PURE__ */ new Map()));
	}
	resolveMotionItemIds(e, t) {
		let n = new Set(t);
		return new Set(Object.values(e.persos).filter((e) => n.has(e.storyId)).map((e) => e.key));
	}
	pruneMotionGroupsBeforeSeek(e) {
		let t = /* @__PURE__ */ new Set(), n = (t) => Xv(t, this.motionStoryByItemId).some((n) => this.isBoundaryInvalidatedByReset(t, n, e)), r = (e) => Object.freeze(e.filter((e) => {
			if (!n(e)) return !0;
			for (let n of e.before.items.keys()) t.add(n);
			for (let n of e.after.items.keys()) t.add(n);
			return !1;
		}));
		this.replayMotionBoundaries = r(this.replayMotionBoundaries), this.presentationMotionBoundaries = r(this.presentationMotionBoundaries), this.motionSystem !== void 0 && this.motionSystem.clearTransientPresentation(t);
	}
	isBoundaryInvalidatedByReset(e, t, n) {
		return this.context.getPlayer().trackJournal.getStoryResetBoundaries(t, !0).some((t) => t.applyAtMs > n || e.timeMs > t.applyAtMs ? !1 : e.timeMs < t.applyAtMs ? !0 : e.intents.some((e) => e.eventSeq === void 0 || e.eventSeq <= t.eventSeq));
	}
	rememberLiveCaptureOccurrences(e) {
		if (!(e.length === 0 || this.liveFirstLayouts.size === 0)) for (let [t, n] of this.liveFirstLayouts) {
			let r = e.filter((e) => e.itemId === n.persoKey && e.startAt === n.timeMs);
			r.length > 0 && this.liveCaptureOccurrences.set(t, Object.freeze([...r]));
		}
	}
	createMotionSystem() {
		return new zv({
			host: new lv(this.root, (e) => this.context.nodes.persoNodes.get(e), (e) => this.context.motionContainerResolver.resolveByKey(e)),
			resolveSourceRevision: (e) => this.resolveMotionSourceRevision(e)
		});
	}
	resolveMotionSourceRevision(e) {
		let t = this.context.getPlayer().getSolvedScene(), n = t?.persos[e];
		if (t === void 0 || n === void 0) return;
		let r = this.context.getComponentStateRevision(e);
		return [
			t.graph.revision,
			r,
			n.placement.mounted ? "mounted" : "detached",
			n.placement.targetId ?? "",
			n.placement.parentKey ?? ""
		].join(":");
	}
	destroy() {
		this.clearLiveCaptureState(), this.motionSystem?.destroy(), this.motionSystem = void 0;
	}
};
function Vv(e) {
	let t = /* @__PURE__ */ new Map();
	for (let [n, r] of Object.entries(e.scene.stories)) for (let e of r.persos) t.set(`${n}:${e.id}`, n);
	return t;
}
function Hv(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = n.action, r = n.eventId ?? `${n.itemId}:${e.name}:${n.declarationPath.join(".")}`, i = zg({
			id: n.eventId === void 0 ? `motion:${r}:${n.startAt}` : `motion:${r}`,
			eventId: r,
			itemId: n.itemId,
			declarationPath: n.declarationPath,
			startAt: n.startAt,
			eventSeq: n.eventSeq,
			storyIds: [.../* @__PURE__ */ new Set([...n.beforeStoryIds, ...n.afterStoryIds])],
			action: e.action,
			resolveActionTransition: dv
		});
		i !== void 0 && t.set(`${n.itemId}:${n.startAt}`, i);
	}
	return Object.freeze([...t.values()].sort((e, t) => e.startAt - t.startAt || Se(e.declarationPath, t.declarationPath)));
}
function Uv(e) {
	return new Set(e.flatMap((e) => e.intents.map((e) => e.id)));
}
function Wv(e, t) {
	if (e.length !== t.length) return !1;
	let n = new Set(t.map((e) => e.id));
	return e.every((e) => n.has(e.id));
}
function Gv(e, t, n) {
	let r = /* @__PURE__ */ new Set();
	for (let i of e) t.has(i.id) || r.add(qv(i, n));
	return Object.freeze(e.filter((e) => r.has(qv(e, n))));
}
function Kv(e, t, n) {
	if (t.length === 0) return [];
	let r = new Set(t.map((e) => `${e.itemId}:${e.startAt}`)), i = new Set(e.filter((e) => r.has(`${e.itemId}:${e.startAt}`)).map((e) => qv(e, n)));
	return Object.freeze(e.filter((e) => i.has(qv(e, n))));
}
function qv(e, t) {
	return `${(e.storyIds === void 0 || e.storyIds.length === 0 ? [t.get(e.itemId) ?? "<unknown>"] : [...new Set(e.storyIds)].sort()).join(",")}:${e.startAt}:${e.endAt}:${e.targetReflow ? "structural" : "pose"}`;
}
function Jv(e, t, n) {
	let r = /* @__PURE__ */ new Map();
	for (let t of e) r.set(Yv(t, n), t);
	for (let e of t) r.set(Yv(e, n), e);
	return Object.freeze([...r.values()].sort((e, t) => e.timeMs - t.timeMs || e.id.localeCompare(t.id)));
}
function Yv(e, t) {
	let n = e.intents[0], r = e.storyIds === void 0 || e.storyIds.length === 0 ? [n === void 0 ? "<unknown>" : t.get(n.itemId) ?? "<unknown>"] : [...new Set(e.storyIds)].sort(), i = n?.targetReflow === !0 ? "structural" : "pose", a = e.intents.map(({ itemId: e }) => e).sort().join(",");
	return `${r.join(",")}:${e.timeMs}:${i}:${a}`;
}
function Xv(e, t) {
	return e.storyIds !== void 0 && e.storyIds.length > 0 ? e.storyIds : [...new Set(e.intents.map((e) => t.get(e.itemId)).filter((e) => e !== void 0))];
}
//#endregion
//#region ../codplay/src/runtime/runner-html/player-runner/runtime-runner.ts
var Zv = class {
	player;
	engine;
	ownsEngine;
	defaultTicker;
	nodes = {
		persoNodes: /* @__PURE__ */ new Map(),
		persoParts: /* @__PURE__ */ new Map(),
		targetNodes: /* @__PURE__ */ new Map()
	};
	motionController;
	captureSourceAdapter;
	captureSourceCircuit;
	emitSourceAdapter;
	materializerContext;
	materializer;
	interactionLockEnabled;
	interactionRoot;
	rootTargetIds;
	mountContainer;
	motionContainerResolver;
	initialPointerEvents;
	initialInert;
	materializationEpoch = 0;
	resourceMetadata = /* @__PURE__ */ new Map();
	resourceMedia = /* @__PURE__ */ new Map();
	stopTerminalObservation;
	sourceAdapters;
	sourceAdaptersAttached = !1;
	seeking = !1;
	lastSourcePlaybackState;
	reportSourceDiagnostic;
	sourceAdaptersDestroyed = !1;
	get motionSystem() {
		return this.motionController.getMotionSystem();
	}
	get presentationMotionBoundaries() {
		return this.motionController.getPresentationMotionBoundaries();
	}
	constructor(e) {
		this.reportSourceDiagnostic = e.onEmitDiagnostic ?? (() => void 0), this.defaultTicker = e.ticker, this.interactionRoot = e.root, this.mountContainer = e.root, this.motionContainerResolver = new dh(e.root, this.nodes.persoNodes), this.interactionLockEnabled = e.enableInteractionLock === !0, this.initialPointerEvents = e.root.style.pointerEvents, this.initialInert = e.root.hasAttribute("inert"), this.materializerContext = {
			numericLengthScale: e.numericLengthScale ?? 1,
			partMarkerPrefix: e.partMarkerPrefix,
			deferredAccessibilityAttributes: /* @__PURE__ */ new Map()
		}, this.fillResourceMetadata(e.resourceMetadata), this.fillResourceMedia(e.resourceMedia), e.catalog.lock(), this.engine = e.engine ?? new hf(e.catalog, {
			resources: e.resources,
			idle: e.idle
		}), this.ownsEngine = e.engine === void 0;
		let t = ny(e.compiledScene);
		this.rootTargetIds = t.map((e) => e.id);
		let n = t.map((e) => ({
			id: e.id,
			kind: "root",
			storyId: e.storyId
		}));
		for (let n of t) this.nodes.targetNodes.set(n.id, e.root);
		this.motionController = new Bv({
			compiledScene: e.compiledScene,
			root: e.root,
			nodes: this.nodes,
			motionContainerResolver: this.motionContainerResolver,
			getPlayer: () => this.player,
			getComponentStateRevision: (e) => this.player.componentRuntime?.getStateRevision(e) ?? 0,
			presentSceneForGeometryCapture: (e) => this.player.presentSceneForGeometryCapture(e),
			getCurrentTimeMs: () => this.player.getCurrentTimeMs(),
			getPersistOnlyMode: () => this.player.includesPersistOnlyInCurrent()
		});
		let r = new Jg(new zm(this.nodes, this.materializerContext), (e, t) => this.motionController.presentMotion(e, t));
		this.materializer = r, this.captureSourceCircuit = new cp({
			compiledScene: e.compiledScene,
			player: {
				getCurrentTimeMs: () => this.player.getCurrentTimeMs(),
				emit: (e) => this.player.emit(e),
				beginCompiledCapture: (e) => this.player.beginCompiledCapture(e),
				trackCapture: (e, t) => this.player.trackCapture(e, t),
				endCapture: (e, t, n) => this.player.endCapture(e, t, n),
				cancelCapture: (e) => this.player.cancelCapture(e)
			},
			onError: ({ error: t, storyId: n, persoId: r, source: i }) => {
				e.onCaptureError?.(t), this.reportSourceDiagnostic({
					severity: "error",
					code: i === "scroll" ? "RUNTIME_SCROLL_CAPTURE_FAILED" : "RUNTIME_CAPTURE_SOURCE_FAILED",
					message: t instanceof Error ? t.message : String(t),
					details: {
						refs: {
							sceneId: e.compiledScene.scene.id,
							storyId: n,
							persoId: r
						},
						context: { source: i }
					}
				});
			}
		});
		let i = Qv(e.catalog, r, this.resourceMetadata, this.resourceMedia, this.engine, this.captureSourceCircuit);
		this.player = new mm(e.id, this.engine, e.compiledScene, void 0, e.strapCollections, void 0, n, r, i, e.functions, void 0, (t) => this.forwardPublicEvent(t, e.onPublicEvent), e.idle, e.onTrace), this.stopTerminalObservation = this.player.subscribeTransport(() => {
			if (this.ownsEngine && this.player.hasSequenceEnded() && this.engine.pause(), this.syncInteractionLock(), !this.seeking) {
				this.notifySourcePlaybackState();
				let e = this.player.getSolvedScene();
				e !== void 0 && this.notifySourceAdapters("scene-presented", (t) => t.onScenePresented?.(e));
			}
		});
		let a = e.captureEventTarget ?? ry(e.root);
		this.captureSourceAdapter = new mp({
			captureSources: this.captureSourceCircuit,
			nodes: this.nodes,
			eventTarget: a,
			onCaptureTrack: e.onCaptureTrack,
			resolveEndCaptureState: (t) => {
				let n = e.resolveEndCaptureState?.(t);
				return this.motionController.captureLiveFirstLayout(t.captureId, t.persoKey, this.player.getCurrentTimeMs()), n;
			},
			onCaptureClose: (t) => {
				this.motionController.completeLiveCaptureMotion(t.captureId, t.completed), e.onCaptureClose?.(t), r.invalidateStructure?.();
			}
		}), this.emitSourceAdapter = new th({
			player: this.player,
			compiledScene: e.compiledScene,
			nodes: this.nodes,
			eventTarget: a,
			onDiagnostic: e.onEmitDiagnostic
		}), this.sourceAdapters = (e.sourceAdapterFactories ?? []).map((t) => t(this.createSourceAdapterContext(e)));
	}
	init() {
		let e = this.player.init();
		if (!e.ok) return e;
		try {
			return this.motionController.init(), this.syncInteractionLock(), this.captureSourceAdapter.attach(), this.emitSourceAdapter.attach(), this.attachSourceAdapters(), e;
		} catch (e) {
			return this.destroySourceAdapters(), this.captureSourceCircuit.destroy(), this.motionController.destroy(), this.player.destroy(), {
				ok: !1,
				diagnostics: $v(e)
			};
		}
	}
	async run(e) {
		try {
			await this.engine.prepareScene(this.player.compiledScene);
		} catch (e) {
			return {
				ok: !1,
				phase: "library",
				error: e instanceof Error ? e.message : String(e)
			};
		}
		let t = e.manifest ?? this.player.compiledScene.resources, n = await e.preload.load({
			manifest: t,
			options: e.preloadOptions
		});
		if (!n.ok) return {
			ok: !1,
			phase: "preload",
			preload: n
		};
		this.setResourceMetadata(n.data.metadata), this.setResourceMedia(n.data.media ?? {});
		let r = [.../* @__PURE__ */ new Set([...n.data.loaded, ...n.data.skipped])];
		this.engine.registerResources(r);
		let i = this.init();
		return i.ok ? (this.play(e.ticker), {
			ok: !0,
			phase: "run",
			preload: n,
			init: i
		}) : {
			ok: !1,
			phase: "init",
			preload: n,
			init: i
		};
	}
	play(e = this.defaultTicker ?? new ae()) {
		this.player.play(), this.ownsEngine && this.engine.start(e), this.syncInteractionLock(), this.notifySourcePlaybackState();
	}
	setResourceMetadata(e) {
		this.resourceMetadata.clear(), this.fillResourceMetadata(e), this.player.getSolvedScene() !== void 0 && this.player.refresh();
	}
	setResourceMedia(e) {
		this.resourceMedia.clear(), this.fillResourceMedia(e), this.player.getSolvedScene() !== void 0 && this.player.refresh();
	}
	setRate(e) {
		this.player.setRate(e);
	}
	getRate() {
		return this.player.getRate();
	}
	pause() {
		this.player.pause(), this.ownsEngine && this.engine.pause(), this.syncInteractionLock(), this.notifySourcePlaybackState();
	}
	reset() {
		this.motionController.beginReset();
		try {
			this.player.reset(), this.captureSourceCircuit.resume(), this.player.componentRuntime?.onReset(), this.notifySourceAdapters("reset", (e) => e.onReset?.()), this.ownsEngine && this.engine.pause(), this.syncInteractionLock(), this.notifySourcePlaybackState();
		} finally {
			this.motionController.endReset();
		}
	}
	advance(e, t = 0) {
		this.engine.advance(e, t);
	}
	seek(e) {
		this.seeking = !0, this.captureSourceCircuit.suspend(), this.player.componentRuntime?.beforeSeek(), this.notifySourceAdapters("before-seek", (e) => e.beforeSeek?.());
		let t, n, r = !1;
		try {
			let i = this.motionController.prepareSeek(e);
			return t = i, r = !0, n = this.player.seek(e), n.ok || this.motionController.restoreSeek(i), this.syncInteractionLock(), n;
		} catch (e) {
			throw r && this.motionController.restoreSeek(t), e;
		} finally {
			r && this.motionController.completeSeek(), this.seeking = !1, this.captureSourceCircuit.resume(), this.player.componentRuntime?.afterSeek();
			let e = this.player.getSolvedScene();
			this.notifySourceAfterSeek(e, n), e !== void 0 && this.notifySourceAdapters("scene-presented-after-seek", (t) => t.onScenePresented?.(e)), this.notifySourcePlaybackState();
		}
	}
	emit(e) {
		return this.player.emit(e);
	}
	resize(e) {
		if (e !== void 0 && (this.materializerContext.numericLengthScale = e), this.materializationEpoch += 1, this.player.getSolvedScene() === void 0) return;
		let t = this.motionController.hasCapturedMotionBoundaries();
		t && this.motionController.resize(), this.player.refresh({ emitMotionOccurrences: t });
	}
	getMaterializationEpoch() {
		return this.materializationEpoch;
	}
	getLifecycleState() {
		return this.player.getLifecycleState();
	}
	getCurrentTimeMs() {
		return this.player.getCurrentTimeMs();
	}
	getPresentationFrame() {
		return this.motionController.getPresentationFrame();
	}
	subscribe(e) {
		return this.player.subscribeTransport(e);
	}
	getPersoNode(e) {
		return this.nodes.persoNodes.get(e);
	}
	getTargetNode(e) {
		return this.nodes.targetNodes.get(e);
	}
	getMaterializedRoots() {
		let e = this.player.getSolvedScene();
		return e === void 0 ? [] : e.graph.rootPersoKeys.flatMap((e) => ey(this.nodes.persoNodes.get(e)));
	}
	setMountContainer(e) {
		if (this.mountContainer === e) return;
		let t = this.motionController.hasCapturedMotionBoundaries();
		this.mountContainer = e, this.motionController.setRoot(e);
		for (let t of this.rootTargetIds) this.nodes.targetNodes.set(t, e);
		this.materializer.invalidateStructure?.(), this.player.getSolvedScene() !== void 0 && this.player.refresh({ emitMotionOccurrences: t });
	}
	getComponentSurface(e, t) {
		let n = this.player.componentRuntime?.getComponentSurfaces();
		return t === "foreignContent" ? n?.getForeignContentSurface?.(e) : t === "input" ? n?.getInputSurface?.(e) : n?.getSurface(e, t);
	}
	prepareExternalPresentation(e, t, n) {
		return this.player.prepareExternalPresentation(e, t, n);
	}
	destroy() {
		this.destroySourceAdapters(), this.captureSourceCircuit.destroy(), this.ownsEngine && this.engine.stop(), this.stopTerminalObservation(), this.captureSourceAdapter.destroy(), this.emitSourceAdapter.destroy(), this.motionController.destroy(), this.player.destroy(), this.nodes.persoNodes.clear(), this.nodes.persoParts.clear(), this.nodes.targetNodes.clear(), this.motionContainerResolver.clear(), this.restoreInteractionLock();
	}
	createSourceAdapterContext(e) {
		return {
			compiledScene: e.compiledScene,
			getSolvedScene: () => this.player.getSolvedScene(),
			getLifecycleState: () => this.player.getLifecycleState(),
			getCurrentTimeMs: () => this.player.getCurrentTimeMs(),
			resolvePersoElement: (e) => ty(this.nodes.persoNodes.get(e)),
			commands: {
				emit: (e) => this.player.emit(e),
				setLiveActions: (e, t) => this.player.setLiveActions(e, t)
			},
			reportDiagnostic: this.reportSourceDiagnostic
		};
	}
	attachSourceAdapters() {
		this.sourceAdaptersDestroyed || this.sourceAdaptersAttached || (this.sourceAdaptersAttached = !0, this.lastSourcePlaybackState = void 0, this.notifySourceAdapters("attach", (e) => e.attach()), this.notifySourcePlaybackState());
	}
	notifySourceAdapters(e, t) {
		!this.sourceAdaptersAttached || this.sourceAdaptersDestroyed || this.sourceAdapters.forEach((n, r) => {
			try {
				t(n);
			} catch (t) {
				this.reportSourceAdapterFailure(e, r, t);
			}
		});
	}
	reportSourceAdapterFailure(e, t, n) {
		this.reportSourceDiagnostic({
			severity: "error",
			code: "RUNTIME_HTML_SOURCE_ADAPTER_FAILED",
			message: n instanceof Error ? n.message : String(n),
			details: {
				refs: { sceneId: this.player.compiledScene.scene.id },
				context: {
					phase: e,
					adapterIndex: t
				}
			}
		});
	}
	notifySourcePlaybackState() {
		if (!this.sourceAdaptersAttached || this.sourceAdaptersDestroyed) return;
		let e = this.player.getLifecycleState();
		e !== this.lastSourcePlaybackState && (this.lastSourcePlaybackState = e, this.notifySourceAdapters("playback-state-change", (t) => t.onPlaybackStateChange?.(e)));
	}
	forwardPublicEvent(e, t) {
		e.name === "sequence:end" && (this.player.componentRuntime?.onSequenceEnd(), this.captureSourceCircuit.suspend(), this.notifySourceAdapters("sequence-end", (t) => t.onSequenceEnd?.(e))), t?.(e);
	}
	notifySourceAfterSeek(e, t) {
		this.notifySourceAdapters("after-seek", (n) => n.afterSeek?.(e, t));
	}
	destroySourceAdapters() {
		this.sourceAdaptersDestroyed || (this.sourceAdaptersDestroyed = !0, this.sourceAdaptersAttached = !1, this.sourceAdapters.forEach((e, t) => {
			try {
				e.destroy();
			} catch (e) {
				this.reportSourceAdapterFailure("destroy", t, e);
			}
		}));
	}
	fillResourceMetadata(e) {
		for (let [t, n] of Object.entries(e ?? {})) this.resourceMetadata.set(t, n);
	}
	fillResourceMedia(e) {
		for (let [t, n] of Object.entries(e ?? {})) this.resourceMedia.set(t, n);
	}
	syncInteractionLock() {
		if (!this.interactionLockEnabled) return;
		let e = this.player.getLifecycleState() === Mf;
		this.interactionRoot.style.pointerEvents = e ? this.initialPointerEvents : "none", this.initialInert || !e ? this.interactionRoot.setAttribute("inert", "") : this.interactionRoot.removeAttribute("inert");
	}
	restoreInteractionLock() {
		this.interactionLockEnabled && (this.interactionRoot.style.pointerEvents = this.initialPointerEvents, this.initialInert ? this.interactionRoot.setAttribute("inert", "") : this.interactionRoot.removeAttribute("inert"));
	}
};
function Qv(e, t, n, r, i, a) {
	return new zi({
		catalog: e,
		materializer: t,
		runtime: i.getComponentRuntimeContext(),
		resourceMetadata: n,
		resourceMedia: r,
		captureSources: a
	});
}
function $v(e) {
	let t = {
		severity: "error",
		code: "RUNTIME_MOTION_INIT_FAILED",
		message: e instanceof Error ? e.message : "Motion runner initialization failed."
	};
	return {
		all: [t],
		warnings: [],
		errors: [t]
	};
}
function ey(e) {
	return e == null ? [] : Array.isArray(e) ? e : [e];
}
function ty(e) {
	return ey(e).find(hm);
}
function ny(e) {
	let t = new Set(e.rootNodeIds);
	return Object.values(e.scene.stories).filter((e) => e.persos.some((e) => t.has(e.id))).map((t) => ({
		id: `__codplay_root__${e.scene.id}__${t.id}`,
		storyId: t.id
	}));
}
function ry(e) {
	return e.ownerDocument?.defaultView ?? (globalThis.window === void 0 ? void 0 : globalThis.window);
}
//#endregion
//#region ../codplay/src/facade/instance-host.ts
function iy(e) {
	let t = e.instance.root ?? ay(), n = new Zv({
		id: e.instance.instanceId,
		compiledScene: e.instance.compiledScene,
		root: t,
		numericLengthScale: oy(t),
		partMarkerPrefix: e.instance.partMarkerPrefix,
		catalog: e.catalog,
		resourceMetadata: cy(e.resourceMetadata),
		resourceMedia: ly(e.resourceMedia),
		engine: e.engine,
		idle: e.instance.idle,
		functions: e.instance.functions,
		strapCollections: e.instance.strapCollections,
		onPublicEvent: e.onPublicEvent,
		onTrace: e.onTrace,
		onEmitDiagnostic: e.onEmitDiagnostic,
		sourceAdapterFactories: e.sourceAdapterFactories
	}), r = () => void 0;
	try {
		let i = n.init();
		return i.ok && (r = sy(t, () => {
			try {
				n.resize(oy(t));
			} catch (t) {
				e.onResizeError(t);
			}
		})), {
			root: t,
			player: n.player,
			runner: n,
			init: i,
			destroy: () => {
				r(), n.destroy();
			}
		};
	} catch (e) {
		throw n.destroy(), e;
	}
}
function ay() {
	if (globalThis.document === void 0) throw Error("CodPlay HTML instances require a DOM environment.");
	return globalThis.document.createElement("div");
}
function oy(e) {
	let t = e.getBoundingClientRect().width;
	return Number.isFinite(t) && t > 0 ? t / 100 : 1;
}
function sy(e, t) {
	if (typeof ResizeObserver < "u") {
		let n = new ResizeObserver(t);
		return n.observe(e), () => n.disconnect();
	}
	return globalThis.addEventListener("resize", t), () => globalThis.removeEventListener("resize", t);
}
function cy(e) {
	return Object.fromEntries(e.entries());
}
function ly(e) {
	return Object.fromEntries(e.entries());
}
//#endregion
//#region ../codplay/src/facade/trace-event.ts
function uy(e, t) {
	return {
		instanceId: e,
		eventId: t.eventId,
		eventSeq: t.eventSeq,
		name: t.name,
		timeMs: t.applyAtMs,
		trackId: t.trackId,
		storyId: t.storyId,
		visibility: t.visibility,
		data: t.data,
		context: t.context,
		meta: t.meta,
		mode: t.mode
	};
}
//#endregion
//#region ../codplay/src/facade/engine-facade/instance-registry.ts
var dy = class {
	instances = /* @__PURE__ */ new Map();
	options;
	constructor(e) {
		this.options = e;
	}
	createPublicRegistry() {
		return {
			create: (e) => this.create(e),
			mount: (e) => this.options.mounts.mount(e),
			get: (e) => this.instances.get(e),
			destroy: (e) => this.destroy(e)
		};
	}
	getManaged(e) {
		return this.instances.get(e);
	}
	async emit(e) {
		let t = this.instances.get(e.instanceId);
		if (t === void 0) {
			K(this.options.diagnostics, "CODPLAY_INSTANCE_UNKNOWN", /* @__PURE__ */ Error(`CodPlay instance is not registered: ${e.instanceId}`), { instanceId: e.instanceId });
			return;
		}
		await t.events.emit(e.eventime, e.target);
	}
	create(e) {
		this.assertCreatable(e);
		let t = new yf(void 0, this.options.diagnostics), n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), i, a = !1;
		try {
			this.options.lockCatalog(), i = iy({
				catalog: this.options.catalog,
				engine: this.options.runtimeEngine,
				resourceMetadata: this.options.resources.metadataSnapshot(),
				resourceMedia: this.options.resources.mediaSnapshot(),
				sourceAdapterFactories: this.options.sourceAdapterFactories,
				instance: e,
				onPublicEvent: (t) => this.forwardPublicEvent(e.instanceId, n, t),
				onTrace: (n) => this.forwardTraceEvent(e.instanceId, r, t, n),
				onEmitDiagnostic: (n) => t.publish(bf(n, {
					instanceId: e.instanceId,
					sceneId: e.compiledScene.scene.id
				})),
				onResizeError: (n) => K(t, "CODPLAY_INSTANCE_RESIZE_FAILED", n, { instanceId: e.instanceId })
			});
			let { player: o, runner: s, init: c } = i;
			if (t.publishReport(c.diagnostics, { instanceId: e.instanceId }), a = !0, !c.ok) throw Error(`CodPlay instance initialization failed: ${e.instanceId}`);
			let l = new Lf({
				instanceId: e.instanceId,
				root: i.root,
				player: o,
				runner: s,
				diagnostics: t,
				eventListeners: n,
				traceListeners: r,
				onPublicEvent: (e) => this.options.onPublicEvent(e),
				onPlaybackStateChange: (t) => this.options.onPlaybackStateChange(e.instanceId, t),
				destroy: i.destroy
			});
			return this.instances.set(e.instanceId, l), l;
		} catch (o) {
			throw a || K(t, "CODPLAY_INSTANCE_CREATE_FAILED", o, { instanceId: e.instanceId }), i?.destroy(), n.clear(), r.clear(), o;
		}
	}
	destroyAll() {
		for (let e of [...this.instances.keys()]) this.destroy(e);
	}
	destroy(e) {
		let t = this.instances.get(e);
		t !== void 0 && (this.options.mounts.detachForInstance(e), this.options.onInstanceDestroyed(e), this.instances.delete(e), t.destroyInternal());
	}
	assertCreatable(e) {
		if (this.options.isDestroyed()) {
			let t = /* @__PURE__ */ Error("CodPlay engine has been destroyed.");
			throw K(this.options.diagnostics, "CODPLAY_INSTANCE_CREATE_FAILED", t, { instanceId: e.instanceId }), t;
		}
		if (e.instanceId.trim().length === 0) {
			let e = /* @__PURE__ */ Error("CodPlay instanceId must not be empty.");
			throw K(this.options.diagnostics, "CODPLAY_INSTANCE_ID_INVALID", e), e;
		}
		if (this.instances.has(e.instanceId)) {
			let t = /* @__PURE__ */ Error(`CodPlay instance already exists: ${e.instanceId}`);
			throw K(this.options.diagnostics, "CODPLAY_INSTANCE_DUPLICATE", t, { instanceId: e.instanceId }), t;
		}
	}
	forwardPublicEvent(e, t, n) {
		let r = this.instances.get(e);
		if (r !== void 0) {
			r.handlePublicEvent(n);
			return;
		}
		let i = If(e, n);
		for (let e of t) e(i);
	}
	forwardTraceEvent(e, t, n, r) {
		let i = uy(e, r);
		for (let a of [...t]) try {
			a(i);
		} catch (t) {
			K(n, "CODPLAY_TRACE_LISTENER_FAILED", t, {
				instanceId: e,
				eventId: r.eventId
			});
		}
	}
}, fy = class {
	mounts = /* @__PURE__ */ new Map();
	mountIdByHost = /* @__PURE__ */ new Map();
	mountIdByChild = /* @__PURE__ */ new Map();
	nextMountId = 1;
	options;
	constructor(e) {
		this.options = e;
	}
	mount(e) {
		if (this.options.isDestroyed()) return this.reject(e, /* @__PURE__ */ Error("CodPlay owner has been destroyed."));
		let t = this.options.getInstance(e.host.instanceId);
		if (t === void 0) return this.reject(e, /* @__PURE__ */ Error(`CodPlay host instance is not registered: ${e.host.instanceId}`));
		let n = this.options.getInstance(e.childInstanceId);
		if (n === void 0) return this.reject(e, /* @__PURE__ */ Error(`CodPlay child instance is not registered: ${e.childInstanceId}`));
		if (e.host.instanceId === e.childInstanceId) return this.reject(e, /* @__PURE__ */ Error("CodPlay cannot mount an instance into itself."));
		let r = py(e.host), i = this.getMountByHost(r);
		if (i !== void 0 && e.replace === void 0) return this.reject(e, /* @__PURE__ */ Error(`CodPlay host is already mounted: ${r}`));
		if (this.mountIdByChild.has(e.childInstanceId)) return this.reject(e, /* @__PURE__ */ Error(`CodPlay child instance is already mounted: ${e.childInstanceId}`));
		let a = t.getForeignContentSurface(e.host);
		if (a === void 0) return this.reject(e, /* @__PURE__ */ Error(`CodPlay mount host is not a materialized slot: ${e.host.instanceId}/${e.host.storyId}/${e.host.persoId}`));
		let o = t.getForeignContentHostRoot(e.host);
		if (o === void 0) return this.reject(e, /* @__PURE__ */ Error(`CodPlay mount host is not a materialized HTML slot root: ${e.host.instanceId}/${e.host.storyId}/${e.host.persoId}`));
		if (n.getMaterializedRoots() === void 0) return this.reject(e, /* @__PURE__ */ Error(`CodPlay child instance is destroyed: ${e.childInstanceId}`));
		let s = i === void 0 || e.replace === void 0 ? void 0 : t.prepareForeignMountReplacement(e.host, e.replace);
		if (i !== void 0 && s === void 0) return this.reject(e, /* @__PURE__ */ Error(`CodPlay mount host does not provide the requested replace transition: ${r}`));
		i !== void 0 && this.detach(i.mountId);
		let c;
		try {
			return c = this.attach({
				request: e,
				hostKey: r,
				hostRoot: o,
				childInstance: n,
				surface: a
			}), s?.start(), c;
		} catch (t) {
			if (c?.detach(), s?.cancel(), i !== void 0) try {
				this.attach({
					request: {
						host: i.host,
						childInstanceId: i.childInstanceId
					},
					hostKey: i.hostKey,
					hostRoot: o,
					childInstance: i.child,
					surface: i.surface
				});
			} catch {}
			return this.reject(e, t);
		}
	}
	detachForInstance(e) {
		for (let [t, n] of this.mounts) (n.host.instanceId === e || n.childInstanceId === e) && this.detach(t);
	}
	detachAll() {
		for (let e of [...this.mounts.keys()]) this.detach(e);
	}
	attach(e) {
		try {
			let t = e.childInstance.setMountContainer(e.hostRoot) ?? [];
			e.surface.attach(t);
		} catch (t) {
			try {
				e.childInstance.setMountContainer(void 0);
			} catch {}
			throw t;
		}
		let t = this.nextMountId++, n = {
			mountId: t,
			host: e.request.host,
			hostKey: e.hostKey,
			childInstanceId: e.request.childInstanceId,
			child: e.childInstance,
			surface: e.surface
		};
		return this.mounts.set(t, n), this.mountIdByHost.set(e.hostKey, t), this.mountIdByChild.set(e.request.childInstanceId, t), { detach: () => this.detach(t) };
	}
	reject(e, t) {
		throw K(this.options.diagnostics, "CODPLAY_INSTANCE_MOUNT_FAILED", t, {
			instanceId: e.host.instanceId,
			storyId: e.host.storyId,
			persoId: e.host.persoId
		}), t instanceof Error ? t : Error(String(t));
	}
	detach(e) {
		let t = this.mounts.get(e);
		if (t !== void 0) try {
			t.surface.detach();
		} finally {
			try {
				t.child.setMountContainer(void 0);
			} finally {
				this.mounts.delete(e), this.mountIdByHost.get(t.hostKey) === e && this.mountIdByHost.delete(t.hostKey), this.mountIdByChild.get(t.childInstanceId) === e && this.mountIdByChild.delete(t.childInstanceId);
			}
		}
	}
	getMountByHost(e) {
		let t = this.mountIdByHost.get(e);
		return t === void 0 ? void 0 : this.mounts.get(t);
	}
};
function py(e) {
	return JSON.stringify([
		e.instanceId,
		e.storyId,
		e.persoId
	]);
}
//#endregion
//#region ../codplay/src/facade/engine-facade/resource-registry.ts
var my = class {
	metadata = /* @__PURE__ */ new Map();
	media = /* @__PURE__ */ new Map();
	runtimeEngine;
	diagnostics;
	isDestroyed;
	constructor(e, t, n) {
		this.runtimeEngine = e, this.diagnostics = t, this.isDestroyed = n;
	}
	createPublicRegistry() {
		return { register: (e) => this.register(e) };
	}
	registerInitial(e) {
		this.registerData(e);
	}
	register(e) {
		if (!this.isDestroyed()) try {
			this.registerData(e), this.runtimeEngine.registerResources(hy(e));
		} catch (e) {
			K(this.diagnostics, "CODPLAY_RESOURCE_REGISTER_FAILED", e);
		}
	}
	metadataSnapshot() {
		return new Map(this.metadata);
	}
	mediaSnapshot() {
		return new Map(this.media);
	}
	destroy() {
		this.metadata.clear();
		for (let e of this.media.values()) e.release();
		this.media.clear();
	}
	registerData(e) {
		if (e !== void 0) {
			for (let [t, n] of Object.entries(e.metadata)) this.metadata.set(t, n);
			for (let [t, n] of Object.entries(e.media ?? {})) {
				let e = this.media.get(t);
				e !== n && (n.retain(), e?.release(), this.media.set(t, n));
			}
		}
	}
};
function hy(e) {
	return [.../* @__PURE__ */ new Set([...e.loaded, ...e.skipped])];
}
//#endregion
//#region ../codplay/src/facade/engine-facade/scene-controller.ts
var gy = class {
	catalog;
	runtimeEngine;
	diagnostics;
	lockCatalog;
	isDestroyed;
	constructor(e, t, n, r, i) {
		this.catalog = e, this.runtimeEngine = t, this.diagnostics = n, this.lockCatalog = r, this.isDestroyed = i;
	}
	build(e, t = {}) {
		try {
			this.lockCatalog();
			let n = new Qs(this.catalog.validationSnapshot(), {
				...t,
				diagnosticOutput: (t) => this.diagnostics.publish(bf(t, { sceneId: e.scene.id }))
			}).build(e.scene);
			return {
				...n,
				diagnostics: _y(n.diagnostics, { sceneId: e.scene.id })
			};
		} catch (t) {
			let n = new z({ output: () => void 0 });
			n.error("CODPLAY_SCENE_COMPILE_FAILED", t instanceof Error ? t.message : String(t), { refs: { sceneId: e.scene.id } });
			let r = n.report();
			return this.diagnostics.publishReport(r), {
				ok: !1,
				diagnostics: r
			};
		}
	}
	async prepare(e) {
		if (this.isDestroyed()) {
			let t = /* @__PURE__ */ Error("CodPlay engine has been destroyed.");
			throw K(this.diagnostics, "CODPLAY_ENGINE_PREPARE_SCENE_FAILED", t, { sceneId: e.scene.id }), t;
		}
		try {
			this.lockCatalog(), await this.runtimeEngine.prepareScene(e);
		} catch (t) {
			throw K(this.diagnostics, "CODPLAY_ENGINE_PREPARE_SCENE_FAILED", t, { sceneId: e.scene.id }), t instanceof Error ? t : Error(String(t));
		}
	}
};
function _y(e, t) {
	let n = e.all.map((e) => bf(e, t));
	return {
		all: n,
		warnings: n.filter((e) => e.severity === "warning"),
		errors: n.filter((e) => e.severity === "error")
	};
}
//#endregion
//#region ../codplay/src/facade/engine-facade/engine-facade.ts
var vy = class {
	catalog;
	runtimeEngine;
	diagnostics;
	capabilities;
	resources;
	scene;
	clock;
	events;
	mounts;
	instances;
	destroyed = !1;
	constructor(e = {}) {
		this.diagnostics = new yf(e.diagnosticOutput);
		try {
			this.catalog = $d(), this.capabilities = new Sf(this.catalog, this.diagnostics, () => this.destroyed), xf(this.catalog, e), this.runtimeEngine = new hf(this.catalog, {
				resources: e.resources === void 0 ? [] : hy(e.resources),
				idle: e.idle
			}), this.resources = new my(this.runtimeEngine, this.diagnostics, () => this.destroyed), this.resources.registerInitial(e.resources), this.scene = new gy(this.catalog, this.runtimeEngine, this.diagnostics, () => this.capabilities.lock(), () => this.destroyed), this.clock = new Of(this.runtimeEngine, e.ticker, this.diagnostics, () => this.destroyed), this.events = new kf(this.diagnostics);
			let t;
			this.mounts = new fy({
				getInstance: (e) => t?.getManaged(e),
				diagnostics: this.diagnostics,
				isDestroyed: () => this.destroyed
			}), this.instances = new dy({
				catalog: this.catalog,
				runtimeEngine: this.runtimeEngine,
				resources: this.resources,
				diagnostics: this.diagnostics,
				sourceAdapterFactories: e.htmlHost?.sourceAdapterFactories,
				lockCatalog: () => this.capabilities.lock(),
				isDestroyed: () => this.destroyed,
				mounts: this.mounts,
				onPublicEvent: (e) => this.events.forward(e),
				onPlaybackStateChange: (e, t) => this.clock.syncPlayback(e, t),
				onInstanceDestroyed: (e) => this.clock.removeInstance(e)
			}), t = this.instances;
		} catch (e) {
			throw K(this.diagnostics, "CODPLAY_ENGINE_CONFIGURATION_FAILED", e), e;
		}
	}
	createCapabilityRegistries() {
		return this.capabilities.createRegistries();
	}
	lockCapabilityRegistries() {
		this.capabilities.lock();
	}
	createResourceRegistry() {
		return this.resources.createPublicRegistry();
	}
	createEventRegistry() {
		return this.events.createPublicRegistry((e) => this.instances.emit(e));
	}
	createInstanceRegistry() {
		return this.instances.createPublicRegistry();
	}
	buildScene(e, t = {}) {
		return this.scene.build(e, t);
	}
	prepareScene(e) {
		return this.scene.prepare(e);
	}
	start() {
		this.clock.start();
	}
	pause() {
		this.clock.pause();
	}
	stop() {
		this.clock.stop();
	}
	advance(e, t = 0) {
		this.clock.advance(e, t);
	}
	destroy() {
		this.destroyed || (this.destroyed = !0, this.mounts.detachAll(), this.instances.destroyAll(), this.events.destroy(), this.clock.destroy(), this.resources.destroy());
	}
}, yy = /* @__PURE__ */ new WeakMap(), by = Object.freeze({
	functions: Object.freeze({}),
	strapCollections: Object.freeze({
		scene: Object.freeze({}),
		stories: Object.freeze({})
	})
});
function xy(e) {
	yy.delete(e);
}
async function Sy(e, t, n, r, i = Ty) {
	let a = Ky(n), o = Gy(t), s = await fetch(new URL("export-manifest.json", o));
	if (!s.ok) throw Error(`Scene package manifest request failed (${s.status}).`);
	let c = Jy(await s.json()), l = await fetch(new URL(c.scene, o));
	if (!l.ok) throw Error(`Compiled scene request failed (${l.status}).`);
	let u = new Hc({ diagnosticOutput: () => void 0 }), d = u.decode(await l.text());
	if (!d.ok) {
		let e = d.diagnostics.errors.map((e) => e.message).join(" ");
		throw Error(`Compiled scene is invalid: ${e}`);
	}
	let f = tb(d.value, c, o), p = u.decode(u.encode(f));
	if (!p.ok) throw Error("Restored compiled scene failed codec validation.");
	let m = c.functions === void 0 ? by : await Cy(e, c.functions, o, i), h = eo(p.value, m.strapCollections, m.functions);
	if (h.length > 0) throw Error(h.map((e) => `${e.code}: ${e.message}`).join("\n"));
	let g = c.styleSheet === void 0 ? void 0 : await ky(c.styleSheet, o);
	await e.engine.prepareScene(p.value);
	let _ = g?.resources.map((e) => ({
		url: e.url,
		type: e.type,
		policy: { cache: "immutable" }
	})) ?? [], v = await e.preload.load({
		manifest: _.length === 0 ? p.value.resources : [p.value.resources, { entries: _ }],
		options: {
			mode: "author",
			container: a
		}
	});
	if (!v.ok) {
		let e = v.error.details?.map((e) => `${e.details.url}: ${e.details.error}`).join("; ");
		throw Error(e === void 0 ? v.error.message : `${v.error.message} ${e}`);
	}
	e.resources.register({
		loaded: v.data.loaded,
		skipped: v.data.skipped,
		metadata: v.data.metadata,
		media: v.data.media
	});
	let y = g === void 0 ? void 0 : `scene-package:${r}`;
	try {
		if (g !== void 0 && y !== void 0) {
			let t = g.fontFaces.length === 0 ? void 0 : Ay();
			e.preload.css.set({
				slot: y,
				cssText: g.cssText,
				container: a
			}), await jy(y, g.fontFaces, t ?? /* @__PURE__ */ new Set());
		}
		let t = e.instances.create({
			instanceId: r,
			compiledScene: p.value,
			functions: m.functions,
			strapCollections: m.strapCollections,
			root: a
		});
		return await Vy(a, new Set(p.value.resources.entries.map((e) => e.url))), {
			instance: t,
			...y === void 0 ? {} : { cssSlot: y }
		};
	} catch (t) {
		throw y !== void 0 && e.preload.css.clear(y), e.instances.destroy(r), t;
	}
}
async function Cy(e, t, n, r) {
	let i = yy.get(e);
	i === void 0 && (i = /* @__PURE__ */ new Map(), yy.set(e, i));
	let a = n.href, o = i.get(a);
	if (o !== void 0) return o;
	let s = wy(t, n, r);
	i.set(a, s);
	try {
		return await s;
	} catch (t) {
		throw i.delete(a), i.size === 0 && yy.delete(e), t;
	}
}
async function wy(e, t, n) {
	let r = await n(new URL(e.file, t));
	if (typeof r.createScenePackageContext != "function") throw Error("Scene package function module does not export createScenePackageContext().");
	if (!Oy(e.references, r.functionReferences)) throw Error("Scene package function module references do not match its manifest.");
	return Ey(r.createScenePackageContext(), e.references);
}
async function Ty(e) {
	return await import(
		/* @vite-ignore */
		e.href
);
}
function Ey(e, t) {
	if (!$(e) || !$(e.functions)) throw Error("Scene package function factory returned an invalid function collection.");
	let n = new Set(t.map((e) => e.ref)), r = Object.keys(e.functions);
	if (r.length !== n.size || r.some((e) => !n.has(e))) throw Error("Scene package function factory returned references that do not match the manifest.");
	for (let t of n) if (typeof e.functions[t] != "function") throw Error(`Scene package function reference is unavailable: ${t}.`);
	return {
		functions: e.functions,
		strapCollections: Dy(e.strapCollections)
	};
}
function Dy(e) {
	if (!$(e) || !$(e.scene) || !$(e.stories)) throw Error("Scene package strapCollections must have the shape { scene, stories }.");
	for (let [t, n] of Object.entries(e.scene)) if (typeof n != "function") throw Error(`Scene package scene strap is not callable: ${t}.`);
	for (let [t, n] of Object.entries(e.stories)) {
		if (!$(n)) throw Error(`Scene package story straps are invalid: ${t}.`);
		for (let [e, r] of Object.entries(n)) if (typeof r != "function") throw Error(`Scene package story strap is not callable: ${t}.${e}.`);
	}
	return e;
}
function Oy(e, t) {
	return Array.isArray(t) && e.length === t.length && e.every((e, n) => {
		let r = t[n];
		return r !== void 0 && r.ref === e.ref && Array.isArray(r.path) && r.path.length === e.path.length && e.path.every((e, t) => r.path[t] === e);
	});
}
async function ky(e, t) {
	let n = await fetch(new URL(e.file, t));
	if (!n.ok) throw Error(`Scene package stylesheet request failed (${n.status}).`);
	let r = await n.text(), i = e.fontFaces.map((e) => ({ ...e })), a = e.resources.map((e) => {
		let n = `url(${JSON.stringify(e.sceneUrl)})`, a = `${new URL(e.file, t).href}${e.suffix}`, o = `url(${JSON.stringify(a)})`;
		if (r.split(n).length - 1 == 0) throw Error(`Scene package stylesheet is missing compiler resource token: ${e.sceneUrl}`);
		r = r.replaceAll(n, o);
		for (let e of i) e.src = e.src.replaceAll(n, o);
		return {
			url: a,
			type: e.type
		};
	});
	return {
		cssText: r,
		resources: a,
		fontFaces: i
	};
}
function Ay() {
	let e = globalThis.document?.fonts;
	if (e === void 0) throw Error("CodPlay scene package fonts require the browser FontFaceSet API.");
	return new Set(Array.from(e));
}
async function jy(e, t, n) {
	if (t.length === 0) return;
	let r = Array.from(globalThis.document.head.querySelectorAll("style[data-codplay-preload-css-slot]")).find((t) => t.getAttribute("data-codplay-preload-css-slot") === e);
	if (r === void 0 || r.sheet === null) throw Error(`CodPlay scene package stylesheet slot is unavailable: ${e}`);
	let i;
	try {
		i = r.sheet.cssRules;
	} catch (e) {
		throw Error(`CodPlay scene package stylesheet cannot be inspected: ${By(e)}`);
	}
	let a = My(i);
	if (a.length !== t.length) throw Error(`CodPlay scene package declares ${t.length} font faces but its stylesheet exposes ${a.length}.`);
	let o = Array.from(globalThis.document.fonts ?? []).filter((e) => !n.has(e)), s = [], c = /* @__PURE__ */ new Set();
	for (let e = 0; e < t.length; e += 1) {
		let n = t[e], r = a[e];
		if (n === void 0 || r === void 0) continue;
		let i = Py(r.rule, e);
		if (!Ly(n, i) || i.src.trim() !== "" && zy(n.src) !== zy(i.src)) throw Error(`CodPlay scene package font face ${e} does not match its compiled manifest.`);
		let l = r.active ? o.find((e) => !c.has(e) && Ly(n, Iy(e))) : void 0;
		if (n.src.trim() === "") throw Error(`CodPlay scene package font face has no CSS source: ${n.family}`);
		let u = r.active ? l : Fy(n);
		if (u === void 0) throw Error(`CodPlay scene package font face is missing from document.fonts: ${n.family}`);
		if (r.active && c.add(u), typeof u.load != "function") throw Error(`CodPlay scene package font face cannot be loaded: ${n.family}`);
		s.push(u.load().then(() => {
			if (u.status !== "loaded") throw Error(`FontFace did not reach loaded state: ${n.family}`);
		}).catch((e) => {
			throw Error(`CodPlay scene package font failed to load (${n.family}): ${By(e)}`);
		}));
	}
	await Promise.all(s);
}
function My(e, t = !0) {
	let n = [];
	for (let r of Array.from(e)) {
		if (r.type === 5 && "style" in r) {
			n.push({
				rule: r,
				active: t
			});
			continue;
		}
		if (!("cssRules" in r)) continue;
		let e = r, i = t && Ny(e);
		n.push(...My(e.cssRules, i));
	}
	return n;
}
function Ny(e) {
	if (e.type === 4) {
		let t = e.conditionText ?? e.media?.mediaText ?? "", n = globalThis.document.defaultView?.matchMedia;
		return typeof n == "function" ? n.call(globalThis.document.defaultView, t).matches : !0;
	}
	if (typeof e.conditionText == "string" && e.constructor.name === "CSSSupportsRule") {
		let t = globalThis.CSS?.supports;
		return typeof t != "function" || t(e.conditionText);
	}
	return !0;
}
function Py(e, t) {
	let n = e.style;
	return {
		sourceOrder: t,
		family: Ry(n.getPropertyValue("font-family")),
		src: n.getPropertyValue("src"),
		weight: Q(n.getPropertyValue("font-weight") || "normal"),
		style: Q(n.getPropertyValue("font-style") || "normal"),
		stretch: Q(n.getPropertyValue("font-stretch") || "normal"),
		variationSettings: Q(n.getPropertyValue("font-variation-settings") || "normal"),
		unicodeRange: Q(n.getPropertyValue("unicode-range") || "U+0-10FFFF"),
		display: Q(n.getPropertyValue("font-display") || "auto")
	};
}
function Fy(e) {
	if (typeof globalThis.FontFace == "function") return new globalThis.FontFace(e.family, e.src, {
		weight: e.weight,
		style: e.style,
		stretch: e.stretch,
		variationSettings: e.variationSettings,
		unicodeRange: e.unicodeRange,
		display: e.display
	});
}
function Iy(e) {
	return {
		sourceOrder: 0,
		family: Ry(e.family),
		src: "",
		weight: Q(e.weight || "normal"),
		style: Q(e.style || "normal"),
		stretch: Q(e.stretch || "normal"),
		variationSettings: Q(e.variationSettings || "normal"),
		unicodeRange: Q(e.unicodeRange || "U+0-10FFFF"),
		display: Q(e.display || "auto")
	};
}
function Ly(e, t) {
	return Ry(e.family) === Ry(t.family) && Q(e.weight) === Q(t.weight) && Q(e.style) === Q(t.style) && Q(e.stretch) === Q(t.stretch) && Q(e.variationSettings) === Q(t.variationSettings) && Q(e.unicodeRange) === Q(t.unicodeRange) && Q(e.display) === Q(t.display);
}
function Ry(e) {
	let t = e.trim(), n = t[0];
	return ((n === "\"" || n === "'") && t.at(-1) === n ? t.slice(1, -1) : t).replace(/\\([\da-fA-F]{1,6})\s?/g, (e, t) => {
		let n = Number.parseInt(t, 16);
		return n > 0 && n <= 1114111 ? String.fromCodePoint(n) : "�";
	}).replace(/\\([\\"'])/g, "$1").replace(/\s+/g, " ").trim();
}
function Q(e) {
	return e.trim().replace(/\s+/g, " ").toLowerCase();
}
function zy(e) {
	return e.trim().replace(/\s+/g, " ").replace(/(["'])(.*?)\1/g, "«$2»");
}
function By(e) {
	return e instanceof Error ? e.message : String(e);
}
async function Vy(e, t) {
	let n = /* @__PURE__ */ new Set();
	for (let r of e.querySelectorAll("img, audio, video, source")) {
		if (!t.has(Wy(r))) continue;
		if (r instanceof HTMLImageElement) {
			n.add(Hy(r));
			continue;
		}
		let e = r instanceof HTMLSourceElement ? r.parentElement?.closest("audio, video") : r;
		e instanceof HTMLMediaElement && n.add(Uy(e));
	}
	await Promise.all(n);
}
function Hy(e) {
	return e.complete ? e.naturalWidth === 0 ? Promise.reject(/* @__PURE__ */ Error(`Scene image failed to load: ${e.src}`)) : typeof e.decode == "function" ? e.decode().then(() => void 0) : Promise.resolve() : new Promise((t, n) => {
		let r = () => {
			e.removeEventListener("load", i), e.removeEventListener("error", a);
		}, i = () => {
			r(), (typeof e.decode == "function" ? e.decode() : Promise.resolve()).then(() => t(), n);
		}, a = () => {
			r(), n(/* @__PURE__ */ Error(`Scene image failed to load: ${e.src}`));
		};
		e.addEventListener("load", i, { once: !0 }), e.addEventListener("error", a, { once: !0 });
	});
}
function Uy(e) {
	return e.readyState >= 3 ? Promise.resolve() : new Promise((t, n) => {
		let r = () => {
			e.removeEventListener("canplay", i), e.removeEventListener("canplaythrough", i), e.removeEventListener("error", a);
		}, i = () => {
			e.readyState < 3 || (r(), t());
		}, a = () => {
			r(), n(/* @__PURE__ */ Error(`Scene media failed to load: ${e.currentSrc || e.src}`));
		};
		e.addEventListener("canplay", i), e.addEventListener("canplaythrough", i), e.addEventListener("error", a, { once: !0 }), e.readyState >= 3 && i();
	});
}
function Wy(e) {
	return e instanceof HTMLImageElement || e instanceof HTMLMediaElement || e instanceof HTMLSourceElement ? "currentSrc" in e && typeof e.currentSrc == "string" && e.currentSrc.length > 0 ? e.currentSrc : e.src : "";
}
function Gy(e) {
	if (globalThis.document === void 0) throw Error("CodPlay.load() requires a browser document.");
	let t = new URL(e, globalThis.document.baseURI);
	return t.pathname.endsWith("/") || (t.pathname += "/"), t;
}
function Ky(e) {
	if (globalThis.document === void 0) throw Error("CodPlay.load() requires a browser document.");
	let t = typeof e == "string" ? globalThis.document.querySelector(e) : e;
	if (!qy(t)) throw Error(typeof e == "string" ? `CodPlay.load() could not resolve root selector: ${e}` : "CodPlay.load() root must be an HTMLElement.");
	return t;
}
function qy(e) {
	return typeof e == "object" && !!e && "nodeType" in e && e.nodeType === 1 && "appendChild" in e && typeof e.appendChild == "function" && "getBoundingClientRect" in e && typeof e.getBoundingClientRect == "function";
}
function Jy(e) {
	if (!$(e) || e.format !== "codplay.scene-package.v1" || e.scene !== "scene/scene.json" || !Array.isArray(e.resources)) throw Error("Scene package manifest has an unsupported format.");
	let t = Yy(e.functions), n = e.resources.map((e, t) => eb(e, t)), r = /* @__PURE__ */ new Set();
	for (let e of n) {
		if (r.has(e.sceneUrl)) throw Error(`Duplicate scene package resource: ${e.sceneUrl}`);
		r.add(e.sceneUrl);
	}
	let i = e.styleSheet === void 0 ? void 0 : Zy(e.styleSheet);
	return {
		format: "codplay.scene-package.v1",
		scene: "scene/scene.json",
		...t === void 0 ? {} : { functions: t },
		resources: n,
		...i === void 0 ? {} : { styleSheet: i }
	};
}
function Yy(e) {
	if (Array.isArray(e) && e.length === 0) return;
	if (!$(e) || e.file !== "scene/functions.mjs" || !Array.isArray(e.references)) throw Error("Scene package function module record is invalid.");
	let t = e.references.map((e, t) => Xy(e, t)), n = /* @__PURE__ */ new Set();
	for (let e of t) {
		if (n.has(e.ref)) throw Error(`Duplicate scene package function reference: ${e.ref}`);
		n.add(e.ref);
	}
	return {
		file: "scene/functions.mjs",
		references: t
	};
}
function Xy(e, t) {
	if (!$(e) || typeof e.ref != "string" || e.ref.length === 0 || !Array.isArray(e.path) || e.path.length === 0 || e.path.some((e) => typeof e != "string" && (typeof e != "number" || !Number.isInteger(e) || e < 0))) throw Error(`Scene package function reference ${t} is invalid.`);
	return {
		ref: e.ref,
		path: e.path
	};
}
function Zy(e) {
	if (!$(e) || e.file !== "scene/style.css" || !Array.isArray(e.classNames) || e.classNames.some((e) => typeof e != "string" || e.length === 0) || !Array.isArray(e.resources) || !Array.isArray(e.fontFaces)) throw Error("Scene package stylesheet record is invalid.");
	let t = e.resources.map((e, t) => $y(e, t)), n = e.fontFaces.map((e, t) => Qy(e, t)), r = /* @__PURE__ */ new Set();
	for (let e of t) for (let t of e.tokens) {
		if (r.has(t)) throw Error(`Duplicate scene package CSS token: ${t}`);
		r.add(t);
	}
	return {
		file: "scene/style.css",
		classNames: e.classNames,
		resources: t,
		fontFaces: n
	};
}
function Qy(e, t) {
	if (!$(e) || e.sourceOrder !== t || typeof e.family != "string" || e.family.trim() === "" || typeof e.src != "string" || e.src.trim() === "" || typeof e.weight != "string" || typeof e.style != "string" || typeof e.stretch != "string" || typeof e.variationSettings != "string" || typeof e.unicodeRange != "string" || typeof e.display != "string") throw Error(`Scene package CSS font face ${t} is invalid.`);
	return {
		sourceOrder: t,
		family: e.family,
		src: e.src,
		weight: e.weight,
		style: e.style,
		stretch: e.stretch,
		variationSettings: e.variationSettings,
		unicodeRange: e.unicodeRange,
		display: e.display
	};
}
function $y(e, t) {
	if (!$(e) || !Array.isArray(e.tokens) || e.tokens.length === 0 || e.tokens.some((e) => typeof e != "string" || !/^codplay-resource-\d+$/.test(e)) || typeof e.sceneUrl != "string" || typeof e.file != "string" || typeof e.suffix != "string" || e.type !== "image" && e.type !== "font") throw Error(`Scene package CSS resource ${t} is invalid.`);
	let n = e.sceneUrl.split(/[?#]/, 1)[0] ?? "";
	if (!/^assets\/[a-f0-9]{20}(?:\.[a-z0-9]+)?$/.test(n) || e.file !== `scene/${n}` || e.suffix !== e.sceneUrl.slice(n.length) || e.suffix !== "" && !/^[?#]/.test(e.suffix)) throw Error(`Scene package CSS resource ${t} has an invalid relative path.`);
	return {
		tokens: e.tokens,
		sceneUrl: e.sceneUrl,
		file: e.file,
		suffix: e.suffix,
		type: e.type
	};
}
function eb(e, t) {
	if (!$(e) || typeof e.sceneUrl != "string" || typeof e.file != "string" || typeof e.suffix != "string" || typeof e.type != "string" || e.type.length === 0 || !Array.isArray(e.occurrences) || e.occurrences.length === 0) throw Error(`Scene package resource ${t} is invalid.`);
	let n = e.sceneUrl.split(/[?#]/, 1)[0] ?? "";
	if (!/^assets\/[a-f0-9]{20}(?:\.[a-z0-9]+)?$/.test(n) || e.file !== `scene/${n}` || e.suffix !== e.sceneUrl.slice(n.length) || e.suffix !== "" && !/^[?#]/.test(e.suffix) || e.file.split("/").includes("..")) throw Error(`Scene package resource ${t} has an invalid relative path.`);
	let r = e.occurrences.map((e) => {
		let n = Array.isArray(e) ? { path: e } : e;
		if (!$(n) || !Array.isArray(n.path) || n.path.length < 2 || n.path.some((e) => typeof e != "string" && (typeof e != "number" || !Number.isInteger(e) || e < 0)) || n.cssUrl !== void 0 && typeof n.cssUrl != "string") throw Error(`Scene package resource ${t} has an invalid occurrence path.`);
		return {
			path: n.path,
			...typeof n.cssUrl == "string" ? { cssUrl: n.cssUrl } : {}
		};
	});
	return {
		sceneUrl: e.sceneUrl,
		file: e.file,
		suffix: e.suffix,
		type: e.type,
		occurrences: r
	};
}
function tb(e, t, n) {
	let r = JSON.parse(JSON.stringify(e)), i = /* @__PURE__ */ new Map();
	for (let e of t.resources) {
		let t = `${new URL(e.file, n).href}${e.suffix}`;
		i.set(e.sceneUrl, {
			url: t,
			type: e.type
		});
		for (let n of e.occurrences) if (n.cssUrl !== void 0) {
			let i = nb(r, n.path);
			if (typeof i != "string" || !i.includes(n.cssUrl)) throw Error(`Compiled scene CSS resource occurrence does not match package manifest: ${e.sceneUrl}`);
			let a = `url(${JSON.stringify(t)})`;
			rb(r, n.path, i.replaceAll(n.cssUrl, a));
		} else {
			if (nb(r, n.path) !== e.sceneUrl) throw Error(`Compiled scene resource occurrence does not match package manifest: ${e.sceneUrl}`);
			rb(r, n.path, t);
		}
	}
	if (i.size !== e.resources.entries.length) throw Error("Scene package manifest does not close the compiled resource list.");
	let a = e.resources.entries.map((e) => {
		let t = i.get(e.url);
		if (t === void 0 || t.type !== e.type) throw Error(`Scene package manifest is missing compiled resource: ${e.url}`);
		return {
			...e,
			url: t.url
		};
	});
	return r.resources = { entries: a }, r.requirements = {
		...r.requirements,
		resources: a.map((e) => e.url)
	}, r;
}
function nb(e, t) {
	let n = e;
	for (let e of t) {
		if (typeof e == "number") {
			if (!Array.isArray(n)) return;
			n = n[e];
			continue;
		}
		if (!$(n)) return;
		n = n[e];
	}
	return n;
}
function rb(e, t, n) {
	let r = nb(e, t.slice(0, -1)), i = t.at(-1);
	if (i === void 0) throw Error("Scene package occurrence path is empty.");
	if (typeof i == "number") {
		if (!Array.isArray(r) || i >= r.length) throw Error("Scene package occurrence path is invalid.");
		r[i] = n;
		return;
	}
	if (!$(r) || !(i in r)) throw Error("Scene package occurrence path is invalid.");
	r[i] = n;
}
function $(e) {
	if (typeof e != "object" || !e || Array.isArray(e)) return !1;
	let t = Object.getPrototypeOf(e);
	return t === Object.prototype || t === null;
}
//#endregion
//#region ../codplay/src/facade/codplay-facade.ts
var ib = class {
	#e;
	#t = Promise.resolve();
	#n = 0;
	#r = /* @__PURE__ */ new Map();
	build;
	load;
	components;
	services;
	modules;
	libraries;
	resources;
	events;
	engine;
	instances;
	preload;
	constructor(e = {}) {
		let t = new ae({
			scheduler: e.frameScheduler,
			pauseOnDocumentHidden: e.pauseOnDocumentHidden
		}), n = new vy({
			...e.engine ?? {},
			ticker: t,
			htmlHost: e.htmlHost
		});
		this.#e = n;
		let r = n.createCapabilityRegistries();
		this.build = (e, t) => n.buildScene(e, t), this.components = r.components, this.services = r.services, this.modules = r.modules, this.libraries = r.libraries, this.resources = n.createResourceRegistry(), this.events = n.createEventRegistry(), this.engine = {
			prepareScene: (e) => n.prepareScene(e),
			start: () => n.start(),
			pause: () => n.pause(),
			stop: () => n.stop(),
			advance: (e, t) => n.advance(e, t)
		};
		let i = n.createInstanceRegistry();
		this.instances = {
			...i,
			destroy: (e) => {
				i.destroy(e);
				let t = this.#r.get(e);
				t !== void 0 && (this.preload.css.clear(t), this.#r.delete(e));
			}
		}, this.preload = v(e.preload ?? {}), this.load = (e, t) => {
			this.#e.lockCapabilityRegistries();
			let n = `codplay-load-${++this.#n}`, r = this.#t.then(async () => {
				let r = await Sy(this, e, t.root, n);
				return r.cssSlot !== void 0 && this.#r.set(n, r.cssSlot), r.instance;
			});
			return this.#t = r.then(() => void 0, () => void 0), r;
		};
	}
	destroy() {
		this.#e.destroy(), xy(this), this.preload.cancel(), this.preload.css.clear(), this.#r.clear();
	}
};
//#endregion
//#region ../codplay/src/scene/authoring/slot-manifest.ts
function ab(e, t = {}) {
	let n = sb(e) ? e.scene.stories : e.stories, r = [];
	for (let [e, i] of Object.entries(n)) {
		let n = i.id;
		t.storyId !== void 0 && t.storyId !== e && t.storyId !== n || i.persos.forEach((t, i) => {
			if (t.type !== "slot") return;
			let a = lb(t.initial);
			r.push({
				slot: t.name ?? "",
				storyId: n,
				persoId: t.id,
				sourcePath: `stories.${e}.persos[${i}].name`,
				...a === void 0 ? {} : { replace: a }
			});
		});
	}
	return r;
}
function ob(e, t, n = {}) {
	let r = n.storyId === void 0 ? e : e.filter((e) => e.storyId === n.storyId), i = r.filter((e) => e.slot === t);
	if (i.length === 1) return {
		ok: !0,
		entry: i[0]
	};
	let a = [...new Set(r.map((e) => e.slot).filter((e) => e.length > 0))].sort((e, t) => e.localeCompare(t)), o = n.sceneId === void 0 ? "the requested scene" : `scene "${n.sceneId}"`, s = n.storyId === void 0 ? o : `${o}, story "${n.storyId}"`;
	return i.length === 0 ? {
		ok: !1,
		diagnostic: {
			code: "AUTHOR_SLOT_NAME_UNKNOWN",
			message: `Slot "${t}" was not found in ${s}. Available slots: ${cb(a)}.`,
			slot: t,
			...n.sceneId === void 0 ? {} : { sceneId: n.sceneId },
			...n.storyId === void 0 ? {} : { storyId: n.storyId },
			...n.referencePath === void 0 ? {} : { referencePath: n.referencePath },
			available: a,
			candidates: i
		}
	} : {
		ok: !1,
		diagnostic: {
			code: "AUTHOR_SLOT_NAME_AMBIGUOUS",
			message: `Slot "${t}" is declared more than once in ${s}: ${i.map((e) => e.sourcePath).join(", ")}.`,
			slot: t,
			...n.sceneId === void 0 ? {} : { sceneId: n.sceneId },
			...n.storyId === void 0 ? {} : { storyId: n.storyId },
			...n.referencePath === void 0 ? {} : { referencePath: n.referencePath },
			available: a,
			candidates: i
		}
	};
}
function sb(e) {
	return "scene" in e && typeof e.scene == "object" && e.scene !== null;
}
function cb(e) {
	return e.length === 0 ? "(none)" : e.map((e) => `"${e}"`).join(", ");
}
function lb(e) {
	let t = e?.replace;
	if (t === "fade" || t === "fade-in") return t;
	if (!(!ub(t) || t.transition !== "fade" && t.transition !== "fade-in")) {
		if (t.duration === void 0) return { transition: t.transition };
		if (!(typeof t.duration != "number" || !Number.isFinite(t.duration) || t.duration < 0)) return {
			transition: t.transition,
			duration: t.duration
		};
	}
}
function ub(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
//#endregion
export { pe as BaseComponent, w as BaseHTMLComponent, ib as CodPlay, df as DEFAULT_RUNTIME_IDLE_DURATION_MS, ff as DEFAULT_RUNTIME_IDLE_EVENT_NAME, mf as RuntimeIdleMonitor, pf as resolveRuntimeIdleOptions, ob as resolveSlotManifestEntry, ab as slotManifest };
