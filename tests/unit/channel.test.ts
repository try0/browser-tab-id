import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageTransport, BroadcastChannelTransport, TransportRacer, isMessageData } from '../../src/channel';
import { MessageData } from '../../src/types';

describe('LocalStorageTransport', () => {
    let transport: LocalStorageTransport;
    const keyPrefix = 'test_btid_transport';

    beforeEach(() => {
        localStorage.clear();
        transport = new LocalStorageTransport(keyPrefix);
    });

    it('メッセージ送信・受信ができる', async () => {
        let received: MessageData | null = null;
        transport.onMessage((msg) => {
            received = msg;
        });

        const message: MessageData = {
            type: 'check-duplicate',
            requestId: 'req1',
            tabId: 'tab1'
        };
        transport.send(message);

        // storageイベントは同一タブでは発火しないため、直接handleStorageEventを呼ぶ
        const event = new StorageEvent('storage', {
            key: `${keyPrefix}_dummy`,
            newValue: JSON.stringify(message),
        });
        // @ts-ignore
        transport['handleStorageEvent'](event);

        expect(received).toEqual(message);
    });

    it('クリーンアップでイベントリスナーが解除される', () => {
        const spy = vi.spyOn(window, 'removeEventListener');
        transport.cleanup();
        expect(spy).toHaveBeenCalledWith('storage', expect.any(Function));
        spy.mockRestore();
    });
});

describe('BroadcastChannelTransport', () => {
    let transport: BroadcastChannelTransport;

    beforeEach(() => {
        transport = new BroadcastChannelTransport('test_channel');
    });

    it('メッセージ送信・受信ができる', async () => {
        let received: MessageData | null = null;
        transport.onMessage((msg) => {
            received = msg;
        });

        const message: MessageData = {
            type: 'check-duplicate',
            requestId: 'req1',
            tabId: 'tab1'
        };
        transport.send(message);

        // BroadcastChannelは同一インスタンスでは受信しないため、直接handleMessageを呼ぶ
        // @ts-ignore
        transport['handleMessage']({ data: message });

        expect(received).toEqual(message);
    });

    it('クリーンアップでチャンネルが閉じられる', () => {
        const spy = vi.spyOn(transport['channel'], 'close');
        transport.cleanup();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});

describe('TransportRacer', () => {
    let local: LocalStorageTransport;
    let racer: TransportRacer;

    beforeEach(() => {
        localStorage.clear();
        local = new LocalStorageTransport('race_btid');
        racer = new TransportRacer([local]);
    });

    it('broadcastで全トランスポートに送信できる', () => {
        const spy = vi.spyOn(local, 'send');
        const msg: MessageData = {
            type: 'check-duplicate',
            requestId: 'req2',
            tabId: 'tab2'
        };
        racer.broadcast(msg);
        expect(spy).toHaveBeenCalledWith(msg);
        spy.mockRestore();
    });

    it('onMessageで受信できる', () => {
        let called = false;
        racer.onMessage((msg, transport) => {
            called = true;
            expect(transport).toBe(local);
            expect(msg.type).toBe('check-duplicate');
            expect(msg.requestId).toBe('req3');
            expect(msg.tabId).toBe('tab3');
        });
        // storageイベントは同一タブでは発火しないため直接呼ぶ
        const event = new StorageEvent('storage', {
            key: 'race_btid_dummy',
            newValue: JSON.stringify({
                type: 'check-duplicate',
                requestId: 'req3',
                tabId: 'tab3'
            }),
        });
        // @ts-ignore
        local['handleStorageEvent'](event);
        expect(called).toBe(true);
    });

    it('cleanupで全トランスポートがクリーンアップされる', () => {
        const spy = vi.spyOn(local, 'cleanup');
        racer.cleanup();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('getTransportNamesでトランスポート名が取得できる', () => {
        expect(racer.getTransportNames()).toEqual(['localStorage']);
    });
});



describe("isMessageData", () => {
    it("正しいMessageData型のオブジェクトの場合はtrueを返す", () => {
        const obj = {
            type: "test",
            requestId: "req-1",
            tabId: "tab-1"
        };
        expect(isMessageData(obj)).toBe(true);
    });

    it("tabIdがnullでもtrueを返す", () => {
        const obj = {
            type: "test",
            requestId: "req-2",
            tabId: null
        };
        expect(isMessageData(obj)).toBe(true);
    });

    it("typeがstringでない場合はfalseを返す", () => {
        const obj = {
            type: 123,
            requestId: "req-3",
            tabId: "tab-3"
        };
        expect(isMessageData(obj)).toBe(false);
    });

    it("requestIdがstringでない場合はfalseを返す", () => {
        const obj = {
            type: "test",
            requestId: 456,
            tabId: "tab-4"
        };
        expect(isMessageData(obj)).toBe(false);
    });

    it("tabIdがstringでもnullでもない場合はfalseを返す", () => {
        const obj = {
            type: "test",
            requestId: "req-5",
            tabId: 789
        };
        expect(isMessageData(obj)).toBe(false);
    });

    it("オブジェクトでない値の場合はfalseを返す", () => {
        expect(isMessageData(null)).toBe(false);
        expect(isMessageData(undefined)).toBe(false);
        expect(isMessageData("string")).toBe(false);
    });
});