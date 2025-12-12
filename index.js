const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.json({ limit: "10mb" }));

// Middleware para logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Rota de health check para Render (CRÍTICA para evitar cold start)
app.get("/", (req, res) => {
  res.json({ 
    status: "online", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Health check detalhado
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

app.post("/formatar-mensagem", async (req, res) => {
  try {
    const promptText = req.body.user_input;

    // Validações de entrada
    if (!promptText || typeof promptText !== "string" || !promptText.trim()) {
      return res.status(400).json({
        resposta: "O texto da mensagem original não foi fornecido ou está vazio.",
        erro: true,
      });
    }

    if (promptText.length > 5000) {
      return res.status(400).json({
        resposta: "A mensagem é muito longa. Máximo 5000 caracteres.",
        erro: true,
      });
    }

    // Normalizar diferentes tipos de quebra de linha (Make/Telegram)
    let userInput = promptText
      .replace(/\\r\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\n/g, ' ')
      .replace(/\r\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Remover quantidade de assentos entre parênteses (exemplo: "11 (9)" → "11")
    userInput = userInput.replace(/(\d{1,2})\s*\(\d+\)/g, '$1');

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
      },
      systemInstruction: `Você é um reformatador profissional de mensagens de alertas de passagens aéreas com milhas.

REGRAS ABSOLUTAS - NUNCA VIOLE:
1. Responda APENAS com texto simples - ZERO emojis, ZERO negritos, ZERO markdown, ZERO formatação
2. Remova TODOS os símbolos especiais, asteriscos, barras e formatação de qualquer tipo
3. Use APENAS código IATA de 3 letras maiúsculas para aeroportos
4. Datas devem ser EXATAMENTE: "Mês/Ano" (3 letras maiúsculas + "/" + 4 dígitos)
   ✓ Correto: "Dez/2025", "Jan/2026", "Fev/2026"
   ✗ Errado: "Dec/2025", "Jan 2026", "Jan-2026", "December/2025"
5. Agrupe datas por mês/ano e liste separadas por vírgula (SEM parênteses ou quantidade)
6. REMOVA TODA informação sobre quantidade de assentos
7. Mantenha o layout exato - não adicione linhas vazias extras
8. Preserve a ordem: Origem, Destino, Programa/CIA, Classe, Milhas, Datas Ida, Datas Volta
9. Responda APENAS com o texto reformatado, NADA MAIS

MAPEAMENTO OBRIGATÓRIO DE URLS:
- Azul Fidelidade, Azul, AZ, Azul+ → https://www.voeazul.com.br/
- Azul pelo Mundo → https://azulpelomundo.voeazul.com.br/
- LATAM, LATAM Pass, LT, TK → https://latampass.latam.com/pt_br/passagens
- Smiles, SM, GOL → https://www.smiles.com.br/passagens
- AAdvantage, American Airlines, AA → https://www.aa.com/
- Privilege Club, Qatar, QR → https://www.qatarairways.com/en/homepage.html
- Executive Club, British Airways, BA → https://www.britishairways.com/travel/redeem/execclub/_gf/pt_br
- Iberia Plus, IB → https://www.iberia.com/us/
- Virgin Flying Club, VJ, VX → https://www.virginatlantic.com/flying-club/
- Air France, AF → https://www.airfrance.com.br/

FORMATO DE SAÍDA EXATO (sem nenhuma modificação):

Oportunidade de emissão – [Destino]

Origem: [Cidade – CÓDIGO IATA]
Destino: [Cidade – CÓDIGO IATA]

Programa/CIA: [Programa – Companhia]
Classe: [Classe]

A partir de: [Nk] milhas [Programa] + taxas o trecho

Datas de ida:
[Mês/Ano]: data1, data2, data3, data4
[Próximo Mês/Ano]: data5, data6

Datas de volta:
[Mês/Ano]: data1, data2
[Próximo Mês/Ano]: data3, data4

Obs: os preços e disponibilidades podem sofrer alterações a qualquer momento.

Emissão: [URL exata conforme mapeamento]`,
    });

    const prompt = `Reformate esta mensagem de alerta de passagens com milhas seguindo as regras absolutas especificadas:

${userInput}

Responda APENAS com a mensagem reformatada no formato exato, sem explicações, comentários ou qualquer texto adicional.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text() || "Sem resposta.";

    // Validar se resposta contém conteúdo mínimo esperado
    if (!text || text.length < 50) {
      console.warn("Resposta muito curta do Gemini:", text);
      return res.status(500).json({
        resposta: "Erro ao processar: resposta insuficiente do modelo. Verifique o formato da mensagem.",
        erro: true,
      });
    }

    // Limpeza agressiva de markdown e emojis residuais
    let respostaLimpa = text
      .replace(/``````/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*(?!\s)/g, '')
      .replace(/`/g, '')
      .replace(/[🀀-🿿]/gu, '')
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .trim();

    // Verificar se há conteúdo após limpeza
    if (!respostaLimpa) {
      return res.status(500).json({
        resposta: "Erro: resposta vazia após processamento. Tente novamente.",
        erro: true,
      });
    }

    // Log de sucesso
    console.log(`[✓] Formatação bem-sucedida | Entrada: ${promptText.length}c | Saída: ${respostaLimpa.length}c`);

    res.json({
      resposta: respostaLimpa,
      erro: false,
    });

  } catch (error) {
    console.error("[ERRO]", {
      mensagem: error.message,
      tipo: error.constructor.name,
      detalhes: error.response?.data || error.stack,
      timestamp: new Date().toISOString(),
    });

    // Tratamento específico de erros
    if (error.message.includes("API key")) {
      return res.status(500).json({
        resposta: "Erro de configuração: chave de API não configurada corretamente.",
        erro: true,
      });
    }

    if (error.message.includes("Rate limit")) {
      return res.status(429).json({
        resposta: "Limite de requisições atingido. Tente novamente em 60 segundos.",
        erro: true,
      });
    }

    if (error.message.includes("timeout") || error.message.includes("TIMEOUT")) {
      return res.status(504).json({
        resposta: "Timeout na processação. A mensagem pode ser muito complexa. Tente simplificar.",
        erro: true,
      });
    }

    res.status(500).json({
      resposta: "Erro ao gerar resposta. Tente novamente.",
      erro: true,
    });
  }
});

// Middleware de erro global
app.use((err, req, res, next) => {
  console.error("Erro não capturado:", err);
  res.status(500).json({
    resposta: "Erro interno do servidor.",
    erro: true,
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ 
    erro: "Rota não encontrada",
    disponivel: ["/", "/health", "POST /formatar-mensagem"]
  });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🚀 Servidor rodando em http://0.0.0.0:${PORT} - ${new Date().toISOString()}`
  );
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM recebido. Encerrando gracefully...");
  server.close(() => {
    console.log("Servidor encerrado.");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT recebido. Encerrando gracefully...");
  server.close(() => {
    console.log("Servidor encerrado.");
    process.exit(0);
  });
});

// Tratamento de promise rejections não capturadas
process.on("unhandledRejection", (reason, promise) => {
  console.error("Promise rejection não tratada:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("Exceção não capturada:", error);
  process.exit(1);
});
