# Padrões visuais

Referência: identidade visual adotada pelo projeto agendamento-salas do Portal Foursys.

| Uso | Valor |
| --- | --- |
| Barra superior e títulos | `#222239` |
| Ações principais | `#ff5315` |
| Detalhes e estados | `#ff892e` |
| Fundo de tela | `#f7f8fa` |
| Cartões | Branco, borda de 1px `#d6d6d6` |
| Tipografia | Nunito, fallback sans-serif |

Os tokens básicos já estão em `frontend/src/styles.css`. Ao implementar as telas, configurar o carregamento de Nunito, manter layout corporativo, minimalista, responsivo e acessível e reutilizar o símbolo do Portal à esquerda, com texto Portal e divisória branca. Não exibir o texto CCH.

## Aplicação no catálogo de mesas

A referência local é `agendamento-salas/frontend`, especialmente `shared/topbar`,
`styles.css` e `features/agendamento`. O catálogo de mesas reutiliza a identidade
visual e a marca, com componentes próprios para seus contratos de API.

- `shared/topbar`: barra `#222239`, altura de `6vh` (mínimo 50px), padding horizontal
  de 30px, símbolo `public/logo-portal.png` com altura de 23px, texto Portal e
  divisória branca de 2px. Abaixo de 900px, texto e divisória somem.
- Menu ativo com calendário, rótulo Agendamento de Mesas, destaque e selo Novo em laranja.
- Perfil com avatar de iniciais, menu com nome e botão Sair, no padrão de salas.
  Clique fora e Escape fecham o menu. Não há notificações ou reservas fictícias no cabeçalho.
- Nunito carregada no `index.html`, com fallback Segoe UI/system-ui/sans-serif.
- Container de até 1500px, título de 1.75rem, subtítulo de 0.9375rem e sobretítulo laranja.
- Botões primários laranja (`#ff5315`), hover `#e04a10`, altura mínima de 44px;
  campos com rótulo em caixa alta, borda cinza e foco laranja.
- Cartões brancos, borda `#e7e9ec`, raio de 10px, cabeçalho com divisória.
- A planta é um componente Angular com HTML e CSS, no padrão de `mapa-salas`:
  cartão, cabeçalho e legenda responsivos, mesas em botões e estruturas em elementos
  decorativos com bordas e fundos CSS. O cabeçalho usa calendário SVG inline e o
  logo local `public/logo-portal.png`; não depende de arquivos exportados do Figma.
- A planta usa toda a largura do conteúdo (container de até 1800px), seguindo a
  geometria do SVG fornecido como base (1670 × 1972 unidades), com expansão visual
  para acomodar a circulação, escala proporcional
  e largura mínima de 1000px, com rolagem restrita ao desenho e altura de até 70dvh. Cabeçalho
  e legenda ficam fora da escala, preservando a tipografia do Portal.
- O mapa aproxima a referência de escritório com piso cinza-claro liso,
  janelas laterais, superiores e inferiores e mesas de tampo claro com cadeiras cinza-claro,
  sem plantas ou jardineiras decorativas.
  Janelas do topo e da base usam o mesmo vidro azulado e moldura da lateral,
  com bordas e divisórias internas finas, sem rótulos de texto. A janela superior
  mantém espaço visual em relação às cadeiras da primeira fileira.
  Decorações em CSS não representam novos dados do catálogo.
  Os controles ajustam o zoom de 50% a 150% da escala inicial ou restauram a
  visualização. Os controles e as instruções ficam abaixo da área rolável,
  sem sobrepor as mesas.
  O nível exibido como 100% corresponde a 72% da escala proporcional original,
  inclusive ao abrir o mapa ou restaurar a visualização.
  Arrastar o fundo com mouse move o mapa; no toque, usar a rolagem
  nativa. Arrastar não interfere nos botões de mesa. A planta permanece em vista
  superior 2D, com sombras CSS de relevo sempre ativas e sem controles de modo.
- A paleta do mapa usa estruturas azul-acinzentadas.
  Seleção com contorno laranja e fundo pêssego, fixa com borda e texto vermelhos
  sobre fundo vermelho suave e inativa tracejada.
  Mesas disponíveis na data usam verde e mostram o rótulo "Livre"; reservadas usam
  lilás suave sem descrição sobre a mesa. A legenda diferencia "Livre na data", "Reservada", fixa,
  inativa e selecionada. A ocupação vem da consulta diária da API.
