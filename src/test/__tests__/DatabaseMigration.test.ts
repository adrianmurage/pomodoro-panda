import { describe, test, expect, afterEach } from 'vitest';
import { initDB, SETTINGS_STORE } from '../../utils/database';

describe('Database Migration Tests', () => {
    afterEach(async () => {
        await indexedDB.deleteDatabase('dev_PomodoroDB');
    });

    test('should create settings store during migration', async () => {
        // Initialize database
        const db = await initDB();
        
        // Verify settings store exists
        expect(db.objectStoreNames.contains(SETTINGS_STORE)).toBe(true);
        
        // Verify store configuration
        const transaction = db.transaction([SETTINGS_STORE], 'readonly');
        const store = transaction.objectStore(SETTINGS_STORE);
        
        // Check keyPath configuration
        expect(store.keyPath).toBe('id');
        
        db.close();
    });

    test('should preserve data during migration', async () => {
        // Initialize database and add test data
        const initialDb = await initDB();
        await new Promise<void>((resolve, reject) => {
            const transaction = initialDb.transaction([SETTINGS_STORE], 'readwrite');
            const store = transaction.objectStore(SETTINGS_STORE);
            store.put({ id: 'testSetting', value: true });
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
        initialDb.close();

        // Reopen database to trigger any pending migrations
        const migratedDb = await initDB();
        
        // Verify data survived migration
        const transaction = migratedDb.transaction([SETTINGS_STORE], 'readonly');
        const store = transaction.objectStore(SETTINGS_STORE);
        
        const request = store.get('testSetting');
        const result = await new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result);
        });
        
        expect(result).toEqual({ id: 'testSetting', value: true });
        
        migratedDb.close();
    });
}); 