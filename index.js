const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 10000;

// Middleware JSON
app.use(express.json({ limit: "1mb" }));

// Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/formatar-mensagem", async (req, res) => {
  try {
    const promptText = req.body?.user_input;

    // Validação forte (Make-friendly)
    if (!promptText || typeof promptText !== "string" || !promptText.trim()) {
      return res.status(400).json({
        resposta: "O texto da mensagem original não foi fornecido."
      });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const prompt = `
Você é um assistente que transforma mensagens de alertas de passagens com milhas
(em texto informal, com emojis) em uma estrutura padronizada, limpa e profissional.

REGRAS OBRIGATÓRIAS:
- Não use emojis
- Não use negrito
- Não invente informações
- Mantenha exatamente o layout solicitado
- Organize datas por mês/ano
- Separe dias por vírgula

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
    const text = result.response.text();

    return res.json({ resposta: text });

  } catch (error) {
    console.error("Erro /formatar-mensagem:", error);

    return res.status(500).json({
      resposta: "Erro interno ao processar a mensagem."
    });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
