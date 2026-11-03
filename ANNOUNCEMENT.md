# Seus projetos em um catálogo que você consegue consultar

**03/11/2026 · Project Shelf API · Dia 01/10**

Em vez de espalhar nomes e links entre arquivos, cadastre projetos de estudo e laboratório em uma API local. Busque por nome/descrição, combine etiquetas e consulte páginas menores sem perder os filtros.

A entrega usa Node.js core, sem token e sem dependências externas. Tem CRUD, persistência em JSON, validação, ordenação com desempate e links de navegação. Os 11 testes HTTP passaram; a [verificação](VERIFICATION.md) registra comandos, resultados e limites.

```bash
git clone https://github.com/perabru/api-lab-2026-11-03.git
cd api-lab-2026-11-03
node examples/demo.mjs
npm test
npm start
```

A demo cria dois projetos em dados temporários, exibe a primeira página e o Link para continuar. Não altera o catálogo habitual.

[Leia o contrato e os exemplos](README.md) · [Código](src/app.js) · [Contribua](CONTRIBUTING.md) · [Texto para LinkedIn](LINKEDIN.md)

Referência: [paginação na GitHub REST API](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api), consultada em 03/11/2026. É uma implementação independente com dados próprios, sem afiliação ou integração com a conta GitHub. O código está publicado; a API roda localmente e não está hospedada.

Teste com seus projetos, abra uma issue com uma sugestão ou dê uma estrela para acompanhar. A colaboração por Pix é opcional e está no README; código e documentação continuam gratuitos.

**English summary:** Project Shelf is a local Node.js project catalog with CRUD, search, tag filters, Link pagination, and file persistence. Eleven HTTP integration tests passed. Run the isolated demo and contribute a reproducible example or test. No external dependencies or hosted endpoint.
