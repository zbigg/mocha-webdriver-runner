import { WebDriver } from "selenium-webdriver";

declare global {
    interface Window {
        __pageEventQueue?: any[];
        __pageEventCallback?: () => void;

        __driverCommandQueue?: any[];
        __driverCommandCallback?: () => void;
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
function drainQueueClientWebDriver() {
    // `WebDriver.executeAsyncScript` will pass `done` as very last argument. For safety, ensure
    // that really use last arg.
    const done: (response: any) => void = arguments[arguments.length - 1];

    function tryDrainQueue() {
        const q = (window as any).__pageEventQueue || [];

        if (q.length === 0) {
            (window as any).__pageEventCallback = tryDrainQueue;
            return;
        }
        (window as any).__pageEventCallback = null;
        (window as any).__pageEventQueue = [];
        const encodedResponseRemote = JSON.stringify(q);
        done(encodedResponseRemote);
    }

    tryDrainQueue();
}

export async function fetchPageEvents(driver: WebDriver): Promise<any[]> {
    const ensodedResponseLocal: any = await driver.executeAsyncScript(drainQueueClientWebDriver);
    const parsed = JSON.parse(ensodedResponseLocal);
    return parsed;
}

function execPageCommandWebDriver() {
    const done: () => void = arguments[arguments.length - 1];
    if (!window.__driverCommandQueue) {
        window.__driverCommandQueue = [];
    }
    window.__driverCommandQueue.push(arguments[0]);
    if (window.__driverCommandCallback) {
        window.__driverCommandCallback();
        window.__driverCommandCallback = undefined;
    }
    done();
}

export async function queuePageCommand(driver: WebDriver, command: any) {
    await driver.executeAsyncScript(execPageCommandWebDriver, JSON.stringify(command));
}

export async function fetchPageCommand(): Promise<any> {
    return new Promise(resolve => {
        function tryShiftCommand() {
            if (!window.__driverCommandQueue || window.__driverCommandQueue.length === 0) {
                window.__driverCommandCallback = tryShiftCommand;
                return;
            }

            const command = window.__driverCommandQueue.shift();
            resolve(JSON.parse(command));
        }
        tryShiftCommand();
    });
}
