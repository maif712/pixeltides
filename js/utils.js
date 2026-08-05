/* ═══════════ tiny helpers ═══════════ */
const U = {
    el: id => document.getElementById(id),
    rand: (a, b) => a + Math.random() * (b - a),
    irand: (a, b) => Math.floor(U.rand(a, b + 1)),
    pick: arr => arr[Math.floor(Math.random() * arr.length)],
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    sign: n => (n < 0 ? -1 : 1),
    chance: p => Math.random() < p,
    shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; },
    weightedPick(list, weightFn) {
        let total = 0;
        const ws = list.map(it => { const w = Math.max(0.0001, weightFn(it)); total += w; return w; });
        let r = Math.random() * total;
        for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; }
        return list[list.length - 1];
    }
};

/* ═══════════ seeded RNG (Daily Challenge) ═══════════ */
function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
function hashStr(s) {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
        h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
        h = h << 13 | h >>> 19;
    }
    return h >>> 0;
}