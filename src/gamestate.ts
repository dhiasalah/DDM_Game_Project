/**
 * Central game state manager — tracks player state, money, stats,
 * and coordinates between all systems.
 */

export type GamePlayerState = "alive" | "wasted" | "busted" | "in-mission";

export interface GameState {
  playerState: GamePlayerState;
  money: number;
  totalKills: number;
  missionsCompleted: number;
  playTime: number;
}

export interface GameStateResult {
  getState: () => Readonly<GameState>;
  getPlayerState: () => GamePlayerState;
  setPlayerState: (s: GamePlayerState) => void;
  getMoney: () => number;
  addMoney: (amount: number) => void;
  removeMoney: (amount: number) => void;
  addKill: () => void;
  completeMission: () => void;
  updatePlayTime: (dt: number) => void;
  reset: () => void;
}

export function createGameState(initialMoney: number = 500): GameStateResult {
  const state: GameState = {
    playerState: "alive",
    money: initialMoney,
    totalKills: 0,
    missionsCompleted: 0,
    playTime: 0,
  };

  function getState(): Readonly<GameState> {
    return state;
  }

  function getPlayerState(): GamePlayerState {
    return state.playerState;
  }

  function setPlayerState(s: GamePlayerState): void {
    state.playerState = s;
  }

  function getMoney(): number {
    return state.money;
  }

  function addMoney(amount: number): void {
    state.money += amount;
    if (state.money < 0) state.money = 0;
  }

  function removeMoney(amount: number): void {
    state.money = Math.max(0, state.money - amount);
  }

  function addKill(): void {
    state.totalKills++;
  }

  function completeMission(): void {
    state.missionsCompleted++;
  }

  function updatePlayTime(dt: number): void {
    state.playTime += dt;
  }

  function reset(): void {
    state.playerState = "alive";
    state.totalKills = 0;
    state.missionsCompleted = 0;
    state.playTime = 0;
    // Money persists across resets (lose 10% on death via removeMoney)
  }

  return {
    getState,
    getPlayerState,
    setPlayerState,
    getMoney,
    addMoney,
    removeMoney,
    addKill,
    completeMission,
    updatePlayTime,
    reset,
  };
}
