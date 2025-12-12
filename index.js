const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 10000;

// Limite pra evitar payload gigante do Telegram quebrar sua API
app.use(express.json({ limit: "200kb" }));

// (Opcional) Proteção simples via header no Make: X-WEBHOOK-TOKEN
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || null;

// Gemini
if (!process.env.GEMINI_API_KEY) {
  console.error("ERRO: GEMINI_API_KEY não configurada no ambiente.");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---------- Schemas ----------
const InputSchema = z.object({
  user_input: z.string().min(1).max(200000),
});

const ExtractedSchema = z
  .object({
    oportunidade_destino: z.string().nullable(), // "Buenos Aires (Argentina)"
    origem: z.object({
      cidade: z.string().nullable(),
      iata: z.string().nullable(),
    }),
    destino: z.object({
      cidade: z.string().nullable(),
      iata: z.string().nullable(),
      pais: z.string().nullable(),
    }),
    programa: z.string().nullable(), // "Smiles", "AAdvantage", etc.
    cia: z.string().nullable(),      // "GOL", "Air France", etc.
    classe: z.string().nullable(),   // "Econômica", "Executiva"
    a_partir_de_texto: z.string().nullable(), // "10k milhas AAdvantage + taxas"
    datas_ida: z
      .array(
        z.object({
          mes_ano: z.string(),       // "Dez/2025"
          dias: z.array(z.number()), // [11, 12, 13]
        })
      )
      .default([]),
    datas_volta: z
      .array(
        z.object({
          mes_ano: z.string(),
          dias: z.array(z.number()),
        })
      )
      .default([]),
  })
  .strict();

// ---------- Helpers ----------
function makeRequestId() {
  return crypto.randomBytes(8).toString("hex");
}

function normText(s) {
  return String(s || "").replace(/\r\n/g, "\n").trim();
}

// tenta achar o primeiro JSON no texto (caso o modelo escape algo antes/depois)
function safeExtractJson(text) {
  if (!text) return null;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const slice = text.slice(first, last + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function uniqSorted(arr) {
  return Array.from(new Set(arr || [])).sort((a, b) => a - b);
}

const MES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function normalizeMesAno(mesAno) {
  const s = String(mesAno || "").trim();

  if (/^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\/\d{4}$/.test(s)) return s;

  const mLong = s.match(/^([A-Za-zÀ-ÿ]+)\/(\d{4})$/);
  if (mLong) {
    const monthName = mLong[1].toLowerCase();
    const year = mLong[2];
    const mapLong = {
      janeiro: "Jan", fevereiro: "Fev", marco: "Mar", março: "Mar", abril: "Abr",
      maio: "Mai", junho: "Jun", julho: "Jul", agosto: "Ago", setembro: "Set",
      outubro: "Out", novembro: "Nov", dezembro: "Dez",
    };
    if (mapLong[monthName]) return `${mapLong[monthName]}/${year}`;
  }

  const mNum = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (mNum) {
    const mm = Number(mNum[1]);
    const yy = mNum[2];
    if (mm >= 1 && mm <= 12) return `${MES_ABREV[mm - 1]}/${yy}`;
  }

  const mIso = s.match(/^(\d{4})-(\d{2})$/);
  if (mIso) {
    const yy = mIso[1];
    const mm = Number(mIso[2]);
    if (mm >= 1 && mm <= 12) return `${MES_ABREV[mm - 1]}/${yy}`;
  }

  return s;
}

function sortMesAnoGroups(groups) {
  const monthIndex = (abrev) => MES_ABREV.indexOf(abrev);
  const parse = (mesAno) => {
    const m = String(mesAno).match(/^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\/(\d{4})$/);
    if (!m) return { y: 9999, m: 99 };
    return { y: Number(m[2]), m: monthIndex(m[1]) };
  };
  return [...groups].sort((a, b) => {
    const pa = parse(a.mes_ano);
    const pb = parse(b.mes_ano);
    if (pa.y !== pb.y) return pa.y - pb.y;
    return pa.m - pb.m;
  });
}

function formatDatas(groups) {
  if (!groups || groups.length === 0) return "";

  const normalized = groups.map((g) => ({
    mes_ano: normalizeMesAno(g.mes_ano),
    dias: uniqSorted(g.dias || []),
  }));

  const sorted = sortMesAnoGroups(normalized);

  return sorted
    .filter((g) => g.mes_ano && g.dias.length > 0)
    .map((g) => `${g.mes_ano}: ${g.dias.join(", ")}`)
    .join("\n");
}

// Link fixo por programa (determinístico)
function getEmissaoLink(programa, cia) {
  const key = `${programa || ""} ${cia || ""}`.trim();

  const rules = [
    { match: /azul pelo mundo/i, url: "https://azulpelomundo.voeazul.com.br/" },
    { match: /(azul fidelidade|tudoazul|azul)\b/i, url: "https://www.voeazul.com.br/" },
    { match: /\blatam\b|\blatam pass\b/i, url: "https://latampass.latam.com/pt_br/passagens" },
    { match: /\bsmiles\b/i, url: "https://www.smiles.com.br/passagens" },
    { match: /privilege club|qatar/i, url: "https://www.qatarairways.com/en/homepage.html" },
    { match: /executive club|british/i, url: "https://www.britishairways.com/travel/redeem/execclub/_gf/pt_br" },
    { match: /iberia plus|\biberia\b/i, url: "https://www.iberia.com/us/" },
    { match: /flying club|virgin/i, url: "https://www.virginatlantic.com/flying-club/" },
    { match: /aadvantage|american airlines/i, url: "https://www.aa.com/" },
  ];

  const found = rules.find((r) => r.match.test(key));
  return found ? found.url : "";
}

// Texto final EXATAMENTE no seu padrão
function renderFinal(d) {
  const destinoTitulo =
    d.oportunidade_destino ||
    (d.destino?.cidade
      ? (d.destino?.pais ? `${d.destino.cidade} (${d.destino.pais})` : d.destino.cidade)
      : "Destino");

  const origemLinha = [d.origem?.cidade, d.origem?.iata].filter(Boolean).join(" – ");
  const destinoLinha = [d.destino?.cidade, d.destino?.iata].filter(Boolean).join(" – ");
  const programaCia = [d.programa, d.cia].filter(Boolean).join(" – ");
  const emissaoLink = getEmissaoLink(d.programa, d.cia);

  const aPartirLinha = d.a_partir_de_texto
    ? `A partir de: ${d.a_partir_de_texto} o trecho`
    : "";

  const idaTxt = formatDatas(d.datas_ida);
  const voltaTxt = formatDatas(d.datas_volta);

  // Mantém layout e quebras de linha consistentes
  return [
    `Oportunidade de emissão – ${destinoTitulo}`,
    ``,
    `Origem: ${origemLinha}  `,
    `Destino: ${destinoLinha}  `,
    ``,
    `Programa/CIA: ${programaCia}  `,
    `Classe: ${d.classe || ""}  `,
    ``,
    `${aPartirLinha}  `,
    ``,
    `Datas de ida:`,
    `${idaTxt}`,
    ``,
    `Datas de volta:`,
    `${voltaTxt}`,
    ``,
    `Obs: os preços e disponibilidades podem sofrer alterações a qualquer momento.`,
    ``,
    `Emissão: ${emissaoLink}`,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildExtractionPrompt(userInput) {
  return `
Você é um extrator de dados de alertas de passagens com milhas.

Retorne APENAS um JSON válido (sem markdown, sem texto antes/depois, sem comentários).
Não use emojis. Não use negrito. Não invente.

REGRAS:
1) "a_partir_de_texto" deve ser exatamente:
   "<valor> milhas <Programa> + taxas"
   Exemplos: "10k milhas AAdvantage + taxas", "636k milhas Smiles + taxas"
   - Se a mensagem usar "k", mantenha "k".
   - Não converta para número inteiro.
2) Ignore textos promocionais (desconto, hack, etc.).
3) Datas:
   - Retorne "mes_ano" exatamente como "Dez/2025", "Jan/2026", etc. (abreviação PT-BR).
   - Extraia somente os DIAS (números). Ignore a quantidade de assentos em parênteses.
4) "oportunidade_destino" deve ser "Cidade (País)" se o país estiver explícito; se não estiver, use null.

FORMATO OBRIGATÓRIO:
{
  "oportunidade_destino": string|null,
  "origem": {"cidade": string|null, "iata": string|null},
  "destino": {"cidade": string|null, "iata": string|null, "pais": string|null},
  "programa": string|null,
  "cia": string|null,
  "classe": string|null,
  "a_partir_de_texto": string|null,
  "datas_ida": [{"mes_ano": "Dez/2025", "dias": [1,2,3]}],
  "datas_volta": [{"mes_ano": "Dez/2025", "dias": [1,2,3]}]
}

MENSAGEM:
<<<
${userInput}
>>>
`.trim();
}

// ---------- Rotas ----------
app.post("/formatar-mensagem", async (req, res) => {
  const requestId = makeRequestId();

  // Token opcional
  if (WEBHOOK_TOKEN) {
    const token = req.headers["x-webhook-token"];
    if (token !== WEBHOOK_TOKEN) {
      return res.status(401).json({ erro: "Não autorizado", requestId });
    }
  }

  const parsed = InputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      erro: "Payload inválido",
      requestId,
      detalhes: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }

  let userInput = normText(parsed.data.user_input);

  // Truncamento para evitar estourar limites do modelo
  const HARD_LIMIT = 90000;
  if (userInput.length > HARD_LIMIT) {
    userInput = userInput.slice(0, HARD_LIMIT) + "\n[TRUNCADO_POR_LIMITE]";
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 1200,
        temperature: 0.0,
      },
    });

    const prompt = buildExtractionPrompt(userInput);

    // ✅ IMPORTANTE: NÃO usar "signal" aqui (o SDK não aceita)
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const raw = result?.response?.text?.() || "";
    const json = safeExtractJson(raw);

    if (!json) {
      return res.status(422).json({
        erro: "Modelo não retornou JSON válido",
        requestId,
        raw: raw.slice(0, 1200),
      });
    }

    const out = ExtractedSchema.safeParse(json);
    if (!out.success) {
      return res.status(422).json({
        erro: "JSON retornado fora do esquema",
        requestId,
        detalhes: out.error.issues,
      });
    }

    const resposta = renderFinal(out.data);
    return res.json({ resposta, requestId });
  } catch (error) {
    console.error("Erro /formatar-mensagem:", {
      requestId,
      name: error?.name,
      message: error?.message,
    });

    return res.status(500).json({
      erro: "Erro ao gerar resposta",
      requestId,
    });
  }
});

app.get("/", (req, res) => res.status(200).send("OK"));

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
