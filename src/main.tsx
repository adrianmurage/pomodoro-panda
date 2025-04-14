import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App/App.tsx';
import './index.css';
import { PostHogProvider } from 'posthog-js/react';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <PostHogProvider
            apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
            options={{
                api_host: "https://eu.i.posthog.com",
            }}
        >
            <App />
        </PostHogProvider>
    </StrictMode>
);
