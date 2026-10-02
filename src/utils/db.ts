import { get, update } from 'idb-keyval';
import type { EncryptedPayload } from './crypto';

export interface OfflineReport {
  id: string; // Unique ID for local tracking
  timestamp: number;
  retries: number;
  nextRetry: number;
  payload: {
    longitude: number;
    latitude: number;
    encryptedPayload: EncryptedPayload;
    confidence_score: number;
    user_category: string;
    tags?: string[];
    isEmergency?: boolean;
    dHash?: string;
  };
}

const STORE_KEY = 'raksha_offline_reports';

/**
 * Saves a report to IndexedDB when the user is offline.
 */
export async function saveOfflineReport(payload: OfflineReport['payload']): Promise<string> {
  const id = `report_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const report: OfflineReport = {
    id,
    timestamp: Date.now(),
    retries: 0,
    nextRetry: Date.now(),
    payload
  };

  await update(STORE_KEY, (val) => {
    const reports = (val as OfflineReport[]) || [];
    return [...reports, report];
  });

  return id;
}

/**
 * Retrieves all offline reports.
 */
export async function getOfflineReports(): Promise<OfflineReport[]> {
  const reports = await get<OfflineReport[]>(STORE_KEY);
  return reports || [];
}

/**
 * Removes a successfully synced report from IndexedDB.
 */
export async function removeOfflineReport(id: string): Promise<void> {
  await update(STORE_KEY, (val) => {
    const reports = (val as OfflineReport[]) || [];
    return reports.filter(r => r.id !== id);
  });
}

/**
 * Updates a report (usually to increment retries)
 */
export async function updateOfflineReport(report: OfflineReport): Promise<void> {
  await update(STORE_KEY, (val) => {
    const reports = (val as OfflineReport[]) || [];
    return reports.map(r => r.id === report.id ? report : r);
  });
}

/**
 * Flushes the queue: tries to sync all pending reports to the backend.
 */
export async function syncOfflineReports(): Promise<{ total: number, successful: number, failed: number }> {
  const reports = await getOfflineReports();
  if (reports.length === 0) {
    return { total: 0, successful: 0, failed: 0 };
  }

  const now = Date.now();
  let successful = 0;
  let failed = 0;

  for (const report of reports) {
    if (now < (report.nextRetry || 0)) {
      continue; // Skip, not ready to retry yet
    }
    
    if (report.retries > 5) {
      console.warn(`[Sync] Dropping report ${report.id} after 5 failed attempts.`);
      await removeOfflineReport(report.id);
      continue;
    }

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': report.id // Prevent duplicate inserts
        },
        body: JSON.stringify(report.payload),
      });

      if (response.ok) {
        await removeOfflineReport(report.id);
        successful++;
      } else {
        const errorText = await response.text();
        console.error(`[Sync] Backend rejected report ${report.id}:`, errorText);
        
        // 4xx errors usually mean bad request, shouldn't retry
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          await removeOfflineReport(report.id);
        } else {
          // 5xx errors or 429: exponential backoff
          report.retries = (report.retries || 0) + 1;
          report.nextRetry = now + Math.pow(2, report.retries) * 1000 * 60; // 2m, 4m, 8m, etc.
          await updateOfflineReport(report);
        }
        failed++;
      }
    } catch (err) {
      console.error(`[Sync] Network error syncing report ${report.id}:`, err);
      report.retries = (report.retries || 0) + 1;
      report.nextRetry = now + Math.pow(2, report.retries) * 1000 * 60;
      await updateOfflineReport(report);
      failed++;
    }
  }

  return { total: reports.length, successful, failed };
}
