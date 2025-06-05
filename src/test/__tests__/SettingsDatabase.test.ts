import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import { settingsDB, initDB } from '../../utils/database';
import { STORE_NAMES, SettingKey } from '../../types/database';

describe('Settings Database Integration', () => {
    // Clean up database after all tests
    afterAll(async () => {
        await indexedDB.deleteDatabase('dev_PomodoroDB');
    });

    // Clear settings store before each test
    beforeEach(async () => {
        const db = await initDB();
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([STORE_NAMES.SETTINGS], 'readwrite');
            const store = transaction.objectStore(STORE_NAMES.SETTINGS);
            store.clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    });

    test('should set and get a boolean setting', async () => {
        const key = 'addTasksToBottom' as SettingKey;
        const value = true;

        await settingsDB.setSetting(key, value);
        const retrievedValue = await settingsDB.getSetting<boolean>(key);

        expect(retrievedValue).toBe(value);
    });

    test('should update an existing setting', async () => {
        const key = 'addTasksToBottom' as SettingKey;
        
        // Set initial value
        await settingsDB.setSetting(key, true);
        
        // Update value
        await settingsDB.setSetting(key, false);
        
        // Verify updated value
        const updatedValue = await settingsDB.getSetting<boolean>(key);
        expect(updatedValue).toBe(false);
    });

    test('should return null for non-existent setting', async () => {
        const value = await settingsDB.getSetting<boolean>('addTasksToBottom' as SettingKey);
        expect(value).toBeNull();
    });

    test('should handle multiple settings', async () => {
        const settings: [SettingKey, boolean][] = [
            ['addTasksToBottom', true],
            ['autoStartBreaks', false],
            ['autoStartPomodoros', true]
        ];

        // Set all settings
        await Promise.all(
            settings.map(([key, value]) => 
                settingsDB.setSetting(key, value)
            )
        );

        // Verify all settings
        for (const [key, expectedValue] of settings) {
            const value = await settingsDB.getSetting<boolean>(key);
            expect(value).toBe(expectedValue);
        }
    });

    test('should handle transaction integrity during concurrent operations', async () => {
        const operations: [SettingKey, boolean][] = Array.from(
            { length: 10 }, 
            (_, i) => ['addTasksToBottom' as SettingKey, i % 2 === 0]
        );

        // Test concurrent sets
        try {
            await Promise.all(
                operations.map(([key, value]) => settingsDB.setSetting(key, value))
            );
        } catch (error) {
            console.error('FAILURE IN concurrent settingsDB.setSetting operations');
            throw error;
        }

        // Verify all settings were set correctly
        const [key, value] = operations[operations.length - 1];
        const retrievedValue = await settingsDB.getSetting<boolean>(key);
        expect(retrievedValue).toBe(value);
    });

    test('should persist settings across database connections', async () => {
        const key = 'addTasksToBottom' as SettingKey;
        const value = true;

        // Set value
        await settingsDB.setSetting(key, value);

        // Close and reopen database connection
        const db = await initDB();
        db.close();
        await initDB();

        // Verify value persisted
        const retrievedValue = await settingsDB.getSetting<boolean>(key);
        expect(retrievedValue).toBe(value);
    });

    test('should handle invalid inputs gracefully', async () => {
        const key = 'addTasksToBottom' as SettingKey;
        
        // Test with empty key (should be handled by type system)
        await expect(async () => {
            // @ts-expect-error - Testing runtime behavior with invalid input
            await settingsDB.setSetting('', true);
        }).rejects.toThrow();
        
        // Test with valid key and value
        await settingsDB.setSetting(key, true);
        const value = await settingsDB.getSetting<boolean>(key);
        expect(value).toBe(true);
    });
}); 
