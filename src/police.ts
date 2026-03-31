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
  let wantedHeat = 0;
  let wantedLevel = 0;
  const maxPoliceCars = 5;
  let heatDecayCooldown = 0;
  const HEAT_DECAY_COOLDOWN = 12;
  const HEAT_DECAY_RATE = 0.08;
  const MIN_CHASE_TIME = 20;

  // ============ BUSTED SYSTEM ============
  let bustedTimer = 0;
  const BUSTED_THRESHOLD = 4.0;
  let onBusted: (() => void) | null = null;
  let bustedTriggered = false;

  // ============ ROAD GRID (for road-aware AI) ============
  // Roads are at every 50 units from -350 to 350
  const ROAD_POSITIONS: number[] = [];
  for (let v = -350; v <= 350; v += 50) {
    ROAD_POSITIONS.push(v);
  }
  const ROAD_HALF = 7;

  /** Find nearest road center position for a given coordinate */
  function nearestRoadPos(val: number): number {
    let best = ROAD_POSITIONS[0];
    let bestDist = Math.abs(val - best);
    for (let i = 1; i < ROAD_POSITIONS.length; i++) {
      const d = Math.abs(val - ROAD_POSITIONS[i]);
      if (d < bestDist) {
        bestDist = d;
        best = ROAD_POSITIONS[i];
      }
    }
    return best;
  }

  /** Check if a position is on or near a road */
  function isOnRoad(x: number, z: number): boolean {
    for (const rp of ROAD_POSITIONS) {
      if (Math.abs(x - rp) < ROAD_HALF) return true;
      if (Math.abs(z - rp) < ROAD_HALF) return true;
    }
    return false;
  }

  interface PoliceUnit {
    root: Mesh;
    sirenPhase: number;
    sirenLeft: Mesh;
    sirenRight: Mesh;
    speed: number;
    active: boolean;
    steerAngle: number;
    activeTimer: number;
    // Road-aware AI state
    currentRoadAxis: "x" | "z" | null; // which road axis we're following
    currentRoadPos: number; // the road position we're on
    lastTurnTime: number; // prevent turning too frequently
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

  const policeWheelMat = new StandardMaterial("policeWheelMat", scene);
  policeWheelMat.diffuseColor = new Color3(0.1, 0.1, 0.1);
  policeWheelMat.freeze();

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

    const cabin = MeshBuilder.CreateBox(
      "policeCabin_" + index,
      { width: 1.6, height: 0.5, depth: 1.8 },
      scene,
    );
    cabin.position.set(0, 0.5, -0.1);
    cabin.parent = body;
    cabin.material = policeCabinMat;

    const stripe = MeshBuilder.CreateBox(
      "policeStripe_" + index,
      { width: 2.05, height: 0.1, depth: 1.0 },
      scene,
    );
    stripe.position.set(0, 0.25, 0.8);
    stripe.parent = body;
    stripe.material = policeStripeMat;

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

    const wheelPositions = [
      { x: -0.95, z: 1.3 },
      { x: 0.95, z: 1.3 },
      { x: -0.95, z: -1.3 },
      { x: 0.95, z: -1.3 },
    ];

    wheelPositions.forEach((wp, wi) => {
      const wheel = MeshBuilder.CreateTorus(
        "pWheel_" + index + "_" + wi,
        { diameter: 0.55, thickness: 0.18, tessellation: 6 },
        scene,
      );
      wheel.position.set(wp.x, -0.2, wp.z);
      wheel.rotation.z = Math.PI / 2;
      wheel.parent = body;
      wheel.material = policeWheelMat;
    });

    shadowGenerator.addShadowCaster(body);
    body.setEnabled(false);

    return {
      root: body,
      sirenPhase: 0,
      sirenLeft,
      sirenRight,
      speed: 0,
      active: false,
      steerAngle: 0,
      activeTimer: 0,
      currentRoadAxis: null,
      currentRoadPos: 0,
      lastTurnTime: 0,
    };
  }

  for (let i = 0; i < maxPoliceCars; i++) {
    policeUnits.push(buildPoliceCar(i));
  }

  // ============ SMART SPAWN — spawn on roads from multiple directions ============
  function spawnPoliceCar(unit: PoliceUnit): void {
    const playerX = carRoot.position.x;
    const playerZ = carRoot.position.z;

    // Pick a random road to spawn on
    const useZRoad = Math.random() > 0.5;
    const roadIdx = Math.floor(Math.random() * ROAD_POSITIONS.length);
    const roadPos = ROAD_POSITIONS[roadIdx];

    let spawnX: number, spawnZ: number;
    const spawnDist = 80 + Math.random() * 60;
    const direction = Math.random() > 0.5 ? 1 : -1;

    if (useZRoad) {
      // Spawn on a Z-axis road (vertical)
      spawnX = roadPos + (Math.random() > 0.5 ? 3.5 : -3.5); // lane offset
      spawnZ = playerZ + direction * spawnDist;
      unit.currentRoadAxis = "z";
      unit.currentRoadPos = roadPos;
    } else {
      // Spawn on an X-axis road (horizontal)
      spawnZ = roadPos + (Math.random() > 0.5 ? 3.5 : -3.5);
      spawnX = playerX + direction * spawnDist;
      unit.currentRoadAxis = "x";
      unit.currentRoadPos = roadPos;
    }

    // Clamp to world
    spawnX = Math.max(-380, Math.min(380, spawnX));
    spawnZ = Math.max(-380, Math.min(380, spawnZ));

    unit.root.position.set(spawnX, 0.55, spawnZ);
    unit.root.rotation.y = Math.atan2(
      playerX - spawnX,
      playerZ - spawnZ,
    );
    unit.speed = 0;
    unit.active = true;
    unit.activeTimer = 0;
    unit.lastTurnTime = 0;
    unit.root.setEnabled(true);
  }

  // ============ BUILDING AVOIDANCE with distance cull ============
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
      const ddx = b.x - px;
      const ddz = b.z - pz;
      if (ddx * ddx + ddz * ddz > 2500) continue;

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
    const prevLevel = wantedLevel;
    if (wantedHeat >= 12) wantedLevel = 5;
    else if (wantedHeat >= 8) wantedLevel = 4;
    else if (wantedHeat >= 5) wantedLevel = 3;
    else if (wantedHeat >= 2.5) wantedLevel = 2;
    else if (wantedHeat >= 0.5) wantedLevel = 1;
    else wantedLevel = 0;

    if (heatDecayCooldown > 0) {
      heatDecayCooldown -= dt;
    } else if (wantedHeat > 0) {
      wantedHeat -= HEAT_DECAY_RATE * dt;
      if (wantedHeat < 0) wantedHeat = 0;
    }

    // Spawn/despawn police based on wanted level
    const targetCount = Math.min(wantedLevel, maxPoliceCars);
    let activeCount = policeUnits.filter((u) => u.active).length;

    if (activeCount < targetCount) {
      for (const unit of policeUnits) {
        if (!unit.active && activeCount < targetCount) {
          spawnPoliceCar(unit);
          activeCount++;
        }
      }
    }

    if (activeCount > targetCount) {
      for (let i = policeUnits.length - 1; i >= 0; i--) {
        const u = policeUnits[i];
        if (
          u.active &&
          activeCount > targetCount &&
          u.activeTimer >= MIN_CHASE_TIME
        ) {
          const dx = u.root.position.x - carRoot.position.x;
          const dz = u.root.position.z - carRoot.position.z;
          const distSq = dx * dx + dz * dz;
          if (distSq > 10000) {
            u.active = false;
            u.root.setEnabled(false);
            activeCount--;
          }
        }
      }
    }

    // ============ UPDATE ACTIVE POLICE CARS ============
    const playerX = carRoot.position.x;
    const playerZ = carRoot.position.z;
    // Estimate player velocity for intercept calculation
    const playerForward = carRoot.getDirection(Axis.Z);

    policeUnits.forEach((unit) => {
      if (!unit.active) return;

      unit.activeTimer += dt;
      unit.lastTurnTime += dt;

      const ux = unit.root.position.x;
      const uz = unit.root.position.z;
      const toPlayerX = playerX - ux;
      const toPlayerZ = playerZ - uz;
      const distSq = toPlayerX * toPlayerX + toPlayerZ * toPlayerZ;
      const dist = Math.sqrt(distSq);

      // ─── INTERCEPT STEERING ───
      // Instead of driving straight at the player, predict where the player
      // will be in ~2 seconds and steer toward that point
      const interceptTime = Math.min(dist / Math.max(unit.speed, 10), 3);
      const playerSpeed = 20; // rough estimate — we don't have exact speed
      const interceptX = playerX + playerForward.x * playerSpeed * interceptTime * 0.4;
      const interceptZ = playerZ + playerForward.z * playerSpeed * interceptTime * 0.4;

      // ─── ROAD-AWARE NAVIGATION ───
      // If we're on a road, follow it until we get to an intersection near
      // the intercept point, then turn toward the player
      let steerTargetX = interceptX;
      let steerTargetZ = interceptZ;

      if (unit.currentRoadAxis && unit.lastTurnTime > 2) {
        // Check if we're near an intersection where we should turn
        const nearestRoadX = nearestRoadPos(ux);
        const nearestRoadZ = nearestRoadPos(uz);

        // Are we at an intersection?
        const atIntersection =
          Math.abs(ux - nearestRoadX) < ROAD_HALF &&
          Math.abs(uz - nearestRoadZ) < ROAD_HALF;

        if (atIntersection) {
          // Should we turn? Turn if the target is closer on the perpendicular road
          if (unit.currentRoadAxis === "z") {
            // Currently going along Z, should we switch to X?
            const distAlongCurrent = Math.abs(interceptZ - uz);
            const distOnPerp = Math.abs(interceptX - ux);
            if (distOnPerp > distAlongCurrent * 0.8 && unit.lastTurnTime > 4) {
              unit.currentRoadAxis = "x";
              unit.currentRoadPos = nearestRoadZ;
              unit.lastTurnTime = 0;
            }
          } else {
            const distAlongCurrent = Math.abs(interceptX - ux);
            const distOnPerp = Math.abs(interceptZ - uz);
            if (distOnPerp > distAlongCurrent * 0.8 && unit.lastTurnTime > 4) {
              unit.currentRoadAxis = "z";
              unit.currentRoadPos = nearestRoadX;
              unit.lastTurnTime = 0;
            }
          }
        }

        // Gently steer toward road center while following it
        if (unit.currentRoadAxis === "z") {
          const roadCenterX = unit.currentRoadPos + (toPlayerX > 0 ? 3.5 : -3.5);
          steerTargetX = roadCenterX + (interceptX - roadCenterX) * 0.2;
        } else {
          const roadCenterZ = unit.currentRoadPos + (toPlayerZ > 0 ? 3.5 : -3.5);
          steerTargetZ = roadCenterZ + (interceptZ - roadCenterZ) * 0.2;
        }
      }

      // When very close to player, drop road following and steer directly
      if (dist < 30) {
        steerTargetX = playerX;
        steerTargetZ = playerZ;
        unit.currentRoadAxis = null;
      }

      // Calculate target angle
      const targetAngle = Math.atan2(
        steerTargetX - ux,
        steerTargetZ - uz,
      );
      let angleDiff = targetAngle - unit.root.rotation.y;

      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // Steer rate scales with wanted level for more aggressive pursuit
      const steerRate = 1.8 + wantedLevel * 0.4;
      unit.root.rotation.y += angleDiff * steerRate * dt;

      // Speed — scales with wanted level
      const maxChaseSpeed = 14 + wantedLevel * 5;
      const targetSpeed = dist > 5 ? maxChaseSpeed : 0;

      if (unit.speed < targetSpeed) {
        unit.speed += 10 * dt;
        if (unit.speed > targetSpeed) unit.speed = targetSpeed;
      } else {
        unit.speed -= 18 * dt;
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
        // If stuck in a building, try to find nearest road
        if (!isOnRoad(unit.root.position.x, unit.root.position.z)) {
          const nearX = nearestRoadPos(unit.root.position.x);
          const nearZ = nearestRoadPos(unit.root.position.z);
          const dxR = Math.abs(unit.root.position.x - nearX);
          const dzR = Math.abs(unit.root.position.z - nearZ);
          if (dxR < dzR) {
            unit.root.position.x += (nearX - unit.root.position.x) * 2 * dt;
            unit.currentRoadAxis = "z";
            unit.currentRoadPos = nearX;
          } else {
            unit.root.position.z += (nearZ - unit.root.position.z) * 2 * dt;
            unit.currentRoadAxis = "x";
            unit.currentRoadPos = nearZ;
          }
        }
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

    // ============ BUSTED CHECK ============
    if (wantedLevel > 0 && !bustedTriggered) {
      let nearbyCount = 0;
      for (let i = 0; i < policeUnits.length; i++) {
        const u = policeUnits[i];
        if (!u.active) continue;
        const dx = u.root.position.x - carRoot.position.x;
        const dz = u.root.position.z - carRoot.position.z;
        if (dx * dx + dz * dz < 9) nearbyCount++;
      }

      if (nearbyCount >= 2) {
        bustedTimer += dt;
        if (bustedTimer >= BUSTED_THRESHOLD) {
          bustedTriggered = true;
          if (onBusted) onBusted();
        }
      } else {
        bustedTimer = Math.max(0, bustedTimer - dt * 2);
      }
    } else {
      bustedTimer = 0;
    }
  }

  function getWantedLevel(): number {
    return wantedLevel;
  }

  function addWantedHeat(amount: number): void {
    wantedHeat += amount;
    heatDecayCooldown = HEAT_DECAY_COOLDOWN;
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

  function setOnBusted(cb: () => void): void {
    onBusted = cb;
  }

  function resetWanted(): void {
    wantedHeat = 0;
    wantedLevel = 0;
    heatDecayCooldown = 0;
    bustedTimer = 0;
    bustedTriggered = false;
    policeUnits.forEach((u) => {
      u.active = false;
      u.root.setEnabled(false);
    });
  }

  function setPlayerSpeed(speed: number): void {
    void speed;
  }

  return {
    updatePolice,
    getWantedLevel,
    addWantedHeat,
    getPoliceUnits,
    setPoliceSpeed,
    setOnBusted,
    resetWanted,
    setPlayerSpeed,
  };
}
