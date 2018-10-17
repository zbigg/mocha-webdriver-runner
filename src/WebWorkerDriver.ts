import { waitForRunnerOptions, runnerBackChannel } from "./RemoteCommon";
import {
    UnhandledExceptionMessage,
    RemoteRunnerMessage,
    AbortedMessage,
    MochaRunMessage
} from "./RemoteRunnerProtocol";
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
    let firstMessageReceived = false;

    worker.addEventListener("message", event => {
        if (!firstMessageReceived) {
            firstMessageReceived = true;
        }
        const message = event.data as RemoteRunnerMessage;
        switch (message.type) {
            case "mocha-ready":
                waitForRunnerOptions().then(mochaOptions => {
                    worker.postMessage(<MochaRunMessage>{
                        type: "mocha-run",
                        mochaOptions
                    });
                });
                break;
            case "mocha-runner-event":
            case "mocha-finished":
            case "log":
            case "err-unhandled-exception":
            case "err-aborted":
                // just forward up to node.js, message is already serialized in format
                // expected by runner
                runnerBackChannel.postMessage(message);
                break;
            default:
                return;
        }
    });
    worker.addEventListener("error", event => {
        if (!firstMessageReceived) {
            worker.terminate();
            const message = "Unable to start Worker";
            runnerBackChannel.postMessage(<AbortedMessage>{
                type: "err-aborted",
                message,
                error: buildMessage(event.error || event.message)
            });
        } else {
            runnerBackChannel.postMessage(<UnhandledExceptionMessage>{
                type: "err-unhandled-exception",
                message: "Unhandled error in Worker context.",
                error: buildMessage(event.error || event.message)
            });
        }
    });
}
