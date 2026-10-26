/**
 * Reconhecimento de rostos no NAVEGADOR de quem clica em Iniciar.
 *
 * Usa a face-api (@vladmandic/face-api 1.7.15) carregada do jsDelivr na hora —
 * nada entra no bundle nem no package.json. Para cada foto: acha os rostos
 * (SSD MobileNet v1), calcula o vetor de 128 números de cada um e recorta uma
 * miniatura. O servidor é quem decide a qual pessoa cada rosto pertence
 * (src/lib/engajamento/rostos.ts).
 *
 * As fotos estão no storage público do Supabase, que responde com CORS "*" —
 * por isso dá para ler os pixels no canvas (crossOrigin = anonymous).
 */

const VERSAO = '1.7.15';
const BASE = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${VERSAO}`;

/** Rosto menor que isso (px, na foto original) não identifica ninguém com segurança. */
const LADO_MINIMO = 40;
const CONFIANCA_MINIMA = 0.6;

// Tipagem mínima do que usamos da face-api.
interface Caixa { x: number; y: number; width: number; height: number }
interface Deteccao { detection: { box: Caixa; score: number }; descriptor: Float32Array }
interface FaceApi {
  nets: Record<'ssdMobilenetv1' | 'faceLandmark68Net' | 'faceRecognitionNet', { loadFromUri(url: string): Promise<void> }>;
  SsdMobilenetv1Options: new (o: { minConfidence: number }) => unknown;
  detectAllFaces(img: HTMLImageElement, o: unknown): { withFaceLandmarks(): { withFaceDescriptors(): Promise<Deteccao[]> } };
  tf: { setBackend(b: string): Promise<boolean>; ready(): Promise<void> };
}

declare global {
  interface Window { __faceApiEngajamento?: Promise<FaceApi> }
}

/** Carrega a biblioteca e os 3 modelos uma vez por aba. */
export function carregarReconhecimento(): Promise<FaceApi> {
  if (window.__faceApiEngajamento) return window.__faceApiEngajamento;
  window.__faceApiEngajamento = new Promise<FaceApi>((resolve, reject) => {
    const evento = `faceapi-pronta-${Date.now()}`;
    const s = document.createElement('script');
    s.type = 'module';
    // módulo ES direto do CDN, fora do bundler
    s.textContent = `import * as f from '${BASE}/dist/face-api.esm.js'; window.dispatchEvent(new CustomEvent('${evento}', { detail: f }));`;
    s.onerror = () => reject(new Error('Não foi possível baixar o reconhecimento de rostos.'));
    window.addEventListener(evento, async (e) => {
      try {
        const api = (e as CustomEvent<FaceApi>).detail;
        await api.tf.setBackend('webgl').catch(() => false);
        await api.tf.ready();
        await Promise.all([
          api.nets.ssdMobilenetv1.loadFromUri(`${BASE}/model`),
          api.nets.faceLandmark68Net.loadFromUri(`${BASE}/model`),
          api.nets.faceRecognitionNet.loadFromUri(`${BASE}/model`),
        ]);
        resolve(api);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Falha ao preparar o reconhecimento de rostos.'));
      }
    }, { once: true });
    document.head.appendChild(s);
  });
  window.__faceApiEngajamento.catch(() => { window.__faceApiEngajamento = undefined; });
  return window.__faceApiEngajamento;
}

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Foto não carregou.'));
    img.src = url;
  });
}

/** Miniatura quadrada do rosto, com folga em volta, em JPEG. */
function recortar(img: HTMLImageElement, c: Caixa): string {
  const lado = Math.max(c.width, c.height) * 1.6;
  const cx = c.x + c.width / 2;
  const cy = c.y + c.height / 2;
  const canvas = document.createElement('canvas');
  canvas.width = 112;
  canvas.height = 112;
  canvas.getContext('2d')!.drawImage(img, cx - lado / 2, cy - lado / 2, lado, lado, 0, 0, 112, 112);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export interface RostoAchado {
  imagemIndice: number;
  descritor: number[];
  caixa: { x: number; y: number; w: number; h: number };
  pontuacao: number;
  foto: string;
}

/** Todos os rostos das fotos de uma publicação. Foto que não abre é pulada. */
export async function rostosDasFotos(api: FaceApi, urls: string[]): Promise<RostoAchado[]> {
  const opcoes = new api.SsdMobilenetv1Options({ minConfidence: CONFIANCA_MINIMA });
  const achados: RostoAchado[] = [];
  for (const [indice, url] of urls.entries()) {
    let img: HTMLImageElement;
    try {
      img = await carregarImagem(url);
    } catch {
      continue;
    }
    const deteccoes = await api.detectAllFaces(img, opcoes).withFaceLandmarks().withFaceDescriptors();
    for (const d of deteccoes) {
      const b = d.detection.box;
      if (b.width < LADO_MINIMO || b.height < LADO_MINIMO) continue;
      achados.push({
        imagemIndice: indice,
        descritor: Array.from(d.descriptor, (n) => Math.round(n * 1e6) / 1e6),
        caixa: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
        pontuacao: Math.round(d.detection.score * 1000) / 1000,
        foto: recortar(img, b),
      });
    }
  }
  return achados;
}
