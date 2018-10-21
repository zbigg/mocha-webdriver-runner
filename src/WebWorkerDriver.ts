import { runnerBackChannel } from "./RemoteCommon";
import { UnhandledExceptionMessage, RemoteRunnerMessage } from "./RemoteRunnerProtocol";
import { buildMessage } from "@zbigg/treesync";

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

    worker.addEventListener("message", event => {
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
}
