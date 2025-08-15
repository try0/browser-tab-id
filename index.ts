import { checkLevel, initialize, state } from './src/main';

document.addEventListener('DOMContentLoaded', () => {

    initialize().then(tabId => {
        document.querySelector('#tab-id')!.textContent = tabId;
        console.log(tabId);

        document.querySelector('#state')!.textContent
            = `State: ${state}, Check Level: ${checkLevel}`;
    });

    document.querySelector('#linkOpener')!.addEventListener('click', (e) => {
        e.preventDefault();
        window.open('./index.html', '_blank');
    });

    document.querySelector('#linkNoOpener')!.addEventListener('click', (e) => {
        e.preventDefault();
        window.open('./index.html', '_blank', 'noopener');
    });
});