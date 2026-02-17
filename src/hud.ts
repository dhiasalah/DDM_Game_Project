import {
  AdvancedDynamicTexture,
  TextBlock,
  Rectangle,
  Control,
} from "@babylonjs/gui";
import type { Scene } from "@babylonjs/core";
import type { Keys, HUDResult } from "./types";

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
  controlsPanel.height = "110px";
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
  controlsTitle.text = "CONTROLS";
  controlsTitle.color = "rgba(255, 255, 255, 0.6)";
  controlsTitle.fontSize = 13;
  controlsTitle.fontFamily = "'Segoe UI', Tahoma, sans-serif";
  controlsTitle.top = "-35px";
  controlsPanel.addControl(controlsTitle);

  const controlLines = [
    "W / ↑  —  Accelerate",
    "S / ↓  —  Reverse",
    "A D / ← →  —  Steer",
    "Space  —  Brake",
  ];

  controlLines.forEach((line, i) => {
    const ct = new TextBlock("ctrl_" + i);
    ct.text = line;
    ct.color = "rgba(255, 255, 255, 0.8)";
    ct.fontSize = 12;
    ct.fontFamily = "'Segoe UI', Tahoma, sans-serif";
    ct.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    ct.left = "20px";
    ct.top = -12 + i * 17 + "px";
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

  return {
    updateSpeed,
    showCollisionText,
    updateKillCounter,
    updateCheckpointHUD,
    updateWantedLevel,
    showMissionComplete,
  };
}
