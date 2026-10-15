# Auditoria pré-UX dos códigos de tela — issue #247

**Fonte:** `docs/screen-codes.md` e composição de navegação em `apps/web/src/App.tsx` na branch `develop`.

## Situação confirmada

O inventário já define códigos estáveis para as principais abas administrativas e mobile, incluindo:
- AGD-MOB-001 Minha Agenda; AGD-MOB-002 Calendário.
- AGD-ADM-001 Gestão de Eventos; AGD-ADM-002 Séries; AGD-ADM-013 Locais; AGD-ADM-014 Convocações.
- AGD-SHR-001 Meu Cadastro; AGD-SHR-002 Login; AGD-SHR-003 Ativação; AGD-SHR-004 Recuperação de PIN.

`App.tsx` possui componente `PublicScreenCode`, que apresenta o identificador na interface.

## Lacuna entre inventário e requisito #247

A regra atual do inventário prevê código próprio de modal **somente quando tratado como superfície independente**. A issue #247 exige código próprio para cada subtela operacional e formulário CRUD com estado/ação distinta. Portanto, o inventário existente não é suficiente para encerrar a issue.

## Plano de auditoria completa sem alterações funcionais

1. Inventariar, por componente, abas, modais, drawers, detalhes, formulários de criação/edição/inativação e diálogos de confirmação.
2. Registrar nome, código atual, código futuro proposto, rota/aba, componente e situação da cobertura visual.
3. Verificar duplicidade e estabilidade dos códigos em testes e documentação.
4. Reservar identificadores específicos para superfícies ainda sem código.
5. Na futura rodada UX, aplicar identificadores discretos e testes de navegação sem modificar regras de autorização.

**Não marcar #247 como concluída nesta PR:** a atribuição exaustiva de códigos a subtelas e os testes visuais ainda dependem da implementação UX.
