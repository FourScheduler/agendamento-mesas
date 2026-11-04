# Contratos da API do MVP de mesas

Contratos do backend (Spring Boot, porta `8081`, prefixo `/api`). Login, perfil, criação administrativa de usuários, catálogo, disponibilidade diária, `POST /api/reservas`, listagem com filtros e cancelamento de reservas próprias estão implementados. As rotas de gestão administrativa de reservas abaixo descrevem contratos previstos.

## Convenções

- JSON em `UTF-8` em todas as rotas.
- Datas no formato ISO `yyyy-MM-dd`; data/hora local sem offset no formato `yyyy-MM-dd'T'HH:mm:ss`; fuso único `America/Sao_Paulo` (ver [fluxo-mvp](fluxo-mvp.md)).
- Todas as rotas exigem autenticação: header `Authorization: Bearer <token>`. Exceção: `POST /api/auth/login`. Sem token ou com token inválido: `401`.
- O token JWT expira em 8 horas (`JWT_EXPIRACAO_HORAS` em dev). Token expirado responde `401`; o cliente deve autenticar de novo. Não há refresh token no MVP.
- O solicitante padrão é o usuário do token. Administradores podem informar `solicitanteId` para criar a reserva em nome de um usuário ativo; usuários comuns não podem escolher terceiros.
- Campos `id` são numéricos inteiros gerados pelo banco.

### Formato padrão de erro

Todas as respostas de erro usam o corpo abaixo (alinhado a RFC 9457, simplificado):

```json
{
  "type": "about:blank",
  "title": "Conflito de reserva",
  "status": 409,
  "detail": "A mesa 053 já possui uma reserva não cancelada em 2026-10-28.",
  "instance": "/api/reservas"
}
```

| Status | Quando usar |
| --- | --- |
| `400` | Request malformado, campo ausente/inválido, data fora das regras (fim de semana, fora da janela de 15 dias, passada). |
| `401` | Sem token, token expirado/inválido, ou login com credenciais erradas. |
| `403` | Usuário autenticado sem perfil adequado (rota admin acessada por usuário comum). |
| `404` | Recurso inexistente (mesa ou reserva com `id` desconhecido). |
| `409` | Conflito de regra de negócio (mesa ocupada/fixa/inativa, reserva do usuário na data, estado inválido da reserva). |

---

## POST /api/auth/login

Autentica e-mail + senha e retorna o token JWT. Rota única sem token.

### Request

```json
{
  "email": "maria.souza@exemplo.com",
  "senha": "senha-do-usuario"
}
```

