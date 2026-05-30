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
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    emailUq: uniqueIndex("cliente_email_uq").on(t.email),
    googleIdUq: uniqueIndex("cliente_google_id_uq").on(t.googleId),
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
});

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
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
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

