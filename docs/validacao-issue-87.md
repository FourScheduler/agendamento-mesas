# Roteiro de validação — issue #87

## O que foi alterado

O beneficiário pode cancelar sua reserva diária mesmo quando ela foi criada por
um administrador. A autorização continua sendo validada no backend; a ação foi
liberada também em Minhas reservas e no mapa.

A informação de que a reserva foi realizada pelo administrador foi mantida.
Foi retirada a orientação que exigia procurar a administração para alterá-la.

O cancelamento preserva o beneficiário, o autor, a mesa, a data e os timestamps
anteriores. Ele altera o status para CANCELADA e registra o momento do cancelamento.
O histórico permanece disponível. Mesa fixa continua sendo um vínculo
administrativo: cancelar uma diária não desfixa, não ativa e não remove responsável.

## Preparação

- Usar a versão da branch
  `Issue-87-Permitir-ao-beneficiario-cancelar-reservas-diarias-criadas-pelo-administrador`.
- Reiniciar o backend após atualizar o código e carregar a versão atual do frontend.
  Portas de desenvolvimento: frontend 4201 e backend 8081; comandos no README.
- Usar ambiente de desenvolvimento/homologação e cadastros de teste: um ADMIN,
  um beneficiário A e outro usuário comum B.
- Para criar as diárias, A deve estar ativo, sem mesa fixa vinculada e sem outra
  reserva na mesma data. Escolher uma mesa LIVRE/ativa e um dia útil dentro da janela
  de criação. Para testar Minhas reservas, usar uma diária CONFIRMADA futura ou de hoje.
- Usar uma nova reserva elegível para cada cenário de cancelamento concluído.
- Para alternar entre contas, usar sessões separadas do navegador ou sair e entrar
  novamente; não compartilhar token ou senha no registro dos testes.

## Testes manuais principais

| ID | O que fazer | Resultado esperado |
| --- | --- | --- |
| M01 | Como ADMIN, criar uma diária para A. Entrar como A e abrir Minhas reservas. | A diária aparece com a informação de autoria administrativa e oferece Cancelar. Não aparece a orientação de procurar a administração para realizar essa ação. |
| M02 | Em Minhas reservas, clicar em Cancelar e depois em Manter. | A reserva continua confirmada. Nenhum sucesso de cancelamento é mostrado. |
| M03 | Repetir a ação e confirmar em Sim, cancelar. | A ação fica em envio; sucesso só aparece após a resposta. Exibe Reserva cancelada e Mesa {codigo} foi liberada. A reserva passa a Cancelada, preserva a informação de autoria e não oferece novo cancelamento. |
| M04 | Criar outra diária para A como ADMIN. Como A, abrir o mapa na data dessa reserva e selecionar a mesa ocupada. Clicar em Cancelar reserva. | A ação está disponível ao beneficiário. Após sucesso, o painel fecha e a disponibilidade da data é atualizada; não é necessário recarregar manualmente a página. |
| M05 | Como B, abrir o mapa na data de uma diária de A e selecionar essa mesa. | B não recebe a ação de cancelar a reserva de A. A reserva de A permanece ativa. |
| M06 | Como ADMIN, cancelar uma diária de A. | O administrador continua autorizado e a disponibilidade é atualizada após a resposta. |
| M07 | Usar uma conta com mesa fixa atribuída, sem diária nessa mesa/data, e consultar Minhas reservas/mapa. | O vínculo fixo aparece sem ação de cancelamento/desfixação para o usuário comum. Ele permanece vinculado após os demais testes. |
| M08 | Consultar novamente uma diária cancelada e sua mesa na data correspondente. | A diária permanece no histórico como Cancelada. Se a mesa continuar LIVRE/ativa e sem outro impedimento, volta a estar disponível naquela data. |

## O que já é coberto automaticamente

- Beneficiário cancela diária criada por ADMIN; terceiro recebe 403 sem alteração.
- Administrador continua cancelando diárias de terceiros.
- Autoria, beneficiário, mesa, data e timestamps anteriores são preservados.
- Repetir o cancelamento retorna 409 e não muda novamente canceladaEm.
- Beneficiário e ADMIN disputando a mesma diária produzem um 200 e um 409,
  com um único cancelamento persistido.
- Falha dentro da transação desfaz o cancelamento e libera os locks.
- A API mantém cancelamento de diária passada e de PENDENTE legada, sem novo prazo.
- Diária antiga cuja mesa passou a ser FIXA/inativa pode ser cancelada sem alterar
  tipo, ativação, ocupante ou responsável. O usuário continua recebendo 403 ao tentar
  a operação administrativa de desfixação.
- Minhas reservas preserva o cartão de mesa fixa, exige confirmação e só mostra
  sucesso depois da resposta; mantém os critérios existentes de data/estado.
- Mapa permite cancelar CONFIRMADA/PENDENTE do beneficiário, inclusive criada por
  ADMIN; recusa terceiro e atualiza disponibilidade após sucesso.

Os cenários de dados legados, rollback e concorrência são preparados pela suíte
em bancos de teste. Eles não exigem modificar manualmente vínculos ou registros
do ambiente usado nos testes manuais principais.

## Limites desta entrega

- Não muda os filtros de Minhas reservas nem seus critérios existentes para
  apresentar cancelamento de acordo com data e estado.
- Não cria novas regras de prazo, tipo de reserva ou autenticação.
- Não permite cancelar reserva alheia nem desfazer vínculo fixo pelo usuário comum.
- Não inclui retenção/exclusão do histórico ou mudança da posição do botão.

## Evidências automáticas desta implementação

- Testes de reservas em H2: 58 passaram.
- Frontend: 129 testes passaram; build concluído com avisos de orçamento de CSS
  em arquivos não alterados por esta entrega.
- Suíte completa backend: 303 testes passaram, sem falhas, erros ou testes
  ignorados, incluindo H2 e MySQL. Maven `verify` e empacotamento concluídos.
- O MySQL foi validado em schema novo/exclusivo de testes, removido ao final.
- `git diff --check`: sem erros.
- Roteiro manual: preparado para execução pelo usuário; não marcado como executado.

## Registro da conferência manual

Para cada item M01–M08, registrar data, versão/commit, ambiente, perfil utilizado,
mesa/data da reserva, resultado obtido e eventual evidência. Não registrar senhas
ou tokens. Distinguir itens aprovados, falhos e não executados.
