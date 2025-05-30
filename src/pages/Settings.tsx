import { usePostHog } from "posthog-js/react";
import styles from "./Settings.module.css";
import { settingsDB } from "../utils/database";
import { TimerSettings } from "../types";
import { useUserSettings } from "../hooks/useUserSettings";

export interface UserSettings extends TimerSettings {
  addTasksToBottom: boolean;
}

const Settings = () => {
  // const logger = useLogger("Settings");
  const {
    settings,
    setSettings,
    isLoading,
    editingSetting,
    setEditingSetting,
    logger,
  } = useUserSettings();
  const posthog = usePostHog();

  const handleToggleTaskPosition = async () => {
    const newValue = !settings.addTasksToBottom;
    try {
      await settingsDB.set("addTasksToBottom", newValue);
      setSettings((prev) => ({
        ...prev,
        addTasksToBottom: newValue,
      }));
      logger.info("Task position setting updated:", {
        addTasksToBottom: newValue,
      });
      posthog?.capture("settings_updated", {
        setting: "addTasksToBottom",
        value: newValue,
      });
    } catch (error) {
      logger.error("Failed to update task position setting:", error);
    }
  };

  const handleSettingChange = async (settingName: string) => {
    try {
      await settingsDB.set(
        settingName,
        settings[settingName as keyof UserSettings]
      );
      setSettings((prev) => ({
        ...prev,
        ...settings,
      }));
      logger.info(`Setting "${settingName}" updated:`, {
        [settingName]: settings[settingName as keyof UserSettings],
      });
      posthog?.capture("settings_updated", {
        setting: settingName,
        value: settings[settingName as keyof UserSettings],
      });
    } catch (error) {
      console.log(error);
    }
  };

  if (isLoading) {
    return <div className={styles.container}>Loading settings...</div>;
  }

  return (
    <div className={styles.container}>
      <h1>Settings</h1>
      <div className={styles.settingsContent}>
        <div className={styles.settingItem}>
          <label className={styles.settingLabel}>
            <span>Add new tasks to bottom of list</span>
            <div className={styles.toggleSwitch}>
              <input
                type="checkbox"
                checked={settings.addTasksToBottom}
                onChange={handleToggleTaskPosition}
              />
              <span className={styles.slider}></span>
            </div>
          </label>
          <p className={styles.settingDescription}>
            When enabled, new tasks will be added to the bottom of your task
            list instead of the top.
          </p>
        </div>

        <div className={styles.settingItem}>
          {/* Work Duration */}
          <div className={styles.timerRow}>
            <span className={styles.timerLabel}>Pomodoro Session</span>
            {editingSetting === "workDuration" ? (
              <input
                type="number"
                min={1}
                max={120}
                value={settings.workDuration}
                className={styles.timerInput}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    workDuration: Number(e.target.value),
                  }))
                }
                onBlur={() => {
                  setEditingSetting(null);
                  handleSettingChange("workDuration");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    console.log(e.key);
                    setEditingSetting(null);
                    handleSettingChange("workDuration");
                  }
                }}
                autoFocus
              />
            ) : (
              <div
                className={styles.timerValue}
                onClick={() => setEditingSetting("workDuration")}
              >
                {settings.workDuration}{" "}
                <span className={styles.timerUnit}>min</span>
                <span className={styles.timerArrow}>&#8250;</span>
              </div>
            )}
          </div>

          {/* Short Break */}
          <div className={styles.timerRow}>
            <span className={styles.timerLabel}>Short break</span>
            {editingSetting === "breakDuration" ? (
              <input
                type="number"
                min={1}
                max={60}
                value={settings.breakDuration}
                className={styles.timerInput}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    breakDuration: Number(e.target.value),
                  }))
                }
                onBlur={() => {
                  setEditingSetting(null);
                  handleSettingChange("breakDuration");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    console.log(e.key);
                    setEditingSetting(null);
                    handleSettingChange("breakDuration");
                  }
                }}
                autoFocus
              />
            ) : (
              <div
                className={styles.timerValue}
                onClick={() => setEditingSetting("breakDuration")}
              >
                {settings.breakDuration}{" "}
                <span className={styles.timerUnit}>min</span>
                <span className={styles.timerArrow}>&#8250;</span>
              </div>
            )}
          </div>

          {/* Long Break */}
          <div className={styles.timerRow}>
            <span className={styles.timerLabel}>Long break</span>
            {editingSetting === "longBreakDuration" ? (
              <input
                type="number"
                min={1}
                max={60}
                value={settings.longBreakDuration}
                className={styles.timerInput}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    longBreakDuration: Number(e.target.value),
                  }))
                }
                onBlur={() => {
                  setEditingSetting(null);
                  handleSettingChange("longBreakDuration");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    console.log(e.key);
                    setEditingSetting(null);
                    handleSettingChange("longBreakDuration");
                  }
                }}
                autoFocus
              />
            ) : (
              <div
                className={styles.timerValue}
                onClick={() => setEditingSetting("longBreakDuration")}
              >
                {settings.longBreakDuration}{" "}
                <span className={styles.timerUnit}>min</span>
                <span className={styles.timerArrow}>&#8250;</span>
              </div>
            )}
          </div>

          {/* Long Break after how many sessions */}
          <div className={styles.timerRow}>
            <span className={styles.timerLabel}>Long break after</span>
            {editingSetting === "sessionsUntilLongBreak" ? (
              <input
                type="number"
                min={1}
                max={10}
                value={settings.sessionsUntilLongBreak}
                className={styles.timerInput}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    sessionsUntilLongBreak: Number(e.target.value),
                  }))
                }
                onBlur={() => {
                  setEditingSetting(null);
                  handleSettingChange("sessionsUntilLongBreak");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    console.log(e.key);
                    setEditingSetting(null);
                    handleSettingChange("sessionsUntilLongBreak");
                  }
                }}
                autoFocus
              />
            ) : (
              <div
                className={styles.timerValue}
                onClick={() => setEditingSetting("sessionsUntilLongBreak")}
              >
                {settings.sessionsUntilLongBreak}{" "}
                <span className={styles.timerUnit}>sess</span>
                <span className={styles.timerArrow}>&#8250;</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
