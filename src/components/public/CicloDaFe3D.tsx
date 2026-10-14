'use client';

/**
 * Hero da home pública: o ciclo de vida do crente em 3D.
 *
 * Porta a cena "pipeline" do site Biotech A (estações, portais e pessoas em
 * three.js) para o caminho da fé: um caminho de terra sobre a malha, percorrido
 * por uma pessoa. O caminho é FECHADO — Multiplicar
 * volta para Receber o Evangelho — e no centro está o Ensino da Palavra,
 * ligado a todas as etapas. No lugar do "backlog" fica a pilha de demandas de
 * pessoas que chegam à igreja.
 *
 * A cena é só decoração interativa: tudo o que é conteúdo (título, textos,
 * cards da igreja) vem da configuração da home e é renderizado em HTML por
 * cima, então continua legível e acessível sem WebGL.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, LayoutGrid, Minus, Pause, Play, Plus, X } from 'lucide-react';

export type EtapaDoCiclo = { nome: string; titulo: string; desc: string; ref: string };

export const ETAPAS_DO_CICLO: EtapaDoCiclo[] = [
  { nome: 'Receber o Evangelho', titulo: 'Receber o Evangelho', desc: 'A boa notícia chega: alguém anuncia Jesus na rua, em casa, no trabalho.', ref: 'Rm 10:17' },
  { nome: 'Aceitar Jesus', titulo: 'Aceitar Jesus', desc: 'A pessoa crê, se arrepende e recebe Cristo como Senhor e Salvador.', ref: 'Jo 1:12' },
  { nome: 'Acolhimento', titulo: 'Acolhimento', desc: 'A igreja recebe: nome, contato e alguém que caminha junto nos primeiros passos.', ref: 'Rm 15:7' },
  { nome: 'Discipulado', titulo: 'Discipulado', desc: 'Os primeiros passos na fé, com acompanhamento próximo e o ensino da Palavra.', ref: 'Mt 28:19-20' },
  { nome: 'Peniel', titulo: 'Peniel', desc: 'O encontro face a face com Deus: imersão, cura interior e um novo começo.', ref: 'Gn 32:30' },
  { nome: 'Casa de Paz e GF', titulo: 'Casa de Paz e GF', desc: 'Do Peniel para os lares: a Casa de Paz alcança a vizinhança e o GF cuida e integra.', ref: 'At 2:46' },
  { nome: 'Maturidade', titulo: 'Maturidade', desc: 'Fé firme e caráter de Cristo: os frutos do Espírito no dia a dia.', ref: 'Ef 4:13' },
  { nome: 'EBD', titulo: 'EBD — Escola Bíblica Dominical', desc: 'O ensino sistemático da Palavra, para todas as idades.', ref: '2Tm 3:16' },
  { nome: 'Multiplicar', titulo: 'Multiplicar', desc: 'Novos discípulos, novos líderes, novos grupos — e o ciclo recomeça.', ref: '2Tm 2:2' },
];

/** O centro do ciclo: a Palavra sustenta todas as etapas. */
const CENTRO = { nome: 'Ensino da Palavra', ref: 'Sl 119:105' };

type Tema = {
  fundo: string; fog: number; ceu: number; chao: number; grade: [number, number];
  terra: number; pedra: number; folha: number; tronco: number; rocha: number; grama: number; plataforma: number; papel: number; apagado: number; portal: number; borda: number;
  texto: string; textoSub: string; rotuloBg: string; rotuloBorda: string; painelBg: string; painelBorda: string;
};

const TEMA_ESCURO: Tema = {
  fundo: 'radial-gradient(120% 80% at 60% 55%,#0F3354 0%,#071C30 65%)', fog: 0x071c30, ceu: 0xe6f3ff, chao: 0x0b2a45,
  grade: [0x2b5c86, 0x1a4469], terra: 0x8b7352, pedra: 0x5e5446, folha: 0x2f8a57, tronco: 0x6b4a2b, rocha: 0x6b7a8a, grama: 0x2c7a4d, plataforma: 0x123a5c, papel: 0xf4f7fa,
  apagado: 0x2d5577, portal: 0x6f8fa8, borda: 0x0b2a45,
  texto: '#F4F7FA', textoSub: '#B7C7D6', rotuloBg: 'rgba(7,28,48,0.78)', rotuloBorda: 'rgba(244,247,250,0.18)',
  painelBg: 'rgba(13,39,64,0.85)', painelBorda: 'rgba(244,247,250,0.12)',
};

const TEMA_CLARO: Tema = {
  fundo: 'radial-gradient(120% 80% at 60% 55%,#F4F8FC 0%,#DCE8F3 70%)', fog: 0xdce8f3, ceu: 0xffffff, chao: 0x9fb8cf,
  grade: [0x9fb9d1, 0xbfd1e2], terra: 0xc9ac80, pedra: 0x8f7c63, folha: 0x58b06e, tronco: 0x8a6440, rocha: 0x9aa7b4, grama: 0x8fcf87, plataforma: 0xc6d9ea, papel: 0x3d5f80,
  apagado: 0xa7bfd4, portal: 0x6f8fa8, borda: 0x2d4a63,
  texto: '#0B2239', textoSub: '#43607A', rotuloBg: 'rgba(255,255,255,0.86)', rotuloBorda: 'rgba(11,34,57,0.16)',
  painelBg: 'rgba(255,255,255,0.88)', painelBorda: 'rgba(11,34,57,0.12)',
};

const N = ETAPAS_DO_CICLO.length;
/** Depois de um clique, o ciclo automático volta sozinho após este tempo. */
const RETOMA_EM = 8000;
/** Limites do zoom (1 = enquadramento padrão; maior = mais perto). */
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.8;
const limitaZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
const pad = (n: number) => String(n + 1).padStart(2, '0');

/** Rótulos soltos na cena (posicionados a cada quadro). */
const ROTULOS_CENA = [
  { t: '▤ Demandas de pessoas', cor: 'texto' },
  { t: `◎ ${CENTRO.nome} · ${CENTRO.ref}`, cor: 'accent' },
  { t: '↺ quem multiplica volta a anunciar', cor: 'sub' },
];

