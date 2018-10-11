import * as MochaSeleniumClient from '../es6/mocha-selenium-client';

declare global {
    interface Window {
        MochaSeleniumClient: typeof MochaSeleniumClient;
    }
}
