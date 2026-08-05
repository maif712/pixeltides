/* ═══════════ Supabase-backed Shop ═══════════ */
const Shop = {
    data: null,

    defaults() {
        return {
            username: null,
            coins: 120,
            unlocked: ['marlow'],
            selected: 'marlow',
            best: 0,
            muted: false,
            medals: {},
            board: [],
            daily: {},
            dex: {},
            bestScore: 0
        };
    },

    async load() {
        if (!DB.user) {
            await DB.init();
        }

        const progress = await DB.getProgress();
        const profile = await DB.getProfile();
        const medals = await DB.getMedals();
        const dex = await DB.getFishDex();

        if (progress) {
            this.data = {
                username: profile ? profile.username : null,
                coins: progress.coins,
                unlocked: progress.unlocked_characters,
                selected: progress.selected_character,
                best: progress.best_round,
                muted: progress.muted,
                medals,
                dex,
                bestScore: progress.best_score
            };
        } else {
            this.data = this.defaults();
            this.data.username = profile ? profile.username : null;
            await DB.saveProgress({
                coins: this.data.coins,
                unlocked_characters: this.data.unlocked,
                selected_character: this.data.selected,
                best_round: this.data.best,
                muted: this.data.muted,
                best_score: this.data.bestScore
            });
        }

        AudioSys.muted = this.data.muted;
    },

    async save() {
        if (!DB.user) return;
        await DB.saveProgress({
            coins: this.data.coins,
            unlocked_characters: this.data.unlocked,
            selected_character: this.data.selected,
            best_round: this.data.best,
            muted: this.data.muted,
            best_score: this.data.bestScore
        });
    },

    async addCoins(n) {
        this.data.coins += n;
        await this.save();
    },

    selectedChar() {
        return CHARACTERS.find(c => c.id === this.data.selected) || CHARACTERS[0];
    },

    async saveMedal(roundIndex, medalTier) {
        const cur = this.data.medals[roundIndex] || 0;
        if (!cur || medalTier < cur) {
            this.data.medals[roundIndex] = medalTier;
            await DB.saveMedal(roundIndex, medalTier);
        }
    },

    async incrementFishDex(speciesName) {
        const isFirst = await DB.incrementFishDex(speciesName);
        if (isFirst) {
            this.data.dex[speciesName] = 1;
        } else {
            this.data.dex[speciesName] = (this.data.dex[speciesName] || 0) + 1;
        }
        return isFirst;
    },

    renderTitle() {
        if (!this.data) return;
        U.el('title-wallet').textContent = `🪙 ${this.data.coins}`;
        U.el('title-best').textContent = this.data.best > 0
            ? `🏅 Best: Round ${this.data.best} · ⭐ ${this.data.bestScore.toLocaleString()}`
            : '⛵ First voyage awaits';
        U.el('btn-sound').textContent = this.data.muted ? '🔇' : '🔊';
        U.el('title-username').textContent = `👤 ${this.data.username || '—'}`;
    },

    pct(v, min, max) {
        return Math.round(U.clamp((v - min) / (max - min), 0, 1) * 100);
    },

    meter(label, pct, valTxt) {
        return `<div class="meter"><b>${label}</b><div class="track"><div class="fill" style="width:${pct}%"></div></div><span>${valTxt}</span></div>`;
    },

    render() {
        if (!this.data) return;
        U.el('shop-wallet').textContent = `🪙 ${this.data.coins}`;
        const grid = U.el('char-grid');
        grid.innerHTML = '';
        for (const c of CHARACTERS) {
            const owned = this.data.unlocked.includes(c.id);
            const selected = this.data.selected === c.id;
            const card = document.createElement('div');
            card.className = 'char-card' + (selected ? ' selected' : '') + (!owned ? ' locked' : '');
            card.innerHTML = `
        <div class="portrait" style="--pc:${c.color}">${c.icon}</div>
        <div class="char-name">${c.name}</div>
        <div class="char-power" title="${c.power.desc}">⚡ ${c.power.icon} ${c.power.name}</div>
        <div class="char-flavor">${c.flavor}</div>
        <div class="char-tags">${c.tags.map(t => `<span>${t}</span>`).join('')}</div>
        ${this.meter('BAR', this.pct(c.barSize, .85, 1.3), '×' + c.barSize.toFixed(2))}
        ${this.meter('CONTROL', this.pct(c.control, .9, 1.35), '×' + c.control.toFixed(2))}
        ${this.meter('COINS', this.pct(c.coinMult, .85, 1.2), '×' + c.coinMult.toFixed(2))}
        ${this.meter('LUCK', this.pct(c.luck, 0, 2), '+' + c.luck.toFixed(1))}
        <div class="char-foot"></div>`;
            const foot = card.querySelector('.char-foot');
            const btn = document.createElement('button');
            btn.className = 'btn btn-small';
            if (selected) {
                btn.textContent = '⚓ FISHING AS';
                btn.disabled = true;
            } else if (owned) {
                btn.textContent = 'SELECT';
                btn.onclick = async () => {
                    AudioSys.sfx('click');
                    this.data.selected = c.id;
                    await this.save();
                    this.render();
                };
            } else {
                btn.textContent = `BUY · 🪙 ${c.cost}`;
                btn.disabled = this.data.coins < c.cost;
                btn.onclick = async () => {
                    if (this.data.coins < c.cost) return;
                    this.data.coins -= c.cost;
                    this.data.unlocked.push(c.id);
                    this.data.selected = c.id;
                    await this.save();
                    AudioSys.sfx('upgrade');
                    this.render();
                };
            }
            foot.appendChild(btn);
            grid.appendChild(card);
        }
    }
};