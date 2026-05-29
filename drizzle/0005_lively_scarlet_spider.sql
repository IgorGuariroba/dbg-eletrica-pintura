CREATE TABLE "operacao_config" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"preco_litro" numeric(10, 2) DEFAULT '6.00' NOT NULL,
	"km_por_litro" numeric(10, 2) DEFAULT '10.00' NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
