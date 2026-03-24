import type { Scene } from "@babylonjs/core";
import type { Keys } from "./types";

export function setupInput(_scene: Scene): Keys {
  const keys: Keys = {};

  document.addEventListener("keydown", (evt: KeyboardEvent) => {
    keys[evt.key.toLowerCase()] = true;
    if (
      ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].indexOf(
        evt.key.toLowerCase(),
      ) !== -1
    ) {
      evt.preventDefault();
    }
  });

  document.addEventListener("keyup", (evt: KeyboardEvent) => {
    keys[evt.key.toLowerCase()] = false;
  });

  // Mouse button tracking (for punching)
  document.addEventListener("mousedown", (evt: MouseEvent) => {
    if (evt.button === 0) keys["mouse0"] = true;
  });

  document.addEventListener("mouseup", (evt: MouseEvent) => {
    if (evt.button === 0) keys["mouse0"] = false;
  });

  return keys;
}
