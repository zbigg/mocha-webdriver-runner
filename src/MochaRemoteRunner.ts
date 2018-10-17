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
}

export function runRemoteMochaTest(messagePort: MessagePort, options: Options): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        const captureConsoleLog = options.captureConsoleLog !== false;
        const reporterConstructor = getReporterConstructor(options!);

        const synchronizer = createMochaStateSynchronizer();
        let runner: mocha.Runner | undefined;
        let reporter: mocha.Reporter | undefined;

        let started: boolean = false;

        function processRunnerEvent(event: MochaRunnerEvent) {
            if (event.type === "start") {
                runner = new mocha.Runner(event.suite!, options.delay === true);
                reporter = new reporterConstructor(runner, options);
                runner.emit("start");
                started = true;
            } else if (event.type === "suite") {
                runner!.emit("suite", event.suite);
            } else if (event.type === "suite end") {
                runner!.emit("suite end");
            } else if (event.type === "test") {
                runner!.emit("test", event.test);
            } else if (event.type === "test end") {
                runner!.emit("test end", event.test);
            } else if (event.type === "pass") {
                runner!.emit("pass", event.test);
            } else if (event.type === "fail") {
                runner!.emit("fail", event.test, event.err);
            } else if (event.type === "end") {
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
            if (message.type === "log" && captureConsoleLog) {
                const args = [`[browser] ${message.level}:`].concat(decodeMessage(message.args));
                (console as any)[message.level].apply(console, args);
            } else if (message.type === "mocha-runner-event" ) {
                processRunnerEvent(synchronizer.decodePacket(message.event));
            } else if (message.type === "err-aborted") {
                if (started) {
                    // TODO: ???
                }
                const error = decodeMessage(message.error);
                if (error) {
                    console.error(error);
                }
                cleanup();
                reject(new Error(message.message));
            } else if (message.type === "err-unhandled-exception") {
                console.error(message.message);
                const error = decodeMessage(message.error);
                if (error) {
                    console.error(error);
                }
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
            messagePort.postMessage(<MochaRunMessage>{
                type: "mocha-run",
                mochaOptions: {
                    grep: options.grep,
                    captureConsoleLog: captureConsoleLog
                }
            });

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
                    resolve(failures === 0);
                });
            } else {
                resolve(failures === 0);
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