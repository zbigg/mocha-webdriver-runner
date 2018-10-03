import { WebDriver } from "selenium-webdriver";

declare global {
    interface Window {
        __pageEventQueue?: any[];
        __pageEventCallback?: () => void;
    }
}

export function emitPageEvent(event: any) {
    if (!window.__pageEventQueue) {
        window.__pageEventQueue = [];
    }
    window.__pageEventQueue.push(event);
    console.log("#emitPageEvent, sending", event);
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
            //console.log("mocha-selenium-driver: #drainQueueClient, empty, backoff");
            (window as any).__pageEventCallback = tryDrainQueue;
            return;
        }
        (window as any).__pageEventCallback = null;
        (window as any).__pageEventQueue = [];
        const encodedResponseRemote = JSON.stringify(q);

        //console.log("mocha-selenium-driver: #drainQueueClient, sent", encodedResponseRemote);
        done(encodedResponseRemote);
    }

    tryDrainQueue();
}

export async function fetchPageEvents(driver: WebDriver): Promise<any[]> {
    const ensodedResponseLocal: any = await driver.executeAsyncScript(drainQueueClientWebDriver);
    const parsed = JSON.parse(ensodedResponseLocal);
    return parsed;
}
