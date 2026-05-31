CREATE TYPE "public"."evento_vinculacao" AS ENUM('VINCULADO', 'DESVINCULADO');--> statement-breakpoint
CREATE TABLE "vinculacao_google_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"google_email" varchar(255) NOT NULL,
	"whatsapp" varchar(20) NOT NULL,
	"evento" "evento_vinculacao" NOT NULL,
	"ator_email" varchar(255) NOT NULL,
	"em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vinculacao_google_pendente" (
	"google_email" varchar(255) PRIMARY KEY NOT NULL,
	"whatsapp" varchar(20) NOT NULL,
	"codigo" varchar(6) NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cliente" ADD COLUMN "google_email" varchar(255);--> statement-breakpoint
ALTER TABLE "vinculacao_google_log" ADD CONSTRAINT "vinculacao_google_log_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cliente_google_email_uq" ON "cliente" USING btree ("google_email");