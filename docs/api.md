# API do Lume v0.4.1

O servidor é local: http://127.0.0.1:8765. Não publique diretamente na internet.

## Leitura geral

POST /api/v1/documents/analyze

- Corpo: bytes do PDF, sem multipart.

- Content-Type: application/pdf.

- Content-Length obrigatório.

- Limite: 20 MiB, 300 páginas, 2 milhões de caracteres extraídos, 30 segundos.

- Resposta schema_version: lume/1.0.

Campos da resposta:

- pages: number (página física) e text.

- summary.short / summary.detailed: id, page e quote; são trechos originais.

- signals.actions / signals.dates: menções por regras, com as mesmas fontes.

- coverage: páginas com texto e seleção apresentada.

- keywords: termos frequentes; não são classificação de assunto.

- unreadable_pages, warnings, created_at, method.

- filename: documento.pdf; a interface atribui o nome original.

A interface acrescenta notes, id e ai quando aplicável. Os dados não são persistidos no servidor.

## IA opcional

POST /api/v1/documents/explain

- Content-Type: application/json; Content-Length obrigatório.

- Corpo: pages (lista de strings), mode (quick, detailed ou question), question (até 1000 caracteres).

- Limite do corpo: 8 MiB; validação de páginas e texto como acima.

- LUME_MODEL configura um modelo local.

- Seleção: até 24 trechos e 16 mil caracteres antes da inferência.

- Tempo máximo do subprocesso: 60 segundos.

- Resposta: items com category, text e sources resolvidas no servidor; model, limitation, pages_used, sources_used.

Todo item precisa referenciar um trecho existente. As fontes são recuperadas do contexto enviado, não inventadas pelo modelo. Essa validação estrutural não certifica correção semântica.

As perguntas usam correspondência de palavras para selecionar o contexto. Se não houver correspondência, a API pode retornar uma resposta vazia sem consultar o modelo. Não é busca semântica nem leitura integral de todos os documentos longos.

## Outros endpoints

GET /api/v1/documents/demo — conteúdo fictício de projeto comunitário.
GET /api/v1/documents/capabilities — ai_configured, model e ocr=false. Configuração não é teste de disponibilidade do serviço.
GET /api/v1/health — versão.
O modo especializado e sua API continuam disponíveis no pacote Edital Claro v0.3.

## Falhas

400 conteúdo vazio/incompleto ou Transfer-Encoding.
403 Host ou Origin não permitido.
413 tamanho acima do limite.
415 tipo de conteúdo incorreto.
422 leitura impossível, JSON inválido, IA indisponível, resposta rejeitada ou timeout.
429 dois trabalhos em andamento.

## Integração futura

Chame os motores pelo backend autenticado de seu produto ou por um serviço privado. Não faça um site público tentar acessar o loopback do usuário.

Para Licite: vincular leitura ao processo e versão do edital, preservar original e hash, autenticar usuários, auditar revisões, definir retenção e limites por usuário. Para outros sistemas, definir campos e objetivos próprios.

O subprocesso atual impõe timeout, não teto de memória. A versão local não oferece isolamento suficiente para uso público multiusuário.