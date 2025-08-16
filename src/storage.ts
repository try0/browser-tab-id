import type { InternalBrowserTabIdOption } from "./types";
import { createLogger } from "./log";
import { LockManagerFactory } from "./lock";
const logger = createLogger();

/**
 * Ring Counterの抽象インターフェース
 */
interface IRingCounter {
    increment(): Promise<number>;
    cleanup(): Promise<void>;
}

/**
 * IndexedDB実装のRing Counter
 */
class IndexedDBRingCounter implements IRingCounter {
    private static readonly OBJECT_STORE_NAME = "ids";
    private static readonly DB_VERSION = 1;

    private option: InternalBrowserTabIdOption;
    constructor(option: InternalBrowserTabIdOption) {
        this.option = option;
    }

    private async openDatabase(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.option.storeName, IndexedDBRingCounter.DB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(IndexedDBRingCounter.OBJECT_STORE_NAME)) {
                    db.createObjectStore(IndexedDBRingCounter.OBJECT_STORE_NAME, { keyPath: "id", autoIncrement: true });
                }
            };

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    private getObjectStore(db: IDBDatabase, mode: IDBTransactionMode = "readonly"): IDBObjectStore {
        const transaction = db.transaction(IndexedDBRingCounter.OBJECT_STORE_NAME, mode);
        return transaction.objectStore(IndexedDBRingCounter.OBJECT_STORE_NAME);
    }

    async increment(): Promise<number> {
        const maxCount = Math.min(10000000, Math.pow(10, this.option.cycleCounterDigits));
        const lockName = `${this.option.storeName}_increment_lock`;
        const lockManager = LockManagerFactory.getInstance();

        return lockManager.withLock(lockName, async () => {
            return new Promise<number>(async (resolve, reject) => {
                try {
                    const db = await this.openDatabase();
                    const store = this.getObjectStore(db, "readwrite");

                    // 空データを追加してautoIncrement値を得る
                    const addReq = store.add({
                        timestamp: Date.now(),
                        lockAcquired: true
                    });

                    addReq.onsuccess = () => {
                        const autoId = addReq.result as number;
                        let modAutoId = autoId % maxCount;
                        
                        if (modAutoId === 0) {
                            setTimeout(() => {
                                this.cleanup();
                            }, 0);
                        }

                        if (this.option.debugLog) {
                            logger.debug(`IndexedDB generated unique ID: ${modAutoId} (raw: ${autoId})`);
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

    async cleanup(): Promise<void> {
        const lockName = `${this.option.storeName}_clear_lock`;
        const lockManager = LockManagerFactory.getInstance();

        return lockManager.withLock(lockName, async () => {
            try {
                const db = await this.openDatabase();
                const store = this.getObjectStore(db, "readwrite");

                return new Promise<void>((resolve, reject) => {
                    const clearReq = store.clear();

                    clearReq.onsuccess = () => {
                        if (this.option.debugLog) {
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
}

/**
 * localStorage実装のRing Counter
 */
class LocalStorageRingCounter implements IRingCounter {
    private readonly counterKey: string;
    private readonly timestampKey: string;

    private option: InternalBrowserTabIdOption;

    constructor(option: InternalBrowserTabIdOption) {
        this.option = option;
        this.counterKey = `${option.storeName}_counter`;
        this.timestampKey = `${option.storeName}_counter_ts`;
    }

    async increment(): Promise<number> {
        const maxCount = Math.min(10000000, Math.pow(10, this.option.cycleCounterDigits));
        
        // 簡単な排他制御（完全ではないが、localStorage用の軽量実装）
        const lockKey = `${this.counterKey}_lock`;
        const lockTimeout = 1000;
        const lockStart = Date.now();
        
        while (localStorage.getItem(lockKey)) {
            if (Date.now() - lockStart > lockTimeout) {
                break; // タイムアウト
            }
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        try {
            localStorage.setItem(lockKey, "1");
            
            let counter = parseInt(localStorage.getItem(this.counterKey) || "0", 10);
            counter = (counter + 1) % maxCount;
            
            localStorage.setItem(this.counterKey, counter.toString());
            localStorage.setItem(this.timestampKey, Date.now().toString());
            
            // 定期的にクリーンアップ（カウンターが0に戻った時）
            if (counter === 0) {
                setTimeout(() => {
                    this.cleanup();
                }, 0);
            }

            if (this.option.debugLog) {
                logger.debug(`localStorage generated unique ID: ${counter}`);
            }

            return counter;
        } finally {
            localStorage.removeItem(lockKey);
        }
    }

    async cleanup(): Promise<void> {
        try {
            // localStorage版では特別なクリーンアップは不要
            // カウンターは既にリングしているため
            if (this.option.debugLog) {
                logger.debug('localStorage counter reset to ring');
            }
        } catch (error) {
            logger.warn(`Failed to cleanup localStorage counter:`, error);
        }
    }
}

/**
 * Ring Counter Factory
 */
class RingCounterFactory {
    static createRingCounter(option: InternalBrowserTabIdOption): IRingCounter {
        if (option.cycleCounterType === 'indexed-db') {
            try {
                if (typeof indexedDB !== 'undefined') {
                    return new IndexedDBRingCounter(option);
                }
            } catch (error) {
                logger.warn('IndexedDB not available, falling back to localStorage:', error);
            }
        }
        
        // フォールバックまたは明示的にlocalStorage使用
        return new LocalStorageRingCounter(option);
    }
}

/**
 * ユニークな数字を生成します（統一インターフェース）
 */
export async function incrementCycleCounter(option: InternalBrowserTabIdOption): Promise<number> {
    const ringCounter = RingCounterFactory.createRingCounter(option);
    return ringCounter.increment();
}

/**
 * ストレージをクリーンアップします
 */
export async function cleanupStorage(option: InternalBrowserTabIdOption): Promise<void> {
    const ringCounter = RingCounterFactory.createRingCounter(option);
    return ringCounter.cleanup();
}