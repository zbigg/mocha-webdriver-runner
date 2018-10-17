import { emitPageEvent, fetchPageCommand } from "./page-event-queue";
import { MessagePortBase } from "./MessagePortBase";
import { RemoteRunnerMessage } from "./RemoteRunnerProtocol";

/**
 * Browser side of Worker-like channel between browser context.
 *
 * Sends messages serialized using [[createMochaStateSynchronizer]] using [[emitPageEvent]].
 */
export class BrowserMessagePort extends MessagePortBase {

    postMessage(message: RemoteRunnerMessage) {
        emitPageEvent({
            type: "message",
            data: message
        });
    }

    doReceiveRemoteEvents() {
        return fetchPageCommand().then(packet => {
            this.dispatchEvent(packet);
        });
    }
}
