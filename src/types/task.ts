import type { TimerSettings } from './timer';
import type { CompletedTaskRecord } from './database';

export interface Task {
  id: string;
  category: string;
  description: string;
  endTime?: number;
  duration?: number;
  completed: boolean;
  pomodoros: number;
  order?: number;
}

export interface TaskInputProps {
  onAddTask: (category: string, description: string) => void;
  onEditTask?: (category: string, description: string) => void;
  onEditCompletedTask?: (category: string, description: string, duration: number) => void;
  initialValues?: {
    category: string;
    description: string;
    duration?: number;
  };
  isEditing?: boolean;
  isEditingCompleted?: boolean;
  onCancelEdit?: () => void;
}

export interface TaskListProps {
  tasks: Task[];
  activeTaskId: string | null;
  onReorder: (reorderedTasks: Task[]) => void;
  onDelete: (taskId: string) => void;
  onUpdatePomodoros: (taskId: string, count: number) => void;
  onEditTask: (taskId: string, category: string, description: string) => void;
  onMarkAsDone: (taskId: string) => void; // Add this new prop
}

export interface SortableTaskItemProps {
  task: Task;
  isActive: boolean;
  estimatedCompletion: number;
  onDelete: (taskId: string) => void;
  onUpdatePomodoros: (taskId: string, count: number) => void;
  onEditTask: (taskId: string, category: string, description: string) => void;
  onMarkAsDone: (taskId: string) => void;
  className?: string;
}

export interface TaskMenuProps {
  onDelete: () => void;
  onClose: () => void;
  onAddPomodoro: () => void;
  onRemovePomodoro: () => void;
  onEdit: () => void;
  onMarkAsDone: () => void;
  pomodoroCount: number;
}

export interface CompletionIndicatorProps {
  tasks: Task[];
  settings?: TimerSettings;
}

export interface TaskSummaryProps {
  tasks: Task[] | CompletedTaskRecord[];
  settings?: TimerSettings;
}

export interface CompletedTasksListProps {
  tasks: CompletedTaskRecord[];
  onRepeatTask: (category: string, description: string, pomodoros?: number) => void;
  onEditCompletedTask?: (taskId: string, category: string, description: string, duration: number) => void;
  onDeleteCompletedTask?: (taskId: string) => void;
}

export interface CompletedTaskMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  onRepeat: () => void;
  onClose: () => void;
} 