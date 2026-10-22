# Proposta funcional — Avisos de convocação e agendamento por função

**Estado:** requisito do PO registrado em 22/10/2026, sujeito a detalhamento e aceite funcional. **Não implementado por esta PR.** Prioridade de produto: lote 4 (Operação e públicos), com integração às jornadas do lote 2 (Agenda/Convocações). Não confundir a inscrição push do dispositivo existente com entrega de alertas completos.

## Necessidade

O usuário deve receber avisos de agendamentos e convocações que realmente lhe digam respeito **pela função institucional que exerce**, respeitando território, vínculos, convites nominais, organização e as permissões do backend. Evitar avisos genéricos sobre reuniões fora de seu escopo.

## Comportamentos propostos para aprovação

1. Ao existir uma nova convocação aplicável à função do membro, apresentar aviso curto e contextual ao usuário autenticado (pop-up/toast/aviso dentro da aplicação); oferecer abertura do evento/convocação correspondente.
2. Atualização ou cancelamento relevante de compromisso já vinculado ao usuário deve produzir novo aviso coerente com o estado atual.
3. Atribuição ou remoção de função/vínculo altera elegibilidade para **novos** avisos, conforme regras da agenda, evitando perda indevida de histórico.
4. A resposta RSVP continua feita na jornada de convocação e observa as permissões e prazos já existentes; o aviso não confirma automaticamente presença.
5. Impedir duplicações repetitivas, limitar interrupções e preservar acesso posterior a avisos importantes (a definir se haverá central persistente).
6. Não expor nomes/dados sensíveis ou conteúdo privado a perfis sem autorização; convites nominais externos seguem regras próprias.
7. Separar dois canais distintos: **alerta dentro do sistema** quando conectado (escopo mínimo requerido) e **push no navegador/PWA** quando fora da aplicação (necessita aceite específico, consentimento do dispositivo e infraestrutura).

## Critérios de aceite a detalhar

- Matriz de disparos: novo evento por função, nova convocação, mudança de horário/local, cancelamento, remoção de convocação e resposta do usuário.
- Destinatários: função, território, múltiplas funções, pessoas nominalmente convocadas, exclusão de não elegíveis.
- Experiência: desktop/mobile, PWA, acessibilidade, ações de abrir/dispensar, persistência, frequência e deduplicação.
- Segurança: servidor determina destinatários; cliente não pode inferir dados de outros membros; logs minimizados.
- Testes: evento de função certa vs errada; usuário sem vínculo; múltiplos vínculos; mudança/cancelamento; usuário offline; alterações de permissão; sessão expirada.

## Dependências e decisão

Épico funcional independente, a ser refinado e estimado antes da implementação. O redesenho Stitch do lote 4 deve incluir estados de Avisos; a integração na agenda deve ser alinhada ao lote 2.

**Perguntas de produto para Gate funcional futuro:** pop-up apenas enquanto usuário está na aplicação ou também notificação push quando fechada? Persistência em uma Central de Avisos? Preferências/silenciamento? Prazos e repetição? Não assumir essas decisões antes do PO.
