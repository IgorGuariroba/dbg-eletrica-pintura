CREATE TABLE "notificacao_in_app" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destinatario_email" varchar(255),
	"destinatario_modulo" "modulo",
	"titulo" varchar(200) NOT NULL,
	"mensagem" text NOT NULL,
	"lida" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "os_historico_conflito" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"os_id" uuid NOT NULL,
	"tipo" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"tecnico_email" varchar(255) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "os_historico_conflito" ADD CONSTRAINT "os_historico_conflito_os_id_ordem_servico_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."ordem_servico"("id") ON DELETE cascade ON UPDATE no action;