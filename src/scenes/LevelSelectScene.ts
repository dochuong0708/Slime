import Phaser from "phaser";
import { ELEMENTS, elementColor, elementLabel } from "../data/element";
import { globalData, resetRun } from "../data/globalData";
import { playSound } from "../systems/AudioSystem";

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: "LevelSelectScene" });
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(0, 0, w, h, 0x12193a).setOrigin(0);

    this.add.text(w / 2, 60, "Chọn Màn Chơi", {
      fontFamily: "system-ui",
      fontSize: "36px",
      color: "#ffffff"
    }).setOrigin(0.5);

    // Score display
    const timeSec = Math.floor(globalData.totalTimeMs / 1000);
    this.add.text(20, 20, `Thời gian: ${timeSec}s | Đã hạ: ${globalData.totalKills} slime`, {
      fontFamily: "system-ui",
      fontSize: "18px",
      color: "#e9ecff"
    });

    const startX = w / 2 - 200;
    const gapX = 100;
    
    // 5 Elemental Stages
    ELEMENTS.forEach((el, index) => {
      const isCleared = globalData.clearedStages.includes(el);
      const stageNum = index + 1;
      const x = startX + index * gapX;
      const y = h / 2 - 40;

      const btn = this.add.circle(x, y, 40, elementColor(el), isCleared ? 0.3 : 1);
      btn.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        playSound('click');
        globalData.activeStage = stageNum;
        this.scene.start("GameScene", { stage: stageNum, resume: false });
      });

      this.add.text(x, y + 60, elementLabel(el), { fontFamily: "system-ui", fontSize: "16px", color: "#fff" }).setOrigin(0.5);
      
      if (isCleared) {
        this.add.text(x, y, "✓", { fontSize: "32px", color: "#00ff00" }).setOrigin(0.5);
      }
    });

    // Final Boss Stage
    const allCleared = globalData.clearedStages.length >= 5;
    const bossBtn = this.add.rectangle(w / 2, h / 2 + 100, 200, 50, allCleared ? 0xff3333 : 0x555555, 1);
    this.add.text(w / 2, h / 2 + 100, "BOSS CUỐI", { fontFamily: "system-ui", fontSize: "20px", color: "#fff", fontStyle: "bold" }).setOrigin(0.5);

    if (allCleared) {
      bossBtn.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        playSound('click');
        globalData.activeStage = 6;
        this.scene.start("GameScene", { stage: 6, resume: false });
      });
    } else {
      this.add.text(w / 2, h / 2 + 140, "(Cần vượt qua 5 hệ trên)", { fontFamily: "system-ui", fontSize: "14px", color: "#999" }).setOrigin(0.5);
    }

    // Back to Menu
    const btnBack = this.add.text(20, h - 50, "← Quay lại Menu", {
      fontFamily: "system-ui",
      fontSize: "20px",
      color: "#ffffff"
    }).setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      playSound('click');
      this.scene.start("MenuScene");
    });
    
    // Reset Run
    this.add.text(w - 180, h - 50, "Chơi ván mới (Reset)", {
        fontFamily: "system-ui",
        fontSize: "20px",
        color: "#ff8888"
      }).setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        playSound('click');
        if (confirm("Bạn có chắc muốn xóa điểm và chơi lại từ đầu?")) {
            resetRun();
            this.scene.restart();
        }
      });
  }
}
