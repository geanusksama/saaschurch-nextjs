export type DeptSlug =
  | "cibe"
  | "jovens"
  | "varaos"
  | "adolescentes"
  | "ebd"
  | "infantil"
  | "missoes"
  | "louvor"
  | "familia"
  | "casais";

export interface DeptConfig {
  slug: DeptSlug;
  name: string;
  shortName: string;
  description: string;
  color: string;       // single accent color — no gradients
  iconColor: string;   // icon fill color (usually same or lighter)
  textOnColor: string;
  layout: "grid" | "video-hero" | "minimal" | "academic" | "magazine" | "dark" | "warm" | "elegant";
  tags: string[];
}

export const DEPARTMENTS: DeptConfig[] = [
  {
    slug: "cibe",
    name: "CIBE",
    shortName: "CIBE",
    description: "Convenção das Irmãs Batistas Evangélicas",
    color: "#7C3AED",
    iconColor: "#A78BFA",
    textOnColor: "#FFFFFF",
    layout: "grid",
    tags: ["mulheres", "ensino", "oração"],
  },
  {
    slug: "jovens",
    name: "Frente Jovem",
    shortName: "FJ",
    description: "Movimento de jovens conectados ao propósito",
    color: "#0891B2",
    iconColor: "#22D3EE",
    textOnColor: "#FFFFFF",
    layout: "video-hero",
    tags: ["jovens", "louvor", "missões"],
  },
  {
    slug: "varaos",
    name: "Varões",
    shortName: "Varões",
    description: "Homens edificando o reino com integridade",
    color: "#1D4ED8",
    iconColor: "#93C5FD",
    textOnColor: "#FFFFFF",
    layout: "minimal",
    tags: ["homens", "liderança", "estudos"],
  },
  {
    slug: "adolescentes",
    name: "Adolescentes",
    shortName: "Adol.",
    description: "Uma geração transformada pela Palavra",
    color: "#EA580C",
    iconColor: "#FCA5A5",
    textOnColor: "#FFFFFF",
    layout: "grid",
    tags: ["adolescentes", "eventos", "grupos"],
  },
  {
    slug: "ebd",
    name: "EBD",
    shortName: "EBD",
    description: "Escola Bíblica Dominical",
    color: "#1E40AF",
    iconColor: "#93C5FD",
    textOnColor: "#FFFFFF",
    layout: "academic",
    tags: ["ensino", "revistas", "classes"],
  },
  {
    slug: "infantil",
    name: "Infantil",
    shortName: "Infantil",
    description: "Sementes do reino — crianças na fé",
    color: "#059669",
    iconColor: "#6EE7B7",
    textOnColor: "#FFFFFF",
    layout: "grid",
    tags: ["crianças", "louvor", "histórias"],
  },
  {
    slug: "missoes",
    name: "Missões",
    shortName: "Missões",
    description: "Levando o evangelho às nações",
    color: "#B45309",
    iconColor: "#FCD34D",
    textOnColor: "#FFFFFF",
    layout: "magazine",
    tags: ["missões", "evangelismo", "nações"],
  },
  {
    slug: "louvor",
    name: "Louvor",
    shortName: "Louvor",
    description: "Exaltando a Deus com excelência",
    color: "#D97706",
    iconColor: "#FDE68A",
    textOnColor: "#FFFFFF",
    layout: "dark",
    tags: ["louvor", "música", "adoração"],
  },
  {
    slug: "familia",
    name: "Família",
    shortName: "Família",
    description: "Fortalecendo lares para a glória de Deus",
    color: "#16A34A",
    iconColor: "#86EFAC",
    textOnColor: "#FFFFFF",
    layout: "warm",
    tags: ["família", "aconselhamento", "encontros"],
  },
  {
    slug: "casais",
    name: "Casais",
    shortName: "Casais",
    description: "Casamentos cultivados no amor de Deus",
    color: "#BE185D",
    iconColor: "#F9A8D4",
    textOnColor: "#FFFFFF",
    layout: "elegant",
    tags: ["casais", "retiro", "conselho"],
  },
];

export const DEPT_MAP = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.slug, d])
) as Record<DeptSlug, DeptConfig>;

// ── App modules — exactly as in the novoChurch Flutter app ───────────────────
// Source: image of the app home screen
export interface AppModule {
  key: string;
  label: string;
  sublabel?: string;
  iconKey: AppIconKey;
}

export type AppIconKey =
  | "biblia" | "igreja" | "pregacoes" | "ministerio"
  | "site"   | "radio"  | "agenda"    | "eventos"
  | "compras"| "pao"    | "testemunhos"| "pastoral" | "lideranca";

export const APP_MODULES: AppModule[] = [
  { key: "biblia",      label: "Bíblia",       iconKey: "biblia"      },
  { key: "igreja",      label: "Igreja",        iconKey: "igreja"      },
  { key: "pregacoes",   label: "Pregações",     iconKey: "pregacoes"   },
  { key: "ministerio",  label: "Ministério",    iconKey: "ministerio"  },
  { key: "site",        label: "Site",          iconKey: "site"        },
  { key: "radio",       label: "Rádio",         iconKey: "radio"       },
  { key: "agenda",      label: "Agenda anual",  iconKey: "agenda"      },
  { key: "eventos",     label: "Eventos",       iconKey: "eventos"     },
  { key: "compras",     label: "Compras",       iconKey: "compras"     },
  { key: "pao",         label: "Pão diário",    iconKey: "pao"         },
  { key: "testemunhos", label: "Testemunhos",   iconKey: "testemunhos" },
  { key: "pastoral",    label: "Atend. Past.",  iconKey: "pastoral"    },
  { key: "lideranca",   label: "Liderança",     iconKey: "lideranca"   },
];
