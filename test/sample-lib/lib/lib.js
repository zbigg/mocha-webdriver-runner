exports.complexAlgo = function (a) {
    if (typeof a !== "number") {
        throw new Error("not a number");
    }
    if (a < 0) {
        return exports.complexAlgo(-a)
    }
    return a;
}