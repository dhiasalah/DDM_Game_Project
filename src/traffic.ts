/**
 * AI Traffic System — NPC cars that drive on roads, follow lanes,
 * obey traffic lights, turn at intersections, and react to the player.
 */

import {
  MeshBuilder,
  StandardMaterial,
  Vector3,
  Color3,
  Axis,
} from "@babylonjs/core";
import type { Scene, ShadowGenerator, Mesh } from "@babylonjs/core";
import type {
  BuildingData,
  IntersectionData,
  TrafficResult,
  TrafficCarData,
  TrafficLightState,
} from "./types";

// ============ ROAD CONSTANTS ============
const ROAD_HALF = 7; // half width of a road (14-unit roads)
const LANE_OFFSET = 3.5; // offset from road center to lane center
const SPAWN_DIST = 180; // spawn traffic within this distance from player
const DESPAWN_DIST = 250; // despawn traffic beyond this distance
const MAX_TRAFFIC = 18; // total pool size
const MAX_ACTIVE = 10; // max active at once

interface TrafficCar {
  root: Mesh;
  speed: number;
  maxSpeed: number;
  active: boolean;
  // Driving state
  roadAxis: "x" | "z"; // which axis this car's road runs along
  roadPos: number; // position of the road on the perpendicular axis
  direction: 1 | -1; // +1 or -1 along the axis
  lane: number; // lane offset from center
  // Intersection handling
  turningAt: IntersectionData | null;
  turnProgress: number;
  turnTarget: { axis: "x" | "z"; roadPos: number; direction: 1 | -1 } | null;
  // Car visual refs
  bodyColor: Color3;
  vehicleType: string;
  // Timing
  waitTimer: number; // time spent waiting at a red light
  stoppedForLight: boolean;
}

const CAR_COLORS = [
  new Color3(0.2, 0.35, 0.7),
  new Color3(0.7, 0.2, 0.15),
  new Color3(0.15, 0.55, 0.2),
  new Color3(0.8, 0.75, 0.2),
  new Color3(0.9, 0.9, 0.9),
  new Color3(0.12, 0.12, 0.14),
  new Color3(0.6, 0.3, 0.1),
  new Color3(0.4, 0.15, 0.5),
];

