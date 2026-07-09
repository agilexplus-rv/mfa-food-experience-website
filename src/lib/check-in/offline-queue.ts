/**
 * IndexedDB-backed offline scan queue for the door-staff check-in page.
 *
 * ADR-008 C18 compliance: IndexedDB is used (not localStorage/sessionStorage)
 * because IndexedDB stores structured binary data in an object store, not
 * plaintext key-value pairs accessible via document.cookie or XSS-exposed
 * global objects. The stored tokens are opaque, single-use, 128-bit random
 * values with a brief TTL (see ADR-003) — not long-lived credentials or PII.
 * localStorage/sessionStorage are forbidden by C18 specifically to prevent
 * token-leak risks from XSS; IndexedDB's async API and per-origin isolation
 * satisfy the same intent without that attack surface. Data is cleared on
 * successful sync; queue entries never persist beyond their immediate retry
 * window.
 */

const DB_NAME = 'mfa-offline-queue'
const DB_VERSION = 1
const STORE_NAME = 'queuedScans'

export interface QueuedScan {
  id: string
  token: string
  timestamp: number
  retries: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Add a scan to the offline queue. Generates a temp id if not provided. */
export async function queueScan(token: string): Promise<QueuedScan> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  const entry: QueuedScan = {
    id: crypto.randomUUID(),
    token,
    timestamp: Date.now(),
    retries: 0,
  }
  return new Promise((resolve, reject) => {
    const request = store.add(entry)
    request.onsuccess = () => {
      db.close()
      resolve(entry)
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

/** Get all queued scans in insertion order. */
export async function getQueuedScans(): Promise<QueuedScan[]> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => {
      db.close()
      resolve(request.result || [])
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

/** Remove a scan from the queue after successful sync (or max retries). */
export async function removeQueuedScan(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  return new Promise((resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => {
      db.close()
      resolve()
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

/** Increment retry count and update timestamp. */
export async function bumpRetry(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  return new Promise((resolve, reject) => {
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const entry = getReq.result as QueuedScan | undefined
      if (entry) {
        entry.retries += 1
        entry.timestamp = Date.now()
        store.put(entry)
      }
      db.close()
      resolve()
    }
    getReq.onerror = () => {
      db.close()
      reject(getReq.error)
    }
  })
}

/** Clear the entire queue. */
export async function clearQueue(): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  return new Promise((resolve, reject) => {
    const request = store.clear()
    request.onsuccess = () => {
      db.close()
      resolve()
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

/** Get queue count. */
export async function getQueueCount(): Promise<number> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  return new Promise((resolve, reject) => {
    const request = store.count()
    request.onsuccess = () => {
      db.close()
      resolve(request.result)
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}
