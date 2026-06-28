import type { AnimationResolvedAction } from "../../animation/types";
import type { TransitionRequest } from "../../animation/types";
import { RUNTIME_CONFIG } from "../config";
import type { ItemDoc, RuntimeElementMap, RuntimePersos } from "../types";
import type { MoveCommand } from "../types";
import type { RenderMutationResolver } from "../render-mutation-resolver";
import { createComponentServices, CORE_SERVICES } from "./lib/component-services";
import type { ServiceInstance } from "./lib/component-services";
import { createComponentModules } from "./lib/component-modules";
import { isDomNode } from "./lib/dom-component-adapter";
import { InputComponent } from "./input-component";
import { LayoutComponent } from "./layout-component";
import { ImageComponent } from "./image-component";
import { ListComponent } from "./list-component";
import { MediaComponent } from "./media-component";
import { TagComponent } from "./tag-component";
import { TextComponent } from "./text-component";
import { moveModule, normalizeMoveCommand, isStoryHostMove } from "../modules/move";
import { listModule } from "../modules/list";
import { replaceModule } from "../modules/replace";
import type {
  ComponentRegisterInput,
  ModuleEmitInput,
  ModuleRegisterInput,
  RegistryResult,
  RuntimeComponent,
  RuntimeComponentClass,
  RuntimeComponentWarningReporter,
  RuntimeLayoutComponent,
  RuntimeLayoutOutletSnapshot,
  RuntimeListComponent,
  RuntimeModule,
  RuntimeModuleEventPayload,
  RuntimeModuleHookOutput,
  RuntimeModuleHookPayload,
  RuntimeModuleHookPhase,
  RuntimeModuleHost,
  RuntimeModuleRuntimeBinding,
  RuntimeRegistrySnapshot,
  RuntimeResolvedUpdate,
  RuntimeUpdateRoutingResult,
  ServiceRegisterInput,
} from "./types";

const DEFAULT_COMPONENT_CLASSES: Record<string, RuntimeComponentClass> = {
  tag: TagComponent,
  text: TextComponent,
  img: ImageComponent,
  input: InputComponent,
  media: MediaComponent,
  list: ListComponent,
  layout: LayoutComponent,
};

/**
 * Builds one runtime map entry for a component root node.
 */
function toRuntimeElementMap(
  componentByPersoId: Map<string, RuntimeComponent>,
  nodeByPersoId: Map<string, unknown>,
): RuntimeElementMap {
  const runtimeElements: RuntimeElementMap = new Map();

  for (const [persoId] of componentByPersoId) {
    runtimeElements.set(persoId, {
      runtimeItemId: persoId,
      nodeRef: nodeByPersoId.get(persoId),
      plugins: undefined,
    });
  }

  return runtimeElements;
}

/**
 * Implements component instantiation, registry management, and move routing.
 */
export class RuntimeComponentOrchestrator {
  private readonly warn: RuntimeComponentWarningReporter;
  private readonly warningKeys = new Set<string>();

  private readonly serviceRegistry = new Map<string, ServiceInstance>(Object.entries(CORE_SERVICES));
  private readonly moduleRegistry = new Map<string, RuntimeModule>();
  private readonly installedModuleBindings: RuntimeModuleRuntimeBinding[] = [];
  private readonly installedModuleEventHandlers = new Map<string, Array<(payload: RuntimeModuleEventPayload) => void>>();
  private readonly componentClassByType = new Map<string, RuntimeComponentClass>();
  private readonly renderMutationResolverByType = new Map<string, RenderMutationResolver>();
  private readonly componentByPersoId = new Map<string, RuntimeComponent>();
  private readonly nodeByPersoId = new Map<string, unknown>();
  private readonly listByPersoId = new Map<string, RuntimeListComponent>();
  private readonly parentListByPersoId = new Map<string, string | null>();
  private readonly mountedByPersoId = new Map<string, boolean>();
  private readonly renderMutationResolverByPersoId = new Map<string, RenderMutationResolver>();
  private readonly outletIdsByComponentId = new Map<string, string[]>();
  private readonly componentIdByOutletId = new Map<string, string>();
  private readonly storyIdByPersoId = new Map<string, string>();
  private readonly storyEntriesByStoryId = new Map<string, string[]>();
  private readonly storyMoveByStoryId = new Map<string, unknown>();
  private readonly storyHostNodeByStoryId = new Map<string, unknown>();

  private createElementOptions: import("../create-element").CreateElementOptions | undefined;

  /**
   * Creates one component orchestrator with default built-in components.
   */
  constructor(input: {
    warn: RuntimeComponentWarningReporter;
    createElementOptions?: import("../create-element").CreateElementOptions;
  }) {
    this.warn = input.warn;
    this.createElementOptions = input.createElementOptions;

    for (const [persoType, componentClass] of Object.entries(DEFAULT_COMPONENT_CLASSES)) {
      this.setComponentClass(persoType, componentClass);
    }

    this.registerModule({ name: "move", module: moveModule });
    this.registerModule({ name: "list", module: listModule });
    this.registerModule({ name: "replace", module: replaceModule });
  }

