import { DEFAULT_TIMER_SETTINGS } from "../constants/timerConstants";
import { Task, TimerSettings } from "../types";
import { logger } from "./logger";

const dbLogger = logger.createLogger("Database");

// Add environment check and database name configuration
const IS_PROD = process.env.NODE_ENV === "production";
const DB_PREFIX = IS_PROD ? "prod" : "dev";
const DB_NAME = `${DB_PREFIX}_PomodoroDB` as const;

// Store names as constants
export const TASKS_STORE = "tasks" as const;
export const COMPLETED_TASKS_STORE = "completedTasks" as const;
export const SETTINGS_STORE = "settings" as const;

// Database version history with migrations
const DB_MIGRATIONS = {
  1: (db: IDBDatabase) => {
    // Initial version - Basic task management
    const taskStore = db.createObjectStore(TASKS_STORE, { keyPath: "id" });
    taskStore.createIndex("endTime", "endTime");
    taskStore.createIndex("order", "order");
  },
  2: (db: IDBDatabase) => {
    // Added completed tasks tracking
    const completedStore = db.createObjectStore(COMPLETED_TASKS_STORE, {
      keyPath: "id",
    });
    completedStore.createIndex("endTime", "endTime");
  },
  3: (db: IDBDatabase) => {
    // Added settings store
    if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
      db.createObjectStore(SETTINGS_STORE, { keyPath: "id" });
    }
  },
} as const;

// Current version is highest migration number
const DB_VERSION = Math.max(...Object.keys(DB_MIGRATIONS).map(Number));

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbLogger.error("Database error:", request.error);
      reject(request.error);
    };

    request.onblocked = () => {
      dbLogger.warn("Please close all other tabs with this site open!");
    };

    request.onsuccess = () => {
      const db = request.result;

      // Handle version change requests from other tabs
      db.onversionchange = () => {
        db.close();
        // Only show warning in non-test environment
        if (process.env.NODE_ENV !== "test") {
          dbLogger.warn("Database is outdated, please reload the page.");
        }
      };

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      // Run all migrations in sequence
      for (let version = oldVersion + 1; version <= DB_VERSION; version++) {
        const migration = DB_MIGRATIONS[version as keyof typeof DB_MIGRATIONS];
        if (migration) {
          migration(db);
        }
      }

      if (!db.objectStoreNames.contains(TASKS_STORE)) {
        db.createObjectStore(TASKS_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(COMPLETED_TASKS_STORE)) {
        db.createObjectStore(COMPLETED_TASKS_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: "id" });
      }
    };
  });
};

