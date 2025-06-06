import { usePostHog } from "posthog-js/react";
import styles from "./Settings.module.css";
import { settingsDB } from "../utils/database";
import { useUserSettings } from "../hooks/useUserSettings";
import { UserSettings } from "../types";
import TimerSettingInput from "../components/Timer/TimerSettingInput";

const Settings = () => {
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
      logger.error(`Failed to update setting "${settingName}":`, error);
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

          <TimerSettingInput
            label="Pomodoro Session"
            settingKey="workDuration"
            value={settings.workDuration / 60000}
            unit="min"
            min={1}
            max={120}
            isEditing={editingSetting === "workDuration"}
            onEdit={setEditingSetting}
            onChange={(value) =>
              setSettings((prev) => ({ ...prev, workDuration: value * 60000 }))
            }
            onSave={() => {
              setEditingSetting(null);
              handleSettingChange("workDuration");
            }}
          />

          {/* Short Break */}
          <TimerSettingInput
            label="Short Break"
            settingKey="breakDuration"
            value={settings.breakDuration / 60000}
            unit="min"
            min={1}
            max={120}
            isEditing={editingSetting === "breakDuration"}
            onEdit={setEditingSetting}
            onChange={(value) =>
              setSettings((prev) => ({ ...prev, breakDuration: value * 60000 }))
            }
            onSave={() => {
              setEditingSetting(null);
              handleSettingChange("breakDuration");
            }}
          />

          {/* Long Break */}
          <TimerSettingInput
            label="Long Break"
            settingKey="longBreakDuration"
            value={settings.longBreakDuration / 60000}
            unit="min"
            min={1}
            max={120}
            isEditing={editingSetting === "longBreakDuration"}
            onEdit={setEditingSetting}
            onChange={(value) =>
              setSettings((prev) => ({ ...prev, longBreakDuration: value * 60000 }))
            }
            onSave={() => {
              setEditingSetting(null);
              handleSettingChange("longBreakDuration");
            }}
          />

          {/* Long Break after how many sessions */}
          <TimerSettingInput
            label="Sessions Until Long Break"
            settingKey="sessionsUntilLongBreak"
            value={settings.sessionsUntilLongBreak}
            unit="sess"
            min={1}
            max={120}
            isEditing={editingSetting === "sessionsUntilLongBreak"}
            onEdit={setEditingSetting}
            onChange={(value) =>
              setSettings((prev) => ({
                ...prev,
                sessionsUntilLongBreak: value,
              }))
            }
            onSave={() => {
              setEditingSetting(null);
              handleSettingChange("sessionsUntilLongBreak");
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Settings;
