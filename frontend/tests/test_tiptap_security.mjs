import { JSDOM } from "jsdom";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

// 1. Inicializa o ambiente DOM para simular o navegador
const dom = new JSDOM("<!DOCTYPE html><html><body><div id='editor'></div></body></html>", {
  url: "http://localhost:3000",
});
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;

console.log("[TipTap Security Test] Ambiente DOM inicializado com sucesso.");

// 2. Configura o Editor com o mesmo Schema utilizado no NotesEditor da plataforma
const editor = new Editor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
  ],
  content: "",
});

const payloads = [
  {
    name: "Scripts executáveis embutidos",
    input: "<p>Texto normal</p><script>alert('XSS_SCRIPT')</script><p>Fim</p>",
    forbiddenPatterns: ["<script", "alert('XSS_SCRIPT')", "XSS_SCRIPT"],
    requiredPatterns: ["Texto normal", "Fim"],
  },
  {
    name: "Atributos de eventos inline em parágrafos e spans",
    input: "<p onmouseover=\"alert('XSS_EVENT')\" onclick=\"alert('CLICK')\">Trecho de pesquisa</p>",
    forbiddenPatterns: ["onmouseover", "onclick", "XSS_EVENT", "CLICK"],
    requiredPatterns: ["Trecho de pesquisa", "<p>Trecho de pesquisa</p>"],
  },
  {
    name: "Elementos de mídia com manipuladores onerror/onload",
    input: "<img src='fake.jpg' onerror=\"alert('XSS_IMG')\" /><svg onload=\"alert('XSS_SVG')\"></svg>",
    forbiddenPatterns: ["<img", "<svg", "onerror", "onload", "XSS_IMG", "XSS_SVG"],
    requiredPatterns: [],
  },
  {
    name: "Frames e iframes com esquemas javascript:",
    input: "<iframe src=\"javascript:alert('XSS_IFRAME')\"></iframe>",
    forbiddenPatterns: ["<iframe", "javascript:", "XSS_IFRAME"],
    requiredPatterns: [],
  },
  {
    name: "Manipuladores de eventos em tags permitidas (Headings, Blockquotes)",
    input: "<h1 onclick=\"alert('H1_EVENT')\">Título Seguro</h1><blockquote onmouseenter=\"alert('QUOTE_EVENT')\">Citação</blockquote>",
    forbiddenPatterns: ["onclick", "onmouseenter", "H1_EVENT", "QUOTE_EVENT", "alert("],
    requiredPatterns: ["<h1>Título Seguro</h1>", "<blockquote>", "Citação"],
  },
];

let failed = 0;

for (const testCase of payloads) {
  console.log(`\n--- Testando: ${testCase.name} ---`);
  console.log(`Input: ${testCase.input}`);

  // Simula a transferência de conteúdo transferido para o editor de notas
  editor.commands.setContent(testCase.input);

  const outputHtml = editor.getHTML();
  console.log(`TipTap Output HTML: ${outputHtml}`);

  let hasError = false;

  for (const forbidden of testCase.forbiddenPatterns) {
    if (outputHtml.toLowerCase().includes(forbidden.toLowerCase())) {
      console.error(`[FALHA] Padrão perigoso '${forbidden}' foi encontrado na saída renderizada do TipTap!`);
      hasError = true;
    }
  }

  for (const required of testCase.requiredPatterns) {
    if (!outputHtml.includes(required)) {
      console.error(`[FALHA] Padrão seguro obrigatório '${required}' não foi preservado na saída!`);
      hasError = true;
    }
  }

  if (hasError) {
    failed++;
  } else {
    console.log(`[PASSOU] Conteúdo perigoso foi devidamente descartado pelo parser do ProseMirror/TipTap.`);
  }
}

console.log("\n==========================================");
if (failed === 0) {
  console.log(`SUCESSO: Todos os ${payloads.length} testes de segurança do TipTap passaram!`);
  console.log("Conclusão: O ProseMirror StarterKit descarta nativamente elementos não permitidos e atributos de evento inline.");
  process.exit(0);
} else {
  console.error(`ERRO: ${failed} testes de segurança falharam!`);
  process.exit(1);
}
