import { getGlobalCoverageInfo } from "../src/InstanbulPlugin";
import * as fs from "fs";
import * as uuidv4 from "uuid/v4";

after(function() {
    console.log("CoveragePlug");
    const coverage = getGlobalCoverageInfo();
    if (coverage) {
        console.log("CoveragePlug: GCR", Object.keys(coverage));
        fs.mkdirSync(".nyc_output", { recursive: true });
        fs.writeFileSync(`./.nyc_output/${uuidv4()}.json`, JSON.stringify(coverage), "utf-8");
    }
});
