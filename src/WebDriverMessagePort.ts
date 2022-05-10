import { queuePageCommand, fetchPageEvents } from "./page-event-queue";
import { WebDriver } from "selenium-webdriver";
import { MessagePortBase } from "./MessagePortBase";
import { RemoteRunnerMessage } from "./RemoteRunnerProtocol";

/**
 * Node side of Worker-like channel between node and browser context.
 */
export class WebDriverMessagePort extends MessagePortBase {
    constructor(public driver: WebDriver) {
        super();
    }

    postMessage(message: RemoteRunnerMessage) {
        this.queueCommand(async () => {
            await queuePageCommand(this.driver, {
                type: "message",
                data: message
            });
            await dumpDriverLogs(this.driver);
        });
    }

    doReceiveRemoteEvents() {
        return this.queueCommand(async () => {
            await fetchPageEvents(this.driver).then(events => {
                events.forEach(event => {
                    this.dispatchEvent(event);
                });
            });
            await dumpDriverLogs(this.driver);
        }).catch(error => {
            console.log("X", error);
            const event = { type: error, error: error };
            this.dispatchEvent((event as any) as Event);
        });
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
            .then(
                result => {
                    this.commandRunning = false;
                    command.resolve(result);
                },
                error => {
                    this.commandRunning = false;
                    command.reject(error);
                }
            )
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
