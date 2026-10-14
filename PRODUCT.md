# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Pesquisadores e Cientistas de Dados:** Análise transversal de múltiplos artigos e relatórios técnicos densos, extração de dados e síntese de hipóteses.
- **Analistas Jurídicos e de Compliance:** Revisão de contratos, identificação de cláusulas e auditoria de riscos regulatórios com comprovação de evidências.
- **Executivos e Tomadores de Decisão:** Extração de resumos executivos, briefings estruturados e cronogramas estratégicos.
- **Engenheiros de IA & Avaliadores de RAG:** Monitoramento de confiabilidade (Faithfulness, Recall@5, MRR@5, latências P50/P95/P99).

## Product Purpose

Fornecer um ambiente de trabalho analítico e workspace de inteligência documental (*NotebookLM Style*) 100% local, ultra-leve e focado em privacidade, permitindo que usuários façam perguntas em linguagem natural e recebam respostas rigorosamente fundamentadas em evidências visuais e rastreáveis na página original dos documentos.

## Positioning

Diferente de wrappers de IA genéricos ou ferramentas corporativas pesadas e lentas, a **Document AI Platform** entrega um ecossistema **100% local, instantâneo e ultra-leve** com:
1. **Busca Híbrida (Sparse FTS + Dense HNSW) com Fusão RRF na camada de serviço** e **Reranking Cross-Encoder TinyBERT ONNX** (<15MB RAM).
2. **Visualizador de PDF com Destaque de Bounding Box** para auditoria visual da evidência na página original.
3. **Editor de Notas Integrado (Tiptap)** para síntese contínua e exportação sem sair do aplicativo.
4. **Isolamento Multiusuário na Camada de Aplicação (`WHERE owner_id = :user_id`)** nos repositórios.
5. **Higienização Determinística contra Indirect Prompt Injections**.

## Operating Context

- Aplicação web responsiva com bancada de 3 colunas (Fontes em Custódia, Dossiê Central de Chat SSE, Studio de Evidências/Notas).
- Sessões de trabalho prolongadas em ambiente de leitura densa e análise investigativa.

## Capabilities and Constraints

- **Capacidades Confirmadas:**
  - Ingestão assíncrona local com semáforo de concorrência (`asyncio.Queue`) e telemetria SSE de progresso.
  - Chunking estruturado preservando tabelas Markdown e coordenadas de bounding box normalizadas.
  - Geração de embeddings em lote via provider configurável (Ollama ou Google Gemini).
  - Interface de notas com auto-salvamento no store e exportação em Markdown (`.md`).
  - Dashboard de avaliação RAG com LLM-as-a-Judge e 5 Quality Gates.
- **Restrições:**
  - Operação 100% local (sem dependência de Redis ou RabbitMQ externos).
  - Máxima eficiência e leveza de hardware.

## Brand Commitments

- **Nome:** Document AI Platform.
- **Linguagem Visual:** "Editorial Dark Mode" com tipografia Source Serif 4 e destaques âmbar de evidência (`#D97706`).

## Evidence on Hand

- Suíte de 54 testes automatizados (34 unitários isolados sem banco + 20 de integração).
- Base de código completa em Next.js 16 App Router e FastAPI.

## Product Principles

1. **Evidência em Primeiro Lugar (Evidence First):** Nenhuma afirmação sem citação e destaque visual exato na fonte.
2. **Leveza e Eficiência Extrema:** Execução local sem bloat, consumo mínimo de memória RAM e latência instantânea.
3. **Soberania e Privacidade de Dados:** Controle total local e isolamento multitenant estrito na camada de aplicação e repositórios.
4. **Continuidade de Fluxo Cognitivo:** Unificação de leitura, pesquisa RAG e redação de notas em uma única bancada de trabalho.
