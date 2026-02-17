import {
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  GlowLayer,
  DefaultRenderingPipeline,
  Vector3,
  Color3,
  ImageProcessingConfiguration,
} from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import type { LightingResult } from "./types";

export function setupLighting(scene: Scene): LightingResult {
  // --- Ambient hemisphere light ---
  const hemiLight = new HemisphericLight(
    "hemiLight",
    new Vector3(0, 1, 0),
    scene,
  );
  hemiLight.intensity = 0.35;
  hemiLight.diffuse = new Color3(0.9, 0.9, 1.0);
  hemiLight.groundColor = new Color3(0.3, 0.25, 0.2);

  // --- Directional "sun" light ---
  const sunLight = new DirectionalLight(
    "sunLight",
    new Vector3(-1, -2.5, -1.5),
    scene,
  );
  sunLight.position = new Vector3(50, 80, 50);
  sunLight.intensity = 0.9;
  sunLight.diffuse = new Color3(1.0, 0.95, 0.85);
  sunLight.specular = new Color3(1.0, 0.95, 0.8);

  // --- Shadow Generator ---
  const shadowGenerator = new ShadowGenerator(1024, sunLight);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 16;
  shadowGenerator.blurScale = 2;
  shadowGenerator.depthScale = 50;
  shadowGenerator.setDarkness(0.3);

  // --- Glow Layer ---
  const glowLayer = new GlowLayer("glowLayer", scene, {
    mainTextureSamples: 1,
    blurKernelSize: 16,
  });
  glowLayer.intensity = 0.6;

  // --- Post-processing Pipeline ---
  const pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene);
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.7;
  pipeline.bloomWeight = 0.3;
  pipeline.bloomKernel = 32;
  pipeline.bloomScale = 0.5;

  pipeline.fxaaEnabled = true;
  pipeline.samples = 1;

  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType =
    ImageProcessingConfiguration.TONEMAPPING_ACES;

  pipeline.imageProcessing.contrast = 1.3;
  pipeline.imageProcessing.exposure = 1.1;

  return { shadowGenerator, glowLayer, pipeline, sunLight };
}
