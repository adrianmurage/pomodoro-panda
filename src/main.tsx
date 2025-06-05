import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { PostHogProvider } from 'posthog-js/react';
import posthog from 'posthog-js';
import { logger } from './utils/logger';

const mainLogger = logger.createLogger('Main');

// Check for PostHog API key
const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;

if (!POSTHOG_KEY) {
    mainLogger.warn('PostHog API key not found. Analytics will be disabled. Set VITE_PUBLIC_POSTHOG_KEY in your environment to enable analytics.');
} else {
    posthog.init(POSTHOG_KEY, {
        api_host: 'https://eu.i.posthog.com',
        loaded: (posthog) => {
            if (import.meta.env.DEV) {
                // Disable posthog in development
                posthog.opt_out_capturing();
            }
        }
    });
}

// Conditionally wrap app with PostHog provider
const AppWithAnalytics = POSTHOG_KEY ? (
    <PostHogProvider client={posthog}>
        <App />
    </PostHogProvider>
) : (
    <App />
);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        {AppWithAnalytics}
    </StrictMode>
);
