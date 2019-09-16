import * as sinon from "sinon";
import * as Mocha from "mocha";

import * as chai from "chai";
const assert = chai.assert;

import * as PageEventQueue from "../lib-cov/page-event-queue";
import { MochaRemoteReporter } from "../lib-cov/MochaRemoteReporter";
import { createMochaStateSynchronizer } from "../lib-cov/suite-synchronizer";
import { RemoteRunnerMessage } from "../lib-cov/RemoteRunnerProtocol";

describe.only("MochaWebDriverReporter", function() {
    let sandbox: sinon.SinonSandbox;

    beforeEach(function() {
        sandbox = sinon.createSandbox();
    });

    afterEach(function() {
        sandbox.restore();
    });

    it("captures events and passes to page-event-queue", function(done) {
        const mocha = new Mocha();
        mocha.addFile(__dirname + "/sample-suite/tests.js");
        mocha.reporter(MochaRemoteReporter as any);
        const emitPageEventStub = sandbox.stub(PageEventQueue, "emitPageEvent");
        const runnerEvents: any[] = [];
        const synchronizer = createMochaStateSynchronizer();
        emitPageEventStub.callsFake((event: MessageEvent) => {
            assert.equal(event.type, "message");
            assert.exists(event.data);
            const message: RemoteRunnerMessage = event.data;
            assert.include(["mocha-runner-event", "coverage-result"], message.type);
            if (message.type === "mocha-runner-event") {
                runnerEvents.push(synchronizer.decodePacket(message.event));
            }
        });
        mocha.run((failures: number) => {
            assert.equal(failures, 2);
            //console.log("events", events);
            const lastEvent = runnerEvents[runnerEvents.length - 1];
            assert.equal(lastEvent.type, "end");
            assert.equal(lastEvent.failures, 2);
            assert.equal(lastEvent.passes, 5);
            done();
        });
    });
});
