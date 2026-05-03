import Phaser from "phaser";
import { globalData } from "../data/globalData";
import { playSound } from "../systems/AudioSystem";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "MenuScene" });
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    // Background
    this.add.rectangle(0, 0, w, h, 0x0b1020).setOrigin(0);

    this.add.text(w / 2, h * 0.25, "Slime Elemental", {
      fontFamily: "system-ui, Arial",
      fontSize: "48px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    const btnStyle = {
      fontFamily: "system-ui, Arial",
      fontSize: "24px",
      color: "#ffffff",
      backgroundColor: "#24306a",
      padding: { x: 20, y: 10 }
    };

    const hasActiveGame = globalData.activeStage !== null;

    // Continue Button
    const btnContinue = this.add.text(w / 2, h * 0.45, "Tiếp tục", {
      ...btnStyle,
      color: hasActiveGame ? "#ffffff" : "#666666",
      backgroundColor: hasActiveGame ? "#24306a" : "#1a1a2e"
    }).setOrigin(0.5);
    
    if (hasActiveGame) {
      btnContinue.setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          playSound('click');
          this.scene.start("GameScene", { stage: globalData.activeStage, resume: true });
        });
    }

    // New Game / Level Select Button
    const btnPlay = this.add.text(w / 2, h * 0.55, "Chơi mới / Chọn màn", btnStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        playSound('click');
        this.scene.start("LevelSelectScene");
      });

    // Settings Button
    const btnSettings = this.add.text(w / 2, h * 0.65, "Cài đặt", btnStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        playSound('click');
        this.scene.launch("SettingsScene");
      });
  }
}
