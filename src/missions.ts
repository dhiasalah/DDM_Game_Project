import { MeshBuilder, StandardMaterial, Color3 } from "@babylonjs/core";
import type { Scene, Mesh } from "@babylonjs/core";
import type {
  MissionDef,
  MissionStep,
  MissionsResult,
  WeaponType,
} from "./types";
import { STORY_MISSION_IDS } from "./missiondata";

/* ================================================================
 *  MISSION SYSTEM — linear story mode with auto-guidance
 * ================================================================ */

interface MissionCallbacks {
  onObjectiveUpdate: (text: string) => void;
  onTimerUpdate: (timeLeft: number) => void;
  onMissionStart: (title: string, description: string) => void;
  onMissionComplete: (
    id: string,
    reward: { money: number; weapon?: WeaponType },
  ) => void;
  onMissionFail: (reason: string) => void;
  onWaypointSet: (x: number, z: number) => void;
  onWaypointClear: () => void;
  getPlayerPosition: () => { x: number; z: number };
  addMoney: (amount: number) => void;
  addWeapon: (type: WeaponType, ammo?: number) => void;
}

const WAYPOINT_REACH_DIST = 8;
const KILL_CHECK_DIST = 20;

export function createMissions(
  scene: Scene,
  allMissions: MissionDef[],
  callbacks: MissionCallbacks,
): MissionsResult {
  const completedMissions = new Set<string>();
  let activeMission: { id: string; stepIndex: number; def: MissionDef } | null =
    null;
  let stepTimer = 0;
  let stepKillCount = 0;
  let stepCollectedIndices = new Set<number>();
  let storyComplete = false;

  // Waypoint marker mesh
  const waypointMat = new StandardMaterial("waypointMat", scene);
  waypointMat.emissiveColor = new Color3(1, 0.8, 0);
  waypointMat.alpha = 0.6;
  waypointMat.disableLighting = true;

  const waypointMarker = MeshBuilder.CreateCylinder(
    "waypointMarker",
    { diameter: 3, height: 15, tessellation: 12 },
    scene,
  );
  waypointMarker.material = waypointMat;
  waypointMarker.isVisible = false;
  waypointMarker.isPickable = false;

  // Collect markers pool
  const collectMarkers: Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const m = MeshBuilder.CreateBox(
      "collectMarker_" + i,
      { width: 1.5, height: 1.5, depth: 1.5 },
      scene,
    );
    const mat = new StandardMaterial("collectMat_" + i, scene);
    mat.emissiveColor = new Color3(0, 1, 0.5);
    mat.alpha = 0.7;
    mat.disableLighting = true;
    m.material = mat;
    m.isVisible = false;
    m.isPickable = false;
    collectMarkers.push(m);
  }

  function showWaypoint(x: number, z: number): void {
    waypointMarker.position.set(x, 7.5, z);
    waypointMarker.isVisible = true;
    callbacks.onWaypointSet(x, z);
  }

  function hideWaypoint(): void {
    waypointMarker.isVisible = false;
    callbacks.onWaypointClear();
  }

  function hideAllCollectMarkers(): void {
    collectMarkers.forEach((m) => (m.isVisible = false));
  }

  function getCurrentStep(): MissionStep | null {
    if (!activeMission) return null;
    return activeMission.def.steps[activeMission.stepIndex] || null;
  }

  function advanceStep(): void {
    if (!activeMission) return;

    activeMission.stepIndex++;
    stepKillCount = 0;
    stepCollectedIndices.clear();
    hideAllCollectMarkers();

    const nextStep = getCurrentStep();
    if (!nextStep) {
      completeMission();
      return;
    }

    setupStep(nextStep);
  }

  function setupStep(step: MissionStep): void {
    callbacks.onObjectiveUpdate(step.description);

    if (step.timeLimit) {
      stepTimer = step.timeLimit;
    } else {
      stepTimer = -1;
    }

    if (
      step.type === "go-to" ||
      step.type === "delivery" ||
      step.type === "chase" ||
      step.type === "escort"
    ) {
      if (step.targetX !== undefined && step.targetZ !== undefined) {
        showWaypoint(step.targetX, step.targetZ);
      }
    } else if (step.type === "race" || step.type === "collect") {
      if (step.targets) {
        step.targets.forEach((t, i) => {
          if (i < collectMarkers.length) {
            collectMarkers[i].position.set(t.x, 1, t.z);
            collectMarkers[i].isVisible = true;
          }
        });
        const firstUncollected = step.targets.find(
          (_, i) => !stepCollectedIndices.has(i),
        );
        if (firstUncollected) {
          showWaypoint(firstUncollected.x, firstUncollected.z);
        }
      }
    } else if (step.type === "kill") {
      if (step.targetX !== undefined && step.targetZ !== undefined) {
        showWaypoint(step.targetX, step.targetZ);
      }
      callbacks.onObjectiveUpdate(`${step.description} (0/${step.count || 1})`);
    }
  }

  function completeMission(): void {
    if (!activeMission) return;

    const def = activeMission.def;
    completedMissions.add(def.id);

    // Give rewards
    callbacks.addMoney(def.reward.money);
    if (def.reward.weapon) {
      callbacks.addWeapon(def.reward.weapon);
    }

    callbacks.onMissionComplete(def.id, def.reward);
    hideWaypoint();
    hideAllCollectMarkers();
    activeMission = null;

    // Check if story is complete
    if (isStoryComplete()) {
      storyComplete = true;
    }
  }

  function startMission(id: string): boolean {
    if (activeMission) return false;

    const def = allMissions.find((m) => m.id === id);
    if (!def) return false;

    for (const req of def.requiredMissions) {
      if (!completedMissions.has(req)) return false;
    }

    if (completedMissions.has(id) && !def.repeatable) return false;

    activeMission = { id, stepIndex: 0, def };
    stepKillCount = 0;
    stepCollectedIndices.clear();

    callbacks.onMissionStart(def.title, def.description);

    const firstStep = getCurrentStep();
    if (firstStep) {
      setupStep(firstStep);
    }

    return true;
  }

  function failMission(reason: string): void {
    if (!activeMission) return;

    callbacks.onMissionFail(reason);
    hideWaypoint();
    hideAllCollectMarkers();
    activeMission = null;
  }

  /** Notify the mission system that a kill happened near the given position */
  function notifyKill(x: number, z: number): void {
    if (!activeMission) return;
    const step = getCurrentStep();
    if (!step || step.type !== "kill") return;

    // Check if kill is in the mission area
    if (step.targetX !== undefined && step.targetZ !== undefined) {
      const dx = x - step.targetX;
      const dz = z - step.targetZ;
      if (dx * dx + dz * dz > KILL_CHECK_DIST * KILL_CHECK_DIST) return;
    }

    stepKillCount++;
    const needed = step.count || 1;
    callbacks.onObjectiveUpdate(
      `${step.description} (${Math.min(stepKillCount, needed)}/${needed})`,
    );

    if (stepKillCount >= needed) {
      advanceStep();
    }
  }

  function updateMissions(dt: number): void {
    if (!activeMission) {
      if (waypointMarker.isVisible) {
        waypointMarker.rotation.y += dt * 2;
      }
      return;
    }

    waypointMarker.rotation.y += dt * 2;
    collectMarkers.forEach((m) => {
      if (m.isVisible) m.rotation.y += dt * 3;
    });

    const step = getCurrentStep();
    if (!step) return;

    // Timer countdown
    if (stepTimer > 0) {
      stepTimer -= dt;
      callbacks.onTimerUpdate(stepTimer);
      if (stepTimer <= 0) {
        failMission("Time's up!");
        return;
      }
    }

    const pos = callbacks.getPlayerPosition();

    switch (step.type) {
      case "go-to":
      case "delivery":
      case "escort":
      case "chase": {
        if (step.targetX !== undefined && step.targetZ !== undefined) {
          const dx = pos.x - step.targetX;
          const dz = pos.z - step.targetZ;
          if (dx * dx + dz * dz < WAYPOINT_REACH_DIST * WAYPOINT_REACH_DIST) {
            advanceStep();
          }
        }
        break;
      }

      case "race":
      case "collect": {
        if (step.targets) {
          for (let i = 0; i < step.targets.length; i++) {
            if (stepCollectedIndices.has(i)) continue;
            const t = step.targets[i];
            const dx = pos.x - t.x;
            const dz = pos.z - t.z;
            if (dx * dx + dz * dz < WAYPOINT_REACH_DIST * WAYPOINT_REACH_DIST) {
              stepCollectedIndices.add(i);
              if (i < collectMarkers.length) {
                collectMarkers[i].isVisible = false;
              }

              const nextUncollected = step.targets.find(
                (_, j) => !stepCollectedIndices.has(j),
              );
              if (nextUncollected) {
                showWaypoint(nextUncollected.x, nextUncollected.z);
              }

              const needed = step.count || step.targets.length;
              if (stepCollectedIndices.size >= needed) {
                advanceStep();
              } else {
                callbacks.onObjectiveUpdate(
                  `${step.description} (${stepCollectedIndices.size}/${needed})`,
                );
              }
              break;
            }
          }
        }
        break;
      }

      case "kill": {
        // Kill count is updated via notifyKill()
        const needed = step.count || 1;
        if (stepKillCount >= needed) {
          advanceStep();
        }
        break;
      }
    }
  }

  // ============ STORY PROGRESSION ============

  /** Get the next story mission the player should do */
  function getNextStoryMission(): MissionDef | null {
    for (const id of STORY_MISSION_IDS) {
      if (completedMissions.has(id)) continue;
      const def = allMissions.find((m) => m.id === id);
      if (!def) continue;
      // Check if prerequisites are met
      const prereqsMet = def.requiredMissions.every((r) =>
        completedMissions.has(r),
      );
      if (prereqsMet) return def;
    }
    return null;
  }

  /** Get story progress as "X/5" */
  function getStoryProgress(): { completed: number; total: number } {
    let completed = 0;
    for (const id of STORY_MISSION_IDS) {
      if (completedMissions.has(id)) completed++;
    }
    return { completed, total: STORY_MISSION_IDS.length };
  }

  function isStoryComplete(): boolean {
    return STORY_MISSION_IDS.every((id) => completedMissions.has(id));
  }

  function getStoryComplete(): boolean {
    return storyComplete;
  }

  function getActiveMission(): {
    id: string;
    stepIndex: number;
    def: MissionDef;
  } | null {
    return activeMission;
  }

  function isMissionActive(): boolean {
    return activeMission !== null;
  }

  function getCompletedMissions(): string[] {
    return Array.from(completedMissions);
  }

  function getAvailableMissions(): MissionDef[] {
    return allMissions.filter((m) => {
      if (completedMissions.has(m.id) && !m.repeatable) return false;
      for (const req of m.requiredMissions) {
        if (!completedMissions.has(req)) return false;
      }
      return true;
    });
  }

  return {
    updateMissions,
    startMission,
    failMission,
    getActiveMission,
    isMissionActive,
    getCompletedMissions,
    getAvailableMissions,
    // New story features
    notifyKill,
    getNextStoryMission,
    getStoryProgress,
    isStoryComplete,
    getStoryComplete,
  };
}
