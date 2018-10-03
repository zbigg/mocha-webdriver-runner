import { Synchronizer } from "@zbigg/treesync";
import * as mocha from "mocha";

const MOCHA_SUITE_SYNCHRONIZED_PROPERTIES = [
    "title",
    "tests",
    "suites",
    "pending",
    "file",
    "delayed",
    "parent",
    "title"
];

const MOCHA_TEST_SYNCHRONIZED_PROPERTIES = [
    "title",
    "speed",
    "type",
    "err",
    "parent",
    "title",
    "state",
    "duration",
    "currentRetry"
];

export function createMochaStateSynchronizer(): Synchronizer {
    const synchronizer = new Synchronizer();
    synchronizer.serializationContext.addClass({
        name: "Mocha.Suite",
        constructor: mocha.Suite as any,
        factory: function() {
            return new mocha.Suite("dummy-test");
        },
        propertyFilter: (name: string) => {
            return MOCHA_SUITE_SYNCHRONIZED_PROPERTIES.includes(name);
        }
    });

    synchronizer.serializationContext.addClass({
        name: "Mocha.Test",
        constructor: mocha.Test as any,
        factory: function() {
            return new mocha.Test("dummy-test", () => {});
        },
        propertyFilter: (name: string) => {
            return MOCHA_TEST_SYNCHRONIZED_PROPERTIES.includes(name);
        }
    });
    return synchronizer;
}
