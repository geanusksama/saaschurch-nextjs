import QRCode from "qrcode";

/**
 * Presets de tamanho de etiqueta — não há integração real de driver de
 * impressora (Zebra ou qualquer outra); a impressão sai pelo diálogo padrão
 * do navegador (window.print), então o "modelo de impressora" escolhido pelo
 * usuário só decide o tamanho/layout da etiqueta impressa via CSS @page.
 */
export interface LabelPreset {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  cols: number;
  /** true = página avulsa por etiqueta (rolo Zebra); false = grade em folha A4 */
  singlePerPage: boolean;
}

export const LABEL_PRESETS: LabelPreset[] = [
  { id: "zebra-50x25", label: "Zebra 50×25mm (rolo)", widthMm: 50, heightMm: 25, cols: 1, singlePerPage: true },
  { id: "zebra-100x150", label: "Zebra 100×150mm (rolo)", widthMm: 100, heightMm: 150, cols: 1, singlePerPage: true },
  { id: "pimaco-a4-3x8", label: "Pimaco A4 (3 colunas × 8 linhas)", widthMm: 63.5, heightMm: 33.9, cols: 3, singlePerPage: false },
  { id: "a4-simple", label: "A4 folha simples (2 colunas)", widthMm: 90, heightMm: 50, cols: 2, singlePerPage: false },
];

export interface LabelAsset {
  code: string;
  name: string;
  sector?: string | null;
  photoUrl?: string | null;
  qrToken: string;
}

export interface PrintAssetLabelsOptions {
  preset: string;
  assets: LabelAsset[];
  showPhoto?: boolean;
  showSector?: boolean;
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function printAssetLabels(opts: PrintAssetLabelsOptions) {
  const preset = LABEL_PRESETS.find((p) => p.id === opts.preset) || LABEL_PRESETS[0];
  const { assets, showPhoto = false, showSector = true } = opts;

  const qrImages = await Promise.all(
    assets.map((a) => QRCode.toDataURL(a.qrToken, { errorCorrectionLevel: "M", margin: 0, width: 200 }).catch(() => ""))
  );

  const labels = assets.map((asset, i) => {
    const qr = qrImages[i] ? `<img class="qr" src="${qrImages[i]}" alt="QR" />` : `<div class="qr-fail">QR</div>`;
    const photo = showPhoto && asset.photoUrl ? `<img class="photo" src="${asset.photoUrl}" alt="" />` : "";
    return `<div class="label">
      ${photo}
      <div class="qr-wrap">${qr}</div>
      <div class="info">
        <span class="name">${escapeHtml(asset.name)}</span>
        <span class="code">${escapeHtml(asset.code)}</span>
        ${showSector && asset.sector ? `<span class="sector">${escapeHtml(asset.sector)}</span>` : ""}
      </div>
    </div>`;
  }).join("");

  const pageSize = preset.singlePerPage
    ? `${preset.widthMm}mm ${preset.heightMm}mm`
    : "A4 portrait";

  const printFrame = document.createElement("iframe");
  printFrame.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;";
  document.body.appendChild(printFrame);
  const fw = printFrame.contentWindow!;
  fw.document.open();
  fw.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Etiquetas de Patrimônio</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .sheet{display:grid;grid-template-columns:repeat(${preset.cols},1fr);gap:2mm;padding:${preset.singlePerPage ? "0" : "4mm"}}
    .label{width:${preset.widthMm}mm;height:${preset.heightMm}mm;border:${preset.singlePerPage ? "none" : "0.5px dashed #ccc"};display:flex;align-items:center;gap:2mm;padding:1.5mm;page-break-inside:avoid;overflow:hidden}
    .qr-wrap{flex:0 0 auto}
    .qr{width:${Math.min(preset.heightMm - 4, 20)}mm;height:${Math.min(preset.heightMm - 4, 20)}mm;display:block}
    .qr-fail{width:16mm;height:16mm;border:1px dashed #999;display:flex;align-items:center;justify-content:center;font-size:6px;color:#999}
    .photo{width:${Math.min(preset.heightMm - 4, 16)}mm;height:${Math.min(preset.heightMm - 4, 16)}mm;object-fit:cover;border-radius:1mm;flex:0 0 auto}
    .info{display:flex;flex-direction:column;min-width:0;overflow:hidden}
    .name{font-size:7.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .code{font-size:6.5px;color:#555;font-family:monospace}
    .sector{font-size:6px;color:#777;text-transform:uppercase}
    @page{size:${pageSize};margin:${preset.singlePerPage ? "0" : "6mm"}}
  </style>
</head>
<body>
  <div class="sheet">${labels}</div>
</body>
</html>`);
  fw.document.close();

  await imagensProntas(fw);
  const cleanup = () => { if (document.body.contains(printFrame)) printFrame.remove(); };
  window.addEventListener("focus", cleanup, { once: true });
  fw.focus();
  fw.print();
}

function imagensProntas(fw: Window) {
  return new Promise<void>((resolve) => {
    const imagens = Array.from(fw.document.images);
    const pendentes = imagens.filter((img) => !img.complete);
    const limite = setTimeout(finalizar, 4000);
    let faltam = pendentes.length;
    function finalizar() {
      clearTimeout(limite);
      fw.requestAnimationFrame(() => resolve());
    }
    if (!faltam) return finalizar();
    const aoTerminar = () => { faltam -= 1; if (faltam <= 0) finalizar(); };
    for (const img of pendentes) {
      img.addEventListener("load", aoTerminar, { once: true });
      img.addEventListener("error", aoTerminar, { once: true });
    }
  });
}
