CREATE TYPE "public"."status_foto_portfolio" AS ENUM('PENDENTE', 'APROVADA', 'REJEITADA');--> statement-breakpoint
CREATE TYPE "public"."tipo_foto" AS ENUM('ANTES', 'DEPOIS');--> statement-breakpoint
CREATE TABLE "foto_portfolio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"os_id" uuid NOT NULL,
	"tecnico_id" uuid,
	"categoria" "categoria_servico" NOT NULL,
	"tipo" "tipo_foto" NOT NULL,
	"chave_privada" text NOT NULL,
	"chave_publica" text,
	"status" "status_foto_portfolio" DEFAULT 'PENDENTE' NOT NULL,
	"motivo_rejeicao" text,
	"tem_dado_sensivel" boolean DEFAULT false NOT NULL,
	"decidido_por" varchar(255),
	"decidido_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "foto_portfolio" ADD CONSTRAINT "foto_portfolio_os_id_ordem_servico_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."ordem_servico"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foto_portfolio" ADD CONSTRAINT "foto_portfolio_tecnico_id_membro_id_fk" FOREIGN KEY ("tecnico_id") REFERENCES "public"."membro"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "foto_portfolio_status_criado_idx" ON "foto_portfolio" USING btree ("status","criado_em");--> statement-breakpoint
CREATE INDEX "foto_portfolio_tecnico_status_idx" ON "foto_portfolio" USING btree ("tecnico_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "foto_portfolio_chave_privada_uq" ON "foto_portfolio" USING btree ("chave_privada");