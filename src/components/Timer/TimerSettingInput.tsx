import React from "react";
import styles from "../../pages/Settings.module.css"; // Adjust if your styles file is named differently

interface TimerSettingInputProps {
  label: string;
  settingKey: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  isEditing: boolean;
  onEdit: (key: string) => void;
  onChange: (value: number) => void;
  onSave: () => void;
}

const TimerSettingInput: React.FC<TimerSettingInputProps> = ({
  label,
  settingKey,
  value,
  unit,
  min,
  max,
  isEditing,
  onEdit,
  onChange,
  onSave,
}) => {
  return (
    <div className={styles.timerRow}>
      <span className={styles.timerLabel}>{label}</span>
      {isEditing ? (
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          className={styles.timerInput}
          onChange={(e) => onChange(Number(e.target.value))}
          onBlur={onSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
          }}
          autoFocus
        />
      ) : (
        <div className={styles.timerValue} onClick={() => onEdit(settingKey)}>
          {value} <span className={styles.timerUnit}>{unit}</span>
          <span className={styles.timerArrow}>&#8250;</span>
        </div>
      )}
    </div>
  );
};

export default TimerSettingInput;
