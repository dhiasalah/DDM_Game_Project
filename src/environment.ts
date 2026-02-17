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
} from "@babylonjs/core";
import type { ShadowGenerator } from "@babylonjs/core";
import type {
  BuildingData,
  EnvironmentResult,
  DestructibleObject,
} from "./types";

export function createEnvironment(
  scene: Scene,
  shadowGenerator: ShadowGenerator,
): EnvironmentResult {
  // ========== SKYBOX ==========
  const skybox = MeshBuilder.CreateBox("skyBox", { size: 800 }, scene);
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
    { width: 400, height: 400, subdivisions: 2 },
    scene,
  );
  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new Color3(0.28, 0.35, 0.22);
  groundMat.specularColor = new Color3(0.1, 0.1, 0.1);
  groundMat.freeze();
  ground.material = groundMat;
  ground.receiveShadows = true;
  ground.freezeWorldMatrix();

  // ========== ROADS ==========
  const roads: Mesh[] = [];
  const roadMat = new StandardMaterial("roadMat", scene);
  roadMat.diffuseColor = new Color3(0.2, 0.2, 0.22);
  roadMat.specularColor = new Color3(0.15, 0.15, 0.15);
  roadMat.specularPower = 64;
  roadMat.freeze();

  const roadLineMat = new StandardMaterial("roadLineMat", scene);
  roadLineMat.diffuseColor = new Color3(0.9, 0.85, 0.2);
  roadLineMat.emissiveColor = new Color3(0.15, 0.14, 0.03);
  roadLineMat.freeze();

  // Collect all dashes for merging
  const allDashes: Mesh[] = [];

  // Main road (Z-axis)
  const roadZ = MeshBuilder.CreateGround(
    "roadZ",
    { width: 14, height: 400 },
    scene,
  );
  roadZ.position.y = 0.02;
  roadZ.material = roadMat;
  roadZ.receiveShadows = true;
  roadZ.freezeWorldMatrix();
  roads.push(roadZ);

  for (let z = -190; z < 190; z += 8) {
    const dash = MeshBuilder.CreateGround(
      "dashZ_" + z,
      { width: 0.3, height: 4 },
      scene,
    );
    dash.position.set(0, 0.04, z);
    dash.material = roadLineMat;
    allDashes.push(dash);
  }

  // Cross road (X-axis)
  const roadX = MeshBuilder.CreateGround(
    "roadX",
    { width: 400, height: 14 },
    scene,
  );
  roadX.position.y = 0.02;
  roadX.material = roadMat;
  roadX.receiveShadows = true;
  roadX.freezeWorldMatrix();
  roads.push(roadX);

  for (let x = -190; x < 190; x += 8) {
    const dash = MeshBuilder.CreateGround(
      "dashX_" + x,
      { width: 4, height: 0.3 },
      scene,
    );
    dash.position.set(x, 0.04, 0);
    dash.material = roadLineMat;
    allDashes.push(dash);
  }

  // Second parallel road (Z-axis, offset)
  const roadZ2 = MeshBuilder.CreateGround(
    "roadZ2",
    { width: 14, height: 400 },
    scene,
  );
  roadZ2.position.set(60, 0.02, 0);
  roadZ2.material = roadMat;
  roadZ2.receiveShadows = true;
  roadZ2.freezeWorldMatrix();
  roads.push(roadZ2);

  for (let z = -190; z < 190; z += 8) {
    const dash = MeshBuilder.CreateGround(
      "dashZ2_" + z,
      { width: 0.3, height: 4 },
      scene,
    );
    dash.position.set(60, 0.04, z);
    dash.material = roadLineMat;
    allDashes.push(dash);
  }

  // Another cross road
  const roadX2 = MeshBuilder.CreateGround(
    "roadX2",
    { width: 400, height: 14 },
    scene,
  );
  roadX2.position.set(0, 0.02, 60);
  roadX2.material = roadMat;
  roadX2.receiveShadows = true;
  roadX2.freezeWorldMatrix();
  roads.push(roadX2);

  for (let x = -190; x < 190; x += 8) {
    const dash = MeshBuilder.CreateGround(
      "dashX2_" + x,
      { width: 4, height: 0.3 },
      scene,
    );
    dash.position.set(x, 0.04, 60);
    dash.material = roadLineMat;
    allDashes.push(dash);
  }

  // MERGE all road dashes (~192 meshes -> 1 draw call)
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

  // Sidewalks
  const sidewalkMat = new StandardMaterial("sidewalkMat", scene);
  sidewalkMat.diffuseColor = new Color3(0.55, 0.53, 0.5);
  sidewalkMat.specularColor = new Color3(0.2, 0.2, 0.2);
  sidewalkMat.freeze();

  function createSidewalk(
    name: string,
    width: number,
    depth: number,
    x: number,
    z: number,
  ): Mesh {
    const sw = MeshBuilder.CreateBox(
      name,
      { width, height: 0.15, depth },
      scene,
    );
    sw.position.set(x, 0.075, z);
    sw.material = sidewalkMat;
    sw.receiveShadows = true;
    sw.freezeWorldMatrix();
    return sw;
  }

  createSidewalk("sw1", 3, 400, 10, 0);
  createSidewalk("sw2", 3, 400, -10, 0);

  // ========== BUILDINGS ==========
  // Pre-create shared building materials (8 colors, reused)
  const buildingColorValues = [
    new Color3(0.55, 0.55, 0.6),
    new Color3(0.7, 0.65, 0.55),
    new Color3(0.4, 0.5, 0.65),
    new Color3(0.6, 0.45, 0.4),
    new Color3(0.5, 0.6, 0.55),
    new Color3(0.75, 0.72, 0.65),
    new Color3(0.35, 0.4, 0.5),
    new Color3(0.65, 0.6, 0.5),
  ];

  const buildingMats = buildingColorValues.map((color, i) => {
    const mat = new StandardMaterial("buildMat_" + i, scene);
    mat.diffuseColor = color;
    mat.specularColor = new Color3(0.2, 0.2, 0.25);
    mat.specularPower = 32;
    mat.freeze();
    return mat;
  });

  const windowMat = new StandardMaterial("windowMat", scene);
  windowMat.diffuseColor = new Color3(0.6, 0.75, 0.9);
  windowMat.specularColor = new Color3(0.9, 0.9, 1.0);
  windowMat.specularPower = 128;
  windowMat.emissiveColor = new Color3(0.08, 0.1, 0.15);
  windowMat.freeze();

  // Collect ALL window planes for a single merge
  const allWindowMeshes: Mesh[] = [];

  function addWindows(building: Mesh, w: number, d: number, h: number): void {
    const windowSize = 0.8;
    const spacing = 2.5;
    const floors = Math.floor(h / spacing);
    const pos = building.position;

    for (let floor = 0; floor < floors; floor++) {
      const y = floor * spacing + 1.5;

      const cols = Math.floor(w / spacing);
      for (let col = 0; col < cols; col++) {
        const xOff = (col - cols / 2 + 0.5) * spacing;

        const wf = MeshBuilder.CreatePlane(
          "wf_" + floor + "_" + col,
          { width: windowSize, height: windowSize * 1.3 },
          scene,
        );
        wf.position.set(pos.x + xOff, y, pos.z + d / 2 + 0.01);
        wf.material = windowMat;
        allWindowMeshes.push(wf);

        const wb = MeshBuilder.CreatePlane(
          "wb_" + floor + "_" + col,
          { width: windowSize, height: windowSize * 1.3 },
          scene,
        );
        wb.position.set(pos.x + xOff, y, pos.z - d / 2 - 0.01);
        wb.rotation.y = Math.PI;
        wb.material = windowMat;
        allWindowMeshes.push(wb);
      }

      const sideCols = Math.floor(d / spacing);
      for (let col = 0; col < sideCols; col++) {
        const zOff = (col - sideCols / 2 + 0.5) * spacing;

        const ws1 = MeshBuilder.CreatePlane(
          "ws1_" + floor + "_" + col,
          { width: windowSize, height: windowSize * 1.3 },
          scene,
        );
        ws1.position.set(pos.x + w / 2 + 0.01, y, pos.z + zOff);
        ws1.rotation.y = Math.PI / 2;
        ws1.material = windowMat;
        allWindowMeshes.push(ws1);

        const ws2 = MeshBuilder.CreatePlane(
          "ws2_" + floor + "_" + col,
          { width: windowSize, height: windowSize * 1.3 },
          scene,
        );
        ws2.position.set(pos.x - w / 2 - 0.01, y, pos.z + zOff);
        ws2.rotation.y = -Math.PI / 2;
        ws2.material = windowMat;
        allWindowMeshes.push(ws2);
      }
    }
  }

  function createBuilding(
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
  ): Mesh {
    const building = MeshBuilder.CreateBox(
      "building_" + x + "_" + z,
      { width: w, height: h, depth: d },
      scene,
    );
    building.position.set(x, h / 2, z);

    // Use shared StandardMaterial instead of per-building PBRMaterial
    building.material =
      buildingMats[Math.floor(Math.random() * buildingMats.length)];

    shadowGenerator.addShadowCaster(building);
    building.receiveShadows = true;

    addWindows(building, w, d, h);

    building.freezeWorldMatrix();

    return building;
  }

  const buildingData: BuildingData[] = [
    { x: 25, z: -25, w: 12, d: 10, h: 18 },
    { x: 25, z: -50, w: 10, d: 12, h: 25 },
    { x: 40, z: -25, w: 10, d: 10, h: 14 },
    { x: 40, z: -50, w: 12, d: 14, h: 30 },
    { x: 25, z: -80, w: 14, d: 10, h: 20 },
    { x: 40, z: -80, w: 10, d: 12, h: 22 },
    { x: 25, z: -110, w: 12, d: 12, h: 16 },
    { x: 40, z: -110, w: 10, d: 10, h: 28 },
    { x: -25, z: -25, w: 10, d: 10, h: 22 },
    { x: -25, z: -55, w: 14, d: 12, h: 18 },
    { x: -40, z: -30, w: 12, d: 14, h: 26 },
    { x: -40, z: -60, w: 10, d: 10, h: 15 },
    { x: -25, z: -90, w: 12, d: 12, h: 20 },
    { x: -40, z: -90, w: 14, d: 10, h: 32 },
    { x: 25, z: 25, w: 10, d: 12, h: 20 },
    { x: 40, z: 30, w: 12, d: 10, h: 24 },
    { x: 25, z: 80, w: 14, d: 14, h: 16 },
    { x: 40, z: 85, w: 10, d: 10, h: 28 },
    { x: -25, z: 25, w: 12, d: 10, h: 19 },
    { x: -40, z: 25, w: 10, d: 14, h: 23 },
    { x: -25, z: 80, w: 12, d: 12, h: 17 },
    { x: -40, z: 80, w: 14, d: 10, h: 30 },
    { x: 80, z: -30, w: 10, d: 12, h: 20 },
    { x: 80, z: -60, w: 12, d: 10, h: 26 },
    { x: 95, z: -30, w: 12, d: 14, h: 18 },
    { x: 80, z: 25, w: 14, d: 12, h: 22 },
    { x: 95, z: 25, w: 10, d: 10, h: 15 },
  ];

  buildingData.forEach((b) => {
    createBuilding(b.x, b.z, b.w, b.d, b.h);
  });

  // MERGE all window planes (~2000+ meshes -> 1 draw call)
  const mergedWindows = Mesh.MergeMeshes(
    allWindowMeshes,
    true,
    true,
    undefined,
    false,
    true,
  );
  if (mergedWindows) {
    mergedWindows.material = windowMat;
    mergedWindows.freezeWorldMatrix();
  }

  // ========== STREET LIGHTS ==========
  // Emissive material only — NO PointLights (saves 18 light passes)
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
      "pole_" + x + "_" + z,
      { diameter: 0.2, height: 7 },
      scene,
    );
    pole.position.set(x, 3.5, z);
    pole.material = poleMat;
    streetLightMeshes.push(pole);

    const arm = MeshBuilder.CreateBox(
      "arm_" + x + "_" + z,
      { width: 2.5, height: 0.1, depth: 0.15 },
      scene,
    );
    arm.position.set(x + 1.25 * Math.cos(rotY), 7, z + 1.25 * Math.sin(rotY));
    arm.material = poleMat;
    streetLightMeshes.push(arm);

    const lamp = MeshBuilder.CreateBox(
      "lamp_" + x + "_" + z,
      { width: 0.8, height: 0.3, depth: 0.5 },
      scene,
    );
    lamp.position.set(x + 2.3 * Math.cos(rotY), 6.8, z + 2.3 * Math.sin(rotY));
    lamp.material = lampMat;
    streetLampMeshes.push(lamp);
  }

  for (let z = -160; z <= 160; z += 40) {
    createStreetLight(8.5, z, 0);
    createStreetLight(-8.5, z, Math.PI);
  }

  // Merge street light meshes (poles+arms -> 1, lamps -> 1)
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

  // ========== TREES ==========
  const trunkMat = new StandardMaterial("trunkMat", scene);
  trunkMat.diffuseColor = new Color3(0.4, 0.28, 0.15);
  trunkMat.freeze();

  // Shared crown materials (4 colors)
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

  function createTree(x: number, z: number): void {
    const trunk = MeshBuilder.CreateCylinder(
      "trunk",
      { diameter: 0.5, height: 3 },
      scene,
    );
    trunk.position.set(x, 1.5, z);
    trunk.material = trunkMat;
    allTrunkMeshes.push(trunk);

    const crown = MeshBuilder.CreateSphere(
      "crown",
      { diameter: 4, segments: 6 },
      scene,
    );
    crown.position.set(x, 4.5, z);
    crown.material = crownMats[Math.floor(Math.random() * crownMats.length)];
    crown.scaling.y = 1.2;
    allCrownMeshes.push(crown);
    // Trees NOT added as shadow casters (saves 48 shadow caster renders)
  }

  const treePositions = [
    { x: -70, z: -40 },
    { x: -80, z: -50 },
    { x: -65, z: -60 },
    { x: -75, z: -75 },
    { x: -85, z: -35 },
    { x: -60, z: -80 },
    { x: -90, z: -55 },
    { x: -70, z: -95 },
    { x: -70, z: 40 },
    { x: -80, z: 55 },
    { x: -65, z: 70 },
    { x: -90, z: 45 },
    { x: -75, z: 85 },
    { x: -60, z: 50 },
    { x: 12, z: -140 },
    { x: -12, z: -160 },
    { x: 12, z: 130 },
    { x: -12, z: 150 },
    { x: 70, z: -100 },
    { x: 100, z: -70 },
    { x: -55, z: 100 },
    { x: -85, z: 110 },
    { x: 110, z: 50 },
    { x: 120, z: -20 },
  ];

  treePositions.forEach((t) => createTree(t.x, t.z));

  // Merge tree meshes (trunks -> 1, crowns -> 1)
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

  // Trash cans along sidewalks
  const trashCanPositions = [
    { x: 9.5, z: -15 },
    { x: -9.5, z: -35 },
    { x: 9.5, z: -55 },
    { x: -9.5, z: -75 },
    { x: 9.5, z: 15 },
    { x: -9.5, z: 35 },
    { x: 9.5, z: 55 },
    { x: -9.5, z: 75 },
    { x: 9.5, z: -95 },
    { x: -9.5, z: -115 },
    { x: 9.5, z: 95 },
    { x: -9.5, z: 115 },
  ];

  trashCanPositions.forEach((pos, i) => {
    const can = MeshBuilder.CreateCylinder(
      "trashCan_" + i,
      { diameter: 0.6, height: 1.0, tessellation: 8 },
      scene,
    );
    can.position.set(pos.x, 0.5, pos.z);
    can.material = trashCanMat;

    destructibles.push({
      mesh: can,
      x: pos.x,
      z: pos.z,
      halfW: 0.4,
      halfD: 0.4,
      alive: true,
      flying: false,
      flyVelocity: Vector3.Zero(),
      flyTime: 0,
      respawnTimer: 0,
    });
  });

  // Benches along sidewalks
  const benchPositions = [
    { x: 9.5, z: -25 },
    { x: -9.5, z: -45 },
    { x: 9.5, z: -65 },
    { x: -9.5, z: 25 },
    { x: 9.5, z: 45 },
    { x: -9.5, z: 65 },
  ];

  benchPositions.forEach((pos, i) => {
    const bench = MeshBuilder.CreateBox(
      "bench_" + i,
      { width: 1.5, height: 0.6, depth: 0.5 },
      scene,
    );
    bench.position.set(pos.x, 0.3, pos.z);
    bench.material = benchMat;

    destructibles.push({
      mesh: bench,
      x: pos.x,
      z: pos.z,
      halfW: 0.85,
      halfD: 0.35,
      alive: true,
      flying: false,
      flyVelocity: Vector3.Zero(),
      flyTime: 0,
      respawnTimer: 0,
    });
  });

  // Small fences / barriers
  const fencePositions = [
    { x: 9.5, z: -5 },
    { x: -9.5, z: -15 },
    { x: 9.5, z: 35 },
    { x: -9.5, z: 55 },
    { x: 9.5, z: -85 },
    { x: -9.5, z: -95 },
    { x: 9.5, z: 75 },
    { x: -9.5, z: 85 },
  ];

  fencePositions.forEach((pos, i) => {
    const fence = MeshBuilder.CreateBox(
      "fence_" + i,
      { width: 2.0, height: 0.8, depth: 0.15 },
      scene,
    );
    fence.position.set(pos.x, 0.4, pos.z);
    fence.material = fenceMat;

    destructibles.push({
      mesh: fence,
      x: pos.x,
      z: pos.z,
      halfW: 1.1,
      halfD: 0.2,
      alive: true,
      flying: false,
      flyVelocity: Vector3.Zero(),
      flyTime: 0,
      respawnTimer: 0,
    });
  });

  // ========== FOG ==========
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0015;
  scene.fogColor = new Color3(0.7, 0.75, 0.85);

  scene.ambientColor = new Color3(0.3, 0.3, 0.35);
  scene.clearColor = new Color4(0.7, 0.75, 0.85, 1.0);

  return { ground, roads, buildingData, destructibles };
}
