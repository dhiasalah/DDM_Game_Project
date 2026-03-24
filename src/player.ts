import { Axis, MeshBuilder, Vector3 } from "@babylonjs/core";
import type { Scene, ShadowGenerator } from "@babylonjs/core";
import type { FollowCamera } from "@babylonjs/core";
import type { Keys, Pedestrian, PlayerMode, PlayerResult } from "./types";
import { playLoop, playOneShot } from "./animations";
import { createProceduralCharacter } from "./proceduralCharacter";

export async function createPlayer(
  scene: Scene,
  shadowGenerator: ShadowGenerator,
  camera: FollowCamera,
): Promise<PlayerResult> {
  // Root mesh used by camera/collision systems.
  const playerMesh = MeshBuilder.CreateBox(
    "playerRoot",
    { width: 0.1, height: 0.1, depth: 0.1 },
    scene,
  );
  playerMesh.isVisible = false;
  playerMesh.position = new Vector3(0, 0, -16);

  // Use procedural character instead of loading .glb
  const { root, animController } = createProceduralCharacter(
    scene,
    shadowGenerator,
  );
  root.parent = playerMesh;

  const anim = animController;
  console.log(
    `[Player] Created procedural character with ${anim.groups.length} animation(s)`,
  );

  playLoop(anim, anim.clips.idle, 1);

  let mode: PlayerMode = "on-foot";
  let punchCooldown = 0;
  let punchAnimTimer = 0;
  let jumpCooldown = 0;
  let jumpAnimTimer = 0;
  let prevSpaceDown = false;

  const WALK_SPEED = 3.0;
  const RUN_SPEED = 7.0;
  const PLAYER_GROUND_Y = 0;

  playerMesh.setEnabled(true);

  function updatePlayer(keys: Keys, dt: number): number {
    if (mode !== "on-foot") return 0;

    const isSprinting = keys["shift"];
    const moveSpeed = isSprinting ? RUN_SPEED : WALK_SPEED;

    let mx = 0;
    let mz = 0;

    if (keys["w"] || keys["arrowup"]) mz += 1;
    if (keys["s"] || keys["arrowdown"]) mz -= 1;
    if (keys["a"] || keys["arrowleft"]) mx -= 1;
    if (keys["d"] || keys["arrowright"]) mx += 1;

    const len = Math.sqrt(mx * mx + mz * mz);
    let speed = 0;

    const spaceDown = !!keys[" "];
    if (spaceDown && !prevSpaceDown && jumpCooldown <= 0) {
      jumpAnimTimer = 0.6;
      jumpCooldown = 0.8;
      playOneShot(anim, anim.clips.jump, 1);
    }
    prevSpaceDown = spaceDown;

    if (len > 0.01) {
      mx /= len;
      mz /= len;

      const camAngle = camera.rotation.y;
      const sinA = Math.sin(camAngle);
      const cosA = Math.cos(camAngle);
      const worldX = mx * cosA + mz * sinA;
      const worldZ = -mx * sinA + mz * cosA;

      playerMesh.rotation.y = Math.atan2(worldX, worldZ);
      playerMesh.position.x += worldX * moveSpeed * dt;
      playerMesh.position.z += worldZ * moveSpeed * dt;

      speed = moveSpeed;

      if (jumpAnimTimer <= 0 && punchAnimTimer <= 0) {
        if (isSprinting) {
          playLoop(anim, anim.clips.run ?? anim.clips.walk, 1.1);
        } else {
          playLoop(anim, anim.clips.walk ?? anim.clips.idle, 1);
        }
      }
    } else if (jumpAnimTimer <= 0 && punchAnimTimer <= 0) {
      playLoop(anim, anim.clips.idle ?? anim.clips.walk, 1);
    }

    playerMesh.position.y = PLAYER_GROUND_Y;

    const limit = 395;
    playerMesh.position.x = Math.max(
      -limit,
      Math.min(limit, playerMesh.position.x),
    );
    playerMesh.position.z = Math.max(
      -limit,
      Math.min(limit, playerMesh.position.z),
    );

    if (jumpAnimTimer > 0) jumpAnimTimer -= dt;

    if (punchAnimTimer > 0) {
      punchAnimTimer -= dt;
      if (punchAnimTimer <= 0 && jumpAnimTimer <= 0) {
        playLoop(anim, len > 0.01 ? anim.clips.walk : anim.clips.idle, 1);
      }
    }

    if (punchCooldown > 0) punchCooldown -= dt;
    if (jumpCooldown > 0) jumpCooldown -= dt;

    return speed * 3.6;
  }

  function checkPunch(
    keys: Keys,
    pedestrians: Pedestrian[],
    addWantedHeat: (amount: number) => void,
    triggerHitParticles: (pos: Vector3) => void,
    showCollisionText: (msg: string, color: string) => void,
    hitCountRef: { count: number },
    updateKillCounter: (count: number) => void,
  ): void {
    if (mode !== "on-foot") return;
    if (!keys["mouse0"]) return;
    if (punchCooldown > 0) return;

    punchCooldown = 0.4;
    punchAnimTimer = 0.32;
    playOneShot(anim, anim.clips.attack, 1.1);

    const forward = playerMesh.getDirection(Axis.Z);
    const px = playerMesh.position.x;
    const pz = playerMesh.position.z;

    for (let i = 0; i < pedestrians.length; i++) {
      const ped = pedestrians[i];
      if (!ped.alive || ped.flying) continue;

      const pedX = ped.mesh.root.position.x;
      const pedZ = ped.mesh.root.position.z;
      const dx = pedX - px;
      const dz = pedZ - pz;
      const distSq = dx * dx + dz * dz;

      if (distSq > 4) continue;

      const dot = dx * forward.x + dz * forward.z;
      if (dot < 0) continue;

      ped.alive = false;
      ped.flying = true;
      ped.flyTime = 0;
      ped.flyVelocity = new Vector3(
        forward.x * 4 + (Math.random() - 0.5) * 2,
        3 + Math.random() * 2,
        forward.z * 4 + (Math.random() - 0.5) * 2,
      );

      hitCountRef.count++;
      triggerHitParticles(ped.mesh.root.position.clone());
      showCollisionText("PUNCH!", "#ff8800");
      updateKillCounter(hitCountRef.count);
      addWantedHeat(0.3);

      break;
    }
  }

  function getMode(): PlayerMode {
    return mode;
  }

  function setMode(m: PlayerMode): void {
    mode = m;
    if (mode === "driving") {
      playLoop(anim, anim.clips.idle, 1);
    }
  }

  function getPosition(): Vector3 {
    return playerMesh.position.clone();
  }

  function setPosition(x: number, y: number, z: number): void {
    playerMesh.position.set(x, y, z);
  }

  function getRotationY(): number {
    return playerMesh.rotation.y;
  }

  function setRotationY(r: number): void {
    playerMesh.rotation.y = r;
  }

  function setVisible(visible: boolean): void {
    playerMesh.setEnabled(visible);
  }

  return {
    playerMesh,
    updatePlayer,
    getMode,
    setMode,
    getPosition,
    setPosition,
    getRotationY,
    setRotationY,
    setVisible,
    checkPunch,
  };
}
