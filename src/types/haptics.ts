import { Action } from "./actions";

/**
 * Map of haptic motor location to an array of effect command strings.
 *
 * Keys must be valid motor locations for the target device model
 * (e.g. `"P7"`, `"P8"` for Notion 2 and Crown).
 * Each array may contain up to 7 effect strings.
 */
export interface HapticEffectsRequest {
  [location: string]: string[];
}

/**
 * The response returned after queuing haptic effects.
 * Mirrors the Action shape used by `dispatchAction`.
 */
export type HapticEffectsResponse = Action;
