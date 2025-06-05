import React, { useEffect, useState } from "react";
import {
  COMPLETION_MESSAGES,
  ERROR_MESSAGES,
  TIMER_TITLES,
  TIMER_TYPES,
} from "../../constants/timerConstants";
import { useLogger } from "../../hooks/useLogger";
import { useTimer } from "../../hooks/useTimer";
import type { TimerProps, TimerState, TimerMode } from "../../types/timer";
import { tasksDB } from "../../utils/database";
import {
  initializeNotifications,
  showNotification,
} from "../../utils/notifications";
import { Notification } from "../Notification";
import styles from "./Timer.module.css";
import { TimerControls } from "./TimerControls";
import { TimerDisplay } from "./TimerDisplay";
import { usePostHog } from "posthog-js/react";

export const Timer: React.FC<TimerProps> = ({
  selectedTask,
  onTaskComplete,
}) => {
  const [notification, setNotification] = useState<string | null>(null);
  const timerLogger = useLogger("Timer");
  const posthog = usePostHog();

  const {
    state,
    startBreak,
    startTimer,
    resetTimer,
    pauseTimer,
    switchTimer,
    settings,
  } = useTimer({
    onComplete: async (state: TimerState) => {
      if (state.timerType === TIMER_TYPES.WORK) {
        // Mark the pomodoro as completed in the database
        await handleDone(state);
      } else {
        // For break timers, just show notification
        showNotification(state.timerType);
        setNotification(COMPLETION_MESSAGES[state.timerType]);
      }
    },
  });

  const canStartWorkTimer = selectedTask !== null;

  const handleStartWorkTimer = () => {
    startTimer(selectedTask);
    if (!posthog.has_opted_in_capturing()) {
      timerLogger.debug(
        "Analytics disabled - skipping event capture for timer start",
      );
      return;
    }
    try {
      posthog.capture("timer_started", {
        timerType: state.timerType as TimerMode,
      });
      timerLogger.debug("Analytics event captured for timer start", {
        timer_type: state.timerType,
      });
    } catch (error) {
      timerLogger.warn("Failed to capture analytics for timer start:", {
        error,
        timer_type: state.timerType,
      });
    }
  };

  const handleStartBreakTimer = () => {
    startBreak(state.timerType);
  };

  const handlePause = () => {
    pauseTimer();
  };

  const handleResume = () => {
    startTimer(selectedTask);
  };

  const handleSkip = () => {
    switchTimer();
  };

  const handleResetCurrentTimer = () => {
    resetTimer();
  };

  const showInAppNotification = (message: string) => {
    setNotification(message);
  };
  const handleDone = async (timerState: TimerState) => {
    if (!timerState) {
      timerLogger.error("Timer state is null or undefined");
      return;
    }

    // Check if this is a break timer - if so, just show notification and switch
    if (
      timerState.timerType === TIMER_TYPES.BREAK ||
      timerState.timerType === TIMER_TYPES.LONG_BREAK
    ) {
      switchTimer();
      showNotification(timerState.timerType);
      setNotification(COMPLETION_MESSAGES[timerState.timerType]);
      return;
    }

    // For work timers, complete the task first, then switch
    let actualDurationMs = undefined;

    if (timerState.hasCompleted) {
      actualDurationMs = settings.workDuration;
    } else if (!timerState.hasCompleted && timerState.hasStarted) {
      // Calculate actual duration based on time spent
      const totalDurationMs = settings.workDuration;
      const timeLeftMs = timerState.timeLeft;
      actualDurationMs = totalDurationMs - timeLeftMs;
    }

    // Validate required data before proceeding
    if (!timerState.activeTaskId) {
      timerLogger.error("No active task ID found", { timerState });
      showInAppNotification(ERROR_MESSAGES.TASK_COMPLETE_FAILED);
      switchTimer();
      return;
    }

    // Check if the task from timer state still exists - don't rely on selectedTask
    // since it might have changed due to task reordering/deletion
    let taskToComplete = selectedTask;
    if (!selectedTask || selectedTask.id !== timerState.activeTaskId) {
      timerLogger.warn("Selected task doesn't match timer's active task", {
        selectedTaskId: selectedTask?.id,
        activeTaskId: timerState.activeTaskId
      });
      
      // The task might have been moved or the activeTask selection changed
      // We'll still try to complete the original task from the timer
      taskToComplete = {
        id: timerState.activeTaskId,
        category: selectedTask?.category || "Unknown",
        description: selectedTask?.description || "Task from timer",
        completed: false,
        pomodoros: 1
      };
    }

    if (!taskToComplete) {
      timerLogger.error("No task to complete", { 
        activeTaskId: timerState.activeTaskId,
        selectedTask: selectedTask?.id 
      });
      showInAppNotification(ERROR_MESSAGES.TASK_COMPLETE_FAILED);
      switchTimer();
      return;
    }

    const completedTask = {
      ...taskToComplete,
      id: `completed-${timerState.activeTaskId}-${Date.now()}`,
      endTime: Date.now(),
      duration: actualDurationMs,
      completed: true,
      pomodoros: 1,
    };

    try {
      await tasksDB.completeOnePomodoro(timerState.activeTaskId, completedTask);
      await onTaskComplete();
      
      // Analytics tracking
      if (!posthog.has_opted_in_capturing()) {
        timerLogger.debug(
          "Analytics disabled - skipping event capture for timer completion",
        );
      } else {
        try {
          posthog.capture("timer_completed", {
            timer_type: timerState.timerType,
            task_id: timerState.activeTaskId,
            duration: actualDurationMs,
          });
          timerLogger.debug("Analytics event captured for timer completion", {
            timer_type: timerState.timerType,
            task_id: timerState.activeTaskId,
            duration: actualDurationMs,
          });
        } catch (analyticsError) {
          timerLogger.warn(
            "Failed to capture analytics for timer completion:",
            {
              error: analyticsError,
              timer_type: timerState.timerType,
              task_id: timerState.activeTaskId,
            },
          );
        }
      }

      // Success - switch timer and show completion message
      switchTimer();
      showNotification(timerState.timerType);
      setNotification(COMPLETION_MESSAGES[timerState.timerType]);
      showInAppNotification(COMPLETION_MESSAGES[timerState.timerType]);
      
    } catch (error) {
      timerLogger.error(
        "Failed to complete task:",
        error instanceof Error ? error.message : error,
        { 
          activeTaskId: timerState.activeTaskId, 
          selectedTask: selectedTask?.id,
          taskToComplete: taskToComplete?.id,
          timerState,
          errorDetails: error instanceof Error ? error.stack : error
        }
      );
      showInAppNotification(ERROR_MESSAGES.TASK_COMPLETE_FAILED);
      
      // Still switch timer even if task completion failed
      switchTimer();
      showNotification(timerState.timerType);
      setNotification(COMPLETION_MESSAGES[timerState.timerType]);
    }
  };

  useEffect(() => {
    initializeNotifications();
  }, []);

  const getTimerTitle = () => {
    const session = Math.floor(state.sessionsCompleted) + 1;
    const title = TIMER_TITLES[state.timerType];
    return typeof title === "function" ? title(session) : title;
  };

  return (
    <>
      <div className={`${styles.timerContainer} ${styles[state.timerType]}`}>
        <div className={styles.timerHeader}>
          <div className={styles.headerLeft}>
            <span className={styles.comingSoon}>⚙️</span>
            <span className={styles.comingSoon}>📋</span>
          </div>
          <div>{getTimerTitle()}</div>
        </div>
        <div className={styles.timerDisplay}>
          <TimerDisplay timeLeft={state.timeLeft} />
        </div>
        <div className={styles.taskName}>
          {selectedTask ? selectedTask.description : "No task selected"}
        </div>
        <TimerControls
          isPaused={!state.isRunning && state.hasStarted}
          hasStarted={state.hasStarted}
          onStart={handleStartWorkTimer}
          onBreak={handleStartBreakTimer}
          onResume={handleResume}
          onPause={handlePause}
          onStop={handleResetCurrentTimer}
          onDone={() => handleDone(state)}
          onSkip={handleSkip}
          disableWorkTimer={!canStartWorkTimer}
          timerType={state.timerType}
        />
      </div>
      {notification && (
        <Notification
          message={notification}
          onClose={() => setNotification(null)}
        />
      )}
    </>
  );
};
