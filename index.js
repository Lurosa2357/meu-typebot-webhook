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
    // NÃO coloque a chave direto aqui.
    // No Render, crie a variável GEMINI_API_KEY com o valor da sua chave.
    const apiKey = process.env.GEMINI_API_KEY;

const url =
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=" +
  apiKey;

    const response = await axios.post(url, {
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
    });

    const output =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sem resposta.";
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




