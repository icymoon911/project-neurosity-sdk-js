import { Observable, merge, EMPTY, throwError } from "rxjs";
import { switchMap, map } from "rxjs/operators";

import { whileOnline } from "./whileOnline";
import { validate, getLabels } from "./subscription";
import {
  BatchMetricName,
  BatchMetricEmission
} from "../types/batchSubscribe";
import { DeviceInfo } from "../types/deviceInfo";

/**
 * Maps a user-facing batch metric name to the internal getCloudMetric config.
 */
interface MetricConfig {
  metric: string;
  labels: string[];
  atomic: boolean;
}

function resolveMetricConfig(name: BatchMetricName): MetricConfig {
  switch (name) {
    case "brainwaves.raw":
      return { metric: "brainwaves", labels: ["raw"], atomic: false };
    case "brainwaves.rawUnfiltered":
      return { metric: "brainwaves", labels: ["rawUnfiltered"], atomic: false };
    case "brainwaves.powerByBand":
      return { metric: "brainwaves", labels: ["powerByBand"], atomic: false };
    case "brainwaves.psd":
      return { metric: "brainwaves", labels: ["psd"], atomic: false };
    case "calm":
      return { metric: "awareness", labels: ["calm"], atomic: false };
    case "focus":
      return { metric: "awareness", labels: ["focus"], atomic: false };
    case "signalQuality":
      return {
        metric: "signalQuality",
        labels: getLabels("signalQuality"),
        atomic: true
      };
    case "signalQualityV2":
      return {
        metric: "signalQualityV2",
        labels: getLabels("signalQualityV2"),
        atomic: true
      };
    case "accelerometer":
      return {
        metric: "accelerometer",
        labels: getLabels("accelerometer"),
        atomic: true
      };
    default:
      throw new Error(`Unknown batch metric name: ${name}`);
  }
}

/**
 * @internal
 *
 * Subscribes to multiple metrics at once, sharing a single `whileOnline`
 * status source so all metrics go offline/online together.
 *
 * Each emission is a `BatchMetricEmission` identifying which metric it
 * came from. All underlying RTDB listeners are cleaned up on unsubscribe.
 */
export function getBatchCloudMetrics(
  dependencies: {
    options: any;
    cloudClient: any;
    onDeviceChange: () => Observable<DeviceInfo>;
    status: () => Observable<any>;
  },
  metricNames: BatchMetricName[]
): Observable<BatchMetricEmission> {
  const { options, cloudClient, onDeviceChange, status } = dependencies;

  if (!metricNames || metricNames.length === 0) {
    return throwError(
      () => new Error("At least one metric name is required for batch subscribe.")
    );
  }

  // Resolve and validate all metrics up front so errors surface synchronously
  // via the observable error channel.
  const configs: Array<{ name: BatchMetricName; config: MetricConfig }> = [];
  for (const name of metricNames) {
    let config: MetricConfig;
    try {
      config = resolveMetricConfig(name);
    } catch (err) {
      return throwError(() => err);
    }

    const validationError = validate(config.metric, config.labels, options);
    if (validationError) {
      return throwError(() => validationError);
    }

    configs.push({ name, config });
  }

  // Call status() once so every metric shares the same status$ source.
  // This guarantees that when the device goes offline, ALL metrics stop
  // emitting at the same time (no mixed online/offline state).
  const sharedStatus$ = status();

  return onDeviceChange().pipe(
    switchMap((device: DeviceInfo) => {
      if (!device) {
        return EMPTY;
      }

      const metricObservables = configs.map(({ name, config }) => {
        const rawMetric$ = new Observable<any>((observer) => {
          const subscriptions = config.atomic
            ? [
                cloudClient.metrics.subscribe({
                  metric: config.metric,
                  labels: config.labels,
                  atomic: config.atomic
                })
              ]
            : config.labels.map((label) =>
                cloudClient.metrics.subscribe({
                  metric: config.metric,
                  labels: [label],
                  atomic: config.atomic
                })
              );

          const subscriptionWithListeners = subscriptions.map(
            (subscription) => ({
              subscription,
              listener: cloudClient.metrics.on(
                subscription,
                (...data: any) => {
                  observer.next(...data);
                }
              )
            })
          );

          // Teardown: unsubscribe all RTDB listeners when the outer
          // observable is unsubscribed.
          return () => {
            subscriptionWithListeners.forEach(
              ({ subscription, listener }) => {
                cloudClient.metrics.unsubscribe(subscription, listener);
              }
            );
          };
        });

        // Derive the label for the emission wrapper.
        // For single-label metrics (calm, focus, brainwaves.raw, etc.) use
        // the label directly. For multi-label atomic metrics use the
        // user-facing batch metric name (e.g. "signalQuality").
        const emissionLabel =
          config.labels.length === 1 ? config.labels[0] : name;

        return rawMetric$.pipe(
          whileOnline({
            status$: sharedStatus$,
            allowWhileOnSleepMode: false
          }),
          map((data) => ({
            metric: config.metric,
            label: emissionLabel,
            data,
            timestamp: Date.now()
          }))
        );
      });

      return merge(...metricObservables);
    })
  );
}
