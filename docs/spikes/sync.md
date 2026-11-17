# Spike FT-5 · Sincronização offline

**Pergunta:** a execução do treino offline usa uma fila de mutações própria (outbox) ou o PowerSync?
**Decisão:** fila própria no app, enviando ao `POST /sync/push` idempotente da API. O offline da versão 1 cobre só a execução do treino (seção 6).
**Data:** 17/11/2026. Código do spike nas branches `spike/sync` do `fittrack-api` e do `fittrack-mobile` (descartáveis; não entram na `master`).

## 1. Método

O cenário é o mesmo para as duas opções: um aluno com ficha ativa de 5 exercícios x 4 séries. Cada execução começa o treino, registra as 20 séries e finaliza (22 mutações).

| Parte | O que foi feito |
| --- | --- |
| Endpoint idempotente (API) | `POST /v1/sync/push` com o formato da seção 6 do `API.md`. Cada mutação roda numa transação que grava a chave (`clientMutationId`, tabela `synced_mutations`) e o efeito juntos; a chave repetida responde `DUPLICATE`. |
| Fila própria (mobile) | SQLite local com a fila gravada na mesma transação do dado, `clientMutationId` UUID v7 gerado na escrita, envio em ordem, espera crescente de 1 s a 60 s com variação, `Retry-After` do `429` e nova tentativa imediata ao reconectar. |
| PowerSync (mobile e API) | SDK `@powersync/react-native` 2.4.1 com `op-sqlite` 18.2.5; as escritas locais viram as mesmas mutações do `/sync/push` (o `clientMutationId` vai no `_metadata`); JWT RS256 e JWKS na API; serviço autohospedado em Docker com sync streams por aluno. |
| Teste de queda de rede | Script que repete 50 vezes por opção o cenário contra a API real, com a rede passando por um proxy TCP que recusa conexões (modo avião) ou derruba a conexão depois de o servidor gravar (resposta perdida). As séries gravadas são contadas no servidor. |

Em cada execução do teste, a rede cai antes de uma série sorteada e volta antes de outra (ou depois de finalizar); em metade das execuções, a resposta do primeiro envio depois de reconectar se perde. A semente é fixa (2026), então as duas opções passam pelos mesmos cortes.

## 2. Resultados

### Queda de rede: 50 execuções por opção

| Opção | Séries esperadas | Gravadas | Perdidas | Duplicadas | Sessões finalizadas | Fila vazia no fim | Requisições | Recusadas (modo avião) | Respostas perdidas | Tempo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fila própria | 1000 | 1000 | 0 | 0 | 50 de 50 | 50 de 50 | 804 | 50 | 27 | 21,0 s |
| PowerSync (só o envio) | 1000 | 1000 | 0 | 0 | 50 de 50 | 50 de 50 | 1368 | 241 | 27 | 25,8 s |

O script foi conferido com sabotagens de propósito, que ele acusou:
- **Id gerado no envio:** um cliente que gera o id da série na hora de enviar, e não na hora de gravar, deu 10 séries duplicadas em 20 execuções, uma por resposta perdida.
- **Sucesso falso:** um cliente que finge sucesso quando a rede falha deu 107 séries perdidas em 20 execuções.

### Outras verificações

- **Mesmo lote repetido:** enviado 10 vezes em sequência ou 10 vezes em paralelo, o lote de 22 mutações grava uma vez (1 sessão, 20 séries, 22 chaves); o caso paralelo ficou estável em 5 rodadas.
- **Modo avião no app:** com 20 séries registradas sem rede, a fila esvazia sozinha ao reconectar (teste do motor de envio e conferência contra a API real).
- **Falhas injetadas no envio do PowerSync:** sem rede, resposta perdida, resposta cortada e `500`; em todos os casos o reenvio não duplica.
- **Postgres para o PowerSync:** o papel de replicação, a publicação e o slot `pgoutput` funcionam com `wal_level=logical`, e as consultas dos sync streams batem com as colunas reais.

### O que não foi medido

- **O PowerSync de ponta a ponta:** o download pelo serviço e o SDK rodando no app. O ambiente usado não tinha Docker nem NDK do Android, e o SDK só roda no app nativo. A linha "PowerSync" da tabela mede só o caminho de envio, com o mesmo conector do app e uma fila com a regra do SDK (a transação só sai depois de `complete()`).
- **O modo avião em aparelho ou emulador**, para as duas opções.
- **Mais de um aparelho por aluno e mais de um aluno ao mesmo tempo.**

