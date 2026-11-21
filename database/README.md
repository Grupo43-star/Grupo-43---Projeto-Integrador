# ReciclaBairro - Banco de Dados (MySQL)

Estrutura oficial da base de dados do projeto **ReciclaBairro**, desenvolvida em MySQL.

## Estrutura dos Ficheiros

* `01_schema.sql`: Cria a base de dados `reciclabairro_db` e as 8 tabelas do sistema (`usuarios`, `materiais`, `pontos_coleta`, `calendario_coleta`, `solicitacoes_retirada`, `itens_solicitacao`, `publicacoes_comunidade` e `mensagens_contato`).
* `02_seeds.sql`: Insere registos fictícios iniciais para testes das rotas da API.

## Como executar localmente (XAMPP / MySQL)

1. Inicie o serviço **MySQL** no painel de controlo do XAMPP (porta padrão `3306`, utilizador `root`, sem palavra-passe).
2. Abra o ficheiro `01_schema.sql` no seu cliente SQL (VS Code, MySQL Workbench ou phpMyAdmin) e execute todo o script.
3. De seguida, execute o ficheiro `02_seeds.sql` para popular as tabelas com dados de teste.