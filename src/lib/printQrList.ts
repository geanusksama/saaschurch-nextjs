import QRCode from "qrcode";
import type { PrintOrientation } from "./printReport";

export interface QrListField {
  label: string;
  value: string;
}

export interface QrListItem {
  /** Conteúdo codificado no QR — normalmente a URL do leitor com o id do card. */
  qrValue: string;
  /** Texto curto impresso abaixo do QR (protocolo), para digitação manual. */
  caption?: string;
  fields: QrListField[];
}

export interface PrintQrListOptions {
  title: string;
  subtitle?: string;
  orientation: PrintOrientation;
  items: QrListItem[];
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Relatório de canhotos com QR Code — um por linha, para recortar e entregar.
 *
 * O QR alterna entre a esquerda e a direita a cada linha de propósito: com dois
 * QRs na mesma coluna, a câmera de quem está recolhendo os papéis lê os dois de
 * uma vez. Alternando, só um QR cai no enquadramento por vez.
 */
export async function printQrList(opts: PrintQrListOptions) {
  const { title, subtitle, orientation, items } = opts;
  const printDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  const qrImages = await Promise.all(
    items.map((item) =>
      QRCode.toDataURL(item.qrValue, { errorCorrectionLevel: "M", margin: 0, width: 320 })
        .catch(() => "")
    )
  );

  const strips = items.map((item, index) => {
    const side = index % 2 === 0 ? "qr-left" : "qr-right";
    const fields = item.fields
      .map((field) => `<div class="field"><span class="fl">${escapeHtml(field.label)}</span><span class="fv">${escapeHtml(field.value || "—")}</span></div>`)
      .join("");
    const img = qrImages[index]
      ? `<img src="${qrImages[index]}" alt="QR" />`
      : `<div class="qr-fail">QR</div>`;
    return `<div class="strip ${side}">
      <div class="qr">${img}${item.caption ? `<span class="qr-cap">${escapeHtml(item.caption)}</span>` : ""}</div>
      <div class="info">${fields}</div>
    </div>
    <div class="cut"><span>✂</span></div>`;
  }).join("");

  const printFrame = document.createElement("iframe");
  printFrame.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;";
  document.body.appendChild(printFrame);
  const fw = printFrame.contentWindow!;
  fw.document.open();
  fw.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:10px;color:#111;margin:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #ccc;padding-bottom:6px;margin-bottom:8px}
    .hdr-title{font-size:12px;font-weight:700;text-transform:uppercase;margin-bottom:2px}
    .hdr-sub{font-size:8px;color:#555}
    .hdr-brand{font-size:9px;font-weight:700;text-transform:uppercase;color:#555}
    .strip{display:flex;align-items:center;gap:10px;padding:6px 4px;min-height:24mm;page-break-inside:avoid;break-inside:avoid}
    .strip.qr-right{flex-direction:row-reverse}
    .qr{width:24mm;flex:0 0 24mm;text-align:center}
    .qr img{width:22mm;height:22mm;display:block;margin:0 auto}
    .qr-fail{width:22mm;height:22mm;margin:0 auto;border:1px dashed #999;display:flex;align-items:center;justify-content:center;color:#999}
    .qr-cap{display:block;margin-top:2px;font-size:7px;font-weight:700;letter-spacing:.04em;color:#444}
    .info{flex:1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px 12px}
    .strip.qr-right .info{text-align:right}
    .field{border-bottom:.5px solid #e5e7eb;padding-bottom:2px;min-width:0}
    .fl{display:block;font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#6b7280}
    .fv{display:block;font-size:9.5px;font-weight:600;color:#111;word-break:break-word}
    .cut{position:relative;border-top:1px dashed #9ca3af;height:10px;page-break-inside:avoid}
    .cut span{position:absolute;top:-6px;left:0;background:#fff;padding-right:3px;font-size:8px;color:#9ca3af;line-height:1}
    .cut:last-child{border-top-style:solid;border-color:#e5e7eb}
    .foot{font-size:8px;color:#666;margin-top:6px}
    @page{size:A4 ${orientation};margin:8mm}
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <p class="hdr-title">${escapeHtml(title)}</p>
      <p class="hdr-sub">${subtitle ? escapeHtml(subtitle) + " · " : ""}Impresso em: ${printDate}</p>
    </div>
    <div class="hdr-brand">SISTEMA MRM</div>
  </div>
  ${strips}
  <p class="foot">Total: ${items.length} registro${items.length !== 1 ? "s" : ""}</p>
</body>
</html>`);
  fw.document.close();

  // Sem esperar, a primeira impressão sai com os quadrados do QR em branco: o
  // print() dispara antes de o iframe decodificar as imagens. Da segunda vez
  // funcionava só porque elas já estavam no cache.
  await imagensProntas(fw);

  const cleanup = () => { if (document.body.contains(printFrame)) printFrame.remove(); };
  window.addEventListener("focus", cleanup, { once: true });
  fw.focus();
  fw.print();
}

/** Resolve quando toda imagem do iframe terminou de carregar (ou falhou). */
function imagensProntas(fw: Window) {
  return new Promise<void>((resolve) => {
    const imagens = Array.from(fw.document.images);
    const pendentes = imagens.filter((img) => !img.complete);

    // Rede não entra aqui (são data: URLs), mas um teto evita travar a impressão
    // caso alguma imagem nunca dispare load nem error.
    const limite = setTimeout(finalizar, 3000);
    let faltam = pendentes.length;

    function finalizar() {
      clearTimeout(limite);
      // Um quadro a mais para o layout assentar antes da caixa de impressão.
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
