import { Runner, MochaGlobals } from "mocha";
import { emitPageEvent } from "./page-event-queue";
import { createMochaStateSynchronizer } from "./suite-synchronizer"

declare global {
    interface Window {
        mocha: Mocha;
        Mocha: MochaGlobals;
    }
}

/**
 * This reporter sends all events received from `runner` to
 * `mocha-selenium-driver` through `page-event-queue`.
 *
 * Objects are serialized using `suite-synchronizer`.
 */
export class MochaSeleniumReporter {
    constructor(runner: Runner) {
        let passes = 0;
        let failures = 0;

        const synchronizer = createMochaStateSynchronizer();

        runner.on("start", function() {
            emitPageEvent({
                type: "start",
                suite: synchronizer.buildPacket(runner.suite)
            });
        });

        runner.on("suite", function(suite) {
            emitPageEvent({
                type: "suite",
                suite: synchronizer.buildPacket(suite)
            });
        });
        runner.on("suite end", function() {
            emitPageEvent({ type: "suite end" });
        });

        runner.on("test", function(test) {
            emitPageEvent({
                type: "test",
                test: synchronizer.buildPacket(test)
            });
        });

        runner.on("test end", function(test) {
            emitPageEvent({
                type: "test end",
                test: synchronizer.buildPacket(test)
            });
        });

        runner.on("pending", function(test) {
            emitPageEvent({
                type: "pending",
                test: synchronizer.buildPacket(test)
            });
        });

        runner.on("pass", function(test) {
            passes++;
            emitPageEvent({
                type: "pass",
                test: synchronizer.buildPacket(test)
            });
        });

        runner.on("fail", function(test, err) {
            failures++;

            emitPageEvent({
                type: "fail",
                test: synchronizer.buildPacket(test),
                err: synchronizer.buildPacket(err)
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
