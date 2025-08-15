const LOG_PREFIX = "[BrowserTabId]";
let isEnabled = true;

export function setLogEnabled(enabled: boolean): void {
    isEnabled = enabled;
}

/**
 * ロガーを生成します。
 * 
 * @returns 
 */
export function createLogger() {
    return {
        debug: isEnabled ? console.log.bind(console, `${LOG_PREFIX} [DEBUG]`) : () => {},
        info: isEnabled ? console.info.bind(console, `${LOG_PREFIX} [INFO]`) : () => {},
        warn: isEnabled ? console.warn.bind(console, `${LOG_PREFIX} [WARN]`) : () => {},
        error: isEnabled ? console.error.bind(console, `${LOG_PREFIX} [ERROR]`) : () => {}
    };
}
