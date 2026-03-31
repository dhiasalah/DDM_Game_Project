import type { MissionDef } from "./types";

/* ================================================================
 *  STORY MODE — 5 linear missions, GTA-style progression
 *  Each mission unlocks the next. Complete all 5 to finish the story.
 * ================================================================ */

export const STORY_MISSION_IDS = [
  "story_1_race",
  "story_2_delivery",
  "story_3_hit",
  "story_4_chase",
  "story_5_heist",
] as const;

export const missionDefs: MissionDef[] = [
  // ═══════════════════════════════════════════════════════════
  // MISSION 1: "Prove Yourself" — Street race through downtown
  // ═══════════════════════════════════════════════════════════
  {
    id: "story_1_race",
    title: "Prove Yourself",
    description:
      "Vinnie wants to see what you can do. Win this street race through downtown checkpoints.",
    type: "race",
    giverId: "vinnie",
    steps: [
      {
        type: "race",
        description: "Race through all checkpoints!",
        targets: [
          { x: 50, z: 0 },
          { x: 100, z: -50 },
          { x: 150, z: 0 },
          { x: 150, z: 100 },
          { x: 100, z: 150 },
          { x: 50, z: 100 },
        ],
        timeLimit: 120,
      },
    ],
    reward: { money: 500 },
    requiredMissions: [],
    repeatable: false,
  },

  // ═══════════════════════════════════════════════════════════
  // MISSION 2: "Hot Delivery" — Timed package delivery
  // ═══════════════════════════════════════════════════════════
  {
    id: "story_2_delivery",
    title: "Hot Delivery",
    description:
      "A package needs to get across the city fast. Pick it up and deliver it — no delays!",
    type: "delivery",
    giverId: "vinnie",
    steps: [
      {
        type: "go-to",
        description: "Drive to the pickup point",
        targetX: -100,
        targetZ: 50,
      },
      {
        type: "go-to",
        description: "Deliver the package — HURRY!",
        targetX: 200,
        targetZ: -150,
        timeLimit: 75,
      },
    ],
    reward: { money: 800, weapon: "bat" },
    requiredMissions: ["story_1_race"],
    repeatable: false,
  },

  // ═══════════════════════════════════════════════════════════
  // MISSION 3: "Clean the Streets" — Kill targets on foot
  // ═══════════════════════════════════════════════════════════
  {
    id: "story_3_hit",
    title: "Clean the Streets",
    description:
      "Tony needs you to deal with some troublemakers. Get out of the car and handle business.",
    type: "kill",
    giverId: "tony",
    steps: [
      {
        type: "go-to",
        description: "Drive to the gang territory",
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
      {
        type: "go-to",
        description: "Get back to safety — drive to the safehouse!",
        targetX: 0,
        targetZ: 0,
        timeLimit: 90,
      },
    ],
    reward: { money: 1200, weapon: "pistol" },
    requiredMissions: ["story_2_delivery"],
    repeatable: false,
  },

  // ═══════════════════════════════════════════════════════════
  // MISSION 4: "The Snitch" — Chase + escape the heat
  // ═══════════════════════════════════════════════════════════
  {
    id: "story_4_chase",
    title: "The Snitch",
    description:
      "An informant is about to rat us out to the cops. Chase him down before he escapes, then lay low.",
    type: "chase",
    giverId: "tony",
    steps: [
      {
        type: "go-to",
        description: "Head to the informant's last known location",
        targetX: 150,
        targetZ: 100,
      },
      {
        type: "go-to",
        description: "Chase the snitch — he's running!",
        targetX: 300,
        targetZ: -200,
        timeLimit: 50,
      },
      {
        type: "go-to",
        description: "Lose the heat — get to the hideout!",
        targetX: -150,
        targetZ: 200,
        timeLimit: 70,
      },
    ],
    reward: { money: 1500, weapon: "shotgun" },
    requiredMissions: ["story_3_hit"],
    repeatable: false,
  },

  // ═══════════════════════════════════════════════════════════
  // MISSION 5: "The Big Score" — Multi-stage warehouse heist
  // ═══════════════════════════════════════════════════════════
  {
    id: "story_5_heist",
    title: "The Big Score",
    description:
      "This is the big one. Hit the warehouse, grab the loot, and escape the entire police force.",
    type: "collect",
    giverId: "vinnie",
    steps: [
      {
        type: "go-to",
        description: "Drive to the warehouse on the west side",
        targetX: -250,
        targetZ: 100,
      },
      {
        type: "collect",
        description: "Grab the loot crates inside!",
        targets: [
          { x: -250, z: 95 },
          { x: -260, z: 110 },
          { x: -240, z: 105 },
        ],
        count: 3,
      },
      {
        type: "go-to",
        description: "ESCAPE! Get to the safehouse before the cops get you!",
        targetX: 0,
        targetZ: 0,
        timeLimit: 120,
      },
    ],
    reward: { money: 5000, weapon: "smg" },
    requiredMissions: ["story_4_chase"],
    repeatable: false,
  },
];

// Mission giver locations — placed on sidewalks near road intersections
export const missionGivers: Record<
  string,
  { x: number; z: number; name: string }
> = {
  vinnie: { x: 10, z: -30, name: "Vinnie" },
  tony: { x: -50, z: 50, name: "Tony" },
};
