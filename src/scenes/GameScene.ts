import Phaser from "phaser";
import type { Element } from "../data/element";
import { ELEMENTS, elementColor, elementLabel } from "../data/element";
import { createProgression, gainExp } from "../data/progression";
import type { DamageableEnemy } from "../data/skills";
import { castElementSkill, getUnlockedSkillName } from "../data/skills";
import { globalData, resetRun } from "../data/globalData";
import { playSound } from "../systems/AudioSystem";
import { HUD } from "../ui/HUD";

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
  isHopping?: boolean;
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
  isHopping?: boolean;
};

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  public player!: Phaser.Physics.Arcade.Sprite;
  public playerState!: PlayerState;
  
  public enemies!: Phaser.Physics.Arcade.Group;
  public walls!: Phaser.Physics.Arcade.StaticGroup;
  public projectiles!: Phaser.Physics.Arcade.Group;
  public pickups!: Phaser.Physics.Arcade.Group;
  private spawnTimerMs = 0;

  public progression = createProgression();
  private skillCooldownUntilMs: Record<Element, number> = { water: 0, fire: 0, wind: 0, earth: 0, metal: 0 };

  public stage = 1 as 1 | 2 | 3 | 4 | 5 | 6;
  public spawnedThisStage = 0;
  public killedThisStage = 0;
  public bossSpawned = false;
  private readonly enemiesPerStage = 10;
  private readonly maxAliveEnemies = 12;

  public readonly stages: StageConfig[] = [
    { stage: 1, element: "water", enemies: 10 },
    { stage: 2, element: "fire", enemies: 10 },
    { stage: 3, element: "wind", enemies: 10 },
    { stage: 4, element: "earth", enemies: 10 },
    { stage: 5, element: "metal", enemies: 10 },
    { stage: 6, element: "metal", enemies: 0, finalBoss: true }
  ];

  public ui!: import("../ui/HUD").HUD;

  private audioCtx?: AudioContext;

  constructor() {
    super({ key: "GameScene" });
  }

  init(data: any) {
    if (data && data.stage) {
      this.stage = data.stage;
    }
  }

  create(data: any) {
    this.progression = globalData.progression; // Persist across stages
    
    if (!data.resume) {
        // We only reset local scene stats, not global stats
        this.skillCooldownUntilMs = { water: 0, fire: 0, wind: 0, earth: 0, metal: 0 };
    }
    
    this.spawnTimerMs = 0;
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

    // Pause functionality
    this.input.keyboard!.on('keydown-ESC', () => {
        this.scene.pause();
        this.scene.launch("PauseScene");
    });

    this.createTextures();
    this.createArena();
    this.createPlayer();
    this.createEnemies();
    this.createProjectiles();
    this.createPickups();
    this.ui = new HUD(this);

    this.physics.add.overlap(this.player, this.enemies, (_, e) => this.onPlayerHit(e as DamageableEnemy));
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.enemies, this.walls);
  }

  private createTextures() {
    // Player slime texture (made white to support skin tinting)
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(24, 24, 22);
    g.fillStyle(0xdddddd, 0.35);
    g.fillEllipse(18, 30, 18, 10);
    g.generateTexture("playerSlime", 48, 48);
    g.clear();

    // Bullet texture (white circle for tinting)
    g.fillStyle(0xffffff, 1);
    g.fillCircle(5, 5, 5);
    g.generateTexture("bullet", 10, 10);
    g.clear();

    // Enemy slime base; color tint per element
    g.fillStyle(0xffffff, 1);
    g.fillCircle(20, 20, 18);
    g.fillStyle(0x000000, 0.08);
    g.fillEllipse(15, 25, 16, 9);
    g.generateTexture("enemySlime", 40, 40);
    g.clear();

    // Particle texture for jump dust
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture("particle", 8, 8);
    g.destroy();
  }

  private createArena() {
    const w = this.scale.width;
    const h = this.scale.height;

    const stageCfg = this.stages.find((s) => s.stage === this.stage);
    const element = stageCfg ? stageCfg.element : "water";
    
    const bgColors: Record<string, { outer: number, inner: number, stroke: number }> = {
        water: { outer: 0x0b1320, inner: 0x1a2e50, stroke: 0x2a5080 },
        fire:  { outer: 0x200b0b, inner: 0x501a1a, stroke: 0x802a2a },
        wind:  { outer: 0x0b201d, inner: 0x1a504a, stroke: 0x2a8076 },
        earth: { outer: 0x1b140b, inner: 0x4a361a, stroke: 0x80622a },
        metal: { outer: 0x111115, inner: 0x3a3a45, stroke: 0x6a6a75 },
    };
    
    // Boss stage 6 uses metal logic or its own dark red scheme
    const color = this.stage === 6 ? { outer: 0x050505, inner: 0x151515, stroke: 0xff3333 } : bgColors[element];

    const bg = this.add.graphics();
    bg.fillStyle(color.outer, 1);
    bg.fillRect(0, 0, w, h);
    bg.fillStyle(color.inner, 1);
    bg.fillRoundedRect(28, 28, w - 56, h - 56, 18);
    bg.lineStyle(2, color.stroke, 0.4);
    bg.strokeRoundedRect(28, 28, w - 56, h - 56, 18);
    bg.setDepth(-10);

    // World bounds
    this.physics.world.setBounds(40, 40, w - 80, h - 80);
    this.physics.world.on('worldbounds', (body: Phaser.Physics.Arcade.Body) => {
      if (body.gameObject && this.projectiles.contains(body.gameObject as Phaser.GameObjects.GameObject)) {
          body.gameObject.destroy();
      }
    });

    // Simple map: a few static obstacles (board)
    this.walls = this.physics.add.staticGroup();
    const addWall = (x: number, y: number, ww: number, hh: number) => {
      const r = this.add.rectangle(x, y, ww, hh, color.stroke, 1).setDepth(-5);
      r.setStrokeStyle(2, 0xffffff, 0.1);
      this.physics.add.existing(r, true);
      this.walls.add(r);
    };

    // Layout based on stage element
    const cx = w / 2;
    const cy = h / 2;
    
    if (this.stage === 6) {
        // Boss arena: wide open with corner pillars
        addWall(cx - 300, cy - 200, 60, 60);
        addWall(cx + 300, cy - 200, 60, 60);
        addWall(cx - 300, cy + 200, 60, 60);
        addWall(cx + 300, cy + 200, 60, 60);
    } else if (element === "water") {
        // Water: a cross in the middle
        addWall(cx, cy, 200, 40);
        addWall(cx, cy, 40, 200);
    } else if (element === "fire") {
        // Fire: two long horizontal walls
        addWall(cx, cy - 150, 400, 30);
        addWall(cx, cy + 150, 400, 30);
    } else if (element === "wind") {
        // Wind: scattered square blocks
        addWall(cx - 200, cy - 100, 80, 80);
        addWall(cx + 200, cy + 100, 80, 80);
        addWall(cx + 200, cy - 100, 80, 80);
        addWall(cx - 200, cy + 100, 80, 80);
        addWall(cx, cy, 60, 60);
    } else if (element === "earth") {
        // Earth: bulky center and side walls
        addWall(cx, cy, 180, 180);
        addWall(cx - 350, cy, 60, 250);
        addWall(cx + 350, cy, 60, 250);
    } else if (element === "metal") {
        // Metal: symmetrical "arena" pattern
        addWall(cx, cy, 180, 26);
        addWall(cx, cy - 120, 26, 160);
        addWall(cx, cy + 120, 26, 160);
        addWall(cx - 260, cy, 140, 26);
        addWall(cx + 260, cy, 140, 26);
    } else {
        addWall(cx, cy, 100, 100);
    }
  }

  private createPlayer() {
    this.player = this.physics.add.sprite(this.scale.width / 2, this.scale.height / 2, "playerSlime");
    this.player.setDepth(10);
    this.player.setCollideWorldBounds(true);
    
    // Apply skin color
    const skinColors = [0x65ff7a, 0xff4d4d, 0x4d94ff, 0xffe066];
    this.player.setTint(skinColors[globalData.settings.playerSkin] || 0x65ff7a);

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
      guardUntilMs: 0,
      isHopping: false
    };
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

  update(_: number, dtMs: number) {
    const nowMs = this.time.now;
    globalData.totalTimeMs += dtMs;

    this.handleMovement(nowMs);
    this.handleAttack(nowMs);
    this.handleMelee(nowMs);
    this.handleSkills(nowMs);
    this.handleEnemyAI(nowMs, dtMs);
    this.handleSpawning(dtMs);
    this.handleDamageOverTime(nowMs);
    this.cleanupDeadEnemies(nowMs);
    
    this.ui.update();

    if (this.playerState.hp <= 0 && this.player.active) {
      this.playerState.hp = 1; // Prevent multiple triggers
      this.player.setActive(false);
      this.player.setVisible(false);
      this.ui.showToast("BẠN ĐÃ BỊ HẠ GỤC!", "#ff4d4d");
      this.time.delayedCall(2500, () => {
          resetRun(); // Reset all global stats (kills, time, cleared stages, progression)
          this.scene.start("MenuScene"); // Go back to main menu
      });
    }
  }

  private handleMovement(nowMs: number) {
    if (!this.player.active) return;
    
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;

    const input = new Phaser.Math.Vector2((right ? 1 : 0) - (left ? 1 : 0), (down ? 1 : 0) - (up ? 1 : 0));
    const isDashing = nowMs < this.playerState.dashUntilMs;

    if (input.lengthSq() > 0.01) {
      input.normalize();
      this.playerState.lastAim = input.clone();

      if (!this.playerState.isHopping && !isDashing) {
        this.playerState.isHopping = true;
        this.playHopEffect();
      }
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;

    const speed = isDashing ? 520 : this.playerState.baseSpeed;
    body.setAcceleration(0, 0);
    body.setVelocity(input.x * speed, input.y * speed);

    if (Phaser.Input.Keyboard.JustDown(this.keys.SHIFT) && nowMs >= this.playerState.dashCooldownUntilMs) {
      this.playerState.dashUntilMs = nowMs + 160;
      this.playerState.dashCooldownUntilMs = nowMs + 850;
      body.velocity.x += this.playerState.lastAim.x * 260;
      body.velocity.y += this.playerState.lastAim.y * 260;
      
      // Cancel hop if dashing
      this.tweens.killTweensOf(this.player);
      this.player.setScale(1, 1);
      this.playerState.isHopping = false;
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

  private playHopEffect() {
    if (!this.player || !this.player.active) return;
    
    playSound('jump');

    this.tweens.add({
      targets: this.player,
      scaleY: 1.25,
      scaleX: 0.75,
      yoyo: true,
      duration: 120,
      onComplete: () => {
        if (this.player && this.player.active) {
            this.emitJumpParticles();
            this.tweens.add({
               targets: this.player,
               scaleX: 1.15,
               scaleY: 0.85,
               yoyo: true,
               duration: 80,
               onComplete: () => {
                   this.playerState.isHopping = false;
               }
            });
        } else {
            this.playerState.isHopping = false;
        }
      }
    });
  }

  private emitJumpParticles() {
    const particles = this.add.particles(this.player.x, this.player.y + 16, 'particle', {
      speed: { min: 15, max: 40 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 300,
      blendMode: 'ADD',
      tint: 0x65ff7a,
      quantity: 4,
      emitting: false
    });
    particles.explode();
    this.time.delayedCall(400, () => particles.destroy());
  }

  private playEnemyHopEffect(enemy: EnemyState) {
    if (!enemy || !enemy.active || enemy.hp <= 0) return;
    
    const baseScale = enemy.isBoss ? (this.stage === 6 ? 2.1 : 1.8) : 1;

    const distToPlayer = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
    if (distToPlayer < 450) {
        playSound('jump', 0.2);
    }

    this.tweens.add({
      targets: enemy,
      scaleY: baseScale * 1.25,
      scaleX: baseScale * 0.75,
      yoyo: true,
      duration: 130,
      onComplete: () => {
        if (enemy && enemy.active && enemy.hp > 0) {
            this.emitEnemyJumpParticles(enemy, baseScale);
            this.tweens.add({
               targets: enemy,
               scaleX: baseScale * 1.15,
               scaleY: baseScale * 0.85,
               yoyo: true,
               duration: 90,
               onComplete: () => {
                   enemy.isHopping = false;
               }
            });
        } else {
            if (enemy && enemy.active) enemy.isHopping = false;
        }
      }
    });
  }

  private emitEnemyJumpParticles(enemy: EnemyState, scale: number) {
    if (!enemy || !enemy.active) return;
    const particles = this.add.particles(enemy.x, enemy.y + (16 * scale), 'particle', {
      speed: { min: 10 * scale, max: 30 * scale },
      angle: { min: 0, max: 360 },
      scale: { start: scale * 0.8, end: 0 },
      alpha: { start: 0.4, end: 0 },
      lifespan: 300,
      blendMode: 'ADD',
      tint: elementColor(enemy.element),
      quantity: enemy.isBoss ? 6 : 3,
      emitting: false
    });
    particles.explode();
    this.time.delayedCall(400, () => particles.destroy());
  }

  private attackCooldownUntilMs = 0;
  private meleeCooldownUntilMs = 0;

  private handleAttack(nowMs: number) {
    if (!this.player.active) return;
    if (!Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) return;
    if (nowMs < this.attackCooldownUntilMs) return;
    this.attackCooldownUntilMs = nowMs + 240;

    const dir = this.playerState.lastAim.clone().normalize();
    const origin = new Phaser.Math.Vector2(this.player.x, this.player.y).add(dir.clone().scale(28));

    // Use a physics sprite in the `projectiles` group so wall-collision is reliable
    const bullet = this.projectiles.create(origin.x, origin.y, "bullet") as Phaser.Physics.Arcade.Image;
    bullet.setDepth(900);
    
    const skinColors = [0x65ff7a, 0xff4d4d, 0x4d94ff, 0xffe066];
    const playerColor = skinColors[globalData.settings.playerSkin] || 0x65ff7a;
    bullet.setTint(playerColor);
    
    bullet.setCircle(5);
    bullet.setDisplaySize(10, 10);
    bullet.setCollideWorldBounds(true);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.onWorldBounds = true;
    body.setAllowGravity(false);
    body.setVelocity(dir.x * 400, dir.y * 400);

    playSound('shoot');

    this.physics.add.overlap(bullet, this.enemies, (_, e) => {
      const enemy = e as EnemyState;
      playSound(enemy.isBoss ? 'bossHit' : 'hit');
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
    if (!this.player.active) return;
    if (!Phaser.Input.Keyboard.JustDown(this.keys.F)) return;
    if (nowMs < this.meleeCooldownUntilMs) return;
    this.meleeCooldownUntilMs = nowMs + 800;

    const dir = this.playerState.lastAim.clone().normalize();
    const origin = new Phaser.Math.Vector2(this.player.x, this.player.y).add(dir.clone().scale(26));

    const skinColors = [0x65ff7a, 0xff4d4d, 0x4d94ff, 0xffe066];
    const playerColor = skinColors[globalData.settings.playerSkin] || 0x65ff7a;
    const hitbox = this.add.rectangle(origin.x, origin.y, 74, 54, playerColor, 0.08).setDepth(950);
    hitbox.setStrokeStyle(2, 0xffffff, 0.12);
    this.physics.add.existing(hitbox, true);

    playSound('melee');

    this.physics.add.overlap(hitbox, this.enemies, () => {}, (_, e) => {
      const enemy = e as EnemyState;
      playSound(enemy.isBoss ? 'bossHit' : 'hit');
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
    if (!this.player.active) return;
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

      const cost = tierUnlocked * 10; // Tier 1: 10 EXP, Tier 2: 20 EXP, Tier 3: 30 EXP
      if (this.progression.exp < cost) {
          this.ui.showToast(`Không đủ EXP để dùng ${elementLabel(element)} (cần ${cost} EXP)`, "#ff4d4d");
          continue;
      }

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
        this.ui.showToast(`Chưa mở skill ${elementLabel(element)} (hãy hạ slime hệ đó)`, "#b8c0ff");
        continue;
      }
      
      // Deduct EXP
      this.progression.exp -= cost;
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

  public getStageEnemyTarget(): number {
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
        this.ui.showToast("Boss cuối xuất hiện!", "#ffffff");
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
      this.ui.showToast(`Boss xuất hiện! (Màn ${this.stage})`, "#ffffff");
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

      // Check for hopping
      if (!e.isHopping && body.velocity.lengthSq() > 400) {
          e.isHopping = true;
          this.playEnemyHopEffect(e);
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
        const stageCfg = this.stages.find((s) => s.stage === this.stage)!;
        if (this.stage !== 6 && !globalData.clearedStages.includes(stageCfg.element)) {
            globalData.clearedStages.push(stageCfg.element);
        }
        globalData.activeStage = null; // Clear active save

        if (this.stage === 6) {
          this.ui.showToast("CHÚC MỪNG BẠN ĐÃ PHÁ ĐẢO!", "#ffffff");
          this.time.delayedCall(3500, () => this.scene.start("MenuScene"));
          continue;
        }

        this.ui.showToast(`Đã vượt qua màn ${elementLabel(stageCfg.element)}!`, "#ffffff");
        this.time.delayedCall(2500, () => {
            this.scene.start("LevelSelectScene");
        });
      } else {
        this.killedThisStage += 1;
        globalData.totalKills += 1;
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
      this.ui.showToast(`Nhặt orb: mở ${name}`, "#ffffff");
    } else {
      this.ui.showToast("Orb này đã được mở rồi", "#b8c0ff");
    }

    orb.destroy();
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