  /**
   * Registers one component class and its optional mutation resolver.
   */
  private setComponentClass(persoType: string, componentClass: RuntimeComponentClass): void {
    this.componentClassByType.set(persoType, componentClass);

    if (componentClass.renderMutationResolver) {
      this.renderMutationResolverByType.set(persoType, componentClass.renderMutationResolver);
      return;
    }

    this.renderMutationResolverByType.delete(persoType);
  }

  /**
   * Updates runtime node factory options used for future component creation.
   */
  setCreateElementOptions(
    createElementOptions: import("../create-element").CreateElementOptions | undefined,
  ): void {
    this.createElementOptions = createElementOptions;
  }

  /**
   * Registers one component class for one perso type. Fails explicitly if the type is already registered.
   */
  registerComponent({ type, component }: ComponentRegisterInput): RegistryResult {
    if (this.componentClassByType.has(type)) {
      return {
        ok: false,
        error: {
          code: "RUNTIME_COMPONENT_ALREADY_REGISTERED",
          message: "Component type is already registered",
          details: { type },
        },
      };
    }
    this.setComponentClass(type, component);
    return { ok: true, status: "registered" };
  }

  /**
   * Overrides one component class for one perso type. Fails explicitly if the type is not yet registered.
   */
  overrideComponent({ type, component }: ComponentRegisterInput): RegistryResult {
    if (!this.componentClassByType.has(type)) {
      return {
        ok: false,
        error: {
          code: "RUNTIME_COMPONENT_NOT_REGISTERED",
          message: "Component type is not registered and cannot be overridden",
          details: { type },
        },
      };
    }
    this.setComponentClass(type, component);
    return { ok: true, status: "overridden" };
  }

  /**
   * Registers one service for one name. Fails explicitly if the name is already registered.
   */
  registerService({ name, service }: ServiceRegisterInput): RegistryResult {
    if (this.serviceRegistry.has(name)) {
      return {
        ok: false,
        error: {
          code: "RUNTIME_SERVICE_ALREADY_REGISTERED",
          message: "Service name is already registered",
          details: { name },
        },
      };
    }
    this.serviceRegistry.set(name, service);
    return { ok: true, status: "registered" };
  }

  /**
   * Overrides one service for one name. Fails explicitly if the name is not yet registered.
   */
  overrideService({ name, service }: ServiceRegisterInput): RegistryResult {
    if (!this.serviceRegistry.has(name)) {
      return {
        ok: false,
        error: {
          code: "RUNTIME_SERVICE_NOT_REGISTERED",
          message: "Service name is not registered and cannot be overridden",
          details: { name },
        },
      };
    }
    this.serviceRegistry.set(name, service);
    return { ok: true, status: "overridden" };
  }

  /**
   * Registers one module. Fails explicitly if the name is already registered.
   */
  registerModule({ name, module }: ModuleRegisterInput): RegistryResult {
    if (this.moduleRegistry.has(name)) {
      return {
        ok: false,
        error: {
          code: "RUNTIME_MODULE_ALREADY_REGISTERED",
          message: "Module name is already registered",
          details: { name },
        },
      };
    }
    this.moduleRegistry.set(name, module);
    return { ok: true, status: "registered" };
  }

  /**
   * Overrides one module. Fails explicitly if the name is not yet registered.
   */
  overrideModule({ name, module }: ModuleRegisterInput): RegistryResult {
    if (!this.moduleRegistry.has(name)) {
      return {
        ok: false,
        error: {
          code: "RUNTIME_MODULE_NOT_REGISTERED",
          message: "Module name is not registered and cannot be overridden",
          details: { name },
        },
      };
    }
    this.moduleRegistry.set(name, module);
    return { ok: true, status: "overridden" };
  }

  /**
   * Installs all registered modules against the runtime host and collects their bindings.
   */
  private installModules(): void {
    this.installedModuleBindings.length = 0;
    this.installedModuleEventHandlers.clear();
    const host = this.createModuleHost();
    for (const module of this.moduleRegistry.values()) {
      const binding = module.install(host);
      if (binding.runtime !== undefined) {
        this.installedModuleBindings.push(binding.runtime);
      }
      if (binding.events !== undefined) {
        for (const [eventName, handler] of Object.entries(binding.events)) {
          const handlers = this.installedModuleEventHandlers.get(eventName) ?? [];
          handlers.push(handler);
          this.installedModuleEventHandlers.set(eventName, handlers);
        }
      }
    }
  }

  /**
   * Dispatches one module-internal event to all registered module event handlers.
   */
  dispatchModuleEvent(name: string, payload: RuntimeModuleEventPayload): void {
    const handlers = this.installedModuleEventHandlers.get(name);
    if (handlers === undefined) return;
    for (const handler of handlers) {
      handler(payload);
    }
  }

