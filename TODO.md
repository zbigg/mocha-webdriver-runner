# TODO

* `dist/mocha-webdriver-client.js` API is too long

* auto mode (branch `auto-mode`)
    * usage: --auto [test files.s]
    * generates temporary html (.mocha-webdriver-runner-test-$$$.html)
    * detects location of mocha and mocha-webdriver-client using require.resolve
    * uses adapted `bootstrap-worker` protocol
    * points browser at temporary file ...
    * ... or serves them automagically!

* automagically serve files from './'
  * for remote webdriver connections
  * --serve HOST:PORT
  * --localtunnell ? - required when yu have browser running on external hosts

* support for `mocha.Runner` options
    * `--fgrep`
    * `--globals`
    * `retries`
    * `delay`
    * `ui`!

* support for tests running in ServiceWorker (WebWorker is already there)

* enable logging from webdriver
* enable one run against several browsers from cli
    * look at config from hermione, mochify
    * API:
        ```javascript
        Brocha.run(url, {
            ...,
            [capability1, capability2, ...]
        });
        ```

* common keywords -> capabilities
    os: --linux, --windows, --mac
