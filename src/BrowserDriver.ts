import { MochaRemoteReporter } from "./MochaRemoteReporter";
import { waitForRunnerOptions, applyMochaOptions, installGlobalErrorHandlers, runnerBackChannel } from "./RemoteCommon";
import { MochaReadyMessage, MochaFinishedMessage } from "./RemoteRunnerProtocol";

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

    mocha.run = function(fn?: ((failures: number) => void | undefined)): Mocha.Runner {
        // TODO: really hacky solution, rewrite somehow
        runnerBackChannel.postMessage(<MochaReadyMessage>{
            type: "mocha-ready"
        });

        waitForRunnerOptions().then(options => {
            applyMochaOptions(mocha, options);

            console.log("mocha-webdriver: starting mocha with options", options);
            originalMochaRun.call(mocha, (failures: number) => {
                runnerBackChannel.postMessage(<MochaFinishedMessage>{
                    type: "mocha-finished"
                    // TODO
                    // failures
                });
                if (fn) {
                    fn(failures);
                }
            });
        });

        return undefined!;
    };
}

/**
 * @deprecated use [[addMochaSource]]
 */
export const install = addMochaSource;