## 3. Comparação

| Critério | Fila própria | PowerSync |
| --- | --- | --- |
| Perdas e duplicatas (50 execuções) | 0 e 0 | 0 e 0 (só o envio) |
| Requisições no mesmo cenário | 804 | 1368 (+70%) |
| Dependências novas no app | nenhuma (`expo-sqlite` e NetInfo já existiam) | 2 nativas: `@powersync/react-native` e `@op-engineering/op-sqlite` (download de 115 MB) |
| Expo Go | funciona | não funciona; todo teste no aparelho exige build de desenvolvimento |
| Código do cliente no spike, sem testes | 463 linhas (fila, envio, espera, motor e chamada à API) | 263 linhas (schema, conector, tradução para o contrato e chamada à API), mais configuração |
| Código no servidor | `/sync/push` (295 linhas no serviço) | o mesmo `/sync/push`, mais JWT/JWKS e a configuração do serviço |
| Serviços a mais | nenhum | PowerSync e MongoDB (ou Postgres de buckets) |
| Postgres | qualquer | replicação lógica (`wal_level=logical`, papel e publicação) |
| Custo | nenhum além da API | Cloud gratuito com limites (abaixo) ou hospedagem de dois serviços a mais |
| Dependência de outros cards | nenhuma | autenticação (FT-10) antes do primeiro teste real |
| Leitura offline (download) | a construir: `GET /me/mesocycle/active` e `GET /sync/pull` (FT-31 e FT-35) | pronta: o serviço replica os dados do aluno para o aparelho |

**Custo e limites do PowerSync Cloud** (página de preços em 17/11/2026):
- **Plano gratuito:** 2 GB sincronizados por mês, 500 MB armazenados, 50 clientes simultâneos, e o projeto é desativado após 1 semana sem uso (outro trecho da página fala em 2 semanas).
- **Pro:** a partir de US$ 49/mês.
- **Edição autohospedada:** sem licença paga, mas exige hospedar o serviço e o MongoDB.

**Riscos do PowerSync observados no spike:**
- **Versões:** o SDK 2.4.1 aceita `op-sqlite` só até a 18.x, e a atual é a 19; a 18.2.5 teve de ser fixada à mão. O pacote declara testes com Expo 56 e React Native 0.85, e o projeto usa SDK 58 e 0.88.
- **Dois SQLite no app:** `op-sqlite` e `expo-sqlite`. O README do SDK cita conflito no iOS com `expo-updates`.
- **Replicação lógica na homologação:** a hospedagem escolhida no FT-3 (Render) só libera replicação lógica no plano Professional, com disco de 10 GB, por pedido ao suporte.
- **Regras duplicadas:** quem vê o quê fica nos sync streams, além da regra de posse da API, e as duas precisam andar juntas.
- **Recusa do servidor:** uma escrita recusada precisa encerrar a transação, senão a fila trava. A linha some do aparelho no checkpoint seguinte.

## 4. Decisão e justificativa

**Fila própria (outbox) com `POST /sync/push` idempotente.**

1. **A garantia vem do servidor nas duas opções.** O que impediu perdas e duplicatas nas 2.000 séries foi a chave `clientMutationId` gerada na escrita e conferida na mesma transação do efeito. O PowerSync não substitui o `/sync/push`: as escritas dele passam pelo mesmo endpoint. Na escrita, o ganho seria nulo.
2. **Menos tráfego e menos peças.** No mesmo cenário, a fila própria fez 41% menos requisições (804 contra 1368). Ela também não acrescenta serviços, dependências nativas nem exigência de replicação lógica.
3. **Custo e prazo.** A fila própria custa zero e não depende da autenticação (FT-10) nem de mudar o plano do Postgres de homologação. O plano gratuito do PowerSync desativa o projeto após uma semana parado, o que atrapalha um TCC com demonstrações espaçadas.
4. **Risco técnico menor.** A fila própria foi testada inteira no ambiente do projeto e roda no Expo Go. O PowerSync ficou com o build nativo e o modo avião sem verificar, sobre versões que o próprio pacote não declara testadas.

