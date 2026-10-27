# Arquitetura inicial

Projeto independente baseado nos padrões técnicos do agendamento-salas.

| Componente | Tecnologia | Desenvolvimento |
| --- | --- | --- |
| Backend | Java 21, Spring Boot 4.1.0, Maven Wrapper 3.9.16 | http://localhost:8081 |
| Frontend | Angular 21, TypeScript, CSS, Node.js 22 | http://localhost:4201 |

O backend possui a aplicação Spring Boot com persistência MySQL (Flyway), autenticação local (Spring Security + JWT) e CORS para `/api/**` restrito à porta 4201 do frontend. Não há integrações externas. O servidor inicia sem `.env`; configurações opcionais são documentadas em `backend/.env.example`. Em desenvolvimento o JWT usa segredo padrão no `application.yaml`, sobrescrevível por `JWT_SECRET`.

O frontend possui bootstrap standalone, HttpClient, arquivos de ambiente e tokens visuais. A rota inicial carrega `CatalogoPage`, que autentica pela API local e hospeda `PlantaMesas` com sessão persistida em `localStorage` e perfil recuperado da API após recarregar. A planta consome IDs e coordenadas do catálogo; a disponibilidade é consultada por data e a seleção permite revisar e confirmar uma reserva diária. `ReservaService` serializa a criação por usuário e mesa dentro de transação `READ_COMMITTED`. O proxy local encaminha `/api/**` para a porta 8081. Em produção, a infraestrutura deverá encaminhar `/api` ao backend no mesmo domínio; o proxy do Angular só vale para desenvolvimento.

Profiles Spring: `dev` por padrão, `prod` para logs e erros de produção e `test` para os testes. Nenhum exige credenciais nesta etapa. A configuração `prod` não representa infraestrutura de implantação pronta.

Na evolução, organizar o backend por responsabilidades e o frontend em `core/`, `shared/` e `features/`. As regras diárias estão documentadas em `fluxo-mvp.md`.

## Integração contínua

GitHub Actions executa dois jobs independentes em pushes e pull requests para `main` e `develop`:

- Backend: Java 21, cache Maven, MySQL 8.4 isolado e `./mvnw --batch-mode verify` (testes H2/MySQL e empacotamento).
- Frontend: Node.js 22, cache npm, `npm ci`, `npm run build` e `npm test -- --watch=false`.

O teste de inicialização abre o servidor em porta aleatória e comprova que o contexto carrega sem serviços externos. Há testes de autenticação, catálogo, persistência e confirmação diária, incluindo concorrência e rollback. O CI provisiona o MySQL de testes sem depender de `.env` ou secrets externos.
