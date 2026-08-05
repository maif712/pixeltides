/* ═══════════════════ GAME DATA ═══════════════════ */

const RARITIES = {
    common: { name: 'Common', color: '#aab3a0', w: 52 },
    uncommon: { name: 'Uncommon', color: '#6fce6a', w: 26 },
    rare: { name: 'Rare', color: '#54b8f2', w: 14 },
    epic: { name: 'Epic', color: '#c583ec', w: 6 },
    legendary: { name: 'Legendary', color: '#ffb63d', w: 2 },
};
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
/* ─────────── sprite assets ─────────── */
// Maps a key → file path. Add new fish here as you create them.
/* ─────────── sprite assets ─────────── */
const SPRITE_MANIFEST = {
    'fish_bumblegill': 'assets/sprites/fish/bumblegill.png',
    'fish_emerald_trout': 'assets/sprites/fish/emerald_trout.png',
    'fish_dawn_perch': 'assets/sprites/fish/dawn_perch.png',
    'env_tree': 'assets/sprites/environment/tree_meadow.png',
    'env_clouds': 'assets/sprites/environment/clouds.png',
};

/* ─────────── environment sprites ─────────── */
const ENV_SPRITES = {
    // Tree: 2-frame gentle sway
    tree: {
        key: 'env_tree',
        frameW: 64,   // ← one frame's width  (sheet width ÷ frames)
        frameH: 80,   // ← one frame's height
        frames: 2,
        fps: 2,       // sway speed (lower = slower)
        worldH: 56    // how tall to draw it in the scene (adjust to taste)
    },
    // Clouds: each frame = a different cloud shape, they drift via code
    clouds: {
        key: 'env_clouds',
        frameW: 48,   // ← one cloud's width  (sheet width ÷ frames)
        frameH: 24,   // ← one cloud's height
        frames: 3
    }
};

const SPECIES_SPRITES = {
    'Bumblegill': 'fish_bumblegill',
    'Emerald Trout': 'fish_emerald_trout',
    'Dawn Perch': 'fish_dawn_perch',
};

const SPRITE_DEFAULTS = { frameW: 32, frameH: 32, frames: 3, fps: 8 };
const SCORE_RARITY = { common: 1, uncommon: 1.4, rare: 2, epic: 3, legendary: 5 };

/* ─────────── playable characters (each with a signature superpower) ─────────── */
const CHARACTERS = [
    {
        id: 'marlow', name: 'Old Marlow', icon: '🧓', color: '#c98a4b', cost: 0,
        flavor: 'Forty years on the water. Nothing surprises him anymore — that’s the problem.',
        tags: ['Balanced stats', 'No quirks'],
        barSize: 1, control: 1, coinMult: 1, luck: 0, catchRate: 1, drain: 1,
        power: { id: 'anchor', name: 'Steady Anchor', icon: '⚓', desc: 'Drain and sink slowed 65% for 4s.' }
    },
    {
        id: 'pip', name: 'Pip', icon: '🧒', color: '#7fc96b', cost: 250,
        flavor: 'Small hands, big pockets. Sells every scale twice.',
        tags: ['+30% coins', '+0.5 Luck', '−8% bar size'],
        barSize: .92, control: 1, coinMult: 1.3, luck: .5, catchRate: 1, drain: 1,
        power: { id: 'luck', name: 'Pocket Luck', icon: '🍀', desc: 'Instant +18% progress and +15 coins.' }
    },
    {
        id: 'brine', name: 'Cpt. Brine', icon: '👩‍✈️', color: '#5aa7d8', cost: 400,
        flavor: 'Steady as an anchor. The fish tire before she does.',
        tags: ['+22% bar', '−15% drain', '−5% control'],
        barSize: 1.22, control: .95, coinMult: 1, luck: 0, catchRate: 1, drain: .85,
        power: { id: 'storm', name: 'Storm Call', icon: '🌩️', desc: 'Rips the fish into your bar and stuns it.' }
    },
    {
        id: 'finn', name: 'Finn the Frog', icon: '🐸', color: '#67d887', cost: 550,
        flavor: 'Half angler, half amphibian. The reel bar is an extension of his legs.',
        tags: ['+32% control', '+5% fill speed', '−10% bar'],
        barSize: .9, control: 1.32, coinMult: 1, luck: 0, catchRate: 1.05, drain: 1,
        power: { id: 'kick', name: 'Frog Kick', icon: '🐸', desc: 'The bar leaps and snaps onto the fish.' }
    },
    {
        id: 'mara', name: 'Witch Mara', icon: '🧙‍♀️', color: '#b07ae0', cost: 700,
        flavor: 'Baits her hook with moonlight. Rare things whisper her name.',
        tags: ['Epic+ offers ×2', '+1.6 Luck', '−10% coins'],
        barSize: 1, control: 1, coinMult: .9, luck: 1.6, catchRate: 1, drain: 1, special: 'fate',
        power: { id: 'chrono', name: 'Chrono Tide', icon: '⏳', desc: 'Freezes the fish in time for 2.2s.' }
    },
    {
        id: 'king', name: 'The Angler King', icon: '👑', color: '#ffc93d', cost: 1200,
        flavor: 'They say the sea itself pays him tribute.',
        tags: ['+12% bar', '+10% control', '+15% coins', '+0.6 Luck', '+10% fill'],
        barSize: 1.12, control: 1.1, coinMult: 1.15, luck: .6, catchRate: 1.1, drain: 1,
        power: { id: 'decree', name: 'Royal Decree', icon: '👑', desc: 'The bar grows ×1.8 for 3.5s.' }
    },
];