  /**
   * Builds the module host that exposes registries and helpers to installed modules.
   */
  private createModuleHost(): RuntimeModuleHost {
    const getTimelineMs = () => this.createElementOptions?.getCurrentTimelineMs?.() ?? 0;
    return {
      report: this.warn,
      warnOnce: (eventSeq, code, details, persoId) => this.warnOnce(eventSeq, code, details, persoId),
      registries: {
        node: {
          get: (id) => this.nodeByPersoId.get(id) ?? null,
        },
        component: {
          get: (id) => this.componentByPersoId.get(id) ?? null,
        },
        container: {
          get: (id) => this.listByPersoId.get(id) ?? null,
          set: (id, list) => {
            this.listByPersoId.set(id, list);
          },
          delete: (id) => {
            this.listByPersoId.delete(id);
          },
          getParentId: (childId) => this.parentListByPersoId.get(childId) ?? null,
          setParentId: (childId, parentId) => {
            this.parentListByPersoId.set(childId, parentId);
          },
        },
        mounted: {
          get: (id) => this.mountedByPersoId.get(id) ?? false,
          set: (id, mounted) => {
            this.mountedByPersoId.set(id, mounted);
          },
        },
      },
      helpers: {
        getStoryId: (persoId) => this.storyIdByPersoId.get(persoId) ?? null,
        resolveTargetNode: (parentId, storyId, childNode) =>
          this.resolveMoveTargetNode(parentId, storyId, childNode),
        canAttachChildToNode: (parentNode, childNode) => this.canAttachChildToNode(parentNode, childNode),
        detachNode: (nodeRef) => this.detachNodeFromParent(nodeRef),
        appendNode: (parentNode, childNode) => this.appendNodeToParent(parentNode, childNode),
        isNodeChildOf: (parentNode, childNode) => this.isNodeChildOf(parentNode, childNode),
      },
      emit: (input: ModuleEmitInput) => {
        const ms = input.ms ?? getTimelineMs();
        this.createElementOptions?.emitRuntimeEvent?.({
          name: input.name,
          data: input.payload,
          ms,
          mode: input.insertMode ?? 'persist-only',
          scopeStoryId: input.scopeStoryId,
          source: 'module',
        });
        this.dispatchModuleEvent(input.name, {
          name: input.name,
          payload: input.payload,
          insertMode: (input.insertMode ?? 'apply-now') as 'apply-now' | 'persist-only',
          scopePersoId: input.scopePersoId,
          scopeStoryId: input.scopeStoryId,
          ms,
        });
      },
      timeline: {
        get currentMs() {
          return getTimelineMs();
        },
      },
    };
  }

  /**
   * Dispatches one hook phase to all installed modules whose match is compatible.
   */
  private runHook(phase: RuntimeModuleHookPhase, payload: RuntimeModuleHookPayload): void {
    for (const binding of this.installedModuleBindings) {
      const hook = binding.hooks?.[phase];
      if (hook === undefined) {
        continue;
      }

      const match = binding.match;
      if (match !== undefined) {
        if (match.actionKeys !== undefined && match.actionKeys.length > 0) {
          const action = payload.resolvedAction?.action as Record<string, unknown> | undefined;
          if (action !== undefined) {
            const hasMatchingKey = match.actionKeys.some((key) =>
              Object.prototype.hasOwnProperty.call(action, key),
            );
            if (!hasMatchingKey) {
              continue;
            }
          }
        }

        if (match.componentCapabilities !== undefined && match.componentCapabilities.length > 0) {
          const component = payload.component;
          if (component === undefined) {
            continue;
          }
          const hasCapability = match.componentCapabilities.some((cap) =>
            component.modules.declared.includes(cap),
          );
          if (!hasCapability) {
            continue;
          }
        }
      }

      hook(payload);
    }
  }

  /**
   * Synchronizes one runtime perso graph without purging the existing registry.
   * `mountedPersoIds`, when provided, restricts both the mount/refresh pass
   * and the initial-move pass to story entries plus persos it lists — a
   * perso resolved as not-mounted-at-targetMs (`resolveMountedStateAtSeek`)
   * gets no write at all, not just a skipped refresh. See
   * 2026-06-28-unify-action-execution-and-move-off-plan.md Phase 3.
   */
  loadPersos(runtimePersos: RuntimePersos, mountedPersoIds?: ReadonlySet<string>): RuntimeElementMap {
    this.installModules();
    this.storyEntriesByStoryId.clear();
    this.storyMoveByStoryId.clear();

    for (const [storyId, entryIds] of Object.entries(runtimePersos.entriesByStoryId ?? {})) {
      this.storyEntriesByStoryId.set(storyId, [...entryIds]);
    }

    for (const [storyId, rawMove] of Object.entries(runtimePersos.storyMovesByStoryId ?? {})) {
      this.storyMoveByStoryId.set(storyId, rawMove);
    }

    // No pre-detach. A loadPersos (seek/rewind/rebuild) runs entirely inside a single
    // synchronous task: the style/content reset below and the subsequent event replay
    // happen before the browser ever repaints, so an off-screen reset is unnecessary.
    // Detaching here would needlessly remove nodes from the document and, for media
    // (<img>/<video>), interrupt the browser decode — corrupting live measurements
    // (naturalWidth) on the next refresh. Attach passes below are made idempotent so
    // unchanged nodes are never detached. See v1-seek-spec.md (appendice 2026-06-25).

    for (const perso of Object.values(runtimePersos.persos)) {
      const storyEntries = this.storyEntriesByStoryId.get(perso.storyId) ?? [];
      const isStoryEntry = storyEntries.includes(perso.id);
      // Exempt only true roots (an entry with no custom move of its own) from
      // the mountedPersoIds filter — an entry with its own move/outlet target
      // is an ordinary perso for this purpose, same root condition as the
      // initial-move loop below and resolveMountedPersoIdsAtSeek's rootPersoIds.
      const isRootEntry = isStoryEntry && (perso.initial.move === undefined || isStoryHostMove(perso.initial.move));
      if (mountedPersoIds !== undefined && !isRootEntry && !mountedPersoIds.has(perso.id)) {
        continue;
      }

      const existingComponent = this.componentByPersoId.get(perso.id);
      if (existingComponent) {
        this.refreshLoadedRuntimeComponent(perso, existingComponent);
        continue;
      }

      const componentClass = this.componentClassByType.get(perso.type);
      if (!componentClass) {
        this.warn({
          code: "AUTHOR_COMPONENT_TYPE_UNKNOWN",
          message: "Unknown component type",
          details: {
            persoId: perso.id,
            persoType: perso.type,
          },
        });
        continue;
      }

      this.mountLoadedRuntimeComponent(perso, componentClass);
    }

    this.mountStoryHosts(runtimePersos);

    for (const perso of Object.values(runtimePersos.persos)) {
      const storyEntries = this.storyEntriesByStoryId.get(perso.storyId) ?? [];
      const isStoryEntry = storyEntries.includes(perso.id);
      const isRootEntry = isStoryEntry && (perso.initial.move === undefined || isStoryHostMove(perso.initial.move));
      if (mountedPersoIds !== undefined && !isRootEntry && !mountedPersoIds.has(perso.id)) {
        continue;
      }

      const rawInitialMove = perso.initial.move;

      if (isStoryEntry && (rawInitialMove === undefined || isStoryHostMove(rawInitialMove))) {
        continue;
      }

      const moveCommand = normalizeMoveCommand(perso.initial.move, true);
      if (moveCommand === null) {
        continue;
      }

      this.runHook("onInitialPerso", { perso, moveCommand });
    }

    this.mountStoryEntriesToStoryHosts(runtimePersos);

    return toRuntimeElementMap(this.componentByPersoId, this.nodeByPersoId);
  }

