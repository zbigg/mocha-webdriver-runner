import { MochaSeleniumReporter } from "./mocha-selenium-reporter";
import { fetchPageCommand, emitPageEvent } from "./page-event-queue";
import { serialize } from "@zbigg/treesync";

export { MochaSeleniumReporter as Reporter } from "./mocha-selenium-reporter";
export { emitPageEvent } from "./page-event-queue";

/**
 * Setups `mocha` instance to send events to
 *  - use [[MochaSeleniumReporter]]
 *  - receive options form `mocha-selenium-runner`
 *
 * Usage:
 *
 *     mocha.setup(...);
 *     MochaSeleniumClient.install(mocha);
 *     // load tests
 *     mocha.run(...);
 *
 * @param mocha
 */
export function install(mocha: Mocha) {
    mocha.reporter(MochaSeleniumReporter as any);
    const originalMochaRun = mocha.run;

    mocha.globals(["__pageEventQueue", "__pageEventCallback", "__driverCommandCallback", "__driverCommandQueue"]);

    mocha.run = function(fn?: ((failures: number) => void | undefined)): Mocha.Runner {
        // TODO: really hacky solution, rewrite somehow
        function doStartMocha(options: any) {
            console.log("mocha-selenium-client: starting mocha with options", options);
            if (options.grep) {
                mocha.grep(options.grep);
            }
            originalMochaRun.call(mocha, fn);
        }
        function processCommand(command: any) {
            if ((command.type == "start-mocha-tests", command.mochaOptions)) {
                doStartMocha(command.mochaOptions);
            } else {
                fetchPageCommand().then(processCommand);
            }
        }
        fetchPageCommand().then(processCommand);

        return undefined!;
    };
}

const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error
};
function pageEventLogger(level: "log" | "info" | "warn" | "error") {
    return function(...args: any[]) {
        originalConsole[level].apply(console, args);
        emitPageEvent({ type: "log", level, args: serialize(args) });
    };
}

console.log = pageEventLogger("log");
console.info = pageEventLogger("info");
console.warn = pageEventLogger("warn");
console.error = pageEventLogger("error");
