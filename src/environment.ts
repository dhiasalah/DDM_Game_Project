import {
  MeshBuilder,
  StandardMaterial,
  CubeTexture,
  Texture,
  Color3,
  Color4,
  Vector3,
  Scene,
  Mesh,
  DynamicTexture,
} from "@babylonjs/core";
import type { ShadowGenerator } from "@babylonjs/core";
import type {
  BuildingData,
  EnvironmentResultExtended,
  DestructibleObject,
  ParkedCarData,
  IntersectionData,
  TrafficLightState,
} from "./types";

/* ================================================================
 *  SEEDED RANDOM – deterministic city generation
 * ================================================================ */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function createEnvironment(
  scene: Scene,
  shadowGenerator: ShadowGenerator,
): EnvironmentResultExtended {
  const rand = seededRandom(42);
  const MAP_SIZE = 800;
  const HALF = MAP_SIZE / 2; // 400
  const ROAD_W = 14;
  const ROAD_HALF = ROAD_W / 2; // 7
  const SIDEWALK_W = 3;
  const SIDEWALK_H = 0.15;
  const VIS_DIST = 220;
  const VIS_DIST_SQ = VIS_DIST * VIS_DIST;

  // ========== SKYBOX ==========
  const skybox = MeshBuilder.CreateBox("skyBox", { size: 1600 }, scene);
  const skyboxMaterial = new StandardMaterial("skyBoxMat", scene);
  skyboxMaterial.backFaceCulling = false;
  skyboxMaterial.reflectionTexture = new CubeTexture(
    "/textures/skybox/skybox",
    scene,
  );
  skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
  skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
  skyboxMaterial.specularColor = new Color3(0, 0, 0);
  skybox.material = skyboxMaterial;
  skyboxMaterial.freeze();
  skybox.infiniteDistance = true;
  skybox.freezeWorldMatrix();

  // ========== GROUND ==========
  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: MAP_SIZE, height: MAP_SIZE, subdivisions: 4 },
    scene,
  );
  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new Color3(0.28, 0.35, 0.22);
  groundMat.specularColor = new Color3(0.1, 0.1, 0.1);
  groundMat.freeze();
  ground.material = groundMat;
  ground.receiveShadows = true;
  ground.freezeWorldMatrix();

  // ========== SHARED MATERIALS ==========
  const roadMat = new StandardMaterial("roadMat", scene);
  roadMat.diffuseColor = new Color3(0.2, 0.2, 0.22);
  roadMat.specularColor = new Color3(0.15, 0.15, 0.15);
  roadMat.specularPower = 64;
  roadMat.freeze();

  const roadLineMat = new StandardMaterial("roadLineMat", scene);
  roadLineMat.diffuseColor = new Color3(0.9, 0.85, 0.2);
  roadLineMat.emissiveColor = new Color3(0.15, 0.14, 0.03);
  roadLineMat.freeze();

  const sidewalkMat = new StandardMaterial("sidewalkMat", scene);
  sidewalkMat.diffuseColor = new Color3(0.55, 0.53, 0.5);
  sidewalkMat.specularColor = new Color3(0.2, 0.2, 0.2);
  sidewalkMat.freeze();

  // ========== PROCEDURAL ROAD GRID ==========
  const roadsZ_X: number[] = []; // Z-axis roads (vertical), at X positions
  const roadsX_Z: number[] = []; // X-axis roads (horizontal), at Z positions

  for (let v = -350; v <= 350; v += 50) {
    roadsZ_X.push(v);
    roadsX_Z.push(v);
  }

  const roads: Mesh[] = [];
  const allDashes: Mesh[] = [];
  const allSidewalkMeshes: Mesh[] = [];

  // Intersections
  const intersections: IntersectionData[] = [];
  for (const rx of roadsZ_X) {
    for (const rz of roadsX_Z) {
      intersections.push({ x: rx, z: rz });
    }
  }

  // Create Z-axis roads (vertical)
  roadsZ_X.forEach((rx, idx) => {
    const road = MeshBuilder.CreateGround(
      "roadZ_" + idx,
      { width: ROAD_W, height: MAP_SIZE },
      scene,
    );
    road.position.set(rx, 0.02, 0);
    road.material = roadMat;
    road.receiveShadows = true;
    road.freezeWorldMatrix();
    roads.push(road);

    // Dashes — skip at intersections
    for (let z = -HALF + 5; z < HALF - 5; z += 8) {
      let atIntersection = false;
      for (const rz of roadsX_Z) {
        if (Math.abs(z - rz) < ROAD_HALF + 2) {
          atIntersection = true;
          break;
        }
      }
      if (atIntersection) continue;

      const dash = MeshBuilder.CreateGround(
        "dZ_" + idx + "_" + z,
        { width: 0.3, height: 4 },
        scene,
      );
      dash.position.set(rx, 0.04, z);
      dash.material = roadLineMat;
      allDashes.push(dash);
    }

    // Sidewalks on both sides
    const swL = MeshBuilder.CreateBox(
      "swL_" + idx,
      { width: SIDEWALK_W, height: SIDEWALK_H, depth: MAP_SIZE },
      scene,
    );
    swL.position.set(rx + ROAD_HALF + SIDEWALK_W / 2, SIDEWALK_H / 2, 0);
    swL.material = sidewalkMat;
    swL.receiveShadows = true;
    allSidewalkMeshes.push(swL);

    const swR = MeshBuilder.CreateBox(
      "swR_" + idx,
      { width: SIDEWALK_W, height: SIDEWALK_H, depth: MAP_SIZE },
      scene,
    );
    swR.position.set(rx - ROAD_HALF - SIDEWALK_W / 2, SIDEWALK_H / 2, 0);
    swR.material = sidewalkMat;
    swR.receiveShadows = true;
    allSidewalkMeshes.push(swR);
  });

  // Create X-axis roads (horizontal)
  roadsX_Z.forEach((rz, idx) => {
    const road = MeshBuilder.CreateGround(
      "roadX_" + idx,
      { width: MAP_SIZE, height: ROAD_W },
      scene,
    );
    road.position.set(0, 0.02, rz);
    road.material = roadMat;
    road.receiveShadows = true;
    road.freezeWorldMatrix();
    roads.push(road);

    for (let x = -HALF + 5; x < HALF - 5; x += 8) {
      let atIntersection = false;
      for (const rx of roadsZ_X) {
        if (Math.abs(x - rx) < ROAD_HALF + 2) {
          atIntersection = true;
          break;
        }
      }
      if (atIntersection) continue;

      const dash = MeshBuilder.CreateGround(
        "dX_" + idx + "_" + x,
        { width: 4, height: 0.3 },
        scene,
      );
      dash.position.set(x, 0.04, rz);
      dash.material = roadLineMat;
      allDashes.push(dash);
    }
  });

  // Merge dashes
  if (allDashes.length > 0) {
    const mergedDashes = Mesh.MergeMeshes(
      allDashes,
      true,
      true,
      undefined,
      false,
      true,
    );
    if (mergedDashes) {
      mergedDashes.material = roadLineMat;
      mergedDashes.freezeWorldMatrix();
    }
  }

  // Merge sidewalks
  if (allSidewalkMeshes.length > 0) {
    const mergedSidewalks = Mesh.MergeMeshes(
      allSidewalkMeshes,
      true,
      true,
      undefined,
      false,
      true,
    );
    if (mergedSidewalks) {
      mergedSidewalks.material = sidewalkMat;
      mergedSidewalks.receiveShadows = true;
      mergedSidewalks.freezeWorldMatrix();
    }
  }

  // ========== BUILDINGS ==========
  // Facade DynamicTextures — window grids drawn procedurally
  const FACADE_TEX_W = 256;
  const FACADE_TEX_H = 512;

  function createFacadeTexture(
    baseColor: Color3,
    windowColor: string,
    floors: number,
    cols: number,
  ): DynamicTexture {
    const tex = new DynamicTexture(
      "facadeTex_" + Math.floor(rand() * 99999),
      { width: FACADE_TEX_W, height: FACADE_TEX_H },
      scene,
      false,
    );
    const ctx = tex.getContext();

    const r = Math.floor(baseColor.r * 255);
    const g = Math.floor(baseColor.g * 255);
    const b = Math.floor(baseColor.b * 255);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, FACADE_TEX_W, FACADE_TEX_H);

    const winW = Math.floor((FACADE_TEX_W * 0.65) / Math.max(cols, 1));
    const winH = Math.floor((FACADE_TEX_H * 0.55) / Math.max(floors, 1));
    const gapX = Math.floor(FACADE_TEX_W / (cols + 0.5));
    const gapY = Math.floor(FACADE_TEX_H / (floors + 0.5));
    const padX = Math.floor((gapX - winW) / 2) + Math.floor(gapX * 0.25);
    const padY = Math.floor((gapY - winH) / 2) + Math.floor(gapY * 0.25);

    for (let fy = 0; fy < floors; fy++) {
      for (let cx = 0; cx < cols; cx++) {
        const wx = padX + cx * gapX;
        const wy = padY + fy * gapY;
        ctx.fillStyle = "#222";
        ctx.fillRect(wx - 1, wy - 1, winW + 2, winH + 2);
        ctx.fillStyle = windowColor;
        ctx.fillRect(wx, wy, winW, winH);
      }
    }

    // Ground floor accent band
    const bandH = Math.floor(FACADE_TEX_H * 0.12);
    ctx.fillStyle = "rgba(40,30,20,0.45)";
    ctx.fillRect(0, FACADE_TEX_H - bandH, FACADE_TEX_W, bandH);

    // Shop window
    const shopW = Math.floor(FACADE_TEX_W * 0.35);
    const shopH = Math.floor(bandH * 0.7);
    const shopX = Math.floor((FACADE_TEX_W - shopW) / 2);
    const shopY = FACADE_TEX_H - bandH + Math.floor((bandH - shopH) / 2);
    ctx.fillStyle = "#334";
    ctx.fillRect(shopX - 1, shopY - 1, shopW + 2, shopH + 2);
    ctx.fillStyle = "#8ab";
    ctx.fillRect(shopX, shopY, shopW, shopH);

    tex.update();
    return tex;
  }

  const buildingBaseColors = [
    new Color3(0.6, 0.58, 0.55),
    new Color3(0.72, 0.68, 0.6),
    new Color3(0.48, 0.52, 0.58),
    new Color3(0.65, 0.5, 0.45),
    new Color3(0.55, 0.6, 0.55),
    new Color3(0.78, 0.75, 0.68),
    new Color3(0.4, 0.42, 0.5),
    new Color3(0.68, 0.62, 0.55),
  ];

  const windowColors = [
    "#7899bb",
    "#6688aa",
    "#8899aa",
    "#99aabb",
    "#7788aa",
    "#668899",
    "#8899bb",
    "#aabbcc",
  ];

  const facadeMats = buildingBaseColors.map((color, i) => {
    const floors = 6 + Math.floor(rand() * 4);
    const cols = 3 + Math.floor(rand() * 3);
    const tex = createFacadeTexture(color, windowColors[i], floors, cols);
    const mat = new StandardMaterial("facadeMat_" + i, scene);
    mat.diffuseTexture = tex;
    mat.specularColor = new Color3(0.15, 0.15, 0.2);
    mat.specularPower = 32;
    mat.freeze();
    return mat;
  });

  const awningColors = [
    new Color3(0.7, 0.15, 0.1),
    new Color3(0.1, 0.4, 0.15),
    new Color3(0.15, 0.2, 0.6),
    new Color3(0.7, 0.55, 0.1),
  ];
  const awningMats = awningColors.map((c, i) => {
    const m = new StandardMaterial("awningMat_" + i, scene);
    m.diffuseColor = c;
    m.freeze();
    return m;
  });

  const ledgeMat = new StandardMaterial("ledgeMat", scene);
  ledgeMat.diffuseColor = new Color3(0.5, 0.48, 0.45);
  ledgeMat.freeze();

  const buildingData: BuildingData[] = [];
  const allLedgeMeshes: Mesh[] = [];
  const allAwningMeshes: Mesh[] = [];
  const buildingMeshes: Mesh[] = [];

  // Park & lot block sets
  const parkBlockSet = new Set<string>();
  const BLOCK_SPACING = 50;
  const gridMinI = Math.floor(-HALF / BLOCK_SPACING);
  const gridMaxI = Math.floor(HALF / BLOCK_SPACING);

  for (let ix = gridMinI; ix < gridMaxI; ix++) {
    for (let iz = gridMinI; iz < gridMaxI; iz++) {
      if (rand() < 0.08) parkBlockSet.add(`${ix}_${iz}`);
    }
  }
  parkBlockSet.delete("0_0");
  parkBlockSet.delete("-1_0");
  parkBlockSet.delete("0_-1");
  parkBlockSet.delete("-1_-1");

  const lotBlockSet = new Set<string>();
  for (let ix = gridMinI; ix < gridMaxI; ix++) {
    for (let iz = gridMinI; iz < gridMaxI; iz++) {
      const key = `${ix}_${iz}`;
      if (!parkBlockSet.has(key) && rand() < 0.05) lotBlockSet.add(key);
    }
  }

  function fillBlock(x0: number, z0: number, x1: number, z1: number): void {
    const bx0 = Math.min(x0, x1) + ROAD_HALF + SIDEWALK_W + 1;
    const bx1 = Math.max(x0, x1) - ROAD_HALF - SIDEWALK_W - 1;
    const bz0 = Math.min(z0, z1) + ROAD_HALF + SIDEWALK_W + 1;
    const bz1 = Math.max(z0, z1) - ROAD_HALF - SIDEWALK_W - 1;

    const blockW = bx1 - bx0;
    const blockD = bz1 - bz0;
    if (blockW < 8 || blockD < 8) return;

    const cx = (bx0 + bx1) / 2;
    const cz = (bz0 + bz1) / 2;
    const distFromCenter = Math.sqrt(cx * cx + cz * cz);

    let minH: number, maxH: number;
    if (distFromCenter < 120) {
      minH = 20;
      maxH = 55;
    } else if (distFromCenter < 250) {
      minH = 12;
      maxH = 30;
    } else {
      minH = 6;
      maxH = 16;
    }

    const count = 1 + Math.floor(rand() * 3);
    for (let bi = 0; bi < count; bi++) {
      const w = 8 + rand() * Math.min(blockW - 10, 10);
      const d = 8 + rand() * Math.min(blockD - 10, 10);
      const h = minH + rand() * (maxH - minH);

      const px = bx0 + w / 2 + rand() * Math.max(0, blockW - w);
      const pz = bz0 + d / 2 + rand() * Math.max(0, blockD - d);

      const clampX = Math.max(bx0 + w / 2, Math.min(bx1 - w / 2, px));
      const clampZ = Math.max(bz0 + d / 2, Math.min(bz1 - d / 2, pz));

      createBuilding(clampX, clampZ, w, d, h);
    }
  }

  function createBuilding(
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
  ): void {
    const mat = facadeMats[Math.floor(rand() * facadeMats.length)];

    const building = MeshBuilder.CreateBox(
      "bld_" + buildingData.length,
      { width: w, height: h, depth: d },
      scene,
    );
    building.position.set(x, h / 2, z);
    building.material = mat;
    shadowGenerator.addShadowCaster(building);
    building.receiveShadows = true;
    building.freezeWorldMatrix();
    buildingMeshes.push(building);

    buildingData.push({ x, z, w, d, h });

    // Ledge every 3rd floor
    const floorH = 3.5;
    const numFloors = Math.floor(h / floorH);
    for (let fi = 3; fi < numFloors; fi += 3) {
      const ly = fi * floorH;
      const ledge = MeshBuilder.CreateBox(
        "ldg",
        { width: w + 0.3, height: 0.2, depth: d + 0.3 },
        scene,
      );
      ledge.position.set(x, ly, z);
      ledge.material = ledgeMat;
      allLedgeMeshes.push(ledge);
    }

    // Rooftop parapet
    const parapetH = 0.8;
    const pFront = MeshBuilder.CreateBox(
      "pf",
      { width: w + 0.2, height: parapetH, depth: 0.25 },
      scene,
    );
    pFront.position.set(x, h + parapetH / 2, z + d / 2);
    pFront.material = ledgeMat;
    allLedgeMeshes.push(pFront);

    const pBack = MeshBuilder.CreateBox(
      "pb",
      { width: w + 0.2, height: parapetH, depth: 0.25 },
      scene,
    );
    pBack.position.set(x, h + parapetH / 2, z - d / 2);
    pBack.material = ledgeMat;
    allLedgeMeshes.push(pBack);

    const pLeft = MeshBuilder.CreateBox(
      "pl",
      { width: 0.25, height: parapetH, depth: d + 0.2 },
      scene,
    );
    pLeft.position.set(x - w / 2, h + parapetH / 2, z);
    pLeft.material = ledgeMat;
    allLedgeMeshes.push(pLeft);

    const pRight = MeshBuilder.CreateBox(
      "pr",
      { width: 0.25, height: parapetH, depth: d + 0.2 },
      scene,
    );
    pRight.position.set(x + w / 2, h + parapetH / 2, z);
    pRight.material = ledgeMat;
    allLedgeMeshes.push(pRight);

    // Rooftop AC units on taller buildings
    if (h > 18 && rand() < 0.65) {
      const acCount = 1 + Math.floor(rand() * 3);
      for (let ai = 0; ai < acCount; ai++) {
        const ac = MeshBuilder.CreateBox(
          "ac",
          { width: 1.2, height: 0.8, depth: 0.9 },
          scene,
        );
        ac.position.set(
          x + (rand() - 0.5) * (w - 2),
          h + 0.4,
          z + (rand() - 0.5) * (d - 2),
        );
        ac.material = ledgeMat;
        allLedgeMeshes.push(ac);
      }
    }

    // Awning (20% chance)
    if (rand() < 0.2) {
      const awning = MeshBuilder.CreateBox(
        "awn",
        { width: w * 0.6, height: 0.08, depth: 1.5 },
        scene,
      );
      awning.position.set(x, 3.2, z + d / 2 + 0.7);
      awning.rotation.x = 0.15;
      awning.material = awningMats[Math.floor(rand() * awningMats.length)];
      allAwningMeshes.push(awning);
    }
  }

  // Generate buildings for each block
  for (let i = 0; i < roadsZ_X.length - 1; i++) {
    for (let j = 0; j < roadsX_Z.length - 1; j++) {
      const x0 = roadsZ_X[i];
      const x1 = roadsZ_X[i + 1];
      const z0 = roadsX_Z[j];
      const z1 = roadsX_Z[j + 1];

      const ix = Math.floor((x0 + x1) / 2 / BLOCK_SPACING);
      const iz = Math.floor((z0 + z1) / 2 / BLOCK_SPACING);
      const key = `${ix}_${iz}`;

      if (parkBlockSet.has(key)) continue;
      if (lotBlockSet.has(key)) continue;
      fillBlock(x0, z0, x1, z1);
    }
  }

  // Merge ledges and awnings
  if (allLedgeMeshes.length > 0) {
    const mergedLedges = Mesh.MergeMeshes(
      allLedgeMeshes,
      true,
      true,
      undefined,
      false,
      true,
    );
    if (mergedLedges) {
      mergedLedges.material = ledgeMat;
      mergedLedges.freezeWorldMatrix();
    }
  }
  if (allAwningMeshes.length > 0) {
    const mergedAwnings = Mesh.MergeMeshes(
      allAwningMeshes,
      true,
      true,
      undefined,
      false,
      true,
    );
    if (mergedAwnings) {
      mergedAwnings.freezeWorldMatrix();
    }
  }

  // ========== STREET LIGHTS ==========
  const poleMat = new StandardMaterial("poleMat", scene);
  poleMat.diffuseColor = new Color3(0.3, 0.3, 0.35);
  poleMat.specularColor = new Color3(0.5, 0.5, 0.5);
  poleMat.freeze();

  const lampMat = new StandardMaterial("lampMat", scene);
  lampMat.diffuseColor = new Color3(1.0, 0.95, 0.7);
  lampMat.emissiveColor = new Color3(1.0, 0.9, 0.6);
  lampMat.freeze();

  const streetLightMeshes: Mesh[] = [];
  const streetLampMeshes: Mesh[] = [];

  function createStreetLight(x: number, z: number, rotY: number): void {
    const pole = MeshBuilder.CreateCylinder(
      "pole",
      { diameter: 0.2, height: 7 },
      scene,
    );
    pole.position.set(x, 3.5, z);
    pole.material = poleMat;
    streetLightMeshes.push(pole);

    const arm = MeshBuilder.CreateBox(
      "arm",
      { width: 2.5, height: 0.1, depth: 0.15 },
      scene,
    );
    arm.position.set(x + 1.25 * Math.cos(rotY), 7, z + 1.25 * Math.sin(rotY));
    arm.material = poleMat;
    streetLightMeshes.push(arm);

    const lamp = MeshBuilder.CreateBox(
      "lamp",
      { width: 0.8, height: 0.3, depth: 0.5 },
      scene,
    );
    lamp.position.set(x + 2.3 * Math.cos(rotY), 6.8, z + 2.3 * Math.sin(rotY));
    lamp.material = lampMat;
    streetLampMeshes.push(lamp);
  }

  // Place along Z-roads every 40 units
  for (const rx of roadsZ_X) {
    for (let z = -HALF + 20; z <= HALF - 20; z += 40) {
      createStreetLight(rx + ROAD_HALF + 1.5, z, 0);
      createStreetLight(rx - ROAD_HALF - 1.5, z, Math.PI);
    }
  }

  if (streetLightMeshes.length > 0) {
    const mergedPoles = Mesh.MergeMeshes(
      streetLightMeshes,
      true,
      true,
      undefined,
      false,
      true,
    );
    if (mergedPoles) {
      mergedPoles.material = poleMat;
      mergedPoles.freezeWorldMatrix();
    }
  }
  if (streetLampMeshes.length > 0) {
    const mergedLamps = Mesh.MergeMeshes(
      streetLampMeshes,
      true,
      true,
      undefined,
      false,
      true,
    );
    if (mergedLamps) {
      mergedLamps.material = lampMat;
      mergedLamps.freezeWorldMatrix();
    }
  }

  // ========== TRAFFIC LIGHTS ==========
  const trafficPoleMat = new StandardMaterial("trafficPoleMat", scene);
  trafficPoleMat.diffuseColor = new Color3(0.25, 0.25, 0.28);
  trafficPoleMat.freeze();

  // On / off materials for each color
  const trafficRedOnMat = new StandardMaterial("trRedOn", scene);
  trafficRedOnMat.diffuseColor = new Color3(0.8, 0.1, 0.1);
  trafficRedOnMat.emissiveColor = new Color3(0.5, 0.02, 0.02);
  trafficRedOnMat.freeze();

  const trafficRedOffMat = new StandardMaterial("trRedOff", scene);
  trafficRedOffMat.diffuseColor = new Color3(0.25, 0.05, 0.05);
  trafficRedOffMat.freeze();

  const trafficYellowOnMat = new StandardMaterial("trYlwOn", scene);
  trafficYellowOnMat.diffuseColor = new Color3(0.9, 0.8, 0.1);
  trafficYellowOnMat.emissiveColor = new Color3(0.4, 0.35, 0.02);
  trafficYellowOnMat.freeze();

  const trafficYellowOffMat = new StandardMaterial("trYlwOff", scene);
  trafficYellowOffMat.diffuseColor = new Color3(0.25, 0.2, 0.05);
  trafficYellowOffMat.freeze();

  const trafficGreenOnMat = new StandardMaterial("trGrnOn", scene);
  trafficGreenOnMat.diffuseColor = new Color3(0.1, 0.7, 0.2);
  trafficGreenOnMat.emissiveColor = new Color3(0.02, 0.3, 0.05);
  trafficGreenOnMat.freeze();

  const trafficGreenOffMat = new StandardMaterial("trGrnOff", scene);
  trafficGreenOffMat.diffuseColor = new Color3(0.05, 0.18, 0.07);
  trafficGreenOffMat.freeze();

  const allTrafficPoleMeshes: Mesh[] = []; // poles & boxes — can merge

  // Per-intersection traffic light data
  interface TrafficLightMeshes {
    redNS: Mesh[];
    yellowNS: Mesh[];
    greenNS: Mesh[];
    redEW: Mesh[];
    yellowEW: Mesh[];
    greenEW: Mesh[];
  }

  const LIGHT_GREEN_DUR = 15;
  const LIGHT_YELLOW_DUR = 3;
  const LIGHT_RED_DUR = LIGHT_GREEN_DUR + LIGHT_YELLOW_DUR; // 18 — keeps phases in sync
  const LIGHT_CYCLE = LIGHT_GREEN_DUR + LIGHT_YELLOW_DUR + LIGHT_RED_DUR; // not needed, but clarity

  // Each tracked intersection has its timer and mesh references
  interface TrafficLightEntry {
    x: number;
    z: number;
    timer: number;
    meshes: TrafficLightMeshes;
    prevNS: string;
    prevEW: string;
  }

  const trafficLightEntries: TrafficLightEntry[] = [];

  intersections.forEach((inter, idx) => {
    if (idx % 2 !== 0) return;
    if (Math.abs(inter.x) > HALF - 60 || Math.abs(inter.z) > HALF - 60) return;

    const entry: TrafficLightEntry = {
      x: inter.x,
      z: inter.z,
      timer: (idx * 7.3) % (LIGHT_GREEN_DUR + LIGHT_YELLOW_DUR + LIGHT_RED_DUR),
      prevNS: "",
      prevEW: "",
      meshes: {
        redNS: [],
        yellowNS: [],
        greenNS: [],
        redEW: [],
        yellowEW: [],
        greenEW: [],
      },
    };

    // NS poles (along Z axis road)
    const nsOffsets = [
      { dx: ROAD_HALF + 1, dz: ROAD_HALF + 1 },
      { dx: -ROAD_HALF - 1, dz: -ROAD_HALF - 1 },
    ];
    // EW poles (along X axis road)
    const ewOffsets = [
      { dx: ROAD_HALF + 1, dz: -ROAD_HALF - 1 },
      { dx: -ROAD_HALF - 1, dz: ROAD_HALF + 1 },
    ];

    const createPole = (px: number, pz: number, group: "NS" | "EW") => {
      const pole = MeshBuilder.CreateCylinder(
        "tp",
        { diameter: 0.15, height: 5 },
        scene,
      );
      pole.position.set(px, 2.5, pz);
      pole.material = trafficPoleMat;
      allTrafficPoleMeshes.push(pole);

      const box = MeshBuilder.CreateBox(
        "tb",
        { width: 0.4, height: 1.2, depth: 0.4 },
        scene,
      );
      box.position.set(px, 5.3, pz);
      box.material = trafficPoleMat;
      allTrafficPoleMeshes.push(box);

      const red = MeshBuilder.CreateSphere(
        "tr",
        { diameter: 0.25, segments: 4 },
        scene,
      );
      red.position.set(px, 5.7, pz);
      red.material = trafficRedOffMat;

      const yellow = MeshBuilder.CreateSphere(
        "ty",
        { diameter: 0.25, segments: 4 },
        scene,
      );
      yellow.position.set(px, 5.3, pz);
      yellow.material = trafficYellowOffMat;

      const green = MeshBuilder.CreateSphere(
        "tg",
        { diameter: 0.25, segments: 4 },
        scene,
      );
      green.position.set(px, 4.9, pz);
      green.material = trafficGreenOffMat;

      if (group === "NS") {
        entry.meshes.redNS.push(red);
        entry.meshes.yellowNS.push(yellow);
        entry.meshes.greenNS.push(green);
      } else {
        entry.meshes.redEW.push(red);
        entry.meshes.yellowEW.push(yellow);
        entry.meshes.greenEW.push(green);
      }
    };

    nsOffsets.forEach((off) =>
      createPole(inter.x + off.dx, inter.z + off.dz, "NS"),
    );
    ewOffsets.forEach((off) =>
      createPole(inter.x + off.dx, inter.z + off.dz, "EW"),
    );

    trafficLightEntries.push(entry);
  });

  if (allTrafficPoleMeshes.length > 0) {
    const mergedTraffic = Mesh.MergeMeshes(
      allTrafficPoleMeshes,
      true,
      true,
      undefined,
      false,
      true,
    );
    if (mergedTraffic) {
      mergedTraffic.freezeWorldMatrix();
    }
  }

  // Helper: get NS state from timer
  function getNSState(timer: number): "green" | "yellow" | "red" {
    if (timer < LIGHT_GREEN_DUR) return "green";
    if (timer < LIGHT_GREEN_DUR + LIGHT_YELLOW_DUR) return "yellow";
    return "red";
  }
  function getEWState(timer: number): "green" | "yellow" | "red" {
    // EW is offset by half cycle — when NS is green/yellow, EW is red and vice-versa
    const halfCycle = LIGHT_GREEN_DUR + LIGHT_YELLOW_DUR;
    if (timer < halfCycle) return "red";
    const ewTime = timer - halfCycle;
    if (ewTime < LIGHT_GREEN_DUR) return "green";
    return "yellow";
  }

  function applyLightMaterials(entry: TrafficLightEntry) {
    const ns = getNSState(entry.timer);
    const ew = getEWState(entry.timer);

    // Skip material swaps if state hasn't changed
    if (ns === entry.prevNS && ew === entry.prevEW) return;
    entry.prevNS = ns;
    entry.prevEW = ew;

    entry.meshes.redNS.forEach((m) => {
      m.material = ns === "red" ? trafficRedOnMat : trafficRedOffMat;
    });
    entry.meshes.yellowNS.forEach((m) => {
      m.material = ns === "yellow" ? trafficYellowOnMat : trafficYellowOffMat;
    });
    entry.meshes.greenNS.forEach((m) => {
      m.material = ns === "green" ? trafficGreenOnMat : trafficGreenOffMat;
    });

    entry.meshes.redEW.forEach((m) => {
      m.material = ew === "red" ? trafficRedOnMat : trafficRedOffMat;
    });
    entry.meshes.yellowEW.forEach((m) => {
      m.material = ew === "yellow" ? trafficYellowOnMat : trafficYellowOffMat;
    });
    entry.meshes.greenEW.forEach((m) => {
      m.material = ew === "green" ? trafficGreenOnMat : trafficGreenOffMat;
    });
  }

  // Cached traffic light states — rebuilt only when lights update
  let cachedLightStates: TrafficLightState[] = [];

  function rebuildLightStatesCache(): void {
    cachedLightStates = trafficLightEntries.map((e) => ({
      x: e.x,
      z: e.z,
      stateNS: getNSState(e.timer),
      stateEW: getEWState(e.timer),
    }));
  }

  // Initial apply
  trafficLightEntries.forEach(applyLightMaterials);
  rebuildLightStatesCache();

  function updateTrafficLights(dt: number): void {
    const fullCycle = LIGHT_GREEN_DUR + LIGHT_YELLOW_DUR + LIGHT_RED_DUR;
    for (const entry of trafficLightEntries) {
      entry.timer = (entry.timer + dt) % fullCycle;
      applyLightMaterials(entry);
    }
    rebuildLightStatesCache();
  }

  function getTrafficLightStates(): TrafficLightState[] {
    return cachedLightStates;
  }

  // ========== TREES ==========
  const trunkMat = new StandardMaterial("trunkMat", scene);
  trunkMat.diffuseColor = new Color3(0.4, 0.28, 0.15);
  trunkMat.freeze();

  const crownColorValues = [
    new Color3(0.2, 0.55, 0.2),
    new Color3(0.25, 0.5, 0.15),
    new Color3(0.15, 0.6, 0.25),
    new Color3(0.3, 0.55, 0.2),
  ];
  const crownMats = crownColorValues.map((c, i) => {
    const m = new StandardMaterial("crownMat_" + i, scene);
    m.diffuseColor = c;
    m.freeze();
    return m;
  });

  const allTrunkMeshes: Mesh[] = [];
  const allCrownMeshes: Mesh[] = [];
  const treeData: { x: number; z: number }[] = [];

  function createTree(x: number, z: number): void {
    const trunk = MeshBuilder.CreateCylinder(
      "trk",
      { diameter: 0.5, height: 3 },
      scene,
    );
    trunk.position.set(x, 1.5, z);
    trunk.material = trunkMat;
    allTrunkMeshes.push(trunk);

    const crown = MeshBuilder.CreateSphere(
      "crn",
      { diameter: 4, segments: 4 },
      scene,
    );
    crown.position.set(x, 4.5, z);
    crown.material = crownMats[Math.floor(rand() * crownMats.length)];
    crown.scaling.y = 1.2;
    allCrownMeshes.push(crown);

    treeData.push({ x, z });
  }

  function isOnRoad(x: number, z: number): boolean {
    for (const rx of roadsZ_X) {
      if (Math.abs(x - rx) < ROAD_HALF + SIDEWALK_W + 1) return true;
    }
    for (const rz of roadsX_Z) {
      if (Math.abs(z - rz) < ROAD_HALF + SIDEWALK_W + 1) return true;
    }
    return false;
  }

  function isInBuilding(tx: number, tz: number): boolean {
    for (const b of buildingData) {
      if (
        tx > b.x - b.w / 2 - 1 &&
        tx < b.x + b.w / 2 + 1 &&
        tz > b.z - b.d / 2 - 1 &&
        tz < b.z + b.d / 2 + 1
      )
        return true;
    }
    return false;
  }

  // Park trees
  for (let ix = gridMinI; ix < gridMaxI; ix++) {
    for (let iz = gridMinI; iz < gridMaxI; iz++) {
      const key = `${ix}_${iz}`;
      if (!parkBlockSet.has(key)) continue;

      const blockCX = (ix + 0.5) * BLOCK_SPACING;
      const blockCZ = (iz + 0.5) * BLOCK_SPACING;

      const treeCount = 8 + Math.floor(rand() * 5);
      for (let t = 0; t < treeCount; t++) {
        const tx = blockCX + (rand() - 0.5) * 30;
        const tz = blockCZ + (rand() - 0.5) * 30;
        if (
          !isOnRoad(tx, tz) &&
          Math.abs(tx) < HALF - 10 &&
          Math.abs(tz) < HALF - 10
        ) {
          createTree(tx, tz);
        }
      }
    }
  }

  // Roadside trees
  for (const rx of roadsZ_X) {
    for (let z = -HALF + 15; z < HALF - 15; z += 25 + rand() * 10) {
      if (rand() < 0.4) continue;
      const side = rand() > 0.5 ? 1 : -1;
      const tx = rx + side * (ROAD_HALF + SIDEWALK_W + 2.5);
      if (!isInBuilding(tx, z)) {
        createTree(tx, z);
      }
    }
  }

  // Merge trees
  if (allTrunkMeshes.length > 0) {
    const mergedTrunks = Mesh.MergeMeshes(
      allTrunkMeshes,
      true,
      true,
      undefined,
      false,
      true,
    );
    if (mergedTrunks) {
      mergedTrunks.material = trunkMat;
      mergedTrunks.freezeWorldMatrix();
    }
  }
  if (allCrownMeshes.length > 0) {
    const mergedCrowns = Mesh.MergeMeshes(
      allCrownMeshes,
      true,
      true,
      undefined,
      false,
      true,
    );
    if (mergedCrowns) {
      mergedCrowns.freezeWorldMatrix();
    }
  }

  // ========== PARKED CARS ==========
  const parkedCarColors = [
    new Color3(0.6, 0.1, 0.1),
    new Color3(0.15, 0.15, 0.5),
    new Color3(0.5, 0.5, 0.5),
    new Color3(0.1, 0.35, 0.15),
    new Color3(0.65, 0.6, 0.5),
    new Color3(0.2, 0.2, 0.25),
  ];
  const parkedCarMats = parkedCarColors.map((c, i) => {
    const m = new StandardMaterial("pcMat_" + i, scene);
    m.diffuseColor = c;
    m.specularColor = new Color3(0.3, 0.3, 0.35);
    m.freeze();
    return m;
  });

  const parkedCarCabinMat = new StandardMaterial("pcCabinMat", scene);
  parkedCarCabinMat.diffuseColor = new Color3(0.2, 0.25, 0.35);
  parkedCarCabinMat.alpha = 0.55;
  parkedCarCabinMat.freeze();

  const allParkedCarMeshes: Mesh[] = [];
  const parkedCars: ParkedCarData[] = [];

  function createParkedCar(x: number, z: number, rotY: number): void {
    const mat = parkedCarMats[Math.floor(rand() * parkedCarMats.length)];

    const body = MeshBuilder.CreateBox(
      "pc_b",
      { width: 1.8, height: 0.5, depth: 4.0 },
      scene,
    );
    body.position.set(x, 0.55, z);
    body.rotation.y = rotY;
    body.material = mat;

    const cabin = MeshBuilder.CreateBox(
      "pc_c",
      { width: 1.5, height: 0.45, depth: 1.6 },
      scene,
    );
    cabin.position.set(0, 0.45, -0.1);
    cabin.parent = body;
    cabin.material = parkedCarCabinMat;

    allParkedCarMeshes.push(body);

    parkedCars.push({ x, z, halfW: 1.0, halfD: 2.1, rotY });
  }

  // Along Z-roads
  for (const rx of roadsZ_X) {
    for (let z = -HALF + 30; z < HALF - 30; z += 18 + rand() * 15) {
      if (rand() < 0.5) continue;
      let atInter = false;
      for (const rz of roadsX_Z) {
        if (Math.abs(z - rz) < ROAD_HALF + 4) {
          atInter = true;
          break;
        }
      }
      if (atInter) continue;

      const side = rand() > 0.5 ? 1 : -1;
      const px = rx + side * (ROAD_HALF - 2.5);
      createParkedCar(px, z, rand() < 0.1 ? (rand() - 0.5) * 0.3 : 0);
    }
  }
  // Along X-roads
  for (const rz of roadsX_Z) {
    for (let x = -HALF + 30; x < HALF - 30; x += 20 + rand() * 15) {
      if (rand() < 0.6) continue;
      let atInter = false;
      for (const rx of roadsZ_X) {
        if (Math.abs(x - rx) < ROAD_HALF + 4) {
          atInter = true;
          break;
        }
      }
      if (atInter) continue;

      const side = rand() > 0.5 ? 1 : -1;
      const pz = rz + side * (ROAD_HALF - 2.5);
      createParkedCar(
        x,
        pz,
        Math.PI / 2 + (rand() < 0.1 ? (rand() - 0.5) * 0.3 : 0),
      );
    }
  }

  allParkedCarMeshes.forEach((m) => m.freezeWorldMatrix());

  // ========== DESTRUCTIBLE STREET OBJECTS ==========
  const destructibles: DestructibleObject[] = [];

  const trashCanMat = new StandardMaterial("trashCanMat", scene);
  trashCanMat.diffuseColor = new Color3(0.3, 0.35, 0.3);
  trashCanMat.freeze();

  const benchMat = new StandardMaterial("benchMat", scene);
  benchMat.diffuseColor = new Color3(0.45, 0.3, 0.15);
  benchMat.freeze();

  const fenceMat = new StandardMaterial("fenceMat", scene);
  fenceMat.diffuseColor = new Color3(0.6, 0.55, 0.5);
  fenceMat.freeze();

  const hydrantMat = new StandardMaterial("hydrantMat", scene);
  hydrantMat.diffuseColor = new Color3(0.8, 0.15, 0.1);
  hydrantMat.freeze();

  function addDestructible(
    mesh: Mesh,
    x: number,
    z: number,
    halfW: number,
    halfD: number,
  ): void {
    destructibles.push({
      mesh,
      x,
      z,
      halfW,
      halfD,
      alive: true,
      flying: false,
      flyVelocity: Vector3.Zero(),
      flyTime: 0,
      respawnTimer: 0,
    });
  }

  let destrIdx = 0;
  for (const rx of roadsZ_X) {
    for (let z = -HALF + 15; z < HALF - 15; z += 20 + rand() * 10) {
      const side = rand() > 0.5 ? 1 : -1;
      const sx = rx + side * (ROAD_HALF + SIDEWALK_W / 2);
      const roll = rand();

      if (roll < 0.35) {
        const can = MeshBuilder.CreateCylinder(
          "tc_" + destrIdx,
          { diameter: 0.6, height: 1.0, tessellation: 8 },
          scene,
        );
        can.position.set(sx, 0.5, z);
        can.material = trashCanMat;
        addDestructible(can, sx, z, 0.4, 0.4);
      } else if (roll < 0.6) {
        const bench = MeshBuilder.CreateBox(
          "bn_" + destrIdx,
          { width: 1.5, height: 0.6, depth: 0.5 },
          scene,
        );
        bench.position.set(sx, 0.3, z);
        bench.material = benchMat;
        addDestructible(bench, sx, z, 0.85, 0.35);
      } else if (roll < 0.75) {
        const hydrant = MeshBuilder.CreateCylinder(
          "hy_" + destrIdx,
          { diameter: 0.35, height: 0.8, tessellation: 8 },
          scene,
        );
        hydrant.position.set(sx, 0.4, z);
        hydrant.material = hydrantMat;
        addDestructible(hydrant, sx, z, 0.25, 0.25);
      } else if (roll < 0.88) {
        const fence = MeshBuilder.CreateBox(
          "fn_" + destrIdx,
          { width: 2.0, height: 0.8, depth: 0.15 },
          scene,
        );
        fence.position.set(sx, 0.4, z);
        fence.material = fenceMat;
        addDestructible(fence, sx, z, 1.1, 0.2);
      }
      destrIdx++;
    }
  }

  // ========== FENCED EMPTY LOTS ==========
  const lotFenceMat = new StandardMaterial("lotFenceMat", scene);
  lotFenceMat.diffuseColor = new Color3(0.5, 0.5, 0.45);
  lotFenceMat.freeze();

  const gravelMat = new StandardMaterial("gravelMat", scene);
  gravelMat.diffuseColor = new Color3(0.45, 0.42, 0.38);
  gravelMat.specularColor = new Color3(0.1, 0.1, 0.1);
  gravelMat.freeze();

  const allLotMeshes: Mesh[] = [];

  for (let ix = gridMinI; ix < gridMaxI; ix++) {
    for (let iz = gridMinI; iz < gridMaxI; iz++) {
      const key = `${ix}_${iz}`;
      if (!lotBlockSet.has(key)) continue;

      const bx = (ix + 0.5) * BLOCK_SPACING;
      const bz = (iz + 0.5) * BLOCK_SPACING;
      const lotW = BLOCK_SPACING - ROAD_W - SIDEWALK_W * 2 - 4;
      const lotD = BLOCK_SPACING - ROAD_W - SIDEWALK_W * 2 - 4;

      const grvl = MeshBuilder.CreateGround(
        "grvl",
        { width: lotW, height: lotD },
        scene,
      );
      grvl.position.set(bx, 0.03, bz);
      grvl.material = gravelMat;
      allLotMeshes.push(grvl);

      const fh = 1.5;
      const fenceF = MeshBuilder.CreateBox(
        "lf",
        { width: lotW, height: fh, depth: 0.1 },
        scene,
      );
      fenceF.position.set(bx, fh / 2, bz + lotD / 2);
      fenceF.material = lotFenceMat;
      allLotMeshes.push(fenceF);

      const fenceB = MeshBuilder.CreateBox(
        "lb",
        { width: lotW, height: fh, depth: 0.1 },
        scene,
      );
      fenceB.position.set(bx, fh / 2, bz - lotD / 2);
      fenceB.material = lotFenceMat;
      allLotMeshes.push(fenceB);

      const fenceL = MeshBuilder.CreateBox(
        "ll",
        { width: 0.1, height: fh, depth: lotD },
        scene,
      );
      fenceL.position.set(bx - lotW / 2, fh / 2, bz);
      fenceL.material = lotFenceMat;
      allLotMeshes.push(fenceL);

      const fenceR = MeshBuilder.CreateBox(
        "lr",
        { width: 0.1, height: fh, depth: lotD },
        scene,
      );
      fenceR.position.set(bx + lotW / 2, fh / 2, bz);
      fenceR.material = lotFenceMat;
      allLotMeshes.push(fenceR);
    }
  }

  if (allLotMeshes.length > 0) {
    const mergedLots = Mesh.MergeMeshes(
      allLotMeshes,
      true,
      true,
      undefined,
      false,
      true,
    );
    if (mergedLots) {
      mergedLots.freezeWorldMatrix();
    }
  }

  // ========== VISIBILITY CULLING ==========
  const TRAFFIC_LIGHT_VIS_SQ = 120 * 120; // traffic lights visible within 120 units

  function updateVisibility(playerX: number, playerZ: number): void {
    for (let i = 0; i < buildingMeshes.length; i++) {
      const b = buildingData[i];
      if (!b) continue;
      const dx = b.x - playerX;
      const dz = b.z - playerZ;
      const distSq = dx * dx + dz * dz;
      buildingMeshes[i].setEnabled(distSq < VIS_DIST_SQ);
    }

    // Cull traffic light spheres by distance
    for (const entry of trafficLightEntries) {
      const dx = entry.x - playerX;
      const dz = entry.z - playerZ;
      const distSq = dx * dx + dz * dz;
      const visible = distSq < TRAFFIC_LIGHT_VIS_SQ;
      const m = entry.meshes;
      for (const arr of [
        m.redNS,
        m.yellowNS,
        m.greenNS,
        m.redEW,
        m.yellowEW,
        m.greenEW,
      ]) {
        for (const mesh of arr) {
          mesh.setEnabled(visible);
        }
      }
    }
  }

  // ========== FOG ==========
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.001;
  scene.fogColor = new Color3(0.7, 0.75, 0.85);

  scene.ambientColor = new Color3(0.3, 0.3, 0.35);
  scene.clearColor = new Color4(0.7, 0.75, 0.85, 1.0);

  return {
    ground,
    roads,
    buildingData,
    destructibles,
    treeData,
    parkedCars,
    intersections,
    updateVisibility,
    updateTrafficLights,
    getTrafficLightStates,
    getRoadPositionsX: () => roadsX_Z,
    getRoadPositionsZ: () => roadsZ_X,
  };
}
