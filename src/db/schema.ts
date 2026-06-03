import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ============================================================
// Enums (linguagem do domínio — ver src/<contexto>/CONTEXT.md)
// ============================================================

export const categoriaServicoEnum = pgEnum("categoria_servico", [
  "ELETRICA",
  "PINTURA",
  "DRYWALL",
]);

export const unidadeMedidaEnum = pgEnum("unidade_medida", [
  "PONTO",
  "M2",
  "HORA",
]);

export const tipoOsEnum = pgEnum("tipo_os", [
  "NORMAL",
  "EXPRESS",
  "COMPLEMENTAR",
  "PREVENTIVA",
  "GARANTIA",
]);

export const estadoOsEnum = pgEnum("estado_os", [
  "NOVA",
  "ORCADA",
  "APROVADA",
  "REJEITADA",
  "EXPIRADA",
  "AGENDADA",
  "A_CAMINHO",
  "NO_LOCAL",
  "EM_EXECUCAO",
  "CONCLUIDA",
  "PAGA",
  "CANCELADA",
  "GARANTIA_ABERTA",
]);

export const statusFotoPortfolioEnum = pgEnum("status_foto_portfolio", [
  "PENDENTE",
  "APROVADA",
  "REJEITADA",
]);

export const tipoFotoEnum = pgEnum("tipo_foto", ["ANTES", "DEPOIS"]);

export const moduloEnum = pgEnum("modulo", [
  "OPERACAO",
  "FINANCEIRO",
  "MARKETING",
  "EQUIPE",
  "GARANTIAS",
  "CATALOGO",
]);

// ============================================================
// Cliente
// ============================================================

export const cliente = pgTable(
  "cliente",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nome: varchar("nome", { length: 200 }).notNull(),
    email: varchar("email", { length: 255 }),
    whatsapp: varchar("whatsapp", { length: 20 }).notNull(),
    endereco: jsonb("endereco").$type<{
      logradouro: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cidade: string;
      uf: string;
      cep?: string;
      lat?: number;
      lng?: number;
    }>(),
    googleId: varchar("google_id", { length: 100 }),
    googleEmail: varchar("google_email", { length: 255 }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    emailUq: uniqueIndex("cliente_email_uq").on(t.email),
    googleIdUq: uniqueIndex("cliente_google_id_uq").on(t.googleId),
    googleEmailUq: uniqueIndex("cliente_google_email_uq").on(t.googleEmail),
    whatsappUq: uniqueIndex("cliente_whatsapp_uq").on(t.whatsapp),
  }),
);

// ============================================================
// Membro Interno (painel admin) + flag Técnico
// ============================================================

export const membro = pgTable(
  "membro",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nome: varchar("nome", { length: 200 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    modulos: moduloEnum("modulos").array().notNull().default(sql`'{}'::modulo[]`),
    isTecnico: boolean("is_tecnico").notNull().default(false),
    fotoUrl: text("foto_url"),
    bio: text("bio"),
    especialidades: categoriaServicoEnum("especialidades")
      .array()
      .notNull()
      .default(sql`'{}'::categoria_servico[]`),
    disponibilidade: jsonb("disponibilidade").$type<{
      dom?: { inicio: string; fim: string } | null;
      seg?: { inicio: string; fim: string } | null;
      ter?: { inicio: string; fim: string } | null;
      qua?: { inicio: string; fim: string } | null;
      qui?: { inicio: string; fim: string } | null;
      sex?: { inicio: string; fim: string } | null;
      sab?: { inicio: string; fim: string } | null;
    }>(),
    ativo: boolean("ativo").notNull().default(true),
    slug: varchar("slug", { length: 255 }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    emailUq: uniqueIndex("membro_email_uq").on(t.email),
    slugUq: uniqueIndex("membro_slug_uq").on(t.slug),
  }),
);

// ============================================================
// Serviço (Catálogo)
// ============================================================

export const servico = pgTable("servico", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 200 }).notNull(),
  categoria: categoriaServicoEnum("categoria").notNull(),
  precoBase: decimal("preco_base", { precision: 10, scale: 2 }).notNull(),
  unidade: unidadeMedidaEnum("unidade").notNull(),
  fotoUrl: text("foto_url"),
  prazoGarantiaMeses: integer("prazo_garantia_meses").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================
