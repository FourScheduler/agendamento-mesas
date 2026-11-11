# Padrões visuais

Na administração de mesas, o lápis permanece visível após Ativar/Inativar,
desabilitado até a mesa estar fixa e com responsável. Nome e e-mail do
responsável ficam centralizados na coluna Responsável Fixo.
O modal de fixação não tem rolagem interna; o responsável selecionado aparece
com iniciais, nome, e-mail e ação Trocar, seguindo o resumo da reserva.
As sugestões ficam no fluxo do modal, sem sobrepor o rodapé, em uma lista
com altura máxima de 192px (cerca de três usuários) e rolagem própria.
Os filtros de gestão se combinam com a busca por número e atualizam a tabela
e a contagem. A busca também aceita localização, nome e e-mail do responsável
fixo, ignorando acentos e diferenças entre maiúsculas e minúsculas.
O catálogo completo da data é filtrado localmente após 250ms sem digitação,
sem recriar o campo, perder foco ou consultar a API a cada letra.
Os filtros rápidos atualizam a tabela
e a contagem. Fixas considera o tipo da mesa; Inativas considera a ativação.
Livres e Reservadas consideram apenas mesas ativas não fixas, sem ou com
reserva no dia consultado, respectivamente. Clicar novamente limpa o filtro.

Referência: identidade visual adotada pelo projeto agendamento-salas do Portal Foursys.

Todos os campos de data da lista, do mapa e de Minhas reservas reutilizam
`app-calendario-reserva`. O componente aceita limites opcionais; os campos de
agendamento bloqueiam fins de semana e respeitam a janela da reserva, enquanto
os filtros de histórico permitem datas passadas e fins de semana.

Em Minhas reservas, a aba Ativas mostra reservas não canceladas de hoje em
diante, em ordem crescente de data, considerando America/Sao_Paulo.
A aba Canceladas mostra somente reservas canceladas, independentemente da
data, em ordem decrescente. As abas permanecem disponíveis com um período
personalizado e combinam-se com os filtros de data e status. Limpar filtros
preserva a aba selecionada. Mesas atribuídas continuam em uma seção separada,
sem alteração das regras de cancelamento.
Ao mudar período ou status, a consulta anterior é cancelada; somente a consulta
mais recente pode atualizar a lista, o carregamento e o erro. Um período inválido
também cancela a consulta pendente e limpa os resultados anteriores.
A listagem usa os endpoints paginados próprios de usuário e administrador.
Na aba Ativas, o limite inicial da consulta nunca precede hoje em São Paulo,
para que a filtragem aconteça antes da paginação e a contagem permaneça coerente.
Trocar aba, período, status ou tamanho reinicia a página; a consulta anterior
também é cancelada ao navegar entre páginas.
Nos cards de reservas, o status fica no canto superior direito, separado da
identificação da mesa. As ações ficam abaixo, sem sobrepor o status ou nomes longos.
A data fica logo abaixo do beneficiário, no mesmo bloco de identificação,
sem espaçamento adicional causado pelas ações de cancelamento.
Os cards usam espaçamento vertical compacto; no desktop, as ações ficam abaixo
do status na coluna direita, ao lado da identificação. Em telas pequenas,
as ações passam para uma linha própria para preservar a leitura.

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

Mesas com reserva diária na data consultada usam fundo `#EAF3FF`, borda
`#83B4ED` e número `#326CA8`. A identificação usa somente texto `#326CA8`, sem caixa:
“Diária” para reservas de terceiros e “Sua reserva” quando o ocupante na data
corresponde ao usuário autenticado. No mapa, o texto “Sua reserva” não aparece
sobre a mesa diária ou fixa: a identificação permanece na legenda, na borda
pulsante e no nome acessível da mesa. A opção de mostrar nomes é preservada.
A pulsação é exclusiva da reserva diária ou mesa fixa ativa do usuário
autenticado. Essa mesa fica acima das mesas vizinhas, inclusive selecionadas,
para que a borda pulsante não seja encoberta. Com movimento reduzido, o
destaque permanece estático e mantém a mesma sobreposição.
Na primeira consulta do mapa, sem uma mesa indicada na navegação, a planta
centraliza a reserva diária ou mesa fixa do usuário, sem abrir os detalhes.

