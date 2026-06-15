import { DeviceInfo } from "./deviceInfo";

/**
 * Names of lifecycle events emitted by the SDK event bus.
 */
export type SDKEventName =
  | "connect"
  | "disconnect"
  | "deviceChange"
  | "authStateChange";

/**
 * Payload for the `connect` event.
 */
export interface SDKConnectEvent {
  deviceId: string;
}

/**
 * Payload for the `disconnect` event.
 */
export interface SDKDisconnectEvent {
  deviceId?: string;
  reason?: "manual" | "logout" | "offline";
}

/**
 * Payload for the `deviceChange` event.
 */
export interface SDKDeviceChangeEvent {
  previousDevice: DeviceInfo | null;
  currentDevice: DeviceInfo | null;
}

/**
 * Payload for the `authStateChange` event.
 */
export interface SDKAuthStateChangeEvent {
  user: any;
  type: "login" | "logout" | "stateChanged";
}

/**
 * Map of event names to their payload types.
 */
export interface SDKEventMap {
  connect: SDKConnectEvent;
  disconnect: SDKDisconnectEvent;
  deviceChange: SDKDeviceChangeEvent;
  authStateChange: SDKAuthStateChangeEvent;
}

/**
 * Handler function for SDK events.
 */
export type SDKEventHandler<T extends SDKEventName> = (
  payload: SDKEventMap[T]
) => void;
