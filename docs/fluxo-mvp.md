# Fluxo e regras de negócio do MVP de mesas

Este documento descreve o fluxo aprovado e as regras de negócio do MVP de agendamento de mesas. Ele é a referência para implementação do backend; autenticação, catálogo, disponibilidade diária e criação confirmada estão implementados.

Parte do MVP: issue #1.

## Fluxo aprovado

1. Usuário informa a **data** desejada (reserva sempre de um dia inteiro).
2. Usuário consulta a **planta de mesas** (`GET /api/mesas`) e a **disponibilidade da data** (`GET /api/mesas/disponiveis?data=...`).
3. Usuário seleciona uma mesa **LIVRE**, **ativa** e sem reserva na data.
4. Usuário **revisa** o resumo (mesa, data e solicitante).
5. Usuário **autentica** quando ainda não estiver logado (`POST /api/auth/login`).
6. Usuário **confirma**: uma única chamada `POST /api/reservas` cria a reserva diretamente em estado `CONFIRMADA`.
7. Usuário **consulta** suas reservas (`GET /api/reservas/minhas`) e pode **cancelar** a qualquer momento (`PATCH /api/reservas/{id}/cancelamento`).

Todas as rotas, inclusive a consulta, exigem token de autenticação. Sem token a resposta é `401`.

## Modelo de mesa

**Mesa** é uma estação individual de trabalho, identificada por **código** único (ex.: `001`). Cada mesa possui:

| Atributo | Descrição |
| --- | --- |
| Código | Identificador único da mesa, ex.: `001` a `115`. |
| Localização | Região onde a mesa está física. No MVP de demonstração, todas na região `TAMBORÉ`. |
| Tipo | `LIVRE` (disponível para reserva por qualquer usuário) ou `FIXA` (designada a pessoa fixa; não aparece em disponibilidade e não pode ser reservada por usuário comum). |
| Estado ativo | Mesa inativa aparece identificada na planta e não pode ser reservada. |
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
| 8 | Cancelamento | O beneficiário pode cancelar suas reservas diárias independentemente de quem as criou, inclusive um administrador, ou de ausência de autor em dados legados. Administradores podem cancelar qualquer reserva, inclusive de beneficiário inativo. A API permite cancelar a qualquer momento, inclusive após o dia reservado. Altera somente a reserva e libera a disponibilidade daquela data; preserva autoria, tipo, ativação, ocupante textual e responsável fixo da mesa. |
| 9 | Solicitante | Por padrão vem do contexto autenticado. Administradores podem escolher um usuário ativo pela busca de nome/e-mail; usuários comuns não podem escolher terceiros. |
| 10 | Autenticação | Login local com e-mail e senha (hash BCrypt). Token JWT em `Authorization: Bearer`. |
| 11 | Estados da reserva | Novas reservas são `CONFIRMADA`. `PENDENTE` permanece compatível com dados legados; `CANCELADA` libera a data. |
| 12 | Confirmação | Após revisar, o usuário envia um único POST. A API responde `201` somente após commit da reserva `CONFIRMADA`. |
| 13 | Mesas fixas | Tipo `FIXA` não aparece em `/api/mesas/disponiveis` e gera `409` na tentativa de reserva. |
| 14 | Solicitante com mesa vinculada | Usuário vinculado por `mesas.responsavel_id` não pode criar reservas, inclusive com mesa inativa ou tipo legado inconsistente. O bloqueio considera o beneficiário escolhido pelo administrador e identifica a mesa no erro. |
| 15 | Uma mesa por responsável | Atribuir ou trocar responsável exige que o usuário não esteja vinculado a outra mesa. Um vínculo existente continua contando mesmo se a mesa estiver inativa. Não há transferência automática; desfixar ou trocar o responsável libera o usuário anterior. |
| 16 | Ativar antes de fixar | Mesa inativa não pode ser fixada nem receber atribuição/troca de responsável (`409`). A alteração direta de tipo para `FIXA` também exige mesa ativa. O administrador deve ativar primeiro; a recusa preserva tipo, ativação e vínculo anterior. |
| 17 | Remover vínculo antes de inativar | Inativação retorna `409` enquanto houver `responsavel_id`, mesmo com usuário inativo ou tipo legado inconsistente. O responsável não é removido automaticamente. Após desfixar/remover explicitamente o vínculo, a inativação é permitida e preserva o tipo da mesa. |
| 18 | Preservar reservas em alterações administrativas | Reservas `PENDENTE`/`CONFIRMADA` de hoje em diante impedem fixação, nova atribuição/troca de responsável e inativação da mesa. O usuário de destino também não pode ter reservas não canceladas de hoje em diante. Retorna `409`, sem cancelar, transferir ou alterar reservas existentes. Passadas e canceladas não impedem a alteração. |

A verificação usa o ID do responsável, não o texto de `ocupante`. Desfixar a mesa
remove esse impedimento; as demais validações continuam aplicáveis. Reservas já
existentes não são alteradas por esse bloqueio. O backend retorna `409` com
`code: USUARIO_COM_MESA_FIXA`, `mesa: { id, codigo }` e `detail` específico para
o próprio usuário ou o administrador que reserva para terceiro. Lista e mapa
apresentam o detalhe sem convertê-lo em conflito de reserva diária duplicada.
Minhas reservas identifica atribuições exclusivamente pelo ID do responsável,
inclusive vínculos legados inconsistentes que precisam de revisão administrativa.
Nome em `ocupante` não estabelece vínculo. A regularização exige conferência
do cadastro pelo e-mail e seleção do ID correto, sem associação automática por nome.
Ver [regularização de vínculos](regularizacao-vinculos-mesas.md).

