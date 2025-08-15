import { incrementCycleCounter } from "./indexeddb";
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
    randomDigits: 8,
    channelName: "btid_channel",
    channelTimeout: 500,
    useIndexedDB: true,
    indexedDBName: "btid_db",
    cycleCounterDigits: 4,
};


// iOSだとバックグラウンドタブとの通信うまくいかないかも
let channel: BroadcastChannel | null = null;

/**
 * BroadcastChannelを初期化します。
 */
function initializeChannel() {
    if (channel) {
        channel.close();
        channel = null;
        window.removeEventListener("beforeunload", closeChannel);
    }
    channel = new BroadcastChannel(option.channelName);
    channel.addEventListener("message", (event) => {
        if (event.data && typeof event.data === "object") {
            const { type, tabId, requestId } = event.data as MessageData;
            if (type === "check-duplicate") {
                // 他タブから重複チェック要求を受信
                const myTabId = getTabId();
                if (myTabId && myTabId === tabId) {
                    // 重複が発見された場合のみ応答
                    channel!.postMessage({
                        type: "found-duplicate",
                        tabId: myTabId,
                        requestId: requestId
                    });
                }
            }
        }
    });
    window.addEventListener("beforeunload", closeChannel);
}

/**
 * BroadcastChannelを閉じます。
 */
function closeChannel() {
    if (channel) {
        channel.close();
        channel = null;
    }
}


/**
 * タブIDを生成します。
 * 
 * @returns タブID
 */
async function generateTabId(): Promise<string> {
    // 時間ベースとランダム数値を組み合わせて生成
    const timestamp = Date.now().toString();
    let cycleNumber: string = "0";
    try {
        if (option.useIndexedDB) {
            // autoincrementを使用してユニークな数字を生成
            cycleNumber = await incrementCycleCounter(option);
        }
    } catch (e) {
        cycleNumber = "0";
    }

    const random = generateRandomNumber();
    let id = timestamp;
    if (option.randomDigits > 0) {
        id += `_${random}`;
    }
    if (option.cycleCounterDigits > 0) {
        id += `_${cycleNumber.padStart(option.cycleCounterDigits, '0')}`;
    }

    return id;
};


/**
 * ランダム部分を生成します。
 * 
 * @returns 
 */
function generateRandomNumber(): string {
    const max = Math.pow(10, option.randomDigits);
    try {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        const randomValue = array[0] % max;

        return randomValue.toString().padStart(option.randomDigits, '0');
    } catch (e) {
        return Math.floor(Math.random() * max).toString().padStart(option.randomDigits, '0');
    }
}

/**
 * セッションストレージへタブIDをセットします。
 * 
 * @param tabId 
 */
function setTabId(tabId: string): void {
    window.sessionStorage.setItem(option.tabIdStorageKey, tabId);
}

/**
 * 他タブとの重複をチェックします
 * 
 * @param tabId チェックするタブID
 * @returns 重複がある場合true
 */
async function checkDuplicateWithOtherTabs(tabId: string): Promise<boolean> {
    return new Promise((resolve) => {
        const requestId = Date.now().toString() + Math.random().toString(36);

        // 重複応答を受信するリスナー
        const duplicateListener = (event: MessageEvent) => {
            if (event.data && typeof event.data === "object") {
                const { type, requestId: responseRequestId } = event.data as MessageData;
                if (type === "found-duplicate" && responseRequestId === requestId) {
                    resolve(true);
                }
            }
        };

        channel!.addEventListener("message", duplicateListener);

        // 他タブに重複チェックを要求
        channel!.postMessage({
            type: "check-duplicate",
            tabId: tabId,
            requestId: requestId
        });

        setTimeout(() => {
            channel!.removeEventListener("message", duplicateListener);
            resolve(false);
        }, option.channelTimeout);
    });
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
export async function initialize(initOption: InitializeBrowserTabIdOption | null = null): Promise<string> {
    // 設定初期化
    option = { ...option, ...initOption };

    initializeChannel();

    // タブIDがすでに存在するか確認
    checkLevel = "session-storage";
    let tabId: string | null = window.sessionStorage.getItem(option.tabIdStorageKey);
    if (!tabId) {
        // 保持していない場合生成
        state = "new-id";
        tabId = await generateTabId();
        setTabId(tabId);
        return tabId;
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
                    return tabId;
                }
            }
        } catch (ignore) {
            // openerのsessionStorageにアクセスできない場合は、エラーを無視して次の処理へ
        }
    }

    // ページのリロードやタブを複製した場合、openerがないので収集
    checkLevel = "broadcast-channel";
    // 他タブとの重複チェック
    const isDuplicate = await checkDuplicateWithOtherTabs(tabId);

    if (!isDuplicate) {
        // 重複なし
        state = "session-storage-id";
        return tabId;
    } else {
        // 別タブと重複
        state = "new-id";
        tabId = await generateTabId();
        setTabId(tabId);
        return tabId;
    }
}

