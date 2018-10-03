import { Runner, MochaGlobals } from "mocha";
import { emitPageEvent } from "./page-event-queue";
import { createMochaStateSynchronizer } from "./suite-synchronizer"

declare global {
    interface Window {
        mocha: Mocha;
        Mocha: MochaGlobals;
    }
}

export class MochaSeleniumReporter {
    constructor(runner: Runner) {
        let passes = 0;
        let failures = 0;

        const synchronizer = createMochaStateSynchronizer();

        runner.on("start", function() {
            emitPageEvent({
                type: "start",
                suite: synchronizer.write(runner.suite)
            });
        });

        runner.on("suite", function(suite) {
            emitPageEvent({
                type: "suite",
                suite: synchronizer.write(suite)
            });
        });
        runner.on("suite end", function() {
            emitPageEvent({ type: "suite end" });
        });

        runner.on("test end", function(test) {
            emitPageEvent({
                type: "test end",
                test: synchronizer.write(test)
            });
        });

        runner.on("pending", function(test) {
            emitPageEvent({
                type: "pending",
                test: synchronizer.write(test)
            });
        });

        runner.on("pass", function(test) {
            passes++;
            emitPageEvent({
                type: "pass",
                test: synchronizer.write(test)
            });
        });

        runner.on("fail", function(test, err) {
            failures++;

            emitPageEvent({
                type: "fail",
                test: synchronizer.write(test),
                err: synchronizer.write(err)
            });
        });

        runner.on("end", function() {
            emitPageEvent({
                type: "end",
                passes: passes,
                failures: failures
            });
        });
    }
}