  /**
   * Refreshes one already-mounted runtime component in place.
   */
  private refreshLoadedRuntimeComponent(perso: ItemDoc, component: RuntimeComponent): void {
    // No detach: the node is reused in place (buildNode preserves node identity) and
    // its style/content reset happens synchronously, before any repaint. Detaching here
    // would interrupt media decode on the reused node. The idempotent attach passes keep
    // the node where it already is when nothing changed.
    const nextRootNode = this.tryInitComponent(perso, component, "refresh");
    if (nextRootNode === null) {
      return;
    }

    this.storeLoadedRuntimeComponent(perso, component, nextRootNode);
  }

  /**
   * Instantiates one new runtime component and stores its runtime maps.
   */
  private mountLoadedRuntimeComponent(perso: ItemDoc, componentClass: RuntimeComponentClass): void {
    const component = new componentClass({
      perso,
      services: createComponentServices(this.serviceRegistry),
      modules: createComponentModules(),
      createElementOptions: this.createElementOptions,
      report: this.warn,
    });

    const rootNode = this.tryInitComponent(perso, component, "mount");
    if (rootNode === null) {
      return;
    }

    this.storeLoadedRuntimeComponent(perso, component, rootNode);
  }

  /**
   * Writes one runtime component snapshot into registry maps.
   */
  private storeLoadedRuntimeComponent(perso: ItemDoc, component: RuntimeComponent, rootNode: unknown): void {
    this.clearComponentOutlets(perso.id);
    this.componentByPersoId.set(perso.id, component);
    this.nodeByPersoId.set(perso.id, rootNode);
    this.parentListByPersoId.set(perso.id, null);
    this.mountedByPersoId.set(perso.id, false);
    this.storyIdByPersoId.set(perso.id, perso.storyId);
    this.listByPersoId.delete(perso.id);

    this.runHook("onComponentMounted", { perso, component, rootNode });

    const resolver = this.renderMutationResolverByType.get(perso.type);
    if (resolver) {
      this.renderMutationResolverByPersoId.set(perso.id, resolver);
    } else if (this.renderMutationResolverByPersoId.has(perso.id)) {
      this.renderMutationResolverByPersoId.delete(perso.id);
    }

    if (this.hasRuntimeOutlets(component)) {
      this.registerComponentOutlets(perso.id, component);
    }
  }

  /**
   * Destroys current runtime maps and returns empty runtime elements.
   */
  destroy(): RuntimeElementMap {
    this.runHook("onDestroy", {});
    this.componentByPersoId.clear();
    this.nodeByPersoId.clear();
    this.listByPersoId.clear();
    this.parentListByPersoId.clear();
    this.mountedByPersoId.clear();
    this.renderMutationResolverByPersoId.clear();
    this.outletIdsByComponentId.clear();
    this.componentIdByOutletId.clear();
    this.storyIdByPersoId.clear();
    this.storyEntriesByStoryId.clear();
    this.storyMoveByStoryId.clear();
    this.storyHostNodeByStoryId.clear();
    return new Map();
  }

  /**
   * Routes resolved updates to component instances and move router.
   */
  routeUpdates(updates: RuntimeResolvedUpdate[]): RuntimeUpdateRoutingResult {
    this.warningKeys.clear();
    const animatableActions: AnimationResolvedAction[] = [];
    const directTransitions: TransitionRequest[] = [];
    let appliedActionsCount = 0;
    const moveDecisionsByUpdateIndex = this.resolveMoveDecisions(updates);

    for (const [updateIndex, update] of updates.entries()) {
      if (
        this.triggerResolvedAction({
          update,
          moveDecision: moveDecisionsByUpdateIndex.get(updateIndex),
          animatableActions,
          directTransitions,
        })
      ) {
        appliedActionsCount += 1;
      }
    }

    return {
      appliedActionsCount,
      animatableActions,
      directTransitions,
    };
  }

