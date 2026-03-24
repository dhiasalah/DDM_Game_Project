/**
 * Health system — tracks player HP & vehicle HP,
 * handles damage, regen, and death/busted triggers.
 */

export interface HealthResult {
  getPlayerHP: () => number;
  getVehicleHP: () => number;
  damagePlayer: (amount: number) => void;
  damageVehicle: (amount: number) => void;
  healPlayer: (amount: number) => void;
  repairVehicle: (amount: number) => void;
  resetPlayer: () => void;
  resetVehicle: () => void;
  isPlayerDead: () => boolean;
  isVehicleDestroyed: () => boolean;
  updateHealth: (dt: number, inCombat: boolean) => void;
  setOnPlayerDeath: (cb: () => void) => void;
  setOnVehicleDestroyed: (cb: () => void) => void;
}

export function createHealthSystem(): HealthResult {
  const MAX_PLAYER_HP = 100;
  const MAX_VEHICLE_HP = 100;
  const REGEN_RATE = 1.0; // HP/s when out of combat
  const REGEN_DELAY = 8.0; // seconds after last damage before regen starts

  let playerHP = MAX_PLAYER_HP;
  let vehicleHP = MAX_VEHICLE_HP;
  let timeSinceLastDamage = REGEN_DELAY; // Start with regen available
  let playerDead = false;
  let vehicleDestroyed = false;

  let onPlayerDeath: (() => void) | null = null;
  let onVehicleDestroyed: (() => void) | null = null;

  function getPlayerHP(): number {
    return playerHP;
  }

  function getVehicleHP(): number {
    return vehicleHP;
  }

  function damagePlayer(amount: number): void {
    if (playerDead) return;
    playerHP -= amount;
    timeSinceLastDamage = 0;
    if (playerHP <= 0) {
      playerHP = 0;
      playerDead = true;
      if (onPlayerDeath) onPlayerDeath();
    }
  }

  function damageVehicle(amount: number): void {
    if (vehicleDestroyed) return;
    vehicleHP -= amount;
    if (vehicleHP <= 0) {
      vehicleHP = 0;
      vehicleDestroyed = true;
      if (onVehicleDestroyed) onVehicleDestroyed();
    }
  }

  function healPlayer(amount: number): void {
    playerHP = Math.min(MAX_PLAYER_HP, playerHP + amount);
  }

  function repairVehicle(amount: number): void {
    vehicleHP = Math.min(MAX_VEHICLE_HP, vehicleHP + amount);
    vehicleDestroyed = false;
  }

  function resetPlayer(): void {
    playerHP = MAX_PLAYER_HP;
    playerDead = false;
    timeSinceLastDamage = REGEN_DELAY;
  }

  function resetVehicle(): void {
    vehicleHP = MAX_VEHICLE_HP;
    vehicleDestroyed = false;
  }

  function isPlayerDead(): boolean {
    return playerDead;
  }

  function isVehicleDestroyed(): boolean {
    return vehicleDestroyed;
  }

  function updateHealth(dt: number, inCombat: boolean): void {
    if (playerDead) return;

    timeSinceLastDamage += dt;

    // Regen when out of combat for REGEN_DELAY seconds
    if (
      !inCombat &&
      timeSinceLastDamage >= REGEN_DELAY &&
      playerHP < MAX_PLAYER_HP
    ) {
      playerHP += REGEN_RATE * dt;
      if (playerHP > MAX_PLAYER_HP) playerHP = MAX_PLAYER_HP;
    }
  }

  function setOnPlayerDeath(cb: () => void): void {
    onPlayerDeath = cb;
  }

  function setOnVehicleDestroyed(cb: () => void): void {
    onVehicleDestroyed = cb;
  }

  return {
    getPlayerHP,
    getVehicleHP,
    damagePlayer,
    damageVehicle,
    healPlayer,
    repairVehicle,
    resetPlayer,
    resetVehicle,
    isPlayerDead,
    isVehicleDestroyed,
    updateHealth,
    setOnPlayerDeath,
    setOnVehicleDestroyed,
  };
}
