import { usePostHog } from 'posthog-js/react';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Banner } from '../components/Banner';
import { Notification } from '../components/Notification';
import { TaskInput, TaskList } from '../components/Tasks';
import { CompletedTasksList } from '../components/Tasks/CompletedTasksList';
import { Timer } from '../components/Timer';
import { DEFAULT_TIMER_SETTINGS } from '../constants/timerConstants';
import { TimerProvider } from '../contexts/TimerContext';
import { useLogger } from '../hooks/useLogger';
import { NotificationState, Task } from '../types';
import { tasksDB } from '../utils/database';

function Home() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notification, setNotification] = useState<NotificationState | null>(
        null
    );
    const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
    const [showBanner, setShowBanner] = useState<boolean>(false);

    const homePageLogger = useLogger('Home');
    const posthog = usePostHog();

    // We don't need the banner for now

    // useEffect(() => {
    //     async function initialize() {
    //         try {
    //             // Check if banner was previously dismissed
    //             const bannerDismissed = localStorage.getItem(
    //                 'statsBannerDismissed'
    //             );

    //             if (!bannerDismissed) {
    //                 localStorage.setItem('statsBannerDismissed', '0');
    //                 setShowBanner(true);
    //             } else if (parseInt(bannerDismissed) < 2) {
    //                 setShowBanner(true);
    //             } else {
    //                 setShowBanner(false);
    //             }
    //         } catch (error) {
    //             console.error('Failed to initialize app:', error);
    //         }
    //     }

    //     initialize();
    // }, []);

    useEffect(() => {
        async function loadTasks() {
            try {
                const loadedTasks = await tasksDB.getAll();
                setTasks(loadedTasks);
            } catch (error) {
                homePageLogger.error('Failed to load tasks:', error);
                setNotification({
                    message: 'Failed to load tasks',
                    type: 'error',
                });
            }
        }

        loadTasks();
    }, [homePageLogger]);

    useEffect(() => {
        async function loadCompletedTasks() {
            try {
                const tasks = await tasksDB.getCompletedTasksForToday();
                setCompletedTasks(tasks);
            } catch (error) {
                homePageLogger.error('Failed to load completed tasks:', error);
                setNotification({
                    message: 'Failed to load completed tasks',
                    type: 'error',
                });
            }
        }

        loadCompletedTasks();
    }, [homePageLogger]);

    const handleAddTask = async (category: string, description: string) => {
        const newTask: Task = {
            id: uuidv4(),
            category,
            description,
            completed: false,
            pomodoros: 1,
        };

        try {
            await tasksDB.add(newTask);
            setTasks((prev) => [newTask, ...prev]);
            setNotification({
                message: 'New task added',
                type: 'success',
            });
        } catch (error) {
            homePageLogger.error('Failed to add task:', error);
            setNotification({
                message: 'Failed to add task',
                type: 'error',
            });
        }
    };

    const handleReorderTasks = async (reorderedTasks: Task[]) => {
        const previousTasks = [...tasks];
        setTasks(reorderedTasks);

        try {
            await tasksDB.updateAll(reorderedTasks);
        } catch (error) {
            homePageLogger.error('Failed to persist task order:', error);
            setTasks(previousTasks);
            // Optionally show an error notification to the user
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        try {
            await tasksDB.delete(taskId);
            setTasks((prev) => prev.filter((task) => task.id !== taskId));
            setNotification({
                message: 'Task deleted',
                type: 'info',
            });
        } catch (error) {
            homePageLogger.error('Failed to delete task:', error);
            setNotification({
                message: 'Failed to delete task',
                type: 'error',
            });
        }
    };

    const handleUpdatePomodoros = async (taskId: string, count: number) => {
        try {
            const task = tasks.find((t) => t.id === taskId);
            if (!task) return;

            const updatedTask = { ...task, pomodoros: count };
            await tasksDB.update(updatedTask);
            setTasks((prev) =>
                prev.map((t) => (t.id === taskId ? updatedTask : t))
            );
        } catch (error) {
            homePageLogger.error('Failed to update task pomodoros:', error);
        }
    };

    const handleEditTask = async (
        taskId: string,
        category: string,
        description: string
    ) => {
        try {
            const task = tasks.find((t) => t.id === taskId);
            if (!task) {
                setNotification({
                    message: 'Task not found',
                    type: 'error',
                });
                return;
            }

            const updatedTask = {
                ...task,
                category,
                description,
            };

            await tasksDB.update(updatedTask);
            setTasks((prev) =>
                prev.map((t) => (t.id === taskId ? updatedTask : t))
            );
            setNotification({
                message: 'Task updated',
                type: 'info',
            });
        } catch (error) {
            homePageLogger.error('Failed to update task:', error);
            setNotification({
                message: 'Failed to update task',
                type: 'error',
            });
        }
    };

    const handleTaskComplete = async () => {
        try {
            const [tasks, completedTasks] = await Promise.all([
                tasksDB.getAll(),
                tasksDB.getCompletedTasksForToday(),
            ]);
            setTasks(tasks);
            setCompletedTasks(completedTasks);
        } catch (error) {
            homePageLogger.error(
                'Error updating lists after task completion:',
                error
            );
            setNotification({
                message: 'Failed to update task lists',
                type: 'error',
            });
        }
    };

    const handleRepeatTask = async (
        category: string,
        description: string,
        pomodoros: number = 1
    ) => {
        // Check for existing task with same category and description
        const existingTask = tasks.find(
            (t) => t.category === category && t.description === description
        );

        if (existingTask) {
            // Update existing task's pomodoros
            const updatedTask = {
                ...existingTask,
                pomodoros: (existingTask.pomodoros || 1) + (pomodoros || 1),
            };

            try {
                await tasksDB.update(updatedTask);
                setTasks((prev) =>
                    prev.map((t) =>
                        t.id === existingTask.id ? updatedTask : t
                    )
                );
                setNotification({
                    message: 'Added pomodoro to existing task',
                    type: 'info',
                });
            } catch (error) {
                homePageLogger.error('Failed to update task:', error);
                setNotification({
                    message: 'Failed to update task',
                    type: 'error',
                });
            }
        } else {
            // Create new task
            handleAddTask(category, description);
        }
    };

    const handleMarkAsDone = async (taskId: string) => {
        try {
            const task = tasks.find((t) => t.id === taskId);
            if (!task) {
                setNotification({
                    message: 'Task not found',
                    type: 'error',
                });
                return;
            }

            // Create a completed task object
            const completedTask = {
                ...task,
                id: `completed-${task.id}-${Date.now()}`,
                endTime: Date.now(),
                duration: DEFAULT_TIMER_SETTINGS.workDuration,
                completed: true,
            };

            // Add to completed tasks and remove from active tasks
            await tasksDB.completeOnePomodoro(taskId, completedTask);

            // Refresh the task lists
            await handleTaskComplete();

            setNotification({
                message: 'Task marked as done',
                type: 'success',
            });
        } catch (error) {
            homePageLogger.error('Failed to mark task as done:', error);
            setNotification({
                message: 'Failed to mark task as done',
                type: 'error',
            });
        }
    };

    const handleEditCompletedTask = async (
        taskId: string,
        category: string,
        description: string,
        duration: number
    ) => {
        try {
            const task = completedTasks.find((t) => t.id === taskId);
            if (!task) {
                setNotification({
                    message: 'Task not found',
                    type: 'error',
                });
                return;
            }

            const updatedTask = {
                ...task,
                category,
                description,
                duration,
            };

            await tasksDB.updateCompletedTask(updatedTask);
            setCompletedTasks((prev) =>
                prev.map((t) => (t.id === taskId ? updatedTask : t))
            );
            setNotification({
                message: 'Completed task updated',
                type: 'info',
            });
        } catch (error) {
            homePageLogger.error('Failed to update completed task:', error);
            setNotification({
                message: 'Failed to update completed task',
                type: 'error',
            });
        }
    };

    const handleDeleteCompletedTask = async (taskId: string) => {
        try {
            await tasksDB.deleteCompletedTask(taskId);
            setCompletedTasks((prev) => prev.filter((t) => t.id !== taskId));
            setNotification({
                message: 'Completed task deleted',
                type: 'info',
            });
        } catch (error) {
            homePageLogger.error('Failed to delete completed task:', error);
            setNotification({
                message: 'Failed to delete completed task',
                type: 'error',
            });
        }
    };

    const handleDismissBanner = () => {
        posthog.capture('stats_banner_dismissed');
        setShowBanner(false);
        // Store the preference in localStorage
        let currentCount = localStorage.getItem('statsBannerDismissed');
        if (isNaN(parseInt(currentCount || '0'))) {
            currentCount = '0';
        }
        const newCount = currentCount ? parseInt(currentCount) + 1 : 1;
        localStorage.setItem('statsBannerDismissed', newCount.toString());
    };

    const activeTask = tasks[0] || null;
    return (
        <>
            <div className={`app ${showBanner ? 'app-with-banner' : ''}`}>
                {showBanner && (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <Banner
                            message={
                                <>
                                    Currently, completed tasks only show today's
                                    items. I'm working on a stats page to show
                                    all historical tasks and analytics!
                                    <br />
                                    <br />
                                    <b>You haven't lost any tasks!</b>
                                </>
                            }
                            type="warning"
                            onDismiss={handleDismissBanner}
                        >
                            Update 🚀
                        </Banner>
                    </div>
                )}
                <TimerProvider>
                    <main className="main-content">
                        <Timer
                            selectedTask={activeTask}
                            onTaskComplete={handleTaskComplete}
                        />
                        <TaskInput onAddTask={handleAddTask} />
                        <TaskList
                            tasks={tasks}
                            activeTaskId={activeTask?.id || null}
                            onReorder={handleReorderTasks}
                            onDelete={handleDeleteTask}
                            onUpdatePomodoros={handleUpdatePomodoros}
                            onEditTask={handleEditTask}
                            onMarkAsDone={handleMarkAsDone}
                        />
                        <CompletedTasksList
                            tasks={completedTasks}
                            onRepeatTask={handleRepeatTask}
                            onEditCompletedTask={handleEditCompletedTask}
                            onDeleteCompletedTask={handleDeleteCompletedTask}
                        />
                    </main>
                </TimerProvider>
                {notification && (
                    <Notification
                        message={notification.message}
                        type={notification.type}
                        onClose={() => setNotification(null)}
                    />
                )}
            </div>
        </>
    );
}

export default Home;
