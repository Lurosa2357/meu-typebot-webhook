const express = require("express");
const bodyParser = require("body-parser");

// importa a lib oficial (@google/generative-ai)
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 10000;

// JSON do Typebot
app.use(bodyParser.json());

// cria o cliente da Gemini API usando a variável GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/formatar-mensagem", async (req, res) => {
  const promptText = req.body.text || "Texto não fornecido.";

  try {
    // usa o modelo igual ao exemplo da doc
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(promptText);
    const response = await result.response;
    const text = response.text() || "Sem resposta.";

    res.json({ resposta: text });
  } catch (error) {
    console.error(
