import { queuePageCommand, fetchPageEvents } from "./page-event-queue";
import { WebDriver, logging } from "selenium-webdriver";
import { MessagePortBase } from "./MessagePortBase";
import { RemoteRunnerMessage } from "./RemoteRunnerProtocol";

export async function dumpDriverLogs(driver: WebDriver) {
    await driver
        .manage()
        .logs()
        .get(logging.Type.DRIVER)
        .then(function(entries) {
            entries.forEach(function(entry) {
                console.log("[webdriver-driver] %s", entry.level.name, entry.message);
            });
        });
    await driver
        .manage()
        .logs()
        .get(logging.Type.BROWSER)
        .then(function(entries) {
            entries.forEach(function(entry) {
                console.log("[webdriver-browser] %s", entry.level.name, entry.message);
            });
        });
}

/**
 * Node side of Worker-like channel between node and browser context.
 */
export class WebDriverMessagePort extends MessagePortBase {
    constructor(public driver: WebDriver) {
        super();
    }

    postMessage(message: RemoteRunnerMessage) {
        this.queueCommand(() =>
            queuePageCommand(this.driver, {
                type: "message",
                data: message
            })
        );
    }

    doReceiveRemoteEvents() {
        return this.queueCommand(() =>
            fetchPageEvents(this.driver).then(events => {
                events.forEach(event => {
                    this.dispatchEvent(event);
                });
            })
        );
    }

    private commandRunning: boolean = false;
    private queuedCommands: {
        fun: () => Promise<any>;
        resolve: (result: any) => void;
        reject: (result: Error) => void;
    }[] = [];

    private tryProcessQueue() {
        if (this.commandRunning || this.queuedCommands.length === 0) {
            return;
        }
        const command = this.queuedCommands.shift()!;
        this.commandRunning = true;
        command
            .fun()
            .then(result => {
                command.resolve(result);
                this.commandRunning = false;
            })
            .catch(error => {
                command.reject(error);
            })
            .then(() => {
                this.tryProcessQueue();
            });
    }
    private queueCommand<T>(fun: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queuedCommands.push({
                fun,
                resolve,
                reject
            });

            process.nextTick(() => {
                this.tryProcessQueue();
            });
        });
    }
}
