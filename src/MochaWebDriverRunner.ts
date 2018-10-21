import { Builder, WebDriver, Capabilities } from "selenium-webdriver";
import * as fs from "fs";
import * as path from "path";

import { WebDriverMessagePort } from "./WebDriverMessagePort";
import { Options, runRemoteMochaTest } from "./MochaRemoteRunner";
import { DomAutoMainOptions, domAutoMain } from "./DomMainAuto";
import { emitPageEvent } from "./page-event-queue";

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

/**
 * Run Mocha tests using `webDriver` (instance or `Capabilities` used to build instance).
 *
 * @param webDriver
 * @param url
 * @param options
 */
export async function runMochaWebDriverTest(
    webDriver: WebDriver | Capabilities,
    url: string,
    options?: Options
): Promise<boolean> {
    if (!(webDriver instanceof WebDriver)) {
        return withWebDriver(webDriver, (driver: WebDriver) => {
            return runMochaWebDriverTest(driver, url, options);
        });
    }

    options = options || {};

    await webDriver.get(url);

    const messagePort = new WebDriverMessagePort(webDriver);

    return runRemoteMochaTest(messagePort, options);
}

export interface BrowserTestAutoOptions {
    mode?: "dom" | "web-worker";
    /*
     * Worker bootstrap scripts URLs.
     *
     * Optional, defaults to:
     *
     *     require.resolve("mocha/mocha.js"),
     *     require.resolve("mocha-webdriver-runner/dist/mocha-webdriver-client.js")
     *
     * Must contain at least `mocha` and `mocha-webdriver-client` browser side script
     * to properly perform test setup.
     */
    bootstrapScripts?: string[];

    /**
     * Extra browser scripts.
     *
     * Resolved in node context using 'require.resolve'.
     * NOTE, this must resolve to javascript prepared to run in browser envirnonment, so
     * it cannot be classic CommonJS module.
     *
     * Example:
     *
     * * `chai/chai.js` - will resolve to stg like `node_modules/chai/chai.js`
     * * `./src/test-utils.js`
     */
    bootstrapScriptsExtra?: string[];

    /**
     * Bootstrap script urls in worker mode used to load `mocha-webdriver-client`
     * in dom env, only to start workers.
     *
     * Defaults to:
     *
     *     require.resolve("mocha-webdriver-runner/dist/mocha-webdriver-client.js")
     */
    bootstrapScriptsDom?: string[];
}

export const MOCHA_WEBDRIVER_RUNNER_BROWSER_SCRIPT = "mocha-webdriver-runner/dist/mocha-webdriver-client.js";

/**
 * Run `tests` under Mocha in Web Worker.
 *
 * All test events are forwarded using [[emitPageEvent]] to node driver.
 *
 * @param options urls of test scripts or [[WorkerTestAutoOptions]].
 */
export async function runMochaWebDriverTestAuto(
    webDriver: WebDriver | Capabilities,
    tests: string[],
    options?: Options & BrowserTestAutoOptions
) {
    options = options || {};
    const serveDir = process.cwd(); // TODO !?
    const baseUrl = `file://${serveDir}`;

    const mode = options.mode || "dom";
    let bootstrapScripts = options.bootstrapScripts || [
        "mocha/mocha.js",
        MOCHA_WEBDRIVER_RUNNER_BROWSER_SCRIPT
    ];

    let bootstrapScriptsDomUrls: string[] | undefined;
    if (mode === "web-worker") {
        const bootstrapScriptsDom = options.bootstrapScriptsDom || [
            MOCHA_WEBDRIVER_RUNNER_BROWSER_SCRIPT
        ];
        bootstrapScriptsDomUrls = bootstrapScriptsDom.map(scriptPath => resolveScriptPath(scriptPath, serveDir));
    }

    if (options.bootstrapScriptsExtra) {
        bootstrapScripts = bootstrapScripts.concat(options.bootstrapScriptsExtra);
    }

    const bootstrapScriptsUrls = bootstrapScripts.map(scriptPath => resolveScriptPath(scriptPath, serveDir));

    const testsUrls = tests.map(scriptPath => resolveScriptPath(scriptPath, serveDir));

    const bootstrapEnv: DomAutoMainOptions = {
        mode: mode,
        baseUrl,
        tests: testsUrls,
        bootstrapScripts: bootstrapScriptsUrls
    };
    if (bootstrapScriptsDomUrls) {
        bootstrapEnv.bootstrapScriptsDom = bootstrapScriptsDomUrls;
    }
    console.log("BE", bootstrapEnv);
    const html = `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8">
            </head>
            <body>
                <script>
                    ${emitPageEvent}
                    ${domAutoMain}

                    domAutoMain(${JSON.stringify(bootstrapEnv)});
                </script>
            </body>
        </html>
    `;
    const tempFile = path.resolve(serveDir, ".foo.bar.html");
    const tempFileUrl = `${baseUrl}/${path.relative(serveDir, tempFile)}`;
    await new Promise((resolve, reject) => {
        fs.writeFile(tempFile, html, "utf-8", err => {
            if (err) {
                reject(new Error(`unable to save file ${tempFile}: ${err}`));
            } else {
                resolve();
            }
        });
    });

    function cleanup() {
        fs.unlinkSync(tempFile);
    }

    return runMochaWebDriverTest(webDriver, tempFileUrl, options)
        .then(result => {
            cleanup();
            return result;
        })
        .catch(error => {
            cleanup();
            return Promise.reject(error);
        });
}

export function resolveScriptPath(scriptPath: string, basePath: string) {
    if (scriptPath === MOCHA_WEBDRIVER_RUNNER_BROWSER_SCRIPT) {
        // hack, so auto mode can be tested in development env
        if (fs.existsSync("dist/mocha-webdriver-client.js")) {
            scriptPath = "./dist/mocha-webdriver-client.js";
        }
    }
    if (scriptPath.startsWith("http:") || scriptPath.startsWith("https:") || scriptPath.startsWith("file:")) {
        return scriptPath;
    }
    if (!path.isAbsolute(scriptPath) && !scriptPath.startsWith(".")) {
        scriptPath = require.resolve(scriptPath);
    }
    return path.relative(basePath, scriptPath);
}
