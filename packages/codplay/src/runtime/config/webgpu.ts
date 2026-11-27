/**
 * WebGPU flag values fixed by the WebGPU specification. TypeScript's DOM
 * library declares the GPU interfaces but not these global flag namespaces.
 */
export const WEBGPU_SHADER_STAGE = { vertex: 0x1, fragment: 0x2 } as const
export const WEBGPU_BUFFER_USAGE = { copyDestination: 0x8, uniform: 0x40 } as const
export const WEBGPU_TEXTURE_USAGE = { copyDestination: 0x2, textureBinding: 0x4, renderAttachment: 0x10 } as const
