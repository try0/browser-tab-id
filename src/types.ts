
/**
 * 設定
 */
export interface BrowserTabIdOption {
    /**
     * タブIDのキー
     * @default 'tabId'
     */
    tabIdStorageKey: string;
    /**
     * タブIDの生成に使うランダム数値の桁数
     */
    randomDigits: number;
    /**
     * BroadcastChannelの名前
     */
    channelName: string;
    /**
     * BroadcastChannelのタイムアウト時間
     */
    channelTimeout: number;
    /**
     * ブラウザのローカルストレージを使用するかどうか
     */
    enableLocalStorageTransport: boolean;
    /**
     * IndexedDBを使用するかどうか
     */
    useIndexedDB: boolean;
    /**
     * IndexedDBの名前
     */
    indexedDBName: string;
    /**
     * リングカウンターの桁数
     */
    cycleCounterDigits: number;

    debugLog: boolean;
}

/**
 * 初期化オプション
 */
export interface InitializeBrowserTabIdOption extends Partial<BrowserTabIdOption> { }

/**
 * 通知タイプ
 */
export type MessageDataType = 'check-duplicate' | `found-duplicate`;

/**
 * 通知データ
 */
export interface MessageData {
    type: MessageDataType;
    requestId: string;
    tabId: string | null;
};

/**
 * トランスポート抽象インターフェース
 */
export interface Transport {
    readonly name: string;
    /**
     * イベントを送信します。
     *
     * @param message
     */
    send(message: MessageData): void;
    /**
     * 受信イベントをハンドリングします。
     * 
     * @param callback 
     */
    onMessage(callback: (message: MessageData) => void): void;
    /**
     * 後処理
     */
    cleanup(): void;
};

/**
 * ID生成状況
 */
export type GeneratedState =
    "no-id" |
    "new-id" |
    "session-storage-id";

/**
 * 重複チェックレベル
 */
export type CheckLevel =
    "no-check" |
    "session-storage" |
    "opener-session-storage" |
    "broadcast-channel";