  /**
   * Single trigger point for one resolved action, regardless of which engine
   * (if any) will later take over a continuous evaluation of it. Resolves the
   * target component, runs `beforeUpdate`/`afterUpdate`, applies the action
   * once via `tryUpdateComponent`, and collects it into `animatableActions`
   * for the renderer to offer to continuous animation engines (see
   * `RendererFacade.tick()` / `ContinuousAnimationEngine`). This is the only
   * place `RUNTIME_COMPONENT_NODE_NOT_FOUND` is raised, so every action —
   * static or claimed later by an engine — gets the same target-resolution
   * guarantee.
   */
  private triggerResolvedAction(input: {
    update: RuntimeResolvedUpdate;
    moveDecision: MoveCommand | null | undefined;
    animatableActions: AnimationResolvedAction[];
    directTransitions: TransitionRequest[];
  }): boolean {
    const targetPersoId = this.resolveTargetPersoId(input.update.resolvedAction);
    const component = this.componentByPersoId.get(targetPersoId);
    if (!component) {
      this.warnOnce(
        input.update.eventSeq,
        "RUNTIME_COMPONENT_NODE_NOT_FOUND",
        {
          targetPersoId,
          eventId: input.update.resolvedAction.eventId,
          eventSeq: input.update.eventSeq,
        },
        targetPersoId,
      );
      return false;
    }

    const moveDecision = input.moveDecision ?? null;
    const hookOutput: RuntimeModuleHookOutput = { directTransitions: [] };

    this.runHook("beforeUpdate", {
      resolvedAction: input.update.resolvedAction,
      eventSeq: input.update.eventSeq,
      moveCommand: moveDecision,
      component,
      output: hookOutput,
    });

    if (
      !this.tryUpdateComponent(component, {
        persoId: targetPersoId,
        eventId: input.update.resolvedAction.eventId,
        eventSeq: input.update.eventSeq,
        action: input.update.resolvedAction.action as Record<string, unknown>,
      })
    ) {
      return false;
    }

    this.runHook("afterUpdate", {
      resolvedAction: input.update.resolvedAction,
      eventSeq: input.update.eventSeq,
      component,
      output: hookOutput,
    });

    input.directTransitions.push(...hookOutput.directTransitions);

    const targetNode = this.nodeByPersoId.get(targetPersoId);
    if (targetNode !== undefined) {
      input.animatableActions.push({
        ...input.update.resolvedAction,
        action: {
          ...input.update.resolvedAction.action,
          target: targetNode,
        },
      });
    }

    return true;
  }

  /**
   * Initializes one component behind one global runtime warning boundary.
   */
  private tryInitComponent(
    perso: ItemDoc,
    component: RuntimeComponent,
    phase: "mount" | "refresh",
  ): unknown | null {
    try {
      component._init();
      return component.node;
    } catch (error) {
      this.warn({
        code: "RUNTIME_COMPONENT_INIT_FAILED",
        message: "Component init failed",
        details: {
          persoId: perso.id,
          persoType: perso.type,
          phase,
          error: error instanceof Error ? error.message : "unknown_error",
        },
      });
      return null;
    }
  }

  /**
   * Updates one component behind one global runtime warning boundary.
   */
  private tryUpdateComponent(
    component: RuntimeComponent,
    input: {
      persoId: string;
      eventId: string;
      eventSeq: number;
      action: Record<string, unknown>;
    },
  ): boolean {
    try {
      component.update(input);
      return true;
    } catch (error) {
      this.warnOnce(
        input.eventSeq,
        "RUNTIME_COMPONENT_UPDATE_FAILED",
        {
          persoId: input.persoId,
          eventId: input.eventId,
          eventSeq: input.eventSeq,
          error: error instanceof Error ? error.message : "unknown_error",
        },
        input.persoId,
      );
      return false;
    }
  }

  /**
   * Exposes one stable runtime registry used by renderer/player integration.
   */
  getRuntimeRegistrySnapshot(): RuntimeRegistrySnapshot {
    return {
      getNodeById: (persoId) => this.nodeByPersoId.get(persoId) ?? null,
      getComponentById: (persoId) => this.componentByPersoId.get(persoId) ?? null,
      getListById: (persoId) => this.listByPersoId.get(persoId) ?? null,
      getRenderMutationResolverById: (persoId) => this.renderMutationResolverByPersoId.get(persoId) ?? null,
      getParentListId: (persoId) => this.parentListByPersoId.get(persoId) ?? null,
      setParentListId: (persoId, parentListId) => {
        this.parentListByPersoId.set(persoId, parentListId);
      },
      isMounted: (persoId) => this.mountedByPersoId.get(persoId) ?? false,
      setMounted: (persoId, mounted) => {
        this.mountedByPersoId.set(persoId, mounted);
      },
    };
  }

  /**
   * Returns one runtime elements map view for renderer state snapshots.
   */
  getRuntimeElements(): RuntimeElementMap {
    return toRuntimeElementMap(this.componentByPersoId, this.nodeByPersoId);
  }

