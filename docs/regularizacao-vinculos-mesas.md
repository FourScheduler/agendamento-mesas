# Regularização de vínculos de mesas — issue #80

O cadastro do usuário é identificado pelo ID interno. O e-mail permite conferir
a pessoa na busca administrativa; nome e `ocupante` são apresentação e não
substituem `mesas.responsavel_id`. Não é necessário criar outra coluna ou mudar
o login para aplicar essa regra.

## Levantamento somente de leitura

Execute no banco do ambiente que será revisado. As consultas não corrigem nem
escolhem vínculos automaticamente.

```sql
-- Mesas fixas cuja identidade ainda precisa ser confirmada.
SELECT id, codigo, ativa, ocupante
FROM mesas
WHERE tipo = 'FIXA' AND responsavel_id IS NULL
ORDER BY codigo;

-- Vínculos com tipo inconsistente: também bloqueiam novas reservas.
SELECT m.id, m.codigo, m.tipo, m.ativa, u.id AS usuario_id, u.nome, u.email
FROM mesas m
JOIN usuarios u ON u.id = m.responsavel_id
WHERE m.tipo <> 'FIXA'
ORDER BY m.codigo;

-- Conferência de unicidade; a constraint V9 deve impedir esses registros.
SELECT responsavel_id, COUNT(*) AS quantidade
FROM mesas
WHERE responsavel_id IS NOT NULL
GROUP BY responsavel_id
HAVING COUNT(*) > 1;
```

Cada pendência exige confirmar com a administração o e-mail do cadastro correto.
Homônimos, divergências de nome, usuário inativo ou identidade não confirmada
permanecem pendentes. Não criar vínculo por comparação automática de nomes.

## Atribuir uma mesa fixa sem responsável

1. Entrar com perfil ADMIN e abrir Gestão.
2. Localizar a mesa e conferir código, tipo, ativação e responsável.
3. Se estiver inativa, revisar a ativação antes de atribuir; a API exige mesa ativa.
4. Clicar no lápis **Atribuir responsável** da mesa FIXA sem vínculo.
5. Buscar o e-mail confirmado, conferir nome e e-mail e selecionar a pessoa.
6. Confirmar. A operação envia `usuarioId` ao endpoint existente
   `PATCH /api/admin/mesas/{id}/responsavel`.
7. Conferir o ID/nome/e-mail retornado pela API. Em recusa, preservar o estado
   anterior e encaminhar a pendência para revisão.

A API revalida usuário ativo, unicidade do vínculo, mesa ativa, reservas
incompatíveis da mesa/usuário e concorrência dentro da transação. Nenhuma reserva
é cancelada, apagada ou transferida automaticamente para permitir a atribuição.

Para vínculo legado em uma mesa `LIVRE`, a administração precisa revisar o estado
correto. A operação de tipo para `LIVRE` remove explicitamente o responsável, com
as validações e locks do service; a fixação/atribuição correta deve usar os
contratos administrativos. Não fazer `UPDATE` direto para contornar as regras.

## Validação após a regularização

- A mesa aparece em Minhas reservas para o ID do responsável, sem depender de nome.
- Usuário e administrador em nome desse beneficiário recebem `409` com
  `code: USUARIO_COM_MESA_FIXA`, identificação da mesa e orientação de desvinculação.
- Não aparece falso sucesso e não há uma nova reserva persistida.
- Ao remover o vínculo explicitamente, o usuário passa pelas demais validações
  normais de reserva. Mesa fixa inativa continua bloqueando enquanto houver vínculo.

Reproduzir os cenários com dados fictícios em testes H2/MySQL e na interface.
Não criar reservas reais para testar sem verificar o ambiente e o resultado
esperado. Dados pessoais e credenciais não pertencem ao roteiro versionado;
mantenha as evidências de regularização restritas ao ambiente revisado.

## Referências

- [Fluxo e regras](fluxo-mvp.md)
- [Contratos da API](contratos-api-mvp.md)
- [Cenários de teste](testes-mvp.md)
