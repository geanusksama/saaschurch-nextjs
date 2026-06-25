const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

const regex = /model\s+(\w+)\s+\{/g;
let match;
const models = [];
while ((match = regex.exec(content)) !== null) {
  models.push(match[1]);
}

console.log('Models found in schema.prisma:');
console.log(models.join(', '));

// Find any model containing 'ticket' or 'presence'
const ticketModels = models.filter(m => m.toLowerCase().includes('ticket') || m.toLowerCase().includes('presence') || m.toLowerCase().includes('attendance'));
console.log('\nRelated models:', ticketModels);
