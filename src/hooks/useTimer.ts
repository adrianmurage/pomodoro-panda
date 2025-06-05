import { useEffect, useCallback } from "react";
import type { Task } from "../types/task";
import type { TimerState, UseTimerProps } from "../types/timer";
import type { TimerMode } from "../types/timer";
import useTimerContext from "./useTimerContext";

export const useTimer = ({ onComplete }: UseTimerProps = {}) => {
  const timerContext = useTimerContext();

  // Register onComplete callback
  useEffect(() => {
    if (onComplete) {
      timerContext.setOnComplete((state: TimerState) => onComplete(state));
    }

    // Clean up on unmount
    return () => {
      timerContext.setOnComplete(() => {});
    };
  }, [onComplete, timerContext]);

  // Wrap the timer methods to ensure they use current settings
  const startBreak = useCallback(
    (breakType: TimerMode) => {
      timerContext.startBreak(breakType);
    },
    [timerContext],
  );

  const startTimer = useCallback(
    (task: Task) => {
      timerContext.startTimer(task);
    },
    [timerContext],
  );

  const pauseTimer = useCallback(() => {
    timerContext.pauseTimer();
  }, [timerContext]);

  const resetTimer = useCallback(() => {
    timerContext.resetTimer();
  }, [timerContext]);

  const switchTimer = useCallback(() => {
    timerContext.switchTimer();
  }, [timerContext]);

  const getStartTime = useCallback(() => timerContext.state.startTime, [timerContext.state.startTime]);
  
  const getExpectedEndTime = useCallback(() => timerContext.state.expectedEndTime, [timerContext.state.expectedEndTime]);

  return {
    state: timerContext.state,
    startBreak,
    startTimer,
    pauseTimer,
    resetTimer,
    switchTimer,
    settings: timerContext.settings,
    getStartTime,
    getExpectedEndTime,
  };
};
