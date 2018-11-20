# TODO

* `dist/mocha-webdriver-client.js` API is too long

* simplyfy mocha parameter passing -> they can be send as query-string args, so
  HTML
    * we can hijack mocha.setup only if `?mocha-webdriver-runner=true`
    * less HTML boilerplate: only `<script>` with `mocha-webdriver-client.js`
    * same HTML can run in manual and webdriver-driven mode
    * not sure how it will work with `file:` URLs

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
    browser --chrome, --firefox, --safari, --edge
    os: --linux, --windows, --mac
