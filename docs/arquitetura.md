# Arquitetura inicial

Projeto independente baseado nos padrões técnicos do agendamento-salas.

| Componente | Tecnologia | Desenvolvimento |
| --- | --- | --- |
| Backend | Java 21, Spring Boot 4.1.0, Maven Wrapper 3.9.16 | http://localhost:8081 |
| Frontend | Angular 21, TypeScript, CSS, Node.js 22 | http://localhost:4201 |

O backend possui somente a aplicação Spring Boot e a configuração CORS para `/api/**`. Não há endpoints de negócio, banco, autenticação nem integrações externas. O servidor inicia sem `.env`; configurações opcionais são documentadas em `backend/.env.example`.

O frontend possui bootstrap standalone, router sem rotas, HttpClient, arquivos de ambiente e tokens visuais. A página em branco é esperada nesta etapa: nenhuma tela foi solicitada. O proxy local encaminha `/api/**` para a porta 8081. Em produção, a infraestrutura deverá encaminhar `/api` ao backend no mesmo domínio; o proxy do Angular só vale para desenvolvimento.

Profiles Spring: `dev` por padrão, `prod` para logs e erros de produção e `test` para os testes. Nenhum exige credenciais nesta etapa. A configuração `prod` não representa infraestrutura de implantação pronta.

Na evolução, organizar o backend por responsabilidades e o frontend em `core/`, `shared/` e `features/`. As regras de reserva de mesas ainda serão definidas.

## Integração contínua

GitHub Actions executa dois jobs independentes em pushes e pull requests para `main` e `develop`:

- Backend: Java 21, cache Maven e `./mvnw --batch-mode verify` (testes e empacotamento).
- Frontend: Node.js 22, cache npm, `npm ci` e `npm run build`.

O teste de inicialização abre o servidor em porta aleatória e comprova que o contexto carrega sem serviços externos. Testes de funcionalidades serão adicionados junto às implementações. O CI não depende de `.env`, banco nem secrets.
