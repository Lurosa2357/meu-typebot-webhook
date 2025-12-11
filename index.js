const express = require("express");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 10000;

// JSON do Typebot
app.use(bodyParser.json());

// cliente Gemini usando GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/formatar-mensagem", async (req, res) => {
  const promptText = req.body.text || "Texto não fornecido.";

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(promptText);
    const response = await result.response;
    const text = response.text() || "Sem resposta.";

    res.json({ resposta: text });
  } catch (error) {
    console.error(
      "Erro na requisição:",
      error.response?.data || error.message || error
    );
    res.status(500).json({ erro: "Erro ao gerar resposta" });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
