import { generateReportExcel } from '../src/lib/excelGenerator';

async function main() {
  console.log('Testing generateReportExcel...');
  const url = generateReportExcel({
    titulo: 'Relatório de Teste',
    colunas: ['Data', 'Nome', 'Valor'],
    linhas: [
      ['2026-06-23', 'João', '150.00'],
      ['2026-06-23', 'Maria', '250.50']
    ],
    totais: ['Total: 400.50']
  });
  console.log('Excel generated successfully at URL:', url);
}

main().catch(err => console.error(err));
