import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
} from "@babylonjs/core";
import type { Scene, ShadowGenerator, Mesh } from "@babylonjs/core";
import type { LocationData, EconomyResult, WeaponType } from "./types";

/* ================================================================
 *  ECONOMY SYSTEM — shops, Pay'n'Spray, safehouses, interactable
 *  locations with visual markers and proximity-based interaction
 * ================================================================ */

interface EconomyCallbacks {
  getMoney: () => number;
  removeMoney: (amount: number) => void;
  addMoney: (amount: number) => void;
  healPlayer: (amount: number) => void;
  repairVehicle: (amount: number) => void;
  addWeapon: (type: WeaponType, ammo?: number) => void;
  addAmmo: (type: WeaponType, amount: number) => void;
  showMessage: (text: string, color: string) => void;
  resetWanted: () => void;
}

// ── Weapon shop inventory ──
interface ShopItem {
  weapon: WeaponType;
  label: string;
  price: number;
  ammo: number;
}

const WEAPON_SHOP_ITEMS: ShopItem[] = [
  { weapon: "bat", label: "Baseball Bat", price: 50, ammo: -1 },
  { weapon: "pistol", label: "Pistol + 60 ammo", price: 200, ammo: 60 },
  { weapon: "shotgun", label: "Shotgun + 30 ammo", price: 500, ammo: 30 },
  { weapon: "smg", label: "SMG + 120 ammo", price: 800, ammo: 120 },
];

const AMMO_ITEMS: {
  weapon: WeaponType;
  label: string;
  price: number;
  ammo: number;
}[] = [
  { weapon: "pistol", label: "Pistol Ammo x30", price: 50, ammo: 30 },
  { weapon: "shotgun", label: "Shotgun Ammo x15", price: 100, ammo: 15 },
  { weapon: "smg", label: "SMG Ammo x60", price: 120, ammo: 60 },
];

const PAY_N_SPRAY_COST = 200;
const HOSPITAL_HEAL_COST = 0; // free when you respawn there

// ── All interactable locations ──
const ALL_LOCATIONS: LocationData[] = [
  // Hospitals
  { x: 100, z: 100, type: "hospital", name: "Downtown Hospital" },
  { x: -200, z: -150, type: "hospital", name: "Westside Clinic" },

  // Police Stations
  { x: -100, z: 50, type: "police-station", name: "Central Police" },
  { x: 150, z: -200, type: "police-station", name: "South Precinct" },

  // Weapon shops
  { x: 0, z: -50, type: "weapon-shop", name: "Ammu-Nation" },
  { x: -150, z: 100, type: "weapon-shop", name: "Gun Runners" },
  { x: 200, z: 50, type: "weapon-shop", name: "Arms Dealer" },

  // Pay'n'Spray
  { x: 50, z: 50, type: "pay-n-spray", name: "Pay'n'Spray Downtown" },
  { x: -200, z: -50, type: "pay-n-spray", name: "Pay'n'Spray West" },

  // Safehouses
  { x: 10, z: -10, type: "safehouse", name: "Starter Apartment" },
  { x: -250, z: 200, type: "safehouse", name: "Dockside Hideout" },
];

const INTERACT_DIST = 6;

