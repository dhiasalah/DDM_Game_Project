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

export interface TreeData {
  x: number;
  z: number;
}

export interface ParkedCarData {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  rotY: number;
}

export interface IntersectionData {
  x: number;
  z: number;
}

export interface EnvironmentResult {
  ground: Mesh;
  roads: Mesh[];
  buildingData: BuildingData[];
  destructibles: DestructibleObject[];
  treeData: TreeData[];
  parkedCars: ParkedCarData[];
  intersections: IntersectionData[];
  updateVisibility: (playerX: number, playerZ: number) => void;
}

// ── Car ──
export interface CarResult {
  carRoot: Mesh;
  updateCar: (keys: Keys, dt: number) => number;
  getSpeed: () => number;
  setSpeed: (s: number) => void;
  setVehicleStats: (stats: VehicleStats) => void;
  setBodyColor: (color: import("@babylonjs/core").Color3) => void;
  getCurrentVehicleType: () => string;
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
  head?: Mesh;
  torso?: Mesh;
  leftLeg?: Mesh;
  rightLeg?: Mesh;
  leftArm?: Mesh;
  rightArm?: Mesh;
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
  // Reactive AI
  fleeing: boolean;
  fleeTimer: number;
  fleeX: number;
  fleeZ: number;
}

export interface PedestriansResult {
  pedestrians: Pedestrian[];
  updatePedestrians: (dt: number) => void;
  setTrafficGetter: (
    getter: () => { x: number; z: number; speed: number; rotY: number }[],
  ) => void;
}

