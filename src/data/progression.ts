import type { Element } from "./element";
import { ELEMENTS } from "./element";

export type UnlockTier = 0 | 1 | 2 | 3;

export type ProgressionState = {
  level: number;
  exp: number;
  expToNext: number;
  shards: Record<Element, number>;
  tierUnlocked: Record<Element, UnlockTier>;
};

export function createProgression(): ProgressionState {
  const shards = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  const tierUnlocked = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, UnlockTier>;
  return {
    level: 1,
    exp: 0,
    expToNext: expRequiredForLevel(1),
    shards,
    tierUnlocked
  };
}

export function expRequiredForLevel(level: number): number {
  // mild curve for prototype
  return Math.floor(25 + level * 15 + level * level * 2);
}

export function gainExp(state: ProgressionState, amount: number): { leveledUp: boolean } {
  state.exp += amount;
  let leveledUp = false;
  while (state.exp >= state.expToNext) {
    state.exp -= state.expToNext;
    state.level += 1;
    state.expToNext = expRequiredForLevel(state.level);
    leveledUp = true;
  }
  return { leveledUp };
}

const SHARD_MILESTONES: ReadonlyArray<{ shards: number; tier: UnlockTier }> = [
  { shards: 3, tier: 1 },
  { shards: 6, tier: 2 },
  { shards: 10, tier: 3 }
];

export function addShardAndCheckUnlock(
  state: ProgressionState,
  element: Element
): { unlockedTier: UnlockTier | null } {
  state.shards[element] += 1;

  const currentTier = state.tierUnlocked[element];
  for (const m of SHARD_MILESTONES) {
    if (m.tier > currentTier && state.shards[element] >= m.shards) {
      state.tierUnlocked[element] = m.tier;
      return { unlockedTier: m.tier };
    }
  }
  return { unlockedTier: null };
}

