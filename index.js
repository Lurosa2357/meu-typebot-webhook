const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json({ limit: "2mb" }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/formatar-mensagem", async (req, res) => {
  try {
    const promptText = req.body?.user_input;

    if (!promptText || typeof promptText !== "string" || !promptText.trim()) {
      return res.status(400).send("O texto da mensagem original não foi fornecido.");
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 512,
        temperature: 0.4
      }
    });

    const prompt = `
Você é um assistente que transforma mensagens de alertas de passagens com milhas
(em texto informal, com emojis) em uma estrutura padronizada, limpa e profissional.

REGRAS:
- Não use emojis
- Não use negrito
- Não invente informações
- Mantenha exatamente o layout solicitado

Mensagem original:
${promptText}

MODELO EXATO:

Oportunidade de emissão – [Destino (com país, se possível)]

Origem: [Cidade – Código do aeroporto]
Destino: [Cidade – Código do aeroporto]
Programa/CIA: [Programa – Companhia aérea]
Classe: [Classe]
A partir de [menor quantidade de milhas + taxas] o trecho

Datas de ida:
[Mês/Ano: dias separados por vírgula]

Datas de volta:
[Mês/Ano: dias separados por vírgula]

Obs: os preços e disponibilidades podem sofrer alterações a qualquer momento.
Emissão: [link correto do programa]
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    res.set("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send(text);

  } catch (err) {
    return res.status(500).send("Erro interno.");
  }
});

app.listen(port, () => {
  console.log(`Rodando na porta ${port}`);
});
