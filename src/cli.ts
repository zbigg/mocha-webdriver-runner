#!/usr/bin/env node

import * as commander from "commander";
import * as fs from "fs";
import * as path from "path";

import { set } from "lodash";
import { Options } from "./MochaRemoteRunner";
import { runMochaWebDriverTest, runMochaWebDriverTestAuto, BrowserTestAutoOptions } from "./MochaWebDriverRunner";

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

function looksLikeUrl(val: string) {
    return val.startsWith("http:") || val.startsWith("https:") || val.startsWith("file:");
}

function createLocalFileUrl(testPagePath: string) {
    const absoluteTestPagePath = path.resolve(process.cwd(), testPagePath);
    return `file://${absoluteTestPagePath}`;
}


function collectImports(val: string, imports: string[] | undefined) {
    imports = imports || [];
    imports.push(val);
    return imports;
}

const version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version;

commander
    .version(version)
    .usage("[options] URL | [javascript test files]")
    .option("-C, --capability <name[=value]>", "required browser capability", collectCapabilities)
    .option("-O, --reporter-options <k=v,k2=v2,...>", "reporter-specific options")
    .option("-R, --reporter <name>", "specify the reporter to use", "spec")
    .option("-t, --timeout <ms>", "set test-case timeout in milliseconds", 2000)
    .option("-i, --import <name>", "import given module before tests (auto mode)", collectImports)
    .option("-e, --env <dom|web-worker>", "environment (auto mode only", "dom")
    .option("-L, --capture-console-log <boolean>", "whether to capture console.log in browser context", true)
    .option("-g, --grep <pattern>", "only run tests/suites that match pattern");

async function run() {
    commander.parse(process.argv);

    const args = commander.args;
    if (args.length < 1) {
        commander.outputHelp();
        throw new Error("mocha-webdriver-runner: URL or file list required");
    }

    const mode: "url" | "auto" = (
        commander.args.length > 1
            ? "auto"
            : looksLikeUrl(commander.args[0])
                ? "url"
                : "auto"
    );

    const mainScript = commander.args.shift()!;

    const url = looksLikeUrl(mainScript) ? mainScript : createLocalFileUrl(mainScript);

    if (process.env.SELENIUM_REMOTE_URL && url.startsWith("file:")) {
        console.warn(`mocha-webdriver-runner: warning: remote selenium nodes usually don't work with file:// urls`);
    }

    const cliOptions = commander.opts();

    const generalOptions = {
        reporter: cliOptions.reporter,
        reporterOptions: parseReporterOptions(cliOptions.reporterOptions),
        grep: cliOptions.grep,
        timeout: cliOptions.timeout,
        captureConsoleLog: cliOptions.captureConsoleLog
    };

    if (mode === "url") {
        const url = commander.args.shift()!;
        return runMochaWebDriverTest(commander.capability, url, generalOptions);
    } else {
        const autoModeOptions: BrowserTestAutoOptions = {
            ...generalOptions,
            bootstrapScriptsExtra: cliOptions.import,
            mode: cliOptions.env || 'dom'
        };
        return runMochaWebDriverTestAuto(commander.capability, commander.args, autoModeOptions);
    }
}

run()
    .then(result => {
        if (result) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    })
    .catch(error => {
        console.error(`mocha-webdriver-runner: Internal error: ${error}`);
        console.error(error.stack);
        process.exit(2);
    });
