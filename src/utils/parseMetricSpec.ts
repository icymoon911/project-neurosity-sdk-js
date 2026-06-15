import { metrics } from "@neurosity/ipk";

import { getLabels } from "./subscription";

/**
 * Parsed representation of a metric spec string.
 * @internal
 */
export interface ParsedMetricSpec {
  /** The RTDB metric namespace (e.g. "brainwaves", "awareness", "signalQuality") */
  metric: string;
  /** Labels to subscribe to within that metric */
  labels: string[];
  /** Whether the metric should be subscribed atomically (single listener for all labels) */
  atomic: boolean;
}

/**
 * Well-known aliases that map user-facing metric names to their
 * underlying RTDB namespace + label.
 */
const ALIASES: Record<string, { metric: string; labels: string[] }> = {
  calm: { metric: "awareness", labels: ["calm"] },
  focus: { metric: "awareness", labels: ["focus"] }
};

/**
 * Metrics that should be subscribed atomically (all labels delivered
 * in a single emission from the device).
 */
const ATOMIC_METRICS = new Set([
  "accelerometer",
  "signalQuality",
  "signalQualityV2"
]);

/**
 * Parse a user-facing metric spec string into the internal representation
 * needed by `getCloudMetric`.
 *
 * Examples:
 *   "brainwaves.raw"     → { metric: "brainwaves", labels: ["raw"], atomic: false }
 *   "calm"               → { metric: "awareness",  labels: ["calm"], atomic: false }
 *   "signalQuality"      → { metric: "signalQuality", labels: [...], atomic: true }
 *   "kinesis.push"       → { metric: "kinesis", labels: ["push"], atomic: false }
 *
 * @internal
 */
export function parseMetricSpec(spec: string): ParsedMetricSpec {
  // Check aliases first (calm, focus)
  if (spec in ALIASES) {
    const alias = ALIASES[spec];
    return {
      metric: alias.metric,
      labels: alias.labels,
      atomic: false
    };
  }

  // Handle dotted specs: "brainwaves.raw", "kinesis.push"
  const dotIndex = spec.indexOf(".");
  if (dotIndex !== -1) {
    const metric = spec.slice(0, dotIndex);
    const label = spec.slice(dotIndex + 1);
    return {
      metric,
      labels: [label],
      atomic: false
    };
  }

  // Simple metric name — use all labels from ipk, atomic if applicable
  const labels = getLabels(spec);
  return {
    metric: spec,
    labels,
    atomic: ATOMIC_METRICS.has(spec)
  };
}
