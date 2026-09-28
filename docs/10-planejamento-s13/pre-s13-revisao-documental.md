# Revisão Documental Pré-S13

Este documento registra o status da governança, versionamento e documentação do repositório antes do início oficial da S13, identificando defasagens e planejando as devidas atualizações.

---

## 1. Status de Versão e Repositório

| Artefato | Observação / Divergência | Classificação |
| :--- | :--- | :--- |
| **APP_VERSION (package.json e código)** | `0.0.1` nos `package.json`, porém `0.0.1-s11` no `wrangler.toml` e `0.0.1-s12` injetado na `index.ts`. O esperado era `0.0.1-s12`. | **REPORTADO** (Divergência técnica estática: wrangler.toml desatualizado em relação à constante interna da S12). |
| **Estrutura de Branches** | Branch atual `feature/s12-relatorios-auditoria` não sofreu merge para `develop` ainda. | **Corrigir antes da S13** (Exige o rito de fechamento S12) |
| **Arquivos Scratch** | Presença maciça de rascunhos técnicos na pasta `/scratch`. | **Histórico Legítimo** (Não afeta build, mas polui se não limpo a longo prazo) |

---

## 2. Status das Sprints (S00-S12) no README

| Artefato | Observação / Divergência | Classificação |
| :--- | :--- | :--- |
| **README.md (Sprints Consolidadas)** | O README menciona consolidação apenas de S00 a S06 ("Fundação técnica, modelo institucional..."). | **Executar após conclusão/merge da S12 e antes da abertura operacional da S13** |
| **Status Oficial** | Faltam registros documentais formais no README do status das funcionalidades S07 a S12. | **Executar após conclusão/merge da S12 e antes da abertura operacional da S13** |

---

## 3. ADRs e Decisões Arquiteturais

| Artefato | Observação / Divergência | Classificação |
| :--- | :--- | :--- |
| **ADR-001 (Autenticação)** | Mencionado no README, porém a política de retenção/localStorage está prestes a mudar na S13 (Cookie HttpOnly). | **Corrigir durante S13** (Criar ADR-002 ou revisar ADR-001 com a nova diretriz de Cookie/KV/D1). |
| **Migrations** | As migrations passadas não possuem um README de histórico. Elas vivem isoladas no código. | **Sem problema** (Drizzle gerencia bem o histórico via hashes, mas seria bom um log humano) |

---

## 4. Nomenclaturas e Funções Canônicas

| Artefato | Observação / Divergência | Classificação |
| :--- | :--- | :--- |
| **Regras de Escopo** | O schema.ts é restrito a contenções `regional`, `administracao`, etc. A documentação (docs/03-modelo-dados) precisa refletir fielmente o ACL de auditoria feito na S12. | **Corrigir durante S13** |
| **Funções Canônicas** | `GESTOR_RELATORIOS`, `AUDITOR_SISTEMA`, `OPERADOR_PORTARIA` agora definem limites verticais rígidos. A wiki (04-seguranca-lgpd) provavelmente não prevê essas roles novas ou a restrição estrita implementada no C3-C10. | **Corrigir antes da S13** (O PMO deve alinhar a documentação formal de roles) |
| **Documentação de Portaria (S11)** | Carece de detalhamento explícito sobre fail-closed na API nos documentos estáticos (apenas consta em testes e PRs). | **Sem problema** (O código provê documentação viva confiável) |
| **Documentação de Auditoria (S12)** | Não existe um manual de usuário ou guia de integração da tabela `auditoria_logs` nos docs principais. | **Corrigir durante S13** |

---

## 5. Avaliação de Risco Técnico Documental

| Artefato | Observação / Divergência | Classificação |
| :--- | :--- | :--- |
| **Documentação de Autenticação / LGPD** | Os documentos atuais do `docs/04-seguranca-lgpd/` ainda podem prever o celular como "dado padrão" em relatórios. A S13 impõe minimização estrita e bloqueio brute-force. | **Corrigir durante S13** (Crucial para não ter política de privacidade mentirosa). |
| **Arquivos Obsoletos / Referências Antigas** | Algumas regras antigas de "token JWT stateless" podem ainda figurar soltas nas issues velhas. | **Histórico Legítimo** |
| **Divergência Código x Documento** | A política de sessão inativa >12h não existe no código ainda, mas precisa entrar na documentação do sistema assim que aprovada. | **Corrigir durante S13** |

---

## Conclusão da Revisão
A estrutura de arquivos do projeto está saudável e o código (`apps/*`) reflete boa coesão de governança. No entanto, a documentação passiva (pasta `/docs` e o `README.md`) ficou estagnada na S06.

**Recomendação para a S13:**
Reservar um ticket de "Dívida Técnica Documental" para atualizar a wiki corporativa (`/docs`), equalizando as S07-S12 e cravando as definições protocolares aprovadas pelo PMO. Não é um impeditivo para início da codificação.