/* ─────────── species: [name, rarity, color, coins, size, speed] ─────────── */
const ROUNDS = [
    {
        name: 'Meadow Pond', sub: 'Still dawn water. The fish are sleepy — so are you.',
        sky: ['#ffcf8f', '#ff9d8a'], water: ['#4fb3bf', '#155e6b'], hills: ['#8fbf72', '#557f4c'],
        sun: { c: '#ffe3a0', x: .7, y: .78, r: 34 }, special: null, trees: true,
        fishSpeed: .72, dart: .5, coinMod: 1, quota: 3, bite: [2, 4.5],
        mods: ['🌅 Gentle waters', '🎣 Quota: 3 fish'],
        fish: [['Bumblegill', 'common', '#f0a44a', 9, .85, .8], ['Pebble Minnow', 'common', '#9fb6c9', 8, .75, .9],
        ['Clover Carp', 'uncommon', '#7ccd72', 17, 1, .95], ['Dawn Perch', 'rare', '#f2a0b8', 32, 1.1, 1.05]]
    },

    {
        name: 'Willow Creek', sub: 'Bright noon current under old willows.',
        sky: ['#8fd3ff', '#d3f0ff'], water: ['#3fa7c4', '#0e5b74'], hills: ['#6fbf5a', '#3f8f46'],
        sun: { c: '#fff2b0', x: .78, y: .16, r: 28 }, special: null, trees: true,
        fishSpeed: .9, dart: .8, coinMod: 1, quota: 3, bite: [1.8, 4],
        mods: ['☀️ Bright current', '🎣 Quota: 3 fish'],
        fish: [['Willow Dace', 'common', '#a9c96b', 9, .8, .95], ['Creek Chub', 'common', '#c9b46b', 9, .85, .9],
        ['Emerald Trout', 'uncommon', '#4fbf7f', 18, 1, 1], ['Bluegill King', 'rare', '#4aa3d8', 34, 1.15, 1.05]]
    },

    {
        name: 'Golden Hour Shoals', sub: 'Everything glitters. The fish know it too.',
        sky: ['#ffb45c', '#ff7e6b'], water: ['#e08a52', '#3c2a55'], hills: ['#c98a52', '#7a4a3a'],
        sun: { c: '#ffb347', x: .66, y: .76, r: 44 }, special: null,
        fishSpeed: 1.05, dart: 1, coinMod: 1.3, quota: 4, bite: [1.6, 3.6],
        mods: ['🪙 Golden hour: +30% coins', '🎣 Quota: 4 fish'],
        fish: [['Amber Sole', 'common', '#e0b25a', 10, .9, .95], ['Sundown Snapper', 'uncommon', '#f08a4b', 19, 1, 1],
        ['Gilded Bream', 'rare', '#ffd257', 36, 1.1, 1.05], ['Sunset Koi', 'epic', '#ff7e5f', 60, 1.25, 1.15]]
    },

    {
        name: 'Misty Hollow', sub: 'You can barely see the fish. Trust the tug.',
        sky: ['#b8c4c4', '#8ea3a3'], water: ['#6b8f95', '#22383d'], hills: ['#7f958f', '#4f6660'],
        sun: null, special: 'fog',
        fishSpeed: 1, dart: 1, coinMod: 1.1, quota: 4, bite: [1.6, 3.6],
        mods: ['🌫️ Fog: fish are hard to see', '🎣 Quota: 4 fish'],
        fish: [['Foggy Gudgeon', 'common', '#9aa7a0', 10, .85, .95], ['Mist Eel', 'uncommon', '#7f9fb0', 19, 1.05, 1],
        ['Grey Phantom', 'rare', '#c2d2dd', 36, 1.1, 1.1], ['Hollow Warden', 'epic', '#6f8fae', 62, 1.3, 1.15]]
    },

    {
        name: 'Stormbreak Coast', sub: 'Rough seas. Fast bites, faster fish.',
        sky: ['#4a5568', '#2b3544'], water: ['#3d5a73', '#101c2a'], hills: ['#3f5162', '#26333f'],
        sun: null, special: 'storm',
        fishSpeed: 1.22, dart: 1.3, coinMod: 1.15, quota: 4, bite: [1.2, 3],
        mods: ['⛈️ Rough seas: fish +22% speed', '⚡ Bites come quicker', '🎣 Quota: 4 fish'],
        fish: [['Thunder Sardine', 'common', '#7fa8c9', 11, .85, 1.05], ['Gale Mackerel', 'uncommon', '#5c8fbf', 20, .95, 1.1],
        ['Stormfin Tuna', 'rare', '#3f6fae', 38, 1.2, 1.15], ['Tempest Ray', 'epic', '#8f5fd0', 64, 1.4, 1.2]]
    },

    {
        name: 'Midnight Lantern', sub: 'One lantern, a dark sea, and lucky stars.',
        sky: ['#0e1b3a', '#1c2f5e'], water: ['#16324f', '#050e1c'], hills: ['#1a2c4a', '#0d1830'],
        sun: { c: '#e8f0ff', x: .74, y: .2, r: 26, moon: true }, special: 'night', stars: true, luckMod: .8,
        fishSpeed: 1.1, dart: 1.1, coinMod: 1.2, quota: 4, bite: [1.4, 3.2],
        mods: ['🌙 Night bite: lucky waters (+Luck)', '🏮 Lantern light', '🎣 Quota: 4 fish'],
        fish: [['Lantern Guppy', 'common', '#ffd98a', 11, .8, 1], ['Moonfish', 'uncommon', '#9fd0ff', 21, 1, 1.05],
        ['Midnight Marlin', 'rare', '#5f7fd0', 40, 1.2, 1.15], ['Starfin', 'epic', '#ffe066', 66, 1.3, 1.2],
        ['Comet Koi', 'legendary', '#ffcf5c', 130, 1.5, 1.3]]
    },

    {
        name: 'Sunken Grotto', sub: 'Glowing water in a drowned cave. Rich pickings.',
        sky: ['#0c2f2f', '#08312c'], water: ['#1f6f68', '#04191c'], hills: ['#0f4a42', '#062b28'],
        sun: null, special: 'grotto',
        fishSpeed: 1.18, dart: 1.25, coinMod: 1.25, quota: 5, bite: [1.3, 3],
        mods: ['💎 Rich waters: +25% coins', '✨ Bioluminescence', '🎣 Quota: 5 fish'],
        fish: [['Cave Blindfish', 'common', '#d0c0a0', 12, .85, 1.05], ['Grotto Angler', 'uncommon', '#7fe0d0', 22, 1, 1.1],
        ['Crystal Tetra', 'rare', '#a0e8ff', 42, 1.1, 1.2], ['Grotto Empress', 'epic', '#66d9c4', 68, 1.35, 1.2]]
    },

    {
        name: 'Frostfjord', sub: 'Icy air numbs your grip. The bar slides like glass.',
        sky: ['#cfe8ff', '#a9c8e8'], water: ['#7fb8d8', '#1e4a66'], hills: ['#e8f2fa', '#b9d2e6'],
        sun: { c: '#fffbe8', x: .8, y: .24, r: 24 }, special: 'ice',
        fishSpeed: 1.12, dart: 1.1, coinMod: 1.25, controlMod: .72, gravityMod: 1.25, quota: 5, bite: [1.3, 3],
        mods: ['🧊 Slippery grip: −28% control', '🧊 Heavier sink', '🎣 Quota: 5 fish'],
        fish: [['Snow Smelt', 'common', '#cfe8f5', 12, .8, 1.05], ['Frost Char', 'uncommon', '#9fd8e8', 22, .95, 1.1],
        ['Glacier Pike', 'rare', '#7fc8f0', 44, 1.25, 1.2], ['Aurora Salmon', 'epic', '#b49fff', 70, 1.35, 1.25]]
    },

    {
        name: 'The Abyss', sub: 'No sky. No floor. Only teeth and treasure.',
        sky: ['#050a18', '#020409'], water: ['#0a1a33', '#010207'], hills: ['#060d1c', '#03060f'],
        sun: null, special: 'abyss', stars: true, luckMod: .6,
        fishSpeed: 1.3, dart: 1.4, coinMod: 1.4, drainMod: 1.2, quota: 5, bite: [1, 2.6],
        mods: ['🌑 Deep pressure: gauge drains faster', '💰 +40% coins', '🎣 Quota: 5 fish'],
        fish: [['Abyss Herring', 'uncommon', '#6080b0', 24, .95, 1.15], ['Voidfang Eel', 'rare', '#7060c0', 46, 1.2, 1.25],
        ['Depth Lurker', 'epic', '#4050a0', 74, 1.4, 1.3], ['Whisper of the Deep', 'legendary', '#9060ff', 140, 1.55, 1.35]]
    },

    {
        name: "Leviathan's Lair", sub: 'The water is red. It has been waiting for you.',
        sky: ['#2a0a12', '#4a0f14'], water: ['#5e1f24', '#12040a'], hills: ['#3a0d14', '#1e060b'],
        sun: { c: '#ff6a5a', x: .7, y: .28, r: 30, moon: true }, special: 'boss', stars: true,
        fishSpeed: 1.25, dart: 1.3, coinMod: 2, quota: 3, bite: [1.2, 2.6],
        mods: ['☠️ TWO Heralds… then the LEVIATHAN', '💰 +100% coins', '⚠️ Boss enrages as it weakens'],
        fish: []
    },
];

