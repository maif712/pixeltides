function splitLetters() {
    document.querySelectorAll('.split').forEach(el => {
        const txt = el.textContent;
        el.textContent = '';
        [...txt].forEach((ch, i) => {
            const s = document.createElement('span');
            s.className = 'letter';
            s.textContent = ch;
            s.style.animationDelay = (i * .09) + 's';
            el.appendChild(s);
        });
    });
}
addEventListener('DOMContentLoaded', () => {
    splitLetters();
    Game.init();
    document.addEventListener('pointerdown', () => AudioSys.unlock());
});