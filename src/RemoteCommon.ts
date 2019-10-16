import { WebWorkerMessagePort } from "./WebWorkerMessagePort";
import { BrowserMessagePort } from "./BrowserMessagePort";
import { RemoteRunnerOptions, LogMessage } from "./RemoteRunnerProtocol";
import { buildMessage } from "@zbigg/treesync";

declare let self: Worker & {
    importScripts(..._scripts: string[]): void;
};

export let currentOptions: RemoteRunnerOptions = {};

export const MAGIC_TIMEOUT = 312345678;

export function inWebWorkerContext() {
    return typeof self !== "undefined" && typeof self.importScripts !== "undefined";
}

export const runnerBackChannel = inWebWorkerContext()
    ? new WebWorkerMessagePort()
    : new BrowserMessagePort();

export function applyMochaOptions(mocha: Mocha, options: RemoteRunnerOptions) {
    currentOptions = {...currentOptions, ...options};

    if (options.captureConsoleLog) {
        installConsoleLogForwarder();
    }

    if (options.checkLeaks !== undefined) {
        if (options.checkLeaks) {
            mocha.checkLeaks()

        } else {
            mocha.ignoreLeaks(true)
        }
    }
    if (options.globals !== undefined) {
        mocha.globals(options.globals);
    }

    if (options.grep) {
        mocha.grep(options.grep);
    }

    {
        const timeout = options.timeout !== undefined ? options.timeout : 2000;
        overrideDefaultMagicTimeout(mocha.suite, timeout);
        mocha.timeout(timeout);
    }
}

export function overrideDefaultMagicTimeout(suite: Mocha.Suite, timeout: number) {
    const overrideMagicTimeout = (obj: Mocha.Runnable | Mocha.Suite) => {
        if (obj.timeout() === MAGIC_TIMEOUT) {
            obj.timeout(timeout);
        }
    }
    overrideMagicTimeout(suite);

    suite.tests.forEach(overrideMagicTimeout);
    (suite as any)._beforeEach.forEach(overrideMagicTimeout);
    (suite as any)._beforeAll.forEach(overrideMagicTimeout);
    (suite as any)._afterEach.forEach(overrideMagicTimeout);
    (suite as any)._afterAll.forEach(overrideMagicTimeout);

    suite.suites.forEach(subSuite => {
        overrideDefaultMagicTimeout(subSuite, timeout);
    });

}
let consoleLogSenderInstalled = false;

/**
 * Hijack `console.*` to send all logs to parent through `runnerBackChannel`.
 */
export function installConsoleLogForwarder() {
    if (consoleLogSenderInstalled) {
        return;
    }
    consoleLogSenderInstalled = true;
    const originalConsole = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error
    };

    function runnerLogForwarder(level: "log" | "info" | "warn" | "error") {
        return function(...args: any[]) {
            originalConsole[level].apply(console, args);
            runnerBackChannel.postMessage(<LogMessage>{
                type: "log",
                level,
                args: buildMessage(args)
            });
        };
    }

    console.log = runnerLogForwarder("log");
    console.info = runnerLogForwarder("info");
    console.warn = runnerLogForwarder("warn");
    console.error = runnerLogForwarder("error");
}

let globalErrorHandlersInstalled = false;

export function installGlobalErrorHandlers() {
    if (globalErrorHandlersInstalled) {
        return;
    }
    globalErrorHandlersInstalled = true;

    self.addEventListener("unhandledrejection", event => {
        runnerBackChannel.postMessage({
            type: "err-unhandled-exception",
            message: "Unhandled rejection in Browser context.",
            error: buildMessage((event as any).reason)
        });
    });

    self.addEventListener("error", event => {
        runnerBackChannel.postMessage({
            type: "err-unhandled-exception",
            message: "Unhandled error in Browser context.",
            error: buildMessage(event.error || event.message)
        });
    });
}
