import { WebDriver } from "selenium-webdriver";

declare global {
    interface Window {
        __pageEventQueue?: any[];
        __pageEventCallback?: () => void;

        __driverCommandQueue?: any[];
        __driverCommandCallbacks?: Array<() => void>;
    }
}

export function emitPageEvent(event: any) {
    if (!window.__pageEventQueue) {
        window.__pageEventQueue = [];
    }
    window.__pageEventQueue.push(event);
    if (window.__pageEventCallback) {
        window.__pageEventCallback();
        delete window.__pageEventCallback;
    }
}

/**
 * Drain event queue on `client` side.
 *
 * To be called by `driver` remotely using `WebDrirver.executeAsyncScript`.
 * Runs in `client` scope.
 *
 * Used by `fetchPageEvents`.
 *
 * @params done LAST PARAMETER callback to be called to return response to `driver`
 */
export function drainQueueClientWebDriver(...args: any[]) {
    // `WebDriver.executeAsyncScript` will pass `done` as very last argument. For safety, ensure
    // that really use last arg.
    const done: (response: any) => void = arguments[arguments.length - 1];
    let timerId: any;

    function tryDrainQueue(forceRespondWithAnything?: boolean) {
        const q = window.__pageEventQueue || [];

        clearTimeout(timerId);
        window.__pageEventCallback = undefined;

        if (!forceRespondWithAnything && q.length === 0) {
            window.__pageEventCallback = tryDrainQueue;
            return;
        }
        window.__pageEventQueue = [];
        const encodedResponseRemote = JSON.stringify(q);
        done(encodedResponseRemote);
    }

    timerId = setTimeout(() => tryDrainQueue(true), 100);

    tryDrainQueue();
}

export async function fetchPageEvents(driver: WebDriver): Promise<any[]> {
    const ensodedResponseLocal: any = await driver.executeAsyncScript(drainQueueClientWebDriver).catch(error => {
        var newErr = new Error(`#fetchPageEvents: failed to receive next event: ${error}`);
        newErr.stack += "\nCaused by: " + error.stack;
        throw newErr;
    });
    const parsed = JSON.parse(ensodedResponseLocal);
    return parsed;
}

export function execPageCommandWebDriver(...args: any[]) {
    const done: () => void = arguments[arguments.length - 1];
    if (!window.__driverCommandQueue) {
        window.__driverCommandQueue = [];
    }
    window.__driverCommandQueue.push(arguments[0]);
    if (window.__driverCommandCallbacks) {
        const tmpCallbacks = window.__driverCommandCallbacks;
        window.__driverCommandCallbacks = undefined;
        for (const callback of tmpCallbacks) {
            callback();
        }
    }
    done();
}

export function queuePageCommand(driver: WebDriver, command: any) {
    return Promise.resolve(driver.executeAsyncScript(execPageCommandWebDriver, JSON.stringify(command)));
}

export function fetchPageCommand(): Promise<any> {
    return new Promise(resolve => {
        function tryShiftCommand() {
            if (!window.__driverCommandQueue || window.__driverCommandQueue.length === 0) {
                if (!window.__driverCommandCallbacks) {
                    window.__driverCommandCallbacks = [];
                }
                window.__driverCommandCallbacks.push(tryShiftCommand);
                return;
            }

            const command = window.__driverCommandQueue.shift();
            resolve(JSON.parse(command));
        }
        tryShiftCommand();
    });
}
