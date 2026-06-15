import { EventBus, SDKEventHandler } from "../utils/EventBus";

describe("EventBus", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  describe("on / emit", () => {
    it("should invoke the handler when the event is emitted", () => {
      const handler = jest.fn();
      bus.on("connect", handler);
      bus.emit("connect", { user: "test-user" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ user: "test-user" });
    });

    it("should invoke multiple handlers for the same event", () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      bus.on("connect", handler1);
      bus.on("connect", handler2);
      bus.emit("connect", "payload");

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("should not invoke handlers registered for a different event", () => {
      const connectHandler = jest.fn();
      const disconnectHandler = jest.fn();

      bus.on("connect", connectHandler);
      bus.on("disconnect", disconnectHandler);
      bus.emit("connect");

      expect(connectHandler).toHaveBeenCalledTimes(1);
      expect(disconnectHandler).not.toHaveBeenCalled();
    });

    it("should pass all arguments to the handler", () => {
      const handler = jest.fn();
      bus.on("deviceChange", handler);
      bus.emit("deviceChange", "arg1", "arg2", 3);

      expect(handler).toHaveBeenCalledWith("arg1", "arg2", 3);
    });

    it("should not throw when emitting an event with no handlers", () => {
      expect(() => bus.emit("connect")).not.toThrow();
    });
  });

  describe("off", () => {
    it("should remove a specific handler", () => {
      const handler = jest.fn();
      bus.on("connect", handler);
      bus.off("connect", handler);
      bus.emit("connect");

      expect(handler).not.toHaveBeenCalled();
    });

    it("should only remove the specified handler, leaving others intact", () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      bus.on("connect", handler1);
      bus.on("connect", handler2);
      bus.off("connect", handler1);
      bus.emit("connect");

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("should be a no-op when removing a handler that was never registered", () => {
      const handler = jest.fn();
      expect(() => bus.off("connect", handler)).not.toThrow();
    });

    it("should be a no-op when removing from an event with no handlers", () => {
      const handler = jest.fn();
      expect(() => bus.off("disconnect", handler)).not.toThrow();
    });
  });

  describe("error handling", () => {
    it("should catch and log handler errors without stopping other handlers", () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const badHandler: SDKEventHandler = () => {
        throw new Error("handler exploded");
      };
      const goodHandler = jest.fn();

      bus.on("connect", badHandler);
      bus.on("connect", goodHandler);
      bus.emit("connect");

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(goodHandler).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });
  });

  describe("removeAllListeners", () => {
    it("should remove all handlers for a specific event", () => {
      const h1 = jest.fn();
      const h2 = jest.fn();

      bus.on("connect", h1);
      bus.on("disconnect", h2);
      bus.removeAllListeners("connect");
      bus.emit("connect");
      bus.emit("disconnect");

      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it("should remove all handlers for all events when no event is specified", () => {
      const h1 = jest.fn();
      const h2 = jest.fn();

      bus.on("connect", h1);
      bus.on("disconnect", h2);
      bus.removeAllListeners();
      bus.emit("connect");
      bus.emit("disconnect");

      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });
  });

  describe("listenerCount", () => {
    it("should return 0 for events with no handlers", () => {
      expect(bus.listenerCount("connect")).toBe(0);
    });

    it("should return the correct count after adding handlers", () => {
      bus.on("connect", () => {});
      bus.on("connect", () => {});
      expect(bus.listenerCount("connect")).toBe(2);
    });

    it("should decrement after removing a handler", () => {
      const handler = jest.fn();
      bus.on("connect", handler);
      bus.on("connect", () => {});
      expect(bus.listenerCount("connect")).toBe(2);

      bus.off("connect", handler);
      expect(bus.listenerCount("connect")).toBe(1);
    });
  });

  describe("all supported event types", () => {
    it("should support connect event", () => {
      const handler = jest.fn();
      bus.on("connect", handler);
      bus.emit("connect", { user: "u1" });
      expect(handler).toHaveBeenCalledWith({ user: "u1" });
    });

    it("should support disconnect event", () => {
      const handler = jest.fn();
      bus.on("disconnect", handler);
      bus.emit("disconnect");
      expect(handler).toHaveBeenCalled();
    });

    it("should support deviceChange event", () => {
      const handler = jest.fn();
      bus.on("deviceChange", handler);
      bus.emit("deviceChange", { deviceId: "d1" });
      expect(handler).toHaveBeenCalledWith({ deviceId: "d1" });
    });

    it("should support authStateChange event", () => {
      const handler = jest.fn();
      bus.on("authStateChange", handler);
      bus.emit("authStateChange", { user: null });
      expect(handler).toHaveBeenCalledWith({ user: null });
    });
  });
});
