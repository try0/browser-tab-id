import type { BrowserTabIdOption } from "./types";

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

    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDatabase(option);
            const store = getObjectStore(db, "readwrite");
            
            // 空データを追加してautoIncrement値を得る
            const addReq = store.add({});
            
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
}

/**
 * IndexedDBを非同期でクリアします。
 * 
 * @param option 
 * @returns 
 */
async function clearIndexedDB(option: BrowserTabIdOption): Promise<void> {
    try {
        const db = await openDatabase(option);
        const store = getObjectStore(db, "readwrite");
        
        return new Promise((resolve, reject) => {
            const clearReq = store.clear();
            
            clearReq.onsuccess = () => {
                db.close();
                resolve();
            };
            
            clearReq.onerror = () => {
                db.close();
                reject(clearReq.error);
            };
        });
    } catch (error) {
        console.warn("Failed to clear IndexedDB:", error);
        throw error;
    }
}
