#!/usr/bin/env node

import * as commander from "commander";
import * as fs from "fs";
import * as path from "path";

import { set } from "lodash";
import { runMochaWebDriverTest } from "./MochaWebDriverRunner";
import { Options } from "./MochaRemoteRunner";

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

const globalCapabilities: any = {};
function collectCapabilities(val: string, capabilities: any) {
    if (!val) {
        throw new Error("capability cannot be empty");
    }
    const dividerIndex = val.indexOf("=");
    let value;
    let key;
    if (dividerIndex === 0) {
        key = val;
        value = true;
    } else {
        key = val.substr(0, dividerIndex);
        value = val.substr(dividerIndex + 1);
    }
    if (typeof value === "string") {
        if (value.startsWith("{") || value.startsWith('"') || value.startsWith("[")) {
            value = JSON.parse(value);
        }
    }
    set(globalCapabilities, key, value);
    return globalCapabilities;
}

function looksLikeUrl(val: string) {
    return val.startsWith("http:") || val.startsWith("https:") || val.startsWith("file:");
}

function createLocalFileUrl(testPagePath: string) {
    const absoluteTestPagePath = path.resolve(process.cwd(), testPagePath);
    return `file://${absoluteTestPagePath}`;
}


const version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version;

commander
    .version(version)
    .usage("[options] URL")
    .option("-C, --capability <name[=value]>", "required browser capability", collectCapabilities)
    .option("-O, --reporter-options <k=v,k2=v2,...>", "reporter-specific options")
    .option("-R, --reporter <name>", "specify the reporter to use", "spec")
    .option("-t, --timeout <ms>", "set test-case timeout in milliseconds", 2000)
    .option("-L, --capture-console-log <boolean>", "whether to capture console.log in browser context", true)
    .option("-g, --grep <pattern>", "only run tests/suites that match pattern");

const shortcuts: any = {
    "chrome": {
        doc: "use Chrome",
        capabilities: {
            browserName: "chrome"
        }
    },
    "headless-chrome": {
        doc: "use headless Chrome",
        capabilities: {
            browserName: "chrome",
            chromeOptions: {
                args: ["--headless"]
            }
        }
    },
    "firefox": {
        doc: "use Firefox",
        capabilities: {
            browserName: "firefox"
        }
    },
    "headless-firefox": {
        doc: "use headless Firefox",
        capabilities: {
            browserName: "firefox",
            "moz:firefoxOptions": {
                args: ["-headless"]
            }
        }
    },
    "safari": {
        doc: "use Safari",
        capabilities: {
            browserName: "safari"
        }
    },
    "edge": {
        doc: "use Edge",
        capabilities: {
            browserName: "MicrosoftEdge"
        }
    }
};

for(const name in shortcuts) {
    const entry = shortcuts[name];
    commander.option(`--${name}`, entry.doc, function() {
        Object.assign(globalCapabilities, entry.capabilities)
    })
}

commander.parse(process.argv);

const args = commander.args;
if (args.length < 1) {
    commander.outputHelp();
    throw new Error("mocha-webdriver-runer: URL needed");
}

const mainScript = commander.args.shift()!;

const url = looksLikeUrl(mainScript) ? mainScript : createLocalFileUrl(mainScript);

if (process.env.SELENIUM_REMOTE_URL && url.startsWith("file:")) {
    console.warn(`mocha-webdriver-runner: warning: remote selenium nodes usually don't work with file:// urls`);
}
const cliOptions = commander.opts();
const options: Options = {
    reporter: cliOptions.reporter,
    reporterOptions: parseReporterOptions(cliOptions.reporterOptions),
    grep: cliOptions.grep,
    timeout: cliOptions.timeout,
    captureConsoleLog: cliOptions.captureConsoleLog
};

runMochaWebDriverTest(globalCapabilities, url, options)
    .then(result => {
        if (result) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    }).catch(error => {
        console.error(`mocha-webdriver-runner: unexpected error: ${error}`);
        console.error(error);
        process.exit(1);
    })
