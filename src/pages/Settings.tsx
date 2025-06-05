import posthog from 'posthog-js';
import { useEffect, useState, useCallback, useRef } from 'react';
import styles from './Settings.module.css';
import { useLogger } from '../hooks/useLogger';
import { settingsDB } from '../utils/database';
import { DEFAULT_TIMER_SETTINGS } from '../constants/timerConstants';
import { debounce } from 'lodash';

interface UserSettings {
    addTasksToBottom: boolean;
    workDuration: number;
    breakDuration: number;
    longBreakDuration: number;
    sessionsUntilLongBreak: number;
}

interface SaveStatus {
    [key: string]: {
        saving: boolean;
        saved: boolean;
        timer?: NodeJS.Timeout;
    };
}

const Settings = () => {
    const logger = useLogger('Settings');
    const [settings, setSettings] = useState<UserSettings>({
        addTasksToBottom: false,
        workDuration: DEFAULT_TIMER_SETTINGS.workDuration,
        breakDuration: DEFAULT_TIMER_SETTINGS.breakDuration,
        longBreakDuration: DEFAULT_TIMER_SETTINGS.longBreakDuration,
        sessionsUntilLongBreak: DEFAULT_TIMER_SETTINGS.sessionsUntilLongBreak
    });
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>({});
    const [localSettings, setLocalSettings] = useState<UserSettings | null>(null);
    const saveStatusTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});
    const debouncedSaveRef = useRef<{ [key: string]: ReturnType<typeof debounce> }>({});

    useEffect(() => {
        async function loadSettings() {
            try {
                const [addTasksToBottom, timerSettings] = await Promise.all([
                    settingsDB.get('addTasksToBottom'),
                    settingsDB.getTimerSettings()
                ]);

                const newSettings = {
                    ...DEFAULT_TIMER_SETTINGS,
                    addTasksToBottom: addTasksToBottom ?? false,
                    ...(timerSettings || {})
                };
                setSettings(newSettings);
                setLocalSettings(newSettings);
                setIsLoading(false);
            } catch (error) {
                logger.error('Failed to load settings:', error);
                setIsLoading(false);
            }
        }

        loadSettings();
    }, [logger]);

    const handleToggleTaskPosition = async () => {
        const newValue = !settings.addTasksToBottom;
        try {
            await settingsDB.set('addTasksToBottom', newValue);
            setSettings(prev => ({
                ...prev,
                addTasksToBottom: newValue
            }));
            logger.info('Task position setting updated:', { addTasksToBottom: newValue });
            if (!posthog.has_opted_in_capturing()) {
                logger.debug('Analytics disabled - skipping event capture for task position setting');
                return;
            }
            try {
                posthog.capture('settings_updated', { setting: 'addTasksToBottom', value: newValue });
                logger.debug('Analytics event captured for task position setting', { setting: 'addTasksToBottom', value: newValue });
            } catch (error) {
                logger.warn('Failed to capture analytics for task position setting update:', { error, setting: 'addTasksToBottom', value: newValue });
            }
        } catch (error) {
            logger.error('Failed to update task position setting:', error);
        }
    };

    const updateSaveStatus = useCallback((key: string, status: { saving?: boolean; saved?: boolean }) => {
        setSaveStatus(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                ...status
            }
        }));

        // Clear existing timeout for this key
        if (saveStatusTimeouts.current[key]) {
            clearTimeout(saveStatusTimeouts.current[key]);
        }

        // If we're showing "Saved!", clear it after 2 seconds
        if (status.saved) {
            saveStatusTimeouts.current[key] = setTimeout(() => {
                setSaveStatus(prev => ({
                    ...prev,
                    [key]: { ...prev[key], saved: false }
                }));
            }, 2000);
        }
    }, []);

    const createDebouncedSave = useCallback((setting: keyof UserSettings) => {
        if (!debouncedSaveRef.current[setting]) {
            debouncedSaveRef.current[setting] = debounce(async (value: number) => {
                // Don't show saving immediately - wait a bit to avoid UI flicker
                const savingTimeout = setTimeout(() => {
                    updateSaveStatus(setting, { saving: true });
                }, 500);
                
                try {
                    await settingsDB.setTimerSettings({ [setting]: value });
                    setSettings(prev => ({
                        ...prev,
                        [setting]: value
                    }));
                    clearTimeout(savingTimeout);
                    updateSaveStatus(setting, { saving: false, saved: true });
                    logger.info('Timer setting updated:', { [setting]: value });
                    if (!posthog.has_opted_in_capturing()) {
                        logger.debug('Analytics disabled - skipping event capture for timer setting');
                        return;
                    }
                    try {
                        posthog.capture('settings_updated', { setting, value });
                        logger.debug('Analytics event captured for timer setting', { setting, value });
                    } catch (error) {
                        logger.warn('Failed to capture analytics for timer setting update:', { error, setting, value });
                    }
                } catch (error) {
                    logger.error('Failed to update timer setting:', error);
                    updateSaveStatus(setting, { saving: false, saved: false });
                }
            }, 2000); // Increased debounce time for better UX when typing numbers
        }
        return debouncedSaveRef.current[setting];
    }, [logger, updateSaveStatus]);

    const handleTimerSettingChange = (setting: keyof UserSettings, value: string) => {
        let numValue = parseInt(value, 10);
        
        // Convert minutes to milliseconds for duration settings
        if (setting.includes('Duration')) {
            numValue = numValue * 60 * 1000;
        }

        // Update local state immediately for UI responsiveness
        setLocalSettings(prev => ({
            ...prev,
            [setting]: numValue
        }));

        // Debounce the actual save
        const debouncedSaver = createDebouncedSave(setting);
        debouncedSaver(numValue);
        
        // Don't show immediate saving status - the debounced save will handle this
        updateSaveStatus(setting, { saving: false, saved: false });
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
                        When enabled, new tasks will be added to the bottom of your task list instead of the top.
                    </p>
                </div>

                <div className={styles.settingGroup}>
                    <h2>Timer Settings</h2>
                    <div className={styles.settingItem}>
                        <label className={styles.settingLabel}>
                            <span>Work Duration (minutes)</span>
                            <div className={styles.inputWithStatus}>
                                {saveStatus.workDuration?.saving && <span className={styles.savingIndicator}>Saving...</span>}
                                {saveStatus.workDuration?.saved && <span className={styles.savedIndicator}>Saved!</span>}
                                <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    value={Math.floor((localSettings?.workDuration ?? settings.workDuration) / (60 * 1000))}
                                    onChange={(e) => handleTimerSettingChange('workDuration', e.target.value)}
                                    className={styles.numberInput}
                                />
                            </div>
                        </label>
                    </div>

                    <div className={styles.settingItem}>
                        <label className={styles.settingLabel}>
                            <span>Short Break Duration (minutes)</span>
                            <div className={styles.inputWithStatus}>
                                {saveStatus.breakDuration?.saving && <span className={styles.savingIndicator}>Saving...</span>}
                                {saveStatus.breakDuration?.saved && <span className={styles.savedIndicator}>Saved!</span>}
                                <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={Math.floor((localSettings?.breakDuration ?? settings.breakDuration) / (60 * 1000))}
                                    onChange={(e) => handleTimerSettingChange('breakDuration', e.target.value)}
                                    className={styles.numberInput}
                                />
                            </div>
                        </label>
                    </div>

                    <div className={styles.settingItem}>
                        <label className={styles.settingLabel}>
                            <span>Long Break Duration (minutes)</span>
                            <div className={styles.inputWithStatus}>
                                {saveStatus.longBreakDuration?.saving && <span className={styles.savingIndicator}>Saving...</span>}
                                {saveStatus.longBreakDuration?.saved && <span className={styles.savedIndicator}>Saved!</span>}
                                <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    value={Math.floor((localSettings?.longBreakDuration ?? settings.longBreakDuration) / (60 * 1000))}
                                    onChange={(e) => handleTimerSettingChange('longBreakDuration', e.target.value)}
                                    className={styles.numberInput}
                                />
                            </div>
                        </label>
                    </div>

                    <div className={styles.settingItem}>
                        <label className={styles.settingLabel}>
                            <span>Sessions Until Long Break</span>
                            <div className={styles.inputWithStatus}>
                                {saveStatus.sessionsUntilLongBreak?.saving && <span className={styles.savingIndicator}>Saving...</span>}
                                {saveStatus.sessionsUntilLongBreak?.saved && <span className={styles.savedIndicator}>Saved!</span>}
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={localSettings?.sessionsUntilLongBreak ?? settings.sessionsUntilLongBreak}
                                    onChange={(e) => handleTimerSettingChange('sessionsUntilLongBreak', e.target.value)}
                                    className={styles.numberInput}
                                />
                            </div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings; 