/* ═══════════ the Vampire-Survivors-style draft ═══════════ */
const UPGRADE_POOL = [
    // commons
    { id: 'cork_grip', name: 'Cork Grip', icon: '🪵', rarity: 'common', max: 4, desc: '+12% reel bar size.', apply: s => { s.barSize *= 1.12; } },
    { id: 'lead_keel', name: 'Lead Keel', icon: '⚓', rarity: 'common', max: 4, desc: 'Bar sinks 12% slower.', apply: s => { s.gravity *= .88; } },
    { id: 'braid', name: 'Braided Line', icon: '🧵', rarity: 'common', max: 4, desc: 'Catch gauge fills 10% faster.', apply: s => { s.catchRate *= 1.10; } },
    { id: 'worm', name: 'Spare Worm', icon: '🪱', rarity: 'common', max: 2, desc: '+1 bait. Mistakes forgiven.', apply: s => { s.bait += 1; } },
    { id: 'tin_coin', name: 'Tin Tally', icon: '🪙', rarity: 'common', max: 4, desc: 'Fish sell for 12% more.', apply: s => { s.coinMult *= 1.12; } },
    // uncommons
    { id: 'beeswax', name: 'Beeswax Gloves', icon: '🧤', rarity: 'uncommon', max: 3, desc: '+15% reel control.', apply: s => { s.control *= 1.15; } },
    { id: 'steady', name: 'Steady Hands', icon: '🤲', rarity: 'uncommon', max: 3, desc: 'Gauge drains 18% slower.', apply: s => { s.drain *= .82; } },
    { id: 'clover', name: 'Clover Lure', icon: '🍀', rarity: 'uncommon', max: 3, desc: '+1 Luck — better fish & offers.', apply: s => { s.luck += 1; } },
    { id: 'bell', name: 'Silver Bell', icon: '🔔', rarity: 'uncommon', max: 2, desc: 'Bite window 30% longer.', apply: s => { s.biteWindow *= 1.3; } },
    { id: 'eagle', name: 'Eagle Eye', icon: '🦅', rarity: 'uncommon', max: 3, desc: 'Perfect bonus +25%.', apply: s => { s.perfectMult += .25; } },
    // rares
    { id: 'magnet', name: 'Magnetweed', icon: '🧲', rarity: 'rare', max: 2, desc: '+22% bar, fish drift toward it.', apply: s => { s.barSize *= 1.22; s.attract = true; } },
    { id: 'calm', name: 'Calmwaters', icon: '🌊', rarity: 'rare', max: 2, desc: 'Fish dart 35% less often.', apply: s => { s.dart *= .65; } },
    { id: 'twin', name: 'Twin Hook', icon: '🪝', rarity: 'rare', max: 2, desc: '20% chance a catch counts twice.', apply: s => { s.twin += .2; } },
    { id: 'gilded', name: 'Gilded Bobber', icon: '✨', rarity: 'rare', max: 2, desc: 'Fish sell for 30% more.', apply: s => { s.coinMult *= 1.3; } },
    // epics
    { id: 'charm', name: 'Abyssal Charm', icon: '🧿', rarity: 'epic', max: 2, desc: 'Once per fish, an escape is undone.', apply: s => { s.charm += 1; } },
    { id: 'jelly', name: 'Moon Jellies', icon: '🪼', rarity: 'epic', max: 2, desc: 'All fish move 15% slower.', apply: s => { s.fishSlow *= .85; } },
    { id: 'surge', name: 'Tide Surge', icon: '⚡', rarity: 'epic', max: 2, desc: 'Hook starts at +15% gauge.', apply: s => { s.surge += .15; } },
    { id: 'siren', name: 'Siren Song', icon: '🎶', rarity: 'epic', max: 1, desc: 'Fish slow down near your bar.', apply: s => { s.siren = true; } },
    // legendaries
    { id: 'leviathan', name: "Leviathan's Lure", icon: '👑', rarity: 'legendary', max: 1, desc: '+30% bar, +25% fill — fish fight 12% harder.', apply: s => { s.barSize *= 1.3; s.catchRate *= 1.25; s.dart *= 1.12; } },
    { id: 'ghostnet', name: 'Ghost Net', icon: '🕸️', rarity: 'legendary', max: 1, desc: 'The gauge can never drop below 8%.', apply: s => { s.ghost = true; } },
    { id: 'crown', name: 'Kingfisher Crown', icon: '🏆', rarity: 'legendary', max: 1, desc: '+60% coins, +2 Luck.', apply: s => { s.coinMult *= 1.6; s.luck += 2; } },
    { id: 'stormheart', name: 'Stormheart', icon: '🌩️', rarity: 'legendary', max: 1, desc: '+40% control, −35% sink.', apply: s => { s.control *= 1.4; s.gravity *= .65; } },
];

const Upgrades = {
    owned: {},
    reset() { this.owned = {}; },
    pool() { return UPGRADE_POOL.filter(u => (this.owned[u.id] || 0) < u.max); },
    weight(u, luck, special) {
        const L = Math.max(0, luck), fate = special === 'fate';
        switch (u.rarity) {
            case 'common': return RARITIES.common.w / (1 + .16 * L);
            case 'uncommon': return RARITIES.uncommon.w * (1 + .05 * L);
            case 'rare': return RARITIES.rare.w * (1 + .12 * L);
            case 'epic': return RARITIES.epic.w * (1 + .22 * L) * (fate ? 1.9 : 1);
            case 'legendary': return RARITIES.legendary.w * (1 + .32 * L) * (fate ? 2.2 : 1);
        }
    },
    roll(luck, special) {
        let pool = this.pool();
        if (!pool.length) return [{
            id: 'gift', name: 'Bag of Coins', icon: '💰', rarity: 'common', gift: 40,
            desc: 'The tide has nothing left to teach — take 40 coins.', max: 99
        }];
        const picks = [];
        while (picks.length < 3 && pool.length) {
            const item = U.weightedPick(pool, u => this.weight(u, luck, special));
            picks.push(item);
            pool = pool.filter(u => u !== item);
        }
        return picks;
    },
    computeStats(charId) {
        const c = CHARACTERS.find(ch => ch.id === charId);
        const s = {
            barSize: c.barSize ?? 1, control: c.control ?? 1, gravity: 1,
            catchRate: c.catchRate ?? 1, drain: c.drain ?? 1, coinMult: c.coinMult ?? 1,
            luck: c.luck ?? 0, perfectMult: 1.5, bait: 4, biteWindow: 1,
            fishSlow: 1, dart: 1, surge: 0, twin: 0, charm: 0,
            ghost: false, siren: false, attract: false
        };
        for (const id in this.owned) {
            const def = UPGRADE_POOL.find(u => u.id === id);
            if (!def) continue;
            for (let i = 0; i < this.owned[id]; i++) def.apply(s);
        }
        return s;
    }
};