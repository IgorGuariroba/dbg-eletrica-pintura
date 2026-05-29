import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  decimal,
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
    criadoEm: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    emailUq: uniqueIndex("membro_email_uq").on(t.email),
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
  criadoEm: timestamp("criado_em", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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
