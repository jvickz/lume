# Explicações e perguntas com IA local

## Estado atual

O adaptador está implementado em ai_local.py e foi testado com respostas simuladas. Não foi instalado um modelo nem executada inferência real nesta entrega.

Nenhum serviço pago é necessário para a leitura básica. Rodar IA local depende de instalação, armazenamento, memória e processamento do computador. O Lume não contrata serviços nem baixa modelos automaticamente.

## Configuração

Use Ollama em 127.0.0.1:11434, configure OLLAMA_NO_CLOUD=1 **no ambiente do Ollama** e reinicie esse serviço. Defina LUME_MODEL no ambiente que inicia o Lume com o nome exato de um modelo local instalado.

O Lume recusa nomes com “cloud”, consulta /api/show e recusa indicação de modelo remoto ou falta de metadados de modelo local. Ainda assim, configure corretamente o serviço Ollama; o Lume não gerencia sua instalação.

## Como a explicação é produzida

1. Validar o texto e os limites da solicitação.

2. Selecionar até 24 trechos; perguntas usam correspondência de palavras.

3. Conferir metadados do modelo local.

4. Solicitar JSON estruturado por /api/chat, sem ferramentas nem execução de comandos.

5. Exigir uma ou mais fontes para cada item.

6. Recusar fontes inexistentes e devolver as citações originais correspondentes.

O texto do PDF é tratado como conteúdo não confiável nas instruções do modelo. Isso reduz o risco de seguir instruções do documento, mas não é garantia contra manipulação ou alucinação. Nenhuma saída do modelo é executada.

## O que ainda precisa ser avaliado

- Qualidade em português, modelos e memória disponíveis.

- Perguntas com sinônimos, inferências e documentos extensos.

- Fidelidade semântica entre resposta e fonte.

- Tempo de resposta e comportamento em limites de contexto.

- Interface e interação em navegador real.

A validação dos IDs de fonte impede referência a páginas inventadas na resposta aceita. Não prova que a fonte realmente sustente cada interpretação.

## Referências técnicas oficiais

Consultadas em 10/11/2026:

- https://docs.ollama.com/api/chat

- https://docs.ollama.com/capabilities/structured-outputs

- https://docs.ollama.com/faq

A API aceita um JSON schema no campo format e stream=false para resposta completa. A desativação de recursos de nuvem do Ollama exige reinício do serviço após configurar OLLAMA_NO_CLOUD=1.