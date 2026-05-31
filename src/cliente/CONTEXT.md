# Cliente (Google OAuth Vinculação)

Domínio responsável por gerenciar a vinculação entre contas do Google (obtidas no login pelo Google OAuth) e o WhatsApp dos clientes (cadastrados através do formulário de solicitação).

## Language

### Cliente
Pessoa física ou jurídica cadastrada no sistema. O cliente é identificado unicamente pelo seu WhatsApp e pode possuir um `google_email` vinculado.
*Avoid*: Usuário, login, conta (use conta do Google para se referir ao OAuth).

### Vinculação
O ato de associar um `google_email` a um registro de `cliente` pré-existente (identificado por seu WhatsApp).
*Avoid*: Associação, linkagem, login-membro.

### Código de Vinculação
Código numérico temporário de 6 dígitos gerado pelo sistema para o fluxo de vinculação de conta. Como o envio é manual nesta fase, o sistema cria uma notificação interna para que um atendente da Equipe envie o código ao cliente.
*Avoid*: Token, senha, OTP, link mágico.

### Desvinculação
O ato de remover o `google_email` do cadastro de um `cliente`, permitindo que ele vincule outra conta do Google ou que o WhatsApp seja associado a um e-mail diferente. Apenas membros da equipe autorizados (módulo EQUIPE) podem realizar essa ação.
*Avoid*: Deletar cliente, desassociar.

## Relationships

- **Cliente ↔ Google Email**: Relação 1-para-1 opcional. Cada cliente só pode ter uma conta do Google associada, e cada conta do Google só pode ser associada a um cliente.
- **Notificação In-App**: Utilizada para notificar a Equipe com o código gerado durante o fluxo manual de vinculação.
