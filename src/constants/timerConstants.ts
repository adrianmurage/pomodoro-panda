import type { TimerMode } from '../types/timer';

export const TIMER_TYPES: Record<string, TimerMode> = {
  WORK: "work",
  BREAK: "break",
  LONG_BREAK: "longBreak",
} as const;

export const DEFAULT_TIMER_SETTINGS = {
  workDuration: 25 * 60 * 1000, // 25 minutes (standard Pomodoro duration)
  breakDuration: 5 * 60 * 1000, // 5 minutes (standard short break)
  longBreakDuration: 15 * 60 * 1000, // 15 minutes (standard long break)
  sessionsUntilLongBreak: 4,
} as const;

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

// Add type guards for better type safety
export function isTimerMode(value: string): value is TimerMode {
  return Object.values(TIMER_TYPES).includes(value as TimerMode);
}
