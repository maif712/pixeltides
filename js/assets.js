/* ═══════════ Asset Manager ═══════════ */
const Assets = {
    images: {},

    // Load a single image, returns a Promise
    loadImage(key, src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.images[key] = img;
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`Asset failed to load: ${src}`);
                this.images[key] = null; // mark as failed, don't hang
                resolve(null);
            };
            img.src = src;
        });
    },

    // Load all assets from a manifest { key: path }
    async loadAll(manifest, onProgress) {
        const keys = Object.keys(manifest);
        let loaded = 0;
        for (const key of keys) {
            await this.loadImage(key, manifest[key]);
            loaded++;
            if (onProgress) onProgress(loaded / keys.length, key);
        }
        return this.images;
    },

    get(key) { return this.images[key] || null; },

    // True only if the image loaded successfully AND has real dimensions
    has(key) {
        const img = this.images[key];
        return !!img && img.complete && img.naturalWidth > 0;
    }
};