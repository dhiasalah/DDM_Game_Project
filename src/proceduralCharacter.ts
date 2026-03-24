import {
  MeshBuilder,
  TransformNode,
  StandardMaterial,
  Color3,
  Animation,
  AnimationGroup,
  Vector3,
  Mesh,
} from "@babylonjs/core";
import type { Scene, ShadowGenerator } from "@babylonjs/core";
import type { CharacterAnimationController } from "./animations";
import { createCharacterAnimationController } from "./animations";

interface ProceduralCharacterResult {
  root: TransformNode;
  animController: CharacterAnimationController;
}

interface CharacterColors {
  skin: Color3;
  shirt: Color3;
  pants: Color3;
  shoes: Color3;
}

const DEFAULT_COLORS: CharacterColors = {
  skin: new Color3(0.9, 0.75, 0.6),
  shirt: new Color3(0.2, 0.4, 0.8),
  pants: new Color3(0.15, 0.15, 0.2),
  shoes: new Color3(0.1, 0.1, 0.1),
};

// ===== MATERIAL CACHE - Reuse materials with same colors =====
interface MaterialCache {
  skin: Map<string, StandardMaterial>;
  shirt: Map<string, StandardMaterial>;
  pants: Map<string, StandardMaterial>;
  shoes: Map<string, StandardMaterial>;
}

let materialCache: MaterialCache | null = null;

function getColorKey(color: Color3): string {
  // Round to reduce unique combinations (0.1 precision)
  const r = Math.round(color.r * 10) / 10;
  const g = Math.round(color.g * 10) / 10;
  const b = Math.round(color.b * 10) / 10;
  return `${r}_${g}_${b}`;
}

function getOrCreateMaterial(
  scene: Scene,
  cache: Map<string, StandardMaterial>,
  namePrefix: string,
  color: Color3,
  specular: Color3,
): StandardMaterial {
  const key = getColorKey(color);
  let mat = cache.get(key);
  if (!mat) {
    mat = new StandardMaterial(`${namePrefix}_${key}`, scene);
    mat.diffuseColor = color;
    mat.specularColor = specular;
    mat.freeze();
    cache.set(key, mat);
  }
  return mat;
}

function initMaterialCache(): MaterialCache {
  return {
    skin: new Map(),
    shirt: new Map(),
    pants: new Map(),
    shoes: new Map(),
  };
}

// Generate random pedestrian colors for variety
export function randomPedestrianColors(): CharacterColors {
  const skinTones = [
    new Color3(0.95, 0.8, 0.65),
    new Color3(0.85, 0.7, 0.55),
    new Color3(0.7, 0.5, 0.35),
    new Color3(0.55, 0.4, 0.3),
    new Color3(0.4, 0.28, 0.2),
  ];

  const shirtColors = [
    new Color3(0.2, 0.4, 0.8), // Blue
    new Color3(0.8, 0.2, 0.2), // Red
    new Color3(0.2, 0.7, 0.3), // Green
    new Color3(0.9, 0.9, 0.9), // White
    new Color3(0.1, 0.1, 0.1), // Black
    new Color3(0.8, 0.6, 0.2), // Yellow/tan
    new Color3(0.6, 0.2, 0.6), // Purple
    new Color3(0.2, 0.6, 0.7), // Teal
  ];

  const pantsColors = [
    new Color3(0.15, 0.15, 0.2), // Dark blue jeans
    new Color3(0.1, 0.1, 0.1), // Black
    new Color3(0.4, 0.35, 0.3), // Khaki
    new Color3(0.2, 0.15, 0.1), // Brown
    new Color3(0.3, 0.3, 0.35), // Gray
  ];

  return {
    skin: skinTones[Math.floor(Math.random() * skinTones.length)],
    shirt: shirtColors[Math.floor(Math.random() * shirtColors.length)],
    pants: pantsColors[Math.floor(Math.random() * pantsColors.length)],
    shoes: new Color3(
      0.1 + Math.random() * 0.1,
      0.1 + Math.random() * 0.1,
      0.1 + Math.random() * 0.1,
    ),
  };
}

