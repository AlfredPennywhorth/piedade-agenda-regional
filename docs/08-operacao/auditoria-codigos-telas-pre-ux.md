# Auditoria pré-UX dos códigos de tela — issue #247

**Fontes:** inventário canônico `docs/inventario-codigos-telas.md`, referência auxiliar `docs/screen-codes.md` e navegação em `apps/web/src/App.tsx` na branch `develop`. **Preservar códigos já publicados; não renumerar.**

## Situação confirmada

O inventário canônico já define códigos estáveis para telas principais e **subtelas AGD-ADM-016–059** (Eventos, Séries, Convocações, cadastros administrativos, Funções, Vínculos e Locais), com códigos já utilizados nos componentes. Entre as telas principais:
- AGD-MOB-001 Minha Agenda; AGD-MOB-002 Calendário.
- AGD-ADM-001 Gestão de Eventos; AGD-ADM-002 Séries; AGD-ADM-013 Locais; AGD-ADM-014 Convocações.
- AGD-SHR-001 Meu Cadastro; AGD-SHR-002 Login; AGD-SHR-003 Ativação; AGD-SHR-004 Recuperação de PIN.

`App.tsx` possui componente `PublicScreenCode`, que apresenta o identificador na interface.

## Lacuna entre inventário e requisito #247

A documentação canônica já cobre uma parte significativa das superfícies CRUD; **não repetir nem renumerar essas entradas**. O próprio `docs/inventario-codigos-telas.md` identifica como pendentes as superfícies não inventariadas de Séries, Convocações, Administração, Portaria, Relatórios, Meu Cadastro e demais módulos, bem como diálogos de confirmação, fluxos públicos e variantes compartilhadas. Essa lista é ponto de partida para auditoria de cobertura real, não indicação de que os códigos 016–059 estejam ausentes.

## Plano de auditoria completa sem alterações funcionais

1. Inventariar, por componente, abas, modais, drawers, detalhes, formulários de criação/edição/inativação e diálogos de confirmação.
2. Registrar nome, código canônico existente (quando houver), eventual código **novo** apenas para superfície ainda não catalogada, rota/aba, componente e cobertura visual.
3. Verificar duplicidade e estabilidade dos códigos em testes e documentação.
4. Reservar identificadores específicos para superfícies ainda sem código.
5. Na futura rodada UX, aplicar identificadores discretos e testes de navegação sem modificar regras de autorização.

**Não marcar #247 como concluída nesta PR:** a atribuição exaustiva de códigos a subtelas e os testes visuais ainda dependem da implementação UX.
