import Phaser from "phaser";
import { elementLabel } from "../data/element";
import type { GameScene } from "../scenes/GameScene";

export class HUD {
    private scene: GameScene;
    private hpText: Phaser.GameObjects.Text;
    private expText: Phaser.GameObjects.Text;
    private shardText: Phaser.GameObjects.Text;
    private skillText: Phaser.GameObjects.Text;
    private toastText: Phaser.GameObjects.Text;
    private playerHpBar: Phaser.GameObjects.Graphics;

    constructor(scene: GameScene) {
        this.scene = scene;
        const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            fontFamily: "system-ui, Segoe UI, Arial",
            fontSize: "14px",
            color: "#e9ecff"
        };
        
        this.hpText = scene.add.text(44, 42, "", textStyle).setDepth(2000);
        this.expText = scene.add.text(44, 64, "", textStyle).setDepth(2000);
        this.shardText = scene.add.text(44, 86, "", textStyle).setDepth(2000);
        this.skillText = scene.add.text(44, 108, "", textStyle).setDepth(2000);
        
        this.toastText = scene.add
            .text(scene.scale.width / 2, 54, "", {
                fontFamily: "system-ui, Segoe UI, Arial",
                fontSize: "16px",
                color: "#ffffff"
            })
            .setOrigin(0.5)
            .setDepth(2500)
            .setAlpha(0);

        this.playerHpBar = scene.add.graphics().setDepth(2001);
    }

    public update() {
        const p = this.scene.progression;
        const ps = this.scene.playerState;
        this.hpText.setText(`HP: ${Math.max(0, Math.floor(ps.hp))}/${ps.maxHp}`);
        this.expText.setText(`LV: ${p.level}  EXP: ${p.exp}/${p.expToNext}`);
        const stageInfo = this.scene.stages.find((s) => s.stage === this.scene.stage)!;
        this.shardText.setText(`Màn ${this.scene.stage} (Hệ: ${elementLabel(stageInfo.element)})`);
        this.skillText.setText(
            `Tiến độ: ${this.scene.killedThisStage}/${this.scene.getStageEnemyTarget()} | Boss: ${this.scene.bossSpawned ? "ON" : "OFF"}  ||  Unlock: Nước T${p.tierUnlocked.water} | Lửa T${p.tierUnlocked.fire} | Gió T${p.tierUnlocked.wind} | Đất T${p.tierUnlocked.earth} | Kim T${p.tierUnlocked.metal}`
        );

        // draw player hp bar
        this.playerHpBar.clear();
        if (this.scene.player.active) {
            const pw = 52;
            const ph = 7;
            const px = this.scene.player.x - pw / 2;
            const py = this.scene.player.y - 38;
            this.playerHpBar.fillStyle(0x000000, 0.35);
            this.playerHpBar.fillRoundedRect(px - 1, py - 1, pw + 2, ph + 2, 3);
            this.playerHpBar.fillStyle(0x2bd052, 0.9);
            this.playerHpBar.fillRoundedRect(px, py, pw * Phaser.Math.Clamp(ps.hp / ps.maxHp, 0, 1), ph, 3);
        }
        
        // draw enemy hp bars
        const children = this.scene.enemies.getChildren() as any[];
        for (const e of children) {
            if (!e.active) continue;
            if (!e.hpBar) continue;
            e.hpBar.clear();

            const w = e.isBoss ? 70 : 46;
            const h = 6;
            const x = e.x - w / 2;
            const y = e.y - (e.isBoss ? 46 : 32);

            e.hpBar.fillStyle(0x000000, 0.35);
            e.hpBar.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 3);
            e.hpBar.fillStyle(e.isBoss ? 0xb86cff : 0xffd24a, 0.9);
            e.hpBar.fillRoundedRect(x, y, w * Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1), h, 3);
        }
    }

    public showToast(msg: string, color = "#ffffff") {
        this.toastText.setText(msg);
        this.toastText.setColor(color);
        this.scene.tweens.killTweensOf(this.toastText);
        this.toastText.setAlpha(0);
        this.scene.tweens.add({
            targets: this.toastText,
            alpha: 1,
            duration: 140,
            yoyo: true,
            hold: 1400,
            ease: "Sine.easeOut"
        });
    }
}
