// Main service worker file
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { initializeJobsDB, getAllActiveJobs,updateJobStatus } from "./idxdb";
import { createWaitJob, processTimerChunk } from "./micro-tasks";

declare const self: ServiceWorkerGlobalScope;

// Precaching
precacheAndRoute(self.__WB_MANIFEST);

// Lifecycle Management
self.addEventListener("install", () => {
  console.log("[SW] Install event");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activate event");
  event.waitUntil(Promise.all([
    cleanupOutdatedCaches(), 
    clientsClaim(),
    initializeJobsDB()
  ]));
});


self.addEventListener("fetch", async (event) => {
  const url = new URL(event.request.url);
  
  // Timer wake-up endpoint
  if (url.pathname === "/timer-keepalive") {
    const activeJobs = await getAllActiveJobs();
    event.respondWith(
      new Response(
        JSON.stringify({ 
          status: activeJobs.length > 0 ? "ALIVE" : "INACTIVE",
          jobCount: activeJobs.length
        }),
        { 
          headers: { 'Content-Type': 'application/json' } 
        }
      )
    );
    
    // Process any active jobs
    if (activeJobs.length > 0) {
      event.waitUntil(processTimerChunk());
    }
  }
});

// Main message handler
self.addEventListener("message", async (event) => {
  console.log("[SW] Received message:", event.data);
  switch (event?.data?.type) {
    case "CREATE_WAIT_JOB":
      try {
        const job = await createWaitJob(event.data.payload);
        event.ports[0]?.postMessage({ success: true, job });
      } catch (error) {
        console.error("[SW] Error creating wait job:", error);
        event.ports[0]?.postMessage({ 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
      break;
    
    case "GET_ACTIVE_JOBS":
      try {
        const jobs = await getAllActiveJobs();
        event.ports[0]?.postMessage({ success: true, jobs });
      } catch (error) {
        console.error("[SW] Error getting active jobs:", error);
        event.ports[0]?.postMessage({ 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
      break;
    
    case "CANCEL_JOB":
      try {
        await updateJobStatus(event.data.id, "cancelled");
        event.ports[0]?.postMessage({ success: true });
      } catch (error) {
        console.error("[SW] Error cancelling job:", error);
        event.ports[0]?.postMessage({ 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
      break;
    
    case "CHECK_SW_STATUS":
      event.ports[0]?.postMessage({ 
        success: true, 
        status: "running",
        activeJobs: await getAllActiveJobs()
      });
      break;
    
    default:
      console.log("[SW] Unknown message type");
  }
});

