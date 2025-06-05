import { DEFAULT_TIMER_SETTINGS } from "../constants/timerConstants";
import { Task, TimerSettings } from "../types";
import {
  TaskRecord,
  CompletedTaskRecord,
  BaseTask,
  ITaskDatabase,
  ISettingsDatabase,
  STORE_NAMES,
  SettingKey,
  SettingValue,
} from "../types/database";
import { logger } from "./logger";
import { validateKey, isValidSettingKey, convertSettingValue } from "./databaseUtils";

const dbLogger = logger.createLogger("Database");

// Add environment check and database name configuration
const IS_PROD = process.env.NODE_ENV === "production";
const DB_PREFIX = IS_PROD ? "prod" : "dev";
const DB_NAME = `${DB_PREFIX}_PomodoroDB` as const;

// Store names
const { TASKS, COMPLETED_TASKS, SETTINGS } = STORE_NAMES;

// Database version history with migrations
const DB_MIGRATIONS = {
  1: (db: IDBDatabase) => {
    // Initial version - Basic task management
    const taskStore = db.createObjectStore(TASKS, { keyPath: "id" });
    taskStore.createIndex("endTime", "endTime");
    taskStore.createIndex("order", "order");
  },
  2: (db: IDBDatabase) => {
    // Added completed tasks tracking
    const completedStore = db.createObjectStore(COMPLETED_TASKS, {
      keyPath: "id",
    });
    completedStore.createIndex("endTime", "endTime");
  },
  3: (db: IDBDatabase) => {
    // Added settings store
    if (!db.objectStoreNames.contains(SETTINGS)) {
      db.createObjectStore(SETTINGS, { keyPath: "id" });
    }
  },
} as const;

// Current version is highest migration number
const DB_VERSION = Math.max(...Object.keys(DB_MIGRATIONS).map(Number));

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbLogger.error("Database initialization failed", { error: request.error });
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      // Apply each migration in sequence
      Object.entries(DB_MIGRATIONS)
        .map(([version, migration]) => ({
          version: parseInt(version),
          migration,
        }))
        .filter(({ version }) => version > oldVersion)
        .sort((a, b) => a.version - b.version)
        .forEach(({ migration }) => migration(db));
    };
  });
};