**O que se perde:** o download pronto do PowerSync. A leitura offline (ficha ativa e exercícios dela) passa a ser construída nos cards FT-31 e FT-35, com `GET /me/mesocycle/active` e `GET /sync/pull`.

**Quando rever:** se o produto passar a exigir offline em muitas áreas além do treino (chat, evolução, edição de ficha no app), o download pronto do PowerSync volta a pesar, e esta comparação deve ser refeita com o teste de ponta a ponta no aparelho.

## 5. Regras que o spike fixou para os cards de execução e sincronização

- **No app:**
  - o `clientMutationId` é gerado na escrita e gravado junto com o dado; nunca na hora de enviar (a sabotagem mostrou a duplicata);
  - a fila é enviada em ordem; se a primeira mutação ainda está esperando, nada passa na frente dela;
  - falha de rede, `5xx`, `408` e `429` mantêm a fila com espera crescente, e o `Retry-After` é respeitado;
  - `401` e `426` também mantêm a fila: sessão expirada ou app desatualizado não podem perder séries;
  - só `400`, `413` e `422` do lote inteiro recusam o lote de vez.
- **No servidor:**
  - cada mutação roda numa transação própria, com a chave e o efeito juntos;
  - uma recusa grava a chave como `REJECTED`, para o reenvio responder `DUPLICATE`;
  - `DEFERRED` não grava a chave, para a mutação voltar depois.

## 6. Escopo offline mínimo (versão 1)

**Funciona sem rede:**
- ver a ficha ativa, as sessões e os itens prescritos, e os exercícios usados nela (dados baixados ao abrir o app e a cada ativação de ficha);
- executar o treino: iniciar sessão, registrar, editar e apagar série, pular, trocar por alternativa aprovada, anotar exercício, finalizar e excluir sessão dentro da janela de 24 h;
- o resumo da sessão finalizada (volume, séries, duração), calculado no aparelho, sem nada de gamificação.

**Exige rede** (React Query com estado de "sem conexão"):
- cadastro, login e perfil;
- mensagens (envio e leitura) e notificações;
- gamificação: offline, o app mostra "sincronize para ver suas conquistas";
- evolução, histórico e anamnese;
- peso e medidas;
- arquivos.

**Consequências no contrato:**
- `MESSAGE_SEND` e `BODY_MEASUREMENT_ADD` continuam no `API.md`, mas o app da versão 1 não os coloca na fila; mensagens e medidas vão pelos endpoints REST com conexão.
- As sprints do mobile usam `START_SESSION` e `FINISH_SESSION`, e citam `GET /me/mesocycle`. O contrato é o do `API.md`: `SESSION_START`, `SESSION_FINISH` e `GET /me/mesocycle/active`.

## 7. Texto proposto para o ADR-005

> **ADR-005 · Sincronização offline da execução do treino**
> **Status:** aceito (spike FT-5, 17/11/2026).
> **Contexto:** o aluno executa o treino sem internet, e cada série precisa chegar ao servidor uma única vez, mesmo com quedas e reenvios.
> **Decisão:** fila de mutações própria no app (SQLite, `clientMutationId` UUID v7 gerado na escrita, envio em ordem com espera crescente) e `POST /sync/push` idempotente no servidor (chave e efeito na mesma transação). O offline da versão 1 cobre só a execução do treino.
> **Alternativa avaliada:** PowerSync. Descartado porque não elimina o endpoint de escrita, acrescenta dois serviços, replicação lógica e duas dependências nativas, fez 70% mais requisições no mesmo cenário e tem plano gratuito que desativa projetos parados.
> **Consequências:** o download da ficha para uso offline e o `GET /sync/pull` são construídos no projeto (FT-31 e FT-35). A decisão é revista se o offline precisar cobrir outras áreas.
> **Evidência:** `docs/spikes/sync.md`. Nas 50 execuções com queda de rede, 1000 de 1000 séries foram gravadas, sem perdas nem duplicatas.

## 8. Fontes

- [PowerSync: React Native e Expo SDK](https://docs.powersync.com/client-sdk-references/react-native-and-expo)
- [PowerSync: preços](https://www.powersync.com/pricing)
- [PowerSync: configuração do banco](https://docs.powersync.com/installation/database-setup)
- [PowerSync: Sync Streams](https://docs.powersync.com/sync/streams/queries)
- [PowerSync: exemplo de autohospedagem](https://github.com/powersync-ja/self-host-demo)
