# Contratos da API do MVP de mesas

Contratos do backend (Spring Boot, porta `8081`, prefixo `/api`). Login, perfil, criação administrativa de usuários, catálogo, disponibilidade diária, criação/listagem/cancelamento de reservas próprias e gerenciamento administrativo de mesas estão implementados. Listagem e cancelamento administrativos de reservas continuam planejados.

## Convenções

- JSON em `UTF-8` em todas as rotas.
- Datas no formato ISO `yyyy-MM-dd`; data/hora local sem offset no formato `yyyy-MM-dd'T'HH:mm:ss`; fuso único `America/Sao_Paulo` (ver [fluxo-mvp](fluxo-mvp.md)).
- Todas as rotas exigem autenticação: header `Authorization: Bearer <token>`. Exceção: `POST /api/auth/login`. Sem token ou com token inválido: `401`.
- O token JWT expira em 8 horas (`JWT_EXPIRACAO_HORAS` em dev). Token expirado responde `401`; o cliente deve autenticar de novo. Não há refresh token no MVP.
- O solicitante de reservas é sempre o usuário do token. O `usuarioId` das operações de atribuição administrativa identifica o responsável fixo, sem criar ou transferir reservas.
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

Confirma e persiste uma reserva de dia inteiro, exclusivamente para a data escolhida. O solicitante vem do token. Campos extras como `usuarioId` e `solicitante` são ignorados e nunca definem a autoria. A resposta só é emitida após commit da transação; não há uma segunda chamada de confirmação.

### Request

