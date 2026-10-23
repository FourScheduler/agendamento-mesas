# Fluxo e regras de negócio do MVP de mesas

Este documento descreve o fluxo aprovado e as regras de negócio do MVP de agendamento de mesas. Ele é a referência para implementação do backend; nenhum endpoint está implementado nesta etapa.

Parte do MVP: issue #1.

## Fluxo aprovado

1. Usuário informa a **data** desejada (reserva sempre de um dia inteiro).
2. Usuário consulta a **planta de mesas** (`GET /api/mesas`) e a **disponibilidade da data** (`GET /api/mesas/disponiveis?data=...`).
3. Usuário seleciona uma mesa **LIVRE**, **ativa** e sem reserva na data.
4. Usuário **revisa** o resumo (mesa, data e solicitante).
5. Usuário **autentica** quando ainda não estiver logado (`POST /api/auth/login`).
6. Usuário **confirma**: criação da reserva em estado `PENDENTE` (`POST /api/reservas`) e confirmação (`POST /api/reservas/{id}/confirmacao`).
7. Usuário **consulta** suas reservas (`GET /api/reservas/minhas`) e pode **cancelar** a qualquer momento (`PATCH /api/reservas/{id}/cancelamento`).

Todas as rotas, inclusive a consulta, exigem token de autenticação. Sem token a resposta é `401`.

## Modelo de mesa

**Mesa** é uma estação individual de trabalho, identificada por **código** único (ex.: `001`). Cada mesa possui:

| Atributo | Descrição |
| --- | --- |
| Código | Identificador único da mesa, ex.: `001` a `115`. |
| Localização | Região onde a mesa está física. No MVP de demonstração, todas na região `PAULISTA`. |
| Tipo | `LIVRE` (disponível para reserva por qualquer usuário) ou `FIXA` (designada a pessoa fixa; não aparece em disponibilidade e não pode ser reservada por usuário comum). |
| Estado ativo | Mesa inativa não aparece na planta nem pode ser reservada. |
| Referência visual | Posição aproximada na planta, usada apenas para desenho no frontend. Não define regra de negócio. |

Somente o **administrador** alterna o tipo `FIXA`/`LIVRE` de uma mesa (`PATCH /api/admin/mesas/{id}/tipo`).

## Regras de negócio confirmadas

| # | Regra | Decisão |
| --- | --- | --- |
| 1 | Unidade de reserva | Dia inteiro. Não existem horários de início/fim no contrato. |
| 2 | Dias permitidos | Segunda a sexta. Fim de semana não aceita reserva (`400`). |
| 3 | Antecedência máxima | Até 15 dias corridos a partir de hoje (`400` fora da janela). |
| 4 | Antecedência mínima | Reservar para hoje é permitido. |
| 5 | Sobreposição da mesma mesa | Uma mesa não pode ter duas reservas não canceladas na mesma data (`409`). |
| 6 | Reservas do mesmo usuário | O usuário não pode ter duas reservas não canceladas na mesma data (`409`). Pode ter reservas em datas diferentes, inclusive na mesma mesa. |
| 7 | Dias consecutivos | Períodos consecutivos são permitidos (dois dias seguidos na mesma mesa ou pelo usuário). |
| 8 | Cancelamento | O dono pode cancelar a qualquer momento, mesmo depois do início do dia reservado. Cancelamento libera a mesa. |
| 9 | Solicitante | Vem do contexto autenticado (token). Não é campo editável do request. |
| 10 | Autenticação | Login local com e-mail e senha (hash BCrypt). Token JWT em `Authorization: Bearer`. |
| 11 | Estados da reserva | `PENDENTE`, `CONFIRMADA` e `CANCELADA`. |
| 12 | Confirmação | Criação gera `PENDENTE`; a confirmação explícita torna `CONFIRMADA`. Evita criação acidental e cobre o passo "revisar → confirmar" do fluxo. |
| 13 | Mesas fixas | Tipo `FIXA` não aparece em `/api/mesas/disponiveis` e gera `409` na tentativa de reserva. |

## Regra de sobreposição: adaptação de `[início, fim)`

A decisão original previa intervalos `[início, fim)`, em que períodos consecutivos são permitidos e sobreposição da mesma mesa não é. Como o MVP adotou **reserva de dia inteiro**, o intervalo da reserva passa a ser o dia completo (`[00:00, 24:00)` do dia reservado) e a regra se traduz em:

- Sobreposição existe quando duas reservas **não canceladas** da mesma **mesa** têm a **mesma data**.
- Dois dias consecutivos nunca se sobrepõem; a reserva do dia `D` não impede a reserva do dia `D+1`.
- Reserva `CANCELADA` não bloqueia mesa nem usuário.

Se o produto evoluir para horários por turno, a semântica `[início, fim)` (meio-aberto) volta a valer; registrar isso como decisão de produto antes de implementar.

## Datas, horários e fuso

- Fuso horário único do sistema: **`America/Sao_Paulo`** (sem horário de verão vigente).
- Datas de reserva são enviadas e retornadas como **data local sem offset**, no formato ISO `yyyy-MM-dd` (ex.: `2026-10-28`).
- Campos de data/hora (criação, confirmação, cancelamento) usam data/hora local sem offset, no formato ISO `yyyy-MM-dd'T'HH:mm:ss` (ex.: `2026-10-23T14:30:00`).
- Regras de "hoje", janela de 15 dias e dia útil são avaliadas no fuso `America/Sao_Paulo`, nunca no fuso do servidor nem no do cliente.
- O contrato não usa offset (`-03:00`) para manter o payload simples e porque o fuso é fixo e único.

## Decisões pendências de negócio

Registradas para validação com o negócio. **Nenhuma restrição foi inventada** para os itens abaixo; enquanto não decididos, o backend não deve implementá-los:

| Pendência | Situação atual |
| --- | --- |
| Tempo de expiração de reserva `PENDENTE` | Sem prazo definido. Uma `PENDENTE` bloqueia a mesa e o usuário até confirmar ou cancelar. Se definido, o estado volta a ficar disponível automaticamente. |
| Interpretação da janela de 15 dias | Adotado "15 dias corridos". Se o negócio quiser "15 dias úteis", ajustar a regra. |
| Horário de expediente de referência | Sem validação de expediente no MVP (regra aprovada). Exibição de expediente futuro fica pendente. |
| Feriados e recesso | Não tratados. Reserva em feriado local é aceita se cair em dia útil. |
| Tornar `FIXA` uma mesa com reservas futuras | Efeito sobre reservas existentes não definido; a implementação deve validar com o produto antes de alterar dados reais. |
| Papel de administrador além dos endpoints do MVP | Gestão de usuários (criar/desativar) fora do MVP; seed no banco. |
| Cancelamento por administrador de reserva com dia já passado | Permitido pela regra "a qualquer momento"; se o negócio quiser restrição, registrar decisão. |

## Fora do escopo do MVP

Microsoft Graph, Outlook, SSO/Entra ID e provedores de IA ficam fora desta entrega (decisão aprovada). Não há integração externa obrigatória.

## Artefatos relacionados

- [Contratos da API](contratos-api-mvp.md)
- [Modelo de dados e demonstração](modelo-dados-mvp.md)
- [Cenários de teste](testes-mvp.md)
