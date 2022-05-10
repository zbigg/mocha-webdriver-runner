import * as mocha from "mocha";
import { RemoteRunnerOptions, MochaRunnerEvent, RemoteRunnerMessage, MochaRunMessage } from "./RemoteRunnerProtocol";
import { createMochaStateSynchronizer } from "./suite-synchronizer";
import { decodeMessage } from "@zbigg/treesync";

/**
 * Mocha Webdriver Runner options.
 */
export interface Options extends RemoteRunnerOptions {
    /**
     * Name or constructor of reporter.
     *
     * When name is string, it must be one of
     * * builtin mocha reporters: `spec`, `xunit`, `json` ...
     * * name of CommonJS module, which default export should be constructor of
     *   compliant `Mocha.Reporter` instance
     */
    reporter?: string | (new (runner: Mocha.Runner) => Mocha.reporters.Base);

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
     * If true, mocha in clients waits for `mocha-run` message with options.
     *
     * If options are passed with other channel (like query-string), mocha can start immediately
     * and this flag can be set to `false`.
     *
     * @default `true`
     */
    clientWaitsForOptions?: boolean;
}

export interface RemoteTestRunResult {
    success: boolean,
    dumpedGlobals: { [name: string]: any };
}

export function runRemoteMochaTest(messagePort: MessagePort, options: Options): Promise<RemoteTestRunResult> {
    return new Promise<RemoteTestRunResult>((resolve, reject) => {
        let result: RemoteTestRunResult = {
            success: false,
            dumpedGlobals: {}
        }
        const captureConsoleLog = options.captureConsoleLog !== false;
        const reporterConstructor = getReporterConstructor(options!);

        const synchronizer = createMochaStateSynchronizer();
        let runner: mocha.Runner | undefined;
        let reporter: mocha.Reporter | undefined;

        let started: boolean = false;

        function processRunnerEvent(event: MochaRunnerEvent) {
            if (event.type === "start") {
                runner = new mocha.Runner(event.suite!, options.delay === true);
                runner.stats = {
                    suites: 0,
                    tests: 0,
                    passes: 0,
                    pending: 0,
                    failures: 0
                };
                reporter = new reporterConstructor(runner, options);
                runner.emit("start");
                started = true;
            } else if (event.type === "suite") {
                runner!.emit("suite", event.suite);
            } else if (event.type === "suite end") {
                runner!.emit("suite end", event.suite);
            } else if (event.type === "test") {
                runner!.emit("test", event.test);
            } else if (event.type === "test end") {
                runner!.emit("test end", event.test);
            } else if (event.type === "pass") {
                runner!.emit("pass", event.test);
            } else if (event.type === "fail") {
                runner!.emit("fail", event.test, event.err);
            } else if (event.type === "end") {
                Object.assign(runner!.stats, event.stats || {});
                runner!.emit("end");
                end(event.failures || 0);
            } else if (event.type === "pending") {
                runner!.emit("pending", event.test);
            } else {
                console.error("#runRemoteMochaTest: invalid event received from page", event.type || event);
            }
        }

        function onMessage(event: MessageEvent) {
            const message = event.data as RemoteRunnerMessage;
            if (!message) {
                console.log("#runRemoteMochaTest: received empty event");
            }

            switch (message.type) {
                case "mocha-ready":
                    if (options.clientWaitsForOptions !== false) {
                        messagePort.postMessage(<MochaRunMessage>{
                            type: "mocha-run",
                            mochaOptions: {
                                grep: options.grep,
                                captureConsoleLog: captureConsoleLog,
                                timeout: options.timeout,
                                globalsToSave: options.globalsToSave
                            }
                        });
                    }
                    break;
                case "log":
                    if (!captureConsoleLog) {
                        return;
                    }
                    const args = [`[browser] ${message.level}:`].concat(decodeMessage(message.args));
                    (console as any)[message.level].apply(console, args);
                    break;

                case "var-dump":
                    const value = decodeMessage(message.value);
                    result.dumpedGlobals[message.name] = value;
                    break;

                case "err-unhandled-exception":
                    {
                        console.error(message.message);
                        const error = decodeMessage(message.error);
                        if (error) {
                            console.error(error);
                        }
                    }
                    break;
                case "mocha-runner-event":
                    processRunnerEvent(synchronizer.decodePacket(message.event));
                    break;
                case "err-aborted":
                    {
                        const error = decodeMessage(message.error);
                        if (error) {
                            console.error(error);
                        }
                        cleanup();
                        reject(new Error(message.message));
                    }
                    break;
                default:
                    console.error("#runRemoteMochaTest: invalid message received from page", message.type || event);
            }
        }

        function onErrorEvent(errorEvent: ErrorEvent) {
            const error = errorEvent.error || "missing error information";
            console.error(`[browser] Unhandled exception: ${error}`, error);
            if (!started) {
                reject(
                    new Error(`#runRemoteMochaTest: Unhandled exeption in remote context before test start: ${error}`)
                );
            }
        }

        function start() {
            messagePort.addEventListener("message", onMessage);
            messagePort.addEventListener("error", onErrorEvent);
        }

        function cleanup() {
            messagePort.removeEventListener("message", onMessage);
            messagePort.removeEventListener("error", onErrorEvent);
        }

        function end(failures: number) {
            cleanup();

            // If reporter has 'done', then we shall call it (mochawesome relies on this).
            const reporterDone = reporter && (reporter as any).done;
            if (typeof reporterDone === "function") {
                reporterDone.call(reporter, failures, () => {
                    result.success = failures === 0;
                    resolve(result);
                });
            } else {
                result.success = failures === 0;
                resolve(result);
            }
        }

        start();
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
