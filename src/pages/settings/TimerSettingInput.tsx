import React from 'react';
import styles from './Settings.module.css';

interface TimerSettingInputProps {
    label: string;
    value: number;
    min: number;
    max: number;
    saving?: boolean;
    saved?: boolean;
    onChange: (value: string) => void;
    /** Whether the value represents minutes (will be shown divided by 60000) */
    isMinutes?: boolean;
}

export const TimerSettingInput: React.FC<TimerSettingInputProps> = ({
    label,
    value,
    min,
    max,
    saving = false,
    saved = false,
    onChange,
    isMinutes = false,
}) => {
    const displayValue = isMinutes ? Math.round(value / (60 * 1000)) : value;
    const displayMin = isMinutes ? Math.round(min / (60 * 1000)) : min;
    const displayMax = isMinutes ? Math.round(max / (60 * 1000)) : max;

    return (
        <div className={styles.settingItem}>
            <label className={styles.settingLabel}>
                <span>{label}</span>
                <div className={styles.inputWithStatus}>
                    {saving && <span className={styles.savingIndicator}>Saving...</span>}
                    {saved && <span className={styles.savedIndicator}>Saved!</span>}
                    <input
                        type="number"
                        min={displayMin}
                        max={displayMax}
                        value={displayValue}
                        onChange={(e) => onChange(e.target.value)}
                        className={styles.numberInput}
                    />
                </div>
            </label>
        </div>
    );
};