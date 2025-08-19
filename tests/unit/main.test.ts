import { describe, it, expect, beforeEach, vi } from 'vitest';
import BrowserTabId, { initialize, get, getCheckLevel, getState } from '../../src/main';

describe('BrowserTabId 基本', () => {
    beforeEach(() => {
        sessionStorage.clear();
        // BroadcastChannelやlocalStorageの副作用もクリア
        localStorage.clear();
        // openerをリセット
        // @ts-ignore
        delete window.opener;
    });

    it('初回initializeでタブIDが生成される', async () => {
        const tabId = await initialize();
        expect(tabId).toBeDefined();
        expect(typeof tabId).toBe('string');
        expect(tabId.length).toBeGreaterThan(0);
        expect(get()).toBe(tabId);
        expect(getState()).toMatch(/id/);
    });

    it('2回目以降は同じタブIDが返る', async () => {
        const tabId1 = await initialize();
        const tabId2 = await initialize();
        expect(tabId2).toBe(tabId1);
        expect(get()).toBe(tabId1);
    });

    it('sessionStorageをクリアすると新しいタブIDが生成される', async () => {
        const tabId1 = await initialize();
        sessionStorage.clear();
        const tabId2 = await initialize();
        expect(tabId2).not.toBe(tabId1);
    });

    it('カスタムキーでタブIDを生成できる', async () => {
        const tabId = await initialize({ tabIdKey: 'custom_btid' });
        expect(tabId).toBeDefined();
        expect(sessionStorage.getItem('custom_btid')).toBe(tabId);
    });

    it('BrowserTabIdデフォルトエクスポートでinitializeできる', async () => {
        const tabId = await BrowserTabId.initialize();
        expect(tabId).toBeDefined();
        expect(typeof tabId).toBe('string');
    });

    it('getCheckLevelとgetStateが正しい値を返す', async () => {
        await initialize();
        expect(['no-check', 'session-storage', 'opener-session-storage', 'broadcast-channel']).toContain(getCheckLevel());
        expect(['no-id', 'new-id', 'session-storage-id']).toContain(getState());
    });

});


describe('BrowserTabId window.opener', () => {
    beforeEach(() => {
        sessionStorage.clear();
        // BroadcastChannelやlocalStorageの副作用もクリア
        localStorage.clear();
        // openerをリセット
        // @ts-ignore
        delete window.opener;
    });


    it('window.openerのsessionStorageが同じIDなら新しいIDが生成される', async () => {
        // 1. opener側のsessionStorageをモック
        const openerSessionStorage = {
            getItem: vi.fn().mockReturnValue('DUPLICATE_ID'),
            setItem: vi.fn(),
        };
        // 2. window.openerをモック
        // @ts-ignore
        window.opener = { sessionStorage: openerSessionStorage };

        // 3. 現在のタブにも同じIDをセット
        sessionStorage.setItem('btid', 'DUPLICATE_ID');

        // 4. initializeを呼ぶと新しいIDが生成される
        const newId = await initialize();
        expect(newId).not.toBe('DUPLICATE_ID');
        expect(get()).toBe(newId);
    });

    it('window.openerのsessionStorageが異なるIDならそのまま', async () => {
        // 1. opener側のsessionStorageをモック
        const openerSessionStorage = {
            getItem: vi.fn().mockReturnValue('OTHER_ID'),
            setItem: vi.fn(),
        };
        // 2. window.openerをモック
        // @ts-ignore
        window.opener = { sessionStorage: openerSessionStorage };

        // 3. 現在のタブに別のIDをセット
        sessionStorage.setItem('btid', 'MY_ID');

        // 4. initializeを呼ぶとIDは変わらない
        const id = await initialize();
        expect(id).toBe('MY_ID');
        expect(get()).toBe('MY_ID');
    });

});