### Response `200`

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "tipo": "Bearer",
  "usuario": {
    "id": 3,
    "nome": "Maria Souza",
    "email": "maria.souza@exemplo.com",
    "perfil": "USUARIO"
  }
}
```

### Erros

| Status | Situação | Exemplo de `detail` |
| --- | --- | --- |
| `400` | `email` ou `senha` ausentes. | `Campo 'email' é obrigatório.` |
| `401` | Credenciais inválidas (e-mail não existe ou senha errada — mesma resposta para não vazar existência). | `Credenciais inválidas.` |
| `401` | Usuário existe mas está inativo. | `Usuário inativo.` |

---

## GET /api/auth/perfil

Retorna o perfil do usuário autenticado (id e nome inclusos), identificado pelo token. Não recebe parâmetros.

### Response `200`

```json
{
  "id": 3,
  "nome": "Maria Souza",
  "email": "maria.souza@exemplo.com",
  "perfil": "USUARIO"
}
```

### Erros

| Status | Situação |
| --- | --- |
| `401` | Sem token, token expirado/inválido ou usuário inativo/desativado após o login. |

---

## GET /api/mesas

Lista o catálogo completo quando `termo` não contém números ou não é informado. Quando houver números, ignora os demais caracteres e busca no banco por trecho do código (por exemplo, `Mesa 10` e `abc 10` equivalem a `10`). Exige autenticação.

### Query params

| Campo | Obrigatório | Formato |
| --- | --- | --- |
| `termo` | Não | Texto livre; somente os dígitos são usados para filtrar pelo código |

### Response `200`

Lista de `MesaResponse` em ordem crescente de código.

## GET /api/admin/usuarios/busca

Busca usuários ativos por trecho do nome ou e-mail, sem diferenciar maiúsculas de minúsculas. Exige perfil `ADMIN`. `termo` deve conter ao menos dois caracteres na interface; a resposta limita-se aos 20 primeiros resultados ordenados por nome.

### Query params

| Campo | Obrigatório | Formato |
| --- | --- | --- |
| `termo` | Sim | Trecho do nome ou e-mail |

### Response `200`

Lista de `UsuarioAdminResumo` (`id`, `nome`, `email`, `perfil`, `ativo`). Usuários inativos não são retornados.

### Erros

| Status | Situação |
| --- | --- |
| `401` | Sem ou com token inválido. |
| `403` | Usuário sem perfil `ADMIN`. |

---

## GET /api/mesas

Lista **todas as mesas**, inclusive inativas, ordenadas por `codigo`, com códigos, localização, tipo e posição visual. O cliente diferencia `LIVRE` de `FIXA` por `tipo` e identifica inativas por `ativa=false`. Esta rota está implementada; não calcula disponibilidade temporal. Ver [catálogo de demonstração](catalogo-demonstracao.md).

### Query params

Nenhum.

### Response `200`

```json
[
  {
    "id": 44,
    "codigo": "044",
    "regiao": "TAMBORÉ",
    "tipo": "LIVRE",
    "ativa": true,
    "referenciaVisual": {
      "planta": "TAMBORÉ",
      "x": 590,
      "y": 1108
    }
  },
  {
    "id": 18,
    "codigo": "018",
    "regiao": "TAMBORÉ",
    "tipo": "FIXA",
    "ativa": true,
    "referenciaVisual": {
      "planta": "TAMBORÉ",
      "x": 213,
      "y": 457
    }
  }
]
```

### Erros

| Status | Situação |
| --- | --- |
| `401` | Sem ou com token inválido. |

---

## GET /api/mesas/com-ocupacao

Lista o catálogo com o indicador `ocupada` para a data consultada, preservando
os campos de mesa, responsável e referência visual. Aceita `termo` com a mesma
normalização de código de `/api/mesas`. Exige autenticação.

`data` é opcional, no formato `yyyy-MM-dd`; quando omitida, usa o dia atual
do relógio da aplicação, em `America/Sao_Paulo`. A consulta não aplica a janela
de criação de reservas: mesas fixas e inativas também são retornadas.

`ocupada` é `true` apenas quando existe reserva `PENDENTE` ou `CONFIRMADA`
na data informada. Reservas canceladas e de outras datas não marcam ocupação.
O campo adicional `ocupanteNaData` identifica o usuário dessa reserva com `id`,
`nome` e `email`; sem reserva bloqueante na data, retorna `null`. O `id` é o do
usuário persistido em `reservas.usuario_id`, inclusive quando a reserva foi feita
por um administrador para outro solicitante. Usuário posteriormente desativado
continua identificado na reserva existente. Senha, hash e token não são retornados.

`ocupante` continua sendo o texto cadastral da mesa e `responsavel` continua sendo
o vínculo de mesa fixa; nenhum deles é sobrescrito pela ocupação diária. Consultar
ou cancelar uma reserva não altera esses campos. As ocupações das mesas retornadas
são buscadas em lote, incluindo o usuário. Se houver duplicidade legada de reservas
bloqueantes para a mesma mesa/data, a apresentação usa a de maior ID, sem alterar
o histórico; a criação atual impede esse conflito.

Resposta `200` com lista (possivelmente vazia); data malformada retorna `400`
e ausência de autenticação retorna `401`.

## GET /api/mesas/disponiveis

Lista as mesas disponíveis para a data informada: **ativas**, **`LIVRE`** e **sem reserva não cancelada** na data. É a base da planta com disponibilidade.

### Query params

| Campo | Obrigatório | Formato | Regras |
| --- | --- | --- | --- |
| `data` | Sim | `yyyy-MM-dd` | Dia útil (seg–sex), de hoje até +15 dias corridos, no fuso `America/Sao_Paulo`. |

### Response `200`

Mesmo formato de `/api/mesas`, apenas as mesas disponíveis:

```json
[
  {
    "id": 44,
    "codigo": "044",
    "regiao": "TAMBORÉ",
    "tipo": "LIVRE",
    "ativa": true,
    "referenciaVisual": {
      "planta": "TAMBORÉ",
      "x": 590,
      "y": 1108
    }
  }
]
```

### Erros

| Status | Situação | Exemplo de `detail` |
| --- | --- | --- |
| `400` | `data` ausente ou malformada. | `Parâmetro 'data' é obrigatório e deve estar no formato yyyy-MM-dd.` |
| `400` | Data em fim de semana. | `Reservas são permitidas apenas de segunda a sexta.` |
| `400` | Data anterior a hoje. | `Data deve ser hoje ou futura.` |
| `400` | Data além de 15 dias corridos. | `Data deve estar em até 15 dias a partir de hoje.` |
| `401` | Sem ou com token inválido. | |

---

## POST /api/reservas

Confirma e persiste uma reserva de dia inteiro, exclusivamente para a data escolhida. Sem `solicitanteId`, o solicitante vem do token. Administradores podem informar `solicitanteId` para escolher um usuário ativo; usuários comuns não podem escolher terceiros. Campos extras como `usuarioId` e `solicitante` são ignorados. A resposta só é emitida após commit da transação; não há uma segunda chamada de confirmação.

### Request

```json
{
  "mesaId": 44,
  "data": "2026-10-28",
  "solicitanteId": 7
}
```

### Response `201`

```json
{
  "id": 10,
  "status": "CONFIRMADA",
  "data": "2026-10-28",
  "criadaEm": "2026-10-23T14:30:00",
  "confirmadaEm": "2026-10-23T14:30:00",
  "mesa": {
    "id": 44,
    "codigo": "044",
    "regiao": "TAMBORÉ"
  },
  "solicitante": {
    "id": 3,
    "nome": "Maria Souza",
    "email": "maria.souza@exemplo.com"
  }
}
```

### Erros

| Status | Situação | Exemplo de `detail` |
| --- | --- | --- |
| `400` | `mesaId` ou `data` ausentes/inválidos; data fim de semana, passada ou além de 15 dias. | `Campo 'data' inválido.` |
| `401` | Sem ou com token inválido. | |
| `403` | Usuário comum envia `solicitanteId`. | `Somente administradores podem escolher o solicitante.` |
| `404` | `mesaId` inexistente. | `Mesa 999 não encontrada.` |
| `404` | `solicitanteId` inexistente ou inativo. | `Solicitante inativo ou inexistente.` |
| `409` | Mesa `FIXA`. | `Mesa 018 é fixa e não pode ser reservada.` |
| `409` | Mesa inativa. | `Mesa 005 está inativa.` |
| `409` | Solicitante vinculado como responsável de uma mesa `FIXA`, ativa ou inativa. | `O solicitante possui uma mesa fixa e não pode realizar reservas.` |
| `409` | Mesa já tem reserva não cancelada na data. | `A mesa 053 já possui uma reserva não cancelada em 2026-10-28.` |
| `409` | Usuário já tem reserva não cancelada na mesma data. | `Você já possui uma reserva em 28/10/2026, para agendar outra mesa na mesma data é necessário cancelar a reserva atual.` |

O bloqueio por mesa fixa consulta o vínculo `responsavel_id` do solicitante efetivo,
sem inferir identidade pelo nome em `ocupante`. Após a desfixação, novas reservas
podem ser criadas se atenderem às demais regras. O bloqueio não cancela reservas
anteriores. O backend disponibiliza o motivo do conflito em `detail`; a adequação
da interface para apresentar esse texto fica para uma etapa posterior.

---

## GET /api/reservas/minhas

Lista somente as reservas do usuário autenticado, com filtros opcionais por status e data ou período. Ordenação fixa por `data` decrescente e, em caso de empate, `id` decrescente.

### Query params

| Campo | Obrigatório | Formato | Observação |
| --- | --- | --- | --- |
| `status` | Não | `PENDENTE` \| `CONFIRMADA` \| `CANCELADA` | Filtra por estado. |
| `data` | Não | `yyyy-MM-dd` | Filtra por dia exato. Não pode ser combinado com `dataInicio` ou `dataFim`. |
| `dataInicio` | Não | `yyyy-MM-dd` | Limite inicial inclusivo. Sem `dataFim`, não há limite final. |
| `dataFim` | Não | `yyyy-MM-dd` | Limite final inclusivo. Sem `dataInicio`, não há limite inicial. |

`status` pode ser combinado com dia exato ou período. Sem filtros, retorna todo o histórico do usuário. Datas passadas e fins de semana são permitidos na consulta; a janela de criação de 15 dias não se aplica. `dataInicio` deve ser anterior ou igual a `dataFim`.

### Response `200`

```json
[
  {
    "id": 10,
    "status": "CONFIRMADA",
    "data": "2026-10-28",
    "criadaEm": "2026-10-23T14:30:00",
    "confirmadaEm": "2026-10-23T14:32:10",
    "mesa": {
      "id": 44,
      "codigo": "044",
      "regiao": "TAMBORÉ"
    }
  }
]
```

Lista vazia (`[]`) é resposta válida (`200`), não erro.

### Erros

| Status | Situação |
| --- | --- |
| `400` | Status/data inválidos, período invertido ou combinação de `data` com os limites do período. |
| `401` | Sem ou com token inválido. |

---

## PATCH /api/reservas/{id}/cancelamento

Cancela a reserva própria, em qualquer estado não cancelado e a qualquer momento,
inclusive após o dia reservado. A reserva deixa de bloquear somente a sua data.
O cancelamento não transforma mesa fixa em livre, não ativa mesa inativa e não
remove responsável fixo ou ocupante textual. As regras administrativas atuais da
mesa continuam valendo para novas reservas.

### Response `200`

Sem corpo, após o commit. O histórico permanece em `GET /api/reservas/minhas`, com
`status: CANCELADA` e `canceladaEm` no fuso `America/Sao_Paulo`. ID, data, mesa,
solicitante e timestamps anteriores da reserva são preservados.

Duas tentativas simultâneas pelo dono resultam em um `200` e um `409`. A segunda
não altera novamente `canceladaEm`. Falhas desfazem integralmente a transação.

### Erros

| Status | Situação | Exemplo de `detail` |
| --- | --- | --- |
| `401` | Sem ou com token inválido. | |
| `404` | Reserva inexistente. | `Reserva 999 não encontrada.` |
| `403` | Reserva de outro usuário. | `Reserva não pertence ao usuário autenticado.` |
| `409` | Reserva já `CANCELADA`; repetir o cancelamento é recusado e não altera o registro. | `Reserva 10 já está cancelada.` |

---

## Rotas de administrador

Exigem perfil `ADMIN`. Usuário comum recebe `403`.

Fixação, nova atribuição/troca de responsável e alteração de tipo para `FIXA`
recusam mesas com reservas `PENDENTE`/`CONFIRMADA` de hoje em diante (`409`):
`Mesa 044 possui reservas não canceladas de hoje em diante. Revise as reservas antes de alterar a mesa.`
Inativação também verifica essas reservas, além do impedimento por responsável.
O dia atual é avaliado em `America/Sao_Paulo`; a consulta inclui reservas além da
janela de 15 dias. Reservas canceladas e datas passadas não impedem a operação.

Para receber uma mesa fixa, o usuário também não pode ter reservas não canceladas
de hoje em diante, mesmo em outra mesa. O conflito retorna `409` com:
`O usuário possui reservas não canceladas de hoje em diante e não pode receber uma mesa fixa.`
Nenhuma operação cancela ou transfere reservas automaticamente. Manter o mesmo
responsável de uma mesa ativa é uma operação sem nova atribuição.

Em disputa concorrente, o estado é revalidado depois dos bloqueios. Se o responsável
observado tiver mudado, retorna `409` com:
`O responsável da mesa foi alterado por outra operação. Atualize os dados e tente novamente.`
A operação recusada não sobrescreve o vínculo nem apresenta sucesso.

### POST /api/admin/usuarios

Provisiona um usuário fictício para demonstração. Cadastro público não existe; esta é a única forma de criar usuário pela API.

#### Request

```json
{
  "nome": "Carlos Lima",
  "email": "carlos.lima@exemplo.com",
  "senha": "senha1234",
  "perfil": "USUARIO"
}
```

| Campo | Obrigatório | Regras |
| --- | --- | --- |
| `nome` | Sim | Não vazio, até 120 caracteres. |
| `email` | Sim | Formato válido, único. |
| `senha` | Sim | Mínimo de 6 caracteres; gravada apenas como hash BCrypt. |
| `perfil` | Não | `USUARIO` (padrão) ou `ADMIN`. |

#### Response `201`

```json
{
  "id": 7,
  "nome": "Carlos Lima",
  "email": "carlos.lima@exemplo.com",
  "perfil": "USUARIO",
  "ativo": true
}
```

#### Erros

| Status | Situação | Exemplo de `detail` |
| --- | --- | --- |
| `400` | Campo ausente/inválido ou senha com menos de 6 caracteres. | `A senha deve ter pelo menos 6 caracteres.` |
| `401` | Sem ou com token inválido. | |
| `403` | Usuário sem perfil `ADMIN`. | `Acesso restrito a administradores.` |
| `409` | E-mail já cadastrado. | `E-mail já cadastrado.` |

### GET /api/admin/reservas

Lista reservas de todos os usuários.

| Query param | Obrigatório | Formato |
| --- | --- | --- |
| `data` | Não | `yyyy-MM-dd` |
| `usuarioId` | Não | inteiro |
| `status` | Não | `PENDENTE` \| `CONFIRMADA` \| `CANCELADA` |

`200`: lista no mesmo formato de `/api/reservas/minhas`, com o campo `solicitante` sempre presente.

### PATCH /api/admin/reservas/{id}/cancelamento

Cancela a reserva de qualquer usuário (mesmas regras de estado de `PATCH /api/reservas/{id}/cancelamento`). `200` com a reserva `CANCELADA`; erros `401`, `403`, `404` e `409` como na rota do usuário.

### PATCH /api/admin/mesas/{id}/fixar

Fixa uma mesa e associa um usuário ativo como responsável.

A mesa também deve estar ativa. Se estiver inativa, retorna `409` com `detail`:
`Mesa 044 está inativa. Ative a mesa antes de fixá-la ou atribuir um responsável.`
O código da mesa é incluído na mensagem. A operação recusada não ativa a mesa,
não altera seu tipo e não atribui o responsável. Após ativá-la pelo endpoint de
ativação, a fixação pode ser solicitada novamente.

#### Request

```json
{
  "usuarioId": 7
}
```

`200`: retorna `MesaResponse` com `tipo: "FIXA"` e o objeto `responsavel` (`id`, `nome`, `email`).

Se o usuário já estiver vinculado a outra mesa, retorna `409` com `detail`:
`O usuário já possui uma mesa fixa vinculada. Desfixe a mesa atual antes de atribuir outra.`
A mesa atual do usuário não é desfixada automaticamente e a mesa de destino permanece
inalterada. Mesas inativas vinculadas também impedem uma nova atribuição.

### PATCH /api/admin/mesas/{id}/desfixar

Desfixa a mesa, altera o tipo para `LIVRE` e remove o responsável (`responsavel: null`).

`200`: retorna o `MesaResponse` atualizado.

### PATCH /api/admin/mesas/{id}/responsavel

Altera o responsável de uma mesa fixa para outro usuário ativo.

A mesa deve estar ativa, inclusive no caso de fixa legada sem responsável. Mesa
inativa retorna `409` com a mensagem de ativação prévia descrita na fixação,
preservando o responsável anterior, quando existente.

O usuário de destino não pode estar vinculado a outra mesa, sob pena de `409` com
a mesma mensagem da fixação. Nesse caso, os dois vínculos existentes são preservados.
Informar novamente o responsável da própria mesa ativa retorna `200`, sem conflito.
Após uma troca bem-sucedida, o usuário anterior pode ser vinculado a outra mesa.

#### Request

```json
{
  "usuarioId": 8
}
```

`200`: retorna o `MesaResponse` atualizado.

### PATCH /api/admin/mesas/{id}/ativacao

Ativa ou inativa uma mesa.

Para inativar (`ativa: false`), a mesa não pode ter responsável vinculado. Caso
exista `responsavel_id`, retorna `409` com `detail`:
`Mesa 044 possui um responsável vinculado. Remova o vínculo antes de inativá-la.`
O bloqueio também vale para responsável inativo, mesa já inativa com vínculo legado
e tipo `LIVRE` com vínculo inconsistente. A recusa preserva ativação, tipo e responsável.
O administrador deve remover o vínculo explicitamente, por exemplo desfixando a
mesa, antes de solicitar a inativação. Mesa sem responsável pode ser inativada
mantendo o tipo atual, inclusive `FIXA` legada sem responsável.

Ativar (`ativa: true`) não remove nem troca responsável e não altera o tipo. A
ativação de uma mesa legada com usuário responsável inativo continua permitida.

#### Request

```json
{
  "ativa": false
}
```

`200`: retorna o `MesaResponse` atualizado.

### PATCH /api/admin/mesas/{id}/tipo

Altera o tipo da mesa entre `FIXA` e `LIVRE`.

#### Request

```json
{
  "tipo": "FIXA"
}
```

#### Response `200`

```json
{
  "id": 44,
  "codigo": "044",
  "regiao": "TAMBORÉ",
  "tipo": "FIXA",
  "ativa": true,
  "referenciaVisual": {
    "planta": "TAMBORÉ",
    "x": 590,
    "y": 1108
  }
}
```

#### Erros

| Status | Situação | Exemplo de `detail` |
| --- | --- | --- |
| `400` | `tipo` ausente ou diferente de `FIXA`/`LIVRE`. | `Campo 'tipo' deve ser FIXA ou LIVRE.` |
| `401` | Sem ou com token inválido. | |
| `403` | Usuário sem perfil `ADMIN`. | `Acesso restrito a administradores.` |
| `404` | Mesa inexistente. | `Mesa 999 não encontrada.` |
| `409` | Alterar para `FIXA` uma mesa inativa. | `Mesa 044 está inativa. Ative a mesa antes de fixá-la ou atribuir um responsável.` |

> Alterar de `LIVRE` para `FIXA` também verifica reservas de hoje em diante, conforme as regras administrativas acima. Alterar para `LIVRE` remove o responsável e preserva a ativação e as reservas.

---

## Resumo de rotas

| Método | Rota | Auth | Perfil |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Não | — |
| GET | `/api/auth/perfil` | Sim | Qualquer |
| GET | `/api/admin/usuarios/busca?termo=...` | Sim | ADMIN |
| GET | `/api/mesas` | Sim | Qualquer |
| GET | `/api/mesas/com-ocupacao` | Sim | Qualquer |
| GET | `/api/mesas/disponiveis` | Sim | Qualquer |
| POST | `/api/reservas` | Sim | Qualquer |
| GET | `/api/reservas/minhas` | Sim | Qualquer |
| PATCH | `/api/reservas/{id}/cancelamento` | Sim | Dono |
| POST | `/api/admin/usuarios` | Sim | ADMIN |
| GET | `/api/admin/reservas` | Sim | ADMIN |
| PATCH | `/api/admin/reservas/{id}/cancelamento` | Sim | ADMIN |
| PATCH | `/api/admin/mesas/{id}/fixar` | Sim | ADMIN |
| PATCH | `/api/admin/mesas/{id}/desfixar` | Sim | ADMIN |
| PATCH | `/api/admin/mesas/{id}/responsavel` | Sim | ADMIN |
| PATCH | `/api/admin/mesas/{id}/ativacao` | Sim | ADMIN |
| PATCH | `/api/admin/mesas/{id}/tipo` | Sim | ADMIN |

## Verificação

Após a implementação, os cenários de [testes-mvp](testes-mvp.md) devem ser cobertos por testes automatizados do backend, e os exemplos deste documento devem ser validados contra a aplicação em execução.
