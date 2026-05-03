import Phaser from "phaser";
import { globalData } from "../data/globalData";
import { playSound } from "../systems/AudioSystem";

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super({ key: "SettingsScene" });
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(0, 0, w, h, 0x000000, 0.85).setOrigin(0);

    this.add.text(w / 2, h * 0.2, "CÀI ĐẶT", {
      fontFamily: "system-ui",
      fontSize: "40px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    // Volume setting
    this.add.text(w / 2 - 100, h * 0.4, "Âm lượng:", { fontFamily: "system-ui", fontSize: "24px", color: "#fff" }).setOrigin(1, 0.5);
    const volText = this.add.text(w / 2, h * 0.4, `${Math.round(globalData.settings.volume * 100)}%`, { fontFamily: "system-ui", fontSize: "24px", color: "#fff" }).setOrigin(0.5);
    
    this.add.text(w / 2 - 40, h * 0.4, "◀", { fontSize: "24px", color: "#65ff7a" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        playSound('click');
        globalData.settings.volume = Math.max(0, globalData.settings.volume - 0.1);
        volText.setText(`${Math.round(globalData.settings.volume * 100)}%`);
      });

    this.add.text(w / 2 + 40, h * 0.4, "▶", { fontSize: "24px", color: "#65ff7a" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        playSound('click');
        globalData.settings.volume = Math.min(1, globalData.settings.volume + 0.1);
        volText.setText(`${Math.round(globalData.settings.volume * 100)}%`);
      });

    // Skin setting
    this.add.text(w / 2 - 100, h * 0.55, "Skin Slime:", { fontFamily: "system-ui", fontSize: "24px", color: "#fff" }).setOrigin(1, 0.5);
    
    const skinNames = ["Mặc định (Xanh)", "Lửa (Đỏ)", "Băng (Xanh dương)", "Vàng (Điện)"];
    const skinColors = [0x65ff7a, 0xff4d4d, 0x4d94ff, 0xffe066];
    
    const preview = this.add.circle(w / 2 - 15, h * 0.55, 15, skinColors[globalData.settings.playerSkin]);
    const skinText = this.add.text(w / 2 + 10, h * 0.55, skinNames[globalData.settings.playerSkin], { fontFamily: "system-ui", fontSize: "24px", color: "#fff" }).setOrigin(0, 0.5);
    
    const cycleSkin = () => {
        playSound('click');
        globalData.settings.playerSkin = (globalData.settings.playerSkin + 1) % skinNames.length;
        skinText.setText(skinNames[globalData.settings.playerSkin]);
        preview.setFillStyle(skinColors[globalData.settings.playerSkin]);
    };

    // Invisible clickable area covering the text and preview
    this.add.rectangle(w / 2 + 120, h * 0.55, 280, 50, 0xffffff, 0)
        .setInteractive({useHandCursor: true})
        .on('pointerdown', cycleSkin);

    // Close Button
    this.add.text(w / 2, h * 0.8, "Đóng", {
      fontFamily: "system-ui",
      fontSize: "24px",
      color: "#ffffff",
      backgroundColor: "#666",
      padding: { x: 30, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        playSound('click');
        this.scene.stop();
      });
  }
}
