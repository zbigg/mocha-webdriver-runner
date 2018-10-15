// rollup.config.js
import typescript from "rollup-plugin-typescript2";
import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";

export default [
    {
        input: "./src/mocha-webdriver-client.ts",
        external: ["mocha"],
        output: {
            file: "./dist/mocha-webdriver-client.js",
            format: "umd",
            name: "MochaWebdriverClient",
            globals: {
                mocha: "Mocha"
            }
        },
        plugins: [typescript({
            tsconfigOverride: {
                compilerOptions: {
                    "module": "esnext",
                    "declaration": false
                },
                "include": [ "./src/mocha-webdriver-client.ts"]
            }
        }), resolve(), commonjs()]
    }
];
