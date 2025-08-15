import { BroadcastChannelTransport, LocalStorageTransport, TransportRacer } from "./channel";
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
    channelTimeout: 600,
    enableLocalStorageTransport: true,
    useIndexedDB: true,
    indexedDBName: "btid_db",
    cycleCounterDigits: 4,
};


let transportRacer: TransportRacer | null = null;

/**
 * 他タブとの重複をチェックします（統一インターフェース使用）
 */
async function checkDuplicateWithOtherTabs(tabId: string): Promise<boolean> {
    return new Promise((resolve) => {
        const requestId = Date.now().toString() + Math.random().toString(36);
        let duplicateFound = false;
        let resolved = false;
        let responseCount = 0;
        const maxRetries = 3;
        const retryInterval = 100;

        const resolveOnce = (found: boolean, transportName: string) => {
            if (!resolved) {
                resolved = true;
                console.log(`Duplicate check resolved by ${transportName}: found=${found}, responses=${responseCount}`);
                resolve(found);
            }
        };

        // 重複応答リスナー
        const messageHandler = (message: MessageData, transport: any) => {
            if (message.type === "found-duplicate" && message.requestId === requestId) {
                duplicateFound = true;
                responseCount++;
                resolveOnce(true, transport.name);
            }
        };

        transportRacer!.onMessage(messageHandler);

        // 複数回送信
        const sendDuplicateCheck = (attempt: number) => {
            if (attempt < maxRetries && !resolved) {
                const message: MessageData = {
                    type: "check-duplicate",
                    tabId: tabId,
                    requestId: requestId,
                };

                // 全トランスポートで送信
                transportRacer!.broadcast(message);

                setTimeout(() => {
                    sendDuplicateCheck(attempt + 1);
                }, retryInterval);
            }
        };

        sendDuplicateCheck(0);

        // タイムアウト処理
        setTimeout(() => {
            transportRacer!.offMessage(messageHandler);
            resolveOnce(duplicateFound, "timeout");
        }, option.channelTimeout);
    });
}

/**
 * トランスポートを初期化します
 */
function initializeTransports() {
    if (transportRacer) {
        transportRacer.cleanup();
    }

    const transports = [];

    // BroadcastChannel トランスポートを追加
    try {
        transports.push(new BroadcastChannelTransport(option.channelName));
    } catch (error) {
        console.warn("BroadcastChannel not available:", error);
    }

    // localStorage トランスポートを追加
    if (option.enableLocalStorageTransport) {
        try {
            transports.push(new LocalStorageTransport("btid_msg"));
        } catch (error) {
            console.warn("localStorage transport not available:", error);
        }
    }

    transportRacer = new TransportRacer(transports);

    // 重複チェックメッセージのハンドラー
    transportRacer.onMessage((message, transport) => {
        if (message.type === "check-duplicate") {
            handleDuplicateCheckMessage(message, transport.name);
        }
    });

    console.log("Initialized transports:", transportRacer.getTransportNames());

    window.addEventListener("beforeunload", () => {
        transportRacer?.cleanup();
    });
}

/**
 * 重複チェックメッセージを処理します
 */
function handleDuplicateCheckMessage(message: MessageData, transportName: string) {
    const { tabId, requestId } = message;
    const myTabId = getTabId();

    if (myTabId && myTabId === tabId) {
        const response: MessageData = {
            type: "found-duplicate",
            tabId: myTabId,
            requestId: requestId,
        };

        // 全トランスポートで応答
        transportRacer!.broadcast(response);
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
    let cycleNumber: number = 0;
    try {
        if (option.useIndexedDB) {
            // autoincrementを使用してユニークな数字を生成
            cycleNumber = await incrementCycleCounter(option);
        }
    } catch (e) {
        console.warn("IndexedDB increment failed, using fallback:", e);
        cycleNumber = 0;
    }

    const random = generateRandomNumber();
    let id = timestamp;
    if (option.randomDigits > 0) {
        // ランダム部あり
        id += `_${random}`;
    }
    if (option.cycleCounterDigits > 0) {
        // リングカウンター部あり
        id += `_${cycleNumber.toString().padStart(option.cycleCounterDigits, '0')}`;
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
    // 設定値の検証
    if (option.randomDigits < 0 || option.randomDigits > 10) {
        throw new Error("randomDigits must be between 0 and 10");
    }
    if (option.cycleCounterDigits < 0 || option.cycleCounterDigits > 10) {
        throw new Error("cycleCounterDigits must be between 0 and 10");
    }

    initializeTransports();

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

