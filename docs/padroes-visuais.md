# Padrões visuais

Na administração de mesas, o lápis permanece visível após Ativar/Inativar,
desabilitado até a mesa estar fixa e com responsável. Nome e e-mail do
responsável ficam centralizados na coluna Responsável Fixo.
O modal de fixação não tem rolagem interna; o responsável selecionado aparece
com iniciais, nome, e-mail e ação Trocar, seguindo o resumo da reserva.
As sugestões ficam no fluxo do modal, sem sobrepor o rodapé, em uma lista
com altura máxima de 192px (cerca de três usuários) e rolagem própria.
Os filtros de gestão se combinam com a busca por número e atualizam a tabela
e a contagem. Fixas considera o tipo da mesa; Inativas considera a ativação.
Livres e Reservadas consideram apenas mesas ativas não fixas, sem ou com
reserva no dia consultado, respectivamente. Clicar novamente limpa o filtro.

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
  Na rota do mapa, o conteúdo ocupa a altura restante abaixo da navegação,
  sem rolagem externa da página. A escala do desenho é preservada; arraste,
  rolagem interna e zoom continuam disponíveis para percorrer a planta.
- O mapa aproxima a referência de escritório com piso cinza-claro liso,
  janelas laterais, superiores e inferiores e mesas de tampo claro com cadeiras cinza-claro,
  sem plantas ou jardineiras decorativas.
  Janelas do topo e da base usam o mesmo vidro azulado e moldura da lateral,
  com bordas e divisórias internas finas, sem rótulos de texto. A janela superior
  mantém espaço visual em relação às cadeiras da primeira fileira.
  Decorações em CSS não representam novos dados do catálogo.
  O topo da fileira 93 fica 48 unidades abaixo da base da bancada 41–48,
  no bloco direito, conforme a linha de referência visual.
  As bancadas seguintes acompanham o deslocamento da 93 consecutivamente.
  A estrutura no vão acompanha esse ajuste apenas visual, preservando a circulação.
  Os intervalos entre bancadas da direita repetem os da esquerda, mantendo
  a abertura da entrada como exceção.
  O bloco Entrada ocupa a largura das quatro mesas do bloco direito e fica
  centralizado no vão entre bancadas, com margens iguais acima e abaixo
  para não sobrepor as cadeiras.
  Os controles ajustam o zoom de 50% a 150% da escala inicial ou restauram a
  visualização. Os controles e a legenda ficam juntos abaixo da área rolável.
  O controle Ampliar mapa abre a planta em um modal centralizado sobre um fundo
  desfocado; o botão X, Escape ou clique fora fecham o modal, com foco de teclado
  mantido dentro dele enquanto estiver aberto. No modal, a escala se ajusta à
  largura e à altura disponíveis; o zoom inicial de 100% corresponde a 260% da
  escala de enquadramento anterior. O modal exibe somente a planta, sem cabeçalho,
  legenda ou barras de rolagem. Controles flutuantes permitem ajustar ou
  restaurar o zoom e arrastar a planta para navegar. Um controle compacto de
  data começa oculta ao abrir o modal e pode ser exibida ou ocultada por um botão,
  junto ao botão com
  ícone de olho ficam juntos em uma barra flutuante translúcida no canto superior
  esquerdo. A data abre o calendário de seleção e atualiza a disponibilidade; o
  olho alterna a exibição dos nomes dos ocupantes.
  As instruções aparecem ao passar o mouse sobre o ícone de informação,
  sem ação de clique; foco por teclado também permite ler a dica.
  O dia da reserva e as ações da consulta ficam no cabeçalho do mapa,
  sem um bloco de título duplicado acima dele.
  O nível exibido como 100% corresponde a 72% da escala proporcional original,
  inclusive ao abrir o mapa ou restaurar a visualização.
  Arrastar o fundo com mouse move o mapa; no toque, usar a rolagem
  nativa. Arrastar não interfere nos botões de mesa. A planta permanece em vista
  superior 2D, com sombras CSS de relevo sempre ativas e sem controles de modo.
