/**
 * Metrics module – extracted from Neurosity.ts.
 *
 * Provides:
 *   - {@link createMetricObservable}: generic factory that wires up
 *     permission checking + wifi/bluetooth streaming-mode routing.
 *   - A mixin that attaches the metric methods (calm, focus, brainwaves,
 *     signalQuality, signalQualityV2, accelerometer) to the Neurosity class.
 *
 * The public API of `Neurosity` is unchanged – external callers see no
 * difference.
 */

import { Observable, throwError } from "rxjs";
import { switchMap } from "rxjs/operators";

import { withPermissionCheck } from "../utils/withPermissionCheck";
import { getCloudMetric } from "../utils/metrics";
import { getLabels } from "../utils/subscription";
import * as errors from "../utils/errors";
import * as platform from "../utils/platform";

import { Calm } from "../types/calm";
import { Focus } from "../types/focus";
import { SignalQuality } from "../types/signalQuality";
import { SignalQualityV2 } from "../types/signalQualityV2";
import { Accelerometer } from "../types/accelerometer";
import {
  BrainwavesLabel,
  Epoch,
  PowerByBand,
  PSD
} from "../types/brainwaves";
import { DeviceInfo } from "../types/deviceInfo";

import type { CloudClient } from "../api/index";
import type { BluetoothClient } from "../api/bluetooth";
import type { SDKOptions } from "../types/options";

// ---------------------------------------------------------------------------
// Minimal host interface – the subset of Neurosity members the mixin needs.
// Kept private to this module.
// ---------------------------------------------------------------------------

interface NeurosityMetricsHost {
  cloudClient: CloudClient;
  bluetoothClient: BluetoothClient;
  options: SDKOptions;
  onDeviceChange(): Observable<DeviceInfo>;
  status(): Observable<any>;
  _withStreamingModeObservable(streams: {
    wifi: () => Observable<any>;
    bluetooth: () => Observable<any>;
  }): Observable<any>;
  _getCloudMetricDependencies(): {
    options: SDKOptions;
    cloudClient: CloudClient;
    onDeviceChange: () => Observable<DeviceInfo>;
    status: () => Observable<any>;
  };
}

// ---------------------------------------------------------------------------
// createMetricObservable – generic metric factory
// ---------------------------------------------------------------------------

/**
 * Configuration for a simple metric that just streams from cloud/bluetooth.
 */
export interface SimpleMetricConfig {
  /** Metric name used for permission lookup and cloud subscription. */
  metric: string;
  /** Override the scope name used for permission lookup (defaults to `metric`). */
  permissionScope?: string;
  /** Labels to subscribe to (defaults to `getLabels(metric)`). */
  labels?: string[];
  /** Whether to treat the subscription as atomic (defaults to `true`). */
  atomic?: boolean;
  /** Factory for the Bluetooth-side observable. */
  bluetooth?: (bt: BluetoothClient) => Observable<any>;
}

/**
 * Configuration for a metric whose availability depends on the device
 * model version (e.g. accelerometer).
 */
export interface DeviceDependentMetricConfig extends SimpleMetricConfig {
  /** Returns `true` when the given model version supports this metric. */
  supportsModel: (modelVersion: string) => boolean;
}

/**
 * Configuration for a fully custom metric (e.g. brainwaves) where the
 * caller supplies the wifi observable factory.
 */
export interface CustomMetricConfig {
  /** Metric name used for permission lookup. */
  metric: string;
  /** Override the scope name used for permission lookup (defaults to `metric`). */
  permissionScope?: string;
  /** Factory for the cloud (wifi) observable. */
  wifi: (deps: ReturnType<NeurosityMetricsHost["_getCloudMetricDependencies"]>) => Observable<any>;
  /** Factory for the Bluetooth observable. */
  bluetooth: (bt: BluetoothClient) => Observable<any>;
}

/**
 * Generic factory that encapsulates the common pattern shared by every
 * metric method:
 *
 * 1. Check scope-based permission → `throwError` on failure
 * 2. Route to wifi (`getCloudMetric`) or bluetooth (`bluetoothClient`)
 *    via `_withStreamingModeObservable`
 *
 * For metrics that need extra device-level validation (like accelerometer),
 * pass a {@link DeviceDependentMetricConfig}. For metrics that need full
 * control over the wifi factory, pass a {@link CustomMetricConfig}.
 *
 * @param host - The `Neurosity` instance (or any object satisfying
 *               {@link NeurosityMetricsHost})
 * @param config - Metric configuration
 * @returns An `Observable` that emits metric data
 */
