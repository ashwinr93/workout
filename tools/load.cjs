// Loads the app's data files (library, plan format, wording, AI prompt) in Node, the way the
// browser does: as plain scripts sharing one scope. Returns that scope.
//   const app = require("./tools/load.cjs");  app.EX, app.parsePlan(…), app.allPhrases()
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const FILES = ["library.js", "plan.js", "speech.js", "prompt.js"];
const NAMES = ["EX", "WARMUP", "COOLDOWN", "ACTIVITIES", "variant", "isVariant", "MUSCLES", "muscleList", "DOSE", "WEEKDAYS", "DAY_NAMES",
  "EXAMPLE_PLAN", "dose", "doseOptions", "parsePlan", "planLink", "examplePlan", "SPOKEN_NAMES", "speakable", "SAY",
  "clipId", "allPhrases", "SITE", "AI_CHATS", "chatLink", "coachPrompt"];
const ctx = vm.createContext({ console });
vm.runInContext(FILES.map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n;\n")
  + `\n;this.__out = { ${NAMES.join(", ")} };`, ctx, { filename: "app-data.js" });
module.exports = ctx.__out;
