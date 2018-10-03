import { EventEmitter } from "events";
import * as mocha from "mocha";
import { Builder, WebDriver } from "selenium-webdriver";
import { fetchPageEvents } from "./page-event-queue";

/*
class FakeRunner extends EventEmitter  implements Mocha.Runner {
    suite: mocha.Suite;
    started: boolean;
    total: number;
    failures: number;
    asyncOnly?: boolean | undefined;
    allowUncaught?: boolean | undefined;
    fullStackTrace?: boolean | undefined;
    forbidOnly?: boolean | undefined;
    forbidPending?: boolean | undefined;
    ignoreLeaks?: boolean | undefined;
    test?: mocha.Test | undefined;
    currentRunnable?: mocha.Runnable | undefined;
    stats?: mocha.Stats | undefined;

    grep(re: RegExp, invert: boolean): this {
        throw new Error("Method not implemented.");
    }
    grepTotal(suite: mocha.Suite | mocha.ISuite): number {
        throw new Error("Method not implemented.");
    }
    globals(): string[];
    globals(arr: ReadonlyArray<string>): this;
    globals(arr?: any): any {
        throw new Error("Method not implemented.");
    }
    run(fn?: ((failures: number) => void) | undefined): this {
        throw new Error("Method not implemented.");
    }
    abort(): this {
        throw new Error("Method not implemented.");
    }
    uncaught(err: any): void {
        throw new Error("Method not implemented.");
    }
    protected globalProps(): string[] {
        throw new Error("Method not implemented.");
    }
    protected checkGlobals(test: mocha.Test): void {
        throw new Error("Method not implemented.");
    }
    protected fail(test: mocha.Test, err: any): void {
        throw new Error("Method not implemented.");
    }
    protected failHook(hook: mocha.Hook, err: any): void {
        throw new Error("Method not implemented.");
    }
    protected hook(name: string, fn: () => void): void {
        throw new Error("Method not implemented.");
    }
    protected hooks(name: string, suites: mocha.Suite[], fn: (err?: any, errSuite?: mocha.Suite | undefined) => void): void {
        throw new Error("Method not implemented.");
    }
    protected hookUp(name: string, fn: (err?: any, errSuite?: mocha.Suite | undefined) => void): void {
        throw new Error("Method not implemented.");
    }
    protected hookDown(name: string, fn: (err?: any, errSuite?: mocha.Suite | undefined) => void): void {
        throw new Error("Method not implemented.");
    }
    protected parents(): mocha.Suite[] {
        throw new Error("Method not implemented.");
    }
    protected runTest(fn: mocha.Done) {
        throw new Error("Method not implemented.");
    }
    protected runTests(suite: mocha.Suite, fn: (errSuite?: mocha.Suite | undefined) => void): void {
        throw new Error("Method not implemented.");
    }
    protected runSuite(suite: mocha.Suite, fn: (errSuite?: mocha.Suite | undefined) => void): void {
        throw new Error("Method not implemented.");
    }
}

*/

async function withWebDriver<T>(test: (driver: WebDriver) => T) {
    let theDriver: WebDriver | undefined;
    return Promise.resolve(
        new Builder().build().then(async driver => {
            theDriver = driver;
            // console.log("driver connected");
            const result = await test(driver);
            // console.log("ok!");
            await driver.quit();
            theDriver = undefined;
            return result;
        })
    ).catch(async (error: Error) => {
        // ensure that driver always quits
        // console.error("croak", error);
        if (theDriver !== undefined) {
            await theDriver.quit();
        }
        throw error;
    });
}

interface Options {
    reporter?: string;
    reporterOptions?: any;
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

    const runnerEventEmitter: any = new EventEmitter();

    // consr runner = new Mocha.Runner()
    const reporterConstructor = getReporterConstructor(options);
    const reporter = new reporterConstructor(runnerEventEmitter as mocha.Runner, options);

    return withWebDriver(async driver => {
        await driver.get(url);
        let finished: boolean = false;
        let exitCode: number | undefined;

        while (!finished) {
            const events = await fetchPageEvents(driver);
            for (const event of events) {
                if (event.type === "start") {
                    runnerEventEmitter.suite = synchronizer.recv(event.suite);
                    runnerEventEmitter.emit("start");
                } else if (event.type === "suite") {
                    runnerEventEmitter.emit("suite", synchronizer.recv(event.suite));
                } else if (event.type === "suite end") {
                    runnerEventEmitter.emit("suite end");
                } else if (event.type === "test end") {
                    runnerEventEmitter.emit("test end", synchronizer.recv(event.test));
                } else if (event.type === "pass") {
                    runnerEventEmitter.emit("pass", synchronizer.recv(event.test));
                } else if (event.type === "fail") {
                    runnerEventEmitter.emit("fail", synchronizer.recv(event.test), synchronizer.recv(event.err));
                } else if (event.type === "end") {
                    runnerEventEmitter.emit("end");
                    finished = true;
                    exitCode = event.failures === 0 ? 0 : 1;
                } else if (event.type === "pending") {
                    runnerEventEmitter.emit("pending", synchronizer.recv(event.test));
                } else {
                    console.error("invalid command", event.type || event);
                }
            }
        }

        return exitCode === 0;
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

//const commander = require("commander");
import * as commander from "commander";
import * as fs from "fs";
import * as path from "path";
import { createMochaStateSynchronizer } from "./suite-synchronizer";

const version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version;

commander
    .version(version)
    .usage("[debug] [options] URL")
    .option("-O, --reporter-options <k=v,k2=v2,...>", "reporter-specific options")
    .option("-R, --reporter <name>", "specify the reporter to use", "spec");

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
    reporterOptions: parseReporterOptions(cliOptions.reporterOptions)
};

runMochaTest(url, options).then(result => {
    if (result) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});
