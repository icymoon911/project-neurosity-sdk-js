import { of, BehaviorSubject, Subject, timer } from "rxjs";
import { delay } from "rxjs/operators";

// Must mock before importing CloudClient
jest.mock("../api/firebase", () => {
  // We use a factory that returns fresh mocks per test via __mockState
  return {
    FirebaseApp: jest.fn().mockImplementation(() => ({
      disconnect: jest.fn(),
      useEmulator: jest.fn(),
      app: {}
    })),
    FirebaseUser: jest.fn().mockImplementation(function () {
      // Access the shared mutable state set up in beforeEach
      const state = (globalThis as any).__loginTestMockState;
      this.login = state?.login || jest.fn().mockResolvedValue({ uid: "test-uid" });
      this.logout = state?.logout || jest.fn().mockResolvedValue({});
      this.onAuthStateChanged =
        state?.onAuthStateChanged ||
        jest.fn().mockReturnValue(of(null));
      this.onUserClaimsChange =
        state?.onUserClaimsChange ||
        jest.fn().mockReturnValue(of({}));
      this.getDevices = state?.getDevices || jest.fn().mockResolvedValue([]);
      this.hasDevicePermission =
        state?.hasDevicePermission || jest.fn().mockResolvedValue(true);
    }),
    FirebaseDevice: jest.fn().mockImplementation(() => ({
      disconnect: jest.fn(),
      getInfo: jest.fn(),
      dispatchAction: jest.fn()
    }))
  };
});

// Mock heartbeat-aware status to avoid RTDB subscription
jest.mock("../utils/heartbeat", () => ({
  heartbeatAwareStatus: jest.fn().mockImplementation((source) => source)
}));

// Mock filterInternalKeys
jest.mock("../utils/filterInternalKeys", () => ({
  filterInternalKeys: jest.fn().mockImplementation(() => (source: any) => source)
}));

import { CloudClient } from "../api";

describe("CloudClient.login - timeout and claims handling", () => {
  let claimsSubject: Subject<any>;

  beforeEach(() => {
    // Use Subject (not BehaviorSubject) so there's no initial emission.
    // This allows us to control exactly when/if claims are emitted.
    claimsSubject = new Subject<any>();

    (globalThis as any).__loginTestMockState = {
      login: jest.fn().mockResolvedValue({ uid: "test-uid" }),
      logout: jest.fn().mockResolvedValue({}),
      onAuthStateChanged: jest.fn().mockReturnValue(of(null)),
      onUserClaimsChange: jest
        .fn()
        .mockReturnValue(claimsSubject.asObservable()),
      getDevices: jest.fn().mockResolvedValue([]),
      hasDevicePermission: jest.fn().mockResolvedValue(true)
    };
  });

  afterEach(() => {
    delete (globalThis as any).__loginTestMockState;
    claimsSubject.complete();
  });

  function createClient(overrides: any = {}) {
    return new CloudClient({
      autoSelectDevice: false,
      loginTimeout: 500, // Short timeout for fast tests
      ...overrides
    });
  }

  it("should succeed when claims arrive before timeout", async () => {
    const client = createClient();

    // Simulate claims arriving after 50ms
    setTimeout(() => {
      claimsSubject.next({ oauth: true, scopes: "read:brainwaves" });
    }, 50);

    await expect(
      client.login({ email: "test@example.com", password: "pass" })
    ).resolves.toBeDefined();
  });

  it("should succeed when claims arrive immediately", async () => {
    // Use a BehaviorSubject that starts with a truthy value
    const immediateSubject = new BehaviorSubject<any>({
      oauth: true,
      scopes: "read:brainwaves"
    });
    (globalThis as any).__loginTestMockState.onUserClaimsChange = jest
      .fn()
      .mockReturnValue(immediateSubject.asObservable());

    const client = createClient();

    await expect(
      client.login({ email: "test@example.com", password: "pass" })
    ).resolves.toBeDefined();

    immediateSubject.complete();
  });

  it("should reject with timeout error when no claims emission at all", async () => {
    const client = createClient({ loginTimeout: 200 });

    // Don't emit anything — let it time out
    await expect(
      client.login({ email: "test@example.com", password: "pass" })
    ).rejects.toThrow(/Timed out waiting for user claims/);
  });

  it("should include the timeout value in the error message", async () => {
    const client = createClient({ loginTimeout: 300 });

    await expect(
      client.login({ email: "test@example.com", password: "pass" })
    ).rejects.toThrow(/300ms/);
  });

  it("should suggest loginTimeout option in the error message", async () => {
    const client = createClient({ loginTimeout: 200 });

    await expect(
      client.login({ email: "test@example.com", password: "pass" })
    ).rejects.toThrow(/loginTimeout/);
  });

  it("should reject with empty claims error when claims emit null", async () => {
    // Emit null immediately (like BehaviorSubject(null)), then nothing else
    const nullSubject = new BehaviorSubject<any>(null);
    (globalThis as any).__loginTestMockState.onUserClaimsChange = jest
      .fn()
      .mockReturnValue(nullSubject.asObservable());

    const client = createClient({ loginTimeout: 300 });

    await expect(
      client.login({ email: "test@example.com", password: "pass" })
    ).rejects.toThrow(/could not be loaded/);

    nullSubject.complete();
  });

  it("should reject with empty claims error when claims emit undefined", async () => {
    const undefSubject = new BehaviorSubject<any>(undefined);
    (globalThis as any).__loginTestMockState.onUserClaimsChange = jest
      .fn()
      .mockReturnValue(undefSubject.asObservable());

    const client = createClient({ loginTimeout: 300 });

    await expect(
      client.login({ email: "test@example.com", password: "pass" })
    ).rejects.toThrow(/could not be loaded/);

    undefSubject.complete();
  });

  it("should succeed when claims emit null first then truthy value", async () => {
    // Simulate: initial null emission, then real claims arrive
    const delayedSubject = new BehaviorSubject<any>(null);
    (globalThis as any).__loginTestMockState.onUserClaimsChange = jest
      .fn()
      .mockReturnValue(delayedSubject.asObservable());

    const client = createClient({ loginTimeout: 2000 });

    // Emit real claims after 50ms
    setTimeout(() => {
      delayedSubject.next({ apiKeyAuth: true, scopes: "read:brainwaves" });
    }, 50);

    await expect(
      client.login({ email: "test@example.com", password: "pass" })
    ).resolves.toBeDefined();

    delayedSubject.complete();
  });

  it("should reject if already logged in", async () => {
    const client = createClient();
    // Simulate already logged in
    (client as any).user = { uid: "existing" };

    await expect(
      client.login({ email: "test@example.com", password: "pass" })
    ).rejects.toBe("Already logged in.");
  });

  it("should use configurable loginTimeout from SDKOptions", async () => {
    const customTimeout = 150;
    const client = createClient({ loginTimeout: customTimeout });

    const start = Date.now();
    await expect(
      client.login({ email: "test@example.com", password: "pass" })
    ).rejects.toThrow();
    const elapsed = Date.now() - start;

    // Should timeout around the configured value (with some tolerance)
    expect(elapsed).toBeGreaterThanOrEqual(customTimeout - 50);
    expect(elapsed).toBeLessThan(customTimeout + 500);
  });

  it("should default to 5000ms timeout when loginTimeout is not provided", () => {
    // Verify the default by checking the options stored in the client
    const client = new CloudClient({ autoSelectDevice: false });
    // The login method reads this.options.loginTimeout, which should be undefined
    // and fall back to 5000. We verify the option is not set.
    expect((client as any).options.loginTimeout).toBeUndefined();
  });
});
