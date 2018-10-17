import { MessagePortBase } from "./MessagePortBase";
import { RemoteRunnerMessage } from "./RemoteRunnerProtocol";

declare let self: Worker & {
    importScripts(..._scripts: string[]): void;
};

/**
 * WebWorker side of Worker-like channel between browser context.
 *
 * Sends messages using [[self.postMessage]].
 */
export class WebWorkerMessagePort extends MessagePortBase {
    start() {
        self.addEventListener("message", this.onMessage);
    }

    close() {
        self.removeEventListener("message", this.onMessage);
    }

    postMessage(message: RemoteRunnerMessage) {
        self.postMessage(message);
    }

    /**
     * Receives `message` from `worker.postMessage` call.
     *
     * Pessage payload is in `message.data` field.
     */
    onMessage = (event: MessageEvent) => {
        this.dispatchEvent(event);
    };

    doReceiveRemoteEvents(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}
