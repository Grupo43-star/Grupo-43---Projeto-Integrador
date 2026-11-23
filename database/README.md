# Banco de Dados — ReciclaBairro

> **Projeto Integrador — Análise e Desenvolvimento de Sistemas (SENAC EAD) · Grupo 43**  
> Documentação oficial da arquitetura de dados, Diagrama Entidade-Relacionamento (DER) e Dicionário de Dados.

---

## 1. Visão Geral e Evolução

| Etapa | Tecnologia | Finalidade | Localização no Repositório |
| :--- | :--- | :--- | :--- |
| **Protótipo (v0)** | MySQL 8 | Modelagem inicial baseada no primeiro protótipo visual | `banco de dados/prototipo_mysql/` |
| **Oficial (v1)** | PostgreSQL 17 + PostGIS | Banco de produção com geolocalização, Prisma ORM e API REST | `reciclabairro-backend-main/prisma/` |

* **Ambiente Local:** Docker na porta `5434` (banco `reciclabairro`).
* **Ambiente de Produção:** Neon (PostgreSQL Serverless) integrado à API na Vercel.

---

## 2. Estrutura Desta Pasta

* `README.md` — Visão geral da arquitetura e instruções de execução.
* `02_dicionario_dados_e_der.md` — Diagrama visual (DER) e descrição das 20 tabelas.
* `prototipo_mysql/` — Scripts SQL (`01_schema.sql` e `02_seeds.sql`) da fase de prototipação.

---

## 3. Destaques da Modelagem Oficial

* **Controle de Acesso (RBAC) e LGPD**
  * Suporte a 6 perfis: `MORADOR`, `COMERCIANTE`, `GESTOR_COOPERATIVA`, `COLETOR`, `EDUCADOR` e `ADMIN`.
  * Registro de consentimento LGPD (`lgpdConsentAt`) e exclusão lógica (`deletedAt`).

* **Geolocalização Espacial (PostGIS)**
  * Coluna `geo` (`geography(Point, 4326)`) com índice `GiST` na tabela `CollectionPoint`.
  * Preenchida automaticamente via *trigger* a partir de latitude e longitude para buscas por proximidade.

* **Ciclo de Vida e Auditoria de Coletas**
  * Fluxo de status controlado: `SOLICITADA` → `EM_ANALISE` → `AGENDADA` → `EM_ROTA` → `CONCLUIDA` (além de `RECUSADA` e `CANCELADA`).
  * Histórico completo em `PickupStatusHistory` e protocolo único no formato `RB-AAAA-NNNNNN`.

* **Notificações Assíncronas (Outbox Pattern)**
  * Fila de entregas por canal (`IN_APP`, `PUSH`, `EMAIL`) na tabela `NotificationDelivery` com controle de tentativas.

---

## 4. Como Subir o Banco Localmente

Os arquivos de migração e carga de dados (`seed.ts`) ficam dentro da pasta do back-end:

```bash
cd reciclabairro-backend-main
cp .env.example .env
docker compose up -d db
npm install
npm run db:deploy
npm run db:seed