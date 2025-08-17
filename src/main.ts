import { BroadcastChannelTransport, LocalStorageTransport, TransportRacer } from "./channel";
import { incrementCycleCounter } from "./storage";
import type { CheckLevel, GeneratedState, InitializeBrowserTabIdOption, InternalBrowserTabIdOption, MessageData, TabIdStringSource } from "./types";
import { createLogger } from "./log";
const logger = createLogger();

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
let option: InternalBrowserTabIdOption = {
    tabIdKey: "btid",
    randomDigits: 8,
    duplicateCheckWaitTime: 600,
    cycleCounterDigits: 4,
    debugLog: false,
    channelName: "btid_channel",
    storeName: "btid_db",
    cycleCounterType: "indexed-db",
    channels: ['broadcast-channel', 'local-storage'],
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
                if (option.debugLog) {
                    logger.debug(`Duplicate check resolved by ${transportName}: found=${found}, responses=${responseCount}`);
                }
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
        }, option.duplicateCheckWaitTime);
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
        logger.warn(`BroadcastChannel not available:`, error);
    }

    // localStorage トランスポートを追加
    if (option.channels.includes("local-storage") || transports.length === 0) {
        try {
            transports.push(new LocalStorageTransport(option.channelName));
        } catch (error) {
            logger.warn(`localStorage transport not available:`, error);
        }
    }

    transportRacer = new TransportRacer(transports);

    // 重複チェックメッセージのハンドラー
    transportRacer.onMessage((message, transport) => {
        if (message.type === "check-duplicate") {
            handleDuplicateCheckMessage(message, transport.name);
        }
    });

    if (option.debugLog) {
        logger.debug(`Initialized transports:`, transportRacer.getTransportNames());
    }

    window.addEventListener("beforeunload", () => {
        transportRacer?.cleanup();
    });
}

/**
 * 重複チェックメッセージを処理します
 */
function handleDuplicateCheckMessage(message: MessageData, transportName: string) {
    const { tabId, requestId } = message;
    const myTabId = get();

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
    const idSource: TabIdStringSource = {
        timestampString: "",
        randomString: "",
        cycleCountString: ""
    };


    // 時間ベースとランダム数値を組み合わせて生成
    idSource.timestampString = Date.now().toString();

    let cycleNumber: number = 0;
    try {
        // autoincrementを使用してユニークな数字を生成
        cycleNumber = await incrementCycleCounter(option);
    } catch (e) {
        logger.warn(`IndexedDB increment failed, using fallback:`, e);
        cycleNumber = 0;
    }

    if (option.randomDigits > 0) {
        // ランダム部あり
        const random = generateRandomNumber();
        idSource.randomString = `${random}`;
    }

    if (option.cycleCounterDigits > 0) {
        // リングカウンター部あり
        idSource.cycleCountString = `${cycleNumber.toString().padStart(option.cycleCounterDigits, '0')}`;
    }


    // 生成
    let id: string;
    if (option.decorate) {
        id = option.decorate(idSource);
    } else {
        id = `${idSource.timestampString}`;

        if (idSource.randomString && idSource.randomString.length > 0) {
            id += `_${idSource.randomString}`;
        }

        if (idSource.cycleCountString && idSource.cycleCountString.length > 0) {
            id += `_${idSource.cycleCountString}`;
        }
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
    window.sessionStorage.setItem(option.tabIdKey, tabId);
}

function fixOption() {
    // 設定値の検証
    if (option.randomDigits < 0) {
        logger.warn("Invalid randomDigits value:", option.randomDigits);
        option.randomDigits = 0;
    }
    if (option.randomDigits > 10) {
        logger.warn("randomDigits value too large, setting to 10:", option.randomDigits);
        option.randomDigits = 10;
    }
    if (option.cycleCounterDigits < 0) {
        logger.warn("Invalid cycleCounterDigits value:", option.cycleCounterDigits);
        option.cycleCounterDigits = 0;
    }
    if (option.cycleCounterDigits > 10) {
        logger.warn("cycleCounterDigits value too large, setting to 10:", option.cycleCounterDigits);
        option.cycleCounterDigits = 10;
    }
    option.channelName = option.tabIdKey + "_channel";
    option.storeName = option.tabIdKey + "_store";
}

/**
 * セッションストレージからタブIDを取得します。
 * 
 * @returns 
 */
export function get(): string {
    return window.sessionStorage.getItem(option.tabIdKey) || '';
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
    fixOption();

    if (option.debugLog) {
        logger.debug("Initializing with options:", option);
    }

    initializeTransports();

    // タブIDがすでに存在するか確認
    checkLevel = "session-storage";
    let tabId: string | null = window.sessionStorage.getItem(option.tabIdKey);
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
            const fromTabId: string | null = window.opener.sessionStorage.getItem(option.tabIdKey);
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

