/**
 * A minimal typed event bus for SDK lifecycle events.
 *
 * Supports `on`, `off`, and `emit` operations. Handlers are stored
 * in a Set per event name, so the same handler registered twice is
 * a no-op, and removing a handler that was never registered is safe.
 *
 * @hidden
 */
export class EventBus<EventMap extends Record<string, any>> {
  private _listeners = new Map<keyof EventMap, Set<(payload: any) => void>>();

  /**
   * Register a handler for the given event.
   */
  on<K extends keyof EventMap>(
    event: K,
    handler: (payload: EventMap[K]) => void
  ): void {
    let handlers = this._listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      this._listeners.set(event, handlers);
    }
    handlers.add(handler);
  }

  /**
   * Remove a previously registered handler.
   * No-op if the handler was not registered.
   */
  off<K extends keyof EventMap>(
    event: K,
    handler: (payload: EventMap[K]) => void
  ): void {
    const handlers = this._listeners.get(event);
    if (!handlers) {
      return;
    }
    handlers.delete(handler);
    if (handlers.size === 0) {
      this._listeners.delete(event);
    }
  }

  /**
   * Emit an event, calling all registered handlers synchronously.
   * Errors thrown by individual handlers are caught and logged to
   * prevent one misbehaving handler from blocking others.
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const handlers = this._listeners.get(event);
    if (!handlers) {
      return;
    }
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (error) {
        console.error(
          `[NeurositySDK] Error in event handler for "${String(event)}":`,
          error
        );
      }
    }
  }

  /**
   * Remove all handlers for a specific event, or all events if
   * no event name is provided.
   */
  removeAllListeners(event?: keyof EventMap): void {
    if (event !== undefined) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  /**
   * Returns the number of handlers registered for the given event.
   */
  listenerCount(event: keyof EventMap): number {
    return this._listeners.get(event)?.size ?? 0;
  }
}
