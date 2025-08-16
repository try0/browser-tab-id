import { test, expect, type Page } from '@playwright/test';

test.describe('ブラウザタブIDのテスト', () => {
    test.setTimeout(5 * 60 * 1000);

    test('複数タブを開いてユニークなタブIDを生成する', async ({ context }) => {
        const tabIds = new Set<string>();
        const tabs: { page: Page, tabId: string | null }[] = [];

        // 50個のタブを開く
        for (let i = 0; i < 50; i++) {
            const page = await context.newPage();
            await page.goto('http://localhost:5173');

            // タブIDが生成されるまで待機
            await page.waitForSelector('#tab-id', { timeout: 15000 });

            // タブIDを取得
            const tabIdElement = await page.locator('#tab-id');
            const tabId = await tabIdElement.textContent();

            expect(tabId).toBeTruthy();
            expect(tabId).not.toBe('');

            // 重複チェック
            expect(tabIds.has(tabId!)).toBe(false);
            tabIds.add(tabId!);

            tabs.push({ page, tabId });

            console.log(`Tab ${i + 1}: ${tabId}`);
        }

        // 全てのタブIDがユニークであることを確認
        expect(tabIds.size).toBe(50);

        // 各タブでタブIDが表示されていることを確認
        for (const { page, tabId } of tabs) {
            const displayedId = await page.locator('#tab-id').textContent();
            expect(displayedId).toBe(tabId);
        }

        // 全てのタブを閉じる
        for (const { page } of tabs) {
            await page.close();
        }
    });

    test('タブ複製時に新しいタブIDを生成する', async ({ context }) => {
        const tabIds = new Set<string>();

        // 最初のタブを開く
        const page1 = await context.newPage();
        await page1.goto('http://localhost:5173');
        await page1.waitForSelector('#tab-id');

        const tabId1 = await page1.locator('#tab-id').textContent();
        expect(tabId1).toBeTruthy();
        tabIds.add(tabId1!);

        // "新しいタブで開く" リンクをクリックして10個のタブを開く
        for (let i = 0; i < 10; i++) {
            const [newPage] = await Promise.all([
                context.waitForEvent('page'),
                page1.click('a[href="./index.html"]')
            ]);

            await newPage.waitForSelector('#tab-id');
            const newTabId = await newPage.locator('#tab-id').textContent();

            expect(newTabId).toBeTruthy();
            expect(newTabId).not.toBe('');
            expect(tabIds.has(newTabId!)).toBe(false);
            tabIds.add(newTabId!);

            console.log(`New tab ${i + 1}: ${newTabId}`);
        }

        expect(tabIds.size).toBe(11); // 最初のタブ + 10個の新しいタブ
    });

    test('opener/noopenerリンクでタブIDを正しく処理する', async ({ context }) => {
        const page = await context.newPage();
        await page.goto('http://localhost:5173');
        await page.waitForSelector('#tab-id');

        const originalTabId = await page.locator('#tab-id').textContent();

        // opener付きリンクでタブを開く
        const [openerPage] = await Promise.all([
            context.waitForEvent('page'),
            page.click('#linkOpener')
        ]);

        await openerPage.waitForSelector('#tab-id');
        const openerTabId = await openerPage.locator('#tab-id').textContent();

        // noopener付きリンクでタブを開く
        const [noOpenerPage] = await Promise.all([
            context.waitForEvent('page'),
            page.click('#linkNoOpener')
        ]);

        await noOpenerPage.waitForSelector('#tab-id');
        const noOpenerTabId = await noOpenerPage.locator('#tab-id').textContent();

        // 全てのタブIDが異なることを確認
        expect(originalTabId).not.toBe(openerTabId);
        expect(originalTabId).not.toBe(noOpenerTabId);
        expect(openerTabId).not.toBe(noOpenerTabId);

        console.log(`Original: ${originalTabId}`);
        console.log(`Opener: ${openerTabId}`);
        console.log(`No Opener: ${noOpenerTabId}`);
    });

    test('ページリロード後も同じタブIDを保持する', async ({ context }) => {
        const page = await context.newPage();
        await page.goto('http://localhost:5173');
        await page.waitForSelector('#tab-id');

        const originalTabId = await page.locator('#tab-id').textContent();

        // ページをリロード
        await page.reload();
        await page.waitForSelector('#tab-id');

        const reloadedTabId = await page.locator('#tab-id').textContent();

        // リロード後も同じタブIDが保持されていることを確認
        expect(reloadedTabId).toBe(originalTabId);

        console.log(`Original: ${originalTabId}`);
        console.log(`After reload: ${reloadedTabId}`);
    });

    test('並行してタブを開いても重複が発生しない', async ({ context }) => {
        const tabIds = new Set<string>();
        const promises: Promise<{ page: Page, tabId: string | null }>[] = [];

        // 50個のタブを並行して開く
        for (let i = 0; i < 50; i++) {
            const promise = (async () => {
                const page = await context.newPage();
                await page.goto('http://localhost:5173');
                await page.waitForSelector('#tab-id', { timeout: 15000 });

                const tabId = await page.locator('#tab-id').textContent();
                return { page, tabId };
            })();

            promises.push(promise);
        }

        // 全ての並行処理が完了するまで待機
        const results = await Promise.all(promises);

        // 重複チェック
        for (const { tabId } of results) {
            expect(tabId).toBeTruthy();
            expect(tabIds.has(tabId!)).toBe(false);
            tabIds.add(tabId!);
        }

        expect(tabIds.size).toBe(50);
        console.log(`Generated ${tabIds.size} unique tab IDs concurrently`);

        // 全てのタブを閉じる
        for (const { page } of results) {
            await page.close();
        }
    });
});

