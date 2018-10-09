#!/usr/bin/env node

import * as commander from "commander";
import * as fs from "fs";
import * as mocha from "mocha";
import * as path from "path";
import { Builder, WebDriver } from "selenium-webdriver";

import { fetchPageEvents, queuePageCommand } from "./page-event-queue";
import { createMochaStateSynchronizer } from "./suite-synchronizer";
import { deserialize } from "@zbigg/treesync";

async function withWebDriver<T>(test: (driver: WebDriver) => T) {
    let theDriver: WebDriver | undefined;
    return Promise.resolve(
        new Builder().build().then(async driver => {
            theDriver = driver;
            const result = await test(driver);
            await driver.quit();
            theDriver = undefined;
            return result;
        })
    ).catch(async (error: Error) => {
        if (theDriver !== undefined) {
            try {
                await theDriver.quit();
            } catch (error) {
                console.log("withWebDriver: error while quiting WebDriver session", error);
            }
        }
        throw error;
    });
}

interface Options {
    reporter?: string;
    reporterOptions?: any;
    delay?: boolean;
    grep?: string;
}

function getReporterConstructor(options: Options) {
    const reporterDef = options.reporter || "spec";
    if (typeof reporterDef === "string") {
        const mochaBuiltinReporters = mocha.reporters;

        const builtinReporter = (mochaBuiltinReporters as any)[reporterDef];
        if (typeof builtinReporter === "function") {
            return builtinReporter;
        }

        const customReporter = require(reporterDef);
        if (typeof customReporter === "function") {
            return customReporter;
        }
    }

    if (typeof reporterDef === "function") {
        return reporterDef;
    } else {
        throw new Error(`unknown reporter: ${reporterDef}`);
    }
}

async function runMochaTest(url: string, options: Options): Promise<boolean> {
    const synchronizer = createMochaStateSynchronizer();

    const reporterConstructor = getReporterConstructor(options);

    let runner: mocha.Runner | undefined;
    let reporter: mocha.Reporter | undefined;

    return withWebDriver(async driver => {
        await driver.get(url);
        let finished: boolean = false;
        let exitCode: number | undefined;
        let failures: number = 0;
        await queuePageCommand(driver, {
            type: "start-mocha-tests",
            mochaOptions: {
                grep: options.grep
            }
        });

        while (!finished) {
            const events = await fetchPageEvents(driver);
            for (const event of events) {
                if (event.type === "log") {
                    let args = deserialize(event.args) as any;
                    args = [`[browser] ${event.level}:`].concat(args);
                    (console as any)[event.level].apply(console, args);
                } else if (event.type === "start") {
                    const suite = synchronizer.decodePacket(event.suite);
                    runner = new mocha.Runner(suite, options.delay === true);
                    reporter = new reporterConstructor(runner, options);
                    runner.emit("start");
                } else if (event.type === "suite") {
                    runner!.emit("suite", synchronizer.decodePacket(event.suite));
                } else if (event.type === "suite end") {
                    runner!.emit("suite end");
                } else if (event.type === "test") {
                    runner!.emit("test", synchronizer.decodePacket(event.test));
                } else if (event.type === "test end") {
                    runner!.emit("test end", synchronizer.decodePacket(event.test));
                } else if (event.type === "pass") {
                    runner!.emit("pass", synchronizer.decodePacket(event.test));
                } else if (event.type === "fail") {
                    runner!.emit("fail", synchronizer.decodePacket(event.test), synchronizer.decodePacket(event.err));
                } else if (event.type === "end") {
                    runner!.emit("end");
                    finished = true;
                    failures = event.failures;
                    exitCode = event.failures === 0 ? 0 : 1;
                } else if (event.type === "pending") {
                    runner!.emit("pending", synchronizer.decodePacket(event.test));
                } else {
                    console.error("runMochaTest: invalid event received from page", event.type || event);
                }
            }
        }

        // if reporters has 'done', then we shall call it
        // (mochawesome relies on this).
        const reporterDone = reporter && (reporter as any).done;
        if (typeof reporterDone === "function") {
            return new Promise<boolean>(resolve => {
                reporterDone.call(reporter, failures, () => {
                    resolve(exitCode === 0);
                });
            });
        } else {
            return exitCode === 0;
        }
    });
}

/**
 * Parse `mocha --reporter-options OPTIONS string.
 */
function parseReporterOptions(optionsString?: string) {
    if (!optionsString) {
        return undefined;
    }
    const result: any = {};
    optionsString.split(",").forEach(opt => {
        const parsed = opt.split("=");
        if (parsed.length > 2 || parsed.length === 0) {
            throw new Error(`invalid reporter option '${opt}'`);
        } else if (parsed.length === 2) {
            result[parsed[0]] = parsed[1];
        } else {
            result[parsed[0]] = true;
        }
    });
    return result;
}

const version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version;

commander
    .version(version)
    .usage("[debug] [options] URL")
    .option("-O, --reporter-options <k=v,k2=v2,...>", "reporter-specific options")
    .option("-R, --reporter <name>", "specify the reporter to use", "spec")
    .option("-g, --grep <pattern>", "only run tests/suites that match pattern");

commander.parse(process.argv);

const args = commander.args;
if (args.length < 1) {
    commander.outputHelp();
    throw new Error("mocha-selenium: URL needed");
}

const url = commander.args.shift()!;
const cliOptions = commander.opts();
const options = {
    reporter: cliOptions.reporter,
    reporterOptions: parseReporterOptions(cliOptions.reporterOptions),
    grep: cliOptions.grep
};

runMochaTest(url, options).then(result => {
    if (result) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});
