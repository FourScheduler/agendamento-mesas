# Backend

- Java 21, Spring Boot 4.1 e Maven.
- Pacote base: `br.com.foursys.agendamento_mesas`.
- Porta local padrão: 8081.
- Configuração opcional em `.env`, com exemplo versionado em `.env.example`.
- Banco e autenticação ainda não estão configurados; não adicionar integrações como parte de tarefas de configuração.
- Na evolução: controllers para HTTP, services para regras e DTOs/records para contratos. Use injeção por construtor e validação de entrada.
- Execute `./mvnw test` ou `.\mvnw.cmd test` após mudanças relacionadas ao backend.
