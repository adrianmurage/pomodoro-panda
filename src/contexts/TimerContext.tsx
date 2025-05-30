import React, {
  createContext,
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from "react";
import {
  DEFAULT_TIMER_SETTINGS,
  TIMER_TYPES,
  type TimerType,
} from "../constants/timerConstants";
import type { Task } from "../types/task";
import type {
  TimerAction,
  TimerContextType,
  TimerSettings,
  TimerState,
} from "../types/timer";
import { useUserSettings } from "../hooks/useUserSettings";

const initialState: TimerState = {
  timeLeft: DEFAULT_TIMER_SETTINGS.workDuration,
  isRunning: false,
  hasStarted: false,
  timerType: TIMER_TYPES.WORK,
  activeTaskId: null,
  startTime: null,
  expectedEndTime: undefined,
  sessionsCompleted: 0,
  hasCompleted: false,
};

function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case "UPDATE_TIMER_STATE":
      return { ...state, ...action.payload };
    case "START_BREAK":
      return {
        ...state,
        timeLeft: action.payload.duration,
        isRunning: true,
        hasStarted: true,
        timerType: action.payload.timerType,
        activeTaskId: null,
        startTime: action.payload.startTime,
        expectedEndTime: action.payload.expectedEndTime,
        hasCompleted: false,
      };
    case "START_TIMER":
      return {
        ...state,
        activeTaskId: action.payload?.activeTaskId ?? null,
        isRunning: true,
        hasStarted: true,
        startTime: action.payload?.startTime ?? Date.now(),
        expectedEndTime: Date.now() + state.timeLeft,
      };

    case "PAUSE_TIMER":
      return {
        ...state,
        isRunning: false,
        // Keep timeLeft as is
      };

    case "UPDATE_TIME_LEFT":
      return {
        ...state,
        timeLeft: action.payload.timeLeft,
      };
    default:
      return state;
  }
}

const TimerContext = createContext<TimerContextType | null>(null);

