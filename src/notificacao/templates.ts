import { eq } from "drizzle-orm";
import { db as dbPadrao, type DB } from "@/db/client";
import { notificacaoTemplate } from "@/db/schema";

/**
 * Catálogo de templates proativos da Cloud API. A fonte de verdade de QUAIS
 * templates existem fica no código (o dispatcher e o job de lembrete referenciam
 * estes nomes); a Operação só edita as **variáveis padrão** (saudação,
 * assinatura, link curto base), persistidas em `notificacao_template` como
 * override por template. O corpo aprovado na Meta não é editável aqui.
 */
export interface TemplateNotificacao {
  /** Nome do template aprovado na Meta. */
  nome: string;
  /** Rótulo amigável exibido na UI de config. */
  rotulo: string;
  /** Variáveis padrão editáveis (chave → valor default). */
  variaveisPadrao: Record<string, string>;
  /**
   * Ordem posicional dos parâmetros do corpo. O gateway envia
   * `Object.values(variaveis)` como params posicionais ({{1}}, {{2}}, …), então
   * ESTA ordem deve casar exatamente com o layout do template aprovado na Meta
   * Business Manager. Ao aprovar/alterar o template lá, ajustar aqui.
   */
  ordemVariaveis: string[];
}

export const TEMPLATES_NOTIFICACAO: TemplateNotificacao[] = [
  {
    nome: "orcamento_pronto",
    rotulo: "Orçamento Pronto",
    variaveisPadrao: { saudacao: "Olá", assinatura: "Equipe DBG Elétrica e Pintura" },
    ordemVariaveis: ["saudacao", "nome_cliente", "link", "assinatura"],
  },
  {
    nome: "tecnico_a_caminho",
    rotulo: "Técnico a Caminho",
    variaveisPadrao: { saudacao: "Olá", assinatura: "Equipe DBG Elétrica e Pintura" },
    ordemVariaveis: ["saudacao", "nome_cliente", "nome_tecnico", "assinatura"],
  },
  {
    nome: "lembrete_pagamento",
    rotulo: "Lembrete de Pagamento",
    variaveisPadrao: { saudacao: "Olá", assinatura: "Equipe DBG Elétrica e Pintura" },
    ordemVariaveis: ["saudacao", "nome_cliente", "valor", "link", "assinatura"],
  },
  {
    nome: "garantia_acionada",
    rotulo: "Garantia Acionada",
    variaveisPadrao: { saudacao: "Olá", assinatura: "Equipe DBG Elétrica e Pintura" },
    ordemVariaveis: ["saudacao", "nome_cliente", "link", "assinatura"],
  },
  {
    nome: "pedido_avaliacao",
    rotulo: "Pedido de Avaliação",
    variaveisPadrao: { saudacao: "Olá", assinatura: "Equipe DBG Elétrica e Pintura" },
    ordemVariaveis: ["saudacao", "nome_cliente", "link", "assinatura"],
  },
  {
    nome: "reavaliacao_pedido",
    rotulo: "Pedido de Reavaliação",
    variaveisPadrao: { saudacao: "Olá", assinatura: "Equipe DBG Elétrica e Pintura" },
    ordemVariaveis: ["saudacao", "nome_cliente", "link", "assinatura"],
  },
  {
    nome: "assinatura_pagamento_falhou",
    rotulo: "Falha de Pagamento de Assinatura",
    variaveisPadrao: { saudacao: "Olá", assinatura: "Equipe DBG Elétrica e Pintura" },
    ordemVariaveis: ["saudacao", "nome_cliente", "link", "assinatura"],
  },
  {
    nome: "orcamento_expirando",
    rotulo: "Orçamento Expirando",
    variaveisPadrao: { saudacao: "Olá", assinatura: "Equipe DBG Elétrica e Pintura" },
    ordemVariaveis: ["saudacao", "nome_cliente", "link", "assinatura"],
  },
  {
    nome: "orcamento_rejeitado",
    rotulo: "Orçamento Rejeitado",
    variaveisPadrao: { saudacao: "Olá", assinatura: "Equipe DBG Elétrica e Pintura" },
    ordemVariaveis: ["saudacao", "nome_cliente", "link", "assinatura"],
  },
  {
    nome: "cliente_inativo",
    rotulo: "Cliente Inativo",
    variaveisPadrao: { saudacao: "Olá", assinatura: "Equipe DBG Elétrica e Pintura" },
    ordemVariaveis: ["saudacao", "nome_cliente", "link", "assinatura"],
  },
];

