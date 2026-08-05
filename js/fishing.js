/* ═══════════ the fishing engine: scene, bobber, minigame, powers ═══════════ */
class Fishing {
    constructor(canvas, cb) {
        this.cv = canvas; this.cx = canvas.getContext('2d');
        this.cb = cb || {};
        this.t = 0; this.state = 'demo';
        this.theme = ROUNDS[0];
        this.stats = {
            barSize: 1, control: 1, gravity: 1, catchRate: 1, drain: 1, luck: 0,
            biteWindow: 1, fishSlow: 1, dart: 1, surge: 0, charm: 0,
            ghost: false, siren: false, attract: false
        };
        this.charSpecial = null; this.powerDef = null; this.charge = 0;
        this.mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
        this.shake = 0; this.flash = 0; this.paused = false; this.awaitingChoice = false;
        this.texts = []; this.parts = []; this.ripples = [];
        this.gauge = null; this.bobber = null; this.result = null;
        this.clouds = Array.from({ length: 6 }, () => ({ x: Math.random(), y: U.rand(.04, .3), s: U.rand(.6, 1.4), v: U.rand(4, 12) }));
        this.stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * .34, s: U.rand(.6, 2), tw: Math.random() * 6 }));
        this.seaweed = Array.from({ length: 5 }, () => ({ x: Math.random(), h: U.rand(46, 110), ph: Math.random() * 6 }));
        this.wildFish = []; this.spawnWild();
        this.rain = []; this.ice = []; this.fogB = []; this.embers = []; this.silhouette = null; this.silT = 6;
        this.lt = U.rand(3, 7);
        this.demoJump = { t: 2 };
        this.initWeather();
        this._bind();
        this.resize();
        addEventListener('resize', () => this.resize());
    }

    /* ---------- setup ---------- */
    resize() {
        const PIXEL_SCALE = 3; // game-pixels per screen-pixel. Higher = chunkier.
        this.pixelScale = PIXEL_SCALE;
        // Low internal resolution (e.g. 640×360 on a 1080p screen)
        this.W = Math.max(1, Math.floor(innerWidth / PIXEL_SCALE));
        this.H = Math.max(1, Math.floor(innerHeight / PIXEL_SCALE));
        this.cv.width = this.W;
        this.cv.height = this.H;
        // Scale back up via CSS to fill the screen
        this.cv.style.width = (this.W * PIXEL_SCALE) + 'px';
        this.cv.style.height = (this.H * PIXEL_SCALE) + 'px';
        // Must be set AFTER resizing (resize resets it) — keeps sprites crisp
        this.cx.imageSmoothingEnabled = false;
        this.waterline = this.H * .44;
    }

    toCanvasCoords(clientX, clientY) {
        const rect = this.cv.getBoundingClientRect();
        return {
            x: (clientX - rect.left) * (this.W / rect.width),
            y: (clientY - rect.top) * (this.H / rect.height)
        };
    }
    _bind() {
        this.cv.addEventListener('contextmenu', e => e.preventDefault());
        this.cv.addEventListener('pointerdown', e => {
            const p = this.toCanvasCoords(e.clientX, e.clientY);
            this.mouse.x = p.x; this.mouse.y = p.y;
            if (e.button === 2) { this.tryPower(); e.preventDefault(); return; }
            this.mouse.down = true;
            this.press(); e.preventDefault();
        });
        addEventListener('pointerup', () => { this.mouse.down = false; });
        addEventListener('pointermove', e => {
            const p = this.toCanvasCoords(e.clientX, e.clientY);
            this.mouse.x = p.x; this.mouse.y = p.y;
        });
    }
    setTheme(th) { this.theme = th; this.spawnWild(); this.initWeather(); }
    setStats(stats, char) {
        this.stats = stats;
        this.charSpecial = char.special || null;
        this.powerDef = char.power || null;
        this.charge = 0;
    }
    initWeather() {
        const sp = this.theme.special;
        this.rain = sp === 'storm' ? Array.from({ length: 90 }, () => ({ x: Math.random() * this.W, y: Math.random() * this.H, v: U.rand(480, 720) })) : [];
        this.ice = sp === 'ice' ? Array.from({ length: 6 }, () => ({ x: Math.random() * this.W, w: U.rand(40, 120), ph: Math.random() * 6, v: U.rand(3, 9) })) : [];
        this.fogB = sp === 'fog' ? Array.from({ length: 4 }, () => ({ x: Math.random() * this.W, y: U.rand(.3, .6) * this.H, r: U.rand(140, 260), v: U.rand(6, 14) })) : [];
        this.embers = sp === 'boss' ? Array.from({ length: 26 }, () => ({ x: Math.random() * this.W, y: Math.random() * this.H, v: U.rand(14, 40), ph: Math.random() * 6 })) : [];
    }
    spawnWild() {
        const pool = this.theme.fish.length ? this.theme.fish : [{ name: null, color: '#8fb3c9' }];
        this.wildFish = Array.from({ length: 5 }, () => {
            const sp = U.pick(pool);   // pick a full species (has .name + .color)
            return {
                x: Math.random() * this.W, baseY: U.rand(this.waterline + 50, this.H - 70),
                dir: U.chance(.5) ? 1 : -1, speed: U.rand(18, 46), size: U.rand(6, 12),
                col: sp.color, sp: sp, phase: Math.random() * 6
            };
        });
    }
    toDemo() { this.state = 'demo'; this.gauge = null; this.bobber = null; this.result = null; this.setTheme(ROUNDS[0]); }
    startFishing() { this.state = 'idle'; this.gauge = null; this.bobber = null; this.awaitingChoice = false; }
    readyNext() {
        this.awaitingChoice = false;   // blessing chosen — casting unlocked
        if (this.state === 'fanfare') this.fanT = Math.min(this.fanT, .25);
    }

    /* ---------- superpower ---------- */
    tryPower() {
        if (this.paused || this.state !== 'hooked' || this.charge < 100 || !this.powerDef) return false;
        this.charge = 0;
        const g = this.gauge, id = this.powerDef.id;
        AudioSys.sfx('power');
        this.shake = Math.max(this.shake, 3);
        switch (id) {
            case 'chrono': g.pFreeze = 2.2; break;
            case 'storm':
                g.fish.y = g.bar.y; g.fish.vy = 0; g.fish.vt = 0; g.fish.stun = .8;
                this.flash = .35; break;
            case 'kick':
                g.bar.y = U.clamp(g.fish.y, g.y + g.bar.h / 2, g.y + g.h - g.bar.h / 2);
                g.bar.vy = 0; break;
            case 'decree': g.pGrow = 3.5; break;
            case 'anchor': g.pAnchor = 4; break;
            case 'luck':
                g.prog = U.clamp(g.prog + .18, 0, 1);
                g.bonusCoins = (g.bonusCoins || 0) + 15;
                for (let i = 0; i < 10; i++) this.sparkle(g.x + g.w / 2, g.fish.y, '#9ff0c0');
                break;
        }
        this.floatText(`${this.powerDef.icon} ${this.powerDef.name}!`, '#9fe8db', g.x - 30, g.y + 10);
        return true;
    }

    /* ---------- input / states ---------- */
    press() {
        if (this.paused) return;
        if (this.awaitingChoice) return;   // must pick a blessing before casting again
        AudioSys.unlock();
        if (this.state === 'idle') this.cast();
        else if (this.state === 'wait') this.cast();
        else if (this.state === 'bite') this.hook();
    }
    cast() {
        this.state = 'cast'; this.castT = 0;
        this.from = { x: this.W * .16, y: this.H * .58 };
        this.target = { x: this.W * U.rand(.38, .58), y: 0 };
        AudioSys.sfx('cast');
    }
    hook() {
        const luck = this.stats.luck + (this.theme.luckMod || 0);
        const sp = (this.cb.getSpecies && this.cb.getSpecies()) || pickSpecies(this.theme, luck, this.charSpecial);
        const gh = this.H * .72, gw = 48, gx = this.W - 64 - gw, gy = this.H * .14;
        const r = U.clamp(13 * sp.size, 10, 46);
        const bh = U.clamp(gh * .17 * this.stats.barSize, 34, gh * .6);
        this.gauge = {
            x: gx, y: gy, w: gw, h: gh, sp, boss: !!sp.boss,
            fish: { y: gy + gh - bh / 2, vy: 0, vt: 0, retarget: U.rand(.6, .9), first: true, dartFx: 0, stun: 0, r },
            bar: { y: gy + gh - bh / 2, vy: 0, h: bh, h0: bh },
            prog: this.stats.surge, topProg: this.stats.surge, perfect: true, t: 0, burst: 0,
            pFreeze: 0, pGrow: 0, pAnchor: 0, bonusCoins: 0,
            enrage: sp.boss ? [.66, .33] : [], charm: this.stats.charm
        };
        this.bobber = null; this.state = 'hooked'; this.shake = 2.5;
        AudioSys.sfx('hook');
        if (this.cb.onHook) this.cb.onHook(sp);
    }
    catchFish() {
        const g = this.gauge;
        this.result = { sp: g.sp, perfect: g.perfect, boss: g.boss, escaped: false, bonusCoins: g.bonusCoins || 0 };
        this.state = 'fanfare'; this.fanT = 1.25;
        this.fanFrom = { x: g.x + g.w / 2, y: g.fish.y };
        for (let i = 0; i < 18; i++) this.sparkle(g.x + g.w / 2, g.fish.y, '#ffd257');
        this.shake = 3;
        this.charge = Math.min(100, this.charge + 30);
        AudioSys.sfx(g.perfect ? 'perfect' : 'catch');
        if (g.sp.rarity === 'legendary' || g.boss) AudioSys.sfx('legend');
        this.awaitingChoice = true;   // lock casting until a blessing is chosen
        if (this.cb.onCatch) this.cb.onCatch(this.result);
    }
    escapeFish() {
        const g = this.gauge;
        if (g.charm > 0) {
            g.charm--; g.prog = .3;
            this.floatText('🧿 the charm holds!', '#9fd0ff', g.x, g.y - 20);
            AudioSys.sfx('upgrade'); return;
        }
        this.result = { sp: g.sp, escaped: true };
        this.state = 'fanfare'; this.fanT = .9;
        this.fanFrom = { x: g.x + g.w / 2, y: g.fish.y };
        AudioSys.sfx('fail');
        if (this.cb.onEscape) this.cb.onEscape();
    }

    /* ---------- fx helpers ---------- */
    floatText(txt, col, x, y) { this.texts.push({ txt, col, x: x ?? this.W * .5, y: y ?? this.H * .4, t: 1.4 }); }
    splash(x, y, n = 14) {
        for (let i = 0; i < n; i++) this.parts.push({
            x, y, vx: U.rand(-130, 130), vy: U.rand(-260, -60),
            g: 640, life: U.rand(.4, .8), col: 'rgba(220,240,255,.9)', r: U.rand(1.5, 3.4)
        });
    }
    sparkle(x, y, col) {
        this.parts.push({
            x, y, vx: U.rand(-90, 90), vy: U.rand(-140, 20), g: -40,
            life: U.rand(.5, .9), col, r: U.rand(1.5, 3)
        });
    }

    /* ---------- update ---------- */
    update(dt) {
        this.t += dt;
        this.shake = Math.max(0, this.shake - dt * 16);
        if (this.flash > 0) this.flash -= dt * 2.5;

        const storm = this.theme.special === 'storm';
        for (const c of this.clouds) { c.x += c.v * dt / this.W * (storm ? 3 : 1); if (c.x > 1.2) c.x = -.2; }

        if (storm) {
            this.lt -= dt;
            if (this.lt <= 0) { this.flash = .85; this.lt = U.rand(4, 9); AudioSys.noise(.7, .1, 220); }
            for (const r of this.rain) {
                r.y += r.v * dt; r.x -= r.v * dt * .18;
                if (r.y > this.H) { r.y = -10; r.x = Math.random() * (this.W + 200); }
            }
        }
        if (this.theme.special === 'ice') for (const b of this.ice) { b.x += b.v * dt; if (b.x > this.W + 80) b.x = -120; }
        if (this.theme.special === 'fog') for (const f of this.fogB) { f.x += f.v * dt; if (f.x - f.r > this.W) f.x = -f.r; }
        if (this.theme.special === 'boss') for (const e of this.embers) { e.y -= e.v * dt; if (e.y < -10) { e.y = this.H + 10; e.x = Math.random() * this.W; } }
        if (this.theme.special === 'abyss') {
            this.silT -= dt;
            if (this.silT <= 0 && !this.silhouette) { this.silhouette = { x: -300, v: U.rand(40, 70) }; this.silT = U.rand(10, 16); }
            if (this.silhouette) { this.silhouette.x += this.silhouette.v * dt; if (this.silhouette.x > this.W + 400) this.silhouette = null; }
        }

        this.updateWild(dt);
        this.parts = this.parts.filter(p => (p.life -= dt) > 0);
        for (const p of this.parts) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
        this.texts = this.texts.filter(tx => (tx.t -= dt) > 0);
        for (const tx of this.texts) tx.y -= 34 * dt;
        this.ripples = this.ripples.filter(r => (r.life -= dt) > 0);
        for (const r of this.ripples) r.r += 60 * dt;

        switch (this.state) {
            case 'demo':
                this.demoJump.t -= dt;
                if (this.demoJump.t <= 0) {
                    this.demoJump = { t: U.rand(2.5, 5), x: U.rand(this.W * .2, this.W * .8), t0: 0, dur: .9 };
                    this.splash(this.demoJump.x, this.waterline, 8); AudioSys.sfx('splash');
                }
                if (this.demoJump.t0 !== undefined) {
                    this.demoJump.t0 += dt;
                    if (this.demoJump.t0 > this.demoJump.dur) { delete this.demoJump.t0; }
                }
                break;
            case 'cast': {
                this.castT += dt / .7;
                if (this.castT >= 1) {
                    const bx = this.target.x;
                    this.bobber = { x: bx, dip: 0 };
                    this.splash(bx, this.wy(bx)); AudioSys.sfx('splash');
                    this.ripples.push({ x: bx, y: this.wy(bx), r: 6, life: .8 });
                    this.state = 'wait';
                    this.waitTimer = U.rand(this.theme.bite[0], this.theme.bite[1]);
                    this.nibbleT = U.rand(1.2, 2.4);
                }
                break;
            }
            case 'wait':
                this.waitTimer -= dt; this.nibbleT -= dt;
                this.bobber.dip = 0;
                if (this.nibbleT <= 0) {
                    this.nibbleT = U.rand(1.2, 2.4);
                    if (this.waitTimer > .8) {
                        this.bobber.dip = 3; AudioSys.sfx('nibble');
                        this.ripples.push({ x: this.bobber.x, y: this.wy(this.bobber.x), r: 4, life: .5 });
                    }
                }
                if (this.waitTimer <= 0) {
                    this.state = 'bite';
                    this.biteT = .95 * this.stats.biteWindow * (this.theme.special === 'boss' ? .75 : 1);
                    AudioSys.sfx('bite');
                }
                break;
            case 'bite':
                this.biteT -= dt;
                if (this.biteT <= 0) {
                    this.state = 'idle'; this.bobber = null;
                    this.floatText('…it swam off.', '#9fb6c9');
                    if (this.cb.onMiss) this.cb.onMiss();
                }
                break;
            case 'hooked': this.updateGauge(dt); break;
            case 'fanfare':
                this.fanT -= dt;
                if (this.fanT <= 0) { this.state = 'idle'; this.gauge = null; this.result = null; }
                break;
        }
    }
    updateWild(dt) {
        for (let i = 0; i < this.wildFish.length; i++) {
            const f = this.wildFish[i];
            f.phase += dt * 2;
            let tx = null;
            if ((this.state === 'wait' || this.state === 'bite') && i === 0 && this.bobber) tx = this.bobber.x - 26 * f.dir;
            if (tx !== null) { f.x += (tx - f.x) * Math.min(1, dt * .9); }
            else {
                f.x += f.dir * f.speed * dt;
                if (f.x < -40 || f.x > this.W + 40) {
                    f.dir *= -1; f.baseY = U.rand(this.waterline + 50, this.H - 70);
                    f.x = U.clamp(f.x, -40, this.W + 40);
                }
            }
        }
    }
    updateGauge(dt) {
        const g = this.gauge, th = this.theme, s = this.stats, fish = g.fish;
        g.t += dt;
        if (g.burst > 0) g.burst -= dt;
        if (g.pFreeze > 0) g.pFreeze -= dt;
        if (g.pGrow > 0) g.pGrow -= dt;
        if (g.pAnchor > 0) g.pAnchor -= dt;
        if (fish.stun > 0) fish.stun -= dt;

        const frozen = g.pFreeze > 0, stunned = fish.stun > 0;
        // fish eases into full speed over the first ~2.2s of the fight
        const ramp = .3 + .7 * U.clamp(g.t / 2.2, 0, 1);

        // ── fish AI ──
        if (!frozen && !stunned) {
            fish.retarget -= dt;
            if (fish.retarget <= 0) {
                if (fish.first) { fish.vt = -this.fishMaxV() * U.rand(.5, .85); fish.first = false; }
                else fish.vt = U.rand(-1, 1) * this.fishMaxV();
                fish.retarget = U.rand(.55, 1.35);
            }
            if (g.t > 1.8 && Math.random() < dt * .4 * s.dart * th.dart) {
                fish.vt = U.sign(Math.random() - .5) * this.fishMaxV() * 1.6;
                fish.dartFx = .25; this.shake = Math.max(this.shake, 2);
            }
            fish.dartFx = Math.max(0, fish.dartFx - dt);
            if (s.siren && Math.abs(fish.y - g.bar.y) < g.bar.h) {
                const barMovingToward = Math.sign(g.bar.vy) === Math.sign(fish.y - g.bar.y);
                if (barMovingToward) fish.vt *= .75; // 25% slow instead of 55%
            }
            if (s.attract) fish.vt += Math.sign(g.bar.y - fish.y) * dt * 130;
            fish.vy += (fish.vt - fish.vy) * Math.min(1, dt * 4);
            const speedMul = s.fishSlow * th.fishSpeed * g.sp.speed * (g.burst > 0 ? 1.75 : 1);
            fish.y += fish.vy * dt * speedMul * ramp;
            const top = g.y + fish.r, bot = g.y + g.h - fish.r;
            if (fish.y < top) { fish.y = top; fish.vy = Math.abs(fish.vy); }
            if (fish.y > bot) { fish.y = bot; fish.vy = -Math.abs(fish.vy); }
        }

        // ── boss enrage ──
        if (g.boss && g.enrage.length && g.prog < g.enrage[0]) {
            g.enrage.shift(); g.burst = 1.6; this.shake = 9;
            AudioSys.sfx('boss');
            this.floatText('IT RAGES!', '#ff6a5a', g.x - 40, g.y + 30);
        }

        // ── bar physics ──
        g.bar.h = g.bar.h0 * (g.pGrow > 0 ? 1.8 : 1);
        const anch = g.pAnchor > 0 ? .35 : 1;
        const acc = g.h * 3.8 * s.control * (th.controlMod || 1);
        const grav = g.h * 2.2 * s.gravity * (th.gravityMod || 1) * anch;
        if (this.mouse.down) g.bar.vy -= acc * dt; else g.bar.vy += grav * dt;
        g.bar.vy = U.clamp(g.bar.vy, -g.h * 1.05, g.h * 1.05);
        g.bar.y += g.bar.vy * dt;
        const bTop = g.y + g.bar.h / 2, bBot = g.y + g.h - g.bar.h / 2;
        if (g.bar.y < bTop) { g.bar.y = bTop; g.bar.vy = 0; }
        if (g.bar.y > bBot) { g.bar.y = bBot; g.bar.vy = 0; }

        // ── progress ──
        const half = g.bar.h / 2 + fish.r * .35;
        const inBar = Math.abs(fish.y - g.bar.y) <= half;
        if (inBar) {
            g.prog += dt * .24 * s.catchRate * (g.boss ? .62 : 1);
            this.charge = Math.min(100, this.charge + 26 * dt); // power charge
            if (Math.random() < dt * 8) this.sparkle(g.x + g.w / 2, fish.y, '#9ff0c0');
        } else {
            const drainRamp = g.t < .8 ? 0 : U.clamp((g.t - .8) / 1.2, .4, 1);
            g.prog -= dt * .13 * s.drain * (th.drainMod || 1) * (g.boss ? 1.35 : 1) * drainRamp * (g.pAnchor > 0 ? .35 : 1);
            if (g.t > 1.0) g.perfect = false;
        }
        if (s.ghost && g.prog < .08) g.prog = .08;
        g.prog = U.clamp(g.prog, 0, 1);
        g.topProg = Math.max(g.topProg, g.prog);
        if (g.prog >= 1) this.catchFish();
        else if (g.prog <= 0 && (g.topProg > .02 || g.t > 3)) this.escapeFish();
    }
    fishMaxV() { return this.gauge.h * (.42 + .4 * this.gauge.sp.speed); }

    /* ═══════════ DRAW ═══════════ */
    wy(px) {
        const amp = this.theme.special === 'storm' ? 5 : 2.4;
        return this.waterline + Math.sin(px * .011 + this.t * 1.4) * amp + Math.sin(px * .023 - this.t * .9) * amp * .5;
    }
    rr(x, px, py, w, h, r) {
        x.beginPath();
        x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r);
        x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
    }
    draw() {
        const x = this.cx, W = this.W, H = this.H, th = this.theme;
        x.save();
        if (this.shake > 0 && !this.paused) x.translate((Math.random() - .5) * this.shake * 2, (Math.random() - .5) * this.shake * 2);

        const sky = x.createLinearGradient(0, 0, 0, this.waterline);
        sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
        x.fillStyle = sky; x.fillRect(-24, -24, W + 48, this.waterline + 40);
        if (th.stars) {
            x.fillStyle = '#fff';
            for (const st of this.stars) {
                x.globalAlpha = .3 + .6 * Math.abs(Math.sin(this.t * 1.4 + st.tw));
                x.fillRect(st.x * W, st.y * H, st.s, st.s);
            } x.globalAlpha = 1;
        }
        if (th.sun) this.drawCelestial(x);
        this.drawClouds(x);
        this.drawBackdrop(x);
        this.drawWater(x);
        this.drawUnder(x);
        this.drawRodLine(x);
        this.drawWeather(x);
        if (this.gauge && this.state === 'hooked') this.drawGauge(x);
        this.drawFanfare(x);
        this.drawParticles(x);
        this.drawTexts(x);
        if (this.state === 'hooked') this.drawCursor(x);
        if (this.state === 'idle' && this.cb.playing) this.drawCastHint(x);
        if (this.flash > 0) { x.fillStyle = `rgba(255,255,255,${this.flash * .6})`; x.fillRect(-24, -24, W + 48, H + 48); }
        x.restore();
    }
    drawCelestial(x) {
        const s = this.theme.sun, px = s.x * this.W, py = s.y * this.waterline;
        const g = x.createRadialGradient(px, py, 4, px, py, s.r * 3);
        g.addColorStop(0, s.c); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(px - s.r * 3, py - s.r * 3, s.r * 6, s.r * 6);
        x.fillStyle = s.c; x.beginPath(); x.arc(px, py, s.r, 0, 7); x.fill();
        if (s.moon) { x.fillStyle = this.theme.sky[0]; x.beginPath(); x.arc(px + s.r * .4, py - s.r * .28, s.r * .82, 0, 7); x.fill(); }
    }
    drawClouds(x) {
        const cs = ENV_SPRITES.clouds;
        // Use sprite only on clear-sky themes (special === null); keep procedural for storm/night/etc.
        if (cs && Assets.has(cs.key) && this.theme.special === null) {
            const img = Assets.get(cs.key);
            x.save();
            x.imageSmoothingEnabled = false;
            this.clouds.forEach((c, i) => {
                const px = c.x * this.W, py = c.y * this.waterline;
                const frame = i % cs.frames;
                const sx = frame * cs.frameW;
                const w = cs.frameW * c.s, h = cs.frameH * c.s;
                x.drawImage(img, sx, 0, cs.frameW, cs.frameH, px - w / 2, py - h / 2, w, h);
            });
            x.restore();
            return;
        }
        // procedural fallback
        x.fillStyle = this.theme.special === 'storm' ? 'rgba(30,38,50,.8)' : 'rgba(255,255,255,.75)';
        for (const c of this.clouds) {
            const px = c.x * this.W, py = c.y * this.waterline;
            x.beginPath();
            x.ellipse(px, py, 46 * c.s, 15 * c.s, 0, 0, 7);
            x.ellipse(px + 30 * c.s, py - 8 * c.s, 30 * c.s, 12 * c.s, 0, 0, 7);
            x.ellipse(px - 32 * c.s, py - 4 * c.s, 26 * c.s, 10 * c.s, 0, 0, 7);
            x.fill();
        }
    }
    hillFar(px) { return this.waterline - (30 + 28 * Math.sin(px * .004 + 1.7) + 18 * Math.sin(px * .011)); }
    hillNear(px) { return this.waterline - (10 + 22 * Math.sin(px * .006 + 4.2) + 12 * Math.sin(px * .017 + 1)); }
    drawBackdrop(x) {
        const W = this.W, th = this.theme;
        const hs = ENV_SPRITES.hills;
        const useHills = hs && Assets.has(hs.key) && th.name === 'Meadow Pond';

        // ── Hills ──
        if (useHills) {
            const img = Assets.get(hs.key);
            const hillsH = hs.worldH;                 // controlled height, not the image's
            const baseY = this.waterline + 2;         // hills base sits on the waterline
            x.save();
            x.imageSmoothingEnabled = false;
            x.drawImage(img, 0, 0, hs.frameW, hs.frameH, 0, baseY - hillsH, W, hillsH);
            x.restore();
        } else {
            x.fillStyle = th.hills[0]; x.beginPath(); x.moveTo(-10, this.waterline + 4);
            for (let i = -10; i <= W + 10; i += 20) x.lineTo(i, this.hillFar(i));
            x.lineTo(W + 10, this.waterline + 4); x.closePath(); x.fill();
            x.fillStyle = th.hills[1]; x.beginPath(); x.moveTo(-10, this.waterline + 6);
            for (let i = -10; i <= W + 10; i += 20) x.lineTo(i, this.hillNear(i));
            x.lineTo(W + 10, this.waterline + 6); x.closePath(); x.fill();
        }

        // ── Trees ──
        if (th.trees) {
            const ts = ENV_SPRITES.tree;
            if (ts && Assets.has(ts.key)) {
                const img = Assets.get(ts.key);
                const tw = ts.worldH * (ts.frameW / ts.frameH);
                const thh = ts.worldH;
                x.save();
                x.imageSmoothingEnabled = false;
                for (const fx of [.08, .16, .55, .86]) {
                    const px = fx * W;
                    // On the pixel-art hills: fixed baseline near the water (+ tiny variation).
                    // On procedural hills: follow the hillNear curve.
                    const py = useHills
                        ? this.waterline - hs.treeBase + Math.sin(fx * 26) * 3
                        : this.hillNear(px) + 2;
                    const frame = Math.floor((this.t + fx * 7) * ts.fps) % ts.frames;
                    const sx = frame * ts.frameW;
                    x.drawImage(img, sx, 0, ts.frameW, ts.frameH, px - tw / 2, py - thh, tw, thh);
                }
                x.restore();
            } else {
                x.fillStyle = 'rgba(0,0,0,.28)';
                for (const fx of [.08, .16, .55, .86]) {
                    const px = fx * W, py = this.hillNear(px) + 2;
                    x.beginPath(); x.moveTo(px, py - 34); x.lineTo(px - 11, py); x.lineTo(px + 11, py); x.closePath(); x.fill();
                    x.fillRect(px - 2, py, 4, 6);
                }
            }
        }

        // ── Grotto stalactites ──
        if (th.special === 'grotto') {
            x.fillStyle = '#04211e';
            for (const fx of [.1, .3, .52, .72, .9]) {
                const px = fx * W, len = 40 + 70 * Math.sin(fx * 40);
                x.beginPath(); x.moveTo(px - 22, 0); x.lineTo(px + 22, 0); x.lineTo(px, len); x.closePath(); x.fill();
            }
        }
    }
    drawWater(x) {
        const W = this.W, H = this.H, th = this.theme;
        x.beginPath(); x.moveTo(-12, H + 12); x.lineTo(-12, this.wy(-12));
        for (let i = -12; i <= W + 12; i += 16) x.lineTo(i, this.wy(i));
        x.lineTo(W + 12, H + 12); x.closePath();
        const g = x.createLinearGradient(0, this.waterline - 20, 0, H);
        g.addColorStop(0, th.water[0]); g.addColorStop(1, th.water[1]);
        x.fillStyle = g; x.fill();
        x.beginPath();
        for (let i = -12; i <= W + 12; i += 16) { const y = this.wy(i); i < 0 ? x.moveTo(i, y) : x.lineTo(i, y); }
        x.strokeStyle = 'rgba(255,255,255,.32)'; x.lineWidth = 2; x.stroke();
        x.save(); x.globalAlpha = .05; x.fillStyle = '#fff';
        for (let i = 0; i < 3; i++) {
            const px = ((this.t * 14 + i * W / 3) % (W + 200)) - 100;
            x.beginPath(); x.moveTo(px, this.waterline); x.lineTo(px + 60, this.waterline);
            x.lineTo(px + 10, H); x.lineTo(px - 40, H); x.closePath(); x.fill();
        }
        x.restore();
        for (const r of this.ripples) {
            x.strokeStyle = `rgba(255,255,255,${r.life * .5})`; x.lineWidth = 2;
            x.beginPath(); x.ellipse(r.x, r.y, r.r, r.r * .3, 0, 0, 7); x.stroke();
        }
    }
    drawUnder(x) {
        const H = this.H, th = this.theme;
        x.strokeStyle = 'rgba(10,60,45,.4)'; x.lineWidth = 4;
        for (const sw of this.seaweed) {
            const px = sw.x * this.W;
            x.beginPath(); x.moveTo(px, H);
            x.quadraticCurveTo(px + Math.sin(this.t * 1.3 + sw.ph) * 14, H - sw.h * .6,
                px + Math.sin(this.t * 1.7 + sw.ph) * 22, H - sw.h);
            x.stroke();
        }
        for (const f of this.wildFish) {
            x.globalAlpha = th.special === 'fog' ? .22 : .5;
            this.drawFishSpecies(x, f.sp, f.x, f.baseY + Math.sin(f.phase) * 8, f.size, f.dir, Math.sin(f.phase) * .08);
            x.globalAlpha = 1;
        }
        if (th.special === 'grotto') {
            for (let i = 0; i < 12; i++) {
                const a = .25 + .5 * Math.abs(Math.sin(this.t * 2 + i * 1.7));
                x.fillStyle = `rgba(120,255,230,${a})`;
                x.beginPath(); x.arc((i * 173) % this.W, this.waterline + 40 + (i * 97) % (H - this.waterline - 80), 2.4, 0, 7); x.fill();
            }
        }
        if (th.special === 'abyss' && this.silhouette) {
            x.fillStyle = 'rgba(2,6,14,.5)';
            const sx = this.silhouette.x, sy = this.waterline + (H - this.waterline) * .5;
            x.beginPath(); x.ellipse(sx, sy, 190, 46, 0, 0, 7); x.fill();
            x.beginPath(); x.moveTo(sx - 180, sy); x.lineTo(sx - 260, sy - 34); x.lineTo(sx - 260, sy + 34); x.closePath(); x.fill();
        }
    }
    drawRodLine(x) {
        const tip = { x: this.W * .16, y: this.H * .58 };
        x.strokeStyle = '#5d3a1a'; x.lineWidth = 5; x.lineCap = 'round';
        x.beginPath(); x.moveTo(this.W * .05, this.H * .88);
        x.quadraticCurveTo(this.W * .09, this.H * .72, tip.x, tip.y); x.stroke();
        x.strokeStyle = '#3a2410'; x.lineWidth = 2;
        x.beginPath(); x.moveTo(this.W * .05, this.H * .88);
        x.quadraticCurveTo(this.W * .09, this.H * .72, tip.x, tip.y); x.stroke();

        if (this.state === 'cast') {
            const t = Math.min(1, this.castT);
            const px = U.lerp(this.from.x, this.target.x, t);
            const py = U.lerp(this.from.y, this.wy(this.target.x), t) - Math.sin(Math.PI * t) * 120;
            x.strokeStyle = 'rgba(240,240,240,.7)'; x.lineWidth = 1.5;
            x.beginPath(); x.moveTo(tip.x, tip.y); x.quadraticCurveTo((tip.x + px) / 2, Math.min(tip.y, py) + 30, px, py); x.stroke();
            this.drawBobberAt(x, px, py);
        } else if (this.bobber && (this.state === 'wait' || this.state === 'bite')) {
            const bx = this.bobber.x;
            const dip = this.state === 'bite' ? 9 : this.bobber.dip;
            const by = this.wy(bx) + dip + Math.sin(this.t * 3) * 1.2;
            x.strokeStyle = 'rgba(240,240,240,.7)'; x.lineWidth = 1.5;
            x.beginPath(); x.moveTo(tip.x, tip.y);
            x.quadraticCurveTo((tip.x + bx) / 2, Math.max(tip.y, by) + 34, bx, by - 8); x.stroke();
            this.drawBobberAt(x, bx, by);
            if (this.state === 'bite') {
                const bounce = Math.sin(this.t * 18) * 4;
                x.fillStyle = '#e2574c'; x.strokeStyle = '#f6e7c1'; x.lineWidth = 3;
                x.beginPath(); x.arc(bx, by - 46 + bounce, 15, 0, 7); x.fill(); x.stroke();
                x.fillStyle = '#fff'; x.font = '700 20px "Pixelify Sans"'; x.textAlign = 'center';
                x.fillText('!', bx, by - 39 + bounce);
            }
        }
    }
    drawBobberAt(x, px, py) {
        x.fillStyle = '#e2574c'; x.beginPath(); x.arc(px, py, 9, Math.PI, 0); x.fill();
        x.fillStyle = '#f6e7c1'; x.beginPath(); x.arc(px, py, 9, 0, Math.PI); x.fill();
        x.strokeStyle = '#241708'; x.lineWidth = 2; x.beginPath(); x.arc(px, py, 9, 0, 7); x.stroke();
        x.fillStyle = '#241708'; x.fillRect(px - 1.2, py - 14, 2.4, 6);
    }
    drawWeather(x) {
        const th = this.theme, W = this.W, H = this.H;
        if (th.special === 'storm') {
            x.strokeStyle = 'rgba(200,220,240,.4)'; x.lineWidth = 1.5;
            x.beginPath();
            for (const r of this.rain) { x.moveTo(r.x, r.y); x.lineTo(r.x - 5, r.y + 16); }
            x.stroke();
        }
        if (th.special === 'ice') {
            x.fillStyle = '#eef6fc'; x.strokeStyle = '#9fc4dc'; x.lineWidth = 2;
            for (const b of this.ice) {
                const py = this.wy(b.x) - 4 + Math.sin(this.t * 1.6 + b.ph) * 2;
                this.rr(x, b.x, py - 7, b.w, 13, 5); x.fill(); x.stroke();
            }
        }
        if (th.special === 'fog') {
            for (const f of this.fogB) {
                const g = x.createRadialGradient(f.x, f.y, 10, f.x, f.y, f.r);
                g.addColorStop(0, 'rgba(230,238,238,.16)'); g.addColorStop(1, 'rgba(230,238,238,0)');
                x.fillStyle = g; x.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
            }
        }
        if (th.special === 'night') {
            x.fillStyle = 'rgba(6,10,34,.42)'; x.fillRect(0, 0, W, H);
            if (this.bobber) {
                x.save(); x.globalCompositeOperation = 'lighter';
                const g = x.createRadialGradient(this.bobber.x, this.wy(this.bobber.x), 8, this.bobber.x, this.wy(this.bobber.x), 150);
                g.addColorStop(0, 'rgba(255,190,90,.30)'); g.addColorStop(1, 'rgba(255,190,90,0)');
                x.fillStyle = g; x.fillRect(this.bobber.x - 160, this.wy(this.bobber.x) - 160, 320, 320);
                x.restore();
            }
        }
        if (th.special === 'abyss') {
            const g = x.createLinearGradient(0, this.waterline, 0, H);
            g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
            x.fillStyle = g; x.fillRect(0, this.waterline, W, H);
        }
        if (th.special === 'boss') {
            for (const e of this.embers) {
                x.fillStyle = `rgba(255,${90 + Math.sin(e.ph + this.t * 3) * 40 | 0},60,.55)`;
                x.fillRect(e.x + Math.sin(e.ph + this.t) * 8, e.y, 2.6, 2.6);
            }
            const pulse = .12 + .08 * Math.sin(this.t * 2.2);
            const g = x.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .8);
            g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(160,10,20,${pulse})`);
            x.fillStyle = g; x.fillRect(0, 0, W, H);
        }
    }
    fishShape(x, px, py, r, col, dir, tilt) {
        x.save(); x.translate(px, py); x.rotate(tilt || 0); x.scale(dir || 1, 1);
        x.fillStyle = col;
        x.beginPath(); x.moveTo(-r * 1.05, 0); x.lineTo(-r * 1.85, -r * .7); x.lineTo(-r * 1.85, r * .7); x.closePath(); x.fill();
        x.beginPath(); x.ellipse(0, 0, r * 1.25, r * .8, 0, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.25)';
        x.beginPath(); x.ellipse(r * .1, r * .28, r * .9, r * .42, 0, 0, 7); x.fill();
        x.fillStyle = 'rgba(0,0,0,.22)';
        x.beginPath(); x.moveTo(-r * .2, -r * .7); x.lineTo(r * .3, -r * 1.15); x.lineTo(r * .55, -r * .6); x.closePath(); x.fill();
        x.fillStyle = '#fff'; x.beginPath(); x.arc(r * .65, -r * .2, r * .22, 0, 7); x.fill();
        x.fillStyle = '#141414'; x.beginPath(); x.arc(r * .72, -r * .2, r * .11, 0, 7); x.fill();
        x.restore();
    }
    // Draws a sprite if available, otherwise falls back to procedural fishShape
    drawFishSpecies(ctx, sp, px, py, r, dir, tilt) {
        const spriteKey = SPECIES_SPRITES[sp.name];
        if (spriteKey && Assets.has(spriteKey)) {
            const img = Assets.get(spriteKey);
            const cfg = SPRITE_DEFAULTS;
            // time-based frame loop (all fish animate smoothly)
            const frame = Math.floor(this.t * cfg.fps) % cfg.frames;
            const sx = frame * cfg.frameW;
            const size = r * 3; // draw size relative to fish radius

            ctx.save();
            ctx.imageSmoothingEnabled = false; // keep pixels crisp
            ctx.translate(px, py);
            if (tilt) ctx.rotate(tilt);
            ctx.scale(-dir, 1); // flip based on direction
            ctx.drawImage(img, sx, 0, cfg.frameW, cfg.frameH, -size / 2, -size / 2, size, size);
            ctx.restore();
            return;
        }
        // Fallback: procedural drawing (for fish without sprites yet)
        this.fishShape(ctx, px, py, r, sp.color, dir, tilt);
    }
    drawGauge(x) {
        const g = this.gauge;
        let frame = g.boss ? '#ff5a48' : '#e8d9a8';
        if (g.pFreeze > 0) frame = '#9fe8ff';
        else if (g.pGrow > 0) frame = '#ffd257';
        else if (g.pAnchor > 0) frame = '#8fd3ff';

        x.fillStyle = 'rgba(8,12,18,.6)'; this.rr(x, g.x - 12, g.y - 12, g.w + 24, g.h + 24, 12); x.fill();
        x.strokeStyle = frame; x.lineWidth = 3;
        this.rr(x, g.x - 12, g.y - 12, g.w + 24, g.h + 24, 12); x.stroke();
        x.fillStyle = '#0d2233'; this.rr(x, g.x, g.y, g.w, g.h, 8); x.fill();
        if (g.pFreeze > 0) { x.fillStyle = 'rgba(159,232,255,.14)'; this.rr(x, g.x, g.y, g.w, g.h, 8); x.fill(); }

        x.save(); x.beginPath(); this.rr(x, g.x - 8, g.y - 8, g.w + 16, g.h + 16, 10); x.clip();
        x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1;
        for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(g.x, g.y + g.h * i / 8); x.lineTo(g.x + g.w, g.y + g.h * i / 8); x.stroke(); }
        const bh = g.bar.h, by = g.bar.y - bh / 2;
        const bg = x.createLinearGradient(0, by, 0, by + bh);
        bg.addColorStop(0, '#ffd257'); bg.addColorStop(1, '#c9791f');
        x.fillStyle = bg; this.rr(x, g.x + 5, by, g.w - 10, bh, 7); x.fill();
        x.strokeStyle = '#3a2410'; x.lineWidth = 2.5; this.rr(x, g.x + 5, by, g.w - 10, bh, 7); x.stroke();
        x.fillStyle = 'rgba(255,255,255,.35)'; this.rr(x, g.x + 8, by + 4, g.w - 16, 5, 3); x.fill();
        if (g.fish.dartFx > 0) { x.shadowColor = '#fff'; x.shadowBlur = 14; }
        if (g.sp.rarity === 'epic' || g.sp.rarity === 'legendary') { x.shadowColor = RARITIES[g.sp.rarity].color; x.shadowBlur = 18; }
        this.drawFishSpecies(x, g.sp, g.x + g.w / 2, g.fish.y, g.fish.r, -1,
            U.clamp(g.fish.vy * .0006, -.5, .5));
        x.shadowBlur = 0;
        if (g.boss) {
            x.fillStyle = '#ffcf5c';
            const fx = g.x + g.w / 2, fy = g.fish.y;
            for (let i = -2; i <= 2; i++) {
                x.beginPath(); x.moveTo(fx + i * 10 - 4, fy - g.fish.r * .75);
                x.lineTo(fx + i * 10, fy - g.fish.r * .75 - 10); x.lineTo(fx + i * 10 + 4, fy - g.fish.r * .75); x.closePath(); x.fill();
            }
        }
        x.restore();

        const ph = (g.h - 6) * g.prog;
        x.fillStyle = g.prog >= 1 ? '#ffd257' : '#7fe37f';
        this.rr(x, g.x + 3, g.y + g.h - 3 - ph, 7, Math.max(2, ph), 3); x.fill();
        if (g.perfect && g.t > .5) {
            x.fillStyle = '#ffd257'; x.font = '700 22px "Pixelify Sans"'; x.textAlign = 'center';
            x.globalAlpha = .7 + .3 * Math.sin(this.t * 6);
            x.fillText('★', g.x + g.w / 2, g.y - 20); x.globalAlpha = 1;
        }
        x.textAlign = 'center';
        x.font = '700 13px "Pixelify Sans"';
        x.fillStyle = g.boss ? '#ff8a7a' : '#e8d9a8';
        x.fillText(g.boss ? '☠ ' + g.sp.name : g.sp.name, g.x + g.w / 2, g.y - (g.perfect && g.t > .5 ? 38 : 22));
        if (g.t < 2.4) {
            x.fillStyle = 'rgba(246,231,193,.85)'; x.font = '600 12px "Pixelify Sans"';
            x.fillText('HOLD to rise · RELEASE to sink', g.x + g.w / 2, g.y + g.h + 26);
        }
    }
    drawFanfare(x) {
        if (!this.result) return;
        const sp = this.result.sp;
        if (this.result.escaped) {
            const k = 1 - this.fanT / .9;
            x.globalAlpha = 1 - k;
            this.fishShape(x, this.fanFrom.x, this.fanFrom.y + k * k * 340, 13 * sp.size, sp.color, 1, .8);
            x.globalAlpha = 1;
            return;
        }
        const k = 1 - this.fanT / 1.25;
        const px = U.lerp(this.fanFrom.x, this.W * .5, k);
        const py = U.lerp(this.fanFrom.y, this.H * .3, k) - Math.sin(Math.PI * k) * 110;
        x.save();
        if (sp.rarity === 'epic' || sp.rarity === 'legendary') { x.shadowColor = RARITIES[sp.rarity].color; x.shadowBlur = 26; }
        this.drawFishSpecies(x, sp, px, py, 13 * sp.size * 1.15, 1, Math.sin(k * 9) * .35);
        x.restore();
        if (Math.random() < .4) this.sparkle(px, py, '#ffd257');
        x.textAlign = 'center'; x.font = '700 20px "Pixelify Sans"';
        x.fillStyle = RARITIES[sp.rarity].color; x.globalAlpha = Math.min(1, k * 2);
        x.fillText(sp.name, this.W * .5, this.H * .24);
        x.globalAlpha = 1;
    }
    drawParticles(x) {
        for (const p of this.parts) {
            x.globalAlpha = U.clamp(p.life * 2, 0, 1);
            x.fillStyle = p.col; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill();
        }
        x.globalAlpha = 1;
    }
    drawTexts(x) {
        x.textAlign = 'center'; x.font = '700 19px "Pixelify Sans"';
        for (const tx of this.texts) {
            x.globalAlpha = U.clamp(tx.t, 0, 1);
            x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 4; x.strokeText(tx.txt, tx.x, tx.y);
            x.fillStyle = tx.col; x.fillText(tx.txt, tx.x, tx.y);
        }
        x.globalAlpha = 1;
    }
    drawCursor(x) {
        x.strokeStyle = 'rgba(246,231,193,.85)'; x.lineWidth = 2;
        x.beginPath(); x.arc(this.mouse.x, this.mouse.y, 10, 0, 7); x.stroke();
        x.fillStyle = 'rgba(246,231,193,.85)';
        x.beginPath(); x.arc(this.mouse.x, this.mouse.y, 2, 0, 7); x.fill();
    }
    drawCastHint(x) {
        const py = this.waterline - 46 + Math.sin(this.t * 3) * 5;
        x.textAlign = 'center'; x.font = '700 18px "Pixelify Sans"';
        x.strokeStyle = 'rgba(0,0,0,.65)'; x.lineWidth = 4;
        x.strokeText('CLICK TO CAST', this.W * .47, py);
        x.fillStyle = '#ffe9b3'; x.fillText('CLICK TO CAST', this.W * .47, py);
        this.drawBobberAt(x, this.W * .47, this.wy(this.W * .47));
    }
}