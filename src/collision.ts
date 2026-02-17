import { Vector3, Axis } from "@babylonjs/core";
import type { Mesh } from "@babylonjs/core";
import type {
  BuildingData,
  Pedestrian,
  DestructibleObject,
  CollisionCallbacks,
  CollisionResult,
} from "./types";

export function setupCollisions(
  carRoot: Mesh,
  buildingData: BuildingData[],
  pedestrians: Pedestrian[],
  destructibles: DestructibleObject[],
  callbacks: CollisionCallbacks,
): CollisionResult {
  const carHalfW = 1.1;
  const carHalfD = 2.25;
  const pedHalf = 0.35;

  let hitCount = 0;
  let collisionCooldown = 0;

  interface AABB {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  }

  function getCarAABB(): AABB {
    const angle = carRoot.rotation.y;
    const cosA = Math.abs(Math.cos(angle));
    const sinA = Math.abs(Math.sin(angle));

    const halfX = carHalfW * cosA + carHalfD * sinA;
    const halfZ = carHalfW * sinA + carHalfD * cosA;

    const cx = carRoot.position.x;
    const cz = carRoot.position.z;

    return {
      minX: cx - halfX,
      maxX: cx + halfX,
      minZ: cz - halfZ,
      maxZ: cz + halfZ,
    };
  }

  function checkCollisions(dt: number): void {
    if (collisionCooldown > 0) collisionCooldown -= dt;

    const carAABB = getCarAABB();
    const carSpeed = callbacks.getSpeed();
    const absSpeed = Math.abs(carSpeed);

    // === BUILDING COLLISIONS ===
    for (let i = 0; i < buildingData.length; i++) {
      const b = buildingData[i];
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
          if (cx < b.x) {
            carRoot.position.x -= overlapX;
          } else {
            carRoot.position.x += overlapX;
          }
        } else {
          if (cz < b.z) {
            carRoot.position.z -= overlapZ;
          } else {
            carRoot.position.z += overlapZ;
          }
        }

        if (absSpeed > 2 && collisionCooldown <= 0) {
          const contactX = Math.max(carAABB.minX, bMinX) + overlapX / 2;
          const contactZ = Math.max(carAABB.minZ, bMinZ) + overlapZ / 2;
          const contactPos = new Vector3(contactX, 0.8, contactZ);

          callbacks.onBuildingHit(contactPos);
          collisionCooldown = 0.5;
        }

        callbacks.setSpeed(0);
      }
    }

    // === PEDESTRIAN COLLISIONS ===
    for (let j = 0; j < pedestrians.length; j++) {
      const ped = pedestrians[j];
      if (!ped.alive || ped.flying) continue;

      const px = ped.mesh.root.position.x;
      const pz = ped.mesh.root.position.z;

      const pMinX = px - pedHalf;
      const pMaxX = px + pedHalf;
      const pMinZ = pz - pedHalf;
      const pMaxZ = pz + pedHalf;

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

    // === WORLD BOUNDARY ===
    const limit = 195;
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

    // === DESTRUCTIBLE OBJECT COLLISIONS ===
    for (let k = 0; k < destructibles.length; k++) {
      const obj = destructibles[k];

      // Update flying objects
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

      // Respawn timer
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

      // Check collision with car
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

        // Slight speed reduction on impact
        const newSpeed = carSpeed * 0.9;
        callbacks.setSpeed(newSpeed);
      }
    }
  }

  return { checkCollisions };
}
