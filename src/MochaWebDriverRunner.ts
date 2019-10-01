import { Builder, WebDriver, Capabilities, logging } from "selenium-webdriver";
import { WebDriverMessagePort } from "./WebDriverMessagePort";
import { Options, runRemoteMochaTest } from "./MochaRemoteRunner";

import * as querystring from "querystring";

export interface WebDriverOptions {
    logger?: string | string[];
    logLevel?: string;
}

export async function withWebDriver<T>(
    capabilities: Object | Capabilities,
    options: WebDriverOptions,
    test: (driver: WebDriver) => T
) {
    let someLoggingEnabled = false;
    if (options.logLevel !== undefined && options.logger === undefined) {
        const logLevel = logging.getLevel(options.logLevel);
        logging.getLogger().setLevel(logLevel);
        someLoggingEnabled = true;
    }
    if (options.logger) {
        const loggerNames = Array.isArray(options.logger) ? options.logger : [options.logger];
        const logLevel = logging.getLevel(options.logLevel || "info");
        for (const name of loggerNames) {
            logging.getLogger(name).setLevel(logLevel);
            someLoggingEnabled = true;
        }
    }

    if (someLoggingEnabled) {
        (logging as any).installConsoleHandler();
    }

    (logging as any).installConsoleHandler();
    let theDriver: WebDriver | undefined;
    const capabilities2 = capabilities instanceof Capabilities ? capabilities : new Capabilities(capabilities);
    const loggingPrefs = new logging.Preferences();
    capabilities2.setLoggingPrefs(loggingPrefs);
    //loggingPrefs.setLevel(logging.Type.DRIVER, logging.Level.ALL);
    //loggingPrefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
    //loggingPrefs.setLevel(logging.Type.CLIENT, logging.Level.ALL);
    return Promise.resolve(
        new Builder()
            .withCapabilities(capabilities2)
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
    options?: Options & { webDriver?: WebDriverOptions }
): Promise<boolean> {
    if (!(webDriver instanceof WebDriver)) {
        return withWebDriver(webDriver, options && options.webDriver || {}, (driver: WebDriver) => {
            return runMochaWebDriverTest(driver, url, options);
        });
    }

    options = options || {};
    const passOptionsWithQueryString = true;

    if (passOptionsWithQueryString) {
        const queryStringParams: any = {
            useMochaWebDriverRunner: 1
        };
        if (options.captureConsoleLog !== undefined) {
            queryStringParams.captureConsoleLog = options.captureConsoleLog;
        }
        if (options.delay !== undefined) {
            queryStringParams.delay = options.delay;
        }
        if (options.timeout !== undefined) {
            queryStringParams.timeout = options.timeout;
        }
        if (options.grep !== undefined) {
            queryStringParams.grep = options.grep;
        }
        const delimiter = url.indexOf("?") === -1 ? "?" : "&";
        url = url + delimiter + querystring.stringify(queryStringParams);
    }

    await webDriver.get(url);

    const messagePort = new WebDriverMessagePort(webDriver);

    return runRemoteMochaTest(messagePort, {
        ...options,
        clientWaitsForOptions: !passOptionsWithQueryString
    });
}
