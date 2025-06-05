import { usePostHog } from 'posthog-js/react';
import { useEffect } from 'react';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import './App.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import NavBar from './components/NavBar/NavBar';
import Home from './pages/Home';
import Settings from './pages/settings';
import Stats from './pages/Stats';
import { initializeApp } from './utils/appSetup';
import { useLogger } from './hooks/useLogger';

function App() {
    const appLogger = useLogger('App');

    // Initialize the app
    useEffect(() => {
        async function initialize() {
            try {
                await initializeApp();
            } catch (error) {
                appLogger.error('Failed to initialize app:', error);
            }
        }
        initialize();
    }, [appLogger]);

    const posthog = usePostHog();

    // Capture app_loaded event once PostHog is available
    useEffect(() => {
        if (!posthog) {
            appLogger.debug('PostHog not initialized yet - skipping app_loaded event');
            return;
        }

        if (!posthog.has_opted_in_capturing()) {
            appLogger.debug('Analytics disabled - skipping app_loaded event');
            return;
        }

        try {
            posthog.capture('app_loaded');
            appLogger.debug('Analytics event captured for app_loaded');
        } catch (error) {
            appLogger.warn('Failed to capture analytics for app_loaded:', error);
        }
    }, [posthog, appLogger]);

    return (
        <ErrorBoundary fallback={<div>Something went wrong</div>}>
            <Router>
                <div className="App">
                    <NavBar />
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/stats" element={<Stats />} />
                    </Routes>
                </div>
            </Router>
        </ErrorBoundary>
    );
}

export default App;