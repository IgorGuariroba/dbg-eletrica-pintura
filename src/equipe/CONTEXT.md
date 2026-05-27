# Equipe

Gestão de pessoas e permissões. Cadastro de técnicos (campo) e membros internos (painel). Administrado pelo módulo Equipe.

## Language

**Técnico**:
Profissional de campo. Flag independente no sistema — não é role exclusiva. Tem: foto, nome, bio, especialidades, disponibilidade semanal. Usa PWA offline-first. Acumula nota média e portfólio (fotos aprovadas).
_Avoid_: Prestador, funcionário, operador

**Membro Interno**:
Pessoa com acesso ao painel administrativo. Tem **Módulos** atribuídos. Pode ser também **Técnico** (roles compostas). Criado pelo admin com módulo Equipe ou pelo Admin Raiz.
_Avoid_: Usuário admin, staff

**Admin Raiz**:
Membro Interno especial com acesso total. Definido via `.env` (variável ADMIN_EMAIL). Único por instalação. Não pode ser removido pelo painel.
_Avoid_: Super admin, root, owner

**Módulo**:
Unidade de permissão binária (tem ou não tem). Seis módulos: Operação, Financeiro, Marketing, Equipe, Garantias, Catálogo. Atribuídos por membro no banco de dados.
_Avoid_: Permissão, role, escopo, feature flag

**Roles Compostas**:
Um usuário pode ser Técnico (flag campo) + ter Módulos admin simultaneamente. Ex: Diego = Técnico + Admin Raiz. Bruna = Membro Interno com módulos Financeiro + Marketing, sem flag Técnico.
_Avoid_: Multi-role, perfil duplo

**Especialidade**:
Categorias de serviço que o Técnico domina (Elétrica, Pintura, Drywall). Usada pelo Instant Booking pra atribuição automática.
_Avoid_: Skill, competência, habilidade

**Disponibilidade**:
Horários semanais que o Técnico está disponível pra agendamento. Definida dentro do horário comercial configurado pelo admin (módulo Operação). Técnico pode restringir, não expandir.
_Avoid_: Agenda, calendar, schedule

**Dashboard**:
Não é módulo — é reflexo filtrado. Cada Membro Interno vê métricas dos Módulos que possui. Admin Raiz vê tudo. Métricas por módulo:
- Operação: OS do dia, pendentes, taxa aprovação, técnicos em campo
- Financeiro: faturamento, pendentes, MRR, ticket médio
- Marketing: funil, leads, conversão, remarketing
- Equipe: técnicos ativos, avaliação média, OS por técnico
- Garantias: ativas, chamados, taxa acionamento
- Catálogo: serviços mais pedidos, sem demanda

## Relationships

- **Equipe → Operação**: disponibilidade do técnico define slots; especialidade define atribuição
- **Equipe → Portal**: role detection no login (e-mail na tabela membros → visão interna)
- **Equipe → Auth.js**: callback signIn consulta tabela membros pra definir role + módulos na session

## Example Dialogue

> **Dev**: Diego quer dar acesso ao módulo Financeiro pra Bruna. Como faz?
>
> **Domain Expert**: Diego (Admin Raiz) abre módulo Equipe, cadastra Bruna como Membro Interno com e-mail Google dela, ativa módulo Financeiro. Próximo login da Bruna → Auth.js detecta e-mail na tabela → session com módulo Financeiro. Dashboard mostra só métricas financeiras.
>
> **Dev**: E se Diego quiser tirar acesso depois?
>
> **Domain Expert**: Mesmo lugar — desativa módulo. Próximo login, não tem mais. Sem redeploy.
