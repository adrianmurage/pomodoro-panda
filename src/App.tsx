import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import NavBar from "./components/NavBar/NavBar";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import Stats from "./pages/Stats";
import { initializeApp } from "./utils/appSetup";
import { RegisterSW } from "./components/pwa/RegisterSW";

function App() {
  // Initialize the app
  useEffect(() => {
    async function initialize() {
      try {
        await initializeApp();
      } catch (error) {
        console.error("Failed to initialize app:", error);
      }
    }
    initialize();
  }, []);

  const posthog = usePostHog();

  // Capture app_loaded event once PostHog is available
  useEffect(() => {
    if (posthog) {
      posthog.capture("app_loaded");
    }
  }, [posthog]);

  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <RegisterSW />
      <Router>
        <NavBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
