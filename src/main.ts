import type { BrowserTabIdOption, CheckLevel, GeneratedState, InitializeBrowserTabIdOption, MessageData } from "./types";

/**
 * 生成状況
 */
export let state: GeneratedState = "no-id";
/**
 * 重複チェックレベル
 */
export let checkLevel: CheckLevel = "no-check";

/**
 * 設定
 */
let option: BrowserTabIdOption = {
    tabIdStorageKey: "btid",
    randomDigitsSize: 5,
    channelName: "btid_channel",
    channelTimeout: 200,
    useIndexedDB: true,
    indexedDBName: "btid_db",
    cycleCounterSize: 2000,
};


// 他タブで生成されたIDを保持
const generatedOtherTabIds: Set<string> = new Set();


// iOSだとバックグラウンドタブとの通信うまくいかないかも
let channel: BroadcastChannel;

/**
 * BroadcastChannelを初期化します。
 */
function initializeChannel() {
    if (channel) {
        channel.close();
    }
    channel = new BroadcastChannel(option.channelName);
    channel.addEventListener("message", (event) => {
        if (event.data && typeof event.data === "object") {
            const { type, tabId } = event.data as MessageData;
            if (type === "notify-generated-id") {
                // 他タブで生成されたIDを保持
                if (tabId) {
                    generatedOtherTabIds.add(tabId);
                }
            }

            if (type === "request-generated-id") {
                // 生成されたIDを要求
                channel.postMessage({ type: "notify-generated-id", tabId: getTabId() });
            }
        }
    });
}



/**
 * タブIDを生成します。
 * 
 * @returns タブID
 */
async function generateTabId(): Promise<string> {
    // 時間ベースとランダム数値を組み合わせて生成
    const timestamp = Date.now().toString();
    let random = generateRandomNumber();
    let cycleNumber: string = "0";
    try {
        if (option.useIndexedDB) {
            // autoincrementを使用してユニークな数字を生成
            cycleNumber = await incrementCycleCounter();
        }
    } catch (e) {
        cycleNumber = "0";
    }
    let id = `${timestamp}_${random}_${cycleNumber.padStart(4, '0')}`;

    // 念のため同一オリジンの他タブIDとの重複チェック
    while (generatedOtherTabIds.has(id)) {
        random = generateRandomNumber();
        id = `${timestamp}_${random}_${cycleNumber.padStart(4, '0')}`;
    }

    return id;
};


/**
 * ランダム部分を生成します。
 * 
 * @returns 
 */
function generateRandomNumber(): string {
    const max = Math.pow(10, option.randomDigitsSize);
    return Math.floor(Math.random() * max).toString().padStart(option.randomDigitsSize, '0');
}

/**
 * IndexedDBからユニークな数字を生成します。
 * 
 * @returns 
 */
async function incrementCycleCounter(): Promise<string> {
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
                let modAutoId = autoId % option.cycleCounterSize;
                if (modAutoId === 0) {
                    if (Math.min(option.cycleCounterSize * 100, 10000000) > autoId) {
                        // autoIncrementが大きくなりすぎないようにクリア
                        setTimeout(() => {
                            resetAutoIncrement();
                        }, 0);
                    } else {
                        // データベースが大きくなりすぎた場合はクリア
                        setTimeout(() => {
                            clearIndexedDB();
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
async function clearIndexedDB(): Promise<void> {
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

async function resetAutoIncrement(): Promise<void> {
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

/**
 * 生成したIDを他タブへ通知します。
 * 
 * @param tabId 
 */
function notifyGeneratedId(tabId: string): void {
    channel.postMessage({ type: "notify-generated-id", tabId: tabId });
}

/**
 * セッションストレージへタブIDをセットします。
 * 
 * @param tabId 
 */
function setTabId(tabId: string): void {
    notifyGeneratedId(tabId);
    window.sessionStorage.setItem(option.tabIdStorageKey, tabId);
}

/**
 * セッションストレージからタブIDを取得します。
 * 
 * @returns 
 */
export function getTabId(): string {
    return window.sessionStorage.getItem(option.tabIdStorageKey) || '';
}

/**
 * タブIDを初期化します。Promiseを返し、タブIDが生成されるまで待機してください。
 * 
 * @param initOption 
 * @returns 
 */
export async function initialize(initOption: InitializeBrowserTabIdOption | null = null): Promise<string | null> {
    // 設定初期化
    option = { ...option, ...initOption };
    if (option.cycleCounterSize > 9999) {
        option.cycleCounterSize = 9999;
        console.log("cycleCounterSize is too large, set to 9999");
    }
    initializeChannel();

    // タブIDがすでに存在するか確認
    checkLevel = "session-storage";
    let tabId: string | null = window.sessionStorage.getItem(option.tabIdStorageKey);
    if (!tabId) {
        // 保持していない場合生成
        state = "new-id";
        tabId = await generateTabId();
        setTabId(tabId);
        return Promise.resolve(tabId);
    }


    checkLevel = "opener-session-storage";
    if (window && window.opener && window.opener.sessionStorage) {
        // openerが存在する場合、直接取得を試みる
        try {
            const fromTabId: string | null = window.opener.sessionStorage.getItem(option.tabIdStorageKey);
            if (fromTabId) {
                if (fromTabId === tabId) {
                    // sessionStorage内のデータが複製されているため生成
                    state = "new-id"
                    tabId = await generateTabId();
                    setTabId(tabId);
                    return Promise.resolve(tabId);
                }
            }
        } catch (ignore) {
            // openerのsessionStorageにアクセスできない場合は、エラーを無視して次の処理へ
        }
    }

    // ページのリロードやタブを複製した場合、openerがないので収集
    checkLevel = "broadcast-channel";
    return new Promise((resolve) => {
        // 再度同一オリジンの別タブへIDを要求
        channel.postMessage({ type: 'request-generated-id' });
        setTimeout(async () => {
            // タイムアウト後にチェック
            if (tabId && !generatedOtherTabIds.has(tabId)) {
                // 重複なし
                state = "session-storage-id";
                resolve(tabId)
            } else {
                // 別タブと重複
                state = "new-id";
                tabId = await generateTabId();
                setTabId(tabId);
                resolve(tabId);
            }

        }, option.channelTimeout);
    });
}
