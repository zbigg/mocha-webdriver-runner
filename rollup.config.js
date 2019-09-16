// rollup.config.js
import typescript from "rollup-plugin-typescript2";
import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import nodeBulitins from "rollup-plugin-node-builtins";

export default [
    {
        input: "./src/index.web.ts",
        external: ["mocha"],
        output: {
            file: "./dist/mocha-webdriver-client.js",
            format: "umd",
            name: "MochaWebdriverClient",
            globals: {
                mocha: "Mocha"
            }
        },
        plugins: [
            typescript({
                tsconfigOverride: {
                    compilerOptions: {
                        module: "esnext",
                        declaration: false
                    },
                    include: ["./src/index.web.ts"]
                }
            }),
            resolve(),
            commonjs(),
            nodeBulitins()
        ]
    },
    {
        input: "./lib-cov/index.web.js",
        external: ["mocha"],
        output: {
            file: "./lib-cov/mocha-webdriver-client-cov.js",
            format: "umd",
            name: "MochaWebdriverClient",
            globals: {
                mocha: "Mocha"
            }
        },
        plugins: [resolve(), commonjs(), nodeBulitins()]
    }
];
