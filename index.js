const express = require("express");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());

// Variável de ambiente no Render:
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

Datas de ida: [Mês(3 letras)/Ano(4 dígitos): datas separadas por vírgulas]
Datas de volta: [Mês(3 letras)/Ano(4 dígitos): datas separadas por vírgulas]

Obs: os preços e disponibilidades podem sofrer alterações a qualquer momento.

Emissão: [link correto de acordo com o programa de milhas]

REGRAS OBRIGATÓRIAS:
- Use apenas estes meses: Jan, Fev, Mar, Abr, Mai, Jun, Jul, Ago, Set, Out, Nov, Dez
- Sempre use o formato Mês/Ano (ex: Dez/2025)
- Ignore números entre parênteses (ex: 11 (7))
- Se houver mais de um mês, separe usando ponto e vírgula ;
- Se houver faixa de milhas, use sempre o MENOR valor
- Não invente informações
- Não explique o que foi feito
- Retorne APENAS o texto final no formato acima

MENSAGEM ORIGINAL:
${userInput}

RETORNE SOMENTE O TEXTO FINAL FORMATADO.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return res.json({
      resposta: text.trim()
    });

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
