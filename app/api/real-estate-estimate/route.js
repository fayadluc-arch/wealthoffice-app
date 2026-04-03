import { NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Scrape ZAP/VivaReal API for real listings
async function searchZapVivaReal(bairro, cidade, uf, tipo, areaMin, areaMax) {
  // ZAP/VivaReal share the same backend API (Grupo OLX)
  const tipoMap = { 'Apartamento': 'APARTMENT', 'Casa': 'HOME', 'Studio': 'APARTMENT', 'Laje Corporativa': 'COMMERCIAL', 'Galpão': 'COMMERCIAL', 'Terreno': 'LAND', 'Varejo': 'COMMERCIAL' };
  const businessType = 'SALE';
  const unitType = tipoMap[tipo] || 'APARTMENT';

  // Normalize city/state for URL
  const cidadeSlug = (cidade || 'sao-paulo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  const ufLower = (uf || 'sp').toLowerCase();
  const bairroSlug = (bairro || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');

  const listings = [];

  // Try ZAP API
  try {
    const zapUrl = `https://glue-api.zapimoveis.com.br/v2/listings?business=SALE&categoryPage=RESULT&listingType=USED&addressType=neighborhood&addressNeighborhood=${encodeURIComponent(bairro)}&addressCity=${encodeURIComponent(cidade)}&addressState=${encodeURIComponent(uf)}&unitTypes=${unitType}&usableAreasMin=${areaMin}&usableAreasMax=${areaMax}&size=20&from=0`;
    const res = await fetch(zapUrl, {
      headers: {
        'x-domain': 'www.zapimoveis.com.br',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const results = data?.search?.result?.listings || [];
      results.forEach(item => {
        const l = item.listing || {};
        const p = l.pricingInfos?.[0] || {};
        const price = Number(p.price) || 0;
        const area = Number(l.usableAreas?.[0]) || 0;
        if (price > 0 && area > 0) {
          listings.push({
            source: 'ZAP',
            price,
            area,
            pricePerM2: Math.round(price / area),
            address: l.address?.street || '',
            neighborhood: l.address?.neighborhood || bairro,
            bedrooms: Number(l.bedrooms?.[0]) || 0,
            condoFee: Number(p.monthlyCondoFee) || 0,
            iptu: Number(p.yearlyIptu) || 0,
          });
        }
      });
    }
  } catch (e) { console.log('ZAP API error:', e.message); }

  // Try VivaReal API (same backend)
  try {
    const vrUrl = `https://glue-api.vivareal.com/v2/listings?business=SALE&categoryPage=RESULT&listingType=USED&addressType=neighborhood&addressNeighborhood=${encodeURIComponent(bairro)}&addressCity=${encodeURIComponent(cidade)}&addressState=${encodeURIComponent(uf)}&unitTypes=${unitType}&usableAreasMin=${areaMin}&usableAreasMax=${areaMax}&size=20&from=0`;
    const res = await fetch(vrUrl, {
      headers: {
        'x-domain': 'www.vivareal.com.br',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const results = data?.search?.result?.listings || [];
      results.forEach(item => {
        const l = item.listing || {};
        const p = l.pricingInfos?.[0] || {};
        const price = Number(p.price) || 0;
        const area = Number(l.usableAreas?.[0]) || 0;
        if (price > 0 && area > 0) {
          listings.push({
            source: 'VivaReal',
            price,
            area,
            pricePerM2: Math.round(price / area),
            address: l.address?.street || '',
            neighborhood: l.address?.neighborhood || bairro,
            bedrooms: Number(l.bedrooms?.[0]) || 0,
            condoFee: Number(p.monthlyCondoFee) || 0,
            iptu: Number(p.yearlyIptu) || 0,
          });
        }
      });
    }
  } catch (e) { console.log('VivaReal API error:', e.message); }

  return listings;
}

// Search rental listings
async function searchRentals(bairro, cidade, uf, tipo, areaMin, areaMax) {
  const tipoMap = { 'Apartamento': 'APARTMENT', 'Casa': 'HOME', 'Studio': 'APARTMENT' };
  const unitType = tipoMap[tipo] || 'APARTMENT';
  const listings = [];

  try {
    const url = `https://glue-api.zapimoveis.com.br/v2/listings?business=RENTAL&categoryPage=RESULT&listingType=USED&addressType=neighborhood&addressNeighborhood=${encodeURIComponent(bairro)}&addressCity=${encodeURIComponent(cidade)}&addressState=${encodeURIComponent(uf)}&unitTypes=${unitType}&usableAreasMin=${areaMin}&usableAreasMax=${areaMax}&size=20&from=0`;
    const res = await fetch(url, {
      headers: { 'x-domain': 'www.zapimoveis.com.br', 'user-agent': 'Mozilla/5.0', 'accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const results = data?.search?.result?.listings || [];
      results.forEach(item => {
        const l = item.listing || {};
        const p = l.pricingInfos?.find(pi => pi.businessType === 'RENTAL') || l.pricingInfos?.[0] || {};
        const price = Number(p.rentalTotalPrice || p.price) || 0;
        const area = Number(l.usableAreas?.[0]) || 0;
        if (price > 0 && area > 0) {
          listings.push({ source: 'ZAP-Aluguel', price, area, pricePerM2: Math.round(price / area) });
        }
      });
    }
  } catch (e) { console.log('Rental search error:', e.message); }

  return listings;
}

// Search ImovelWeb API
async function searchImovelWeb(bairro, cidade, uf, tipo, areaMin, areaMax) {
  const listings = [];
  try {
    const cidadeSlug = (cidade || 'sao-paulo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    const bairroSlug = (bairro || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    const url = `https://www.imovelweb.com.br/apartamentos-venda-${bairroSlug}-${cidadeSlug}-${(uf||'sp').toLowerCase()}-${areaMin}-${areaMax}-m2-orden-precio-ascendente.html`;
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const html = await res.text();
      // Extract prices from structured data (JSON-LD)
      const ldMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
      ldMatches.forEach(m => {
        try {
          const json = JSON.parse(m.replace(/<\/?script[^>]*>/g, ''));
          if (json['@type'] === 'Product' || json['@type'] === 'Residence') {
            const price = Number(json.offers?.price) || 0;
            const area = Number(json.floorSize?.value) || 0;
            if (price > 100000 && area > 20) {
              listings.push({ source: 'ImovelWeb', price, area, pricePerM2: Math.round(price / area), condoFee: 0, iptu: 0 });
            }
          }
        } catch {}
      });
      // Also try regex for prices in the page
      if (listings.length === 0) {
        const priceMatches = html.match(/R\$\s*([\d.]+)/g) || [];
        const areaMatches = html.match(/(\d+)\s*m²/g) || [];
        // Basic heuristic — pair large prices with areas
        priceMatches.forEach((pm, i) => {
          const price = Number(pm.replace(/R\$\s*/, '').replace(/\./g, ''));
          const area = areaMatches[i] ? Number(areaMatches[i].replace(/\s*m²/, '')) : 0;
          if (price > 100000 && area > 20 && area < 1000) {
            listings.push({ source: 'ImovelWeb', price, area, pricePerM2: Math.round(price / area), condoFee: 0, iptu: 0 });
          }
        });
      }
    }
  } catch (e) { console.log('ImovelWeb error:', e.message); }
  return listings;
}

// Search QuintoAndar API
async function searchQuintoAndar(bairro, cidade, uf, tipo, areaMin, areaMax) {
  const listings = [];
  try {
    // QuintoAndar uses a GraphQL API
    const res = await fetch('https://www.quintoandar.com.br/api/yellow-pages/v2/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        business_context: 'SALE',
        filters: {
          map: { neighborhoods: [bairro] },
          area: { min: areaMin, max: areaMax },
        },
        return: ['id', 'coverImage', 'rent', 'salePrice', 'address', 'area', 'bedrooms'],
        size: 20,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const hits = data?.hits?.hits || data?.results || [];
      hits.forEach(h => {
        const src = h._source || h;
        const price = Number(src.salePrice || src.sale_price) || 0;
        const area = Number(src.area) || 0;
        if (price > 100000 && area > 20) {
          listings.push({ source: 'QuintoAndar', price, area, pricePerM2: Math.round(price / area), condoFee: 0, iptu: 0 });
        }
      });
    }
  } catch (e) { console.log('QuintoAndar error:', e.message); }
  return listings;
}

// Fallback: Gemini search when APIs fail
async function geminiEstimate(logradouro, bairro, cidade, uf, tipo, area, padrao) {
  if (!GOOGLE_API_KEY) return null;

  const prompt = `Busque preço por m² ATUAL de ${tipo} à venda no bairro ${bairro}, ${cidade}/${uf}, padrão ${padrao || 'Médio'}, área ~${area}m².
Busque em ZAP Imóveis, Viva Real, QuintoAndar, Loft, ImovelWeb.
${logradouro ? `Rua específica: ${logradouro}` : ''}

Responda SOMENTE JSON:
{"preco_m2_medio":0,"preco_m2_min":0,"preco_m2_max":0,"aluguel_m2":0,"condo_medio":0,"iptu_m2_ano":0,"amostras":0,"fonte":"sites"}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.05, maxOutputTokens: 1024 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || '';
    let jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const m = jsonStr.match(/\{[\s\S]*\}/);
    if (m) jsonStr = m[0];
    // Fix truncated
    const o = (jsonStr.match(/\{/g) || []).length;
    const c = (jsonStr.match(/\}/g) || []).length;
    if (o > c) { const lc = jsonStr.lastIndexOf(','); jsonStr = lc > 0 ? jsonStr.substring(0, lc) + '}' : jsonStr + '}'; }
    return JSON.parse(jsonStr);
  } catch { return null; }
}

export async function POST(request) {
  try {
    const { logradouro, numero, bairro, cidade, uf, tipo, uso, area_m2, padrao } = await request.json();

    const area = Number(area_m2) || 70;
    const areaMin = Math.round(area * 0.6);
    const areaMax = Math.round(area * 1.4);
    const bairroStr = bairro || 'Centro';
    const cidadeStr = cidade || 'São Paulo';
    const ufStr = uf || 'SP';
    const tipoStr = tipo || 'Apartamento';

    // Step 1: Search ALL sources in parallel
    const [zapListings, rentalListings, imovelWebListings, quintoandarListings] = await Promise.all([
      searchZapVivaReal(bairroStr, cidadeStr, ufStr, tipoStr, areaMin, areaMax),
      searchRentals(bairroStr, cidadeStr, ufStr, tipoStr, areaMin, areaMax),
      searchImovelWeb(bairroStr, cidadeStr, ufStr, tipoStr, areaMin, areaMax),
      searchQuintoAndar(bairroStr, cidadeStr, ufStr, tipoStr, areaMin, areaMax),
    ]);
    // Merge all sale listings
    const saleListings = [...zapListings, ...imovelWebListings, ...quintoandarListings];
    console.log(`Found: ${zapListings.length} ZAP/VR, ${imovelWebListings.length} ImovelWeb, ${quintoandarListings.length} QuintoAndar, ${rentalListings.length} rentals`);

    let result;

    if (saleListings.length >= 3) {
      // We have enough real data — use it directly
      const prices = saleListings.map(l => l.pricePerM2).sort((a, b) => a - b);
      // Remove outliers (bottom 10% and top 10%)
      const trimmed = prices.length > 5
        ? prices.slice(Math.floor(prices.length * 0.1), Math.ceil(prices.length * 0.9))
        : prices;

      const avg = Math.round(trimmed.reduce((s, v) => s + v, 0) / trimmed.length);
      const min = trimmed[0];
      const max = trimmed[trimmed.length - 1];

      // Condominiums and IPTU from real listings
      const condos = saleListings.filter(l => l.condoFee > 0).map(l => l.condoFee);
      const iptus = saleListings.filter(l => l.iptu > 0).map(l => l.iptu);
      const avgCondo = condos.length > 0 ? Math.round(condos.reduce((s, v) => s + v, 0) / condos.length) : 0;
      const avgIptu = iptus.length > 0 ? Math.round(iptus.reduce((s, v) => s + v, 0) / iptus.length) : 0;

      // Rental data
      const rentalPrices = rentalListings.map(l => l.price).sort((a, b) => a - b);
      const avgRental = rentalPrices.length > 0
        ? Math.round(rentalPrices.reduce((s, v) => s + v, 0) / rentalPrices.length)
        : 0;

      // Apply 10% negotiation discount
      const valorMercado = Math.round(avg * area * 0.90);

      const yieldCalc = avgRental > 0 && valorMercado > 0
        ? Number((avgRental * 12 / valorMercado * 100).toFixed(1))
        : 0;

      result = {
        valor_mercado: valorMercado,
        preco_m2_venda_medio: avg,
        preco_m2_venda_min: min,
        preco_m2_venda_max: max,
        preco_m2_aluguel: rentalPrices.length > 0 ? Math.round(avgRental / area) : 0,
        aluguel_estimado: avgRental,
        iptu_estimado_anual: avgIptu || Math.round(valorMercado * 0.008),
        condominio_estimado: avgCondo,
        yield_regiao: yieldCalc,
        amostras_venda: saleListings.length,
        amostras_aluguel: rentalListings.length,
        confianca: saleListings.length >= 10 ? 'alta' : saleListings.length >= 5 ? 'media' : 'baixa',
        fonte: [...new Set(saleListings.map(l => l.source))].join(', '),
        metodo: 'Comparativo direto (dados reais)',
        area_referencia: area,
        desconto_negociacao: '10%',
      };
    } else {
      // Fallback: use Gemini with Google Search
      const gemini = await geminiEstimate(logradouro, bairroStr, cidadeStr, ufStr, tipoStr, area, padrao);

      if (gemini && gemini.preco_m2_medio > 0) {
        const avg = gemini.preco_m2_medio;
        const valorMercado = Math.round(avg * area * 0.90);
        const avgRental = gemini.aluguel_m2 ? Math.round(gemini.aluguel_m2 * area) : 0;

        result = {
          valor_mercado: valorMercado,
          preco_m2_venda_medio: Math.round(avg),
          preco_m2_venda_min: Math.round(gemini.preco_m2_min || avg * 0.85),
          preco_m2_venda_max: Math.round(gemini.preco_m2_max || avg * 1.15),
          preco_m2_aluguel: Math.round(gemini.aluguel_m2 || 0),
          aluguel_estimado: avgRental,
          iptu_estimado_anual: Math.round(gemini.iptu_m2_ano ? gemini.iptu_m2_ano * area : valorMercado * 0.008),
          condominio_estimado: Math.round(gemini.condo_medio || 0),
          yield_regiao: avgRental > 0 ? Number((avgRental * 12 / valorMercado * 100).toFixed(1)) : 0,
          amostras_venda: (gemini.amostras || 0) + saleListings.length,
          amostras_aluguel: rentalListings.length,
          confianca: 'baixa',
          fonte: `Gemini Search${saleListings.length > 0 ? ', ' + [...new Set(saleListings.map(l => l.source))].join(', ') : ''}`,
          metodo: 'Estimativa IA (fallback)',
          area_referencia: area,
          desconto_negociacao: '10%',
        };
      } else {
        return NextResponse.json({
          error: 'Não foi possível encontrar dados suficientes para avaliação',
          detail: `${saleListings.length} anúncios encontrados para ${bairroStr}, ${cidadeStr}`,
        }, { status: 404 });
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('Estimate error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
