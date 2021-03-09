// rollup.config.js
import typescript from "rollup-plugin-typescript2";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
export default [
    {
        input: "./src/index.web.ts",
        external: ["mocha"],
        output: {
            file: "./dist/mocha-webdriver-client.js",
            format: "umd",
            name: "MochaWebdriverClient",
            globals: {
                mocha: "Mocha",
            },
        },
        plugins: [
            typescript({
                tsconfigOverride: {
                    compilerOptions: {
                        module: "esnext",
                        declaration: false,
                    },
                    include: ["./src/index.web.ts"],
                },
            }),
            commonjs(),
            nodeResolve({ preferBuiltins: false }),
        ],
    },
];
