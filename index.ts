import BrowserTabId from './src/main';

// Promise<string>
BrowserTabId.initialize({
    debugLog: true
}).then(tabId /*: string */ => {

    const showTabId = () => {
        document.querySelector('#tab-id')!.textContent = tabId;
        document.querySelector('#state')!.textContent
            = `State: ${BrowserTabId.getState()}, Check Level: ${BrowserTabId.getCheckLevel()}`;
    }

    if (document.readyState === "complete") {
        showTabId();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            showTabId();
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('#linkOpener')!.addEventListener('click', (e) => {
        e.preventDefault();
        window.open('./index.html', '_blank');
    });

    document.querySelector('#linkNoOpener')!.addEventListener('click', (e) => {
        e.preventDefault();
        window.open('./index.html', '_blank', 'noopener');
    });
});