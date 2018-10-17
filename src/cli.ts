#!/usr/bin/env node

import * as commander from "commander";
import * as fs from "fs";
import * as path from "path";

import { set } from "lodash";
import { runMochaWebDriverTest } from "./MochaWebDriverRunner";

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
    capabilities = capabilities || {};
    set(capabilities, key, value);
    return capabilities;
}
const version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version;

commander
    .version(version)
    .usage("[options] URL")
    .option("-C, --capability <name[=value]>", "required browser capability", collectCapabilities)
    .option("-O, --reporter-options <k=v,k2=v2,...>", "reporter-specific options")
    .option("-R, --reporter <name>", "specify the reporter to use", "spec")
    .option("-L, --capture-console-log <boolean>", "whether to capture console.log in browser context", true)
    .option("-g, --grep <pattern>", "only run tests/suites that match pattern");

commander.parse(process.argv);

const args = commander.args;
if (args.length < 1) {
    commander.outputHelp();
    throw new Error("mocha-webdriver-runer: URL needed");
}

const url = commander.args.shift()!;
const cliOptions = commander.opts();
const options = {
    reporter: cliOptions.reporter,
    reporterOptions: parseReporterOptions(cliOptions.reporterOptions),
    grep: cliOptions.grep,
    captureConsoleLog: cliOptions.captureConsoleLog
};

runMochaWebDriverTest(commander.capability, url, options).then(result => {
    if (result) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});
