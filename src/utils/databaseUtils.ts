import { logger } from './logger';
import { DatabaseError, StoreName, TransactionMode, SettingValue, SettingKey } from '../types/database';

const dbLogger = logger.createLogger("Database");

/**
 * Wraps an IndexedDB request in a promise
 * @param request The IndexedDB request to wrap
 * @param operation Name of the operation for error reporting
 * @returns Promise that resolves with the request result
 */
export function wrapRequest<T>(
  request: IDBRequest<T>,
  operation: string,
  storeName?: StoreName
): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      const error = new DatabaseError(
        `${operation} failed: ${request.error?.message || 'Unknown error'}`,
        operation,
        storeName,
        request.error || undefined
      );
      dbLogger.error(error.message, { error });
      reject(error);
    };
  });
}

/**
 * Creates a transaction for one or more stores
 * @param db The database instance
 * @param storeNames Array of store names to include in transaction
 * @param mode Transaction mode (readonly/readwrite)
 * @returns Transaction and object stores
 */
export function createTransaction(
  db: IDBDatabase,
  storeNames: StoreName[],
  mode: TransactionMode = 'readonly'
): { 
  transaction: IDBTransaction;
  stores: { [key in StoreName]?: IDBObjectStore };
} {
  const transaction = db.transaction(storeNames, mode);
  const stores = storeNames.reduce((acc, storeName) => {
    acc[storeName] = transaction.objectStore(storeName);
    return acc;
  }, {} as { [key in StoreName]?: IDBObjectStore });

  return { transaction, stores };
}

/**
 * Wraps a transaction in a promise
 * @param transaction The transaction to wrap
 * @returns Promise that resolves when transaction completes
 */
export function wrapTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      const error = new DatabaseError(
        `Transaction failed: ${transaction.error?.message || 'Unknown error'}`,
        'transaction',
        undefined,
        transaction.error || undefined
      );
      dbLogger.error(error.message, { error });
      reject(error);
    };
    transaction.onabort = () => {
      const error = new DatabaseError(
        `Transaction aborted: ${transaction.error?.message || 'Unknown error'}`,
        'transaction',
        undefined,
        transaction.error || undefined
      );
      dbLogger.error(error.message, { error });
      reject(error);
    };
  });
}

/**
 * Helper to safely convert a setting value to the expected type
 * @param value The value to convert
 * @param key The setting key (used for type inference)
 * @returns The converted value
 * @example
 * convertSettingValue('25', 'workDuration') // returns 25
 * convertSettingValue('true', 'autoStartBreaks') // returns true
 * convertSettingValue(1, 'autoStartBreaks') // returns true
 */
export function convertSettingValue<T extends SettingValue>(
  value: unknown,
  key: SettingKey
): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Type inference based on key pattern
  if (key.endsWith('Duration') || key === 'sessionsUntilLongBreak') {
    return Number(value) as T;
  }
  
  if (key.startsWith('autoStart') || key === 'addTasksToBottom') {
    return Boolean(value) as T;
  }

  return value as T;
}

/**
 * Validates a database key
 * @param key The key to validate
 * @throws DatabaseError if key is invalid
 */
export function validateKey(key: string): void {
  if (!key || typeof key !== 'string' || key.trim() === '') {
    throw new DatabaseError(
      'Invalid key: Key must be a non-empty string',
      'validateKey'
    );
  }
}

/**
 * Creates a compound index key
 * @param components The components to combine into a key
 * @returns The compound key
 */
export function createCompoundKey(...components: (string | number)[]): string {
  return components.join('::');
}

/**
 * Type guard to check if a value is a valid setting value
 * @param value The value to check
 * @returns boolean indicating if value is a valid setting value
 */
export function isValidSettingValue(value: unknown): value is SettingValue {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/**
 * Type guard to check if a key is a valid setting key
 * @param key The key to check
 * @returns boolean indicating if key is a valid setting key
 */
export function isValidSettingKey(key: string): key is SettingKey {
  const validKeys: Set<string> = new Set([
    'workDuration',
    'breakDuration',
    'longBreakDuration',
    'sessionsUntilLongBreak',
    'addTasksToBottom',
    'autoStartBreaks',
    'autoStartPomodoros'
  ]);
  return validKeys.has(key);
}