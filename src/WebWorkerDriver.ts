import { runnerBackChannel, reportError, installGlobalErrorHandlers, installConsoleLogForwarder } from "./RemoteCommon";
import { RemoteRunnerMessage, RemoteBootstrapParams, MochaRunnerEvent } from "./RemoteRunnerProtocol";
import { workerAutoMain } from "./WorkerAutoMain";

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
     *     require.resolve("mocha/mocha.js",
     *     require.resolve("mocha-webdriver-runner/dist/mocha-webdriver-client.js")
     *
     * Must contain at least `mocha` and `mocha-webdriver-client` browser side script
     * to properly perform test setup.
     *
     * Relative to `document.baseUrl`
     */
    bootstrapScripts?: string[];
}

/**
 * Run `tests` under Mocha in Web Worker.
 *
 * All test events are forwarded using [[emitPageEvent]] to node driver.
 *
 * Context: Dom/Browser
 *
 * @param options urls of test scripts or [[WorkerTestAutoOptions]].
 */
export function runWorkerTestsAuto(options: WorkerTestAutoOptions | string[]) {
    installGlobalErrorHandlers();
    installConsoleLogForwarder();

    const actualOptions = Array.isArray(options)
        ? <WorkerTestAutoOptions>{
              tests: options
          }
        : options;

    if (!actualOptions.bootstrapScripts) {
        actualOptions.bootstrapScripts = [
            // these defaults work only for "common" use case, where test page is
            // test/something.html
            "../node_modules/mocha/mocha.js",
            "../node_modules/mocha-webdriver-runner/dist/mocha-webdriver-client.js"
        ];
    }

    const boostrapEnvMessage: RemoteBootstrapParams = {
        baseUrl: baseUrl(document.baseURI),
        bootstrapScripts: actualOptions.bootstrapScripts,
        tests: actualOptions.tests
    };
    const workerScript = `
        ${workerAutoMain}
        workerAutoMain(${JSON.stringify(boostrapEnvMessage)});
    `;

    const workerScriptBlob = new Blob([workerScript], { type: "application/javascript" });
    const workerScriptUrl = URL.createObjectURL(workerScriptBlob);
    const worker = new Worker(workerScriptUrl);

    function end() {
        worker.terminate();
    }

    const onError = (event: ErrorEvent) => {
        reportError("Unhandled error in Worker context", event.error);
    };

    const onMessage = (event: MessageEvent) => {
        const message = event.data as MochaRunnerEvent;
        if (message.type === "mocha-finished") {
            end();
        }
    };
    worker.addEventListener("error", onError);
    worker.addEventListener("message", onMessage);

    // pass control to normal worker handler
    addWorkerSource(worker);
}

function baseUrl(url: string) {
    const idx = url.lastIndexOf("/");
    if (idx === -1) {
        return "./";
    } else {
        return url.substring(0, idx + 1);
    }
}

/**
 * Adds Web Worker instance which will send test events, when ran.
 *
 * Worker instance, must run tests using mocha instrumented by [[addMochaSource]].
 *
 * All test events from mocha running in worker will be forwarded to [[runRemoteMochaTest]]
 * through [[BrowserMessagePort]].
 *
 * Context: Dom/Browser
 *
 * Example:
 *
 * const testsWorker = new Worker('./tests-worker.js);
 * MochaWebdriverClient.addWorkerSource(testsWorker);
 */
export function addWorkerSource(worker: Worker) {
    runnerBackChannel.addEventListener("message", event => {
        const message = event.data as RemoteRunnerMessage;
        if (message && message.type === "mocha-run") {
            worker.postMessage(message);
        }
    });

    worker.addEventListener("message", event => {
        const message = event.data as RemoteRunnerMessage;
        runnerBackChannel.postMessage(message);
    });

    worker.addEventListener("error", event => {
        reportError("Unhandled error in Worker context.", event.error);
    });
}
