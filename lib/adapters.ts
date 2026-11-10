/**
 * Type adapters — convert between boxmovies and app-level types so we
 * don't have to keep transforming the same shape in every view.
 *
 * The converter itself lives in `lib/cards.ts` — there is ONE of it, and
 * this module keeps the older import path working.
 */
export { toMediaCard, toMediaCards } from "./cards";
