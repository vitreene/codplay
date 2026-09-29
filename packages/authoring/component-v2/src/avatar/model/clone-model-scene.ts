import type { Group, Material, Mesh, Object3D, Skeleton, SkinnedMesh } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'

/** Clones a decoded model for one Avatar while retaining its skeleton sharing. */
export function cloneModelScene(source: Group): Group {
  const scene = clone(source) as Group
  const skeletons = new Map<Skeleton, Skeleton>()
  const materials = new Map<Material, Material>()

  /** Copies resource ownership and skeleton aliases for one matching node pair. */
  function visit(sourceNode: Object3D, clonedNode: Object3D): void {
    const sourceSkin = sourceNode as SkinnedMesh
    if (sourceSkin.isSkinnedMesh) {
      const clonedSkin = clonedNode as SkinnedMesh
      const shared = skeletons.get(sourceSkin.skeleton)
      if (shared === undefined) {
        skeletons.set(sourceSkin.skeleton, clonedSkin.skeleton)
      } else {
        clonedSkin.skeleton = shared
      }
    }

    const sourceMesh = sourceNode as Mesh
    if (sourceMesh.isMesh) {
      const clonedMesh = clonedNode as Mesh
      // Morph synthesis and retargeting mutate geometry for each mesh.
      clonedMesh.geometry = sourceMesh.geometry.clone()
      clonedMesh.material = Array.isArray(sourceMesh.material)
        ? sourceMesh.material.map(cloneMaterial)
        : cloneMaterial(sourceMesh.material as Material)
    }

    for (let index = 0; index < sourceNode.children.length; index += 1) {
      visit(sourceNode.children[index]!, clonedNode.children[index]!)
    }
  }

  /** Reuses one private material when source meshes share it. */
  function cloneMaterial(sourceMaterial: Material): Material {
    let material = materials.get(sourceMaterial)
    if (material === undefined) {
      material = sourceMaterial.clone()
      materials.set(sourceMaterial, material)
    }
    return material
  }

  visit(source, scene)
  return scene
}
