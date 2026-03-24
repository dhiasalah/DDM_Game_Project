import { Vector3, Axis } from "@babylonjs/core";
import type { Mesh } from "@babylonjs/core";
import type {
  BuildingData,
  TreeData,
  ParkedCarData,
  Pedestrian,
  DestructibleObject,
  CollisionCallbacks,
  CollisionResult,
  PoliceResult,
  PlayerMode,
  TrafficCarData,
} from "./types";

/* ================================================================
 *  SPATIAL HASH GRID — O(1) lookup for nearby static objects
 * ================================================================ */
const CELL_SIZE = 40;

interface SpatialGrid<T> {
  cells: Map<string, T[]>;
  cellSize: number;
}

function createSpatialGrid<T>(
  items: T[],
  getX: (t: T) => number,
  getZ: (t: T) => number,
): SpatialGrid<T> {
  const cells = new Map<string, T[]>();
  for (const item of items) {
    const cx = Math.floor(getX(item) / CELL_SIZE);
    const cz = Math.floor(getZ(item) / CELL_SIZE);
    const key = `${cx}_${cz}`;
    let bucket = cells.get(key);
    if (!bucket) {
      bucket = [];
      cells.set(key, bucket);
    }
    bucket.push(item);
  }
  return { cells, cellSize: CELL_SIZE };
}

function queryGrid<T>(grid: SpatialGrid<T>, x: number, z: number): T[] {
  const cx = Math.floor(x / CELL_SIZE);
  const cz = Math.floor(z / CELL_SIZE);
  const result: T[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const key = `${cx + dx}_${cz + dz}`;
      const bucket = grid.cells.get(key);
      if (bucket) {
        for (let i = 0; i < bucket.length; i++) {
          result.push(bucket[i]);
        }
      }
    }
  }
  return result;
}

/* ================================================================ */

