import * as mocha from "mocha";
import { Builder, WebDriver, Capabilities } from "selenium-webdriver";

import { fetchPageEvents, queuePageCommand } from "./page-event-queue";
import { createMochaStateSynchronizer } from "./suite-synchronizer";
import { deserialize } from "@zbigg/treesync";

export async function withWebDriver<T>(capabilities: Object | Capabilities, test: (driver: WebDriver) => T) {
    let theDriver: WebDriver | undefined;
    return Promise.resolve(
        new Builder()
            .withCapabilities(capabilities)
            .build()
            .then(async driver => {
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

/**
 * Mocha Selenium Runner options.
 */
export interface Options {
    /**
     * Name or constructor of reporter.
     *
     * When name is string, it must be one of
     * * builtin mocha reporters: `spec`, `xunit`, `json` ...
     * * name of CommonJS module, which default export should be constructor of
     *   compliant `Mocha.Reporter` instance
     */
    reporter?: string | (new () => Mocha.Reporter);

    /**
     * Reporter options object.
     *
     * Each reporter has custom options, for example
     *  * `xunit` reporter supports
     *      * `output: string` - a file name to which report shoult be generated
     *      * `suiteName: string` - root suite name which defaults to `Mocha Tests`
     */
    reporterOptions?: any;

    /**
     * Delay test execution (TBD)!
     */
    delay?: boolean;

    /**
     * Run only tests than name matches `grep` expression.
     */
    grep?: string | RegExp;

    /**
     * Capture `console.log` (and other) messages executed in browser context.
     *
     * Defaults to `true`.
     */
    captureConsoleLog?: boolean;
}

/**
 * Run Mocha tests using `webDriver` (instance or `Capabilities` used to build instance).
 * @param webDriver
 * @param url
 * @param options
 */
export async function runMochaWebDriverTest(webDriver: WebDriver | Capabilities, url: string, options?: Options): Promise<boolean> {
    if (!(webDriver instanceof WebDriver)) {
        return withWebDriver(webDriver, (driver: WebDriver) => {
            return runMochaWebDriverTest(driver, url, options);
        });
    }

    options = options || {};

    const synchronizer = createMochaStateSynchronizer();

    const reporterConstructor = getReporterConstructor(options);

    let runner: mocha.Runner | undefined;
    let reporter: mocha.Reporter | undefined;

    await webDriver.get(url);

    let finished: boolean = false;
    let exitCode: number | undefined;
    let failures: number = 0;

    const captureConsoleLog = options.captureConsoleLog !== false;
    await queuePageCommand(webDriver, {
        type: "start-mocha-tests",
        mochaOptions: {
            grep: options.grep,
            captureConsoleLog: captureConsoleLog
        }
    });

    while (!finished) {
        const events = await fetchPageEvents(webDriver);
        for (const event of events) {
            if (event.type === "log" && captureConsoleLog) {
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
                console.error("runMochaWebDriverTest: invalid event received from page", event.type || event);
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
}
