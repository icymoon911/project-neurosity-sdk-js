import {
  validateScopeBasedPermissionForAction,
  validateScopeBasedPermissionForFunctionName
} from "../utils/permissions";

describe("Permissions", () => {
  describe("validateScopeBasedPermissionForAction", () => {
    it("should not error when user is not using OAuth or API key", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        {},
        { command: "marker", action: "add" }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should allow action when user has the required scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: "write:brainwave-markers" },
        { command: "marker", action: "add" }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should reject action when user lacks the required scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: "read:brainwaves" },
        { command: "marker", action: "add" }
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("write:brainwave-markers");
    });

    it("should not crash when scopes is undefined (OAuth user)", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: undefined },
        { command: "marker", action: "add" }
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("write:brainwave-markers");
    });

    it("should not crash when scopes is null (OAuth user)", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: null as any },
        { command: "marker", action: "add" }
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it("should not crash when scopes is empty string", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: "" },
        { command: "marker", action: "add" }
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it("should not crash when scopes is a non-string type (number)", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: 42 as any },
        { command: "marker", action: "add" }
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it("should not crash when userClaims is null", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        null as any,
        { command: "marker", action: "add" }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should handle multiple scopes as comma-separated string", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        {
          apiKeyAuth: true,
          scopes: "read:brainwaves,write:brainwave-markers,write:haptics"
        },
        { command: "marker", action: "add" }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should allow unmapped actions without error (OAuth user)", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: "read:brainwaves" },
        { command: "unknown", action: "unknownAction" }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should have scope mapping for brainwaves/startRecording", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: "write:brainwaves" },
        { command: "brainwaves", action: "startRecording" }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should reject brainwaves/startRecording without write:brainwaves scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { oauth: true, scopes: "read:brainwaves" },
        { command: "brainwaves", action: "startRecording" }
      );
      expect(hasError).toBe(true);
      expect(error?.message).toContain("write:brainwaves");
    });

    it("should handle API key auth with missing scopes", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { apiKeyAuth: true },
        { command: "haptics", action: "queue" }
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain("write:haptics");
    });

    it("should handle API key auth with correct scopes", () => {
      const [hasError, error] = validateScopeBasedPermissionForAction(
        { apiKeyAuth: true, scopes: "write:haptics" },
        { command: "haptics", action: "queue" }
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });
  });

  describe("validateScopeBasedPermissionForFunctionName", () => {
    it("should not error when user is not using OAuth or API key", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        {},
        "brainwaves"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should allow function when user has the required scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "read:brainwaves" },
        "brainwaves"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should reject function when user lacks the required scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "read:calm" },
        "brainwaves"
      );
      expect(hasError).toBe(true);
      expect(error?.message).toContain("read:brainwaves");
    });

    it("should not crash when scopes is undefined", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true },
        "brainwaves"
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it("should not crash when scopes is null", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: null as any },
        "brainwaves"
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it("should not crash when scopes is empty string", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { apiKeyAuth: true, scopes: "" },
        "kinesis"
      );
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it("should not crash when scopes is an array (wrong type)", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: ["read:brainwaves"] as any },
        "brainwaves"
      );
      // Array is not a string, so scopes are treated empty
      expect(hasError).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it("should handle kinesis with read:kinesis scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { apiKeyAuth: true, scopes: "read:kinesis" },
        "kinesis"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should handle predictions with read:kinesis scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { apiKeyAuth: true, scopes: "read:kinesis" },
        "predictions"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should allow unmapped function names without error", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "read:brainwaves" },
        "unknownFunction"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should handle signalQualityV2 with read:signal-quality scope", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        { oauth: true, scopes: "read:signal-quality" },
        "signalQualityV2"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });

    it("should handle userClaims being undefined", () => {
      const [hasError, error] = validateScopeBasedPermissionForFunctionName(
        undefined as any,
        "brainwaves"
      );
      expect(hasError).toBe(false);
      expect(error).toBeNull();
    });
  });
});
