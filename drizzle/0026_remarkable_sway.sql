CREATE TABLE "tratativa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alerta_avaliacao_id" uuid NOT NULL,
	"os_id" uuid NOT NULL,
	"tipo" varchar(32) NOT NULL,
	"descricao" text NOT NULL,
	"responsavel_id" uuid,
	"data" timestamp with time zone NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerta_avaliacao" ADD COLUMN "resolvido_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "avaliacao" ADD COLUMN "invalida" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "avaliacao" ADD COLUMN "motivo_invalidacao" text;--> statement-breakpoint
ALTER TABLE "avaliacao" ADD COLUMN "invalidada_por" varchar(255);--> statement-breakpoint
ALTER TABLE "avaliacao" ADD COLUMN "invalidada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tratativa" ADD CONSTRAINT "tratativa_alerta_avaliacao_id_alerta_avaliacao_id_fk" FOREIGN KEY ("alerta_avaliacao_id") REFERENCES "public"."alerta_avaliacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tratativa" ADD CONSTRAINT "tratativa_os_id_ordem_servico_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."ordem_servico"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tratativa" ADD CONSTRAINT "tratativa_responsavel_id_membro_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."membro"("id") ON DELETE set null ON UPDATE no action;