import { LoggerConfig, LogLevel, SentryType } from "../types/logger";
import { v4 as uuidv4 } from 'uuid';

/**
 * simple logger for react apps
 */
class Logger {
    private level: LogLevel;
    private prefix: string;
    private useSentry: boolean;
    private sentryInstance?: SentryType;
    private browserId: string;

    constructor(config: LoggerConfig = {}) {
        // Default level based on environment
        this.level = config.level ?? (
            process.env.NODE_ENV === 'production'
                ? LogLevel.WARN // Only warn and above in production
                : LogLevel.DEBUG // All logs in development
        );

        this.prefix = config.prefix ?? '';
        this.useSentry = config.useSentry ?? false;
        this.sentryInstance = config.sentryInstance;
        this.browserId = this.getBrowserId();
        // Validate sentry config
        if (this.useSentry && !this.sentryInstance) {
            console.warn('Logger configured to use Sentry but no instance provided');
            this.useSentry = false;
        }
    }

    /**
 * Get or create a persistent browser ID
 */
    private getBrowserId(): string {
        // Try to get existing ID from localStorage
        const storedId = localStorage.getItem('browser_instance_id');

        if (storedId) {
            return storedId;
        }

        // Generate a new ID if none exists
        const newId = uuidv4();

        // Store it for future sessions
        try {
            localStorage.setItem('browser_instance_id', newId);
        } catch (e) {
            console.warn('Failed to store browser ID in localStorage', e);
        }

        return newId;
    }


    /**
     * Configure the logger
     */
    configure(config: LoggerConfig): void {
        if (config.level !== undefined) {
            this.level = config.level;
        }

        if (config.prefix !== undefined) {
            this.prefix = config.prefix;
        }

        if (config.useSentry !== undefined) {
            this.useSentry = config.useSentry;
        }

        if (config.sentryInstance !== undefined) {
            this.sentryInstance = config.sentryInstance;
        }

        // Validate sentry config
        if (this.useSentry && !this.sentryInstance) {
            console.warn('Logger configured to use Sentry but no instance provided');
            this.useSentry = false;
        }
    }



    /**
     * Set the logging level 
     */
    setLevel(level: LogLevel): void {
        this.level = level;
    }

    /**
     * Set a prefix for all log messages
     */
    setPrefix(prefix: string): void {
        this.prefix = prefix;
    }


    /**
     * Set the Sentry instance
     */
    setSentryInstance(instance: SentryType, useSentry: boolean): void {
        this.sentryInstance = instance;
        this.useSentry = useSentry;
    }

    /**
     * Get the call site location for logging
     */
    private getCallSite(): string {
        const error = new Error();
        Error.captureStackTrace(error, this.getCallSite);
        
        const stackLines = error.stack?.split('\n') || [];
        // Skip internal frames (Error, getCallSite, logger method)
        const callerLine = stackLines[3] || '';
        
        // Extract file path and line number
        const match = callerLine.match(/\((.+)\)/) || callerLine.match(/at (.+)/);
        return match ? match[1].trim() : 'unknown location';
    }

    /**
     * Format timestamp in a human-readable format
     * Uses local time in development and UTC in production
     */
    private formatTimestamp(): string {
        const now = new Date();
        if (process.env.NODE_ENV === 'production') {
            // Use UTC in production for consistency
            return now.toISOString().split('T').join(' ').slice(0, -1);
        } else {
            // Use local time in development for easier debugging
            const pad = (n: number) => n.toString().padStart(2, '0');
            return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
                   `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.` +
                   `${now.getMilliseconds().toString().padStart(3, '0')}`;
        }
    }

    /**
     * Format the log message with timestamp, level, prefix, and call site
     */
    private formatMessage(level: string, message: string): string {
        const callSite = this.getCallSite();
        const timestamp = this.formatTimestamp();
        return `${timestamp} [${level}] ${this.prefix} ${message} (${callSite})`;
    }

    /**
     * Log a debug message
     */
    debug(message: string, ...data: unknown[]): void {
        if (this.level <= LogLevel.DEBUG) {
            const enhancedData = this.addBrowserId(data);
            console.debug(this.formatMessage('DEBUG', message), ...enhancedData);

            if (this.useSentry && this.sentryInstance) {
                this.sentryInstance.addBreadcrumb({
                    category: 'debug',
                    message: `${this.prefix} ${message}`,
                    data: enhancedData.length > 0 ? this.processDataForSentry(enhancedData) : undefined,
                    level: 'info',
                    // Include location data in Sentry
                    timestamp: Date.now(),
                    filename: this.getCallSite()
                });
            }
        }
    }

