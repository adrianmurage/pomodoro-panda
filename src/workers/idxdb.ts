const DB_NAME = "worker-bee-jobs";
const DB_VERSION = 1;
const JOBS_STORE = "waiting-jobs";

export interface WaitJob {
  id: string;
  endTime: number;
  createdAt: number;
  description?: string;
  status: "active" | "completed" | "cancelled";
}
  

// ====== IndexedDB Setup ======
// Initialize IndexedDB for job storage
export const initializeJobsDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create jobs object store if it doesn't exist
      if (!db.objectStoreNames.contains(JOBS_STORE)) {
        const jobsStore = db.createObjectStore(JOBS_STORE, { keyPath: "id" });
        jobsStore.createIndex("endTime", "endTime", { unique: false });
        jobsStore.createIndex("status", "status", { unique: false });
      }
    };

    request.onsuccess = () => {
      console.log("[SW] Jobs database initialized successfully");
      resolve();
    };

    request.onerror = (event) => {
      console.error(
        "[SW] Error initializing jobs database:",
        (event.target as IDBOpenDBRequest).error
      );
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// Get database connection
export const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// Store job in database
export const storeJob = async (job: WaitJob): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOBS_STORE, "readwrite");
    const store = transaction.objectStore(JOBS_STORE);

    const request = store.put(job);

    request.onsuccess = () => {
      console.log(`[SW] Job ${job.id} stored successfully`);
      resolve();
    };

    request.onerror = (event) => {
      console.error("[SW] Error storing job:", (event.target as IDBRequest).error);
      reject((event.target as IDBRequest).error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
};

// Get all active jobs
export const getAllActiveJobs = async (): Promise<WaitJob[]> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOBS_STORE, "readonly");
    const store = transaction.objectStore(JOBS_STORE);
    const index = store.index("status");
    const request = index.getAll("active");

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBRequest).error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
};

// Get job by ID
export const getJobById = async (id: string): Promise<WaitJob | undefined> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOBS_STORE, "readonly");
    const store = transaction.objectStore(JOBS_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBRequest).error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
};

// Update job status
export const updateJobStatus = async (
  id: string,
  status: "active" | "completed" | "cancelled"
): Promise<void> => {
  const job = await getJobById(id);
  if (!job) {
    throw new Error(`Job with id ${id} not found`);
  }

  job.status = status;
  await storeJob(job);
};

// Delete job from database
export const deleteJob = async (id: string): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOBS_STORE, "readwrite");
    const store = transaction.objectStore(JOBS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (event) => {
      reject((event.target as IDBRequest).error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
};
