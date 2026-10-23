# Cenários de teste do MVP de mesas

Cenários que o backend deve cobrir com testes automatizados. Cada cenário referencia a regra em [fluxo-mvp](fluxo-mvp.md) e o contrato em [contratos-api-mvp](contratos-api-mvp.md).

## Datas inválidas (`400`)

| # | Cenário | Request | Esperado |
| --- | --- | --- | --- |
| 1 | `data` ausente | `GET /api/mesas/disponiveis` sem query | `400` |
| 2 | `data` malformada | `GET /api/mesas/disponiveis?data=28-10-2026` | `400` |
| 3 | Data em sábado | `GET /api/mesas/disponiveis?data=<sábado>` | `400` com "segunda a sexta" |
| 4 | Data em domingo | `GET /api/mesas/disponiveis?data=<domingo>` | `400` |
| 5 | Data anterior a hoje | `GET ...?data=<ontem>` | `400` |
| 6 | Data além de 15 dias | `GET ...?data=<hoje + 16 dias>` | `400` |
| 7 | Limites da janela | `data = hoje` e `data = hoje + 15 dias` | `200` (bordas válidas) |
| 8 | Data inválida na criação | `POST /api/reservas` com data fim de semana | `400` |

Regra de "hoje" avaliada em `America/Sao_Paulo`, independente do fuso do ambiente de teste.

## Mesa inválida ou indisponível

| # | Cenário | Condição | Esperado |
| --- | --- | --- | --- |
| 9 | Mesa inexistente | `POST /api/reservas` com `mesaId = 999` | `404` |
| 10 | Mesa fixa | `POST /api/reservas` para mesa `FIXA` (ex.: `id` da `018`) | `409` "fixa" |
| 11 | Mesa inativa | Mesa com `ativa = FALSE` em `/disponiveis` e na criação | ausente da lista; `409` na criação |
| 12 | Disponibilidade filtra fixas | `/api/mesas/disponiveis?data=D` | retorna só `LIVRE` sem reserva |
| 13 | Disponibilidade filtra ocupadas | Mesa com reserva `CONFIRMADA` em `D` | ausente da lista de `D` |
| 14 | Mesa inativa fora da planta | `/api/mesas` | inativas não aparecem |

## Conflitos de reserva (`409`)

| # | Cenário | Condição | Esperado |
| --- | --- | --- | --- |
| 15 | Conflito de mesa | Mesa já tem reserva `CONFIRMADA` na data | `409` na criação |
| 16 | Conflito com `PENDENTE` | Mesa tem reserva `PENDENTE` na data | `409` (PENDENTE bloqueia) |
| 17 | Usuário já reservou no dia | Usuário tem reserva não cancelada na data | `409` "usuário" |
| 18 | Dias consecutivos ok | Reservar `D` e `D+1` (mesa e usuário) | `201` nas duas |
| 19 | Cancelamento libera | Cancelar reserva de `D` e re-reservar a mesa em `D` | `201` |
| 20 | Cancelada não bloqueia usuário | Usuário com reserva `CANCELADA` em `D` cria outra em `D` | `201` |

## Confirmação

| # | Cenário | Esperado |
| --- | --- | --- |
| 21 | Confirmar `PENDENTE` própria | `200`, status `CONFIRMADA`, `confirmadaEm` preenchido |
| 22 | Confirmar reserva já `CONFIRMADA` | `409` |
| 23 | Confirmar reserva `CANCELADA` | `409` |
| 24 | Confirmar reserva inexistente | `404` |

## Cancelamento

| # | Cenário | Esperado |
| --- | --- | --- |
| 25 | Cancelar `PENDENTE` própria | `200`, `CANCELADA`, `canceladaEm` preenchido |
| 26 | Cancelar `CONFIRMADA` própria | `200` |
| 27 | Cancelar após o dia da reserva | `200` (regra "a qualquer momento") |
| 28 | Cancelar já cancelada | `409` |
| 29 | Cancelar inexistente | `404` |

## Acesso indevido

| # | Cenário | Esperado |
| --- | --- | --- |
| 30 | Rota protegida sem token | `401` |
| 31 | Token expirado/inválido | `401` |
| 32 | Login com senha errada | `401` (mesma resposta do e-mail inexistente) |
| 33 | Confirmar reserva de outro usuário | `403` |
| 34 | Cancelar reserva de outro usuário | `403` |
| 35 | Usuário comum em rota admin | `403` |
| 36 | Usuário inativo tenta login | `401` |

## Administrador

| # | Cenário | Esperado |
| --- | --- | --- |
| 37 | Listar reservas com filtros (`data`, `usuarioId`, `status`) | `200` com `solicitante` em cada item |
| 38 | Admin cancela reserva de terceiro | `200`, `CANCELADA` |
| 39 | Alternar mesa `LIVRE` → `FIXA` | `200`; sai de `/disponiveis` |
| 40 | Alternar mesa `FIXA` → `LIVRE` | `200`; entra em `/disponiveis` se sem reserva |
| 41 | Alternar tipo com `tipo` inválido | `400` |
| 42 | Alternar tipo de mesa inexistente | `404` |

## Relação reserva → usuário

| # | Cenário | Esperado |
| --- | --- | --- |
| 43 | Resposta de criação traz `solicitante` do token | `solicitante.id` = usuário do token |
| 44 | Tentar enviar `usuarioId`/`solicitante` no body | campo ignorado (ou `400` se o contrato optar por rejeitar) |
| 45 | `/api/reservas/minhas` só retorna as reservas do próprio usuário | `200` filtrado |
