const fs = require('fs');

const content = fs.readFileSync('src/app-ui/finance/Diretoria.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('<ResponsiveContainer') || line.includes('<BarChart') || line.includes('<AreaChart') || line.includes('<PieChart') || line.includes('<LineChart')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
