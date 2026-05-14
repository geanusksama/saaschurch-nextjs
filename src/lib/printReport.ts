export type PrintOrientation = 'portrait' | 'landscape';

export interface PrintColumn {
  label: string;
  key: string;
  width?: string;
}

export interface PrintReportOptions {
  title: string;
  subtitle?: string;
  orientation: PrintOrientation;
  columns: PrintColumn[];
  rows: Record<string, string | null | undefined>[];
}

export function printReport(opts: PrintReportOptions) {
  const { title, subtitle, orientation, columns, rows } = opts;
  const printDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const thead = columns.map((c) => `<th${c.width ? ` style="width:${c.width}"` : ''}>${c.label}</th>`).join('');

  const tbody = rows.map((row) =>
    `<tr>${columns.map((c) => `<td>${row[c.key] ?? '—'}</td>`).join('')}</tr>`
  ).join('');

  const printFrame = document.createElement('iframe');
  printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
  document.body.appendChild(printFrame);
  const fw = printFrame.contentWindow!;
  fw.document.open();
  fw.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:9px;color:#111;margin:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #ccc;padding-bottom:6px;margin-bottom:8px}
    .hdr-title{font-size:12px;font-weight:700;text-transform:uppercase;margin-bottom:2px}
    .hdr-sub{font-size:8px;color:#555}
    .hdr-brand{font-size:9px;font-weight:700;text-transform:uppercase;color:#555}
    table{width:100%;border-collapse:collapse;font-size:8.5px}
    th,td{border:.5px solid #dde1e7;padding:3px 4px;text-align:left;vertical-align:top}
    th{background:#f3f4f6;font-weight:700;text-transform:uppercase;font-size:7.5px;letter-spacing:.06em;white-space:nowrap}
    tr:nth-child(even) td{background:#f9fafb}
    .foot{font-size:8px;color:#666;margin-top:6px}
    @page{size:A4 ${orientation};margin:8mm}
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <p class="hdr-title">${title}</p>
      <p class="hdr-sub">${subtitle ? subtitle + ' · ' : ''}Impresso em: ${printDate}</p>
    </div>
    <div class="hdr-brand">SISTEMA MRM</div>
  </div>
  <table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}</tbody>
  </table>
  <p class="foot">Total: ${rows.length} registro${rows.length !== 1 ? 's' : ''}</p>
</body>
</html>`);
  fw.document.close();
  const cleanup = () => { if (document.body.contains(printFrame)) printFrame.remove(); };
  window.addEventListener('focus', cleanup, { once: true });
  fw.focus();
  fw.print();
}
