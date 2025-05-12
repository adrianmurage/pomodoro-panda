import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Task } from '../../types';
import styles from './Tasks.module.css';
import completedStyles from './CompletedTasksList.module.css';
import { CompletedTaskMenu } from './CompletedTaskMenu';
import { TaskInput } from './TaskInput';
import { CompletedTasksSummary } from './CompletedTasksSummary';
import { useLogger } from '../../hooks/useLogger';

interface CompletedTasksListProps {
  tasks: Task[];
  onRepeatTask: (category: string, description: string, pomodoros?: number) => void;
  onEditCompletedTask?: (taskId: string, category: string, description: string, duration: number) => void;
  onDeleteCompletedTask?: (taskId: string) => void;
}

export const CompletedTasksList: React.FC<CompletedTasksListProps> = ({ 
  tasks,
  onRepeatTask,
  onEditCompletedTask,
  onDeleteCompletedTask
}) => {
  const location = useLocation();
  const logger = useLogger(CompletedTasksList.name);
  const [isMenuOpen, setIsMenuOpen] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (tasks.length === 0) return null;

  const handleRepeat = (task: Task) => {
    onRepeatTask(task.category, task.description, task.pomodoros || 1);
  };

  const handleMenuToggle = (taskId: string) => {
    setIsMenuOpen(isMenuOpen === taskId ? null : taskId);
  };

  const handleEdit = (taskId: string) => {
    setIsEditing(taskId);
  };

  const handleDelete = (taskId: string) => {
    if (onDeleteCompletedTask) {
      onDeleteCompletedTask(taskId);
    }
  };

  const handleEditSubmit = (taskId: string, category: string, description: string, duration: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && onEditCompletedTask) {
      onEditCompletedTask(taskId, category, description, duration);
      setIsEditing(null);
    }
  };

  /**
   * Formats a task's end time (Unix timestamp in milliseconds) into a readable string.
   * The format depends on the current page:
   * - On the '/stats' page, it returns 'DD/MM/YYYY - HH:MM'.
   * - On other pages, it returns 'HH:MM'.
   * Returns '--:--' if the endTime is missing or invalid, or 'Error' if formatting fails.
   * @param endTime - The Unix timestamp (in milliseconds) when the task was completed.
   * @returns A formatted string representing the end time, or a placeholder/error string.
   */
  const formatTaskEndTime = (endTime: number | undefined | null): string => {
    if (!endTime) {
      logger.warn('Task end time is missing or invalid');
      return '--:--';
    }
    try {
      const date = new Date(endTime);
      if (isNaN(date.getTime())) {
        logger.warn(`Invalid date created from endTime: ${endTime}`);
        return '--:--';
      }

      const timeOptions: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      };

      if (location.pathname === '/stats') {
        const dateOptions: Intl.DateTimeFormatOptions = {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        };
        return `${date.toLocaleDateString('en-GB', dateOptions)} - ${date.toLocaleTimeString([], timeOptions)}`;
      } else {
        return date.toLocaleTimeString([], timeOptions);
      }
    } catch (error) {
      logger.error(`Error formatting date for endTime ${endTime}:`, error);
      return 'Error';
    }
  };

  return (
    <div className={styles.taskList}>
      <CompletedTasksSummary tasks={tasks} />

      <div className={completedStyles.completedTasksHeader}>
        <div className={completedStyles.taskCategory}>Category</div>
        <div className={completedStyles.taskDescription}>Description</div>
        <div className={styles.taskTime}>
          {location.pathname === '/stats' ? 'Completed On' : 'Time'}
        </div>
        <div className={styles.taskTime}>Duration</div>
        <div className={styles.taskActions}>Actions</div>
      </div>
      
      <div role="list" aria-label="Completed tasks" className={completedStyles.completedTasksList}>
        {tasks.map((task) => {
          if (isEditing === task.id) {
            return (
              <div
                key={task.id}
                className={styles.taskItemEditing}
              >
                <TaskInput
                  onAddTask={() => {}}
                  onEditCompletedTask={(category, description, duration) => 
                    handleEditSubmit(task.id, category, description, duration)
                  }
                  initialValues={{
                    category: task.category,
                    description: task.description,
                    duration: task.duration || 0
                  }}
                  isEditing={true}
                  isEditingCompleted={true}
                  onCancelEdit={() => setIsEditing(null)}
                />
              </div>
            );
          }

          const formattedEndTime = formatTaskEndTime(task.endTime);

          return (
            <div
              key={task.id}
              className={completedStyles.completedTaskItem}
              role="listitem"
            >
              <div className={styles.taskCategory}>{task.category}</div>
              <div className={styles.taskDescription}>{task.description}</div>
              <div className={styles.taskTime}>
                {formattedEndTime}
              </div>
              <div className={styles.taskTime}>
                {typeof task.duration === 'number' ? `${Math.round(task.duration / 60000)}m` : '--m'}
              </div>
              <div className={styles.taskActions} ref={isMenuOpen === task.id ? menuRef : undefined}>
                <button
                  className={completedStyles.repeatButton}
                  onClick={() => handleRepeat(task)}
                  aria-label={`Repeat task: ${task.description}`}
                >
                  🔄
                </button>
                <button
                  className={styles.moreButton}
                  onClick={() => handleMenuToggle(task.id)}
                  aria-label={`More options for ${task.description}`}
                  aria-expanded={isMenuOpen === task.id}
                  aria-haspopup="menu"
                >
                  ⋮
                </button>
                {isMenuOpen === task.id && (
                  <CompletedTaskMenu
                    onEdit={() => handleEdit(task.id)}
                    onDelete={() => handleDelete(task.id)}
                    onRepeat={() => handleRepeat(task)}
                    onClose={() => setIsMenuOpen(null)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 