import { Runner } from "mocha";
import { runnerBackChannel } from "./RemoteCommon";
import { createMochaStateSynchronizer } from "./suite-synchronizer";
import { MochaRunnerEvent, MochaRunnerEventMessage } from "./RemoteRunnerProtocol";

/**
 * This reporter sends all events received from `Mocha.Runner` to
 * [[runRemoteMochaTest]] through [[runnerBackChannel]].
 *
 * It sends messages of type `mocha-runner-event`, with event contens serialized using
 * `suite-synchronizer`.
 */
export class MochaRemoteReporter {
    constructor(runner: Runner) {
        let passes = 0;
        let failures = 0;

        const synchronizer = createMochaStateSynchronizer();

        function forwardRunnerEvent(event: MochaRunnerEvent) {
            runnerBackChannel.postMessage(<MochaRunnerEventMessage>{
                type: "mocha-runner-event",
                event: synchronizer.buildPacket(event)
            });
        }

        // TODO: hook events

        runner.on("start", function() {
            forwardRunnerEvent({
                type: "start",
                suite: runner.suite
            });
        });

        runner.on("suite", function(suite) {
            forwardRunnerEvent({
                type: "suite",
                suite
            });
        });

        runner.on("suite end", function(suite) {
            forwardRunnerEvent({
                type: "suite end",
                suite
            });
        });

        runner.on("test", function(test) {
            forwardRunnerEvent({
                type: "test",
                test
            });
        });

        runner.on("test end", function(test) {
            forwardRunnerEvent({
                type: "test end",
                test
            });
        });

        runner.on("pending", function(test) {
            forwardRunnerEvent({
                type: "pending",
                test
            });
        });

        runner.on("pass", function(test) {
            passes++;
            forwardRunnerEvent({
                type: "pass",
                test: test
            });
        });

        runner.on("fail", function(test, err) {
            failures++;

            forwardRunnerEvent({
                type: "fail",
                test,
                err
            });
        });

        runner.on("end", function() {
            forwardRunnerEvent({
                type: "end",
                passes: passes,
                failures: failures
            });
        });
    }
}
