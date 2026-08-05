// Atualiza automaticamente os eventos datados da agenda (index.html).
// Pesquisa a programação real de Salvador na web via API da Anthropic e
// reescreve o bloco DATADOS entre os marcadores AGENDA-AUTO-INICIO / -FIM.
// Roda no GitHub Actions toda semana; precisa do secret ANTHROPIC_API_KEY.

import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const FILE = 'index.html';
const client = new Anthropic(); // usa a variável de ambiente ANTHROPIC_API_KEY

// Data de hoje no fuso de Salvador (formato AAAA-MM-DD)
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date());

const CATS = new Set(['musica', 'festa', 'teatro', 'arte', 'feira', 'popular']);

const prompt = `Você é curador da agenda cultural de Salvador/BA. Hoje é ${hoje}.
Pesquise na web a programação cultural REAL de Salvador dos próximos 12 dias a partir de hoje: shows, teatro, dança, exposições, festas e feiras culturais.
Use como fontes as melhores publicações de agenda de Salvador: As Melhores Coisas de Salvador, Roda Cultural, Roteiro Cultural SSA (roteiroculturalssa.com.br), el Cabong (elcabong.com.br), salvadordabahia.com/eventos, agendaculturalsalvador.com.br e ba.gov.br/tca; e as ticketerias filtradas por Salvador: Sympla, Shotgun, Eventim e Ingresse.
Responda SOMENTE com um array JSON válido (sem markdown, sem texto antes ou depois) com 6 a 12 eventos reais. Cada item tem exatamente estes campos:
{"n":"Nome do evento","cat":"musica|festa|teatro|arte|feira|popular","data":"AAAA-MM-DD","hora":"19h","local":"Local — bairro","preco":"R$45 ou Grátis ou Consultar","desc":"uma frase curta","link":"https://fonte-ou-ingresso"}
Regras: o campo cat DEVE ser exatamente um destes seis valores minúsculos; data no formato AAAA-MM-DD dentro dos próximos 12 dias; NUNCA invente eventos (se achar poucos confiáveis, retorne poucos); NÃO use emojis. Responda apenas com o array JSON.`;

async function pedirEventos() {
  const req = {
    model: 'claude-sonnet-5',
    max_tokens: 4000,
    output_config: { effort: 'low' },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
    messages: [{ role: 'user', content: prompt }],
  };
  let resp = await client.messages.create(req);
  // O web_search pode pausar (pause_turn) se rodar muitas buscas; retomamos.
  let guard = 0;
  while (resp.stop_reason === 'pause_turn' && guard++ < 4) {
    resp = await client.messages.create({
      ...req,
      messages: [
        { role: 'user', content: prompt },
        { role: 'assistant', content: resp.content },
      ],
    });
  }
  return resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

function extrairArray(texto) {
  const i = texto.indexOf('[');
  const j = texto.lastIndexOf(']');
  if (i < 0 || j < 0 || j < i) return [];
  try { return JSON.parse(texto.slice(i, j + 1)); } catch { return []; }
}

const semEmoji = (s) => String(s || '').replace(/[\p{Extended_Pictographic}\u{FE0F}]/gu, '').trim();

function dentroDaJanela(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const diff = (new Date(d + 'T00:00:00') - new Date(hoje + 'T00:00:00')) / 86400000;
  return diff >= -1 && diff <= 13;
}

function normaliza(e) {
  const cat = String(e?.cat || '').toLowerCase();
  if (!CATS.has(cat) || !e?.n || !e?.data || !dentroDaJanela(e.data)) return null;
  const link = e.link && /^https?:\/\//.test(e.link)
    ? e.link
    : 'https://www.google.com/search?q=' + encodeURIComponent((e.n || '') + ' Salvador');
  return {
    n: semEmoji(e.n).slice(0, 80),
    cat,
    data: e.data,
    hora: semEmoji(e.hora) || 'consultar',
    local: semEmoji(e.local),
    preco: semEmoji(e.preco) || 'Consultar',
    desc: semEmoji(e.desc).slice(0, 160),
    link,
  };
}

function montaBloco(items) {
  const linhas = items.map((e) =>
    `  {n:${JSON.stringify(e.n)}, cat:${JSON.stringify(e.cat)}, data:${JSON.stringify(e.data)}, hora:${JSON.stringify(e.hora)}, local:${JSON.stringify(e.local)}, preco:${JSON.stringify(e.preco)},\n   desc:${JSON.stringify(e.desc)},\n   link:${JSON.stringify(e.link)}},`
  ).join('\n');
  return `// AGENDA-AUTO-INICIO (não editar à mão — atualizado pela automação semanal do GitHub)\nconst DATADOS = [\n${linhas}\n];\n// AGENDA-AUTO-FIM`;
}

(async () => {
  let html = fs.readFileSync(FILE, 'utf8');
  // Sempre atualiza a data de referência (mostrada na tira de dias e no topo)
  html = html.replace(/const HOJE_ISO = '[^']*';/, `const HOJE_ISO = '${hoje}';`);

  let items = [];
  try {
    const texto = await pedirEventos();
    items = extrairArray(texto).map(normaliza).filter(Boolean).slice(0, 12);
  } catch (err) {
    console.error('Falha na busca/geração:', err?.message || err);
  }

  if (items.length >= 1) {
    html = html.replace(/\/\/ AGENDA-AUTO-INICIO[\s\S]*?\/\/ AGENDA-AUTO-FIM/, montaBloco(items));
    console.log(`Agenda atualizada com ${items.length} eventos (${hoje}).`);
  } else {
    console.log('Nenhum evento novo confiável — só a data de referência foi atualizada.');
  }

  fs.writeFileSync(FILE, html);
})();
