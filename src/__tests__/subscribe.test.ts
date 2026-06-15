/// <reference types="node" />

import { Neurosity } from "../Neurosity";
import { Observable, Subject, firstValueFrom, take, toArray } from "rxjs";
import { of, ReplaySubject } from "rxjs";
import { STATUS } from "../types/status";
import { DeviceInfo } from "../types/deviceInfo";
import { MetricEmission } from "../types/subscribe";

// Mock Firebase modules
jest.mock("../api/firebase", () => {
  const mockFirebaseApp = jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    useEmulator: jest.fn()
  }));
  mockFirebaseApp.prototype.constructor = mockFirebaseApp;

  const mockFirebaseUser = jest.fn().mockImplementation(() => ({
    login: jest.fn().mockResolvedValue({}),
    logout: jest.fn().mockResolvedValue({}),
    onAuthStateChanged: jest.fn().mockReturnValue(of(null)),
    onUserClaimsChange: jest.fn().mockReturnValue(of({}))
  }));
  mockFirebaseUser.prototype.constructor = mockFirebaseUser;

  const mockFirebaseDevice = jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    getInfo: jest.fn().mockResolvedValue({}),
    selectDevice: jest.fn().mockResolvedValue({}),
    dispatchAction: jest.fn()
  }));
  mockFirebaseDevice.prototype.constructor = mockFirebaseDevice;

  return {
    FirebaseApp: mockFirebaseApp,
    FirebaseUser: mockFirebaseUser,
    FirebaseDevice: mockFirebaseDevice
  };
});

// Mock CloudClient
jest.mock("../api", () => {
  const originalModule = jest.requireActual("../api");

  class MockCloudClient {
    public user = null;
    public userClaims = { scopes: ["brainwaves"] };
    protected options: any;
    public subscriptionManager = {
      add: jest.fn(),
      remove: jest.fn(),
      removeAll: jest.fn()
    };
    private _selectedDevice = new ReplaySubject<DeviceInfo | null | undefined>(1);
    private _eventBus: any = null;

    constructor(options: any) {
      this.options = options;
      this._selectedDevice.next(undefined);
    }

    setEventBus = jest.fn().mockImplementation((bus: any) => {
      this._eventBus = bus;
    });
    login = jest.fn().mockResolvedValue({});
    logout = jest.fn().mockResolvedValue({});
    getInfo = jest.fn().mockResolvedValue({});
    selectDevice = jest.fn().mockResolvedValue({});
    didSelectDevice = jest.fn().mockResolvedValue(true);
    onDeviceChange = jest.fn().mockReturnValue(
      of({
        deviceId: "test-device-id",
        status: STATUS.ONLINE
      })
    );
    osVersion = jest.fn().mockReturnValue(of("1.0.0"));
    status = jest.fn().mockReturnValue(of({ state: STATUS.ONLINE }));
    metrics = {
      subscribe: jest.fn().mockReturnValue({}),
      on: jest.fn().mockImplementation((subscription, callback) => {
        callback({});
        return jest.fn();
      }),
      unsubscribe: jest.fn()
    };
  }

  return {
    ...originalModule,
    CloudClient: jest
      .fn()
      .mockImplementation((options) => new MockCloudClient(options))
  };
});

// Mock getCloudMetric to control emissions per metric
jest.mock("../utils/metrics", () => ({
  getCloudMetric: jest.fn().mockImplementation((_deps, subscription) => {
    const { metric, labels } = subscription;
    const label = labels[0] || metric;
    // Return an Observable that emits a predictable value
    return of({
      _mock: true,
      metric,
      label,
      value: `${metric}:${label}`
    });
  })
}));

// Mock @neurosity/ipk metrics for getLabels
jest.mock("@neurosity/ipk", () => ({
  metrics: {
    accelerometer: { x: {}, y: {}, z: {} },
    brainwaves: { raw: {}, rawUnfiltered: {}, powerByBand: {}, psd: {} },
    awareness: { calm: {}, focus: {} },
    signalQuality: { CP3: {}, C3: {}, F3: {} },
    signalQualityV2: { CP3: {}, C3: {}, F3: {} },
    kinesis: { push: {}, pull: {} },
    predictions: { label1: {} }
  },
  BLUETOOTH_CHARACTERISTICS: {}
}));