export function buscarTemplate(nome: string): TemplateNotificacao | undefined {
  return TEMPLATES_NOTIFICACAO.find((t) => t.nome === nome);
}

export interface TemplateConfig extends TemplateNotificacao {
  /** Variáveis efetivas: padrão do catálogo + overrides salvos pela Operação. */
  variaveis: Record<string, string>;
}

export interface TemplateRepo {
  /** Lista todos os templates do catálogo com as variáveis efetivas. */
  listar(): Promise<TemplateConfig[]>;
  /** Variáveis efetivas de um template (catálogo + override). */
  obterVariaveis(nome: string): Promise<Record<string, string>>;
  /** Salva os overrides de variáveis padrão de um template. */
  salvarVariaveis(nome: string, variaveis: Record<string, string>): Promise<void>;
}

/**
 * Repo de config de templates: lê os overrides de `notificacao_template` e os
 * mescla sobre os defaults do catálogo. O catálogo é sempre a base — um template
 * sem linha na tabela usa os defaults intactos.
 */
export function criarTemplateRepo(db: DB = dbPadrao): TemplateRepo {
  async function overrides(): Promise<Map<string, Record<string, string>>> {
    const linhas = await db.select().from(notificacaoTemplate);
    return new Map(linhas.map((l) => [l.nome, l.variaveis]));
  }

  return {
    async listar() {
      const mapa = await overrides();
      return TEMPLATES_NOTIFICACAO.map((t) => ({
        ...t,
        variaveis: { ...t.variaveisPadrao, ...(mapa.get(t.nome) ?? {}) },
      }));
    },

    async obterVariaveis(nome) {
      const tpl = buscarTemplate(nome);
      const base = tpl?.variaveisPadrao ?? {};
      const [linha] = await db
        .select()
        .from(notificacaoTemplate)
        .where(eq(notificacaoTemplate.nome, nome))
        .limit(1);
      return { ...base, ...(linha?.variaveis ?? {}) };
    },

    async salvarVariaveis(nome, variaveis) {
      await db
        .insert(notificacaoTemplate)
        .values({
          nome,
          rotulo: buscarTemplate(nome)?.rotulo ?? nome,
          variaveis,
        })
        .onConflictDoUpdate({
          target: notificacaoTemplate.nome,
          set: { variaveis },
        });
    },
  };
}

/**
 * Reordena as variáveis de um template na ordem posicional do corpo aprovado na
 * Meta (`ordemVariaveis`). Chaves ausentes entram como string vazia para não
 * deslocar as posições seguintes; o gateway mapeia `Object.values` em ordem para
 * {{1}}, {{2}}, … Sem catálogo conhecido, devolve as variáveis como vieram.
 */
export function ordenarVariaveis(
  nome: string,
  variaveis: Record<string, string>,
): Record<string, string> {
  const tpl = buscarTemplate(nome);
  if (!tpl) return variaveis;
  const ordenado: Record<string, string> = {};
  for (const chave of tpl.ordemVariaveis) {
    ordenado[chave] = variaveis[chave] ?? "";
  }
  return ordenado;
}

/**
 * Normaliza um WhatsApp para E.164 sem `+` (só dígitos) e valida o tamanho.
 * Devolve `null` quando o número é inválido — o dispatcher pula o canal e loga.
 */
export function normalizarWhatsapp(bruto: string): string | null {
  const digitos = bruto.replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 15) return null;
  return digitos;
}
