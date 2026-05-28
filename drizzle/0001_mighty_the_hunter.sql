ALTER TABLE "orcamento" DROP CONSTRAINT "orcamento_os_id_ordem_servico_id_fk";
--> statement-breakpoint
ALTER TABLE "ordem_servico" DROP CONSTRAINT "ordem_servico_solicitacao_id_solicitacao_id_fk";
--> statement-breakpoint
ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_os_id_ordem_servico_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."ordem_servico"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordem_servico" ADD CONSTRAINT "ordem_servico_solicitacao_id_solicitacao_id_fk" FOREIGN KEY ("solicitacao_id") REFERENCES "public"."solicitacao"("id") ON DELETE restrict ON UPDATE no action;