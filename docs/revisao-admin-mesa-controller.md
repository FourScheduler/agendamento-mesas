# Revisão dos contratos administrativos — issue #61

## Avaliação e escopo

`AdminMesaController` já delega fixação, desfixação, alteração de responsável,
tipo e ativação ao `MesaService`. A autorização ADMIN é aplicada pelo
`SecurityConfig` a `/api/admin/**`. Não foi identificada necessidade de
reescrever o controller ou transferir regras de negócio entre camadas.

Foram identificados dois pontos concretos:

- O tratamento compartilhado de entrada inválida orientava verificar `mesaId`
  e `data`, mesmo quando a requisição administrativa usava `usuarioId`, `tipo`
  ou `ativa`. Tipo inválido não retornava a orientação documentada.
- Os testes administrativos não cobriam sistematicamente autenticação,
  autorização, formato inválido e recurso inexistente nas cinco operações.

## Solução

`AdminMesaExceptionHandler` trata somente erros de leitura do corpo e de
conversão do ID em `AdminMesaController`. A orientação de campo usa o caminho
estruturado da exceção de desserialização, sem expor o valor recebido ou
detalhes internos. Quando não há campo identificável, usa uma orientação geral
sobre o corpo JSON. Os erros das outras APIs continuam no handler existente.

`AdminMesaApiTests` cobre os contratos e a preservação dos dados após recusas,
além dos formatos de sucesso. As validações de campos ausentes no service,
as mensagens de negócio e os status existentes são preservados. Os exemplos
de tipo ausente e tipo inválido na documentação agora distinguem esses casos.

Não há alteração de rotas, DTOs, regras, transações, ordem de bloqueios,
persistência, frontend, dependências ou schema. A revisão não cria novos tipos
de mesa nem antecipa o desenho da interface da issue #69.

## Validação

Validação local em 05/11/2026, com Java 21:

- `AdminMesaApiTests`: 52 testes passaram.
- Maven `verify`: 186 testes executados com sucesso e empacotamento concluído.
  As 93 execuções condicionais de MySQL foram ignoradas por ausência de
  `TEST_MYSQL_URL`. Autenticação, vínculo único, reservas e concorrência em H2
  passaram junto com os testes de contrato.
- `git diff --check`: sem erros.

Foi usada a configuração pública do Maven indicada no README. No Windows,
`jdk.net.unixdomain.tmpdir` foi apontado, apenas nessa execução, para um caminho
temporário inexistente, evitando o problema local de sockets do agente Java.
Nenhuma configuração global foi alterada.

As suítes MySQL continuam disponíveis para execução com schema exclusivo de
testes, conforme `docs/testes-mvp.md` e README. O frontend não foi alterado.
