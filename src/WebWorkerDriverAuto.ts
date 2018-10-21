import {
    RemoteRunnerOptions,
    RemoteRunnerMessage,
    AbortedMessage,
    UnhandledExceptionMessage,
    MochaRunnerEvent,
    BootstrapWorkerMessage,
    MochaReadyMessage,
    MochaFinishedMessage
} from "./RemoteRunnerProtocol";
import { installGlobalErrorHandlers, installConsoleLogForwarder, runnerBackChannel } from "./RemoteCommon";
import { buildMessage } from "@zbigg/treesync";
import { addWorkerSource } from "./WebWorkerDriver";

declare let self: Worker & {
    importScripts(..._scripts: string[]): void;
};

declare global {
    const MochaWebdriverClient: any;
}

function workerCode() {
    const DEFAULT_BOOTSTRAP_SCRIPTS = [
        "../node_modules/mocha/mocha.js",
        "../node_modules/mocha-webdriver-runner/dist/mocha-webdriver-client.js"
    ];

    function initialize(env: BootstrapWorkerMessage) {
        const baseUrl = env.baseUrl || "";
        const bootstrapScripts = env.bootstrapScripts || DEFAULT_BOOTSTRAP_SCRIPTS;
        bootstrapScripts.forEach(function(scriptUrl: string) {
            self.importScripts(baseUrl + scriptUrl);
        });

        if (mocha === undefined) {
            self.postMessage(<AbortedMessage>{
                type: "err-aborted",
                message: "global object 'mocha' not available after bootstrap"
            });
        }
        if (MochaWebdriverClient === undefined) {
            self.postMessage(<AbortedMessage>{
                type: "err-aborted",
                message: "global object 'MochaWebdriverClient' not available after bootstrap"
            });
        }

        MochaWebdriverClient.installGlobalErrorHandlers();

        mocha.setup({
            ui: "bdd",
            reporter: MochaWebdriverClient.Reporter as any
        });
        const tests = env.tests || [];
        tests.forEach(function(testUrl: string) {
            self.importScripts(baseUrl + testUrl);
        });
        mocha.checkLeaks();
        self.postMessage(<MochaReadyMessage>{ type: "mocha-ready" });
    }

    function run(options: RemoteRunnerOptions) {
        MochaWebdriverClient.applyMochaOptions(mocha, options);
        mocha.run(function() {
            self.postMessage(<MochaFinishedMessage>{ type: "mocha-finished" });
        });
    }

    self.onmessage = function(event) {
        const message = event.data as RemoteRunnerMessage;
        try {
            if (message.type === "boostrap-worker") {
                initialize(message);
            } else if (message.type === "mocha-run") {
                run(message.mochaOptions || {});
            } else {
                console.log("unknown message received", message);
            }
        } catch(error) {
            self.postMessage(<UnhandledExceptionMessage>{
                type: "err-unhandled-exception",
                message: "[worker] " + error.message,
                // manually serialized error
                error: {
                    root: {
                        type: 'error',
                        value: {
                            message: error.message,
                            stack: error.stack
                        }
                    },
                    objects: {}
                }
            });
        }
    };
    self.postMessage({ type: "worker-ready-for-bootstrap" });
}

export interface WorkerTestAutoOptions {
    /**
     * Test scripts URLs.
     *
     * Relative to `document.baseUrl`
     */
    tests: string[];

    /*
     * Worker bootstrap scripts URLs.
     *
     * Optional, defaults to:
     *
     *     [ "../node_modules/mocha/mocha.js",
     *       "../node_modules/mocha-webdriver-runner/dist/mocha-webdriver-client.js" ]
     *
     * Must contain at least `mocha` and `mocha-webdriver-client` browser side script
     * to properly perform test setup.
     *
     * Relative to `document.baseUrl`
     */
    bootstrapScripts?: string[];
}
/**
 * Run `tests` under Mocha in WebWorker.
 *
 * All test events are forwarded using [[emitPageEvent]] to node driver.
 *
 * @param options urls of test scripts or [[WorkerTestAutoOptions]].
 */
export function runWorkerTestsAuto(options: WorkerTestAutoOptions | string[]) {
    const actualOptions = Array.isArray(options)
        ? <WorkerTestAutoOptions>{
              tests: options
          }
        : options;
    installGlobalErrorHandlers();
    installConsoleLogForwarder();

    return new Promise((resolve, reject) => {
        const workerScript = `
            ${workerCode}
            workerCode();
        `;

        const workerScriptBlob = new Blob([workerScript], { type: "application/javascript" });
        const workerScriptUrl = URL.createObjectURL(workerScriptBlob);
        const worker = new Worker(workerScriptUrl);
        let firstMessageReceived = false;
        let bootstraped = false;

        function end() {
            worker.terminate();
        }

        function emitCommandToWorker(command: RemoteRunnerMessage) {
            worker.postMessage(command);
        }

        const onError = (event: ErrorEvent) => {
            if (!firstMessageReceived || !bootstraped) {
                worker.terminate();
                const message = firstMessageReceived
                    ? `unable to boostrap Worker`
                    : "unable to start Worker";
                runnerBackChannel.postMessage(<AbortedMessage>{
                    type: "err-aborted",
                    message,
                    error: buildMessage(event.error || event.message)
                });
                reject(new Error(message));
            } else {
                runnerBackChannel.postMessage(<UnhandledExceptionMessage>{
                    type: "err-unhandled-exception",
                    message: "Unhandled error in Worker context.",
                    error: buildMessage(event.error || event.message)
                });
            }
        };
        const onMessage = (event: MessageEvent) => {
            if (!firstMessageReceived) {
                firstMessageReceived = true;
            }

            const message = event.data as MochaRunnerEvent;
            //
            // TODO:
            //   This protocol (worker-ready-for-bootstrap&boostrap-worker) can be generalized and
            //   used "driver->browser" auto scheme too so client doesn't have to create html and
            //   `mocha-webdriver-runner` can be serve files too!.
            //
            if ((message.type as string) === "worker-ready-for-bootstrap") {
                emitCommandToWorker(<BootstrapWorkerMessage>{
                    type: "boostrap-worker",
                    baseUrl: baseUrl(document.baseURI),
                    bootstrapScripts: actualOptions.bootstrapScripts,
                    tests: actualOptions.tests
                });
                worker.removeEventListener("error", onError);
                worker.removeEventListener("message", onMessage);
            } else if (message.type === "mocha-finished") {
                end();
                resolve();
            }
        };
        worker.addEventListener("error", onError);
        worker.addEventListener("message", onMessage);

        // pass control to normal worker handler
        addWorkerSource(worker);
    });
}

function baseUrl(url: string) {
    const idx = url.lastIndexOf("/");
    if (idx === -1) {
        return "./";
    } else {
        return url.substring(0, idx + 1);
    }
}
