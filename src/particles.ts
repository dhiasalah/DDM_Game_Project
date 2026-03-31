import {
  ParticleSystem,
  Texture,
  MeshBuilder,
  Vector3,
  Color4,
} from "@babylonjs/core";
import type { Scene, Mesh, AbstractMesh } from "@babylonjs/core";
import type { Keys, ParticlesResult } from "./types";

export function setupParticles(scene: Scene, carRoot: Mesh): ParticlesResult {
  // ============ EXHAUST SMOKE ============
  function createExhaustSystem(
    scene: Scene,
    parent: Mesh,
    xOffset: number,
    name: string,
  ): ParticleSystem {
    const exhaust = new ParticleSystem(name, 75, scene);
    exhaust.particleTexture = new Texture("/textures/flare.png", scene);

    const emitter = MeshBuilder.CreateBox(
      name + "_emitter",
      { size: 0.001 },
      scene,
    );
    emitter.isVisible = false;
    emitter.position.set(xOffset, -0.1, -2.4);
    emitter.parent = parent;
    exhaust.emitter = emitter;

    exhaust.minEmitBox = new Vector3(-0.05, -0.05, -0.1);
    exhaust.maxEmitBox = new Vector3(0.05, 0.05, 0.0);

    exhaust.color1 = new Color4(0.5, 0.5, 0.55, 0.4);
    exhaust.color2 = new Color4(0.35, 0.35, 0.4, 0.2);
    exhaust.colorDead = new Color4(0.2, 0.2, 0.2, 0.0);

    exhaust.minSize = 0.08;
    exhaust.maxSize = 0.25;
    exhaust.minLifeTime = 0.2;
    exhaust.maxLifeTime = 0.8;

    exhaust.emitRate = 0;
    exhaust.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    exhaust.direction1 = new Vector3(-0.15, 0.15, -0.8);
    exhaust.direction2 = new Vector3(0.15, 0.3, -1.2);
    exhaust.minEmitPower = 0.5;
    exhaust.maxEmitPower = 1.5;

    exhaust.gravity = new Vector3(0, 0.3, 0);
    exhaust.updateSpeed = 0.02;

    exhaust.addSizeGradient(0, 0.1);
    exhaust.addSizeGradient(0.5, 0.2);
    exhaust.addSizeGradient(1.0, 0.4);

    exhaust.start();
    return exhaust;
  }

  const exhaustL = createExhaustSystem(scene, carRoot, -0.4, "exhaustL");
  const exhaustR = createExhaustSystem(scene, carRoot, 0.4, "exhaustR");

  // ============ TIRE DUST ============
  const dustSystems: ParticleSystem[] = [];
  const wheelOffsets = [
    { x: -1.1, z: -1.4, name: "dustRL" },
    { x: 1.1, z: -1.4, name: "dustRR" },
  ];

  wheelOffsets.forEach((w) => {
    const dust = new ParticleSystem(w.name, 50, scene);
    dust.particleTexture = new Texture("/textures/flare.png", scene);

    const emitter = MeshBuilder.CreateBox(
      w.name + "_emitter",
      { size: 0.001 },
      scene,
    );
    emitter.isVisible = false;
    emitter.position.set(w.x, -0.3, w.z);
    emitter.parent = carRoot;
    dust.emitter = emitter;

    dust.minEmitBox = new Vector3(-0.15, 0, -0.15);
    dust.maxEmitBox = new Vector3(0.15, 0, 0.15);

    dust.color1 = new Color4(0.6, 0.5, 0.35, 0.3);
    dust.color2 = new Color4(0.5, 0.4, 0.3, 0.15);
    dust.colorDead = new Color4(0.3, 0.25, 0.2, 0.0);

    dust.minSize = 0.15;
    dust.maxSize = 0.5;
    dust.minLifeTime = 0.3;
    dust.maxLifeTime = 1.0;

    dust.emitRate = 0;
    dust.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    dust.direction1 = new Vector3(-0.5, 0.3, -0.5);
    dust.direction2 = new Vector3(0.5, 0.8, 0.5);
    dust.minEmitPower = 0.3;
    dust.maxEmitPower = 1.0;

    dust.gravity = new Vector3(0, -0.5, 0);
    dust.updateSpeed = 0.02;

    dust.start();
    dustSystems.push(dust);
  });

  // ============ UPDATE FUNCTION ============
  function updateParticles(keys: Keys, speed: number): void {
    const isAccelerating = keys["w"] || keys["arrowup"];
    const targetExhaustRate = isAccelerating ? 30 : speed > 2 ? 8 : 3;
    exhaustL.emitRate = targetExhaustRate;
    exhaustR.emitRate = targetExhaustRate;

    const sizeScale = Math.min(speed / 50, 1.0);
    exhaustL.maxSize = 0.15 + sizeScale * 0.25;
    exhaustR.maxSize = 0.15 + sizeScale * 0.25;

    const isTurning =
      keys["a"] || keys["arrowleft"] || keys["d"] || keys["arrowright"];
    const isBraking = keys[" "];
    const dustRate =
      isTurning && speed > 5 ? 40 : isBraking && speed > 3 ? 60 : 0;
    dustSystems.forEach((d) => {
      d.emitRate = dustRate;
    });
  }

  // ============ COLLISION SPARKS ============
  const collisionSparks = new ParticleSystem("collisionSparks", 100, scene);
  collisionSparks.particleTexture = new Texture("/textures/flare.png", scene);

  const sparkEmitter = MeshBuilder.CreateBox(
    "sparkEmitter",
    { size: 0.001 },
    scene,
  );
  sparkEmitter.isVisible = false;
  collisionSparks.emitter = sparkEmitter;

  collisionSparks.minEmitBox = new Vector3(-0.3, -0.3, -0.3);
  collisionSparks.maxEmitBox = new Vector3(0.3, 0.3, 0.3);

  collisionSparks.color1 = new Color4(1.0, 0.8, 0.2, 1.0);
  collisionSparks.color2 = new Color4(1.0, 0.4, 0.1, 0.8);
  collisionSparks.colorDead = new Color4(0.4, 0.1, 0.0, 0.0);

  collisionSparks.minSize = 0.05;
  collisionSparks.maxSize = 0.15;
  collisionSparks.minLifeTime = 0.2;
  collisionSparks.maxLifeTime = 0.6;

  collisionSparks.emitRate = 0;
  collisionSparks.blendMode = ParticleSystem.BLENDMODE_ADD;

  collisionSparks.direction1 = new Vector3(-4, 2, -4);
  collisionSparks.direction2 = new Vector3(4, 6, 4);
  collisionSparks.minEmitPower = 4;
  collisionSparks.maxEmitPower = 10;

  collisionSparks.gravity = new Vector3(0, -9.81, 0);
  collisionSparks.updateSpeed = 0.01;
  collisionSparks.start();

  function triggerCollisionSparks(position: Vector3): void {
    sparkEmitter.position.copyFrom(position);
    collisionSparks.emitRate = 150;
    collisionSparks.manualEmitCount = 30;
    setTimeout(() => {
      collisionSparks.emitRate = 0;
    }, 150);
  }

  // ============ PEDESTRIAN HIT PARTICLES ============
  const hitBurst = new ParticleSystem("hitBurst", 75, scene);
  hitBurst.particleTexture = new Texture("/textures/flare.png", scene);

  const hitEmitter = MeshBuilder.CreateBox(
    "hitEmitter",
    { size: 0.001 },
    scene,
  );
  hitEmitter.isVisible = false;
  hitBurst.emitter = hitEmitter;

  hitBurst.minEmitBox = new Vector3(-0.2, -0.2, -0.2);
  hitBurst.maxEmitBox = new Vector3(0.2, 0.2, 0.2);

  hitBurst.color1 = new Color4(0.9, 0.15, 0.1, 1.0);
  hitBurst.color2 = new Color4(1.0, 0.3, 0.1, 0.7);
  hitBurst.colorDead = new Color4(0.3, 0.05, 0.0, 0.0);

  hitBurst.minSize = 0.08;
  hitBurst.maxSize = 0.25;
  hitBurst.minLifeTime = 0.3;
  hitBurst.maxLifeTime = 1.0;

  hitBurst.emitRate = 0;
  hitBurst.blendMode = ParticleSystem.BLENDMODE_ADD;

  hitBurst.direction1 = new Vector3(-3, 3, -3);
  hitBurst.direction2 = new Vector3(3, 8, 3);
  hitBurst.minEmitPower = 3;
  hitBurst.maxEmitPower = 8;

  hitBurst.gravity = new Vector3(0, -6, 0);
  hitBurst.updateSpeed = 0.01;
  hitBurst.start();

  function triggerHitParticles(position: Vector3): void {
    hitEmitter.position.copyFrom(position);
    hitBurst.emitRate = 120;
    hitBurst.manualEmitCount = 25;
    setTimeout(() => {
      hitBurst.emitRate = 0;
    }, 200);
  }

  return { updateParticles, triggerCollisionSparks, triggerHitParticles };
}
