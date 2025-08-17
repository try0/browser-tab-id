const LOG_PREFIX = "[BrowserTabId]";
/**
 * ロガーの状態
 */
export const LoggerState = {
    isDebug: false
};

/**
 * ロガーを生成します。
 * 
 * @returns 
 */
export function createLogger() {
    // コンソールのリンクを呼び出し元にしときたいから、デバッグログは呼び出し元でisDebugをチェック
    // なんかほかに方法ないのか？？
    return {
        log: console.log.bind(console, `${LOG_PREFIX} [DEBUG]`),
        info: console.info.bind(console, `${LOG_PREFIX} [INFO]`),
        warn: console.warn.bind(console, `${LOG_PREFIX} [WARN]`),
        error: console.error.bind(console, `${LOG_PREFIX} [ERROR]`),
        isDebug: () => LoggerState.isDebug
    };
}
