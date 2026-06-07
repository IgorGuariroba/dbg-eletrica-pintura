CREATE TYPE "public"."status_assinatura" AS ENUM('PENDENTE', 'ATIVA', 'PAUSADA', 'CANCELADA', 'INADIMPLENTE');--> statement-breakpoint
CREATE TABLE "assinatura" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"plano_id" uuid NOT NULL,
	"status" "status_assinatura" DEFAULT 'PENDENTE' NOT NULL,
	"preapproval_id_mp" varchar(64),
	"inicio" timestamp with time zone,
	"fim_ciclo_atual" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelado_em" timestamp with time zone,
	"motivo_cancelamento" text
);
--> statement-breakpoint
CREATE TABLE "assinatura_evento" (
	"event_id" varchar(80) PRIMARY KEY NOT NULL,
	"preapproval_id_mp" varchar(64) NOT NULL,
	"tipo" varchar(40) NOT NULL,
	"recebido_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plano" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(120) NOT NULL,
	"preco" numeric(10, 2) NOT NULL,
	"preapproval_plan_id_mp" varchar(64),
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assinatura" ADD CONSTRAINT "assinatura_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assinatura" ADD CONSTRAINT "assinatura_plano_id_plano_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."plano"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assinatura_preapproval_uq" ON "assinatura" USING btree ("preapproval_id_mp");