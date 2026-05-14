// Seed for the Secretariat Kanban / Pipeline / Matrix system.
// Source data was provided by the legacy system (matriz / pipelines /
// stages / columns). Run with:  node prisma/seed-kanban.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── PIPELINES (kan_pipelines) ──────────────────────────────────────────────
const pipelines = [
  { id: 1, name: "Secretaria",  type: "Serviços",         hash: "abc123xyz",  campo: "campinas", isActive: true },
  { id: 2, name: "Evento",      type: "Eventos diversos", hash: "abc123xyz2", campo: "campinas", isActive: true },
  { id: 4, name: "Tesouraria",  type: "Tesouraria",       hash: "abc123xyz",  campo: "campinas", isActive: true },
];

// ─── SERVICES (kan_services) ────────────────────────────────────────────────
const services = [
  { id: 1,  sigla: "ADMINM",        description: "Admissao de Membros",                                  servico: null,                            usesMatrix: false },
  { id: 2,  sigla: "ADMINOB",       description: "Admissao de Obreiros",                                 servico: null,                            usesMatrix: false },
  { id: 3,  sigla: "BAT",           description: "Batismo (em outro Ministério)",                        servico: "Batismo (em outro Ministério)", usesMatrix: false },
  { id: 4,  sigla: "CAD",           description: "Cadastro",                                             servico: null,                            usesMatrix: false },
  { id: 5,  sigla: "CDIACNO",       description: "Consagração a Diácono",                                servico: null,                            usesMatrix: false },
  { id: 6,  sigla: "CDIACSA",       description: "Consagração a Diaconisa",                              servico: null,                            usesMatrix: false },
  { id: 7,  sigla: "CDM",           description: "Carta de Mudança",                                     servico: null,                            usesMatrix: false },
  { id: 8,  sigla: "CONEV",         description: "Consagração a Evangelista",                            servico: null,                            usesMatrix: false },
  { id: 9,  sigla: "CONPR",         description: "Consagração a Pastor",                                 servico: null,                            usesMatrix: false },
  { id: 10, sigla: "CONSPRESB",     description: "Consagração a Presbítero",                             servico: null,                            usesMatrix: false },
  { id: 11, sigla: "DESCR",         description: "Descredenciamento de Cargo - Evangelista (Mulher)",    servico: null,                            usesMatrix: false },
  { id: 12, sigla: "DESCRH",        description: "Descredenciamento de Cargo - Evangelista (Homem)",     servico: null,                            usesMatrix: false },
  { id: 13, sigla: "DESCRPH",       description: "Descredenciamento de Cargo - Pastor",                  servico: null,                            usesMatrix: false },
  { id: 14, sigla: "DESLMEM",       description: "Desligamento de Membros",                              servico: null,                            usesMatrix: false },
  { id: 15, sigla: "DESlMIN",       description: "Desligamento de Ministros",                            servico: null,                            usesMatrix: false },
  { id: 16, sigla: "DESLOBRE",      description: "Desligamento de Obreiros",                             servico: null,                            usesMatrix: false },
  { id: 17, sigla: "EXCL",          description: "Exclusão de Membros",                                  servico: null,                            usesMatrix: false },
  { id: 18, sigla: "FALE",          description: "Falecimento",                                          servico: null,                            usesMatrix: false },
  { id: 19, sigla: "READMEM",       description: "Readmissao de Membros",                                servico: null,                            usesMatrix: false },
  { id: 20, sigla: "READOBR",       description: "Readmissão de Obreiros",                               servico: null,                            usesMatrix: false },
  { id: 21, sigla: "READOMN",       description: "Readmissão de Ministros",                              servico: null,                            usesMatrix: false },
  { id: 22, sigla: "RECEV",         description: "Reconhecimento de Cargo - Evangelista",                servico: null,                            usesMatrix: false },
  { id: 23, sigla: "RECPR",         description: "Reconhecimento de Cargo - Pastor",                     servico: null,                            usesMatrix: false },
  { id: 24, sigla: "RECMS",         description: "Reconhecimento de Cargo - Missionaria",                servico: null,                            usesMatrix: false },
  { id: 25, sigla: "RECONPB",       description: "Reconhecimento de Cargo - Presbitero",                 servico: null,                            usesMatrix: false },
  { id: 26, sigla: "SCOOP",         description: "Separação a Cooperador",                               servico: null,                            usesMatrix: false },
  { id: 27, sigla: "SCOOPA",        description: "Separação a Cooperadora",                              servico: null,                            usesMatrix: false },
  { id: 28, sigla: "TRANSFERENCIA", description: "Transferência",                                        servico: "Transferencia",                 usesMatrix: true  },
  { id: 29, sigla: "BATISMO",       description: "Batismo em Águas",                                     servico: "Batismo em águas",              usesMatrix: true  },
  { id: 30, sigla: "CONMISSF",      description: "Consagração a Missionária",                            servico: null,                            usesMatrix: false },
  { id: 31, sigla: "CONMISSM",      description: "Consagração a Missionário",                            servico: null,                            usesMatrix: false },
  { id: 32, sigla: "CONPRF",        description: "Consagração a Pastora",                                servico: null,                            usesMatrix: false },
];

