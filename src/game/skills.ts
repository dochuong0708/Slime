import Phaser from "phaser";
import type { Element } from "./element";
import { elementColor, elementLabel, isAdvantaged } from "./element";

export type SkillId = "skill_water" | "skill_fire" | "skill_wind" | "skill_earth" | "skill_metal";

export type SkillInfo = {
  id: SkillId;
  element: Element;
  name: string;
  cooldownMs: number;
  // tier 1..3
  tier: 1 | 2 | 3;
};

export const SKILLS: Record<Element, SkillInfo[]> = {
  water: [
    { id: "skill_water", element: "water", name: "Water Bolt", cooldownMs: 800, tier: 1 },
    { id: "skill_water", element: "water", name: "Ice Patch", cooldownMs: 2000, tier: 2 },
    { id: "skill_water", element: "water", name: "Tidal Wave", cooldownMs: 4500, tier: 3 }
  ],
  fire: [
    { id: "skill_fire", element: "fire", name: "Fire Burst", cooldownMs: 900, tier: 1 },
    { id: "skill_fire", element: "fire", name: "Flame Trail", cooldownMs: 2200, tier: 2 },
    { id: "skill_fire", element: "fire", name: "Inferno Ring", cooldownMs: 4800, tier: 3 }
  ],
  wind: [
    { id: "skill_wind", element: "wind", name: "Gust Slash", cooldownMs: 700, tier: 1 },
    { id: "skill_wind", element: "wind", name: "Cyclone Pull", cooldownMs: 2500, tier: 2 },
    { id: "skill_wind", element: "wind", name: "Tempest Dash", cooldownMs: 3500, tier: 3 }
  ],
  earth: [
    { id: "skill_earth", element: "earth", name: "Rock Guard", cooldownMs: 1600, tier: 1 },
    { id: "skill_earth", element: "earth", name: "Spike Line", cooldownMs: 2400, tier: 2 },
    { id: "skill_earth", element: "earth", name: "Stone Arena", cooldownMs: 5200, tier: 3 }
  ],
  metal: [
    { id: "skill_metal", element: "metal", name: "Iron Pierce", cooldownMs: 850, tier: 1 },
    { id: "skill_metal", element: "metal", name: "Magnet Pulse", cooldownMs: 2600, tier: 2 },
    { id: "skill_metal", element: "metal", name: "Overclock Blade", cooldownMs: 4200, tier: 3 }
  ]
};

export function getUnlockedSkillName(element: Element, tier: 1 | 2 | 3): string {
  const info = SKILLS[element].find((s) => s.tier === tier);
  return info ? `${info.name} (${elementLabel(element)} T${tier})` : `${elementLabel(element)} T${tier}`;
}

export type DamageableEnemy = Phaser.Physics.Arcade.Sprite & {
  element: Element;
  hp: number;
  slowUntilMs?: number;
  burningUntilMs?: number;
};

function withElementMultiplier(attacker: Element, defender: Element, base: number): number {
  return isAdvantaged(attacker, defender) ? base * 1.25 : base;
}

