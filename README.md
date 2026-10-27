# Agendamento de Mesas

[![CI](https://github.com/FourScheduler/agendamento-mesas/actions/workflows/ci.yml/badge.svg)](https://github.com/FourScheduler/agendamento-mesas/actions/workflows/ci.yml)

Projeto FourScheduler com persistência MySQL, autenticação local e catálogo de mesas fictícias. O catálogo autenticado e o componente Angular de planta estão descritos em [Catálogo de demonstração](docs/catalogo-demonstracao.md). O fluxo de reserva diária está implementado: escolha a data, selecione uma mesa disponível e confirme. O backend registra o usuário autenticado e protege conflitos concorrentes por mesa e por usuário.

## Pré-requisitos

- JDK 21 (confira `java --version`).
- Node.js 22 e npm (confira `node --version` e `npm.cmd --version`).
- Git. O Maven é disponibilizado pelo Wrapper em `backend/`.

O backend em desenvolvimento requer MySQL configurado em `backend/.env` (consulte `.env.example`). Testes automatizados usam H2 e não exigem serviço externo. O seed fictício é exclusivo do perfil `dev`.

## Backend — porta 8081

No PowerShell, a partir da raiz:

```powershell
cd backend
.\mvnw.cmd --version
.\mvnw.cmd spring-boot:run
```

O log deve mostrar `Started AgendamentoMesasApplication`. Mantenha o terminal aberto. Use `POST /api/auth/login` para obter o token e `GET /api/mesas` com `Authorization: Bearer <token>` para consultar o catálogo.

O arquivo `.env` é opcional. Se precisar alterar configurações, copie `backend/.env.example` para `backend/.env` e edite os valores. Não versione `.env` nem credenciais.

### Maven com configuração corporativa

Se o Maven estiver redirecionando dependências para um repositório corporativo, use a configuração pública incluída, somente nesta execução e dentro de `backend/`:

```powershell
.\mvnw.cmd -s .mvn/settings-public.xml -gs .mvn/settings-public.xml spring-boot:run
```

Para testar e empacotar, substitua `spring-boot:run` por `clean verify`. Isso não modifica o `settings.xml` corporativo. O download inicial do próprio Maven Wrapper usa a URL pública em `.mvn/wrapper/maven-wrapper.properties`.

### Selecionar Java 21 no terminal

Se já houver um JDK 21 instalado, ajuste o caminho conforme sua instalação. No PowerShell, por exemplo:

```powershell
$env:JAVA_HOME = "$env:USERPROFILE\.jdks\azul-21.0.11"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
```

No Git Bash:

```bash
export JAVA_HOME="$HOME/.jdks/azul-21.0.11"
export PATH="$JAVA_HOME/bin:$PATH"
java --version
cd backend
./mvnw -s .mvn/settings-public.xml -gs .mvn/settings-public.xml spring-boot:run
```

As alterações de Java valem para o terminal atual. Se usar os botões do IntelliJ, selecione JDK 21 no projeto e no Maven Runner e importe `backend/pom.xml` como projeto Maven.

## Frontend — porta 4201

Em outro PowerShell, a partir da raiz:

```powershell
cd frontend
npm.cmd ci
npm.cmd start
```

Abra `http://localhost:4201`. A página inicial oferece login local e, após autenticar, exibe a planta de demonstração carregada da API. No perfil `dev`, uma conta fictícia disponível é `maria.souza@exemplo.com`, senha `senha1234`. Use `npm.cmd` no PowerShell para evitar o bloqueio de scripts de `npm.ps1`. No Git Bash, pode usar `npm`.

O arquivo frontend/.npmrc usa o registro público e habilita a resolução padrão de peer dependencies somente neste projeto, sem alterar a configuração npm corporativa da máquina.

O Angular encaminha `/api` para `http://localhost:8081` durante o desenvolvimento. Os ambientes usam `apiUrl: '/api'`. O backend deve estar em execução para autenticar e carregar o catálogo. O token é mantido em `localStorage`; ao recarregar, o frontend recupera o perfil real em `/api/auth/perfil`. Sair ou receber `401` encerra a sessão.

## Validação e CI

```powershell
cd backend
.\mvnw.cmd -s .mvn/settings-public.xml -gs .mvn/settings-public.xml clean verify
cd ..\frontend
npm.cmd ci
npm.cmd run build
```

O workflow `.github/workflows/ci.yml` executa testes e empacotamento do backend e build do frontend em pushes e pull requests para `main` e `develop`, com um MySQL 8.4 isolado para repetir os testes de criação e concorrência. Consulte a aba Actions no GitHub para o resultado de cada execução. O frontend também executa seus testes automatizados.

As portas 8081 e 4201 permitem executar este projeto junto do agendamento-salas, que utiliza 8080 e 4200.

## Reservas diárias e testes MySQL

`POST /api/reservas` recebe `{ "mesaId": 44, "data": "2026-10-28" }` com Bearer token e retorna `201` com a reserva `CONFIRMADA`, mesa, data e solicitante. Não envie usuário no request. Mesas fixas/inativas ou ocupadas e usuário com outra reserva no dia retornam `409`. A reserva vale somente na data escolhida; o dia seguinte é independente. São permitidos dias úteis, de hoje até hoje + 15 dias corridos, no fuso de São Paulo.

Os testes comuns usam H2. Para repetir o contrato e os testes concorrentes no MySQL, configure um **schema exclusivo cujo nome termine em `_test`**; a suíte apaga seus registros entre os testes. Exemplo no PowerShell, dentro de `backend/`:

```powershell
$env:TEST_MYSQL_URL = "jdbc:mysql://127.0.0.1:3306/agendamento_mesas_test?serverTimezone=America/Sao_Paulo"
$env:TEST_MYSQL_USERNAME = "usuario-de-testes"
$env:TEST_MYSQL_PASSWORD = "senha-local-de-testes"
.\mvnw.cmd -s .mvn/settings-public.xml -gs .mvn/settings-public.xml verify
```

Crie esse schema e conceda acesso antes de executar. Sem `TEST_MYSQL_URL`, somente `ReservaMySqlTests` é ignorada. O CI sempre fornece MySQL e executa essa suíte. As migrations aplicadas continuam intactas; não houve mudança de estrutura na entrega diária.

## Documentação

- [Arquitetura](docs/arquitetura.md)
- [Padrões visuais](docs/padroes-visuais.md)
- [MVP de mesas — fluxo e regras](docs/fluxo-mvp.md)
- [MVP de mesas — contratos da API](docs/contratos-api-mvp.md)
- [MVP de mesas — modelo de dados e demonstração](docs/modelo-dados-mvp.md)
- [MVP de mesas — cenários de teste](docs/testes-mvp.md)
- [Instruções do projeto](AGENTS.md)
