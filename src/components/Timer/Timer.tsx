import React, { useEffect, useState } from 'react';
import {
    COMPLETION_MESSAGES,
    ERROR_MESSAGES,
    TIMER_TITLES,
    TIMER_TYPES,
} from '../../constants/timerConstants';
import { useLogger } from '../../hooks/useLogger';
import { useTimer } from '../../hooks/useTimer';
import type { TimerProps, TimerState } from '../../types/timer';
import { tasksDB } from '../../utils/database';
import {
    initializeNotifications,
    showNotification,
} from '../../utils/notifications';
import { Notification } from '../Notification';
import styles from './Timer.module.css';
import { TimerControls } from './TimerControls';
import { TimerDisplay } from './TimerDisplay';
import { usePostHog } from 'posthog-js/react';

export const Timer: React.FC<TimerProps> = ({
    selectedTask,
    onTaskComplete,
}) => {
    const [notification, setNotification] = useState<string | null>(null);
    const timerLogger = useLogger('Timer');
    const posthog = usePostHog();

    const { state, startBreak, startTimer, resetTimer, pauseTimer, switchTimer, settings } =
        useTimer({
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
        posthog.capture('timer_started', {
            timer_type: state.timerType,
        });
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
            return;
        }
        switchTimer();
        showNotification(state.timerType);
        setNotification(COMPLETION_MESSAGES[state.timerType]);

        if(state.timerType === TIMER_TYPES.BREAK || state.timerType === TIMER_TYPES.LONG_BREAK) {
            return;
        }

        let actualDurationMs = undefined;

        if (timerState.hasCompleted) {
            actualDurationMs = settings.workDuration;
        } else if (!timerState.hasCompleted && timerState.hasStarted) {
            // Calculate actual duration based on time spent
            const totalDurationMs = settings.workDuration; 
            const timeLeftMs = state.timeLeft; 
            actualDurationMs = totalDurationMs - timeLeftMs;
        }

        const completedTask = {
            ...selectedTask,
            id: `completed-${timerState.activeTaskId}-${Date.now()}`,
            endTime: Date.now(),
            duration: actualDurationMs,
            completed: true,
            pomodoros: 1,
        };

        try {
            if (!timerState.activeTaskId) {
                throw new Error('No task id found');
            }
            await tasksDB.completeOnePomodoro(
                timerState.activeTaskId,
                completedTask
            );
            await onTaskComplete();
            posthog.capture('timer_completed', {
                timer_type: timerState.timerType,
                task_id: timerState.activeTaskId,
                duration: actualDurationMs,
            });
            showInAppNotification(COMPLETION_MESSAGES[state.timerType]);
        } catch (error) {
            timerLogger.error(
                'Failed to complete task:',
                error instanceof Error ? error.message : error
            );
            showInAppNotification(ERROR_MESSAGES.TASK_COMPLETE_FAILED);
        }
    };

    useEffect(() => {
        initializeNotifications();
    }, []);

    const getTimerTitle = () => {
        const session = Math.floor(state.sessionsCompleted) + 1;
        const title = TIMER_TITLES[state.timerType];
        return typeof title === 'function' ? title(session) : title;
    };


    return (
        <>
            <div
                className={`${styles.timerContainer} ${
                    styles[state.timerType]
                }`}
            >
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
                    {selectedTask
                        ? selectedTask.description
                        : 'No task selected'}
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
