ALTER TABLE "orcamento" ADD COLUMN "assinatura_token" varchar(64);--> statement-breakpoint
ALTER TABLE "orcamento" ADD COLUMN "assinatura_ip" varchar(64);--> statement-breakpoint
ALTER TABLE "orcamento" ADD COLUMN "motivo_rejeicao" text;