describe('BrowserTabId フォーマットユニットテスト', () => {
    beforeEach(() => {
        sessionStorage.clear();
        localStorage.clear();
        // @ts-ignore
        delete window.opener;
    });

    it('デフォルトのIDフォーマットは「timestamp_random_cycle」の形式になる', async () => {
        const tabId = await initialize({
            randomDigits: 8,
            cycleCounterDigits: 4,
        });
        // 例: "1755567816439_12345678_0005"
        expect(tabId).toMatch(/^\d{13}_\d{8}_\d{4}$/);
        expect(get()).toBe(tabId);
    });

    it('randomDigits=0の場合はランダム部が省略される', async () => {
        const tabId = await initialize({
            randomDigits: 0,
            cycleCounterDigits: 4,
        });
        // 例: "1755567816439_0005"
        expect(tabId).toMatch(/^\d{13}_\d{4}$/);
    });

    it('cycleCounterDigits=0の場合はカウンター部が省略される', async () => {
        const tabId = await initialize({
            randomDigits: 8,
            cycleCounterDigits: 0,
        });
        // 例: "1755567816439_12345678"
        expect(tabId).toMatch(/^\d{13}_\d{8}$/);
    });

    it('randomDigits=0, cycleCounterDigits=0の場合はタイムスタンプのみ', async () => {
        const tabId = await initialize({
            randomDigits: 0,
            cycleCounterDigits: 0,
        });
        // 例: "1755567816439"
        expect(tabId).toMatch(/^\d{13}$/);
    });

    it('decorate関数でカスタムフォーマットが適用される', async () => {
        const tabId = await initialize({
            decorate: (src) => `CUSTOM-${src.timestampString}-${src.randomString}-${src.cycleCountString}`,
            randomDigits: 2,
            cycleCounterDigits: 2,
        });
        // 例: "CUSTOM-1755567816439-12-05"
        expect(tabId).toMatch(/^CUSTOM-\d{13}-\d{2}-\d{2}$/);
    });

    it('decorate関数でソースを利用しない', async () => {
        const tabId = await initialize({
            decorate: () => `CUSTOM-XXXX-XXXX-XXXX`,
            randomDigits: 2,
            cycleCounterDigits: 2,
        });
        // 例: "CUSTOM-XXXX-XXXX-XXXX"
        expect(tabId).toMatch(/^CUSTOM-XXXX-XXXX-XXXX$/);
    });
});


describe('タブ間重複チェックのタイムアウト', () => {
    beforeEach(() => {
        sessionStorage.clear();
        localStorage.clear();
        // @ts-ignore
        delete window.opener;
    });

    it('duplicateCheckWaitTime 短め', async () => {
        // タイムアウトを短く設定
        const waitTime = 100;
        // transportRacerのbroadcast/onMessageが何も返さない（応答がない）状況を作る
        // ここでは通常通りinitializeを呼ぶだけでOK（他タブがいないので応答なし）

        // 採番済みかつ、window.openerなし
        sessionStorage.setItem("btid", "existing_id");

        const start = Date.now();
        const tabId = await initialize({
            duplicateCheckWaitTime: waitTime
        });
        const elapsed = Date.now() - start;

        // タイムアウトより十分大きい値にはならないことを確認
        expect(elapsed).toBeGreaterThanOrEqual(waitTime);
        expect(elapsed).toBeLessThan(waitTime + 200); // 多少の誤差を許容

        // tabIdが生成されていること
        expect(typeof tabId).toBe('string');
        expect(tabId.length).toBeGreaterThan(0);
    });

        it('duplicateCheckWaitTime 長め', async () => {
        // タイムアウトを短く設定
        const waitTime = 3000;
        // transportRacerのbroadcast/onMessageが何も返さない（応答がない）状況を作る
        // ここでは通常通りinitializeを呼ぶだけでOK（他タブがいないので応答なし）

        // 採番済みかつ、window.openerなし
        sessionStorage.setItem("btid", "existing_id");

        const start = Date.now();
        const tabId = await initialize({
            duplicateCheckWaitTime: waitTime
        });
        const elapsed = Date.now() - start;

        // タイムアウトより十分大きい値にはならないことを確認
        expect(elapsed).toBeGreaterThanOrEqual(waitTime);
        expect(elapsed).toBeLessThan(waitTime + 200); // 多少の誤差を許容

        // tabIdが生成されていること
        expect(typeof tabId).toBe('string');
        expect(tabId.length).toBeGreaterThan(0);
    });
    
});