export function CicloDaFe3D({
  isDark,
  accent,
  topo,
  cards,
  infoCentro,
}: {
  isDark: boolean;
  /** Cor de destaque da igreja (configuração da home). */
  accent: string;
  /** Título e textos da igreja, à esquerda no topo. */
  topo: ReactNode;
  /** Cards principais da home, à direita no topo. */
  cards: ReactNode;
  /** Horários dos cultos e endereço da sede, mostrados no centro do ciclo. */
  infoCentro?: { endereco: string; horarios: { dia: string; itens: string[] }[] } | null;
}) {
  const tema = isDark ? TEMA_ESCURO : TEMA_CLARO;
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const [ativo, setAtivo] = useState(0);
  const [andando, setAndando] = useState(false);
  const ativoRef = useRef(0);
  const usuarioMexeu = useRef(false);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Pausa pelo botão: só o play tira. */
  const [pausado, setPausado] = useState(false);
  const pausadoRef = useRef(false);
  /** Card central com a explicação da etapa: aparece no clique do usuário. */
  const [cartao, setCartao] = useState(false);
  const retomarRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Zoom da cena: lido a cada quadro pela câmera. */
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const mudarZoom = useCallback((z: number) => {
    const novo = limitaZoom(z);
    zoomRef.current = novo;
    setZoom(novo);
  }, []);
  const irParaRef = useRef<(i: number) => boolean>(() => false);

  const semMovimento = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const agendarAuto = useCallback((ms = 4200) => {
    if (autoRef.current) clearTimeout(autoRef.current);
    if (usuarioMexeu.current || pausadoRef.current || semMovimento) return;
    autoRef.current = setTimeout(() => {
      const prox = (ativoRef.current + 1) % N;
      ativoRef.current = prox;
      setAtivo(prox);
      if (irParaRef.current(prox)) setAndando(true);
    }, ms);
  }, [semMovimento]);

  /**
   * Clique do usuário: pausa o automático, que volta sozinho 8 s depois. O card
   * central só abre no clique de um nó do ciclo (abrirCartao); a lista de
   * etapas de baixo e as setas só navegam.
   */
  const irPara = useCallback((i: number, peloUsuario: boolean, abrirCartao = false) => {
    if (peloUsuario) {
      usuarioMexeu.current = true;
      if (autoRef.current) clearTimeout(autoRef.current);
      if (retomarRef.current) clearTimeout(retomarRef.current);
      setCartao(abrirCartao);
      retomarRef.current = setTimeout(() => {
        if (pausadoRef.current) return; // pausado pelo botão: espera o play
        usuarioMexeu.current = false;
        setCartao(false);
        agendarAuto(300);
      }, RETOMA_EM);
    }
    ativoRef.current = i;
    setAtivo(i);
    if (irParaRef.current(i)) setAndando(true);
  }, [agendarAuto]);

  const alternarPlay = useCallback(() => {
    if (retomarRef.current) clearTimeout(retomarRef.current);
    if (pausadoRef.current) {
      pausadoRef.current = false;
      setPausado(false);
      usuarioMexeu.current = false;
      setCartao(false);
      agendarAuto(300);
    } else {
      pausadoRef.current = true;
      setPausado(true);
      if (autoRef.current) clearTimeout(autoRef.current);
    }
  }, [agendarAuto]);

  const fecharCartao = useCallback(() => {
    setCartao(false);
    if (retomarRef.current) clearTimeout(retomarRef.current);
    if (!pausadoRef.current) {
      usuarioMexeu.current = false;
      agendarAuto(1200);
    }
  }, [agendarAuto]);

  useEffect(() => () => { if (retomarRef.current) clearTimeout(retomarRef.current); }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let W = host.clientWidth, H = host.clientHeight;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // sem WebGL: fica só o conteúdo em HTML
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, W < 760 ? 1.5 : 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(tema.fog, 24, 52);
    const cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 200);
    // Iluminação física (three ≥ r155): as intensidades do r128 multiplicadas por π.
    scene.add(new THREE.HemisphereLight(tema.ceu, tema.chao, 0.6 * Math.PI));
    const sol = new THREE.DirectionalLight(0xffffff, 0.95 * Math.PI);
    sol.position.set(-6, 16, 9);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12 });
    scene.add(sol);
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({ opacity: isDark ? 0.4 : 0.18 }));
    chao.rotation.x = -Math.PI / 2;
    chao.receiveShadow = true;
    scene.add(chao);
    const grade = new THREE.GridHelper(70, 70, tema.grade[0], tema.grade[1]);
    grade.position.y = 0.002;
    scene.add(grade);

    const cor = new THREE.Color(accent), papel = new THREE.Color(tema.papel), apagado = new THREE.Color(tema.apagado);

    // ── Trilho fechado: elipse ondulada com as 10 etapas ────────────────────
    const A = 12.8, B = 4.3;
    const ang = (i: number) => Math.PI * 0.9 - (i / N) * Math.PI * 2;
    const SP = ETAPAS_DO_CICLO.map((_, i) => {
      const a = ang(i), onda = i % 2 ? 0.55 : -0.35;
      return new THREE.Vector3((A + onda) * Math.cos(a), 0, (B + onda * 0.6) * Math.sin(a));
    });
    const curva = new THREE.CatmullRomCurve3(SP, true, 'centripetal');
    const envolve = (u: number) => ((u % 1) + 1) % 1;
    const stT = SP.map((p) => {
      let melhor = 0, bd = 1e9;
      for (let k = 0; k <= 3000; k++) {
        const u = k / 3000, q = curva.getPointAt(u), d = q.distanceToSquared(p);
        if (d < bd) { bd = d; melhor = u; }
      }
      return melhor;
    });
    const cima = new THREE.Vector3(0, 1, 0);
    const ladoEm = (u: number) => { const t = curva.getTangentAt(u); t.y = 0; return t.normalize().cross(cima).normalize(); };

    // Caminho de terra batida (no lugar dos trilhos do site de referência): uma
    // faixa larga com as bordas irregulares e pedrinhas dos dois lados.
    const NC = 600, largura = 0.78;
    const verts: number[] = [], idx: number[] = [];
    for (let k = 0; k <= NC; k++) {
      const u = (k % NC) / NC, p = curva.getPointAt(u), sd = ladoEm(u);
      const ondula = 1 + Math.sin(k * 0.9) * 0.06 + Math.sin(k * 0.23) * 0.05;
      const a = p.clone().addScaledVector(sd, largura * ondula), b = p.clone().addScaledVector(sd, -largura * ondula);
      verts.push(a.x, 0.02, a.z, b.x, 0.02, b.z);
      if (k < NC) { const v = k * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
    }
    const caminhoGeo = new THREE.BufferGeometry();
    caminhoGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    caminhoGeo.setIndex(idx);
    caminhoGeo.computeVertexNormals();
    const caminho = new THREE.Mesh(caminhoGeo, new THREE.MeshStandardMaterial({ color: tema.terra, roughness: 1, side: THREE.DoubleSide }));
    caminho.receiveShadow = true;
    scene.add(caminho);
    const NP = 520, dummy = new THREE.Object3D();
    const pedras = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.07, 0), new THREE.MeshStandardMaterial({ color: tema.pedra, roughness: 0.95 }), NP);
    for (let k = 0; k < NP; k++) {
      const u = k / NP, p = curva.getPointAt(u), sd = ladoEm(u);
      const lado = k % 2 ? 1 : -1, desvio = largura + 0.05 + ((k * 37) % 13) / 13 * 0.22;
      dummy.position.copy(p).addScaledVector(sd, lado * desvio).setY(0.04);
      dummy.rotation.set(k * 0.7, k * 1.3, 0);
      dummy.scale.setScalar(0.6 + ((k * 53) % 11) / 11 * 0.9);
      dummy.updateMatrix();
      pedras.setMatrixAt(k, dummy.matrix);
    }
    pedras.castShadow = true; pedras.receiveShadow = true;
    scene.add(pedras);
    dummy.scale.setScalar(1);
    const ND = 260;
    const pontos = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), ND);
    for (let k = 0; k < ND; k++) {
      const p = curva.getPointAt(k / ND);
      dummy.position.set(p.x, 0.04, p.z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      pontos.setMatrixAt(k, dummy.matrix); pontos.setColorAt(k, apagado);
    }
    scene.add(pontos);

    // ── Estações (para fora do caminho) ─────────────────────────────────────
    // null = ícone montado à mão (igreja, casa + GF, pilha de livros).
    const geos: (THREE.BufferGeometry | null)[] = [
      new THREE.ConeGeometry(0.42, 1.0, 6),              // receber o evangelho: o anúncio
      new THREE.OctahedronGeometry(0.55),                // aceitar Jesus
      null,                                              // acolhimento: a igreja
      new THREE.BoxGeometry(0.75, 0.75, 0.75),           // discipulado
      new THREE.ConeGeometry(0.34, 0.95, 16),            // Peniel: a chama
      null,                                              // Casa de Paz e GF
      new THREE.TorusKnotGeometry(0.32, 0.11, 100, 14),  // maturidade
      null,                                              // EBD: os livros
      new THREE.IcosahedronGeometry(0.58, 0),            // multiplicar
    ];
    const centro = new THREE.Vector3();
    /** Igrejinha: nave, telhado de duas águas, torre com pináculo e cruz. */
    const igreja = (mat: THREE.Material) => {
      const g = new THREE.Group();
      const parte = (geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
        const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m;
      };
      parte(new THREE.BoxGeometry(0.62, 0.42, 0.85), 0, -0.2, 0.08);                          // nave
      parte(new THREE.CylinderGeometry(0.001, 0.46, 0.32, 4, 1, false, Math.PI / 4), 0, 0.17, 0.08, 0, 0, 0).scale.set(0.95, 1, 1.32); // telhado
      parte(new THREE.BoxGeometry(0.3, 0.62, 0.3), 0, -0.1, -0.42);                           // torre
      parte(new THREE.ConeGeometry(0.22, 0.34, 4), 0, 0.38, -0.42, 0, Math.PI / 4, 0);         // pináculo
      parte(new THREE.BoxGeometry(0.04, 0.26, 0.04), 0, 0.66, -0.42);                         // cruz (haste)
      parte(new THREE.BoxGeometry(0.16, 0.04, 0.04), 0, 0.7, -0.42);                          // cruz (braço)
      return g;
    };
    /** Casa de Paz (casinha) e GF (roda de pessoas) juntos. */
    const casaEGF = (mat: THREE.Material) => {
      const g = new THREE.Group();
      const casa = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 0.44), mat); casa.position.set(-0.18, -0.15, 0); casa.castShadow = true;
      const teto = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.3, 4), mat); teto.position.set(-0.18, 0.19, 0); teto.rotation.y = Math.PI / 4; teto.castShadow = true;
      const roda = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 12, 32), mat); roda.position.set(0.32, 0.05, 0.1); roda.rotation.x = Math.PI / 2.4; roda.castShadow = true;
      g.add(casa, teto, roda);
      return g;
    };
    /** EBD: uma pilha de livros. */
    const livros = (mat: THREE.Material) => {
      const g = new THREE.Group();
      [0, 1, 2].forEach((k) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.72 - k * 0.08, 0.16, 0.5 - k * 0.04), mat);
        m.position.y = -0.2 + k * 0.17; m.rotation.y = (k - 1) * 0.25; m.castShadow = true; g.add(m);
      });
      return g;
    };
    type Estacao = { g: THREE.Group; icone: THREE.Object3D; iconeMat: THREE.MeshStandardMaterial; anelMat: THREE.MeshBasicMaterial; portalMat: THREE.MeshStandardMaterial; a: number };
    const estacoes: Estacao[] = [];
    const clicaveis: THREE.Object3D[] = [];
    stT.forEach((u, i) => {
      const p = curva.getPointAt(u), t = curva.getTangentAt(u), lado = ladoEm(u);
      const sinal = Math.sign(lado.dot(p.clone().setY(0).sub(centro))) || 1;
      const g = new THREE.Group();
      g.position.copy(p).addScaledVector(lado, 1.9 * sinal).setY(0);
      scene.add(g);
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.22, 48), new THREE.MeshStandardMaterial({ color: tema.plataforma, roughness: 0.7 }));
      plat.position.y = 0.11; plat.castShadow = plat.receiveShadow = true; g.add(plat);
      const anelMat = new THREE.MeshBasicMaterial({ color: apagado.clone() });
      const anel = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.03, 8, 64), anelMat);
      anel.rotation.x = Math.PI / 2; anel.position.y = 0.23; g.add(anel);
      const iconeMat = new THREE.MeshStandardMaterial({ color: papel.clone(), roughness: 0.35, metalness: 0.15, emissive: cor, emissiveIntensity: 0 });
      // Acolhimento é a igreja; Casa de Paz e GF e a EBD têm ícone próprio. As
      // demais etapas usam as formas geométricas do site de referência.
      const geo = geos[i];
      const icone: THREE.Object3D = i === 2 ? igreja(iconeMat)
        : i === 5 ? casaEGF(iconeMat)
        : i === 7 || !geo ? livros(iconeMat)
        : new THREE.Mesh(geo, iconeMat);
      icone.position.y = 1.25; icone.castShadow = true; g.add(icone);
      const portalMat = new THREE.MeshStandardMaterial({ color: tema.portal, metalness: 0.6, roughness: 0.4, emissive: cor, emissiveIntensity: 0 });
      const portal = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 8, 32, Math.PI), portalMat);
      portal.position.set(p.x, 0, p.z); portal.rotation.y = Math.atan2(t.x, t.z) + Math.PI / 2; portal.castShadow = true;
      scene.add(portal);
      plat.userData.idx = i; clicaveis.push(plat);
      icone.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.userData.idx = i; clicaveis.push(m); } });
      estacoes.push({ g, icone, iconeMat, anelMat, portalMat, a: 0 });
    });
    const posEstacao = (i: number) => estacoes[i].g.position.clone().setY(0.35);

    // ── Pontos fixos dos rótulos da cena ────────────────────────────────────
    const posRotulos: THREE.Vector3[] = [];
    // Linhas tracejadas: cor da igreja no escuro; no claro, quase preto (o
    // amarelo sumia no fundo claro).
    const corLinha = isDark ? new THREE.Color(accent).getHex() : 0x1b2a3a;
    type Corredor = { c: THREE.CubicBezierCurve3; m: THREE.Mesh; o: number };
    const corredores: Corredor[] = [];
    const arco = (a: THREE.Vector3, b: THREE.Vector3, off: THREE.Vector3, corArco: number) => {
      const c = new THREE.CubicBezierCurve3(a, a.clone().add(off), b.clone().add(off), b);
      const linha = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(c.getPoints(80)),
        new THREE.LineDashedMaterial({ color: corArco, dashSize: 0.22, gapSize: 0.16, transparent: true, opacity: 0.85 }),
      );
      linha.computeLineDistances(); scene.add(linha);
      const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 10), new THREE.MeshBasicMaterial({ color: corArco }));
      ponta.position.copy(c.getPoint(1));
      ponta.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.getPoint(1).sub(c.getPoint(0.95)).normalize());
      scene.add(ponta);
      const bola = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), new THREE.MeshBasicMaterial({ color: corArco }));
      scene.add(bola);
      corredores.push({ c, m: bola, o: Math.random() });
    };

    // Demandas de pessoas (no lugar do "backlog"): uma pilha de fichas fora do
    // trilho, perto de Evangelizar, que alimenta o ciclo.
    // Dentro do ciclo, à esquerda: por fora ela saía da tela.
    const demandasPos = new THREE.Vector3(-9.2, 0, 0.6);
    const demandas = new THREE.Group(); demandas.position.copy(demandasPos); demandas.rotation.y = 0.35; scene.add(demandas);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.14, 1.5), new THREE.MeshStandardMaterial({ color: tema.plataforma, roughness: 0.7 }));
    base.position.y = 0.07; base.castShadow = base.receiveShadow = true; demandas.add(base);
    const fichas: THREE.Mesh[] = [];
    [0xe5493a, 0x22b566, 0x2684ff, 0xffab00, 0xa78bfa, 0x22b566].forEach((c, k) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.9), new THREE.MeshStandardMaterial({ color: tema.papel, roughness: 0.5 }));
      m.position.set(k % 2 ? 0.05 : -0.05, 0.18 + k * 0.08, (k % 3 - 1) * 0.04); m.rotation.y = (k % 3 - 1) * 0.07; m.castShadow = true;
      const tarja = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.064, 0.9), new THREE.MeshBasicMaterial({ color: c }));
      tarja.position.x = -0.63; m.add(tarja);
      demandas.add(m); fichas.push(m);
    });
    posRotulos.push(demandasPos.clone().setY(1.5));
    arco(demandasPos.clone().setY(0.6), posEstacao(0), new THREE.Vector3(0, 1.6, 0), corLinha);

    // Centro: Ensino da Palavra, ligado a todas as etapas.
    const centroPos = new THREE.Vector3(0.6, 0, -0.2);
    const hubs = [0].map(() => {
      const g = new THREE.Group(); g.position.copy(centroPos); scene.add(g);
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, 0.24, 48), new THREE.MeshStandardMaterial({ color: tema.plataforma, roughness: 0.7 }));
      plat.position.y = 0.12; plat.castShadow = plat.receiveShadow = true; g.add(plat);
      const anel = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.04, 8, 72), new THREE.MeshBasicMaterial({ color: cor }));
      anel.rotation.x = Math.PI / 2; anel.position.y = 0.25; g.add(anel);
      // Livro aberto: duas páginas inclinadas sobre uma lombada.
      const livroMat = new THREE.MeshStandardMaterial({ color: tema.papel, roughness: 0.4, emissive: cor, emissiveIntensity: 0.25 });
      const capaMat = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.5 });
      const simbolo = new THREE.Group();
      [-1, 1].forEach((lado) => {
        const pag = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.8), livroMat);
        pag.position.set(lado * 0.31, 0, 0); pag.rotation.z = -lado * 0.22; pag.castShadow = true; simbolo.add(pag);
        const capa = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.03, 0.84), capaMat);
        capa.position.set(lado * 0.32, -0.04, 0); capa.rotation.z = -lado * 0.22; simbolo.add(capa);
      });
      simbolo.position.y = 1.15; g.add(simbolo);
      const luz = new THREE.PointLight(cor, 2.5, 5, 1); luz.position.y = 1.6; g.add(luz);
      posRotulos.push(centroPos.clone().setY(2.3));
      estacoes.forEach((_, e) => arco(centroPos.clone().setY(0.45), posEstacao(e), new THREE.Vector3(0, 0.9, 0), corLinha));
      return { simbolo };
    });
    // Rótulo do retorno: entre Multiplicar e Evangelizar, por fora do trilho
    // (por dentro ele cobria o rótulo de Evangelizar).
    {
      const u = envolve((stT[N - 1] + stT[0] + 1) / 2), q = curva.getPointAt(u), l = ladoEm(u);
      const sinal = Math.sign(l.dot(q.clone().setY(0))) || 1;
      posRotulos.push(q.addScaledVector(l, 3.4 * sinal).setY(0.4));
    }

    // ── Cenário: manchas de grama, árvores low-poly e rochas ────────────────
    // Sorteio com semente fixa: o cenário é o mesmo a cada visita. Nada nasce
    // em cima do caminho, das estações, do centro ou da pilha de demandas.
    let semente = 20261014;
    const sorte = () => { semente = (semente * 1664525 + 1013904223) % 4294967296; return semente / 4294967296; };
    const amostrasCaminho = Array.from({ length: 240 }, (_, k) => curva.getPointAt(k / 240));
    const livre = (x: number, z: number, folga: number) => {
      const q = new THREE.Vector3(x, 0, z);
      if (amostrasCaminho.some((a) => a.distanceTo(q) < 1.4 + folga)) return false;
      if (estacoes.some((st) => st.g.position.distanceTo(q) < 1.7 + folga)) return false;
      if (centroPos.distanceTo(q) < 3.2 + folga) return false;
      if (demandasPos.distanceTo(q) < 1.9 + folga) return false;
      return true;
    };
    const sortearLugar = (folga: number, dentroDoCiclo = false) => {
      for (let t = 0; t < 400; t++) {
        const x = (sorte() * 2 - 1) * (dentroDoCiclo ? 10 : 20), z = (sorte() * 2 - 1) * (dentroDoCiclo ? 3.6 : 10);
        const fora = (x / (A + 2.6)) ** 2 + (z / (B + 2.4)) ** 2 > 1;
        if ((dentroDoCiclo || fora) && livre(x, z, folga)) return new THREE.Vector2(x, z);
      }
      return null;
    };
    const gramaMat = new THREE.MeshStandardMaterial({ color: tema.grama, roughness: 1, transparent: true, opacity: isDark ? 0.32 : 0.5, depthWrite: false });
    const tufos: THREE.Vector3[] = [];
    for (let k = 0; k < 16; k++) {
      const l = sortearLugar(0, k % 4 === 0); if (!l) continue;
      const r = 1 + sorte() * 1.6;
      const mancha = new THREE.Mesh(new THREE.CircleGeometry(r, 9), gramaMat);
      mancha.rotation.x = -Math.PI / 2; mancha.rotation.z = sorte() * Math.PI; mancha.scale.set(1, 0.55 + sorte() * 0.5, 1);
      mancha.position.set(l.x, 0.006 + k * 0.0004, l.y); mancha.receiveShadow = true; scene.add(mancha);
      for (let j = 0; j < 14; j++) {
        const a = sorte() * Math.PI * 2, d = Math.sqrt(sorte()) * r * 0.75;
        tufos.push(new THREE.Vector3(l.x + Math.cos(a) * d, 0, l.y + Math.sin(a) * d * 0.7));
      }
    }
    const tufoMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.035, 0.2, 4), new THREE.MeshStandardMaterial({ color: tema.folha, roughness: 0.9, flatShading: true }), Math.max(1, tufos.length));
    tufos.forEach((q, k) => {
      dummy.position.set(q.x, 0.1, q.z); dummy.rotation.set((sorte() - 0.5) * 0.4, 0, (sorte() - 0.5) * 0.4); dummy.scale.setScalar(0.7 + sorte() * 0.8); dummy.updateMatrix();
      tufoMesh.setMatrixAt(k, dummy.matrix);
    });
    tufoMesh.count = tufos.length;
    dummy.scale.setScalar(1);
    scene.add(tufoMesh);

    const folhaMat = new THREE.MeshStandardMaterial({ color: tema.folha, roughness: 0.85, flatShading: true });
    const troncoMat = new THREE.MeshStandardMaterial({ color: tema.tronco, roughness: 0.9, flatShading: true });
    const arvore = (x: number, z: number, escala: number, redonda: boolean) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(escala); g.rotation.y = sorte() * Math.PI;
      const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.55, 6), troncoMat); tronco.position.y = 0.27; tronco.castShadow = true; g.add(tronco);
      if (redonda) {
        const copa = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 0), folhaMat); copa.position.y = 0.88; copa.castShadow = true; g.add(copa);
      } else {
        [[0.55, 0.85, 0.75], [0.42, 0.7, 1.18]].forEach(([r, h, y]) => {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), folhaMat); cone.position.y = y; cone.castShadow = true; g.add(cone);
        });
      }
      scene.add(g);
    };
    for (let k = 0; k < 18; k++) {
      const l = sortearLugar(0.4, k < 3); if (!l) continue;
      arvore(l.x, l.y, 0.75 + sorte() * 0.55, k % 3 === 0);
    }
    const rochaMat = new THREE.MeshStandardMaterial({ color: tema.rocha, roughness: 0.95, flatShading: true });
    for (let k = 0; k < 12; k++) {
      const l = sortearLugar(0.2, k < 2); if (!l) continue;
      const r = 0.22 + sorte() * 0.38;
      const rocha = new THREE.Mesh(k % 2 ? new THREE.DodecahedronGeometry(r, 0) : new THREE.IcosahedronGeometry(r, 0), rochaMat);
      rocha.position.set(l.x, r * 0.35, l.y); rocha.scale.set(1, 0.6 + sorte() * 0.3, 0.85); rocha.rotation.set(sorte(), sorte() * 3, sorte());
      rocha.castShadow = true; rocha.receiveShadow = true; scene.add(rocha);
    }

    // ── Pessoas ─────────────────────────────────────────────────────────────
    const PELE = [0xf1c9a5, 0xc68a5e, 0x8d5a3b];
    const ROUPA = [new THREE.Color(accent).getHex(), 0x22b566, 0xf4f7fa, 0xffab00, 0x2684ff, 0xe5493a, 0xa78bfa];
    type Pessoa = { g: THREE.Group; pernas: THREE.Group[]; bracos: THREE.Group[]; cabeca: THREE.Mesh; fase: number; modo: 'fica' | 'anda'; u?: number; vel?: number };
    const pessoas: Pessoa[] = [];
    const pessoa = (k: number, pai: THREE.Object3D = scene): Omit<Pessoa, 'modo'> => {
      const g = new THREE.Group();
      const roupa = new THREE.MeshStandardMaterial({ color: ROUPA[k % ROUPA.length], roughness: 0.6 });
      const calca = new THREE.MeshStandardMaterial({ color: 0x1a2f45, roughness: 0.8 });
      const pele = new THREE.MeshStandardMaterial({ color: PELE[k % 3], roughness: 0.7 });
      const pernas = [-0.055, 0.055].map((x) => { const pv = new THREE.Group(); pv.position.set(x, 0.22, 0); const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.08), calca); m.position.y = -0.11; m.castShadow = true; pv.add(m); g.add(pv); return pv; });
      const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.26, 12), roupa); corpo.position.y = 0.35; corpo.castShadow = true; g.add(corpo);
      const bracos = [-0.14, 0.14].map((x) => { const pv = new THREE.Group(); pv.position.set(x, 0.46, 0); const m = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.2, 0.06), roupa); m.position.y = -0.1; m.castShadow = true; pv.add(m); g.add(pv); return pv; });
      const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), pele); cabeca.position.y = 0.58; cabeca.castShadow = true; g.add(cabeca);
      g.scale.setScalar(1.15); pai.add(g);
      return { g, pernas, bracos, cabeca, fase: Math.random() * 6 };
    };
    let pk = 0;
    estacoes.forEach((st, i) => {
      const n = i % 3 === 0 ? 2 : 1;
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + i * 0.9 + 0.6, P = pessoa(pk++);
        P.g.position.set(st.g.position.x + Math.cos(a) * 0.72, 0.22, st.g.position.z + Math.sin(a) * 0.72);
        P.g.lookAt(st.g.position.x, 0.22, st.g.position.z);
        pessoas.push({ ...P, modo: 'fica' });
      }
    });
    // Gente chegando: em volta da pilha de demandas.
    for (let j = 0; j < 3; j++) {
      const P = pessoa(pk++), a = j * 2.1;
      P.g.position.set(demandasPos.x + Math.cos(a) * 1.3, 0, demandasPos.z + Math.sin(a) * 1.0);
      P.g.lookAt(demandasPos.x, 0, demandasPos.z);
      pessoas.push({ ...P, modo: 'fica' });
    }
    // Gente em volta do Ensino da Palavra.
    for (let j = 0; j < 5; j++) {
      const P = pessoa(pk++), a = (j / 5) * Math.PI * 2 + 0.4;
      P.g.position.set(centroPos.x + Math.cos(a) * 1.85, 0, centroPos.z + Math.sin(a) * 1.85);
      P.g.lookAt(centroPos.x, 0, centroPos.z);
      pessoas.push({ ...P, modo: 'fica' });
    }
    for (let j = 0; j < 4; j++) {
      const P = pessoa(pk++);
      pessoas.push({ ...P, modo: 'anda', u: j / 4, vel: 0.00003 + j * 0.000006 });
    }
    const andarP = new THREE.Vector3();

    // ── Carrinho levando uma pessoa ─────────────────────────────────────────
    // Quem percorre o caminho: uma pessoa caminhando, com um halo aos pés.
    const carro = new THREE.Group(); scene.add(carro);
    const passageiro = pessoa(99, carro);
    passageiro.g.position.set(0, 0, 0);
    passageiro.g.scale.setScalar(1.9);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: cor }));
    halo.rotation.x = Math.PI / 2; halo.position.y = 0.05; carro.add(halo);
    const brilho = new THREE.PointLight(cor, 3, 6, 1); brilho.position.y = 1.2; carro.add(brilho);

    // ── Interação ───────────────────────────────────────────────────────────
    const S = { t: stT[0], anim: null as null | { de: number; ate: number; ini: number; dur: number } };
    irParaRef.current = (i: number) => {
      const atual = envolve(S.t), alvo = stT[i];
      if (!S.anim && Math.abs(alvo - atual) < 1e-4) return false;
      const d = (((alvo - atual) % 1) + 1) % 1; // sempre para frente: é um ciclo
      S.t = atual;
      S.anim = { de: atual, ate: atual + d, ini: performance.now(), dur: 900 + d * 9000 };
      return true;
    };
    const ray = new THREE.Raycaster(), mv = new THREE.Vector2(), mouse = { x: 0, y: 0 }, foco = new THREE.Vector3();
    const escolher = (e: PointerEvent) => {
      const b = renderer.domElement.getBoundingClientRect();
      mv.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      ray.setFromCamera(mv, cam);
      const h = ray.intersectObjects(clicaveis)[0];
      return h ? (h.object.userData.idx as number) : -1;
    };
    const aoMover = (e: PointerEvent) => {
      const b = renderer.domElement.getBoundingClientRect();
      mouse.x = (e.clientX - b.left) / b.width - 0.5; mouse.y = (e.clientY - b.top) / b.height - 0.5;
      renderer.domElement.style.cursor = escolher(e) >= 0 ? 'pointer' : 'default';
    };
    const aoClicar = (e: PointerEvent) => { const i = escolher(e); if (i >= 0) irPara(i, true, true); };
    renderer.domElement.addEventListener('pointermove', aoMover);
    renderer.domElement.addEventListener('pointerdown', aoClicar);
    // Zoom: Ctrl/⌘ + roda (a pinça do touchpad chega assim). A roda sozinha
    // continua rolando a página.
    const aoRodar = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      mudarZoom(zoomRef.current * Math.exp(-e.deltaY * 0.0025));
    };
    // Pinça com dois dedos (celular/tablet). Um dedo continua rolando a página.
    let pinca: { d: number; z: number } | null = null;
    const distancia = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const aoTocar = (e: TouchEvent) => { if (e.touches.length === 2) pinca = { d: distancia(e.touches), z: zoomRef.current }; };
    const aoMoverToque = (e: TouchEvent) => {
      if (!pinca || e.touches.length !== 2) return;
      e.preventDefault();
      mudarZoom(pinca.z * (distancia(e.touches) / pinca.d));
    };
    const aoSoltar = (e: TouchEvent) => { if (e.touches.length < 2) pinca = null; };
    renderer.domElement.style.touchAction = 'pan-y';
    renderer.domElement.addEventListener('wheel', aoRodar, { passive: false });
    renderer.domElement.addEventListener('touchstart', aoTocar, { passive: true });
    renderer.domElement.addEventListener('touchmove', aoMoverToque, { passive: false });
    renderer.domElement.addEventListener('touchend', aoSoltar);
    const ro = new ResizeObserver(() => {
      W = host.clientWidth; H = host.clientHeight;
      renderer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix();
    });
    ro.observe(host);

    const suave = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
    const v = new THREE.Vector3();
    let rotEtapas: HTMLElement[] = [], rotCena: HTMLElement[] = [];
    let raf = 0;
    const quadro = () => {
      raf = requestAnimationFrame(quadro);
      const agora = performance.now();
      let movendo = false;
      if (S.anim) {
        const k = Math.min(1, (agora - S.anim.ini) / S.anim.dur);
        S.t = S.anim.de + (S.anim.ate - S.anim.de) * suave(k); movendo = true;
        if (k >= 1) { S.anim = null; S.t = envolve(S.t); setAndando(false); agendarAuto(); }
      }
      const ct = envolve(S.t), p = curva.getPointAt(ct), tg = curva.getTangentAt(ct);
      const pulo = movendo ? Math.abs(Math.sin(agora * 0.014)) * 0.04 : 0;
      carro.position.set(p.x, pulo, p.z);
      carro.lookAt(p.x + tg.x, pulo, p.z + tg.z);
      // Passos: pernas e braços balançam enquanto anda; parado, respira.
      const passo = movendo ? Math.sin(agora * 0.014) * 0.7 : 0;
      passageiro.pernas[0].rotation.x = passo; passageiro.pernas[1].rotation.x = -passo;
      passageiro.bracos[0].rotation.x = -passo * 0.8; passageiro.bracos[1].rotation.x = passo * 0.8;
      halo.scale.setScalar(1 + Math.sin(agora * 0.004) * 0.08);

      // Câmera: enquadra o ciclo inteiro no espaço livre entre o texto e o rodapé.
      const sr = spacerRef.current, estreito = W < 760;
      let frac = 0.55, refH = H;
      let faixa = H * 0.45;
      // Centro um pouco acima do meio da faixa: a cena pode passar por trás do
      // texto (o degradê do topo cobre), mas não da barra de etapas.
      if (sr && H) { frac = (sr.offsetTop + sr.offsetHeight * 0.45) / H; faixa = sr.offsetHeight; if (estreito) refH = Math.min(H, Math.max(420, sr.offsetHeight)); }
      cam.fov = 2 * Math.atan(Math.tan(16 * Math.PI / 180) * (H / refH)) * 180 / Math.PI;
      cam.aspect = W / H; cam.setViewOffset(W, H, 0, (0.5 - frac) * H, W, H);
      // Afastamento da câmera: o que a largura pede (como no site de
      // referência) ou o que a faixa livre pede — o ciclo é mais fundo que um
      // trilho reto e precisa caber entre os cards e o rodapé.
      const asp = W / refH, ajuste = 3.1 / asp;
      const pelaFaixa = estreito ? 0 : (1.74 * 340) / Math.max(200, faixa);
      // Celular: aproxima e acompanha a pessoa (o ciclo inteiro ficaria
      // minúsculo). Tela larga: o ciclo inteiro, centralizado.
      // Teto alto o bastante para tablet em pé (tela alta e estreita) caber inteiro.
      const f = estreito ? 1.55 : Math.min(5.2, Math.max(1.85, ajuste * 1.12, pelaFaixa));
      const zm = zoomRef.current;
      const segue = estreito || zm > 1.15;
      foco.x += (p.x * (segue ? 0.85 : 0.04) - foco.x) * 0.04; foco.z += (p.z * (segue ? 0.5 : 0.06) - foco.z) * 0.04;
      const fz = f / zm;
      cam.position.set(foco.x + mouse.x * 2, 15 * fz - mouse.y * 1.2, foco.z + 15 * fz);
      cam.lookAt(foco.x, 0.4, foco.z - 0.4);
      (scene.fog as THREE.Fog).near = 21 * fz * 1.05; (scene.fog as THREE.Fog).far = 21 * fz * 2.4;
      cam.updateMatrixWorld();

      // O rastro aceso acompanha a pessoa ao redor do ciclo.
      for (let k = 0; k < ND; k++) pontos.setColorAt(k, ((ct - k / ND + 1) % 1) < 0.28 ? cor : apagado);
      if (pontos.instanceColor) pontos.instanceColor.needsUpdate = true;

      if (!rotEtapas.length && labelsRef.current) {
        rotEtapas = [...labelsRef.current.querySelectorAll<HTMLElement>('[data-st]')];
        rotCena = [...labelsRef.current.querySelectorAll<HTMLElement>('[data-ov]')];
      }
      const atv = ativoRef.current;
      estacoes.forEach((st, i) => {
        st.a += ((i === atv ? 1 : 0) - st.a) * 0.08;
        st.iconeMat.color.copy(papel).lerp(cor, st.a); st.iconeMat.emissiveIntensity = st.a * 0.45;
        st.anelMat.color.copy(apagado).lerp(cor, st.a); st.portalMat.emissiveIntensity = st.a * 0.9;
        st.icone.rotation.y += 0.008 + st.a * 0.02;
        st.icone.position.y = 1.25 + st.a * 0.35 + Math.sin(agora * 0.002 + i) * 0.08;
        const el = rotEtapas[i];
        if (el) {
          v.copy(st.g.position); v.y = 2.35 + st.a * 0.35; v.project(cam);
          el.style.transform = `translate(${(v.x + 1) / 2 * W}px,${(-v.y + 1) / 2 * H}px) translate(-50%,-100%)`;
          // Celular: só a etapa atual e as vizinhas, senão os rótulos se amontoam.
          const longe = Math.min(Math.abs(i - atv), N - Math.abs(i - atv)) > 1;
          el.style.opacity = v.z > 1 || (estreito && longe) ? '0' : '1';
          el.style.pointerEvents = estreito && longe ? 'none' : 'auto';
        }
      });
      rotCena.forEach((el, k) => {
        const q = posRotulos[k]; if (!q) return;
        v.copy(q).project(cam);
        el.style.transform = `translate(${(v.x + 1) / 2 * W}px,${(-v.y + 1) / 2 * H}px) translate(-50%,-50%)`;
        // Em tela estreita só ficam a pilha e o retorno; os grupos poluiriam.
        el.style.opacity = v.z > 1 || estreito ? '0' : '1';
      });
      corredores.forEach((c) => c.m.position.copy(c.c.getPoint((agora * 0.00022 + c.o) % 1)));
      hubs.forEach((h) => { h.simbolo.rotation.y += 0.006; h.simbolo.position.y = 1.15 + Math.sin(agora * 0.002) * 0.08; });
      fichas.forEach((m, k) => { m.position.y = 0.18 + k * 0.08 + (k === fichas.length - 1 ? 0.06 + Math.sin(agora * 0.003) * 0.05 : 0); });
      pessoas.forEach((P) => {
        const t = agora * 0.001 + P.fase;
        if (P.modo === 'fica') {
          P.bracos[0].rotation.x = -0.9 + Math.sin(t * 3) * 0.25; P.bracos[1].rotation.x = -0.9 + Math.cos(t * 3) * 0.25;
          P.cabeca.rotation.y = Math.sin(t * 0.8) * 0.4;
        } else {
          P.u = envolve((P.u ?? 0) + (P.vel ?? 0) * 16);
          const q = curva.getPointAt(P.u), tq = curva.getTangentAt(P.u), sd = tq.clone().cross(cima).normalize();
          andarP.copy(q).addScaledVector(sd, -0.85); andarP.y = Math.abs(Math.sin(t * 7)) * 0.03;
          P.g.position.copy(andarP); P.g.lookAt(andarP.x + tq.x, andarP.y, andarP.z + tq.z);
          const bal = Math.sin(t * 7) * 0.6;
          P.pernas[0].rotation.x = bal; P.pernas[1].rotation.x = -bal; P.bracos[0].rotation.x = -bal * 0.8; P.bracos[1].rotation.x = bal * 0.8;
        }
      });
      renderer.render(scene, cam);
    };
    quadro();
    agendarAuto(1800);

    return () => {
      cancelAnimationFrame(raf);
      if (autoRef.current) clearTimeout(autoRef.current);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointermove', aoMover);
      renderer.domElement.removeEventListener('pointerdown', aoClicar);
      renderer.domElement.removeEventListener('wheel', aoRodar);
      renderer.domElement.removeEventListener('touchstart', aoTocar);
      renderer.domElement.removeEventListener('touchmove', aoMoverToque);
      renderer.domElement.removeEventListener('touchend', aoSoltar);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
      irParaRef.current = () => false;
    };
    // A cena é refeita só quando o tema ou a cor da igreja mudam.
  }, [isDark, accent, tema, agendarAuto, irPara, mudarZoom]);

  const atual = ETAPAS_DO_CICLO[ativo];
  const corRotulo = (c: string) => (c === 'texto' ? tema.texto : c === 'sub' ? tema.textoSub : c === 'accent' ? (isDark ? accent : tema.texto) : c);

  return (
    <section
      className="relative flex flex-col overflow-hidden"
      style={{ minHeight: 'max(100vh, 820px)', background: tema.fundo, color: tema.texto }}
    >
      <div ref={hostRef} className="absolute inset-0" />
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{ height: '46%', background: isDark
          ? 'linear-gradient(180deg,rgba(7,28,48,0.95) 0%,rgba(7,28,48,0.7) 55%,rgba(7,28,48,0) 100%)'
          : 'linear-gradient(180deg,rgba(244,248,252,0.95) 0%,rgba(244,248,252,0.7) 55%,rgba(244,248,252,0) 100%)' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{ height: '30%', background: isDark
          ? 'linear-gradient(0deg,rgba(7,28,48,0.95) 0%,rgba(7,28,48,0) 100%)'
          : 'linear-gradient(0deg,rgba(220,232,243,0.95) 0%,rgba(220,232,243,0) 100%)' }}
      />

      {/* Rótulos que seguem a cena (posicionados pelo laço de animação). */}
      <div ref={labelsRef} className="absolute inset-0 pointer-events-none overflow-hidden">
        {ETAPAS_DO_CICLO.map((e, i) => {
          const on = i === ativo;
          return (
            <button
              key={i}
              data-st={i}
              type="button"
              onClick={() => irPara(i, true, true)}
              className="absolute left-0 top-0 pointer-events-auto cursor-pointer whitespace-nowrap rounded-full font-mono uppercase transition-colors"
              style={{
                fontSize: 11, letterSpacing: '0.06em', padding: '6px 10px', willChange: 'transform',
                border: `1px solid ${on ? accent : tema.rotuloBorda}`,
                background: on ? accent : tema.rotuloBg,
                color: on ? '#071C30' : tema.texto,
              }}
            >
              {pad(i)} {e.nome}
            </button>
          );
        })}
        {ROTULOS_CENA.map((o, k) => (
          <span
            key={k}
            data-ov={k}
            className="absolute left-0 top-0 whitespace-nowrap rounded-md font-mono uppercase"
            style={{
              fontSize: 10, letterSpacing: '0.06em', padding: '4px 8px', willChange: 'transform',
              border: `1px dashed ${corRotulo(o.cor)}`, background: tema.rotuloBg, color: corRotulo(o.cor),
            }}
          >
            {o.t}
          </span>
        ))}
      </div>

      {/* Cultos e endereço: no topo, ao centro (só onde há espaço livre). */}
        {infoCentro && (infoCentro.endereco || infoCentro.horarios.length > 0) && (
          <div
            className="hidden xl:block absolute left-1/2 -translate-x-1/2 z-[31] rounded-xl"
            style={{
              top: 22, width: 300, padding: '10px 14px',
              background: tema.painelBg, border: `1px solid ${tema.painelBorda}`, backdropFilter: 'blur(10px)',
              color: tema.texto, fontSize: 11, lineHeight: 1.45,
            }}
          >
            {infoCentro.horarios.length > 0 && (
              <>
                <div className="font-mono uppercase mb-1" style={{ fontSize: 9, letterSpacing: '0.1em', color: isDark ? accent : tema.textoSub }}>Cultos</div>
                {infoCentro.horarios.map(({ dia, itens }) => (
                  <div key={dia}><strong>{dia}:</strong> <span style={{ color: tema.textoSub }}>{itens.join(' · ')}</span></div>
                ))}
              </>
            )}
            {infoCentro.endereco && (
              <div className={infoCentro.horarios.length > 0 ? 'mt-1.5' : ''} style={{ color: tema.textoSub }}>
                <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: '0.1em', color: isDark ? accent : tema.textoSub }}>Endereço </span>
                {infoCentro.endereco}
              </div>
            )}
          </div>
        )}

      {/* Topo: textos da igreja à esquerda, cards principais à direita. */}
      <div
        className="relative z-[8] flex items-start justify-between gap-4 sm:gap-7 pointer-events-none"
        style={{ padding: 'clamp(84px,11vh,108px) clamp(16px,4vw,56px) 0' }}
      >
        <div className="pointer-events-auto min-w-0" style={{ flex: '1 1 0', maxWidth: 600 }}>{topo}</div>
        {/* Ícone de opções: na mesma linha do título em qualquer largura. */}
        <div className="pointer-events-auto flex flex-col shrink-0">{cards}</div>
      </div>

      <div ref={spacerRef} className="pointer-events-none" style={{ flex: '1 1 auto', minHeight: 'clamp(260px,32vh,460px)' }} />

      {/* Rodapé do hero: as etapas e a etapa atual. */}
      <div
        className="relative z-[6] flex flex-wrap items-end justify-between gap-3.5 pb-24 sm:pb-6 pr-4 sm:pr-24"
        style={{ paddingLeft: 'clamp(16px,4vw,56px)' }}
      >
        <div className="min-w-0" style={{ flex: '1 1 520px' }}>
          <div className="flex items-center gap-3 mb-2.5">
            <button
              type="button"
              onClick={alternarPlay}
              aria-label={pausado ? 'Retomar o ciclo automático' : 'Pausar o ciclo automático'}
              title={pausado ? 'Retomar' : 'Pausar'}
              className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center cursor-pointer transition-colors"
              style={{ background: pausado ? accent : tema.rotuloBg, border: `1px solid ${pausado ? accent : tema.rotuloBorda}`, color: pausado ? '#071C30' : tema.texto }}
            >
              {pausado ? <Play className="w-4 h-4 ml-0.5" /> : <Pause className="w-4 h-4" />}
            </button>
            <div className="flex items-center shrink-0 rounded-full overflow-hidden" style={{ border: `1px solid ${tema.rotuloBorda}`, background: tema.rotuloBg }}>
              <button
                type="button"
                onClick={() => mudarZoom(zoom / 1.2)}
                disabled={zoom <= ZOOM_MIN + 0.001}
                aria-label="Afastar"
                title="Afastar (Ctrl + roda)"
                className="w-9 h-9 flex items-center justify-center cursor-pointer disabled:opacity-35 disabled:cursor-default"
                style={{ color: tema.texto }}
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => mudarZoom(1)}
                aria-label="Zoom padrão"
                title="Voltar ao zoom padrão"
                className="h-9 px-1 font-mono cursor-pointer"
                style={{ fontSize: 10, color: tema.textoSub, minWidth: 38 }}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => mudarZoom(zoom * 1.2)}
                disabled={zoom >= ZOOM_MAX - 0.001}
                aria-label="Aproximar"
                title="Aproximar (Ctrl + roda)"
                className="w-9 h-9 flex items-center justify-center cursor-pointer disabled:opacity-35 disabled:cursor-default"
                style={{ color: tema.texto }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.1em', color: tema.textoSub }}>
              {pausado ? 'Pausado — aperte o play para seguir' : 'Clique numa etapa — a pessoa caminha até lá'}
            </div>
          </div>
          <div className="relative mb-2.5" style={{ height: 2, background: isDark ? 'rgba(244,247,250,0.14)' : 'rgba(11,34,57,0.14)' }}>
            <div
              className="absolute left-0 top-0 bottom-0"
              style={{ width: `${(ativo / (N - 1)) * 100}%`, background: accent, transition: 'width .9s cubic-bezier(.6,0,.2,1)' }}
            />
          </div>
          <div className="flex items-stretch gap-1.5">
            <button
              type="button"
              aria-label="Etapa anterior"
              onClick={() => irPara((ativo + N - 1) % N, true)}
              className="hidden sm:flex w-9 shrink-0 items-center justify-center rounded-[10px] cursor-pointer"
              style={{ background: tema.rotuloBg, border: `1px solid ${tema.rotuloBorda}`, color: tema.texto }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {/* Celular: grade com todas as etapas, sem rolagem lateral. */}
            <div className="grid grid-cols-3 gap-1.5 flex-1 min-w-0 sm:flex sm:gap-1.5">
              {ETAPAS_DO_CICLO.map((e, i) => {
                const on = i === ativo, feito = i < ativo;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => irPara(i, true)}
                    className="text-left cursor-pointer rounded-[10px] transition-colors min-w-0 sm:flex-1"
                    style={{
                      minHeight: 44, padding: '8px 9px 9px',
                      background: on ? `${accent}29` : tema.rotuloBg,
                      border: `1px solid ${on ? accent : tema.rotuloBorda}`,
                      color: tema.texto,
                    }}
                  >
                    <div className="font-mono" style={{ fontSize: 10, color: on || feito ? accent : tema.textoSub }}>{pad(i)}</div>
                    <div className="font-semibold mt-0.5 leading-tight" style={{ fontSize: 12.5 }}>{e.nome}</div>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Próxima etapa"
              onClick={() => irPara((ativo + 1) % N, true)}
              className="hidden sm:flex w-9 shrink-0 items-center justify-center rounded-[10px] cursor-pointer"
              style={{ background: tema.rotuloBg, border: `1px solid ${tema.rotuloBorda}`, color: tema.texto }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Card central com a explicação: só no clique (etapa de baixo ou nó). */}
      <AnimatePresence>
        {cartao && (
          <motion.div
            key="cartao"
            initial={{ opacity: 0, scale: 0.92, x: '-50%', y: 'calc(-50% + 10px)' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.94, x: '-50%', y: 'calc(-50% + 6px)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="absolute z-[9] left-1/2 top-1/2 rounded-2xl shadow-2xl"
            style={{
              width: 'min(440px, calc(100vw - 32px))', padding: '18px 20px',
              background: tema.painelBg, border: `1px solid ${tema.painelBorda}`, backdropFilter: 'blur(16px)',
            }}
            role="dialog"
            aria-label={atual.titulo}
          >
            <div className="flex items-center justify-between gap-2.5 font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: tema.textoSub }}>
              <span>Etapa {pad(ativo)} / {pad(N - 1)}</span>
              <span className="flex items-center gap-3">
                <span style={{ color: andando ? accent : tema.textoSub }}>{andando ? '● a caminho' : '● nesta etapa'}</span>
                <button type="button" onClick={fecharCartao} aria-label="Fechar" className="cursor-pointer" style={{ color: tema.textoSub }}>
                  <X className="w-4 h-4" />
                </button>
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 mt-2">
              <div className="font-semibold" style={{ fontSize: 21, letterSpacing: '-0.02em' }}>{atual.titulo}</div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  aria-label="Etapa anterior"
                  onClick={() => irPara((ativo + N - 1) % N, true, true)}
                  className="w-10 h-10 rounded-full cursor-pointer"
                  style={{ border: `1px solid ${tema.rotuloBorda}`, background: 'transparent', color: tema.texto }}
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label="Próxima etapa"
                  onClick={() => irPara((ativo + 1) % N, true, true)}
                  className="w-10 h-10 rounded-full cursor-pointer"
                  style={{ border: 'none', background: tema.texto, color: isDark ? '#071C30' : '#F4F7FA' }}
                >
                  →
                </button>
              </div>
            </div>
            <p className="mt-2" style={{ fontSize: 14, lineHeight: 1.55, color: tema.textoSub }}>
              {atual.desc} <span className="font-mono" style={{ color: accent }}>{atual.ref}</span>
            </p>
            {/* Contagem para o automático voltar (some se estiver pausado). */}
            {!pausado && (
              <div className="mt-3 h-[2px] rounded-full overflow-hidden" style={{ background: tema.rotuloBorda }}>
                <motion.div
                  key={`conta-${ativo}`}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: RETOMA_EM / 1000, ease: 'linear' }}
                  style={{ height: '100%', background: accent }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/**
 * Card no estilo da home nova: número, título, descrição e seta. O primeiro
 * fica em destaque (verde), como "Iniciar um projeto" no site de referência.
 */
export function CardDoCiclo({
  numero,
  titulo,
  descricao,
  destaque,
  isDark,
  accent,
  extra,
}: {
  numero: string;
  titulo: string;
  descricao?: ReactNode;
  destaque?: boolean;
  isDark: boolean;
  accent: string;
  extra?: ReactNode;
}) {
  const fundo = destaque ? 'rgba(34,181,102,0.16)' : isDark ? 'rgba(13,39,64,0.78)' : 'rgba(255,255,255,0.82)';
  const borda = destaque ? 'rgba(34,181,102,0.55)' : isDark ? 'rgba(244,247,250,0.14)' : 'rgba(11,34,57,0.12)';
  return (
    <span
      className="grid h-full items-center text-left rounded-2xl transition-transform group-hover:-translate-x-1"
      style={{
        gridTemplateColumns: '40px minmax(0,1fr) 20px', gap: 14, padding: '14px 16px',
        background: fundo, border: `1px solid ${borda}`, backdropFilter: 'blur(12px)',
        color: isDark ? '#F4F7FA' : '#0B2239',
      }}
    >
      <span
        className="w-10 h-10 rounded-[10px] flex items-center justify-center font-mono"
        style={{
          fontSize: 12, fontWeight: 500,
          background: destaque ? '#22B566' : `${accent}2e`,
          color: destaque ? '#FFFFFF' : accent,
        }}
      >
        {numero}
      </span>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="font-semibold flex items-center gap-2" style={{ fontSize: 15 }}>{titulo}{extra}</span>
        {descricao && (
          <span style={{ fontSize: 13, lineHeight: 1.4, color: isDark ? '#B7C7D6' : '#43607A' }}>{descricao}</span>
        )}
      </span>
      <span style={{ color: accent, fontSize: 16 }}>→</span>
    </span>
  );
}

/**
 * Todas as opções da igreja num ícone só, no canto direito do hero. O clique
 * abre um painel que cresce a partir do ícone, no lugar onde ficavam os cards.
 * Escolher uma opção fecha o painel (menos "Instalar o app", que pode abrir os
 * passos do iPhone por cima e precisa continuar montado).
 */
export function MenuDeOpcoes({
  isDark,
  accent,
  total,
  children,
}: {
  isDark: boolean;
  accent: string;
  total: number;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    const aoClicarFora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (caixaRef.current && !caixaRef.current.contains(alvo)) setAberto(false);
    };
    window.addEventListener('keydown', aoTeclar);
    document.addEventListener('mousedown', aoClicarFora);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('mousedown', aoClicarFora);
    };
  }, [aberto]);

  const corTexto = isDark ? '#F4F7FA' : '#0B2239';

  return (
    <div ref={caixaRef} className="relative self-end">
      <motion.button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-label={aberto ? 'Fechar opções' : 'Abrir opções da igreja'}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="relative w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer"
        style={{
          background: aberto ? accent : isDark ? 'rgba(13,39,64,0.85)' : 'rgba(255,255,255,0.9)',
          border: `1px solid ${aberto ? accent : isDark ? 'rgba(244,247,250,0.18)' : 'rgba(11,34,57,0.14)'}`,
          color: aberto ? '#071C30' : corTexto,
          backdropFilter: 'blur(12px)',
          boxShadow: aberto ? `0 0 28px ${accent}66` : '0 8px 24px rgba(0,0,0,0.25)',
        }}
      >
        <motion.span animate={{ rotate: aberto ? 90 : 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
          {aberto ? <X className="w-6 h-6" /> : <LayoutGrid className="w-6 h-6" />}
        </motion.span>
        {!aberto && total > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-mono"
            style={{ fontSize: 10, background: '#22B566', color: '#FFFFFF' }}
          >
            {total}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            key="painel"
            initial={{ opacity: 0, scale: 0.4, x: 12, y: -8 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.4, x: 12, y: -8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            style={{
              transformOrigin: 'top right',
              // Duas colunas em tela larga: as opções cabem sem rolar.
              width: 'min(760px, calc(100vw - 32px))',
              maxHeight: 'min(82vh, 720px)',
              background: isDark ? 'rgba(7,28,48,0.92)' : 'rgba(244,248,252,0.95)',
              border: `1px solid ${isDark ? 'rgba(244,247,250,0.14)' : 'rgba(11,34,57,0.12)'}`,
              backdropFilter: 'blur(16px)',
            }}
            className="absolute right-0 top-16 sm:right-16 sm:top-0 z-40 rounded-2xl p-2.5 overflow-y-auto shadow-2xl"
            onClickCapture={(e) => {
              const alvo = e.target as HTMLElement;
              if (alvo.closest('[data-card-acao]') && !alvo.closest('[data-card-pwa]')) setTimeout(() => setAberto(false), 0);
            }}
          >
            <div className="font-mono uppercase px-1.5 pt-1 pb-2" style={{ fontSize: 10, letterSpacing: '0.12em', color: isDark ? '#8FA6BA' : '#43607A' }}>
              Acesse
            </div>
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
              initial="fechado"
              animate="aberto"
              variants={{ aberto: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }}
            >
              {Array.isArray(children)
                ? children.filter(Boolean).map((c, i) => (
                    <motion.div key={i} variants={{ fechado: { opacity: 0, x: 16 }, aberto: { opacity: 1, x: 0 } }}>
                      {c}
                    </motion.div>
                  ))
                : children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
