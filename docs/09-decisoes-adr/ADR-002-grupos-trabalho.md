# ADR-002 — Modelagem dos Grupos de Trabalho

**Data original:** 2026-08-31  
**Revisão PMO:** 2026-09-22  
**Status:** REVISADO E RATIFICADO

## Contexto

A modelagem inicial permitia que um Grupo de Trabalho pertencesse a Regional, Administração ou Setor. Essa hipótese foi substituída por uma regra institucional mais recente.

## Regra vigente

Os Grupos de Trabalho da Piedade são **exclusivamente Regionais**.

Cada Setor pode indicar representantes para cada GT Regional. A representação setorial não transforma o GT em um GT de Setor.

Exemplos:
- GT Fundo Musical — Regional São Paulo;
- Setor Carrão — responsável e/ou suplente no GT Fundo Musical;
- Setor Centro — responsável e/ou suplente no mesmo GT Fundo Musical.

## Consequências de modelagem

A tabela `grupos_trabalho` permanece compatível com o histórico estrutural, mas os novos GTs institucionais homologados devem utilizar somente:
- `regional_id` preenchido;
- `administracao_id = NULL`;
- `setor_id = NULL`.

A participação passa a ser representada pela tabela `participacoes_grupos_trabalho`, contendo:
- GT Regional;
- Setor representado;
- pré-cadastro ministerial da pessoa;
- papel `RESPONSAVEL` ou `SUPLENTE`;
- situação de mensageria, quando disponível;
- situação ativa/inativa.

O vínculo é feito inicialmente ao **pré-cadastro ministerial**. Quando o registro ministerial for finalizado como membro, a identidade operacional é resolvida pelo `membro_id` já associado ao pré-cadastro, evitando duplicação de pessoa.

## Integridade

A migration DATA-05 aplica proteção no banco para:
1. impedir nova participação em GT que não seja Regional;
2. impedir representação por Setor pertencente a outra Regional;
3. limitar o papel a `RESPONSAVEL` ou `SUPLENTE`;
4. impedir duplicidade ativa da mesma pessoa/papel no mesmo GT e Setor.

## Dados complementares de telefone

Bases operacionais de GT podem trazer telefone celular mesmo quando a exportação ministerial não possui esse dado.

Esse telefone pode preencher `celular_referencia` no pré-cadastro somente quando houver conciliação inequívoca do nome com o cadastro ministerial. Nome abreviado, incompleto, divergente ou ambíguo não autoriza atualização automática.

O telefone de referência não cria conta, não substitui o número da carteirinha e não finaliza o cadastro de membro.

## Dados que não são identidade

Campos como:
- Grupo ZAP;
- ZAP;
- Convidado;
- SIM/NÃO;
- Assinatura;

são informações operacionais e não devem participar do algoritmo de identidade da pessoa.

## Regra para importação

A linha de origem possui um contexto comum:
- Setor;
- Grupo de Trabalho.

Esse contexto vale para:
- Diácono responsável + telefone principal;
- Suplente + contato.

Portanto, uma linha pode gerar zero, um ou dois registros de participação, conforme a conciliação dos nomes com o pré-cadastro ministerial.

Registros sem conciliação segura devem ser enviados para relatório de exceções e não importados automaticamente.
