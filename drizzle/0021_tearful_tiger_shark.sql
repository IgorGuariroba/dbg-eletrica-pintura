CREATE TABLE "notificacao_marco" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"os_id" uuid NOT NULL,
	"marco" varchar(64) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificacao_template" (
	"nome" varchar(64) PRIMARY KEY NOT NULL,
	"rotulo" varchar(120) NOT NULL,
	"variaveis" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notificacao_marco" ADD CONSTRAINT "notificacao_marco_os_id_ordem_servico_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."ordem_servico"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notificacao_marco_os_marco_uq" ON "notificacao_marco" USING btree ("os_id","marco");