/* normalize fish tuples → species objects */
for (const r of ROUNDS) {
    r.fish = r.fish.map(f => Array.isArray(f)
        ? { name: f[0], rarity: f[1], color: f[2], coins: f[3], size: f[4], speed: f[5] }
        : f);
}

const HERALD = { name: 'Herald of the Deep', rarity: 'epic', color: '#e0556a', coins: 80, size: 1.5, speed: 1.2 };
const BOSS_FISH = { name: 'SILT-MAW LEVIATHAN', rarity: 'legendary', color: '#ff5a48', coins: 420, size: 2.4, speed: 1.25, boss: true };

/* rarity → species roll, luck-shifted */
function pickSpecies(theme, luck, special) {
    const L = Math.max(0, luck);
    const fate = special === 'fate';
    const w = {
        common: RARITIES.common.w / (1 + 0.16 * L),
        uncommon: RARITIES.uncommon.w * (1 + 0.05 * L),
        rare: RARITIES.rare.w * (1 + 0.12 * L),
        epic: RARITIES.epic.w * (1 + 0.22 * L) * (fate ? 1.8 : 1),
        legendary: RARITIES.legendary.w * (1 + 0.32 * L) * (fate ? 2.2 : 1),
    };
    let rar = U.weightedPick(RARITY_ORDER, k => w[k]);
    let pool = theme.fish.filter(f => f.rarity === rar);
    if (!pool.length) {
        const i = RARITY_ORDER.indexOf(rar);
        for (let d = 1; d < 5 && !pool.length; d++) {
            pool = theme.fish.filter(f => f.rarity === RARITY_ORDER[i - d]);
            if (!pool.length) pool = theme.fish.filter(f => f.rarity === RARITY_ORDER[i + d]);
        }
    }
    if (!pool.length) pool = theme.fish;
    return U.pick(pool);
}