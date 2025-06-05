import posthog from "posthog-js";
import { useEffect, useState, useCallback, useRef } from "react";
import { debounce } from "lodash";
import styles from "./Settings.module.css";
import { useLogger } from "../../hooks/useLogger";
import { settingsDB } from "../../utils/database";
import { DEFAULT_TIMER_SETTINGS } from "../../constants/timerConstants";
import { TimerSettingInput } from "./TimerSettingInput";

interface UserSettings extends TimerSettings {
  addTasksToBottom?: boolean;
}

interface SaveStatus {
  [key: string]: {
    saving: boolean;
    saved: boolean;
    timer?: NodeJS.Timeout;
  };
}

const SettingsPage = () => {
  const logger = useLogger("Settings");
  const [settings, setSettings] = useState<UserSettings>({
    ...DEFAULT_TIMER_SETTINGS,
    workDuration: DEFAULT_TIMER_SETTINGS.workDuration,
    breakDuration: DEFAULT_TIMER_SETTINGS.breakDuration,
    longBreakDuration: DEFAULT_TIMER_SETTINGS.longBreakDuration,
    sessionsUntilLongBreak: DEFAULT_TIMER_SETTINGS.sessionsUntilLongBreak,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({});
  const [localSettings, setLocalSettings] = useState<UserSettings>({
    ...DEFAULT_TIMER_SETTINGS,
    workDuration: DEFAULT_TIMER_SETTINGS.workDuration,
    breakDuration: DEFAULT_TIMER_SETTINGS.breakDuration,
    longBreakDuration: DEFAULT_TIMER_SETTINGS.longBreakDuration,
    sessionsUntilLongBreak: DEFAULT_TIMER_SETTINGS.sessionsUntilLongBreak,
  });
  const saveStatusTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const debouncedSaveRef = useRef<{
    [key: string]: ReturnType<typeof debounce>;
  }>({});

  useEffect(() => {
    async function loadSettings() {
      try {
        const [addTasksToBottom, timerSettings] = await Promise.all([
          settingsDB.get<boolean>("addTasksToBottom"),
          settingsDB.getTimerSettings(),
        ]);

        // Ensure we have valid settings with correct millisecond values
        const validSettings = {
          workDuration: timerSettings.workDuration || DEFAULT_TIMER_SETTINGS.workDuration,
          breakDuration: timerSettings.breakDuration || DEFAULT_TIMER_SETTINGS.breakDuration,
          longBreakDuration: timerSettings.longBreakDuration || DEFAULT_TIMER_SETTINGS.longBreakDuration,
          sessionsUntilLongBreak: timerSettings.sessionsUntilLongBreak || DEFAULT_TIMER_SETTINGS.sessionsUntilLongBreak,
          addTasksToBottom: addTasksToBottom ?? false,
        };
        
        // Log the timer settings in an easy to read format
        logger.info("Timer Settings Loaded:", {
          stored: {
            workDuration: `${Math.floor(timerSettings?.workDuration / (60 * 1000))} minutes`,
            breakDuration: `${Math.floor(timerSettings?.breakDuration / (60 * 1000))} minutes`,
            longBreakDuration: `${Math.floor(timerSettings?.longBreakDuration / (60 * 1000))} minutes`,
            sessionsUntilLongBreak: timerSettings?.sessionsUntilLongBreak
          },
          defaults: {
            workDuration: `${Math.floor(DEFAULT_TIMER_SETTINGS.workDuration / (60 * 1000))} minutes`,
            breakDuration: `${Math.floor(DEFAULT_TIMER_SETTINGS.breakDuration / (60 * 1000))} minutes`,
            longBreakDuration: `${Math.floor(DEFAULT_TIMER_SETTINGS.longBreakDuration / (60 * 1000))} minutes`,
            sessionsUntilLongBreak: DEFAULT_TIMER_SETTINGS.sessionsUntilLongBreak
          },
          final: {
            workDuration: `${Math.floor(validSettings.workDuration / (60 * 1000))} minutes`,
            breakDuration: `${Math.floor(validSettings.breakDuration / (60 * 1000))} minutes`,
            longBreakDuration: `${Math.floor(validSettings.longBreakDuration / (60 * 1000))} minutes`,
            sessionsUntilLongBreak: validSettings.sessionsUntilLongBreak
          }
        });

        setSettings(validSettings);
        setLocalSettings(validSettings);
        setIsLoading(false);
      } catch (error) {
        logger.error("Failed to load settings:", error);
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [logger]);

  const handleToggleTaskPosition = useCallback(async () => {
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
      if (!posthog.has_opted_in_capturing()) {
        logger.debug(
          "Analytics disabled - skipping event capture for task position setting",
        );
        return;
      }
      try {
        posthog.capture("settings_updated", {
          setting: "addTasksToBottom",
          value: newValue,
        });
        logger.debug("Analytics event captured for task position setting", {
          setting: "addTasksToBottom",
          value: newValue,
        });
      } catch (error) {
        logger.warn(
          "Failed to capture analytics for task position setting update:",
          { error, setting: "addTasksToBottom", value: newValue },
        );
      }
    } catch (error) {
      logger.error("Failed to update task position setting:", error);
    }
  }, [settings.addTasksToBottom, setSettings, logger]);

  const updateSaveStatus = useCallback(
    (key: string, status: { saving?: boolean; saved?: boolean }) => {
      setSaveStatus((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          ...status,
        },
      }));

      // Clear existing timeout for this key
      if (saveStatusTimeouts.current[key]) {
        clearTimeout(saveStatusTimeouts.current[key]);
      }

      // If we're showing "Saved!", clear it after 2 seconds
      if (status.saved) {
        saveStatusTimeouts.current[key] = setTimeout(() => {
          setSaveStatus((prev) => ({
            ...prev,
            [key]: { ...prev[key], saved: false },
          }));
        }, 2000);
      }
    },
    [],
  );

  const createDebouncedSave = useCallback(
    (setting: keyof UserSettings): ((value: number) => void) | undefined => {
      if (!debouncedSaveRef.current[setting]) {
        debouncedSaveRef.current[setting] = debounce(async (value: number) => {
          // Don't show saving immediately - wait a bit to avoid UI flicker
          const savingTimeout = setTimeout(() => {
            updateSaveStatus(setting, { saving: true });
          }, 500);

          try {
            await settingsDB.setTimerSettings({ [setting]: value });
            setSettings((prev) => ({
              ...prev,
              [setting]: value,
            }));
            clearTimeout(savingTimeout);
            updateSaveStatus(setting, { saving: false, saved: true });
            logger.info("Timer setting updated:", { [setting]: value });
            if (!posthog.has_opted_in_capturing()) {
              logger.debug(
                "Analytics disabled - skipping event capture for timer setting",
              );
              return;
            }
            try {
              posthog.capture("settings_updated", { setting, value });
              logger.debug("Analytics event captured for timer setting", {
                setting,
                value,
              });
            } catch (error) {
              logger.warn(
                "Failed to capture analytics for timer setting update:",
                { error, setting, value },
              );
            }
          } catch (error) {
            logger.error("Failed to update timer setting:", error);
            updateSaveStatus(setting, { saving: false, saved: false });
          }
        }, 2000); // Increased debounce time for better UX when typing numbers
      }
      return debouncedSaveRef.current[setting];
    },
    [logger, updateSaveStatus],
  );

  const handleTimerSettingChange = useCallback(
    (setting: keyof UserSettings, value: string) => {
      // Parse input value as minutes
      let numValue = parseInt(value, 10) || 0;
      
      // Convert minutes to milliseconds for duration settings
      const valueToStore = setting.includes('Duration') ? numValue * 60 * 1000 : numValue;

      logger.info(`Setting ${setting} to ${numValue} minutes (${valueToStore} ms)`);

      // Update both states to keep them in sync
      setSettings(prev => ({
          ...prev,
          [setting]: valueToStore,
      }));
      setLocalSettings(prev => ({
          ...prev,
          [setting]: valueToStore,
      }));

      // Debounce the actual save
      const debouncedSaver = createDebouncedSave(setting);
      if (debouncedSaver) {
          debouncedSaver(valueToStore);
          // Show saving status
          updateSaveStatus(setting, { saving: true, saved: false });
      } else {
          logger.error('Failed to create debounced save function');
      }
    },
    [createDebouncedSave, setSettings, setLocalSettings, updateSaveStatus, logger]
  );

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

        <div className={styles.settingGroup}>
          <h2>Timer Settings</h2>
          <button 
            className={styles.resetButton}
            onClick={() => {
              const defaultValues = {
                ...DEFAULT_TIMER_SETTINGS,
                workDuration: DEFAULT_TIMER_SETTINGS.workDuration,
                breakDuration: DEFAULT_TIMER_SETTINGS.breakDuration,
                longBreakDuration: DEFAULT_TIMER_SETTINGS.longBreakDuration,
                sessionsUntilLongBreak: DEFAULT_TIMER_SETTINGS.sessionsUntilLongBreak,
              };

              // Update both local and main settings state
              setLocalSettings(defaultValues);
              setSettings(defaultValues);
              
              // Save default values to database
              settingsDB.setTimerSettings(DEFAULT_TIMER_SETTINGS);
              
              // Show success message
              Object.keys(DEFAULT_TIMER_SETTINGS).forEach(key => {
                updateSaveStatus(key, { saving: false, saved: true });
              });

              logger.info("Settings reset to defaults");
            }}
          >
            Reset to Default
          </button>
          <TimerSettingInput
            label="Work Duration (minutes)"
            value={Math.max(1, Math.floor(settings.workDuration / (60 * 1000)))}
            min={1}
            max={60}
            saving={saveStatus.workDuration?.saving}
            saved={saveStatus.workDuration?.saved}
            onChange={(value) =>
              handleTimerSettingChange("workDuration", value)
            }
            isMinutes={false}
          />
          <TimerSettingInput
            label="Short Break Duration (minutes)"
            value={Math.max(1, Math.floor(settings.breakDuration / (60 * 1000)))}
            min={1}
            max={30}
            saving={saveStatus.breakDuration?.saving}
            saved={saveStatus.breakDuration?.saved}
            onChange={(value) =>
              handleTimerSettingChange("breakDuration", value)
            }
            isMinutes={false}
          />
          <TimerSettingInput
            label="Long Break Duration (minutes)"
            value={Math.max(1, Math.floor(settings.longBreakDuration / (60 * 1000)))}
            min={1}
            max={60}
            saving={saveStatus.longBreakDuration?.saving}
            saved={saveStatus.longBreakDuration?.saved}
            onChange={(value) =>
              handleTimerSettingChange("longBreakDuration", value)
            }
            isMinutes={false}
          />
          <TimerSettingInput
            label="Sessions Until Long Break"
            value={
              localSettings?.sessionsUntilLongBreak ??
              settings.sessionsUntilLongBreak
            }
            min={1}
            max={10}
            saving={saveStatus.sessionsUntilLongBreak?.saving}
            saved={saveStatus.sessionsUntilLongBreak?.saved}
            onChange={(value) =>
              handleTimerSettingChange("sessionsUntilLongBreak", value)
            }
          />
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
