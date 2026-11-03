# Verificação — 03/11/2026

Ambiente observado: Linux, Node.js v24.22.1. Sem instalação de dependências externas.

## Comandos executados

```bash
npm test --prefix api-lab-2026-11-03
node api-lab-2026-11-03/examples/demo.mjs
```

Dentro do repositório: `npm test` e `node examples/demo.mjs`.

## Resultado dos testes

11 testes, 11 aprovados, 0 falhas, 0 cancelados, 0 ignorados. Duração reportada pelo runner: 354.859381 ms (varia a cada execução).

1. CRUD HTTP completo, Location, timestamps, atualização parcial e exclusão 204.
2. Cadastro, alteração e exclusão preservados após fechar e abrir o servidor.
3. Travessia real dos links de paginação sem perda/duplicação em catálogo estático, com filtros preservados.
4. Ordenação com desempate e busca sem distinguir caixa; resultado vazio sem Link.
5. Campos inválidos, URLs, slug imutável e PATCH vazio.
6. Parâmetros inválidos/repetidos.
7. JSON inválido, Content-Type incorreto e corpo acima de 16 KiB.
8. Doze cadastros concorrentes sem perda; duplicação retorna 409.
9. 404/405 e formato de erro.
10. Falha de gravação simulada: 503, sem alterar memória ou arquivo original.
11. Dados corrompidos impedem inicialização e não são sobrescritos.

O npm emitiu um aviso sobre a configuração ambiental `http-proxy`; o processo terminou com exit code 0. O projeto não adiciona essa configuração.

## Demonstração executada

- POST estufa → 201, Location /projects/estufa.
- POST sumo → 201, Location /projects/sumo.
- GET /projects?tag=esp32&per_page=1 → 200, total 2, pages 2, primeiro slug estufa.
- Link observado: `</projects?tag=esp32&per_page=1&page=2>; rel="next", </projects?tag=esp32&per_page=1&page=2>; rel="last"`.
- Timestamps da primeira execução da demo: 2026-11-03T10:04:24.913Z para o primeiro registro; valores são dinâmicos.

## Limites da evidência

Verificação local por HTTP real em porta efêmera. O reinício testado recria o servidor e recarrega o arquivo no mesmo processo de teste; não é um teste de queda de energia. Não foram feitos testes de carga, validação em Windows, múltiplos processos, serviço hospedado ou integração com GitHub. Referências oficiais consultadas nesta data; não há consulta externa durante o uso da API.

Melhoria de contribuição: demo isolada reproduzível, guia de contribuição e formulário de bug com ambiente e passos para reprodução.
