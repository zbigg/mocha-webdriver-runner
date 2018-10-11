# TODO

* cosider new name
    * mocha-selenium-runner already taken (but not popular nor maintained)
        * and/or take over, talk with original maintainer !?
    * proposed
        * mocha-webdriver-runner
        * mocha-webdriver
        * brocha ;) as BROwser moCHA

* write actual tests
    * requires API
    * xunit test can be based on xpath patching

* pasing logs should be optional
    * client: captureConsoleLog
        default undefined
        undefined can be overriden by driver in init
        true
    * driver: captureConsoleLog
        captureConsoleLog

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

* expose JS API
    * Mocha.Runner like JS API ?
    ```javascript
    import { Brocha } from 'brocha';

    Brocha.run(url, {
        grep,
        capabilities
    });
    ```

* common keywords -> capabilities
    browser --chrome, --firefox, --safari, --edge
    os: --linux, --windows, --mac