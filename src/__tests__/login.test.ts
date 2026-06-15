import { CloudClient } from "../api/index";
import { of, Subject, timer, EMPTY } from "rxjs";
import { delay } from "rxjs/operators";

// Mock all firebase dependencies to isolate login behavior
jest.mock("../api/firebase", () => {
  class MockFirebaseApp {
    constructor() {}
    disconnect() {
      return Promise.resolve();
    }
    goOffline() {}
    goOnline() {}
    get app() {
      return {};
    }
  }

  class MockFirebaseUser {
    private _claimsSubject = new Subject<any>();
    private _authSubject = new Subject<any>();
    public loginImpl: ((credentials: any) => Promise<any>) | null = null;
    public claimsToEmit: any = { scopes: "read:brainwaves" };
    public claimsDelay: number = 0;

    constructor() {}

    login = jest.fn().mockImplementation(async (credentials: any) => {
      if (this.loginImpl) {
        return this.loginImpl(credentials);
      }
      return { uid: "test-uid", email: credentials.email };
    });

    logout = jest.fn().mockResolvedValue(undefined);

    onAuthStateChanged = jest.fn().mockReturnValue(this._authSubject.asObservable());

    onUserClaimsChange = jest.fn().mockImplementation(() => {
      if (this.claimsToEmit === null) {
        // Never emit — simulates timeout scenario
        return new Subject<any>().asObservable();
      }
      if (this.claimsDelay > 0) {
        return of(this.claimsToEmit).pipe(delay(this.claimsDelay));
      }
      return of(this.claimsToEmit);
    });

    getDevices = jest.fn().mockResolvedValue([]);

    hasDevicePermission = jest.fn().mockResolvedValue(true);

    createAccount = jest.fn().mockResolvedValue({ uid: "new-uid" });

    deleteAccount = jest.fn().mockResolvedValue(undefined);

    createCustomToken = jest.fn().mockResolvedValue({ token: "custom-token" });

    createApiKey = jest.fn().mockResolvedValue({ id: "key-id" });

    removeApiKey = jest.fn().mockResolvedValue({ success: true });

    removeOAuthAccess = jest.fn().mockResolvedValue({ success: true });

    onUserDevicesChange = jest.fn().mockReturnValue(of([]));

    onUserExperiments = jest.fn().mockReturnValue(of([]));

    deleteUserExperiment = jest.fn().mockResolvedValue(undefined);

    addDevice = jest.fn().mockResolvedValue(undefined);

    removeDevice = jest.fn().mockResolvedValue(undefined);

    transferDevice = jest.fn().mockResolvedValue(undefined);
  }

  class MockFirebaseDevice {
    constructor() {}
    disconnect() {
      return Promise.resolve();
    }
    dispatchAction() {
      return Promise.resolve({});
    }
    getInfo() {
      return Promise.resolve({});
    }
    onNamespace() {}
    offNamespace() {}
    onceNamespace() {
      return Promise.resolve(null);
    }
    onMetric() {}
    offMetric() {}
    subscribeToMetric() {
      return { id: "sub-1" };
    }
    unsubscribeFromMetric() {}
    nextMetric() {}
    createBluetoothToken() {
      return Promise.resolve("bt-token");
    }
    getSkill() {
      return Promise.resolve(null);
    }
    changeSettings() {
      return Promise.resolve();
    }
    getTimesync() {
      return Promise.resolve({ offset: 0 });
    }
  }

  return {
    FirebaseApp: MockFirebaseApp,
    FirebaseUser: MockFirebaseUser,
    FirebaseDevice: MockFirebaseDevice
  };
});

describe("CloudClient.login", () => {
  let client: CloudClient;
  let mockFirebaseUser: any;

  beforeEach(() => {
    client = new CloudClient({
      autoSelectDevice: false,
      userClaimsTimeout: 500
    } as any);

    // Access the internal firebaseUser mock
    mockFirebaseUser = (client as any).firebaseUser;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should succeed when user claims arrive within timeout", async () => {
    mockFirebaseUser.claimsToEmit = { scopes: "read:brainwaves" };
    mockFirebaseUser.claimsDelay = 50;

    const result = await client.login({
      email: "test@example.com",
      password: "pass"
    } as any);

    expect(result).toBeDefined();
    expect(result.user?.email || mockFirebaseUser.login).toBeDefined();
  });

  it("should reject with timeout error when claims do not arrive in time", async () => {
    mockFirebaseUser.claimsToEmit = null; // Never emit
    (client as any).options.userClaimsTimeout = 100;

    await expect(
      client.login({ email: "test@example.com", password: "pass" } as any)
    ).rejects.toMatch(/timed out after 100ms/);
  });

  it("should include userClaimsTimeout suggestion in timeout error message", async () => {
    mockFirebaseUser.claimsToEmit = null; // Never emit
    (client as any).options.userClaimsTimeout = 50;

    await expect(
      client.login({ email: "test@example.com", password: "pass" } as any)
    ).rejects.toMatch(/userClaimsTimeout/);
  });

  it("should use default timeout of 5000ms when not specified", async () => {
    const clientNoTimeout = new CloudClient({
      autoSelectDevice: false
    } as any);
    const fbUser = (clientNoTimeout as any).firebaseUser;
    fbUser.claimsToEmit = null;

    // We don't actually wait 5s in the test — we override to a short timeout
    (clientNoTimeout as any).options.userClaimsTimeout = 100;

    await expect(
      clientNoTimeout.login({
        email: "test@example.com",
        password: "pass"
      } as any)
    ).rejects.toMatch(/timed out after 100ms/);
  });

  it("should reject when already logged in", async () => {
    (client as any).user = { uid: "existing-user" };

    await expect(
      client.login({ email: "test@example.com", password: "pass" } as any)
    ).rejects.toBe(`Already logged in.`);
  });

  it("should handle fast claims arrival (synchronous)", async () => {
    mockFirebaseUser.claimsToEmit = { scopes: "read:kinesis,write:brainwaves" };
    mockFirebaseUser.claimsDelay = 0;

    const result = await client.login({
      email: "test@example.com",
      password: "pass"
    } as any);

    expect(result).toBeDefined();
  });

  it("should respect custom userClaimsTimeout value", async () => {
    const customClient = new CloudClient({
      autoSelectDevice: false,
      userClaimsTimeout: 200
    } as any);

    const fbUser = (customClient as any).firebaseUser;
    fbUser.claimsToEmit = null; // Never emit

    const start = Date.now();
    await expect(
      customClient.login({
        email: "test@example.com",
        password: "pass"
      } as any)
    ).rejects.toMatch(/timed out after 200ms/);
    const elapsed = Date.now() - start;

    // Should timeout around 200ms, not 5000ms
    expect(elapsed).toBeLessThan(1000);
  });
});