export const tasksDB: ITaskDatabase = {
  async add(task: BaseTask): Promise<string> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TASKS], "readwrite");
      const store = transaction.objectStore(TASKS);

      // Get the highest order value
      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => {
        const tasks = getAllRequest.result;
        const maxOrder = tasks.reduce((max, t) => Math.max(max, t.order || 0), -1);
        
        // Generate a unique ID
        const id = crypto.randomUUID();
        const taskWithId: TaskRecord = {
          ...task,
          id,
          order: maxOrder + 1
        };

        const addRequest = store.add(taskWithId);
        
        addRequest.onsuccess = () => resolve(id);
        addRequest.onerror = () => reject(addRequest.error);
      };

      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  },

  async getAll(): Promise<TaskRecord[]> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TASKS], "readonly");
      const store = transaction.objectStore(TASKS);
      const request = store.getAll();

      request.onsuccess = () => {
        const tasks = request.result || [];
        resolve(tasks.sort((a, b) => (a.order || 0) - (b.order || 0)));
      };

      request.onerror = () => reject(request.error);
    });
  },

  async update(id: string, updates: Partial<TaskRecord>): Promise<void> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TASKS], "readwrite");
      const store = transaction.objectStore(TASKS);
      
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const existingTask = getRequest.result;
        if (!existingTask) {
          reject(new Error(`Task with id ${id} not found`));
          return;
        }

        const updatedTask = { ...existingTask, ...updates };
        const putRequest = store.put(updatedTask);
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  },

  async delete(id: string): Promise<void> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TASKS], "readwrite");
      const store = transaction.objectStore(TASKS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async completeOnePomodoro(taskId: string, completedTask: Task): Promise<void> {
    if (!taskId) {
      throw new Error("Task ID is required");
    }
    
    dbLogger.debug("Completing pomodoro for task", { taskId, completedTaskId: completedTask.id });
    
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TASKS, COMPLETED_TASKS], "readwrite");
      const tasksStore = transaction.objectStore(TASKS);
      const completedStore = transaction.objectStore(COMPLETED_TASKS);

      // First get the original task
      const getRequest = tasksStore.get(taskId);

      getRequest.onsuccess = () => {
        const originalTask = getRequest.result;
        if (!originalTask) {
          dbLogger.warn("Task not found in database - creating completed record without updating original", { taskId });
          
          // Debug: List all available tasks
          const debugRequest = tasksStore.getAll();
          debugRequest.onsuccess = () => {
            const allTasks = debugRequest.result || [];
            dbLogger.info("Available tasks in database", { 
              taskId, 
              availableTaskIds: allTasks.map(t => t.id),
              totalTasks: allTasks.length 
            });
          };
          
          // Instead of failing, just add to completed tasks without modifying the original
          // This handles the case where the task was already deleted or doesn't exist
          const completedTaskId = `${completedTask.id}_${Date.now()}`;
          const completedRecord: CompletedTaskRecord = {
            ...completedTask,
            id: completedTaskId,
            endTime: Date.now(),
            pomodorosCompleted: 1,
            order: 0 // Default order since we don't have the original task
          };

          const addCompletedRequest = completedStore.add(completedRecord);
          addCompletedRequest.onsuccess = () => {
            dbLogger.info("Added completed task record for missing original task", { taskId, completedTaskId });
            resolve();
          };
          addCompletedRequest.onerror = () => {
            dbLogger.error("Failed to add completed task record for missing original", { 
              error: addCompletedRequest.error, 
              completedTaskId,
              taskId
            });
            reject(addCompletedRequest.error);
          };
          
          return;
        }

        dbLogger.debug("Found original task", { taskId, remainingPomodoros: originalTask.pomodoros });

        const remainingPomodoros = (originalTask.pomodoros || 0) - 1;

        // Add to completed tasks
        const completedTaskId = `${completedTask.id}_${Date.now()}`;
        const completedRecord: CompletedTaskRecord = {
          ...completedTask,
          id: completedTaskId,
          endTime: Date.now(),
          pomodorosCompleted: 1,
          order: originalTask.order
        };

        const addCompletedRequest = completedStore.add(completedRecord);
        addCompletedRequest.onerror = () => {
          dbLogger.error("Failed to add completed task record", { 
            error: addCompletedRequest.error, 
            completedTaskId 
          });
          reject(addCompletedRequest.error);
        };

        // Update or delete original task
        if (remainingPomodoros >= 1) {
          dbLogger.debug("Updating task with remaining pomodoros", { taskId, remainingPomodoros });
          const updateRequest = tasksStore.put({
            ...originalTask,
            pomodoros: remainingPomodoros,
          });
          updateRequest.onerror = () => {
            dbLogger.error("Failed to update task", { 
              error: updateRequest.error, 
              taskId, 
              remainingPomodoros 
            });
            reject(updateRequest.error);
          };
        } else {
          dbLogger.debug("Deleting completed task", { taskId });
          const deleteRequest = tasksStore.delete(taskId);
          deleteRequest.onerror = () => {
            dbLogger.error("Failed to delete completed task", { 
              error: deleteRequest.error, 
              taskId 
            });
            reject(deleteRequest.error);
          };
        }

        transaction.oncomplete = () => {
          dbLogger.debug("Task completion transaction successful", { taskId, completedTaskId });
          resolve();
        };
      };

      getRequest.onerror = () => {
        dbLogger.error("Failed to get original task", { error: getRequest.error, taskId });
        reject(getRequest.error);
      };
      
      transaction.onerror = () => {
        dbLogger.error("Transaction failed during task completion", { 
          error: transaction.error, 
          taskId 
        });
        reject(transaction.error);
      };
    });
  },

  async getCompletedTasks(): Promise<CompletedTaskRecord[]> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COMPLETED_TASKS], "readonly");
      const store = transaction.objectStore(COMPLETED_TASKS);
      const index = store.index("endTime");
      const request = index.getAll();

      request.onsuccess = () => {
        const tasks = request.result || [];
        resolve(tasks.sort((a, b) => (b.endTime || 0) - (a.endTime || 0)));
      };

      request.onerror = () => reject(request.error);
    });
  },

  async getCompletedTasksForToday(): Promise<CompletedTaskRecord[]> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COMPLETED_TASKS], "readonly");
      const store = transaction.objectStore(COMPLETED_TASKS);
      const index = store.index("endTime");

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const request = index.getAll();
      request.onsuccess = () => {
        const tasks = request.result || [];
        resolve(
          tasks
            .filter(task => task.endTime >= startOfDay.getTime() && task.endTime <= endOfDay.getTime())
            .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
        );
      };
      request.onerror = () => reject(request.error);
    });
  },

  async updateCompletedTask(task: CompletedTaskRecord): Promise<void> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COMPLETED_TASKS], "readwrite");
      const store = transaction.objectStore(COMPLETED_TASKS);
      const request = store.put(task);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async deleteCompletedTask(taskId: string): Promise<void> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COMPLETED_TASKS], "readwrite");
      const store = transaction.objectStore(COMPLETED_TASKS);
      const request = store.delete(taskId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};

