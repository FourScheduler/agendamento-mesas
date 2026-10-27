# Modelo de dados e demonstração do MVP de mesas

Definição do banco MySQL do MVP: tabelas, relacionamentos, estados e conjunto de demonstração.

Reservas são de dia inteiro, armazenadas em `reservas.data`. A criação confirma diretamente e preserva a estrutura existente; nenhuma migration nova é necessária para a issue #7.

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
| `regiao` | VARCHAR(40) | NOT NULL. Localização física (demonstração: `TAMBORÉ`). |
| `tipo` | VARCHAR(10) | NOT NULL. `LIVRE` ou `FIXA`. |
| `ativa` | BOOLEAN | NOT NULL, padrão `TRUE`. |
| `planta` | VARCHAR(20) | Referência visual da planta (demonstração: `TAMBORÉ`). |
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
POST /api/reservas → CONFIRMADA → CANCELADA (cancelamento em entrega futura)
```

- `CONFIRMADA`: persistida com usuário e mesa; bloqueia somente a data reservada.
- `PENDENTE`: estado legado, não criado pelo POST atual; continua bloqueando mesa e usuário na data.
- `CANCELADA`: preserva o histórico e não bloqueia mesa nem usuário, mesmo sem `cancelada_em` em dados legados.
- Uma reserva confirmada para D não bloqueia D+1. Seu status não precisa mudar à meia-noite.

#### Restrições de aplicação (não há índice único parcial em MySQL)

A unicidade "uma reserva não cancelada por mesa/data" e "uma reserva não cancelada por usuário/data" não é expressa com `UNIQUE` no MySQL (exigiria excluir `CANCELADA`). A aplicação serializa a confirmação bloqueando usuário e mesa, nessa ordem, em transação `READ_COMMITTED`. Reconsulta os conflitos depois dos locks e grava atomicamente (`409` em conflito). O lock na linha da mesa protege também a primeira reserva, sem depender de linhas existentes em `reservas`. Consulta seguida de insert sem esse bloqueio não é suficiente. Índices de apoio:

- `idx_reservas_mesadata` em (`mesa_id`, `data`)
- `idx_reservas_usuariodata` em (`usuario_id`, `data`)

## Regras de consulta derivadas

- `/api/mesas` retorna todas as mesas (fixas, livres e inativas), ordenadas por código, sem disponibilidade temporal.
- `/api/mesas/disponiveis?data=D` retorna mesas com `ativa = TRUE` E `tipo = 'LIVRE'` E sem reserva em `D` com status em (`PENDENTE`, `CONFIRMADA`).
- `/api/reservas/minhas` filtra por `usuario_id` do token.

## Seed de demonstração

> Os dados abaixo são de **demonstração**, para desenvolvimento e testes. Não representam a planta oficial nem o quadro real de mesas.

### Região TAMBORÉ

- **115 mesas**, códigos `001` a `115`, todas na região `TAMBORÉ`.
- **17 mesas `LIVRE`** (códigos `044`, `053`, `054`, `055`, `077`, `078`, `080`, `082`, `083`, `084`, `085`, `086`, `096`, `097`, `105`, `106`, `107`): elegíveis para consulta de disponibilidade; conjunto inteiramente fictício.
- **98 mesas `FIXA`** (todas as demais): demonstração sem vínculo com pessoas reais; aparecem na planta e não são elegíveis para reserva.
- Após `V3`, `005` é inativa; as demais 114 são ativas. Ver [carga e contrato visual](catalogo-demonstracao.md).
- Após `V4`, posições da planta `TAMBORÉ` seguem a geometria de referência: x de 24 a 1402 e y de 24 a 1857, em dois blocos com corredor e entrada. Ver [contrato visual](catalogo-demonstracao.md).

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
