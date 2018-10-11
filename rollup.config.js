// rollup.config.js
import typescript from "rollup-plugin-typescript2";
import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";

export default [
    {
        input: "./src/mocha-selenium-client.ts",
        external: ["mocha"],
        output: {
            file: "./umd/mocha-selenium-client.js",
            format: "umd",
            name: "MochaSeleniumClient",
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
                    }
                }
            }),
            resolve(),
            commonjs()
        ]
    }
];
