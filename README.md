# fittrack-api

API REST do **FitTrack Pro**: prescrição, execução e acompanhamento de treinos de força e hipertrofia.
Monólito modular com NestJS (Fastify), Prisma e PostgreSQL; o mesmo código sobe como `api` (HTTP) ou `worker` (jobs).

## Documentos de referência

| Documento                                    | Conteúdo                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`docs/API.md`](docs/API.md)                 | Endpoints, envelopes de resposta, formato de erro e catálogo de códigos              |
| [`docs/ESTRUTURA.md`](docs/ESTRUTURA.md)     | Pastas, módulos, camadas, matriz de dependências e ordem de implementação por sprint |
| [`docs/spikes/sync.md`](docs/spikes/sync.md) | Spike de sincronização offline: método, resultados e decisão pela fila própria       |

Mudanças de contrato ou de estrutura são feitas primeiro nesses documentos e depois no código.

## Requisitos

- Node.js 24 (`.nvmrc`)
- pnpm 10 (`corepack enable` instala a versão fixada em `package.json`)
- Docker com Compose v2 (PostgreSQL 17 e MinIO pelo `docker-compose.yml`)

## Ambiente local

### Primeira vez

```bash
corepack enable
pnpm install                    # também gera o cliente Prisma
cp .env.example .env
pnpm dev                        # http://localhost:3000/v1/health
pnpm db:seed                    # em outro terminal, com a API no ar
```

`pnpm dev` sobe o PostgreSQL e o MinIO do `docker-compose.yml` (esperando o banco ficar saudável), aplica as migrações pendentes com `prisma migrate deploy` e inicia a API com recarga automática. Nas próximas vezes, basta `pnpm dev`.

`GET /v1/health` responde `200` com `{ "data": { "status": "ok", ... } }`, ou `503` com `"status": "down"` se o banco não responder.

No Windows com WSL 2, ative a integração com a sua distribuição em Docker Desktop > Settings > Resources > WSL integration; sem ela, o comando `docker` não existe dentro do WSL.

### Serviços

| Serviço          | Endereço                | Acesso                         |
| ---------------- | ----------------------- | ------------------------------ |
| API              | `http://localhost:3000` | prefixo `/v1`                  |
| PostgreSQL       | `localhost:5432`        | `fittrack` / `fittrack`        |
| MinIO (S3)       | `http://localhost:9000` | `fittrack` / `fittrack-secret` |
| Console do MinIO | `http://localhost:9001` | `fittrack` / `fittrack-secret` |

Os dados ficam nos volumes `postgres-data` e `storage-data`. `pnpm env:down` para os contêineres e mantém os dados; `docker compose down -v` apaga os volumes para recomeçar do zero.

### Banco de dados

| Script                          | O que faz                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm db:migrate`               | Aplica as migrações pendentes, cria a próxima se o schema mudou e gera o cliente |
| `pnpm db:migrate --name <nome>` | Cria a migração com o nome dado                                                  |
| `pnpm db:seed`                  | Grava os dados iniciais (idempotente: rodar de novo não duplica)                 |
| `pnpm db:reset`                 | Apaga a base local, reaplica todas as migrações e roda o seed (pede confirmação) |

O seed (`prisma/seed/`) grava os grupamentos e equipamentos da biblioteca, o catálogo de badges e os parâmetros de negócio de `system_settings` (meta semanal, limiares do dia válido, janelas de edição e de recálculo, validade do convite, versão mínima do app). Catálogos e badges são definidos no código e atualizados a cada execução; parâmetros só são criados quando faltam, para não desfazer um ajuste feito na base. Os exercícios base entram na Sprint 3.

Todo instante é `timestamptz` e as chaves primárias são UUID v7 geradas pelo `IdGenerator`, nunca pelo banco; `test/architecture/prisma-schema.spec.ts` confere as duas regras. A conexão fixa a sessão em UTC (`src/platform/database/pg-adapter.ts`): o adapter do Prisma envia e lê instantes sem offset, e um servidor com outro fuso deslocaria todos os horários.

O Prisma não declara índices parciais nem restrições `CHECK`; quando uma regra precisa deles (como o único vínculo ativo por aluno, `links_one_active_per_student`), crie a migração com `pnpm db:migrate --create-only --name <nome>`, acrescente o SQL ao fim do `migration.sql` e aplique com `pnpm db:migrate`. Índices parciais e `CHECK` não são removidos nas migrações seguintes, mas um índice único comum que não está no schema é: declare-o no schema ou faça-o parcial. Para conferir, com a base migrada, o comando abaixo deve gerar uma migração vazia:

```bash
pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