export const settingsDB: ISettingsDatabase = {
  /**
   * @deprecated Use getSetting instead
   */
  async get<T extends SettingValue>(key: SettingKey): Promise<T | null> {
    return this.getSetting<T>(key);
  },

  async getSetting<T extends SettingValue>(key: SettingKey): Promise<T | null> {
    validateKey(key);
    if (!isValidSettingKey(key)) {
      throw new Error(`Invalid setting key: ${key}`);
    }

    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SETTINGS], "readonly");
      const store = transaction.objectStore(SETTINGS);
      const request = store.get(key);

      request.onsuccess = () => {
        const record = request.result;
        resolve(record ? convertSettingValue<T>(record.value, key) : null);
      };

      request.onerror = () => reject(request.error);
    });
  },

  async setSetting<T extends SettingValue>(key: SettingKey, value: T): Promise<void> {
    validateKey(key);
    if (!isValidSettingKey(key)) {
      throw new Error(`Invalid setting key: ${key}`);
    }

    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SETTINGS], "readwrite");
      const store = transaction.objectStore(SETTINGS);
      const request = store.put({ id: key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getTimerSettings(): Promise<TimerSettings> {
    try {
      const workDuration =
        (await this.getSetting<number>("workDuration")) ?? DEFAULT_TIMER_SETTINGS.workDuration;
      const breakDuration =
        (await this.getSetting<number>("breakDuration")) ?? DEFAULT_TIMER_SETTINGS.breakDuration;
      const longBreakDuration =
        (await this.getSetting<number>("longBreakDuration")) ?? DEFAULT_TIMER_SETTINGS.longBreakDuration;
      const sessionsUntilLongBreak =
        (await this.getSetting<number>("sessionsUntilLongBreak")) ?? DEFAULT_TIMER_SETTINGS.sessionsUntilLongBreak;

      // Convert any values that might be in minutes to milliseconds
      const convertToMs = (value: number): number => {
        // If value is small (less than 1000), assume it's in minutes
        return value < 1000 ? value * 60 * 1000 : value;
      };

      return {
        workDuration: convertToMs(workDuration),
        breakDuration: convertToMs(breakDuration),
        longBreakDuration: convertToMs(longBreakDuration),
        sessionsUntilLongBreak
      };
    } catch (error) {
      dbLogger.error("Failed to get timer settings", { error });
      return DEFAULT_TIMER_SETTINGS;
    }
  },

  async setTimerSettings(settings: Partial<TimerSettings>): Promise<void> {
    const updates: Promise<void>[] = [];

    // Ensure all duration values are in milliseconds
    const ensureMilliseconds = (value: number): number => {
      return value < 1000 ? value * 60 * 1000 : value;
    };

    if (settings.workDuration !== undefined) {
      updates.push(this.setSetting("workDuration", ensureMilliseconds(settings.workDuration)));
    }
    if (settings.breakDuration !== undefined) {
      updates.push(this.setSetting("breakDuration", ensureMilliseconds(settings.breakDuration)));
    }
    if (settings.longBreakDuration !== undefined) {
      updates.push(this.setSetting("longBreakDuration", ensureMilliseconds(settings.longBreakDuration)));
    }
    if (settings.sessionsUntilLongBreak !== undefined) {
      updates.push(this.setSetting("sessionsUntilLongBreak", settings.sessionsUntilLongBreak));
    }

    await Promise.all(updates);
  }
};