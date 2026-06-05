CREATE TABLE "alerta_avaliacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"os_id" uuid NOT NULL,
	"solicitacao_id" uuid NOT NULL,
	"tecnico_id" uuid,
	"nota" integer NOT NULL,
	"comentario_os" text,
	"status" varchar(16) DEFAULT 'PENDENTE' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operacao_config" ADD COLUMN "google_review_url" text;--> statement-breakpoint
ALTER TABLE "alerta_avaliacao" ADD CONSTRAINT "alerta_avaliacao_os_id_ordem_servico_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."ordem_servico"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerta_avaliacao" ADD CONSTRAINT "alerta_avaliacao_solicitacao_id_solicitacao_id_fk" FOREIGN KEY ("solicitacao_id") REFERENCES "public"."solicitacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerta_avaliacao" ADD CONSTRAINT "alerta_avaliacao_tecnico_id_membro_id_fk" FOREIGN KEY ("tecnico_id") REFERENCES "public"."membro"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alerta_avaliacao_os_id_uq" ON "alerta_avaliacao" USING btree ("os_id");