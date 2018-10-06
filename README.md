# Mocha-selenium-runner

Run Mocha tests in browsers using Selenium WebDriver.

Inspired by [mocha-chrome](https://www.npmjs.com/package/mocha-chrome), but with following
features implemented from start:

* drives browser using Selenium WebDriver, so you can run tests on everything that selenium WebDriver supports. Hint: it supports everything (tm).
* runs reporters locally, in node environment so most of reporters (which are designed to work in node environment) should work out-of-box:
    * tested mocha builtins: spec, xunit, tap, etc ...
    * support for `mochawesome` (including usage of `addContext`)

That's it, have fun.

## Install

```
$ npm install @zbigg/mocha-selenium-runner

```

## How to

Prepare your tests to run in browser as described on [Mocha website](https://mochajs.org/#running-mocha-in-the-browser).

Add `mocha-selenium-runner` browser side client:

     <script src="../node_modules/@zbigg/mocha-selenium-runner/dist/mocha-selenium-client.js"></script>

and tell `Mocha` that it should use it as reporter:

    mocha.setup({
      ui: "bdd",
      reporter: MochaSeleniumClient.Reporter
    })

Run the test suite:

    SELENIUM_BROWSER=Chrome npx mocha-selenium-runner test/index.html

    SELENIUM_BROWSER=Firefox npx mocha-selenium-runner test/index.html --reporter=tap

See `package.json` scripts and `test/sample-suite/index-headless` for reference.

(assuming your tests are in index.html).

For instructions how to pass parameters to Selenium WebDriver, see [WebDriverJS Builder] documentation.

[WebDriverJS Builder]:https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/index_exports_Builder.html

