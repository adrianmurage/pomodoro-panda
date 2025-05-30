import React from "react";
import { TimerDisplayProps } from "../../types";
import styles from "./Timer.module.css";

export const TimerDisplay: React.FC<TimerDisplayProps> = React.memo(
  ({ timeLeft }) => {
    // Ensure timeLeft is a valid number and not negative
    const validTimeLeft = Math.max(0, Number(timeLeft) || 0);

    // Use Math.floor to ensure we get whole numbers
    const timeLeftInSeconds = Math.floor(validTimeLeft / 1000);
    const minutes = Math.floor(timeLeftInSeconds / 60);
    const seconds = Math.floor(timeLeftInSeconds % 60);

    return (
      <div className={styles.timerDisplay}>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>
    );
  }
);

TimerDisplay.displayName = "TimerDisplay";
