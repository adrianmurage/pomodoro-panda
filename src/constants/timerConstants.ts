import { UserSettings } from "../pages/Settings";

export const TIMER_TYPES = {
  WORK: "work",
  BREAK: "break",
  LONG_BREAK: "longBreak",
} as const;

export type TimerType = (typeof TIMER_TYPES)[keyof typeof TIMER_TYPES];

export const DEFAULT_TIMER_SETTINGS = {
  workDuration: 90 * 60 * 1000, // 90 minutes
  breakDuration: 30 * 60 * 1000, // 30 minutes
  longBreakDuration: 60 * 60 * 1000, // 60 minutes
  sessionsUntilLongBreak: 4,
} as const;

// Add this near your imports or above your component
export const USER_SETTINGS_KEYS: (keyof UserSettings)[] = [
  "addTasksToBottom",
  "workDuration",
  "breakDuration",
  "longBreakDuration",
  "sessionsUntilLongBreak",
];

export const NOTIFICATION_MESSAGES = {
  [TIMER_TYPES.WORK]: "Time to take a break!",
  [TIMER_TYPES.BREAK]: "Time to focus!",
  [TIMER_TYPES.LONG_BREAK]: "Time to focus!",
} as const;

export const COMPLETION_MESSAGES = {
  [TIMER_TYPES.WORK]: "Work session completed!",
  [TIMER_TYPES.BREAK]: "Break session completed!",
  [TIMER_TYPES.LONG_BREAK]: "Long break session completed!",
} as const;

export const ERROR_MESSAGES = {
  TASK_LOAD_FAILED: "Failed to load tasks",
  TASK_UPDATE_FAILED: "Failed to update task",
  TASK_COMPLETE_FAILED: "Failed to complete task",
} as const;

export const TIMER_TITLES = {
  [TIMER_TYPES.WORK]: (session: number) => `Pomodoro ${session}`,
  [TIMER_TYPES.BREAK]: "Short Break",
  [TIMER_TYPES.LONG_BREAK]: "Long Break",
  DEFAULT: "Timer",
} as const;

/**
 * Determines whether a given string is a valid {@link TimerType}.
 *
 * @param value - The string to check.
 * @returns True if {@link value} is one of the defined timer types; otherwise, false.
 */
export function isTimerType(value: string): value is TimerType {
  return Object.values(TIMER_TYPES).includes(value as TimerType);
}
