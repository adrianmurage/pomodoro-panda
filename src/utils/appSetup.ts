import { logger } from './logger';
import { LogLevel } from '../types/logger';
import * as Sentry from '@sentry/react';

/**
 * Initialize the logger and other app settings
 */
export async function initializeApp() {
    // Fine-tune the logger level based on environment
    if (process.env.NODE_ENV === "development") {
        // Already set to DEBUG by default
        logger.setPrefix("[DEV] ");
    }
    else if (process.env.NODE_ENV === "production") {
        // Already set to WARN by default

        // Check if we should use Sentry
        if (import.meta.env.VITE_USE_SENTRY === 'true' && import.meta.env.VITE_SENTRY_DSN) {
            try {
                Sentry.init({
                    dsn: import.meta.env.VITE_SENTRY_DSN,
                    environment: process.env.NODE_ENV,
                    debug: false,
                    integrations: [
                        Sentry.feedbackIntegration({
                            isNameRequired: false,
                            isEmailRequired: true,
                            isMessageRequired: true,
                            themeLight:{
                                accentBackground: '#d9534f',
                                successColor: '#5cb85c'
                            },
                            triggerLabel: 'Help Us Improve!',
                            formTitle: 'Report a bug, provide feedback, or request a feature',
                            messagePlaceholder: "Report any bugs, provide feedback, or request a feature here. Be as detailed as possible. Adrian(the guy building this), will get back to you within 24 hours.",
                        }),
                        Sentry.replayIntegration({
                            // help us see what was going on in the app when an error occurs
                            // while keeping the user's data private
                            maskAllText: false,
                            maskAllInputs: false,
                            blockAllMedia: false,
                        })
                    ],
                    replaysSessionSampleRate: 0,
                    replaysOnErrorSampleRate: 1.0,
                });

                // Verify initialization
                // Sentry.captureMessage('Sentry Initialization Test');
                logger.configure({
                    useSentry: true,
                    sentryInstance: Sentry,
                });

            } catch (error) {
                logger.error("Failed to initialize Sentry", { error });
            }
        } else {
            console.warn('Sentry configuration missing:', {
                useSentry: import.meta.env.VITE_USE_SENTRY,
                hasDSN: !!import.meta.env.VITE_SENTRY_DSN
            });
        }
    } else if (process.env.NODE_ENV === "test") {
        // Disable all logging in test mode
        logger.setLevel(LogLevel.NONE);
    }

    // global error handlers ensure that no error goes unnoticed or un-logged
    window.addEventListener('error', (event) => {
        // Check if this is a resource loading error
        if (event.target && (event.target as HTMLElement).tagName) {
            const target = event.target as HTMLElement;
            const resourceUrl = (target instanceof HTMLLinkElement) ? target.href : (target as HTMLImageElement | HTMLScriptElement).src;

            logger.warn(`Resource failed to load: ${resourceUrl}`, {
                tagName: target.tagName,
                type: event.type
            });

            Sentry.captureMessage(`Resource failed to load: ${resourceUrl}`, 'warning');
            return true; // Prevent default handling for resource errors
        }

        // For JavaScript errors
        logger.error('Uncaught error', { 
            error: event.error || event.message,
            message: event.error?.message || event.message
        });
        Sentry.captureException(event.error || new Error(event.message));
        return false;
    }, true);

    window.addEventListener('unhandledrejection', (event) => {
        logger.error('Unhandled promise rejection', {
            error: event.reason,
            message: event.reason?.message
        });
        Sentry.captureException(event.reason);
    });
}
