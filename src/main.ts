import { Engine, Scene } from "@babylonjs/core";

import { setupInput } from "./input";
import { setupLighting } from "./lighting";
import { createEnvironment } from "./environment";
import { createCar } from "./car";
import { setupParticles } from "./particles";
import { createPedestrians } from "./pedestrians";
import { setupCollisions } from "./collision";
import { setupCamera } from "./camera";
import { createHUD } from "./hud";
import { createCheckpoints } from "./checkpoints";
import { createPolice } from "./police";

import "./style.css";

async function main(): Promise<void> {
  // ============ CANVAS & ENGINE ============
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const engine = new Engine(canvas, false, {
    preserveDrawingBuffer: false,
    stencil: true,
  });

  // ============ CREATE SCENE ============
  async function createScene(): Promise<Scene> {
    const scene = new Scene(engine);
    scene.collisionsEnabled = false;
    scene.skipPointerMovePicking = true;
    scene.autoClear = false;

    // --- Input ---
    const keys = setupInput(scene);

    // --- Lighting ---
    const { shadowGenerator, pipeline } = setupLighting(scene);

    // --- Environment ---
    const { buildingData, destructibles } = createEnvironment(
      scene,
      shadowGenerator,
    );

    // --- Car ---
    const { carRoot, updateCar, getSpeed, setSpeed } = createCar(
      scene,
      shadowGenerator,
    );

    // --- Particles ---
    const { updateParticles, triggerCollisionSparks, triggerHitParticles } =
      setupParticles(scene, carRoot);

    // --- Pedestrians ---
    const { pedestrians, updatePedestrians } = createPedestrians(
      scene,
      shadowGenerator,
      carRoot,
    );

    // --- Camera ---
    const camera = setupCamera(scene, canvas, carRoot);

    scene.activeCamera = camera;
    try {
      pipeline.addCamera(camera);
    } catch (_e) {
      /* pipeline auto-detects */
    }

    // --- HUD ---
    const {
      updateSpeed,
      showCollisionText,
      updateKillCounter,
      updateCheckpointHUD,
      updateWantedLevel,
      showMissionComplete,
    } = createHUD(scene);

    // --- Checkpoints ---
    const checkpointResult = createCheckpoints(scene, carRoot);

    // --- Police ---
    const policeResult = createPolice(
      scene,
      shadowGenerator,
      carRoot,
      buildingData,
    );

    // --- Collision System ---
    const { checkCollisions } = setupCollisions(
      carRoot,
      buildingData,
      pedestrians,
      destructibles,
      {
        getSpeed,
        setSpeed,
        onBuildingHit(contactPos) {
          triggerCollisionSparks(contactPos);
          showCollisionText("COLLISION!", "#ff2222");
        },
        onPedestrianHit(hitPos, hitCount) {
          triggerHitParticles(hitPos);
          showCollisionText("HIT!", "#ffcc00");
          updateKillCounter(hitCount);
          policeResult.addWantedHeat(1.0);
        },
        onDestructibleHit(obj) {
          triggerCollisionSparks(obj.mesh.position);
          showCollisionText("SMASH!", "#ff8800");
          policeResult.addWantedHeat(0.5);
        },
        onCheckpointHit(_index) {
          showCollisionText("CHECKPOINT!", "#00ff66");
        },
      },
    );

    // ============ RENDER LOOP LOGIC ============
    let lastTime = performance.now();

    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      const dt = Math.min(deltaTime, 0.05);

      const speed = updateCar(keys, dt);
      checkCollisions(dt);
      updatePedestrians(dt);
      updateParticles(keys, speed);
      updateSpeed(speed, keys);

      // Checkpoints
      checkpointResult.updateCheckpoints(dt);
      updateCheckpointHUD(
        checkpointResult.getMissionActive(),
        checkpointResult.getCollectedCount(),
        checkpointResult.getTotalCheckpoints(),
        checkpointResult.getMissionTime(),
        checkpointResult.getActiveIndex(),
      );

      // Check for mission complete
      if (
        checkpointResult.getMissionActive() &&
        checkpointResult.getCollectedCount() ===
          checkpointResult.getTotalCheckpoints()
      ) {
        showMissionComplete(checkpointResult.getMissionTime());
      }

      // Police
      policeResult.updatePolice(dt);
      updateWantedLevel(policeResult.getWantedLevel());
    });

    return scene;
  }

  // ============ BOOT ============
  const scene = await createScene();

  engine.runRenderLoop(() => {
    scene.render();
  });

  // ============ RESIZE HANDLER ============
  window.addEventListener("resize", () => {
    engine.resize();
  });

  // ============ FOCUS CANVAS ============
  canvas.focus();
  canvas.addEventListener("click", () => canvas.focus());
}

main();
