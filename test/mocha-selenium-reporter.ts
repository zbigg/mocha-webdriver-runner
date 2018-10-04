import * as sinon from "sinon";
import * as Mocha from "mocha";

import * as ChaiThings from "chai-things";
import * as chai from "chai";
chai.should();
chai.use(ChaiThings);

import { MochaSeleniumReporter } from "../src/mocha-selenium-reporter";
// import { createMochaStateSynchronizer } from "../src/suite-synchronizer";
import * as PageEventQueue from "../src/page-event-queue";

describe("MochaSeleniumReporter", function() {
    let sandbox: sinon.SinonSandbox;

    beforeEach(function () {
        sandbox = sinon.createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    it("captures events and passes to page-event-queue", function(done) {
        const mocha = new Mocha();
        mocha.addFile(__dirname + "/sample-suite/tests.js");
        mocha.reporter(MochaSeleniumReporter as any);
        const emitPageEventStub = sandbox.stub(PageEventQueue, "emitPageEvent");
        const events: any[] = [];
        emitPageEventStub.callsFake((event: any) => {
            events.push(event);
        });
        mocha.run((failures: number) => {
            failures.should.equal(2);
            events.should.include.something.that.deep.equals({ type: "end", failures: 2, passes: 2 });
            done();
        });
    });
});
