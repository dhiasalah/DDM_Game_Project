import {
  Vector3,
  Ray,
  MeshBuilder,
  StandardMaterial,
  Color3,
} from "@babylonjs/core";
import type { Scene, Mesh } from "@babylonjs/core";
import type {
  WeaponsResult,
  Pedestrian,
  ShootingResult,
  PoliceResult,
  CollisionCallbacks,
} from "./types";

/* ================================================================
 *  SHOOTING SYSTEM — raycast-based gunplay, melee attacks,
 *  hit detection for pedestrians, traffic, police
 * ================================================================ */

interface ShootingConfig {
  scene: Scene;
  weapons: WeaponsResult;
  pedestrians: Pedestrian[];
  policeResult: PoliceResult;
  getPlayerPosition: () => Vector3;
  getAimDirection: () => Vector3;
  getMode: () => "driving" | "on-foot";
  callbacks: Pick<CollisionCallbacks, "triggerHitParticles">;
  onKill: () => void;
  onPedHit: (pos: Vector3) => void;
  addWantedHeat: (amount: number) => void;
}

export function createShooting(config: ShootingConfig): ShootingResult {
  const {
    scene,
    weapons,
    pedestrians,
    policeResult,
    getPlayerPosition,
    getAimDirection,
    getMode,
    callbacks,
    onKill,
    onPedHit,
    addWantedHeat,
  } = config;

  let aiming = false;

  // Muzzle flash mesh (tiny sphere that flashes briefly)
  const flashMat = new StandardMaterial("muzzleFlashMat", scene);
  flashMat.emissiveColor = new Color3(1, 0.9, 0.3);
  flashMat.disableLighting = true;
  flashMat.freeze();

  const flashMesh = MeshBuilder.CreateSphere(
    "muzzleFlash",
    { diameter: 0.3, segments: 4 },
    scene,
  );
  flashMesh.material = flashMat;
  flashMesh.isVisible = false;
  flashMesh.isPickable = false;

  let flashTimer = 0;

  // Impact marker pool
  const impactMat = new StandardMaterial("impactMat", scene);
  impactMat.emissiveColor = new Color3(1, 0.5, 0);
  impactMat.disableLighting = true;
  impactMat.freeze();

  const impactPool: { mesh: Mesh; timer: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const m = MeshBuilder.CreateSphere(
      "impact_" + i,
      { diameter: 0.15, segments: 4 },
      scene,
    );
    m.material = impactMat;
    m.isVisible = false;
    m.isPickable = false;
    impactPool.push({ mesh: m, timer: 0 });
  }
  let impactIdx = 0;

  function showImpact(pos: Vector3): void {
    const imp = impactPool[impactIdx % impactPool.length];
    imp.mesh.position.copyFrom(pos);
    imp.mesh.isVisible = true;
    imp.timer = 0.15;
    impactIdx++;
  }

  function fireRanged(): void {
    const wState = weapons.getCurrentWeapon();
    const wData = weapons.getWeaponData(wState.weaponType);

    const origin = getPlayerPosition();
    const baseDir = getAimDirection();

    // Shotgun fires multiple pellets
    const pelletCount = wState.weaponType === "shotgun" ? 6 : 1;

    for (let p = 0; p < pelletCount; p++) {
      // Add spread
      const spread = wData.spread;
      const dir = new Vector3(
        baseDir.x + (Math.random() - 0.5) * spread * 2,
        baseDir.y + (Math.random() - 0.5) * spread,
        baseDir.z + (Math.random() - 0.5) * spread * 2,
      ).normalize();

      const ray = new Ray(origin.add(new Vector3(0, 1.2, 0)), dir, wData.range);

      // Check against pedestrians
      let hitSomething = false;
      for (let i = 0; i < pedestrians.length; i++) {
        const ped = pedestrians[i];
        if (!ped.alive || ped.flying) continue;

        const pedPos = ped.mesh.root.position;
        const toPed = pedPos.subtract(origin);
        const dot = Vector3.Dot(toPed, dir);
        if (dot < 0 || dot > wData.range) continue;

        // Point-to-ray distance
        const proj = dir.scale(dot);
        const closest = origin.add(proj);
        const dist = Vector3.Distance(closest, pedPos);

        if (dist < 1.0) {
          // Hit pedestrian
          ped.alive = false;
          ped.flying = true;
          ped.flyTime = 0;
          ped.flyVelocity = dir.scale(3).add(new Vector3(0, 4, 0));

          callbacks.triggerHitParticles(pedPos.clone());
          onPedHit(pedPos.clone());
          onKill();
          addWantedHeat(1.5);
          hitSomething = true;
          break;
        }
      }

      if (!hitSomething) {
        // Check against police
        const policeUnits = policeResult.getPoliceUnits();
        for (let i = 0; i < policeUnits.length; i++) {
          const pu = policeUnits[i];
          if (!pu.active) continue;

          const puPos = pu.root.position;
          const toPu = puPos.subtract(origin);
          const dot = Vector3.Dot(toPu, dir);
          if (dot < 0 || dot > wData.range) continue;

          const proj = dir.scale(dot);
          const closest = origin.add(proj);
          const dist = Vector3.Distance(closest, puPos);

          if (dist < 2.0) {
            showImpact(closest);
            addWantedHeat(3.0);
            hitSomething = true;
            break;
          }
        }
      }

      // Show impact at max range if nothing hit
      if (!hitSomething) {
        showImpact(origin.add(dir.scale(Math.min(wData.range, 40))));
      }
    }

    // Muzzle flash
    flashMesh.position
      .copyFrom(origin)
      .addInPlace(new Vector3(0, 1.2, 0))
      .addInPlace(baseDir.scale(1.5));
    flashMesh.isVisible = true;
    flashTimer = 0.05;

    // Ranged weapons add wanted
    addWantedHeat(0.5);
  }

  function fireMelee(): void {
    const wState = weapons.getCurrentWeapon();
    const wData = weapons.getWeaponData(wState.weaponType);
    const origin = getPlayerPosition();
    const dir = getAimDirection();

    // Check pedestrians in melee range
    for (let i = 0; i < pedestrians.length; i++) {
      const ped = pedestrians[i];
      if (!ped.alive || ped.flying) continue;

      const pedPos = ped.mesh.root.position;
      const dx = pedPos.x - origin.x;
      const dz = pedPos.z - origin.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < wData.range) {
        // Check if roughly in front (180-degree arc)
        const dot = dx * dir.x + dz * dir.z;
        if (dot > 0 || dist < 1.0) {
          ped.alive = false;
          ped.flying = true;
          ped.flyTime = 0;
          ped.flyVelocity = new Vector3(
            dir.x * 4 + (Math.random() - 0.5) * 2,
            3 + Math.random() * 2,
            dir.z * 4 + (Math.random() - 0.5) * 2,
          );

          callbacks.triggerHitParticles(pedPos.clone());
          onPedHit(pedPos.clone());
          onKill();
          addWantedHeat(1.0);
          break; // One hit per swing
        }
      }
    }
  }

  function updateShooting(dt: number): void {
    // Update flash timer
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) {
        flashMesh.isVisible = false;
      }
    }

    // Update impact markers
    for (const imp of impactPool) {
      if (imp.timer > 0) {
        imp.timer -= dt;
        if (imp.timer <= 0) {
          imp.mesh.isVisible = false;
        }
      }
    }

    // Don't auto-fire — main.ts handles input and calls tryFire
    // Check for mouse input (left click to fire) is handled in main.ts
    const mode = getMode();
    if (mode !== "on-foot" && !aiming) return;

    // weapons.update is called from main separately
  }

  function isAiming(): boolean {
    return aiming;
  }

  function setAiming(aim: boolean): void {
    aiming = aim;
  }

  return {
    updateShooting,
    isAiming,
    setAiming,
    fireRanged,
    fireMelee,
  };
}
