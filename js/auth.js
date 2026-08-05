/* ═══════════ auth flow ═══════════ */
const Auth = {
    mode: 'signin',

    init() {
        U.el('auth-tab-signin').onclick = () => this.setMode('signin');
        U.el('auth-tab-signup').onclick = () => this.setMode('signup');
        U.el('auth-submit').onclick = () => this.submit();
        U.el('auth-password').addEventListener('keydown', e => {
            if (e.key === 'Enter') this.submit();
        });
        U.el('btn-logout').onclick = () => this.logout();
    },

    setMode(mode) {
        this.mode = mode;
        U.el('auth-tab-signin').classList.toggle('active', mode === 'signin');
        U.el('auth-tab-signup').classList.toggle('active', mode === 'signup');
        U.el('auth-submit').textContent = mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT';
        U.el('auth-password').autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
        this.message('');
    },

    message(text, type = '') {
        const el = U.el('auth-message');
        el.textContent = text;
        el.className = 'auth-message ' + type;
    },

    async submit() {
        const email = U.el('auth-email').value.trim();
        const password = U.el('auth-password').value;
        const btn = U.el('auth-submit');

        if (!email || !password) {
            this.message('Please enter email and password.', 'error');
            return;
        }
        if (password.length < 6) {
            this.message('Password must be at least 6 characters.', 'error');
            return;
        }

        btn.disabled = true;
        btn.textContent = '…';
        try {
            if (this.mode === 'signup') {
                await DB.signUp(email, password);
                this.message('Account created! Loading…', 'success');
            } else {
                await DB.signIn(email, password);
                this.message('Welcome back!', 'success');
            }
            setTimeout(() => Game.onAuthSuccess(), 500);
        } catch (err) {
            this.message(this.friendlyError(err.message), 'error');
            btn.disabled = false;
            btn.textContent = this.mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT';
        }
    },

    friendlyError(msg) {
        if (msg.includes('Invalid login credentials')) return 'Wrong email or password.';
        if (msg.includes('already registered')) return 'That email already has an account. Sign in instead.';
        if (msg.includes('confirm your email')) return 'Check your inbox to confirm your email, then sign in.';
        if (msg.includes('rate limit')) return 'Too many attempts. Wait a moment and try again.';
        return msg;
    },

    async logout() {
        AudioSys.sfx('click');
        await DB.signOut();
        location.reload();
    },

    show() {
        Game.show('screen-auth');   // hides ALL screens, then shows auth
    },
    hide() {
        // do nothing here — Game.onAuthSuccess() will show the title
    }
};