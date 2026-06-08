# Permissões binárias por módulo com roles compostas

Seis módulos (Operação, Financeiro, Marketing, Equipe, Garantias, Catálogo) com acesso binário (tem ou não tem). Dashboard não é módulo — filtra automaticamente pelos módulos do usuário. Técnico é flag independente que pode acumular com módulos admin (roles compostas). Admin raiz via .env acessa tudo, demais membros gerenciados no banco pelo admin.

Decidimos assim porque: (1) DBG é empresa pequena — granularidade fina (ler vs editar dentro de módulo) seria complexidade desproporcional; (2) Diego é técnico + admin raiz — roles compostas refletem realidade; (3) permissões no banco (não .env) permitem gestão em runtime sem redeploy.

## Consequences

- Se precisar restringir algo dentro de um módulo no futuro, solução é dividir o módulo em dois — não adicionar sub-permissões.
