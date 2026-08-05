/* ═══════════ synthesized SFX (no assets needed) ═══════════ */
const AudioSys = {
    ctx: null, muted: false,
    unlock() {
        if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(f, d, type = 'square', v = .14, delay = 0, slide = 0) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
        g.gain.setValueAtTime(v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(this.ctx.destination);
        o.start(t); o.stop(t + d + .05);
    },
    noise(d, v = .2, fq = 800, delay = 0) {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime + delay;
        const len = Math.max(1, Math.floor(this.ctx.sampleRate * d));
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = fq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        src.connect(f).connect(g).connect(this.ctx.destination); src.start(t);
    },
    sfx(name) {
        switch (name) {
            case 'click': this.tone(660, .06, 'square', .07); break;
            case 'cast': this.noise(.22, .1, 1400); this.tone(240, .25, 'sine', .05, 0, 260); break;
            case 'splash': this.noise(.3, .22, 700); break;
            case 'nibble': this.tone(300, .05, 'sine', .05); break;
            case 'bite': this.tone(880, .07, 'square', .13); this.tone(880, .08, 'square', .13, .1); break;
            case 'hook': this.tone(440, .08, 'square', .12); this.tone(660, .1, 'square', .12, .07); break;
            case 'catch': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .12, 'triangle', .13, i * .09)); break;
            case 'perfect': [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, .12, 'triangle', .12, i * .08)); break;
            case 'legend': [392, 523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, .16, 'triangle', .14, i * .1));
                this.noise(.5, .08, 3000, .2); break;
            case 'coin': this.tone(988, .07, 'square', .1); this.tone(1319, .13, 'square', .1, .06); break;
            case 'upgrade': this.tone(523, .12, 'triangle', .13); this.tone(659, .16, 'triangle', .13, .09); break;
            case 'fail': this.tone(220, .22, 'sawtooth', .13, 0, -120); this.tone(130, .32, 'sawtooth', .12, .12, -60); break;
            case 'boss': this.tone(72, .7, 'sawtooth', .22, 0, -26); this.noise(.6, .12, 300); break;
            case 'pause': this.tone(440, .08, 'square', .08); break;
            case 'power': this.tone(300, .2, 'sawtooth', .12, 0, 520);
                [660, 880, 1174].forEach((f, i) => this.tone(f, .13, 'triangle', .11, .1 + i * .06)); break;
            case 'discover': this.tone(784, .09, 'triangle', .12); this.tone(1174, .16, 'triangle', .12, .08); break;
        }
    }
};