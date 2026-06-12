ALTER TABLE "notificacao_marco" RENAME COLUMN "os_id" TO "ref_id";--> statement-breakpoint
ALTER TABLE "notificacao_marco" DROP CONSTRAINT "notificacao_marco_os_id_ordem_servico_id_fk";
--> statement-breakpoint
DROP INDEX "notificacao_marco_os_marco_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "notificacao_marco_ref_marco_uq" ON "notificacao_marco" USING btree ("ref_id","marco");