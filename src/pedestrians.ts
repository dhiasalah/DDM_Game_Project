import { TransformNode, Vector3 } from "@babylonjs/core";
import type { Scene, ShadowGenerator, Mesh } from "@babylonjs/core";
import type { Pedestrian, PedestrianMesh, PedestriansResult } from "./types";
import {
  playLoop,
  playOneShot,
  type CharacterAnimationController,
} from "./animations";
import {
  createProceduralCharacter,
  randomPedestrianColors,
} from "./proceduralCharacter";

interface SpawnData {
  x: number;
  z: number;
  axis: "x" | "z";
  min: number;
  max: number;
}

function placeholderPedMesh(root: TransformNode): PedestrianMesh {
  return {
    root,
  };
}

export function createPedestrians(
  scene: Scene,
  shadowGenerator: ShadowGenerator,
  carRoot: Mesh,
): PedestriansResult {
  const pedestrians: Pedestrian[] = [];
  const pedAnimations = new Map<Pedestrian, CharacterAnimationController>();
  const hadFlyingState = new Set<Pedestrian>();

  const spawnData: SpawnData[] = [
    { x: 9, z: -30, axis: "z", min: -60, max: 0 },
    { x: -9, z: -50, axis: "z", min: -80, max: -20 },
    { x: 9, z: 50, axis: "z", min: 20, max: 80 },
    { x: -9, z: 30, axis: "z", min: 10, max: 55 },
    { x: 20, z: -5, axis: "x", min: 10, max: 50 },
    { x: -20, z: 5, axis: "x", min: -50, max: -10 },
    { x: 59, z: -80, axis: "z", min: -120, max: -40 },
    { x: -59, z: -60, axis: "z", min: -100, max: -20 },
    { x: 59, z: 70, axis: "z", min: 30, max: 110 },
    { x: -59, z: 80, axis: "z", min: 40, max: 120 },
    { x: 80, z: -9, axis: "x", min: 55, max: 110 },
    { x: -80, z: 9, axis: "x", min: -110, max: -55 },
    { x: 110, z: -9, axis: "x", min: 60, max: 140 },
    { x: -110, z: 9, axis: "x", min: -140, max: -60 },
    { x: 159, z: -30, axis: "z", min: -70, max: 10 },
    { x: -159, z: 30, axis: "z", min: -10, max: 70 },
    { x: 9, z: -180, axis: "z", min: -220, max: -140 },
    { x: -9, z: 180, axis: "z", min: 140, max: 220 },
    { x: 209, z: -60, axis: "z", min: -100, max: -20 },
    { x: -209, z: 60, axis: "z", min: 20, max: 100 },
    { x: 259, z: 9, axis: "x", min: 210, max: 300 },
    { x: -259, z: -9, axis: "x", min: -300, max: -210 },
    { x: 9, z: -280, axis: "z", min: -330, max: -240 },
    { x: -9, z: 280, axis: "z", min: 240, max: 330 },
    { x: 59, z: 200, axis: "z", min: 160, max: 240 },
    { x: -59, z: -200, axis: "z", min: -240, max: -160 },
    { x: 159, z: 150, axis: "z", min: 110, max: 190 },
    { x: -159, z: -150, axis: "z", min: -190, max: -110 },
    { x: 200, z: 59, axis: "x", min: 160, max: 240 },
    { x: -200, z: -59, axis: "x", min: -240, max: -160 },
    { x: 309, z: -40, axis: "z", min: -80, max: 0 },
    { x: -309, z: 40, axis: "z", min: 0, max: 80 },
    { x: 9, z: 330, axis: "z", min: 290, max: 370 },
    { x: -9, z: -330, axis: "z", min: -370, max: -290 },
    { x: 100, z: -200, axis: "z", min: -240, max: -160 },
    { x: -100, z: 200, axis: "z", min: 160, max: 240 },
    { x: 59, z: -300, axis: "z", min: -340, max: -260 },
    { x: -59, z: 300, axis: "z", min: 260, max: 340 },
    { x: 250, z: -150, axis: "z", min: -190, max: -110 },
    { x: -250, z: 150, axis: "z", min: 110, max: 190 },
  ];

  function createPedestrianMesh(
    index: number,
    data: SpawnData,
  ): { mesh: PedestrianMesh; anim: CharacterAnimationController } {
    // Create procedural character with random colors for variety
    const colors = randomPedestrianColors();
    const { root, animController } = createProceduralCharacter(
      scene,
      shadowGenerator,
      colors,
    );

    root.name = `ped_${index}`;
    root.position = new Vector3(data.x, 0, data.z);

    // Random height variation
    const scale = 0.85 + Math.random() * 0.2;
    root.scaling.setAll(scale);

    if (data.axis === "x") {
      root.rotation.y = Math.PI / 2;
    }

    playLoop(
      animController,
      animController.clips.idle ?? animController.clips.walk,
      1,
    );

    return {
      mesh: placeholderPedMesh(root),
      anim: animController,
    };
  }

  const created = spawnData.map((data, i) => createPedestrianMesh(i, data));

  spawnData.forEach((data, i) => {
    const createdPed = created[i];
    const speed = 1.5 + Math.random() * 1.5;
    const direction = Math.random() > 0.5 ? 1 : -1;

    const ped: Pedestrian = {
      mesh: createdPed.mesh,
      speed,
      direction,
      axis: data.axis,
      boundMin: data.min,
      boundMax: data.max,
      alive: true,
      respawnTimer: 0,
      spawnX: data.x,
      spawnZ: data.z,
      walkPhase: Math.random() * Math.PI * 2,
      flying: false,
      flyVelocity: new Vector3(0, 0, 0),
      flyTime: 0,
      fleeing: false,
      fleeTimer: 0,
      fleeX: 0,
      fleeZ: 0,
    };

    pedestrians.push(ped);
    pedAnimations.set(ped, createdPed.anim);
  });

  function startFlee(
    ped: Pedestrian,
    pedX: number,
    pedZ: number,
    dangerX: number,
    dangerZ: number,
  ): void {
    ped.fleeing = true;
    ped.fleeTimer = FLEE_DURATION;
    const dx = pedX - dangerX;
    const dz = pedZ - dangerZ;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
    ped.fleeX = dx / dist + (Math.random() - 0.5) * 0.5;
    ped.fleeZ = dz / dist + (Math.random() - 0.5) * 0.5;
    const fLen = Math.sqrt(ped.fleeX * ped.fleeX + ped.fleeZ * ped.fleeZ) || 1;
    ped.fleeX /= fLen;
    ped.fleeZ /= fLen;
  }

  const FLEE_DETECT_DIST = 12;
  const FLEE_SPEED = 5;
  const FLEE_DURATION = 2.5;

  let getTrafficPositions:
    | (() => { x: number; z: number; speed: number; rotY: number }[])
    | null = null;

  function updatePedestrians(dt: number): void {
    const carX = carRoot.position.x;
    const carZ = carRoot.position.z;

    pedestrians.forEach((ped) => {
      const anim = pedAnimations.get(ped);
      if (!anim) {
        return;
      }

      if (ped.flying) {
        if (!hadFlyingState.has(ped)) {
          hadFlyingState.add(ped);
          playOneShot(anim, anim.clips.deathOrHit ?? anim.clips.attack, 1);
        }

        ped.flyTime += dt;
        ped.flyVelocity.y -= 9.81 * dt;
        ped.mesh.root.position.addInPlace(ped.flyVelocity.scale(dt));

        ped.mesh.root.rotation.x += 5 * dt;
        ped.mesh.root.rotation.z += 3 * dt;

        if (ped.flyTime > 3 || ped.mesh.root.position.y < -2) {
          ped.flying = false;
          ped.mesh.root.setEnabled(false);
          ped.respawnTimer = 10;
        }
        return;
      }

      if (!ped.alive) {
        ped.respawnTimer -= dt;
        if (ped.respawnTimer <= 0) {
          ped.alive = true;
          ped.fleeing = false;
          ped.fleeTimer = 0;
          hadFlyingState.delete(ped);
          ped.mesh.root.position.set(ped.spawnX, 0, ped.spawnZ);
          ped.mesh.root.rotation.set(0, ped.axis === "x" ? Math.PI / 2 : 0, 0);
          ped.mesh.root.setEnabled(true);
          ped.direction = Math.random() > 0.5 ? 1 : -1;
          playLoop(anim, anim.clips.idle ?? anim.clips.walk, 1);
        }
        return;
      }

      const pedX = ped.mesh.root.position.x;
      const pedZ = ped.mesh.root.position.z;

      if (!ped.fleeing) {
        const dxC = pedX - carX;
        const dzC = pedZ - carZ;
        const distSqC = dxC * dxC + dzC * dzC;

        if (distSqC < FLEE_DETECT_DIST * FLEE_DETECT_DIST && distSqC < 64) {
          startFlee(ped, pedX, pedZ, carX, carZ);
        }

        if (!ped.fleeing && getTrafficPositions) {
          const trafficList = getTrafficPositions();
          for (let t = 0; t < trafficList.length; t++) {
            const tc = trafficList[t];
            if (tc.speed < 5) continue;
            const dxT = pedX - tc.x;
            const dzT = pedZ - tc.z;
            const distSqT = dxT * dxT + dzT * dzT;
            if (distSqT < 64) {
              startFlee(ped, pedX, pedZ, tc.x, tc.z);
              break;
            }
          }
        }
      }

      if (ped.fleeing) {
        ped.fleeTimer -= dt;
        if (ped.fleeTimer <= 0) {
          ped.fleeing = false;
        } else {
          ped.mesh.root.position.x += ped.fleeX * FLEE_SPEED * dt;
          ped.mesh.root.position.z += ped.fleeZ * FLEE_SPEED * dt;

          ped.mesh.root.position.x = Math.max(
            -395,
            Math.min(395, ped.mesh.root.position.x),
          );
          ped.mesh.root.position.z = Math.max(
            -395,
            Math.min(395, ped.mesh.root.position.z),
          );

          ped.mesh.root.rotation.y = Math.atan2(ped.fleeX, ped.fleeZ);
          playLoop(anim, anim.clips.run ?? anim.clips.walk, 1.15);
          return;
        }
      }

      const moveAmount = ped.speed * ped.direction * dt;

      if (ped.axis === "z") {
        ped.mesh.root.position.z += moveAmount;
        if (ped.mesh.root.position.z > ped.boundMax) {
          ped.mesh.root.position.z = ped.boundMax;
          ped.direction = -1;
          ped.mesh.root.rotation.y = Math.PI;
        } else if (ped.mesh.root.position.z < ped.boundMin) {
          ped.mesh.root.position.z = ped.boundMin;
          ped.direction = 1;
          ped.mesh.root.rotation.y = 0;
        }
      } else {
        ped.mesh.root.position.x += moveAmount;
        if (ped.mesh.root.position.x > ped.boundMax) {
          ped.mesh.root.position.x = ped.boundMax;
          ped.direction = -1;
          ped.mesh.root.rotation.y = -Math.PI / 2;
        } else if (ped.mesh.root.position.x < ped.boundMin) {
          ped.mesh.root.position.x = ped.boundMin;
          ped.direction = 1;
          ped.mesh.root.rotation.y = Math.PI / 2;
        }
      }

      const dx = ped.mesh.root.position.x - carRoot.position.x;
      const dz = ped.mesh.root.position.z - carRoot.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < 10000) {
        playLoop(
          anim,
          anim.clips.walk ?? anim.clips.idle,
          Math.max(0.7, ped.speed / 2),
        );
      }
    });
  }

  return {
    pedestrians,
    updatePedestrians,
    setTrafficGetter: (
      getter: () => { x: number; z: number; speed: number; rotY: number }[],
    ) => {
      getTrafficPositions = getter;
    },
  };
}