export const tasksDB = {
  async add(task: Task): Promise<string> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TASKS_STORE], "readwrite");
      const store = transaction.objectStore(TASKS_STORE);

      // Use cursor for memory efficiency
      const tasks: Task[] = [];
      const cursorRequest = store.openCursor();

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          tasks.push(cursor.value);
          cursor.continue();
        } else {
          // All tasks collected, now add new task
          const taskWithOrder = { ...task, order: tasks.length };

          // Batch operations for better performance
          const batchSize = 100;
          for (let i = 0; i < tasks.length; i += batchSize) {
            const batch = tasks.slice(i, i + batchSize);
            batch.forEach((t) => store.put(t));
          }

          store.add(taskWithOrder);
        }
      };

      transaction.oncomplete = () => resolve(task.id);
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async getAll(): Promise<Task[]> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TASKS_STORE], "readonly");
      const store = transaction.objectStore(TASKS_STORE);

      const request = store.getAll();

      request.onsuccess = () => {
        const tasks = request.result || [];
        // Sort by order property only
        const sortedTasks = [...tasks].sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
          }
          return 0; // maintain original order if no order property
        });
        resolve(sortedTasks);
      };

      request.onerror = () => reject(request.error);
    });
  },

  async update(task: Task): Promise<void> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TASKS_STORE], "readwrite");
      const store = transaction.objectStore(TASKS_STORE);
      const request = store.put(task);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async updateAll(tasks: Task[]): Promise<void> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TASKS_STORE], "readwrite");
      const store = transaction.objectStore(TASKS_STORE);

      transaction.onerror = () => reject(transaction.error);

      // Clear existing tasks
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => {
        // Handle empty array case
        if (tasks.length === 0) {
          resolve();
          return;
        }

        // Add all tasks in order
        let count = 0;
        tasks.forEach((task, index) => {
          const taskWithOrder = { ...task, order: index };
          const request = store.add(taskWithOrder);

          request.onsuccess = () => {
            count++;
            if (count === tasks.length) {
              resolve();
            }
          };

          request.onerror = (event) => {
            event.preventDefault(); // Prevent transaction abort
            reject(request.error);
          };
        });
      };

      clearRequest.onerror = () => reject(clearRequest.error);
    });
  },

  async delete(taskId: string): Promise<void> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TASKS_STORE], "readwrite");
      const store = transaction.objectStore(TASKS_STORE);

      // First check if task exists
      const getRequest = store.get(taskId);

      transaction.onerror = () => reject(transaction.error);

      getRequest.onsuccess = () => {
        if (!getRequest.result) {
          resolve(); // Task doesn't exist, nothing to delete
          return;
        }

        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          const tasks = getAllRequest.result;
          const sortedTasks = tasks.sort(
            (a, b) => (a.order ?? 0) - (b.order ?? 0),
          );

          const deleteRequest = store.delete(taskId);

          deleteRequest.onsuccess = () => {
            const remainingTasks = sortedTasks
              .filter((t) => t.id !== taskId)
              .map((task, index) => ({
                ...task,
                order: index,
              }));

            if (remainingTasks.length === 0) {
              resolve();
              return;
            }

            const updateTransaction = db.transaction(
              [TASKS_STORE],
              "readwrite",
            );
            const updateStore = updateTransaction.objectStore(TASKS_STORE);

            updateTransaction.oncomplete = () => resolve();
            updateTransaction.onerror = () => reject(updateTransaction.error);

            remainingTasks.forEach((task) => {
              updateStore.put(task);
            });
          };

          deleteRequest.onerror = () => reject(deleteRequest.error);
        };

        getAllRequest.onerror = () => reject(getAllRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  },

  async getCompletedTasks(): Promise<Task[]> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COMPLETED_TASKS_STORE], "readonly");
      const store = transaction.objectStore(COMPLETED_TASKS_STORE);
      const index = store.index("endTime");

      // Get all completed tasks sorted by endTime in descending order
      const request = index.getAll();

      request.onsuccess = () => {
        const tasks = request.result || [];
        resolve(tasks.sort((a, b) => (b.endTime || 0) - (a.endTime || 0)));
      };

      request.onerror = () => reject(request.error);
    });
  },

  // Add a method that returns all completed tasks with a filter for only tasks completed today
  async getCompletedTasksForToday(): Promise<Task[]> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COMPLETED_TASKS_STORE], "readonly");
      const store = transaction.objectStore(COMPLETED_TASKS_STORE);
      const index = store.index("endTime");

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const request = index.getAll();
      request.onsuccess = () => {
        const tasks = request.result || [];
        // the tasks should have the latest first and the oldest last
        resolve(
          tasks
            .filter(
              (task) =>
                task.endTime &&
                task.endTime >= startOfDay &&
                task.endTime < endOfDay,
            )
            .sort((a, b) => (b.endTime || 0) - (a.endTime || 0)),
        );
      };
      request.onerror = () => reject(request.error);
    });
  },

  async completeOnePomodoro(
    taskId: string,
    completedPomodoro: Task,
  ): Promise<void> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [TASKS_STORE, COMPLETED_TASKS_STORE],
        "readwrite",
      );

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      const tasksStore = transaction.objectStore(TASKS_STORE);
      const completedStore = transaction.objectStore(COMPLETED_TASKS_STORE);

      const checkRequest = completedStore.get(completedPomodoro.id);

      checkRequest.onsuccess = () => {
        if (checkRequest.result) {
          completedPomodoro.id = `${completedPomodoro.id}_${Date.now()}`;
        }

        const getRequest = tasksStore.get(taskId);

        getRequest.onsuccess = () => {
          const originalTask = getRequest.result;

          if (!originalTask) {
            transaction.abort();
            reject(new Error("Task not found"));
            return;
          }
          const remainingPomodoros = (originalTask.pomodoros || 0) - 1;

          completedStore.add(completedPomodoro);

          if (remainingPomodoros >= 1) {
            tasksStore.put({
              ...originalTask,
              pomodoros: remainingPomodoros,
            });
          } else {
            tasksStore.delete(taskId);
          }
        };

        getRequest.onerror = () => {
          transaction.abort();
          reject(getRequest.error);
        };
      };

      checkRequest.onerror = () => {
        transaction.abort();
        reject(checkRequest.error);
      };
    });
  },

  async updateCompletedTask(task: Task): Promise<void> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COMPLETED_TASKS_STORE], "readwrite");
      const store = transaction.objectStore(COMPLETED_TASKS_STORE);
      const request = store.put(task);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async deleteCompletedTask(taskId: string): Promise<void> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COMPLETED_TASKS_STORE], "readwrite");
      const store = transaction.objectStore(COMPLETED_TASKS_STORE);
      const request = store.delete(taskId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
};

