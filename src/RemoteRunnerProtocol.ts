import * as mocha from "mocha";
import { SerializationMessage, SyncPayload } from "@zbigg/treesync";

export interface RemoteRunnerOptions {
    /**
     * Delay test execution (TBD)!
     */
    delay?: boolean;

    /**
     * Run only tests than name matches `grep` expression.
     */
    grep?: string | RegExp;

    /**
     * Capture `console.log` (and other) messages executed in browser context.
     *
     * Defaults to `true`.
     */
    captureConsoleLog?: boolean;
}

/**
 * Sent from driver to worker in automatic mode to boostrap worker i.e
 * - load essential scripts (mocha, mocha-webdriver-client)
 * - load actual test scripts
 *
 * It's expected that worker will respond with [[MochaReadyMessage]]
 */
export interface BootstrapWorkerMessage {
    type: "boostrap-worker";
    baseUrl: string;
    bootstrapScripts?: string[];
    tests: string[];
}

export interface MochaReadyMessage {
    type: "mocha-ready";
}

export interface MochaRunMessage {
    type: "mocha-run";
    mochaOptions?: RemoteRunnerOptions;
}

export interface MochaFinishedMessage {
    type: "mocha-finished";
}

export interface LogMessage {
    type: "log",
    level: string;

    // `console.log` args serialized using `treesync.serialize`.
    args: SerializationMessage;
}

export interface AbortedMessage {
    type: "err-aborted";
    message: string;

    // `Error` serialized using `treesync.serialize`.
    error: SerializationMessage;
}

export interface UnhandledExceptionMessage {
    type: "err-unhandled-exception";
    message: string;

    // `Error` serialized using `treesync.serialize`.
    error: SerializationMessage;
}

/**
 * Simplistic interface of Mocha event sent
 *
 * TODO: implement proper subtypes
 */
export interface MochaRunnerEvent {
    type: string;
    test?: mocha.Test;
    suite?: mocha.Suite;
    message?: string;
    err?: Error;
    failures?: number;
    passes?: number;
}

export interface MochaRunnerEventMessage {
    type: "mocha-runner-event";

    /**
     * [[MochaRunnerEvent]] serialized using `suite-synchronizer`.
     */
    event: SyncPayload;
}

export type RemoteRunnerMessage =
    | MochaReadyMessage
    | MochaRunMessage
    | MochaFinishedMessage
    | MochaRunnerEventMessage
    | UnhandledExceptionMessage
    | AbortedMessage
    | LogMessage
    | BootstrapWorkerMessage
