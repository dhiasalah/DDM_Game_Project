import {
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  Color3,
  Axis,
} from "@babylonjs/core";
import type { Scene, ShadowGenerator, Mesh } from "@babylonjs/core";
import type { BuildingData, PoliceResult } from "./types";

export function createPolice(
  scene: Scene,
  shadowGenerator: ShadowGenerator,
  carRoot: Mesh,
  buildingData: BuildingData[],
): PoliceResult {
  // ============ WANTED SYSTEM ============
  let wantedHeat = 0; // Accumulates from ped hits / destruction
  let wantedLevel = 0; // 0-5 stars
  const maxPoliceCars = 5;
  let heatDecayCooldown = 0; // Seconds remaining before heat can start decaying
  const HEAT_DECAY_COOLDOWN = 12; // Seconds after last crime before heat decays
  const HEAT_DECAY_RATE = 0.08; // Heat lost per second (slow)
  const MIN_CHASE_TIME = 20; // Minimum seconds a police car stays active

  interface PoliceUnit {
    root: Mesh;
    sirenPhase: number;
    sirenLeft: Mesh;
    sirenRight: Mesh;
    speed: number;
    active: boolean;
    steerAngle: number;
    activeTimer: number;
  }

  const policeUnits: PoliceUnit[] = [];

  // ============ MATERIALS ============
  const policeBodyMat = new StandardMaterial("policeBodyMat", scene);
  policeBodyMat.diffuseColor = new Color3(0.1, 0.1, 0.15);
  policeBodyMat.specularColor = new Color3(0.4, 0.4, 0.5);
  policeBodyMat.freeze();

  const policeCabinMat = new StandardMaterial("policeCabinMat", scene);
  policeCabinMat.diffuseColor = new Color3(0.15, 0.2, 0.35);
  policeCabinMat.alpha = 0.6;
  policeCabinMat.freeze();

  const policeStripeMat = new StandardMaterial("policeStripeMat", scene);
  policeStripeMat.diffuseColor = new Color3(1, 1, 1);
  policeStripeMat.freeze();

  const sirenRedMat = new StandardMaterial("sirenRedMat", scene);
  sirenRedMat.diffuseColor = new Color3(1, 0.1, 0.1);
  sirenRedMat.emissiveColor = new Color3(1, 0.05, 0.05);

  const sirenBlueMat = new StandardMaterial("sirenBlueMat", scene);
  sirenBlueMat.diffuseColor = new Color3(0.1, 0.2, 1);
  sirenBlueMat.emissiveColor = new Color3(0.05, 0.1, 1);

  const sirenOffMat = new StandardMaterial("sirenOffMat", scene);
  sirenOffMat.diffuseColor = new Color3(0.2, 0.2, 0.2);

  // ============ BUILD POLICE CAR ============
  function buildPoliceCar(index: number): PoliceUnit {
    const body = MeshBuilder.CreateBox(
      "policeBody_" + index,
      { width: 2.0, height: 0.5, depth: 4.2 },
      scene,
    );
    body.position.set(-100 - index * 20, 0.55, -100);
    body.material = policeBodyMat;
    body.isVisible = true;

    // Cabin
    const cabin = MeshBuilder.CreateBox(
      "policeCabin_" + index,
      { width: 1.6, height: 0.5, depth: 1.8 },
      scene,
    );
    cabin.position.set(0, 0.5, -0.1);
    cabin.parent = body;
    cabin.material = policeCabinMat;

    // White stripe
    const stripe = MeshBuilder.CreateBox(
      "policeStripe_" + index,
      { width: 2.05, height: 0.1, depth: 1.0 },
      scene,
    );
    stripe.position.set(0, 0.25, 0.8);
    stripe.parent = body;
    stripe.material = policeStripeMat;

    // Siren lights on top
    const sirenLeft = MeshBuilder.CreateBox(
      "sirenL_" + index,
      { width: 0.3, height: 0.2, depth: 0.3 },
      scene,
    );
    sirenLeft.position.set(-0.35, 0.8, 0);
    sirenLeft.parent = body;
    sirenLeft.material = sirenOffMat;

    const sirenRight = MeshBuilder.CreateBox(
      "sirenR_" + index,
      { width: 0.3, height: 0.2, depth: 0.3 },
      scene,
    );
    sirenRight.position.set(0.35, 0.8, 0);
    sirenRight.parent = body;
    sirenRight.material = sirenOffMat;

    // Simple wheels
    const wheelMat = new StandardMaterial("policeWheelMat_" + index, scene);
    wheelMat.diffuseColor = new Color3(0.1, 0.1, 0.1);
    wheelMat.freeze();

    const wheelPositions = [
      { x: -0.95, z: 1.3 },
      { x: 0.95, z: 1.3 },
      { x: -0.95, z: -1.3 },
      { x: 0.95, z: -1.3 },
    ];

    wheelPositions.forEach((wp, wi) => {
      const wheel = MeshBuilder.CreateTorus(
        "pWheel_" + index + "_" + wi,
        { diameter: 0.55, thickness: 0.18, tessellation: 12 },
        scene,
      );
      wheel.position.set(wp.x, -0.2, wp.z);
      wheel.rotation.z = Math.PI / 2;
      wheel.parent = body;
      wheel.material = wheelMat;
    });

    shadowGenerator.addShadowCaster(body);

    body.setEnabled(false); // Start inactive

    return {
      root: body,
      sirenPhase: 0,
      sirenLeft,
      sirenRight,
      speed: 0,
      active: false,
      steerAngle: 0,
      activeTimer: 0,
    };
  }

  // Pre-create police cars
  for (let i = 0; i < maxPoliceCars; i++) {
    policeUnits.push(buildPoliceCar(i));
  }

  // ============ SPAWN LOGIC ============
  function spawnPoliceCar(unit: PoliceUnit): void {
    // Spawn far from player, on a road
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 70;
    let spawnX = carRoot.position.x + Math.cos(angle) * dist;
    let spawnZ = carRoot.position.z + Math.sin(angle) * dist;

    // Clamp to world
    spawnX = Math.max(-380, Math.min(380, spawnX));
    spawnZ = Math.max(-380, Math.min(380, spawnZ));

    unit.root.position.set(spawnX, 0.55, spawnZ);
    unit.root.rotation.y = Math.atan2(
      carRoot.position.x - spawnX,
      carRoot.position.z - spawnZ,
    );
    unit.speed = 0;
    unit.active = true;
    unit.activeTimer = 0;
    unit.root.setEnabled(true);
  }

  // ============ BUILDING AVOIDANCE ============
  function checkPoliceBuilding(
    px: number,
    pz: number,
    halfW: number,
    halfD: number,
  ): { pushX: number; pushZ: number } {
    let pushX = 0;
    let pushZ = 0;
    for (let i = 0; i < buildingData.length; i++) {
      const b = buildingData[i];
      const bMinX = b.x - b.w / 2;
      const bMaxX = b.x + b.w / 2;
      const bMinZ = b.z - b.d / 2;
      const bMaxZ = b.z + b.d / 2;

      const overlapX =
        Math.min(px + halfW, bMaxX) - Math.max(px - halfW, bMinX);
      const overlapZ =
        Math.min(pz + halfD, bMaxZ) - Math.max(pz - halfD, bMinZ);

      if (overlapX > 0 && overlapZ > 0) {
        if (overlapX < overlapZ) {
          pushX += px < b.x ? -overlapX : overlapX;
        } else {
          pushZ += pz < b.z ? -overlapZ : overlapZ;
        }
      }
    }
    return { pushX, pushZ };
  }

  // ============ UPDATE ============
  function updatePolice(dt: number): void {
    // Calculate wanted level from heat (lower thresholds so hits matter)
    const prevLevel = wantedLevel;
    if (wantedHeat >= 12) wantedLevel = 5;
    else if (wantedHeat >= 8) wantedLevel = 4;
    else if (wantedHeat >= 5) wantedLevel = 3;
    else if (wantedHeat >= 2.5) wantedLevel = 2;
    else if (wantedHeat >= 0.5) wantedLevel = 1;
    else wantedLevel = 0;

    // Decay cooldown — heat only decays once the cooldown expires
    if (heatDecayCooldown > 0) {
      heatDecayCooldown -= dt;
    } else if (wantedHeat > 0) {
      wantedHeat -= HEAT_DECAY_RATE * dt;
      if (wantedHeat < 0) wantedHeat = 0;
    }

    // Spawn/despawn police based on wanted level
    const targetCount = Math.min(wantedLevel, maxPoliceCars);
    let activeCount = policeUnits.filter((u) => u.active).length;

    // Spawn new units if needed
    if (activeCount < targetCount) {
      for (const unit of policeUnits) {
        if (!unit.active && activeCount < targetCount) {
          spawnPoliceCar(unit);
          activeCount++;
        }
      }
    }

    // Despawn excess units — only if they've been active long enough
    if (activeCount > targetCount) {
      for (let i = policeUnits.length - 1; i >= 0; i--) {
        const u = policeUnits[i];
        if (
          u.active &&
          activeCount > targetCount &&
          u.activeTimer >= MIN_CHASE_TIME
        ) {
          // Also only despawn if far from player (>100 units away)
          const dx = u.root.position.x - carRoot.position.x;
          const dz = u.root.position.z - carRoot.position.z;
          const distSq = dx * dx + dz * dz;
          if (distSq > 10000) {
            // 100^2
            u.active = false;
            u.root.setEnabled(false);
            activeCount--;
          }
        }
      }
    }

    // Update active police cars
    policeUnits.forEach((unit) => {
      if (!unit.active) return;

      // Track how long this unit has been active
      unit.activeTimer += dt;

      // Chase AI — steer toward player
      const toPlayerX = carRoot.position.x - unit.root.position.x;
      const toPlayerZ = carRoot.position.z - unit.root.position.z;
      const distSq = toPlayerX * toPlayerX + toPlayerZ * toPlayerZ;
      const dist = Math.sqrt(distSq);

      // Target angle to player
      const targetAngle = Math.atan2(toPlayerX, toPlayerZ);
      let angleDiff = targetAngle - unit.root.rotation.y;

      // Normalize angle diff
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // Steer toward player
      const steerRate = 2.0 + wantedLevel * 0.3;
      unit.root.rotation.y += angleDiff * steerRate * dt;

      // Speed control — chase with increasing aggression
      const maxChaseSpeed = 15 + wantedLevel * 5;
      const targetSpeed = dist > 5 ? maxChaseSpeed : 0;

      if (unit.speed < targetSpeed) {
        unit.speed += 12 * dt;
        if (unit.speed > targetSpeed) unit.speed = targetSpeed;
      } else {
        unit.speed -= 20 * dt;
        if (unit.speed < 0) unit.speed = 0;
      }

      // Move forward
      const forward = unit.root.getDirection(Axis.Z);
      unit.root.position.addInPlace(forward.scale(unit.speed * dt));
      unit.root.position.y = 0.55;

      // Building collision
      const push = checkPoliceBuilding(
        unit.root.position.x,
        unit.root.position.z,
        1.0,
        2.1,
      );
      unit.root.position.x += push.pushX;
      unit.root.position.z += push.pushZ;
      if (push.pushX !== 0 || push.pushZ !== 0) {
        unit.speed *= 0.5;
      }

      // World boundary
      const lim = 390;
      unit.root.position.x = Math.max(
        -lim,
        Math.min(lim, unit.root.position.x),
      );
      unit.root.position.z = Math.max(
        -lim,
        Math.min(lim, unit.root.position.z),
      );

      // Siren animation
      unit.sirenPhase += dt * 8;
      const sirenOn = Math.sin(unit.sirenPhase) > 0;
      unit.sirenLeft.material = sirenOn ? sirenRedMat : sirenOffMat;
      unit.sirenRight.material = sirenOn ? sirenOffMat : sirenBlueMat;
    });
  }

  function getWantedLevel(): number {
    return wantedLevel;
  }

  function addWantedHeat(amount: number): void {
    wantedHeat += amount;
    heatDecayCooldown = HEAT_DECAY_COOLDOWN; // Reset decay cooldown on every crime
  }

  function getPoliceUnits() {
    return policeUnits.map((u) => ({
      root: u.root,
      speed: u.speed,
      active: u.active,
    }));
  }

  function setPoliceSpeed(index: number, speed: number): void {
    if (index >= 0 && index < policeUnits.length) {
      policeUnits[index].speed = speed;
    }
  }

  return {
    updatePolice,
    getWantedLevel,
    addWantedHeat,
    getPoliceUnits,
    setPoliceSpeed,
  };
}
