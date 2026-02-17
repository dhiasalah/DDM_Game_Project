import type {
  Scene,
  ShadowGenerator,
  TransformNode,
  Mesh,
  Vector3,
} from "@babylonjs/core";

// ── Input ──
export type Keys = Record<string, boolean>;

// ── Lighting ──
export interface LightingResult {
  shadowGenerator: ShadowGenerator;
  glowLayer: import("@babylonjs/core").GlowLayer;
  pipeline: import("@babylonjs/core").DefaultRenderingPipeline;
  sunLight: import("@babylonjs/core").DirectionalLight;
}

// ── Environment ──
export interface BuildingData {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

export interface DestructibleObject {
  mesh: Mesh;
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  alive: boolean;
  flying: boolean;
  flyVelocity: import("@babylonjs/core").Vector3;
  flyTime: number;
  respawnTimer: number;
}

export interface EnvironmentResult {
  ground: Mesh;
  roads: Mesh[];
  buildingData: BuildingData[];
  destructibles: DestructibleObject[];
}

// ── Car ──
export interface CarResult {
  carRoot: Mesh;
  updateCar: (keys: Keys, dt: number) => number;
  getSpeed: () => number;
  setSpeed: (s: number) => void;
}

// ── Particles ──
export interface ParticlesResult {
  updateParticles: (keys: Keys, speed: number) => void;
  triggerCollisionSparks: (position: Vector3) => void;
  triggerHitParticles: (position: Vector3) => void;
}

// ── Pedestrians ──
export interface PedestrianMesh {
  root: TransformNode;
  head: Mesh;
  torso: Mesh;
  leftLeg: Mesh;
  rightLeg: Mesh;
  leftArm: Mesh;
  rightArm: Mesh;
}

export interface Pedestrian {
  mesh: PedestrianMesh;
  speed: number;
  direction: number;
  axis: "x" | "z";
  boundMin: number;
  boundMax: number;
  alive: boolean;
  respawnTimer: number;
  spawnX: number;
  spawnZ: number;
  walkPhase: number;
  flying: boolean;
  flyVelocity: Vector3;
  flyTime: number;
}

export interface PedestriansResult {
  pedestrians: Pedestrian[];
  updatePedestrians: (dt: number) => void;
}

// ── Collision ──
export interface CollisionCallbacks {
  getSpeed: () => number;
  setSpeed: (s: number) => void;
  onBuildingHit: (contactPos: Vector3) => void;
  onPedestrianHit: (hitPos: Vector3, hitCount: number) => void;
  onDestructibleHit: (obj: DestructibleObject) => void;
  onCheckpointHit: (index: number) => void;
}

export interface CollisionResult {
  checkCollisions: (dt: number) => void;
}

// ── Checkpoints ──
export interface Checkpoint {
  mesh: Mesh;
  x: number;
  z: number;
  radius: number;
  collected: boolean;
}

export interface CheckpointResult {
  checkpoints: Checkpoint[];
  updateCheckpoints: (dt: number) => void;
  getActiveIndex: () => number;
  getMissionTime: () => number;
  getMissionActive: () => boolean;
  getTotalCheckpoints: () => number;
  getCollectedCount: () => number;
  startMission: () => void;
}

// ── Police ──
export interface PoliceCar {
  mesh: Mesh;
  speed: number;
  active: boolean;
}

export interface PoliceResult {
  updatePolice: (dt: number) => void;
  getWantedLevel: () => number;
  addWantedHeat: (amount: number) => void;
}

// ── HUD ──
export interface HUDResult {
  updateSpeed: (speed: number, keys: Keys) => void;
  showCollisionText: (message: string, color: string) => void;
  updateKillCounter: (count: number) => void;
  updateCheckpointHUD: (
    active: boolean,
    collected: number,
    total: number,
    time: number,
    activeIndex: number,
  ) => void;
  updateWantedLevel: (level: number) => void;
  showMissionComplete: (time: number) => void;
}
