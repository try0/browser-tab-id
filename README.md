時間 + ランダム数字 + インクリメント でなるべく重複しないIDを生成して、sessionStorageで管理します。  

```
1755313540998_87226662_0001
```

[サンプル](https://try0.github.io/browser-tab-id/index.html)

* インクリメント部は、[Web Locks API](https://developer.mozilla.org/ja/docs/Web/API/Web_Locks_API)が使える環境であれば、ロックを取得してインクリメント。
* window.openerがあれば、sessionStorageを直接確認。
* 別タブとイベントやり取りで重複チェック。





```JS
const tabId = await BrowserTabId.initialize();
```

```JS
const tabId = await BrowserTabId.initialize({
    tabIdKey: "btid", // sessionStorageのキー。他プレフィックスとして使用。
    randomDigits: 8, // ランダム数値部桁数。0でランダム部省略。
    duplicateCheckWaitTime: 600, // 他タブへの重複チェックにかける待機時間ミリ秒。
    cycleCounterDigits: 4, // インクリメント数値部桁数。0で省略。
    cycleCounterType: "indexed-db", // リングカウンターの記録ストア。 or local-storage。indexed-db使用不可時はlocal-storageへフォールバック。
    channels: ['broadcast-channel', 'local-storage'], // 他タブへの問い合わせ方法。broadcast-channel使用不可時はlocal-storageへフォールバック。
    debugLog: false, // デバッグ用ログ。
});
```
