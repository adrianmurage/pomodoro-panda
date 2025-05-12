import { usePostHog } from 'posthog-js/react';
import { useEffect } from 'react';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import './App.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import NavBar from './components/NavBar/NavBar';
import { useLogger } from './hooks/useLogger';
import Home from './pages/Home';
import Stats from './pages/Stats';
import { initializeApp } from './utils/appSetup';

function App() {
    // Initialize the app
    useEffect(() => {
        async function initialize() {
            try {
                await initializeApp();
            } catch (error) {
                console.error('Failed to initialize app:', error);
            }
        }
        initialize();
    }, []);

    const appLogger = useLogger('App');
    const posthog = usePostHog();

    useEffect(() => {
        if (posthog && appLogger) {
            appLogger.info('PostHog successfully initialized');
            posthog.capture('app_loaded');
        }
    }, [appLogger, posthog]);

    return (
        <ErrorBoundary fallback={<div>Something went wrong</div>}>
            <Router>
                <NavBar />
                <Routes>
                    <Route
                        path="/"
                        element={<Home />}
                    />
                    <Route
                        path="/stats"
                        element={<Stats />}
                    />
                </Routes>
            </Router>
        </ErrorBoundary>
    );
}

export default App;
