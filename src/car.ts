import {
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  SpotLight,
  TransformNode,
  Vector3,
  Color3,
  Axis,
} from "@babylonjs/core";
import type { Scene, ShadowGenerator, Mesh } from "@babylonjs/core";
import type { Keys, CarResult } from "./types";

// Cached Color3 values for taillight emissive (avoid per-frame allocation)
const BRAKE_EMISSIVE = new Color3(1.0, 0.15, 0.05);
const IDLE_EMISSIVE = new Color3(0.8, 0.05, 0.02);

export function createCar(
  scene: Scene,
  shadowGenerator: ShadowGenerator,
): CarResult {
  // ============ CAR ROOT = BODY MESH ============
  const carRoot = MeshBuilder.CreateBox(
    "carBody",
    { width: 2.2, height: 0.55, depth: 4.5 },
    scene,
  );
  carRoot.position = new Vector3(0, 1.5, -20);
  carRoot.isVisible = true;

  const bodyMat = new PBRMaterial("carBodyMat", scene);
  bodyMat.albedoColor = new Color3(0.85, 0.12, 0.1);
  bodyMat.metallic = 0.8;
  bodyMat.roughness = 0.25;
  bodyMat.clearCoat.isEnabled = true;
  bodyMat.clearCoat.intensity = 1.0;
  carRoot.material = bodyMat;

  // ============ CABIN ============
  const cabin = MeshBuilder.CreateBox(
    "cabin",
    { width: 1.8, height: 0.6, depth: 2.2 },
    scene,
  );
  cabin.position.set(0, 0.55, -0.15);
  cabin.parent = carRoot;

  const cabinMat = new PBRMaterial("cabinMat", scene);
  cabinMat.albedoColor = new Color3(0.15, 0.2, 0.35);
  cabinMat.metallic = 0.3;
  cabinMat.roughness = 0.1;
  cabinMat.alpha = 0.65;
  cabin.material = cabinMat;

  // ============ HOOD ============
  const hood = MeshBuilder.CreateBox(
    "hood",
    { width: 2.1, height: 0.15, depth: 1.5 },
    scene,
  );
  hood.position.set(0, 0.32, 1.2);
  hood.parent = carRoot;
  hood.material = bodyMat;

  // ============ TRUNK ============
  const trunk = MeshBuilder.CreateBox(
    "trunk",
    { width: 2.1, height: 0.15, depth: 1.0 },
    scene,
  );
  trunk.position.set(0, 0.32, -1.5);
  trunk.parent = carRoot;
  trunk.material = bodyMat;

  // ============ FRONT BUMPER ============
  const frontBumper = MeshBuilder.CreateBox(
    "frontBumper",
    { width: 2.3, height: 0.35, depth: 0.3 },
    scene,
  );
  frontBumper.position.set(0, -0.15, 2.25);
  frontBumper.parent = carRoot;

  const bumperMat = new PBRMaterial("bumperMat", scene);
  bumperMat.albedoColor = new Color3(0.15, 0.15, 0.18);
  bumperMat.metallic = 0.6;
  bumperMat.roughness = 0.5;
  frontBumper.material = bumperMat;

  // ============ REAR BUMPER ============
  const rearBumper = MeshBuilder.CreateBox(
    "rearBumper",
    { width: 2.3, height: 0.35, depth: 0.3 },
    scene,
  );
  rearBumper.position.set(0, -0.15, -2.25);
  rearBumper.parent = carRoot;
  rearBumper.material = bumperMat;

  // ============ SPOILER ============
  const spoilerBase = MeshBuilder.CreateBox(
    "spoilerBase",
    { width: 1.6, height: 0.06, depth: 0.5 },
    scene,
  );
  spoilerBase.position.set(0, 0.95, -1.8);
  spoilerBase.parent = carRoot;
  spoilerBase.material = bodyMat;

  const supportL = MeshBuilder.CreateCylinder(
    "spoilerSuppL",
    { diameter: 0.08, height: 0.4 },
    scene,
  );
  supportL.position.set(-0.5, 0.75, -1.8);
  supportL.parent = carRoot;
  supportL.material = bumperMat;

  const supportR = MeshBuilder.CreateCylinder(
    "spoilerSuppR",
    { diameter: 0.08, height: 0.4 },
    scene,
  );
  supportR.position.set(0.5, 0.75, -1.8);
  supportR.parent = carRoot;
  supportR.material = bumperMat;

  // ============ HEADLIGHTS ============
  const headlightMat = new StandardMaterial("headlightMat", scene);
  headlightMat.diffuseColor = new Color3(1, 1, 0.9);
  headlightMat.emissiveColor = new Color3(1, 0.95, 0.8);

  const headlightL = MeshBuilder.CreateSphere(
    "headlightL",
    { diameter: 0.35, segments: 8 },
    scene,
  );
  headlightL.position.set(-0.75, 0.05, 2.3);
  headlightL.parent = carRoot;
  headlightL.material = headlightMat;

  const headlightR = MeshBuilder.CreateSphere(
    "headlightR",
    { diameter: 0.35, segments: 8 },
    scene,
  );
  headlightR.position.set(0.75, 0.05, 2.3);
  headlightR.parent = carRoot;
  headlightR.material = headlightMat;

  const hlSpotL = new SpotLight(
    "hlSpotL",
    new Vector3(-0.75, 0.05, 2.3),
    new Vector3(0, -0.15, 1),
    Math.PI / 4,
    10,
    scene,
  );
  hlSpotL.parent = carRoot;
  hlSpotL.diffuse = new Color3(1, 0.95, 0.8);
  hlSpotL.intensity = 2;
  hlSpotL.range = 40;

  const hlSpotR = new SpotLight(
    "hlSpotR",
    new Vector3(0.75, 0.05, 2.3),
    new Vector3(0, -0.15, 1),
    Math.PI / 4,
    10,
    scene,
  );
  hlSpotR.parent = carRoot;
  hlSpotR.diffuse = new Color3(1, 0.95, 0.8);
  hlSpotR.intensity = 2;
  hlSpotR.range = 40;

  // ============ TAILLIGHTS ============
  const taillightMat = new StandardMaterial("taillightMat", scene);
  taillightMat.diffuseColor = new Color3(1, 0.1, 0.05);
  taillightMat.emissiveColor = new Color3(0.8, 0.05, 0.02);

  const taillightL = MeshBuilder.CreateBox(
    "taillightL",
    { width: 0.4, height: 0.15, depth: 0.08 },
    scene,
  );
  taillightL.position.set(-0.75, 0.05, -2.35);
  taillightL.parent = carRoot;
  taillightL.material = taillightMat;

  const taillightR = MeshBuilder.CreateBox(
    "taillightR",
    { width: 0.4, height: 0.15, depth: 0.08 },
    scene,
  );
  taillightR.position.set(0.75, 0.05, -2.35);
  taillightR.parent = carRoot;
  taillightR.material = taillightMat;

  // ============ WHEELS ============
  const wheelMat = new PBRMaterial("wheelMat", scene);
  wheelMat.albedoColor = new Color3(0.08, 0.08, 0.1);
  wheelMat.metallic = 0.2;
  wheelMat.roughness = 0.9;

  const rimMat = new PBRMaterial("rimMat", scene);
  rimMat.albedoColor = new Color3(0.7, 0.7, 0.75);
  rimMat.metallic = 0.95;
  rimMat.roughness = 0.15;

  interface WheelEntry {
    node: TransformNode;
    tire: Mesh;
    rim: Mesh;
    front: boolean;
  }

  const wheels: WheelEntry[] = [];
  const wheelPositions = [
    { name: "wheelFL", x: -1.1, y: -0.25, z: 1.4, front: true },
    { name: "wheelFR", x: 1.1, y: -0.25, z: 1.4, front: true },
    { name: "wheelRL", x: -1.1, y: -0.25, z: -1.4, front: false },
    { name: "wheelRR", x: 1.1, y: -0.25, z: -1.4, front: false },
  ];

  wheelPositions.forEach((wp) => {
    const tire = MeshBuilder.CreateTorus(
      wp.name + "_tire",
      { diameter: 0.65, thickness: 0.22, tessellation: 24 },
      scene,
    );

    const rim = MeshBuilder.CreateCylinder(
      wp.name + "_rim",
      { diameter: 0.5, height: 0.15 },
      scene,
    );
    rim.material = rimMat;
    rim.rotation.x = Math.PI / 2;

    const wheelNode = new TransformNode(wp.name, scene);
    tire.parent = wheelNode;
    rim.parent = wheelNode;
    tire.material = wheelMat;

    wheelNode.position.set(wp.x, wp.y, wp.z);
    wheelNode.rotation.z = Math.PI / 2;
    wheelNode.parent = carRoot;

    wheels.push({ node: wheelNode, tire, rim, front: wp.front });
  });

  // ============ SHADOW CASTERS ============
  shadowGenerator.addShadowCaster(carRoot);
  shadowGenerator.addShadowCaster(cabin);
  shadowGenerator.addShadowCaster(hood);
  shadowGenerator.addShadowCaster(trunk);

  // ============ NO PHYSICS — MANUAL ARCADE MOVEMENT ============
  const groundY = 0.55;
  carRoot.position.y = groundY;

  // ============ UPDATE FUNCTION ============
  let currentSpeed = 0;
  const maxForwardSpeed = 45;
  const maxReverseSpeed = 15;
  const accelRate = 20;
  const reverseRate = 15;
  const brakeRate = 35;
  const dragRate = 5;
  const steerSpeed = 2.5;
  let wheelSpinAngle = 0;
  let steerAngle = 0;

  function updateCar(keys: Keys, deltaTime: number): number {
    // === ACCELERATION ===
    if (keys["w"] || keys["arrowup"]) {
      currentSpeed += accelRate * deltaTime;
      if (currentSpeed > maxForwardSpeed) currentSpeed = maxForwardSpeed;
    }

    // === REVERSE ===
    if (keys["s"] || keys["arrowdown"]) {
      currentSpeed -= reverseRate * deltaTime;
      if (currentSpeed < -maxReverseSpeed) currentSpeed = -maxReverseSpeed;
    }

    // === BRAKING ===
    if (keys[" "]) {
      if (currentSpeed > 0) {
        currentSpeed -= brakeRate * deltaTime;
        if (currentSpeed < 0) currentSpeed = 0;
      } else if (currentSpeed < 0) {
        currentSpeed += brakeRate * deltaTime;
        if (currentSpeed > 0) currentSpeed = 0;
      }
      taillightMat.emissiveColor = BRAKE_EMISSIVE;
    } else {
      taillightMat.emissiveColor = IDLE_EMISSIVE;
    }

    // === NATURAL DRAG ===
    if (
      !(keys["w"] || keys["arrowup"]) &&
      !(keys["s"] || keys["arrowdown"]) &&
      !keys[" "]
    ) {
      if (currentSpeed > 0) {
        currentSpeed -= dragRate * deltaTime;
        if (currentSpeed < 0) currentSpeed = 0;
      } else if (currentSpeed < 0) {
        currentSpeed += dragRate * deltaTime;
        if (currentSpeed > 0) currentSpeed = 0;
      }
    }

    // === STEERING ===
    const absSpeed = Math.abs(currentSpeed);
    let targetSteer = 0;
    if (absSpeed > 0.5) {
      const turnAmount = steerSpeed * deltaTime;
      const speedFactor =
        Math.min(absSpeed / 5, 1.0) * Math.max(0.3, 1.0 - absSpeed / 80);
      const turnDir = currentSpeed >= 0 ? 1 : -1;

      if (keys["a"] || keys["arrowleft"]) {
        carRoot.rotation.y -= turnAmount * speedFactor * turnDir;
        targetSteer = -0.4;
      }
      if (keys["d"] || keys["arrowright"]) {
        carRoot.rotation.y += turnAmount * speedFactor * turnDir;
        targetSteer = 0.4;
      }
    }

    // === MOVE THE CAR ===
    const forward = carRoot.getDirection(Axis.Z);
    carRoot.position.addInPlace(forward.scale(currentSpeed * deltaTime));

    carRoot.position.y = groundY;

    // === VISUAL WHEEL ANIMATION ===
    wheelSpinAngle += currentSpeed * deltaTime * 3;
    steerAngle += (targetSteer - steerAngle) * 0.15;

    wheels.forEach((w) => {
      w.tire.rotation.y = wheelSpinAngle;
      w.rim.rotation.y = wheelSpinAngle;
      if (w.front) {
        w.node.rotation.y = steerAngle;
      }
    });

    return Math.abs(currentSpeed) * 3.6;
  }

  function getSpeed(): number {
    return currentSpeed;
  }

  function setSpeed(s: number): void {
    currentSpeed = s;
  }

  return { carRoot, updateCar, getSpeed, setSpeed };
}