export function createEconomy(
  scene: Scene,
  shadowGenerator: ShadowGenerator | null,
  callbacks: EconomyCallbacks,
): EconomyResult & {
  updateEconomy: (playerX: number, playerZ: number, mode: string) => void;
  getInteractPrompt: () => string | null;
  interact: () => void;
  getLocationMarkers: () => {
    x: number;
    z: number;
    color: string;
    type: string;
  }[];
} {
  // ── Build visual markers for each location ──
  const locationMeshes: { loc: LocationData; mesh: Mesh }[] = [];

  const matColors: Record<string, Color3> = {
    hospital: new Color3(1, 0.2, 0.2), // red
    "police-station": new Color3(0.2, 0.4, 1), // blue
    "weapon-shop": new Color3(1, 0.6, 0), // orange
    "pay-n-spray": new Color3(0, 0.8, 1), // cyan
    safehouse: new Color3(0, 1, 0.4), // green
  };

  for (const loc of ALL_LOCATIONS) {
    const mat = new StandardMaterial(`loc_${loc.name}_mat`, scene);
    mat.emissiveColor = matColors[loc.type] || new Color3(1, 1, 1);
    mat.alpha = 0.85;
    mat.disableLighting = true;
    mat.freeze();

    // Simple beacon column
    const beacon = MeshBuilder.CreateCylinder(
      `loc_${loc.name}`,
      { diameter: 1.5, height: 12, tessellation: 8 },
      scene,
    );
    beacon.material = mat;
    beacon.position.set(loc.x, 6, loc.z);
    beacon.isPickable = false;

    // Skip shadow casting for beacons (decorative, saves GPU)

    // Ground ring
    const ring = MeshBuilder.CreateTorus(
      `loc_${loc.name}_ring`,
      { diameter: 5, thickness: 0.3, tessellation: 10 },
      scene,
    );
    const ringMat = new StandardMaterial(`loc_${loc.name}_ringMat`, scene);
    ringMat.emissiveColor = matColors[loc.type] || new Color3(1, 1, 1);
    ringMat.alpha = 0.6;
    ringMat.disableLighting = true;
    ringMat.freeze();
    ring.material = ringMat;
    ring.position.set(loc.x, 0.1, loc.z);
    ring.isPickable = false;

    locationMeshes.push({ loc, mesh: beacon });
  }

  // ── State ──
  let nearbyLocation: LocationData | null = null;
  let interactPrompt: string | null = null;
  let shopCooldown = 0;

  // Weapon shop state
  let currentShopIndex = 0;

  function updateEconomy(playerX: number, playerZ: number, mode: string): void {
    if (shopCooldown > 0) shopCooldown -= 0.016; // rough dt

    // Rotate beacons for visual flair
    for (const lm of locationMeshes) {
      lm.mesh.rotation.y += 0.01;
    }

    // Find nearest interactable location
    nearbyLocation = null;
    interactPrompt = null;

    if (mode !== "on-foot") return; // Only interact on foot

    let bestDist = INTERACT_DIST * INTERACT_DIST;
    for (const loc of ALL_LOCATIONS) {
      const dx = playerX - loc.x;
      const dz = playerZ - loc.z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) {
        bestDist = d;
        nearbyLocation = loc;
      }
    }

    if (nearbyLocation) {
      switch (nearbyLocation.type) {
        case "weapon-shop": {
          const item =
            WEAPON_SHOP_ITEMS[currentShopIndex % WEAPON_SHOP_ITEMS.length];
          interactPrompt = `[E] Buy ${item.label} — $${item.price}  |  [Q/R] Browse`;
          break;
        }
        case "pay-n-spray":
          interactPrompt = `[E] Repair & Respray — $${PAY_N_SPRAY_COST}`;
          break;
        case "safehouse":
          interactPrompt = `[E] Save & Rest — ${nearbyLocation.name}`;
          break;
        case "hospital":
          interactPrompt = `${nearbyLocation.name} — Free healing`;
          break;
        case "police-station":
          interactPrompt = `${nearbyLocation.name}`;
          break;
      }
    }
  }

  function interact(): void {
    if (!nearbyLocation || shopCooldown > 0) return;
    shopCooldown = 0.3; // prevent spam

    switch (nearbyLocation.type) {
      case "weapon-shop": {
        const item =
          WEAPON_SHOP_ITEMS[currentShopIndex % WEAPON_SHOP_ITEMS.length];
        if (callbacks.getMoney() >= item.price) {
          callbacks.removeMoney(item.price);
          callbacks.addWeapon(
            item.weapon,
            item.ammo > 0 ? item.ammo : undefined,
          );
          callbacks.showMessage(`Purchased ${item.label}`, "#00ff66");
        } else {
          callbacks.showMessage("Not enough cash!", "#ff4444");
        }
        break;
      }

      case "pay-n-spray": {
        if (callbacks.getMoney() >= PAY_N_SPRAY_COST) {
          callbacks.removeMoney(PAY_N_SPRAY_COST);
          callbacks.repairVehicle(100);
          callbacks.resetWanted();
          callbacks.showMessage(
            "Vehicle repaired & wanted level cleared!",
            "#00ccff",
          );
        } else {
          callbacks.showMessage("Not enough cash!", "#ff4444");
        }
        break;
      }

      case "safehouse": {
        callbacks.healPlayer(100);
        callbacks.showMessage("Health restored! Game saved.", "#00ff66");
        break;
      }

      case "hospital": {
        callbacks.healPlayer(100);
        callbacks.showMessage("Healed up!", "#ff6666");
        break;
      }

      default:
        break;
    }
  }

  function browseShop(direction: number): void {
    if (!nearbyLocation || nearbyLocation.type !== "weapon-shop") return;
    currentShopIndex =
      (currentShopIndex + direction + WEAPON_SHOP_ITEMS.length) %
      WEAPON_SHOP_ITEMS.length;
  }

  function getLocations(): LocationData[] {
    return ALL_LOCATIONS;
  }

  function getNearbyLocation(
    x: number,
    z: number,
    maxDist: number,
  ): LocationData | null {
    let best: LocationData | null = null;
    let bestD = maxDist * maxDist;
    for (const loc of ALL_LOCATIONS) {
      const dx = x - loc.x;
      const dz = z - loc.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = loc;
      }
    }
    return best;
  }

  function canAfford(amount: number): boolean {
    return callbacks.getMoney() >= amount;
  }

  function getInteractPrompt(): string | null {
    return interactPrompt;
  }

  function getLocationMarkers(): {
    x: number;
    z: number;
    color: string;
    type: string;
  }[] {
    return ALL_LOCATIONS.map((loc) => {
      let color = "#ffffff";
      switch (loc.type) {
        case "hospital":
          color = "#ff4444";
          break;
        case "police-station":
          color = "#4488ff";
          break;
        case "weapon-shop":
          color = "#ff9900";
          break;
        case "pay-n-spray":
          color = "#00ccff";
          break;
        case "safehouse":
          color = "#00ff66";
          break;
      }
      return { x: loc.x, z: loc.z, color, type: loc.type };
    });
  }

  return {
    getLocations,
    getNearbyLocation,
    canAfford,
    updateEconomy,
    getInteractPrompt,
    interact,
    getLocationMarkers,
  };
}