export function setupCollisions(
  carRoot: Mesh,
  buildingData: BuildingData[],
  pedestrians: Pedestrian[],
  destructibles: DestructibleObject[],
  callbacks: CollisionCallbacks,
  policeResult: PoliceResult,
  treeData: TreeData[],
  parkedCars: ParkedCarData[],
): CollisionResult & {
  checkOnFootCollisions: (playerMesh: Mesh, mode: PlayerMode) => void;
  setTrafficGetter: (getter: () => TrafficCarData[]) => void;
} {
  const carHalfW = 1.1;
  const carHalfD = 2.25;
  const policeHalfW = 1.0;
  const policeHalfD = 2.1;
  const pedHalf = 0.35;
  const treeHalf = 0.5;

  let hitCount = 0;
  let collisionCooldown = 0;
  let policeCooldown = 0;
  let trafficCooldown = 0;

  let getTrafficCars: (() => TrafficCarData[]) | null = null;
  const trafficHalfW = 1.0;
  const trafficHalfD = 2.0;

  // Build spatial grids for static objects
  const buildingGrid = createSpatialGrid(
    buildingData,
    (b) => b.x,
    (b) => b.z,
  );
  const treeGrid = createSpatialGrid(
    treeData,
    (t) => t.x,
    (t) => t.z,
  );
  const parkedCarGrid = createSpatialGrid(
    parkedCars,
    (p) => p.x,
    (p) => p.z,
  );

  // ===== DYNAMIC PEDESTRIAN GRID - Updated each frame =====
  const pedestrianGrid: SpatialGrid<Pedestrian> = {
    cells: new Map(),
    cellSize: CELL_SIZE,
  };

  function updatePedestrianGrid(): void {
    pedestrianGrid.cells.clear();
    for (const ped of pedestrians) {
      if (!ped.alive || ped.flying) continue;
      const x = ped.mesh.root.position.x;
      const z = ped.mesh.root.position.z;
      const cx = Math.floor(x / CELL_SIZE);
      const cz = Math.floor(z / CELL_SIZE);
      const key = `${cx}_${cz}`;
      let bucket = pedestrianGrid.cells.get(key);
      if (!bucket) {
        bucket = [];
        pedestrianGrid.cells.set(key, bucket);
      }
      bucket.push(ped);
    }
  }

  interface AABB {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  }

  function getOrientedAABB(
    cx: number,
    cz: number,
    rotY: number,
    halfW: number,
    halfD: number,
  ): AABB {
    const cosA = Math.abs(Math.cos(rotY));
    const sinA = Math.abs(Math.sin(rotY));
    const halfX = halfW * cosA + halfD * sinA;
    const halfZ = halfW * sinA + halfD * cosA;
    return {
      minX: cx - halfX,
      maxX: cx + halfX,
      minZ: cz - halfZ,
      maxZ: cz + halfZ,
    };
  }

  function getCarAABB(): AABB {
    return getOrientedAABB(
      carRoot.position.x,
      carRoot.position.z,
      carRoot.rotation.y,
      carHalfW,
      carHalfD,
    );
  }

  function getOverlap(
    a: AABB,
    b: AABB,
  ): { overlapX: number; overlapZ: number } | null {
    const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
    if (overlapX > 0 && overlapZ > 0) return { overlapX, overlapZ };
    return null;
  }

  function forwardDir(rotY: number): { x: number; z: number } {
    return { x: Math.sin(rotY), z: Math.cos(rotY) };
  }

  function checkCollisions(dt: number): void {
    if (collisionCooldown > 0) collisionCooldown -= dt;
    if (policeCooldown > 0) policeCooldown -= dt;
    if (trafficCooldown > 0) trafficCooldown -= dt;

    // Update pedestrian spatial grid once per frame
    updatePedestrianGrid();

    const carAABB = getCarAABB();
    const carSpeed = callbacks.getSpeed();
    const absSpeed = Math.abs(carSpeed);
    const px = carRoot.position.x;
    const pz = carRoot.position.z;

    // ======================================================
    // === PLAYER vs BUILDINGS (spatial grid) ===
    // ======================================================
    const nearBuildings = queryGrid(buildingGrid, px, pz);
    for (let i = 0; i < nearBuildings.length; i++) {
      const b = nearBuildings[i];
      const bMinX = b.x - b.w / 2;
      const bMaxX = b.x + b.w / 2;
      const bMinZ = b.z - b.d / 2;
      const bMaxZ = b.z + b.d / 2;

      const overlapX =
        Math.min(carAABB.maxX, bMaxX) - Math.max(carAABB.minX, bMinX);
      const overlapZ =
        Math.min(carAABB.maxZ, bMaxZ) - Math.max(carAABB.minZ, bMinZ);

      if (overlapX > 0 && overlapZ > 0) {
        const cx = carRoot.position.x;
        const cz = carRoot.position.z;

        if (overlapX < overlapZ) {
          carRoot.position.x += cx < b.x ? -overlapX : overlapX;
        } else {
          carRoot.position.z += cz < b.z ? -overlapZ : overlapZ;
        }

        if (absSpeed > 2 && collisionCooldown <= 0) {
          const contactX = Math.max(carAABB.minX, bMinX) + overlapX / 2;
          const contactZ = Math.max(carAABB.minZ, bMinZ) + overlapZ / 2;
          callbacks.onBuildingHit(new Vector3(contactX, 0.8, contactZ));
          collisionCooldown = 0.5;
          // High-speed collision damage
          if (absSpeed > 15) {
            const dmg = Math.min(30, (absSpeed - 15) * 0.8);
            callbacks.onVehicleDamage(dmg);
            callbacks.onPlayerDamage(dmg * 0.3);
          }
        }
        callbacks.setSpeed(0);
      }
    }

    // ======================================================
    // === PLAYER vs TREES (spatial grid) ===
    // ======================================================
    const nearTrees = queryGrid(treeGrid, px, pz);
    for (let ti = 0; ti < nearTrees.length; ti++) {
      const tree = nearTrees[ti];
      const tMinX = tree.x - treeHalf;
      const tMaxX = tree.x + treeHalf;
      const tMinZ = tree.z - treeHalf;
      const tMaxZ = tree.z + treeHalf;

      const overlapTX =
        Math.min(carAABB.maxX, tMaxX) - Math.max(carAABB.minX, tMinX);
      const overlapTZ =
        Math.min(carAABB.maxZ, tMaxZ) - Math.max(carAABB.minZ, tMinZ);

      if (overlapTX > 0 && overlapTZ > 0) {
        const cx = carRoot.position.x;
        const cz = carRoot.position.z;

        if (overlapTX < overlapTZ) {
          carRoot.position.x += cx < tree.x ? -overlapTX : overlapTX;
        } else {
          carRoot.position.z += cz < tree.z ? -overlapTZ : overlapTZ;
        }

        if (absSpeed > 2 && collisionCooldown <= 0) {
          callbacks.onBuildingHit(new Vector3(tree.x, 1.0, tree.z));
          collisionCooldown = 0.5;
        }
        callbacks.setSpeed(0);
      }
    }

    // ======================================================
    // === PLAYER vs PARKED CARS (spatial grid) ===
    // ======================================================
    const nearParked = queryGrid(parkedCarGrid, px, pz);
    for (let pi = 0; pi < nearParked.length; pi++) {
      const pc = nearParked[pi];
      const pcAABB = getOrientedAABB(pc.x, pc.z, pc.rotY, pc.halfW, pc.halfD);

      const overlap = getOverlap(carAABB, pcAABB);
      if (overlap) {
        const { overlapX, overlapZ } = overlap;
        const cx = carRoot.position.x;
        const cz = carRoot.position.z;

        if (overlapX < overlapZ) {
          carRoot.position.x += cx < pc.x ? -overlapX : overlapX;
        } else {
          carRoot.position.z += cz < pc.z ? -overlapZ : overlapZ;
        }

        if (absSpeed > 2 && collisionCooldown <= 0) {
          callbacks.onBuildingHit(new Vector3(pc.x, 0.6, pc.z));
          collisionCooldown = 0.5;
        }
        callbacks.setSpeed(carSpeed * 0.3);
      }
    }

    // ======================================================
    // === PLAYER vs PEDESTRIANS (spatial grid) ===
    // ======================================================
    const nearPeds = queryGrid(pedestrianGrid, px, pz);
    for (let j = 0; j < nearPeds.length; j++) {
      const ped = nearPeds[j];
      if (!ped.alive || ped.flying) continue;

      const pedX = ped.mesh.root.position.x;
      const pedZ = ped.mesh.root.position.z;

      const pMinX = pedX - pedHalf;
      const pMaxX = pedX + pedHalf;
      const pMinZ = pedZ - pedHalf;
      const pMaxZ = pedZ + pedHalf;

      const overlapPX =
        Math.min(carAABB.maxX, pMaxX) - Math.max(carAABB.minX, pMinX);
      const overlapPZ =
        Math.min(carAABB.maxZ, pMaxZ) - Math.max(carAABB.minZ, pMinZ);

      if (overlapPX > 0 && overlapPZ > 0 && absSpeed > 2) {
        ped.alive = false;
        ped.flying = true;
        ped.flyTime = 0;

        const forward = carRoot.getDirection(Axis.Z);
        const launchSpeed = Math.min(absSpeed * 0.6, 15);
        ped.flyVelocity = new Vector3(
          forward.x * launchSpeed + (Math.random() - 0.5) * 3,
          6 + Math.random() * 4,
          forward.z * launchSpeed + (Math.random() - 0.5) * 3,
        );

        hitCount++;
        callbacks.onPedestrianHit(ped.mesh.root.position.clone(), hitCount);
      }
    }

    // ======================================================
    // === PLAYER vs WORLD BOUNDARY ===
    // ======================================================
    const limit = 395;
    if (carRoot.position.x > limit) {
      carRoot.position.x = limit;
      callbacks.setSpeed(0);
    }
    if (carRoot.position.x < -limit) {
      carRoot.position.x = -limit;
      callbacks.setSpeed(0);
    }
    if (carRoot.position.z > limit) {
      carRoot.position.z = limit;
      callbacks.setSpeed(0);
    }
    if (carRoot.position.z < -limit) {
      carRoot.position.z = -limit;
      callbacks.setSpeed(0);
    }

    // ======================================================
    // === PLAYER vs DESTRUCTIBLES ===
    // ======================================================
    for (let k = 0; k < destructibles.length; k++) {
      const obj = destructibles[k];

      if (obj.flying) {
        obj.flyTime += dt;
        obj.flyVelocity.y -= 9.81 * dt;
        obj.mesh.position.addInPlace(obj.flyVelocity.scale(dt));
        obj.mesh.rotation.x += 4 * dt;
        obj.mesh.rotation.z += 3 * dt;

        if (obj.flyTime > 2.5 || obj.mesh.position.y < -2) {
          obj.flying = false;
          obj.mesh.setEnabled(false);
          obj.respawnTimer = 15;
        }
        continue;
      }

      if (!obj.alive) {
        obj.respawnTimer -= dt;
        if (obj.respawnTimer <= 0) {
          obj.alive = true;
          obj.mesh.position.set(
            obj.x,
            obj.mesh.position.y < 0.4 ? 0.3 : 0.5,
            obj.z,
          );
          obj.mesh.rotation.set(0, 0, 0);
          obj.mesh.setEnabled(true);
        }
        continue;
      }

      // Only check destructibles near the player
      const ddx = obj.x - px;
      const ddz = obj.z - pz;
      if (ddx * ddx + ddz * ddz > 2500) continue; // 50u radius

      const oMinX = obj.x - obj.halfW;
      const oMaxX = obj.x + obj.halfW;
      const oMinZ = obj.z - obj.halfD;
      const oMaxZ = obj.z + obj.halfD;

      const overlapOX =
        Math.min(carAABB.maxX, oMaxX) - Math.max(carAABB.minX, oMinX);
      const overlapOZ =
        Math.min(carAABB.maxZ, oMaxZ) - Math.max(carAABB.minZ, oMinZ);

      if (overlapOX > 0 && overlapOZ > 0 && absSpeed > 1) {
        obj.alive = false;
        obj.flying = true;
        obj.flyTime = 0;

        const forward = carRoot.getDirection(Axis.Z);
        const launchSpeed = Math.min(absSpeed * 0.4, 10);
        obj.flyVelocity = new Vector3(
          forward.x * launchSpeed + (Math.random() - 0.5) * 4,
          4 + Math.random() * 3,
          forward.z * launchSpeed + (Math.random() - 0.5) * 4,
        );

        callbacks.onDestructibleHit(obj);
        callbacks.setSpeed(carSpeed * 0.9);
      }
    }

    // ======================================================
    // === POLICE COLLISIONS ===
    // ======================================================
    const policeUnits = policeResult.getPoliceUnits();

    for (let pi = 0; pi < policeUnits.length; pi++) {
      const pUnit = policeUnits[pi];
      if (!pUnit.active) continue;

      const policeAABB = getOrientedAABB(
        pUnit.root.position.x,
        pUnit.root.position.z,
        pUnit.root.rotation.y,
        policeHalfW,
        policeHalfD,
      );

      // PLAYER vs POLICE — momentum-based bounce
      const playerPoliceOverlap = getOverlap(carAABB, policeAABB);
      if (playerPoliceOverlap) {
        const { overlapX, overlapZ } = playerPoliceOverlap;
        const pcx = carRoot.position.x;
        const pcz = carRoot.position.z;
        const ppx = pUnit.root.position.x;
        const ppz = pUnit.root.position.z;

        const sepX = ppx - pcx;
        const sepZ = ppz - pcz;

        if (overlapX < overlapZ) {
          const sign = sepX >= 0 ? 1 : -1;
          carRoot.position.x -= sign * overlapX * 0.5;
          pUnit.root.position.x += sign * overlapX * 0.5;
        } else {
          const sign = sepZ >= 0 ? 1 : -1;
          carRoot.position.z -= sign * overlapZ * 0.5;
          pUnit.root.position.z += sign * overlapZ * 0.5;
        }

        const playerFwd = forwardDir(carRoot.rotation.y);
        const policeFwd = forwardDir(pUnit.root.rotation.y);

        const sepLen = Math.sqrt(sepX * sepX + sepZ * sepZ) || 1;
        const nx = sepX / sepLen;
        const nz = sepZ / sepLen;

        const playerVn = carSpeed * (playerFwd.x * nx + playerFwd.z * nz);
        const policeVn = pUnit.speed * (policeFwd.x * nx + policeFwd.z * nz);

        const restitution = 0.6;
        const newPlayerVn =
          playerVn - (1 + restitution) * 0.5 * (playerVn - policeVn);
        const newPoliceVn =
          policeVn - (1 + restitution) * 0.5 * (policeVn - playerVn);

        const finalPlayerSpeed = carSpeed + (newPlayerVn - playerVn);
        callbacks.setSpeed(Math.max(-15, Math.min(45, finalPlayerSpeed)));
        policeResult.setPoliceSpeed(
          pi,
          Math.max(0, Math.min(40, Math.abs(newPoliceVn))),
        );

        if (policeCooldown <= 0) {
          const contactPos = new Vector3(
            (pcx + ppx) * 0.5,
            0.8,
            (pcz + ppz) * 0.5,
          );
          callbacks.onPoliceHit(contactPos);
          policeCooldown = 0.5;
          // Police ram damage
          callbacks.onVehicleDamage(5);
          callbacks.onPlayerDamage(3);
        }
      }

      // POLICE vs POLICE
      for (let pj = pi + 1; pj < policeUnits.length; pj++) {
        const pUnit2 = policeUnits[pj];
        if (!pUnit2.active) continue;

        const policeAABB2 = getOrientedAABB(
          pUnit2.root.position.x,
          pUnit2.root.position.z,
          pUnit2.root.rotation.y,
          policeHalfW,
          policeHalfD,
        );

        const ppOverlap = getOverlap(policeAABB, policeAABB2);
        if (ppOverlap) {
          const { overlapX, overlapZ } = ppOverlap;
          const sx = pUnit2.root.position.x - pUnit.root.position.x;
          const sz = pUnit2.root.position.z - pUnit.root.position.z;

          if (overlapX < overlapZ) {
            const sign = sx >= 0 ? 1 : -1;
            pUnit.root.position.x -= sign * overlapX * 0.5;
            pUnit2.root.position.x += sign * overlapX * 0.5;
          } else {
            const sign = sz >= 0 ? 1 : -1;
            pUnit.root.position.z -= sign * overlapZ * 0.5;
            pUnit2.root.position.z += sign * overlapZ * 0.5;
          }

          policeResult.setPoliceSpeed(pi, pUnit.speed * 0.5);
          policeResult.setPoliceSpeed(pj, pUnit2.speed * 0.5);

          callbacks.triggerCollisionSparks(
            new Vector3(
              (pUnit.root.position.x + pUnit2.root.position.x) * 0.5,
              0.8,
              (pUnit.root.position.z + pUnit2.root.position.z) * 0.5,
            ),
          );
        }
      }

      // POLICE vs PEDESTRIANS (spatial grid)
      const nearPolicePeds = queryGrid(
        pedestrianGrid,
        pUnit.root.position.x,
        pUnit.root.position.z,
      );
      for (let pj = 0; pj < nearPolicePeds.length; pj++) {
        const ped = nearPolicePeds[pj];
        if (!ped.alive || ped.flying) continue;

        const pedX = ped.mesh.root.position.x;
        const pedZ = ped.mesh.root.position.z;
        const pedAABB: AABB = {
          minX: pedX - pedHalf,
          maxX: pedX + pedHalf,
          minZ: pedZ - pedHalf,
          maxZ: pedZ + pedHalf,
        };

        const pedOverlap = getOverlap(policeAABB, pedAABB);
        if (pedOverlap && pUnit.speed > 2) {
          ped.alive = false;
          ped.flying = true;
          ped.flyTime = 0;

          const pfwd = forwardDir(pUnit.root.rotation.y);
          const launchSpeed = Math.min(pUnit.speed * 0.6, 15);
          ped.flyVelocity = new Vector3(
            pfwd.x * launchSpeed + (Math.random() - 0.5) * 3,
            6 + Math.random() * 4,
            pfwd.z * launchSpeed + (Math.random() - 0.5) * 3,
          );

          callbacks.triggerHitParticles(ped.mesh.root.position.clone());
        }
      }

      // POLICE vs DESTRUCTIBLES (nearby only)
      for (let dk = 0; dk < destructibles.length; dk++) {
        const obj = destructibles[dk];
        if (!obj.alive || obj.flying) continue;

        // Distance cull for police vs destructibles
        const ddx2 = obj.x - pUnit.root.position.x;
        const ddz2 = obj.z - pUnit.root.position.z;
        if (ddx2 * ddx2 + ddz2 * ddz2 > 900) continue; // 30u radius

        const objAABB: AABB = {
          minX: obj.x - obj.halfW,
          maxX: obj.x + obj.halfW,
          minZ: obj.z - obj.halfD,
          maxZ: obj.z + obj.halfD,
        };

        const destOverlap = getOverlap(policeAABB, objAABB);
        if (destOverlap && pUnit.speed > 1) {
          obj.alive = false;
          obj.flying = true;
          obj.flyTime = 0;

          const pfwd = forwardDir(pUnit.root.rotation.y);
          const launchSpd = Math.min(pUnit.speed * 0.4, 10);
          obj.flyVelocity = new Vector3(
            pfwd.x * launchSpd + (Math.random() - 0.5) * 4,
            4 + Math.random() * 3,
            pfwd.z * launchSpd + (Math.random() - 0.5) * 4,
          );

          callbacks.triggerCollisionSparks(obj.mesh.position.clone());
          policeResult.setPoliceSpeed(pi, pUnit.speed * 0.9);
        }
      }

      // POLICE vs TREES (spatial grid)
      const nearPoliceTrees = queryGrid(
        treeGrid,
        pUnit.root.position.x,
        pUnit.root.position.z,
      );
      for (let ti = 0; ti < nearPoliceTrees.length; ti++) {
        const tree = nearPoliceTrees[ti];
        const treeAABB: AABB = {
          minX: tree.x - treeHalf,
          maxX: tree.x + treeHalf,
          minZ: tree.z - treeHalf,
          maxZ: tree.z + treeHalf,
        };

        const treeOverlap = getOverlap(policeAABB, treeAABB);
        if (treeOverlap) {
          const { overlapX, overlapZ } = treeOverlap;

          if (overlapX < overlapZ) {
            pUnit.root.position.x +=
              pUnit.root.position.x < tree.x ? -overlapX : overlapX;
          } else {
            pUnit.root.position.z +=
              pUnit.root.position.z < tree.z ? -overlapZ : overlapZ;
          }
          policeResult.setPoliceSpeed(pi, pUnit.speed * 0.5);
        }
      }

      // POLICE vs BUILDINGS (spatial grid)
      const nearPoliceBuildings = queryGrid(
        buildingGrid,
        pUnit.root.position.x,
        pUnit.root.position.z,
      );
      for (let bi = 0; bi < nearPoliceBuildings.length; bi++) {
        const b = nearPoliceBuildings[bi];
        const bAABB: AABB = {
          minX: b.x - b.w / 2,
          maxX: b.x + b.w / 2,
          minZ: b.z - b.d / 2,
          maxZ: b.z + b.d / 2,
        };

        const bOverlap = getOverlap(policeAABB, bAABB);
        if (bOverlap) {
          const { overlapX, overlapZ } = bOverlap;
          if (overlapX < overlapZ) {
            pUnit.root.position.x +=
              pUnit.root.position.x < b.x ? -overlapX : overlapX;
          } else {
            pUnit.root.position.z +=
              pUnit.root.position.z < b.z ? -overlapZ : overlapZ;
          }
          policeResult.setPoliceSpeed(pi, pUnit.speed * 0.5);
        }
      }
    }

    // ======================================================
    // === TRAFFIC CAR COLLISIONS ===
    // ======================================================
    if (getTrafficCars) {
      const trafficList = getTrafficCars();

      for (let ti = 0; ti < trafficList.length; ti++) {
        const tc = trafficList[ti];
        if (!tc.active) continue;

        const tcAABB = getOrientedAABB(
          tc.root.position.x,
          tc.root.position.z,
          tc.root.rotation.y,
          trafficHalfW,
          trafficHalfD,
        );

        // PLAYER CAR vs TRAFFIC CAR
        const ptOverlap = getOverlap(carAABB, tcAABB);
        if (ptOverlap) {
          const { overlapX, overlapZ } = ptOverlap;
          const sx = tc.root.position.x - carRoot.position.x;
          const sz = tc.root.position.z - carRoot.position.z;

          // Push apart
          if (overlapX < overlapZ) {
            const sign = sx >= 0 ? 1 : -1;
            carRoot.position.x -= sign * overlapX * 0.4;
            tc.root.position.x += sign * overlapX * 0.6;
          } else {
            const sign = sz >= 0 ? 1 : -1;
            carRoot.position.z -= sign * overlapZ * 0.4;
            tc.root.position.z += sign * overlapZ * 0.6;
          }

          // Slow both
          callbacks.setSpeed(carSpeed * 0.4);
          tc.speed *= 0.2;

          if (trafficCooldown <= 0) {
            const contactPos = new Vector3(
              (carRoot.position.x + tc.root.position.x) * 0.5,
              0.8,
              (carRoot.position.z + tc.root.position.z) * 0.5,
            );
            callbacks.triggerCollisionSparks(contactPos);
            trafficCooldown = 0.4;

            // Damage on high-speed impact
            if (absSpeed > 10) {
              const dmg = Math.min(25, (absSpeed - 10) * 0.7);
              callbacks.onVehicleDamage(dmg);
              callbacks.onPlayerDamage(dmg * 0.2);
            }
          }
        }

        // TRAFFIC vs PEDESTRIANS (spatial grid)
        const nearTrafficPeds = queryGrid(
          pedestrianGrid,
          tc.root.position.x,
          tc.root.position.z,
        );
        for (let pj = 0; pj < nearTrafficPeds.length; pj++) {
          const ped = nearTrafficPeds[pj];
          if (!ped.alive || ped.flying) continue;

          const pedX = ped.mesh.root.position.x;
          const pedZ = ped.mesh.root.position.z;
          const pedAABB: AABB = {
            minX: pedX - pedHalf,
            maxX: pedX + pedHalf,
            minZ: pedZ - pedHalf,
            maxZ: pedZ + pedHalf,
          };

          const tpOverlap = getOverlap(tcAABB, pedAABB);
          if (tpOverlap && tc.speed > 2) {
            ped.alive = false;
            ped.flying = true;
            ped.flyTime = 0;

            const tfwd = forwardDir(tc.root.rotation.y);
            const launchSpeed = Math.min(tc.speed * 0.6, 15);
            ped.flyVelocity = new Vector3(
              tfwd.x * launchSpeed + (Math.random() - 0.5) * 3,
              6 + Math.random() * 4,
              tfwd.z * launchSpeed + (Math.random() - 0.5) * 3,
            );

            callbacks.triggerHitParticles(ped.mesh.root.position.clone());
          }
        }

        // TRAFFIC vs BUILDINGS (spatial grid — push back)
        const nearTrafficBldgs = queryGrid(
          buildingGrid,
          tc.root.position.x,
          tc.root.position.z,
        );
        for (let bi = 0; bi < nearTrafficBldgs.length; bi++) {
          const b = nearTrafficBldgs[bi];
          const bAABB: AABB = {
            minX: b.x - b.w / 2,
            maxX: b.x + b.w / 2,
            minZ: b.z - b.d / 2,
            maxZ: b.z + b.d / 2,
          };

          const tbOverlap = getOverlap(tcAABB, bAABB);
          if (tbOverlap) {
            const { overlapX, overlapZ } = tbOverlap;
            if (overlapX < overlapZ) {
              tc.root.position.x +=
                tc.root.position.x < b.x ? -overlapX : overlapX;
            } else {
              tc.root.position.z +=
                tc.root.position.z < b.z ? -overlapZ : overlapZ;
            }
            tc.speed *= 0.3;
          }
        }

        // TRAFFIC vs TREES (spatial grid)
        const nearTrafficTrees = queryGrid(
          treeGrid,
          tc.root.position.x,
          tc.root.position.z,
        );
        for (let tti = 0; tti < nearTrafficTrees.length; tti++) {
          const tree = nearTrafficTrees[tti];
          const treeAABB: AABB = {
            minX: tree.x - treeHalf,
            maxX: tree.x + treeHalf,
            minZ: tree.z - treeHalf,
            maxZ: tree.z + treeHalf,
          };

          const ttOverlap = getOverlap(tcAABB, treeAABB);
          if (ttOverlap) {
            const { overlapX, overlapZ } = ttOverlap;
            if (overlapX < overlapZ) {
              tc.root.position.x +=
                tc.root.position.x < tree.x ? -overlapX : overlapX;
            } else {
              tc.root.position.z +=
                tc.root.position.z < tree.z ? -overlapZ : overlapZ;
            }
            tc.speed *= 0.5;
          }
        }

        // TRAFFIC vs PARKED CARS (spatial grid)
        const nearTrafficParked = queryGrid(
          parkedCarGrid,
          tc.root.position.x,
          tc.root.position.z,
        );
        for (let tpi = 0; tpi < nearTrafficParked.length; tpi++) {
          const pc = nearTrafficParked[tpi];
          const pcAABB = getOrientedAABB(
            pc.x,
            pc.z,
            pc.rotY,
            pc.halfW,
            pc.halfD,
          );
          const tpcOverlap = getOverlap(tcAABB, pcAABB);
          if (tpcOverlap) {
            const { overlapX, overlapZ } = tpcOverlap;
            if (overlapX < overlapZ) {
              tc.root.position.x +=
                tc.root.position.x < pc.x ? -overlapX : overlapX;
            } else {
              tc.root.position.z +=
                tc.root.position.z < pc.z ? -overlapZ : overlapZ;
            }
            tc.speed *= 0.3;
          }
        }
      }
    }
  }

  // ======================================================
  // === ON-FOOT PLAYER COLLISION (circle vs AABB) ===
  // ======================================================
  const PLAYER_RADIUS = 0.4;

  function checkOnFootCollisions(playerMesh: Mesh, mode: PlayerMode): void {
    if (mode !== "on-foot") return;

    const px = playerMesh.position.x;
    const pz = playerMesh.position.z;

    // Player vs Buildings
    const nearBldgs = queryGrid(buildingGrid, px, pz);
    for (let i = 0; i < nearBldgs.length; i++) {
      const b = nearBldgs[i];
      // Closest point on building AABB to player
      const closestX = Math.max(b.x - b.w / 2, Math.min(px, b.x + b.w / 2));
      const closestZ = Math.max(b.z - b.d / 2, Math.min(pz, b.z + b.d / 2));
      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < PLAYER_RADIUS * PLAYER_RADIUS && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const push = PLAYER_RADIUS - dist;
        playerMesh.position.x += (dx / dist) * push;
        playerMesh.position.z += (dz / dist) * push;
      }
    }

    // Player vs Trees
    const nearTr = queryGrid(treeGrid, px, pz);
    for (let i = 0; i < nearTr.length; i++) {
      const t = nearTr[i];
      const dx = px - t.x;
      const dz = pz - t.z;
      const distSq = dx * dx + dz * dz;
      const minDist = PLAYER_RADIUS + treeHalf;

      if (distSq < minDist * minDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const push = minDist - dist;
        playerMesh.position.x += (dx / dist) * push;
        playerMesh.position.z += (dz / dist) * push;
      }
    }

    // Player vs Parked Cars
    const nearPC = queryGrid(parkedCarGrid, px, pz);
    for (let i = 0; i < nearPC.length; i++) {
      const pc = nearPC[i];
      const pcAABB = getOrientedAABB(pc.x, pc.z, pc.rotY, pc.halfW, pc.halfD);
      const closestX = Math.max(pcAABB.minX, Math.min(px, pcAABB.maxX));
      const closestZ = Math.max(pcAABB.minZ, Math.min(pz, pcAABB.maxZ));
      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < PLAYER_RADIUS * PLAYER_RADIUS && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const push = PLAYER_RADIUS - dist;
        playerMesh.position.x += (dx / dist) * push;
        playerMesh.position.z += (dz / dist) * push;
      }
    }

    // Player vs Traffic Cars (on foot — can get hit!)
    if (getTrafficCars) {
      const trafficList = getTrafficCars();
      for (let i = 0; i < trafficList.length; i++) {
        const tc = trafficList[i];
        if (!tc.active) continue;

        const tcAABB = getOrientedAABB(
          tc.root.position.x,
          tc.root.position.z,
          tc.root.rotation.y,
          trafficHalfW,
          trafficHalfD,
        );
        const closestX = Math.max(tcAABB.minX, Math.min(px, tcAABB.maxX));
        const closestZ = Math.max(tcAABB.minZ, Math.min(pz, tcAABB.maxZ));
        const dx = px - closestX;
        const dz = pz - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < PLAYER_RADIUS * PLAYER_RADIUS && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const push = PLAYER_RADIUS - dist + 0.3;
          playerMesh.position.x += (dx / dist) * push;
          playerMesh.position.z += (dz / dist) * push;

          // Getting hit by a traffic car hurts!
          if (tc.speed > 3) {
            const dmg = Math.min(40, tc.speed * 1.5);
            callbacks.onPlayerDamage(dmg);
            callbacks.triggerHitParticles(playerMesh.position.clone());
            tc.speed *= 0.5;
          }
        }
      }
    }

    // World boundary
    const limit = 395;
    playerMesh.position.x = Math.max(
      -limit,
      Math.min(limit, playerMesh.position.x),
    );
    playerMesh.position.z = Math.max(
      -limit,
      Math.min(limit, playerMesh.position.z),
    );
  }

  return {
    checkCollisions,
    checkOnFootCollisions,
    setTrafficGetter: (getter: () => TrafficCarData[]) => {
      getTrafficCars = getter;
    },
  };
}
