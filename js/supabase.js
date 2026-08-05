/* ═══════════ Supabase Client & API ═══════════ */

const SUPABASE_URL = window.__SUPABASE_URL__;
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase config. Check .env file.');
}

// Renamed to supabaseClient to avoid conflict with the global window.supabase object from the CDN
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DB = {
    user: null,

    async init() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            this.user = session ? session.user : null;
            return this.user;
        } catch (e) {
            console.warn('Supabase session check failed:', e.message);
            return null;
        }
    },

    async signUp(email, password) {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) this.user = data.user;
        return data;
    },

    async signIn(email, password) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        this.user = data.user;
        return data;
    },

    async signOut() {
        await supabaseClient.auth.signOut();
        this.user = null;
    },

    // ═══════════ USER PROGRESS ═══════════
    // ═══════════ USER PROGRESS ═══════════
    async getProgress() {
        if (!this.user) return null;
        const { data, error } = await supabaseClient
            .from('user_progress')
            .select('*')
            .eq('user_id', this.user.id)
            .maybeSingle();  // Changed from .single() to .maybeSingle()

        if (error) {
            console.warn('Progress fetch warning:', error.message);
            return null;
        }
        return data;
    },

    async getProfile() {
        if (!this.user) return null;
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('username')
            .eq('id', this.user.id)
            .single();
        if (error) return null;
        return data;
    },

    async saveProgress(progress) {
        if (!this.user) return;
        const { error } = await supabaseClient
            .from('user_progress')
            .upsert({ user_id: this.user.id, ...progress });
        if (error) console.error('Save progress error:', error);
    },

    // ═══════════ LEADERBOARD ═══════════
    async submitRun(runData) {
        if (!this.user) return;
        const { error } = await supabaseClient
            .from('leaderboard_runs')
            .insert({ user_id: this.user.id, ...runData });
        if (error) console.error('Submit run error:', error);
    },

    async getLeaderboard(limit = 100) {
        const { data, error } = await supabaseClient
            .rpc('get_leaderboard', { limit_count: limit });
        if (error) { console.error('Leaderboard error:', error); return []; }
        return data || [];
    },

    async getDailyLeaderboard(date) {
        const { data, error } = await supabaseClient
            .rpc('get_daily_leaderboard', { target_date: date, limit_count: 100 });
        if (error) { console.error('Daily leaderboard error:', error); return []; }
        return data || [];
    },

    // ═══════════ DAILY SCORES ═══════════
    async submitDailyScore(date, score) {
        if (!this.user) return;
        const { error } = await supabaseClient
            .from('daily_scores')
            .upsert({ user_id: this.user.id, date, score });
        if (error) console.error('Daily score error:', error);
    },

    async getDailyScore(date) {
        if (!this.user) return null;
        const { data, error } = await supabaseClient
            .from('daily_scores')
            .select('score')
            .eq('user_id', this.user.id)
            .eq('date', date)
            .maybeSingle();  // Changed from .single() to .maybeSingle()
        if (error) {
            console.error('Daily score fetch error:', error);
            return null;
        }
        return data?.score ?? null;
    },

    // ═══════════ MEDALS ═══════════
    async saveMedal(roundIndex, medalTier) {
        if (!this.user) return;
        const { error } = await supabaseClient
            .rpc('upsert_medal', {
                p_user_id: this.user.id,
                p_round_index: roundIndex,
                p_medal_tier: medalTier
            });
        if (error) console.error('Medal error:', error);
    },

    async getMedals() {
        if (!this.user) return {};
        const { data, error } = await supabaseClient
            .from('medals')
            .select('round_index, medal_tier')
            .eq('user_id', this.user.id);
        if (error) return {};
        const medals = {};
        for (const m of data) medals[m.round_index] = m.medal_tier;
        return medals;
    },

    // ═══════════ FISH DEX ═══════════
    async incrementFishDex(speciesName) {
        if (!this.user) return false;
        const { data, error } = await supabaseClient
            .rpc('increment_fish_dex', {
                p_user_id: this.user.id,
                p_species_name: speciesName
            });
        if (error) { console.error('Fish dex error:', error); return false; }
        return data;
    },

    async getFishDex() {
        if (!this.user) return {};
        const { data, error } = await supabaseClient
            .from('fish_dex')
            .select('species_name, count')
            .eq('user_id', this.user.id);
        if (error) return {};
        const dex = {};
        for (const f of data) dex[f.species_name] = f.count;
        return dex;
    }
};

// Expose globally so other script files can access DB
window.DB = DB;