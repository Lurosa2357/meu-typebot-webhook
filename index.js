const express = require("express");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());

// A chave DEVE estar no Render como variável de ambiente:
// KEY: GEMINI_API_KEY
// VALUE: sua_chave_do_gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/formatar-mensagem", async (req, res) => {
  const userInput = req.body.user_input;

  if (!userInput || typeof userInput !== "string") {
    return res.status(400).json({ erro: "user_input obrigatório" });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 900
      }
    });

    const prompt = `
Você é um FORMATADOR DE TEXTO ESTRITO.

Sua tarefa é converter a mensagem recebida em EXATAMENTE este formato, sem emojis, sem negrito e sem qualquer texto fora do modelo.

FORMATO FIXO (NÃO ALTERE NADA):

Oportunidade de emissão – [Destino]

Origem: [Cidade – IATA]
Destino: [Cidade – IATA]
Programa/CIA: [Programa – Companhia]
Classe: [Classe]
A partir de [menor valor de milhas + taxas] o trecho

Datas de ida: [Mês/Ano: datas separadas por vírgula]
Datas de volta: [Mês/Ano: datas separadas por vírgula]

Obs: os preços e disponibilidades podem sofrer alterações a qualquer momento.

Emissão: [link correto do programa]

REGRAS:
- Use meses abreviados: Jan, Fev, Mar, Abr, Mai, Jun, Jul, Ago, Set, Out, Nov, Dez e ano AAAA
- Ignore números entre parênteses
- Se houver mais de um mês, separe por ;
- Não invente dados
- Não explique nada
- Não adicione nada antes ou depois do texto final

MENSAGEM ORIGINAL:
${userInput}

RETORNE APENAS O TEXTO FINAL.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return res.json({ resposta: text.trim() });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ erro: "Erro ao processar mensagem" });
  }
});

app.get("/", (req, res) => {
  res.send("API rodando");
});

app.listen(port, () => {
  console.log("Servidor rodando na porta", port);
});
