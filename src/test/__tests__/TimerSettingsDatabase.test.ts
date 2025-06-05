import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import { settingsDB, initDB } from '../../utils/database';
import { DEFAULT_TIMER_SETTINGS } from '../../constants/timerConstants';
import { STORE_NAMES } from '../../types/database';

describe('Timer Settings Database Integration', () => {
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

    test('should return default timer settings when no settings exist', async () => {
        const settings = await settingsDB.getTimerSettings();
        expect(settings).toEqual(DEFAULT_TIMER_SETTINGS);
    });

    test('should store and retrieve timer settings in milliseconds', async () => {
        const testSettings = {
            workDuration: 30 * 60 * 1000,      // 30 minutes in ms
            breakDuration: 10 * 60 * 1000,     // 10 minutes in ms
            longBreakDuration: 20 * 60 * 1000, // 20 minutes in ms
            sessionsUntilLongBreak: 4
        };

        await settingsDB.setTimerSettings(testSettings);
        const retrievedSettings = await settingsDB.getTimerSettings();

        expect(retrievedSettings).toEqual(testSettings);
    });

    test('should convert minute values to milliseconds when storing', async () => {
        const inputSettings = {
            workDuration: 30,      // 30 minutes
            breakDuration: 10,     // 10 minutes
            longBreakDuration: 20, // 20 minutes
            sessionsUntilLongBreak: 4
        };

        const expectedSettings = {
            workDuration: 30 * 60 * 1000,      // 30 minutes in ms
            breakDuration: 10 * 60 * 1000,     // 10 minutes in ms
            longBreakDuration: 20 * 60 * 1000, // 20 minutes in ms
            sessionsUntilLongBreak: 4
        };

        await settingsDB.setTimerSettings(inputSettings);
        const retrievedSettings = await settingsDB.getTimerSettings();

        expect(retrievedSettings).toEqual(expectedSettings);
    });

    test('should handle partial updates to timer settings', async () => {
        // First set all settings
        const initialSettings = {
            workDuration: 25 * 60 * 1000,
            breakDuration: 5 * 60 * 1000,
            longBreakDuration: 15 * 60 * 1000,
            sessionsUntilLongBreak: 4
        };
        await settingsDB.setTimerSettings(initialSettings);

        // Update only workDuration
        const partialUpdate = {
            workDuration: 30 * 60 * 1000
        };
        await settingsDB.setTimerSettings(partialUpdate);

        // Verify only workDuration was updated
        const retrievedSettings = await settingsDB.getTimerSettings();
        expect(retrievedSettings).toEqual({
            ...initialSettings,
            workDuration: 30 * 60 * 1000
        });
    });

    test('should preserve existing settings when updating only some values', async () => {
        // Set initial settings
        await settingsDB.setTimerSettings({
            workDuration: 25 * 60 * 1000,
            breakDuration: 5 * 60 * 1000,
            longBreakDuration: 15 * 60 * 1000,
            sessionsUntilLongBreak: 4
        });

        // Update only sessionsUntilLongBreak
        await settingsDB.setTimerSettings({
            sessionsUntilLongBreak: 6
        });

        const settings = await settingsDB.getTimerSettings();
        expect(settings.workDuration).toBe(25 * 60 * 1000);
        expect(settings.breakDuration).toBe(5 * 60 * 1000);
        expect(settings.longBreakDuration).toBe(15 * 60 * 1000);
        expect(settings.sessionsUntilLongBreak).toBe(6);
    });

    test('should handle extreme duration values', async () => {
        const extremeSettings = {
            workDuration: 240 * 60 * 1000,     // 4 hours
            breakDuration: 1 * 60 * 1000,      // 1 minute
            longBreakDuration: 360 * 60 * 1000, // 6 hours
            sessionsUntilLongBreak: 10
        };

        await settingsDB.setTimerSettings(extremeSettings);
        const retrievedSettings = await settingsDB.getTimerSettings();

        expect(retrievedSettings).toEqual(extremeSettings);
    });

    test('should handle concurrent timer settings updates', async () => {
        const updates = [
            { workDuration: 20 * 60 * 1000 },
            { breakDuration: 7 * 60 * 1000 },
            { longBreakDuration: 25 * 60 * 1000 },
            { sessionsUntilLongBreak: 5 }
        ];

        await Promise.all(updates.map(update => settingsDB.setTimerSettings(update)));

        const finalSettings = await settingsDB.getTimerSettings();
        expect(finalSettings).toEqual({
            workDuration: 20 * 60 * 1000,
            breakDuration: 7 * 60 * 1000,
            longBreakDuration: 25 * 60 * 1000,
            sessionsUntilLongBreak: 5
        });
    });

    test('should persist timer settings across database connections', async () => {
        const testSettings = {
            workDuration: 35 * 60 * 1000,
            breakDuration: 8 * 60 * 1000,
            longBreakDuration: 20 * 60 * 1000,
            sessionsUntilLongBreak: 3
        };

        // Set settings
        await settingsDB.setTimerSettings(testSettings);

        // Close and reopen database connection
        const db = await initDB();
        db.close();
        await initDB();

        // Verify settings persisted
        const retrievedSettings = await settingsDB.getTimerSettings();
        expect(retrievedSettings).toEqual(testSettings);
    });
});