    /**
     * Log an info message
     */
    info(message: string, ...data: unknown[]): void {
        if (this.level <= LogLevel.INFO) {
            const enhancedData = this.addBrowserId(data);
            console.info(this.formatMessage('INFO', message), ...enhancedData);

            if (this.useSentry && this.sentryInstance) {
                const callSite = this.getCallSite();
                this.sentryInstance.addBreadcrumb({
                    category: 'info',
                    message: `${this.prefix} ${message}`,
                    data: enhancedData.length > 0 ? this.processDataForSentry(enhancedData) : undefined,
                    level: 'info',
                    timestamp: Date.now(),
                    filename: callSite
                });

                if (process.env.NODE_ENV === 'production') {
                    this.sentryInstance.captureMessage(
                        this.formatMessage('INFO', message),
                        'info'
                    );
                }
            }
        }
    }

    /**
     * Log a warning message
     */
    warn(message: string, ...data: unknown[]): void {
        if (this.level <= LogLevel.WARN) {
            const enhancedData = this.addBrowserId(data);
            console.warn(this.formatMessage('WARN', message), ...enhancedData);

            if (this.useSentry && this.sentryInstance) {
                const callSite = this.getCallSite();
                this.sentryInstance.addBreadcrumb({
                    category: 'warning',
                    message: `${this.prefix} ${message}`,
                    data: enhancedData.length > 0 ? this.processDataForSentry(enhancedData) : undefined,
                    level: 'warning',
                    timestamp: Date.now(),
                    filename: callSite
                });

                this.sentryInstance.captureMessage(
                    this.formatMessage('WARN', message),
                    'warning'
                );
            }
        }
    }

    /**
     * Log an error message
     */
    error(message: string | Error, ...data: unknown[]): void {
        if (this.level <= LogLevel.ERROR) {
            const enhancedData = this.addBrowserId(data);
            const callSite = this.getCallSite();

            if (message instanceof Error) {
                console.error(
                    this.formatMessage('ERROR', message.message),
                    message.stack,
                    ...enhancedData,
                    message
                );
            } else {
                console.error(
                    this.formatMessage('ERROR', message),
                    ...enhancedData
                );
            }

            if (this.useSentry && this.sentryInstance) {
                if (message instanceof Error) {
                    this.sentryInstance.captureException(message, {
                        extra: {
                            ...this.processDataForSentry(enhancedData),
                            location: callSite
                        }
                    });
                } else {
                    this.sentryInstance.addBreadcrumb({
                        category: 'error',
                        message: `${this.prefix} ${message}`,
                        data: enhancedData.length > 0 ? this.processDataForSentry(enhancedData) : undefined,
                        level: 'error',
                        timestamp: Date.now(),
                        filename: callSite
                    });

                    this.sentryInstance.captureMessage(
                        this.formatMessage('ERROR', message),
                        'error'
                    );
                }
            }
        }
    }

    /**
     * Add browser ID to log data
     */
    private addBrowserId(data: unknown[]): unknown[] {
        // If first item is an object, add browserId to it
        if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
            return [{ ...data[0], browserId: this.browserId }, ...data.slice(1)];
        }

        // Otherwise, add a new object with browserId as the first item
        return [{ browserId: this.browserId }, ...data];
    }


    /**
     * Create a new logger with a specific prefix
     * Useful for component-specific logging
     */
    createLogger(name: string): Logger {
        const childLogger = new Logger({
            level: this.level,
            prefix: `[${name}]`,
            useSentry: this.useSentry,
            sentryInstance: this.sentryInstance,
            browserId: this.browserId
        })

        return childLogger;
    }

    /**
     * Get the browser ID
     */
    getBrowserInstanceId(): string {
        return this.browserId;
    }


    /**
     * Process data for Sentry to ensure it can be properly serialized
     */
    private processDataForSentry(data: unknown[]): Record<string, unknown> {
        // Convert array of data to an object for Sentry
        // This helps with Sentry's data structure expectations
        if (data.length === 1 && typeof data[0] === 'object' && data[0] !== null) {
            return data[0] as Record<string, unknown>;
        }

        // If multiple items or not an object, create a numbered keys object
        return data.reduce<Record<string, unknown>>((acc, item, index) => {
            try {
                acc[`item_${index}`] = item;
                return acc;
            } catch (error) {
                acc[`item_${index}`] = 'Could not serialize for Sentry';
                console.error('[Logger] [processDataForSentry] Error serializing data for Sentry:', error);
                return acc;
            }
        }, {} as Record<string, unknown>);
    }
}


// Export a singleton instance
export const logger = new Logger();

