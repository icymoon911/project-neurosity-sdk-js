/**
 * Supported metric names for batch subscription.
 * Each name maps to an internal metric+label pair used by getCloudMetric.
 */
export type BatchMetricName =
  | "brainwaves.raw"
  | "brainwaves.rawUnfiltered"
  | "brainwaves.powerByBand"
  | "brainwaves.psd"
  | "calm"
  | "focus"
  | "signalQuality"
  | "signalQualityV2"
  | "accelerometer";

/**
 * A single emission from a batch subscription, representing the latest
 * data from one of the subscribed metrics.
 */
export interface BatchMetricEmission<T = any> {
  /** Internal metric name (e.g. "brainwaves", "awareness", "signalQuality") */
  metric: string;
  /** Label within the metric (e.g. "raw", "calm", "focus") */
  label: string;
  /** The raw metric data payload */
  data: T;
  /** Unix timestamp (ms) when this emission was received */
  timestamp: number;
}