- Ao selecionar uma mesa, os detalhes aparecem em um painel lateral não modal à
  direita, mantendo a planta visível e interativa; em telas menores, o painel abre
  pela base. Mesas indisponíveis também podem ser consultadas, mas não exibem ação
  de reserva. Fechar pelo botão ou por Escape limpa a seleção sem alterar o zoom.
  Clicar novamente na mesa com detalhes abertos fecha o painel e limpa a seleção.
  O indicador de status no painel acompanha as cores da disponibilidade da mesa:
  verde para livre, vermelho para fixa ou reservada e cinza tracejado para inativa.
  Mesas fixas exibem Localização, Data selecionada e Reservado para, priorizando
  o nome do responsável vinculado. ADMIN pode fixar ou desfixar pelo switch do
  painel, com confirmação e seleção de usuário ativo ao fixar. A planta recarrega
  após a operação; durante o envio, o painel permanece aberto.
  O switch exibe “Mesa Fixa” à direita do controle. Fixar e desfixar exigem
  confirmação em popup com Confirmar e Cancelar; Escape cancela sem fechar
  os detalhes. Após salvar, um aviso global informa o sucesso da ação.
  Alternar o switch preserva o solicitante escolhido, reutilizado ao fixar a mesa;
  a seleção só é removida ao trocar o solicitante ou editar a busca.
  O painel de detalhes usa conteúdo compacto e altura natural, sem rolagem interna.
  No desktop, o painel ocupa entre 300 e 340px; a planta se adapta ao espaço
  restante e mantém a altura disponível abaixo do cabeçalho, sem aumentar a
  altura da página ao abrir os detalhes.
  O solicitante ocupa toda a largura do painel, com quebra de nomes e e-mails
  longos. A busca tem nome acessível sem texto duplicado acima da entrada.
  As ações de reserva e fixação exibem “Confirmar” no rodapé do painel,
  alinhado à base da página.
- A paleta do mapa usa estruturas azul-acinzentadas.
  Seleção com contorno laranja e fundo pêssego, fixa com borda e texto vermelhos
  sobre fundo vermelho suave e inativa tracejada.
  Mesas disponíveis na data usam verde e mostram o rótulo "Livre"; reservadas usam
  o mesmo vermelho suave das mesas fixas, somente na data reservada, sem descrição sobre a mesa.
  A legenda exibe Livre, Reservada e Inativa, mantendo o botão de olho.
  A ocupação vem da consulta diária da API.
- O formulário escolhe a data inteira, informa a janela de 15 dias e permite atualizar
  a disponibilidade. O calendário do agendamento e do mapa desabilita sábados, domingos
  e datas fora da janela para todos os perfis; a API mantém a mesma validação.
  O calendário abre em popup compacto junto ao campo de data, sem escurecer a página.
  Ao abrir sem uma data na URL durante sábado ou domingo, a seleção inicial usa
  a próxima segunda-feira, mantendo esse padrão após confirmar uma reserva.
  No agendamento, clicar novamente na mesa selecionada remove
  a seleção; Enter e Espaço têm o mesmo comportamento.
  No mapa, selecionar uma mesa abre modal com detalhes já expandidos;
  ao chegar por Ver mapa do agendamento, a mesa fica somente destacada, sem abrir
  o modal automaticamente. A rolagem leva diretamente à mesa selecionada,
  centralizando-a na área visível. Clicar na mesa na planta abre os detalhes;
  mesas reservadas exibem localização, data e beneficiário, sem formulário de
  nova reserva; somente o beneficiário autorizado ou um administrador pode
  cancelar. Após cancelamento, o mapa atualiza a disponibilidade da data.
  A página enquadra cabeçalho, planta e rodapé na janela; a centralização da mesa
  altera somente a rolagem interna, preservando a visibilidade dos controles.
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
atalhos Explorar mesas e Voltar ao agendamento e a rolagem horizontal em telas menores.
O modal de ações usa fundo desfocado e dimensões alinhadas ao modal do mapa;
o conteúdo interno fica limitado a 420px, sem alterar a largura do modal.

Tokens adicionais ficam em `styles.css`: `--orange-dark`, `--orange-soft`,
`--border-soft`, `--surface`, `--disabled`, `--selection-bg` e `--error` (`#dc2626`).
Na planta: `--mesa-livre` (`#10b981`), `--mesa-livre-texto` (`#047857`),
`--mapa-fixa` (`#f3f4f6`), `--mapa-borda`/`--mapa-estrutura` (`#d1d5db`) e
`--mapa-linha` (`#93c5fd`). Entrada e estruturas são apenas referências visuais.