export const TimerProvider: React.FC<{
  children: React.ReactNode;
  settings?: TimerSettings;
}> = ({ children, settings = DEFAULT_TIMER_SETTINGS }) => {
  const { settings: userSettings, isLoading: userSettingsLoading } =
    useUserSettings();

  const [state, dispatch] = useReducer(timerReducer, initialState);

  const isInitialStateLoaded = useRef<boolean>(false);

  // Animation frame reference
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Callback for timer completion
  const onCompleteRef = useRef<((state: TimerState) => void) | null>(null);

  // Set callback for timer completion
  const setOnComplete = useCallback((callback: (state: TimerState) => void) => {
    onCompleteRef.current = callback;
  }, []);

  // Get next timer type and duration
  const getNextTimer = useCallback(() => {
    if (state.timerType === TIMER_TYPES.WORK) {
      const nextSessions = state.sessionsCompleted + 1;

      if (nextSessions % settings.sessionsUntilLongBreak === 0) {
        return {
          type: TIMER_TYPES.LONG_BREAK,
          duration: settings.longBreakDuration,
        };
      }
      return {
        type: TIMER_TYPES.BREAK,
        duration: settings.breakDuration,
      };
    }
    return {
      type: TIMER_TYPES.WORK,
      duration: settings.workDuration,
    };
  }, [state.timerType, state.sessionsCompleted, settings]);

  // Update timer logic
  const updateTimer = useCallback(() => {
    if (!state.isRunning || !state.startTime || !state.expectedEndTime) return;

    const now = Date.now();
    const remaining = Math.max(0, state.expectedEndTime - now);
    const newTimeLeft = Math.ceil(remaining);

    // Check if timer completed
    if (newTimeLeft <= 0) {
      const finalState = {
        ...state,
        hasCompleted: true,
        isRunning: false,
        timeLeft: 0,
      };

      // Call completion callback
      if (onCompleteRef.current) {
        onCompleteRef.current(finalState);
      }

      return;
    }

    // Only update if time has changed
    if (newTimeLeft !== state.timeLeft) {
      dispatch({
        type: "UPDATE_TIME_LEFT",
        payload: { timeLeft: newTimeLeft },
      });
    }

    // Schedule next update
    animationFrameRef.current = requestAnimationFrame(updateTimer);
  }, [state]);

  // Start animation frame when running
  useEffect(() => {
    if (userSettingsLoading) return;

    // check if the initialState setup is done
    if (!isInitialStateLoaded.current) {
      const initialTimeLeft = userSettings.workDuration * 60 * 1000;

      dispatch({
        type: "UPDATE_TIMER_STATE",
        payload: {
          timeLeft: initialTimeLeft,
        },
      });
      isInitialStateLoaded.current = true;
    }
    if (state.isRunning) {
      animationFrameRef.current = requestAnimationFrame(updateTimer);
    }

    // Set the initialState
    if (!state.isRunning) {
      console.log("User settings", userSettings.workDuration);
      console.log("Initial State: ", initialState.timeLeft);
      initialState.timeLeft = userSettings.workDuration * 90 * 1000;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    state.isRunning,
    updateTimer,
    userSettings.workDuration,
    userSettingsLoading,
  ]);

  // Action creators
  const startTimer = useCallback(
    (task: Task) => {
      const now = Date.now();
      dispatch({
        type: "START_TIMER",
        payload: {
          startTime: now,
          expectedEndTime: now + state.timeLeft,
          activeTaskId: task.id,
        },
      });
    },
    [state.timeLeft]
  );

  const startBreak = useCallback(
    (breakType: TimerType) => {
      const now = Date.now();
      if (breakType === TIMER_TYPES.BREAK) {
        dispatch({
          type: "START_BREAK",
          payload: {
            startTime: now,
            expectedEndTime: now + userSettings.breakDuration,
            duration: userSettings.breakDuration,
            timerType: TIMER_TYPES.BREAK,
          },
        });
      } else if (breakType === TIMER_TYPES.LONG_BREAK) {
        dispatch({
          type: "START_BREAK",
          payload: {
            startTime: now,
            expectedEndTime: now + userSettings.longBreakDuration,
            duration: userSettings.longBreakDuration,
            timerType: TIMER_TYPES.LONG_BREAK,
          },
        });
      }
    },
    [userSettings.breakDuration, userSettings.longBreakDuration]
  );

  const pauseTimer = useCallback(() => {
    dispatch({ type: "PAUSE_TIMER" });
  }, []);

  /**
   * This function is used to reset the timer.
   * It resets uses the update timer state action to reset:
   * - isRunning to false
   * - hasStarted to false
   * - activeTaskId to null
   * - startTime to null
   * - expectedEndTime to undefined
   * - hasCompleted to false
   * - timeLeft to either break duration | long break duration
   */
  const resetTimer = useCallback(() => {
    const payload: Partial<TimerState> = {
      isRunning: false,
      hasStarted: false,
      activeTaskId: null,
      startTime: null,
      expectedEndTime: undefined,
      hasCompleted: false,
    };
    if (state.timerType === TIMER_TYPES.WORK) {
      payload.timeLeft = userSettings.workDuration;
    } else if (state.timerType === TIMER_TYPES.BREAK) {
      payload.timeLeft = userSettings.breakDuration;
    } else if (state.timerType === TIMER_TYPES.LONG_BREAK) {
      payload.timeLeft = userSettings.longBreakDuration;
    }
    dispatch({ type: "UPDATE_TIMER_STATE", payload: payload });
  }, [
    userSettings.breakDuration,
    userSettings.longBreakDuration,
    userSettings.workDuration,
    state.timerType,
  ]);

  /**
   * This function is used to switch the timer to the next timer type.
   * It updates the timer state to the next timer type and resets the timer.
   * It also updates the sessions completed if the timer is switched from WORK to a break type.
   */
  const switchTimer = useCallback(() => {
    const nextTimer = getNextTimer();

    const payload: Partial<TimerState> = {
      isRunning: false,
      hasStarted: false,
      activeTaskId: null,
      startTime: null,
      expectedEndTime: undefined,
      hasCompleted: false,
    };

    if (nextTimer.type === TIMER_TYPES.WORK) {
      payload.timeLeft = userSettings.workDuration * 60 * 1000;
      payload.timerType = TIMER_TYPES.WORK;
      payload.sessionsCompleted = state.sessionsCompleted + 1;
    } else if (nextTimer.type === TIMER_TYPES.BREAK) {
      payload.timeLeft = userSettings.breakDuration;
      payload.timerType = TIMER_TYPES.BREAK;
      payload.sessionsCompleted = state.sessionsCompleted;
    } else if (nextTimer.type === TIMER_TYPES.LONG_BREAK) {
      payload.timeLeft = userSettings.longBreakDuration;
      payload.timerType = TIMER_TYPES.LONG_BREAK;
      payload.sessionsCompleted = state.sessionsCompleted;
    }

    dispatch({
      type: "UPDATE_TIMER_STATE",
      payload: payload,
    });
  }, [
    getNextTimer,
    userSettings.breakDuration,
    userSettings.longBreakDuration,
    userSettings.workDuration,
    state.sessionsCompleted,
  ]);

  const value = {
    state,
    startBreak,
    startTimer,
    pauseTimer,
    resetTimer,
    switchTimer,
    setOnComplete,
    settings: userSettings,
  };

  if (userSettingsLoading) {
    return null;
  }

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
};

export default TimerContext;
