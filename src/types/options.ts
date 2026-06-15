import { Skill } from "./skill";
import { SubscriptionManager } from "../subscriptions/SubscriptionManager";
import { BluetoothTransport } from "../api/bluetooth/BluetoothClient";
import { STREAMING_MODE } from "./streaming";

export interface SDKOptions {
  deviceId?: string;
  autoSelectDevice?: boolean;
  timesync?: boolean;
  bluetoothTransport?: BluetoothTransport;
  streamingMode?: STREAMING_MODE;
  /**
   * Timeout in milliseconds to wait for user claims during login.
   * Defaults to 5000ms (5 seconds). Increase this value for slow or
   * high-latency network environments.
   */
  userClaimsTimeout?: number;
  /**
   * @hidden
   */
  emulator?: boolean;
  /**
   * @hidden
   */
  emulatorHost?: string;
  /**
   * @hidden
   */
  emulatorAuthPort?: number;
  /**
   * @hidden
   */
  emulatorDatabasePort?: number;
  /**
   * @hidden
   */
  emulatorOptions?: {
    mockUserToken?: any;
  };
  /**
   * @hidden
   */
  emulatorFunctionsPort?: number;
  /**
   * @hidden
   */
  emulatorFirestorePort?: number;
  /**
   * @hidden
   */
  skill?: Skill;
}

/**
 * @hidden
 */
export interface SDKDependencies {
  subscriptionManager: SubscriptionManager;
}
