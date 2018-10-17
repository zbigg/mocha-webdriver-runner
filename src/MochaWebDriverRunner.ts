import { Builder, WebDriver, Capabilities } from "selenium-webdriver";
import { WebDriverMessagePort } from "./WebDriverMessagePort";
import { Options, runRemoteMochaTest } from "./MochaRemoteRunner";

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
