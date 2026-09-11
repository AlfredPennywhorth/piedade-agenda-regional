# Checklist de Encerramento S12 — Relatórios e Auditoria

Este documento estabelece o procedimento formal, seguro e audível para finalizar a Sprint S12 e autorizar o início da S13. Nenhuma etapa deve ser ignorada.

---

## 1. Critérios de Validação (Pré-Merge)
- [ ] 1. Todos os Cenários de Homologação (C1 a C10-B) testados manualmente e aprovados (status `PASS`). Importante que o C10-B ateste a geração real e orgânica dos logs pela aplicação.
- [ ] 2. Esteira de Integração Contínua (CI) completamente verde no HEAD atual da branch `feature/s12-relatorios-auditoria`.
- [ ] 3. Pull Request (PR #16) aberta, aprovada na revisão de código e com status `Mergeable` (sem conflitos).
- [ ] 4. Revisão estrutural do PMO concluída.
- [ ] 5. Ausência confirmada de blockers técnicos ou impeditivos de negócio.
- [ ] 6. Toda documentação (diagramas, wikis de API) atualizada conforme implementações da S12.
- [ ] 7. Scripts de banco (`migrations`) duplamente checados contra perdas de dados destrutivas acidentais.
- [ ] 8. Variável/Constante `APP_VERSION` devidamente atualizada (se aplicável ao workflow de release).
- [ ] 9. Verificação de sujeira: Nenhum arquivo `.sql` ou `.md` da pasta `scratch/` ou arquivos com chaves/senhas reais foi acidentalmente commitado.
- [ ] 10. `git status` da branch local indicando `working tree clean`.
- [ ] 11. Branch de feature local perfeitamente sincronizada com a origin no GitHub.
- [ ] 12. Evidências de homologação (prints, vídeos, payloads) devidamente capturadas e anexadas ao card da sprint ou PR.
- [ ] 13. Autorização formal expressa e assinada (ou aprovada via ferramenta) do PO para merge.

---

## 2. Condições de Execução e Aborto

### 🟢 GO (Critério de Sucesso)
* Todas as 13 checkboxes acima marcadas.
* Nenhuma regressão detectada em funcionalidades críticas.
* Merge sem conflitos habilitado no GitHub.

### 🔴 NO-GO (Condição de Aborto)
* Qualquer teste C1-C10 falhar ou revelar falso-positivo.
* CI/CD quebrado no último minuto (lint, typecheck, unit).
* Conflito inesperado com atualizações urgentes injetadas em `develop` por terceiros.
* Perda de token/sessão ou vulnerabilidade grave identificada tardiamente.

### 🔄 Procedimento de Rollback (Se o merge falhar ou corromper)
1. **Evitar o merge forçado:** Se houver conflito complexo, NÃO tente resolver na tela do GitHub.
2. **Desfazer localmente:** Se o merge local para `develop` quebrar testes, use `git merge --abort`.
3. **Reverter em develop (Se merge já enviado):** Se a regressão for notada logo após push em `develop`, criar PR de reversão baseada no commit anterior: `git revert -m 1 <sha-do-merge>`.

---

## 3. Comandos Git Sugeridos (Guia de Referência)
*(ATENÇÃO: Não execute os comandos sem garantir as pré-condições).*

**Preparação e Verificação:**
```bash
# Conferir status limpo e branch atual
git status

# Garantir que tem as últimas atualizações
git fetch origin

# Verificar se não há arquivos scratch adicionados indevidamente
git diff --name-only origin/develop
```

**Integração (Se feito localmente ao invés da UI do GitHub):**
```bash
# 14. Ir para a branch develop
git checkout develop

# Garantir develop limpa e atualizada
git pull origin develop

# Executar o merge preservando histórico (no-ff)
git merge --no-ff feature/s12-relatorios-auditoria -m "Merge branch 'feature/s12-relatorios-auditoria' into develop"

# Subir a integração
git push origin develop
```

**Pós-Merge e Sincronização:**
```bash
# 15. Capturar o SHA do merge para documentação
git log -1 --format="%H"

# 16. Garantir atualização
git pull origin develop
```

---

## 4. Rito de Passagem

- [ ] **14.** Merge realizado com sucesso em `develop` (via GitHub ou CLI local).
- [ ] **15.** SHA do merge capturado e registrado nos logs do PMO.
- [ ] **16.** Ambiente local atualizado na branch `develop`.
- [ ] **17.** **ENCERRAMENTO FORMAL DA S12:** Etiqueta S12 movida para `DONE`.
- [ ] **18.** **AUTORIZAÇÃO DA S13:** Luz verde do PO/PMO para iniciar ativamente a programação e criação de branches baseadas no backlog preparado da S13.