export function createMetricObservable(
  host: NeurosityMetricsHost,
  config: SimpleMetricConfig | DeviceDependentMetricConfig | CustomMetricConfig
): Observable<any> {
  const {
    metric,
    permissionScope = metric
  } = config;

  return withPermissionCheck(
    host.cloudClient.userClaims,
    permissionScope,
    () => {
      const isCustom = "wifi" in config;
      const isDeviceDep = "supportsModel" in config;

      if (isCustom) {
        const customConfig = config as CustomMetricConfig;
        return host._withStreamingModeObservable({
          wifi: () => customConfig.wifi(host._getCloudMetricDependencies()),
          bluetooth: () => customConfig.bluetooth(host.bluetoothClient)
        });
      }

      const simpleConfig = config as SimpleMetricConfig | DeviceDependentMetricConfig;
      const labels = simpleConfig.labels ?? getLabels(metric);
      const atomic = simpleConfig.atomic ?? true;

      if (isDeviceDep) {
        const deviceConfig = config as DeviceDependentMetricConfig;
        return host.onDeviceChange().pipe(
          switchMap((selectedDevice: DeviceInfo | null) => {
            const modelVersion =
              selectedDevice?.modelVersion || platform.MODEL_VERSION_1;

            if (!deviceConfig.supportsModel(modelVersion)) {
              return throwError(() =>
                errors.metricNotSupportedByModel(metric, modelVersion)
              );
            }

            return host._withStreamingModeObservable({
              wifi: () =>
                getCloudMetric(host._getCloudMetricDependencies(), {
                  metric,
                  labels,
                  atomic
                }),
              bluetooth: () =>
                deviceConfig.bluetooth
                  ? deviceConfig.bluetooth(host.bluetoothClient)
                  : (host.bluetoothClient as any)[metric]()
            });
          })
        );
      }

      // Simple metric
      return host._withStreamingModeObservable({
        wifi: () =>
          getCloudMetric(host._getCloudMetricDependencies(), {
            metric,
            labels,
            atomic
          }),
        bluetooth: () =>
          simpleConfig.bluetooth
            ? simpleConfig.bluetooth(host.bluetoothClient)
            : (host.bluetoothClient as any)[metric]()
      });
    },
    "observable"
  );
}

// ---------------------------------------------------------------------------
// Mixin – attaches metric methods to the Neurosity prototype
// ---------------------------------------------------------------------------

/**
 * Public metric methods added to `Neurosity` via the mixin.
 * These declarations are merged into the `Neurosity` class interface
 * so TypeScript recognises them as regular instance methods.
 */
export interface NeurosityMetricsMixin {
  calm(): Observable<Calm>;
  focus(): Observable<Focus>;
  brainwaves(label: BrainwavesLabel): Observable<Epoch | PowerByBand | PSD>;
  signalQuality(): Observable<SignalQuality>;
  signalQualityV2(): Observable<SignalQualityV2>;
  accelerometer(): Observable<Accelerometer>;
}

type NeurosityConstructor = new (...args: any[]) => {};

/**
 * Applies the metrics mixin to the Neurosity class.
 * Called once at module load time.
 */
export function applyMetricsMixin<T extends NeurosityConstructor>(
  NeurosityClass: T
): T & (new (...args: any[]) => NeurosityMetricsMixin) {
  const proto = NeurosityClass.prototype as any;

  // ----- calm -----
  proto.calm = function (this: NeurosityMetricsHost): Observable<Calm> {
    return createMetricObservable(this, {
      metric: "awareness",
      permissionScope: "calm",
      labels: ["calm"],
      atomic: false,
      bluetooth: (bt) => bt.calm()
    });
  };

  // ----- focus -----
  proto.focus = function (this: NeurosityMetricsHost): Observable<Focus> {
    return createMetricObservable(this, {
      metric: "awareness",
      permissionScope: "focus",
      labels: ["focus"],
      atomic: false,
      bluetooth: (bt) => bt.focus()
    });
  };

  // ----- brainwaves -----
  proto.brainwaves = function (
    this: NeurosityMetricsHost,
    label: BrainwavesLabel
  ): Observable<Epoch | PowerByBand | PSD> {
    return createMetricObservable(this, {
      metric: "brainwaves",
      permissionScope: "brainwaves",
      wifi: (deps) =>
        getCloudMetric(deps, {
          metric: "brainwaves",
          labels: label ? [label] : [],
          atomic: false
        }),
      bluetooth: (bt) => bt.brainwaves(label)
    });
  };

  // ----- signalQuality -----
  proto.signalQuality = function (
    this: NeurosityMetricsHost
  ): Observable<SignalQuality> {
    return createMetricObservable(this, {
      metric: "signalQuality",
      labels: getLabels("signalQuality"),
      atomic: true,
      bluetooth: (bt) => bt.signalQuality()
    });
  };

  // ----- signalQualityV2 -----
  proto.signalQualityV2 = function (
    this: NeurosityMetricsHost
  ): Observable<SignalQualityV2> {
    return createMetricObservable(this, {
      metric: "signalQualityV2",
      permissionScope: "signalQuality", // Reuse same scope
      labels: getLabels("signalQualityV2"),
      atomic: true,
      bluetooth: (bt) => bt.signalQualityV2()
    });
  };

  // ----- accelerometer -----
  proto.accelerometer = function (
    this: NeurosityMetricsHost
  ): Observable<Accelerometer> {
    return createMetricObservable(this, {
      metric: "accelerometer",
      labels: getLabels("accelerometer"),
      atomic: true,
      supportsModel: platform.supportsAccel,
      bluetooth: (bt) => bt.accelerometer()
    } as DeviceDependentMetricConfig);
  };

  return NeurosityClass as any;
}
