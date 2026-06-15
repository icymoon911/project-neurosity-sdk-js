/**
 * SDK lifecycle event types emitted by the EventBus.
 */
export type SDKEventType =
  | "connect"
  | "disconnect"
  | "deviceChange"
  | "authStateChange";

/**
 * Handler function for SDK events.
 */
export type SDKEventHandler = (...args: any[]) => void;

/**
 * Internal event bus for SDK lifecycle events.
 * Allows CloudClient to emit events and Neurosity to expose on/off to consumers.
 * @hidden
 */
export class EventBus {
  private listeners: Map<SDKEventType, Set<SDKEventHandler>> = new Map();

  /**
   * Register a handler for a specific event.
   */
  public on(event: SDKEventType, handler: SDKEventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  /**
   * Remove a previously registered handler.
   */
  public off(event: SDKEventType, handler: SDKEventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit an event to all registered handlers.
   */
  public emit(event: SDKEventType, ...args: any[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for "${event}":`, error);
        }
      }
    }
  }

  /**
   * Remove all listeners for a specific event, or all events if no event is specified.
   */
  public removeAllListeners(event?: SDKEventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the count of registered handlers for a specific event.
   */
  public listenerCount(event: SDKEventType): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
