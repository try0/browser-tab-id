# browser-tab-id

[English](./README.md) | [日本語](./README.ja.md)

時間 + ランダム数字 + インクリメント でなるべく重複しないIDを生成して、sessionStorageで管理します。  


```
{timestamp}_{random}_{counter}
1755313540998_87226662_0001
```

* インクリメント部は、[Web Locks API](https://developer.mozilla.org/ja/docs/Web/API/Web_Locks_API)が使える環境であれば、ロックを取得してインクリメント。
* window.openerがあれば、sessionStorageを直接確認。
* 別タブとイベントやり取りで重複チェック。


## Usage

[npm](https://www.npmjs.com/package/@try0/browser-tab-id)
```
npm i @try0/browser-tab-id
```

最小構成
```JS
const tabId = await BrowserTabId.initialize();
```

全オプション
```JS
const tabId = await BrowserTabId.initialize({
    tabIdKey: "btid", // sessionStorageのキー。他プレフィックスとして使用。
    randomDigits: 8, // ランダム数値部桁数。0で省略。
    duplicateCheckWaitTime: 600, // 他タブへの重複チェックにかける待機時間ミリ秒。
    cycleCounterDigits: 4, // インクリメント数値部桁数。0で省略。桁超えると最初に戻る。
    cycleCounterType: "indexed-db", // リングカウンターの記録ストア。 or local-storage。indexed-db使用不可時はlocal-storageへフォールバック。
    channels: ["broadcast-channel", "local-storage"], // 他タブへの問い合わせ方法。broadcast-channel使用不可時はlocal-storageへフォールバック。
    decorate: (idSrc) => [idSrc.timestampString, idSrc.randomString, idSrc.cycleCountString].join("_"), // フォーマットの変更。ランダム・カウンター部は0埋めの文字列。
    debugLog: false, // デバッグ用ログ。
});
```

TypeScript
```ts
import BrowserTabId , { type BrowserTabIdOption, type TabIdStringSource } from '@try0/browser-tab-id'

const btOption: BrowserTabIdOption = {

}
const tabId: string = await BrowserTabId.initialize(btOption);

```

既存のID生成ロジックへの移譲
```JS
const tabId = await BrowserTabId.initialize({
     decorate: (idSrc) => ulid()
});
```

CDNから直
```
<script src="https://unpkg.com/@try0/browser-tab-id@0.0.4/dist/browser-tab-id.umd.js"></script>
```
```
<script src="https://cdn.jsdelivr.net/npm/@try0/browser-tab-id@0.0.4/dist/browser-tab-id.umd.js"></script>
```


## デモ

[Sample](https://try0.github.io/browser-tab-id/index.html)