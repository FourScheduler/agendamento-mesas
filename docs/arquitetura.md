# Arquitetura inicial

Projeto independente baseado nos padrões técnicos do agendamento-salas.

| Componente | Tecnologia | Desenvolvimento |
| --- | --- | --- |
| Backend | Java 21, Spring Boot 4.1.0, Maven Wrapper 3.9.16 | http://localhost:8081 |
| Frontend | Angular 21, TypeScript, CSS, Node.js 22 | http://localhost:4201 |

O backend possui a aplicação Spring Boot com persistência MySQL (Flyway), autenticação local (Spring Security + JWT) e CORS para `/api/**` restrito à porta 4201 do frontend. Não há integrações externas. O servidor inicia sem `.env`; configurações opcionais são documentadas em `backend/.env.example`. Em desenvolvimento o JWT usa segredo padrão no `application.yaml`, sobrescrevível por `JWT_SECRET`.

O frontend usa bootstrap standalone, HttpClient e tokens visuais. O componente raiz hospeda o `Layout` com a barra de navegação e `RouterOutlet`. As rotas `/login`, `/agendamento`, `/mapa` e `/minhas-reservas` preservam a organização da develop; a rota inicial redireciona para agendamento, com acesso autenticado. A página de minhas reservas permanece uma preparação para a próxima entrega.

`AuthService` compartilha a sessão entre as telas, persiste o token em `localStorage` e carrega o perfil real por `/api/auth/perfil` antes de liberar a navegação protegida após recarregar. Logout e respostas `401` limpam a sessão e retornam ao login. `ReservaDiaria` compartilha o estado e a confirmação entre a lista de mesas e o mapa. As duas telas usam data inteira, permitem revisar o solicitante e tratam `400`, `401` e `409`, atualizando a disponibilidade. A data é preservada por query param ao alternar entre lista e planta.

`PlantaMesas` consome IDs e coordenadas do catálogo completo e combina a disponibilidade da data escolhida. A confirmação no backend continua serializada por usuário e mesa em transação `READ_COMMITTED`. O proxy local encaminha `/api/**` para 8081; em produção a infraestrutura deve encaminhar `/api` ao backend no mesmo domínio.

O filtro diário compartilha a validação de datas no frontend e registra em
`ReservaDiaria` a data cuja disponibilidade terminou de carregar. Trocar a data
ou atualizar invalida essa referência e a seleção antes da nova requisição.
`PlantaMesas.disponibilidadeConsultada` informa a conclusão ao mapa; a lista
registra a conclusão de sua própria consulta. Somente resultados da data atual
liberam seleção e confirmação. Ver [issue #11](issue-11-filtro-data.md).

Profiles Spring: `dev` por padrão, `prod` para logs e erros de produção e `test` para os testes. Nenhum exige credenciais nesta etapa. A configuração `prod` não representa infraestrutura de implantação pronta.

Na evolução, organizar o backend por responsabilidades e o frontend em `core/`, `shared/` e `features/`. As regras diárias estão documentadas em `fluxo-mvp.md`.

## Integração contínua

GitHub Actions executa dois jobs independentes em pushes e pull requests para `main` e `develop`:

- Backend: Java 21, cache Maven, MySQL 8.4 isolado e `./mvnw --batch-mode verify` (testes H2/MySQL e empacotamento).
- Frontend: Node.js 22, cache npm, `npm ci`, `npm run build` e `npm test -- --watch=false`.

O teste de inicialização abre o servidor em porta aleatória e comprova que o contexto carrega sem serviços externos. Há testes de autenticação, catálogo, persistência e confirmação diária, incluindo concorrência e rollback. O CI provisiona o MySQL de testes sem depender de `.env` ou secrets externos.
