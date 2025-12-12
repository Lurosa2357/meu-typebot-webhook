const express = require("express");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());

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

Converta a mensagem recebida para EXATAMENTE o formato abaixo.
Não use emojis. Não use negrito. Não adicione nem remova linhas.
Não escreva absolutamente nada fora do modelo.

MODELO FIXO (OBRIGATÓRIO):

Oportunidade de emissão – [Destino]

Origem: [Cidade – IATA]
Destino: [Cidade – IATA]
Programa/CIA: [Programa – Companhia]
Classe: [Classe]
A partir de [milhas necessárias + taxas] o trecho

Datas de ida: [Mês/Ano: datas separadas por vírgulas]
Datas de volta: [Mês/Ano: datas separadas por vírgulas]

Obs: os preços e disponibilidades podem sofrer alterações a qualquer momento.

Emissão: [link correto de acordo com o programa de milhas]

REGRAS:
- Meses: Jan, Fev, Mar, Abr, Mai, Jun, Jul, Ago, Set, Out, Nov, Dez
- Ignore números entre parênteses
- Use o menor valor de milhas
- Separe meses com ;
- Não invente dados
- Retorne APENAS o texto final
- se não tiver informação de Classe (econômica ou executiva), coloque econômica, se for voo nacional, sempre classe economica

MENSAGEM ORIGINAL:
${userInput}

RETORNE SOMENTE O TEXTO FINAL FORMATADO.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text() || "";

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
