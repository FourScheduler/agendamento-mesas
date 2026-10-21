# Frontend

- Angular 21, TypeScript, CSS e componentes standalone.
- Porta local padrão: 4201; proxy `/api` para `http://localhost:8081`.
- Organização futura em `core/`, `shared/` e `features/`.
- A base atual não contém telas nem regras de reserva. O componente raiz apenas hospeda o router.
- O frontend consome somente a API própria. Nunca incluir chaves, senhas ou tokens em arquivos de ambiente Angular.
- Siga os tokens e as diretrizes em `docs/padroes-visuais.md` ao criar telas.
- Execute `npm.cmd run build` após mudanças. Adicione testes relevantes quando houver comportamento implementado.
