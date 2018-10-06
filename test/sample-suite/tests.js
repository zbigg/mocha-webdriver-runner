//
// sample test suite
//

// assume chai is loaded using global script

var assert = typeof chai !== "undefined" ? chai.assert : require("chai").assert;

describe("mocha-selenium", function() {
    it("supports passing test", function() {
        assert(true);
    });
    it.skip("supports pending test", function() {
        assert(true);
    });
    it("supports failing test with basic string diff", function() {
        assert.equal("abcdef", "abcd");
    });

    it("supports failing test with objects diff", function() {
        assert.deepEqual({ a: 1, b: 2 }, { b: 22, a: 1 });
    });

    describe("supports nested suites", function() {
        it("passing test", function() {
            assert(true);
        });
        it.skip("pending test", function() {
            assert(true);
        });
    });

    describe("mochawsesome context", function() {
        it("supports basic string context", function() {
            this.test.context = [ "hello" ];
        });
        it("supports basic title/value", function() {
            this.test.context = { "title": "foo", value: 3.14 };
        });
        it("supports just url-like context", function() {
            this.test.context = "https://www.fnordware.com/superpng/pnggrad8rgb.jpg";
        });
    });
});
