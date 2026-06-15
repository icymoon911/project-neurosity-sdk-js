import {
  validateScopeBasedPermissionForAction,
  validateScopeBasedPermissionForFunctionName
} from "../utils/permissions";

describe("Permissions", () => {
  describe("validateScopeBasedPermissionForAction", () => {
    it("should not reject when user is not using OAuth or API key", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        {},
        { command: "brainwaves", action: "record", message: {} }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should not reject when user has the required scope via OAuth", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: "write:brainwaves,read:brainwaves" },
        { command: "brainwaves", action: "record", message: {} }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should not reject when user has the required scope via API key", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { apiKeyAuth: true, scopes: "write:brainwaves" },
        { command: "brainwaves", action: "record", message: {} }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should reject when user lacks the required scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: "read:brainwaves" },
        { command: "brainwaves", action: "record", message: {} }
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("write:brainwaves");
    });

    it("should not crash when scopes is undefined (OAuth)", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true },
        { command: "brainwaves", action: "record", message: {} }
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("write:brainwaves");
    });

    it("should not crash when scopes is undefined (API key)", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { apiKeyAuth: true },
        { command: "brainwaves", action: "record", message: {} }
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("write:brainwaves");
    });

    it("should not crash when scopes is null", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: null as any },
        { command: "brainwaves", action: "record", message: {} }
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it("should not crash when scopes is an empty string", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: "" },
        { command: "brainwaves", action: "record", message: {} }
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("write:brainwaves");
    });

    it("should not crash when scopes is a number", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: 12345 as any },
        { command: "brainwaves", action: "record", message: {} }
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it("should not crash when userClaims is null", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        null as any,
        { command: "brainwaves", action: "record", message: {} }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should not crash when userClaims is undefined", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        undefined as any,
        { command: "brainwaves", action: "record", message: {} }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate brainwaves/startRecording action", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { apiKeyAuth: true, scopes: "write:brainwaves" },
        { command: "brainwaves", action: "startRecording", message: {} }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should reject brainwaves/startRecording when scope is missing", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { apiKeyAuth: true, scopes: "read:brainwaves" },
        { command: "brainwaves", action: "startRecording", message: {} }
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("write:brainwaves");
    });

    it("should validate marker/add action", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: "write:brainwave-markers" },
        { command: "marker", action: "add", message: { label: "test" } }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate haptics/queue action", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: "write:haptics" },
        { command: "haptics", action: "queue", message: {} }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate training/record action", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { apiKeyAuth: true, scopes: "write:kinesis" },
        { command: "training", action: "record", message: {} }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate training/stop action", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { apiKeyAuth: true, scopes: "write:kinesis" },
        { command: "training", action: "stop", message: {} }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate training/stopAll action", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { apiKeyAuth: true, scopes: "write:kinesis" },
        { command: "training", action: "stopAll", message: {} }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate wifi/reset action", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: "write:wifi-settings" },
        { command: "wifi", action: "reset", message: {} }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });
  });

  describe("validateScopeBasedPermissionForFunctionName", () => {
    it("should not reject when user is not using OAuth or API key", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        {},
        "brainwaves"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should not reject when user has the required scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "read:brainwaves,read:focus" },
        "brainwaves"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should reject when user lacks the required scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "read:focus" },
        "brainwaves"
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("read:brainwaves");
    });

    it("should not crash when scopes is undefined (OAuth)", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true },
        "kinesis"
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("read:kinesis");
    });

    it("should not crash when scopes is undefined (API key)", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { apiKeyAuth: true },
        "kinesis"
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("read:kinesis");
    });

    it("should not crash when scopes is null", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: null as any },
        "brainwaves"
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it("should not crash when scopes is an empty string", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "" },
        "focus"
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("read:focus");
    });

    it("should not crash when scopes is a non-string value", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: { foo: "bar" } as any },
        "calm"
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it("should not crash when userClaims is null", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        null as any,
        "brainwaves"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should not crash when userClaims is undefined", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        undefined as any,
        "brainwaves"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate predictions with read:kinesis scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { apiKeyAuth: true, scopes: "read:kinesis" },
        "predictions"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate signalQuality with read:signal-quality scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "read:signal-quality" },
        "signalQuality"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate accelerometer with read:accelerometer scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "read:accelerometer" },
        "accelerometer"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate calm with read:calm scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "read:calm" },
        "calm"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate focus with read:focus scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "read:focus" },
        "focus"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate getInfo with read:devices-info scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "read:devices-info" },
        "getInfo"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate status with read:devices-status scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "read:devices-status" },
        "status"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate settings with read:devices-settings scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "read:devices-settings" },
        "settings"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate changeSettings with write:devices-settings scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "write:devices-settings" },
        "changeSettings"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate addDevice with write:devices-add scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "write:devices-add" },
        "addDevice"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate removeDevice with write:devices-remove scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "write:devices-remove" },
        "removeDevice"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should validate createApiKey with write:api-keys scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "write:api-keys" },
        "createApiKey"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should handle multiple scopes correctly", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        {
          oauth: true,
          scopes: "read:brainwaves,read:focus,read:calm,read:kinesis"
        },
        "kinesis"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should handle scopes with extra whitespace in comma separation", () => {
      // Note: current implementation uses simple split(",") without trimming.
      // This test documents the current behavior.
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: " read:brainwaves , read:focus " },
        "brainwaves"
      );
      // " read:brainwaves " (with leading space) does not match "read:brainwaves"
      // so this should return an error
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
