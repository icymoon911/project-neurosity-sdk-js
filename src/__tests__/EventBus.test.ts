/// <reference types="node" />

import { EventBus } from "../utils/EventBus";

interface TestEventMap {
  connect: { deviceId: string };
  disconnect: { reason: string };
  deviceChange: { from: string | null; to: string | null };
}

describe("EventBus", () => {
  let bus: EventBus<TestEventMap>;

  beforeEach(() => {
    bus = new EventBus<TestEventMap>();
  });

  describe("on / emit", () => {
    test("should call registered handler when event is emitted", () => {
      const handler = jest.fn();
      bus.on("connect", handler);

      bus.emit("connect", { deviceId: "abc-123" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ deviceId: "abc-123" });
    });

    test("should call multiple handlers for the same event", () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      bus.on("connect", handler1);
      bus.on("connect", handler2);

      bus.emit("connect", { deviceId: "dev-1" });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    test("should not call handlers registered for different events", () => {
      const connectHandler = jest.fn();
      const disconnectHandler = jest.fn();

      bus.on("connect", connectHandler);
      bus.on("disconnect", disconnectHandler);

      bus.emit("connect", { deviceId: "dev-1" });

      expect(connectHandler).toHaveBeenCalledTimes(1);
      expect(disconnectHandler).not.toHaveBeenCalled();
    });

    test("should not fail when emitting event with no handlers", () => {
      expect(() => {
        bus.emit("connect", { deviceId: "dev-1" });
      }).not.toThrow();
    });
  });

  describe("off", () => {
    test("should remove handler so it no longer receives events", () => {
      const handler = jest.fn();
      bus.on("connect", handler);
      bus.off("connect", handler);

      bus.emit("connect", { deviceId: "dev-1" });

      expect(handler).not.toHaveBeenCalled();
    });

    test("should be safe to call off for unregistered handler", () => {
      const handler = jest.fn();
      expect(() => {
        bus.off("connect", handler);
      }).not.toThrow();
    });

    test("should only remove the specific handler, not others", () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      bus.on("connect", handler1);
      bus.on("connect", handler2);
      bus.off("connect", handler1);

      bus.emit("connect", { deviceId: "dev-1" });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    test("should catch handler errors and continue calling other handlers", () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const badHandler = jest.fn(() => {
        throw new Error("boom");
      });
      const goodHandler = jest.fn();

      bus.on("connect", badHandler);
      bus.on("connect", goodHandler);

      bus.emit("connect", { deviceId: "dev-1" });

      expect(badHandler).toHaveBeenCalledTimes(1);
      expect(goodHandler).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("removeAllListeners", () => {
    test("should remove all handlers for a specific event", () => {
      const h1 = jest.fn();
      const h2 = jest.fn();
      const h3 = jest.fn();

      bus.on("connect", h1);
      bus.on("connect", h2);
      bus.on("disconnect", h3);

      bus.removeAllListeners("connect");

      bus.emit("connect", { deviceId: "dev-1" });
      bus.emit("disconnect", { reason: "manual" });

      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
      expect(h3).toHaveBeenCalledTimes(1);
    });

    test("should remove all handlers for all events when no arg", () => {
      const h1 = jest.fn();
      const h2 = jest.fn();

      bus.on("connect", h1);
      bus.on("disconnect", h2);

      bus.removeAllListeners();

      bus.emit("connect", { deviceId: "dev-1" });
      bus.emit("disconnect", { reason: "manual" });

      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });
  });

  describe("listenerCount", () => {
    test("should return 0 for events with no handlers", () => {
      expect(bus.listenerCount("connect")).toBe(0);
    });

    test("should return correct count after on/off", () => {
      const h1 = jest.fn();
      const h2 = jest.fn();

      bus.on("connect", h1);
      expect(bus.listenerCount("connect")).toBe(1);

      bus.on("connect", h2);
      expect(bus.listenerCount("connect")).toBe(2);

      bus.off("connect", h1);
      expect(bus.listenerCount("connect")).toBe(1);

      bus.off("connect", h2);
      expect(bus.listenerCount("connect")).toBe(0);
    });
  });

  describe("deduplication", () => {
    test("should not register the same handler twice for the same event", () => {
      const handler = jest.fn();

      bus.on("connect", handler);
      bus.on("connect", handler);

      bus.emit("connect", { deviceId: "dev-1" });

      // Set deduplicates — handler should only be called once
      expect(handler).toHaveBeenCalledTimes(1);
      expect(bus.listenerCount("connect")).toBe(1);
    });
  });
});
