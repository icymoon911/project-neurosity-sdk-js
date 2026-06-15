import { Observable, throwError } from "rxjs";
import {
  validateScopeBasedPermissionForFunctionName,
  validateScopeBasedPermissionForAction
} from "./permissions";
import { Action } from "../types/actions";

/**
 * Result of a permission validation: `[hasError, error]`.
 */
export type PermissionCheckResult = [boolean, Error | null];

type PermissionBasedClaims = Parameters<
  typeof validateScopeBasedPermissionForFunctionName
>[0];

/**
 * Runs a scope-based permission check for a named function.
 *
 * - If the check passes, calls `fn()` and returns its Observable or Promise.
 * - If the check fails:
 *   - when `returnKind` is `"observable"`, returns `throwError(() => error)`
 *   - when `returnKind` is `"promise"`, returns `Promise.reject(error)`
 *
 * This replaces the repeated 4-line permission pattern that previously
 * appeared in every public Neurosity method.
 *
 * @param userClaims - The current user's OAuth/API-key claims
 * @param functionName - Name used to look up the required scope
 * @param fn - The function to execute if permission is granted
 * @param returnKind - Whether the caller returns an Observable or Promise
 */
export function withPermissionCheck<T>(
  userClaims: PermissionBasedClaims,
  functionName: string,
  fn: () => Observable<T>,
  returnKind: "observable"
): Observable<T>;
export function withPermissionCheck<T>(
  userClaims: PermissionBasedClaims,
  functionName: string,
  fn: () => Promise<T>,
  returnKind: "promise"
): Promise<T>;
export function withPermissionCheck<T>(
  userClaims: PermissionBasedClaims,
  functionName: string,
  fn: () => Observable<T> | Promise<T>,
  returnKind: "observable" | "promise"
): Observable<T> | Promise<T> {
  const [hasError, error] = validateScopeBasedPermissionForFunctionName(
    userClaims,
    functionName
  );

  if (hasError) {
    return returnKind === "observable"
      ? throwError(() => error)
      : Promise.reject(error);
  }

  return fn();
}

/**
 * Like {@link withPermissionCheck}, but validates against an {@link Action}
 * instead of a function name. Used for command/action pairs such as
 * `brainwaves/record` or `haptics/queue`.
 */
export function withActionPermissionCheck<T>(
  userClaims: PermissionBasedClaims,
  action: Action,
  fn: () => Observable<T>,
  returnKind: "observable"
): Observable<T>;
export function withActionPermissionCheck<T>(
  userClaims: PermissionBasedClaims,
  action: Action,
  fn: () => Promise<T>,
  returnKind: "promise"
): Promise<T>;
export function withActionPermissionCheck<T>(
  userClaims: PermissionBasedClaims,
  action: Action,
  fn: () => Observable<T> | Promise<T>,
  returnKind: "observable" | "promise"
): Observable<T> | Promise<T> {
  const [hasError, error] = validateScopeBasedPermissionForAction(
    userClaims,
    action
  );

  if (hasError) {
    return returnKind === "observable"
      ? throwError(() => error)
      : Promise.reject(error);
  }

  return fn();
}
