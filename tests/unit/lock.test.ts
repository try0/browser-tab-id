import { describe, it, expect, beforeEach } from 'vitest';
import {
    LocalStorageBestEffortLockManager,
    LockManagerFactory,
    WebLocksAPIManager,
} from '../../src/lock';

// localStorageのモックはjsdomで自動提供される

describe('LocalStorageBestEffortLockManager', () => {
    let lockManager: LocalStorageBestEffortLockManager;

    beforeEach(() => {
        lockManager = new LocalStorageBestEffortLockManager();
        localStorage.clear();
    });

    it('ロックを取得して解放できる', async () => {
        let called = false;
        await lockManager.withLock('test-lock', async () => {
            called = true;
            expect(localStorage.getItem('test-lock')).not.toBeNull();
        });
        expect(called).toBe(true);
        expect(localStorage.getItem('test-lock')).toBeNull();
    });

    it('ロックが保持されている場合はタイムアウトする', async () => {
        // 先にロックをセット
        localStorage.setItem('test-lock', String(Date.now() + 100));
        await expect(
            lockManager.withLock('test-lock', async () => { }, { timeout: 50 })
        ).rejects.toThrow(/Lock timeout/);
    });

    it('連続してロック取得できる', async () => {
        let order: number[] = [];
        await lockManager.withLock('test-lock', async () => {
            order.push(1);
            await lockManager.withLock('test-lock', async () => {
                order.push(2);
            });
            order.push(3);
        });
        expect(order).toEqual([1, 2, 3]);
    });
});

describe('LockManagerFactory', () => {
    beforeEach(() => {
        LockManagerFactory.cleanup();
        localStorage.clear();
    });

    it('インスタンスが取得できる', () => {
        const instance = LockManagerFactory.getInstance();
        expect(instance).toBeDefined();
        expect(typeof instance.withLock).toBe('function');
    });

    it('cleanupでインスタンスがリセットされる', () => {
        const first = LockManagerFactory.getInstance();
        LockManagerFactory.cleanup();
        const second = LockManagerFactory.getInstance();
        expect(second).not.toBe(first);
    });
});

// WebLocksAPIManagerのテストはWeb Locks API対応環境でのみ有効
// jsdom環境ではスキップ