// ── Collision ──
export interface CollisionCallbacks {
  getSpeed: () => number;
  setSpeed: (s: number) => void;
  onBuildingHit: (contactPos: Vector3) => void;
  onPedestrianHit: (hitPos: Vector3, hitCount: number) => void;
  onDestructibleHit: (obj: DestructibleObject) => void;
  onCheckpointHit: (index: number) => void;
  onPoliceHit: (contactPos: Vector3) => void;
  onVehicleDamage: (amount: number) => void;
  onPlayerDamage: (amount: number) => void;
  triggerCollisionSparks: (position: Vector3) => void;
  triggerHitParticles: (position: Vector3) => void;
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
export interface PoliceUnitData {
  root: Mesh;
  speed: number;
  active: boolean;
}

export interface PoliceResult {
  updatePolice: (dt: number) => void;
  getWantedLevel: () => number;
  addWantedHeat: (amount: number) => void;
  getPoliceUnits: () => PoliceUnitData[];
  setPoliceSpeed: (index: number, speed: number) => void;
  setOnBusted: (cb: () => void) => void;
  resetWanted: () => void;
  setPlayerSpeed: (speed: number) => void;
}

// ── Player ──
export type PlayerMode = "on-foot" | "driving";

export interface PlayerResult {
  playerMesh: Mesh;
  updatePlayer: (keys: Keys, dt: number) => number;
  getMode: () => PlayerMode;
  setMode: (mode: PlayerMode) => void;
  getPosition: () => Vector3;
  setPosition: (x: number, y: number, z: number) => void;
  getRotationY: () => number;
  setRotationY: (r: number) => void;
  setVisible: (visible: boolean) => void;
  checkPunch: (
    keys: Keys,
    pedestrians: Pedestrian[],
    addWantedHeat: (amount: number) => void,
    triggerHitParticles: (pos: Vector3) => void,
    showCollisionText: (msg: string, color: string) => void,
    hitCountRef: { count: number },
    updateKillCounter: (count: number) => void,
  ) => void;
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
  showVehiclePrompt: (show: boolean, text?: string) => void;
  updateHealthBar: (hp: number, maxHp: number) => void;
  updateVehicleHealthBar: (hp: number, maxHp: number, visible: boolean) => void;
  updateMoney: (amount: number) => void;
  showWastedScreen: (onComplete: () => void) => void;
  showBustedScreen: (onComplete: () => void) => void;
  hideDeathScreen: () => void;
  updateMissionObjective: (text: string, show: boolean) => void;
  updateMissionTimer: (time: number, show: boolean) => void;
  showMissionStart: (title: string, desc: string, reward: number) => void;
  hideMissionStart: () => void;
  showMissionFailed: (reason: string) => void;
  updateWeaponHUD: (
    weaponName: string,
    ammo: number,
    maxAmmo: number,
    show: boolean,
  ) => void;
  showCrosshair: (show: boolean) => void;
  updateMinimap: (
    playerX: number,
    playerZ: number,
    playerRot: number,
    markers: MinimapMarker[],
  ) => void;
  setMinimapRoads: (roadsX: number[], roadsZ: number[]) => void;
  toggleHelp: () => void;
  updateMissionHint: (hasMission: boolean, mode: string) => void;
}

// ── Minimap ──
export interface MinimapMarker {
  x: number;
  z: number;
  color: string;
  type: "mission" | "giver" | "police" | "waypoint" | "shop" | "safehouse";
}

// ── Traffic ──
export interface TrafficCarData {
  root: Mesh;
  speed: number;
  active: boolean;
  lane: number;
  vehicleType: string;
}

export interface TrafficResult {
  updateTraffic: (dt: number, playerX: number, playerZ: number) => void;
  getTrafficCars: () => TrafficCarData[];
  getActiveTrafficCars: () => TrafficCarData[];
  removeTrafficCar: (index: number) => void;
}

// ── Vehicles ──
export interface VehicleStats {
  name: string;
  topSpeed: number;
  acceleration: number;
  braking: number;
  handling: number;
  mass: number;
  bodyColor: import("@babylonjs/core").Color3;
  bodyWidth: number;
  bodyHeight: number;
  bodyDepth: number;
  cabinScale: number;
}

export interface VehicleRegistryResult {
  getVehicleTypes: () => string[];
  getStats: (type: string) => VehicleStats;
  buildVehicleMesh: (type: string, index: number) => Mesh;
}

// ── Weapons ──
export type WeaponType = "fist" | "bat" | "pistol" | "shotgun" | "smg";

export interface WeaponData {
  name: string;
  type: "melee" | "ranged";
  damage: number;
  range: number;
  fireRate: number;
  spread: number;
  maxAmmo: number;
}

export interface WeaponState {
  weaponType: WeaponType;
  ammo: number;
}

export interface WeaponsResult {
  getCurrentWeapon: () => WeaponState;
  getWeaponData: (type: WeaponType) => WeaponData;
  switchWeapon: (type: WeaponType) => void;
  addWeapon: (type: WeaponType, ammo?: number) => void;
  addAmmo: (type: WeaponType, amount: number) => void;
  hasWeapon: (type: WeaponType) => boolean;
  getOwnedWeapons: () => WeaponType[];
  cycleWeapon: (direction: number) => void;
  tryFire: (dt: number) => boolean;
  update: (dt: number) => void;
}

// ── Shooting ──
export interface ShootingResult {
  updateShooting: (dt: number) => void;
  isAiming: () => boolean;
  setAiming: (aim: boolean) => void;
  fireRanged: () => void;
  fireMelee: () => void;
}

// ── Explosions ──
export interface ExplosionsResult {
  triggerExplosion: (
    x: number,
    y: number,
    z: number,
    radius: number,
    damage: number,
  ) => void;
  updateExplosions: (dt: number) => void;
}

// ── Missions ──
export type MissionType =
  | "go-to"
  | "collect"
  | "kill"
  | "chase"
  | "race"
  | "escort"
  | "delivery";
export type MissionState = "available" | "active" | "completed" | "failed";

export interface MissionStep {
  type: MissionType;
  description: string;
  targetX?: number;
  targetZ?: number;
  targets?: { x: number; z: number }[];
  timeLimit?: number;
  count?: number;
}

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  giverId: string;
  steps: MissionStep[];
  reward: { money: number; weapon?: WeaponType };
  requiredMissions: string[];
  repeatable: boolean;
}

export interface MissionsResult {
  updateMissions: (dt: number) => void;
  startMission: (id: string) => boolean;
  failMission: (reason: string) => void;
  getActiveMission: () => {
    id: string;
    stepIndex: number;
    def: MissionDef;
  } | null;
  isMissionActive: () => boolean;
  getCompletedMissions: () => string[];
  getAvailableMissions: () => MissionDef[];
}

// ── Economy ──
export interface LocationData {
  x: number;
  z: number;
  type:
    | "hospital"
    | "police-station"
    | "weapon-shop"
    | "pay-n-spray"
    | "safehouse";
  name: string;
}

export interface EconomyResult {
  getLocations: () => LocationData[];
  getNearbyLocation: (
    x: number,
    z: number,
    maxDist: number,
  ) => LocationData | null;
  canAfford: (amount: number) => boolean;
}

// ── Environment additions ──
export interface TrafficLightState {
  x: number;
  z: number;
  stateNS: "green" | "yellow" | "red"; // North-South direction
  stateEW: "green" | "yellow" | "red"; // East-West direction
}

export interface EnvironmentResultExtended extends EnvironmentResult {
  updateTrafficLights: (dt: number) => void;
  getTrafficLightStates: () => TrafficLightState[];
  getRoadPositionsX: () => number[];
  getRoadPositionsZ: () => number[];
}
