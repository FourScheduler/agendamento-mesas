# Catálogo e planta de demonstração

`GET /api/mesas` exige o JWT do login local e retorna todas as mesas, inclusive inativas,
ordenadas por `codigo`. Campos: `id`, `codigo`, `regiao`, `tipo` (`LIVRE`/`FIXA`),
`ativa` e `referenciaVisual: { planta, x, y }`. Não recebe período e não informa ocupação.

O catálogo e a planta são inteiramente fictícios. Os 115 códigos (`001` a `115`) e
suas coordenadas vêm do seed SQL, nunca de uma lista duplicada em Angular.
As coordenadas são pixels relativos ao canto superior esquerdo de cada planta;
o cartão da mesa ocupa 180 × 92 unidades no desenho. Plantas diferentes têm espaços
de coordenadas independentes. O canvas de Tamboré mede 1670 × 1972 unidades, com
escala proporcional à largura disponível e rolagem horizontal abaixo de 1000px.
Após `V4`, x varia de 24 a 1402 e y de 24 a 1857, sem sobreposição entre mesas.
São 72 posições no bloco esquerdo e 43 no direito, com corredor central e área de entrada.
Se um servidor ainda retornar a grade compacta anterior a `V4`, o consumidor identifica
esse sistema de coordenadas, usa cartões de 64 × 44 e omite as estruturas da planta
nova. Assim, atualizar o frontend antes do backend não causa sobreposição. A disposição
do SVG aparece quando a API retorna as coordenadas atualizadas.

## Carga reproduzível

- `db/migration/V1` cria a estrutura em todos os ambientes.
- Apenas o perfil `dev` inclui `db/seed`: `V2` cria usuários fictícios e 115 mesas;
  `V3` torna `005` inativa, preservando seu identificador, código e posição.
  `V4` atualiza exclusivamente as posições das mesas para o padrão do SVG de referência,
  preservando códigos, IDs, tipos e estado ativo. Nenhum nome do SVG foi incorporado.
- O perfil `test` usa estrutura vazia por padrão. `CatalogoMesasTests` habilita
  explicitamente o mesmo seed em bancos H2 isolados no modo MySQL.
- `prod` não carrega demonstração. Não habilitar `dev` junto com `prod`.
- Flyway aplica cada versão uma vez. Reiniciar não duplica nem redefine dados.
  Migrations existentes não foram reescritas; bancos de desenvolvimento já criados recebem
  as versões pendentes, incluindo `V4` após reiniciar o backend com o perfil `dev`.
- Em bancos vazios carregados com as mesmas migrations, IDs, códigos e posições
  coincidem (IDs 1 a 115). O cliente deve usar o `id` recebido, sem calculá-lo pelo código
  ou índice da lista. Não se promete identidade entre bancos com cargas manuais diferentes.
- São 17 mesas livres ativas, 97 fixas ativas e uma fixa inativa (`005`).
  Os usuários são exemplos, sem dados pessoais reais; não há reservas no seed.

Para desenvolvimento, configure o MySQL conforme `backend/.env.example` e execute
`mvnw.cmd spring-boot:run` em `backend` (8081). A carga não exige scripts manuais adicionais.
Para testar: `mvnw.cmd -s .mvn/settings-public.xml -gs .mvn/settings-public.xml test`.
Os testes automatizados usam H2; a execução contra MySQL requer uma instância local.

## Inatividade, seleção e data

`ativa` é a condição administrativa da mesa. `tipo=LIVRE` indica elegibilidade de catálogo, não ausência de reservas. Fixas e inativas permanecem visíveis e não selecionáveis. O catálogo completo não tem disponibilidade global.

Reservas são de **dia inteiro**. A planta combina `GET /api/mesas` com `GET /api/mesas/disponiveis?data=yyyy-MM-dd`. Mesas livres ausentes da disponibilidade são exibidas como ocupadas na data. Falha ou carregamento da consulta impede selecionar mesas. Trocar a data, o token ou atualizar a disponibilidade cancela consultas anteriores e limpa a seleção.

`ReservaService.criar` revalida mesa, usuário, data e conflitos sob locks, em uma única transação. O frontend apenas apresenta a disponibilidade consultada; a confirmação é a autoridade final. Uma reserva de D não ocupa D+1, sem necessidade de alterar seu status à meia-noite.

## Consumidor Angular

`MapaPage`, na rota protegida `/mapa`, permite escolher o dia e hospeda o componente abaixo. `AgendamentoPage`, em `/agendamento`, apresenta a lista de mesas disponíveis e o resumo da reserva. As duas telas compartilham `ReservaDiaria`, usam o mesmo POST e preservam a data ao navegar entre lista e planta:

```html
<app-planta-mesas [token]="tokenDaSessao" [data]="dataEscolhida"
  [atualizacao]="versaoDaConsulta" (mesaSelecionada)="selecionarMesa($event)"
  (disponibilidadeConsultada)="registrarDisponibilidade($event)" />
```

O login fica em `/login`, com sessão compartilhada por `AuthService`. O token é mantido em `localStorage`; os guards recuperam a identidade real em `GET /api/auth/perfil` antes de abrir as rotas protegidas após recarregar. Sair ou receber `401` limpa o token e volta ao login. A barra de navegação e a página preparatória `/minhas-reservas` da develop foram preservadas.

Após selecionar uma mesa disponível, o usuário revisa mesa, dia inteiro e solicitante e envia `POST /api/reservas` com `mesaId` e `data`. Administradores podem pesquisar usuários ativos por nome ou e-mail e informar `solicitanteId`; usuários comuns sempre reservam para si. O botão e a data ficam bloqueados durante o envio. Sucesso só é exibido após a resposta de confirmação, com identificação da reserva.

Em `409`, a seleção é limpa e a disponibilidade é atualizada; `400` mostra a validação e `401` exige novo login. Falhas de rede/servidor não exibem sucesso e provocam nova consulta. O catálogo e os estados de ocupação vêm exclusivamente da API, sem fallback fictício.

Testes: `npm.cmd test -- --watch=false`; compilação: `npm.cmd run build`.

`disponibilidadeConsultada` emite a data somente após concluir a consulta. O
hospedeiro registra essa referência em `ReservaDiaria`; mudar a data ou atualizar
limpa a referência e impede confirmar uma seleção baseada na consulta anterior.
Datas inválidas exibem erro junto ao campo, sem consultar ou reaproveitar mesas.

## Padrão da planta

O SVG fornecido é referência de geometria e apresentação, sem nomes de pessoas ou
reservas incorporadas ao produto. O frontend contém somente a geometria decorativa
(`planta-layout.ts`: entrada, parede e duas estruturas). O catálogo permanece na API.
Mesas, marcadores de seleção, entrada, parede e estruturas são elementos HTML
estilizados com CSS; não são imagens sobrepostas. A apresentação usa os componentes
standalone, os tokens e a fonte Nunito do Portal, seguindo `agendamento-salas`.
Cabeçalho e legenda se adaptam à tela sem acompanhar a escala do desenho. A pasta
de imagens exportadas do Figma foi removida; apenas o logo do Portal permanece como PNG.
Cada mesa usa o código recebido no canto superior esquerdo, estado ao centro e
marcador no canto direito. Livre tem borda verde, fixa tem fundo cinza, inativa usa
borda tracejada e seleção tem borda laranja com confirmação visual. Verde representa disponibilidade na data consultada. Mesas ocupadas têm estado próprio em laranja. Nenhum nome ou reserva do SVG é incorporado ao produto.
