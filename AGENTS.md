# Agendamento de Mesas — Instruções do projeto

Este projeto pertence à organização FourScheduler. A estrutura inicial segue o padrão do agendamento-salas, mas o código e o histórico são independentes.

## Escopo atual

Somente configuração e infraestrutura de desenvolvimento. Não implementar telas, mapas, autenticação ou regras de reserva sem solicitação explícita. Não integrar Microsoft Graph, Outlook, Entra ID ou provedores de IA sem solicitação explícita.

## Estrutura

- `backend/`: Java 21, Spring Boot 4.1 e Maven Wrapper.
- `frontend/`: Angular 21, TypeScript, CSS e componentes standalone.
- `docs/`: arquitetura e padrões visuais.
- `.github/workflows/ci.yml`: testes do backend e build do frontend.

Leia a documentação relevante em `docs/` antes de implementar mudanças. Frontend em `http://localhost:4201`; backend em `http://localhost:8081`. O frontend deve consumir somente a API do backend. Credenciais pertencem exclusivamente ao backend e nunca devem ser versionadas.

Mantenha mudanças pequenas e focadas, sem trocar versões ou adicionar dependências sem necessidade clara. Não copie regras ou dados de salas para mesas. Execute os testes e builds relacionados e informe os resultados.

## Comandos no PowerShell

```powershell
cd backend
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run

cd ..\frontend
npm.cmd ci
npm.cmd start
npm.cmd run build
```

Para Maven com configuração corporativa, consulte o README antes de alterar qualquer configuração global.
