import { NextResponse } from 'next/server';

// Generic Gemini analysis endpoint — calls Gemini with Google Search
// Used by: Cotação IA, Estudo de Região, Holding & Tributação

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export async function POST(request) {
  try {
    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ erro: 'GOOGLE_API_KEY não configurada' }, { status: 500 });
    }

    const { prompt, tipo } = await request.json();
    if (!prompt) {
      return NextResponse.json({ erro: 'Prompt é obrigatório' }, { status: 400 });
    }

    const systemPrefix = {
      cotacao: 'Você é um analista imobiliário profissional brasileiro. Responda em português com dados reais e atualizados. Use formatação markdown com tabelas quando apropriado. Seja objetivo e cite fontes.',
      estudo: 'Você é um consultor imobiliário sênior (nível JLL/CBRE/Cushman). Responda em português com análise institucional profunda. Use formatação markdown com seções claras, tabelas e bullet points. Cite dados de mercado reais.',
      holding: 'Você é um advogado tributarista especializado em planejamento patrimonial imobiliário no Brasil. Responda em português com números reais. Use formatação markdown com tabelas comparativas.',
    }[tipo] || 'Você é um analista imobiliário profissional brasileiro. Responda em português.';

    const fullPrompt = `${systemPrefix}\n\n${prompt}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      const res = await fetch(`${GEMINI_URL}?key=${GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[gemini-analysis] Gemini ${res.status}:`, errText.substring(0, 200));
        return NextResponse.json({ erro: `Gemini retornou ${res.status}` }, { status: 502 });
      }

      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean) || []).join('');

      if (!text) {
        return NextResponse.json({ erro: 'Gemini retornou resposta vazia' }, { status: 502 });
      }

      return NextResponse.json({ resultado: text, tipo });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error('[gemini-analysis] error:', err.message);
    if (err.name === 'AbortError') {
      return NextResponse.json({ erro: 'Timeout — Gemini demorou mais de 90s' }, { status: 504 });
    }
    return NextResponse.json({ erro: 'Erro ao processar análise' }, { status: 500 });
  }
}
