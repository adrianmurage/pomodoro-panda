// Define message interface for type safety
export interface ServiceWorkerMessage {
  type: string;
  message?: string;
  timestamp?: string;
  [key: string]: unknown;
}

// Send a message to the service worker
export function sendMessageToSW(message: ServiceWorkerMessage): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
    console.log('Message sent to Service Worker:', message);
  } else {
    console.error('No active service worker found');
  }
}

// Set up event listener for service worker messages
export function listenForSWMessages(callback: (event: MessageEvent<ServiceWorkerMessage>) => void): void {
  navigator.serviceWorker.addEventListener('message', callback as EventListener);
}

interface WaitJobPayload {
  duration: number;
  description?: string;
  id: string;
}
export function createWaitJob(payload: WaitJobPayload): void {
  sendMessageToSW({
    type: 'CREATE_WAIT_JOB',
    payload,
  });
}
