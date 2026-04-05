import { NextResponse } from 'next/server';

// GeoSampa WFS — Dados cadastrais de lotes em São Paulo
// Fonte: Prefeitura de São Paulo — geosampa.prefeitura.sp.gov.br

const WFS_BASE = 'http://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/ows';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

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

async function queryWFS(lat, lon) {
  const d = 0.0005; // ~50m radius
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d},EPSG:4326`;
  const params = new URLSearchParams({
    service: 'WFS',
    version: '1.1.0',
    request: 'GetFeature',
    typeName: 'geoportal:lote_cidadao',
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    BBOX: bbox,
    maxFeatures: '5',
  });
  const res = await fetch(`${WFS_BASE}?${params}`, {
    next: { revalidate: 604800 },
  });
  if (!res.ok) return null;
  const geo = await res.json();
  if (!geo.features || !geo.features.length) return null;
  return geo.features[0];
}

function extractLoteData(feature) {
  const p = feature.properties || {};
  // GeoSampa field names vary — try common patterns
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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    let lat = parseFloat(searchParams.get('lat'));
    let lon = parseFloat(searchParams.get('lon'));
    const endereco = searchParams.get('endereco');

    // Geocode if address provided
    if (endereco && (!lat || !lon || isNaN(lat) || isNaN(lon))) {
      const coords = await geocode(endereco);
      if (!coords) {
        return NextResponse.json({ disponivel: false, erro: 'Endereço não encontrado' }, { status: 404 });
      }
      lat = coords.lat;
      lon = coords.lon;
    }

    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      return NextResponse.json({ erro: 'Forneça lat/lon ou endereco' }, { status: 400 });
    }

    // Check if coordinates are within São Paulo bounds (rough)
    if (lat < -24.1 || lat > -23.3 || lon < -47.0 || lon > -46.3) {
      return NextResponse.json({ disponivel: false, erro: 'Coordenadas fora de São Paulo' });
    }

    const feature = await queryWFS(lat, lon);
    if (!feature) {
      return NextResponse.json({ disponivel: false, coordenadas: { lat, lon } });
    }

    const lote = extractLoteData(feature);

    return NextResponse.json({
      disponivel: true,
      lote,
      fonte: 'GeoSampa — Prefeitura de São Paulo',
      coordenadas: { lat, lon },
    });
  } catch (err) {
    console.error('[geosampa] error:', err.message);
    return NextResponse.json({ disponivel: false, erro: 'Erro ao consultar GeoSampa' }, { status: 500 });
  }
}
