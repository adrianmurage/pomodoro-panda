import { useEffect, useState } from "react";
import {
  USER_SETTINGS_KEYS,
  DEFAULT_TIMER_SETTINGS,
} from "../constants/timerConstants";
import { settingsDB } from "../utils/database";
import { useLogger } from "./useLogger";
import { UserSettings } from "../types";

export function useUserSettings() {
  const logger = useLogger("Settings");

  const [settings, setSettings] = useState<UserSettings>({
    ...DEFAULT_TIMER_SETTINGS,
    addTasksToBottom: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [editingSetting, setEditingSetting] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const entries = await Promise.all(
          USER_SETTINGS_KEYS.map(async (key) => {
            const value = await settingsDB.get(key);
            return [key, value] as [
              keyof UserSettings,
              string | number | boolean
            ];
          })
        );

        const newSettings = entries.reduce((acc, [key, value]) => {
          if (value !== null) {
            acc[key] = value;
          }
          return acc;
        }, {} as UserSettings);
        
        if (Object.keys(newSettings).length > 0) {
          setSettings((prev) => ({ ...prev, ...newSettings }));
        }

        setIsLoading(false);
      } catch (error) {
        logger.error("Failed to load settings:", error);
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [logger]);

  return {
    settings,
    setSettings,
    isLoading,
    editingSetting,
    setEditingSetting,
    logger,
  };
}
