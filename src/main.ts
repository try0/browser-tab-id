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
    channelTimeout: 200
};

// 他タブで生成されたIDを保持
const generatedOtherTabIds: Set<string> = new Set();


// iOSだとバックグラウンドタブとの通信うまくいかないかも
const channel = new BroadcastChannel("btid_channel");
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
// 事前に１回要求しておく
channel.postMessage({ type: 'request-generated-id' });

/**
 * タブIDを生成します。
 * 
 * @returns タブID
 */
function generateTabId(): string {
    // 時間ベースとランダム数値を組み合わせて生成
    const newId = Date.now().toString();
    let random = generateRandomDigits();
    let id = newId + "_" + random;

    // 同一オリジンの他タブIDとの重複チェック
    while (generatedOtherTabIds.has(id)) {
        random = generateRandomDigits();
        id = newId + "_" + random;
    }
    return id;
};


/**
 * ランダム部分を生成します。
 * 
 * @returns 
 */
function generateRandomDigits(): string {
    const max = Math.pow(10, option.randomDigitsSize);
    return Math.floor(Math.random() * max).toString().padStart(option.randomDigitsSize, '0');
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
export function initialize(initOption: InitializeBrowserTabIdOption | null = null): Promise<string | null> {
    // 設定初期化
    option = { ...option, ...initOption };

    // タブIDがすでに存在するか確認
    checkLevel = "session-storage";
    let tabId: string | null = window.sessionStorage.getItem(option.tabIdStorageKey);
    if (!tabId) {
        // 保持していない場合生成
        state = "new-id";
        tabId = generateTabId();
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
                    tabId = generateTabId();
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
        setTimeout(() => {
            // タイムアウト後にチェック
            if (tabId && !generatedOtherTabIds.has(tabId)) {
                // 重複なし
                state = "session-storage-id";
                resolve(tabId)
            } else {
                // 別タブと重複
                state = "new-id";
                tabId = generateTabId();
                setTabId(tabId);
                resolve(tabId);
            }

        }, option.channelTimeout);
    });
}
