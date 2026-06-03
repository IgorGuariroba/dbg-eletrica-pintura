CREATE TYPE "public"."canal_garantia" AS ENUM('PORTAL', 'WHATSAPP');--> statement-breakpoint
CREATE TYPE "public"."status_garantia_chamado" AS ENUM('pendente');--> statement-breakpoint
CREATE TABLE "garantia_chamado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"os_origem_id" uuid NOT NULL,
	"descricao" text NOT NULL,
	"foto_url" text NOT NULL,
	"criado_por" varchar(255) NOT NULL,
	"canal" "canal_garantia" NOT NULL,
	"status" "status_garantia_chamado" DEFAULT 'pendente' NOT NULL,
	"tem_complementar_rejeitado" boolean DEFAULT false NOT NULL,
	"acionamento_invalido" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garantia_chamado" ADD CONSTRAINT "garantia_chamado_os_origem_id_ordem_servico_id_fk" FOREIGN KEY ("os_origem_id") REFERENCES "public"."ordem_servico"("id") ON DELETE restrict ON UPDATE no action;