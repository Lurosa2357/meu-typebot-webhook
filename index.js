const express = require("express");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 10000;

// JSON do Typebot
app.use(bodyParser.json());

// cliente Gemini usando GEMINI_API_KEY (configurada no Render)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/formatar-mensagem", async (req, res) => {
  const promptText = req.body.text || "Texto não fornecido.";

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 256,
        temperature: 0.7,
      },
    });

    // prompt completo com a mensagem original embutida
    const prompt = `
Você é um assistente que transforma mensagens de alertas de passagens com milhas (geralmente com emojis e texto informal) em uma estrutura padronizada, limpa e profissional.

Receba a mensagem abaixo e reformule seguindo estritamente o modelo abaixo. Remova negritos, emojis e formatação informal. Organize as datas por mês/ano, e separe os dias com vírgula. Substitua o link de emissão corretamente com base no programa de milhas.

Mensagem original:
${promptText}

⚠️ MODELO PADRÃO QUE A RESPOSTA DEVE SEGUIR:

Oportunidade de emissão – [Destino (com país, se possível)]

Origem: [Cidade – Código do aeroporto]  
Destino: [Cidade – Código do aeroporto]  
Programa/CIA: [Nome do programa de milhas – Companhia aérea]  
Classe: [Classe da cabine]  
A partir de [menor quantidade de milhas + taxas] o trecho  

🗓 Datas de ida:  
[Mês/ano: dias separados por vírgula]  

🗓 Datas de volta:  
[Mês/ano: dias separados por vírgula]  

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
- Mantenha o layout do exemplo exatamente.

Agora, gere a resposta padronizada com base na mensagem recebida.
`;

    const result = await model.generateContent(prompt);
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
