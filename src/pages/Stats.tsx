import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CompletedTasksList } from '../components/Tasks/CompletedTasksList';
import { Notification } from '../components/Notification';
import { useLogger } from '../hooks/useLogger';
import { Task, NotificationState } from '../types';
import { tasksDB } from '../utils/database';
import styles from './Stats.module.css';

/**
 * Formats a total duration in milliseconds to a string of hours and minutes.
 * @param milliseconds - The total duration in milliseconds.
 * @returns A string of hours and minutes, or '0m' if the duration is 0 milliseconds.
 */
const formatTotalDuration = (milliseconds: number): string => {
    const totalMinutes = Math.round(milliseconds / 60000);

    if (totalMinutes === 0) return '0m';

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
        if (minutes > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${hours}h`;
    }
    return `${minutes}m`;
};

function Stats() {
    const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
    const [notification, setNotification] = useState<NotificationState | null>(
        null
    );
    const statsPageLogger = useLogger('StatsPage');

    /**
     * Loads all completed tasks from the database.
     */
    useEffect(() => {
        async function loadCompletedTasks() {
            statsPageLogger.info('Fetching all completed tasks...');
            try {
                const tasks = await tasksDB.getCompletedTasks();
                setCompletedTasks(tasks);
                statsPageLogger.info(
                    `Successfully fetched ${tasks.length} completed tasks.`
                );
            } catch (error) {
                statsPageLogger.error('Failed to load completed tasks:', error);
                setNotification({
                    message: 'Failed to load completed tasks',
                    type: 'error',
                });
            }
        }

        loadCompletedTasks();
    }, [statsPageLogger]);

    /**
     * Calculates the total number of pomodoros completed.
     * @returns The total number of pomodoros completed.
     */
    const totalPomodoros = useMemo(() => {
        statsPageLogger.info('Calculating total completed pomodoros');
        return completedTasks.length;
    }, [completedTasks, statsPageLogger]);

    /**
     * Formats the total time spent on completed tasks.
     * @returns A string of hours and minutes, or '0m' if the duration is 0 milliseconds.
     */
    const formattedTotalTimeSpent = useMemo(() => {
        statsPageLogger.info('Calculating total time spent on completed tasks');
        const totalDurationMs = completedTasks.reduce(
            (sum, task) => sum + (task.duration || 0),
            0
        );
        return formatTotalDuration(totalDurationMs);
    }, [completedTasks, statsPageLogger]);

    /**
     * Repeats a task.
     * @param category - The category of the task.
     * @param description - The description of the task.
     * @param pomodoros - The number of pomodoros to add to the task.
     */
    const handleRepeatTask = async (
        category: string,
        description: string,
        pomodoros: number = 1
    ) => {
        statsPageLogger.info('Repeating task:', {
            category,
            description,
            pomodoros,
        });
        try {
            // Check for existing active task with same category and description
            const activeTasks = await tasksDB.getAll();
            const existingTask = activeTasks.find(
                (t) => t.category === category && t.description === description
            );

            if (existingTask) {
                // Update existing task's pomodoros
                const updatedTask = {
                    ...existingTask,
                    pomodoros: (existingTask.pomodoros || 1) + (pomodoros || 1),
                };
                await tasksDB.update(updatedTask);
                statsPageLogger.info(
                    'Added pomodoro to existing active task:',
                    updatedTask
                );
                setNotification({
                    message:
                        'Added pomodoro to existing task on the Home page.',
                    type: 'info',
                });
            } else {
                // Create new task
                const newTask: Task = {
                    id: uuidv4(),
                    category,
                    description,
                    completed: false,
                    pomodoros: pomodoros || 1,
                    // order will be set by tasksDB.add
                };
                await tasksDB.add(newTask);
                statsPageLogger.info('Added new task to active list:', newTask);
                setNotification({
                    message: 'Task added to the Home page.',
                    type: 'success',
                });
            }
        } catch (error) {
            statsPageLogger.error('Failed to repeat task:', error);
            setNotification({
                message: 'Failed to repeat task',
                type: 'error',
            });
        }
    };

    /**
     * Edits a completed task.
     * @param taskId - The ID of the task to edit.
     * @param category - The category of the task.
     * @param description - The description of the task.
     * @param duration - The duration of the task.
     */
    const handleEditCompletedTask = async (
        taskId: string,
        category: string,
        description: string,
        duration: number
    ) => {
        statsPageLogger.info('Editing completed task:', {
            taskId,
            category,
            description,
            duration,
        });
        try {
            const taskToEdit = completedTasks.find((t) => t.id === taskId);
            if (!taskToEdit) {
                statsPageLogger.error('Task not found for editing:', taskId);
                setNotification({ message: 'Task not found', type: 'error' });
                return;
            }

            const updatedTask = {
                ...taskToEdit,
                category,
                description,
                duration,
            };

            await tasksDB.updateCompletedTask(updatedTask);
            setCompletedTasks((prevTasks) =>
                prevTasks.map((task) =>
                    task.id === taskId ? updatedTask : task
                )
            );
            statsPageLogger.info(
                'Completed task updated successfully:',
                updatedTask
            );
            setNotification({
                message: 'Completed task updated',
                type: 'info',
            });
        } catch (error) {
            statsPageLogger.error('Failed to update completed task:', error);
            setNotification({
                message: 'Failed to update completed task',
                type: 'error',
            });
        }
    };

    /**
     * Deletes a completed task.
     * @param taskId - The ID of the task to delete.
     */
    const handleDeleteCompletedTask = async (taskId: string) => {
        statsPageLogger.info('Deleting completed task:', { taskId });
        try {
            await tasksDB.deleteCompletedTask(taskId);
            setCompletedTasks((prevTasks) =>
                prevTasks.filter((task) => task.id !== taskId)
            );
            statsPageLogger.info(
                'Completed task deleted successfully:',
                taskId
            );
            setNotification({
                message: 'Completed task deleted',
                type: 'info',
            });
        } catch (error) {
            statsPageLogger.error('Failed to delete completed task:', error);
            setNotification({
                message: 'Failed to delete completed task',
                type: 'error',
            });
        }
    };

    return (
        <div className={styles.statsContainer}>
            <div className={styles.infoCardsContainer}>
                <div className={`${styles.infoCard} ${styles.pomodorosCard}`}>
                    <div className={styles.infoCardLeftRow}>
                        <span className={styles.infoCardIcon}>✅</span>
                    </div>
                    <div className={styles.infoCardRightRow}>
                        <span className={styles.infoCardValue}>
                            {totalPomodoros}
                        </span>
                        <p className={styles.infoCardLabel}>Pomodoros</p>
                    </div>
                </div>
                <div className={`${styles.infoCard} ${styles.timeSpentCard}`}>
                    <div className={styles.infoCardLeftRow}>
                        <span className={styles.infoCardIcon}>🕒</span>
                    </div>
                    <div className={styles.infoCardRightRow}>
                        <span className={styles.infoCardValue}>
                            {formattedTotalTimeSpent}
                        </span>
                        <p className={styles.infoCardLabel}>Time spent</p>
                    </div>
                </div>
            </div>

            <CompletedTasksList
                tasks={completedTasks}
                onRepeatTask={handleRepeatTask}
                onEditCompletedTask={handleEditCompletedTask}
                onDeleteCompletedTask={handleDeleteCompletedTask}
            />
            {notification && (
                <Notification
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}
        </div>
    );
}

export default Stats;
