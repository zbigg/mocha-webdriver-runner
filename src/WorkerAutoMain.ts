import {
    RemoteRunnerOptions,
    RemoteRunnerMessage,
    UnhandledExceptionMessage,
    RemoteBootstrapParams,
    MochaReadyMessage,
    MochaFinishedMessage
} from "./RemoteRunnerProtocol";

declare const MochaWebdriverClient: typeof import('./index.web');

declare let self: Worker & {
    importScripts(..._scripts: string[]): void;
};

/**
 * The main of Web Worker in auto mode.
 *
 * Context: WebWorker/Browser
 */
export function workerAutoMain(env: RemoteBootstrapParams) {
    function reportErrorRaw(error: Error) {
        self.postMessage(<UnhandledExceptionMessage>{
            type: "err-unhandled-exception",
            message: "[worker] " + error.message,
            // manually serialized error
            error: {
                root: {
                    type: "error",
                    value: {
                        message: error.message,
                        stack: error.stack
                    }
                },
                objects: {}
            }
        });
    }
    function bootstrap() {
        const baseUrl = env.baseUrl || "";
        const bootstrapScripts = env.bootstrapScripts;
        bootstrapScripts.forEach(function(scriptUrl: string) {
            self.importScripts(baseUrl + scriptUrl);
        });

        if (typeof mocha === "undefined") {
            throw new Error("global object 'mocha' not available after bootstrap");
        }
        if (typeof MochaWebdriverClient === "undefined") {
            throw new Error("global object 'MochaWebdriverClient' not available after bootstrap");
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
            if (message.type === "mocha-run") {
                run(message.mochaOptions || {});
            }
        } catch (error) {
            reportErrorRaw(error);
        }
    };

    self.onerror = function(event) {
        reportErrorRaw(event.error);
    };

    try {
        bootstrap();
    } catch (error) {
        reportErrorRaw(error);
    }
}
