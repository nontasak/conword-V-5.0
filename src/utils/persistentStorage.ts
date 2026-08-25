/**
 * Persistent Storage Engine (Client-side Only)
 * 
 * Provides robust, non-volatile offline storage across all devices & browsers:
 * - iPad / iPhone (Safari, Chrome, Edge)
 * - Mac / PC (Safari, Chrome, Edge, Firefox)
 * 
 * Features:
 * 1. Persistent Storage API (`navigator.storage.persist()`) prevents browser auto-eviction / 7-day WebKit purge.
 * 2. Multi-tier storage: IndexedDB (primary, high quota) + localStorage (mirror fallback).
 * 3. Rolling History Snapshots: Automatically records revision snapshots (keeps latest 50 versions).
 * 4. Safe Delete with Instant Recovery: Retains last deleted draft in a protected store.
 * 5. Lifecycle Flush: Saves instantly on `visibilitychange`, `pagehide`, and `beforeunload`.
 * 6. Blank State Protection: Prevents uninitialized React state from overwriting saved text.
 */

const DB_NAME = 'SpeechToTextAppDB';
const DB_VERSION = 1;
const STORE_KEY_VALUE = 'keyval';
const STORE_SNAPSHOTS = 'snapshots';
const STORE_BACKUPS = 'backups';

const USER_CLEARED_FLAG_KEY = 'speech_app_user_cleared_state';
const EMERGENCY_BACKUP_KEY = 'speech_app_emergency_backup';
const DATA_LOSS_ACKNOWLEDGED_KEY = 'speech_app_data_loss_ack_ts';

export interface TextSnapshot {
  id: number; // timestamp
  timestamp: string; // ISO string
  thaiTime: string; // formatted Thai time
  length: number;
  wordCount: number;
  preview: string;
  text: string;
}

export interface UserClearedState {
  isCleared: boolean;
  timestamp: number;
  clearedAtThai?: string;
  clearedLength?: number;
}

export interface EmergencyBackupRecord {
  key?: string;
  text: string;
  timestamp: number;
  thaiTime: string;
  length: number;
  wordCount: number;
  source?: string;
}

// Open IndexedDB instance
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_KEY_VALUE)) {
        db.createObjectStore(STORE_KEY_VALUE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        const snapshotStore = db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
        snapshotStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_BACKUPS)) {
        db.createObjectStore(STORE_BACKUPS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Request the browser to mark this site's storage as persistent.
 * On Safari (iOS 15.2+) and Chrome/Edge, this prevents automatic cache eviction.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const granted = await navigator.storage.persist();
        console.log(`[StorageEngine] Persistent storage granted: ${granted}`);
        return granted;
      }
      return true;
    } catch (e) {
      console.warn('[StorageEngine] Error requesting persistent storage', e);
    }
  }
  return false;
}

/**
 * Set a key-value pair in both IndexedDB and localStorage (Dual-mirror)
 */
export async function setItem(key: string, value: string): Promise<void> {
  // 1. Mirror to localStorage synchronously
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`[StorageEngine] localStorage setItem failed for ${key}`, e);
  }

  // 2. Save to IndexedDB
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_KEY_VALUE, 'readwrite');
      const store = tx.objectStore(STORE_KEY_VALUE);
      const req = store.put({ key, value, updatedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn(`[StorageEngine] IndexedDB setItem failed for ${key}`, e);
  }
}

/**
 * Get a key-value pair from IndexedDB (with fallback to localStorage)
 */
export async function getItem(key: string): Promise<string | null> {
  let localValue: string | null = null;
  try {
    localValue = localStorage.getItem(key);
  } catch (e) {
    console.warn(`[StorageEngine] localStorage getItem failed for ${key}`, e);
  }

  try {
    const db = await openDB();
    const idbValue = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_KEY_VALUE, 'readonly');
      const store = tx.objectStore(STORE_KEY_VALUE);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && typeof req.result.value === 'string') {
          resolve(req.result.value);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });

    // If IndexedDB has value, use it; otherwise fallback to localStorage
    if (idbValue !== null) {
      // Sync back to localStorage if localStorage was empty
      if (localValue === null && idbValue.length > 0) {
        try {
          localStorage.setItem(key, idbValue);
        } catch (_) {}
      }
      return idbValue;
    }
  } catch (e) {
    console.warn(`[StorageEngine] IndexedDB getItem failed for ${key}`, e);
  }

  return localValue;
}

/**
 * Save a revision snapshot of the text
 */
