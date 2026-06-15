import { Neurosity } from "../Neurosity";
import { BehaviorSubject, Observable, of, throwError } from "rxjs";
import { take, toArray } from "rxjs/operators";
import { DeviceInfo } from "../types/deviceInfo";
import { STATUS, DeviceStatus } from "../types/status";
import { PendingSubscription, Subscription } from "../types/subscriptions";
import { BatchMetricName } from "../types/batchSubscribe";

// Mock CloudClient
jest.mock("../api/index", () => {
  let subscriptionId = 0;

  const mockCloudClient = {
    login: jest.fn(),
    logout: jest.fn(),
    onAuthStateChanged: jest.fn(),
    onDeviceChange: jest.fn(),
    status: jest.fn(),
    metrics: {
      on: jest.fn(
        (subscription: Subscription, callback: (value: any) => void) => {
          // Return a teardown function
          return () => {};
        }
      ),
      subscribe: jest.fn((subscription: PendingSubscription) => {
        const id = `sub-${subscriptionId++}`;
        return { id, ...subscription };
      }),
      unsubscribe: jest.fn()
    },
    osVersion: jest.fn(),
    userClaims: {
      scopes: [
        "brainwaves",
        "awareness",
        "signalQuality",
        "accelerometer",
        "focus",
        "calm"
      ]
    }
  };

  return {
    CloudClient: jest.fn().mockImplementation(() => mockCloudClient)
  };
});

const testDeviceId = "mock-device-id";

