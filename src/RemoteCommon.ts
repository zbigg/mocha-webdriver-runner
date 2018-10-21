import { WebWorkerMessagePort } from "./WebWorkerMessagePort";
import { BrowserMessagePort } from "./BrowserMessagePort";
import { RemoteRunnerOptions, LogMessage, RemoteRunnerMessage } from "./RemoteRunnerProtocol";
import { buildMessage } from "@zbigg/treesync";

declare let self: Worker & {
    importScripts(..._scripts: string[]): void;
};

export function inWebWorkerContext() {
    return typeof self !== "undefined" && typeof self.importScripts !== "undefined";
}

export const runnerBackChannel = inWebWorkerContext()
    ? new WebWorkerMessagePort()
    : new BrowserMessagePort();

export function applyMochaOptions(mocha: Mocha, options: RemoteRunnerOptions) {
    if (options.grep) {
        mocha.grep(options.grep);
    }
    if (options.captureConsoleLog) {
        installConsoleLogForwarder();
    }
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

export function installGlobalErrorHandlers() {
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
