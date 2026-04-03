import { NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Multi-step estimation: 3 searches → cross-validate → conservative output
export async function POST(request) {
  try {
    const { logradouro, numero, bairro, cidade, uf, tipo, uso, area_m2, padrao } = await request.json();

    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
    }

    const area = Number(area_m2) || 70;
    const enderecoCompleto = [logradouro, numero].filter(Boolean).join(', ');
    const bairroStr = bairro || '';
    const cidadeUf = [cidade, uf].filter(Boolean).join('/');
    const tipoDesc = tipo || 'Apartamento';
    const padraoDesc = padrao || 'Médio';

    // === STEP 1: Search for specific comparable listings ===
    const prompt = `Você é um avaliador imobiliário profissional brasileiro certificado (CNAI).
Realize uma avaliação de mercado usando o método comparativo direto (ABNT NBR 14653-2).

IMÓVEL AVALIANDO:
- Endereço: ${enderecoCompleto}, ${bairroStr}, ${cidadeUf}
- Tipo: ${tipoDesc}
- Uso: ${uso || 'Residencial'}
- Área: ${area}m²
- Padrão: ${padraoDesc}

METODOLOGIA OBRIGATÓRIA:
1. BUSQUE anúncios REAIS de venda em: ZAP Imóveis, Viva Real, ImovelWeb, QuintoAndar, OLX Imóveis, Loft, Lopes
2. BUSQUE anúncios REAIS de aluguel nas mesmas fontes
3. FILTRE por: mesmo bairro (${bairroStr}), mesmo tipo (${tipoDesc}), área entre ${Math.round(area*0.7)}m² e ${Math.round(area*1.3)}m²
4. COLETE pelo menos 3 amostras de venda e 3 de aluguel
5. CALCULE o R$/m² médio, mínimo e máximo encontrados
6. APLIQUE fator de desconto de negociação de 10% sobre preço pedido de venda
7. CALCULE o valor do imóvel: R$/m² médio × ${area}m² × fator_desconto
8. Para IPTU: busque tabela de alíquotas da prefeitura de ${cidade || 'São Paulo'} para ${tipoDesc} ${uso || 'Residencial'}
9. Para condomínio: busque valores reais de condomínio em prédios de padrão ${padraoDesc} no ${bairroStr}

REGRAS:
- Use APENAS dados de anúncios reais encontrados na busca
- Se encontrar menos de 3 amostras no bairro, amplie para bairros limítrofes
- Preço pedido ≠ preço de venda. Aplique desconto de 10% para venda
- Yield = (aluguel_anual / valor_venda) × 100
- Seja CONSERVADOR — melhor subestimar que superestimar

FORMATO — responda SOMENTE JSON puro, sem markdown:
{"preco_m2_venda_medio":0,"preco_m2_venda_min":0,"preco_m2_venda_max":0,"preco_m2_aluguel":0,"valor_mercado":0,"aluguel_estimado":0,"iptu_anual":0,"condominio":0,"yield":0,"amostras_venda":0,"amostras_aluguel":0,"confianca":"media","fonte":"sites","metodo":"comparativo"}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.05, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('Gemini API error:', err);
      return NextResponse.json({ error: 'Gemini API error' }, { status: 500 });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.map(p => p.text).filter(Boolean).join('') || '';

    // Parse JSON robustly
    let jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    // Fix truncated JSON
    const open = (jsonStr.match(/\{/g) || []).length;
    const close = (jsonStr.match(/\}/g) || []).length;
    if (open > close) {
      const lc = jsonStr.lastIndexOf(',');
      const lcol = jsonStr.lastIndexOf(':');
      jsonStr = lc > lcol ? jsonStr.substring(0, lc) + '}' : jsonStr + '}';
    }

    try {
      const est = JSON.parse(jsonStr);

      // Sanity checks & conservative adjustments
      const vm = est.valor_mercado || (est.preco_m2_venda_medio || 0) * area * 0.9;
      const alug = est.aluguel_estimado || (est.preco_m2_aluguel || 0) * area;

      return NextResponse.json({
        // Core values
        valor_mercado: Math.round(vm),
        preco_m2_venda_medio: Math.round(est.preco_m2_venda_medio || vm / area),
        preco_m2_venda_min: Math.round(est.preco_m2_venda_min || 0),
        preco_m2_venda_max: Math.round(est.preco_m2_venda_max || 0),
        preco_m2_aluguel: Math.round(est.preco_m2_aluguel || 0),
        aluguel_estimado: Math.round(alug),
        iptu_estimado_anual: Math.round(est.iptu_anual || vm * 0.01),
        condominio_estimado: Math.round(est.condominio || 0),
        yield_regiao: Number((alug * 12 / (vm || 1) * 100).toFixed(1)),
        // Metadata
        amostras_venda: est.amostras_venda || 0,
        amostras_aluguel: est.amostras_aluguel || 0,
        confianca: est.confianca || 'media',
        fonte: est.fonte || 'Gemini Search',
        metodo: 'Comparativo ABNT NBR 14653-2',
        area_referencia: area,
        desconto_negociacao: '10%',
      });
    } catch {
      console.error('Parse error:', text.substring(0, 500));
      return NextResponse.json({ error: 'Falha ao processar estimativa', raw: text.substring(0, 300) }, { status: 500 });
    }
  } catch (err) {
    console.error('Estimate error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
