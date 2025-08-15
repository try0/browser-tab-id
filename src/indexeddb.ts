import type { BrowserTabIdOption } from "./types";

/**
 * IndexedDBからユニークな数字を生成します。
 * 
 * @returns 
 */
export async function incrementCycleCounter(option: BrowserTabIdOption): Promise<string> {

    const maxCount = Math.min(10000000, Math.pow(10, option.cycleCounterDigits));

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(option.indexedDBName, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains("ids")) {
                db.createObjectStore("ids", { keyPath: "id", autoIncrement: true });
            }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("ids", "readwrite");
            const store = tx.objectStore("ids");
            // 空データを追加してautoIncrement値を得る
            const addReq = store.add({});
            addReq.onsuccess = () => {
                // addReq.resultがautoIncrementされた数値
                const autoId = addReq.result as number;

                // 一定件数ごとにクリア
                let modAutoId = autoId % maxCount;
                if (modAutoId === 0) {
                    if (maxCount * 10 > autoId) {
                        // autoIncrementが大きくなりすぎないようにクリア
                        setTimeout(() => {
                            resetAutoIncrement(option);
                        }, 0);
                    } else {
                        // データベースが大きくなりすぎた場合はクリア
                        setTimeout(() => {
                            clearIndexedDB(option);
                        }, 0);
                    }
                }

                resolve(modAutoId.toString());
                db.close();
            };
            addReq.onerror = () => {
                reject(addReq.error);
                db.close();
            };
        };
    });
}

/**
 * IndexedDBを非同期でクリアします
 */
async function clearIndexedDB(option: BrowserTabIdOption): Promise<void> {
    try {
        const request = indexedDB.open(option.indexedDBName, 1);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction("ids", "readwrite");
                const store = tx.objectStore("ids");

                const clearReq = store.clear();
                clearReq.onsuccess = () => {
                    db.close();
                    resolve();
                };
                clearReq.onerror = () => {
                    db.close();
                    reject(clearReq.error);
                };
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.warn("Failed to clear IndexedDB:", error);
    }
}

async function resetAutoIncrement(option: BrowserTabIdOption): Promise<void> {
    return new Promise((resolve, reject) => {
        // 既存のデータベースを削除
        const deleteReq = indexedDB.deleteDatabase(option.indexedDBName);

        deleteReq.onsuccess = () => {
            // 新しいデータベースを作成（autoIncrementは1から開始）
            const openReq = indexedDB.open(option.indexedDBName, 1);

            openReq.onupgradeneeded = () => {
                const db = openReq.result;
                if (!db.objectStoreNames.contains("ids")) {
                    db.createObjectStore("ids", { keyPath: "id", autoIncrement: true });
                }
            };

            openReq.onsuccess = () => {
                openReq.result.close();
                resolve();
            };

            openReq.onerror = () => reject(openReq.error);
        };

        deleteReq.onerror = () => reject(deleteReq.error);
    });
}