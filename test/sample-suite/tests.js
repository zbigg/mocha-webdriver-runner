//
// sample test suite
//

// assume chai is loaded using global script

var assert = typeof chai !== "undefined" ? chai.assert : require("chai").assert;

describe("sample module", function () {
    it("passing test", function () {
        assert(true);
        globalThis.someResult = Object.assign(globalThis.someResult || {}, {
            test1: "result1"
        })
    });
    it.skip("pending test", function () {
        assert(true);
    });
    it("failing test with basic string diff", function () {
        globalThis.someResult = Object.assign(globalThis.someResult || {}, {
            test2: "result2"
        })
        assert.equal("abcdef", "abcd");
    });

    it("failing test with objects diff", function () {
        assert.deepEqual({ a: 1, b: 2 }, { b: 22, a: 1 });
    });

    describe("nested suite", function () {
        it("passing test", function () {
            assert(true);
        });
        it.skip("pending test", function () {
            assert(true);
        });
    });

    describe("mochawsesome context", function () {
        it("basic string context", function () {
            this.test.context = ["hello"];
        });
        it("basic title/value", function () {
            this.test.context = { "title": "foo", value: 3.14 };
        });
        it("just url-like context", function () {
            this.test.context = "https://www.fnordware.com/superpng/pnggrad8rgb.jpg";
        });
    });
});
