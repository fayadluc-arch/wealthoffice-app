import { NextResponse } from 'next/server';

// GeoSampa WFS — Dados cadastrais de lotes + zoneamento em São Paulo
// Fonte: Prefeitura de São Paulo — geosampa.prefeitura.sp.gov.br

const WFS_BASE = 'http://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/ows';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

// PDE São Paulo 2014 (Lei 16.050) — parâmetros por zona
const ZONEAMENTO_INFO = {
  'ZEU':  { nome: 'Zona Eixo de Estruturação da Transformação Urbana', ca_min: 0.5, ca_bas: 1, ca_max: 4, to_max: 0.7, gabarito: 'Sem limite', usos: ['Residencial', 'Comercial', 'Serviços', 'Industrial não incômodo', 'Misto'], hmp: '25% da área computável', obs: 'Incentivo à densidade junto ao transporte público. Fachada ativa obrigatória no térreo.' },
  'ZEUP': { nome: 'Zona Eixo de Estruturação da Transformação Urbana Previsto', ca_min: 0.5, ca_bas: 1, ca_max: 4, to_max: 0.7, gabarito: 'Sem limite', usos: ['Residencial', 'Comercial', 'Serviços', 'Misto'], hmp: '25% da área computável', obs: 'Mesmo da ZEU, para eixos de transporte futuro (metrô/corredor de ônibus planejado).' },
  'ZEM':  { nome: 'Zona Eixo de Estruturação da Transformação Metropolitana', ca_min: 0.5, ca_bas: 1, ca_max: 4, to_max: 0.7, gabarito: 'Sem limite', usos: ['Residencial', 'Comercial', 'Serviços', 'Industrial', 'Misto'], hmp: '25%', obs: 'Eixos de integração metropolitana (ferrovias, marginais).' },
  'ZM-1': { nome: 'Zona Mista de Baixa Densidade', ca_min: 0.2, ca_bas: 1, ca_max: 1, to_max: 0.5, gabarito: '15m (~5 andares)', usos: ['Residencial', 'Comercial local', 'Serviços'], hmp: 'Não exigido', obs: 'Área predominantemente residencial horizontal. Comércio local permitido.' },
  'ZM-2': { nome: 'Zona Mista de Média Densidade', ca_min: 0.2, ca_bas: 1, ca_max: 2, to_max: 0.5, gabarito: '28m (~9 andares)', usos: ['Residencial', 'Comercial', 'Serviços', 'Misto'], hmp: 'Não exigido para CA ≤ 1', obs: 'Permite verticalização moderada. Bom para prédios residenciais de médio porte.' },
  'ZM-3': { nome: 'Zona Mista de Alta Densidade', ca_min: 0.3, ca_bas: 1, ca_max: 2.5, to_max: 0.5, gabarito: '48m (~15 andares)', usos: ['Residencial', 'Comercial', 'Serviços', 'Institucional', 'Misto'], hmp: '20% se CA > 1', obs: 'Verticalização mais intensa. Ideal para incorporação residencial/comercial.' },
  'ZC':   { nome: 'Zona de Centralidade', ca_min: 0.3, ca_bas: 1, ca_max: 2.5, to_max: 0.7, gabarito: '48m', usos: ['Comercial', 'Serviços', 'Residencial', 'Misto'], hmp: 'Não exigido', obs: 'Áreas de centralidade (subcentros). Uso comercial incentivado.' },
  'ZCOR': { nome: 'Zona Corredor', ca_min: 0.3, ca_bas: 1, ca_max: 2, to_max: 0.7, gabarito: '28m', usos: ['Comercial', 'Serviços', 'Residencial'], hmp: 'Não exigido', obs: 'Ao longo de vias estruturais. Comércio e serviços no térreo.' },
  'ZPI-1':{ nome: 'Zona Predominantemente Industrial 1', ca_min: 0.1, ca_bas: 0.6, ca_max: 1.5, to_max: 0.7, gabarito: 'Sem limite', usos: ['Industrial', 'Logística', 'Galpão', 'Comércio atacadista'], hmp: 'N/A', obs: 'Uso industrial incentivado. Residencial restrito.' },
  'ZPI-2':{ nome: 'Zona Predominantemente Industrial 2', ca_min: 0.1, ca_bas: 0.6, ca_max: 1.5, to_max: 0.7, gabarito: 'Sem limite', usos: ['Industrial', 'Logística'], hmp: 'N/A', obs: 'Mais restritivo que ZPI-1.' },
  'ZDE-1':{ nome: 'Zona de Desenvolvimento Econômico 1', ca_min: 0.2, ca_bas: 1, ca_max: 2, to_max: 0.7, gabarito: 'Sem limite', usos: ['Comercial', 'Serviços', 'Tecnologia', 'Industrial não incômodo'], hmp: 'N/A', obs: 'Incentivo a atividades econômicas e geração de emprego.' },
  'ZOE':  { nome: 'Zona de Ocupação Especial', ca_min: 0, ca_bas: 0, ca_max: 0, to_max: 0, gabarito: 'Específico', usos: ['Definido em lei específica'], hmp: 'Específico', obs: 'Grandes equipamentos (aeroporto, campus USP, etc). Regras caso a caso.' },
  'ZEPAM':{ nome: 'Zona Especial de Proteção Ambiental', ca_min: 0, ca_bas: 0, ca_max: 0, to_max: 0, gabarito: '10m', usos: ['Preservação', 'Parque', 'Lazer'], hmp: 'N/A', obs: 'Área de proteção. Construção muito restrita ou proibida.' },
  'ZEPEC':{ nome: 'Zona Especial de Preservação Cultural', ca_min: 0, ca_bas: 1, ca_max: 1, to_max: 0.5, gabarito: 'Específico', usos: ['Conforme tombamento'], hmp: 'N/A', obs: 'Patrimônio histórico. Reforma com aprovação do CONPRESP/CONDEPHAAT.' },
  'ZER-1':{ nome: 'Zona Exclusivamente Residencial de Baixa Densidade 1', ca_min: 0.2, ca_bas: 1, ca_max: 1, to_max: 0.5, gabarito: '10m (~3 andares)', usos: ['Residencial unifamiliar'], hmp: 'N/A', obs: 'Apenas casas. Proibido prédios, comércio e serviços. Lote mínimo 250m².' },
  'ZER-2':{ nome: 'Zona Exclusivamente Residencial de Baixa Densidade 2', ca_min: 0.2, ca_bas: 1, ca_max: 1, to_max: 0.5, gabarito: '10m', usos: ['Residencial unifamiliar', 'Condomínio horizontal'], hmp: 'N/A', obs: 'Casas e condomínios horizontais. Lote mínimo 500m².' },
};

