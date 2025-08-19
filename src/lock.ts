import { createLogger } from "./log";
import type { ILockManager, LockOption } from "./types";

const logger = createLogger();

/**
 * Web Locks APIベースの実装
 */
export class WebLocksAPIManager implements ILockManager {
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
 * 簡易ロック実装
 */
export class LocalStorageBestEffortLockManager implements ILockManager {
    async withLock<T>(lockName: string, callback: () => Promise<T>, options: LockOption = {}): Promise<T> {
        const timeout = options.timeout ?? 1000;
        const expire = Date.now() + timeout;
        const pollInterval = 10;
        let acquired = false;

        // ロック取得
        while (!acquired) {
            const now = Date.now();
            const lockValue = localStorage.getItem(lockName);
            if (!lockValue || Number(lockValue) < now) {
                try {
                    localStorage.setItem(lockName, String(expire));
                    // 直後に自分がロック保持者か再確認
                    if (localStorage.getItem(lockName) === String(expire)) {
                        acquired = true;
                        break;
                    }
                } catch { }
            }

            if (now > expire) {
                throw new Error(`Lock timeout after ${timeout}ms`);
            }

            await new Promise(r => setTimeout(r, pollInterval));
        }

        try {
            return await callback();
        } finally {
            // ロック解放
            if (localStorage.getItem(lockName) === String(expire)) {
                localStorage.removeItem(lockName);
            }
        }
    }

    cleanup(): void {
        // 特に何もしない
    }
}




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
                logger.log('createLockManager Using LocalStorage Lock');
            }
            return new LocalStorageBestEffortLockManager();
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

