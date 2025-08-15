
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
}

/**
 * 初期化オプション
 */
export interface InitializeBrowserTabIdOption extends Partial<BrowserTabIdOption> { }

/**
 * 通知タイプ
 */
export type MessageDataType = 'notify-generated-id' | 'request-generated-id';

/**
 * 通知データ
 */
export interface MessageData {
    type: MessageDataType;
    tabId: string | null;
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