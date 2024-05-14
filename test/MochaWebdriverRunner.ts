import { assert } from "chai";
import * as sinon from "sinon";

import * as Mocha from "mocha";
import * as fs from "fs";
import * as xpath from "xpath";
// import * as xmldom from 'xmldom';
const xmldom = require("xmldom");

import { runMochaWebDriverTest } from "../src/MochaWebDriverRunner";
import { Options } from "../src/MochaRemoteRunner";

class NullReporter extends Mocha.reporters.Base {
    constructor(runner: Mocha.Runner) {
        super(runner);
    }
}

const browserConfigurations = [
    {
        name: "chrome-headless",
        capabilities: {
            browserName: "chrome",
            "goog:chromeOptions": {
                args: ["--headless", "--window-size=300,300"]
            }
        }
    }
    // {
    //     name: "firefox-headless",
    //     capabilities: {
    //         browserName: "firefox",
    //         "moz:firefoxOptions": {
    //             args: ["-headless"]
    //         }
    //     }
    // }
];

browserConfigurations.forEach((entry) => {
    const capabilities = entry.capabilities as any;
    describe(`MochaWebDriverRunner @${entry.name}`, function () {
        describe("Mocha xunit reporter support", function () {
            const xunitTmpFile = "xunit-tmp.xml";

            const runTestOptions: Options = {
                reporter: "xunit",
                reporterOptions: {
                    output: xunitTmpFile,
                    suiteName: "Test Suite Name"
                },
                globalsToSave: ["someResult"],
                globals: ["someResult"]
            };
            beforeEach(function () {
                if (fs.existsSync(xunitTmpFile)) {
                    fs.unlinkSync(xunitTmpFile);
                }
            });
            afterEach(function () {
                if (fs.existsSync(xunitTmpFile)) {
                    fs.unlinkSync(xunitTmpFile);
                }
            });

            function xunitSuiteAsserts() {
                const resultFileContent = fs.readFileSync(xunitTmpFile, "utf-8");
                const domParser = new xmldom.DOMParser();
                const resultDom = domParser.parseFromString(resultFileContent);

                const suiteResult = xpath.select("//testsuite", resultDom);
                assert.equal(suiteResult.length, 1);

                const suiteElement = suiteResult[0] as Element;
                assert.equal(suiteElement.nodeName, "testsuite");
                assert.equal(suiteElement.getAttribute("name"), "Test Suite Name");
                assert.equal(suiteElement.getAttribute("tests"), "9");
                assert.equal(suiteElement.getAttribute("errors"), "2");
                assert.equal(suiteElement.getAttribute("skipped"), "2");

                const tests = xpath.select("//testcase", suiteElement);
                assert.equal(tests.length, 9);
            }

            it("generates correct xunit output from browser test", async function () {
                this.timeout(20000);
                const testResult = await runMochaWebDriverTest(
                    capabilities,
                    "file://" + __dirname + "/sample-suite/index-headless.html",
                    runTestOptions
                );
                assert.equal(testResult.success, false);
                assert.isDefined(testResult.dumpedGlobals.someResult);
                xunitSuiteAsserts();
            });
            it("generates correct xunit output from worker auto test", async function () {
                this.timeout(20000);
                const testResult = await runMochaWebDriverTest(
                    capabilities,
                    "file://" + __dirname + "/sample-suite/worker-test-auto.html",
                    runTestOptions
                );
                assert.equal(testResult.success, false);
                assert.isDefined(testResult.dumpedGlobals.someResult);
                xunitSuiteAsserts();
            });
        });
        describe("timeout support", function () {
            this.timeout(42000);

            it("fails on timeout", async function () {
                this.timeout(20000);
                const testResult = await runMochaWebDriverTest(
                    capabilities,
                    "file://" + __dirname + "/sample-suite/headless-timeout.html",
                    {
                        reporter: NullReporter
                    }
                );
                assert.equal(testResult.success, false);
            });
            it("supports timeout override", async function () {
                this.timeout(20000);
                const testResult = await runMochaWebDriverTest(
                    capabilities,
                    "file://" + __dirname + "/sample-suite/headless-timeout.html",
                    {
                        reporter: NullReporter,
                        timeout: 3000
                    }
                );
                assert.equal(testResult.success, true);
            });
        });

        describe("capture console logs supports", function () {
            let sandbox: sinon.SinonSandbox;
            const logLevels: (keyof Console)[] = ["log", "error"];
            beforeEach(function () {
                sandbox = sinon.createSandbox();
            });
            afterEach(function () {
                sandbox.restore();
            });

            it("captures logs by default", async function () {
                const spies = logLevels.map((name) => sandbox.spy(console, name));
                this.timeout(20000);
                const testResult = await runMochaWebDriverTest(
                    capabilities,
                    "file://" + __dirname + "/sample-suite/log-capture.html",
                    {
                        reporter: NullReporter
                    }
                );
                assert.equal(testResult.success, true);
                logLevels.forEach((name, i) => {
                    assert.isTrue(
                        spies[i].calledWith(`[browser] ${name}:`, `sample console.${name}`),
                        `expected 'sample console.${name}' message to be captured`
                    );
                });
            });
            it("doesn't capture logs by if disabled", async function () {
                this.timeout(20000);
                const spies = logLevels.map((name) => sandbox.spy(console, name));
                const testResult = await runMochaWebDriverTest(
                    capabilities,
                    "file://" + __dirname + "/sample-suite/log-capture.html",
                    {
                        reporter: NullReporter,
                        captureConsoleLog: false
                    }
                );
                assert.equal(testResult.success, true);
                logLevels.forEach((name, i) => {
                    assert.isFalse(
                        spies[i].calledWith(`[browser] ${name}:`, `sample console.${name}`),
                        `expected 'sample console.${name}' message to be captured`
                    );
                });
            });
        });
    });
});
