![Project Shelf API: organize, encontre, compartilhe](brand/banner.svg)

# Project Shelf API · Catálogo de projetos

Organize projetos de aulas, portfólio ou laboratório em um catálogo que pode ser consultado por nome, descrição e etiqueta. Cadastre uma vez e navegue por páginas, com os registros preservados ao reiniciar.

**Dia 01/10 · 03/11/2026 · Node.js 22+ · zero dependências externas · 11 testes aprovados**

[Começar](#comece-em-um-minuto) · [Rotas](#contrato-http) · [Verificação](VERIFICATION.md) · [Anúncio](ANNOUNCEMENT.md) · [Texto para LinkedIn](LINKEDIN.md) · [Contribuir](CONTRIBUTING.md) · [Apoiar](#-incentive-mais-código-aberto)

Implementação própria inspirada na paginação da GitHub REST API. Os dados são cadastrados por você: esta API não consulta repositórios, não acessa sua conta e não tem vínculo com o GitHub. O código está publicado para execução local; não há endpoint público hospedado.

## Comece em um minuto

Requisito: Node.js 22 ou superior. Verificado com Node.js **24.22.1**. Não precisa de token, banco externo ou `npm install`.

```bash
git clone https://github.com/perabru/api-lab-2026-11-03.git
cd api-lab-2026-11-03
npm start
```

Em outro terminal (Bash, WSL ou Git Bash):

```bash
curl -i http://127.0.0.1:3000/health
curl -i -X POST http://127.0.0.1:3000/projects \
  -H 'Content-Type: application/json' \
  -d '{"slug":"estufa","name":"Estufa ESP32","tags":["esp32"]}'
curl 'http://127.0.0.1:3000/projects/estufa'
```

O cadastro retorna **201 Created** com `Location: /projects/estufa`. O registro inclui `slug`, `name`, `description`, `tags`, `url`, `created_at` e `updated_at`. Os horários UTC são gerados pelo servidor. Repetir o cadastro com o mesmo slug retorna **409**, sem duplicar o registro.

## Contrato HTTP

| Método | Rota | Resultado |
|---|---|---|
| GET | `/health` | 200, `{"status":"ok"}` |
| POST | `/projects` | 201, projeto criado; cabeçalho `Location` |
| GET | `/projects` | 200, `items`, `total`, `page`, `per_page`, `pages` |
| GET | `/projects/:slug` | 200, um projeto; 404 se não existir |
| PATCH | `/projects/:slug` | 200, projeto atualizado; slug imutável |
| DELETE | `/projects/:slug` | 204, sem corpo; 404 se não existir |

### Campos de cadastro e alteração

| Campo | Regra |
|---|---|
| `slug` | Obrigatório no POST; 1–80 caracteres minúsculos, números e hífens entre segmentos; único e imutável |
| `name` | Obrigatório no POST; texto não vazio, até 120 caracteres |
| `description` | Opcional, até 1000 caracteres; padrão vazio |
| `tags` | Até 10 identificadores de até 30 caracteres; mesmo formato do slug; duplicatas removidas |
| `url` | Opcional; vazio ou HTTPS sem usuário/senha; até 2048 caracteres; apenas armazenada, nunca acessada |

Textos não aceitam caracteres de controle. Campos desconhecidos são rejeitados. PATCH aceita apenas campos mutáveis e exige pelo menos um. `created_at` e `updated_at` são gerados pelo servidor.

```bash
curl -X PATCH http://127.0.0.1:3000/projects/estufa \
  -H 'Content-Type: application/json' \
  -d '{"description":"Monitoramento de sensores","tags":["esp32","iot"]}'
curl -i -X DELETE http://127.0.0.1:3000/projects/estufa
```

### Busca, filtros e paginação

| Parâmetro | Regra / padrão |
|---|---|
| `q` | Busca parcial em nome e descrição, sem distinguir maiúsculas; até 200 caracteres; sem normalização de acentos |
| `tag` | Correspondência exata com uma etiqueta |
| `sort` | `name` (padrão) ou `created_at` |
| `order` | `asc` (padrão) ou `desc` |
| `page` | Inteiro 1–1000000; padrão 1 |
| `per_page` | Inteiro 1–100; padrão 20 |

Filtros são combinados por AND. A ordenação usa comparação textual determinística com desempate por slug, não ordenação linguística por idioma. Parâmetros desconhecidos, repetidos ou fora dos limites retornam 400. Página além do final retorna `items: []`, preservando o total.

```bash
curl -i 'http://127.0.0.1:3000/projects?tag=esp32&per_page=1'
```

Com os dois projetos da [demonstração isolada](examples/demo.mjs), a resposta verificada contém `total: 2`, `page: 1`, `per_page: 1`, `pages: 2` e um item `estufa`. O cabeçalho foi:

```http
Link: </projects?tag=esp32&per_page=1&page=2>; rel="next", </projects?tag=esp32&per_page=1&page=2>; rel="last"
```

Os links são referências relativas à mesma origem, preservam filtros e podem conter `first`, `prev`, `next` e `last`. Resolva-os contra a URL da requisição. Não há `Link` quando não existe página vizinha, quando o resultado está vazio ou a página solicitada está além do final. Mudanças no catálogo entre requisições podem deslocar itens: não é uma paginação por snapshot.

### Erros previsíveis

```json
{"error":{"code":"duplicate_slug","message":"Este slug já existe."}}
```

| Status | Situação |
|---|---|
| 400 | JSON inválido ou parâmetros de consulta inválidos |
| 404 | Rota ou projeto inexistente |
| 405 | Método não permitido; cabeçalho `Allow` informa os aceitos |
| 409 | Slug duplicado ou catálogo com 1000 projetos |
| 413 | Corpo maior que 16 KiB |
| 415 | POST/PATCH sem `Content-Type: application/json` |
| 422 | Campo inválido, desconhecido ou imutável |
| 503 | Falha de persistência; alteração não aplicada em memória |

## Persistência e limites

Por padrão, os dados ficam em `data/projects.json` (ignorado pelo Git). Cada alteração escreve um temporário e faz rename antes de atualizar a memória. Um arquivo corrompido impede a inicialização e é preservado para recuperação manual. Faça backup com o processo parado. O arquivo comporta até 1000 projetos.

```bash
PORT=3100 DATA_FILE=./data/laboratorio.json npm start
```

`HOST` padrão é `127.0.0.1`; `PORT` padrão é `3000`. Use **um único processo por arquivo**: não há lock entre processos. O catálogo inteiro é carregado em memória e gravado a cada mutação; não é indicado para grandes volumes. A escrita por rename evita substituição parcial em condições normais, mas não promete durabilidade diante de queda de energia.

Não há autenticação, autorização, CORS ou proteção para exposição pública. A configuração padrão é local. Não armazene dados sensíveis; antes de hospedar, planeje autenticação, HTTPS, limites de tráfego e um banco apropriado. A URL cadastrada não é validada quanto a existência ou segurança do destino, pois não é acessada.

## Teste e explore sem alterar seus dados

```bash
npm test
node examples/demo.mjs
```

**Resultado real em 03/11/2026: 11 testes aprovados, 0 falhas.** Testes e demo usam diretórios temporários isolados, sem alterar o catálogo habitual. [Veja o registro da execução e seus limites](VERIFICATION.md).

## Referências consultadas em 03/11/2026

- [GitHub REST API — paginação](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api): inspiração para `page`, `per_page` e navegação por `Link`. Esta implementação é independente e rejeita `per_page` acima de 100 em vez de reduzi-lo silenciosamente.
- [Node.js — HTTP](https://nodejs.org/api/http.html): servidor e respostas com módulos nativos. As funções utilizadas foram verificadas no runtime indicado acima.

## 💛 Incentive mais código aberto

![Apoio voluntário por Pix](https://raw.githubusercontent.com/perabru/peradev-apis/main/brand/pix-support.svg)

Se este catálogo ajudou você a aprender ou construir algo, uma colaboração voluntária incentiva a continuidade e a criação de novas APIs.

### Chave Pix — copie e cole

```text
bruno.pera@unifesp.br
```

**O apoio é opcional. O código permanece aberto e gratuito para todos.**

Obrigado por incentivar exemplos executáveis, testes e conhecimento compartilhado.

## Construa junto

Encontrou uma falha? Use o [formulário de bug](https://github.com/perabru/api-lab-2026-11-03/issues/new?template=bug_report.yml) com comando, resultado esperado e observado. O [guia de contribuição](CONTRIBUTING.md) explica como reproduzir os testes, proteger seus dados e propor uma mudança pequena.

**English:** A local project catalog API built with Node.js core modules. CRUD, search, tag filtering, deterministic pagination with Link headers, and JSON persistence. Eleven HTTP integration tests pass. No GitHub integration, credentials, or hosted endpoint.

[Calendário das 10 APIs](https://github.com/perabru/peradev-apis/blob/main/docs/10-days.md) · **Licença MIT — Bruno Michel Pera**