// ─── STAGES (kan_stages) — Secretaria pipeline = id 1 ───────────────────────
// Maps the legacy "kanartefato" → kan_stages. serviceId points to KanService.
// idservico in legacy was sometimes 0; we attach Batismo→3, Transferência→28,
// Cadastro→4, Requerimento→null (umbrella), Consagração→null (umbrella).
const stages = [
  { id: 1, pipelineId: 1, serviceId: 3,    name: "Batismo",       description: "Pipeline de Batismo",       author: "Francisco", campo: "campinas", hash: "abc123xyz" },
  { id: 2, pipelineId: 1, serviceId: 28,   name: "Transferência", description: "Pipeline de Transferência", author: "Eu",        campo: "campinas", hash: "abc123xyz" },
  { id: 3, pipelineId: 1, serviceId: 4,    name: "Cadastro",      description: "Pipeline de Cadastro",      author: "eu",        campo: "campinas", hash: "abc123xyz" },
  { id: 4, pipelineId: 1, serviceId: null, name: "Requerimento",  description: "Pipeline de Requerimentos", author: "Francisco", campo: "campinas", hash: "abc123xyz" },
  { id: 5, pipelineId: 1, serviceId: null, name: "Consagração",   description: "Pipeline de Consagração",   author: "Francisco", campo: "campinas", hash: "abc123xyz" },
];

// ─── COLUMNS (kan_columns) ──────────────────────────────────────────────────
// stageId references kan_stages; columnIndex is the legacy "colunaiss".
const columns = [
  // Batismo (stage 1)
  { id: 1,  stageId: 1, name: "Pendente",              columnIndex: 1, color: "purple" },
  { id: 2,  stageId: 1, name: "Aprovado",              columnIndex: 2, color: "blue"   },
  { id: 15, stageId: 1, name: "Cancelado",             columnIndex: 3, color: "blue"   },
  // Transferência (stage 2)
  { id: 3,  stageId: 2, name: "Pendente",              columnIndex: 1, color: "blue"   },
  { id: 8,  stageId: 2, name: "Aprovada",              columnIndex: 2, color: "blue"   },
  { id: 9,  stageId: 2, name: "Cancelada",             columnIndex: 3, color: "blue"   },
  // Cadastro (stage 3)
  { id: 4,  stageId: 3, name: "Pendente",              columnIndex: 1, color: "blue"   },
  { id: 5,  stageId: 3, name: "Aprovado",              columnIndex: 2, color: "blue"   },
  { id: 7,  stageId: 3, name: "Reprovado",             columnIndex: 3, color: "blue"   },
  // Requerimento (stage 4)
  { id: 10, stageId: 4, name: "Pendente",              columnIndex: 1, color: "blue"   },
  { id: 11, stageId: 4, name: "Finalizado",            columnIndex: 2, color: "blue"   },
  { id: 12, stageId: 4, name: "Cancelado",             columnIndex: 3, color: "blue"   },
  // Consagração (stage 5)
  { id: 6,  stageId: 5, name: "Pendente",              columnIndex: 1, color: "orange" },
  { id: 13, stageId: 5, name: "Aprovado",              columnIndex: 2, color: "green"  },
  { id: 14, stageId: 5, name: "Documentos Aprovados",  columnIndex: 3, color: "blue"   },
  { id: 18, stageId: 5, name: "Consagrado",            columnIndex: 4, color: "green"  },
  { id: 21, stageId: 5, name: "Consagração Cancelada", columnIndex: 5, color: "yellow" },
];

