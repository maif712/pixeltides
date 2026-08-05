/* ═══════════ orchestration: screens, rounds, score, daily, dex ═══════════ */
const Loading = {
    show() { U.el('screen-loading').classList.remove('hidden'); },
    hide() { U.el('screen-loading').classList.add('hidden'); },
    status(text) { U.el('loading-status').textContent = text; },
    progress(pct) { U.el('loading-fill').style.width = U.clamp(pct, 0, 100) + '%'; }
};

const MEDAL_TXT = ['—', '🥇 Gold', '🥈 Silver', '🥉 Bronze'];

const Game = {
    run: null, engine: null, playing: false, toastTimer: null, last: 0,
    _origRand: null,

    async init() {
        this.engine = new Fishing(U.el('scene'), {
            onCatch: r => this.onCatch(r),
            onEscape: () => this.onEscape(),
            onMiss: () => { },
            onHook: sp => this.onHook(sp),
            getSpecies: () => this.getSpecies(),
            playing: false
        });
        Auth.init();
        this.bindUI();

        Shop.data = Shop.defaults();
        requestAnimationFrame(t => this.loop(t));

        // Show loading immediately — no flash of other screens
        Loading.show();
        Loading.status('Loading assets…');
        Loading.progress(5);

        // Preload all sprites before gameplay
        await Assets.loadAll(SPRITE_MANIFEST, (progress) => {
            Loading.progress(5 + progress * 25); // assets use 5%–30% of the bar
        });

        Loading.status('Checking session…');
        Loading.progress(35);

        try {
            const user = await DB.init();
            if (user) {
                Loading.status('Loading your save…');
                Loading.progress(45);
                await this.onAuthSuccess();
            } else {
                Loading.progress(100);
                Loading.hide();
                Auth.show();
            }
        } catch (err) {
            console.error('Startup failed:', err);
            Loading.status('Connection failed. Please refresh.');
        }
    },

    async onAuthSuccess() {
        Loading.status('Loading your catches…');
        Loading.progress(70);
        await Shop.load();

        Loading.progress(100);
        Loading.status('Ready!');
        // Short pause so the bar visibly completes before fading out
        setTimeout(() => {
            Loading.hide();
            this.show('screen-title');
            Shop.renderTitle();
        }, 400);
    },
    loop(now) {
        const dt = Math.min(.033, (now - this.last) / 1000 || .016);
        this.last = now;
        if (!this.engine.paused) this.engine.update(dt);
        this.engine.draw();
        if (this.playing && this.run && !this.engine.paused) this.run.roundTime += dt;
        if (this.playing) this.syncPower();
        requestAnimationFrame(t => this.loop(t));
    },

    /* ---------- screens ---------- */
    show(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        if (id) U.el(id).classList.remove('hidden');
    },
    toast(msg, ms = 2000) {
        const t = U.el('toast');
        t.innerHTML = msg; t.classList.add('show');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
    },
    setPlaying(on) {
        this.playing = on;
        this.engine.cb.playing = on;
        document.body.classList.toggle('playing', on);
        U.el('hud').classList.toggle('hidden', !on);
    },

    /* ---------- seeded daily ---------- */
    enterSeed(str) { this._origRand = Math.random; Math.random = mulberry32(hashStr(str)); },
    exitSeed() { if (this._origRand) { Math.random = this._origRand; this._origRand = null; } },

    /* ---------- run / rounds ---------- */
    startRun(daily = false) {
        AudioSys.sfx('click');
        const char = Shop.selectedChar();
        Upgrades.reset();
        const ds = new Date().toISOString().slice(0, 10);
        if (daily) this.enterSeed(ds);
        this.run = {
            round: 0, coins: 0, bait: 0, quotaGot: 0, fishCount: 0, perfects: 0,
            roundCatches: [], roundCoins: 0, cleared: 0, banked: false, ended: false,
            score: 0, streak: 0, roundScore: 0, roundTime: 0, daily,
            char, stats: Upgrades.computeStats(char.id)
        };
        this.run.bait = this.run.stats.bait;
        this.engine.setStats(this.run.stats, char);
        this.startRound(0);
    },
    startRound(i) {
        const th = ROUNDS[i];
        this.run.round = i; this.run.quotaGot = 0; this.run.roundCoins = 0;
        this.run.roundCatches = []; this.run.roundScore = 0;
        this.engine.setTheme(th);
        this.engine.startFishing();
        U.el('intro-num').textContent = `ROUND ${i + 1} / ${ROUNDS.length}` + (this.run.daily ? '  ·  🎲 DAILY' : '');
        U.el('intro-name').textContent = th.name;
        U.el('intro-sub').textContent = th.sub;
        U.el('intro-mods').innerHTML = th.mods.map(m => `<span>${m}</span>`).join('');
        const m = Shop.data.medals[i];
        U.el('intro-medal').textContent = m ? `Best medal here: ${MEDAL_TXT[m]}` : '🏅 No medal yet — beat the clock!';
        const pw = this.run.char.power;
        U.el('intro-power').innerHTML = `⚡ <b>${pw.icon} ${pw.name}</b> — ${pw.desc} &nbsp;·&nbsp; right-click or F`;
        U.el('intro-go').textContent = i === ROUNDS.length - 1 ? 'ENTER THE LAIR ⚠' : 'CAST OFF →';
        U.el('round-card').style.setProperty('--acc', th.water[0]);
        this.setPlaying(false);
        this.show('screen-intro');
    },
    beginRound() {
        AudioSys.sfx('click');
        this.show(null);
        this.setPlaying(true);
        this.run.roundTime = 0;
        this.updateHUD();
        const th = ROUNDS[this.run.round];
        this.toast(th.special === 'boss' ? '☠ Something enormous stirs below…' : `🎣 ${th.name} — cast away!`);
    },
    getSpecies() {
        const r = this.run, th = ROUNDS[r.round];
        if (th.special !== 'boss') return null;
        const order = ['herald', 'herald', 'boss'];
        return order[r.quotaGot] === 'boss' ? BOSS_FISH : HERALD;
    },
    onHook(sp) {
        const rc = RARITIES[sp.rarity];
        if (sp.boss) {
            this.toast(`⚠ <b style="color:${rc.color}">${sp.name}</b> SURFACES!`, 2600);
            AudioSys.sfx('boss'); this.engine.shake = 8;
        } else {
            this.toast(`Hooked: <b style="color:${rc.color}">${sp.name}</b> · ${rc.name}`, 1400);
        }
    },

    /* ---------- catch / escape / score ---------- */
    async onCatch(res) {
        const r = this.run, th = ROUNDS[r.round], s = r.stats;

        // Fish-dex via Supabase
        const isFirst = await Shop.incrementFishDex(res.sp.name);
        if (isFirst) {
            r.coins += 30;
            this.toast(`📖 New species: <b style="color:${RARITIES[res.sp.rarity].color}">${res.sp.name}</b> +30🪙`, 2400);
            AudioSys.sfx('discover');
        }

        let coins = Math.round(res.sp.coins * (1 + r.round * .12) * s.coinMult * (th.coinMod || 1) * (res.perfect ? s.perfectMult : 1));
        const twinHit = !res.sp.boss && Math.random() < s.twin;
        if (twinHit) coins *= 2;
        coins += res.bonusCoins || 0;
        r.coins += coins;
        r.roundCoins += coins;
        r.quotaGot++;
        r.fishCount++;
        if (res.perfect) r.perfects++;
        r.roundCatches.push(res.sp);

        const combo = 1 + Math.min(8, r.streak) * .25;
        let gain = Math.round(res.sp.coins * SCORE_RARITY[res.sp.rarity] * (res.perfect ? 1.5 : 1) * combo * (1 + r.round * .08));
        if (res.boss) gain *= 2;
        r.score += gain;
        r.roundScore += gain;
        if (res.perfect) r.streak++;
        else r.streak = 0;

        this.engine.floatText(`+${coins} 🪙`, '#ffd257', this.W * .5, this.H * .36);
        if (res.perfect) this.engine.floatText('PERFECT!', '#9ff0c0', this.W * .5, this.H * .36 + 28);
        this.engine.floatText(`+${gain} ⭐${combo > 1 ? ' ×' + combo.toFixed(2) : ''}`, '#9fd0ff', this.W * .5, this.H * .36 + 56);
        AudioSys.sfx('coin');
        if (twinHit) this.toast('🪝 Twin Hook — double haul!');
        this.updateHUD();
        if (res.boss) {
            setTimeout(() => this.endRun(true), 1100);
            return;
        }
        setTimeout(() => this.showUpgrades(), 800);
    },
    onEscape() {
        const r = this.run;
        r.bait--; r.streak = 0;
        this.updateHUD();
        if (r.bait <= 0) { setTimeout(() => this.endRun(false), 900); }
        else this.toast('It slipped away… −1 🪱');
    },

    /* ---------- upgrade draft ---------- */
    showUpgrades() {
        const r = this.run, th = ROUNDS[r.round];
        this.draftChoices = Upgrades.roll(r.stats.luck + (th.luckMod || 0), r.char.special);
        this.renderDraft();
        U.el('overlay-upgrades').classList.remove('hidden');
    },
    renderDraft() {
        const box = U.el('up-cards');
        box.innerHTML = '';
        this.draftChoices.forEach((d, i) => {
            const lvl = Upgrades.owned[d.id] || 0;
            const card = document.createElement('div');
            card.className = `up-card r-${d.rarity}`;
            card.style.animationDelay = (i * .09) + 's';
            card.innerHTML = `
        <div class="up-icon">${d.icon}</div>
        <div class="rarity-pill">${RARITIES[d.rarity].name}</div>
        <div class="up-name">${d.name}</div>
        <div class="up-desc">${d.desc}</div>
        <div class="up-lvl">${d.gift ? 'GIFT' : `Lv ${lvl + 1} / ${d.max}`}</div>`;
            card.onclick = () => this.pickUpgrade(d);
            box.appendChild(card);
        });
        U.el('up-reroll').style.visibility = this.run.coins >= 40 ? 'visible' : 'hidden';
    },
    pickUpgrade(d) {
        const r = this.run;
        if (d.gift) { r.coins += d.gift; }
        else {
            const oldBait = r.stats.bait;
            Upgrades.owned[d.id] = (Upgrades.owned[d.id] || 0) + 1;
            r.stats = Upgrades.computeStats(r.char.id);
            const gained = r.stats.bait - oldBait;
            if (gained > 0) r.bait += gained;
            this.engine.setStats(r.stats, r.char);
            this.engine.charge = Math.min(100, this.engine.charge); // keep charge, stats refreshed
        }
        AudioSys.sfx('upgrade');
        U.el('overlay-upgrades').classList.add('hidden');
        this.toast(`${d.icon} ${d.name} — blessed!`, 1500);
        this.updateHUD();
        this.afterUpgradePicked();
    },
    reroll() {
        if (this.run.coins < 40) return;
        this.run.coins -= 40; AudioSys.sfx('coin'); this.updateHUD();
        const th = ROUNDS[this.run.round];
        this.draftChoices = Upgrades.roll(this.run.stats.luck + (th.luckMod || 0), this.run.char.special);
        this.renderDraft();
    },
    afterUpgradePicked() {
        const r = this.run, th = ROUNDS[r.round];
        this.engine.readyNext();
        if (r.quotaGot >= th.quota) setTimeout(() => this.roundClear(), 350);
    },

    /* ---------- medals & round clear ---------- */
    medalFor(th, t) {
        const q = th.quota, i = this.run.round;
        let gT = q * 13 + i * 4, sT = q * 19 + i * 6, bT = q * 28 + i * 8;
        if (th.special === 'boss') { gT += 30; sT += 30; bT += 30; }
        if (t <= gT) return 1;
        if (t <= sT) return 2;
        if (t <= bT) return 3;
        return 0;
    },
    async roundClear() {
        const r = this.run, th = ROUNDS[r.round];
        r.cleared = r.round + 1;
        const t = r.roundTime;
        const medal = this.medalFor(th, t);

        if (medal) {
            await Shop.saveMedal(r.round, medal);
            AudioSys.sfx('legend');
        } else {
            AudioSys.sfx('upgrade');
        }

        const bonus = Math.round((r.round + 1) * 15 * r.stats.coinMult);
        r.coins += bonus;
        r.roundCoins += bonus;
        r.bait = Math.min(r.stats.bait, r.bait + 1);

        U.el('sum-title').textContent = `Round ${r.round + 1} Clear!`;
        let html = r.roundCatches.map(sp =>
            `<div class="sum-row"><span class="fish-name" style="color:${RARITIES[sp.rarity].color}">🐟 ${sp.name}</span>
       <span>${RARITIES[sp.rarity].name}</span></div>`).join('');
        html += `<div class="sum-total"><span>⏱ Time</span><span>${t.toFixed(1)}s — ${MEDAL_TXT[medal]}</span></div>`;
        html += `<div class="sum-total"><span>⭐ Round score</span><span>${r.roundScore.toLocaleString()}</span></div>`;
        html += `<div class="sum-total"><span>Round haul</span><span>🪙 ${r.roundCoins} (incl. +${bonus} bonus)</span></div>`;
        html += `<div class="sum-total"><span>Worm mended</span><span>🪱 +1</span></div>`;
        U.el('sum-body').innerHTML = html;
        U.el('btn-next').textContent = r.round === ROUNDS.length - 2 ? 'ENTER THE LAIR ⚠' : 'NEXT WATERS →';
        this.setPlaying(false);
        this.show('screen-summary');
        this.updateHUD();
    },
    nextRound() { AudioSys.sfx('click'); this.startRound(this.run.round + 1); },

    /* ---------- end of run ---------- */
    async endRun(win) {
        const r = this.run;
        if (!r || r.ended) return;
        r.ended = true;
        this.exitSeed();

        if (!r.banked) {
            await Shop.addCoins(r.coins);
            r.banked = true;
        }
        Shop.data.best = Math.max(Shop.data.best, r.cleared);

        // Submit to leaderboard
        await DB.submitRun({
            score: r.score,
            rounds_cleared: r.cleared,
            character: r.char.icon + ' ' + r.char.name,
            fish_count: r.fishCount,
            perfects: r.perfects,
            mode: r.daily ? 'daily' : 'run'
        });

        // Submit daily score if applicable
        if (r.daily) {
            const date = new Date().toISOString().slice(0, 10);
            await DB.submitDailyScore(date, r.score);
        }

        if (r.score > Shop.data.bestScore) Shop.data.bestScore = r.score;
        await Shop.save();

        this.setPlaying(false);
        this.engine.paused = false;
        U.el('overlay-pause').classList.add('hidden');
        U.el('end-icon').textContent = win ? '🏆' : '💀';
        U.el('end-title').textContent = win ? 'THE LEVIATHAN FALLS!' : 'THE TIDE CLAIMS YOUR LINE';
        U.el('end-sub').textContent = win
            ? 'Ten waters conquered. The sea will sing your name.'
            : `You sank in Round ${r.round + 1} — ${ROUNDS[r.round].name}. The worms remember.`;
        U.el('end-stats').innerHTML = `
      <div><span>⭐ Final score</span><b>${r.score.toLocaleString()}</b></div>
      <div><span>🔥 Best streak stat</span><b>${r.perfects} perfects</b></div>
      <div><span>Fish caught</span><b>${r.fishCount}</b></div>
      <div><span>Coins banked</span><b>🪙 ${r.coins}</b></div>
      <div><span>Rounds cleared</span><b>${r.cleared} / ${ROUNDS.length}</b></div>
      <div><span>Angler</span><b>${r.char.icon} ${r.char.name}</b></div>`;
        this.engine.toDemo();
        this.show('screen-end');
        AudioSys.sfx(win ? 'legend' : 'fail');
    },
    quitToTitle() {
        this.exitSeed();
        this.setPlaying(false);
        this.engine.paused = false;
        U.el('overlay-pause').classList.add('hidden');
        this.engine.toDemo();
        Shop.renderTitle();
        this.show('screen-title');
        AudioSys.sfx('click');
    },

    /* ---------- HUD ---------- */
    updateHUD() {
        const r = this.run; if (!r) return;
        const th = ROUNDS[r.round];
        U.el('hud-round').textContent = `${r.daily ? '🎲 ' : ''}Round ${r.round + 1}/${ROUNDS.length} · ${th.name}`;
        U.el('hud-quota').textContent = th.special === 'boss'
            ? (r.quotaGot >= 2 ? '☠ THE LEVIATHAN' : `☠ Heralds ${r.quotaGot}/2`)
            : `🐟 ${r.quotaGot} / ${th.quota}`;
        U.el('hud-bait').textContent = '🪱'.repeat(Math.max(0, r.bait)) || '—';
        U.el('hud-coins').textContent = `🪙 ${r.coins}`;
        U.el('hud-char').textContent = `${r.char.icon} ${r.char.name}`;
        U.el('hud-score').textContent = `⭐ ${r.score.toLocaleString()}`;
        const comboEl = U.el('hud-combo');
        if (r.streak > 0) {
            const mult = 1 + Math.min(8, r.streak) * .25;
            comboEl.classList.add('on');
            comboEl.textContent = `🔥 streak ${r.streak} · next ×${mult.toFixed(2)}`;
        } else comboEl.classList.remove('on');
        const buffs = U.el('hud-buffs');
        buffs.innerHTML = '';
        for (const id in Upgrades.owned) {
            const d = UPGRADE_POOL.find(u => u.id === id); if (!d) continue;
            const chip = document.createElement('span');
            chip.className = 'buff';
            chip.style.setProperty('--rc', RARITIES[d.rarity].color);
            chip.title = `${d.name} — ${d.desc}`;
            chip.textContent = `${d.icon}${Upgrades.owned[id] > 1 ? '×' + Upgrades.owned[id] : ''}`;
            buffs.appendChild(chip);
        }
        U.el('hud-username').textContent = `👤 ${Shop.data.username || '—'}`;
    },
    syncPower() {
        const pb = U.el('hud-power');
        pb.style.setProperty('--chg', Math.floor(this.engine.charge));
        pb.classList.toggle('ready', this.engine.charge >= 100 && this.engine.state === 'hooked' && !this.engine.paused);
        if (this.run) U.el('hud-power-ico').textContent = this.run.char.power.icon;
    },

    /* ---------- leaderboard & aquarium screens ---------- */
    async renderBoard() {
        const list = U.el('board-list');
        const loading = U.el('board-loading');

        // Show loading, clear previous content
        loading.classList.remove('hidden');
        U.el('daily-box').innerHTML = '';
        list.innerHTML = '';

        try {
            const today = new Date().toISOString().slice(0, 10);
            const [best, entries] = await Promise.all([
                DB.getDailyScore(today),
                DB.getLeaderboard(100)
            ]);

            U.el('daily-box').innerHTML = `
          <div class="daily-card">
            <b>🎲 DAILY CATCH — ${today}</b>
            <span>${best ? `Today's best: ⭐ ${best.toLocaleString()}` : 'Not attempted yet — same seeded waters for everyone. Go set the bar!'}</span>
          </div>`;

            if (!entries.length) {
                list.innerHTML = '<div class="board-empty">No voyages recorded yet. Set sail!</div>';
            } else {
                list.innerHTML = entries.map((e, i) => `
              <li class="${i === 0 ? 'top1' : ''}">
                <span class="b-rank">#${i + 1}</span>
                <span class="b-username" title="${e.username}">${this.shortEmail(e.username)}</span>
                <span class="b-score">⭐ ${e.score.toLocaleString()}</span>
                <span class="b-char" title="${e.character}">${e.character.split(' ')[0]}</span>
                <span class="b-mode">${e.mode === 'daily' ? '🎲' : '⛵'} ${e.date.slice(5)}</span>
              </li>`).join('');
            }
        } catch (err) {
            console.error('Failed to load ranks:', err);
            list.innerHTML = '<div class="board-empty">Could not load ranks. Please try again.</div>';
        } finally {
            loading.classList.add('hidden');
        }
    },

    // Helper to truncate long emails for the leaderboard display
    shortEmail(email) {
        if (!email) return '—';
        const [name, domain] = email.split('@');
        if (!domain) return name.length > 12 ? name.slice(0, 12) + '…' : name;
        return name.length > 10 ? name.slice(0, 10) + '…' : name;
    },
    renderAquarium() {
        let total = 0, found = 0;
        const groups = ROUNDS.map((th, i) => {
            const list = th.special === 'boss' ? [HERALD, BOSS_FISH] : th.fish;
            const cards = list.map(sp => {
                total++;
                const c = Shop.data.dex[sp.name];
                if (c) found++;
                return `<div class="aq-card ${c ? '' : 'undiscovered'} r-${sp.rarity}">
          <div class="mini-fish" style="--fc:${sp.color}"><i class="tail"></i><i class="eye"></i></div>
          <div class="aq-name">${c ? sp.name : '???'}</div>
          <div class="aq-count">${c ? '×' + c : RARITIES[sp.rarity].name}</div>
        </div>`;
            }).join('');
            return `<div class="aq-group"><h3>${i + 1}. ${th.name}</h3><div class="aq-grid">${cards}</div></div>`;
        });
        U.el('aq-pct').textContent = `${found}/${total} · ${Math.round(found / total * 100)}%`;
        U.el('aq-groups').innerHTML = groups.join('');
    },

    /* ---------- pause ---------- */
    togglePause(force) {
        if (!this.playing) return;
        const on = force !== undefined ? force : !this.engine.paused;
        this.engine.paused = on;
        U.el('overlay-pause').classList.toggle('hidden', !on);
        AudioSys.sfx('pause');
    },

    /* ---------- wiring ---------- */
    bindUI() {
        U.el('btn-play').onclick = () => this.startRun(false);
        U.el('btn-daily').onclick = () => this.startRun(true);
        U.el('btn-shop').onclick = () => { AudioSys.sfx('click'); Shop.render(); this.show('screen-shop'); };
        U.el('btn-aquarium').onclick = () => { AudioSys.sfx('click'); this.renderAquarium(); this.show('screen-aquarium'); };
        U.el('btn-board').onclick = () => { AudioSys.sfx('click'); this.show('screen-board'); this.renderBoard(); };
        U.el('btn-howto').onclick = () => { AudioSys.sfx('click'); this.show('screen-howto'); };
        U.el('shop-back').onclick = () => { AudioSys.sfx('click'); Shop.renderTitle(); this.show('screen-title'); };
        U.el('aq-back').onclick = () => { AudioSys.sfx('click'); Shop.renderTitle(); this.show('screen-title'); };
        U.el('board-back').onclick = () => { AudioSys.sfx('click'); Shop.renderTitle(); this.show('screen-title'); };
        U.el('howto-back').onclick = () => { AudioSys.sfx('click'); this.show('screen-title'); };
        U.el('btn-sound').onclick = () => {
            AudioSys.muted = !AudioSys.muted; Shop.data.muted = AudioSys.muted; Shop.save();
            U.el('btn-sound').textContent = AudioSys.muted ? '🔇' : '🔊';
            if (!AudioSys.muted) { AudioSys.unlock(); AudioSys.sfx('click'); }
        };
        U.el('intro-go').onclick = () => this.beginRound();
        U.el('btn-next').onclick = () => this.nextRound();
        U.el('btn-retry').onclick = () => this.startRun(this.run ? this.run.daily : false);
        U.el('btn-menu').onclick = () => this.quitToTitle();
        U.el('hud-pause').onclick = () => this.togglePause();
        U.el('hud-power').onclick = () => this.engine.tryPower();
        U.el('btn-resume').onclick = () => this.togglePause(false);
        U.el('btn-quit').onclick = () => { if (this.run && !this.run.ended) { this.endRun(false); } else this.quitToTitle(); };
        U.el('up-reroll').onclick = () => this.reroll();
        addEventListener('keydown', e => {
            if (e.code === 'Escape') {
                if (!U.el('overlay-upgrades').classList.contains('hidden')) return;
                if (this.playing) this.togglePause();
            }
            if (e.code === 'KeyF' && this.playing) this.engine.tryPower();
            if (e.code === 'Space') { e.preventDefault(); if (this.playing && !this.engine.paused) { this.engine.mouse.down = true; this.engine.press(); } }
        });
        addEventListener('keyup', e => { if (e.code === 'Space') this.engine.mouse.down = false; });
        addEventListener('blur', () => { if (this.playing) this.togglePause(true); });

        // Long-press (0.6s) on power button for touch devices (replaces right-click)
        let pressTimer = null;
        const powerBtn = U.el('hud-power');

        powerBtn.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
                this.engine.tryPower();
                pressTimer = null;
            }, 600);
        }, { passive: true });

        powerBtn.addEventListener('touchend', () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
                // Short tap also works
                this.engine.tryPower();
            }
        });

        powerBtn.addEventListener('touchcancel', () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        });
    }
};