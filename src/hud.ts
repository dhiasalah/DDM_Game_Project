import {
  AdvancedDynamicTexture,
  TextBlock,
  Rectangle,
  Control,
} from "@babylonjs/gui";
import type { Scene } from "@babylonjs/core";
import type { Keys, HUDResult, MinimapMarker } from "./types";

export function createHUD(scene: Scene): HUDResult {
  const advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI(
    "UI",
    true,
    scene,
  );

  // ============ SPEED PANEL (bottom-left) ============
  const speedPanel = new Rectangle("speedPanel");
  speedPanel.width = "220px";
  speedPanel.height = "100px";
  speedPanel.cornerRadius = 15;
  speedPanel.color = "rgba(255, 255, 255, 0.3)";
  speedPanel.thickness = 1;
  speedPanel.background = "rgba(0, 0, 0, 0.45)";
  speedPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  speedPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  speedPanel.left = "20px";
  speedPanel.top = "-20px";
  advancedTexture.addControl(speedPanel);

  const speedLabel = new TextBlock("speedLabel");
  speedLabel.text = "SPEED";
  speedLabel.color = "rgba(255, 255, 255, 0.6)";
  speedLabel.fontSize = 14;
  speedLabel.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  speedLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  speedLabel.top = "-20px";
  speedPanel.addControl(speedLabel);

  const speedText = new TextBlock("speedText");
  speedText.text = "0";
  speedText.color = "#ffffff";
  speedText.fontSize = 36;
  speedText.fontWeight = "bold";
  speedText.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  speedText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  speedText.top = "8px";
  speedPanel.addControl(speedText);

  const speedUnit = new TextBlock("speedUnit");
  speedUnit.text = "km/h";
  speedUnit.color = "rgba(255, 255, 255, 0.5)";
  speedUnit.fontSize = 14;
  speedUnit.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  speedUnit.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  speedUnit.top = "32px";
  speedPanel.addControl(speedUnit);

  // ============ CONTROLS HINT (bottom-right) ============
  const controlsPanel = new Rectangle("controlsPanel");
  controlsPanel.width = "260px";
  controlsPanel.height = "180px";
  controlsPanel.cornerRadius = 15;
  controlsPanel.color = "rgba(255, 255, 255, 0.3)";
  controlsPanel.thickness = 1;
  controlsPanel.background = "rgba(0, 0, 0, 0.45)";
  controlsPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  controlsPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  controlsPanel.left = "-20px";
  controlsPanel.top = "-20px";
  advancedTexture.addControl(controlsPanel);

  const controlsTitle = new TextBlock("controlsTitle");
  controlsTitle.text = "CONTROLS  (H = Help)";
  controlsTitle.color = "rgba(255, 255, 255, 0.6)";
  controlsTitle.fontSize = 13;
  controlsTitle.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  controlsTitle.top = "-72px";
  controlsPanel.addControl(controlsTitle);

  const controlLines = [
    "W A S D / Arrows — Move",
    "Space — Brake",
    "F — Enter / Exit vehicle",
    "F near car — Carjack!",
    "E — Talk to NPC / Use shop",
    "Q — Switch weapon",
    "Click — Attack / Shoot",
    "H — Toggle help overlay",
  ];

  controlLines.forEach((line, i) => {
    const ct = new TextBlock("ctrl_" + i);
    ct.text = line;
    ct.color = "rgba(255, 255, 255, 0.8)";
    ct.fontSize = 11;
    ct.fontFamily = "'Segoe UI', Tahoma, sans-serif";
    ct.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    ct.left = "20px";
    ct.top = -48 + i * 15 + "px";
    controlsPanel.addControl(ct);
  });

  // ============ GAME TITLE (top-center, fades out) ============
  const titleText = new TextBlock("title");
  titleText.text = "🏎️ CITY RACER";
  titleText.color = "#ffffff";
  titleText.fontSize = 42;
  titleText.fontWeight = "bold";
  titleText.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  titleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  titleText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  titleText.top = "40px";
  titleText.shadowColor = "rgba(0,0,0,0.5)";
  titleText.shadowBlur = 10;
  titleText.shadowOffsetX = 2;
  titleText.shadowOffsetY = 2;
  advancedTexture.addControl(titleText);

  setTimeout(() => {
    let opacity = 1.0;
    const fadeInterval = setInterval(() => {
      opacity -= 0.02;
      if (opacity <= 0) {
        titleText.alpha = 0;
        clearInterval(fadeInterval);
      } else {
        titleText.alpha = opacity;
      }
    }, 30);
  }, 4000);

  // ============ GEAR INDICATOR ============
  const gearText = new TextBlock("gearText");
  gearText.text = "N";
  gearText.color = "#00ff88";
  gearText.fontSize = 24;
  gearText.fontWeight = "bold";
  gearText.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  gearText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  gearText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  gearText.left = "250px";
  gearText.top = "-55px";
  advancedTexture.addControl(gearText);

  // ============ COLLISION TEXT ============
  const collisionText = new TextBlock("collisionText");
  collisionText.text = "";
  collisionText.color = "#ff0000";
  collisionText.fontSize = 52;
  collisionText.fontWeight = "bold";
  collisionText.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  collisionText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  collisionText.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  collisionText.alpha = 0;
  collisionText.shadowColor = "rgba(0,0,0,0.7)";
  collisionText.shadowBlur = 12;
  collisionText.shadowOffsetX = 3;
  collisionText.shadowOffsetY = 3;
  advancedTexture.addControl(collisionText);

  let collisionFadeTimer: ReturnType<typeof setInterval> | null = null;

  function showCollisionText(message: string, color: string): void {
    collisionText.text = message;
    collisionText.color = color;
    collisionText.alpha = 1.0;
    collisionText.fontSize = 52;

    if (collisionFadeTimer) clearInterval(collisionFadeTimer);

    setTimeout(() => {
      collisionFadeTimer = setInterval(() => {
        collisionText.alpha -= 0.04;
        if (collisionText.alpha <= 0) {
          collisionText.alpha = 0;
          if (collisionFadeTimer) {
            clearInterval(collisionFadeTimer);
            collisionFadeTimer = null;
          }
        }
      }, 30);
    }, 600);
  }

  // ============ KILL COUNTER (top-right) ============
  const killPanel = new Rectangle("killPanel");
  killPanel.width = "180px";
  killPanel.height = "60px";
  killPanel.cornerRadius = 12;
  killPanel.color = "rgba(255, 50, 50, 0.4)";
  killPanel.thickness = 1;
  killPanel.background = "rgba(0, 0, 0, 0.5)";
  killPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  killPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  killPanel.left = "-20px";
  killPanel.top = "20px";
  advancedTexture.addControl(killPanel);

  const killLabel = new TextBlock("killLabel");
  killLabel.text = "HITS";
  killLabel.color = "rgba(255, 255, 255, 0.6)";
  killLabel.fontSize = 13;
  killLabel.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  killLabel.top = "-12px";
  killPanel.addControl(killLabel);

  const killCountText = new TextBlock("killCountText");
  killCountText.text = "0";
  killCountText.color = "#ff4444";
  killCountText.fontSize = 28;
  killCountText.fontWeight = "bold";
  killCountText.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  killCountText.top = "10px";
  killPanel.addControl(killCountText);

  function updateKillCounter(count: number): void {
    killCountText.text = count.toString();
    killCountText.fontSize = 36;
    setTimeout(() => {
      killCountText.fontSize = 28;
    }, 200);
  }

  // ============ CHECKPOINT HUD (top-center) ============
  const checkpointPanel = new Rectangle("checkpointPanel");
  checkpointPanel.width = "260px";
  checkpointPanel.height = "70px";
  checkpointPanel.cornerRadius = 12;
  checkpointPanel.color = "rgba(0, 255, 100, 0.4)";
  checkpointPanel.thickness = 1;
  checkpointPanel.background = "rgba(0, 0, 0, 0.5)";
  checkpointPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  checkpointPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  checkpointPanel.top = "20px";
  checkpointPanel.alpha = 0;
  advancedTexture.addControl(checkpointPanel);

  const checkpointTitle = new TextBlock("cpTitle");
  checkpointTitle.text = "CHECKPOINT";
  checkpointTitle.color = "#00ff66";
  checkpointTitle.fontSize = 14;
  checkpointTitle.fontWeight = "bold";
  checkpointTitle.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  checkpointTitle.top = "-18px";
  checkpointPanel.addControl(checkpointTitle);

  const checkpointProgress = new TextBlock("cpProgress");
  checkpointProgress.text = "0 / 10";
  checkpointProgress.color = "#ffffff";
  checkpointProgress.fontSize = 26;
  checkpointProgress.fontWeight = "bold";
  checkpointProgress.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  checkpointProgress.top = "5px";
  checkpointPanel.addControl(checkpointProgress);

  const checkpointTimer = new TextBlock("cpTimer");
  checkpointTimer.text = "0.0s";
  checkpointTimer.color = "rgba(255, 255, 255, 0.7)";
  checkpointTimer.fontSize = 13;
  checkpointTimer.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  checkpointTimer.top = "24px";
  checkpointPanel.addControl(checkpointTimer);

  function updateCheckpointHUD(
    active: boolean,
    collected: number,
    total: number,
    time: number,
    _activeIndex: number,
  ): void {
    checkpointPanel.alpha = active ? 1 : 0;
    if (!active) return;
    checkpointProgress.text = collected + " / " + total;
    checkpointTimer.text = time.toFixed(1) + "s";
    if (collected === total) {
      checkpointTitle.text = "COMPLETE!";
      checkpointTitle.color = "#ffdd00";
    } else {
      checkpointTitle.text = "CHECKPOINT";
      checkpointTitle.color = "#00ff66";
    }
  }

  // ============ WANTED LEVEL (top-left) ============
  const wantedPanel = new Rectangle("wantedPanel");
  wantedPanel.width = "200px";
  wantedPanel.height = "50px";
  wantedPanel.cornerRadius = 10;
  wantedPanel.color = "rgba(255, 50, 50, 0.4)";
  wantedPanel.thickness = 1;
  wantedPanel.background = "rgba(0, 0, 0, 0.5)";
  wantedPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  wantedPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  wantedPanel.left = "20px";
  wantedPanel.top = "20px";
  wantedPanel.alpha = 0;
  advancedTexture.addControl(wantedPanel);

  const wantedStars = new TextBlock("wantedStars");
  wantedStars.text = "";
  wantedStars.color = "#ff4444";
  wantedStars.fontSize = 28;
  wantedStars.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  wantedStars.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  wantedPanel.addControl(wantedStars);

  let wantedPulse = 0;

  function updateWantedLevel(level: number): void {
    if (level <= 0) {
      wantedPanel.alpha = 0;
      return;
    }
    wantedPanel.alpha = 1;
    wantedStars.text = "★".repeat(level) + "☆".repeat(5 - level);
    wantedPulse += 0.08;
    const pulse = 0.8 + Math.sin(wantedPulse) * 0.2;
    wantedStars.alpha = level >= 3 ? pulse : 1;
    wantedStars.color =
      level >= 4 ? "#ff0000" : level >= 2 ? "#ff6600" : "#ff4444";
  }

  // ============ MISSION COMPLETE SPLASH ============
  const missionCompletePanel = new Rectangle("missionComplete");
  missionCompletePanel.width = "500px";
  missionCompletePanel.height = "160px";
  missionCompletePanel.cornerRadius = 20;
  missionCompletePanel.color = "rgba(255, 215, 0, 0.6)";
  missionCompletePanel.thickness = 2;
  missionCompletePanel.background = "rgba(0, 0, 0, 0.7)";
  missionCompletePanel.horizontalAlignment =
    Control.HORIZONTAL_ALIGNMENT_CENTER;
  missionCompletePanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  missionCompletePanel.alpha = 0;
  advancedTexture.addControl(missionCompletePanel);

  const missionTitle = new TextBlock("missionTitle");
  missionTitle.text = "MISSION COMPLETE!";
  missionTitle.color = "#ffd700";
  missionTitle.fontSize = 36;
  missionTitle.fontWeight = "bold";
  missionTitle.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  missionTitle.top = "-25px";
  missionTitle.shadowColor = "rgba(0,0,0,0.7)";
  missionTitle.shadowBlur = 8;
  missionCompletePanel.addControl(missionTitle);

  const missionTimeText = new TextBlock("missionTime");
  missionTimeText.text = "";
  missionTimeText.color = "#ffffff";
  missionTimeText.fontSize = 24;
  missionTimeText.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  missionTimeText.top = "20px";
  missionCompletePanel.addControl(missionTimeText);

  const missionSubText = new TextBlock("missionSub");
  missionSubText.text = "All checkpoints collected!";
  missionSubText.color = "rgba(255, 255, 255, 0.6)";
  missionSubText.fontSize = 14;
  missionSubText.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  missionSubText.top = "50px";
  missionCompletePanel.addControl(missionSubText);

  function showMissionComplete(time: number): void {
    missionTimeText.text = "Time: " + time.toFixed(1) + " seconds";
    missionCompletePanel.alpha = 1;

    setTimeout(() => {
      const fadeInt = setInterval(() => {
        missionCompletePanel.alpha -= 0.02;
        if (missionCompletePanel.alpha <= 0) {
          missionCompletePanel.alpha = 0;
          clearInterval(fadeInt);
        }
      }, 30);
    }, 5000);
  }

  // ============ VEHICLE PROMPT ============
  const vehiclePrompt = new TextBlock("vehiclePrompt");
  vehiclePrompt.text = "Press F to enter vehicle";
  vehiclePrompt.color = "#ffffff";
  vehiclePrompt.fontSize = 22;
  vehiclePrompt.fontWeight = "bold";
  vehiclePrompt.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  vehiclePrompt.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  vehiclePrompt.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  vehiclePrompt.top = "-140px";
  vehiclePrompt.alpha = 0;
  vehiclePrompt.shadowColor = "rgba(0,0,0,0.7)";
  vehiclePrompt.shadowBlur = 8;
  vehiclePrompt.shadowOffsetX = 2;
  vehiclePrompt.shadowOffsetY = 2;
  advancedTexture.addControl(vehiclePrompt);

  function showVehiclePrompt(show: boolean, text?: string): void {
    vehiclePrompt.alpha = show ? 1 : 0;
    if (text) vehiclePrompt.text = text;
  }

  // ============ PLAYER HEALTH BAR (bottom-center) ============
  const healthPanel = new Rectangle("healthPanel");
  healthPanel.width = "220px";
  healthPanel.height = "30px";
  healthPanel.cornerRadius = 6;
  healthPanel.color = "rgba(255, 255, 255, 0.2)";
  healthPanel.thickness = 1;
  healthPanel.background = "rgba(0, 0, 0, 0.5)";
  healthPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  healthPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  healthPanel.top = "-20px";
  advancedTexture.addControl(healthPanel);

  const healthBarBg = new Rectangle("healthBarBg");
  healthBarBg.width = "200px";
  healthBarBg.height = "14px";
  healthBarBg.cornerRadius = 4;
  healthBarBg.background = "rgba(80, 0, 0, 0.6)";
  healthBarBg.color = "transparent";
  healthBarBg.thickness = 0;
  healthPanel.addControl(healthBarBg);

  const healthBarFill = new Rectangle("healthBarFill");
  healthBarFill.width = "200px";
  healthBarFill.height = "14px";
  healthBarFill.cornerRadius = 4;
  healthBarFill.background = "#44cc44";
  healthBarFill.color = "transparent";
  healthBarFill.thickness = 0;
  healthBarFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  healthBarBg.addControl(healthBarFill);

  const healthLabel = new TextBlock("healthLabel");
  healthLabel.text = "HP";
  healthLabel.color = "rgba(255,255,255,0.7)";
  healthLabel.fontSize = 10;
  healthLabel.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  healthLabel.top = "-12px";
  healthPanel.addControl(healthLabel);

  function updateHealthBar(hp: number, maxHp: number): void {
    const pct = Math.max(0, Math.min(1, hp / maxHp));
    healthBarFill.width = pct * 200 + "px";
    if (pct > 0.6) healthBarFill.background = "#44cc44";
    else if (pct > 0.3) healthBarFill.background = "#ccaa22";
    else healthBarFill.background = "#cc2222";
  }

  // ============ VEHICLE HEALTH BAR (below speed panel) ============
  const vhealthPanel = new Rectangle("vhealthPanel");
  vhealthPanel.width = "220px";
  vhealthPanel.height = "24px";
  vhealthPanel.cornerRadius = 6;
  vhealthPanel.color = "rgba(255, 255, 255, 0.2)";
  vhealthPanel.thickness = 1;
  vhealthPanel.background = "rgba(0, 0, 0, 0.45)";
  vhealthPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  vhealthPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  vhealthPanel.left = "20px";
  vhealthPanel.top = "-125px";
  vhealthPanel.alpha = 0;
  advancedTexture.addControl(vhealthPanel);

  const vhealthBarBg = new Rectangle("vhealthBarBg");
  vhealthBarBg.width = "200px";
  vhealthBarBg.height = "10px";
  vhealthBarBg.cornerRadius = 3;
  vhealthBarBg.background = "rgba(80, 80, 0, 0.5)";
  vhealthBarBg.color = "transparent";
  vhealthBarBg.thickness = 0;
  vhealthPanel.addControl(vhealthBarBg);

  const vhealthBarFill = new Rectangle("vhealthBarFill");
  vhealthBarFill.width = "200px";
  vhealthBarFill.height = "10px";
  vhealthBarFill.cornerRadius = 3;
  vhealthBarFill.background = "#44aacc";
  vhealthBarFill.color = "transparent";
  vhealthBarFill.thickness = 0;
  vhealthBarFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  vhealthBarBg.addControl(vhealthBarFill);

  const vhealthLabel = new TextBlock("vhealthLabel");
  vhealthLabel.text = "VEHICLE";
  vhealthLabel.color = "rgba(255,255,255,0.6)";
  vhealthLabel.fontSize = 9;
  vhealthLabel.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  vhealthLabel.top = "-8px";
  vhealthPanel.addControl(vhealthLabel);

  function updateVehicleHealthBar(
    hp: number,
    maxHp: number,
    visible: boolean,
  ): void {
    vhealthPanel.alpha = visible ? 1 : 0;
    const pct = Math.max(0, Math.min(1, hp / maxHp));
    vhealthBarFill.width = pct * 200 + "px";
    if (pct > 0.6) vhealthBarFill.background = "#44aacc";
    else if (pct > 0.3) vhealthBarFill.background = "#ccaa22";
    else vhealthBarFill.background = "#cc4422";
  }

  // ============ MONEY DISPLAY (top-right, below kills) ============
  const moneyPanel = new Rectangle("moneyPanel");
  moneyPanel.width = "180px";
  moneyPanel.height = "45px";
  moneyPanel.cornerRadius = 12;
  moneyPanel.color = "rgba(0, 200, 80, 0.4)";
  moneyPanel.thickness = 1;
  moneyPanel.background = "rgba(0, 0, 0, 0.5)";
  moneyPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  moneyPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  moneyPanel.left = "-20px";
  moneyPanel.top = "90px";
  advancedTexture.addControl(moneyPanel);

  const moneyText = new TextBlock("moneyText");
  moneyText.text = "$500";
  moneyText.color = "#44dd66";
  moneyText.fontSize = 24;
  moneyText.fontWeight = "bold";
  moneyText.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  moneyPanel.addControl(moneyText);

  function updateMoney(amount: number): void {
    moneyText.text = "$" + Math.floor(amount).toLocaleString();
  }

  // ============ WASTED / BUSTED OVERLAYS ============
  const deathOverlay = new Rectangle("deathOverlay");
  deathOverlay.width = "100%";
  deathOverlay.height = "100%";
  deathOverlay.background = "rgba(120, 0, 0, 0.0)";
  deathOverlay.color = "transparent";
  deathOverlay.thickness = 0;
  deathOverlay.alpha = 0;
  deathOverlay.zIndex = 100;
  advancedTexture.addControl(deathOverlay);

  const deathText = new TextBlock("deathText");
  deathText.text = "WASTED";
  deathText.color = "#ff2222";
  deathText.fontSize = 72;
  deathText.fontWeight = "bold";
  deathText.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  deathText.shadowColor = "rgba(0,0,0,0.8)";
  deathText.shadowBlur = 15;
  deathText.shadowOffsetX = 3;
  deathText.shadowOffsetY = 3;
  deathOverlay.addControl(deathText);

  const deathSubText = new TextBlock("deathSubText");
  deathSubText.text = "";
  deathSubText.color = "rgba(255,255,255,0.7)";
  deathSubText.fontSize = 20;
  deathSubText.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  deathSubText.top = "55px";
  deathOverlay.addControl(deathSubText);

  let deathFadeTimer: ReturnType<typeof setInterval> | null = null;

  function showWastedScreen(onComplete: () => void): void {
    deathText.text = "WASTED";
    deathText.color = "#ff2222";
    deathSubText.text = "You lost 10% of your money";
    deathOverlay.background = "rgba(120, 0, 0, 0.6)";
    deathOverlay.alpha = 0;

    if (deathFadeTimer) clearInterval(deathFadeTimer);

    let fadeIn = 0;
    deathFadeTimer = setInterval(() => {
      fadeIn += 0.03;
      if (fadeIn >= 1) {
        fadeIn = 1;
        if (deathFadeTimer) clearInterval(deathFadeTimer);
        setTimeout(() => {
          onComplete();
        }, 2500);
      }
      deathOverlay.alpha = fadeIn;
    }, 30);
  }

  function showBustedScreen(onComplete: () => void): void {
    deathText.text = "BUSTED";
    deathText.color = "#4488ff";
    deathSubText.text = "You lost 10% of your money";
    deathOverlay.background = "rgba(0, 20, 80, 0.6)";
    deathOverlay.alpha = 0;

    if (deathFadeTimer) clearInterval(deathFadeTimer);

    let fadeIn = 0;
    deathFadeTimer = setInterval(() => {
      fadeIn += 0.03;
      if (fadeIn >= 1) {
        fadeIn = 1;
        if (deathFadeTimer) clearInterval(deathFadeTimer);
        setTimeout(() => {
          onComplete();
        }, 2500);
      }
      deathOverlay.alpha = fadeIn;
    }, 30);
  }

  function hideDeathScreen(): void {
    if (deathFadeTimer) {
      clearInterval(deathFadeTimer);
      deathFadeTimer = null;
    }
    let fadeOut = deathOverlay.alpha;
    const fadeInt = setInterval(() => {
      fadeOut -= 0.05;
      if (fadeOut <= 0) {
        deathOverlay.alpha = 0;
        clearInterval(fadeInt);
      } else {
        deathOverlay.alpha = fadeOut;
      }
    }, 30);
  }

  // ============ MISSION OBJECTIVE (top-center, below checkpoint) ============
  const missionObjPanel = new Rectangle("missionObjPanel");
  missionObjPanel.width = "350px";
  missionObjPanel.height = "50px";
  missionObjPanel.cornerRadius = 10;
  missionObjPanel.color = "rgba(255, 200, 0, 0.4)";
  missionObjPanel.thickness = 1;
  missionObjPanel.background = "rgba(0, 0, 0, 0.5)";
  missionObjPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  missionObjPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  missionObjPanel.top = "100px";
  missionObjPanel.alpha = 0;
  advancedTexture.addControl(missionObjPanel);

  const missionObjText = new TextBlock("missionObjText");
  missionObjText.text = "";
  missionObjText.color = "#ffffff";
  missionObjText.fontSize = 16;
  missionObjText.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  missionObjText.textWrapping = true;
  missionObjPanel.addControl(missionObjText);

  function updateMissionObjective(text: string, show: boolean): void {
    missionObjPanel.alpha = show ? 1 : 0;
    missionObjText.text = text;
  }

  // Mission timer
  const missionTimerText = new TextBlock("missionTimerText");
  missionTimerText.text = "";
  missionTimerText.color = "#ffaa00";
  missionTimerText.fontSize = 22;
  missionTimerText.fontWeight = "bold";
  missionTimerText.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  missionTimerText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  missionTimerText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  missionTimerText.top = "155px";
  missionTimerText.alpha = 0;
  advancedTexture.addControl(missionTimerText);

  function updateMissionTimer(time: number, show: boolean): void {
    missionTimerText.alpha = show ? 1 : 0;
    if (show) {
      const min = Math.floor(time / 60);
      const sec = Math.floor(time % 60);
      missionTimerText.text = min + ":" + (sec < 10 ? "0" : "") + sec;
    }
  }

  // Mission start dialog
  const missionStartPanel = new Rectangle("missionStartPanel");
  missionStartPanel.width = "420px";
  missionStartPanel.height = "200px";
  missionStartPanel.cornerRadius = 16;
  missionStartPanel.color = "rgba(255, 200, 0, 0.5)";
  missionStartPanel.thickness = 2;
  missionStartPanel.background = "rgba(0, 0, 0, 0.75)";
  missionStartPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  missionStartPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  missionStartPanel.alpha = 0;
  missionStartPanel.zIndex = 50;
  advancedTexture.addControl(missionStartPanel);

  const msTitle = new TextBlock("msTitle");
  msTitle.text = "";
  msTitle.color = "#ffd700";
  msTitle.fontSize = 28;
  msTitle.fontWeight = "bold";
  msTitle.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  msTitle.top = "-60px";
  missionStartPanel.addControl(msTitle);

  const msDesc = new TextBlock("msDesc");
  msDesc.text = "";
  msDesc.color = "rgba(255,255,255,0.8)";
  msDesc.fontSize = 16;
  msDesc.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  msDesc.textWrapping = true;
  msDesc.top = "-10px";
  missionStartPanel.addControl(msDesc);

  const msReward = new TextBlock("msReward");
  msReward.text = "";
  msReward.color = "#44dd66";
  msReward.fontSize = 20;
  msReward.fontWeight = "bold";
  msReward.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  msReward.top = "35px";
  missionStartPanel.addControl(msReward);

  const msHint = new TextBlock("msHint");
  msHint.text = "Press ENTER to accept  |  Press ESC to decline";
  msHint.color = "rgba(255,255,255,0.5)";
  msHint.fontSize = 13;
  msHint.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  msHint.top = "70px";
  missionStartPanel.addControl(msHint);

  function showMissionStart(title: string, desc: string, reward: number): void {
    msTitle.text = title;
    msDesc.text = desc;
    msReward.text = "Reward: $" + reward.toLocaleString();
    missionStartPanel.alpha = 1;
  }

  function hideMissionStart(): void {
    missionStartPanel.alpha = 0;
  }

  // Mission failed splash
  function showMissionFailed(reason: string): void {
    showCollisionText("MISSION FAILED", "#ff2222");
    setTimeout(() => {
      showCollisionText(reason, "#ff8888");
    }, 1200);
  }

  // ============ WEAPON HUD (bottom-right, above controls) ============
  const weaponPanel = new Rectangle("weaponPanel");
  weaponPanel.width = "180px";
  weaponPanel.height = "50px";
  weaponPanel.cornerRadius = 10;
  weaponPanel.color = "rgba(255, 255, 255, 0.3)";
  weaponPanel.thickness = 1;
  weaponPanel.background = "rgba(0, 0, 0, 0.45)";
  weaponPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  weaponPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  weaponPanel.left = "-20px";
  weaponPanel.top = "-140px";
  weaponPanel.alpha = 0;
  advancedTexture.addControl(weaponPanel);

  const weaponName = new TextBlock("weaponName");
  weaponName.text = "FIST";
  weaponName.color = "#ffffff";
  weaponName.fontSize = 16;
  weaponName.fontWeight = "bold";
  weaponName.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  weaponName.top = "-10px";
  weaponPanel.addControl(weaponName);

  const ammoText = new TextBlock("ammoText");
  ammoText.text = "∞";
  ammoText.color = "rgba(255,255,255,0.7)";
  ammoText.fontSize = 14;
  ammoText.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  ammoText.top = "12px";
  weaponPanel.addControl(ammoText);

  function updateWeaponHUD(
    wName: string,
    ammo: number,
    maxAmmo: number,
    show: boolean,
  ): void {
    weaponPanel.alpha = show ? 1 : 0;
    weaponName.text = wName.toUpperCase();
    if (maxAmmo <= 0) {
      ammoText.text = "∞";
    } else {
      ammoText.text = ammo + " / " + maxAmmo;
      ammoText.color =
        ammo < maxAmmo * 0.2 ? "#ff4444" : "rgba(255,255,255,0.7)";
    }
  }

  // ============ CROSSHAIR ============
  const crosshairH = new Rectangle("crosshairH");
  crosshairH.width = "20px";
  crosshairH.height = "2px";
  crosshairH.background = "rgba(255,255,255,0.7)";
  crosshairH.color = "transparent";
  crosshairH.thickness = 0;
  crosshairH.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  crosshairH.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  crosshairH.alpha = 0;
  crosshairH.zIndex = 90;
  advancedTexture.addControl(crosshairH);

  const crosshairV = new Rectangle("crosshairV");
  crosshairV.width = "2px";
  crosshairV.height = "20px";
  crosshairV.background = "rgba(255,255,255,0.7)";
  crosshairV.color = "transparent";
  crosshairV.thickness = 0;
  crosshairV.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  crosshairV.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  crosshairV.alpha = 0;
  crosshairV.zIndex = 90;
  advancedTexture.addControl(crosshairV);

  function showCrosshair(show: boolean): void {
    crosshairH.alpha = show ? 1 : 0;
    crosshairV.alpha = show ? 1 : 0;
  }

  // ============ MINIMAP (bottom-left corner, above speed panel) ============
  const minimapSize = 220;
  const minimapRadius = minimapSize / 2;
  const minimapPanel = new Rectangle("minimapPanel");
  minimapPanel.width = minimapSize + "px";
  minimapPanel.height = minimapSize + "px";
  minimapPanel.cornerRadius = minimapRadius; // circular
  minimapPanel.color = "rgba(255, 255, 255, 0.5)";
  minimapPanel.thickness = 2;
  minimapPanel.background = "rgba(10, 15, 10, 0.85)";
  minimapPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  minimapPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  minimapPanel.left = "15px";
  minimapPanel.top = "-140px";
  advancedTexture.addControl(minimapPanel);

  // Road grid lines (pool of thin rectangles)
  const maxRoadLines = 32;
  const roadLines: Rectangle[] = [];
  for (let i = 0; i < maxRoadLines; i++) {
    const rl = new Rectangle("roadLine_" + i);
    rl.width = "2px";
    rl.height = minimapSize + 20 + "px"; // long enough to span the circle
    rl.background = "rgba(80, 80, 80, 0.7)";
    rl.color = "transparent";
    rl.thickness = 0;
    rl.alpha = 0;
    rl.isHitTestVisible = false;
    minimapPanel.addControl(rl);
    roadLines.push(rl);
  }

  // Compass "N" indicator
  const compassN = new TextBlock("compassN");
  compassN.text = "N";
  compassN.color = "#ff4444";
  compassN.fontSize = 14;
  compassN.fontWeight = "bold";
  compassN.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  compassN.top = -(minimapRadius - 10) + "px";
  compassN.shadowColor = "rgba(0,0,0,0.8)";
  compassN.shadowBlur = 4;
  minimapPanel.addControl(compassN);

  // Minimap outer ring label
  const minimapLabel = new TextBlock("minimapLabel");
  minimapLabel.text = "MAP";
  minimapLabel.color = "rgba(255,255,255,0.4)";
  minimapLabel.fontSize = 10;
  minimapLabel.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  minimapLabel.top = minimapRadius - 14 + "px";
  minimapPanel.addControl(minimapLabel);

  // Player dot (always centered) — bright and bigger
  const playerDot = new Rectangle("playerDot");
  playerDot.width = "8px";
  playerDot.height = "8px";
  playerDot.cornerRadius = 4;
  playerDot.background = "#ffffff";
  playerDot.color = "#00ccff";
  playerDot.thickness = 1;
  playerDot.zIndex = 20;
  minimapPanel.addControl(playerDot);

  // Player direction indicator
  const playerArrow = new Rectangle("playerArrow");
  playerArrow.width = "4px";
  playerArrow.height = "14px";
  playerArrow.background = "#00ccff";
  playerArrow.color = "transparent";
  playerArrow.thickness = 0;
  playerArrow.top = "-11px";
  playerArrow.zIndex = 20;
  minimapPanel.addControl(playerArrow);

  // Minimap marker dots (reusable pool — bigger)
  const maxMinimapDots = 30;
  const minimapDots: Rectangle[] = [];
  const minimapDotLabels: TextBlock[] = [];
  for (let i = 0; i < maxMinimapDots; i++) {
    const dot = new Rectangle("mmDot_" + i);
    dot.width = "6px";
    dot.height = "6px";
    dot.cornerRadius = 3;
    dot.background = "#ff0000";
    dot.color = "transparent";
    dot.thickness = 0;
    dot.alpha = 0;
    dot.zIndex = 10;
    minimapPanel.addControl(dot);
    minimapDots.push(dot);

    // Optional label for giver/waypoint dots
    const lbl = new TextBlock("mmLbl_" + i);
    lbl.text = "";
    lbl.color = "#ffffff";
    lbl.fontSize = 8;
    lbl.fontFamily = "'Segoe UI', Tahoma, sans-serif";
    lbl.alpha = 0;
    lbl.zIndex = 11;
    lbl.shadowColor = "rgba(0,0,0,1)";
    lbl.shadowBlur = 3;
    minimapPanel.addControl(lbl);
    minimapDotLabels.push(lbl);
  }

  const MINIMAP_SCALE = 0.55; // pixels per world unit on minimap
  let mmRoadsX: number[] = []; // horizontal road Z-positions
  let mmRoadsZ: number[] = []; // vertical road X-positions

  function setMinimapRoads(roadsX: number[], roadsZ: number[]): void {
    mmRoadsX = roadsX;
    mmRoadsZ = roadsZ;
  }

  function updateMinimap(
    playerX: number,
    playerZ: number,
    playerRot: number,
    markers: MinimapMarker[],
  ): void {
    const maxDist = minimapRadius - 8;

    // --- Compass N is always at the top (fixed north-up map) ---
    compassN.left = "0px";
    compassN.top = -(minimapRadius - 10) + "px";

    // Rotate only the player arrow to show facing direction
    playerArrow.rotation = playerRot;

    // --- Draw road grid lines (fixed north-up) ---
    let roadIdx = 0;
    // Vertical roads (at certain X positions → horizontal offset on minimap)
    for (let ri = 0; ri < mmRoadsZ.length && roadIdx < maxRoadLines; ri++) {
      const wx = mmRoadsZ[ri];
      const sx = (wx - playerX) * MINIMAP_SCALE;
      if (Math.abs(sx) > maxDist + 10) continue;
      roadLines[roadIdx].left = sx + "px";
      roadLines[roadIdx].top = "0px";
      roadLines[roadIdx].rotation = 0; // vertical line
      roadLines[roadIdx].alpha = 0.5;
      roadIdx++;
    }
    // Horizontal roads (at certain Z positions → vertical offset on minimap)
    for (let ri = 0; ri < mmRoadsX.length && roadIdx < maxRoadLines; ri++) {
      const wz = mmRoadsX[ri];
      const sy = (wz - playerZ) * MINIMAP_SCALE;
      if (Math.abs(sy) > maxDist + 10) continue;
      roadLines[roadIdx].left = "0px";
      roadLines[roadIdx].top = sy + "px";
      roadLines[roadIdx].rotation = Math.PI / 2; // horizontal line
      roadLines[roadIdx].alpha = 0.5;
      roadIdx++;
    }
    // Hide unused road lines
    for (; roadIdx < maxRoadLines; roadIdx++) {
      roadLines[roadIdx].alpha = 0;
    }

    // --- Position marker dots (fixed north-up) ---
    for (let i = 0; i < maxMinimapDots; i++) {
      if (i < markers.length) {
        const m = markers[i];
        // Simple world offset: X is right, Z is down on minimap
        let sx = (m.x - playerX) * MINIMAP_SCALE;
        let sy = (m.z - playerZ) * MINIMAP_SCALE;
        const dist = Math.sqrt(sx * sx + sy * sy);

        if (dist > maxDist) {
          const scale = maxDist / dist;
          sx *= scale;
          sy *= scale;
        }

        minimapDots[i].left = sx + "px";
        minimapDots[i].top = sy + "px";
        minimapDots[i].background = m.color;
        minimapDots[i].alpha = 1;

        // Size and shape based on type
        switch (m.type) {
          case "giver":
            minimapDots[i].width = "10px";
            minimapDots[i].height = "10px";
            minimapDots[i].cornerRadius = 0; // square for givers
            minimapDots[i].rotation = Math.PI / 4; // diamond shape
            minimapDots[i].color = "#ffffff";
            minimapDots[i].thickness = 1;
            break;
          case "waypoint":
            minimapDots[i].width = "12px";
            minimapDots[i].height = "12px";
            minimapDots[i].cornerRadius = 0;
            minimapDots[i].rotation = Math.PI / 4;
            minimapDots[i].color = "#ffffff";
            minimapDots[i].thickness = 1;
            break;
          case "police":
            minimapDots[i].width = "7px";
            minimapDots[i].height = "7px";
            minimapDots[i].cornerRadius = 3.5;
            minimapDots[i].rotation = 0;
            minimapDots[i].color = "transparent";
            minimapDots[i].thickness = 0;
            break;
          case "shop":
          case "safehouse":
            minimapDots[i].width = "6px";
            minimapDots[i].height = "6px";
            minimapDots[i].cornerRadius = 1;
            minimapDots[i].rotation = 0;
            minimapDots[i].color = "transparent";
            minimapDots[i].thickness = 0;
            break;
          default:
            minimapDots[i].width = "6px";
            minimapDots[i].height = "6px";
            minimapDots[i].cornerRadius = 3;
            minimapDots[i].rotation = 0;
            minimapDots[i].color = "transparent";
            minimapDots[i].thickness = 0;
        }

        // Labels for givers and waypoints
        if (m.type === "giver" || m.type === "waypoint") {
          minimapDotLabels[i].text = m.type === "giver" ? "★" : "●";
          minimapDotLabels[i].left = sx + "px";
          minimapDotLabels[i].top = sy - 9 + "px";
          minimapDotLabels[i].color = m.color;
          minimapDotLabels[i].fontSize = m.type === "giver" ? 11 : 10;
          minimapDotLabels[i].alpha = 1;
        } else {
          minimapDotLabels[i].alpha = 0;
        }
      } else {
        minimapDots[i].alpha = 0;
        minimapDotLabels[i].alpha = 0;
      }
    }
  }

  // ============ UPDATE FUNCTION ============
  function updateSpeed(speed: number, keys: Keys): void {
    const displaySpeed = Math.round(speed);
    speedText.text = displaySpeed.toString();

    if (displaySpeed > 100) {
      speedText.color = "#ff4444";
    } else if (displaySpeed > 60) {
      speedText.color = "#ffaa00";
    } else {
      speedText.color = "#ffffff";
    }

    if (keys && (keys["s"] || keys["arrowdown"])) {
      gearText.text = "R";
      gearText.color = "#ff4444";
    } else if (displaySpeed < 2) {
      gearText.text = "N";
      gearText.color = "#00ff88";
    } else if (displaySpeed < 30) {
      gearText.text = "1";
      gearText.color = "#ffffff";
    } else if (displaySpeed < 60) {
      gearText.text = "2";
      gearText.color = "#ffffff";
    } else if (displaySpeed < 90) {
      gearText.text = "3";
      gearText.color = "#ffffff";
    } else if (displaySpeed < 120) {
      gearText.text = "4";
      gearText.color = "#ffffff";
    } else {
      gearText.text = "5";
      gearText.color = "#ffaa00";
    }
  }

  // ============ HELP / TUTORIAL OVERLAY ============
  const helpOverlay = new Rectangle("helpOverlay");
  helpOverlay.width = "520px";
  helpOverlay.height = "440px";
  helpOverlay.cornerRadius = 20;
  helpOverlay.color = "rgba(255, 200, 0, 0.5)";
  helpOverlay.thickness = 2;
  helpOverlay.background = "rgba(0, 0, 0, 0.88)";
  helpOverlay.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  helpOverlay.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  helpOverlay.zIndex = 80;
  helpOverlay.alpha = 1;
  advancedTexture.addControl(helpOverlay);

  const helpTitle = new TextBlock("helpTitle");
  helpTitle.text = "🎮  HOW TO PLAY";
  helpTitle.color = "#ffd700";
  helpTitle.fontSize = 30;
  helpTitle.fontWeight = "bold";
  helpTitle.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  helpTitle.top = "-180px";
  helpOverlay.addControl(helpTitle);

  const helpLines = [
    "═══════════  DRIVING  ═══════════",
    "  W A S D / Arrow keys — Drive & steer",
    "  Space — Brake      F — Exit vehicle",
    "",
    "═══════════  ON FOOT  ═══════════",
    "  W A S D — Walk      F — Enter car / Carjack",
    "  E — Talk to NPC / Start mission / Use shop",
    "  Q — Switch weapon   Click — Attack / Shoot",
    "",
    "═══════  HOW TO START MISSIONS  ═══════",
    "  1. Press F to exit your car",
    "  2. Walk to a ★ yellow marker on the minimap",
    "     (Vinnie, Tony, Racer, Taxi Stand, Contact)",
    "  3. Press E when you see the prompt",
    "  4. Follow the green waypoint to complete it!",
    "",
    "═══════════  MINIMAP  ═══════════",
    "  ★ Yellow diamonds = Mission givers",
    "  ● Green diamond = Active mission waypoint",
    "  Blue dots = Police     Colored dots = Shops",
  ];

  helpLines.forEach((line, i) => {
    const hl = new TextBlock("helpLine_" + i);
    hl.text = line;
    hl.color = line.startsWith("══")
      ? "rgba(255,200,0,0.6)"
      : "rgba(255,255,255,0.85)";
    hl.fontSize = line.startsWith("══") ? 12 : 13;
    hl.fontFamily = "'Segoe UI', Tahoma, sans-serif";
    hl.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    hl.left = "35px";
    hl.top = -140 + i * 18 + "px";
    helpOverlay.addControl(hl);
  });

  const helpDismiss = new TextBlock("helpDismiss");
  helpDismiss.text = "Press H to close  (auto-hides in 12s)";
  helpDismiss.color = "rgba(255,255,255,0.4)";
  helpDismiss.fontSize = 13;
  helpDismiss.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  helpDismiss.top = "195px";
  helpOverlay.addControl(helpDismiss);

  let helpVisible = true;
  // Auto-hide after 12 seconds
  setTimeout(() => {
    if (helpVisible) {
      helpOverlay.alpha = 0;
      helpVisible = false;
    }
  }, 12000);

  function toggleHelp(): void {
    helpVisible = !helpVisible;
    helpOverlay.alpha = helpVisible ? 1 : 0;
  }

  // ============ MISSION HINT (persistent, bottom-center, above health) ============
  const missionHint = new TextBlock("missionHint");
  missionHint.text =
    "💡 Exit car (F) → Walk to ★ marker → Press E to start a mission";
  missionHint.color = "rgba(255, 200, 0, 0.7)";
  missionHint.fontSize = 14;
  missionHint.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  missionHint.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  missionHint.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  missionHint.top = "-55px";
  missionHint.shadowColor = "rgba(0,0,0,0.8)";
  missionHint.shadowBlur = 4;
  advancedTexture.addControl(missionHint);

  let hintPulse = 0;
  function updateMissionHint(hasMission: boolean, mode: string, guidanceText?: string): void {
    if (hasMission) {
      missionHint.alpha = 0;
      return;
    }
    hintPulse += 0.04;
    const pulse = 0.5 + Math.sin(hintPulse) * 0.3;
    missionHint.alpha = pulse;
    if (guidanceText) {
      missionHint.text = guidanceText;
    } else if (mode === "driving") {
      missionHint.text =
        "💡 Press F to exit car → Walk to ★ marker → Press E for missions";
    } else {
      missionHint.text =
        "💡 Walk to a ★ yellow marker on the minimap and press E";
    }
  }

  // ============ STORY PROGRESS (top-left, below wanted stars) ============
  const storyPanel = new Rectangle("storyPanel");
  storyPanel.width = "200px";
  storyPanel.height = "40px";
  storyPanel.cornerRadius = 8;
  storyPanel.color = "rgba(255, 200, 0, 0.4)";
  storyPanel.thickness = 1;
  storyPanel.background = "rgba(0, 0, 0, 0.5)";
  storyPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  storyPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  storyPanel.left = "20px";
  storyPanel.top = "75px";
  advancedTexture.addControl(storyPanel);

  const storyProgressText = new TextBlock("storyProgressText");
  storyProgressText.text = "STORY: MISSION 1/5";
  storyProgressText.color = "#ffd700";
  storyProgressText.fontSize = 15;
  storyProgressText.fontWeight = "bold";
  storyProgressText.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  storyPanel.addControl(storyProgressText);

  function updateStoryProgress(completed: number, total: number): void {
    if (completed >= total) {
      storyProgressText.text = "✅ STORY COMPLETE";
      storyProgressText.color = "#44ff66";
    } else {
      storyProgressText.text = `STORY: MISSION ${completed + 1}/${total}`;
      storyProgressText.color = "#ffd700";
    }
  }

  // ============ STORY COMPLETE SCREEN ============
  const storyCompleteOverlay = new Rectangle("storyCompleteOverlay");
  storyCompleteOverlay.width = "100%";
  storyCompleteOverlay.height = "100%";
  storyCompleteOverlay.background = "rgba(0, 0, 0, 0.0)";
  storyCompleteOverlay.color = "transparent";
  storyCompleteOverlay.thickness = 0;
  storyCompleteOverlay.alpha = 0;
  storyCompleteOverlay.zIndex = 110;
  advancedTexture.addControl(storyCompleteOverlay);

  const storyCompleteTitle = new TextBlock("storyCompleteTitle");
  storyCompleteTitle.text = "🏆 STORY COMPLETE 🏆";
  storyCompleteTitle.color = "#ffd700";
  storyCompleteTitle.fontSize = 56;
  storyCompleteTitle.fontWeight = "bold";
  storyCompleteTitle.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  storyCompleteTitle.shadowColor = "rgba(0,0,0,0.8)";
  storyCompleteTitle.shadowBlur = 15;
  storyCompleteTitle.shadowOffsetX = 3;
  storyCompleteTitle.shadowOffsetY = 3;
  storyCompleteTitle.top = "-40px";
  storyCompleteOverlay.addControl(storyCompleteTitle);

  const storyCompleteSub = new TextBlock("storyCompleteSub");
  storyCompleteSub.text = "You conquered the city. The streets are yours.";
  storyCompleteSub.color = "rgba(255, 255, 255, 0.8)";
  storyCompleteSub.fontSize = 22;
  storyCompleteSub.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  storyCompleteSub.top = "20px";
  storyCompleteOverlay.addControl(storyCompleteSub);

  const storyCompleteHint = new TextBlock("storyCompleteHint");
  storyCompleteHint.text = "Free roam continues — have fun!";
  storyCompleteHint.color = "rgba(255, 255, 255, 0.5)";
  storyCompleteHint.fontSize = 16;
  storyCompleteHint.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  storyCompleteHint.top = "60px";
  storyCompleteOverlay.addControl(storyCompleteHint);

  function showStoryComplete(): void {
    storyCompleteOverlay.background = "rgba(0, 20, 0, 0.75)";
    storyCompleteOverlay.alpha = 0;

    let fadeIn = 0;
    const fadeInterval = setInterval(() => {
      fadeIn += 0.02;
      if (fadeIn >= 1) {
        fadeIn = 1;
        clearInterval(fadeInterval);
        // Auto-hide after 8 seconds
        setTimeout(() => {
          let fadeOut = 1;
          const fadeOutInterval = setInterval(() => {
            fadeOut -= 0.02;
            if (fadeOut <= 0) {
              storyCompleteOverlay.alpha = 0;
              clearInterval(fadeOutInterval);
            } else {
              storyCompleteOverlay.alpha = fadeOut;
            }
          }, 30);
        }, 8000);
      }
      storyCompleteOverlay.alpha = fadeIn;
    }, 30);
  }

  return {
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
    updateMissionObjective,
    updateMissionTimer,
    showMissionStart,
    hideMissionStart,
    showMissionFailed,
    updateWeaponHUD,
    showCrosshair,
    updateMinimap,
    setMinimapRoads,
    toggleHelp,
    updateMissionHint,
    // Story mode additions
    updateStoryProgress,
    showStoryComplete,
  };
}

