import { describe, it, expect, beforeEach } from 'vitest';
import {
    LocalStorageRingCounter,
    IndexedDBRingCounter,
    RingCounterFactory,
    incrementCycleCounter,
    cleanupStorage
} from '../../src/storage';

// テスト用オプション
const option = {
    storeName: 'test_store',
    cycleCounterDigits: 3,
    cycleCounterType: 'local-storage'
} as any;

const idbOption = {
    storeName: 'test_store_idb',
    cycleCounterDigits: 3,
    cycleCounterType: 'indexed-db'
} as any;

describe('LocalStorageRingCounter', () => {
    let counter: LocalStorageRingCounter;

    beforeEach(() => {
        localStorage.clear();
        counter = new LocalStorageRingCounter(option);
    });

    it('カウンターがインクリメントされ、上限でラップアラウンドする', async () => {
        const max = Math.pow(10, option.cycleCounterDigits);
        let last = 0;
        for (let i = 1; i <= max + 2; i++) {
            const val = await counter.increment();
            expect(typeof val).toBe('number');
            last = val;
        }
        expect(last).toBe(2); // (max + 2)回目は2
    });

    it('インクリメント時にタイムスタンプがセットされる', async () => {
        await counter.increment();
        const ts = localStorage.getItem(`${option.storeName}_counter_ts`);
        expect(ts).not.toBeNull();
        expect(Number(ts)).toBeGreaterThan(0);
    });

    it('クリーンアップがエラーなく実行できる', async () => {
        await expect(counter.cleanup()).resolves.not.toThrow();
    });
});

describe('IndexedDBRingCounter', () => {
    let counter: IndexedDBRingCounter;

    beforeEach(() => {
        counter = new IndexedDBRingCounter(idbOption);
    });

    it('インクリメントで数値が返る', async () => {
        const val = await counter.increment();
        expect(typeof val).toBe('number');
        expect(val).toBeGreaterThanOrEqual(0);
    });

    it('クリーンアップがエラーなく実行できる', async () => {
        await expect(counter.cleanup()).resolves.not.toThrow();
    });
});

describe('incrementCycleCounter / cleanupStorage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('incrementCycleCounterでインクリメントできる', async () => {
        const val = await incrementCycleCounter(option);
        expect(typeof val).toBe('number');
    });

    it('cleanupStorageでクリーンアップできる', async () => {
        await expect(cleanupStorage(option)).resolves.not.toThrow();
    });
});