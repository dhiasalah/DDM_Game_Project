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
  hemiLight.intensity = 0.7;
  hemiLight.diffuse = new Color3(0.95, 0.95, 1.0);
  hemiLight.groundColor = new Color3(0.5, 0.45, 0.4);

  // --- Directional "sun" light ---
  const sunLight = new DirectionalLight(
    "sunLight",
    new Vector3(-1, -2.5, -1.5),
    scene,
  );
  sunLight.position = new Vector3(50, 80, 50);
  sunLight.intensity = 1.4;
  sunLight.diffuse = new Color3(1.0, 0.95, 0.85);
  sunLight.specular = new Color3(1.0, 0.95, 0.8);

  // --- Shadow Generator (optimized settings) ---
  const shadowGenerator = new ShadowGenerator(256, sunLight);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 4; // Reduced from 8
  shadowGenerator.blurScale = 1; // Reduced from 2
  shadowGenerator.depthScale = 50;
  shadowGenerator.setDarkness(0.3);

  // --- Glow Layer (disabled — expensive scene re-render) ---
  const glowLayer = new GlowLayer("glowLayer", scene, {
    mainTextureSamples: 1,
    blurKernelSize: 8,
  });
  glowLayer.intensity = 0.4;
  glowLayer.isEnabled = false; // disabled for performance

  // --- Post-processing Pipeline (optimized settings) ---
  const pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene);
  pipeline.bloomEnabled = false;
  pipeline.bloomThreshold = 0.8;
  pipeline.bloomWeight = 0.25;
  pipeline.bloomKernel = 8;
  pipeline.bloomScale = 0.5;

  pipeline.fxaaEnabled = false;
  pipeline.samples = 1;

  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType =
    ImageProcessingConfiguration.TONEMAPPING_ACES;

  pipeline.imageProcessing.contrast = 1.1;
  pipeline.imageProcessing.exposure = 1.5;

  return { shadowGenerator, glowLayer, pipeline, sunLight };
}