// Stage IDs: 1=Batismo, 2=Transferência, 3=Cadastro, 4=Requerimento, 5=Consagração
const STAGE = { BAT: 1, TRANSF: 2, CAD: 3, REQ: 4, CON: 5 };

// ─── MATRIX RULES (kan_matrix_rules) — full legacy matriz dump ──────────────
const rules = [
  { stageId: STAGE.REQ,   serviceId: 1, columnIndex: 1, changeStatus: false, newStatus: null,                changeTitle: true,  newTitle: "CONGREGADO", insertOccurrence: true, occurrenceName: "Cadastros",         message: "Admissão em andamento", description: "Admissao de Membros" },
  { stageId: STAGE.REQ,   serviceId: 1, columnIndex: 2, changeStatus: true,  newStatus: "Ativo",             changeTitle: true,  newTitle: "MEMBRO",     insertOccurrence: true, occurrenceName: "Membro ativado",    message: "Admissão concluída",    description: "Admissao de Membros" },
  { stageId: STAGE.REQ,   serviceId: 1, columnIndex: 3, changeStatus: true,  newStatus: "Aguadando Ativação", changeTitle: true, newTitle: "CONGREGADO", insertOccurrence: true, occurrenceName: "Cadastro cancelado", message: "Admissão cancelada",   description: "Admissao de Membros" },

  { stageId: STAGE.REQ,   serviceId: 2, columnIndex: 1, changeStatus: true,  newStatus: "Aguadando Ativação", changeTitle: false, newTitle: "CONGREGADO", insertOccurrence: true, occurrenceName: "Admissão iniciada",  message: "Admissão iniciada",   description: "Admissao de Obreiros" },
  { stageId: STAGE.REQ,   serviceId: 2, columnIndex: 2, changeStatus: true,  newStatus: "Ativo",             changeTitle: true,  newTitle: "MEMBRO",     insertOccurrence: true, occurrenceName: "Admissão concluída", message: "Admissão concluída",  description: "Admissao de Obreiros" },
  { stageId: STAGE.REQ,   serviceId: 2, columnIndex: 3, changeStatus: true,  newStatus: "Aguadando Ativação", changeTitle: false, newTitle: "CONGREGADO", insertOccurrence: true, occurrenceName: "Admissão cancelada", message: "Admissão cancelada",  description: "Admissao de Obreiros" },

  { stageId: STAGE.BAT,   serviceId: 3, columnIndex: 1, insertOccurrence: true, occurrenceName: "Incluído no batismo", message: "Batismo (em outro Ministério)", description: "Batismo (em outro Ministério)" },
  { stageId: STAGE.BAT,   serviceId: 3, columnIndex: 2, changeStatus: true, newStatus: "Ativo", changeTitle: true, newTitle: "MEMBRO", insertOccurrence: true, occurrenceName: "Batizado",         message: "Batismo (em outro Ministério)", description: "Batismo (em outro Ministério)" },
  { stageId: STAGE.BAT,   serviceId: 3, columnIndex: 3, insertOccurrence: true, occurrenceName: "Batismo Cancelado",    message: "Batismo (em outro Ministério)", description: "Batismo (em outro Ministério)" },

  { stageId: STAGE.CAD,   serviceId: 4, columnIndex: 1, changeStatus: true, newStatus: "Aguardando Ativação", changeTitle: true, newTitle: "CONGREGADO", insertOccurrence: true, occurrenceName: "Cadastro",            description: "Cadastro" },
  { stageId: STAGE.CAD,   serviceId: 4, columnIndex: 2, changeStatus: true, newStatus: "Ativo",               changeTitle: true, newTitle: "MEMBRO",     insertOccurrence: true, occurrenceName: "Admissão concluida",  description: "Cadastrado" },
  { stageId: STAGE.CAD,   serviceId: 4, columnIndex: 3, changeStatus: true, newStatus: "Aguardando Ativação", changeTitle: true, newTitle: "CONGREGADO", insertOccurrence: true, occurrenceName: "Admissão Cancelada",  description: "Cadastro Cancelado" },

  { stageId: STAGE.CON,   serviceId: 5, columnIndex: 1, insertOccurrence: true, occurrenceName: "Consagração a diácono", description: "Consagração Diácono" },
  { stageId: STAGE.CON,   serviceId: 5, columnIndex: 2, insertOccurrence: true, occurrenceName: "Aprovado",              description: "Consagração Diácono" },
  { stageId: STAGE.CON,   serviceId: 5, columnIndex: 3, insertOccurrence: true, occurrenceName: "Documentos Aprovados", description: "Consagração Diácono" },
  { stageId: STAGE.CON,   serviceId: 5, columnIndex: 4, changeStatus: true, newStatus: "Ativo", changeTitle: true, newTitle: "DIACONO", insertOccurrence: true, occurrenceName: "Consagrado a Diácono", description: "Consagração Diácono" },
  { stageId: STAGE.CON,   serviceId: 5, columnIndex: 5, changeTitle: true, newTitle: "MEMBRO", insertOccurrence: true, occurrenceName: "Consagração cancelada", description: "Consagração Diácono" },

  { stageId: STAGE.CON,   serviceId: 6, columnIndex: 1, insertOccurrence: true, occurrenceName: "Consagração Diaconisa", description: "Consagração Diaconisa" },
  { stageId: STAGE.CON,   serviceId: 6, columnIndex: 2, insertOccurrence: true, occurrenceName: "Aprovada",             description: "Consagração Diaconisa" },
  { stageId: STAGE.CON,   serviceId: 6, columnIndex: 3, insertOccurrence: true, occurrenceName: "Documentos Aprovados", description: "Consagração Diaconisa" },
  { stageId: STAGE.CON,   serviceId: 6, columnIndex: 4, changeStatus: true, newStatus: "Ativo", changeTitle: true, newTitle: "DIACONISA", insertOccurrence: true, occurrenceName: "Consagrado a DIACONISA", description: "Consagração Diaconisa" },
  { stageId: STAGE.CON,   serviceId: 6, columnIndex: 5, changeTitle: true, newTitle: "MEMBRO", insertOccurrence: true, occurrenceName: "Consagração cancelada", description: "Consagração Diaconisa" },

  { stageId: STAGE.TRANSF, serviceId: 7, columnIndex: 1, changeStatus: true,  newStatus: "",         changeTitle: true, newTitle: "NOVO", doesTransfer: true, insertOccurrence: true, occurrenceName: "Carta solicitada",   description: "Carta de Mudança" },
  { stageId: STAGE.TRANSF, serviceId: 7, columnIndex: 2, changeStatus: true,  newStatus: "Desligado", changeTitle: true, newTitle: "NOVO", doesTransfer: true, insertOccurrence: true, occurrenceName: "Carta aprovada",     description: "Carta de Mudança" },
  { stageId: STAGE.TRANSF, serviceId: 7, columnIndex: 3, changeStatus: true,  newStatus: null,        changeTitle: true, newTitle: "NOVO", doesTransfer: true, insertOccurrence: true, occurrenceName: "Carta não aprovada", description: "Carta de Mudança" },

  { stageId: STAGE.CON,   serviceId: 8, columnIndex: 1, insertOccurrence: true, occurrenceName: "Indicação a EVANGELISTA", description: "Consagração a Evangelista" },
  { stageId: STAGE.CON,   serviceId: 8, columnIndex: 2, insertOccurrence: true, occurrenceName: "Aprovado",                description: "Consagração a Evangelista" },
  { stageId: STAGE.CON,   serviceId: 8, columnIndex: 3, insertOccurrence: true, occurrenceName: "Documentos aprovados",    description: "Consagração a Evangelista" },
  { stageId: STAGE.CON,   serviceId: 8, columnIndex: 4, changeStatus: true, newStatus: "Ativo", changeTitle: true, newTitle: "EVANGELISTA", insertOccurrence: true, occurrenceName: "Consagrado a EVANGELISTA",          description: "Consagração a Evangelista" },
  { stageId: STAGE.CON,   serviceId: 8, columnIndex: 5, changeStatus: true, newStatus: "Ativo", changeTitle: true, newTitle: "PRESBITERO",  insertOccurrence: true, occurrenceName: "Consagrado a EVANGELISTA Cancelado", description: "Consagração a Evangelista" },

  { stageId: STAGE.CON,   serviceId: 9, columnIndex: 1, insertOccurrence: true, occurrenceName: "Consagração a Pastor", description: "Consagração a Pastor" },
  { stageId: STAGE.CON,   serviceId: 9, columnIndex: 2, insertOccurrence: true, occurrenceName: "Aprovado",             description: "Consagração a Pastor" },
  { stageId: STAGE.CON,   serviceId: 9, columnIndex: 3, insertOccurrence: true, occurrenceName: "Documentos aprovados", description: "Consagração a Pastor" },
  { stageId: STAGE.CON,   serviceId: 9, columnIndex: 4, changeStatus: true, newStatus: "Ativo", changeTitle: true, newTitle: "PASTOR",      insertOccurrence: true, occurrenceName: "Consagrado a PASTOR",      description: "Consagração a Pastor" },
  { stageId: STAGE.CON,   serviceId: 9, columnIndex: 5, changeStatus: true, newStatus: "Ativo", changeTitle: true, newTitle: "EVANGELISTA", insertOccurrence: true, occurrenceName: "Consagração cancelada",    description: "Consagração a Pastor" },

  { stageId: STAGE.CON,   serviceId: 10, columnIndex: 1, insertOccurrence: true, occurrenceName: "Consagração a Presbítero", description: "Consagração a Presbítero" },
  { stageId: STAGE.CON,   serviceId: 10, columnIndex: 2, insertOccurrence: true, occurrenceName: "Aprovado",                 description: "Consagração a Presbítero" },
  { stageId: STAGE.CON,   serviceId: 10, columnIndex: 3, insertOccurrence: true, occurrenceName: "Documentos aprovados",     description: "Consagração a Presbítero" },
  { stageId: STAGE.CON,   serviceId: 10, columnIndex: 4, changeStatus: true, newStatus: "Ativo", changeTitle: true, newTitle: "PRESBITERO", insertOccurrence: true, occurrenceName: "Consagrado a PRESBÍTERO",  description: "Consagração a Presbítero" },
  { stageId: STAGE.CON,   serviceId: 10, columnIndex: 5, changeStatus: true, newStatus: "Ativo", changeTitle: true, newTitle: "DIACONO",    insertOccurrence: true, occurrenceName: "Consagração cancelada",    description: "Consagração a Presbítero" },

  { stageId: STAGE.REQ,   serviceId: 11, columnIndex: 1, insertOccurrence: true, occurrenceName: "Descredenciamento de Cargo - Evangelista (Mulher)", description: "Descredenciamento de Cargo - Evangelista (Mulher)" },
  { stageId: STAGE.REQ,   serviceId: 11, columnIndex: 2, insertOccurrence: true, occurrenceName: "Aprovado",                                          description: "Descredenciamento de Cargo - Evangelista (Mulher)" },
  { stageId: STAGE.REQ,   serviceId: 11, columnIndex: 3, changeStatus: true, newStatus: "Desligado", insertOccurrence: true, occurrenceName: "Descredenciado", description: "Descredenciamento de Cargo - Evangelista (Mulher)" },

  { stageId: STAGE.REQ,   serviceId: 12, columnIndex: 1, insertOccurrence: true, occurrenceName: "Descredenciamento de Cargo - Evangelista (Homem)", description: "Descredenciamento de Cargo - Evangelista (Homem)" },
  { stageId: STAGE.REQ,   serviceId: 12, columnIndex: 2, insertOccurrence: true, occurrenceName: "Aprovado",                                         description: "Descredenciamento de Cargo - Evangelista (Homem)" },
  { stageId: STAGE.REQ,   serviceId: 12, columnIndex: 3, changeStatus: true, newStatus: "Desligado", insertOccurrence: true, occurrenceName: "Descredenciado", description: "Descredenciamento de Cargo - Evangelista (Homem)" },

  { stageId: STAGE.REQ,   serviceId: 13, columnIndex: 1, insertOccurrence: true, occurrenceName: "Descredenciamento de Cargo - Pastor", description: "Descredenciamento de Cargo - Pastor" },
  { stageId: STAGE.REQ,   serviceId: 13, columnIndex: 2, insertOccurrence: true, occurrenceName: "Descredenciamento de Cargo - Pastor", description: "Descredenciamento de Cargo - Pastor" },
  { stageId: STAGE.REQ,   serviceId: 13, columnIndex: 3, insertOccurrence: true, occurrenceName: "Descredenciado",                      description: "Descredenciamento de Cargo - Pastor" },

  { stageId: STAGE.REQ,   serviceId: 14, columnIndex: 1, changeTitle: false, newTitle: "NOVO",   insertOccurrence: true, occurrenceName: "Deligamento de membro",   description: "Desligamento de Membros" },
  { stageId: STAGE.REQ,   serviceId: 14, columnIndex: 2, changeStatus: true, newStatus: "Desligado", changeTitle: false, newTitle: "NOVO",   insertOccurrence: true, occurrenceName: "Membro desligado",        description: "Desligamento de Membros" },
  { stageId: STAGE.REQ,   serviceId: 14, columnIndex: 3, changeStatus: true, newStatus: "Ativo",     changeTitle: false, newTitle: "MEMBRO", insertOccurrence: true, occurrenceName: "Desligamento Cancelado",  description: "Desligamento de Membros" },

  { stageId: STAGE.REQ,   serviceId: 15, columnIndex: 1, insertOccurrence: true, occurrenceName: "Desligamento de Ministros", description: "Desligamento de Ministros" },
  { stageId: STAGE.REQ,   serviceId: 15, columnIndex: 2, changeStatus: true, newStatus: "Desligado", insertOccurrence: true, occurrenceName: "Desligado",            description: "Desligamento de Ministros" },
  { stageId: STAGE.REQ,   serviceId: 15, columnIndex: 3, changeStatus: true, newStatus: "Ativo",     insertOccurrence: true, occurrenceName: "Desligamento cancelado", description: "Desligamento de Ministros" },

  { stageId: STAGE.REQ,   serviceId: 16, columnIndex: 1, insertOccurrence: true, occurrenceName: "Desligamento de Obreiros", description: "Desligamento de Obreiros" },
  { stageId: STAGE.REQ,   serviceId: 16, columnIndex: 2, changeStatus: true, newStatus: "Desligado", insertOccurrence: true, occurrenceName: "Obreiro Desligado",     description: "Desligamento de Obreiros" },
  { stageId: STAGE.REQ,   serviceId: 16, columnIndex: 3, changeStatus: true, newStatus: "Ativo",     insertOccurrence: true, occurrenceName: "Desligamento Cancelado", description: "Desligamento de Obreiros" },

  { stageId: STAGE.REQ,   serviceId: 17, columnIndex: 1, changeTitle: false, newTitle: "NOVO",                 insertOccurrence: true, occurrenceName: "Exclusão de Membros",  description: "Exclusão de Membros" },
  { stageId: STAGE.REQ,   serviceId: 17, columnIndex: 2, changeStatus: true, newStatus: "Excluido", changeTitle: true, newTitle: "AGUARDANDO ATIVACAO", insertOccurrence: true, occurrenceName: "Aprovado",              description: "Exclusão de Membros" },
  { stageId: STAGE.REQ,   serviceId: 17, columnIndex: 3, changeTitle: false, newTitle: "NOVO",                 insertOccurrence: true, occurrenceName: "Exclusão cancelada", description: "Exclusão de Membros" },

  { stageId: STAGE.REQ,   serviceId: 18, columnIndex: 1, insertOccurrence: true, occurrenceName: "Falecimento",                                description: "Falecimento" },
  { stageId: STAGE.REQ,   serviceId: 18, columnIndex: 2, changeStatus: true, newStatus: "Desligado", insertOccurrence: true, occurrenceName: "Ação de desligamento por falecimento", message: "Falecido", description: "Falecimento" },
  { stageId: STAGE.REQ,   serviceId: 18, columnIndex: 3, insertOccurrence: true, occurrenceName: "Cancelado",                                  description: "Falecimento" },

  { stageId: STAGE.REQ,   serviceId: 19, columnIndex: 1, insertOccurrence: true, occurrenceName: "Readmissão de Membros", description: "Readmissão de Membros" },
  { stageId: STAGE.REQ,   serviceId: 19, columnIndex: 2, changeStatus: true, newStatus: "Ativo",                changeTitle: true, newTitle: "MEMBRO",     insertOccurrence: true, occurrenceName: "Aprovado",             description: "Readmissão de Membros" },
  { stageId: STAGE.REQ,   serviceId: 19, columnIndex: 3, newStatus: "Aguardando Ativação",                       changeTitle: true, newTitle: "CONGREGADO", insertOccurrence: true, occurrenceName: "Readmissão cancelada", description: "Readmissão de Membros" },

  { stageId: STAGE.REQ,   serviceId: 20, columnIndex: 1, insertOccurrence: true, occurrenceName: "Readmissão de Obreiros", description: "Readmissão de Obreiros" },
  { stageId: STAGE.REQ,   serviceId: 20, columnIndex: 2, changeStatus: true, newStatus: "Ativo",                insertOccurrence: true, occurrenceName: "Aprovado",             description: "Readmissão de Obreiros" },
  { stageId: STAGE.REQ,   serviceId: 20, columnIndex: 3, newStatus: "Aguardando Ativação",                      insertOccurrence: true, occurrenceName: "Readmissão cancelada", description: "Readmissão de Obreiros" },

  { stageId: STAGE.REQ,   serviceId: 21, columnIndex: 1, insertOccurrence: true, occurrenceName: "Readmissão de Ministros", description: "Readmissão de Ministros" },
  { stageId: STAGE.REQ,   serviceId: 21, columnIndex: 2, changeStatus: true, newStatus: "Ativo", insertOccurrence: true, occurrenceName: "Aprovado",             description: "Readmissão de Ministros" },
  { stageId: STAGE.REQ,   serviceId: 21, columnIndex: 3, newStatus: "Ativo",                     insertOccurrence: true, occurrenceName: "Readmissão cancelada", description: "Readmissão de Ministros" },

  { stageId: STAGE.REQ,   serviceId: 22, columnIndex: 1, insertOccurrence: true, occurrenceName: "Reconhecimento de Cargo - Evangelista", description: "Reconhecimento de Cargo - Evangelista" },
  { stageId: STAGE.REQ,   serviceId: 22, columnIndex: 2, insertOccurrence: true, occurrenceName: "Aprovado",                              description: "Reconhecimento de Cargo - Evangelista" },
  { stageId: STAGE.REQ,   serviceId: 22, columnIndex: 3, insertOccurrence: true, occurrenceName: "Reconhecimento cancelado",              description: "Reconhecimento de Cargo - Evangelista" },

  { stageId: STAGE.REQ,   serviceId: 23, columnIndex: 1, insertOccurrence: true, occurrenceName: "Reconhecimento de Cargo - Pastor", description: "Reconhecimento de Cargo - Pastor" },
  { stageId: STAGE.REQ,   serviceId: 23, columnIndex: 2, changeStatus: true, newStatus: "Ativo", insertOccurrence: true, occurrenceName: "Aprovado", description: "Reconhecimento de Cargo - Pastor" },
  { stageId: STAGE.REQ,   serviceId: 23, columnIndex: 3, insertOccurrence: true, occurrenceName: "Reconhecimento cancelado", description: "Reconhecimento de Cargo - Pastor" },

  { stageId: STAGE.REQ,   serviceId: 24, columnIndex: 1, insertOccurrence: true, occurrenceName: "Reconhecimento de Cargo - Missionaria", description: "Reconhecimento de Cargo - Missionaria" },
  { stageId: STAGE.REQ,   serviceId: 24, columnIndex: 2, changeStatus: true, newStatus: "Ativo", insertOccurrence: true, occurrenceName: "Aprovado", description: "Reconhecimento de Cargo - Missionaria" },
  { stageId: STAGE.REQ,   serviceId: 24, columnIndex: 3, insertOccurrence: true, occurrenceName: "Reconhecimento cancelado", description: "Reconhecimento de Cargo - Missionaria" },

  { stageId: STAGE.REQ,   serviceId: 25, columnIndex: 1, insertOccurrence: true, occurrenceName: "Reconhecimento de Cargo - Presbítero", description: "Reconhecimento de Cargo - Presbítero" },
  { stageId: STAGE.REQ,   serviceId: 25, columnIndex: 2, changeStatus: true, newStatus: "Ativo", insertOccurrence: true, occurrenceName: "Aprovado", description: "Reconhecimento de Cargo - Presbítero" },
  { stageId: STAGE.REQ,   serviceId: 25, columnIndex: 3, insertOccurrence: true, occurrenceName: "Reconhecimento cancelado", description: "Reconhecimento de Cargo - Presbítero" },

  { stageId: STAGE.REQ,   serviceId: 26, columnIndex: 1, insertOccurrence: true, occurrenceName: "Separação a Cooperador", description: "Separação a Cooperador" },
  { stageId: STAGE.REQ,   serviceId: 26, columnIndex: 2, changeStatus: true, newStatus: "Ativo", insertOccurrence: true, occurrenceName: "Aprovado",             description: "Separação a Cooperador" },
  { stageId: STAGE.REQ,   serviceId: 26, columnIndex: 3, insertOccurrence: true, occurrenceName: "Documentação aprovada", description: "Separação a Cooperador" },
  { stageId: STAGE.REQ,   serviceId: 26, columnIndex: 4, newStatus: "Ativo", changeTitle: true, newTitle: "COOPERADOR", insertOccurrence: true, occurrenceName: "Separado",  description: "Separação a Cooperador" },
  { stageId: STAGE.REQ,   serviceId: 26, columnIndex: 5, insertOccurrence: true, occurrenceName: "Cancelado",            description: "Separação a Cooperador" },

  { stageId: STAGE.REQ,   serviceId: 27, columnIndex: 1, insertOccurrence: true, occurrenceName: "Separação a Cooperadora",            description: "Separação a Cooperadora" },
  { stageId: STAGE.REQ,   serviceId: 27, columnIndex: 2, insertOccurrence: true, occurrenceName: "Aprovado",                           description: "Separação a Cooperadora" },
  { stageId: STAGE.REQ,   serviceId: 27, columnIndex: 3, insertOccurrence: true, occurrenceName: "Separação a Cooperadora cancelado", description: "Separação a Cooperadora" },
  { stageId: STAGE.REQ,   serviceId: 27, columnIndex: 4, insertOccurrence: true, occurrenceName: "Documentação aprovada",             description: "Separação a Cooperadora" },

  { stageId: STAGE.TRANSF, serviceId: 28, columnIndex: 1, changeStatus: true, newStatus: "",      changeTitle: true, newTitle: "",       insertOccurrence: true, occurrenceName: "Aguardando transferência", description: "Transferencia de Membro" },
  { stageId: STAGE.TRANSF, serviceId: 28, columnIndex: 2, changeStatus: true, newStatus: "Ativo", changeTitle: true, newTitle: "", doesTransfer: true, insertOccurrence: true, occurrenceName: "Transferido",  description: "Transferencia de Membro" },
  { stageId: STAGE.TRANSF, serviceId: 28, columnIndex: 3, changeStatus: true, newStatus: "",      changeTitle: true, newTitle: "",       insertOccurrence: true, occurrenceName: "Transferência cancelada",   description: "Transferencia de Membro" },

  { stageId: STAGE.BAT,   serviceId: 29, columnIndex: 1, insertOccurrence: true, occurrenceName: "Incluido no batismo", description: "Batismo em águas" },
  { stageId: STAGE.BAT,   serviceId: 29, columnIndex: 2, changeStatus: true, newStatus: "Ativo", changeTitle: true, newTitle: "MEMBRO", insertOccurrence: true, occurrenceName: "Batizado",         description: "Batismo em águas", servicoExtra: "Membro" },
  { stageId: STAGE.BAT,   serviceId: 29, columnIndex: 3, insertOccurrence: true, occurrenceName: "Batismo Cancelado",  description: "Batismo em águas" },
];

