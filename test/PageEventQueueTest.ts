import { assert } from "chai";

import {
    execPageCommandWebDriver,
    drainQueueClientWebDriver,
    emitPageEvent,
    fetchPageCommand
} from "../src/page-event-queue";

const inNodeContext = typeof window === "undefined";

function fetchPageEventsLocal(): Promise<any[]> {
    return new Promise(resolve => {
        drainQueueClientWebDriver((result: any) => {
            const parsed = JSON.parse(result);
            resolve(parsed);
        });
    });
}

function queuePageCommandLocal(command: any): Promise<void> {
    return new Promise(resolve => {
        execPageCommandWebDriver(JSON.stringify(command), resolve);
    });
}

describe.only(`page-event-queue`, function() {
    beforeEach(function() {
        if (inNodeContext) {
            (global as any).window = {};
        }
    });
    afterEach(function() {
        if (inNodeContext) {
            (global as any).window = {};
        } else {
            const { __pageEventQueue, __driverCommandQueue } = window;
            // console.log({
            //     __pageEventQueue,
            //     __driverCommandQueue
            // });
            delete window.__pageEventQueue;
            delete window.__pageEventCallback;
            delete window.__driverCommandQueue;
            delete window.__driverCommandCallbacks;
            assert(!__pageEventQueue || __pageEventQueue.length === 0);
            assert(!__driverCommandQueue || __driverCommandQueue.length === 0);
        }
    });
    const SAMPLE_EVENT_ONE = { type: "sample-event1" };

    it("supports basic browser - node events", async function() {
        // browser code
        emitPageEvent(SAMPLE_EVENT_ONE);

        // node code
        const events = await fetchPageEventsLocal();
        assert.equal(events.length, 1);
        assert.deepEqual(events[0], SAMPLE_EVENT_ONE);
    });

    it("supports basic node -> browser commands", async function() {
        // browser code
        const browserTask = new Promise(resolve => {
            fetchPageCommand().then(events => {
                resolve(events);
            });
        });

        // node code
        queuePageCommandLocal(SAMPLE_EVENT_ONE);

        // evaluate result
        const receivedEvent = await browserTask;
        assert.deepEqual(receivedEvent, SAMPLE_EVENT_ONE);
    });

    it("supports flood node -> browser commands #serialized", async function() {
        // browser code
        // node code

        const N = 50;
        for (let i = 0; i < N; ++i) {
            queuePageCommandLocal({ ...SAMPLE_EVENT_ONE, i: i });
        }

        // evaluate result in browser
        for (let i = 0; i < N; ++i) {
            await fetchPageCommand();
        }
    });

    it("supports flood node -> browser commands #parallel", async function() {
        // node code
        const N = 50;
        // evaluate result in browser
        const promises: Array<Promise<void>> = [];
        for (let i = 0; i < N; ++i) {
            promises.push(
                new Promise(resolve => {
                    setTimeout(async () => {
                        await fetchPageCommand();
                        resolve();
                    }, 1);
                })
            );
        }
        await new Promise(resolve => setTimeout(resolve, 2));

        for (let i = 0; i < N; ++i) {
            queuePageCommandLocal({ ...SAMPLE_EVENT_ONE, i: i });
        }

        await Promise.all(promises);
    });

    it("supports flood browser -> node events #parallel", async function() {
        // node code
        const N = 50;
        // evaluate result in browser
        const promises: Array<Promise<void>> = [];
        for (let i = 0; i < N; ++i) {
            promises.push(
                new Promise(resolve => {
                    setTimeout(async () => {
                        await fetchPageCommand();
                        resolve();
                    }, 1);
                })
            );
        }
        await new Promise(resolve => setTimeout(resolve, 2));

        for (let i = 0; i < N; ++i) {
            queuePageCommandLocal({ ...SAMPLE_EVENT_ONE, i: i });
        }

        await Promise.all(promises);
    });
});
