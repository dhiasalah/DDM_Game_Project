import type {
  WeaponType,
  WeaponData,
  WeaponState,
  WeaponsResult,
} from "./types";

/* ================================================================
 *  WEAPONS SYSTEM — inventory, switching, firing cooldowns
 * ================================================================ */

const weaponDefinitions: Record<WeaponType, WeaponData> = {
  fist: {
    name: "Fists",
    type: "melee",
    damage: 8,
    range: 2.0,
    fireRate: 2.5, // attacks per second
    spread: 0,
    maxAmmo: -1, // infinite
  },
  bat: {
    name: "Baseball Bat",
    type: "melee",
    damage: 18,
    range: 2.5,
    fireRate: 1.8,
    spread: 0,
    maxAmmo: -1,
  },
  pistol: {
    name: "Pistol",
    type: "ranged",
    damage: 20,
    range: 80,
    fireRate: 3,
    spread: 0.02,
    maxAmmo: 120,
  },
  shotgun: {
    name: "Shotgun",
    type: "ranged",
    damage: 12, // per pellet, 6 pellets
    range: 30,
    fireRate: 1.2,
    spread: 0.08,
    maxAmmo: 60,
  },
  smg: {
    name: "SMG",
    type: "ranged",
    damage: 10,
    range: 50,
    fireRate: 8,
    spread: 0.05,
    maxAmmo: 300,
  },
};

export function createWeapons(): WeaponsResult {
  // Owned weapons — always start with fists
  const owned = new Set<WeaponType>(["fist"]);
  const ammoMap = new Map<WeaponType, number>();
  let currentWeapon: WeaponType = "fist";
  let fireCooldown = 0;

  // Ordered list for cycling
  const weaponOrder: WeaponType[] = ["fist", "bat", "pistol", "shotgun", "smg"];

  function getCurrentWeapon(): WeaponState {
    return {
      weaponType: currentWeapon,
      ammo: ammoMap.get(currentWeapon) ?? -1,
    };
  }

  function getWeaponData(type: WeaponType): WeaponData {
    return weaponDefinitions[type];
  }

  function switchWeapon(type: WeaponType): void {
    if (owned.has(type)) {
      currentWeapon = type;
      fireCooldown = 0.2; // small delay on switch
    }
  }

  function addWeapon(type: WeaponType, ammo?: number): void {
    owned.add(type);
    const data = weaponDefinitions[type];
    if (data.maxAmmo > 0) {
      const current = ammoMap.get(type) ?? 0;
      const toAdd = ammo ?? Math.floor(data.maxAmmo * 0.5);
      ammoMap.set(type, Math.min(current + toAdd, data.maxAmmo));
    }
  }

  function addAmmo(type: WeaponType, amount: number): void {
    const data = weaponDefinitions[type];
    if (data.maxAmmo > 0) {
      const current = ammoMap.get(type) ?? 0;
      ammoMap.set(type, Math.min(current + amount, data.maxAmmo));
    }
  }

  function hasWeapon(type: WeaponType): boolean {
    return owned.has(type);
  }

  function getOwnedWeapons(): WeaponType[] {
    return weaponOrder.filter((w) => owned.has(w));
  }

  function cycleWeapon(direction: number): void {
    const ownedList = getOwnedWeapons();
    if (ownedList.length <= 1) return;
    const idx = ownedList.indexOf(currentWeapon);
    const next = (idx + direction + ownedList.length) % ownedList.length;
    switchWeapon(ownedList[next]);
  }

  function tryFire(_dt: number): boolean {
    if (fireCooldown > 0) return false;

    const data = weaponDefinitions[currentWeapon];

    // Check ammo for ranged weapons
    if (data.maxAmmo > 0) {
      const ammo = ammoMap.get(currentWeapon) ?? 0;
      if (ammo <= 0) return false;
      ammoMap.set(currentWeapon, ammo - 1);
    }

    fireCooldown = 1 / data.fireRate;
    return true;
  }

  function update(dt: number): void {
    if (fireCooldown > 0) {
      fireCooldown -= dt;
    }
  }

  return {
    getCurrentWeapon,
    getWeaponData,
    switchWeapon,
    addWeapon,
    addAmmo,
    hasWeapon,
    getOwnedWeapons,
    cycleWeapon,
    tryFire,
    update,
  };
}
