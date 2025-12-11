const express = require("express");
const bodyParser = require("body-parser");
const { GoogleAuth } = require("google-auth-library");

const app = express();
const port = 3000;

app.use(bodyParser.json());

app.post("/formatar-mensagem", async (req, res) => {
  const promptText = req.body.text || "Texto não fornecido.";

  const client = new GoogleAuth({
    keyFile: "./chave-servico.json", // Altere para o nome do seu arquivo de chave
    scopes: "https://www.googleapis.com/auth/cloud-platform",
  });

  const authClient = await client.getClient();

  const url = "https://generativelanguage.googleapis.com/v1beta/models/text-bison-001:generateText";

  try {
    const response = await authClient.request({
      url,
      method: "POST",
      data: {
        prompt: {
          text: promptText,
        },
        temperature: 0.7,
        candidateCount: 1,
      },
    });

    const output = response.data?.candidates?.[0]?.output || "Sem resposta.";
    res.json({ resposta: output });
  } catch (error) {
    console.error("Erro na requisição:", error.message);
    res.status(500).json({ erro: "Erro ao gerar resposta" });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
