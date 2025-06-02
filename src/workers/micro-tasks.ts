import { type WaitJob, getAllActiveJobs, getJobById, storeJob } from "./idxdb";


// ====== Constants ======
declare const self: ServiceWorkerGlobalScope;

const MICRO_TASK_INTERVAL = 50000; // 50 seconds
const TIMER_MARGIN = 180000; // 3 minutes

// Create a new waiting job
export async function createWaitJob(data: { 
  duration: number; 
  description?: string; 
  id?: string;
}) {
  const jobId = data?.id || `job-${Date.now()}`;
  const now = Date.now();
  const endTime = now + data?.duration;
  
  const job: WaitJob = {
    id: jobId,
    endTime,
    createdAt: now,
    description: data.description || `Waiting job ${jobId}`,
    status: "active"
  };
  
  // Store in IndexedDB
  await storeJob(job);
  
  // Start processing immediately
  processTimerChunk(jobId);
  
  // Also start a self-wake loop to prevent long sleep
  startKeepAliveLoop();
  
  return job;
}

// Self-wake every 45 minutes (fallback)
let keepAliveInterval: NodeJS.Timeout | null = null;

export function startKeepAliveLoop() {
  if (keepAliveInterval) return; // Already running
  
  keepAliveInterval = setInterval(async () => {
    const activeJobs = await getAllActiveJobs();
    if (activeJobs.length > 0) {
      // Ping ourselves to reset idle timer by forcing a fetch event
      try {
        await fetch(`/timer-keepalive?${Date.now()}`);
      } catch (error) {
        console.error("[SW] Error in keep-alive ping:", error);
      }
    } else {
      // No active jobs, stop the interval
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    }
  }, 2_700_000); // 45 minutes < max browser idle
}

// ====== Timer Processing Logic ======
// Process timer chunk (main timer mechanism)
export async function processTimerChunk(jobId?: string) {
  try {
    let jobs: WaitJob[];
    
    if (jobId) {
      const job = await getJobById(jobId);
      jobs = job ? [job] : [];
    } else {
      jobs = await getAllActiveJobs();
    }

    if (jobs.length === 0) {
      console.log("[SW] No active jobs to process");
      return;
    }

    console.log(`[SW] Processing ${jobs.length} active jobs`);
    
    // Process each job
    for (const job of jobs) {
      const remaining = job.endTime - Date.now();
      
      // Job complete or near completion (within margin)
      if (remaining <= TIMER_MARGIN) {
        const adjustedDelay = Math.max(0, remaining - 2000); // 2s buffer
        
        // Set a precise timeout for the final phase
        if (adjustedDelay > 0) {
          console.log(`[SW] Job ${job.id} near completion, setting precise timer for ${adjustedDelay}ms`);
          setTimeout(() => completeJob(job), adjustedDelay);
        } else {
          // Complete immediately if already past due
          await completeJob(job);
        }
      } else {
        // Still waiting, broadcast status
        notifyClientsAboutJobStatus(job);
        // We'll continue in the next micro-task
        console.log(`[SW] Job ${job.id} still waiting, ${remaining}ms remaining`);
      }
    }
    
    // Schedule next chunk after the interval
    setTimeout(async () => {
      await processTimerChunk();
    }, MICRO_TASK_INTERVAL);
    
  } catch (error) {
    console.error("[SW] Error processing timer chunks:", error);
  }
}

// Complete a job
async function completeJob(job: WaitJob) {
  console.log(`[SW] Completing job ${job.id}`);
  
  // Update job status
  job.status = "completed";
  await storeJob(job);
  
  // Notify all clients
  notifyClientsAboutJobCompletion(job);
  
  // Show notification
  await self.registration.showNotification("Job Complete", {
    body: job.description || `Job ${job.id} is complete!`,
    icon: "/vite.svg",
    requireInteraction: true
  });
}

// Notify clients about job status
export function notifyClientsAboutJobStatus(job: WaitJob) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: "JOB_STATUS_UPDATE",
        job: {
          id: job.id,
          endTime: job.endTime,
          createdAt: job.createdAt,
          description: job.description,
          status: job.status,
          remaining: job.endTime - Date.now()
        }
      });
    });
  });
}

// Notify clients about job completion
export function notifyClientsAboutJobCompletion(job: WaitJob) {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: "JOB_COMPLETED",
          job: {
            id: job.id,
            description: job.description
          }
        });
      });
    });
  }
  


