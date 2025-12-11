const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const port = process.env.PORT || 10000;

// Para o JSON do Typebot
app.use(bodyParser.json());

app.post("/formatar-mensagem", async (req, res) => {
  const promptText = req.body.text || "Texto não fornecido.";

  try {
    // No Render, configure a variável GEMINI_API_KEY com a sua chave
    const apiKey = process.env.GEMINI_API_KEY;

    const url =
      "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=" +
      apiKey;

    const response = await axios.post(url, {
      prompt: { text: promptText },
      temperature: 0.7,
      candidateCount: 1,
    });

    const output =
      response.data?.candidates?.[0]?.output || "Sem resposta.";
    res.json({ resposta: output });
  } catch (error) {
    console.error(
      "Erro na requisição:",
      error.response?.data || error.message
    );
    res.status(500).json({ erro: "Erro ao gerar resposta" });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