export function createTraffic(
  scene: Scene,
  shadowGenerator: ShadowGenerator,
  buildingData: BuildingData[],
  intersections: IntersectionData[],
  roadsX: number[], // X positions of Z-axis roads
  roadsZ: number[], // Z positions of X-axis roads
  getTrafficLightStates: () => TrafficLightState[],
): TrafficResult {
  const trafficCars: TrafficCar[] = [];

  // ============ SHARED MATERIALS ============
  const cabinMat = new StandardMaterial("trafficCabinMat", scene);
  cabinMat.diffuseColor = new Color3(0.15, 0.2, 0.3);
  cabinMat.alpha = 0.55;
  cabinMat.freeze();

  const wheelMat = new StandardMaterial("trafficWheelMat", scene);
  wheelMat.diffuseColor = new Color3(0.1, 0.1, 0.1);
  wheelMat.freeze();

  // Shared headlight / taillight materials (instead of per-car)
  const sharedHLMat = new StandardMaterial("trafficHLMat", scene);
  sharedHLMat.emissiveColor = new Color3(0.8, 0.8, 0.6);
  sharedHLMat.diffuseColor = new Color3(1, 1, 0.9);
  sharedHLMat.freeze();

  const sharedTLMat = new StandardMaterial("trafficTLMat", scene);
  sharedTLMat.emissiveColor = new Color3(0.6, 0.05, 0.02);
  sharedTLMat.diffuseColor = new Color3(0.8, 0.1, 0.05);
  sharedTLMat.freeze();

  // Pre-create one StandardMaterial per car color (shared across same-color cars)
  const carBodyMats = CAR_COLORS.map((color, i) => {
    const m = new StandardMaterial("trafficBodyMat_" + i, scene);
    m.diffuseColor = color;
    m.specularColor = new Color3(0.4, 0.4, 0.45);
    m.specularPower = 32;
    m.freeze();
    return m;
  });

  // ============ BUILD TRAFFIC CAR MESH ============
  function buildTrafficCar(index: number, _color: Color3): Mesh {
    const body = MeshBuilder.CreateBox(
      "traffic_" + index,
      { width: 2.0, height: 0.5, depth: 4.0 },
      scene,
    );
    body.isVisible = true;
    body.position.set(-500, 0.55, -500); // off-screen initially

    // Use shared StandardMaterial instead of per-car PBRMaterial
    body.material = carBodyMats[index % carBodyMats.length];

    // Cabin
    const cabin = MeshBuilder.CreateBox(
      "tCabin_" + index,
      { width: 1.5, height: 0.45, depth: 1.6 },
      scene,
    );
    cabin.position.set(0, 0.45, -0.1);
    cabin.parent = body;
    cabin.material = cabinMat;

    // Wheels (4) — reduced tessellation from 10 to 6
    const wheelPositions = [
      { x: -0.9, z: 1.2 },
      { x: 0.9, z: 1.2 },
      { x: -0.9, z: -1.2 },
      { x: 0.9, z: -1.2 },
    ];
    wheelPositions.forEach((wp, wi) => {
      const wheel = MeshBuilder.CreateTorus(
        "tW_" + index + "_" + wi,
        { diameter: 0.5, thickness: 0.16, tessellation: 6 },
        scene,
      );
      wheel.position.set(wp.x, -0.2, wp.z);
      wheel.rotation.z = Math.PI / 2;
      wheel.parent = body;
      wheel.material = wheelMat;
    });

    // Headlights — shared material
    const hlL = MeshBuilder.CreateSphere(
      "tHLL_" + index,
      { diameter: 0.2, segments: 4 },
      scene,
    );
    hlL.position.set(-0.65, 0, 2.0);
    hlL.parent = body;
    hlL.material = sharedHLMat;

    const hlR = MeshBuilder.CreateSphere(
      "tHLR_" + index,
      { diameter: 0.2, segments: 4 },
      scene,
    );
    hlR.position.set(0.65, 0, 2.0);
    hlR.parent = body;
    hlR.material = sharedHLMat;

    // Taillights — shared material
    const tlL = MeshBuilder.CreateBox(
      "tTLL_" + index,
      { width: 0.3, height: 0.12, depth: 0.06 },
      scene,
    );
    tlL.position.set(-0.65, 0, -2.05);
    tlL.parent = body;
    tlL.material = sharedTLMat;

    const tlR = MeshBuilder.CreateBox(
      "tTLR_" + index,
      { width: 0.3, height: 0.12, depth: 0.06 },
      scene,
    );
    tlR.position.set(0.65, 0, -2.05);
    tlR.parent = body;
    tlR.material = sharedTLMat;

    shadowGenerator.addShadowCaster(body);
    body.setEnabled(false);

    return body;
  }

  // ============ PRE-CREATE POOL ============
  for (let i = 0; i < MAX_TRAFFIC; i++) {
    const color = CAR_COLORS[i % CAR_COLORS.length];
    const root = buildTrafficCar(i, color);
    trafficCars.push({
      root,
      speed: 0,
      maxSpeed: 10 + Math.random() * 12,
      active: false,
      roadAxis: "z",
      roadPos: 0,
      direction: 1,
      lane: LANE_OFFSET,
      turningAt: null,
      turnProgress: 0,
      turnTarget: null,
      bodyColor: color,
      vehicleType: "sedan",
      waitTimer: 0,
      stoppedForLight: false,
    });
  }

  // ============ FIND NEAREST INTERSECTION ============
  function findNearestIntersection(
    x: number,
    z: number,
  ): IntersectionData | null {
    let best: IntersectionData | null = null;
    let bestDist = Infinity;
    for (const inter of intersections) {
      const d = (inter.x - x) ** 2 + (inter.z - z) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = inter;
      }
    }
    return best;
  }

  // ============ CHECK IF AT INTERSECTION ============
  function isNearIntersection(
    car: TrafficCar,
    pos: number,
  ): IntersectionData | null {
    for (const inter of intersections) {
      const interPos = car.roadAxis === "z" ? inter.z : inter.x;
      if (Math.abs(pos - interPos) < 2) {
        return inter;
      }
    }
    return null;
  }

  // ============ CHECK TRAFFIC LIGHT STATE ============
  function shouldStopForLight(car: TrafficCar): boolean {
    const states = getTrafficLightStates();
    const pos =
      car.roadAxis === "z" ? car.root.position.z : car.root.position.x;
    const perpPos = car.roadPos;

    // Find nearest intersection ahead
    for (const inter of intersections) {
      const interPos = car.roadAxis === "z" ? inter.z : inter.x;
      const dist = (interPos - pos) * car.direction;

      // Only care about intersections 3-15 units ahead
      if (dist > 3 && dist < 15) {
        // Check light state for this intersection
        for (const light of states) {
          if (
            Math.abs(light.x - inter.x) < 5 &&
            Math.abs(light.z - inter.z) < 5
          ) {
            const relevantState =
              car.roadAxis === "z" ? light.stateNS : light.stateEW;
            if (relevantState === "red" || relevantState === "yellow") {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  // ============ CHECK FOR CAR AHEAD ============
  function hasCarAhead(car: TrafficCar, allCars: TrafficCar[]): boolean {
    const myX = car.root.position.x;
    const myZ = car.root.position.z;

    for (const other of allCars) {
      if (other === car || !other.active) continue;

      const dx = other.root.position.x - myX;
      const dz = other.root.position.z - myZ;
      const distSq = dx * dx + dz * dz;

      if (distSq > 100) continue; // 10u max check

      // Check if ahead along our direction
      if (car.roadAxis === "z") {
        if (
          dz * car.direction > 1 &&
          dz * car.direction < 8 &&
          Math.abs(dx) < 2.5
        ) {
          return true;
        }
      } else {
        if (
          dx * car.direction > 1 &&
          dx * car.direction < 8 &&
          Math.abs(dz) < 2.5
        ) {
          return true;
        }
      }
    }
    return false;
  }

  // ============ SPAWN A TRAFFIC CAR ============
  function spawnTrafficCar(
    car: TrafficCar,
    playerX: number,
    playerZ: number,
  ): void {
    // Pick a random road
    const useZRoad = Math.random() > 0.5;

    if (useZRoad && roadsX.length > 0) {
      const roadX = roadsX[Math.floor(Math.random() * roadsX.length)];
      const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
      const lane = dir === 1 ? LANE_OFFSET : -LANE_OFFSET;

      // Spawn somewhere on this road, away from player
      let spawnZ =
        playerZ + (Math.random() > 0.5 ? 1 : -1) * (60 + Math.random() * 100);
      spawnZ = Math.max(-380, Math.min(380, spawnZ));

      car.roadAxis = "z";
      car.roadPos = roadX;
      car.direction = dir;
      car.lane = lane;
      car.root.position.set(roadX + lane, 0.55, spawnZ);
      car.root.rotation.y = dir === 1 ? 0 : Math.PI;
    } else if (roadsZ.length > 0) {
      const roadZ = roadsZ[Math.floor(Math.random() * roadsZ.length)];
      const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
      const lane = dir === 1 ? LANE_OFFSET : -LANE_OFFSET;

      let spawnX =
        playerX + (Math.random() > 0.5 ? 1 : -1) * (60 + Math.random() * 100);
      spawnX = Math.max(-380, Math.min(380, spawnX));

      car.roadAxis = "x";
      car.roadPos = roadZ;
      car.direction = dir;
      car.lane = lane;
      car.root.position.set(spawnX, 0.55, roadZ + lane);
      car.root.rotation.y = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    }

    car.speed = car.maxSpeed * 0.5;
    car.active = true;
    car.turningAt = null;
    car.turnProgress = 0;
    car.turnTarget = null;
    car.waitTimer = 0;
    car.stoppedForLight = false;
    car.root.setEnabled(true);
  }

  // ============ UPDATE ============
  function updateTraffic(dt: number, playerX: number, playerZ: number): void {
    let activeCount = 0;

    for (let i = 0; i < trafficCars.length; i++) {
      const car = trafficCars[i];

      if (car.active) {
        activeCount++;

        // Distance check — despawn if too far
        const dx = car.root.position.x - playerX;
        const dz = car.root.position.z - playerZ;
        const distSq = dx * dx + dz * dz;

        if (distSq > DESPAWN_DIST * DESPAWN_DIST) {
          car.active = false;
          car.root.setEnabled(false);
          activeCount--;
          continue;
        }

        // ---- DRIVING LOGIC ----

        // Check for turning at intersection
        if (!car.turningAt) {
          const pos =
            car.roadAxis === "z" ? car.root.position.z : car.root.position.x;
          const inter = isNearIntersection(car, pos);

          if (inter && Math.random() < 0.3 * dt) {
            // Decide to turn
            const turnRoll = Math.random();
            if (turnRoll < 0.2) {
              // Turn to perpendicular road
              const newAxis = car.roadAxis === "z" ? "x" : "z";
              const newRoadPos = car.roadAxis === "z" ? inter.z : inter.x;
              const newDir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
              car.turningAt = inter;
              car.turnProgress = 0;
              car.turnTarget = {
                axis: newAxis as "x" | "z",
                roadPos: newRoadPos,
                direction: newDir,
              };
            }
          }
        }

        // Execute turn
        if (car.turningAt && car.turnTarget) {
          car.turnProgress += dt * car.speed * 0.08;

          if (car.turnProgress >= 1) {
            // Turn complete
            car.roadAxis = car.turnTarget.axis;
            car.roadPos = car.turnTarget.roadPos;
            car.direction = car.turnTarget.direction;
            car.lane =
              car.turnTarget.direction === 1 ? LANE_OFFSET : -LANE_OFFSET;
            car.turningAt = null;
            car.turnTarget = null;

            // Snap rotation
            if (car.roadAxis === "z") {
              car.root.rotation.y = car.direction === 1 ? 0 : Math.PI;
            } else {
              car.root.rotation.y =
                car.direction === 1 ? Math.PI / 2 : -Math.PI / 2;
            }
          } else {
            // Interpolate turn
            const t = car.turnProgress;
            const startAngle = car.root.rotation.y;
            let targetAngle: number;
            if (car.turnTarget.axis === "z") {
              targetAngle = car.turnTarget.direction === 1 ? 0 : Math.PI;
            } else {
              targetAngle =
                car.turnTarget.direction === 1 ? Math.PI / 2 : -Math.PI / 2;
            }

            // Lerp angle
            let diff = targetAngle - startAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            car.root.rotation.y = startAngle + diff * t * 0.1;
          }
        }

        // Traffic light check
        const shouldStop = shouldStopForLight(car);
        const carAhead = hasCarAhead(car, trafficCars);

        if (shouldStop || carAhead) {
          car.speed -= 15 * dt;
          if (car.speed < 0) car.speed = 0;
          car.stoppedForLight = shouldStop;
        } else {
          // Accelerate toward max speed
          if (car.speed < car.maxSpeed) {
            car.speed += 8 * dt;
            if (car.speed > car.maxSpeed) car.speed = car.maxSpeed;
          }
          car.stoppedForLight = false;
        }

        // Move along road
        const forward = car.root.getDirection(Axis.Z);
        car.root.position.addInPlace(forward.scale(car.speed * dt));
        car.root.position.y = 0.55;

        // Keep in lane (correct drift)
        if (!car.turningAt) {
          if (car.roadAxis === "z") {
            const targetX = car.roadPos + car.lane;
            car.root.position.x += (targetX - car.root.position.x) * 2 * dt;
          } else {
            const targetZ = car.roadPos + car.lane;
            car.root.position.z += (targetZ - car.root.position.z) * 2 * dt;
          }
        }

        // World boundary
        const lim = 390;
        if (
          Math.abs(car.root.position.x) > lim ||
          Math.abs(car.root.position.z) > lim
        ) {
          car.active = false;
          car.root.setEnabled(false);
          activeCount--;
        }
      }
    }

    // Spawn new traffic cars if under limit
    if (activeCount < MAX_ACTIVE) {
      for (const car of trafficCars) {
        if (!car.active && activeCount < MAX_ACTIVE) {
          spawnTrafficCar(car, playerX, playerZ);
          activeCount++;
        }
      }
    }

    // Rebuild cached arrays after all mutations
    rebuildCaches();
  }

  // Cached active list — rebuilt only in updateTraffic, not on every getter call
  let cachedActive: TrafficCarData[] = [];
  let cachedAll: TrafficCarData[] = [];
  let cacheDirty = true;

  function rebuildCaches(): void {
    // Rebuild all list only when pool size changes (rare)
    if (cachedAll.length !== trafficCars.length) {
      cachedAll = trafficCars.map((c) => ({
        root: c.root,
        speed: c.speed,
        active: c.active,
        lane: c.lane,
        vehicleType: c.vehicleType,
      }));
    } else {
      // Update in-place — no allocation
      for (let i = 0; i < trafficCars.length; i++) {
        const c = trafficCars[i];
        const t = cachedAll[i];
        t.speed = c.speed;
        t.active = c.active;
        t.lane = c.lane;
      }
    }
    // Rebuild active list (reuse array, splice to size)
    let ai = 0;
    for (let i = 0; i < cachedAll.length; i++) {
      if (cachedAll[i].active) {
        cachedActive[ai] = cachedAll[i];
        ai++;
      }
    }
    cachedActive.length = ai;
  }

  function getTrafficCars(): TrafficCarData[] {
    return cachedAll;
  }

  function getActiveTrafficCars(): TrafficCarData[] {
    return cachedActive;
  }

  function removeTrafficCar(index: number): void {
    if (index >= 0 && index < trafficCars.length) {
      trafficCars[index].active = false;
      trafficCars[index].root.setEnabled(false);
    }
  }

  return {
    updateTraffic,
    getTrafficCars,
    getActiveTrafficCars,
    removeTrafficCar,
  };
}