async function run() {
  console.log("Seeding kan_pipelines...");
  for (const p of pipelines) {
    await prisma.kanPipeline.upsert({ where: { id: p.id }, update: p, create: p });
  }

  console.log("Seeding kan_services...");
  for (const s of services) {
    await prisma.kanService.upsert({ where: { id: s.id }, update: s, create: s });
  }

  console.log("Seeding kan_stages...");
  for (const st of stages) {
    await prisma.kanStage.upsert({ where: { id: st.id }, update: st, create: st });
  }

  console.log("Seeding kan_columns...");
  for (const c of columns) {
    await prisma.kanColumn.upsert({ where: { id: c.id }, update: c, create: c });
  }

  console.log("Seeding kan_matrix_rules...");
  // Clear & re-insert (no stable legacy id to upsert by)
  await prisma.kanMatrixRule.deleteMany({});
  for (const r of rules) {
    await prisma.kanMatrixRule.create({ data: r });
  }

  // Reset sequences so new auto-increments don't collide with seeded IDs
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('kan_pipelines', 'id'), COALESCE((SELECT MAX(id) FROM kan_pipelines), 1))`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('kan_stages',    'id'), COALESCE((SELECT MAX(id) FROM kan_stages), 1))`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('kan_columns',   'id'), COALESCE((SELECT MAX(id) FROM kan_columns), 1))`);

  console.log("Done.");
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
