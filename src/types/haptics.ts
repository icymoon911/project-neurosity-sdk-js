import { Action } from "./actions";

/**
 * Haptic motor location identifiers.
 * P7 and P8 correspond to the 10-10 EEG system positions
 * where the haptic motors are located on Notion 2 and Crown devices.
 */
export type HapticMotorLocation = "P7" | "P8";

/**
 * A map of motor locations to arrays of haptic effect command strings.
 * Each location supports up to 7 effects.
 */
export type HapticEffectsRequest = {
  [motorLocation: string]: string[];
};

/**
 * Response from the haptics command.
 */
export type HapticResponse = Action;