  /**
   * Returns one registered mutation resolver for one runtime item when available.
   */
  getRenderMutationResolverById(persoId: string): RenderMutationResolver | null {
    return this.renderMutationResolverByPersoId.get(persoId) ?? null;
  }

  /**
   * Checks whether one runtime component exposes the layout outlet bridge contract.
   */
  private hasRuntimeOutlets(
    component: RuntimeComponent,
  ): component is RuntimeComponent & { getOutletsSnapshot: () => RuntimeLayoutOutletSnapshot[] } {
    return "getOutletsSnapshot" in component && typeof component.getOutletsSnapshot === "function";
  }

  /**
   * Clears layout outlet registrations for one layout component id.
   */
  private clearComponentOutlets(componentId: string): void {
    const outletIds = this.outletIdsByComponentId.get(componentId);
    if (!outletIds) {
      return;
    }

    for (const outletId of outletIds) {
      if (this.nodeByPersoId.get(outletId) !== undefined) {
        this.nodeByPersoId.delete(outletId);
      }
      this.componentIdByOutletId.delete(outletId);
    }

    this.outletIdsByComponentId.delete(componentId);
  }

  /**
   * Registers all outlet containers exposed by one layout component.
   */
  private registerComponentOutlets(componentId: string, outletComponent: RuntimeLayoutComponent): void {
    const registeredOutletIds: string[] = [];

    for (const outlet of outletComponent.getOutletsSnapshot()) {
      const outletId = outlet.outletId;
      if (
        this.componentByPersoId.has(outletId) ||
        this.nodeByPersoId.has(outletId) ||
        this.listByPersoId.has(outletId)
      ) {
        this.warn({
          code: "AUTHOR_LAYOUT_OUTLET_ID_COLLISION",
          message: "Layout outlet id collides with an existing runtime id",
          details: {
            layoutId: componentId,
            outletId,
          },
        });
        continue;
      }

      this.nodeByPersoId.set(outletId, outlet.nodeRef);
      this.componentIdByOutletId.set(outletId, componentId);
      registeredOutletIds.push(outletId);
    }

    this.outletIdsByComponentId.set(componentId, registeredOutletIds);
  }

  /**
   * Checks whether one runtime node is inside one SVG context.
   */
  private isSvgNode(nodeRef: unknown): boolean {
    if (
      typeof globalThis.Element !== "undefined" &&
      isDomNode(nodeRef) &&
      nodeRef instanceof globalThis.Element
    ) {
      return nodeRef.namespaceURI === "http://www.w3.org/2000/svg" || nodeRef.tagName.toLowerCase() === "svg";
    }

    if (typeof nodeRef !== "object" || nodeRef === null) {
      return false;
    }

    const node = nodeRef as { namespaceURI?: unknown; tagName?: unknown };
    return node.namespaceURI === "http://www.w3.org/2000/svg" || node.tagName === "svg";
  }

  /**
   * Checks whether one child node can be attached to one target node.
   */
  private canAttachChildToNode(targetNode: unknown, childNode: unknown): boolean {
    if (!this.isSvgNode(targetNode)) {
      return true;
    }

    return this.isSvgNode(childNode);
  }

  /**
   * Creates one synthetic host node used to mount one story instance.
   */
  private createStoryHostNode(storyId: string, useDomNode: boolean): unknown {
    if (useDomNode && typeof globalThis.document !== "undefined") {
      const hostNode = globalThis.document.createElement("div");
      hostNode.id = storyId;
      return hostNode;
    }

    return {
      tagName: "DIV",
      id: storyId,
      style: {},
      attributes: {},
      children: [],
    };
  }

  /**
   * Resolves one synthetic host node for one story instance.
   */
  private resolveStoryHostNode(storyId: string, childNode?: unknown): unknown {
    const existingHostNode = this.storyHostNodeByStoryId.get(storyId);
    if (existingHostNode !== undefined) {
      return existingHostNode;
    }

    const hostNode = this.createStoryHostNode(storyId, isDomNode(childNode));
    this.storyHostNodeByStoryId.set(storyId, hostNode);
    return hostNode;
  }

  /**
   * Resolves one explicit parent node for one story host mount.
   */
  private resolveStoryMountTargetNode(parentId: string): unknown | null {
    if (parentId === RUNTIME_CONFIG.move.rootToken) {
      return null;
    }

    return this.nodeByPersoId.get(parentId) ?? null;
  }

  /**
   * Mounts story hosts into declared parent outlets before child entries.
   */
  private mountStoryHosts(runtimePersos: RuntimePersos): void {
    for (const [storyId, rawMove] of Object.entries(runtimePersos.storyMovesByStoryId ?? {})) {
      const move = normalizeMoveCommand(rawMove, true);
      if (move === null) {
        continue;
      }

      const targetNode = this.resolveStoryMountTargetNode(move.parentId);
      if (targetNode === null) {
        continue;
      }

      const hostNode = this.resolveStoryHostNode(storyId, targetNode);
      // Idempotent: re-appending an already-attached host would detach its whole
      // subtree (and interrupt media decode). The story structure is static across seeks.
      if (this.isNodeChildOf(targetNode, hostNode)) {
        continue;
      }
      this.appendNodeToParent(targetNode, hostNode);
    }
  }