```json
{
  "mesaId": 44,
  "data": "2026-10-28"
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
| `404` | `mesaId` inexistente. | `Mesa 999 não encontrada.` |
| `409` | Mesa `FIXA`. | `Mesa 018 é fixa e não pode ser reservada.` |
| `409` | Mesa inativa. | `Mesa 005 está inativa.` |
| `409` | Usuário autenticado possui mesa fixa. | `Você já possui uma mesa fixa e não pode realizar novas reservas de mesas compartilhadas.` |
| `409` | Mesa já tem reserva não cancelada na data. | `A mesa 053 já possui uma reserva não cancelada em 2026-10-28.` |
| `409` | Usuário já tem reserva não cancelada na mesma data. | `Você já possui uma reserva em 28/10/2026, para agendar outra mesa na mesma data é necessário cancelar a reserva atual.` |

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

Cancela a reserva própria, em qualquer estado não cancelado e a qualquer momento.
A reserva deixa de bloquear sua data; a mesa só fica disponível se continuar ativa,
`LIVRE` e sem outros bloqueios. Não altera tipo, ativação nem responsável fixo.

### Response `200`

A implementação atual retorna `200` sem corpo. Consulte `/api/reservas/minhas`
para recuperar os dados atualizados da reserva.

### Erros

| Status | Situação | Exemplo de `detail` |
| --- | --- | --- |
| `401` | Sem ou com token inválido. | |
| `404` | Reserva inexistente. | `Reserva 999 não encontrada.` |
| `403` | Reserva de outro usuário. | `Reserva não pertence ao usuário autenticado.` |
| `409` | Reserva já `CANCELADA`; repetir o cancelamento é recusado e não altera o registro. | `Reserva 10 já está cancelada.` |

---

## GET /api/mesas/minha-fixa

Disponível a qualquer usuário autenticado, sem permissão administrativa.
Retorna um objeto com campo `mesa`: formato do catálogo comum, ou `null` se não houver atribuição.
A identidade vem exclusivamente do token; não recebe `usuarioId` e não lista vínculos de outras pessoas.
Serve à tela comum de reservas para apresentar o bloqueio. Mesmo sem essa consulta,
`POST /api/reservas` revalida sob lock e retorna `409` para usuário com mesa fixa.

## Rotas de administrador

Exigem perfil `ADMIN`. Usuário comum recebe `403`.

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

### GET /api/admin/usuarios?ativo=true

Implementado. Lista somente usuários ativos, ordenados por nome e, em caso de empate, por ID.
Retorna uma lista de objetos com `id`, `nome` e `email`, sem perfil nem credenciais.
O filtro `ativo` é opcional e assume `true`; `false` ou formato inválido retorna `400`.
O resultado vazio é válido. O backend revalida a situação do usuário no momento da atribuição.

### GET /api/admin/mesas

Implementado. Lista todas as mesas por código, inclusive inativas e fixas legadas sem atribuição.
Cada objeto contém `id`, `codigo`, `regiao`, `tipo`, `ativa` e `responsavel`.
`responsavel` é `null` quando não há vínculo; caso contrário contém somente `id`, `nome` e `email`.
O responsável continua visível se posteriormente ficar inativo. O catálogo comum não expõe esses dados pessoais.

### PUT /api/admin/mesas/{id}/responsavel

Implementado. Recebe `usuarioId` obrigatório e positivo. Fixa uma mesa ou troca seu responsável.
Retorna `200` com o mesmo formato da consulta administrativa de mesas.

- Exige mesa ativa e usuário existente e ativo; IDs inexistentes retornam `404`.
- Usuário com outra mesa fixa recebe `409`; não há transferência automática.
- Repetir o mesmo vínculo retorna `200`, desde que mesa e usuário continuem ativos.
- A atribuição passa a `FIXA` sem alterar `ativa` nem criar reserva.
- A mesa e o novo responsável não podem possuir reservas `PENDENTE` ou `CONFIRMADA` de hoje em diante, no fuso `America/Sao_Paulo`. Conflito retorna `409`, sem cancelar reservas.
- Mesa inativa, usuário inativo ou responsável alterado durante a espera por lock retornam `409`.
- A troca é atômica. Se recusada, o vínculo anterior é preservado.

### DELETE /api/admin/mesas/{id}/responsavel

Implementado. Remove a atribuição e altera o tipo para `LIVRE`, preservando `ativa` e as reservas.
Permite desvincular usuário inativo e regularizar mesa fixa legada sem responsável.
Retorna `200` com a mesa administrativa atualizada; repetir a remoção é permitido.
Mesa inexistente retorna `404`; mudança concorrente do responsável retorna `409` e exige atualização.

### PATCH /api/admin/mesas/{id}/estado

Implementado. Recebe `ativa` obrigatório, booleano, e retorna `200` com a mesa administrativa atualizada.
Ausência do campo ou request inválido retorna `400`; mesa inexistente retorna `404`.

- Inativação com qualquer responsável vinculado retorna `409`, inclusive se o usuário estiver inativo.
- Primeiro é necessário desfixar explicitamente. Não há desfixação automática.
- Reserva `PENDENTE` ou `CONFIRMADA` da mesa de hoje em diante impede a inativação (`409`).
- Ativação não atribui responsável nem cria reserva; preserva o tipo, inclusive em mesa fixa legada.
- Reservas passadas e canceladas são preservadas e não impedem a operação.

### GET /api/admin/reservas (planejado)

Lista reservas de todos os usuários.

| Query param | Obrigatório | Formato |
| --- | --- | --- |
| `data` | Não | `yyyy-MM-dd` |
| `usuarioId` | Não | inteiro |
| `status` | Não | `PENDENTE` \| `CONFIRMADA` \| `CANCELADA` |

`200`: lista no mesmo formato de `/api/reservas/minhas`, com o campo `solicitante` sempre presente.

### PATCH /api/admin/reservas/{id}/cancelamento (planejado)

Cancela a reserva de qualquer usuário (mesmas regras de estado de `PATCH /api/reservas/{id}/cancelamento`). `200` com a reserva `CANCELADA`; erros `401`, `403`, `404` e `409` como na rota do usuário.

As operações de responsável substituem o antigo contrato planejado de alteração direta de tipo.
Não há rota para criar reservas em nome de outra pessoa. As rotas administrativas implementadas
respondem `401` sem sessão válida e `403` para usuário comum. Violações de integridade ou
disputa de locks são convertidas em `409`, sem exposição de detalhes do banco.

---

## Resumo de rotas

| Método | Rota | Auth | Perfil |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Não | — |
| GET | `/api/auth/perfil` | Sim | Qualquer |
| GET | `/api/mesas` | Sim | Qualquer |
| GET | `/api/mesas/disponiveis` | Sim | Qualquer |
| GET | `/api/mesas/minha-fixa` | Sim | Qualquer |
| POST | `/api/reservas` | Sim | Qualquer |
| GET | `/api/reservas/minhas` | Sim | Qualquer |
| PATCH | `/api/reservas/{id}/cancelamento` | Sim | Dono |
| POST | `/api/admin/usuarios` | Sim | ADMIN |
| GET | `/api/admin/usuarios?ativo=true` | Sim | ADMIN |
| GET | `/api/admin/mesas` | Sim | ADMIN |
| PUT | `/api/admin/mesas/{id}/responsavel` | Sim | ADMIN |
| DELETE | `/api/admin/mesas/{id}/responsavel` | Sim | ADMIN |
| PATCH | `/api/admin/mesas/{id}/estado` | Sim | ADMIN |
| GET | `/api/admin/reservas` | Sim | ADMIN |
| PATCH | `/api/admin/reservas/{id}/cancelamento` | Sim | ADMIN |

## Verificação

Após a implementação, os cenários de [testes-mvp](testes-mvp.md) devem ser cobertos por testes automatizados do backend, e os exemplos deste documento devem ser validados contra a aplicação em execução.
