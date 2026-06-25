const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf-8');
const models = content.match(/model\s+(\w+)/g);
console.log('MODELS:');
models.forEach(m => console.log('  ' + m.split(/\s+/)[1]));