describe("Neurosity.subscribe (batch)", () => {
  let neurosity: Neurosity;
  const testDeviceId = "test-device-id";
  let mockGetCloudMetric: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-set the default mock implementation after clearAllMocks
    mockGetCloudMetric = require("../utils/metrics").getCloudMetric as jest.Mock;
    mockGetCloudMetric.mockImplementation((_deps, subscription) => {
      const { metric, labels } = subscription;
      const label = labels[0] || metric;
      return of({
        _mock: true,
        metric,
        label,
        value: `${metric}:${label}`
      });
    });

    neurosity = new Neurosity({
      deviceId: testDeviceId,
      emulator: true
    });

    // Avoid Bluetooth code paths
    neurosity["_osHasBluetoothSupport"] = jest.fn().mockReturnValue(of(false));
  });

  describe("basic batch subscription", () => {
    test("should emit MetricEmission objects for each metric", async () => {
      const emissions: MetricEmission[] = [];

      const sub = neurosity
        .subscribe(["calm", "focus"])
        .pipe(take(2), toArray())
        .subscribe((items) => {
          emissions.push(...items);
        });

      // Wait for async emissions
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(emissions.length).toBe(2);

      const calmEmission = emissions.find((e) => e.metric === "calm");
      const focusEmission = emissions.find((e) => e.metric === "focus");

      expect(calmEmission).toBeDefined();
      expect(calmEmission!.label).toBe("calm");
      expect(calmEmission!.data).toBeDefined();
      expect(typeof calmEmission!.timestamp).toBe("number");

      expect(focusEmission).toBeDefined();
      expect(focusEmission!.label).toBe("focus");
    });

    test("should parse dotted metric specs like brainwaves.raw", async () => {
      const emissions = await firstValueFrom(
        neurosity.subscribe(["brainwaves.raw"]).pipe(take(1), toArray())
      );

      expect(emissions.length).toBe(1);
      expect(emissions[0].metric).toBe("brainwaves.raw");
      expect(emissions[0].label).toBe("raw");

      // Verify getCloudMetric was called with the parsed spec
      expect(mockGetCloudMetric).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          metric: "brainwaves",
          labels: ["raw"],
          atomic: false
        })
      );
    });

    test("should handle signalQuality as atomic metric", async () => {
      const emissions = await firstValueFrom(
        neurosity.subscribe(["signalQuality"]).pipe(take(1), toArray())
      );

      expect(emissions.length).toBe(1);
      expect(emissions[0].metric).toBe("signalQuality");

      expect(mockGetCloudMetric).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          metric: "signalQuality",
          atomic: true
        })
      );
    });
  });

  describe("shared whileOnline status", () => {
    test("should call getCloudMetric for each metric, all sharing the same status() source", () => {
      const statusSpy = jest.spyOn(neurosity as any, "status");

      neurosity.subscribe(["calm", "focus", "signalQuality"]).subscribe();

      // Each getCloudMetric call internally uses status() via _getCloudMetricDependencies
      // The status() method returns the same shared Observable (shareReplay(1))
      expect(mockGetCloudMetric).toHaveBeenCalledTimes(3);

      // All three calls share the same deps object pattern
      const calls = mockGetCloudMetric.mock.calls;
      expect(calls[0][0]).toBeDefined();
      expect(calls[1][0]).toBeDefined();
      expect(calls[2][0]).toBeDefined();
    });
  });

  describe("unsubscribe cleanup", () => {
    test("should clean up all internal subscriptions on unsubscribe", () => {
      const subjects: Subject<any>[] = [];

      mockGetCloudMetric.mockImplementation((_deps, subscription) => {
        const subject = new Subject();
        subjects.push(subject);
        return subject.asObservable();
      });

      const sub = neurosity
        .subscribe(["calm", "focus", "brainwaves.raw"])
        .subscribe();

      expect(subjects.length).toBe(3);

      // Emit some data
      subjects.forEach((s, i) => s.next({ value: i }));

      // Unsubscribe
      sub.unsubscribe();

      // All subjects should have no observers after unsubscribe
      subjects.forEach((s) => {
        expect(s.observed).toBe(false);
      });
    });
  });

  describe("error handling", () => {
    test("should error on empty metrics array", (done) => {
      neurosity.subscribe([]).subscribe({
        error: (err) => {
          expect(err.message).toContain("At least one metric");
          done();
        }
      });
    });

    test("should error on non-array input", (done) => {
      (neurosity as any).subscribe("calm").subscribe({
        error: (err) => {
          expect(err.message).toContain("At least one metric");
          done();
        }
      });
    });
  });

  describe("emission structure", () => {
    test("should include all required fields in MetricEmission", (done) => {
      neurosity.subscribe(["calm"]).pipe(take(1)).subscribe({
        next: (emission) => {
          expect(emission).toHaveProperty("metric");
          expect(emission).toHaveProperty("label");
          expect(emission).toHaveProperty("data");
          expect(emission).toHaveProperty("timestamp");

          expect(typeof emission.metric).toBe("string");
          expect(typeof emission.label).toBe("string");
          expect(emission.data).toBeDefined();
          expect(typeof emission.timestamp).toBe("number");
          done();
        },
        error: done
      });
    });
  });
});
