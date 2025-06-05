import { Task } from './task';
import { TimerSettings } from './timer';

// Store Names
export const STORE_NAMES = {
    TASKS: 'tasks',
    COMPLETED_TASKS: 'completedTasks',
    SETTINGS: 'settings',
} as const;

export type StoreName = typeof STORE_NAMES[keyof typeof STORE_NAMES];

// Base Task Type (without id and order)
export type BaseTask = Omit<Task, 'id' | 'order'>;

// Task Record Types
export interface TaskRecord extends Task {
    id: string;
    order: number;
    category: string;
    description: string;
    completed: boolean;
    pomodoros: number;
}

export interface CompletedTaskRecord extends Omit<TaskRecord, 'pomodoros'> {
    endTime: number;
    pomodorosCompleted: number;
}

// Settings Types
export type SettingKey = 
    | 'workDuration'
    | 'breakDuration'
    | 'longBreakDuration'
    | 'sessionsUntilLongBreak'
    | 'addTasksToBottom'
    | 'autoStartBreaks'
    | 'autoStartPomodoros';

export type SettingValue = string | number | boolean;

export interface SettingRecord {
    id: SettingKey;
    value: SettingValue;
}



// Database Operation Results
export interface DatabaseOperationResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
}

// Database Migration Types
export type MigrationFunction = (db: IDBDatabase) => void;

export interface DatabaseMigrations {
    [version: number]: MigrationFunction;
}

// Database Store Configurations
export interface StoreConfig {
    name: StoreName;
    keyPath: string;
    indexes?: {
        name: string;
        keyPath: string;
        options?: IDBIndexParameters;
    }[];
}

// Timer Settings Types
export interface TimerSettingsRecord {
    workDuration: {
        id: 'workDuration';
        value: number;
    };
    breakDuration: {
        id: 'breakDuration';
        value: number;
    };
    longBreakDuration: {
        id: 'longBreakDuration';
        value: number;
    };
    sessionsUntilLongBreak: {
        id: 'sessionsUntilLongBreak';
        value: number;
    };
}

// Transaction Types
export type TransactionMode = 'readonly' | 'readwrite';

export interface TransactionOptions {
    mode?: TransactionMode;
    stores: StoreName[];
}

// Error Types
export class DatabaseError extends Error {
    constructor(
        message: string,
        public readonly operation: string,
        public readonly store?: StoreName,
        public readonly originalError?: Error
    ) {
        super(message);
        this.name = 'DatabaseError';
    }
}

// Database Interface
export interface ITaskDatabase {
    // Task Operations
    add(task: BaseTask): Promise<string>;
    getAll(): Promise<TaskRecord[]>;
    update(id: string, updates: Partial<TaskRecord>): Promise<void>;
    delete(id: string): Promise<void>;
    
    // Completed Task Operations
    completeOnePomodoro(taskId: string, completedTask: Task): Promise<void>;
    getCompletedTasks(): Promise<CompletedTaskRecord[]>;
    getCompletedTasksForToday(): Promise<CompletedTaskRecord[]>;
    updateCompletedTask(task: CompletedTaskRecord): Promise<void>;
    deleteCompletedTask(taskId: string): Promise<void>;
}

export interface ISettingsDatabase {
    // Settings Operations
    get<T extends SettingValue>(key: SettingKey): Promise<T | null>;
    getSetting<T extends SettingValue>(key: SettingKey): Promise<T | null>;
    setSetting<T extends SettingValue>(key: SettingKey, value: T): Promise<void>;
    getTimerSettings(): Promise<TimerSettings>;
    setTimerSettings(settings: Partial<TimerSettings>): Promise<void>;
}