Cada regra em SQL tem teste em `test/integration/`.

Transações abrem só no caso de uso, por `UnitOfWork.run(tx => ...)`; os repositórios recebem o `tx`.

### Testes de integração

Rodam contra um PostgreSQL de verdade, com as migrações aplicadas, na base de `DATABASE_URL`. Use uma base separada da de desenvolvimento:

```bash
docker compose exec postgres createdb -U fittrack fittrack_test
export DATABASE_URL=postgresql://fittrack:fittrack@localhost:5432/fittrack_test?schema=public
pnpm prisma migrate deploy
pnpm test:integration
```

No CI, o job `integration` sobe um Postgres 17 como serviço e roda os mesmos passos.

### Web e mobile apontando para esta API

Os fronts escolhem a API por variável de ambiente; nenhum código muda entre local e homologação.

| Front                                | Variável              | API local                                | Homologação                |
| ------------------------------------ | --------------------- | ---------------------------------------- | -------------------------- |
| `fittrack-web`                       | `VITE_API_URL`        | `http://localhost:3000/v1`               | URL de homologação + `/v1` |
| `fittrack-mobile` (Android emulador) | `EXPO_PUBLIC_API_URL` | `http://10.0.2.2:3000/v1`                | URL de homologação + `/v1` |
| `fittrack-mobile` (aparelho)         | `EXPO_PUBLIC_API_URL` | `http://<IP da máquina na rede>:3000/v1` | URL de homologação + `/v1` |

A API escuta em `0.0.0.0`, então aparelhos na mesma rede alcançam a máquina de desenvolvimento pelo IP local.

## Homologação

A API roda no Render como serviço web Docker (`render.yaml`), com a mesma imagem do `Dockerfile`. A imagem sobe a API ou o worker conforme `PROCESS_ROLE` (`api` ou `worker`), roda com usuário sem privilégio e define `NODE_ENV=production`.

### Fluxo de publicação

1. Merge na `master` dispara o CI.
2. Com o CI verde, o workflow `Deploy staging` aplica as migrações pendentes (`prisma migrate deploy`) no banco de homologação.
3. O workflow chama o deploy hook do Render com o commit exato que passou no CI.
4. O workflow espera `GET /v1/health` responder `200` em homologação.

O auto-deploy do Render fica desligado para que nada seja publicado sem CI verde e migrações aplicadas.

### Configuração inicial (uma vez)

1. **Banco:** crie um PostgreSQL gerenciado e guarde a URL de conexão direta (sem pooler; o `prisma migrate` precisa dela). O Postgres gratuito do Render expira 30 dias após a criação; para homologação de longo prazo, use um plano pago ou um provedor com plano gratuito sem expiração.
2. **Render:** em New > Blueprint, conecte este repositório. O Render lê o `render.yaml` e pede o valor de `DATABASE_URL`. Depois, copie a URL do deploy hook em Settings > Deploy Hook.
3. **GitHub:** em Settings > Environments, crie o ambiente `staging` com:

   | Tipo     | Nome                     | Valor                                                                         |
   | -------- | ------------------------ | ----------------------------------------------------------------------------- |
   | Secret   | `STAGING_DATABASE_URL`   | URL de conexão direta do banco de homologação                                 |
   | Secret   | `RENDER_DEPLOY_HOOK_URL` | URL do deploy hook do serviço no Render                                       |
   | Variable | `STAGING_API_URL`        | URL pública da API com `/v1`, por exemplo `https://<serviço>.onrender.com/v1` |