- O formulário escolhe a data inteira, informa a janela de 15 dias e permite atualizar
  a disponibilidade. No mapa, selecionar uma mesa abre modal com detalhes já expandidos;
  administradores podem buscar outro solicitante ativo. A confirmação tem estado de envio
  e resultados acessíveis (`role=status`/`role=alert`).
- Confirmações e críticas de reserva aparecem em uma notificação no canto superior
  direito, abaixo da barra de navegação, com texto branco: verde para sucesso e
  vermelho para erro. Ambas fecham após dez segundos, com somente uma barra de
  tempo visível, sem contador numérico. Passar o mouse ou focar o botão pausa a contagem; ao sair,
  ela retoma o tempo restante. Há botão para fechar imediatamente. O mesmo
  componente é usado na lista e no mapa, sem repetir a mensagem no formulário.
  Os cartões de sucesso e erro usam largura de 320px e altura mínima de 87px, padding
  de 8px e cantos de 4px, adaptando-se a janelas menores. O fundo de sucesso é
  `#07bc0c`; o texto é centralizado e a altura cresce conforme a mensagem. A rolagem
  interna só aparece se o texto ultrapassar a altura disponível na janela.
- No mapa, a seleção aparece em uma barra abaixo do desenho com código, data,
  ícone de cadeira e botão Confirmar reserva. Localização e solicitante ficam
  em Detalhes da reserva, expansível por teclado. Limpar seleção continua disponível.
  Em telas menores, o botão de confirmação ocupa a largura da barra.
- Os dados e posições continuam vindo exclusivamente da API de mesas. Nenhum
  catálogo, fluxo de salas ou autenticação mockada foi copiado.
- Fileiras vizinhas são unidas visualmente em pares por bloco do corredor:
  a segunda encosta na primeira e as cadeiras internas são removidas.
  Mesas sem correspondente mantêm suas cadeiras. O ajuste usa as coordenadas
  da API sem alterar o banco, os IDs ou a seleção individual de cada mesa.
  Em Tamboré, as laterais também encostam, formando bancadas por bloco
  (1/8, 2/7, 3/6, 4/5). O espaçamento vertical da base é ampliado em 40%,
  mantendo as duplas encostadas, e o corredor central tem mais de 200 unidades.
  Entrada e estruturas acompanham essa transformação de apresentação; a faixa cinza
  decorativa anteriormente rotulada como parede foi removida.
  Todas as mesas de uma fileira compartilham o mesmo alinhamento vertical,
  inclusive quando não há mesa correspondente na fileira vizinha (como a 91).
  As fileiras iniciadas nas mesas 65 e 77 ficam ligeiramente mais próximas
  no alinhamento horizontal, mantendo cada bancada unida.
  A coluna de sustentação acima da mesa 91 ocupa uma célula da mesma grade;
  cadeiras que interceptariam estruturas não são desenhadas.
  O quadrado cinza ao lado da mesa 97 tem o mesmo tamanho da estrutura próxima
  às mesas 93/94 e fica alinhado à fileira da mesa 97.
  No modo Relevo, a sombra acompanha apenas o contorno externo da bancada
  de duas fileiras, sem sombras ou deslocamento de hover nas divisões individuais.

Na gestão de mesas, usar cartão branco com cabeçalho integrado, contagem de
resultados e tabela com títulos em fundo cinza-claro. Números ficam centralizados
em etiquetas, status têm texto e indicador colorido e linhas inativas usam fundo
vermelho suave. Ações usam botões de contorno com foco visível. Preservar os
atalhos Ver mapa e Voltar ao agendamento e a rolagem horizontal em telas menores.

Tokens adicionais ficam em `styles.css`: `--orange-dark`, `--orange-soft`,
`--border-soft`, `--surface`, `--disabled`, `--selection-bg` e `--error` (`#dc2626`).
Na planta: `--mesa-livre` (`#10b981`), `--mesa-livre-texto` (`#047857`),
`--mapa-fixa` (`#f3f4f6`), `--mapa-borda`/`--mapa-estrutura` (`#d1d5db`) e
`--mapa-linha` (`#93c5fd`). Entrada e estruturas são apenas referências visuais.
