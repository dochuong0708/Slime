import type { Element } from "./element";
import { createProgression, ProgressionState } from "./progression";

export type GlobalData = {
  clearedStages: Element[];
  totalKills: number;
  totalTimeMs: number;
  settings: {
    volume: number;
    playerSkin: number; // 0: Green, 1: Red, 2: Blue, 3: Yellow
  };
  activeStage: number | null; // Currently saved/paused stage config (1-6)
  progression: ProgressionState;
};

export const globalData: GlobalData = {
  clearedStages: [],
  totalKills: 0,
  totalTimeMs: 0,
  settings: {
    volume: 0.5,
    playerSkin: 0
  },
  activeStage: null,
  progression: createProgression(),
};

export function resetRun() {
  globalData.clearedStages = [];
  globalData.totalKills = 0;
  globalData.totalTimeMs = 0;
  globalData.activeStage = null;
  globalData.progression = createProgression();
}
