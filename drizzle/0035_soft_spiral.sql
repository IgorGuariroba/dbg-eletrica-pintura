CREATE TABLE "config_remarketing" (
	"gatilho" varchar(40) PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"prazos_dias" integer[] NOT NULL,
	"template_id" varchar(64),
	"atualizado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "remarketing_enviado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gatilho" varchar(40) NOT NULL,
	"cliente_id" uuid NOT NULL,
	"contexto" varchar(120) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "remarketing_enviado" ADD CONSTRAINT "remarketing_enviado_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "remarketing_enviado_uq" ON "remarketing_enviado" USING btree ("gatilho","cliente_id","contexto");