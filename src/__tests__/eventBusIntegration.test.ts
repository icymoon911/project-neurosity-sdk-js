/// <reference types="node" />

import { Neurosity } from "../Neurosity";
import { of, ReplaySubject } from "rxjs";
import { STATUS } from "../types/status";
import { DeviceInfo } from "../types/deviceInfo";
import { SDKConnectEvent, SDKDeviceChangeEvent, SDKAuthStateChangeEvent } from "../types/events";

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

// Mock CloudClient — we use a real-ish mock that actually invokes setEventBus
jest.mock("../api", () => {
  const originalModule = jest.requireActual("../api");

  class MockCloudClient {
    public user = null;
    public userClaims = {};
    protected options: any;
    public subscriptionManager = {
      add: jest.fn(),
      remove: jest.fn(),
      removeAll: jest.fn()
    };
    private _selectedDevice = new ReplaySubject<DeviceInfo | null | undefined>(1);
    private _eventBus: any = null;
    private _previousDevice: DeviceInfo | null = null;

    constructor(options: any) {
      this.options = options;
      this._selectedDevice.next(undefined);
    }

    setEventBus = jest.fn().mockImplementation((bus: any) => {
      this._eventBus = bus;
    });

    login = jest.fn().mockImplementation(async () => {
      // Simulate login: emit authStateChange and connect events
      if (this._eventBus) {
        this._eventBus.emit("authStateChange", {
          user: { uid: "test-uid" },
          type: "login"
        });
        this._eventBus.emit("connect", {
          deviceId: "test-device-id"
        });
      }
      return {};
    });

    logout = jest.fn().mockImplementation(async () => {
      if (this._eventBus) {
        this._eventBus.emit("authStateChange", {
          user: null,
          type: "logout"
        });
        this._eventBus.emit("disconnect", {
          deviceId: "test-device-id",
          reason: "logout"
        });
      }
      return {};
    });

    disconnect = jest.fn().mockImplementation(async () => {
      if (this._eventBus) {
        this._eventBus.emit("disconnect", {
          deviceId: "test-device-id",
          reason: "manual"
        });
      }
      return {};
    });

    /**
     * Simulate a device change event from inside CloudClient.
     * This is normally triggered by the _selectedDevice subscription.
     */
    simulateDeviceChange(currentDevice: DeviceInfo | null) {
      if (this._eventBus) {
        this._eventBus.emit("deviceChange", {
          previousDevice: this._previousDevice,
          currentDevice
        });
      }
      this._previousDevice = currentDevice;
    }

    getInfo = jest.fn().mockResolvedValue({});
    selectDevice = jest.fn().mockResolvedValue({});
    didSelectDevice = jest.fn().mockResolvedValue(true);
    onDeviceChange = jest.fn().mockReturnValue(of(null));
    osVersion = jest.fn().mockReturnValue(of("1.0.0"));
    status = jest.fn().mockReturnValue(of({ state: STATUS.ONLINE }));
    metrics = {
      subscribe: jest.fn().mockReturnValue({}),
      on: jest.fn().mockReturnValue(jest.fn()),
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

describe("Neurosity event bus integration (on/off)", () => {
  let neurosity: Neurosity;

  beforeEach(() => {
    jest.clearAllMocks();
    neurosity = new Neurosity({
      deviceId: "test-device-id",
      emulator: true
    });

    neurosity["_osHasBluetoothSupport"] = jest.fn().mockReturnValue(of(false));
  });

  describe("on()", () => {
    test("should register handler that receives connect events", async () => {
      const handler = jest.fn();
      neurosity.on("connect", handler);

      // Trigger login which emits connect event
      await neurosity.login({ email: "test@test.com", password: "test" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: "test-device-id"
        })
      );
    });

    test("should register handler that receives authStateChange events", async () => {
      const handler = jest.fn();
      neurosity.on("authStateChange", handler);

      await neurosity.login({ email: "test@test.com", password: "test" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "login",
          user: expect.objectContaining({ uid: "test-uid" })
        })
      );
    });

    test("should register handler that receives disconnect events", async () => {
      const handler = jest.fn();
      neurosity.on("disconnect", handler);

      await neurosity.disconnect();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "manual"
        })
      );
    });

    test("should register handler that receives deviceChange events", () => {
      const handler = jest.fn();
      neurosity.on("deviceChange", handler);

      // Simulate device change from inside CloudClient
      const mockDevice: DeviceInfo = {
        deviceId: "new-device",
        deviceNickname: "New Device",
        channelNames: ["CH1"],
        channels: 1,
        samplingRate: 250,
        manufacturer: "Neurosity",
        model: "Crown",
        modelName: "Crown",
        modelVersion: "v1",
        apiVersion: "1.0.0",
        osVersion: "1.0.0",
        emulator: false
      };

      (neurosity["cloudClient"] as any).simulateDeviceChange(mockDevice);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          previousDevice: null,
          currentDevice: mockDevice
        })
      );
    });
  });

  describe("off()", () => {
    test("should stop receiving events after off()", async () => {
      const handler = jest.fn();
      neurosity.on("connect", handler);
      neurosity.off("connect", handler);

      await neurosity.login({ email: "test@test.com", password: "test" });

      expect(handler).not.toHaveBeenCalled();
    });

    test("should only remove the specified handler", async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      neurosity.on("connect", handler1);
      neurosity.on("connect", handler2);
      neurosity.off("connect", handler1);

      await neurosity.login({ email: "test@test.com", password: "test" });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("multiple event types", () => {
    test("should handle multiple event types independently", async () => {
      const connectHandler = jest.fn();
      const authHandler = jest.fn();
      const disconnectHandler = jest.fn();

      neurosity.on("connect", connectHandler);
      neurosity.on("authStateChange", authHandler);
      neurosity.on("disconnect", disconnectHandler);

      await neurosity.login({ email: "test@test.com", password: "test" });

      expect(connectHandler).toHaveBeenCalledTimes(1);
      expect(authHandler).toHaveBeenCalledTimes(1);
      expect(disconnectHandler).not.toHaveBeenCalled();

      await neurosity.logout();

      expect(authHandler).toHaveBeenCalledTimes(2); // login + logout
      expect(disconnectHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("setEventBus integration", () => {
    test("should call setEventBus on CloudClient during construction", () => {
      expect(neurosity["cloudClient"].setEventBus).toHaveBeenCalledTimes(1);
      expect(neurosity["cloudClient"].setEventBus).toHaveBeenCalledWith(
        expect.any(Object)
      );
    });
  });
});
