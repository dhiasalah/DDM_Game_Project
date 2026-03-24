import type { MissionDef } from "./types";

/* ================================================================
 *  MISSION DEFINITIONS — all story + side missions
 * ================================================================ */

export const missionDefs: MissionDef[] = [
  // ── STORY MISSIONS ──
  {
    id: "intro_drive",
    title: "First Wheels",
    description: "Drive to the marked location downtown.",
    type: "go-to",
    giverId: "vinnie",
    steps: [
      {
        type: "go-to",
        description: "Drive to the garage on Main Street",
        targetX: 50,
        targetZ: 50,
      },
    ],
    reward: { money: 200 },
    requiredMissions: [],
    repeatable: false,
  },
  {
    id: "hot_delivery",
    title: "Hot Delivery",
    description: "Deliver the package before time runs out!",
    type: "delivery",
    giverId: "vinnie",
    steps: [
      {
        type: "go-to",
        description: "Pick up the package",
        targetX: -100,
        targetZ: 50,
      },
      {
        type: "go-to",
        description: "Deliver to the drop-off — HURRY!",
        targetX: 200,
        targetZ: -100,
        timeLimit: 60,
      },
    ],
    reward: { money: 500 },
    requiredMissions: ["intro_drive"],
    repeatable: false,
  },
  {
    id: "gang_trouble",
    title: "Gang Trouble",
    description: "Take out the rival gang members.",
    type: "kill",
    giverId: "tony",
    steps: [
      {
        type: "go-to",
        description: "Head to the gang territory",
        targetX: -200,
        targetZ: -200,
      },
      {
        type: "kill",
        description: "Eliminate the gang members",
        targetX: -200,
        targetZ: -200,
        count: 3,
      },
    ],
    reward: { money: 800, weapon: "shotgun" },
    requiredMissions: ["hot_delivery"],
    repeatable: false,
  },
  {
    id: "street_race_1",
    title: "Street Race: Downtown",
    description: "Win the downtown race through checkpoints.",
    type: "race",
    giverId: "racer",
    steps: [
      {
        type: "race",
        description: "Race through all checkpoints!",
        targets: [
          { x: 0, z: 0 },
          { x: 50, z: -50 },
          { x: 100, z: 0 },
          { x: 100, z: 100 },
          { x: 50, z: 150 },
          { x: 0, z: 100 },
        ],
        timeLimit: 90,
      },
    ],
    reward: { money: 600 },
    requiredMissions: [],
    repeatable: true,
  },
  {
    id: "chase_the_snitch",
    title: "Chase the Snitch",
    description: "Chase down the informant before he escapes.",
    type: "chase",
    giverId: "tony",
    steps: [
      {
        type: "go-to",
        description: "Find the snitch near the park",
        targetX: 150,
        targetZ: 50,
      },
      {
        type: "chase",
        description: "Chase him down!",
        targetX: 300,
        targetZ: -150,
        timeLimit: 45,
      },
    ],
    reward: { money: 700 },
    requiredMissions: ["gang_trouble"],
    repeatable: false,
  },
  {
    id: "big_heist",
    title: "The Big Heist",
    description: "Rob the warehouse and escape the cops.",
    type: "collect",
    giverId: "vinnie",
    steps: [
      {
        type: "go-to",
        description: "Drive to the warehouse",
        targetX: -250,
        targetZ: 100,
      },
      {
        type: "collect",
        description: "Grab the loot crates",
        targets: [
          { x: -250, z: 100 },
          { x: -260, z: 110 },
          { x: -240, z: 90 },
        ],
        count: 3,
      },
      {
        type: "go-to",
        description: "Escape to the safehouse!",
        targetX: 0,
        targetZ: 0,
        timeLimit: 120,
      },
    ],
    reward: { money: 2000, weapon: "smg" },
    requiredMissions: ["chase_the_snitch"],
    repeatable: false,
  },

  // ── SIDE MISSIONS ──
  {
    id: "taxi_run_1",
    title: "Taxi Run",
    description: "Pick up and drop off passengers for cash.",
    type: "delivery",
    giverId: "taxi_stand",
    steps: [
      {
        type: "go-to",
        description: "Pick up the passenger",
        targetX: 50,
        targetZ: -100,
      },
      {
        type: "go-to",
        description: "Drop off at the destination",
        targetX: -150,
        targetZ: 200,
        timeLimit: 60,
      },
    ],
    reward: { money: 300 },
    requiredMissions: [],
    repeatable: true,
  },
  {
    id: "street_race_2",
    title: "Street Race: Industrial",
    description: "Win the industrial district race.",
    type: "race",
    giverId: "racer",
    steps: [
      {
        type: "race",
        description: "Race through the docks!",
        targets: [
          { x: -150, z: -100 },
          { x: -200, z: -200 },
          { x: -300, z: -150 },
          { x: -250, z: -50 },
          { x: -150, z: 0 },
        ],
        timeLimit: 75,
      },
    ],
    reward: { money: 500 },
    requiredMissions: ["street_race_1"],
    repeatable: true,
  },
  {
    id: "collect_packages",
    title: "Hidden Packages",
    description: "Find the hidden packages around the city.",
    type: "collect",
    giverId: "contact",
    steps: [
      {
        type: "collect",
        description: "Find all hidden packages",
        targets: [
          { x: 100, z: -200 },
          { x: -100, z: 300 },
          { x: 250, z: 150 },
          { x: -300, z: -250 },
          { x: 0, z: -350 },
        ],
        count: 5,
      },
    ],
    reward: { money: 1000, weapon: "pistol" },
    requiredMissions: [],
    repeatable: false,
  },
  {
    id: "escort_vip",
    title: "VIP Escort",
    description: "Escort the VIP safely to his destination.",
    type: "escort",
    giverId: "tony",
    steps: [
      {
        type: "go-to",
        description: "Pick up the VIP",
        targetX: 100,
        targetZ: 100,
      },
      {
        type: "go-to",
        description: "Drive the VIP to the airport",
        targetX: -300,
        targetZ: 300,
        timeLimit: 90,
      },
    ],
    reward: { money: 900 },
    requiredMissions: ["intro_drive"],
    repeatable: false,
  },
];

// Mission giver locations
export const missionGivers: Record<
  string,
  { x: number; z: number; name: string }
> = {
  vinnie: { x: 10, z: -30, name: "Vinnie" },
  tony: { x: -50, z: 50, name: "Tony" },
  racer: { x: 100, z: -50, name: "Street Racer" },
  taxi_stand: { x: 50, z: -100, name: "Taxi Stand" },
  contact: { x: -100, z: -100, name: "Contact" },
};