export async function saveTextSnapshot(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 5) return;

  const now = new Date();
  const thaiTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    ' ' + now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  
  const preview = trimmed.substring(0, 120).replace(/\s+/g, ' ') + (trimmed.length > 120 ? '...' : '');
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  const snapshot: TextSnapshot = {
    id: Date.now(),
    timestamp: now.toISOString(),
    thaiTime,
    length: text.length,
    wordCount,
    preview,
    text,
  };

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
    const store = tx.objectStore(STORE_SNAPSHOTS);
    
    // Add new snapshot
    store.put(snapshot);

    // Limit to latest 50 snapshots
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result > 50) {
        const cursorReq = store.openCursor(); // iterates from oldest id
        let toDelete = countReq.result - 50;
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor && toDelete > 0) {
            cursor.delete();
            toDelete--;
            cursor.continue();
          }
        };
      }
    };
  } catch (e) {
    console.warn('[StorageEngine] Error saving snapshot', e);
  }
}

/**
 * Get all available snapshots (newest first)
 */
export async function getAllSnapshots(): Promise<TextSnapshot[]> {
  try {
    const db = await openDB();
    return new Promise<TextSnapshot[]>((resolve) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as TextSnapshot[];
        // Sort descending by id (timestamp)
        list.sort((a, b) => b.id - a.id);
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    console.warn('[StorageEngine] Error getting snapshots', e);
    return [];
  }
}

/**
 * Delete a specific snapshot
 */
export async function deleteSnapshot(id: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
    tx.objectStore(STORE_SNAPSHOTS).delete(id);
  } catch (e) {
    console.warn('[StorageEngine] Error deleting snapshot', e);
  }
}

/**
 * Clear all history snapshots
 */
export async function clearAllSnapshots(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
    tx.objectStore(STORE_SNAPSHOTS).clear();
  } catch (e) {
    console.warn('[StorageEngine] Error clearing snapshots', e);
  }
}

/**
 * Backup the text before clearing (Trash / Recovery Buffer)
 */
export async function saveLastDeletedText(text: string): Promise<void> {
  if (!text || text.trim() === '') return;
  
  const now = new Date();
  const thaiTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) +
    ' (' + now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ')';

  const backupData = {
    key: 'last_deleted_text',
    text,
    deletedAt: thaiTime,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem('last_deleted_text', JSON.stringify(backupData));
  } catch (_) {}

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_BACKUPS, 'readwrite');
    tx.objectStore(STORE_BACKUPS).put(backupData);
  } catch (_) {}
}

/**
 * Retrieve the last deleted text
 */
export async function getLastDeletedText(): Promise<{ text: string; deletedAt: string } | null> {
  try {
    const local = localStorage.getItem('last_deleted_text');
    if (local) {
      return JSON.parse(local);
    }
  } catch (_) {}

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_BACKUPS, 'readonly');
      const store = tx.objectStore(STORE_BACKUPS);
      const req = store.get('last_deleted_text');
      req.onsuccess = () => {
        if (req.result && req.result.text) {
          resolve({ text: req.result.text, deletedAt: req.result.deletedAt || '' });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (_) {
    return null;
  }
}

/**
 * Set the User Action Clear state flag.
 * Whenever the user intentionally clears text, we record isCleared: true.
 * When the user writes new text or restores content, we set isCleared: false.
 */
export async function setUserClearedState(isCleared: boolean, clearedText: string = ''): Promise<void> {
  const now = new Date();
  const thaiTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    ' (' + now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) + ')';

  const state: UserClearedState = {
    isCleared,
    timestamp: Date.now(),
    clearedAtThai: thaiTime,
    clearedLength: clearedText.length,
  };

  try {
    localStorage.setItem(USER_CLEARED_FLAG_KEY, JSON.stringify(state));
  } catch (_) {}

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_BACKUPS, 'readwrite');
    tx.objectStore(STORE_BACKUPS).put({ key: USER_CLEARED_FLAG_KEY, ...state });
  } catch (_) {}
}

/**
 * Get the User Action Clear state
 */
export async function getUserClearedState(): Promise<UserClearedState | null> {
  try {
    const local = localStorage.getItem(USER_CLEARED_FLAG_KEY);
    if (local) {
      return JSON.parse(local);
    }
  } catch (_) {}

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_BACKUPS, 'readonly');
      const store = tx.objectStore(STORE_BACKUPS);
      const req = store.get(USER_CLEARED_FLAG_KEY);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (_) {
    return null;
  }
}

/**
 * Save an Emergency Memory/Storage Backup instantly
 * (Invoked on visibilitychange, beforeunload, pagehide, and regular text updates)
 */