export const settingsDB = {
  async get<T>(key: string): Promise<T | null> {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SETTINGS_STORE], "readonly");
      const store = transaction.objectStore(SETTINGS_STORE);
      const request = store.get(key);

      request.onsuccess = () => {
        const value = request.result?.value;
        resolve(value === undefined ? null : value as T);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async set<T>(key: string, value: T): Promise<void> {
    if (!key || typeof key !== "string" || key.trim() === "") {
      throw new Error("Setting key cannot be empty");
    }

    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SETTINGS_STORE], "readwrite");
      const store = transaction.objectStore(SETTINGS_STORE);
      const request = store.put({ id: key, value });

      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  // Timer settings helpers
  async getTimerSettings(): Promise<TimerSettings> {
    try {
      const workDuration =
        (await this.get<number>("workDuration")) ?? DEFAULT_TIMER_SETTINGS.workDuration;
      const breakDuration =
        (await this.get<number>("breakDuration")) ??
        DEFAULT_TIMER_SETTINGS.breakDuration;
      const longBreakDuration =
        (await this.get<number>("longBreakDuration")) ??
        DEFAULT_TIMER_SETTINGS.longBreakDuration;
      const sessionsUntilLongBreak =
        (await this.get<number>("sessionsUntilLongBreak")) ??
        DEFAULT_TIMER_SETTINGS.sessionsUntilLongBreak;

      return {
        workDuration,
        breakDuration,
        longBreakDuration,
        sessionsUntilLongBreak,
      };
    } catch (error) {
      console.error("Failed to get timer settings:", error);
      return DEFAULT_TIMER_SETTINGS;
    }
  },

  async setTimerSettings(settings: Partial<TimerSettings>): Promise<void> {
    const updates: Promise<void>[] = [];

    if (settings.workDuration !== undefined) {
      updates.push(this.set("workDuration", settings.workDuration));
    }
    if (settings.breakDuration !== undefined) {
      updates.push(this.set("breakDuration", settings.breakDuration));
    }
    if (settings.longBreakDuration !== undefined) {
      updates.push(this.set("longBreakDuration", settings.longBreakDuration));
    }
    if (settings.sessionsUntilLongBreak !== undefined) {
      updates.push(
        this.set("sessionsUntilLongBreak", settings.sessionsUntilLongBreak),
      );
    }

    await Promise.all(updates);
  },
};
