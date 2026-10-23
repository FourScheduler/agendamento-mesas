# Contratos da API do MVP de mesas

Contratos do backend (Spring Boot, porta `8081`, prefixo `/api`). Este documento define requests, responses e exemplos de erro para implementação. Nada está implementado nesta etapa; os exemplos são o alvo do backend e do frontend.

## Convenções

- JSON em `UTF-8` em todas as rotas.
- Datas no formato ISO `yyyy-MM-dd`; data/hora local sem offset no formato `yyyy-MM-dd'T'HH:mm:ss`; fuso único `America/Sao_Paulo` (ver [fluxo-mvp](fluxo-mvp.md)).
- Todas as rotas exigem autenticação: header `Authorization: Bearer <token>`. Exceção: `POST /api/auth/login`. Sem token ou com token inválido: `401`.
- O solicitante é sempre o usuário do token. Nenhum request aceita `usuarioId`/`solicitante` editável.
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
| `403` | Usuário autenticado sem papel adequado (rota admin acessada por usuário comum). |
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
    "papel": "USUARIO"
  }
}
```

### Erros

| Status | Situação | Exemplo de `detail` |
| --- | --- | --- |
| `400` | `email` ou `senha` ausentes. | `Campo 'email' é obrigatório.` |
| `401` | Credenciais inválidas (e-mail não existe ou senha errada — mesma resposta para não vazar existência). | `Credenciais inválidas.` |

---

## GET /api/mesas

Lista todas as mesas **ativas** para a planta (códigos, localização, tipo e posição visual). O cliente diferencia `LIVRE` de `FIXA` pelo campo `tipo`; mesas inativas não são retornadas.

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
      "x": 340,
      "y": 320
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
      "x": 660,
      "y": 140
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
      "x": 340,
      "y": 320
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

Cria uma reserva em estado `PENDENTE` para a data inteiro. A confirmação é um passo separado (`POST /api/reservas/{id}/confirmacao`). O solicitante vem do token.

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
  "status": "PENDENTE",
  "data": "2026-10-28",
  "criadaEm": "2026-10-23T14:30:00",
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
| `409` | Mesa já tem reserva não cancelada na data. | `A mesa 053 já possui uma reserva não cancelada em 2026-10-28.` |
| `409` | Usuário já tem reserva não cancelada na mesma data. | `Você já possui uma reserva não cancelada em 2026-10-28.` |

---

## POST /api/reservas/{id}/confirmacao

Confirma a reserva própria em estado `PENDENTE`, tornando-a `CONFIRMADA`. Só o dono pode confirmar.

### Response `200`

```json
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
| `401` | Sem ou com token inválido. | |
| `404` | Reserva inexistente. | `Reserva 999 não encontrada.` |
| `403` | Reserva existe mas pertence a outro usuário. | `Reserva não pertence ao usuário autenticado.` |
| `409` | Reserva já `CONFIRMADA` ou `CANCELADA`. | `Reserva 10 já foi confirmada.` |

---

## GET /api/reservas/minhas

Lista as reservas do usuário autenticado, com filtro opcional por status e data.

### Query params

| Campo | Obrigatório | Formato | Observação |
| --- | --- | --- | --- |
| `status` | Não | `PENDENTE` \| `CONFIRMADA` \| `CANCELADA` | Filtra por estado. |
| `data` | Não | `yyyy-MM-DD` | Filtra por data da reserva. |

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
| `400` | `status` ou `data` com valor inválido. |
| `401` | Sem ou com token inválido. |

---

## PATCH /api/reservas/{id}/cancelamento

Cancela a reserva própria, em qualquer estado não cancelado e a qualquer momento. A mesa volta a ficar disponível.

### Response `200`

```json
{
  "id": 10,
  "status": "CANCELADA",
  "data": "2026-10-28",
  "criadaEm": "2026-10-23T14:30:00",
  "canceladaEm": "2026-10-24T09:00:00",
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
| `401` | Sem ou com token inválido. | |
| `404` | Reserva inexistente. | `Reserva 999 não encontrada.` |
| `403` | Reserva de outro usuário. | `Reserva não pertence ao usuário autenticado.` |
| `409` | Reserva já `CANCELADA` (idempotência opcional; escolha documentada: recusar duplicado). | `Reserva 10 já está cancelada.` |

---

## Rotas de administrador

Exigem token com papel `ADMIN`. Usuário comum recebe `403`.

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
    "x": 340,
    "y": 320
  }
}
```

#### Erros

| Status | Situação | Exemplo de `detail` |
| --- | --- | --- |
| `400` | `tipo` ausente ou diferente de `FIXA`/`LIVRE`. | `Campo 'tipo' deve ser FIXA ou LIVRE.` |
| `401` | Sem ou com token inválido. | |
| `403` | Usuário sem papel `ADMIN`. | `Acesso restrito a administradores.` |
| `404` | Mesa inexistente. | `Mesa 999 não encontrada.` |

> Efeito sobre reservas existentes ao tornar `FIXA` uma mesa com reservas futuras é pendência de negócio (ver [fluxo-mvp](fluxo-mvp.md)). A implementação deve validar antes de aplicar a mudança.

---

## Resumo de rotas

| Método | Rota | Auth | Papel |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Não | — |
| GET | `/api/mesas` | Sim | Qualquer |
| GET | `/api/mesas/disponiveis` | Sim | Qualquer |
| POST | `/api/reservas` | Sim | Qualquer |
| POST | `/api/reservas/{id}/confirmacao` | Sim | Dono |
| GET | `/api/reservas/minhas` | Sim | Qualquer |
| PATCH | `/api/reservas/{id}/cancelamento` | Sim | Dono |
| GET | `/api/admin/reservas` | Sim | ADMIN |
| PATCH | `/api/admin/reservas/{id}/cancelamento` | Sim | ADMIN |
| PATCH | `/api/admin/mesas/{id}/tipo` | Sim | ADMIN |

## Verificação

Após a implementação, os cenários de [testes-mvp](testes-mvp.md) devem ser cobertos por testes automatizados do backend, e os exemplos deste documento devem ser validados contra a aplicação em execução.