## Regra de sobreposição: adaptação de `[início, fim)`

A decisão original previa intervalos `[início, fim)`, em que períodos consecutivos são permitidos e sobreposição da mesma mesa não é. Como o MVP adotou **reserva de dia inteiro**, o intervalo da reserva passa a ser o dia completo (`[00:00, 24:00)` do dia reservado) e a regra se traduz em:

- Sobreposição existe quando duas reservas **não canceladas** da mesma **mesa** têm a **mesma data**.
- Dois dias consecutivos nunca se sobrepõem; a reserva do dia `D` não impede a reserva do dia `D+1`.
- Reserva `CANCELADA` não bloqueia mesa nem usuário.

A reserva ocupa exclusivamente sua data. No dia seguinte a mesa está disponível se não houver outra reserva; não é necessário cancelar ou alterar automaticamente o status da reserva anterior.

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
| Reservas `PENDENTE` legadas | Novas reservas não passam por esse estado. Dados legados continuam bloqueando mesa e usuário na data até seu cancelamento ou tratamento futuro. |
| Interpretação da janela de 15 dias | Adotado "15 dias corridos". Se o negócio quiser "15 dias úteis", ajustar a regra. |
| Horário de expediente de referência | Sem validação de expediente no MVP (regra aprovada). Exibição de expediente futuro fica pendente. |
| Feriados e recesso | Não tratados. Reserva em feriado local é aceita se cair em dia útil. |
| Papel de administrador além dos endpoints do MVP | Gestão de usuários (criar/desativar) fora do MVP; seed no banco. |
| Cancelamento por administrador de reserva com dia já passado | Permitido pela regra "a qualquer momento"; se o negócio quiser restrição, registrar decisão. |

## Confirmação concorrente

`ReservaService.criar` usa uma transação `READ_COMMITTED`, bloqueando primeiro a linha do usuário e depois a linha da mesa (`PESSIMISTIC_WRITE` / `SELECT ... FOR UPDATE`). A mesa já existe mesmo quando não há reservas; o bloqueio protege a primeira inserção. Após esperar, as consultas de mesa/data e usuário/data enxergam o commit anterior. Canceladas são ignoradas pelo status. Todos os caminhos futuros de escrita devem respeitar essa ordem de locks e revalidar conflitos dentro da transação. Falhas desfazem a escrita e liberam os locks.

Fixação, troca, desfixação e alteração direta de tipo usam `READ_COMMITTED`.
Os responsáveis anterior e novo são bloqueados por ID crescente, sem duplicatas,
antes da mesa. O responsável anterior é consultado como ID escalar para não carregar
uma entidade Mesa obsoleta no contexto JPA. Após os locks, o vínculo é conferido
novamente: se mudou durante a espera, a operação retorna `409` para atualização
e nova tentativa, sem adquirir mais usuários depois da mesa nem sobrescrever o vínculo.
A consulta de unicidade exclui a própria mesa; manter o mesmo responsável ativo
continua sendo uma operação sem nova atribuição. A restrição única de `responsavel_id`
complementa a validação, inclusive para gravações diretas no banco.

Ativação/inativação usa `READ_COMMITTED` e bloqueia a linha da mesa antes de avaliar
o vínculo e gravar `ativa`. Isso coordena a operação com fixação e troca de
responsável: em uma disputa entre atribuição e inativação, somente uma pode
concluir, sem produzir mesa inativa com um responsável novo. Ativar uma mesa
legada preserva seu tipo e responsável, inclusive quando o usuário está inativo.

Após esperar pelos locks, as consultas de reservas usam o dia atual do relógio da
aplicação em `America/Sao_Paulo`, sem limitar a pesquisa à janela de 15 dias da criação.
Se a reserva concluir primeiro, a alteração administrativa incompatível retorna `409`.
Se a alteração concluir primeiro, a criação revalida mesa ativa/livre e vínculo fixo
do solicitante antes de confirmar. As reservas anteriores são sempre preservadas.

O cancelamento usa transação `READ_COMMITTED`, bloqueando primeiro o beneficiário
da reserva e depois a mesa, inclusive quando solicitado por um administrador.
O ID do beneficiário é consultado como escalar; a reserva é lida após o lock do
usuário, que serializa cancelamentos pelo dono ou por administradores, e a
autoria/estado são validados antes de salvar.
Somente `status` e `canceladaEm` da reserva são alterados; o timestamp usa o relógio
da aplicação em São Paulo. O commit ocorre antes do `200` sem corpo. Repetir o
cancelamento retorna `409`, sem regravar o timestamp; reserva alheia retorna `403`.
Falha na transação desfaz o cancelamento e libera os locks. Criação e operações
administrativas aguardam o lock da mesa para revalidar disponibilidade/reservas.

## Fora do escopo do MVP

Microsoft Graph, Outlook, SSO/Entra ID e provedores de IA ficam fora desta entrega (decisão aprovada). Não há integração externa obrigatória.

## Artefatos relacionados

- [Contratos da API](contratos-api-mvp.md)
- [Modelo de dados e demonstração](modelo-dados-mvp.md)
- [Cenários de teste](testes-mvp.md)
