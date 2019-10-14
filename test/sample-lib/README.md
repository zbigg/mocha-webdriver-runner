# Sample test lib with coverage report from "in-browser" test run

1. Use `webpack` with `istanbul-instrumenter-loader` resolver to instrument 
test bundle.

```
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
```
See [./webpack.config.js](./webpack.config.js)

As for now, `mocha-webdriver-runner` doesn't have direct support for capturing `nyc` instrumentation result, but we know that its stored in global `__coverage__` and has to be saved in `.nyc_output*.json` to be picked up by `nyc report`, so

2. Use `-S` option of `mocha-driver-runner` to capture globals after tests:

```
$ webpack -d
$ mocha-webdriver-runner --headless-chrome -S __coverage__:.nyc_output/test.json ./dist/test/index.html
```
See [./package.json](./package.json)

3. Generate report

```
$ npx nyc report --reporter=text
npx: installed 144 in 5.916s
----------|----------|----------|----------|----------|-------------------|
File      |  % Stmts | % Branch |  % Funcs |  % Lines | Uncovered Line #s |
----------|----------|----------|----------|----------|-------------------|
All files |    83.33 |       75 |      100 |    83.33 |                   |
 lib.js   |    83.33 |       75 |      100 |    83.33 |                 3 |
----------|----------|----------|----------|----------|-------------------|
ERROR: Coverage for lines (83.33%) does not meet global threshold (90%)

```

Profit!