  /**
   * Resolves, for every perso with a known effective move at one seek
   * target, whether it would be mounted — walking the proposed parent chain
   * top-down via already-registered graph relationships only
   * (`componentIdByOutletId`, and any other perso recognized by
   * `effectiveMoveByPersoId` itself for a list or direct-node target), never
   * the DOM nor the track. A perso whose chain reaches the detach sentinel,
   * an unresolved target, or a cycle before reaching a root is not mounted —
   * its whole subtree is short-circuited without consulting any
   * descendant's own history. See
   * 2026-06-28-unify-action-execution-and-move-off-plan.md Phase 3.
   */
  resolveMountedStateAtSeek(input: {
    rootPersoIds: ReadonlySet<string>;
    effectiveMoveByPersoId: ReadonlyMap<string, MoveCommand | null>;
  }): Map<string, boolean> {
    const resolved = new Map<string, boolean>();
    for (const persoId of input.effectiveMoveByPersoId.keys()) {
      this.resolveOneMountedStateAtSeek(persoId, input, resolved, new Set());
    }
    return resolved;
  }

  /**
   * Resolves one perso's mounted state at seek, memoized, with cycle
   * detection (a cyclic parent chain is treated as not mounted rather than
   * recursed forever).
   */
  private resolveOneMountedStateAtSeek(
    persoId: string,
    input: {
      rootPersoIds: ReadonlySet<string>;
      effectiveMoveByPersoId: ReadonlyMap<string, MoveCommand | null>;
    },
    resolved: Map<string, boolean>,
    visiting: Set<string>,
  ): boolean {
    const cached = resolved.get(persoId);
    if (cached !== undefined) {
      return cached;
    }

    if (visiting.has(persoId)) {
      resolved.set(persoId, false);
      return false;
    }

    const move = input.effectiveMoveByPersoId.get(persoId) ?? null;

    if (move === null) {
      // A root entry with no move of its own is mounted under its story
      // host. Any other perso with no move at all (no static `initial.move`,
      // no track move) was never placed anywhere: not mounted.
      const mounted = input.rootPersoIds.has(persoId);
      resolved.set(persoId, mounted);
      return mounted;
    }

    if (move.parentId === RUNTIME_CONFIG.move.detachToken) {
      resolved.set(persoId, false);
      return false;
    }

    if (move.parentId === RUNTIME_CONFIG.move.rootToken) {
      resolved.set(persoId, true);
      return true;
    }

    visiting.add(persoId);
    let parentMounted: boolean;
    if (input.effectiveMoveByPersoId.has(move.parentId)) {
      // The target is itself a known perso (a list, or any other component
      // targeted directly) — resolve its own mounted state the same way.
      parentMounted = this.resolveOneMountedStateAtSeek(move.parentId, input, resolved, visiting);
    } else {
      const owningComponentId = this.componentIdByOutletId.get(move.parentId);
      parentMounted =
        owningComponentId !== undefined
          ? this.resolveOneMountedStateAtSeek(owningComponentId, input, resolved, visiting)
          : false;
    }
    visiting.delete(persoId);

    resolved.set(persoId, parentMounted);
    return parentMounted;
  }

  /**
   * Resolves one parent node target from one move parent identifier.
   */
  private resolveMoveTargetNode(
    parentId: string,
    storyId: string | null,
    childNode?: unknown,
  ): unknown | null {
    if (parentId === RUNTIME_CONFIG.move.rootToken) {
      return storyId === null ? null : this.resolveStoryHostNode(storyId, childNode);
    }

    return this.nodeByPersoId.get(parentId) ?? null;
  }

  /**
   * Mounts the root entries of each story into their synthetic hosts.
   */
  private mountStoryEntriesToStoryHosts(runtimePersos: RuntimePersos): void {
    for (const [storyId, entryIds] of Object.entries(runtimePersos.entriesByStoryId ?? {})) {
      if (entryIds.length === 0) {
        continue;
      }

      const hostNode = this.resolveStoryHostNode(storyId, this.nodeByPersoId.get(entryIds[0]));

      for (const entryId of entryIds) {
        const item = runtimePersos.persos[entryId];
        if (item === undefined) {
          continue;
        }

        const rawInitialMove = item.initial.move;
        if (rawInitialMove !== undefined && !isStoryHostMove(rawInitialMove)) {
          continue;
        }

        const entryNode = this.nodeByPersoId.get(entryId);
        if (entryNode === undefined) {
          continue;
        }

        // Idempotent: skip when the entry is already attached to its host. The entry
        // order is static across seeks, so leaving placed nodes untouched preserves
        // order while avoiding a subtree detach (and media decode interruption).
        if (!this.isNodeChildOf(hostNode, entryNode)) {
          this.appendNodeToParent(hostNode, entryNode);
        }
        this.parentListByPersoId.set(entryId, null);
        this.mountedByPersoId.set(entryId, true);
      }
    }
  }

