import { EventEmitter } from "events";

export abstract class MessagePortBase {
    private emitter = new EventEmitter();

    started: boolean = false;

    abstract postMessage(message: any): void;
    abstract doReceiveRemoteEvents(): Promise<void>;

    // MessagePort interface
    start() {
        this.started = true;
        this.receiveRemoteEvents();
    }
    close() {
        this.started = false;
    }

    set onmessage(listener: (event: any) => void) {
        this.addEventListener("message", listener);
    }

    set onmessageerror(listener: (event: any) => void) {
        this.addEventListener("error", listener);
    }

    addEventListener(type: "message" | "error", listener: (event: any) => void) {
        this.emitter.addListener(type, listener);
        if (!this.started) {
            this.start();
        }
    }
    removeEventListener(type: "message" | "error", listener: (event: any) => void) {
        this.emitter.removeListener(type, listener);
        if (this.emitter.listenerCount("message") === 0 || this.emitter.listenerCount("error") === 0) {
            this.close();
        }
    }

    dispatchEvent(event: Event): boolean {
        this.emitter.emit(event.type, event);
        return true;
    }

    private receiveRemoteEvents() {
        if (!this.started) {
            return;
        }
        this.doReceiveRemoteEvents().then(() => {
            this.receiveRemoteEvents();
        });
    }
}
