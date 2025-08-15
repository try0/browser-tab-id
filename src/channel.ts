import type { MessageData, Transport } from "./types";

/**
 * BroadcastChannel トランスポート実装
 * iOSだとバックグラウンドタブとの通信うまくいかないかも
 */
export class BroadcastChannelTransport implements Transport {
    public readonly name = "BroadcastChannel";
    private channel: BroadcastChannel;
    /**
     * ハンドラー
     */
    private messageCallback?: (message: MessageData) => void;

    constructor(channelName: string) {
        // チャンネル初期化
        this.channel = new BroadcastChannel(channelName);
        this.channel.addEventListener("message", this.handleMessage.bind(this));
    }

    private handleMessage(event: MessageEvent) {
        if (event.data && typeof event.data === "object" && this.messageCallback) {
            this.messageCallback(event.data as MessageData);
        }
    }

    send(message: MessageData): void {
        this.channel.postMessage(message);
    }

    onMessage(callback: (message: MessageData) => void): void {
        this.messageCallback = callback;
    }

    cleanup(): void {
        this.channel.close();
        this.messageCallback = undefined;
    }
}

/**
 * localStorage トランスポート実装
 */
export class LocalStorageTransport implements Transport {
    public readonly name = "localStorage";
    private keyPrefix: string;
    private messageCallback?: (message: MessageData) => void;
    private storageListener: (event: StorageEvent) => void;
    private timeoutIds: Set<number> = new Set();

    constructor(keyPrefix: string = "btid_transport") {
        // 初期化
        this.keyPrefix = keyPrefix;
        this.storageListener = this.handleStorageEvent.bind(this);
        window.addEventListener("storage", this.storageListener);
    }

    private handleStorageEvent(event: StorageEvent) {
        if (event.key && event.key.startsWith(`${this.keyPrefix}_`) && event.newValue && this.messageCallback) {
            try {
                const message = JSON.parse(event.newValue) as MessageData;
                this.messageCallback(message);
            } catch (e) {
                // JSON parse エラーは無視
            }
        }
    }

    send(message: MessageData): void {
        // イベントをラップして記録
        const key = `${this.keyPrefix}_${Date.now()}_${Math.random().toString(36)}`;
        const messageWithTimestamp = {
            ...message,
            timestamp: Date.now()
        };

        localStorage.setItem(key, JSON.stringify(messageWithTimestamp));

        // 短時間後に削除
        const timeoutId = setTimeout(() => {
            localStorage.removeItem(key);
        }, 5000);
        this.timeoutIds.add(timeoutId);
    }

    onMessage(callback: (message: MessageData) => void): void {
        this.messageCallback = callback;
    }

    cleanup(): void {
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds.clear();

        window.removeEventListener("storage", this.storageListener);
        this.messageCallback = undefined;
        this.cleanupOldKeys();
    }

    private cleanupOldKeys(): void {
        const now = Date.now();
        const maxAge = 10000;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`${this.keyPrefix}_`)) {
                try {
                    const value = localStorage.getItem(key);
                    if (value) {
                        const data = JSON.parse(value);
                        if (data.timestamp && (now - data.timestamp > maxAge)) {
                            localStorage.removeItem(key);
                        }
                    }
                } catch (e) {
                    localStorage.removeItem(key);
                }
            }
        }
    }
}

/**
 * 複数トランスポートのレースを管理するクラス
 */
export class TransportRacer {
    private transports: Transport[] = [];
    private messageCallbacks: Set<(message: MessageData, transport: Transport) => void> = new Set();

    constructor(transports: Transport[]) {
        this.transports = transports;

        if (transports.length === 0) {
            console.warn("No available transports");
        }

        // 各トランスポートからのメッセージを統一的に処理
        this.transports.forEach(transport => {
            transport.onMessage((message) => {
                this.messageCallbacks.forEach(callback => {
                    callback(message, transport);
                });
            });
        });
    }

    /**
     * 全トランスポートでメッセージを送信
     */
    broadcast(message: MessageData): void {
        this.transports.forEach(transport => {
            try {
                transport.send(message);
            } catch (error) {
                console.warn(`Failed to send message via ${transport.name}:`, error);
            }
        });
    }

    /**
     * メッセージ受信コールバックを登録
     */
    onMessage(callback: (message: MessageData, transport: Transport) => void): void {
        this.messageCallbacks.add(callback);
    }

    /**
     * メッセージ受信コールバックを削除
     */
    offMessage(callback: (message: MessageData, transport: Transport) => void): void {
        this.messageCallbacks.delete(callback);
    }

    /**
     * 全トランスポートをクリーンアップ
     */
    cleanup(): void {
        this.transports.forEach(transport => {
            try {
                transport.cleanup();
            } catch (error) {
                console.warn(`Failed to cleanup ${transport.name}:`, error);
            }
        });
        this.messageCallbacks.clear();
    }

    /**
     * 利用可能なトランスポート一覧を取得
     */
    getTransportNames(): string[] {
        return this.transports.map(t => t.name);
    }
}