import * as sinon from "sinon";
import * as Mocha from "mocha";

import * as ChaiThings from "chai-things";
import * as chai from "chai";
chai.should();
chai.use(ChaiThings);
const assert = chai.assert;

import * as PageEventQueue from "../src/page-event-queue";
import { MochaRemoteReporter } from "../src/MochaRemoteReporter";
import { createMochaStateSynchronizer } from "../src/suite-synchronizer";
import { AssertionError } from "assert";
import { MochaRunnerEventMessage, RemoteRunnerMessage } from "../src/RemoteRunnerProtocol";

describe("MochaWebDriverReporter", function() {
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
        const events: any[] = [];
        const synchronizer = createMochaStateSynchronizer();
        emitPageEventStub.callsFake((event: MessageEvent) => {
            assert.equal(event.type, "message");
            assert.exists(event.data);
            const message: RemoteRunnerMessage = event.data
            assert.equal(message.type, 'mocha-runner-event');
            if (message.type === "mocha-runner-event") {
                events.push(synchronizer.decodePacket(message.event));
            }
        });
        mocha.run((failures: number) => {
            failures.should.equal(2);
            events.should.include.something.that.deep.equals({
                type: "end", failures: 2, passes: 5
            });
            done();
        });
    });
});