export async function saveEmergencyBackup(text: string, source = 'lifecycle_flush'): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length === 0) return;

  const now = new Date();
  const thaiTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    ' ' + now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  const backupData: EmergencyBackupRecord = {
    key: EMERGENCY_BACKUP_KEY,
    text,
    timestamp: Date.now(),
    thaiTime,
    length: text.length,
    wordCount,
    source,
  };

  // Synchronous localStorage write
  try {
    localStorage.setItem(EMERGENCY_BACKUP_KEY, JSON.stringify(backupData));
  } catch (e) {
    console.warn('[StorageEngine] Failed to write emergency backup to localStorage', e);
  }

  // Asynchronous IndexedDB write
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_BACKUPS, 'readwrite');
    tx.objectStore(STORE_BACKUPS).put(backupData);
  } catch (e) {
    console.warn('[StorageEngine] Failed to write emergency backup to IndexedDB', e);
  }
}

/**
 * Retrieve the latest emergency backup
 */
export async function getEmergencyBackup(): Promise<EmergencyBackupRecord | null> {
  try {
    const local = localStorage.getItem(EMERGENCY_BACKUP_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && parsed.text) return parsed;
    }
  } catch (_) {}

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_BACKUPS, 'readonly');
      const store = tx.objectStore(STORE_BACKUPS);
      const req = store.get(EMERGENCY_BACKUP_KEY);
      req.onsuccess = () => {
        if (req.result && req.result.text) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (_) {
    return null;
  }
}

/**
 * Check if post-eviction data loss occurred:
 * Condition:
 * 1. The currently loaded main text is empty or missing (or blank)
 * 2. There is an available backup (emergency backup or snapshot) with substantive text (> 20 chars)
 * 3. The user did NOT explicitly clear the text (userClearedState is not true, or backup is significantly newer)
 */
export async function checkPostEvictionDataLoss(
  currentLoadedText: string | null | undefined
): Promise<{ isEvicted: boolean; backupData: EmergencyBackupRecord | null }> {
  const isCurrentEmpty = !currentLoadedText || currentLoadedText.trim().length === 0;
  if (!isCurrentEmpty) {
    return { isEvicted: false, backupData: null };
  }

  try {
    // 1. Get user cleared status
    const userClearedState = await getUserClearedState();
    
    // 2. Get emergency backup
    let backupRecord = await getEmergencyBackup();

    // 3. If no emergency backup found, check latest snapshot from history
    if (!backupRecord || !backupRecord.text || backupRecord.text.trim().length === 0) {
      const snapshots = await getAllSnapshots();
      if (snapshots.length > 0 && snapshots[0].text && snapshots[0].text.trim().length > 0) {
        const snap = snapshots[0];
        backupRecord = {
          text: snap.text,
          timestamp: snap.id,
          thaiTime: snap.thaiTime,
          length: snap.length,
          wordCount: snap.wordCount,
          source: 'snapshot_store'
        };
      }
    }

    // 4. If still no backup or backup is too small, no eviction loss
    if (!backupRecord || !backupRecord.text || backupRecord.text.trim().length < 5) {
      return { isEvicted: false, backupData: null };
    }

    // 5. Check if user deliberately cleared it
    if (userClearedState && userClearedState.isCleared) {
      // If user cleared it AFTER the backup was created, then it was intentional
      if (userClearedState.timestamp >= backupRecord.timestamp - 2000) {
        return { isEvicted: false, backupData: null };
      }
    }

    // 6. Check if user already acknowledged and dismissed this specific data loss recovery
    const lastAckTs = localStorage.getItem(DATA_LOSS_ACKNOWLEDGED_KEY);
    if (lastAckTs && parseInt(lastAckTs, 10) >= backupRecord.timestamp) {
      return { isEvicted: false, backupData: null };
    }

    // All conditions met: data became empty without user intention, and backup is available
    return { isEvicted: true, backupData: backupRecord };
  } catch (e) {
    console.warn('[StorageEngine] Error checking post-eviction data loss', e);
    return { isEvicted: false, backupData: null };
  }
}

/**
 * Mark that the user has either restored, downloaded, or dismissed this data loss alert
 */
export function markDataLossResolved(backupTimestamp?: number): void {
  try {
    const ts = backupTimestamp || Date.now();
    localStorage.setItem(DATA_LOSS_ACKNOWLEDGED_KEY, ts.toString());
  } catch (_) {}
}

/**
 * Clear current active text (when user clicks Clear / ล้างข้อความ)
 */
export async function clearActiveText(currentText: string): Promise<void> {
  // 1. Record explicit user clear action
  await setUserClearedState(true, currentText);

  // 2. First, safely archive to last_deleted_text in case it was a mistake
  if (currentText && currentText.trim().length > 0) {
    await saveLastDeletedText(currentText);
    await saveTextSnapshot(currentText);
  }

  // 3. Clear main key in both storages
  try {
    localStorage.removeItem('savedText');
  } catch (_) {}

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_KEY_VALUE, 'readwrite');
    tx.objectStore(STORE_KEY_VALUE).delete('savedText');
  } catch (_) {}
}

