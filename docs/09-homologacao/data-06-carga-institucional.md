# DATA-06 — Carga institucional da Regional São Paulo

## Objetivo

Preparar a carga inicial da estrutura institucional e do pré-cadastro ministerial sem versionar dados pessoais no repositório e sem executar alterações no D1 de produção antes da autorização do PMO.

## Escopo da carga preparada

Totais esperados na base saneada atual:

- 14 Setores atuais;
- 495 Casas de Oração com código BR válido;
- 11 GTs Regionais homologados;
- 392 pré-cadastros ministeriais;
- 212 participações de GT atualmente conciliadas.

Os totais devem ser novamente conferidos imediatamente antes da execução real, pois a planilha operacional pode receber substituições de representantes de GT.

## Ordem obrigatória

1. migrations do banco, incluindo `0019_pre_cadastro_ministerial.sql` e `0020_participacoes_gt.sql`;
2. Regional e Administração reais já existentes/confirmadas;
3. Setores;
4. Casas;
5. GTs Regionais;
6. pré-cadastros ministeriais;
7. participações dos GTs;
8. validação pós-carga.

A ordem é importante por causa das chaves estrangeiras e dos gatilhos de integridade.

## Regras ratificadas

- somente códigos de Casa `BR` ativos entram na carga operacional;
- registros `XX` são históricos/inativos e não entram;
- Ponte Pequena: `XX 21-0822` é histórico; `BR-21-1672` é o código vigente;
- `BR-21-0008 — BRÁS` pertence ao Setor Brás para efeito da Agenda, ainda que a base de origem administrativa o associe a Centro;
- Lapa permanece um único Setor; JD. Mangalot e Perus são referências de futura segregação;
- Freguesia do Ó permanece um único Setor; Cachoeirinha e Jaraguá são referências de futura segregação;
- GTs pertencem exclusivamente à Regional;
- o Setor aparece na participação do representante do GT, não como escopo do GT;
- nomes divergentes não são associados automaticamente;
- telefone só é complementar ao pré-cadastro quando a conciliação de pessoa é inequívoca;
- conflito de telefone não deve escolher número automaticamente.

## Dados pessoais

Os arquivos contendo nomes, telefones e participações reais não devem ser adicionados ao GitHub.

Podem ser versionados:

- migrations;
- código de importação genérico;
- testes com dados sintéticos;
- documentação;
- estrutura territorial sem dados pessoais, mediante decisão do PMO.

## Idempotência

A carga deve usar IDs determinísticos e `INSERT OR IGNORE` apenas quando a repetição exata puder ser considerada segura.

A simples presença de `INSERT OR IGNORE` não deve mascarar divergências. Antes da execução é obrigatório verificar:

- mesmo código de Casa associado a nome diferente;
- mesmo ID determinístico associado a outro escopo;
- GT fora da Regional;
- representante em Setor de outra Regional;
- pré-cadastro apontando para Casa inexistente.

## Pré-validação mínima

Antes da carga real:

- migrations aplicadas em banco descartável;
- script executado uma primeira vez;
- script executado novamente para provar idempotência;
- contagens comparadas com a base saneada;
- zero violações de FK;
- zero violações dos triggers de GT;
- zero códigos `XX` na carga;
- `BR-21-0008` confirmado no Setor Brás;
- `BR-21-1672` presente e `BR-21-0822` ausente;
- exceções de nomes/telefones mantidas fora da automação.

## Execução em produção

A carga no D1 remoto requer autorização explícita do PMO.

Antes disso, substituir e conferir os identificadores reais de:

- `REGIONAL_ID`;
- `ADMINISTRACAO_ID`.

Nunca usar automaticamente a Administração demonstrativa como destino da carga real.

## Rollback

Como a carga inicial será executada em blocos separados, cada bloco deve ser validado antes do próximo. Em caso de divergência, interromper a carga e corrigir o script de origem; não corrigir dados reais manualmente em série sem registrar a causa.

## Teste automatizado

`carga-institucional.spec.ts` cobre:

- reaplicação idempotente com IDs determinísticos;
- integridade de GT Regional;
- segregação Regional do representante;
- unicidade da participação ativa;
- dependência correta da estrutura territorial.
