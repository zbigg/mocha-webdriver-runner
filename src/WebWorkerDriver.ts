import { runnerBackChannel } from "./RemoteCommon";
import { UnhandledExceptionMessage, RemoteRunnerMessage, MochaRunMessage } from "./RemoteRunnerProtocol";
import { buildMessage } from "@zbigg/treesync";
import { queryStringRunnerOptions } from "./BrowserDriver";
import { runRemoteMochaTest } from "./MochaRemoteRunner";

/**
 * Adds Web Worker instance which will send test events, when ran.
 *
 * Worker instance, must run tests using mocha instrumented by [[addMochaSource]].
 *
 * All test events from mocha running in worker will be forwarded to [[runRemoteMochaTest]]
 * through [[BrowserMessagePort]]
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
    let firstMessage = true;
    worker.addEventListener("message", event => {
        if (firstMessage && queryStringRunnerOptions !== undefined) {
            worker.postMessage(<MochaRunMessage>{
                type: "mocha-run",
                mochaOptions: queryStringRunnerOptions
            });
            firstMessage = false;
        }
        const message = event.data as RemoteRunnerMessage;
        runnerBackChannel.postMessage(message);
    });

    worker.addEventListener("error", event => {
        runnerBackChannel.postMessage(<UnhandledExceptionMessage>{
            type: "err-unhandled-exception",
            message: "Unhandled error in Worker context.",
            error: buildMessage(event.error || event.message)
        });
    });

    if (queryStringRunnerOptions === undefined) {
        runRemoteMochaTest((worker as any as MessagePort), {
            reporter: "html",
            captureConsoleLog: false,
            clientWaitsForOptions: true
        })
    }
}
