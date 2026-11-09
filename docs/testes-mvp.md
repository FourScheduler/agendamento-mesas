# Cenários de teste do MVP de mesas

Cenários que o backend deve cobrir com testes automatizados. Cada cenário referencia a regra em [fluxo-mvp](fluxo-mvp.md) e o contrato em [contratos-api-mvp](contratos-api-mvp.md).

A issue #7 implementa criação diária com confirmação direta, autoria e serialização. Listagem própria/administrativa e cancelamento estão cobertos por testes.

Para datas e fuso horário no frontend, consulte o [roteiro de validação da issue #75](validacao-issue-75.md), com os cenários de virada de dia e comandos de teste.

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
| 14 | Mesa inativa identificável na planta | `/api/mesas` | inativas aparecem com `ativa=false`, código, ID e posição; seleção bloqueada |

## Conflitos de reserva (`409`)

| # | Cenário | Condição | Esperado |
| --- | --- | --- | --- |
| 15 | Conflito de mesa | Mesa já tem reserva `CONFIRMADA` na data | `409` na criação |
| 16 | Conflito com `PENDENTE` | Mesa tem reserva `PENDENTE` na data | `409` (PENDENTE bloqueia) |
| 17 | Usuário já reservou no dia | Usuário tem reserva não cancelada na data | `409` "usuário" |
| 18 | Dias consecutivos ok | Reservar `D` e `D+1` (mesa e usuário) | `201` nas duas |
| 19 | Cancelamento libera | Cancelar reserva de `D` e re-reservar a mesa em `D` | `201` |
| 20 | Cancelada não bloqueia usuário | Usuário com reserva `CANCELADA` em `D` cria outra em `D` | `201` |

`ReservaApiTests` também verifica o bloqueio de beneficiário com mesa vinculada
ativa, inativa ou com tipo legado `LIVRE` (`409`, código `USUARIO_COM_MESA_FIXA`,
ID/código da mesa e mensagem específica, sem inserção), inclusive na reserva feita
por administrador para outro usuário. A mesa fixa do administrador não impede uma
reserva para solicitante sem vínculo. São cobertos a liberação após desfixar, nome
em `ocupante` sem vínculo, mesa fixa de outro usuário e preservação de reservas
existentes. Esses cenários são herdados pela suíte MySQL.

## Confirmação direta e concorrência

| Cenário | Esperado |
| --- | --- |
| POST autenticado com mesa/data válidas | `201`, `CONFIRMADA`, timestamps e solicitante do token; dados visíveis em outra transação após a resposta |
| Request com `usuarioId` e `solicitante` de terceiro | Campos ignorados; reserva pertence ao usuário do token |
| Admin busca solicitante por nome ou e-mail | `GET /api/admin/usuarios/busca?termo=...` retorna usuários ativos correspondentes, até 20 resultados |
| Admin cria reserva para solicitante ativo escolhido | `201`; reserva pertence ao ID enviado em `solicitanteId` |
| Usuário comum envia `solicitanteId` | `403`; nenhuma reserva criada |
| Duas requisições, usuários diferentes, mesma mesa/data, reservas inicialmente vazias | Um `201`, um `409`, uma reserva persistida |
| Mesmo usuário, mesas diferentes, mesma data | Um `201`, um `409`, uma reserva persistida |
| Usuários e mesas diferentes | Ambas confirmam |
| Mesa bloqueada por transação que confirma enquanto a outra espera | Segunda requisição aguarda e revalida após commit; retorna `409` |
| Falha depois do insert na mesma transação | Rollback integral; nova tentativa consegue reservar |
| Reserva em D e consulta em D+1 | A mesa aparece disponível em D+1 se não houver outra reserva |
| H2 e MySQL | Mesmos testes de contrato e concorrência; MySQL verifica uso de InnoDB |

`ReservaApiTests` usa transações independentes e relógio fixo. `ReservaMySqlTests` repete a suíte em schema exclusivo terminado em `_test`, configurado por `TEST_MYSQL_URL`. O CI provisiona MySQL 8.4 e executa os dois bancos. `DataReservaValidatorTests` cobre a virada de dia UTC/São Paulo.

O frontend cobre confirmação sem autoria editável tanto na lista quanto no mapa, duplo clique, sucesso após resposta, atualização de disponibilidade, erros `400`, `401`, `409`, rede/servidor e cancelamento de consulta ao trocar de data. Os testes de sessão/guards verificam restauração do perfil real, token expirado sem loop de navegação, logout e resposta de perfil recebida após logout. As rotas de login, agendamento, mapa e minhas reservas são preservadas, incluindo a data no trânsito entre lista e planta.

## Listagem de reservas próprias

`ReservaApiTests` cobre filtros por dia exato, período inclusivo (inclusive limites iguais ou abertos) e status, retorno vazio, autenticação e isolamento por usuário. A consulta inclui histórico e datas além da janela de criação. A ordem é `data DESC, id DESC`, com desempate verificado em chamadas repetidas. Datas/status inválidos, período invertido e combinação de dia exato com período retornam `400`.
## Filtro de disponibilidade diária — issue #11

Os testes de lista e mapa alteram o campo `input[type=date]` por eventos reais
de formulário. Cobrem data obrigatória, passada, fim de semana, fora da janela,
troca rápida de datas, carregamento, resposta vazia, erro e nova tentativa.
A confirmação é bloqueada até concluir a consulta da data atual, mesmo se um
evento antigo tentar selecionar uma mesa durante a atualização. O resumo usa
dia inteiro e a data de confirmação é a mesma enviada na consulta.

`data-reserva.spec.ts` cobre formato, datas inexistentes, fuso de São Paulo e os
limites inclusivos da janela. O backend mantém sua validação autoritativa.
Ver [descrição atualizada da issue #11](issue-11-filtro-data.md).

## Cancelamento

Roteiro para conferência manual e resumo das alterações da #87:
[Validação da issue #87](validacao-issue-87.md).

`ReservaApiTests` e a suíte herdada `ReservaMySqlTests` verificam preservação de tipo
`LIVRE`/`FIXA`, ativação, responsável e ocupante textual, inclusive mesas legadas
inativas e reserva antiga cuja mesa passou a ser fixa. O relógio fixo confirma o
timestamp em São Paulo. São cobertos rollback integral, dois cancelamentos
simultâneos (um `200`, um `409`), nova reserva/inativação aguardando o commit,
cancelamento concorrente com fixação/inativação sobre reserva antiga e nova reserva
do mesmo usuário sem duplicação. São cobertas disputas entre dono e administrador
e entre dois administradores, inclusive para beneficiário inativo e mesa fixa
inativa, preservando sua configuração. Usuário comum recebe `403` para reserva
alheia. O beneficiário pode cancelar diária criada por administrador, preservando
beneficiário, autor, mesa, data e timestamps anteriores. Cancelamento repetido
retorna `409`, e uma disputa entre beneficiário e administrador produz um `200`
e um `409`. Rollback também é verificado para diária de autoria administrativa.

A cobertura da #87 inclui diária administrativa passada e estado legado PENDENTE
na API, sem novo prazo, e cancelamento sem remover o vínculo de mesa que passou
a ser fixa/inativa. O beneficiário continua sem permissão para desfixar a mesa.
Minhas reservas testa confirmação e sucesso somente após resposta, preservação
do cartão de mesa fixa e ausência da antiga orientação de procurar o administrador.
As restrições existentes de data/estado dessa tela são preservadas. O mapa testa
CONFIRMADA/PENDENTE, atualização da disponibilidade e bloqueio para terceiro.

| # | Cenário | Esperado |
| --- | --- | --- |
| 25 | Cancelar `PENDENTE` própria | `200`, `CANCELADA`, `canceladaEm` preenchido |
| 26 | Cancelar `CONFIRMADA` própria | `200` |
| 27 | Cancelar após o dia da reserva | `200` (regra "a qualquer momento") |
| 28 | Cancelar já cancelada | `409` com `detail` identificando a reserva; status e `canceladaEm` permanecem inalterados |
| 29 | Cancelar inexistente | `404` com `detail` identificando a reserva inexistente |

## Acesso indevido

| # | Cenário | Esperado |
| --- | --- | --- |
| 30 | Rota protegida sem token | `401` |
| 31 | Token expirado/inválido | `401` |
| 32 | Login com senha errada | `401` (mesma resposta do e-mail inexistente) |
| 33 | Manipular autoria na criação | Campos ignorados; autoria do token |
| 34 | Cancelar reserva de outro usuário | `403` |
| 35 | Usuário comum em rota admin | `403` |
| 36 | Usuário inativo tenta login | `401` |

## Autenticação e identidade

| # | Cenário | Esperado |
| --- | --- | --- |
| 46 | Login com credenciais válidas | `200` com `token`, `tipo: Bearer` e `usuario` (id, nome, email, perfil) |
| 47 | `GET /api/auth/perfil` com token válido | `200` com id e nome do usuário do token |
| 48 | Usuário desativado após o login usa o token | `401` (checagem por request) |
| 49 | Campos `usuarioId`/`solicitante` manipulados no body | ignorados; solicitante padrão continua sendo o usuário do token |
| 50 | Credenciais e token não aparecem nos logs | ausentes do output de log |
| 51 | Admin cria usuário via `POST /api/admin/usuarios` | `201` com id gerado; senha gravada como hash |
| 52 | Criação com e-mail já cadastrado | `409` |
| 53 | Criação com senha com menos de 6 caracteres | `400` |
| 54 | Login retorna mesmo erro para e-mail inexistente e senha errada | `401` idêntico |

## Ocupante diário da mesa

`OcupacaoDiariaApiTests` e `OcupacaoDiariaMySqlTests` verificam a consulta
`/api/mesas/com-ocupacao`: identificação do solicitante real por ID, nome e e-mail,
inclusive na reserva feita pelo administrador, sem senha/hash; usuários distintos
em dias distintos; ausência de reserva e cancelamento retornando ocupante nulo;
reservas legadas pendentes; preservação da identidade após desativar o usuário;
independência entre ocupante diário, texto cadastral e responsável fixo.

Também cobrem autenticação, data ISO inválida, data omitida usando o relógio de
São Paulo, consulta histórica/futura, filtro de código, lista vazia e duplicidade
legada apresentada por maior ID sem modificar registros. Um teste compara a
quantidade de consultas com duas e 22 mesas para evitar uma busca de ocupação por
mesa. Todos os cenários são repetidos em H2 e MySQL no schema exclusivo `_test`.

## Administrador

`AdminMesaApiTests` verifica as cinco rotas de alteração de mesa: `401` para
ausência de token ou token inválido, `403` para usuário comum, `404` para mesa
inexistente e `400` para ID malformado. Fixação e troca também cobrem usuário
inexistente ou inativo. Entradas ausentes, `null`, valores inválidos e corpos
malformados verificam as mensagens administrativas, o envelope de erro e a
preservação dos dados. Há um conflito `409` de cada operação e sucesso com o
formato de `MesaResponse`, incluindo responsável e referência visual.

`ConcorrenciaAdministrativaApiTests` e `ConcorrenciaAdministrativaMySqlTests`
verificam fixação/inativação/tipo contra criação de reserva na mesma mesa,
atribuição/troca contra reserva do usuário em outra mesa, bloqueio por reservas
`PENDENTE`/`CONFIRMADA` de hoje em diante e liberação para passadas/canceladas.
As disputas produzem um sucesso e um `409`; não há cancelamento automático.
Testes com espera controlada verificam que desfixar preserva a ativação atual e
recusa contexto cujo responsável mudou enquanto aguardava, sem sobrescrever o novo vínculo.

`ResponsavelUnicoApiTests` cobre fixação e troca recusadas quando o usuário já tem
outra mesa, preservação dos vínculos após erro, manutenção do próprio responsável,
mesa vinculada inativa, liberação após desfixar/trocar, várias mesas com responsável
`NULL`, violação direta da restrição no banco e duas disputas concorrentes entre
administradores. `ResponsavelUnicoMySqlTests` repete a suíte no schema `_test`.

A suíte também cobre recusa de fixação de mesa livre inativa, atribuição em fixa
legada inativa, troca recusada preservando responsável anterior e alteração direta
de tipo sem contornar o bloqueio. Ativar primeiro permite concluir a operação;
desfixar uma mesa legada inativa continua removendo o vínculo sem ativá-la.

Inativação com vínculo é recusada para responsável ativo ou inativo, inclusive
tipos inconsistentes e mesas já inativas com vínculo legado. Os testes verificam
preservação de ativação/tipo/responsável após erro, liberação após desfixar,
inativação sem responsável preservando `LIVRE`/`FIXA`, repetição sem vínculo e
ativação de mesa legada sem remover responsável. Disputas de fixação/atribuição
contra inativação resultam em um `200` e um `409`, sem estado final inconsistente,
tanto em H2 quanto em MySQL.

`MigracaoResponsavelUnicoTests` aplica V9 sobre V8 com dados: verifica preservação
de mesas, usuários e reservas, reaplicação sem efeito e recusa de dados duplicados
sem remoção automática de vínculos.

| # | Cenário | Esperado |
| --- | --- | --- |
| 55 | Buscar usuários ativos por nome/e-mail | `GET /api/admin/usuarios/busca?termo=...` retorna no máximo 20 correspondências |
| 56 | Admin cria reserva com `solicitanteId` ativo | `201`; resposta e registro identificam o usuário selecionado |
| 57 | Usuário comum chama busca ou envia `solicitanteId` | `403`; sem dados retornados ou reserva criada |
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