  /**
   * Detaches one node from its current DOM or object parent.
   */
  private detachNodeFromParent(nodeRef: unknown): void {
    if (isDomNode(nodeRef)) {
      const parentNode = nodeRef.parentNode;
      if (parentNode !== null && parentNode !== undefined) {
        parentNode.removeChild(nodeRef);
      }

      return;
    }

    if (typeof nodeRef !== "object" || nodeRef === null) {
      return;
    }

    const childNode = nodeRef as Record<string, unknown>;
    const parentNode = childNode.parentNode;
    if (typeof parentNode !== "object" || parentNode === null) {
      return;
    }

    const mutableParent = parentNode as Record<string, unknown>;
    const currentChildren = Array.isArray(mutableParent.children) ? mutableParent.children : [];
    mutableParent.children = currentChildren.filter((candidate) => candidate !== nodeRef);
    childNode.parentNode = null;
  }

  /**
   * Reports whether one node is already a direct child of one parent (DOM or object).
   * Used by the idempotent attach passes to skip a redundant detach/append cycle on seek.
   */
  private isNodeChildOf(parentNode: unknown, childNode: unknown): boolean {
    if (
      typeof parentNode !== "object" ||
      parentNode === null ||
      typeof childNode !== "object" ||
      childNode === null
    ) {
      return false;
    }

    return (childNode as { parentNode?: unknown }).parentNode === parentNode;
  }

  /**
   * Appends one node to one DOM or object parent.
   */
  private appendNodeToParent(parentNode: unknown, childNode: unknown): void {
    if (isDomNode(parentNode) && isDomNode(childNode)) {
      parentNode.appendChild(childNode);
      return;
    }

    if (
      typeof parentNode !== "object" ||
      parentNode === null ||
      typeof childNode !== "object" ||
      childNode === null
    ) {
      return;
    }

    if (isDomNode(parentNode) || isDomNode(childNode)) {
      return;
    }

    const mutableParent = parentNode as Record<string, unknown>;
    const mutableChild = childNode as Record<string, unknown>;
    const currentChildren = Array.isArray(mutableParent.children) ? mutableParent.children : [];
    if (typeof mutableChild.parentNode === "object" && mutableChild.parentNode !== null) {
      this.detachNodeFromParent(mutableChild);
    }

    mutableParent.children = currentChildren
      .filter((candidate) => candidate !== childNode)
      .concat([childNode]);
    mutableChild.parentNode = parentNode;
  }

  /**
   * Resolves action target id from action targetId override or listener id.
   */
  private resolveTargetPersoId(action: AnimationResolvedAction): string {
    return action.action.targetId ?? action.listenerId;
  }

  /**
   * Emits one warning once per {eventSeq, code, persoId} key.
   */
  private warnOnce(eventSeq: number, code: string, details: Record<string, unknown>, persoId?: string): void {
    const key = `${eventSeq}:${code}:${persoId ?? ""}`;
    if (this.warningKeys.has(key)) {
      return;
    }

    this.warningKeys.add(key);
    this.warn({
      code,
      message: code,
      details,
    });
  }

  /**
   * Resolves one move command decision map with same-tick conflict policy.
   */
  private resolveMoveDecisions(updates: RuntimeResolvedUpdate[]): Map<number, MoveCommand | null> {
    const decisions = new Map<number, MoveCommand | null>();
    const candidatesByKey = new Map<
      string,
      Array<{
        updateIndex: number;
        eventSeq: number;
        eventId: string;
        persoId: string;
        moveCommand: MoveCommand | null;
      }>
    >();

    for (const [updateIndex, update] of updates.entries()) {
      const action = update.resolvedAction.action as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(action, "move")) {
        continue;
      }

      const persoId = this.resolveTargetPersoId(update.resolvedAction);
      const moveCommand = normalizeMoveCommand(action.move, false);
      const key = `${update.eventSeq}:${persoId}`;
      const candidates = candidatesByKey.get(key) ?? [];
      candidates.push({
        updateIndex,
        eventSeq: update.eventSeq,
        eventId: update.resolvedAction.eventId,
        persoId,
        moveCommand,
      });
      candidatesByKey.set(key, candidates);
    }

    for (const candidates of candidatesByKey.values()) {
      if (candidates.length === 0) {
        continue;
      }

      const first = candidates[0];
      if (first === undefined) {
        continue;
      }

      if (candidates.length === 1) {
        decisions.set(first.updateIndex, first.moveCommand);
        if (first.moveCommand === null) {
          this.warnOnce(
            first.eventSeq,
            "AUTHOR_MOVE_COMMAND_INVALID",
            {
              persoId: first.persoId,
              eventId: first.eventId,
            },
            first.persoId,
          );
        }

        continue;
      }

      const last = candidates[candidates.length - 1];
      if (last === undefined) {
        continue;
      }

      this.warnOnce(
        last.eventSeq,
        "AUTHOR_MOVE_CONFLICT_SAME_TICK",
        {
          persoId: last.persoId,
          eventId: last.eventId,
          conflictCount: candidates.length,
        },
        last.persoId,
      );

      if (last.moveCommand === null) {
        for (const candidate of candidates) {
          decisions.set(candidate.updateIndex, null);
        }

        this.warnOnce(
          last.eventSeq,
          "AUTHOR_MOVE_LAST_INVALID_SAME_TICK",
          {
            persoId: last.persoId,
            eventId: last.eventId,
          },
          last.persoId,
        );
        continue;
      }

      for (const candidate of candidates) {
        decisions.set(
          candidate.updateIndex,
          candidate.updateIndex === last.updateIndex ? last.moveCommand : null,
        );
      }
    }

    return decisions;
  }
}
