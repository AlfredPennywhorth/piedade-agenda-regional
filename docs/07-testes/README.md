# Testes

Este diretório contém a documentação da estratégia de testes do projeto **Agenda Regional São Paulo**.

## Pirâmide de testes

```
        [E2E — Playwright]
      [Integração — Vitest]
  [Unitários — Vitest (maioria)]
```

## Ferramentas

| Ferramenta | Uso |
|---|---|
| Vitest | Testes unitários e de integração (web + worker + shared) |
| @testing-library/react | Testes de componentes React |
| Playwright | Testes E2E (chromium) |

## Cobertura esperada

- Pacote `shared`: 100% de cobertura de schemas e utilitários
- Worker (rotas): cobertura de todos os endpoints
- Web (componentes críticos): fluxos de ativação, acesso e convocação

## Dados de teste

> **Segurança**: Utilizar APENAS dados sintéticos nos testes.
> CPF: usar gerador de CPF válido sintético.
> Celular: usar série 99999-XXXX ou similar não-real.

## Comandos

```bash
pnpm test              # Todos os testes (unitários)
pnpm test:e2e          # E2E com Playwright (apps/web)
pnpm --filter @piedade/worker test   # Worker apenas
pnpm --filter @piedade/web test      # Web apenas
pnpm --filter @piedade/shared test   # Shared apenas
```

## Resultado S00

| Suite | Testes | Status |
|---|---|---|
| shared | 7 | ✅ Passando |
| worker | 4 | ✅ Passando |
| web | 2 | ✅ Passando |

> **Status:** Framework de testes configurado. Casos de negócio aguardam Sprint S01.
