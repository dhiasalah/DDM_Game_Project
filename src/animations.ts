import type { AbstractMesh, AnimationGroup, Node } from "@babylonjs/core";

export interface CharacterAnimationSet {
  idle?: AnimationGroup;
  walk?: AnimationGroup;
  run?: AnimationGroup;
  attack?: AnimationGroup;
  jump?: AnimationGroup;
  deathOrHit?: AnimationGroup;
}

export interface CharacterAnimationController {
  groups: AnimationGroup[];
  clips: CharacterAnimationSet;
  currentLoop: AnimationGroup | null;
}

function collectNodeIds(root: Node): Set<number> {
  const ids = new Set<number>();
  ids.add(root.uniqueId);
  const children = root.getDescendants(false);
  for (const child of children) {
    ids.add(child.uniqueId);
  }
  return ids;
}

export function extractAnimationGroupsForRoot(
  root: Node,
  meshes: AbstractMesh[],
): AnimationGroup[] {
  const scene = root.getScene();
  const nodeIds = collectNodeIds(root);

  const meshNodeIds = new Set<number>();
  for (const mesh of meshes) {
    meshNodeIds.add(mesh.uniqueId);
  }

  return scene.animationGroups.filter((group) => {
    for (const targeted of group.targetedAnimations) {
      const target = targeted.target as Node | null;
      if (!target) continue;
      if (nodeIds.has(target.uniqueId) || meshNodeIds.has(target.uniqueId)) {
        return true;
      }
    }
    return false;
  });
}

function nameMatches(group: AnimationGroup, aliases: string[]): boolean {
  const n = group.name.toLowerCase();
  return aliases.some((alias) => n.includes(alias));
}

function pickClip(
  groups: AnimationGroup[],
  aliases: string[],
): AnimationGroup | undefined {
  return groups.find((group) => nameMatches(group, aliases));
}

export function createCharacterAnimationController(
  groups: AnimationGroup[],
): CharacterAnimationController {
  const clips: CharacterAnimationSet = {
    idle: pickClip(groups, ["idle", "breath", "stand"]),
    walk: pickClip(groups, ["walk", "jog", "locomotion"]),
    run: pickClip(groups, ["run", "sprint"]),
    attack: pickClip(groups, ["attack", "punch", "melee", "hit"]),
    jump: pickClip(groups, ["jump", "hop"]),
    deathOrHit: pickClip(groups, ["death", "die", "hitreact", "hit"]),
  };

  // Fallback: if we have any animations but they don't match our expected names,
  // use the first one for everything (handles Mixamo combined animations)
  const hasAnyUnmatchedAnimation =
    groups.length > 0 && Object.values(clips).every((clip) => !clip);

  if (hasAnyUnmatchedAnimation) {
    const fallbackClip = groups[0];
    clips.idle = fallbackClip;
    clips.walk = fallbackClip;
    clips.run = fallbackClip;
    clips.attack = fallbackClip;
    clips.jump = fallbackClip;
    clips.deathOrHit = fallbackClip;
  } else {
    // Standard fallback chain
    if (!clips.idle && groups.length > 0) {
      clips.idle = groups[0];
    }
    if (!clips.walk && clips.idle) {
      clips.walk = clips.idle;
    }
    if (!clips.run && clips.walk) {
      clips.run = clips.walk;
    }
  }

  return {
    groups,
    clips,
    currentLoop: null,
  };
}

function stopOthers(
  controller: CharacterAnimationController,
  keep?: AnimationGroup,
): void {
  for (const group of controller.groups) {
    if (keep && group === keep) continue;
    if (group.isPlaying) {
      group.stop();
    }
  }
}

export function playLoop(
  controller: CharacterAnimationController,
  group: AnimationGroup | undefined,
  speedRatio = 1,
): void {
  if (!group) return;

  if (controller.currentLoop !== group) {
    stopOthers(controller, group);
    controller.currentLoop = group;
    group.start(true, speedRatio);
    return;
  }

  group.speedRatio = speedRatio;
  if (!group.isPlaying) {
    group.start(true, speedRatio);
  }
}

export function playOneShot(
  controller: CharacterAnimationController,
  group: AnimationGroup | undefined,
  speedRatio = 1,
): void {
  if (!group) {
    return;
  }

  stopOthers(controller);
  controller.currentLoop = null;
  group.start(false, speedRatio);
}
