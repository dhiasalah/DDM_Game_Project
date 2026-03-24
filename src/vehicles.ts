import { Color3 } from "@babylonjs/core";
import type { VehicleStats, VehicleRegistryResult } from "./types";
import type { Scene, Mesh } from "@babylonjs/core";

/* ================================================================
 *  VEHICLE REGISTRY — defines all drivable vehicle types
 * ================================================================ */

const vehicleDefinitions: Record<string, VehicleStats> = {
  sedan: {
    name: "Sedan",
    topSpeed: 42,
    acceleration: 18,
    braking: 30,
    handling: 2.3,
    mass: 1.2,
    bodyColor: new Color3(0.3, 0.35, 0.6),
    bodyWidth: 2.0,
    bodyHeight: 0.55,
    bodyDepth: 4.2,
    cabinScale: 1.0,
  },
  sports: {
    name: "Sports",
    topSpeed: 65,
    acceleration: 28,
    braking: 40,
    handling: 3.0,
    mass: 1.0,
    bodyColor: new Color3(0.85, 0.12, 0.1),
    bodyWidth: 2.0,
    bodyHeight: 0.45,
    bodyDepth: 4.4,
    cabinScale: 0.85,
  },
  muscle: {
    name: "Muscle",
    topSpeed: 55,
    acceleration: 25,
    braking: 28,
    handling: 2.0,
    mass: 1.4,
    bodyColor: new Color3(0.15, 0.15, 0.15),
    bodyWidth: 2.2,
    bodyHeight: 0.55,
    bodyDepth: 4.6,
    cabinScale: 0.9,
  },
  suv: {
    name: "SUV",
    topSpeed: 38,
    acceleration: 15,
    braking: 25,
    handling: 1.8,
    mass: 1.8,
    bodyColor: new Color3(0.2, 0.5, 0.25),
    bodyWidth: 2.4,
    bodyHeight: 0.7,
    bodyDepth: 4.8,
    cabinScale: 1.1,
  },
  taxi: {
    name: "Taxi",
    topSpeed: 40,
    acceleration: 16,
    braking: 28,
    handling: 2.2,
    mass: 1.3,
    bodyColor: new Color3(0.9, 0.8, 0.1),
    bodyWidth: 2.0,
    bodyHeight: 0.55,
    bodyDepth: 4.3,
    cabinScale: 1.0,
  },
  truck: {
    name: "Truck",
    topSpeed: 30,
    acceleration: 10,
    braking: 20,
    handling: 1.5,
    mass: 2.5,
    bodyColor: new Color3(0.5, 0.3, 0.15),
    bodyWidth: 2.6,
    bodyHeight: 0.8,
    bodyDepth: 5.5,
    cabinScale: 1.2,
  },
  compact: {
    name: "Compact",
    topSpeed: 35,
    acceleration: 22,
    braking: 32,
    handling: 2.8,
    mass: 0.8,
    bodyColor: new Color3(0.2, 0.6, 0.8),
    bodyWidth: 1.8,
    bodyHeight: 0.5,
    bodyDepth: 3.6,
    cabinScale: 0.9,
  },
  van: {
    name: "Van",
    topSpeed: 32,
    acceleration: 12,
    braking: 22,
    handling: 1.6,
    mass: 2.0,
    bodyColor: new Color3(0.9, 0.9, 0.85),
    bodyWidth: 2.3,
    bodyHeight: 0.9,
    bodyDepth: 5.0,
    cabinScale: 1.15,
  },
};

const vehicleTypeKeys = Object.keys(vehicleDefinitions);

export function createVehicleRegistry(_scene: Scene): VehicleRegistryResult {
  function getVehicleTypes(): string[] {
    return vehicleTypeKeys;
  }

  function getStats(type: string): VehicleStats {
    return vehicleDefinitions[type] || vehicleDefinitions["sedan"];
  }

  function buildVehicleMesh(_type: string, _index: number): Mesh {
    // Placeholder — actual vehicles use the traffic.ts or car.ts primitive meshes
    // This would be used for fancy custom mesh building in later phases
    throw new Error("Use car.ts setVehicleStats instead for now");
  }

  return { getVehicleTypes, getStats, buildVehicleMesh };
}

/** Pick a random vehicle type key */
export function randomVehicleType(): string {
  return vehicleTypeKeys[Math.floor(Math.random() * vehicleTypeKeys.length)];
}

/** Get a specific vehicle's stats without creating the registry */
export function getVehicleStatsStatic(type: string): VehicleStats {
  return vehicleDefinitions[type] || vehicleDefinitions["sedan"];
}
