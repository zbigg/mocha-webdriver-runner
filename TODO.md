# TODO

* `dist/mocha-webdriver-client.js` API is too long
* write actual tests
    * requires API
    * xunit test can be based on xpath patching

* HTML boilerplate
    * generate HTML boilerplate on demand
* temporarily generate HTML boilerplate "on fly"
* serve files from folder !?
    * all CLI options are cumbersome ?
    * shall we detect if url points at file ?
        * file is js, then autowrap it ?
        * file is HTML, then just run it ?
        * options to serve from given folder (needed by workers)

* auto mode
    * usage: --auto [test files.s]
    * generates temporary html (.mocha-webdriver-runner-test-$$$.html)
    * detects location of mocha and mocha-webdriver-client using require.resolve
    * uses adapted `bootstrap-worker` protocol
    * points browser at temporary file ...
    * ... or serves them automagically!

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
    browser --chrome, --firefox, --safari, --edge
    os: --linux, --windows, --mac
