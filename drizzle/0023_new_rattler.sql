ALTER TYPE "public"."status_garantia_chamado" ADD VALUE 'aplicada';--> statement-breakpoint
ALTER TYPE "public"."status_garantia_chamado" ADD VALUE 'rejeitada';--> statement-breakpoint
ALTER TABLE "garantia_chamado" ADD COLUMN "os_garantia_id" uuid;--> statement-breakpoint
ALTER TABLE "garantia_chamado" ADD COLUMN "motivo_rejeicao" text;--> statement-breakpoint
ALTER TABLE "garantia_chamado" ADD COLUMN "override_prazo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "garantia_chamado" ADD COLUMN "justificativa_override" text;--> statement-breakpoint
ALTER TABLE "garantia_chamado" ADD COLUMN "decidido_por" varchar(255);--> statement-breakpoint
ALTER TABLE "garantia_chamado" ADD COLUMN "decidido_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "garantia_chamado" ADD CONSTRAINT "garantia_chamado_os_garantia_id_ordem_servico_id_fk" FOREIGN KEY ("os_garantia_id") REFERENCES "public"."ordem_servico"("id") ON DELETE set null ON UPDATE no action;