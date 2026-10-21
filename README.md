# Agendamento de Mesas

[![CI](https://github.com/FourScheduler/agendamento-mesas/actions/workflows/ci.yml/badge.svg)](https://github.com/FourScheduler/agendamento-mesas/actions/workflows/ci.yml)

Base inicial do projeto FourScheduler, seguindo os padrões do agendamento-salas. Esta etapa contém apenas estrutura, configurações e CI; não contém telas, mapas, login nem regras de reserva.

## Pré-requisitos

- JDK 21 (confira `java --version`).
- Node.js 22 e npm (confira `node --version` e `npm.cmd --version`).
- Git. O Maven é disponibilizado pelo Wrapper em `backend/`.

Não é necessário MySQL, JWT, Ollama nem qualquer serviço externo para executar esta base.

## Backend — porta 8081

No PowerShell, a partir da raiz:

```powershell
cd backend
.\mvnw.cmd --version
.\mvnw.cmd spring-boot:run
```

O log deve mostrar `Started AgendamentoMesasApplication`. Mantenha o terminal aberto. Como ainda não há endpoints, uma resposta 404 em `http://localhost:8081/` é esperada.

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

Abra `http://localhost:4201`. A página vazia é intencional: nenhuma tela foi implementada. Use `npm.cmd` no PowerShell para evitar o bloqueio de scripts de `npm.ps1`. No Git Bash, pode usar `npm`.

O Angular encaminha `/api` para `http://localhost:8081` durante o desenvolvimento. Os ambientes usam `apiUrl: '/api'`; nenhuma chamada de negócio foi implementada.

## Validação e CI

```powershell
cd backend
.\mvnw.cmd -s .mvn/settings-public.xml -gs .mvn/settings-public.xml clean verify
cd ..\frontend
npm.cmd ci
npm.cmd run build
```

O workflow `.github/workflows/ci.yml` executa testes e empacotamento do backend e build do frontend em pushes e pull requests para `main` e `develop`, sem exigir secrets ou banco. Consulte a aba Actions no GitHub para o resultado de cada execução. Ainda não existem testes de interface porque nenhuma tela foi implementada.

As portas 8081 e 4201 permitem executar este projeto junto do agendamento-salas, que utiliza 8080 e 4200.

## Documentação

- [Arquitetura](docs/arquitetura.md)
- [Padrões visuais](docs/padroes-visuais.md)
- [Instruções do projeto](AGENTS.md)
