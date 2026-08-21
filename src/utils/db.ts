import { get, update } from 'idb-keyval';
import type { EncryptedPayload } from './crypto';

export interface OfflineReport {
  id: string; // Unique ID for local tracking
  timestamp: number;
  payload: {
    longitude: number;
    latitude: number;
    encryptedPayload: EncryptedPayload;
    confidence_score: number;
    user_category: string;
  };
}

const STORE_KEY = 'delhi_offline_reports';

/**
 * Saves a report to IndexedDB when the user is offline.
 */
export async function saveOfflineReport(payload: OfflineReport['payload']): Promise<string> {
  const id = `report_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const report: OfflineReport = {
    id,
    timestamp: Date.now(),
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
 * Flushes the queue: tries to sync all pending reports to the backend.
 */
export async function syncOfflineReports(): Promise<{ total: number, successful: number, failed: number }> {
  const reports = await getOfflineReports();
  if (reports.length === 0) {
    return { total: 0, successful: 0, failed: 0 };
  }

  let successful = 0;
  let failed = 0;

  for (const report of reports) {
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report.payload),
      });

      if (response.ok) {
        await removeOfflineReport(report.id);
        successful++;
      } else {
        console.error(`[Sync] Backend rejected report ${report.id}:`, await response.text());
        failed++;
      }
    } catch (err) {
      console.error(`[Sync] Network error syncing report ${report.id}:`, err);
      failed++;
    }
  }

  return { total: reports.length, successful, failed };
}
