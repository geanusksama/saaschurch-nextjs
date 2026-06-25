const fs = require('fs');

const content = fs.readFileSync('prisma/schema.prisma', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.trim().startsWith('model AiAgent') || line.trim().startsWith('model Setting') || line.trim().startsWith('model Campo ')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
