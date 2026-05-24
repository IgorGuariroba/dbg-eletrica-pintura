# Guia: Configurar Google Sheets para receber leads do site

Tempo estimado: 15 minutos

---

## Passo 1 — Criar a planilha de leads

1. Acesse https://sheets.google.com com a conta **dbg.servicosindustriais@gmail.com**
2. Clique em **"Em branco"** para criar uma nova planilha
3. Renomeie para: **Leads Site DBG**
4. Na primeira linha, escreva os cabeçalhos nas colunas:
   - A1: `Data`
   - B1: `Nome`
   - C1: `Telefone`
   - D1: `Servico`
5. Copie o ID da planilha que aparece na URL do navegador. Exemplo:
   - URL: `https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXX/edit`
   - O ID e a parte entre `/d/` e `/edit`
   - **Guarde esse ID, vamos precisar depois**

---

## Passo 2 — Criar projeto no Google Cloud

1. Acesse https://console.cloud.google.com
2. No topo da pagina, clique em **"Selecionar projeto"** e depois **"Novo Projeto"**
3. Nome do projeto: **Site DBG**
4. Clique em **"Criar"**
5. Aguarde criar e confirme que o projeto **Site DBG** esta selecionado no topo

---

## Passo 3 — Ativar a API do Google Sheets

1. No menu lateral esquerdo, clique em **"APIs e servicos"** > **"Biblioteca"**
2. Na barra de pesquisa, digite: **Google Sheets API**
3. Clique no resultado **Google Sheets API**
4. Clique no botao azul **"Ativar"**
5. Aguarde ativar

---

## Passo 4 — Criar conta de servico

1. No menu lateral, va em **"APIs e servicos"** > **"Credenciais"**
2. Clique em **"Criar credenciais"** > **"Conta de servico"**
3. Preencha:
   - Nome: **site-dbg**
   - ID: vai preencher automatico
4. Clique **"Criar e continuar"**
5. Na etapa de permissoes, clique **"Continuar"** (pule essa parte)
6. Na etapa final, clique **"Concluir"**

---

## Passo 5 — Gerar chave JSON

1. Na pagina de Credenciais, em **"Contas de servico"**, clique no email que aparece (algo como `site-dbg@site-dbg-xxxxx.iam.gserviceaccount.com`)
2. Va na aba **"Chaves"**
3. Clique em **"Adicionar chave"** > **"Criar nova chave"**
4. Selecione **JSON**
5. Clique **"Criar"**
6. Um arquivo `.json` vai baixar automaticamente para seu computador
7. **Guarde esse arquivo com cuidado — ele da acesso a planilha. Nao compartilhe publicamente.**

---

## Passo 6 — Compartilhar a planilha com a conta de servico

1. Volte para a planilha **Leads Site DBG** no Google Sheets
2. Clique no botao **"Compartilhar"** (canto superior direito)
3. No campo de email, cole o email da conta de servico (aquele que termina em `.iam.gserviceaccount.com`)
4. Permissao: **Editor**
5. Desmarque **"Notificar pessoas"**
6. Clique **"Compartilhar"**

---

## O que me enviar depois

Quando terminar, me envie:

1. O **arquivo JSON** que baixou no Passo 5
2. O **ID da planilha** que copiou no Passo 1

Com isso eu configuro tudo no site.

---

**Duvidas?** Me chame que eu ajudo!
