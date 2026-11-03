# Como contribuir

1. Use Node.js 22+ e execute `npm test` antes de alterar.
2. Rode `node examples/demo.mjs` para entender o contrato sem tocar em seus dados.
3. Abra uma issue no próprio repositório com o problema concreto, comportamento esperado, comando e resultado observado. Não inclua dados pessoais ou segredos.
4. Faça uma mudança pequena por pull request. Preserve o contrato ou explique a incompatibilidade.
5. Para mudanças de comportamento, acrescente um teste HTTP significativo. Os testes usam arquivos temporários e devem continuar independentes da rede externa.
6. Atualize o README quando mudar campos, limites, exemplos ou status HTTP.

Não versione `data/`, `.env`, logs, tokens ou catálogos privados. Para reproduzir falhas, substitua informações reais por exemplos mínimos.

Sugestões úteis: documentação acessível, exemplos de clientes que seguem Link e melhorias de validação com casos de teste. Novas dependências precisam de uma justificativa concreta.

Licença MIT. Apoiar por Pix é opcional e não é requisito para usar ou contribuir.
