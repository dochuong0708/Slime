import Phaser from "phaser";
import type { Element } from "../game/element";
import { ELEMENTS, elementColor, elementLabel } from "../game/element";
import { createProgression, gainExp } from "../game/progression";
import type { DamageableEnemy } from "../game/skills";
import { castElementSkill, getUnlockedSkillName } from "../game/skills";

type EnemyState = DamageableEnemy & {
  homeX: number;
  homeY: number;
  leashRadius: number;
  aggroRadius: number;
  wanderAngle: number;
  nextWanderAtMs: number;
  isBoss?: boolean;
  maxHp: number;
  hpBar?: Phaser.GameObjects.Graphics;
  bossNextSpecialAtMs?: number;
  bossSpecialCdMs?: number;
};

type SkillOrb = Phaser.Physics.Arcade.Image & {
  element: Element;
  tier: 1 | 2 | 3;
};

type StageConfig =
  | { stage: 1 | 2 | 3 | 4 | 5; element: Element; enemies: number }
  | { stage: 6; element: "metal"; enemies: 0; finalBoss: true };

type PlayerState = {
  hp: number;
  maxHp: number;
  baseSpeed: number;
  lastAim: Phaser.Math.Vector2;
  invulnUntilMs: number;
  dashUntilMs: number;
  dashCooldownUntilMs: number;
  guardUntilMs: number;
};

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  private player!: Phaser.Physics.Arcade.Sprite;
  private playerState!: PlayerState;
  private playerHpBar!: Phaser.GameObjects.Graphics;

  private enemies!: Phaser.Physics.Arcade.Group;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private spawnTimerMs = 0;

  private progression = createProgression();
  private skillCooldownUntilMs: Record<Element, number> = { water: 0, fire: 0, wind: 0, earth: 0, metal: 0 };

  private stage = 1 as 1 | 2 | 3 | 4 | 5 | 6;
  private spawnedThisStage = 0;
  private killedThisStage = 0;
  private bossSpawned = false;
  private readonly enemiesPerStage = 10;
  private readonly maxAliveEnemies = 12;

  private readonly stages: StageConfig[] = [
    { stage: 1, element: "water", enemies: 10 },
    { stage: 2, element: "fire", enemies: 10 },
    { stage: 3, element: "wind", enemies: 10 },
    { stage: 4, element: "earth", enemies: 10 },
    { stage: 5, element: "metal", enemies: 10 },
    { stage: 6, element: "metal", enemies: 0, finalBoss: true }
  ];

  private hud!: {
    hpText: Phaser.GameObjects.Text;
    expText: Phaser.GameObjects.Text;
    shardText: Phaser.GameObjects.Text;
    skillText: Phaser.GameObjects.Text;
    toast: Phaser.GameObjects.Text;
  };

  constructor() {
    super({ key: "GameScene" });
  }

  create() {
    // Reset all run stats when (re)starting the scene
    this.progression = createProgression();
    this.skillCooldownUntilMs = { water: 0, fire: 0, wind: 0, earth: 0, metal: 0 };
    this.spawnTimerMs = 0;
    this.spawnTimerMs = 0;
    this.stage = 1;
    this.spawnedThisStage = 0;
    this.killedThisStage = 0;
    this.bossSpawned = false;

    this.cursors = this.input.keyboard!.createCursorKeys();
    const keyboard = this.input.keyboard!;
    this.keys = {
      W: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SPACE: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      F: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      SHIFT: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      ONE: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      TWO: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      THREE: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      FOUR: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      FIVE: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE)
    };

    // Ensure the Phaser canvas can receive keyboard focus in some environments
    const canvas = this.game.canvas;
    canvas.setAttribute("tabindex", "0");
    canvas.style.outline = "none";
    canvas.focus();
    this.input.on("pointerdown", () => canvas.focus());

    this.createTextures();
    this.createArena();
    this.createPlayer();
    this.createEnemies();
    this.createProjectiles();
    this.createPickups();
    this.createHud();

    this.physics.add.overlap(this.player, this.enemies, (_, e) => this.onPlayerHit(e as DamageableEnemy));
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.enemies, this.walls);
  }

  private createTextures() {
    // Player slime texture
    const g = this.add.graphics();
    g.fillStyle(0x65ff7a, 1);
    g.fillCircle(24, 24, 22);
    g.fillStyle(0x2bd052, 0.35);
    g.fillEllipse(18, 30, 18, 10);
    g.generateTexture("playerSlime", 48, 48);
    g.clear();

    // Enemy slime base; color tint per element
    g.fillStyle(0xffffff, 1);
    g.fillCircle(20, 20, 18);
    g.fillStyle(0x000000, 0.08);
    g.fillEllipse(15, 25, 16, 9);
    g.generateTexture("enemySlime", 40, 40);
    g.destroy();
  }

  private createArena() {
    const w = this.scale.width;
    const h = this.scale.height;

    const bg = this.add.graphics();
    // Brighter map colors
    bg.fillStyle(0x12193a, 1);
    bg.fillRect(0, 0, w, h);
    bg.fillStyle(0x1a2550, 1);
    bg.fillRoundedRect(28, 28, w - 56, h - 56, 18);
    bg.lineStyle(2, 0xffffff, 0.06);
    bg.strokeRoundedRect(28, 28, w - 56, h - 56, 18);
    bg.setDepth(-10);

    // World bounds
    this.physics.world.setBounds(40, 40, w - 80, h - 80);

    // Simple map: a few static obstacles (board)
    this.walls = this.physics.add.staticGroup();
    const addWall = (x: number, y: number, ww: number, hh: number) => {
      const r = this.add.rectangle(x, y, ww, hh, 0x24306a, 1).setDepth(-5);
      r.setStrokeStyle(2, 0xffffff, 0.1);
      this.physics.add.existing(r, true);
      this.walls.add(r);
    };

    // layout is symmetrical-ish to feel like an "arena"
    addWall(w / 2, h / 2, 180, 26);
    addWall(w / 2, h / 2 - 120, 26, 160);
    addWall(w / 2, h / 2 + 120, 26, 160);
    addWall(w / 2 - 260, h / 2, 140, 26);
    addWall(w / 2 + 260, h / 2, 140, 26);
  }

  private createPlayer() {
    this.player = this.physics.add.sprite(this.scale.width / 2, this.scale.height / 2, "playerSlime");
    this.player.setDepth(10);
    this.player.setCollideWorldBounds(true);
    // Direct velocity movement (more "free" control)
    this.player.setDamping(false);
    this.player.setDrag(0, 0);
    this.player.setMaxVelocity(800, 800);

    this.playerState = {
      hp: 100,
      maxHp: 100,
      baseSpeed: 240,
      lastAim: new Phaser.Math.Vector2(1, 0),
      invulnUntilMs: 0,
      dashUntilMs: 0,
      dashCooldownUntilMs: 0,
      guardUntilMs: 0
    };

    this.playerHpBar = this.add.graphics().setDepth(2001);
  }

  private createEnemies() {
    this.enemies = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      runChildUpdate: false
    });
  }

  private createProjectiles() {
    this.projectiles = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      runChildUpdate: false
    });

    this.physics.add.collider(this.projectiles, this.walls, (p) => {
      (p as Phaser.GameObjects.GameObject).destroy();
    });
  }

  private createPickups() {
    this.pickups = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      runChildUpdate: false
    });

    this.physics.add.collider(this.pickups, this.walls);
    this.physics.add.overlap(this.player, this.pickups, (_, p) => this.onPickupOrb(p as SkillOrb));
  }

  private createHud() {
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "system-ui, Segoe UI, Arial",
      fontSize: "14px",
      color: "#e9ecff"
    };

    this.hud = {
      hpText: this.add.text(44, 42, "", textStyle).setDepth(2000),
      expText: this.add.text(44, 64, "", textStyle).setDepth(2000),
      shardText: this.add.text(44, 86, "", textStyle).setDepth(2000),
      skillText: this.add.text(44, 108, "", textStyle).setDepth(2000),
      toast: this.add
        .text(this.scale.width / 2, 54, "", {
          fontFamily: "system-ui, Segoe UI, Arial",
          fontSize: "16px",
          color: "#ffffff"
        })
        .setOrigin(0.5)
        .setDepth(2500)
        .setAlpha(0)
    };

    this.updateHud();
  }

  private toast(msg: string, color = "#ffffff") {
    this.hud.toast.setText(msg);
    this.hud.toast.setColor(color);
    this.tweens.killTweensOf(this.hud.toast);
    this.hud.toast.setAlpha(0);
    this.tweens.add({
      targets: this.hud.toast,
      alpha: 1,
      duration: 140,
      yoyo: true,
      hold: 1400,
      ease: "Sine.easeOut"
    });
  }

  private updateHud() {
    const p = this.progression;
    this.hud.hpText.setText(`HP: ${Math.max(0, Math.floor(this.playerState.hp))}/${this.playerState.maxHp}`);
    this.hud.expText.setText(`LV: ${p.level}  EXP: ${p.exp}/${p.expToNext}`);
    const stageInfo = this.stages.find((s) => s.stage === this.stage)!;
    this.hud.shardText.setText(`Màn ${this.stage} (Hệ: ${elementLabel(stageInfo.element)})`);
    this.hud.skillText.setText(
      `Tiến độ: ${this.killedThisStage}/${this.getStageEnemyTarget()} | Boss: ${this.bossSpawned ? "ON" : "OFF"}  ||  Unlock: Nước T${p.tierUnlocked.water} | Lửa T${p.tierUnlocked.fire} | Gió T${p.tierUnlocked.wind} | Đất T${p.tierUnlocked.earth} | Kim T${p.tierUnlocked.metal}`
    );
  }

  update(_: number, dtMs: number) {
    const nowMs = this.time.now;
    this.handleMovement(nowMs);
    this.handleAttack(nowMs);
    this.handleMelee(nowMs);
    this.handleSkills(nowMs);
    this.handleEnemyAI(nowMs, dtMs);
    this.handleSpawning(dtMs);
    this.handleDamageOverTime(nowMs);
    this.cleanupDeadEnemies(nowMs);
    this.drawHpBars();
    this.updateHud();

    if (this.playerState.hp <= 0) {
      this.scene.restart();
    }
  }

  private handleMovement(nowMs: number) {
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;

    const input = new Phaser.Math.Vector2((right ? 1 : 0) - (left ? 1 : 0), (down ? 1 : 0) - (up ? 1 : 0));
    if (input.lengthSq() > 0.01) {
      input.normalize();
      this.playerState.lastAim = input.clone();
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;

    const isDashing = nowMs < this.playerState.dashUntilMs;
    const speed = isDashing ? 520 : this.playerState.baseSpeed;
    body.setAcceleration(0, 0);
    body.setVelocity(input.x * speed, input.y * speed);

    if (Phaser.Input.Keyboard.JustDown(this.keys.SHIFT) && nowMs >= this.playerState.dashCooldownUntilMs) {
      this.playerState.dashUntilMs = nowMs + 160;
      this.playerState.dashCooldownUntilMs = nowMs + 850;
      body.velocity.x += this.playerState.lastAim.x * 260;
      body.velocity.y += this.playerState.lastAim.y * 260;
    }

    // Wind T3: Tempest Dash bonus (small gust at dash)
    if (isDashing && nowMs % 60 < 16 && this.progression.tierUnlocked.wind >= 3) {
      castElementSkill({
        scene: this,
        element: "wind",
        tierUnlocked: 3,
        origin: new Phaser.Math.Vector2(this.player.x, this.player.y),
        aimDir: this.playerState.lastAim,
        enemies: this.enemies,
        nowMs
      });
    }
  }

  private attackCooldownUntilMs = 0;
  private meleeCooldownUntilMs = 0;

  private handleAttack(nowMs: number) {
    if (!Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) return;
    if (nowMs < this.attackCooldownUntilMs) return;
    this.attackCooldownUntilMs = nowMs + 240;

    const dir = this.playerState.lastAim.clone().normalize();
    const origin = new Phaser.Math.Vector2(this.player.x, this.player.y).add(dir.clone().scale(28));

    // Use a physics sprite in the `projectiles` group so wall-collision is reliable
    const bullet = this.projectiles.create(origin.x, origin.y, "") as Phaser.Physics.Arcade.Image;
    bullet.setDepth(900);
    bullet.setTint(0x65ff7a);
    bullet.setCircle(5);
    bullet.setDisplaySize(10, 10);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocity(dir.x * 400, dir.y * 400);

    this.physics.add.overlap(bullet, this.enemies, (_, e) => {
      const enemy = e as EnemyState;
      const dmg = enemy.isBoss ? 10 : 16;
      enemy.hp -= dmg;
      const eb = enemy.body as Phaser.Physics.Arcade.Body;
      const knock = enemy.isBoss ? 80 : 240;
      eb.velocity.x += dir.x * knock;
      eb.velocity.y += dir.y * knock;
      bullet.destroy();
    });

    // world bounds cleanup
    this.time.delayedCall(500, () => bullet.destroy());
  }

  private handleMelee(nowMs: number) {
    if (!Phaser.Input.Keyboard.JustDown(this.keys.F)) return;
    if (nowMs < this.meleeCooldownUntilMs) return;
    this.meleeCooldownUntilMs = nowMs + 800;

    const dir = this.playerState.lastAim.clone().normalize();
    const origin = new Phaser.Math.Vector2(this.player.x, this.player.y).add(dir.clone().scale(26));

    const hitbox = this.add.rectangle(origin.x, origin.y, 74, 54, 0x65ff7a, 0.08).setDepth(950);
    hitbox.setStrokeStyle(2, 0xffffff, 0.12);
    this.physics.add.existing(hitbox, true);

    this.physics.add.overlap(hitbox, this.enemies, () => {}, (_, e) => {
      const enemy = e as EnemyState;
      if (enemy.isBoss) {
        enemy.hp -= 60; // not one-shot boss
      } else {
        enemy.hp = 0; // one-shot normal enemies
      }
      const eb = enemy.body as Phaser.Physics.Arcade.Body;
      eb.velocity.x += dir.x * 260;
      eb.velocity.y += dir.y * 260;
      return false;
    });

    this.time.delayedCall(110, () => hitbox.destroy());
  }

  private handleSkills(nowMs: number) {
    const keyToElement: Array<[Phaser.Input.Keyboard.Key, Element]> = [
      [this.keys.ONE, "water"],
      [this.keys.TWO, "fire"],
      [this.keys.THREE, "wind"],
      [this.keys.FOUR, "earth"],
      [this.keys.FIVE, "metal"]
    ];

    for (const [key, element] of keyToElement) {
      if (!Phaser.Input.Keyboard.JustDown(key)) continue;
      if (nowMs < this.skillCooldownUntilMs[element]) continue;

      const tierUnlocked = this.progression.tierUnlocked[element];

      if (element === "earth" && tierUnlocked >= 1) {
        this.playerState.guardUntilMs = nowMs + (tierUnlocked >= 3 ? 1200 : 700);
      }

      const res = castElementSkill({
        scene: this,
        element,
        tierUnlocked,
        origin: new Phaser.Math.Vector2(this.player.x, this.player.y),
        aimDir: this.playerState.lastAim,
        enemies: this.enemies,
        nowMs
      });
      if (!res) {
        this.toast(`Chưa mở skill ${elementLabel(element)} (hãy hạ slime hệ đó)`, "#b8c0ff");
        continue;
      }
      this.skillCooldownUntilMs[element] = nowMs + res.cooldownMs;
    }
  }

  private handleSpawning(dtMs: number) {
    this.spawnTimerMs += dtMs;
    const spawnEvery = 650;
    while (this.spawnTimerMs >= spawnEvery) {
      this.spawnTimerMs -= spawnEvery;
      this.stageSpawnerTick();
    }
  }

  private getStageEnemyTarget(): number {
    const cfg = this.stages.find((s) => s.stage === this.stage)!;
    return cfg.stage === 6 ? 0 : cfg.enemies;
  }

  private stageSpawnerTick() {
    const cfg = this.stages.find((s) => s.stage === this.stage)!;

    // Stage 6: final boss only
    if (cfg.stage === 6) {
      if (!this.bossSpawned) {
        this.spawnBoss(cfg.element, true);
        this.bossSpawned = true;
        this.toast("Boss cuối xuất hiện!", "#ffffff");
      }
      return;
    }

    // If boss is spawned, stop spawning normal enemies
    if (this.bossSpawned) return;

    const alive = this.enemies.countActive(true);
    if (alive >= this.maxAliveEnemies) return;

    if (this.spawnedThisStage < cfg.enemies) {
      this.spawnEnemy(cfg.element);
      this.spawnedThisStage += 1;
      return;
    }

    // All have been spawned; when all are killed, spawn boss
    if (this.killedThisStage >= cfg.enemies) {
      this.spawnBoss(cfg.element, false);
      this.bossSpawned = true;
      this.toast(`Boss xuất hiện! (Màn ${this.stage})`, "#ffffff");
    }
  }

  private spawnEnemy(element: Element) {
    const margin = 70;
    const w = this.scale.width;
    const h = this.scale.height;
    const edge = Phaser.Math.Between(0, 3);
    let x = 0;
    let y = 0;
    if (edge === 0) {
      x = Phaser.Math.Between(margin, w - margin);
      y = margin;
    } else if (edge === 1) {
      x = w - margin;
      y = Phaser.Math.Between(margin, h - margin);
    } else if (edge === 2) {
      x = Phaser.Math.Between(margin, w - margin);
      y = h - margin;
    } else {
      x = margin;
      y = Phaser.Math.Between(margin, h - margin);
    }

    const e = this.enemies.create(x, y, "enemySlime") as EnemyState;
    e.setDepth(8);
    e.setTint(elementColor(element));
    e.element = element;
    e.isBoss = false;
    e.setScale(1);
    e.maxHp = 28 + this.progression.level * 4;
    e.hp = e.maxHp;
    e.setCollideWorldBounds(true);
    e.setDamping(true);
    e.setDrag(900, 900);
    e.setMaxVelocity(150, 150);

    // Enemy "home" behavior: stays near spawn, only aggro when player is close
    e.homeX = x;
    e.homeY = y;
    e.leashRadius = 110;
    e.aggroRadius = 190;
    e.wanderAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    e.nextWanderAtMs = this.time.now + Phaser.Math.Between(600, 1200);

    e.hpBar = this.add.graphics().setDepth(2000);
  }

  private spawnBoss(element: Element, isFinalBoss: boolean) {
    const w = this.scale.width;
    const h = this.scale.height;
    const x = w / 2;
    const y = 96;

    const e = this.enemies.create(x, y, "enemySlime") as EnemyState;
    e.setDepth(9);
    e.element = element;
    e.isBoss = true;
    e.setScale(isFinalBoss ? 2.1 : 1.8);
    e.setTint(isFinalBoss ? 0xffffff : elementColor(element));
    e.maxHp = isFinalBoss ? 1400 : 520 + this.stage * 140;
    e.hp = e.maxHp;
    e.setCollideWorldBounds(true);
    e.setDamping(true);
    e.setDrag(750, 750);
    e.setMaxVelocity(isFinalBoss ? 260 : 240, isFinalBoss ? 260 : 240);

    e.homeX = x;
    e.homeY = y;
    e.leashRadius = 260;
    e.aggroRadius = 9999;
    e.wanderAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    e.nextWanderAtMs = this.time.now + Phaser.Math.Between(500, 900);

    e.bossSpecialCdMs = 60_000;
    e.bossNextSpecialAtMs = this.time.now + 4_000;

    e.hpBar = this.add.graphics().setDepth(2000);
  }

  private handleEnemyAI(nowMs: number, dtMs: number) {
    const children = this.enemies.getChildren() as EnemyState[];
    for (const e of children) {
      const body = e.body as Phaser.Physics.Arcade.Body;
      const toPlayer = new Phaser.Math.Vector2(this.player.x - e.x, this.player.y - e.y);
      const distToPlayer = toPlayer.length();

      // Status effects
      const slow = e.slowUntilMs && nowMs < e.slowUntilMs ? 0.55 : 1;
      // Slower enemies overall
      const speedBase = 50 + this.progression.level * 0.5;
      const speed = speedBase * slow;

      const hasAggro = distToPlayer <= e.aggroRadius;

      // If not aggro: wander around home (leashed)
      if (!hasAggro) {
        if (nowMs >= e.nextWanderAtMs) {
          e.wanderAngle += Phaser.Math.FloatBetween(-1.2, 1.2);
          e.nextWanderAtMs = nowMs + Phaser.Math.Between(700, 1400);
        }
        const wanderPoint = new Phaser.Math.Vector2(
          e.homeX + Math.cos(e.wanderAngle) * e.leashRadius,
          e.homeY + Math.sin(e.wanderAngle) * e.leashRadius
        );
        const toWander = wanderPoint.subtract(new Phaser.Math.Vector2(e.x, e.y));
        const dist = Math.max(1, toWander.length());
        const dir = toWander.scale(1 / dist);

        // Gentle motion, feels like "standing around"
        const idleSpeed = Math.min(90, speed * 0.55);
        body.setAcceleration(dir.x * idleSpeed * 4, dir.y * idleSpeed * 4);
        continue;
      }

      // Aggro: chase & attack on contact (overlap)
      const dist = Math.max(1, distToPlayer);
      const dir = toPlayer.scale(1 / dist);

      // Boss special (once per 60s). Stage 6 boss can use all 5 boss specials.
      if (e.isBoss && e.bossSpecialCdMs && e.bossNextSpecialAtMs && nowMs >= e.bossNextSpecialAtMs) {
        const stageCfg = this.stages.find((s) => s.stage === this.stage)!;
        const isFinalBoss = stageCfg.stage === 6;

        if (isFinalBoss) {
          const order: Element[] = ["water", "fire", "wind", "earth", "metal"];
          const idx = Math.floor((nowMs / e.bossSpecialCdMs) % order.length);
          this.castBossSpecial(order[idx], nowMs, e.x, e.y);
        } else {
          this.castBossSpecial(e.element, nowMs, e.x, e.y);
        }

        e.bossNextSpecialAtMs = nowMs + e.bossSpecialCdMs;
      }

      // Different behavior per element (lightweight)
      if (e.element === "fire") {
        // charge
        body.setAcceleration(dir.x * speed * 7, dir.y * speed * 7);
      } else if (e.element === "wind") {
        // strafe a bit
        const strafe = new Phaser.Math.Vector2(-dir.y, dir.x).scale(Math.sin(nowMs / 300) * 0.35);
        body.setAcceleration((dir.x + strafe.x) * speed * 6, (dir.y + strafe.y) * speed * 6);
      } else if (e.element === "earth") {
        body.setAcceleration(dir.x * speed * 4.2, dir.y * speed * 4.2);
      } else if (e.element === "metal") {
        // pause/hard push
        const pulse = Math.sin(nowMs / 220) > 0.25 ? 1 : 0.2;
        body.setAcceleration(dir.x * speed * 5.5 * pulse, dir.y * speed * 5.5 * pulse);
      } else {
        // water: steady
        body.setAcceleration(dir.x * speed * 5, dir.y * speed * 5);
      }

      // keep slight separation
      const sep = 20;
      for (const other of children) {
        if (other === e) continue;
        const d2 = Phaser.Math.Distance.Between(e.x, e.y, other.x, other.y);
        if (d2 < sep) {
          const away = new Phaser.Math.Vector2(e.x - other.x, e.y - other.y).normalize().scale(90);
          body.velocity.x += away.x * (dtMs / 1000);
          body.velocity.y += away.y * (dtMs / 1000);
        }
      }
    }
  }

  private castBossSpecial(element: Element, nowMs: number, bossX: number, bossY: number) {
    const origin = new Phaser.Math.Vector2(bossX, bossY);
    const toPlayer = new Phaser.Math.Vector2(this.player.x - bossX, this.player.y - bossY);
    const aim = toPlayer.lengthSq() < 0.0001 ? new Phaser.Math.Vector2(1, 0) : toPlayer;

    // Telegraph
    const t = this.add
      .text(this.scale.width / 2, 90, `Boss dùng chiêu: ${elementLabel(element)}`, {
        fontFamily: "system-ui, Segoe UI, Arial",
        fontSize: "16px",
        color: "#ffffff"
      })
      .setOrigin(0.5)
      .setDepth(2600);
    this.time.delayedCall(1200, () => t.destroy());

    // Use the existing element-skill caster as boss specials (Tier 3 feel)
    castElementSkill({
      scene: this,
      element,
      tierUnlocked: 3,
      origin,
      aimDir: aim,
      enemies: this.enemies,
      nowMs
    });

    // Extra boss-only bite: small direct damage if player is too close (makes it scary)
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, origin.x, origin.y);
    if (d < 70) {
      this.playerState.hp -= 10;
      this.cameras.main.shake(80, 0.005);
    }
  }

  private handleDamageOverTime(nowMs: number) {
    const children = this.enemies.getChildren() as DamageableEnemy[];
    for (const e of children) {
      if (e.burningUntilMs && nowMs < e.burningUntilMs) {
        // tiny DOT tick
        if (Math.floor(nowMs / 220) !== Math.floor((nowMs - 16) / 220)) {
          e.hp -= 3;
        }
      }
    }
  }

  private cleanupDeadEnemies(nowMs: number) {
    const children = this.enemies.getChildren() as EnemyState[];
    for (const e of children) {
      if (e.hp > 0) continue;

      const element = e.element;
      const isBoss = e.isBoss === true;
      e.hpBar?.destroy();
      e.destroy();

      if (isBoss) {
        if (this.stage === 6) {
          this.toast("Bạn đã chiến thắng! (Màn cuối hoàn thành)", "#ffffff");
          this.time.delayedCall(2500, () => this.scene.restart());
          continue;
        }

        this.toast(`Hạ boss! Qua màn ${this.stage + 1}`, "#ffffff");
        this.stage = ((this.stage + 1) as 1 | 2 | 3 | 4 | 5 | 6);
        this.playerState.hp = this.playerState.maxHp;
        this.spawnedThisStage = 0;
        this.killedThisStage = 0;
        this.bossSpawned = false;
        this.pickups.clear(true, true);
        // Small reward
        gainExp(this.progression, 60);
      } else {
        this.killedThisStage += 1;
        gainExp(this.progression, 12);

        // Skill-orb drop: only in the stage element, and only if next tier exists.
        this.tryDropSkillOrb(element, e.x, e.y);
      }
    }
  }

  private tryDropSkillOrb(element: Element, x: number, y: number) {
    const cfg = this.stages.find((s) => s.stage === this.stage)!;
    if (cfg.element !== element) return;

    const current = this.progression.tierUnlocked[element];
    const nextTier = (Math.min(3, current + 1) as 1 | 2 | 3);
    if (current >= 3) return;

    // Chance: higher for first unlock, lower later
    const chance = current === 0 ? 0.35 : current === 1 ? 0.25 : 0.18;
    if (Math.random() > chance) return;

    const orb = this.pickups.create(Phaser.Math.Clamp(x, 70, this.scale.width - 70), Phaser.Math.Clamp(y, 70, this.scale.height - 70), "") as SkillOrb;
    orb.setDepth(1200);
    orb.element = element;
    orb.tier = nextTier;
    orb.setCircle(10);
    orb.setDisplaySize(20, 20);
    orb.setTint(elementColor(element));

    // Visual pulse
    this.tweens.add({
      targets: orb,
      alpha: 0.35,
      duration: 450,
      yoyo: true,
      repeat: -1
    });
  }

  private onPickupOrb(orb: SkillOrb) {
    const el = orb.element;
    const tier = orb.tier;

    if (this.progression.tierUnlocked[el] < tier) {
      this.progression.tierUnlocked[el] = tier;
      const name = getUnlockedSkillName(el, tier);
      this.toast(`Nhặt orb: mở ${name}`, "#ffffff");
    } else {
      this.toast("Orb này đã được mở rồi", "#b8c0ff");
    }

    orb.destroy();
  }

  private drawHpBars() {
    // Player bar
    const p = this.playerState;
    this.playerHpBar.clear();
    const pw = 52;
    const ph = 7;
    const px = this.player.x - pw / 2;
    const py = this.player.y - 38;
    this.playerHpBar.fillStyle(0x000000, 0.35);
    this.playerHpBar.fillRoundedRect(px - 1, py - 1, pw + 2, ph + 2, 3);
    this.playerHpBar.fillStyle(0x2bd052, 0.9);
    this.playerHpBar.fillRoundedRect(px, py, pw * Phaser.Math.Clamp(p.hp / p.maxHp, 0, 1), ph, 3);

    // Enemy bars
    const children = this.enemies.getChildren() as EnemyState[];
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

  private onPlayerHit(enemy: DamageableEnemy) {
    const nowMs = this.time.now;
    if (nowMs < this.playerState.invulnUntilMs) return;

    const inGuard = nowMs < this.playerState.guardUntilMs;
    const isBoss = (enemy as EnemyState).isBoss === true;
    const base = isBoss ? 18 : 12;
    const dmg = inGuard ? Math.max(4, Math.floor(base * 0.5)) : base;
    this.playerState.hp -= dmg;
    this.playerState.invulnUntilMs = nowMs + 420;

    // knockback
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const away = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y).normalize();
    body.velocity.x += away.x * 220;
    body.velocity.y += away.y * 220;

    this.cameras.main.shake(60, 0.004);
  }
}

