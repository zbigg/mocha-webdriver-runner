const assert = require('assert');

const complexAlgo = require('../lib/lib').complexAlgo;

describe("lib", function () {
    describe("#complexAlgo", function () {
        it("works with negative", function () {
            assert.strictEqual(complexAlgo(-1), 1)
        })
        it("works with positive", function () {
            assert.strictEqual(complexAlgo(1), 1)
        })
    })
})