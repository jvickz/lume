# Lume · v0.4.1

**Leitura e organização de documentos.**

Lume é a evolução do Edital Claro para a leitura de PDFs de diferentes áreas. O nome remete a luz e clareza: encontrar o que importa, compreender com contexto e voltar à fonte.

Desenvolvido por **João Vitor Marinho**. Python + JavaScript, processamento básico local, API separada da interface.

## O que já funciona

| Recurso | Como funciona |
| --- | --- |
| Leitura geral | Aceita PDFs com texto, sem exigir campos de licitação |
| Essencial e detalhado | Seleciona trechos originais por frequência de termos e distribuição entre páginas |
| Ações e datas | Sinaliza menções por palavras e formatos, preservando o contexto e possíveis negações |
| Conferência da fonte | Mostra o trecho no texto extraído e sua página física |
| Anotações | Registra dúvidas junto à leitura |
| Histórico e arquivos | Cinco leituras no navegador, exportação/reabertura JSON e relatório HTML imprimível |
| IA local opcional | Adaptador para explicação e perguntas via Ollama, com referências validadas |

**A leitura básica é extrativa:** escolhe e organiza palavras do próprio documento. Não traduz, não simplifica termos e não equivale a uma explicação gerada por IA.

A IA opcional usa uma seleção de trechos. A existência de uma referência não garante que a interpretação esteja correta.

## Começar no Windows

1. Extraia o pacote inteiro e entre na pasta **Lume**.

2. Tenha Python 3.10 ou superior instalado com **Add Python to PATH**.

3. Abra **iniciar.cmd**. No primeiro uso, ele cria um ambiente virtual e instala pypdf; precisa de internet nessa etapa.

4. O navegador abre em **http://127.0.0.1:8765**.

5. Clique em **Abrir exemplo fictício** ou envie seu PDF.

6. Explore as abas, use **Conferir fonte**, registre anotações e salve ou exporte.

7. Mantenha a janela do servidor aberta; **Ctrl+C** encerra a aplicação.

O botão de exemplo usa um guia fictício de projeto comunitário. O PDF incluído contém o mesmo guia fictício de projeto comunitário.

### Instalação manual

```sh
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
python -m pip install -r requirements.txt
python launch.py
```

Porta alternativa: `python server.py --port 8766`.

## Ativar a explicação e as perguntas

A integração com **Ollama** está implementada, mas nenhum modelo foi instalado ou baixado automaticamente. O recurso precisa de um modelo local compatível com saída JSON estruturada e de recursos suficientes no computador.

1. Instale Ollama a partir de [ollama.com](https://ollama.com/).

2. Escolha e instale um modelo adequado à memória disponível. O Lume não escolhe nem baixa modelos por conta própria.

3. Configure o serviço Ollama para operar sem nuvem: defina **OLLAMA_NO_CLOUD=1** e reinicie o Ollama. Essa variável deve estar no ambiente do serviço Ollama, não apenas no processo do Lume.

4. Execute `ollama list` e copie o nome exato de um modelo local instalado.

5. No PowerShell, na pasta Lume, defina o modelo e inicie:

```powershell
$env:LUME_MODEL = 'NOME_EXATO_DO_MODELO_LOCAL_INSTALADO'
.\iniciar.cmd
```

Substitua o nome de exemplo. Não é uma chave secreta. O serviço é consultado em **http://127.0.0.1:11434**; o Lume não oferece campo para enviar documentos a um endpoint remoto.

**Importante:** a variável OLLAMA_NO_CLOUD precisa ser aplicada ao Ollama e ele deve ser reiniciado. Configurá-la apenas depois que o serviço já está rodando não altera o serviço existente.

Sem o modelo ou com o serviço indisponível, a leitura básica continua disponível. O Lume não inicia nem encerra automaticamente o serviço Ollama.

[Guia da integração com IA](docs/ia-local.md)

## Uso em diferentes áreas

- **Estudos:** localizar trechos de textos acadêmicos e formular perguntas sobre a seleção.

- **Trabalho:** organizar a leitura de relatórios, propostas e projetos.

- **Manuais:** localizar instruções e conferir o contexto antes de executar atividades.

- **Documentos cotidianos:** destacar passagens relevantes e registrar dúvidas.

- **Editais:** usar a leitura geral para localizar e conferir trechos. Os campos específicos continuam no Edital Claro v0.3.

A seleção por frequência não mede importância jurídica, científica ou financeira. O projeto ainda não foi avaliado em uma amostra representativa de documentos reais.

## O que mudou desde o Edital Claro

- Novo nome **Lume**, fundo claro, tipografia simples e azul discreto.

- Tela inicial dedicada à leitura geral.

- Motor extrativo independente de campos de edital.

- Abas Essencial, Detalhado e Ações e datas.

- Referências, busca literal, anotações e histórico próprios.

- Adaptador de IA local para explicações e perguntas.

- API própria de documentos para futuras integrações.

- Pacote independente de leitura geral; mantenha o Edital Claro v0.3 para seu modo especializado.

## Integração com outros sistemas

A interface consulta a API local; os motores Python podem ser chamados por uma futura camada de serviço.

- `POST /api/v1/documents/analyze`: leitura geral de PDF.

- `POST /api/v1/documents/explain`: explicação/pergunta com IA configurada.

- `GET /api/v1/documents/capabilities`: configuração disponível, sem garantir que o modelo esteja pronto.

O endpoint antigo de editais pertence ao pacote Edital Claro v0.3 e não está neste pacote.

A integração ao **Licite** e o aplicativo Windows instalado continuam como próximas etapas. Não foram aplicadas alterações ao Licite nesta versão.

[Contrato da API](docs/api.md) · [Plano de evolução](docs/plano.md)

## Limites e dados

- Até **20 MiB, 300 páginas e 2 milhões de caracteres** extraídos.

- Sem OCR: PDFs escaneados podem retornar pouco ou nenhum texto.

- Arquivos protegidos por senha são recusados.

- Tabelas, gráficos, fórmulas, manuscritos e colunas não têm interpretação visual garantida.

- Extração até 30 segundos; operação de IA até 60 segundos no processo.

- Perguntas usam busca por palavras, que pode falhar em sinônimos ou relações indiretas.

- Os primeiros 12 trechos com ações/datas são mostrados; não é um inventário completo.

- O histórico é limitado ao navegador e à quota disponível. Trocar porta/perfil ou limpar dados pode fazê-lo desaparecer.

- JSON e HTML contêm texto extraído e anotações. O PDF original não é salvo pelo servidor.

- A aplicação escuta apenas em 127.0.0.1. Uso multiusuário exige autenticação, isolamento, limites de recursos e auditoria.

O motor de leitura básica não faz chamadas externas. A configuração e operação do serviço Ollama são independentes; siga o modo sem nuvem descrito acima.

## Verificação desta entrega

Consulte [docs/validacao.md](docs/validacao.md) para os resultados desta versão. A IA foi verificada com respostas simuladas; a inferência real e a inspeção visual em navegador continuam pendentes.

```sh
python -m unittest discover -s tests -v
node --check web/lume.js
node --test tests/lume.test.cjs
```

[Detalhes da validação](docs/validacao.md)

---

Projeto de [João Vitor Marinho](https://github.com/jvickz). O nome foi escolhido pela proposta de clareza; não foi realizada pesquisa de registro de marca.