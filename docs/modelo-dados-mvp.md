# Modelo de dados e demonstração do MVP de mesas

Definição do banco MySQL do MVP: tabelas, relacionamentos, estados e conjunto de demonstração.

## Tabelas

### `usuarios`

| Coluna | Tipo | Restrições |
| --- | --- | --- |
| `id` | BIGINT | PK, auto incremento. |
| `nome` | VARCHAR(120) | NOT NULL. |
| `email` | VARCHAR(160) | NOT NULL, UNIQUE. |
| `senha_hash` | VARCHAR(100) | NOT NULL. Hash BCrypt; a senha em texto puro nunca é persistida nem versionada. |
| `perfil` | VARCHAR(20) | NOT NULL. `USUARIO` ou `ADMIN`. |
| `ativo` | BOOLEAN | NOT NULL, padrão `TRUE`. Usuário inativo não autentica. |

### `mesas`

| Coluna | Tipo | Restrições |
| --- | --- | --- |
| `id` | BIGINT | PK, auto incremento. |
| `codigo` | VARCHAR(10) | NOT NULL, UNIQUE. Ex.: `001`. |
| `regiao` | VARCHAR(40) | NOT NULL. Localização física (demonstração: `PAULISTA`). |
| `tipo` | VARCHAR(10) | NOT NULL. `LIVRE` ou `FIXA`. |
| `ativa` | BOOLEAN | NOT NULL, padrão `TRUE`. |
| `planta` | VARCHAR(20) | Referência visual da planta (demonstração: `PAULISTA`). |
| `posicao_x` | INTEGER | Referência visual (coordenada x na planta). |
| `posicao_y` | INTEGER | Referência visual (coordenada y na planta). |

`planta`/`posicao_x`/`posicao_y` servem apenas ao desenho do frontend; não participam de regra de negócio.

### `reservas`

| Coluna | Tipo | Restrições |
| --- | --- | --- |
| `id` | BIGINT | PK, auto incremento. |
| `mesa_id` | BIGINT | FK NOT NULL → `mesas(id)`. Uma reserva sempre aponta uma mesa. |
| `usuario_id` | BIGINT | FK NOT NULL → `usuarios(id)`. Relação reserva → usuário é obrigatória (decisão aprovada: "usuário responsável pela reserva"). |
| `data` | DATE | NOT NULL. Dia inteiro reservado (`yyyy-MM-dd`). |
| `status` | VARCHAR(10) | NOT NULL. `PENDENTE`, `CONFIRMADA` ou `CANCELADA`. |
| `criada_em` | DATETIME | NOT NULL. Data/hora local `America/Sao_Paulo`. |
| `confirmada_em` | DATETIME | NULL, preenchido na confirmação. |
| `cancelada_em` | DATETIME | NULL, preenchido no cancelamento. |

#### Estados da reserva

```
PENDENTE ──confirmacao──▶ CONFIRMADA
    │                        │
    └─────cancelamento───────┴──▶ CANCELADA
```

- `PENDENTE`: criada, aguardando confirmação. Bloqueia a mesa e a data do usuário.
- `CONFIRMADA`: confirmada pelo dono ou por administrador.
- `CANCELADA`: estado final; não bloqueia mesa nem data do usuário.
- Transições fora do diagrama retornam `409`.

#### Restrições de aplicação (não há índice único parcial em MySQL)

A unicidade "uma reserva não cancelada por mesa/data" e "uma reserva não cancelada por usuário/data" não é expressa com `UNIQUE` no MySQL (exigiria excluir `CANCELADA`). A aplicação valida antes de gravar (`409` em conflito). Índices de apoio:

- `idx_reservas_mesadata` em (`mesa_id`, `data`)
- `idx_reservas_usuariodata` em (`usuario_id`, `data`)

## Regras de consulta derivadas

- `/api/mesas` retorna mesas com `ativa = TRUE` (fixas e livres).
- `/api/mesas/disponiveis?data=D` retorna mesas com `ativa = TRUE` E `tipo = 'LIVRE'` E sem reserva em `D` com status em (`PENDENTE`, `CONFIRMADA`).
- `/api/reservas/minhas` filtra por `usuario_id` do token.

## Seed de demonstração

> Os dados abaixo são de **demonstração**, para desenvolvimento e testes. Não representam a planta oficial nem o quadro real de mesas.

### Região PAULISTA

- **115 mesas**, códigos `001` a `115`, todas na região `PAULISTA`.
- **17 mesas `LIVRE`** (códigos `044`, `053`, `054`, `055`, `077`, `078`, `080`, `082`, `083`, `084`, `085`, `086`, `096`, `097`, `105`, `106`, `107`): elegíveis para reserva — refletem o quadro atual de mesas livres.
- **98 mesas `FIXA`** (todas as demais): designadas a pessoas que vêm 3 ou mais dias por semana; aparecem na planta mas nunca em `/api/mesas/disponiveis`.
- Todas `ativa = TRUE` no seed.
- Posições visuais distribuídas em coordenadas simples da planta `PAULISTA` (x de 100 a 820, y de 80 a 740).

### Usuários

| Nome | E-mail | Perfil | Observação |
| --- | --- | --- | --- |
| Administrador | `admin@exemplo.com` | `ADMIN` | Acesso às rotas `/api/admin/**`. |
| Maria Souza | `maria.souza@exemplo.com` | `USUARIO` | Exemplo de usuário comum. |
| João Pereira | `joao.pereira@exemplo.com` | `USUARIO` | Exemplo de usuário comum. |

- Senha de demonstração de todos os usuários do seed: `senha1234` (guardada apenas como hash BCrypt no banco; o texto puro existe só como comentário no SQL de desenvolvimento). Em qualquer ambiente real as senhas vêm de variável/segredo fora do versionamento.
- Nenhuma reserva no seed; reservas são criadas pelos testes e pelo uso.

### Planta de demonstração

O arquivo de planta (SVG/coordenadas) é material de demonstração para o frontend. O desenho **não deve ser apresentado como planta oficial**; a planta oficial será fornecida pelo negócio em etapa futura.
