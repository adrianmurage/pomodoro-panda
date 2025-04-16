import React from 'react';
import { TaskSummaryProps } from '../../types';
import { calculateCompletedDuration } from '../../utils/timeCalculations';
import styles from './Tasks.module.css';

export const CompletedTasksSummary: React.FC<TaskSummaryProps> = ({
    tasks,
}) => {
    const { hours, minutes } = calculateCompletedDuration(tasks);

    const formatDuration = () => {
        if (minutes === 0) return `${hours}h`;
        else if (hours === 0) return `${minutes}m`;
        else return `${hours}h ${minutes}m`;
    };

    return (
        <div className={styles.taskSummary}>
            <div className={styles.summaryItem}>
                <span>COMPLETED · {tasks.length}</span>
                <span>{formatDuration()}</span>
            </div>
        </div>
    );
};
