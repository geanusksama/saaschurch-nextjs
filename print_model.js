const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

const regex = /model\s+(FacePresenca|EventAttendance)\s+\{[\s\S]*?\}/g;
let match;
while ((match = regex.exec(content)) !== null) {
  console.log(match[0]);
  console.log('\n---\n');
}
