import type { BrowserTabIdOption } from "./types";
import { createLogger } from "./log";
import { LockManagerFactory } from "./lock";
const logger = createLogger();

/**
 * オブジェクトストア名
 */
const OBJECT_STORE_NAME = "ids";
/**
 * データベースバージョン
 */
const DB_VERSION = 1;

/**
 * IndexedDBを開きます。
 * 
 * @param option 
 * @returns 
 */
function openDatabase(option: BrowserTabIdOption): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(option.indexedDBName, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
                db.createObjectStore(OBJECT_STORE_NAME, { keyPath: "id", autoIncrement: true });
            }
        };

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

/**
 * トランザクションとオブジェクトストアを取得します。
 * 
 * @param db 
 * @param mode 
 * @returns 
 */
function getObjectStore(db: IDBDatabase, mode: IDBTransactionMode = "readonly"): IDBObjectStore {
    const transaction = db.transaction(OBJECT_STORE_NAME, mode);
    return transaction.objectStore(OBJECT_STORE_NAME);
}

/**
 * IndexedDBからユニークな数字を生成します。
 * option.cycleCounterDigits桁数のリングカウンターです。
 * 
 * @param option 
 * @returns 
 */
export async function incrementCycleCounter(option: BrowserTabIdOption): Promise<number> {
    const maxCount = Math.min(10000000, Math.pow(10, option.cycleCounterDigits));
    const lockName = `btid_counter_${option.indexedDBName}`;
    const lockManager = LockManagerFactory.getInstance();

    return lockManager.withLock(lockName, async () => {


        return new Promise<number>(async (resolve, reject) => {
            try {
                const db = await openDatabase(option);
                const store = getObjectStore(db, "readwrite");

                // 空データを追加してautoIncrement値を得る
                const addReq = store.add({
                    timestamp: Date.now(),
                    lockAcquired: true
                });

                addReq.onsuccess = () => {
                    // addReq.resultがautoIncrementされた数値
                    const autoId = addReq.result as number;

                    // 一定件数ごとにクリア
                    let modAutoId = autoId % maxCount;
                    if (modAutoId === 0) {
                        setTimeout(() => {
                            clearIndexedDB(option);
                        }, 0);
                    }

                    if (option.debugLog) {
                        logger.debug(`Generated unique ID: ${modAutoId} (raw: ${autoId})`);
                    }

                    resolve(modAutoId);
                    db.close();
                };

                addReq.onerror = () => {
                    reject(addReq.error);
                    db.close();
                };
            } catch (error) {
                reject(error);
            }
        });
    }, { timeout: 10000 });
}

/**
 * IndexedDBを非同期でクリアします。
 * 
 * @param option 
 * @returns 
 */
async function clearIndexedDB(option: BrowserTabIdOption): Promise<void> {
    const lockName = `btid_clear_${option.indexedDBName}`;
    const lockManager = LockManagerFactory.getInstance();

    return lockManager.withLock(lockName, async () => {
        try {
            const db = await openDatabase(option);
            const store = getObjectStore(db, "readwrite");

            return new Promise<void>((resolve, reject) => {
                const clearReq = store.clear();

                clearReq.onsuccess = () => {
                    if (option.debugLog) {
                        logger.debug('IndexedDB cleared');
                    }
                    db.close();
                    resolve();
                };

                clearReq.onerror = () => {
                    db.close();
                    reject(clearReq.error);
                };
            });
        } catch (error) {
            logger.warn(`Failed to clear IndexedDB:`, error);
            throw error;
        }
    }, { timeout: 5000 });
}