async function geocode(endereco) {
  const url = `${NOMINATIM}?q=${encodeURIComponent(endereco)}&format=json&limit=1&countrycodes=br`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'WealthOffice/1.0 (contact@wealthoffice.com.br)' },
    next: { revalidate: 604800 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function queryWFS(typeName, lat, lon, maxFeatures = 5) {
  const d = 0.0005;
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d},EPSG:4326`;
  const params = new URLSearchParams({
    service: 'WFS', version: '1.1.0', request: 'GetFeature',
    typeName, outputFormat: 'application/json',
    srsName: 'EPSG:4326', BBOX: bbox, maxFeatures: String(maxFeatures),
  });
  try {
    const res = await fetch(`${WFS_BASE}?${params}`, { next: { revalidate: 604800 } });
    if (!res.ok) return null;
    const geo = await res.json();
    return geo.features?.length ? geo.features[0] : null;
  } catch { return null; }
}

function extractLoteData(feature) {
  const p = feature?.properties || {};
  return {
    sql: p.sq_lote || p.SQL || p.cd_setor_quadra_lote || p.sq_fiscal || null,
    area: p.ar_lote || p.qt_area_terreno || p.area || null,
    perimetro: p.pe_lote || p.perimetro || null,
    zoneamento: p.cd_zoneamento || p.zoneamento || p.zona || null,
    uso: p.dc_uso || p.tp_uso || p.uso || null,
    tipo_lote: p.tp_lote || p.tipo || null,
    setor: p.cd_setor || null,
    quadra: p.cd_quadra || null,
    lote: p.cd_lote || null,
  };
}

function buildZoneAnalysis(zoneCode, areaLote) {
  if (!zoneCode) return null;
  // Normalize: "ZM-2a" → "ZM-2", "ZEU-1" → "ZEU"
  const normalized = zoneCode.replace(/[a-z]/g, '').replace(/-\d$/, (m) => m).toUpperCase().trim();
  const info = ZONEAMENTO_INFO[normalized] || Object.entries(ZONEAMENTO_INFO).find(([k]) => normalized.startsWith(k))?.[1];
  if (!info) return { zona: zoneCode, mensagem: `Zona ${zoneCode} — consultar legislação municipal para parâmetros.` };

  const area = Number(areaLote) || 0;
  const areaComputavelMax = area * info.ca_max;
  const areaComputavelBasica = area * info.ca_bas;

  return {
    zona: zoneCode,
    nome: info.nome,
    parametros: {
      ca_basico: info.ca_bas,
      ca_maximo: info.ca_max,
      taxa_ocupacao: info.to_max,
      gabarito: info.gabarito,
    },
    usos_permitidos: info.usos,
    hmp: info.hmp,
    observacao: info.obs,
    potencial_construtivo: area > 0 ? {
      area_lote: area,
      area_computavel_basica: Math.round(areaComputavelBasica),
      area_computavel_maxima: Math.round(areaComputavelMax),
      area_ocupacao_maxima: Math.round(area * info.to_max),
      pavimentos_estimados: info.gabarito === 'Sem limite'
        ? Math.ceil(areaComputavelMax / (area * info.to_max)) || 0
        : parseInt(info.gabarito) > 0 ? Math.floor(parseInt(info.gabarito) / 3) : null,
      outorga_onerosa: info.ca_max > info.ca_bas,
      area_outorga: info.ca_max > info.ca_bas ? Math.round(areaComputavelMax - areaComputavelBasica) : 0,
    } : null,
    ideias: generateIdeas(info, area),
  };
}

function generateIdeas(info, area) {
  const ideas = [];
  const usos = info.usos.join(', ').toLowerCase();

  if (info.ca_max >= 4) {
    ideas.push({ tipo: 'Torre Residencial', desc: `Prédio alto (CA ${info.ca_max}). Potencial ${Math.round(area * info.ca_max)}m² computáveis. VGV estimado: R$ ${Math.round(area * info.ca_max * 12000 / 1000000)}M+`, viabilidade: 'Alta' });
    ideas.push({ tipo: 'Uso Misto (Residencial + Comércio)', desc: 'Térreo comercial + torre residencial. Fachada ativa rende desconto na outorga.', viabilidade: 'Alta' });
  }
  if (info.ca_max >= 2 && usos.includes('comercial')) {
    ideas.push({ tipo: 'Prédio Comercial / Lajes', desc: `Lajes corporativas de ${Math.round(area * info.to_max)}m² por andar. Renda de aluguel: ~R$ ${Math.round(area * info.to_max * 80)}/mês por andar.`, viabilidade: 'Alta' });
  }
  if (info.ca_max >= 2 && usos.includes('residencial')) {
    const unidades = Math.round(area * info.ca_max / 50);
    ideas.push({ tipo: 'Incorporação Residencial', desc: `~${unidades} unidades de 50m². VGV estimado: R$ ${Math.round(unidades * 500000 / 1000000)}M.`, viabilidade: 'Alta' });
  }
  if (info.ca_max <= 1 && usos.includes('residencial')) {
    ideas.push({ tipo: 'Casa / Condomínio Horizontal', desc: `Área max ${Math.round(area * info.to_max)}m² de ocupação. Ideal para residência unifamiliar de alto padrão.`, viabilidade: 'Alta' });
  }
  if (usos.includes('industrial') || usos.includes('logística') || usos.includes('galpão')) {
    ideas.push({ tipo: 'Galpão Logístico', desc: `Ocupação até ${Math.round(area * info.to_max)}m². Aluguel estimado: R$ 25-40/m² (logístico).`, viabilidade: 'Alta' });
  }
  if (usos.includes('misto') && area > 300) {
    ideas.push({ tipo: 'Hotel / Flat', desc: 'Unidades compactas para locação short-stay ou long-stay. Demanda crescente em eixos de transporte.', viabilidade: 'Média' });
  }
  if (area > 1000) {
    ideas.push({ tipo: 'Estacionamento (transitório)', desc: `Renda imediata enquanto aguarda incorporação. ~${Math.round(area / 12)} vagas × R$ 25/dia = R$ ${Math.round(area / 12 * 25 * 22)}/mês.`, viabilidade: 'Alta' });
  }

  return ideas;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    let lat = parseFloat(searchParams.get('lat'));
    let lon = parseFloat(searchParams.get('lon'));
    const endereco = searchParams.get('endereco');

    if (endereco && (!lat || !lon || isNaN(lat) || isNaN(lon))) {
      const coords = await geocode(endereco);
      if (!coords) return NextResponse.json({ disponivel: false, erro: 'Endereço não encontrado' }, { status: 404 });
      lat = coords.lat;
      lon = coords.lon;
    }

    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      return NextResponse.json({ erro: 'Forneça lat/lon ou endereco' }, { status: 400 });
    }

    if (lat < -24.1 || lat > -23.3 || lon < -47.0 || lon > -46.3) {
      return NextResponse.json({ disponivel: false, erro: 'Coordenadas fora de São Paulo' });
    }

    // Query lot data
    const feature = await queryWFS('geoportal:lote_cidadao', lat, lon);
    if (!feature) {
      return NextResponse.json({ disponivel: false, coordenadas: { lat, lon } });
    }

    const lote = extractLoteData(feature);

    // Build zoning analysis
    const zoneAnalysis = buildZoneAnalysis(lote.zoneamento, lote.area);

    return NextResponse.json({
      disponivel: true,
      lote,
      zoneamento: zoneAnalysis,
      fonte: 'GeoSampa — Prefeitura de São Paulo (PDE Lei 16.050/2014)',
      coordenadas: { lat, lon },
    });
  } catch (err) {
    console.error('[geosampa] error:', err.message);
    return NextResponse.json({ disponivel: false, erro: 'Erro ao consultar GeoSampa' }, { status: 500 });
  }
}