// Solicitação
// ============================================================

export const solicitacao = pgTable(
  "solicitacao",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    token: varchar("token", { length: 64 }).notNull(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => cliente.id, { onDelete: "restrict" }),
    categorias: categoriaServicoEnum("categorias").array().notNull(),
    descricao: text("descricao"),
    fotosUrls: text("fotos_urls").array().notNull().default(sql`'{}'::text[]`),
    endereco: jsonb("endereco").$type<{
      logradouro: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cidade: string;
      uf: string;
      cep?: string;
      lat?: number;
      lng?: number;
    }>().notNull(),
    dataDesejada: timestamp("data_desejada", { withTimezone: true }),
    duracaoEstimada: varchar("duracao_estimada", { length: 20 }),
    lgpdAceito: boolean("lgpd_aceito").notNull().default(false),
    origem: varchar("origem", { length: 20 }).notNull().default("FORMULARIO"), // FORMULARIO | EXPRESS | MANUAL
    foraCobertura: boolean("fora_cobertura").notNull().default(false),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    tokenUq: uniqueIndex("solicitacao_token_uq").on(t.token),
  }),
);

// ============================================================
// Ordem de Serviço (OS)
// ============================================================

export const ordemServico = pgTable("ordem_servico", {
  id: uuid("id").defaultRandom().primaryKey(),
  solicitacaoId: uuid("solicitacao_id")
    .notNull()
    .references(() => solicitacao.id, { onDelete: "restrict" }),
  osPaiId: uuid("os_pai_id").references((): AnyPgColumn => ordemServico.id, {
    onDelete: "set null",
  }),
  tipo: tipoOsEnum("tipo").notNull(),
  estado: estadoOsEnum("estado").notNull().default("NOVA"),
  categoria: categoriaServicoEnum("categoria").notNull(),
  tecnicoId: uuid("tecnico_id").references(() => membro.id, {
    onDelete: "set null",
  }),
  prazoGarantiaMeses: integer("prazo_garantia_meses"),
  agendadoPara: timestamp("agendado_para", { withTimezone: true }),
  metadados: jsonb("metadados")
    .$type<{
      devolucoes?: {
        tecnicoId: string;
        motivo: string;
        em: string;
      }[];
      // OS pai aguardando aprovação de uma Complementar para prosseguir.
      aguardandoComplementar?: boolean;
      complementarId?: string;
      notaServico?: string;
      materiais?: {
        item: string;
        quantidade: number;
        observacao?: string;
      }[];
    }>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .defaultNow()
    .notNull(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (t) => ({
  tecnicoAgendadoUq: uniqueIndex("ordem_servico_tecnico_agendado_uq")
    .on(t.tecnicoId, t.agendadoPara)
    .where(sql`estado IN ('AGENDADA', 'A_CAMINHO', 'NO_LOCAL', 'EM_EXECUCAO')`),
}));

// ============================================================
// Orçamento
// ============================================================

export const orcamento = pgTable("orcamento", {
  id: uuid("id").defaultRandom().primaryKey(),
  osId: uuid("os_id")
    .notNull()
    .references(() => ordemServico.id, { onDelete: "restrict" }),
  tokenAprovacao: varchar("token_aprovacao", { length: 64 }).notNull().unique(),
  totalMaterial: decimal("total_material", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  totalMaoDeObra: decimal("total_mao_de_obra", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  totalDeslocamento: decimal("total_deslocamento", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
  validoAte: timestamp("valido_ate", { withTimezone: true }).notNull(),
  aprovadoEm: timestamp("aprovado_em", { withTimezone: true }),
  rejeitadoEm: timestamp("rejeitado_em", { withTimezone: true }),
  // Assinatura digital da aprovação: posse do link (token) + IP + carimbo.
  assinaturaToken: varchar("assinatura_token", { length: 64 }),
  assinaturaIp: varchar("assinatura_ip", { length: 64 }),
  // Aprovação presencial (assinada no PWA do técnico): DIGITAL | PRESENCIAL.
  aprovacaoTipo: varchar("aprovacao_tipo", { length: 20 }),
  // Chave da assinatura manuscrita no R2 privado (assinaturas/os/{id}/{uuid}.png).
  assinaturaUrl: text("assinatura_url"),
  // E-mail do técnico que captou a aprovação presencial.
  aprovacaoPor: varchar("aprovacao_por", { length: 255 }),
  // Aceite da LGPD registrado no ato (presencial).
  aprovacaoLgpd: boolean("aprovacao_lgpd"),
  motivoRejeicao: text("motivo_rejeicao"),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  // Acelera a busca do orçamento mais recente por OS (aprovação/expiração).
  osRecenteIdx: index("orcamento_os_criado_idx").on(t.osId, t.criadoEm.desc()),
}));

// ============================================================
// Item de Orçamento
// ============================================================

export const orcamentoItem = pgTable("orcamento_item", {
  id: uuid("id").defaultRandom().primaryKey(),
  orcamentoId: uuid("orcamento_id")
    .notNull()
    .references(() => orcamento.id, { onDelete: "cascade" }),
  servicoId: uuid("servico_id")
    .notNull()
    .references(() => servico.id, { onDelete: "restrict" }),
  quantidade: decimal("quantidade", { precision: 10, scale: 2 }).notNull(),
  precoUnitario: decimal("preco_unitario", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
});

// ============================================================
// Histórico de transições de estado da OS
// ============================================================

export const transicaoOs = pgTable(
  "transicao_os",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    osId: uuid("os_id")
      .notNull()
      .references(() => ordemServico.id, { onDelete: "cascade" }),
    estadoAnterior: estadoOsEnum("estado_anterior").notNull(),
    estadoNovo: estadoOsEnum("estado_novo").notNull(),
    atorEmail: varchar("ator_email", { length: 255 }).notNull(),
    motivo: text("motivo"),
    // Geolocalização do técnico no momento da transição (rastreamento manual).
    lat: decimal("lat", { precision: 9, scale: 6 }),
    lon: decimal("lon", { precision: 9, scale: 6 }),
    em: timestamp("em", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // Acelera a leitura cronológica do histórico de uma OS.
    osEmIdx: index("transicao_os_os_em_idx").on(t.osId, t.em),
  }),
);

// ============================================================
// Confirmação de presença do cliente (rastreamento)
// ============================================================

export const confirmacaoPresenca = pgTable("confirmacao_presenca", {
  // Uma confirmação por OS — a unicidade garante idempotência.
  osId: uuid("os_id")
    .primaryKey()
    .references(() => ordemServico.id, { onDelete: "cascade" }),
  ip: varchar("ip", { length: 64 }).notNull(),
  confirmadoEm: timestamp("confirmado_em", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================
// Config do módulo Operação (linha única)
// ============================================================

export const operacaoConfig = pgTable("operacao_config", {
  // Singleton: sempre a chave "default".
  id: text("id").primaryKey().default("default"),
  precoLitro: decimal("preco_litro", { precision: 10, scale: 2 })
    .notNull()
    .default("6.00"),
  kmPorLitro: decimal("km_por_litro", { precision: 10, scale: 2 })
    .notNull()
    .default("10.00"),
  // Horário comercial por dia da semana: janela aberta, ou ausente/null = fechado.
  // Mesma shape de membro.disponibilidade — define a janela máxima de slots.
  horarioComercial: jsonb("horario_comercial").$type<{
    dom?: { inicio: string; fim: string } | null;
    seg?: { inicio: string; fim: string } | null;
    ter?: { inicio: string; fim: string } | null;
    qua?: { inicio: string; fim: string } | null;
    qui?: { inicio: string; fim: string } | null;
    sex?: { inicio: string; fim: string } | null;
    sab?: { inicio: string; fim: string } | null;
  }>(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// ============================================================
// Raio de Cobertura (bairros atendidos — módulo Operação)
// ============================================================

export const bairroCobertura = pgTable("bairro_cobertura", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Chave normalizada (trim + lowercase) — ver src/operacao/cobertura.ts.
  nome: varchar("nome", { length: 120 }).notNull().unique(),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================
// Histórico de Conflitos
// ============================================================

export const osHistoricoConflito = pgTable("os_historico_conflito", {
  id: uuid("id").defaultRandom().primaryKey(),
  osId: uuid("os_id")
    .notNull()
    .references(() => ordemServico.id, { onDelete: "cascade" }),
  tipo: varchar("tipo", { length: 50 }).notNull(), // TRANSICAO, FOTO, NOTA, MATERIAL, ASSINATURA, CRIACAO_EXPRESS, CRIACAO_COMPLEMENTAR
  payload: jsonb("payload").notNull(),
  tecnicoEmail: varchar("tecnico_email", { length: 255 }).notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================
// Pagamento (Mercado Pago)
// ============================================================
// Âncora de idempotência do webhook: a PK composta (payment_id, os_id)
// garante que o mesmo pagamento — mesmo cobrindo N OS no checkout
// consolidado — seja persistido uma única vez por OS.

export const pagamento = pgTable(
  "pagamento",
  {
    // payment_id do Mercado Pago.
    paymentId: varchar("payment_id", { length: 64 }).notNull(),
    osId: uuid("os_id")
      .notNull()
      .references(() => ordemServico.id, { onDelete: "restrict" }),
    valor: decimal("valor", { precision: 10, scale: 2 }).notNull(),
    metodo: varchar("metodo", { length: 20 }).notNull(), // pix | credit_card | ...
    status: varchar("status", { length: 20 }).notNull(), // approved | rejected | cancelled
    observacao: text("observacao"),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.paymentId, t.osId] }),
  }),
);

// ============================================================
// Notificação In-App
// ============================================================

export const notificacaoInApp = pgTable("notificacao_in_app", {
  id: uuid("id").defaultRandom().primaryKey(),
  destinatarioEmail: varchar("destinatario_email", { length: 255 }), // Nulo se for voltada a um módulo/role (ex: admin)
  destinatarioModulo: moduloEnum("destinatario_modulo"), // Ex: "OPERACAO" para administradores
  titulo: varchar("titulo", { length: 200 }).notNull(),
  mensagem: text("mensagem").notNull(),
  lida: boolean("lida").notNull().default(false),
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================
// Notificação WhatsApp (Cloud API — módulo Notificação)
// ============================================================
// Registro de cada template proativo enviado pela Cloud API. `message_id` é o
// id devolvido pela Meta — usado para idempotência do webhook de status e para
// correlacionar eventos delivered/read/failed ao registro original.

export const filaWhatsapp = pgTable("fila_whatsapp", {
  id: uuid("id").defaultRandom().primaryKey(),
  destinatario: varchar("destinatario", { length: 32 }).notNull(),
  template: varchar("template", { length: 64 }).notNull(),
  variaveis: jsonb("variaveis").$type<Record<string, string>>().notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pendente"), // pendente | enviado
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .defaultNow()
    .notNull(),
  processadoEm: timestamp("processado_em", { withTimezone: true }),
});

export const notificacaoWhatsapp = pgTable(
  "notificacao_whatsapp",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    destinatario: varchar("destinatario", { length: 32 }).notNull(),
    template: varchar("template", { length: 64 }).notNull(),
    variaveis: jsonb("variaveis").$type<Record<string, string>>().notNull(),
    status: varchar("status", { length: 16 }).notNull(), // enviado | entregue | lido | falhou
    // id da mensagem na Meta (nulo só em registros transitórios). UNIQUE para
    // idempotência: webhook de status duplicado não cria/atualiza duas vezes.
    messageId: varchar("message_id", { length: 128 }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    messageIdUnico: uniqueIndex("notificacao_whatsapp_message_id_uq").on(
      t.messageId,
    ),
  }),
);

// ============================================================
// Marco de Notificação (idempotência do dispatcher — módulo Notificação)
// ============================================================
// Âncora de idempotência: cada evento de notificação que não pode duplicar
// grava um marco (osId, marco). UNIQUE garante que reexecuções do job (ex:
// lembrete de pagamento dia1/dia3) só disparem uma vez por marco. Insert com
// onConflictDoNothing → 0 linhas devolvidas = já enviado, pula.

export const notificacaoMarco = pgTable(
  "notificacao_marco",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    osId: uuid("os_id")
      .notNull()
      .references(() => ordemServico.id, { onDelete: "cascade" }),
    // Chave do marco, ex: "lembrete_pagamento:dia1", "lembrete_pagamento:dia3".
    marco: varchar("marco", { length: 64 }).notNull(),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    osMarcoUq: uniqueIndex("notificacao_marco_os_marco_uq").on(t.osId, t.marco),
  }),
);

// ============================================================
// Template de Notificação (config do módulo Operação)
// ============================================================
// Variáveis padrão por template editáveis pela Operação (saudação, assinatura,
// link curto base). Não edita o corpo do template Meta (precisa aprovação) — só
// alimenta as variáveis dinâmicas do payload. O dispatcher mescla esses padrões
// com as variáveis do evento (nome_cliente, valor, link) na hora do envio.

export const notificacaoTemplate = pgTable("notificacao_template", {
  // Nome do template aprovado na Meta (ex: "orcamento_pronto").
  nome: varchar("nome", { length: 64 }).primaryKey(),
  // Rótulo amigável exibido na UI de config.
  rotulo: varchar("rotulo", { length: 120 }).notNull(),
  // Variáveis padrão (saudacao, assinatura, link_base, ...).
  variaveis: jsonb("variaveis")
    .$type<Record<string, string>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// ============================================================
// Foto candidata a Portfólio (Marketing)
// ============================================================
// Só fotos que o técnico marcou "boa pra portfólio" ganham linha aqui.
// As demais fotos da OS seguem apenas no R2 privado (listadas por prefixo).

export const fotoPortfolio = pgTable(
  "foto_portfolio",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    osId: uuid("os_id")
      .notNull()
      .references(() => ordemServico.id, { onDelete: "cascade" }),
    tecnicoId: uuid("tecnico_id").references(() => membro.id, {
      onDelete: "set null",
    }),
    categoria: categoriaServicoEnum("categoria").notNull(),
    tipo: tipoFotoEnum("tipo").notNull(),
    // Chave do objeto no R2 privado (origem).
    chavePrivada: text("chave_privada").notNull(),
    // Chave no R2 público — preenchida só na aprovação (cópia separada).
    chavePublica: text("chave_publica"),
    status: statusFotoPortfolioEnum("status").notNull().default("PENDENTE"),
    motivoRejeicao: text("motivo_rejeicao"),
    // Sinalização do admin: foto exibe rosto/endereço (apenas registra).
    temDadoSensivel: boolean("tem_dado_sensivel").notNull().default(false),
    decididoPor: varchar("decidido_por", { length: 255 }),
    decididoEm: timestamp("decidido_em", { withTimezone: true }),
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    // Acelera a fila de aprovação (pendentes mais antigas primeiro).
    statusCriadoIdx: index("foto_portfolio_status_criado_idx").on(
      t.status,
      t.criadoEm,
    ),
    // Acelera "Trabalhos recentes" no perfil público do técnico.
    tecnicoStatusIdx: index("foto_portfolio_tecnico_status_idx").on(
      t.tecnicoId,
      t.status,
    ),
    // Idempotência: a mesma foto (chave R2) só pode virar candidata uma vez.
    chavePrivadaUq: uniqueIndex("foto_portfolio_chave_privada_uq").on(
      t.chavePrivada,
    ),
  }),
);

// ============================================================
// Relations
// ============================================================

export const clienteRelations = relations(cliente, ({ many }) => ({
  solicitacoes: many(solicitacao),
}));

export const solicitacaoRelations = relations(solicitacao, ({ one, many }) => ({
  cliente: one(cliente, {
    fields: [solicitacao.clienteId],
    references: [cliente.id],
  }),
  ordens: many(ordemServico),
}));

export const ordemServicoRelations = relations(ordemServico, ({ one, many }) => ({
  solicitacao: one(solicitacao, {
    fields: [ordemServico.solicitacaoId],
    references: [solicitacao.id],
  }),
  tecnico: one(membro, {
    fields: [ordemServico.tecnicoId],
    references: [membro.id],
  }),
  osPai: one(ordemServico, {
    fields: [ordemServico.osPaiId],
    references: [ordemServico.id],
    relationName: "os_hierarquia",
  }),
  osFilhas: many(ordemServico, { relationName: "os_hierarquia" }),
  orcamentos: many(orcamento),
  transicoes: many(transicaoOs),
  conflitos: many(osHistoricoConflito),
}));

export const transicaoOsRelations = relations(transicaoOs, ({ one }) => ({
  os: one(ordemServico, {
    fields: [transicaoOs.osId],
    references: [ordemServico.id],
  }),
}));

export const orcamentoRelations = relations(orcamento, ({ one, many }) => ({
  os: one(ordemServico, {
    fields: [orcamento.osId],
    references: [ordemServico.id],
  }),
  itens: many(orcamentoItem),
}));

export const orcamentoItemRelations = relations(orcamentoItem, ({ one }) => ({
  orcamento: one(orcamento, {
    fields: [orcamentoItem.orcamentoId],
    references: [orcamento.id],
  }),
  servico: one(servico, {
    fields: [orcamentoItem.servicoId],
    references: [servico.id],
  }),
}));

export const osHistoricoConflitoRelations = relations(osHistoricoConflito, ({ one }) => ({
  os: one(ordemServico, {
    fields: [osHistoricoConflito.osId],
    references: [ordemServico.id],
  }),
}));

export const fotoPortfolioRelations = relations(fotoPortfolio, ({ one }) => ({
  os: one(ordemServico, {
    fields: [fotoPortfolio.osId],
    references: [ordemServico.id],
  }),
  tecnico: one(membro, {
    fields: [fotoPortfolio.tecnicoId],
    references: [membro.id],
  }),
}));

export const eventoVinculacaoEnum = pgEnum("evento_vinculacao", ["VINCULADO", "DESVINCULADO"]);

export const vinculacaoGooglePendente = pgTable("vinculacao_google_pendente", {
  googleEmail: varchar("google_email", { length: 255 }).primaryKey(),
  whatsapp: varchar("whatsapp", { length: 20 }).notNull(),
  codigo: varchar("codigo", { length: 6 }).notNull(),
  expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
});

export const vinculacaoGoogleLog = pgTable("vinculacao_google_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  clienteId: uuid("cliente_id").notNull().references(() => cliente.id, { onDelete: "cascade" }),
  googleEmail: varchar("google_email", { length: 255 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 20 }).notNull(),
  evento: eventoVinculacaoEnum("evento").notNull(),
  atorEmail: varchar("ator_email", { length: 255 }).notNull(),
  em: timestamp("em", { withTimezone: true }).defaultNow().notNull(),
});

export const vinculacaoGoogleLogRelations = relations(vinculacaoGoogleLog, ({ one }) => ({
  cliente: one(cliente, {
    fields: [vinculacaoGoogleLog.clienteId],
    references: [cliente.id],
  }),
}));

export const canalGarantiaEnum = pgEnum("canal_garantia", ["PORTAL", "WHATSAPP"]);
export const statusGarantiaChamadoEnum = pgEnum("status_garantia_chamado", [
  "pendente",
]);

export const garantiaChamado = pgTable("garantia_chamado", {
  id: uuid("id").defaultRandom().primaryKey(),
  osOrigemId: uuid("os_origem_id")
    .notNull()
    .references(() => ordemServico.id, { onDelete: "restrict" }),
  descricao: text("descricao").notNull(),
  fotoUrl: text("foto_url").notNull(),
  criadoPor: varchar("criado_por", { length: 255 }).notNull(),
  canal: canalGarantiaEnum("canal").notNull(),
  status: statusGarantiaChamadoEnum("status").notNull().default("pendente"),
  temComplementarRejeitado: boolean("tem_complementar_rejeitado").notNull().default(false),
  acionamentoInvalido: boolean("acionamento_invalido").notNull().default(false),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
});

export const garantiaChamadoRelations = relations(garantiaChamado, ({ one }) => ({
  osOrigem: one(ordemServico, {
    fields: [garantiaChamado.osOrigemId],
    references: [ordemServico.id],
  }),
}));


