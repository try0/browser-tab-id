# browser-tab-id

[English](./README.md) | [日本語](./README.ja.md)

Generates an ID that is as unique as possible using time + random number + increment, and manages it with sessionStorage.

```
{timestamp}_{random}_{counter}
1755313540998_87226662_0001
```

* The increment part uses [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) for locking and incrementing if available.
* If `window.opener` exists, checks sessionStorage directly.
* Checks for duplicates by exchanging events with other tabs.

## Usage

[npm](https://www.npmjs.com/package/@try0/browser-tab-id)
```
npm i @try0/browser-tab-id
```

Minimal usage
```js
const tabId = await BrowserTabId.initialize();
```

All options
```js
const tabId = await BrowserTabId.initialize({
    tabIdKey: "btid", // Key for sessionStorage. Also used as a prefix.
    randomDigits: 8, // Number of digits for the random part. Set to 0 to omit.
    duplicateCheckWaitTime: 600, // Wait time in milliseconds for duplicate check with other tabs.
    cycleCounterDigits: 4, // Number of digits for the increment part. Set to 0 to omit. Rolls over when exceeding the digit limit.
    cycleCounterType: "indexed-db", // Storage for the ring counter. Or "local-storage". Falls back to local-storage if indexed-db is unavailable.
    channels: ["broadcast-channel", "local-storage"], // Methods for communicating with other tabs. Falls back to local-storage if broadcast-channel is unavailable.
    decorate: (idSrc) => [idSrc.timestampString, idSrc.randomString, idSrc.cycleCountString].join("_"), // Change the format. Random and counter parts are zero-padded strings.
    debugLog: false, // Enable debug logs.
});
```

TypeScript
```ts
import BrowserTabId , { type BrowserTabIdOption, type TabIdStringSource } from '@try0/browser-tab-id'

const btOption: BrowserTabIdOption = {

}
const tabId: string = await BrowserTabId.initialize(btOption);

```

Delegating to an existing ID generation logic
```JS
const tabId = await BrowserTabId.initialize({
     decorate: (idSrc) => ulid()
});
```

Direct from CDN
```
<script src="https://unpkg.com/@try0/browser-tab-id@0.0.4/dist/browser-tab-id.umd.js"></script>
```
```
<script src="https://cdn.jsdelivr.net/npm/@try0/browser-tab-id@0.0.4/dist/browser-tab-id.umd.js"></script>
```



## Demo

[Sample](https://try0.github.io/browser-tab-id/index.html)