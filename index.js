const express = require("express");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 10000;

// Middleware para ler JSON do corpo da requisição
app.use(bodyParser.json());

// Instância do Gemini usando a chave de API do ambiente
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Rota principal para formatar a mensagem
app.post("/formatar-mensagem", async (req, res) => {
  const promptText = req.body.user_input;

  // Validação básica do corpo
  if (!promptText || typeof promptText !== "string" || !promptText.trim()) {
    return res.status(400).json({
      erro: "O campo 'user_input' é obrigatório e deve ser uma string não vazia.",
    });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 512,
        temperature: 0.3,
      },
    });

    const prompt = `
Você é um assistente que transforma mensagens de alertas de passagens com milhas (geralmente com emojis e texto informal) em uma estrutura padronizada, limpa e profissional.

Receba a mensagem abaixo e reformule seguindo estritamente o modelo abaixo. Remova negritos, emojis e formatação informal. Organize as datas por mês/ano, e separe os dias com vírgula. Substitua o link de emissão corretamente com base no programa de milhas.

Mensagem original:
[INÍCIO DA MENSAGEM ORIGINAL]
${promptText}
[FIM DA MENSAGEM ORIGINAL]

⚠️ MODELO PADRÃO QUE A RESPOSTA DEVE SEGUIR (USE EXATAMENTE ESSE LAYOUT):

Oportunidade de emissão – [Destino (com país, se possível)]

Origem: [Cidade – Código do aeroporto]
Destino: [Cidade – Código do aeroporto]
Programa/CIA: [Nome do programa de milhas – Companhia aérea]
Classe: [Classe da cabine]
A partir de [menor quantidade de milhas + taxas] o trecho

🗓 Datas de ida:
[Dez/2025: 11, 12, 14, 15, 16, 17, 19, 22, 24]

🗓 Datas de volta:
[Dez/2025: 31]
[Jan/2026: 1, 3, 5, 6, 7, 8, 9, 10]

(Os exemplos acima são apenas para mostrar o formato.)

Obs: os preços e disponibilidades podem sofrer alterações a qualquer momento.
Emissão: [link correto de acordo com o programa de milhas]

Use estes links de emissão, conforme o programa citado:
- Azul Fidelidade / Azul: https://www.voeazul.com.br/
- Azul pelo Mundo: https://azulpelomundo.voeazul.com.br/
- Latam: https://latampass.latam.com/pt_br/passagens
- Smiles: https://www.smiles.com.br/passagens
- Privilege Club - Qatar: https://www.qatarairways.com/en/homepage.html
- Executive Club - British: https://www.britishairways.com/travel/redeem/execclub/_gf/pt_br
- Iberia Plus: https://www.iberia.com/us/
- Flying Club - Virgin: https://www.virginatlantic.com/flying-club/
- AAdvantage: https://www.aa.com/

IMPORTANTE:
- Não use emojis ou negritos na resposta.
- Não invente informações.
- Se houver faixas de milhas (por exemplo "entre 223k e 227k"), escolha o MENOR valor para o campo "A partir de [...]".
- Agrupe as datas por mês/ano usando o formato "Dez/2025: 11, 12, 14, 15".
- A resposta deve começar exatamente com "Oportunidade de emissão –" e terminar na linha de "Emissão: ...".
- Não adicione comentários, explicações ou qualquer texto fora do modelo.

Agora, gere SOMENTE a resposta padronizada com base na mensagem recebida, seguindo o modelo acima, sem nenhum texto adicional antes ou depois.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text() || "Sem resposta.";

    return res.json({ resposta: text });
  } catch (error) {
    console.error(
      "Erro na requisição:",
      error.response?.data || error.message || error
    );
    return res
      .status(500)
      .json({ erro: "Erro ao gerar resposta com o Gemini." });
  }
});

// Rota simples para teste de saúde
app.get("/", (req, res) => {
  res.send("API de formatação de mensagens com Gemini está rodando.");
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
