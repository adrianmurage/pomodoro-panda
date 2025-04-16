import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../../types';
import styles from './Tasks.module.css';
import completedStyles from './CompletedTasksList.module.css';
import { CompletedTaskMenu } from './CompletedTaskMenu';
import { TaskInput } from './TaskInput';
import { CompletedTasksSummary } from './CompletedTasksSummary';
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

  return (
    <div className={styles.taskList}>
      <CompletedTasksSummary tasks={tasks} />

      {/* add a header section with category & description */}
      <div className={completedStyles.completedTasksHeader}>
        <div className={completedStyles.taskCategory}>Category</div>
        <div className={completedStyles.taskDescription}>Description</div>
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
                  onAddTask={() => {}} // Not used in edit mode
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

          return (
            <div
              key={task.id}
              className={completedStyles.completedTaskItem}
              role="listitem"
            >
              <div className={styles.taskCategory}>{task.category}</div>
              <div className={styles.taskDescription}>{task.description}</div>
              <div className={styles.taskTime}>
                {new Date(task.endTime!).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              <div className={styles.taskTime}>
                {Math.round(task.duration! / 60000)}m
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