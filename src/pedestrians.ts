import {
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  Color3,
} from "@babylonjs/core";
import type { Scene, ShadowGenerator, Mesh } from "@babylonjs/core";
import type { Pedestrian, PedestrianMesh, PedestriansResult } from "./types";

interface SpawnData {
  x: number;
  z: number;
  axis: "x" | "z";
  min: number;
  max: number;
}

export function createPedestrians(
  scene: Scene,
  shadowGenerator: ShadowGenerator,
  carRoot: Mesh,
): PedestriansResult {
  const pedestrians: Pedestrian[] = [];

  // ============ COLOR PALETTES ============
  const skinColors = [
    new Color3(0.96, 0.8, 0.69),
    new Color3(0.87, 0.72, 0.53),
    new Color3(0.76, 0.57, 0.4),
    new Color3(0.55, 0.38, 0.26),
    new Color3(0.42, 0.28, 0.18),
  ];

  const shirtColors = [
    new Color3(0.2, 0.4, 0.8),
    new Color3(0.8, 0.2, 0.2),
    new Color3(0.2, 0.7, 0.3),
    new Color3(0.9, 0.9, 0.2),
    new Color3(0.9, 0.5, 0.1),
    new Color3(0.6, 0.2, 0.7),
    new Color3(0.9, 0.9, 0.9),
    new Color3(0.15, 0.15, 0.15),
  ];

  const pantsColors = [
    new Color3(0.15, 0.15, 0.4),
    new Color3(0.2, 0.2, 0.2),
    new Color3(0.5, 0.35, 0.2),
    new Color3(0.35, 0.35, 0.35),
  ];

  // ============ PRE-CREATE SHARED MATERIAL POOLS ============
  const skinMats = skinColors.map((c, i) => {
    const m = new StandardMaterial("skinMat_" + i, scene);
    m.diffuseColor = c;
    m.freeze();
    return m;
  });
  const shirtMats = shirtColors.map((c, i) => {
    const m = new StandardMaterial("shirtMat_" + i, scene);
    m.diffuseColor = c;
    m.freeze();
    return m;
  });
  const pantsMats = pantsColors.map((c, i) => {
    const m = new StandardMaterial("pantsMat_" + i, scene);
    m.diffuseColor = c;
    m.freeze();
    return m;
  });

  // ============ SPAWN DATA ============
  const spawnData: SpawnData[] = [
    { x: 9, z: -30, axis: "z", min: -60, max: 0 },
    { x: -9, z: -50, axis: "z", min: -80, max: -20 },
    { x: 9, z: -80, axis: "z", min: -110, max: -50 },
    { x: -9, z: 30, axis: "z", min: 10, max: 55 },
    { x: 9, z: 50, axis: "z", min: 20, max: 80 },
    { x: 3, z: -40, axis: "z", min: -70, max: -10 },
    { x: -3, z: 40, axis: "z", min: 10, max: 70 },
    { x: 20, z: -5, axis: "x", min: 10, max: 50 },
    { x: -20, z: 5, axis: "x", min: -50, max: -10 },
    { x: 35, z: 3, axis: "x", min: 10, max: 55 },
    { x: 68, z: -40, axis: "z", min: -70, max: -10 },
    { x: 52, z: -60, axis: "z", min: -90, max: -30 },
    { x: 20, z: 68, axis: "x", min: 10, max: 50 },
    { x: -20, z: 52, axis: "x", min: -50, max: -10 },
    { x: -4, z: -100, axis: "z", min: -130, max: -70 },
  ];

  // ============ CREATE PEDESTRIAN MESH ============
  function createPedestrianMesh(
    index: number,
    data: SpawnData,
  ): PedestrianMesh {
    const root = new TransformNode("ped_" + index, scene);
    root.position = new Vector3(data.x, 0.15, data.z);

    // Pick from shared material pools
    const skinMat = skinMats[Math.floor(Math.random() * skinMats.length)];
    const shirtMat = shirtMats[Math.floor(Math.random() * shirtMats.length)];
    const pantsMat = pantsMats[Math.floor(Math.random() * pantsMats.length)];

    const head = MeshBuilder.CreateSphere(
      "pedHead_" + index,
      { diameter: 0.32, segments: 8 },
      scene,
    );
    head.position.y = 1.56;
    head.parent = root;
    head.material = skinMat;

    const torso = MeshBuilder.CreateBox(
      "pedTorso_" + index,
      { width: 0.45, height: 0.6, depth: 0.25 },
      scene,
    );
    torso.position.y = 1.1;
    torso.parent = root;
    torso.material = shirtMat;

    const leftLeg = MeshBuilder.CreateBox(
      "pedLL_" + index,
      { width: 0.16, height: 0.7, depth: 0.16 },
      scene,
    );
    leftLeg.position.set(-0.12, 0.45, 0);
    leftLeg.parent = root;
    leftLeg.material = pantsMat;

    const rightLeg = MeshBuilder.CreateBox(
      "pedRL_" + index,
      { width: 0.16, height: 0.7, depth: 0.16 },
      scene,
    );
    rightLeg.position.set(0.12, 0.45, 0);
    rightLeg.parent = root;
    rightLeg.material = pantsMat;

    const leftArm = MeshBuilder.CreateBox(
      "pedLA_" + index,
      { width: 0.13, height: 0.5, depth: 0.13 },
      scene,
    );
    leftArm.position.set(-0.33, 1.05, 0);
    leftArm.parent = root;
    leftArm.material = shirtMat;

    const rightArm = MeshBuilder.CreateBox(
      "pedRA_" + index,
      { width: 0.13, height: 0.5, depth: 0.13 },
      scene,
    );
    rightArm.position.set(0.33, 1.05, 0);
    rightArm.parent = root;
    rightArm.material = shirtMat;

    // Only add torso as shadow caster (skip head — saves draw calls)
    shadowGenerator.addShadowCaster(torso);

    if (data.axis === "x") {
      root.rotation.y = Math.PI / 2;
    }

    return { root, head, torso, leftLeg, rightLeg, leftArm, rightArm };
  }

  // ============ SPAWN ALL PEDESTRIANS ============
  spawnData.forEach((data, i) => {
    const mesh = createPedestrianMesh(i, data);
    const speed = 1.5 + Math.random() * 1.5;
    const direction = Math.random() > 0.5 ? 1 : -1;

    pedestrians.push({
      mesh,
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
    });
  });

  // ============ UPDATE FUNCTION ============
  function updatePedestrians(dt: number): void {
    pedestrians.forEach((ped) => {
      // --- FLYING (death animation) ---
      if (ped.flying) {
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

      // --- DEAD, WAITING TO RESPAWN ---
      if (!ped.alive) {
        ped.respawnTimer -= dt;
        if (ped.respawnTimer <= 0) {
          ped.alive = true;
          ped.mesh.root.position.set(ped.spawnX, 0.15, ped.spawnZ);
          ped.mesh.root.rotation.set(0, ped.axis === "x" ? Math.PI / 2 : 0, 0);
          ped.mesh.root.setEnabled(true);
          ped.direction = Math.random() > 0.5 ? 1 : -1;
          ped.mesh.leftLeg.rotation.x = 0;
          ped.mesh.rightLeg.rotation.x = 0;
          ped.mesh.leftArm.rotation.x = 0;
          ped.mesh.rightArm.rotation.x = 0;
        }
        return;
      }

      // --- ALIVE: WALK ALONG PATROL PATH ---
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

      // Walking animation — only for nearby peds (distance culling)
      const dx = ped.mesh.root.position.x - carRoot.position.x;
      const dz = ped.mesh.root.position.z - carRoot.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < 6400) {
        // 80 * 80
        ped.walkPhase += dt * ped.speed * 4;
        const swing = Math.sin(ped.walkPhase) * 0.4;
        ped.mesh.leftLeg.rotation.x = swing;
        ped.mesh.rightLeg.rotation.x = -swing;
        ped.mesh.leftArm.rotation.x = -swing * 0.8;
        ped.mesh.rightArm.rotation.x = swing * 0.8;
      }
    });
  }

  return { pedestrians, updatePedestrians };
}
