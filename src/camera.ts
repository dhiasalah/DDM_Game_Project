import { FollowCamera, Vector3 } from "@babylonjs/core";
import type { Scene, AbstractMesh } from "@babylonjs/core";

export function setupCamera(
  scene: Scene,
  _canvas: HTMLCanvasElement,
  target: AbstractMesh,
): FollowCamera {
  const camera = new FollowCamera("followCam", new Vector3(0, 10, -15), scene);

  camera.radius = 16;
  camera.heightOffset = 6;
  camera.rotationOffset = 180;
  camera.cameraAcceleration = 0.04;
  camera.maxCameraSpeed = 18;
  camera.lockedTarget = target;

  camera.fov = 0.9;
  camera.minZ = 0.5;
  camera.maxZ = 1000;

  camera.inputs.clear();

  return camera;
}
