// Define message interface for type safety
export interface ServiceWorkerMessage {
  type: string;
  message?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Sends a message to the active service worker, if one is available.
 *
 * If no active service worker is present, logs an error to the console.
 *
 * @param message - The message to send to the service worker.
 */
export function sendMessageToSW(message: ServiceWorkerMessage): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
    console.log('Message sent to Service Worker:', message);
  } else {
    console.error('No active service worker found');
  }
}

/**
 * Registers a callback to handle messages received from the service worker.
 *
 * @param callback - Function invoked with each incoming {@link MessageEvent} containing a {@link ServiceWorkerMessage}.
 */
export function listenForSWMessages(callback: (event: MessageEvent<ServiceWorkerMessage>) => void): void {
  navigator.serviceWorker.addEventListener('message', callback as EventListener);
}

interface WaitJobPayload {
  duration: number;
  description?: string;
  id: string;
}
/**
 * Requests the service worker to create a wait job with the specified parameters.
 *
 * @param payload - The details of the wait job, including duration, identifier, and optional description.
 */
export function createWaitJob(payload: WaitJobPayload): void {
  sendMessageToSW({
    type: 'CREATE_WAIT_JOB',
    payload,
  });
}
