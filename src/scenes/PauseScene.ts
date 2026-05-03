import Phaser from "phaser";
import { playSound } from "../systems/AudioSystem";

export class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: "PauseScene" });
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    // Semi-transparent dark background
    this.add.rectangle(0, 0, w, h, 0x000000, 0.7).setOrigin(0);

    this.add.text(w / 2, h * 0.3, "TẠM DỪNG", {
      fontFamily: "system-ui",
      fontSize: "40px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    const btnStyle = {
      fontFamily: "system-ui",
      fontSize: "24px",
      color: "#ffffff",
      backgroundColor: "#24306a",
      padding: { x: 20, y: 10 }
    };

    // Resume button
    this.add.text(w / 2, h * 0.45, "Tiếp tục", btnStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        playSound('click');
        this.scene.resume("GameScene");
        this.scene.stop();
      });

    // Back to Level Select
    this.add.text(w / 2, h * 0.58, "Về màn chọn Level", btnStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        playSound('click');
        this.scene.stop("GameScene");
        this.scene.start("LevelSelectScene");
        this.scene.stop();
      });

    // Back to Main Menu
    this.add.text(w / 2, h * 0.71, "Về Menu chính", btnStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        playSound('click');
        this.scene.stop("GameScene");
        this.scene.start("MenuScene");
        this.scene.stop();
      });
      
    // Listen for ESC to resume
    this.input.keyboard?.on('keydown-ESC', () => {
        this.scene.resume("GameScene");
        this.scene.stop();
    });
  }
}
