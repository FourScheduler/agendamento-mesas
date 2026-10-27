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
  geometria do SVG fornecido. Canvas de 1670 × 1972 unidades, escala proporcional
  e largura mínima de 1000px, com rolagem horizontal restrita ao desenho. Cabeçalho
  e legenda ficam fora da escala, preservando a tipografia do Portal.
- Seleção em `#fffaf6` com borda `#ff892e`, fixa em cinza e inativa tracejada.
  Mesas disponíveis na data usam borda verde; ocupadas usam fundo laranja suave e
  rótulo "Ocupada". A legenda diferencia "Livre na data", "Ocupada na data", fixa,
  inativa e selecionada. A ocupação vem da consulta diária da API.
- O formulário escolhe a data inteira, informa a janela de 15 dias e permite atualizar
  a disponibilidade. O cartão de revisão mostra mesa, data e solicitante; a confirmação
  tem estado de envio e resultados acessíveis (`role=status`/`role=alert`).
- No mapa em telas acima de 700px, o cartão de detalhes pode ser arrastado pelo
  cabeçalho ou movido com as setas ao focar o cabeçalho (Shift acelera). O movimento
  fica dentro da janela; fechar e confirmar continuam independentes do arraste.
  Em telas menores, o cartão permanece no fluxo da página.
- Os dados e posições continuam vindo exclusivamente da API de mesas. Nenhum
  catálogo, fluxo de salas ou autenticação mockada foi copiado.

Tokens adicionais ficam em `styles.css`: `--orange-dark`, `--orange-soft`,
`--border-soft`, `--surface`, `--disabled`, `--selection-bg` e `--error` (`#dc2626`).
Na planta: `--mesa-livre` (`#10b981`), `--mesa-livre-texto` (`#047857`),
`--mapa-fixa` (`#f3f4f6`), `--mapa-borda`/`--mapa-estrutura` (`#d1d5db`) e
`--mapa-linha` (`#93c5fd`). Entrada e estruturas são apenas referências visuais.
