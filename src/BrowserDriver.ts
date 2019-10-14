import { MochaRemoteReporter } from "./MochaRemoteReporter";
import {
    applyMochaOptions,
    installGlobalErrorHandlers,
    runnerBackChannel,
    MAGIC_TIMEOUT
} from "./RemoteCommon";
import {
    MochaReadyMessage,
    MochaFinishedMessage,
    RemoteRunnerMessage,
    RemoteRunnerOptions
} from "./RemoteRunnerProtocol";

export let queryStringRunnerOptions: RemoteRunnerOptions | undefined;

import * as qs from "qs";

/**
 * Adds mocha instance which will send test events, when ran.
 *  - use [[MochaWebdriverReporter]] to gather events
 *  - sends events to [[runRemoteMochaTest]]
 *
 * Note, default `Mocha` instance i.e `(global|window|self).mocha` is added by default, so
 * there is no reason to use this funciton manually, see [[initializeMochaWebDriverClient]].
 *
 * May be used both in "main" thread or in web worker thread. When executed in worker, it's
 * expected that worker instance in main thread is also registered for forwarding using
 * [[addWorkerSource]].
 */
export function addMochaSource(mocha: Mocha) {
    installGlobalErrorHandlers();

    mocha.reporter(MochaRemoteReporter as any);
    mocha.globals(["__pageEventQueue", "__pageEventCallback", "__driverCommandCallback", "__driverCommandQueue"]);

    if (queryStringRunnerOptions !== undefined) {
        applyMochaOptions(mocha, queryStringRunnerOptions);
    } else {
        delayMochaRun(mocha);
    }
}

export function delayMochaRun(mocha: Mocha) {
    //
    // HACK NOTE:
    //
    // Initialize mocha timeout with rubbish, so we can detect not-customized timeouts later.
    // All tests, hook & suites with timeout() == MAGIC_TIMEOUT have it overriden later in
    // `applyMochaOptions` when actual timeout value is received from driver.
    //
    mocha.timeout(MAGIC_TIMEOUT);

    const originalMochaRun = mocha.run;
    mocha.run = function (fn?: ((failures: number) => void | undefined)): Mocha.Runner {
        runnerBackChannel.addEventListener("message", event => {
            const message = event.data as RemoteRunnerMessage;
            if (message && message.type === "mocha-run") {
                applyMochaOptions(mocha, message.mochaOptions || {});

                originalMochaRun.call(mocha, (failures: number) => {
                    runnerBackChannel.postMessage(<MochaFinishedMessage>{
                        type: "mocha-finished"
                    });
                    if (fn) {
                        fn(failures);
                    }
                });
            }
        });

        runnerBackChannel.postMessage(<MochaReadyMessage>{
            type: "mocha-ready"
        });

        return undefined!;
    };
}

/**
 * Initialize Mocha Webdriver Browser side.
 *
 * Checks `window.location.search` for specific `RemoteRunnerOptions` and if
 * `useMochaWebDriverRunner` flag is detected applies them to default `mocha` instance.
 */
export function initializeMochaWebDriverClient() {
    if (typeof window !== "undefined") {
        const queryString = window.location.search;
        if (!queryString) {
            return;
        }
        const parsed = qs.parse(queryString.substr(1));
        if (!parsed.useMochaWebDriverRunner) {
            return;
        }
        const mochaOptions: RemoteRunnerOptions = {};
        if (typeof parsed.timeout === "string") {
            mochaOptions.timeout = parseInt(parsed.timeout, 10);
        }
        if (typeof parsed.grep === "string") {
            mochaOptions.grep = parsed.grep;
        }
        if (typeof parsed.captureConsoleLog === "string") {
            mochaOptions.captureConsoleLog = parsed.captureConsoleLog !== "false";
        }
        if (typeof parsed.captureConsoleLog === "string") {
            mochaOptions.captureConsoleLog = parsed.captureConsoleLog !== "";
        }
        if (typeof parsed.globalsToSave === "string") {
            mochaOptions.globalsToSave = String(parsed.globalsToSave).split(',');
        }

        queryStringRunnerOptions = mochaOptions;
    }

    if (typeof mocha !== "undefined") {
        addMochaSource(mocha);
    }
}

/**
 * @deprecated use [[addMochaSource]]
 */
export const install = addMochaSource;
