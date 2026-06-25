const fs = require('fs');

const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

const regexAgent = /model\s+AiAgent\s+\{[\s\S]*?\}/gi;
const matchAgent = regexAgent.exec(content);
if (matchAgent) {
  console.log("=== AiAgent Model ===");
  console.log(matchAgent[0]);
}

const regexSetting = /model\s+Setting\s+\{[\s\S]*?\}/gi;
const matchSetting = regexSetting.exec(content);
if (matchSetting) {
  console.log("\n=== Setting Model ===");
  console.log(matchSetting[0]);
}
