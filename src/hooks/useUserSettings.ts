import { useEffect, useState } from "react";
import {
  USER_SETTINGS_KEYS,
  DEFAULT_TIMER_SETTINGS,
} from "../constants/timerConstants";
import { settingsDB } from "../utils/database";
import type { UserSettings } from "../pages/Settings";
import { useLogger } from "./useLogger";

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

        for (const [key, value] of entries) {
          setSettings((prev) => ({
            ...prev,
            [key]: value ?? prev[key],
          }));
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
