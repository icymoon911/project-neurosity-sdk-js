import { Observable, throwError } from "rxjs";
import { switchMap } from "rxjs/operators";

import { getCloudMetric } from "../utils/metrics";
import { validateScopeBasedPermissionForFunctionName } from "../utils/permissions";
import { getLabels } from "../utils/subscription";
import * as errors from "../utils/errors";
import * as platform from "../utils/platform";
import { DeviceInfo } from "../types/deviceInfo";

/**
 * Minimal context required by metric factory functions.
 * The Neurosity class satisfies this interface.
 */
export interface MetricContext {
  /** Exposed user claims for permission checks (avoids exposing protected cloudClient) */
  userClaims: any;
  options: any;
  bluetoothClient?: any;
  onDeviceChange(): Observable<DeviceInfo>;
  status(): Observable<any>;
  _withStreamingModeObservable<T>(streams: {
    wifi: () => Observable<T>;
    bluetooth: () => Observable<T>;
  }): Observable<T>;
  _getCloudMetricDependencies(): any;
}

/**
 * Configuration for creating a standard metric Observable via the factory.
 */
export interface MetricConfig {
  /** The metric name as understood by getCloudMetric (e.g. "awareness", "signalQuality") */
  metric: string;
  /** Labels to filter the metric by */
  labels: string[];
  /** Whether to use atomic subscription mode */
  atomic: boolean;
  /** The scope name for permission check. Defaults to `metric` if omitted. */
  scopeName?: string;
  /** Bluetooth getter for the metric. Falls back to WiFi only if omitted. */
  bluetoothGetter?: () => Observable<any>;
}

/**
 * Factory function that encapsulates the common metric Observable pattern:
 * 1. Permission check via scope-based validation
 * 2. WiFi/Bluetooth routing via `_withStreamingModeObservable`
 * 3. Cloud metric subscription via `getCloudMetric`
 *
 * Adding a new metric becomes a one-liner:
 * ```typescript
 * return createMetricObservable(this, {
 *   metric: "awareness",
 *   labels: ["calm"],
 *   atomic: false,
 *   scopeName: "calm",
 *   bluetoothGetter: () => this.bluetoothClient.calm()
 * });
 * ```
 */
export function createMetricObservable<T>(
  context: MetricContext,
  config: MetricConfig
): Observable<T> {
  const {
    metric,
    labels,
    atomic,
    scopeName = metric,
    bluetoothGetter
  } = config;

  const [hasOAuthError, OAuthError] = validateScopeBasedPermissionForFunctionName(
    context.userClaims,
    scopeName
  );

  if (hasOAuthError) {
    return throwError(() => OAuthError);
  }

  const wifiGetter = () =>
    getCloudMetric(context._getCloudMetricDependencies(), {
      metric,
      labels,
      atomic
    });

  if (bluetoothGetter) {
    return context._withStreamingModeObservable<T>({
      wifi: wifiGetter,
      bluetooth: bluetoothGetter
    });
  }

  return wifiGetter();
}

/**
 * Specialized factory for the accelerometer metric, which requires a
 * device model version check before subscribing.
 */
export function createAccelerometerObservable<T>(
  context: MetricContext,
  config: MetricConfig
): Observable<T> {
  const { metric, labels, atomic, scopeName = metric } = config;

  const [hasOAuthError, OAuthError] = validateScopeBasedPermissionForFunctionName(
    context.userClaims,
    scopeName
  );

  if (hasOAuthError) {
    return throwError(() => OAuthError);
  }

  return context.onDeviceChange().pipe(
    switchMap((selectedDevice: DeviceInfo | null) => {
      const modelVersion =
        selectedDevice?.modelVersion || platform.MODEL_VERSION_1;
      const supportsAccel = platform.supportsAccel(modelVersion);

      if (!supportsAccel) {
        return throwError(() =>
          errors.metricNotSupportedByModel(metric, modelVersion)
        );
      }

      return context._withStreamingModeObservable<T>({
        wifi: () =>
          getCloudMetric(context._getCloudMetricDependencies(), {
            metric,
            labels,
            atomic
          }),
        bluetooth: () => context.bluetoothClient.accelerometer()
      });
    })
  );
}
