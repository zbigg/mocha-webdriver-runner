import { MochaRemoteReporter } from "./MochaRemoteReporter";
import { applyMochaOptions, installGlobalErrorHandlers, runnerBackChannel, MAGIC_TIMEOUT } from "./RemoteCommon";
import { MochaReadyMessage, MochaFinishedMessage, RemoteRunnerMessage } from "./RemoteRunnerProtocol";

/**
 * Adds mocha instance which will send test events, when ran.
 *  - use [[MochaWebdriverReporter]] to gather events
 *  - sends events to [[runRemoteMochaTest]]
 *
 * May be used both in "main" thread or in web worker thread. When executed in worker, it's
 * expected that worker instance in main thread is also registered for forwarding using
 * [[addWorkerSource]].
 *
 * Example:
 *
 *     mocha.setup(...);
 *     MochaWebdriverClient.addMochaSource(mocha);
 *     // load tests
 *     mocha.run();
 */
export function addMochaSource(mocha: Mocha) {
    installGlobalErrorHandlers();

    mocha.reporter(MochaRemoteReporter as any);
    const originalMochaRun = mocha.run;

    mocha.globals(["__pageEventQueue", "__pageEventCallback", "__driverCommandCallback", "__driverCommandQueue"]);

    //
    // HACK NOTE:
    //
    // Initialize mocha timeout with rubbish, so we can detect not-customized timeouts later.
    // All tests, hook & suites with timeout() == MAGIC_TIMEOUT have it overriden later in
    // `applyMochaOptions` when actual timeout value is received from driver.
    //
    mocha.timeout(MAGIC_TIMEOUT);

    mocha.run = function(fn?: ((failures: number) => void | undefined)): Mocha.Runner {

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

        return undefined!;
    };

    runnerBackChannel.postMessage(<MochaReadyMessage>{
        type: "mocha-ready"
    });
}

/**
 * @deprecated use [[addMochaSource]]
 */
export const install = addMochaSource;