export function createProceduralCharacter(
  scene: Scene,
  shadowGenerator?: ShadowGenerator | null,
  colors: CharacterColors = DEFAULT_COLORS,
): ProceduralCharacterResult {
  const root = new TransformNode("proceduralCharacter", scene);

  // Initialize material cache on first use
  if (!materialCache) {
    materialCache = initMaterialCache();
  }

  // Get or create cached materials (reduces 160+ materials to ~30)
  const skinMat = getOrCreateMaterial(
    scene,
    materialCache.skin,
    "skinMat",
    colors.skin,
    new Color3(0.1, 0.1, 0.1),
  );
  const shirtMat = getOrCreateMaterial(
    scene,
    materialCache.shirt,
    "shirtMat",
    colors.shirt,
    new Color3(0.1, 0.1, 0.1),
  );
  const pantsMat = getOrCreateMaterial(
    scene,
    materialCache.pants,
    "pantsMat",
    colors.pants,
    new Color3(0.05, 0.05, 0.05),
  );
  const shoeMat = getOrCreateMaterial(
    scene,
    materialCache.shoes,
    "shoeMat",
    colors.shoes,
    new Color3(0.05, 0.05, 0.05),
  );

  // Body parts - pivots for animation
  const hipsPivot = new TransformNode("hips", scene);
  hipsPivot.parent = root;
  hipsPivot.position.y = 1.0;

  const torsoPivot = new TransformNode("torso", scene);
  torsoPivot.parent = hipsPivot;
  torsoPivot.position.y = 0.15;

  const headPivot = new TransformNode("head", scene);
  headPivot.parent = torsoPivot;
  headPivot.position.y = 0.45;

  // Limb pivots
  const leftArmPivot = new TransformNode("leftArm", scene);
  leftArmPivot.parent = torsoPivot;
  leftArmPivot.position = new Vector3(-0.22, 0.35, 0);

  const rightArmPivot = new TransformNode("rightArm", scene);
  rightArmPivot.parent = torsoPivot;
  rightArmPivot.position = new Vector3(0.22, 0.35, 0);

  const leftLegPivot = new TransformNode("leftLeg", scene);
  leftLegPivot.parent = hipsPivot;
  leftLegPivot.position = new Vector3(-0.1, 0, 0);

  const rightLegPivot = new TransformNode("rightLeg", scene);
  rightLegPivot.parent = hipsPivot;
  rightLegPivot.position = new Vector3(0.1, 0, 0);

  // Create meshes
  const torso = MeshBuilder.CreateBox(
    "torsoMesh",
    { width: 0.4, height: 0.5, depth: 0.2 },
    scene,
  );
  torso.parent = torsoPivot;
  torso.position.y = 0.15;
  torso.material = shirtMat;

  const hips = MeshBuilder.CreateBox(
    "hipsMesh",
    { width: 0.35, height: 0.15, depth: 0.18 },
    scene,
  );
  hips.parent = hipsPivot;
  hips.position.y = 0;
  hips.material = pantsMat;

  const head = MeshBuilder.CreateSphere("headMesh", { diameter: 0.25 }, scene);
  head.parent = headPivot;
  head.position.y = 0.15;
  head.material = skinMat;

  // Arms
  const leftUpperArm = MeshBuilder.CreateCapsule(
    "leftUpperArm",
    { radius: 0.05, height: 0.3 },
    scene,
  );
  leftUpperArm.parent = leftArmPivot;
  leftUpperArm.position.y = -0.15;
  leftUpperArm.material = shirtMat;

  const leftForearmPivot = new TransformNode("leftForearm", scene);
  leftForearmPivot.parent = leftArmPivot;
  leftForearmPivot.position.y = -0.3;

  const leftForearm = MeshBuilder.CreateCapsule(
    "leftForearmMesh",
    { radius: 0.04, height: 0.28 },
    scene,
  );
  leftForearm.parent = leftForearmPivot;
  leftForearm.position.y = -0.14;
  leftForearm.material = skinMat;

  const rightUpperArm = MeshBuilder.CreateCapsule(
    "rightUpperArm",
    { radius: 0.05, height: 0.3 },
    scene,
  );
  rightUpperArm.parent = rightArmPivot;
  rightUpperArm.position.y = -0.15;
  rightUpperArm.material = shirtMat;

  const rightForearmPivot = new TransformNode("rightForearm", scene);
  rightForearmPivot.parent = rightArmPivot;
  rightForearmPivot.position.y = -0.3;

  const rightForearm = MeshBuilder.CreateCapsule(
    "rightForearmMesh",
    { radius: 0.04, height: 0.28 },
    scene,
  );
  rightForearm.parent = rightForearmPivot;
  rightForearm.position.y = -0.14;
  rightForearm.material = skinMat;

  // Legs
  const leftUpperLeg = MeshBuilder.CreateCapsule(
    "leftUpperLeg",
    { radius: 0.07, height: 0.45 },
    scene,
  );
  leftUpperLeg.parent = leftLegPivot;
  leftUpperLeg.position.y = -0.22;
  leftUpperLeg.material = pantsMat;

  const leftLowerLegPivot = new TransformNode("leftLowerLeg", scene);
  leftLowerLegPivot.parent = leftLegPivot;
  leftLowerLegPivot.position.y = -0.45;

  const leftLowerLeg = MeshBuilder.CreateCapsule(
    "leftLowerLegMesh",
    { radius: 0.055, height: 0.42 },
    scene,
  );
  leftLowerLeg.parent = leftLowerLegPivot;
  leftLowerLeg.position.y = -0.21;
  leftLowerLeg.material = pantsMat;

  const leftFoot = MeshBuilder.CreateBox(
    "leftFoot",
    { width: 0.1, height: 0.08, depth: 0.2 },
    scene,
  );
  leftFoot.parent = leftLowerLegPivot;
  leftFoot.position = new Vector3(0, -0.46, 0.04);
  leftFoot.material = shoeMat;

  const rightUpperLeg = MeshBuilder.CreateCapsule(
    "rightUpperLeg",
    { radius: 0.07, height: 0.45 },
    scene,
  );
  rightUpperLeg.parent = rightLegPivot;
  rightUpperLeg.position.y = -0.22;
  rightUpperLeg.material = pantsMat;

  const rightLowerLegPivot = new TransformNode("rightLowerLeg", scene);
  rightLowerLegPivot.parent = rightLegPivot;
  rightLowerLegPivot.position.y = -0.45;

  const rightLowerLeg = MeshBuilder.CreateCapsule(
    "rightLowerLegMesh",
    { radius: 0.055, height: 0.42 },
    scene,
  );
  rightLowerLeg.parent = rightLowerLegPivot;
  rightLowerLeg.position.y = -0.21;
  rightLowerLeg.material = pantsMat;

  const rightFoot = MeshBuilder.CreateBox(
    "rightFoot",
    { width: 0.1, height: 0.08, depth: 0.2 },
    scene,
  );
  rightFoot.parent = rightLowerLegPivot;
  rightFoot.position = new Vector3(0, -0.46, 0.04);
  rightFoot.material = shoeMat;

  // Add shadow - only torso for performance (92% reduction in shadow casters)
  if (shadowGenerator) {
    shadowGenerator.addShadowCaster(torso, false);
  }

  // Create animations
  const fps = 30;

  // Idle animation - subtle breathing
  const idleGroup = new AnimationGroup("idle", scene);

  const idleTorsoAnim = new Animation(
    "idleTorso",
    "scaling.y",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  idleTorsoAnim.setKeys([
    { frame: 0, value: 1 },
    { frame: 30, value: 1.02 },
    { frame: 60, value: 1 },
  ]);
  idleGroup.addTargetedAnimation(idleTorsoAnim, torsoPivot);

  const idleArmSwayL = new Animation(
    "idleArmL",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  idleArmSwayL.setKeys([
    { frame: 0, value: 0.05 },
    { frame: 30, value: -0.05 },
    { frame: 60, value: 0.05 },
  ]);
  idleGroup.addTargetedAnimation(idleArmSwayL, leftArmPivot);

  const idleArmSwayR = new Animation(
    "idleArmR",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  idleArmSwayR.setKeys([
    { frame: 0, value: -0.05 },
    { frame: 30, value: 0.05 },
    { frame: 60, value: -0.05 },
  ]);
  idleGroup.addTargetedAnimation(idleArmSwayR, rightArmPivot);

  // Walk animation
  const walkGroup = new AnimationGroup("walk", scene);
  const walkSpeed = 40;

  const walkLegL = new Animation(
    "walkLegL",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  walkLegL.setKeys([
    { frame: 0, value: 0.5 },
    { frame: walkSpeed / 2, value: -0.5 },
    { frame: walkSpeed, value: 0.5 },
  ]);
  walkGroup.addTargetedAnimation(walkLegL, leftLegPivot);

  const walkLegR = new Animation(
    "walkLegR",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  walkLegR.setKeys([
    { frame: 0, value: -0.5 },
    { frame: walkSpeed / 2, value: 0.5 },
    { frame: walkSpeed, value: -0.5 },
  ]);
  walkGroup.addTargetedAnimation(walkLegR, rightLegPivot);

  const walkKneeL = new Animation(
    "walkKneeL",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  walkKneeL.setKeys([
    { frame: 0, value: 0 },
    { frame: walkSpeed / 4, value: 0.6 },
    { frame: walkSpeed / 2, value: 0 },
    { frame: (walkSpeed * 3) / 4, value: 0.1 },
    { frame: walkSpeed, value: 0 },
  ]);
  walkGroup.addTargetedAnimation(walkKneeL, leftLowerLegPivot);

  const walkKneeR = new Animation(
    "walkKneeR",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  walkKneeR.setKeys([
    { frame: 0, value: 0 },
    { frame: walkSpeed / 4, value: 0.1 },
    { frame: walkSpeed / 2, value: 0 },
    { frame: (walkSpeed * 3) / 4, value: 0.6 },
    { frame: walkSpeed, value: 0 },
  ]);
  walkGroup.addTargetedAnimation(walkKneeR, rightLowerLegPivot);

  const walkArmL = new Animation(
    "walkArmL",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  walkArmL.setKeys([
    { frame: 0, value: -0.4 },
    { frame: walkSpeed / 2, value: 0.4 },
    { frame: walkSpeed, value: -0.4 },
  ]);
  walkGroup.addTargetedAnimation(walkArmL, leftArmPivot);

  const walkArmR = new Animation(
    "walkArmR",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  walkArmR.setKeys([
    { frame: 0, value: 0.4 },
    { frame: walkSpeed / 2, value: -0.4 },
    { frame: walkSpeed, value: 0.4 },
  ]);
  walkGroup.addTargetedAnimation(walkArmR, rightArmPivot);

  const walkTorsoBob = new Animation(
    "walkTorsoBob",
    "position.y",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  walkTorsoBob.setKeys([
    { frame: 0, value: 1.0 },
    { frame: walkSpeed / 4, value: 1.03 },
    { frame: walkSpeed / 2, value: 1.0 },
    { frame: (walkSpeed * 3) / 4, value: 1.03 },
    { frame: walkSpeed, value: 1.0 },
  ]);
  walkGroup.addTargetedAnimation(walkTorsoBob, hipsPivot);

  // Run animation - faster leg movement
  const runGroup = new AnimationGroup("run", scene);
  const runSpeed = 24;

  const runLegL = new Animation(
    "runLegL",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  runLegL.setKeys([
    { frame: 0, value: 0.8 },
    { frame: runSpeed / 2, value: -0.8 },
    { frame: runSpeed, value: 0.8 },
  ]);
  runGroup.addTargetedAnimation(runLegL, leftLegPivot);

  const runLegR = new Animation(
    "runLegR",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  runLegR.setKeys([
    { frame: 0, value: -0.8 },
    { frame: runSpeed / 2, value: 0.8 },
    { frame: runSpeed, value: -0.8 },
  ]);
  runGroup.addTargetedAnimation(runLegR, rightLegPivot);

  const runKneeL = new Animation(
    "runKneeL",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  runKneeL.setKeys([
    { frame: 0, value: 0 },
    { frame: runSpeed / 4, value: 1.2 },
    { frame: runSpeed / 2, value: 0 },
    { frame: (runSpeed * 3) / 4, value: 0.2 },
    { frame: runSpeed, value: 0 },
  ]);
  runGroup.addTargetedAnimation(runKneeL, leftLowerLegPivot);

  const runKneeR = new Animation(
    "runKneeR",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  runKneeR.setKeys([
    { frame: 0, value: 0 },
    { frame: runSpeed / 4, value: 0.2 },
    { frame: runSpeed / 2, value: 0 },
    { frame: (runSpeed * 3) / 4, value: 1.2 },
    { frame: runSpeed, value: 0 },
  ]);
  runGroup.addTargetedAnimation(runKneeR, rightLowerLegPivot);

  const runArmL = new Animation(
    "runArmL",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  runArmL.setKeys([
    { frame: 0, value: -0.8 },
    { frame: runSpeed / 2, value: 0.8 },
    { frame: runSpeed, value: -0.8 },
  ]);
  runGroup.addTargetedAnimation(runArmL, leftArmPivot);

  const runArmR = new Animation(
    "runArmR",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  runArmR.setKeys([
    { frame: 0, value: 0.8 },
    { frame: runSpeed / 2, value: -0.8 },
    { frame: runSpeed, value: 0.8 },
  ]);
  runGroup.addTargetedAnimation(runArmR, rightArmPivot);

  const runElbowL = new Animation(
    "runElbowL",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  runElbowL.setKeys([
    { frame: 0, value: -0.8 },
    { frame: runSpeed / 2, value: -1.2 },
    { frame: runSpeed, value: -0.8 },
  ]);
  runGroup.addTargetedAnimation(runElbowL, leftForearmPivot);

  const runElbowR = new Animation(
    "runElbowR",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  runElbowR.setKeys([
    { frame: 0, value: -1.2 },
    { frame: runSpeed / 2, value: -0.8 },
    { frame: runSpeed, value: -1.2 },
  ]);
  runGroup.addTargetedAnimation(runElbowR, rightForearmPivot);

  const runTorsoBob = new Animation(
    "runTorsoBob",
    "position.y",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  runTorsoBob.setKeys([
    { frame: 0, value: 1.0 },
    { frame: runSpeed / 4, value: 1.06 },
    { frame: runSpeed / 2, value: 1.0 },
    { frame: (runSpeed * 3) / 4, value: 1.06 },
    { frame: runSpeed, value: 1.0 },
  ]);
  runGroup.addTargetedAnimation(runTorsoBob, hipsPivot);

  const runTorsoLean = new Animation(
    "runTorsoLean",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  runTorsoLean.setKeys([
    { frame: 0, value: 0.15 },
    { frame: runSpeed, value: 0.15 },
  ]);
  runGroup.addTargetedAnimation(runTorsoLean, torsoPivot);

  // Attack/Punch animation
  const attackGroup = new AnimationGroup("attack", scene);
  const attackSpeed = 12;

  const attackArmR = new Animation(
    "attackArmR",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  attackArmR.setKeys([
    { frame: 0, value: 0 },
    { frame: 3, value: -1.5 },
    { frame: attackSpeed, value: 0 },
  ]);
  attackGroup.addTargetedAnimation(attackArmR, rightArmPivot);

  const attackElbowR = new Animation(
    "attackElbowR",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  attackElbowR.setKeys([
    { frame: 0, value: 0 },
    { frame: 3, value: -0.3 },
    { frame: attackSpeed, value: 0 },
  ]);
  attackGroup.addTargetedAnimation(attackElbowR, rightForearmPivot);

  const attackTorso = new Animation(
    "attackTorso",
    "rotation.y",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  attackTorso.setKeys([
    { frame: 0, value: 0 },
    { frame: 3, value: -0.3 },
    { frame: attackSpeed, value: 0 },
  ]);
  attackGroup.addTargetedAnimation(attackTorso, torsoPivot);

  // Jump animation
  const jumpGroup = new AnimationGroup("jump", scene);
  const jumpSpeed = 18;

  const jumpHips = new Animation(
    "jumpHips",
    "position.y",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  jumpHips.setKeys([
    { frame: 0, value: 1.0 },
    { frame: 4, value: 0.85 },
    { frame: 9, value: 1.3 },
    { frame: 14, value: 1.0 },
    { frame: jumpSpeed, value: 1.0 },
  ]);
  jumpGroup.addTargetedAnimation(jumpHips, hipsPivot);

  const jumpLegsL = new Animation(
    "jumpLegsL",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  jumpLegsL.setKeys([
    { frame: 0, value: 0 },
    { frame: 4, value: 0.6 },
    { frame: 9, value: -0.2 },
    { frame: jumpSpeed, value: 0 },
  ]);
  jumpGroup.addTargetedAnimation(jumpLegsL, leftLegPivot);

  const jumpLegsR = new Animation(
    "jumpLegsR",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  jumpLegsR.setKeys([
    { frame: 0, value: 0 },
    { frame: 4, value: 0.6 },
    { frame: 9, value: -0.2 },
    { frame: jumpSpeed, value: 0 },
  ]);
  jumpGroup.addTargetedAnimation(jumpLegsR, rightLegPivot);

  const jumpArmsL = new Animation(
    "jumpArmsL",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  jumpArmsL.setKeys([
    { frame: 0, value: 0 },
    { frame: 4, value: 0.3 },
    { frame: 9, value: -0.8 },
    { frame: jumpSpeed, value: 0 },
  ]);
  jumpGroup.addTargetedAnimation(jumpArmsL, leftArmPivot);

  const jumpArmsR = new Animation(
    "jumpArmsR",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  jumpArmsR.setKeys([
    { frame: 0, value: 0 },
    { frame: 4, value: 0.3 },
    { frame: 9, value: -0.8 },
    { frame: jumpSpeed, value: 0 },
  ]);
  jumpGroup.addTargetedAnimation(jumpArmsR, rightArmPivot);

  // Death/hit react animation
  const deathGroup = new AnimationGroup("death", scene);
  const deathSpeed = 30;

  const deathHips = new Animation(
    "deathHips",
    "position.y",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  deathHips.setKeys([
    { frame: 0, value: 1.0 },
    { frame: 15, value: 0.5 },
    { frame: deathSpeed, value: 0.3 },
  ]);
  deathGroup.addTargetedAnimation(deathHips, hipsPivot);

  const deathTorso = new Animation(
    "deathTorso",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  deathTorso.setKeys([
    { frame: 0, value: 0 },
    { frame: 15, value: -0.5 },
    { frame: deathSpeed, value: -1.4 },
  ]);
  deathGroup.addTargetedAnimation(deathTorso, torsoPivot);

  const deathLegsL = new Animation(
    "deathLegsL",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  deathLegsL.setKeys([
    { frame: 0, value: 0 },
    { frame: deathSpeed, value: 0.8 },
  ]);
  deathGroup.addTargetedAnimation(deathLegsL, leftLegPivot);

  const deathLegsR = new Animation(
    "deathLegsR",
    "rotation.x",
    fps,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT,
  );
  deathLegsR.setKeys([
    { frame: 0, value: 0 },
    { frame: deathSpeed, value: 0.6 },
  ]);
  deathGroup.addTargetedAnimation(deathLegsR, rightLegPivot);

  // Create animation controller
  const animationGroups = [
    idleGroup,
    walkGroup,
    runGroup,
    attackGroup,
    jumpGroup,
    deathGroup,
  ];
  const animController = createCharacterAnimationController(animationGroups);

  return { root, animController };
}
