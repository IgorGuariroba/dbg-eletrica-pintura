CREATE TYPE "public"."categoria_servico" AS ENUM('ELETRICA', 'PINTURA', 'DRYWALL');--> statement-breakpoint
CREATE TYPE "public"."estado_os" AS ENUM('NOVA', 'ORCADA', 'APROVADA', 'REJEITADA', 'EXPIRADA', 'AGENDADA', 'A_CAMINHO', 'NO_LOCAL', 'EM_EXECUCAO', 'CONCLUIDA', 'PAGA', 'CANCELADA', 'GARANTIA_ABERTA');--> statement-breakpoint
CREATE TYPE "public"."modulo" AS ENUM('OPERACAO', 'FINANCEIRO', 'MARKETING', 'EQUIPE', 'GARANTIAS', 'CATALOGO');--> statement-breakpoint
CREATE TYPE "public"."tipo_os" AS ENUM('NORMAL', 'EXPRESS', 'COMPLEMENTAR', 'PREVENTIVA', 'GARANTIA');--> statement-breakpoint
CREATE TYPE "public"."unidade_medida" AS ENUM('PONTO', 'M2', 'HORA');--> statement-breakpoint
CREATE TABLE "cliente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(200) NOT NULL,
	"email" varchar(255),
	"whatsapp" varchar(20) NOT NULL,
	"endereco" jsonb,
	"google_id" varchar(100),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membro" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(200) NOT NULL,
	"email" varchar(255) NOT NULL,
	"modulos" "modulo"[] DEFAULT '{}'::modulo[] NOT NULL,
	"is_tecnico" boolean DEFAULT false NOT NULL,
	"foto_url" text,
	"bio" text,
	"especialidades" "categoria_servico"[] DEFAULT '{}'::categoria_servico[] NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orcamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"os_id" uuid NOT NULL,
	"token_aprovacao" varchar(64) NOT NULL,
	"total_material" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_mao_de_obra" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_deslocamento" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"valido_ate" timestamp with time zone NOT NULL,
	"aprovado_em" timestamp with time zone,
	"rejeitado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orcamento_token_aprovacao_unique" UNIQUE("token_aprovacao")
);
--> statement-breakpoint
CREATE TABLE "orcamento_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orcamento_id" uuid NOT NULL,
	"servico_id" uuid NOT NULL,
	"quantidade" numeric(10, 2) NOT NULL,
	"preco_unitario" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ordem_servico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"solicitacao_id" uuid NOT NULL,
	"os_pai_id" uuid,
	"tipo" "tipo_os" NOT NULL,
	"estado" "estado_os" DEFAULT 'NOVA' NOT NULL,
	"categoria" "categoria_servico" NOT NULL,
	"tecnico_id" uuid,
	"prazo_garantia_meses" integer,
	"agendado_para" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "servico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(200) NOT NULL,
	"categoria" "categoria_servico" NOT NULL,
	"preco_base" numeric(10, 2) NOT NULL,
	"unidade" "unidade_medida" NOT NULL,
	"foto_url" text,
	"prazo_garantia_meses" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solicitacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"categorias" "categoria_servico"[] NOT NULL,
	"descricao" text,
	"fotos_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"endereco" jsonb NOT NULL,
	"lgpd_aceito" boolean DEFAULT false NOT NULL,
	"origem" varchar(20) DEFAULT 'FORMULARIO' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_os_id_ordem_servico_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."ordem_servico"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_item" ADD CONSTRAINT "orcamento_item_orcamento_id_orcamento_id_fk" FOREIGN KEY ("orcamento_id") REFERENCES "public"."orcamento"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_item" ADD CONSTRAINT "orcamento_item_servico_id_servico_id_fk" FOREIGN KEY ("servico_id") REFERENCES "public"."servico"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordem_servico" ADD CONSTRAINT "ordem_servico_solicitacao_id_solicitacao_id_fk" FOREIGN KEY ("solicitacao_id") REFERENCES "public"."solicitacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordem_servico" ADD CONSTRAINT "ordem_servico_os_pai_id_ordem_servico_id_fk" FOREIGN KEY ("os_pai_id") REFERENCES "public"."ordem_servico"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordem_servico" ADD CONSTRAINT "ordem_servico_tecnico_id_membro_id_fk" FOREIGN KEY ("tecnico_id") REFERENCES "public"."membro"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacao" ADD CONSTRAINT "solicitacao_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cliente_email_uq" ON "cliente" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "cliente_google_id_uq" ON "cliente" USING btree ("google_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membro_email_uq" ON "membro" USING btree ("email");