export function castElementSkill(args: {
  scene: Phaser.Scene;
  element: Element;
  tierUnlocked: 0 | 1 | 2 | 3;
  origin: Phaser.Math.Vector2;
  aimDir: Phaser.Math.Vector2;
  enemies: Phaser.Physics.Arcade.Group;
  nowMs: number;
}): { usedTier: 1 | 2 | 3; cooldownMs: number } | null {
  const { scene, element, tierUnlocked, origin, aimDir, enemies, nowMs } = args;
  if (tierUnlocked === 0) return null;

  const usedTier = tierUnlocked as 1 | 2 | 3;
  const info = SKILLS[element].find((s) => s.tier === usedTier);
  if (!info) return null;

  const dir = aimDir.lengthSq() < 0.0001 ? new Phaser.Math.Vector2(1, 0) : aimDir.clone().normalize();

  if (element === "water") {
    if (usedTier === 1) {
      // bolt projectile + slow
      const bullet = scene.add.circle(origin.x, origin.y, 5, elementColor(element), 1);
      scene.physics.add.existing(bullet);
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      body.setCircle(5);
      body.setAllowGravity(false);
      body.setVelocity(dir.x * 520, dir.y * 520);
      scene.physics.add.overlap(bullet, enemies, (_, e) => {
        const enemy = e as DamageableEnemy;
        enemy.hp -= withElementMultiplier(element, enemy.element, 14);
        enemy.slowUntilMs = nowMs + 1400;
        bullet.destroy();
      });
      scene.time.delayedCall(900, () => bullet.destroy());
    } else if (usedTier === 2) {
      // ice patch: slow zone
      const patch = scene.add.circle(origin.x + dir.x * 40, origin.y + dir.y * 40, 44, 0x2aa8ff, 0.18);
      scene.physics.add.existing(patch, true);
      scene.physics.add.overlap(patch, enemies, () => {}, (_, e) => {
        const enemy = e as DamageableEnemy;
        enemy.slowUntilMs = nowMs + 1800;
        enemy.hp -= withElementMultiplier(element, enemy.element, 6);
        return false;
      });
      scene.time.delayedCall(1200, () => patch.destroy());
    } else {
      // tidal wave: wide knockback + damage
      const wave = scene.add.rectangle(origin.x + dir.x * 80, origin.y + dir.y * 80, 220, 70, 0x39c6ff, 0.12);
      scene.physics.add.existing(wave, true);
      scene.physics.add.overlap(wave, enemies, () => {}, (_, e) => {
        const enemy = e as DamageableEnemy;
        enemy.hp -= withElementMultiplier(element, enemy.element, 18);
        enemy.slowUntilMs = nowMs + 2200;
        const eb = enemy.body as Phaser.Physics.Arcade.Body;
        eb.velocity.x += dir.x * 240;
        eb.velocity.y += dir.y * 240;
        return false;
      });
      scene.time.delayedCall(500, () => wave.destroy());
    }
  }

  if (element === "fire") {
    if (usedTier === 1) {
      // burst close-range
      const burst = scene.add.circle(origin.x + dir.x * 24, origin.y + dir.y * 24, 34, elementColor(element), 0.18);
      scene.physics.add.existing(burst, true);
      scene.physics.add.overlap(burst, enemies, () => {}, (_, e) => {
        const enemy = e as DamageableEnemy;
        enemy.hp -= withElementMultiplier(element, enemy.element, 18);
        enemy.burningUntilMs = nowMs + 1600;
        return false;
      });
      scene.time.delayedCall(180, () => burst.destroy());
    } else if (usedTier === 2) {
      // flame trail: 3 patches behind you (simple)
      for (let i = 0; i < 3; i++) {
        scene.time.delayedCall(i * 140, () => {
          const p = scene.add.circle(origin.x - dir.x * 22 * i, origin.y - dir.y * 22 * i, 26, 0xff6a2a, 0.14);
          scene.physics.add.existing(p, true);
          scene.physics.add.overlap(p, enemies, () => {}, (_, e) => {
            const enemy = e as DamageableEnemy;
            enemy.hp -= withElementMultiplier(element, enemy.element, 10);
            enemy.burningUntilMs = nowMs + 1400;
            return false;
          });
          scene.time.delayedCall(900, () => p.destroy());
        });
      }
    } else {
      // inferno ring around player
      const ring = scene.add.circle(origin.x, origin.y, 70, 0xff3c2f, 0.08);
      ring.setStrokeStyle(2, 0xff8a3a, 0.45);
      scene.physics.add.existing(ring, true);
      scene.physics.add.overlap(ring, enemies, () => {}, (_, e) => {
        const enemy = e as DamageableEnemy;
        enemy.hp -= withElementMultiplier(element, enemy.element, 22);
        enemy.burningUntilMs = nowMs + 2200;
        return false;
      });
      scene.time.delayedCall(650, () => ring.destroy());
    }
  }

  if (element === "wind") {
    if (usedTier === 1) {
      // quick arc slash (rectangle)
      const slash = scene.add.rectangle(origin.x + dir.x * 30, origin.y + dir.y * 30, 90, 26, 0xd7f5ff, 0.12);
      scene.physics.add.existing(slash, true);
      scene.physics.add.overlap(slash, enemies, () => {}, (_, e) => {
        const enemy = e as DamageableEnemy;
        enemy.hp -= withElementMultiplier(element, enemy.element, 16);
        const eb = enemy.body as Phaser.Physics.Arcade.Body;
        eb.velocity.x += dir.x * 190;
        eb.velocity.y += dir.y * 190;
        return false;
      });
      scene.time.delayedCall(120, () => slash.destroy());
    } else if (usedTier === 2) {
      // cyclone pull (small area pull)
      const c = scene.add.circle(origin.x + dir.x * 40, origin.y + dir.y * 40, 60, 0xbef2ff, 0.08);
      scene.physics.add.existing(c, true);
      scene.physics.add.overlap(c, enemies, () => {}, (_, e) => {
        const enemy = e as DamageableEnemy;
        enemy.hp -= withElementMultiplier(element, enemy.element, 8);
        const eb = enemy.body as Phaser.Physics.Arcade.Body;
        const v = new Phaser.Math.Vector2(origin.x - enemy.x, origin.y - enemy.y).normalize().scale(140);
        eb.velocity.x += v.x;
        eb.velocity.y += v.y;
        return false;
      });
      scene.time.delayedCall(650, () => c.destroy());
    } else {
      // tempest dash is handled in player (this casts a short gust damage at end)
      const g = scene.add.rectangle(origin.x + dir.x * 10, origin.y + dir.y * 10, 120, 50, 0xe7fbff, 0.06);
      scene.physics.add.existing(g, true);
      scene.physics.add.overlap(g, enemies, () => {}, (_, e) => {
        const enemy = e as DamageableEnemy;
        enemy.hp -= withElementMultiplier(element, enemy.element, 14);
        return false;
      });
      scene.time.delayedCall(160, () => g.destroy());
    }
  }

  if (element === "earth") {
    if (usedTier === 1) {
      // rock guard: temporary damage reduction marker (handled outside); here we just show bubble
      const b = scene.add.circle(origin.x, origin.y, 38, 0xb08b4f, 0.06);
      b.setStrokeStyle(2, 0xe1c28a, 0.35);
      scene.time.delayedCall(520, () => b.destroy());
    } else if (usedTier === 2) {
      // spike line
      const line = scene.add.rectangle(origin.x + dir.x * 70, origin.y + dir.y * 70, 180, 26, 0x9a743b, 0.12);
      scene.physics.add.existing(line, true);
      scene.physics.add.overlap(line, enemies, () => {}, (_, e) => {
        const enemy = e as DamageableEnemy;
        enemy.hp -= withElementMultiplier(element, enemy.element, 20);
        return false;
      });
      scene.time.delayedCall(220, () => line.destroy());
    } else {
      // stone arena: slows enemies inside briefly
      const arena = scene.add.circle(origin.x, origin.y, 92, 0x7c5a2a, 0.06);
      arena.setStrokeStyle(2, 0xe9d2ad, 0.22);
      scene.physics.add.existing(arena, true);
      scene.physics.add.overlap(arena, enemies, () => {}, (_, e) => {
        const enemy = e as DamageableEnemy;
        enemy.slowUntilMs = nowMs + 2200;
        enemy.hp -= withElementMultiplier(element, enemy.element, 10);
        return false;
      });
      scene.time.delayedCall(900, () => arena.destroy());
    }
  }

  if (element === "metal") {
    if (usedTier === 1) {
      // iron pierce: fast projectile, higher damage
      const bullet = scene.add.circle(origin.x, origin.y, 4, elementColor(element), 1);
      scene.physics.add.existing(bullet);
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      body.setCircle(4);
      body.setAllowGravity(false);
      body.setVelocity(dir.x * 700, dir.y * 700);
      scene.physics.add.overlap(bullet, enemies, (_, e) => {
        const enemy = e as DamageableEnemy;
        enemy.hp -= withElementMultiplier(element, enemy.element, 22);
        bullet.destroy();
      });
      scene.time.delayedCall(650, () => bullet.destroy());
    } else if (usedTier === 2) {
      // magnet pulse: pull in small radius
      const p = scene.add.circle(origin.x, origin.y, 78, 0xc8d0da, 0.06);
      p.setStrokeStyle(2, 0xffffff, 0.2);
      scene.physics.add.existing(p, true);
      scene.physics.add.overlap(p, enemies, () => {}, (_, e) => {
        const enemy = e as DamageableEnemy;
        enemy.hp -= withElementMultiplier(element, enemy.element, 10);
        const eb = enemy.body as Phaser.Physics.Arcade.Body;
        const v = new Phaser.Math.Vector2(origin.x - enemy.x, origin.y - enemy.y).normalize().scale(220);
        eb.velocity.x += v.x;
        eb.velocity.y += v.y;
        return false;
      });
      scene.time.delayedCall(300, () => p.destroy());
    } else {
      // overclock blade: short multi-hit zone in front
      for (let i = 0; i < 3; i++) {
        scene.time.delayedCall(i * 110, () => {
          const z = scene.add.rectangle(origin.x + dir.x * 28, origin.y + dir.y * 28, 80, 34, 0xe9eef6, 0.08);
          scene.physics.add.existing(z, true);
          scene.physics.add.overlap(z, enemies, () => {}, (_, e) => {
            const enemy = e as DamageableEnemy;
            enemy.hp -= withElementMultiplier(element, enemy.element, 12);
            return false;
          });
          scene.time.delayedCall(90, () => z.destroy());
        });
      }
    }
  }

  // scene.add
  //   .text(origin.x, origin.y - 54, `${elementLabel(element)} T${usedTier}`, {
  //     fontFamily: "system-ui, Segoe UI, Arial",
  //     fontSize: "12px",
  //     color: "#e9ecff"
  //   })
  //   .setOrigin(0.5)
  //   .setAlpha(0.9)
  //   .setDepth(3000)
  //   .setScrollFactor(0)
  //   .setShadow(0, 2, "#000000", 4, true, true);
  const SHOW_SKILL_TEXT = false;

if (SHOW_SKILL_TEXT) {
  scene.add
    .text(origin.x, origin.y - 54, `${elementLabel(element)} T${usedTier}`, {
      fontFamily: "system-ui, Segoe UI, Arial",
      fontSize: "12px",
      color: "#e9ecff"
    })
    .setOrigin(0.5)
    .setAlpha(0.9)
    .setDepth(3000)
    .setScrollFactor(0)
    .setShadow(0, 2, "#000000", 4, true, true);
}

  return { usedTier, cooldownMs: info.cooldownMs };
}

