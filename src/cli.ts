#!/usr/bin/env node

import * as commander from "commander";
import * as fs from "fs";
import * as path from "path";

import { set, merge, cloneDeep } from "lodash";
import { runMochaWebDriverTest } from "./MochaWebDriverRunner";
import { Options } from "./MochaRemoteRunner";

const DEFAULT_CONFIG_FILE = ".mocha-webdriver-runner.json";

function readDefaultCliOptions(): CliOptions {
    let optionsRaw: any;
    if (!fs.existsSync(DEFAULT_CONFIG_FILE)) {
        return {};
    }
    try {
        optionsRaw = fs.readFileSync(DEFAULT_CONFIG_FILE, "utf-8");
    } catch (error) {
        throw new Error(`unable to read config from '${DEFAULT_CONFIG_FILE}': ${error}`);
    }
    return JSON.parse(optionsRaw);
}

interface CliOptions {
    capabilities?: any;

    reporter?: string;
    reporterOptions?: { [name: string]: string };
    grep?: string;
    checkLeaks?: boolean;
    globals?: string[];
    timeout?: number;
    globalsToSave?: { [name: string]: string };
    captureConsoleLog?: boolean;
}

let DEFAULT_CLI_OPTIONS: Readonly<CliOptions> = {
    captureConsoleLog: true,
    capabilities: {},
    timeout: 2000,
    reporter: "spec"
};

let programOptions: CliOptions = cloneDeep(DEFAULT_CLI_OPTIONS);

let useDefaultConfigFile = true;

function consumeOptionsFileOption(name: string) {
    useDefaultConfigFile = false;
    const fromFile = JSON.parse(fs.readFileSync(name, "utf-8"));
    merge(programOptions, fromFile);
    return name;
}

function numberOptionConsumer(name: string) {
    return (value: string, current: any) => {
        const intValue = parseInt(value, 10);
        set(programOptions, name, intValue);
        return name;
    };
}

function stringOptionConsumer(name: string) {
    return (value: string, current: any) => {
        set(programOptions, name, value);
        return value;
    };
}

function booleanOptionConsumer(name: string) {
    return (value: string, current: any) => {
        const normalized = value.toLocaleLowerCase();
        const enabled = normalized === "yes" || normalized === "1" || normalized === "true";
        set(programOptions, name, enabled);
        return value;
    };
}

function consumeReporterOptions(optionsString?: string) {
    if (!optionsString) {
        return optionsString;
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
    programOptions.reporterOptions = result;
    return optionsString;
}

function collectCapabilities(val: string, capabilities: any) {
    if (!val) {
        throw new Error("capability cannot be empty");
    }
    const dividerIndex = val.indexOf("=");
    let value;
    let key;
    if (dividerIndex === -1) {
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
    set(programOptions.capabilities!, key, value);
}

function collectGlobalsToSave(val: string) {
    if (!val) {
        throw new Error("global name cannot be empty");
    }
    let globalName;
    let outputFileName;
    const dividerIndex = val.indexOf(":");
    if (dividerIndex === -1) {
        globalName = val;
        outputFileName = `${val}.json`;
    } else {
        globalName = val.substr(0, dividerIndex);
        outputFileName = val.substr(dividerIndex + 1);
    }
    if (!programOptions.globalsToSave) {
        programOptions.globalsToSave = {};
    }
    programOptions.globalsToSave[globalName] = outputFileName;
}

const globals: string[] = [];

function collectGlobals(val: string) {
    if (!val) {
        throw new Error("global name cannot be empty");
    }
    globals.push(...val.split(","));
    return val;
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
    .usage("[options] URL")
    .option("-c, --config <FILE>", "config file", consumeOptionsFileOption, DEFAULT_CONFIG_FILE)
    .option("-C, --capability <name[=value]>", "required browser capability", collectCapabilities)
    .option("-O, --reporter-options <k=v,k2=v2,...>", "reporter-specific options", consumeReporterOptions())
    .option(
        "-R, --reporter <name>",
        "specify the reporter to use",
        stringOptionConsumer("reporter"),
        DEFAULT_CLI_OPTIONS.reporter
    )
    .option(
        "-t, --timeout <ms>",
        "set test-case timeout in milliseconds",
        numberOptionConsumer("timeout"),
        DEFAULT_CLI_OPTIONS.timeout
    )
    .option("--check-leaks <boolean>", "Check for global variable leaks")
    .option("--globals <name1,name2...>", "list of allowed global variables", collectGlobals)
    .option("-S, --save <globalName[:fileName]>", "save global `name` as JSON file", collectGlobalsToSave)
    .option(
        "-L, --capture-console-log <boolean>",
        "whether to capture console.log in browser context",
        booleanOptionConsumer("captureConsoleLog")
    )
    .option("-g, --grep <pattern>", "only run tests/suites that match pattern", stringOptionConsumer("grep"))
    .version(version);

const shortcuts: any = {
    chrome: {
        doc: "use Chrome",
        capabilities: {
            browserName: "chrome"
        }
    },
    "headless-chrome": {
        doc: "use headless Chrome",
        capabilities: {
            browserName: "chrome",
            "goog:chromeOptions": {
                args: ["--headless"]
            }
        }
    },
    firefox: {
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
    safari: {
        doc: "use Safari",
        capabilities: {
            browserName: "safari"
        }
    },
    edge: {
        doc: "use Edge",
        capabilities: {
            browserName: "MicrosoftEdge"
        }
    }
};

for (const name in shortcuts) {
    const entry = shortcuts[name];
    commander.option(`--${name}`, entry.doc, function() {
        merge(programOptions.capabilities, entry.capabilities);
    });
}

commander.parse(process.argv);

if (useDefaultConfigFile) {
    programOptions = merge({}, DEFAULT_CLI_OPTIONS, readDefaultCliOptions, programOptions);
}

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

const options: Options = {
    reporter: programOptions.reporter,
    reporterOptions: programOptions.reporterOptions,
    grep: programOptions.grep,
    checkLeaks: programOptions.checkLeaks,
    globals: programOptions.globals,
    timeout: programOptions.timeout,
    globalsToSave: programOptions.globalsToSave && Object.keys(programOptions.globalsToSave),
    captureConsoleLog: programOptions.captureConsoleLog
};

runMochaWebDriverTest(programOptions.capabilities, url, options)
    .then(result => {
        for (const varName in result.dumpedGlobals) {
            const varValue = result.dumpedGlobals[varName];
            const fileName = programOptions.globalsToSave![varName];
            console.log(`mocha-webdriver-runner: saving ${varName} dump in ${fileName}`);
            fs.mkdirSync(path.dirname(fileName), { recursive: true });
            fs.writeFileSync(fileName, JSON.stringify(varValue), "utf-8");
        }

        if (result.success) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    })
    .catch(error => {
        console.error(`mocha-webdriver-runner: unexpected error: ${error}`);
        console.error(error);
        process.exit(1);
    });
