/**
 * Feature flags. Switch one on by setting an environment variable when
 * building (locally in a `.env.local` file, or in Cloudflare Pages under
 * Settings → Environment variables), e.g. VITE_FEATURE_ADS=true.
 */
export const features = {
  /** Advert slot below the editor (DESIGN.md §8). OFF for version 1. */
  ads: import.meta.env.VITE_FEATURE_ADS === 'true',
};
