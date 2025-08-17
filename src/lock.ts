import { createLogger } from "./log";
import type { ILockManager, LockOption } from "./types";

const logger = createLogger();

/**
 * Web Locks APIベースの実装
 */
class WebLocksAPIManager implements ILockManager {
    /**
     * 排他ロックを取得して処理を実行
     * @param lockName ロック名
     * @param callback ロック取得後に実行する処理
     * @param options ロックオプション
     */
    async withLock<T>(lockName: string, callback: () => Promise<T>, options: LockOption = {}): Promise<T> {
        const { timeout = 10000, mode = 'exclusive' } = options;

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Lock timeout after ${timeout}ms`));
            }, timeout);

            navigator.locks.request(lockName, { mode }, async (lock) => {

                if (!lock) {
                    clearTimeout(timeoutId);
                    reject(new Error('Failed to acquire lock'));
                    return;
                }

                try {
                    const result = await callback();
                    clearTimeout(timeoutId);
                    resolve(result);
                } catch (error) {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            }).catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    }


    cleanup(): void {
        // Web Locks APIは自動的にクリーンアップされる
    }
}

/**
 * 非対応時は何もしない
 * なんかフォールバック実装できればあとでする
 */
const noLockManager: ILockManager = {
    async withLock<T>(_lockName: string, callback: () => Promise<T>, _options?: LockOption): Promise<T> {
        return callback();
    },
    cleanup(): void {
        // 何もしない
    }
};

/**
 * ロックマネージャーファクトリー
 */
export class LockManagerFactory {
    private static instance: ILockManager | null = null;

    static getInstance(): ILockManager {
        if (!this.instance) {
            this.instance = this.createLockManager();
        }
        return this.instance;
    }

    private static createLockManager(): ILockManager {
        if (this.isWebLocksAPIAvailable()) {
            if (logger.isDebug()) {
                logger.log('createLockManager Using Web Locks API');
            }
            return new WebLocksAPIManager();
        } else {
            if (logger.isDebug()) {
                logger.log('createLockManager Disabled locks');
            }
            return noLockManager;
        }
    }

    private static isWebLocksAPIAvailable(): boolean {
        return 'navigator' in globalThis && 'locks' in navigator;
    }

    static cleanup(): void {
        if (this.instance) {
            this.instance.cleanup();
            this.instance = null;
        }
    }
}

// クリーンアップ
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        LockManagerFactory.cleanup();
    });
}