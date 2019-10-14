const path = require('path');
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
    devtool: "source-map",
    resolve: {
        extensions: [".js"],
        modules: [".", "node_modules"]
    },
    module: {
        rules: [
            // instrument only testing sources with Istanbul
            {
                test: /\.js$/,
                use: { loader: 'istanbul-instrumenter-loader' },
                include: path.resolve('lib/')
            }
        ]
    },
    output: {
        path: path.join(__dirname, "dist/test"),
        filename: "[name].bundle.js"
    },
    entry: {
        test: ["test/lib.spec.js"]
    },
    plugins: [
        new CopyWebpackPlugin([
            path.join(__dirname, "test/index.html"),
            require.resolve("mocha/mocha.js"),
            require.resolve("mocha/mocha.css"),
            require.resolve("../../dist/mocha-webdriver-client.js")
        ])
    ]
}