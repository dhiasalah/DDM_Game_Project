import { Engine, Scene, Vector3, MeshBuilder, StandardMaterial, Color3 } from "@babylonjs/core";

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
import { createPlayer } from "./player";
import { createGameState } from "./gamestate";
import { createHealthSystem } from "./health";
import { createTraffic } from "./traffic";
import { getVehicleStatsStatic } from "./vehicles";
import { createWeapons } from "./weapons";
import { createShooting } from "./shooting";
import { createMissions } from "./missions";
import { missionDefs, missionGivers } from "./missiondata";
import { createEconomy } from "./economy";
import type { PlayerMode } from "./types";

import "./style.css";

async function main(): Promise<void> {
  // ============ CANVAS & ENGINE ============
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const engine = new Engine(canvas, false, {
    preserveDrawingBuffer: false,
    stencil: true,
  });
  // On high-DPI screens, reduce render resolution to boost FPS
  if (window.devicePixelRatio > 1) {
    engine.setHardwareScalingLevel(window.devicePixelRatio);
  }

  // ============ CREATE SCENE ============
  async function createScene(): Promise<Scene> {
    const scene = new Scene(engine);
    scene.collisionsEnabled = false;
    scene.skipPointerMovePicking = true;
    scene.autoClear = false;
    scene.blockMaterialDirtyMechanism = true;
    scene.skipFrustumClipping = true;
    // Disable all pointer picking (game uses custom raycasts)
    scene.pointerDownPredicate = () => false;
    scene.pointerUpPredicate = () => false;
    scene.pointerMovePredicate = () => false;

    // --- Input ---
    const keys = setupInput(scene);

    // --- Lighting ---
    const { shadowGenerator, pipeline } = setupLighting(scene);

    // --- Environment ---
    const {
      buildingData,
      destructibles,
      treeData,
      parkedCars,
      intersections,
      updateVisibility,
      updateTrafficLights,
      getTrafficLightStates,
      getRoadPositionsX,
      getRoadPositionsZ,
    } = createEnvironment(scene, shadowGenerator);

    // --- Car ---
    const {
      carRoot,
      updateCar,
      getSpeed,
      setSpeed,
      setVehicleStats,
      setBodyColor,
      getCurrentVehicleType,
    } = createCar(scene, shadowGenerator);

    // --- Particles ---
    const { updateParticles, triggerCollisionSparks, triggerHitParticles } =
      setupParticles(scene, carRoot);

    // --- Pedestrians (now using procedural characters, no model loading needed) ---
    const {
      pedestrians,
      updatePedestrians,
      setTrafficGetter: setPedTrafficGetter,
    } = createPedestrians(scene, shadowGenerator, carRoot);

    // --- Camera ---
    const { camera, switchTarget } = setupCamera(scene, canvas, carRoot);

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
      showVehiclePrompt,
      updateHealthBar,
      updateVehicleHealthBar,
      updateMoney,
      showWastedScreen,
      showBustedScreen,
      hideDeathScreen,
      updateWeaponHUD,
      showCrosshair,
      updateMinimap,
      setMinimapRoads,
      toggleHelp,
      updateMissionHint,
      updateMissionObjective,
      updateMissionTimer,
      showMissionStart,
      hideMissionStart,
      showMissionFailed,
      updateStoryProgress,
      showStoryComplete,
    } = createHUD(scene);

    // --- Game State ---
    const gameState = createGameState(500);

    // --- Health System ---
    const healthSystem = createHealthSystem();

    // --- Player (on-foot character) ---
    const playerResult = await createPlayer(scene, shadowGenerator, camera);

    // --- Checkpoints ---
    const checkpointResult = createCheckpoints(scene, carRoot);

    // --- Police ---
    const policeResult = createPolice(
      scene,
      shadowGenerator,
      carRoot,
      buildingData,
    );

    // --- Weapons System ---
    const weapons = createWeapons();
    // Start with some weapons for testing
    weapons.addWeapon("pistol", 60);
    weapons.addWeapon("bat");

    // Forward-declare mission system (assigned later, used in callbacks)
    let missionsResult!: import("./types").MissionsResult;

    // --- Shooting System ---
    const shootingResult = createShooting({
      scene,
      weapons,
      pedestrians,
      policeResult,
      getPlayerPosition: () => playerResult.playerMesh.position.clone(),
      getAimDirection: () => {
        const camDir = camera.getForwardRay().direction;
        return new Vector3(camDir.x, 0, camDir.z).normalize();
      },
      getMode: () => currentMode as "driving" | "on-foot",
      callbacks: { triggerHitParticles },
      onKill: () => {
        gameState.addKill();
        gameState.addMoney(Math.floor(5 + Math.random() * 15));
        hitCountRef.count++;
        updateKillCounter(hitCountRef.count);
      },
      onPedHit: (pos) => {
        showCollisionText("HIT!", "#ffcc00");
        triggerHitParticles(pos);
        // Notify mission system about the kill (pos is a Vector3)
        if (missionsResult) {
          missionsResult.notifyKill(pos.x, pos.z);
        }
      },
      addWantedHeat: (amount) => policeResult.addWantedHeat(amount),
    });

    const shootingFireRanged = shootingResult.fireRanged;
    const shootingFireMelee = shootingResult.fireMelee;

    // --- Collision System ---
    const {
      checkCollisions,
      checkOnFootCollisions,
      setTrafficGetter: setCollTrafficGetter,
    } = setupCollisions(
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
          gameState.addKill();
          gameState.addMoney(Math.floor(5 + Math.random() * 15));
          // Notify mission system about the kill
          if (missionsResult) {
            missionsResult.notifyKill(hitPos.x, hitPos.z);
          }
        },
        onDestructibleHit(obj) {
          triggerCollisionSparks(obj.mesh.position);
          showCollisionText("SMASH!", "#ff8800");
          policeResult.addWantedHeat(0.5);
        },
        onCheckpointHit(_index) {
          showCollisionText("CHECKPOINT!", "#00ff66");
        },
        onPoliceHit(contactPos) {
          triggerCollisionSparks(contactPos);
          showCollisionText("POLICE HIT!", "#ff4444");
        },
        onVehicleDamage(amount) {
          healthSystem.damageVehicle(amount);
        },
        onPlayerDamage(amount) {
          healthSystem.damagePlayer(amount);
        },
        triggerCollisionSparks,
        triggerHitParticles,
      },
      policeResult,
      treeData,
      parkedCars,
    );

    // --- Traffic System ---
    const trafficResult = createTraffic(
      scene,
      shadowGenerator,
      buildingData,
      intersections,
      getRoadPositionsX(),
      getRoadPositionsZ(),
      getTrafficLightStates,
    );

    // Wire traffic into collision + pedestrian systems
    setCollTrafficGetter(() => trafficResult.getActiveTrafficCars());
    setPedTrafficGetter(() =>
      trafficResult.getActiveTrafficCars().map((tc) => ({
        x: tc.root.position.x,
        z: tc.root.position.z,
        speed: tc.speed,
        rotY: tc.root.rotation.y,
      })),
    );

    // Track active waypoint for minimap
    let currentWaypoint: { x: number; z: number } | null = null;

    // --- Mission System ---
    missionsResult = createMissions(scene, missionDefs, {
      onObjectiveUpdate: (text) => updateMissionObjective(text, true),
      onTimerUpdate: (timeLeft) => updateMissionTimer(timeLeft, true),
      onMissionStart: (title, description) => {
        showMissionStart(title, description, 0);
        // Auto-hide after 4 seconds
        setTimeout(() => hideMissionStart(), 4000);
      },
      onMissionComplete: (_id, reward) => {
        gameState.completeMission();
        showMissionComplete(0);
        updateMissionObjective("", false);
        updateMissionTimer(0, false);
        showCollisionText(`MISSION COMPLETE! +$${reward.money}`, "#00ff66");
        // Update story progress
        const progress = missionsResult.getStoryProgress();
        updateStoryProgress(progress.completed, progress.total);
        // Check if story is fully complete
        if (missionsResult.getStoryComplete()) {
          showStoryComplete();
        }
      },
      onMissionFail: (reason) => {
        showMissionFailed(reason);
        updateMissionObjective("", false);
        updateMissionTimer(0, false);
        setTimeout(() => hideMissionStart(), 3000);
      },
      onWaypointSet: (x, z) => {
        currentWaypoint = { x, z };
      },
      onWaypointClear: () => {
        currentWaypoint = null;
      },
      getPlayerPosition: () => {
        if (currentMode === "driving") {
          return { x: carRoot.position.x, z: carRoot.position.z };
        }
        return {
          x: playerResult.playerMesh.position.x,
          z: playerResult.playerMesh.position.z,
        };
      },
      addMoney: (amount) => gameState.addMoney(amount),
      addWeapon: (type, ammo) => weapons.addWeapon(type, ammo),
    });

    // --- Mission Giver Visual Markers ---
    for (const [id, giver] of Object.entries(missionGivers)) {
      const marker = MeshBuilder.CreateTorus(
        "giverMarker_" + id,
        { diameter: 3.5, thickness: 0.8, tessellation: 16 },
        scene
      );
      marker.position.set(giver.x, 1, giver.z);
      
      const mat = new StandardMaterial("giverMat_" + id, scene);
      mat.emissiveColor = new Color3(1, 0.8, 0); // Yellow
      mat.diffuseColor = mat.emissiveColor;
      mat.alpha = 0.7;
      mat.disableLighting = true;
      marker.material = mat;
      marker.isPickable = false;

      // Add a simple animation so it spins and bobs
      scene.onBeforeRenderObservable.add(() => {
        marker.rotation.x += 0.03;
        marker.rotation.y += 0.04;
      });
    }

    // --- Economy System ---
    const economyResult = createEconomy(scene, shadowGenerator, {
      getMoney: () => gameState.getMoney(),
      removeMoney: (amount) => gameState.removeMoney(amount),
      addMoney: (amount) => gameState.addMoney(amount),
      healPlayer: (amount) => healthSystem.healPlayer(amount),
      repairVehicle: (amount) => healthSystem.repairVehicle(amount),
      addWeapon: (type, ammo) => weapons.addWeapon(type, ammo),
      addAmmo: (type, amount) => weapons.addWeapon(type, amount),
      showMessage: (text, color) => showCollisionText(text, color),
      resetWanted: () => policeResult.resetWanted(),
    });

    // ============ PLAYER MODE SYSTEM ============
    let currentMode: PlayerMode = "driving";
    let fKeyWasDown = false;
    let qKeyWasDown = false;
    let eKeyWasDown = false;
    let hKeyWasDown = false;
    let mouseDown = false;
    const ENTER_EXIT_DIST = 4.0; // Distance threshold to enter own car
    const CARJACK_DIST = 5.0; // Distance threshold to carjack a traffic car
    const hitCountRef = { count: 0 };

    // Mouse input for shooting
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) mouseDown = true;
    });
    canvas.addEventListener("mouseup", (e) => {
      if (e.button === 0) mouseDown = false;
    });

    // Start in driving mode — player character hidden
    playerResult.setVisible(false);
    playerResult.setMode("driving");

    // Set minimap road grid data
    setMinimapRoads(getRoadPositionsX(), getRoadPositionsZ());

    // ============ RESPAWN LOCATIONS ============
    const HOSPITAL_LOCATIONS = [
      { x: 100, z: 100 },
      { x: -200, z: -150 },
    ];
    const POLICE_STATION_LOCATIONS = [
      { x: -100, z: 50 },
      { x: 150, z: -200 },
    ];

    function findNearest(
      locations: { x: number; z: number }[],
      px: number,
      pz: number,
    ): { x: number; z: number } {
      let best = locations[0];
      let bestDist = Infinity;
      for (const loc of locations) {
        const d = (loc.x - px) ** 2 + (loc.z - pz) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = loc;
        }
      }
      return best;
    }

    // ============ WASTED / BUSTED HANDLING ============
    let deathCooldown = 0; // prevents input during death
    let isRespawning = false;

    function handleWasted(): void {
      if (isRespawning) return;
      isRespawning = true;
      deathCooldown = 5;
      gameState.setPlayerState("wasted");
      const penalty = Math.floor(gameState.getMoney() * 0.1);
      gameState.removeMoney(penalty);
      // Fail active mission on death
      if (missionsResult.isMissionActive()) {
        missionsResult.failMission("You died!");
      }

      showWastedScreen(() => {
        // Respawn at nearest hospital
        const px =
          currentMode === "driving"
            ? carRoot.position.x
            : playerResult.playerMesh.position.x;
        const pz =
          currentMode === "driving"
            ? carRoot.position.z
            : playerResult.playerMesh.position.z;
        const spawn = findNearest(HOSPITAL_LOCATIONS, px, pz);

        carRoot.position.set(spawn.x, 0.55, spawn.z);
        carRoot.rotation.y = 0;
        setSpeed(0);
        playerResult.setPosition(spawn.x - 3, 0, spawn.z);

        healthSystem.resetPlayer();
        healthSystem.resetVehicle();
        policeResult.resetWanted();
        gameState.setPlayerState("alive");

        if (currentMode === "on-foot") {
          switchToDriving();
        }

        hideDeathScreen();
        isRespawning = false;
      });
    }

    function handleBusted(): void {
      if (isRespawning) return;
      isRespawning = true;
      deathCooldown = 5;
      gameState.setPlayerState("busted");
      const penalty = Math.floor(gameState.getMoney() * 0.1);
      gameState.removeMoney(penalty);
      // Fail active mission on busted
      if (missionsResult.isMissionActive()) {
        missionsResult.failMission("You got busted!");
      }

      showBustedScreen(() => {
        const px =
          currentMode === "driving"
            ? carRoot.position.x
            : playerResult.playerMesh.position.x;
        const pz =
          currentMode === "driving"
            ? carRoot.position.z
            : playerResult.playerMesh.position.z;
        const spawn = findNearest(POLICE_STATION_LOCATIONS, px, pz);

        carRoot.position.set(spawn.x, 0.55, spawn.z);
        carRoot.rotation.y = 0;
        setSpeed(0);
        playerResult.setPosition(spawn.x - 3, 0, spawn.z);

        healthSystem.resetPlayer();
        healthSystem.resetVehicle();
        policeResult.resetWanted();
        gameState.setPlayerState("alive");

        if (currentMode === "on-foot") {
          switchToDriving();
        }

        hideDeathScreen();
        isRespawning = false;
      });
    }

    // Wire up callbacks
    healthSystem.setOnPlayerDeath(handleWasted);
    policeResult.setOnBusted(handleBusted);

    function switchToOnFoot(): void {
      currentMode = "on-foot";
      playerResult.setMode("on-foot");

      // Place player at car's left side
      const carX = carRoot.position.x;
      const carZ = carRoot.position.z;
      const leftOffset = Math.cos(carRoot.rotation.y + Math.PI / 2) * 2.5;
      const leftOffsetZ = Math.sin(carRoot.rotation.y + Math.PI / 2) * 2.5;
      playerResult.setPosition(carX - leftOffset, 0, carZ - leftOffsetZ);
      playerResult.setRotationY(carRoot.rotation.y);

      playerResult.setVisible(true);
      setSpeed(0);
      switchTarget(playerResult.playerMesh, "on-foot");
    }

    function switchToDriving(): void {
      currentMode = "driving";
      playerResult.setMode("driving");
      playerResult.setVisible(false);
      switchTarget(carRoot, "driving");
    }

    // ============ RENDER LOOP LOGIC ============
    let lastTime = performance.now();
    let inCombat = false;

    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      const dt = Math.min(deltaTime, 0.05);

      // Update game state time
      gameState.updatePlayTime(dt);

      // If dead/busted, skip gameplay updates
      if (
        gameState.getPlayerState() === "wasted" ||
        gameState.getPlayerState() === "busted"
      ) {
        if (deathCooldown > 0) deathCooldown -= dt;
        return;
      }

      // --- F key: enter/exit vehicle ---
      const fDown = keys["f"] === true;
      if (fDown && !fKeyWasDown) {
        if (currentMode === "driving") {
          switchToOnFoot();
        } else if (currentMode === "on-foot") {
          // Check distance to own car first
          const dx = playerResult.playerMesh.position.x - carRoot.position.x;
          const dz = playerResult.playerMesh.position.z - carRoot.position.z;
          const distSq = dx * dx + dz * dz;
          if (distSq < ENTER_EXIT_DIST * ENTER_EXIT_DIST) {
            switchToDriving();
          } else {
            // === CARJACKING: check nearby traffic cars ===
            const playerX = playerResult.playerMesh.position.x;
            const playerZ = playerResult.playerMesh.position.z;
            const trafficCars = trafficResult.getActiveTrafficCars();
            let nearestIdx = -1;
            let nearestDist = CARJACK_DIST * CARJACK_DIST;

            for (let i = 0; i < trafficCars.length; i++) {
              const tc = trafficCars[i];
              if (!tc.active) continue;
              const tdx = playerX - tc.root.position.x;
              const tdz = playerZ - tc.root.position.z;
              const td = tdx * tdx + tdz * tdz;
              if (td < nearestDist) {
                nearestDist = td;
                nearestIdx = i;
              }
            }

            if (nearestIdx >= 0) {
              const stolenCar = trafficCars[nearestIdx];
              // Teleport player car to stolen car's position
              carRoot.position.set(
                stolenCar.root.position.x,
                0.55,
                stolenCar.root.position.z,
              );
              carRoot.rotation.y = stolenCar.root.rotation.y;

              // Apply the stolen vehicle's type stats
              const vehicleType = stolenCar.vehicleType || "sedan";
              const stats = getVehicleStatsStatic(vehicleType);
              setVehicleStats(stats);
              setSpeed(stolenCar.speed * 0.5); // inherit some momentum

              // Remove the traffic car
              trafficResult.removeTrafficCar(nearestIdx);

              // Add wanted heat for carjacking
              policeResult.addWantedHeat(2.0);
              showCollisionText("CARJACKED!", "#ff8800");

              // Switch to driving
              switchToDriving();
            }
          }
        }
      }
      fKeyWasDown = fDown;

      // --- Q key: cycle weapon ---
      const qDown = keys["q"] === true;
      if (qDown && !qKeyWasDown) {
        weapons.cycleWeapon(1);
      }
      qKeyWasDown = qDown;

      // --- H key: toggle help ---
      const hDown = keys["h"] === true;
      if (hDown && !hKeyWasDown) {
        toggleHelp();
      }
      hKeyWasDown = hDown;

      // --- E key: interact / accept mission / economy ---
      const eDown = keys["e"] === true;
      if (eDown && !eKeyWasDown && currentMode === "on-foot") {
        // Priority 1: Economy interaction (shops etc.)
        const ecoPrompt = economyResult.getInteractPrompt();
        if (ecoPrompt) {
          economyResult.interact();
        } else if (!missionsResult.isMissionActive()) {
          // Priority 2: Mission givers
          const pxE = playerResult.playerMesh.position.x;
          const pzE = playerResult.playerMesh.position.z;
          const GIVER_DIST = 12; // Increased distance to make it easier to trigger
          for (const [giverId, giver] of Object.entries(missionGivers)) {
            const gdx = pxE - giver.x;
            const gdz = pzE - giver.z;
            if (gdx * gdx + gdz * gdz < GIVER_DIST * GIVER_DIST) {
              const available = missionsResult.getAvailableMissions();
              const giverMission = available.find((m) => m.giverId === giverId);
              if (giverMission) {
                missionsResult.startMission(giverMission.id);
              } else {
                showCollisionText("No missions available", "#aaaaaa");
              }
              break;
            }
          }
        }
      }
      eKeyWasDown = eDown;

      // --- Mouse click: fire weapon (on-foot only) ---
      if (mouseDown && currentMode === "on-foot") {
        const wStateFire = weapons.getCurrentWeapon();
        const wDataFire = weapons.getWeaponData(wStateFire.weaponType);
        if (weapons.tryFire(dt)) {
          if (wDataFire.type === "ranged") {
            shootingFireRanged();
          } else {
            shootingFireMelee();
          }
        }
      }

      // Update weapon cooldowns
      weapons.update(dt);
      shootingResult.updateShooting(dt);

      // --- Determine combat state for health regen ---
      inCombat = policeResult.getWantedLevel() > 0;

      // --- Mode-dependent updates ---
      let speed = 0;

      if (currentMode === "driving") {
        speed = updateCar(keys, dt);
        updateVisibility(carRoot.position.x, carRoot.position.z);
        checkCollisions(dt);
        updateParticles(keys, speed);
        showVehiclePrompt(false);
      } else {
        // On-foot mode
        speed = playerResult.updatePlayer(keys, dt);
        updateVisibility(
          playerResult.playerMesh.position.x,
          playerResult.playerMesh.position.z,
        );
        checkOnFootCollisions(playerResult.playerMesh, currentMode);

        // Punch check
        playerResult.checkPunch(
          keys,
          pedestrians,
          policeResult.addWantedHeat,
          triggerHitParticles,
          showCollisionText,
          hitCountRef,
          updateKillCounter,
        );

        // Show prompt if near car, traffic car, or mission giver
        const dx = playerResult.playerMesh.position.x - carRoot.position.x;
        const dz = playerResult.playerMesh.position.z - carRoot.position.z;
        const distSq = dx * dx + dz * dz;
        const nearOwnCar = distSq < ENTER_EXIT_DIST * ENTER_EXIT_DIST;

        if (nearOwnCar) {
          showVehiclePrompt(true);
        } else {
          // Check if near any traffic car
          let nearTraffic = false;
          const pxFoot = playerResult.playerMesh.position.x;
          const pzFoot = playerResult.playerMesh.position.z;
          const activeTrafic = trafficResult.getActiveTrafficCars();
          for (let ti = 0; ti < activeTrafic.length; ti++) {
            const tc = activeTrafic[ti];
            if (!tc.active) continue;
            const tdx = pxFoot - tc.root.position.x;
            const tdz = pzFoot - tc.root.position.z;
            if (tdx * tdx + tdz * tdz < CARJACK_DIST * CARJACK_DIST) {
              nearTraffic = true;
              break;
            }
          }

          if (nearTraffic) {
            showVehiclePrompt(true, "Press F to Carjack");
          } else {
            // Check economy prompt first (shops, etc.)
            const ecoPrompt = economyResult.getInteractPrompt();
            if (ecoPrompt) {
              showVehiclePrompt(true, ecoPrompt);
            } else {
              // Check if near a mission giver
              let nearGiver = false;
              const GIVER_PROMPT_DIST = 6;
              for (const giver of Object.values(missionGivers)) {
                const mgdx = pxFoot - giver.x;
                const mgdz = pzFoot - giver.z;
                if (
                  mgdx * mgdx + mgdz * mgdz <
                  GIVER_PROMPT_DIST * GIVER_PROMPT_DIST
                ) {
                  nearGiver = true;
                  showVehiclePrompt(true, `Press E \u2014 ${giver.name}`);
                  break;
                }
              }
              if (!nearGiver) {
                showVehiclePrompt(false);
              }
            }
          }
        }
      }

      // --- Health update ---
      healthSystem.updateHealth(dt, inCombat);

      // --- Mission System update ---
      missionsResult.updateMissions(dt);

      // --- Economy update ---
      const ecoPx =
        currentMode === "driving"
          ? carRoot.position.x
          : playerResult.playerMesh.position.x;
      const ecoPz =
        currentMode === "driving"
          ? carRoot.position.z
          : playerResult.playerMesh.position.z;
      economyResult.updateEconomy(ecoPx, ecoPz, currentMode);

      // --- Traffic & environment updates ---
      updateTrafficLights(dt);
      const tpx =
        currentMode === "driving"
          ? carRoot.position.x
          : playerResult.playerMesh.position.x;
      const tpz =
        currentMode === "driving"
          ? carRoot.position.z
          : playerResult.playerMesh.position.z;
      trafficResult.updateTraffic(dt, tpx, tpz);

      // --- HUD updates ---
      policeResult.updatePolice(dt);
      updatePedestrians(dt);
      updateSpeed(speed, keys);

      // Health HUD
      updateHealthBar(healthSystem.getPlayerHP(), 100);
      updateVehicleHealthBar(
        healthSystem.getVehicleHP(),
        100,
        currentMode === "driving",
      );
      updateMoney(gameState.getMoney());

      // Weapon HUD
      const wState = weapons.getCurrentWeapon();
      const wData = weapons.getWeaponData(wState.weaponType);
      updateWeaponHUD(
        wData.name,
        wState.ammo < 0 ? 999 : wState.ammo,
        wData.maxAmmo < 0 ? 999 : wData.maxAmmo,
        currentMode === "on-foot",
      );
      showCrosshair(currentMode === "on-foot" && wData.type === "ranged");

      // Minimap
      const px =
        currentMode === "driving"
          ? carRoot.position.x
          : playerResult.playerMesh.position.x;
      const pz =
        currentMode === "driving"
          ? carRoot.position.z
          : playerResult.playerMesh.position.z;
      const pRot =
        currentMode === "driving"
          ? carRoot.rotation.y
          : playerResult.getRotationY();

      // Gather minimap markers — police cars, mission givers, active waypoint
      const mmMarkers: {
        x: number;
        z: number;
        color: string;
        type:
          | "police"
          | "mission"
          | "giver"
          | "waypoint"
          | "shop"
          | "safehouse";
      }[] = [];
      const pUnits = policeResult.getPoliceUnits();
      for (const pu of pUnits) {
        if (pu.active) {
          mmMarkers.push({
            x: pu.root.position.x,
            z: pu.root.position.z,
            color: "#4488ff",
            type: "police",
          });
        }
      }

      // Mission giver markers (yellow dots on minimap)
      for (const giver of Object.values(missionGivers)) {
        mmMarkers.push({
          x: giver.x,
          z: giver.z,
          color: "#ffcc00",
          type: "giver",
        });
      }

      // Active mission waypoint marker (green dot)
      if (currentWaypoint) {
        mmMarkers.push({
          x: currentWaypoint.x,
          z: currentWaypoint.z,
          color: "#00ff66",
          type: "waypoint",
        });
      }

      // Economy location markers (shops, safehouses, etc.)
      const ecoMarkers = economyResult.getLocationMarkers();
      for (const em of ecoMarkers) {
        mmMarkers.push({
          x: em.x,
          z: em.z,
          color: em.color,
          type: em.type as "shop" | "safehouse",
        });
      }

      updateMinimap(px, pz, pRot, mmMarkers);

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

      // Wanted level HUD
      updateWantedLevel(policeResult.getWantedLevel());

      // Mission hint with story guidance
      let guidanceText: string | undefined;
      if (!missionsResult.isMissionActive() && !missionsResult.getStoryComplete()) {
        const nextMission = missionsResult.getNextStoryMission();
        if (nextMission) {
          const giverName = missionGivers[nextMission.giverId]?.name || nextMission.giverId;
          if (currentMode === "driving") {
            guidanceText = `📍 Go to ${giverName} for: "${nextMission.title}" — Press F to exit car, then E near ★`;
          } else {
            guidanceText = `📍 Walk to ${giverName} (★ on map) and press E — Next: "${nextMission.title}"`;
          }
        }
      }
      updateMissionHint(missionsResult.isMissionActive(), currentMode, guidanceText);
      // Update story progress HUD
      const storyProg = missionsResult.getStoryProgress();
      updateStoryProgress(storyProg.completed, storyProg.total);
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
