const express = require("express");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 10000;

// Middleware para ler JSON
app.use(bodyParser.json());

// Instância do Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Rota principal
app.post("/formatar-mensagem", async (req, res) => {
  const userInput = req.body.user_input;

  // Validação básica
  if (!userInput || typeof userInput !== "string" || !userInput.trim()) {
    return res.status(400).json({
      erro: "O campo 'user_input' é obrigatório e deve ser uma string não vazia."
    });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 900
      }
    });

    // PROMPT JSON ESTRITO
    const prompt = `
Você é um FORMATADOR DE DADOS ESTRITO.

Sua única tarefa é ler a mensagem abaixo e retornar APENAS UM OBJETO JSON válido, seguindo EXATAMENTE o schema definido.

REGRAS OBRIGATÓRIAS:
- Retorne SOMENTE JSON válido
- NÃO use emojis
- NÃO use markdown
- NÃO escreva texto fora do JSON
- NÃO invente dados
- NÃO mantenha textos promocionais, CTAs, hacks, clubes ou observações extras
- Ignore números entre parênteses (ex: 12 (7))
- Se um campo não existir, use null
- Agrupe datas por mês e ano
- Use meses abreviados em português: Jan, Fev, Mar, Abr, Mai, Jun, Jul, Ago, Set, Out, Nov, Dez

SCHEMA OBRIGATÓRIO:
{
  "titulo": "string",
  "origem": {
    "cidade": "string",
    "iata": "string"
  },
  "destino": {
    "cidade": "string",
    "iata": "string"
  },
  "programa": "string",
  "companhia": "string",
  "classe": "string",
  "milhas_minimas": "string",
  "datas_ida": {
    "Mes/Ano": ["DD", "DD"]
  },
  "datas_volta": {
    "Mes/Ano": ["DD", "DD"]
  },
  "link_emissao": "string"
}

LINK DE EMISSÃO (usar exatamente conforme o programa):
Azul Fidelidade / Azul → https://www.voeazul.com.br/
Azul pelo Mundo → https://azulpelomundo.voeazul.com.br/
Latam → https://latampass.latam.com/pt_br/passagens
Smiles → https://www.smiles.com.br/passagens
Privilege Club - Qatar → https://www.qatarairways.com/en/homepage.html
Executive Club - British → https://www.britishairways.com/travel/redeem/execclub/_gf/pt_br
Iberia Plus → https://www.iberia.com/us/
Flying Club - Virgin → https://www.virginatlantic.com/flying-club/
AAdvantage → https://www.aa.com/

MENSAGEM ORIGINAL:
${userInput}

RETORNE APENAS O JSON.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error("Resposta vazia do Gemini");
    }

    // Parse defensivo do JSON
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error("JSON inválido retornado pelo Gemini:", text);
      return res.status(500).json({
        erro: "O Gemini retornou um JSON inválido.",
        bruto: text
      });
    }

    // Retorna JSON PURO para o Make
    return res.json(parsed);

  } catch (error) {
    console.error("Erro geral:", error.message || error);
    return res.status(500).json({
      erro: "Erro ao processar a mensagem com o Gemini."
    });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("API de formatação com Gemini (JSON) está rodando.");
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
