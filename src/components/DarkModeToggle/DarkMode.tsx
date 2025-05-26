import React, { useState, useEffect } from "react";
import styles from "./DarkMode.module.css";

const DarkMode: React.FC = () => {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }, [isDark]);

  return (
    <button
      className={`${styles.button} ${isDark ? styles.dark : styles.light}`}
      onClick={toggleTheme}
      aria-label="Toggle Dark Mode"
    >
      <div className={styles.icon}>{isDark ? "🌙" : "☀️"}</div>
    </button>
  );
};

export default DarkMode;
