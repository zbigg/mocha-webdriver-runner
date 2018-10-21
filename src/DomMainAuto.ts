import {
    UnhandledExceptionMessage,
    MochaFinishedMessage,
    RemoteBootstrapParams
} from "./RemoteRunnerProtocol";

declare const MochaWebdriverClient: typeof import('./index.web');

declare global {
    interface Window {
        emitPageEvent: any;
    }
}

export interface DomAutoMainOptions extends RemoteBootstrapParams {
    mode: 'dom' | 'web-worker';
    bootstrapScriptsDom?: string[];
}

/**
 * The in-browser main in auto mode.
 *
 * Context: Dom/Browser
 */
export function domAutoMain(env: DomAutoMainOptions) {
    function loadScript(scriptUrl: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const doLoadScript = function() {
                var script = document.createElement("script");
                script.onload = function() {
                    resolve();
                };
                script.onerror = function(event: ErrorEvent) {
                    reject(new Error(`Failed to load script: ${event.error || event.message}`));
                };
                script.src = scriptUrl;

                document.head!.appendChild(script);
            };
            if (!document) {
                window.addEventListener("load", doLoadScript);
            } else {
                doLoadScript();
            }
        });
    }

    function runTasks(tasks: Array<() => Promise<void>>): Promise<void> {
        if (tasks.length === 0) {
            return Promise.resolve();
        }
        const task = tasks.shift()!;
        return Promise.resolve(task()).then(() => runTasks(tasks));
    }

    function reportErrorRaw(error: Error) {
        window.emitPageEvent({
            type: "message",
            data: <UnhandledExceptionMessage>{
                type: "err-unhandled-exception",
                message: error.message,
                // manually serialized error
                error: {
                    root: {
                        type: "error",
                        value: {
                            message: error.message,
                            stack: error.stack
                        }
                    },
                    objects: {}
                }
            }
        });
    }

    function bootstrapDomEnv() {
        //const baseUrl = env.baseUrl || "";
        const tasks: Array<() => Promise<void>> = [];
        if (!env.bootstrapScripts) {
            throw new Error("no bootstrap scripts!");
        }
        env.bootstrapScripts.forEach(scriptUrl => {
            tasks.push(() => loadScript(scriptUrl));
        });
        tasks.push(() => {
            if (typeof mocha === "undefined") {
                throw new Error("global object 'mocha' not available after bootstrap");
            }
            if (typeof MochaWebdriverClient === "undefined") {
                throw new Error("global object 'MochaWebdriverClient' not available after bootstrap");
            }
            MochaWebdriverClient.installConsoleLogForwarder();
            mocha.setup({
                ui: "bdd"
            });
            MochaWebdriverClient.addMochaSource(mocha);
            return Promise.resolve();
        });

        env.tests.forEach(scriptUrl => {
            tasks.push(() => loadScript(scriptUrl));
        });

        tasks.push(() => {
            mocha.checkLeaks();
            mocha.run(function() {
                MochaWebdriverClient.runnerBackChannel.postMessage(<MochaFinishedMessage>{ type: "mocha-finished" });
            });
            return Promise.resolve();
        });
        runTasks(tasks).catch(error => {
            reportErrorRaw(error);
        });
    }

    function bootstrapWorkerEnv() {
        const tasks: Array<() => Promise<void>> = [];
        if (!env.bootstrapScriptsDom) {
            throw new Error('bootstrapScriptsDom not defined in worker mode!');
        }
        env.bootstrapScriptsDom.forEach(scriptUrl => {
            tasks.push(() => loadScript(scriptUrl));
        });
        tasks.push(() => {
            if (MochaWebdriverClient === undefined) {
                throw new Error("global object 'MochaWebdriverClient' not available after bootstrap");
            }
            MochaWebdriverClient.installConsoleLogForwarder();
            MochaWebdriverClient.runWorkerTestsAuto({
                tests: env.tests,
                bootstrapScripts: env.bootstrapScripts
            });
            return Promise.resolve();
        });
        runTasks(tasks).catch(error => {
            reportErrorRaw(error);
        });
    }
    try {
        if (env.mode === 'dom') {
            bootstrapDomEnv();
        } else {
            bootstrapWorkerEnv();
        }
    } catch(error) {
        reportErrorRaw(error);
    }
}
