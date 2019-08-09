import { assert } from "chai";
import * as Mocha from "mocha";
import * as fs from "fs";
import * as xpath from "xpath";
// import * as xmldom from 'xmldom';
const xmldom = require("xmldom");

import { runMochaWebDriverTest } from "../src/MochaWebDriverRunner";

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
    },
    {
        name: "firefox-headless",
        capabilities: {
            browserName: "firefox",
            "moz:firefoxOptions": {
                args: ["-headless"]
            }
        }
    }
];

browserConfigurations.forEach(entry => {
    const capabilities = entry.capabilities as any;
    describe(`MochaWebDriverRunner @${entry.name}`, function() {
        describe("Mocha xunit reporter support", function() {
            const xunitTmpFile = "xunit-tmp.xml";

            const runTestOptions = {
                reporter: "xunit",
                reporterOptions: {
                    output: xunitTmpFile,
                    suiteName: "Test Suite Name"
                }
            };
            beforeEach(function() {
                if (fs.existsSync(xunitTmpFile)) {
                    fs.unlinkSync(xunitTmpFile);
                }
            });
            afterEach(function() {
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

            it("generates correct xunit output from browser test", async function() {
                this.timeout(20000);
                const testResult = await runMochaWebDriverTest(
                    capabilities,
                    "file://" + __dirname + "/sample-suite/index-headless.html",
                    runTestOptions
                );
                assert.equal(testResult, false);
                xunitSuiteAsserts();
            });
            it("generates correct xunit output from worker auto test", async function() {
                this.timeout(20000);
                const testResult = await runMochaWebDriverTest(
                    capabilities,
                    "file://" + __dirname + "/sample-suite/worker-test-auto.html",
                    runTestOptions
                );
                assert.equal(testResult, false);
                xunitSuiteAsserts();
            });
        });
        describe("timeout support", function() {
            this.timeout(42000);

            it("fails on timeout", async function() {
                this.timeout(20000);
                const testResult = await runMochaWebDriverTest(
                    capabilities,
                    "file://" + __dirname + "/sample-suite/headless-timeout.html",
                    {
                        reporter: NullReporter
                    }
                );
                assert.equal(testResult, false);
            });
            it("supports timeout override", async function() {
                this.timeout(20000);
                const testResult = await runMochaWebDriverTest(
                    capabilities,
                    "file://" + __dirname + "/sample-suite/headless-timeout.html",
                    {
                        reporter: NullReporter,
                        timeout: 3000
                    }
                );
                assert.equal(testResult, true);
            });
        });
    });
});
