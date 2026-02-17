import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
} from "@babylonjs/core";
import type { Scene, Mesh } from "@babylonjs/core";
import type { Checkpoint, CheckpointResult } from "./types";

export function createCheckpoints(
  scene: Scene,
  carRoot: Mesh,
): CheckpointResult {
  const checkpoints: Checkpoint[] = [];

  // Checkpoint positions — placed at road intersections and along roads
  const cpPositions = [
    { x: 0, z: 30 },
    { x: 30, z: 60 },
    { x: 60, z: 30 },
    { x: 60, z: -30 },
    { x: 30, z: 0 },
    { x: 0, z: -60 },
    { x: -30, z: 0 },
    { x: 0, z: 90 },
    { x: 60, z: -80 },
    { x: -30, z: -60 },
  ];

  // Materials
  const activeMat = new StandardMaterial("cpActiveMat", scene);
  activeMat.diffuseColor = new Color3(0.1, 1.0, 0.3);
  activeMat.emissiveColor = new Color3(0.05, 0.6, 0.15);
  activeMat.alpha = 0.6;

  const inactiveMat = new StandardMaterial("cpInactiveMat", scene);
  inactiveMat.diffuseColor = new Color3(0.3, 0.3, 0.35);
  inactiveMat.emissiveColor = new Color3(0.05, 0.05, 0.08);
  inactiveMat.alpha = 0.3;

  const collectedMat = new StandardMaterial("cpCollectedMat", scene);
  collectedMat.diffuseColor = new Color3(0.2, 0.2, 0.2);
  collectedMat.alpha = 0.15;

  cpPositions.forEach((pos, i) => {
    const ring = MeshBuilder.CreateTorus(
      "checkpoint_" + i,
      { diameter: 6, thickness: 0.5, tessellation: 24 },
      scene,
    );
    ring.position.set(pos.x, 1.5, pos.z);
    ring.material = inactiveMat;

    // Add a vertical pillar as visual marker
    const pillar = MeshBuilder.CreateCylinder(
      "cpPillar_" + i,
      { diameter: 0.3, height: 8 },
      scene,
    );
    pillar.position.set(pos.x, 4, pos.z);
    pillar.material = inactiveMat;
    pillar.parent = ring;
    pillar.position = Vector3.Zero();
    pillar.position.y = 2.5;

    checkpoints.push({
      mesh: ring,
      x: pos.x,
      z: pos.z,
      radius: 4,
      collected: false,
    });
  });

  // Mission state
  let missionActive = false;
  let missionTime = 0;
  let activeIndex = 0;
  let collectedCount = 0;
  let spinAngle = 0;

  function startMission(): void {
    missionActive = true;
    missionTime = 0;
    activeIndex = 0;
    collectedCount = 0;

    checkpoints.forEach((cp, i) => {
      cp.collected = false;
      cp.mesh.material = i === 0 ? activeMat : inactiveMat;
      cp.mesh.setEnabled(true);
    });
  }

  function updateCheckpoints(dt: number): void {
    // Spin animation for checkpoint rings
    spinAngle += dt * 1.5;
    checkpoints.forEach((cp) => {
      if (!cp.collected) {
        cp.mesh.rotation.y = spinAngle;
        cp.mesh.rotation.x = Math.sin(spinAngle * 0.7) * 0.15;
      }
    });

    if (!missionActive) return;

    missionTime += dt;

    // Check if car is inside the active checkpoint
    if (activeIndex < checkpoints.length) {
      const cp = checkpoints[activeIndex];
      const dx = carRoot.position.x - cp.x;
      const dz = carRoot.position.z - cp.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < cp.radius * cp.radius) {
        // Collected!
        cp.collected = true;
        cp.mesh.material = collectedMat;
        collectedCount++;

        activeIndex++;

        // Highlight next checkpoint
        if (activeIndex < checkpoints.length) {
          checkpoints[activeIndex].mesh.material = activeMat;
        } else {
          // All collected — mission complete
          missionActive = false;
        }
      }
    }
  }

  function getActiveIndex(): number {
    return activeIndex;
  }

  function getMissionTime(): number {
    return missionTime;
  }

  function getMissionActive(): boolean {
    return missionActive;
  }

  function getTotalCheckpoints(): number {
    return checkpoints.length;
  }

  function getCollectedCount(): number {
    return collectedCount;
  }

  // Auto-start mission after 6 seconds
  setTimeout(() => {
    startMission();
  }, 6000);

  return {
    checkpoints,
    updateCheckpoints,
    getActiveIndex,
    getMissionTime,
    getMissionActive,
    getTotalCheckpoints,
    getCollectedCount,
    startMission,
  };
}
