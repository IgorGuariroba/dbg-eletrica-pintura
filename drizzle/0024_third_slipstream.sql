CREATE TABLE "avaliacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"os_id" uuid NOT NULL,
	"tecnico_id" uuid,
	"nota" integer NOT NULL,
	"comentario_os" text,
	"ator_token" varchar(64) NOT NULL,
	"ip" varchar(64) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comentario_geral" (
	"solicitacao_id" uuid PRIMARY KEY NOT NULL,
	"comentario" text NOT NULL,
	"ator_token" varchar(64) NOT NULL,
	"ip" varchar(64) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "solicitacao" ADD COLUMN "lembrete_avaliacao_enviado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_os_id_ordem_servico_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."ordem_servico"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_tecnico_id_membro_id_fk" FOREIGN KEY ("tecnico_id") REFERENCES "public"."membro"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comentario_geral" ADD CONSTRAINT "comentario_geral_solicitacao_id_solicitacao_id_fk" FOREIGN KEY ("solicitacao_id") REFERENCES "public"."solicitacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "avaliacao_os_id_uq" ON "avaliacao" USING btree ("os_id");