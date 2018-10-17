self.importScripts("../../node_modules/mocha/mocha.js");
self.importScripts("../../node_modules/chai/chai.js");

// In your app, you should have this probably
// self.importScripts("../../node_modules/mocha-webdriver-runner/dist/mocha-webdriver-client.js");
self.importScripts("../../dist/mocha-webdriver-client.js");

mocha.setup({
    ui: "bdd",
});
MochaWebdriverClient.addMochaSource(mocha);

self.importScripts("tests.js");

mocha.checkLeaks();
mocha.run();