O plano gratuito do Render hiberna o serviço após 15 minutos sem tráfego; a primeira requisição depois disso leva cerca de um minuto. O worker não está no `render.yaml` porque o Render não oferece workers no plano gratuito e ainda não há jobs; ele entra quando os primeiros jobs forem implementados.

### Rodar a imagem localmente

```bash
docker build -t fittrack-api .
docker run --rm -p 3000:3000 --env-file .env -e PROCESS_ROLE=api fittrack-api
docker run --rm --env-file .env -e PROCESS_ROLE=worker fittrack-api
```

Dentro do contêiner, `localhost` é o próprio contêiner: para usar o Postgres do `docker-compose.yml`, troque o host da `DATABASE_URL` por `host.docker.internal`.

## Variáveis de ambiente

Validadas no início do processo (`src/platform/config/env.schema.ts`): valor ausente ou inválido impede a API e o worker de subir, com a lista dos problemas. Os valores locais estão em `.env.example`.

| Variável       | Obrigatória | Padrão        | Descrição                                                    |
| -------------- | ----------- | ------------- | ------------------------------------------------------------ |
| `DATABASE_URL` | sim         | —             | URL do PostgreSQL (`postgresql://...`)                       |
| `PORT`         | não         | `3000`        | Porta HTTP da API (1 a 65535)                                |
| `NODE_ENV`     | não         | `development` | `development`, `test` ou `production`                        |
| `LOG_LEVEL`    | não         | `info`        | `fatal`, `error`, `warn`, `info`, `debug` ou `trace`         |
| `PROCESS_ROLE` | não         | `api`         | `api` ou `worker`; cada `main` força o valor do seu processo |

Em `development` os logs saem formatados (pino-pretty); nos demais ambientes, em JSON.

## Scripts

| Script                                     | O que faz                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `pnpm dev`                                 | Sobe o ambiente, aplica migrações e inicia a API com recarga automática |
| `pnpm dev:api` / `pnpm dev:worker`         | Só a API ou o worker com recarga automática (ambiente já no ar)         |
| `pnpm env:up` / `pnpm env:down`            | Sobe ou para o PostgreSQL e o MinIO do `docker-compose.yml`             |
| `pnpm build`                               | Compila para `dist/`                                                    |
| `pnpm start:api` / `pnpm start:worker`     | Roda a versão compilada                                                 |
| `pnpm test` / `test:watch` / `test:cov`    | Testes (Vitest), sem banco                                              |
| `pnpm test:integration`                    | Testes de integração contra o PostgreSQL de `DATABASE_URL`              |
| `pnpm lint` / `pnpm typecheck`             | ESLint e TypeScript                                                     |
| `pnpm arch`                                | Regras de dependência entre módulos e camadas (`dependency-cruiser`)    |
| `pnpm db:migrate` / `db:seed` / `db:reset` | Migrações, dados iniciais e recriação da base local                     |

## Estrutura

```
src/
├─ main.api.ts, app.module.ts         processo api
├─ main.worker.ts, worker.module.ts   processo worker
├─ platform/        config, database (+ /health), logging, clock-and-ids, queue, storage, push, mail, realtime
├─ shared-kernel/   errors, http (envelope, cursor, validação), auth, time (semana no fuso), types
└─ modules/         identity, linking, students, library, prescription, execution,
                    progress, gamification, messaging, notifications, files
prisma/             schema.prisma, migrations/, seed/
test/               http/, architecture/, integration/, contract/, fixtures/
```

## Convenções

- Respostas no envelope `{ "data": ... }` (aplicado por um interceptor global); listas paginadas por cursor com `{ data, page }`.
- Erros no formato `{ "error": { code, message, details, traceId } }`; o `traceId` é o mesmo valor do cabeçalho `X-Request-Id` e do log da requisição.
- Tempo e identificadores só pelas portas `Clock` e `IdGenerator` (UUID v7); o lint bloqueia `new Date()`, `Date.now()`, `randomUUID()` e `process.env` fora da `platform`.
- Branch por card (`FT-n-descricao`), um PR por card e commits no padrão Conventional Commits.
