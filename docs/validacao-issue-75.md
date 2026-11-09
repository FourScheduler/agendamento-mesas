# Validação da issue #75 — datas e fuso no frontend

## O que mudou

- Gestão consulta a ocupação do dia de São Paulo, inclusive após as 21h, quando UTC já pode estar no dia seguinte.
- Minhas reservas compara datas `yyyy-MM-dd`: hoje continua nas futuras até a meia-noite em São Paulo. O horário local do navegador não participa dessa classificação.
- O calendário compartilhado atualiza o dia na meia-noite de São Paulo, ao recuperar foco/visibilidade e antes das operações. Temporizador e eventos são removidos ao destruir o serviço.
- Lista e mapa atualizam data mínima, limite inclusivo de 15 dias e disponibilidade sem trocar a data consultada. Se o dia escolhido ficou no passado, a seleção deixa de permitir confirmação e aparece a validação existente.
- Busca, filtros, período personalizado e solicitante permanecem no contexto da tela. A gestão reconsulta a ocupação do novo dia; Minhas reservas reclassifica os dados carregados.
- Backend, banco, contratos HTTP e permissões de cancelamento permanecem com suas regras vigentes. UTC continua sendo usado para a aritmética de datas sem horário, evitando depender do fuso do navegador.

## Cenários para conferir na interface

Use ambiente de desenvolvimento e contas/dados de teste. As reservas são diárias. Mesa fixa não é uma reserva diária e não ganha ação de desfixação.

| Caso | Passos | Resultado esperado |
| --- | --- | --- |
| M01 — após 21h | Após 21h de São Paulo, abrir gestão e conferir no Network o parâmetro `data` de `/api/mesas/com-ocupacao`. Abrir Minhas reservas com uma reserva de hoje. | Consulta usa o dia de São Paulo; a reserva de hoje está nas futuras e mantém suas ações elegíveis. Exemplo: `2026-11-07T01:30:00Z` ainda é `2026-11-06` em São Paulo. |
| M02 — gestão aberta | Deixar gestão aberta na virada do dia, com busca e filtro rápido selecionados. | Reconsulta ocupação com a nova data, preservando busca e filtro. Não mantém ocupação do dia anterior. |
| M03 — classificação | Manter Minhas reservas aberta com reservas de hoje e de dias futuros. Aguardar a meia-noite de São Paulo. | A reserva do dia anterior passa para passadas; as futuras continuam na lista. Filtros de status e período personalizado permanecem. |
| M04 — data vencida | Na lista e no mapa, selecionar mesa para hoje e manter a tela aberta até depois da meia-noite. | Data permanece visível, aparece “Data deve ser hoje ou futura.” e não é enviado POST para essa data. Não há troca automática para amanhã. |
| M05 — data futura | Selecionar uma data futura válida, aplicar uma busca e manter a tela aberta até a virada ou retornar após suspensão da aba. | Mesma data e busca são preservadas; disponibilidade é atualizada e limites avançam. Aguardar a consulta antes de selecionar/confirmar a mesa. |
| M06 — fim de semana | Conferir sexta/sábado e domingo/segunda; abrir uma nova página no fim de semana. | Tela aberta não troca a data escolhida. Sábado/domingo continuam bloqueados; uma página nova sem data no contexto inicia no próximo dia útil. |
| M07 — janela | Conferir hoje, hoje + 15 e hoje + 16, antes e após a virada. Escolher bordas que sejam dias úteis. | Hoje e +15 são válidos; +16 é recusado. Limites se atualizam; fim de semana continua recusado mesmo dentro da janela. |
| M08 — outro fuso | Usar emulação de fuso do navegador em ambiente de teste, por exemplo `Asia/Tokyo` ou `Pacific/Honolulu`, e repetir M01–M07. | Os dias consultados e classificados continuam seguindo São Paulo. Não alterar o fuso global da máquina. |

Aguardar a virada real ou usar emulação/relógio controlado no ambiente de teste. Não alterar datas do banco ou configurações globais para simular os casos.

## Testes automatizados

Os testes usam relógio controlado para cobrir virada UTC versus São Paulo, sexta/sábado, domingo/segunda, troca de ano, retorno à aba, destruição do serviço, classificação/ações de Minhas reservas, preservação de filtros e revalidação antes do POST.

Na pasta `frontend/`:

```powershell
npm.cmd test -- --watch=false
npm.cmd run build
```

### Resultados em 06/11/2026

| Comando | Resultado |
| --- | --- |
| `npm.cmd test -- --watch=false` | 140 testes passaram, em 16 arquivos. |
| Testes relacionados com `TZ=Pacific/Honolulu` apenas no processo de teste | 83 testes passaram, em 7 arquivos. |
| `npm.cmd run build` | Passou; permanecem os avisos de orçamento de CSS em Minhas reservas, planta, agendamento, mapa e gestão. Esses estilos não foram alterados nesta issue. |
| `git diff --check` | Sem erros de whitespace. |

Comando da execução em outro fuso, em um processo PowerShell separado, dentro de `frontend/`:

```powershell
$env:TZ = 'Pacific/Honolulu'
npm.cmd test -- --watch=false --include=src/app/features/reservas/*.spec.ts --include=src/app/features/mesas/admin-mesa-page.spec.ts --include=src/app/features/minhas-reservas/minhas-reservas-page.spec.ts --include=src/app/features/mapa/reserva-diaria.spec.ts --include=src/app/features/agendamento/agendamento-page.spec.ts
```

Não foi alterada a configuração global de fuso. Backend e banco não foram modificados; os testes do backend não foram executados nesta entrega. Os cenários manuais M01–M08 ainda precisam ser conferidos na aplicação: não devem ser considerados executados apenas porque os testes automatizados passaram. Registrar também os resultados do CI no PR quando houver publicação.
