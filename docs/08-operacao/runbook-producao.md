# Runbook de liberação para produção

> Gate operacional S13.07. Nenhum passo de produção deve ser executado sem autorização expressa do PMO.

## 1. Pré-condições

Antes de promover `develop → main`:

- BETA-01 (#56) sem pendência crítica;
- S13.01 (#159) consolidada;
- CI verde no SHA candidato;
- nenhuma PR corretiva P0 pendente;
- migrations novas identificadas;
- ponto de restauração/backup do D1 de produção verificado;
- secrets/vars do ambiente `production` configurados.

## 2. Configuração exigida no GitHub Environment `production`

### Variables

- `CLOUDFLARE_ACCOUNT_ID`
- `PROD_API_URL` — HTTPS e terminando em `/api/v1`

### Secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_D1_DATABASE_ID`
- `PIN_PEPPER`
- `MASTER_BOOTSTRAP_SECRET`

Nenhum valor de secret deve ser colocado em issue, comentário, log manual ou documentação.

## 3. Promoção

1. Confirmar SHA homologado de `develop`.
2. Abrir PR `develop → main`.
3. Reconfirmar CI e diff.
4. Fazer merge somente após autorização expressa do PMO.
5. Registrar o merge commit de `main` como SHA candidato de produção.

## 4. Worker Produção

Executar o workflow **Deploy Worker — Produção** a partir de `main`.

Entradas obrigatórias:

- `confirm_release = true`;
- `confirm_backup = true`.

O workflow deve:

1. validar que está em `refs/heads/main`;
2. validar vars/secrets essenciais;
3. materializar o ID do D1 produção;
4. aplicar migrations;
5. publicar o Worker com `--env production`;
6. configurar `PIN_PEPPER`;
7. configurar `MASTER_BOOTSTRAP_SECRET`.

Se qualquer etapa falhar, **não iniciar Pages Produção** até entender o estado do Worker e do banco.

## 5. Smoke do Worker

Antes do frontend:

- `/health`;
- login de conta de homologação autorizada;
- `/auth/me`;
- verificação de CORS somente para origem de produção;
- operação administrativa simples compatível com o perfil;
- confirmar ausência de erro de migration.

Não registrar token, PIN, telefone real ou outro dado pessoal em evidências públicas.

## 6. Pages Produção

Executar **Deploy Pages — Produção** a partir de `main`, somente após o Worker do mesmo SHA concluir com sucesso e o smoke do Worker ser aprovado, com:

- `confirm_release = true`;
- `confirm_worker_smoke = true`.

O workflow:
- compartilha o grupo de concorrência `production-release` com o Worker, impedindo execução simultânea;
- consulta os runs do workflow **Deploy Worker — Produção**;
- exige um run `workflow_dispatch` concluído com sucesso no mesmo `github.sha`;
- valida `PROD_API_URL`;
- gera o bundle usando essa API;
- publica a branch `main` do projeto Pages.

## 7. Smoke pós-produção

Executar no mínimo:

1. abrir frontend de produção;
2. login;
3. `Meu Cadastro`;
4. agenda;
5. navegação conforme perfil;
6. Contas e Acessos com usuário administrativo autorizado;
7. Portaria;
8. relatórios;
9. logout e novo login.

Registrar apenas resultado, SHA e horário; não publicar dados pessoais.

## 8. Rollback de código

Se o problema for somente código/frontend:

1. interromper novos deploys;
2. identificar o último merge commit estável em `main`;
3. reverter em Git o commit defeituoso por PR de rollback;
4. exigir CI verde;
5. redeployar Worker e/ou Pages conforme o componente afetado.

Não forçar `main` para trás e não reescrever histórico.

## 9. Rollback de banco

Migration D1 é tratada como operação separada do rollback de código.

Se uma migration causar dano:

1. interromper escrita sempre que operacionalmente necessário;
2. não tentar “desaplicar” SQL manualmente sem plano validado;
3. utilizar o ponto de restauração/backup verificado antes do deploy;
4. reconciliar o código com o estado restaurado;
5. executar smoke antes de reabrir operação.

A existência e a verificabilidade do ponto de restauração são condição para marcar `confirm_backup = true`.

## 10. Critério de conclusão

A produção só é considerada liberada após:

- Worker Produção verde;
- Pages Produção verde;
- smoke pós-produção concluído;
- SHA de produção registrado na issue S13.07;
- nenhuma falha P0 aberta.