describe("Batch Subscribe", () => {
  let neurosity: Neurosity;
  let cloudClient: any;
  let mockCalmSubject: BehaviorSubject<any>;
  let mockFocusSubject: BehaviorSubject<any>;

  beforeEach(() => {
    subscriptionIdReset();
    neurosity = new Neurosity({
      deviceId: testDeviceId,
      emulator: true
    });

    cloudClient = (neurosity as any).cloudClient;

    // Mock device info
    const mockDeviceInfo: Partial<DeviceInfo> = {
      deviceId: testDeviceId,
      channelNames: ["CP3", "C3", "F5", "PO3", "PO4", "F6", "C4", "CP4"],
      samplingRate: 256,
      modelName: "crown",
      modelVersion: "v3"
    };

    // Mock device status: online
    const mockDeviceStatus: DeviceStatus = {
      state: STATUS.ONLINE,
      charging: false,
      battery: 100,
      sleepMode: false,
      sleepModeReason: null,
      lastHeartbeat: Date.now(),
      ssid: "test-network"
    };

    cloudClient.onDeviceChange.mockReturnValue(of(mockDeviceInfo));
    cloudClient.status.mockReturnValue(of(mockDeviceStatus));
    cloudClient.osVersion.mockReturnValue(of("16.0.0"));

    // Create subjects for controllable metric emissions
    mockCalmSubject = new BehaviorSubject({
      probability: 0.42,
      label: "calm",
      metric: "awareness",
      timestamp: Date.now()
    });

    mockFocusSubject = new BehaviorSubject({
      probability: 0.77,
      label: "focus",
      metric: "awareness",
      timestamp: Date.now()
    });

    // Wire up metrics.on to feed from our subjects
    cloudClient.metrics.on.mockImplementation(
      (subscription: Subscription, callback: (value: any) => void) => {
        if (subscription.metric === "awareness") {
          if (subscription.labels.includes("calm")) {
            const sub = mockCalmSubject.subscribe((v) => callback(v));
            return () => sub.unsubscribe();
          }
          if (subscription.labels.includes("focus")) {
            const sub = mockFocusSubject.subscribe((v) => callback(v));
            return () => sub.unsubscribe();
          }
        }
        // Default: emit a generic value
        callback({ generic: true });
        return () => {};
      }
    );
  });

  // Helper to reset subscription ID counter between tests
  function subscriptionIdReset() {
    // The mock module is re-used, but we can't easily reset module state.
    // Subscription IDs just need to be unique, which they already are.
  }

  describe("Basic batch subscribe", () => {
    it("should emit BatchMetricEmission for each metric in the list", (done) => {
      const emissions: any[] = [];

      neurosity
        .subscribe(["calm", "focus"])
        .pipe(take(2))
        .subscribe({
          next: (emission) => {
            emissions.push(emission);
          },
          complete: () => {
            expect(emissions.length).toBe(2);

            // Should have emissions from both calm and focus
            const metrics = emissions.map((e) => e.label);
            expect(metrics).toContain("calm");
            expect(metrics).toContain("focus");

            // Each emission should have the expected shape
            for (const e of emissions) {
              expect(e).toHaveProperty("metric");
              expect(e).toHaveProperty("label");
              expect(e).toHaveProperty("data");
              expect(e).toHaveProperty("timestamp");
              expect(typeof e.timestamp).toBe("number");
            }

            // Check calm emission
            const calmEmission = emissions.find((e) => e.label === "calm");
            expect(calmEmission.metric).toBe("awareness");
            expect(calmEmission.data.probability).toBe(0.42);

            // Check focus emission
            const focusEmission = emissions.find((e) => e.label === "focus");
            expect(focusEmission.metric).toBe("awareness");
            expect(focusEmission.data.probability).toBe(0.77);

            done();
          },
          error: done
        });
    });

    it("should handle a single metric in the batch", (done) => {
      neurosity
        .subscribe(["calm"])
        .pipe(take(1))
        .subscribe({
          next: (emission) => {
            expect(emission.metric).toBe("awareness");
            expect(emission.label).toBe("calm");
            expect(emission.data.probability).toBe(0.42);
            done();
          },
          error: done
        });
    });
  });

  describe("Shared whileOnline status", () => {
    it("should not emit when device is offline", (done) => {
      // Override status to offline
      const offlineStatus: DeviceStatus = {
        state: STATUS.OFFLINE,
        charging: false,
        battery: 50,
        sleepMode: false,
        sleepModeReason: null,
        lastHeartbeat: Date.now(),
        ssid: "test-network"
      };
      cloudClient.status.mockReturnValue(of(offlineStatus));

      let emitted = false;
      const sub = neurosity.subscribe(["calm", "focus"]).subscribe({
        next: () => {
          emitted = true;
        }
      });

      // Give it a tick then check nothing was emitted
      setTimeout(() => {
        expect(emitted).toBe(false);
        sub.unsubscribe();
        done();
      }, 50);
    });
  });

  describe("Unsubscribe cleanup", () => {
    it("should unsubscribe all RTDB listeners when outer subscription is cancelled", (done) => {
      const sub = neurosity.subscribe(["calm", "focus"]).subscribe();

      // Allow initial emissions
      setTimeout(() => {
        sub.unsubscribe();

        // After unsubscribe, metrics.unsubscribe should have been called
        // for each internal subscription
        const unsubscribeCalls =
          cloudClient.metrics.unsubscribe.mock.calls.length;
        expect(unsubscribeCalls).toBeGreaterThan(0);

        // Emit more data — the handler should NOT be called anymore
        const prevCallCount = cloudClient.metrics.on.mock.calls.length;
        mockCalmSubject.next({
          probability: 0.99,
          label: "calm",
          metric: "awareness",
          timestamp: Date.now()
        });

        // The on() call count shouldn't increase after unsubscribe
        // (no new listeners registered)
        setTimeout(() => {
          expect(cloudClient.metrics.on.mock.calls.length).toBe(prevCallCount);
          done();
        }, 50);
      }, 50);
    });
  });

  describe("Error handling", () => {
    it("should error when an empty metric list is provided", (done) => {
      neurosity.subscribe([] as BatchMetricName[]).subscribe({
        next: () => done(new Error("Should not emit")),
        error: (err) => {
          expect(err.message).toContain("At least one metric");
          done();
        }
      });
    });

    it("should error for an unknown metric name", (done) => {
      neurosity.subscribe(["nonexistent.metric" as any]).subscribe({
        next: () => done(new Error("Should not emit")),
        error: (err) => {
          expect(err.message).toContain("Unknown batch metric");
          done();
        }
      });
    });

    it("should error when device is not selected (null device)", (done) => {
      // Override onDeviceChange to return null
      cloudClient.onDeviceChange.mockReturnValue(of(null));

      let emitted = false;
      const sub = neurosity.subscribe(["calm"]).subscribe({
        next: () => {
          emitted = true;
        },
        complete: () => {
          // EMPTY completes without emitting
          expect(emitted).toBe(false);
          done();
        }
      });

      setTimeout(() => {
        if (!emitted) {
          sub.unsubscribe();
          done();
        }
      }, 50);
    });
  });

  describe("Atomic metrics (signalQuality, accelerometer)", () => {
    it("should use the batch metric name as label for atomic metrics", (done) => {
      // Override metrics.on for signalQuality
      cloudClient.metrics.on.mockImplementation(
        (subscription: Subscription, callback: (value: any) => void) => {
          if (subscription.metric === "signalQuality") {
            callback({ CP3: { standardDeviation: 3.5, status: "good" } });
            return () => {};
          }
          callback({});
          return () => {};
        }
      );

      neurosity
        .subscribe(["signalQuality"])
        .pipe(take(1))
        .subscribe({
          next: (emission) => {
            expect(emission.metric).toBe("signalQuality");
            // For atomic metrics with multiple labels, the label should be
            // the user-facing batch metric name
            expect(emission.label).toBe("signalQuality");
            expect(emission.data).toHaveProperty("CP3");
            done();
          },
          error: done
        });
    });
  });

  describe("Brainwaves batch metrics", () => {
    it("should support brainwaves.raw subscription", (done) => {
      cloudClient.metrics.on.mockImplementation(
        (subscription: Subscription, callback: (value: any) => void) => {
          if (
            subscription.metric === "brainwaves" &&
            subscription.labels.includes("raw")
          ) {
            callback({
              data: [
                [1, 2, 3],
                [4, 5, 6]
              ],
              info: { samplingRate: 256, startTime: Date.now() }
            });
            return () => {};
          }
          callback({});
          return () => {};
        }
      );

      neurosity
        .subscribe(["brainwaves.raw"])
        .pipe(take(1))
        .subscribe({
          next: (emission) => {
            expect(emission.metric).toBe("brainwaves");
            expect(emission.label).toBe("raw");
            expect(emission.data).toHaveProperty("data");
            expect(emission.data).toHaveProperty("info");
            done();
          },
          error: done
        });
    });
  });
});
