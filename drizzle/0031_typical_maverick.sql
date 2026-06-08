CREATE TYPE "public"."status_checklist" AS ENUM('OK', 'PROBLEMA', 'NA');--> statement-breakpoint
CREATE TABLE "checklist_preventivo_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"categoria" "categoria_servico" NOT NULL,
	"ordem" integer NOT NULL,
	"descricao" varchar(300) NOT NULL,
	"exige_foto" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "os_checklist_resultado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"os_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"descricao_snapshot" varchar(300) NOT NULL,
	"status" "status_checklist" NOT NULL,
	"observacao" text,
	"foto_url" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "os_checklist_resultado" ADD CONSTRAINT "os_checklist_resultado_os_id_ordem_servico_id_fk" FOREIGN KEY ("os_id") REFERENCES "public"."ordem_servico"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklist_item_categoria_ordem_idx" ON "checklist_preventivo_item" USING btree ("categoria","ordem");--> statement-breakpoint
CREATE UNIQUE INDEX "os_checklist_resultado_os_item_uq" ON "os_checklist_resultado" USING btree ("os_id","item_id");