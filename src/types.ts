
/**
 * 設定
 */
export interface BrowserTabIdOption {
    /**
     * タブIDのキー
     */
    tabIdKey: string;
    /**
     * タブIDの生成に使うランダム数値の桁数
     */
    randomDigits: number;
    /**
     * BroadcastChannelの重複チェック待機時間
     */
    duplicateCheckWaitTime: number;
    /**
     * ブラウザのローカルストレージを使用するかどうか
     */
    channels: ("broadcast-channel" | "local-storage")[];
    /**
     * リングカウンターの桁数
     */
    cycleCounterDigits: number;
    /**
     * リングカウンター実装
     */
    cycleCounterType: 'local-storage' | 'indexed-db';
    /**
     * プレフィックスを生成する関数
     */
    prefixFactory?: () => string;

    debugLog: boolean;
}

/**
 * 初期化オプション
 */
export interface InitializeBrowserTabIdOption extends Partial<BrowserTabIdOption> { }

export interface InternalBrowserTabIdOption extends BrowserTabIdOption {
    channelName: string;
    storeName: string;
}

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



/**
 * ロック管理のインターフェース
 */
export interface ILockManager {
    /**
     * 排他ロックを取得して処理を実行します。
     * 
     * @param lockName ロック名
     * @param callback ロック取得後に実行する処理
     * @param options ロックオプション
     */
    withLock<T>(lockName: string, callback: () => Promise<T>, options?: LockOption): Promise<T>;
    
    /**
     * ロックマネージャーをクリーンアップ
     */
    cleanup(): void;
}

export interface LockOption {
    timeout?: number;
    mode?: 'exclusive' | 'shared';
}

