// Track app operations that are in progress
const appOperationLocks = new Map<number, Promise<void>>();

/**
 * Acquires a lock for an app operation
 * @param appId The app ID to lock
 * @returns An object with release function and promise
 */
export function acquireLock(appId: number): {
  release: () => void;
  promise: Promise<void>;
} {
  let release: () => void = () => {};

  const promise = new Promise<void>((resolve) => {
    release = () => {
      appOperationLocks.delete(appId);
      resolve();
    };
  });

  appOperationLocks.set(appId, promise);
  return { release, promise };
}

/**
 * Executes a function with a lock on the app ID
 * @param appId The app ID to lock
 * @param fn The function to execute with the lock
 * @returns Result of the function
 */
export async function withLock<T>(
  appId: number,
  fn: () => Promise<T>
): Promise<T> {
  // Wait for any existing operation to complete
  const existingLock = appOperationLocks.get(appId);
  if (existingLock) {
    await existingLock;
  }

  // Acquire a new lock
  const { release, promise } = acquireLock(appId);

  try {
    const result = await fn();
    return result;
  } finally {
    release();
  }
}
