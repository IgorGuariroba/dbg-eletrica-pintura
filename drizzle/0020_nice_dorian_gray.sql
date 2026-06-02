CREATE TABLE "fila_whatsapp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destinatario" varchar(32) NOT NULL,
	"template" varchar(64) NOT NULL,
	"variaveis" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'pendente' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"processado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notificacao_whatsapp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destinatario" varchar(32) NOT NULL,
	"template" varchar(64) NOT NULL,
	"variaveis" jsonb NOT NULL,
	"status" varchar(16) NOT NULL,
	"message_id" varchar(128),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "notificacao_whatsapp_message_id_uq" ON "notificacao_whatsapp" USING btree ("message_id");