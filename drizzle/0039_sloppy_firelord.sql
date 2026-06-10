CREATE TABLE "rate_limit" (
	"chave" varchar(120) PRIMARY KEY NOT NULL,
	"janela_inicio" timestamp with time zone NOT NULL,
	"contagem" integer DEFAULT 1 NOT NULL
);
