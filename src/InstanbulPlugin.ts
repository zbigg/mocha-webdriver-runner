const theGlobal: any =
    typeof globalThis !== "undefined"
        ? globalThis
        : typeof self !== "undefined"
        ? self
        : typeof window !== "undefined"
        ? window
        : global;

interface CoverageInfo {
    [filaName: string]: any;
}
export function getGlobalCoverageInfo(): CoverageInfo | undefined {
    return theGlobal["__coverage__"];
}
