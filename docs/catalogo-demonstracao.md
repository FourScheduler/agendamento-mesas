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

## Inatividade, seleção e período

`ativa` é a condição administrativa da mesa. `tipo=LIVRE` indica elegibilidade de
catálogo, não ausência de reservas. Uma mesa inativa permanece visível e identificável.
`MesaService.obterParaReserva(id)` recusa mesas inativas ou fixas com conflito (`409`),
e IDs inexistentes com `404`. Esse método é o ponto de validação do catálogo para o
futuro serviço de reservas; não grava uma reserva nem afirma disponibilidade.

A decisão atual é **reservar por horário**. Ocupação deve ser calculada pelas reservas
que se sobrepõem ao período solicitado, sem alterar `ativa`, `tipo` ou criar um booleano
global `disponivel`. Esta entrega não implementa criação de reservas nem consulta temporal.
As seções antigas de reservas por dia em outros documentos e a coluna `reservas.data`
precisam de evolução própria para o contrato por horário antes de implementar esse fluxo.

## Consumidor Angular

`MesaService.listar(token)` consulta exclusivamente `/api/mesas` com Bearer token.
`PlantaMesas` é um componente standalone reutilizável para o fluxo autenticado:

```html
<app-planta-mesas [token]="tokenDaSessao" (mesaSelecionada)="selecionarMesa($event)" />
```

O hospedeiro importa `PlantaMesas` e fornece o token retornado por `/api/auth/login`.
O componente não armazena credenciais; cancela a consulta anterior e limpa a seleção
quando o token muda. Estados de carregamento, lista vazia e falha/401 são explícitos.
Agrupa as mesas pela planta da resposta, desenha pelas coordenadas e emite a mesa com
seu ID original. Fixas e inativas são visíveis, mas não selecionáveis. Selecionar
uma mesa livre ainda exige validar disponibilidade por período no futuro fluxo de reserva.

`CatalogoPage`, na rota inicial `/`, hospeda o componente após o login local por
e-mail e senha. O token permanece somente em memória: sair ou recarregar a página
exige novo login. Uma resposta `401` do catálogo devolve o usuário ao formulário.
A mesa selecionada tem seus detalhes exibidos, sem criar uma reserva.
Não existe catálogo ou fallback fictício no frontend.
Testes: `npm.cmd test -- --watch=false`; compilação: `npm.cmd run build`.

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
borda tracejada e seleção tem borda laranja com confirmação visual. Verde representa
`tipo=LIVRE` no catálogo, sem afirmar ausência de conflito em qualquer período.
Não são exibidos os estados Reservada ou Suporte do SVG sem dados que os sustentem.
