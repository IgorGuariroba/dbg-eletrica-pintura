# 1 Solicitação gera N Ordens de Serviço

Cliente preenche um formulário (múltiplas categorias permitidas). Sistema cria automaticamente 1 OS por categoria selecionada. Admin/técnico pode merge OS se mesmo técnico faz tudo. Cada OS tem ciclo de vida, técnico, garantia e agendamento independentes.

Decidimos assim porque: (1) 1 OS = 1 técnico simplifica máquina de estados, agendamento e responsabilidade; (2) garantias têm prazos diferentes por categoria (elétrica 12 meses, pintura 6 meses); (3) checkout consolidado opcional permite pagar junto ou separado sem bloquear nenhuma OS.

## Consequences

- Merge de OS é operação manual do admin — necessário enquanto Diego faz tudo sozinho, natural quando equipe especializar.
- Cliente vê Solicitação como agrupador no portal, não OS individuais (exceto no detalhe).
