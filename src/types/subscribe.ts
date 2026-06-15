/**
 * A metric spec string that identifies a metric to subscribe to.
 *
 * Supported formats:
 * - Simple metric name: `"accelerometer"`, `"signalQuality"`, `"signalQualityV2"`
 * - Dotted metric.label: `"brainwaves.raw"`, `"brainwaves.psd"`, `"kinesis.push"`
 * - Aliases: `"calm"` (maps to awareness/calm), `"focus"` (maps to awareness/focus)
 */
export type MetricSpec = string;

/**
 * A single emission from a batch subscription, representing the latest
 * data for one of the subscribed metrics.
 */
export interface MetricEmission {
  /**
   * The original metric spec string as passed to `subscribe()`.
   * e.g. `"brainwaves.raw"`, `"calm"`, `"focus"`
   */
  metric: string;

  /**
   * The label(s) associated with this emission.
   * For single-label metrics this is the label name (e.g. `"raw"`, `"calm"`).
   * For multi-label atomic metrics this is a comma-separated list.
   */
  label: string;

  /**
   * The raw data payload from the device.
   */
  data: any;

  /**
   * Client-side timestamp (ms since epoch) when this emission was received.
   */
  timestamp: number;
}
