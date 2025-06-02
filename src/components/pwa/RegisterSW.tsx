import { useRegisterSW } from "virtual:pwa-register/react";
import { useState, useEffect } from "react";
import styles from "./pwa.module.css";

interface RegisterSWProps {
  autoHideDelay?: number; // Optional delay for auto-hiding in milliseconds
}

export function RegisterSW({ autoHideDelay = 5000 }: RegisterSWProps) {
  const { needRefresh, updateServiceWorker, offlineReady } = useRegisterSW({});
  const [offlineFadeOut, setOfflineFadeOut] = useState(false);

  const [offlineVisible, setOfflineVisible] = useState(offlineReady?.[0] || false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(needRefresh?.[0] || false);

  // Handle offline ready notification
  useEffect(() => {
    if (offlineReady?.[0]) {
      setOfflineVisible(true);
      setOfflineFadeOut(false);

      // Auto-hide after delay
      if (autoHideDelay > 0) {
        const timer = setTimeout(() => {
          setOfflineFadeOut(true);

          // After animation completes, hide completely
          setTimeout(() => setOfflineVisible(false), 500); // 500ms matches the transition duration
        }, autoHideDelay);

        return () => clearTimeout(timer);
      }
    }
  }, [offlineReady, autoHideDelay]);

  // Update prompt state when needRefresh changes
  useEffect(() => {
    setShowUpdatePrompt(needRefresh?.[0] || false);
  }, [needRefresh]);

  const dismissUpdatePrompt = () => {
    setShowUpdatePrompt(false);
  };

  const handleUpdate = () => {
    updateServiceWorker(true);
    setShowUpdatePrompt(false);
  };

  return (
    <>
      {/* Update notification - only shows when updates exist and persists until user action */}
      {showUpdatePrompt && (
        <div className={styles.updateNotification}>
          <div className={styles.updateContainer}>
            <span className={styles.updateText}>New version available!</span>
            <button
              className={`${styles.updateButton} ${styles.updateButtonAccent}`}
              onClick={handleUpdate}>
              Reload & Update
            </button>
            <button
              className={`${styles.updateButton} ${styles.updateButtonGhost}`}
              onClick={dismissUpdatePrompt}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Offline ready notification - shows briefly and auto-hides */}
      {offlineVisible && offlineReady?.[0] && (
        <div
          className={`${styles.offlineNotification} ${
            offlineFadeOut ? styles.fadeOut : styles.fadeIn
          }`}>
          <div className={styles.offlineContainer}>
            <div className={styles.offlineContent}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="currentColor"
                viewBox="0 0 16 16">
                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z" />
              </svg>
              <span>App ready for offline use</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