A tela de login usa fundo cinza em gradiente, apresentação à esquerda e
formulário branco à direita. O cartão tem raio de 24px; campos e botão, 12px.
Em telas pequenas, os blocos ficam empilhados. A ação principal permanece laranja.

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
  Ao passar o mouse sobre uma mesa, o nome do ocupante na data ou do responsável
  fixo aparece em um popup arredondado somente com o nome,
  mesmo quando os nomes estao ocultos no desenho.
  O popup compacto tem fundo cinza-escuro `#52525b`, raio de 16px,
  texto branco de 12px e largura limitada à mesa, com quebra de linha
  entre nome e sobrenomes conforme o espaço disponível.
  Fica centralizado
  no lugar do numero da mesa apontada, ocultando-o temporariamente enquanto
  estiver aberto. Ao sair, o numero reaparece. Tambem aparece no foco por teclado.
  Usa a camada superior do navegador (Popover API), sem recorte pela planta
  ou sobreposicao pelos demais elementos.
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
  A legenda exibe Livre, Reservada, Sua reserva e Inativa, mantendo o botão de olho.
  A amostra de Sua reserva usa a mesma pulsação de 1,5 segundo da mesa própria,
  desativada quando há preferência por movimento reduzido.
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
- Toasts usam o componente compartilhado `ToastItem` (`app-toast`), no canto superior
  direito abaixo da navegação. O padrão segue cartão claro, borda suave, cantos de
  12px, ícone circular de 28px à esquerda, título e descrição alinhados à esquerda
  e botão de fechar à direita. Sucesso usa fundo `#ecfdf5`, texto `#166534`,
  borda `#a7f3d0` e ícone `#16a34a`. Erro, aviso e informação usam variações
  vermelha, amarela e azul, sempre com ícones e texto, sem depender somente da cor.
  Confirmações usam verde; cancelamentos usam a variante vermelha `cancelamento`,
  sem serem anunciados como erro. Avisos usam fundo `#fefce8` e borda `#fde047`.
  Todos os toasts fecham após seis segundos, com somente uma barra de
  tempo visível, sem contador numérico. Passar o mouse ou focar o botão pausa a contagem; ao sair,
  ela retoma o tempo restante. Há botão para fechar imediatamente. O mesmo
  componente visual é usado pelo `ToastContainer` global e pelo adaptador
  `Notificacao` da lista e do mapa, sem duplicar estilos ou temporizadores.
  Os cartões usam largura máxima de 320px, limitada à janela, padding de 6px por 10px
  e altura adaptável. A rolagem
  interna só aparece se o texto ultrapassar a altura disponível na janela.
  Cada toast pausa independentemente com mouse ou foco; remover, limpar ou
  destruir o componente cancela sua contagem. A duração é fixa em 6000ms,
  sem personalização por chamada. Erros usam `role=alert`; demais variantes usam `role=status`.
  Ao concluir navegação para outra página, os toasts globais são removidos.
  Alterações de data ou filtros na mesma rota e navegações canceladas os preservam.
  Sair do layout também limpa as notificações. O link Minhas reservas permanece
  branco ao passar o mouse e quando ativo.

  Para novas notificações, injetar `ToastService` e chamar, por exemplo,
  `toast.sucesso('Reserva confirmada!', 'Sua mesa foi reservada com sucesso.')`.
  Para cancelamentos, usar `toast.cancelamento('Reserva cancelada')`.
  Também estão disponíveis `erro`, `aviso`, `info` e `mostrar`.
  O container já está instalado uma única vez no `Layout`;
  não adicionar um container por tela. O item controla a duração enquanto
  renderizado, sem um segundo temporizador no serviço.
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
atalhos Explorar mesas e Listar mesas e a rolagem horizontal em telas menores.
O modal de ações usa fundo desfocado e dimensões alinhadas ao modal do mapa;
o conteúdo interno fica limitado a 420px, sem alterar a largura do modal.

Tokens adicionais ficam em `styles.css`: `--orange-dark`, `--orange-soft`,
`--border-soft`, `--surface`, `--disabled`, `--selection-bg` e `--error` (`#dc2626`).
Na planta: `--mesa-livre` (`#10b981`), `--mesa-livre-texto` (`#047857`),
`--mapa-fixa` (`#f3f4f6`), `--mapa-borda`/`--mapa-estrutura` (`#d1d5db`) e
`--mapa-linha` (`#93c5fd`). Entrada e estruturas são apenas referências visuais.
