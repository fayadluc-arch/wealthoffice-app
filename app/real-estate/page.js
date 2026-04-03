'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// SUPABASE CLIENT
// ============================================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ============================================================
// CONSTANTS
// ============================================================
const TIPOS = ['Apartamento', 'Casa', 'Studio', 'Laje Corporativa', 'Galpão', 'Terreno', 'Varejo'];
const USOS = ['Residencial', 'Comercial', 'Industrial', 'Misto'];
const PADROES = ['Econômico', 'Médio', 'Alto', 'Luxo'];
const STATUS_LIST = ['Alugado', 'Vago', 'Uso Próprio', 'Em Reforma', 'À Venda'];
const TITULARES = ['PF', 'Holding', 'SPE', 'FII'];
const INDICES = ['IGPM', 'IPCA', 'INPC'];
const GARANTIAS = ['Caução', 'Fiador', 'Seguro Fiança', 'Título Capitalização', 'Sem Garantia'];
const MANUT_CATEGORIAS = ['Preventiva', 'Corretiva', 'Reforma', 'Pintura', 'Elétrica', 'Hidráulica', 'Ar Condicionado', 'Outro'];
const STATUS_COLORS = {
  'Alugado': '#34D399',
  'Vago': '#F87171',
  'Uso Próprio': '#60A5FA',
  'Em Reforma': '#FBBF24',
  'À Venda': '#A78BFA',
};
const RECIBO_COLORS = { Pendente: '#FBBF24', Pago: '#34D399', Atrasado: '#F87171' };
const MANUT_COLORS = { Pendente: '#FBBF24', 'Em Andamento': '#60A5FA', Concluída: '#34D399' };

// ============================================================
// HELPERS
// ============================================================
function fmtR(v) {
  if (v == null || isNaN(v)) return 'R$ 0,00';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(v, dec = 1) {
  if (v == null || isNaN(v)) return '0,0%';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + '%';
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}
function calcNOI(im) {
  const aluguelAnual = (im.aluguel || 0) * 12;
  const vacancia = aluguelAnual * 0.05;
  const admAnual = (im.aluguel || 0) * (im.taxa_adm || 0) / 100 * 12;
  const manut = aluguelAnual * 0.03;
  return aluguelAnual - vacancia - (im.iptu_anual || 0) - (im.condominio_mensal || 0) * 12 - (im.seguro_anual || 0) - (im.capex_pendente || 0) - admAnual - manut;
}
function calcYield(im) {
  const vm = im.valor_mercado || im.custo_aquisicao;
  if (!vm || vm <= 0) return 0;
  return (calcNOI(im) / vm) * 100;
}
function calcLTV(im) {
  const vm = im.valor_mercado || im.custo_aquisicao;
  if (!vm || vm <= 0) return 0;
  return ((im.divida || 0) / vm) * 100;
}
function diasFimContrato(im) {
  if (!im.contrato_fim) return null;
  return Math.round((new Date(im.contrato_fim) - new Date()) / (1000 * 60 * 60 * 24));
}
function diasProxReajuste(im) {
  if (!im.data_proximo_reajuste) return null;
  return Math.round((new Date(im.data_proximo_reajuste) - new Date()) / (1000 * 60 * 60 * 24));
}
function proxReajuste(aluguel, indice, taxa) {
  return aluguel * (1 + (taxa || 0) / 100);
}

// ============================================================
// ICONS (SVG inline)
// ============================================================
const Icons = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  building: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/></svg>,
  wrench: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  calculator: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="11" x2="8" y2="11.01"/><line x1="12" y1="11" x2="12" y2="11.01"/><line x1="16" y1="11" x2="16" y2="11.01"/><line x1="8" y1="15" x2="8" y2="15.01"/><line x1="12" y1="15" x2="12" y2="15.01"/><line x1="8" y1="19" x2="8" y2="19.01"/><line x1="12" y1="19" x2="12" y2="19.01"/></svg>,
  chart: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  target: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  brain: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44A2.5 2.5 0 0 1 4.5 17.5a2.5 2.5 0 0 1-.44-4.96A2.5 2.5 0 0 1 4.5 9.5 2.5 2.5 0 0 1 7 7a2.5 2.5 0 0 1 2.5-5z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44A2.5 2.5 0 0 0 19.5 17.5a2.5 2.5 0 0 0 .44-4.96A2.5 2.5 0 0 0 19.5 9.5 2.5 2.5 0 0 0 17 7a2.5 2.5 0 0 0-2.5-5z"/></svg>,
  back: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  alert: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  logout: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  dollar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  map: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
};

// ============================================================
// STYLES (Same design system as precatórios module)
// ============================================================
const S = {
  app: { display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' },
  sidebar: {
    width: 260, background: 'linear-gradient(180deg, #0D1017 0%, #0A0D12 100%)',
    borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
    position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
  },
  sidebarLogo: { padding: '32px 28px 28px', borderBottom: '1px solid var(--border)' },
  logoIcon: {
    width: 40, height: 40, borderRadius: 12,
    background: 'linear-gradient(135deg, var(--blue) 0%, #93C5FD 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: '-0.03em',
    boxShadow: '0 2px 12px rgba(96,165,250,0.3)',
  },
  logoText: { fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-serif)' },
  logoSub: { fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 500 },
  nav: { flex: 1, padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: (active) => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
    borderRadius: 10, cursor: 'pointer',
    color: active ? '#93C5FD' : 'var(--text-secondary)',
    background: active ? 'rgba(96,165,250,0.07)' : 'transparent',
    fontSize: 13.5, fontWeight: active ? 600 : 400,
    transition: 'all var(--transition)', border: 'none', width: '100%', textAlign: 'left',
    letterSpacing: '-0.01em',
    borderLeft: active ? '3px solid var(--blue)' : '3px solid transparent',
  }),
  sidebarFooter: {
    padding: '20px 24px', borderTop: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  main: { flex: 1, marginLeft: 260, padding: '32px 40px 48px', minHeight: '100vh', maxWidth: 'calc(100vw - 260px)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  pageTitle: { fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' },
  pageSub: { fontSize: 13.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5, letterSpacing: '-0.01em' },
  card: { background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', padding: 28, marginBottom: 20 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 },
  kpiCard: (accent) => ({
    background: accent ? 'linear-gradient(135deg, rgba(96,165,250,0.08) 0%, rgba(96,165,250,0.02) 100%)' : 'var(--bg-card)',
    borderRadius: 16, border: accent ? '1px solid rgba(96,165,250,0.2)' : '1px solid var(--border)',
    padding: '22px 24px', position: 'relative', overflow: 'hidden',
  }),
  kpiLabel: { fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 },
  kpiValue: (color) => ({ fontSize: 26, fontWeight: 700, color: color || 'var(--text-primary)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }),
  kpiSub: { fontSize: 12, color: 'var(--text-muted)', marginTop: 8 },
  btn: (variant) => ({
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
    fontSize: 13, fontWeight: 600, border: 'none', transition: 'all var(--transition)',
    ...(variant === 'primary' ? {
      background: 'linear-gradient(135deg, var(--blue) 0%, #93C5FD 100%)',
      color: '#fff', boxShadow: '0 2px 12px rgba(96,165,250,0.25)',
    } : variant === 'danger' ? {
      background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(248,113,113,0.15)',
    } : variant === 'accent' ? {
      background: 'var(--accent-dim)', color: 'var(--accent-light)', border: '1px solid rgba(46,158,110,0.15)',
    } : {
      background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-light)',
    })
  }),
  input: {
    width: '100%', padding: '11px 16px', borderRadius: 10,
    border: '1px solid var(--border)', background: 'var(--bg-surface)',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none',
  },
  select: {
    width: '100%', padding: '11px 16px', borderRadius: 10,
    border: '1px solid var(--border)', background: 'var(--bg-surface)',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none',
  },
  label: { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, display: 'block', letterSpacing: '0.04em', textTransform: 'uppercase' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0 },
  th: { textAlign: 'left', padding: '14px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', whiteSpace: 'nowrap' },
  td: { padding: '16px 16px', fontSize: 13.5, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
  badge: (color) => ({
    display: 'inline-flex', alignItems: 'center', padding: '5px 14px',
    borderRadius: 20, fontSize: 11, fontWeight: 600, color: color, background: color + '12',
  }),
  subtabs: { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 },
  subtab: (active) => ({
    padding: '10px 20px', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer',
    color: active ? '#93C5FD' : 'var(--text-secondary)', border: 'none', background: 'none',
    borderBottom: active ? '2px solid var(--blue)' : '2px solid transparent',
    transition: 'all var(--transition)', marginBottom: -1,
  }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 },
  formSection: { fontSize: 16, fontWeight: 700, marginBottom: 24, paddingBottom: 12, borderBottom: '1px solid var(--border)', letterSpacing: '-0.02em', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' },
  emptyState: { textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' },
  alertCard: (color) => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
    borderRadius: 10, background: color + '08', border: '1px solid ' + color + '20',
    fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8,
  }),
};

// ============================================================
// EMPTY IMOVEL TEMPLATE
// ============================================================
const EMPTY_IMOVEL = {
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: 'SP', matricula: '',
  tipo: 'Apartamento', uso: 'Residencial', area_m2: '', quartos: '', padrao: 'Médio', nome: '',
  titular: 'PF', titular_nome: '', cnpj: '', custo_aquisicao: '', data_aquisicao: '', valor_mercado: '', divida: '', parcela_mensal: '',
  status: 'Vago', inquilino: '', inquilino_contato: '', aluguel: '', contrato_inicio: '', contrato_fim: '',
  indice_reajuste: 'IGPM', data_proximo_reajuste: '', garantia: '', imobiliaria: '', taxa_adm: '', inadimplente: false,
  iptu_anual: '', condominio_mensal: '', seguro_anual: '', capex_pendente: '', observacoes: '',
};

// ============================================================
// FIELD INPUT COMPONENT
// ============================================================
function Field({ label, value, onChange, type = 'text', options, placeholder, suffix, disabled, style: st }) {
  if (options) {
    return (
      <div style={st}>
        <label style={S.label}>{label}</label>
        <select style={S.select} value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled}>
          <option value="">Selecionar</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div style={st}>
      <label style={S.label}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          style={S.input}
          type={type}
          value={value || ''}
          onChange={e => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {suffix && <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12 }}>{suffix}</span>}
      </div>
    </div>
  );
}

// ============================================================
// TAB 1: DASHBOARD
// ============================================================
function DashboardTab({ imoveis }) {
  const totais = useMemo(() => {
    const alugados = imoveis.filter(i => i.status === 'Alugado');
    const receitaMensal = alugados.reduce((s, i) => s + (i.aluguel || 0), 0);
    const noiAnual = imoveis.reduce((s, i) => s + calcNOI(i), 0);
    const patrimonio = imoveis.reduce((s, i) => s + (i.valor_mercado || i.custo_aquisicao || 0), 0);
    const yieldPort = patrimonio > 0 ? (noiAnual / patrimonio) * 100 : 0;
    const vagos = imoveis.filter(i => i.status === 'Vago').length;
    const vacancia = imoveis.length > 0 ? (vagos / imoveis.length) * 100 : 0;
    return { receitaMensal, noiAnual, patrimonio, yieldPort, vacancia, alugados: alugados.length, vagos };
  }, [imoveis]);

  const alertas = useMemo(() => {
    const list = [];
    imoveis.forEach(im => {
      if (im.inadimplente) list.push({ tipo: 'Inadimplência', msg: `${im.nome || im.logradouro || 'Imóvel'} — inquilino inadimplente`, color: '#F87171' });
      if (im.status === 'Vago') list.push({ tipo: 'Vacância', msg: `${im.nome || im.logradouro || 'Imóvel'} — vago`, color: '#FBBF24' });
      const df = diasFimContrato(im);
      if (df !== null && df <= 90 && df > 0) list.push({ tipo: 'Contrato', msg: `${im.nome || im.logradouro || 'Imóvel'} — contrato vence em ${df}d`, color: '#F97316' });
      if (df !== null && df <= 0) list.push({ tipo: 'Contrato Vencido', msg: `${im.nome || im.logradouro || 'Imóvel'} — contrato vencido`, color: '#F87171' });
      const ltv = calcLTV(im);
      if (ltv > 70) list.push({ tipo: 'LTV Alto', msg: `${im.nome || im.logradouro || 'Imóvel'} — LTV ${fmtPct(ltv)}`, color: '#F87171' });
      const dr = diasProxReajuste(im);
      if (dr !== null && dr <= 60 && dr > 0) list.push({ tipo: 'Reajuste', msg: `${im.nome || im.logradouro || 'Imóvel'} — reajuste em ${dr}d`, color: '#60A5FA' });
    });
    return list;
  }, [imoveis]);

  return (
    <div>
      <div style={S.kpiGrid}>
        {[
          { label: 'Receita Mensal', value: fmtR(totais.receitaMensal), color: '#34D399', accent: true },
          { label: 'NOI Anual', value: fmtR(totais.noiAnual), color: '#60A5FA' },
          { label: 'Patrimônio', value: fmtR(totais.patrimonio) },
          { label: 'Yield Portfólio', value: fmtPct(totais.yieldPort), color: totais.yieldPort >= 6 ? '#34D399' : '#FBBF24' },
          { label: 'Vacância', value: fmtPct(totais.vacancia), color: totais.vacancia > 10 ? '#F87171' : '#34D399' },
        ].map(k => (
          <div key={k.label} style={S.kpiCard(k.accent)}>
            <div style={S.kpiLabel}>{Icons.dollar} {k.label}</div>
            <div style={S.kpiValue(k.color)}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Ativos', value: imoveis.length, color: 'var(--text-primary)' },
          { label: 'Locados', value: totais.alugados, color: '#34D399' },
          { label: 'Inadimplentes', value: imoveis.filter(i => i.inadimplente).length, color: '#F87171' },
          { label: 'Em Holding/SPE', value: imoveis.filter(i => i.titular === 'Holding' || i.titular === 'SPE').length, color: '#A78BFA' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 24px', flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alertas.length > 0 && (
        <div style={S.card}>
          <div style={S.formSection}>Alertas Operacionais ({alertas.length})</div>
          {alertas.map((a, i) => (
            <div key={i} style={S.alertCard(a.color)}>
              {Icons.alert}
              <span style={{ color: a.color, fontWeight: 600, minWidth: 130 }}>{a.tipo}</span>
              <span>{a.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Portfolio table */}
      <div style={S.card}>
        <div style={S.formSection}>Portfólio</div>
        {imoveis.length === 0 ? (
          <div style={S.emptyState}>Nenhum imóvel cadastrado ainda.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['Ativo', 'Tipo', 'Aluguel', 'NOI Anual', 'Yield', 'LTV', 'Status', 'Alertas'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {imoveis.map(im => {
                  const noi = calcNOI(im);
                  const y = calcYield(im);
                  const ltv = calcLTV(im);
                  const df = diasFimContrato(im);
                  const alerts = [];
                  if (im.inadimplente) alerts.push('Inadimpl.');
                  if (ltv > 70) alerts.push('LTV>' + Math.round(ltv) + '%');
                  if (df !== null && df <= 90) alerts.push(df <= 0 ? 'Vencido' : df + 'd');
                  return (
                    <tr key={im.id} className="table-row-hover">
                      <td style={S.td}>
                        <div style={{ fontWeight: 600 }}>{im.nome || im.logradouro || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{im.cidade}/{im.uf}</div>
                      </td>
                      <td style={S.td}>{im.tipo}</td>
                      <td style={S.td}>{fmtR(im.aluguel)}</td>
                      <td style={{ ...S.td, color: noi >= 0 ? '#34D399' : '#F87171' }}>{fmtR(noi)}</td>
                      <td style={{ ...S.td, color: y >= 6 ? '#34D399' : '#FBBF24' }}>{fmtPct(y)}</td>
                      <td style={{ ...S.td, color: ltv > 70 ? '#F87171' : 'var(--text-secondary)' }}>{fmtPct(ltv)}</td>
                      <td style={S.td}><span style={S.badge(STATUS_COLORS[im.status] || '#60A5FA')}>{im.status}</span></td>
                      <td style={S.td}>
                        {alerts.length > 0 ? alerts.map((a, i) => (
                          <span key={i} style={{ ...S.badge('#F87171'), marginRight: 4, fontSize: 10 }}>{a}</span>
                        )) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB 2: CADASTRO DE ATIVO
// ============================================================
function CadastroTab({ imoveis, onSave, onEdit, onDelete, user }) {
  const [subtab, setSubtab] = useState('novo');
  const [form, setForm] = useState({ ...EMPTY_IMOVEL });
  const [editingId, setEditingId] = useState(null);
  const [cepStatus, setCepStatus] = useState(null); // null | 'loading' | 'ok' | 'error'
  const [saving, setSaving] = useState(false);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // CEP auto-fill
  useEffect(() => {
    const clean = (form.cep || '').replace(/\D/g, '');
    if (clean.length !== 8) { setCepStatus(null); return; }
    setCepStatus('loading');
    fetch(`/api/cep/${clean}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setCepStatus('error'); return; }
        setForm(f => ({ ...f, logradouro: data.logradouro, bairro: data.bairro, cidade: data.cidade, uf: data.uf, complemento: data.complemento || f.complemento }));
        setCepStatus('ok');
      })
      .catch(() => setCepStatus('error'));
  }, [form.cep]);

  async function handleSave() {
    setSaving(true);
    const data = { ...form };
    // Convert numeric fields
    ['area_m2', 'quartos', 'custo_aquisicao', 'valor_mercado', 'divida', 'parcela_mensal', 'aluguel', 'taxa_adm', 'iptu_anual', 'condominio_mensal', 'seguro_anual', 'capex_pendente'].forEach(k => {
      data[k] = data[k] === '' || data[k] == null ? 0 : Number(data[k]);
    });
    data.user_id = user.id;
    if (editingId) {
      await onEdit(editingId, data);
    } else {
      await onSave(data);
    }
    setForm({ ...EMPTY_IMOVEL });
    setEditingId(null);
    setSaving(false);
    setSubtab('todos');
  }

  function startEdit(im) {
    setForm({ ...im });
    setEditingId(im.id);
    setSubtab('novo');
  }

  // Preview NOI
  const previewNOI = useMemo(() => {
    const f = { ...form };
    ['aluguel', 'iptu_anual', 'condominio_mensal', 'seguro_anual', 'capex_pendente', 'taxa_adm'].forEach(k => f[k] = Number(f[k]) || 0);
    return calcNOI(f);
  }, [form]);

  return (
    <div>
      <div style={S.subtabs}>
        <button style={S.subtab(subtab === 'novo')} onClick={() => { setSubtab('novo'); setEditingId(null); setForm({ ...EMPTY_IMOVEL }); }}>
          {editingId ? 'Editar Ativo' : 'Novo Ativo'}
        </button>
        <button style={S.subtab(subtab === 'todos')} onClick={() => setSubtab('todos')}>
          Todos os Ativos ({imoveis.length})
        </button>
      </div>

      {subtab === 'novo' ? (
        <div style={S.card}>
          {/* Location */}
          <div style={S.formSection}>Localização</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={S.label}>
                CEP {cepStatus === 'loading' && '⏳'}{cepStatus === 'ok' && '✓'}{cepStatus === 'error' && '✗'}
              </label>
              <input style={{ ...S.input, borderColor: cepStatus === 'ok' ? '#34D399' : cepStatus === 'error' ? '#F87171' : undefined }}
                value={form.cep} onChange={e => upd('cep', e.target.value)} placeholder="00000-000" />
            </div>
            <Field label="Logradouro" value={form.logradouro} onChange={v => upd('logradouro', v)} />
            <Field label="Número" value={form.numero} onChange={v => upd('numero', v)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
            <Field label="Complemento" value={form.complemento} onChange={v => upd('complemento', v)} />
            <Field label="Bairro" value={form.bairro} onChange={v => upd('bairro', v)} />
            <Field label="Cidade" value={form.cidade} onChange={v => upd('cidade', v)} />
            <Field label="UF" value={form.uf} onChange={v => upd('uf', v)} />
            <Field label="Matrícula" value={form.matricula} onChange={v => upd('matricula', v)} placeholder="Nº matrícula" />
          </div>

          {/* Quick Classification — appears after CEP auto-fill */}
          {cepStatus === 'ok' && (
            <div style={{ marginBottom: 28 }}>
              <div style={S.formSection}>Classificação do Imóvel</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                {[
                  { label: 'Residencial', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, color: '#34D399', tipos: ['Apartamento', 'Casa', 'Studio'], uso: 'Residencial', desc: 'Apartamento, casa, studio' },
                  { label: 'Comercial', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/></svg>, color: '#60A5FA', tipos: ['Laje Corporativa', 'Varejo', 'Galpão'], uso: 'Comercial', desc: 'Laje, varejo, galpão' },
                  { label: 'Terreno', icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l5-5 4 4 4-4 5 5"/></svg>, color: '#FBBF24', tipos: ['Terreno'], uso: 'Misto', desc: 'Terreno para desenvolvimento' },
                ].map(c => {
                  const isActive = c.uso === form.uso && c.tipos.includes(form.tipo);
                  return (
                    <div
                      key={c.label}
                      onClick={() => {
                        upd('uso', c.uso);
                        upd('tipo', c.tipos[0]);
                      }}
                      style={{
                        background: isActive ? c.color + '12' : 'var(--bg-surface)',
                        border: isActive ? `2px solid ${c.color}` : '1px solid var(--border)',
                        borderRadius: 16, padding: '24px 20px', cursor: 'pointer',
                        textAlign: 'center', transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = c.color + '60'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      <div style={{ color: isActive ? c.color : 'var(--text-muted)', marginBottom: 12, display: 'flex', justifyContent: 'center' }}>{c.icon}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: isActive ? c.color : 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-serif)' }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.desc}</div>
                      {isActive && <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: c.color }}>✓ Selecionado</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Characteristics */}
          <div style={S.formSection}>Características</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
            <Field label="Nome / Apelido" value={form.nome} onChange={v => upd('nome', v)} placeholder="Ex: Apto Faria Lima" style={{ gridColumn: 'span 2' }} />
            <Field label="Tipo" value={form.tipo} onChange={v => upd('tipo', v)} options={TIPOS} />
            <Field label="Uso" value={form.uso} onChange={v => upd('uso', v)} options={USOS} />
            <Field label="Área m²" value={form.area_m2} onChange={v => upd('area_m2', v)} type="number" />
            <Field label="Quartos" value={form.quartos} onChange={v => upd('quartos', v)} type="number" />
          </div>

          {/* Ownership */}
          <div style={S.formSection}>Estrutura Patrimonial</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <Field label="Titular" value={form.titular} onChange={v => upd('titular', v)} options={TITULARES} />
            <Field label="Nome Titular" value={form.titular_nome} onChange={v => upd('titular_nome', v)} />
            <Field label="CNPJ (se PJ)" value={form.cnpj} onChange={v => upd('cnpj', v)} />
            <Field label="Padrão" value={form.padrao} onChange={v => upd('padrao', v)} options={PADROES} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
            <Field label="Custo Aquisição" value={form.custo_aquisicao} onChange={v => upd('custo_aquisicao', v)} type="number" placeholder="R$" />
            <Field label="Data Aquisição" value={form.data_aquisicao} onChange={v => upd('data_aquisicao', v)} type="date" />
            <Field label="Valor Mercado" value={form.valor_mercado} onChange={v => upd('valor_mercado', v)} type="number" placeholder="R$" />
            <Field label="Dívida" value={form.divida} onChange={v => upd('divida', v)} type="number" placeholder="R$" />
            <Field label="Parcela Mensal" value={form.parcela_mensal} onChange={v => upd('parcela_mensal', v)} type="number" placeholder="R$" />
          </div>

          {/* Operational */}
          <div style={S.formSection}>Operacional</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <Field label="Status" value={form.status} onChange={v => upd('status', v)} options={STATUS_LIST} />
            <Field label="Inquilino" value={form.inquilino} onChange={v => upd('inquilino', v)} />
            <Field label="Contato Inquilino" value={form.inquilino_contato} onChange={v => upd('inquilino_contato', v)} />
            <div>
              <Field label="Aluguel Mensal" value={form.aluguel} onChange={v => upd('aluguel', v)} type="number" placeholder="R$" />
              {Number(form.aluguel) > 0 && (
                <div style={{ marginTop: 6, fontSize: 12, color: previewNOI >= 0 ? '#34D399' : '#F87171' }}>
                  NOI estimado: {fmtR(previewNOI)}/ano
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <Field label="Início Contrato" value={form.contrato_inicio} onChange={v => upd('contrato_inicio', v)} type="date" />
            <Field label="Fim Contrato" value={form.contrato_fim} onChange={v => upd('contrato_fim', v)} type="date" />
            <Field label="Índice Reajuste" value={form.indice_reajuste} onChange={v => upd('indice_reajuste', v)} options={INDICES} />
            <Field label="Próx. Reajuste" value={form.data_proximo_reajuste} onChange={v => upd('data_proximo_reajuste', v)} type="date" />
            <Field label="Garantia" value={form.garantia} onChange={v => upd('garantia', v)} options={GARANTIAS} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
            <Field label="Imobiliária" value={form.imobiliaria} onChange={v => upd('imobiliaria', v)} />
            <Field label="Taxa Adm %" value={form.taxa_adm} onChange={v => upd('taxa_adm', v)} type="number" suffix="%" />
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <label style={{ ...S.label, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.inadimplente || false} onChange={e => upd('inadimplente', e.target.checked)} />
                Inadimplente
              </label>
            </div>
          </div>

          {/* Charges */}
          <div style={S.formSection}>Encargos</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
            <Field label="IPTU Anual" value={form.iptu_anual} onChange={v => upd('iptu_anual', v)} type="number" placeholder="R$" />
            <Field label="Condomínio Mensal" value={form.condominio_mensal} onChange={v => upd('condominio_mensal', v)} type="number" placeholder="R$" />
            <Field label="Seguro Anual" value={form.seguro_anual} onChange={v => upd('seguro_anual', v)} type="number" placeholder="R$" />
            <Field label="CAPEX Pendente" value={form.capex_pendente} onChange={v => upd('capex_pendente', v)} type="number" placeholder="R$" />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 28 }}>
            <label style={S.label}>Observações</label>
            <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' }} value={form.observacoes || ''} onChange={e => upd('observacoes', e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button style={S.btn('primary')} onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Atualizar Ativo' : 'Cadastrar Ativo'}
            </button>
            {editingId && (
              <button style={S.btn()} onClick={() => { setEditingId(null); setForm({ ...EMPTY_IMOVEL }); }}>Cancelar</button>
            )}
            {(form.titular === 'Holding' || form.titular === 'SPE' || form.titular === 'PF') && (
              <button style={S.btn('accent')} onClick={() => {
                if (window.sendPrompt) window.sendPrompt(`Analise a estrutura patrimonial para este imóvel: Titular: ${form.titular}, Valor: ${fmtR(Number(form.valor_mercado) || 0)}, Aluguel: ${fmtR(Number(form.aluguel) || 0)}, Tipo: ${form.tipo}. Compare PF vs Holding vs SPE considerando IRPF, ITCMD, blindagem patrimonial e custo de manutenção.`);
              }}>
                Analisar Estrutura no Chat ↗
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={S.card}>
          {imoveis.length === 0 ? (
            <div style={S.emptyState}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nenhum ativo cadastrado</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Clique em "Novo Ativo" para começar</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Ativo', 'Tipo', 'Cidade', 'Titular', 'Valor Mercado', 'Aluguel', 'Status', 'Ações'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {imoveis.map(im => (
                    <tr key={im.id} className="table-row-hover">
                      <td style={S.td}><span style={{ fontWeight: 600 }}>{im.nome || im.logradouro || '—'}</span></td>
                      <td style={S.td}>{im.tipo}</td>
                      <td style={S.td}>{im.cidade}/{im.uf}</td>
                      <td style={S.td}><span style={S.badge(im.titular === 'PF' ? '#60A5FA' : '#A78BFA')}>{im.titular}</span></td>
                      <td style={S.td}>{fmtR(im.valor_mercado)}</td>
                      <td style={S.td}>{fmtR(im.aluguel)}</td>
                      <td style={S.td}><span style={S.badge(STATUS_COLORS[im.status] || '#60A5FA')}>{im.status}</span></td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button style={{ ...S.btn(), padding: '6px 12px', fontSize: 12 }} onClick={() => startEdit(im)}>{Icons.edit}</button>
                          <button style={{ ...S.btn('danger'), padding: '6px 12px', fontSize: 12 }} onClick={() => onDelete(im.id)}>{Icons.trash}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB 3: OPERACIONAL
// ============================================================
function OperacionalTab({ imoveis, recibos, ocorrencias, manutencoes, onSaveRecibo, onSaveOcorrencia, onSaveManutencao, onUpdateImovel }) {
  const [subtab, setSubtab] = useState('recibos');
  const [reciboForm, setReciboForm] = useState({ imovel_id: '', mes_referencia: '', valor_bruto: '', taxa_adm_valor: '', valor_liquido: '', status: 'Pendente', observacoes: '' });
  const [ocorrForm, setOcorrForm] = useState({ imovel_id: '', tipo: 'Inadimplência', descricao: '', valor: '' });
  const [manutForm, setManutForm] = useState({ imovel_id: '', categoria: 'Corretiva', descricao: '', valor: '', fornecedor: '' });
  const [reajForm, setReajForm] = useState({ imovel_id: '', indice: 'IGPM', taxa: 5.0 });

  const alugados = imoveis.filter(i => i.status === 'Alugado');

  // Auto-calc recibo
  useEffect(() => {
    if (!reciboForm.imovel_id) return;
    const im = imoveis.find(i => i.id === reciboForm.imovel_id);
    if (!im) return;
    const bruto = im.aluguel || 0;
    const adm = bruto * (im.taxa_adm || 0) / 100;
    setReciboForm(f => ({ ...f, valor_bruto: bruto, taxa_adm_valor: adm, valor_liquido: bruto - adm }));
  }, [reciboForm.imovel_id, imoveis]);

  return (
    <div>
      <div style={S.subtabs}>
        {['recibos', 'reajuste', 'inadimplencia', 'manutencao'].map(t => (
          <button key={t} style={S.subtab(subtab === t)} onClick={() => setSubtab(t)}>
            {{ recibos: 'Recibos', reajuste: 'Reajuste', inadimplencia: 'Inadimplência', manutencao: 'Manutenção' }[t]}
          </button>
        ))}
      </div>

      {subtab === 'recibos' && (
        <div>
          <div style={S.card}>
            <div style={S.formSection}>Gerar Recibo</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={S.label}>Imóvel</label>
                <select style={S.select} value={reciboForm.imovel_id} onChange={e => setReciboForm(f => ({ ...f, imovel_id: e.target.value }))}>
                  <option value="">Selecionar</option>
                  {alugados.map(im => <option key={im.id} value={im.id}>{im.nome || im.logradouro}</option>)}
                </select>
              </div>
              <Field label="Mês Ref." value={reciboForm.mes_referencia} onChange={v => setReciboForm(f => ({ ...f, mes_referencia: v }))} placeholder="04/2026" />
              <Field label="Bruto" value={reciboForm.valor_bruto} onChange={v => setReciboForm(f => ({ ...f, valor_bruto: v }))} type="number" />
              <Field label="Taxa Adm" value={reciboForm.taxa_adm_valor} onChange={v => setReciboForm(f => ({ ...f, taxa_adm_valor: v }))} type="number" />
              <Field label="Líquido" value={reciboForm.valor_liquido} onChange={v => setReciboForm(f => ({ ...f, valor_liquido: v }))} type="number" />
              <div>
                <label style={S.label}>Status</label>
                <select style={S.select} value={reciboForm.status} onChange={e => setReciboForm(f => ({ ...f, status: e.target.value }))}>
                  {['Pendente', 'Pago', 'Atrasado'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <button style={S.btn('primary')} onClick={() => { onSaveRecibo(reciboForm); setReciboForm({ imovel_id: '', mes_referencia: '', valor_bruto: '', taxa_adm_valor: '', valor_liquido: '', status: 'Pendente', observacoes: '' }); }}>
              Gerar Recibo
            </button>
          </div>
          {/* Recibos history */}
          <div style={S.card}>
            <div style={S.formSection}>Histórico de Recibos ({recibos.length})</div>
            {recibos.length === 0 ? <div style={S.emptyState}>Nenhum recibo gerado</div> : (
              <table style={S.table}>
                <thead><tr>{['Imóvel', 'Mês', 'Bruto', 'Adm', 'Líquido', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {recibos.map(r => {
                    const im = imoveis.find(i => i.id === r.imovel_id);
                    return (
                      <tr key={r.id} className="table-row-hover">
                        <td style={S.td}>{im?.nome || im?.logradouro || '—'}</td>
                        <td style={S.td}>{r.mes_referencia}</td>
                        <td style={S.td}>{fmtR(r.valor_bruto)}</td>
                        <td style={S.td}>{fmtR(r.taxa_adm_valor)}</td>
                        <td style={{ ...S.td, fontWeight: 600 }}>{fmtR(r.valor_liquido)}</td>
                        <td style={S.td}><span style={S.badge(RECIBO_COLORS[r.status])}>{r.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {subtab === 'reajuste' && (
        <div>
          <div style={S.card}>
            <div style={S.formSection}>Simulador de Reajuste</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={S.label}>Imóvel</label>
                <select style={S.select} value={reajForm.imovel_id} onChange={e => setReajForm(f => ({ ...f, imovel_id: e.target.value }))}>
                  <option value="">Selecionar</option>
                  {alugados.map(im => <option key={im.id} value={im.id}>{im.nome || im.logradouro} — {fmtR(im.aluguel)}</option>)}
                </select>
              </div>
              <Field label="Índice" value={reajForm.indice} onChange={v => setReajForm(f => ({ ...f, indice: v }))} options={INDICES} />
              <Field label="Taxa %" value={reajForm.taxa} onChange={v => setReajForm(f => ({ ...f, taxa: v }))} type="number" suffix="%" />
            </div>
            {reajForm.imovel_id && (() => {
              const im = imoveis.find(i => i.id === reajForm.imovel_id);
              if (!im) return null;
              const novo = proxReajuste(im.aluguel, reajForm.indice, reajForm.taxa);
              return (
                <div style={{ display: 'flex', gap: 24, alignItems: 'center', padding: 20, background: 'var(--bg-surface)', borderRadius: 12, marginBottom: 16 }}>
                  <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>ATUAL</div><div style={{ fontSize: 20, fontWeight: 700 }}>{fmtR(im.aluguel)}</div></div>
                  <div style={{ fontSize: 20, color: 'var(--text-muted)' }}>→</div>
                  <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>NOVO ({reajForm.indice} +{reajForm.taxa}%)</div><div style={{ fontSize: 20, fontWeight: 700, color: '#34D399' }}>{fmtR(novo)}</div></div>
                  <div style={{ marginLeft: 'auto' }}>
                    <button style={S.btn('primary')} onClick={() => onUpdateImovel(im.id, { aluguel: novo })}>
                      Aplicar Reajuste
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
          {/* Agenda de reajustes */}
          <div style={S.card}>
            <div style={S.formSection}>Agenda de Reajustes</div>
            <table style={S.table}>
              <thead><tr>{['Imóvel', 'Aluguel Atual', 'Índice', 'Próx. Reajuste', 'Dias'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {alugados.sort((a, b) => (diasProxReajuste(a) || 999) - (diasProxReajuste(b) || 999)).map(im => {
                  const d = diasProxReajuste(im);
                  return (
                    <tr key={im.id} className="table-row-hover">
                      <td style={S.td}>{im.nome || im.logradouro}</td>
                      <td style={S.td}>{fmtR(im.aluguel)}</td>
                      <td style={S.td}>{im.indice_reajuste}</td>
                      <td style={S.td}>{fmtDate(im.data_proximo_reajuste)}</td>
                      <td style={{ ...S.td, color: d !== null && d <= 60 ? '#F87171' : 'var(--text-secondary)' }}>{d != null ? `${d}d` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subtab === 'inadimplencia' && (
        <div>
          <div style={S.card}>
            <div style={S.formSection}>Registrar Ocorrência</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={S.label}>Imóvel</label>
                <select style={S.select} value={ocorrForm.imovel_id} onChange={e => setOcorrForm(f => ({ ...f, imovel_id: e.target.value }))}>
                  <option value="">Selecionar</option>
                  {imoveis.map(im => <option key={im.id} value={im.id}>{im.nome || im.logradouro}</option>)}
                </select>
              </div>
              <Field label="Tipo" value={ocorrForm.tipo} onChange={v => setOcorrForm(f => ({ ...f, tipo: v }))} options={['Inadimplência', 'Dano', 'Reclamação', 'Jurídico', 'Outro']} />
              <Field label="Valor" value={ocorrForm.valor} onChange={v => setOcorrForm(f => ({ ...f, valor: v }))} type="number" />
              <Field label="Descrição" value={ocorrForm.descricao} onChange={v => setOcorrForm(f => ({ ...f, descricao: v }))} />
            </div>
            <button style={S.btn('primary')} onClick={() => { onSaveOcorrencia(ocorrForm); setOcorrForm({ imovel_id: '', tipo: 'Inadimplência', descricao: '', valor: '' }); }}>
              Registrar
            </button>
          </div>
          {/* Inadimplentes list */}
          <div style={S.card}>
            <div style={S.formSection}>Inadimplentes</div>
            {imoveis.filter(i => i.inadimplente).length === 0 ? (
              <div style={S.emptyState}>Nenhum inadimplente no momento</div>
            ) : (
              <table style={S.table}>
                <thead><tr>{['Imóvel', 'Inquilino', 'Aluguel', 'Ação'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {imoveis.filter(i => i.inadimplente).map(im => (
                    <tr key={im.id} className="table-row-hover">
                      <td style={S.td}>{im.nome || im.logradouro}</td>
                      <td style={S.td}>{im.inquilino || '—'}</td>
                      <td style={S.td}>{fmtR(im.aluguel)}</td>
                      <td style={S.td}>
                        <button style={{ ...S.btn('accent'), padding: '6px 16px', fontSize: 12 }} onClick={() => onUpdateImovel(im.id, { inadimplente: false })}>
                          {Icons.check} Regularizado
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {/* Ocorrencias history */}
          <div style={S.card}>
            <div style={S.formSection}>Histórico de Ocorrências ({ocorrencias.length})</div>
            {ocorrencias.length === 0 ? <div style={S.emptyState}>Nenhuma ocorrência registrada</div> : (
              <table style={S.table}>
                <thead><tr>{['Imóvel', 'Tipo', 'Descrição', 'Valor', 'Data'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {ocorrencias.map(o => {
                    const im = imoveis.find(i => i.id === o.imovel_id);
                    return (
                      <tr key={o.id} className="table-row-hover">
                        <td style={S.td}>{im?.nome || im?.logradouro || '—'}</td>
                        <td style={S.td}><span style={S.badge(o.tipo === 'Inadimplência' ? '#F87171' : '#FBBF24')}>{o.tipo}</span></td>
                        <td style={{ ...S.td, whiteSpace: 'normal', maxWidth: 300 }}>{o.descricao}</td>
                        <td style={S.td}>{fmtR(o.valor)}</td>
                        <td style={S.td}>{fmtDate(o.created_at?.split('T')[0])}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {subtab === 'manutencao' && (
        <div>
          <div style={S.card}>
            <div style={S.formSection}>Registrar Manutenção / CAPEX</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={S.label}>Imóvel</label>
                <select style={S.select} value={manutForm.imovel_id} onChange={e => setManutForm(f => ({ ...f, imovel_id: e.target.value }))}>
                  <option value="">Selecionar</option>
                  {imoveis.map(im => <option key={im.id} value={im.id}>{im.nome || im.logradouro}</option>)}
                </select>
              </div>
              <Field label="Categoria" value={manutForm.categoria} onChange={v => setManutForm(f => ({ ...f, categoria: v }))} options={MANUT_CATEGORIAS} />
              <Field label="Valor" value={manutForm.valor} onChange={v => setManutForm(f => ({ ...f, valor: v }))} type="number" />
              <Field label="Fornecedor" value={manutForm.fornecedor} onChange={v => setManutForm(f => ({ ...f, fornecedor: v }))} />
              <Field label="Descrição" value={manutForm.descricao} onChange={v => setManutForm(f => ({ ...f, descricao: v }))} />
            </div>
            <button style={S.btn('primary')} onClick={() => { onSaveManutencao(manutForm); setManutForm({ imovel_id: '', categoria: 'Corretiva', descricao: '', valor: '', fornecedor: '' }); }}>
              Registrar Manutenção
            </button>
          </div>
          <div style={S.card}>
            <div style={S.formSection}>Histórico de Manutenções ({manutencoes.length})</div>
            {manutencoes.length === 0 ? <div style={S.emptyState}>Nenhuma manutenção registrada</div> : (
              <table style={S.table}>
                <thead><tr>{['Imóvel', 'Categoria', 'Descrição', 'Valor', 'Fornecedor', 'Status', 'Data'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {manutencoes.map(m => {
                    const im = imoveis.find(i => i.id === m.imovel_id);
                    return (
                      <tr key={m.id} className="table-row-hover">
                        <td style={S.td}>{im?.nome || im?.logradouro || '—'}</td>
                        <td style={S.td}><span style={S.badge('#60A5FA')}>{m.categoria}</span></td>
                        <td style={{ ...S.td, whiteSpace: 'normal', maxWidth: 300 }}>{m.descricao}</td>
                        <td style={S.td}>{fmtR(m.valor)}</td>
                        <td style={S.td}>{m.fornecedor || '—'}</td>
                        <td style={S.td}><span style={S.badge(MANUT_COLORS[m.status])}>{m.status}</span></td>
                        <td style={S.td}>{fmtDate(m.data_execucao || m.created_at?.split('T')[0])}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB 4: MOTOR FINANCEIRO
// ============================================================
function MotorFinanceiroTab({ imoveis }) {
  const [subtab, setSubtab] = useState('noi');
  const [projecaoAnos, setProjecaoAnos] = useState(5);
  const [reajusteAnual, setReajusteAnual] = useState(5);

  return (
    <div>
      <div style={S.subtabs}>
        {['noi', 'fluxo', 'kpis'].map(t => (
          <button key={t} style={S.subtab(subtab === t)} onClick={() => setSubtab(t)}>
            {{ noi: 'NOI por Ativo', fluxo: 'Fluxo de Caixa', kpis: 'KPIs Portfólio' }[t]}
          </button>
        ))}
      </div>

      {subtab === 'noi' && (
        <div style={S.card}>
          <div style={S.formSection}>NOI Detalhado por Ativo</div>
          {imoveis.length === 0 ? <div style={S.emptyState}>Cadastre imóveis para ver o NOI</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Ativo', 'Aluguel Bruto', '(-) Vacância 5%', '(-) IPTU', '(-) Condo', '(-) Seguro', '(-) CAPEX', '(-) Adm', '(-) Manut 3%', '= NOI Mensal', '(-) Dívida', '= Cash Flow'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {imoveis.map(im => {
                    const alugAnual = (im.aluguel || 0) * 12;
                    const vac = alugAnual * 0.05;
                    const adm = (im.aluguel || 0) * (im.taxa_adm || 0) / 100 * 12;
                    const manut = alugAnual * 0.03;
                    const noi = alugAnual - vac - (im.iptu_anual || 0) - (im.condominio_mensal || 0) * 12 - (im.seguro_anual || 0) - (im.capex_pendente || 0) - adm - manut;
                    const divAnual = (im.parcela_mensal || 0) * 12;
                    const cf = noi - divAnual;
                    const dcr = divAnual > 0 ? noi / divAnual : null;
                    return (
                      <tr key={im.id} className="table-row-hover">
                        <td style={S.td}><span style={{ fontWeight: 600 }}>{im.nome || im.logradouro || '—'}</span></td>
                        <td style={S.td}>{fmtR(alugAnual)}</td>
                        <td style={{ ...S.td, color: '#F87171' }}>({fmtR(vac)})</td>
                        <td style={{ ...S.td, color: '#F87171' }}>({fmtR(im.iptu_anual)})</td>
                        <td style={{ ...S.td, color: '#F87171' }}>({fmtR((im.condominio_mensal || 0) * 12)})</td>
                        <td style={{ ...S.td, color: '#F87171' }}>({fmtR(im.seguro_anual)})</td>
                        <td style={{ ...S.td, color: '#F87171' }}>({fmtR(im.capex_pendente)})</td>
                        <td style={{ ...S.td, color: '#F87171' }}>({fmtR(adm)})</td>
                        <td style={{ ...S.td, color: '#F87171' }}>({fmtR(manut)})</td>
                        <td style={{ ...S.td, fontWeight: 700, color: noi >= 0 ? '#34D399' : '#F87171' }}>{fmtR(noi / 12)}/m</td>
                        <td style={{ ...S.td, color: '#F87171' }}>({fmtR(im.parcela_mensal)})/m</td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 700, color: cf >= 0 ? '#34D399' : '#F87171' }}>{fmtR(cf / 12)}/m</div>
                          {dcr !== null && <div style={{ fontSize: 10, color: dcr < 1.2 ? '#F87171' : 'var(--text-muted)', marginTop: 2 }}>DCR: {dcr.toFixed(2)}x {dcr < 1.2 ? '⚠️' : ''}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subtab === 'fluxo' && (
        <div style={S.card}>
          <div style={S.formSection}>Projeção de Fluxo de Caixa</div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <Field label="Horizonte (anos)" value={projecaoAnos} onChange={v => setProjecaoAnos(v)} type="number" style={{ width: 150 }} />
            <Field label="Reajuste anual %" value={reajusteAnual} onChange={v => setReajusteAnual(v)} type="number" suffix="%" style={{ width: 150 }} />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Ano</th>
                  <th style={S.th}>Receita Bruta</th>
                  <th style={S.th}>NOI</th>
                  <th style={S.th}>Serviço Dívida</th>
                  <th style={S.th}>Cash Flow Livre</th>
                  <th style={S.th}>Cash Flow Acum.</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: projecaoAnos }, (_, y) => {
                  const fator = Math.pow(1 + (reajusteAnual || 0) / 100, y);
                  const receita = imoveis.reduce((s, im) => s + (im.aluguel || 0) * 12 * fator, 0);
                  const noi = imoveis.reduce((s, im) => s + calcNOI({ ...im, aluguel: (im.aluguel || 0) * fator }), 0);
                  const div = imoveis.reduce((s, im) => s + (im.parcela_mensal || 0) * 12, 0);
                  const cf = noi - div;
                  const cfAcum = Array.from({ length: y + 1 }, (_, yy) => {
                    const f = Math.pow(1 + (reajusteAnual || 0) / 100, yy);
                    return imoveis.reduce((s, im) => s + calcNOI({ ...im, aluguel: (im.aluguel || 0) * f }), 0) - div;
                  }).reduce((s, v) => s + v, 0);
                  return (
                    <tr key={y} className="table-row-hover">
                      <td style={S.td}>Ano {y + 1}</td>
                      <td style={S.td}>{fmtR(receita)}</td>
                      <td style={{ ...S.td, color: '#34D399' }}>{fmtR(noi)}</td>
                      <td style={{ ...S.td, color: '#F87171' }}>({fmtR(div)})</td>
                      <td style={{ ...S.td, fontWeight: 700, color: cf >= 0 ? '#34D399' : '#F87171' }}>{fmtR(cf)}</td>
                      <td style={{ ...S.td, color: cfAcum >= 0 ? '#34D399' : '#F87171' }}>{fmtR(cfAcum)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subtab === 'kpis' && (
        <div>
          <div style={S.kpiGrid}>
            {(() => {
              const pat = imoveis.reduce((s, i) => s + (i.valor_mercado || i.custo_aquisicao || 0), 0);
              const custo = imoveis.reduce((s, i) => s + (i.custo_aquisicao || 0), 0);
              const divida = imoveis.reduce((s, i) => s + (i.divida || 0), 0);
              const noiTotal = imoveis.reduce((s, i) => s + calcNOI(i), 0);
              const equity = pat - divida;
              const ltvPort = pat > 0 ? (divida / pat) * 100 : 0;
              const roe = equity > 0 ? (noiTotal / equity) * 100 : 0;
              const capRate = pat > 0 ? (noiTotal / pat) * 100 : 0;
              const yieldOnCost = custo > 0 ? (noiTotal / custo) * 100 : 0;
              return [
                { label: 'Patrimônio Bruto', value: fmtR(pat) },
                { label: 'Equity (Pat - Dívida)', value: fmtR(equity), color: '#34D399' },
                { label: 'Dívida Total', value: fmtR(divida), color: '#F87171' },
                { label: 'LTV Portfólio', value: fmtPct(ltvPort), color: ltvPort > 70 ? '#F87171' : '#34D399' },
                { label: 'Cap Rate', value: fmtPct(capRate), color: '#60A5FA', accent: true },
                { label: 'Yield on Cost', value: fmtPct(yieldOnCost), color: '#A78BFA' },
                { label: 'ROE (NOI/Equity)', value: fmtPct(roe), color: '#34D399' },
                { label: 'NOI Total Anual', value: fmtR(noiTotal), color: '#34D399' },
              ].map(k => (
                <div key={k.label} style={S.kpiCard(k.accent)}>
                  <div style={S.kpiLabel}>{k.label}</div>
                  <div style={S.kpiValue(k.color)}>{k.value}</div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB 5: VALUATION
// ============================================================
function ValuationTab({ imoveis }) {
  const [subtab, setSubtab] = useState('banda');
  const [selectedId, setSelectedId] = useState('');
  const [capRate, setCapRate] = useState(7);
  const [inputs, setInputs] = useState({ liquidez: '', custoRepo: '', comparavel: '', estrategico: '' });

  const im = imoveis.find(i => i.id === selectedId);

  return (
    <div>
      <div style={S.subtabs}>
        {['banda', 'renda', 'comparaveis'].map(t => (
          <button key={t} style={S.subtab(subtab === t)} onClick={() => setSubtab(t)}>
            {{ banda: 'Banda de Valor', renda: 'Por Renda / Cap Rate', comparaveis: 'Comparáveis IA' }[t]}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={S.label}>Selecionar Ativo</label>
        <select style={{ ...S.select, maxWidth: 400 }} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          <option value="">Selecionar imóvel</option>
          {imoveis.map(im => <option key={im.id} value={im.id}>{im.nome || im.logradouro}</option>)}
        </select>
      </div>

      {!im ? (
        <div style={S.emptyState}>Selecione um imóvel para avaliação</div>
      ) : subtab === 'banda' ? (
        <div style={S.card}>
          <div style={S.formSection}>Banda de Valor — {im.nome || im.logradouro}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
            <Field label="Liquidez Forçada" value={inputs.liquidez || Math.round((im.valor_mercado || 0) * 0.7)} onChange={v => setInputs(f => ({ ...f, liquidez: v }))} type="number" />
            <Field label="Custo Reposição" value={inputs.custoRepo || Math.round((im.area_m2 || 0) * 8000)} onChange={v => setInputs(f => ({ ...f, custoRepo: v }))} type="number" />
            <div>
              <label style={S.label}>Por Renda (NOI/Cap)</label>
              <div style={{ ...S.input, background: 'var(--bg-elevated)', color: '#34D399', fontWeight: 700 }}>
                {fmtR(capRate > 0 ? calcNOI(im) / (capRate / 100) : 0)}
              </div>
            </div>
            <Field label="Comparável/Pedido" value={inputs.comparavel || im.valor_mercado} onChange={v => setInputs(f => ({ ...f, comparavel: v }))} type="number" />
            <Field label="Valor Estratégico" value={inputs.estrategico || Math.round((im.valor_mercado || 0) * 1.15)} onChange={v => setInputs(f => ({ ...f, estrategico: v }))} type="number" />
          </div>
          {(() => {
            const vals = [
              Number(inputs.liquidez) || (im.valor_mercado || 0) * 0.7,
              Number(inputs.custoRepo) || (im.area_m2 || 0) * 8000,
              capRate > 0 ? calcNOI(im) / (capRate / 100) : 0,
              Number(inputs.comparavel) || im.valor_mercado || 0,
              Number(inputs.estrategico) || (im.valor_mercado || 0) * 1.15,
            ].filter(v => v > 0);
            const media = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
            return (
              <div style={{ textAlign: 'center', padding: 32, background: 'linear-gradient(135deg, rgba(96,165,250,0.08) 0%, rgba(96,165,250,0.02) 100%)', borderRadius: 16, border: '1px solid rgba(96,165,250,0.2)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>Valor Médio Estimado</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#60A5FA', fontFamily: 'var(--font-serif)' }}>{fmtR(media)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Média de {vals.length} metodologias</div>
              </div>
            );
          })()}
        </div>
      ) : subtab === 'renda' ? (
        <div style={S.card}>
          <div style={S.formSection}>Valuation por Renda — {im.nome || im.logradouro}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            <Field label="Cap Rate %" value={capRate} onChange={v => setCapRate(v)} type="number" suffix="%" />
            <div>
              <label style={S.label}>NOI Anual</label>
              <div style={{ ...S.input, background: 'var(--bg-elevated)', fontWeight: 600 }}>{fmtR(calcNOI(im))}</div>
            </div>
          </div>
          {(() => {
            const noi = calcNOI(im);
            const valorRenda = capRate > 0 ? noi / (capRate / 100) : 0;
            const yieldOnCost = (im.custo_aquisicao || 0) > 0 ? (noi / im.custo_aquisicao) * 100 : 0;
            const valorCriado = valorRenda - (im.custo_aquisicao || 0);
            return (
              <div style={S.grid3}>
                <div style={{ ...S.kpiCard(true), textAlign: 'center' }}>
                  <div style={S.kpiLabel}>Valor por Renda</div>
                  <div style={S.kpiValue('#60A5FA')}>{fmtR(valorRenda)}</div>
                </div>
                <div style={{ ...S.kpiCard(), textAlign: 'center' }}>
                  <div style={S.kpiLabel}>Yield on Cost</div>
                  <div style={S.kpiValue('#A78BFA')}>{fmtPct(yieldOnCost)}</div>
                </div>
                <div style={{ ...S.kpiCard(), textAlign: 'center' }}>
                  <div style={S.kpiLabel}>Valor Criado</div>
                  <div style={S.kpiValue(valorCriado >= 0 ? '#34D399' : '#F87171')}>{fmtR(valorCriado)}</div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        <div style={S.card}>
          <div style={S.formSection}>Comparáveis via IA — {im.nome || im.logradouro}</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.7 }}>
            Análise de comparáveis de mercado seguindo a metodologia ABNT NBR 14653.
          </p>
          <button style={S.btn('primary')} onClick={() => {
            if (window.sendPrompt) window.sendPrompt(`Faça uma análise de comparáveis de mercado (ABNT NBR 14653) para: ${im.tipo} de ${im.area_m2 || '?'}m² em ${im.bairro || '?'}, ${im.cidade || '?'}/${im.uf || 'SP'}. Padrão: ${im.padrao}. Valor atual de mercado: ${fmtR(im.valor_mercado)}. Aluguel: ${fmtR(im.aluguel)}. Apresente: 1) Comparáveis encontrados (mínimo 3), 2) Ajustes (localização, padrão, área), 3) Valor unitário (R$/m²), 4) Faixa de valor, 5) Conclusão técnica.`);
          }}>
            {Icons.brain} Buscar Comparáveis IA
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB 6: DECISÃO — VENDER vs MANTER vs REFORMAR
// ============================================================
function DecisaoTab({ imoveis }) {
  const [selectedId, setSelectedId] = useState('');
  const [params, setParams] = useState({
    tma: 12, horizonte: 10, valorVenda: '', valorizacao: 3,
    custoReforma: '', incrementoAluguel: 30, igc: 15, custoTransacao: 5,
  });

  const im = imoveis.find(i => i.id === selectedId);

  function calcVPL(fluxos, tma) {
    return fluxos.reduce((s, cf, t) => s + cf / Math.pow(1 + tma / 100, t + 1), 0);
  }

  const cenarios = useMemo(() => {
    if (!im) return [];
    const noi = calcNOI(im);
    const vm = im.valor_mercado || im.custo_aquisicao || 0;
    const h = params.horizonte || 10;
    const tma = params.tma || 12;

    // 1. Manter
    const fluxosManter = Array.from({ length: h }, (_, y) => noi * Math.pow(1.05, y));
    const valorFinalManter = vm * Math.pow(1 + (params.valorizacao || 3) / 100, h);
    fluxosManter[h - 1] += valorFinalManter;
    const vplManter = calcVPL(fluxosManter, tma);

    // 2. Vender
    const venda = Number(params.valorVenda) || vm;
    const liquido = venda * (1 - (params.igc || 15) / 100) * (1 - (params.custoTransacao || 5) / 100);
    const vplVender = liquido; // NPV at t=0

    // 3. Reformar
    const custoRef = Number(params.custoReforma) || 0;
    const noiReformado = noi * (1 + (params.incrementoAluguel || 30) / 100);
    const fluxosReformar = [-custoRef, ...Array.from({ length: h - 1 }, (_, y) => noiReformado * Math.pow(1.05, y))];
    const vmReformado = vm * 1.2 * Math.pow(1 + (params.valorizacao || 3) / 100, h);
    fluxosReformar[fluxosReformar.length - 1] += vmReformado;
    const vplReformar = calcVPL(fluxosReformar, tma);

    return [
      { nome: 'Manter', vpl: vplManter, desc: `NOI crescendo 5% a.a. + venda em ${h} anos` },
      { nome: 'Vender Agora', vpl: vplVender, desc: `Venda líquida após IR (${params.igc}%) e custos (${params.custoTransacao}%)` },
      { nome: 'Reformar + Manter', vpl: vplReformar, desc: `Reforma de ${fmtR(custoRef)} → aluguel +${params.incrementoAluguel}%` },
    ].sort((a, b) => b.vpl - a.vpl);
  }, [im, params]);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <label style={S.label}>Selecionar Ativo</label>
        <select style={{ ...S.select, maxWidth: 400 }} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          <option value="">Selecionar imóvel</option>
          {imoveis.map(im => <option key={im.id} value={im.id}>{im.nome || im.logradouro}</option>)}
        </select>
      </div>

      {!im ? <div style={S.emptyState}>Selecione um imóvel para análise de decisão</div> : (
        <div>
          <div style={S.card}>
            <div style={S.formSection}>Parâmetros</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
              <Field label="TMA (taxa mínima) %" value={params.tma} onChange={v => setParams(p => ({ ...p, tma: v }))} type="number" suffix="%" />
              <Field label="Horizonte (anos)" value={params.horizonte} onChange={v => setParams(p => ({ ...p, horizonte: v }))} type="number" />
              <Field label="Valor de Venda" value={params.valorVenda || im.valor_mercado} onChange={v => setParams(p => ({ ...p, valorVenda: v }))} type="number" />
              <Field label="Valorização a.a. %" value={params.valorizacao} onChange={v => setParams(p => ({ ...p, valorizacao: v }))} type="number" suffix="%" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <Field label="Custo Reforma" value={params.custoReforma} onChange={v => setParams(p => ({ ...p, custoReforma: v }))} type="number" />
              <Field label="Incremento Aluguel %" value={params.incrementoAluguel} onChange={v => setParams(p => ({ ...p, incrementoAluguel: v }))} type="number" suffix="%" />
              <Field label="IR Ganho Capital %" value={params.igc} onChange={v => setParams(p => ({ ...p, igc: v }))} type="number" suffix="%" />
              <Field label="Custo Transação %" value={params.custoTransacao} onChange={v => setParams(p => ({ ...p, custoTransacao: v }))} type="number" suffix="%" />
            </div>
          </div>

          <div style={S.grid3}>
            {cenarios.map((c, i) => (
              <div key={c.nome} style={{
                ...S.card,
                border: i === 0 ? '2px solid var(--blue)' : '1px solid var(--border)',
                position: 'relative',
              }}>
                {i === 0 && <div style={{ position: 'absolute', top: -1, left: 20, right: 20, height: 3, background: 'linear-gradient(90deg, var(--blue), #93C5FD)', borderRadius: '0 0 3px 3px' }} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-serif)' }}>{c.nome}</span>
                  {i === 0 && <span style={S.badge('#34D399')}>Recomendado</span>}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: c.vpl >= 0 ? '#34D399' : '#F87171', marginBottom: 12, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtR(c.vpl)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>VPL (TMA {params.tma}%)</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{c.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button style={S.btn('primary')} onClick={() => {
              if (window.sendPrompt) window.sendPrompt(`Análise estratégica para o imóvel "${im.nome || im.logradouro}" em ${im.cidade}/${im.uf}:
- Tipo: ${im.tipo}, Área: ${im.area_m2}m², Padrão: ${im.padrao}
- Valor Mercado: ${fmtR(im.valor_mercado)}, Custo: ${fmtR(im.custo_aquisicao)}, Dívida: ${fmtR(im.divida)}
- Aluguel: ${fmtR(im.aluguel)}, NOI: ${fmtR(calcNOI(im))}, Yield: ${fmtPct(calcYield(im))}
- Cenários VPL (TMA ${params.tma}%): ${cenarios.map(c => `${c.nome}: ${fmtR(c.vpl)}`).join(', ')}
Recomende a melhor decisão considerando cenário macro, mercado imobiliário local, oportunidade de reforma e timing de venda.`);
            }}>
              {Icons.brain} Análise Estratégica no Chat ↗
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB 7: MERCADO IA
// ============================================================
function MercadoIATab({ imoveis }) {
  const [subtab, setSubtab] = useState('cotacao');
  const [selectedId, setSelectedId] = useState('');
  const im = imoveis.find(i => i.id === selectedId);

  return (
    <div>
      <div style={S.subtabs}>
        {['cotacao', 'estudo', 'holding'].map(t => (
          <button key={t} style={S.subtab(subtab === t)} onClick={() => setSubtab(t)}>
            {{ cotacao: 'Cotação de Aluguel', estudo: 'Estudo de Região', holding: 'Holding & Tributação' }[t]}
          </button>
        ))}
      </div>

      {(subtab === 'cotacao' || subtab === 'estudo') && (
        <div style={{ marginBottom: 20 }}>
          <label style={S.label}>Selecionar Ativo (opcional)</label>
          <select style={{ ...S.select, maxWidth: 400 }} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">Usar dados gerais</option>
            {imoveis.map(im => <option key={im.id} value={im.id}>{im.nome || im.logradouro} — {im.cidade}/{im.uf}</option>)}
          </select>
        </div>
      )}

      {subtab === 'cotacao' && (
        <div style={S.card}>
          <div style={S.formSection}>Cotação de Aluguel de Mercado</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.7 }}>
            Análise de aluguel por tipologia, R$/m², yield esperado e tendência 12 meses para a região.
          </p>
          <button style={S.btn('primary')} onClick={() => {
            const loc = im ? `${im.bairro || ''}, ${im.cidade || ''}/${im.uf || 'SP'}` : 'São Paulo/SP';
            const tipo = im ? im.tipo : 'Apartamento';
            if (window.sendPrompt) window.sendPrompt(`Pesquise cotações de aluguel de mercado para a região de ${loc}. Tipologia: ${tipo}. ${im ? `Área: ${im.area_m2}m². Padrão: ${im.padrao}.` : ''} Apresente em tabela: Tipologia | Faixa de Aluguel | R$/m² | Yield esperado | Tendência 12m. Compare com o aluguel atual ${im ? fmtR(im.aluguel) : 'do mercado'} e indique se está acima/abaixo do mercado.`);
          }}>
            {Icons.brain} Buscar Cotações IA
          </button>
        </div>
      )}

      {subtab === 'estudo' && (
        <div style={S.card}>
          <div style={S.formSection}>Estudo de Região (nível JLL/CBRE)</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.7 }}>
            Análise institucional completa: tese de investimento, indicadores socioeconômicos, infraestrutura, riscos e recomendação.
          </p>
          <button style={S.btn('primary')} onClick={() => {
            const loc = im ? `${im.bairro || ''}, ${im.cidade || ''}/${im.uf || 'SP'}` : 'São Paulo/SP';
            if (window.sendPrompt) window.sendPrompt(`Elabore um estudo de região nível JLL/CBRE para ${loc}. Inclua: 1) Tese de investimento (bull/bear case), 2) Indicadores socioeconômicos (renda média, crescimento populacional, IDH), 3) Infraestrutura e mobilidade, 4) Estoque e absorção do mercado imobiliário, 5) Pipeline de novos empreendimentos, 6) Oportunidades e riscos, 7) Recomendação final com score de atratividade (1-10).`);
          }}>
            {Icons.brain} Gerar Estudo de Região
          </button>
        </div>
      )}

      {subtab === 'holding' && (
        <div style={S.card}>
          <div style={S.formSection}>Holding & Análise Tributária</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.7 }}>
            Compare IRPF pessoa física vs lucro presumido PJ. Análise de ITCMD, blindagem patrimonial, payback fiscal e próximos passos.
          </p>
          {(() => {
            const totalPat = imoveis.reduce((s, i) => s + (i.valor_mercado || i.custo_aquisicao || 0), 0);
            const totalAluguel = imoveis.reduce((s, i) => s + (i.aluguel || 0), 0);
            const pf = imoveis.filter(i => i.titular === 'PF').length;
            const pj = imoveis.filter(i => i.titular !== 'PF').length;
            return (
              <div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                  <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '16px 24px', flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PATRIMÔNIO TOTAL</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtR(totalPat)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '16px 24px', flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>RECEITA MENSAL</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtR(totalAluguel)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '16px 24px', flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PF / PJ</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{pf} / {pj}</div>
                  </div>
                </div>
                <button style={S.btn('primary')} onClick={() => {
                  if (window.sendPrompt) window.sendPrompt(`Análise tributária completa do portfólio imobiliário:
- ${imoveis.length} imóveis, patrimônio total ${fmtR(totalPat)}
- Receita mensal de aluguéis: ${fmtR(totalAluguel)} (${fmtR(totalAluguel * 12)}/ano)
- ${pf} imóveis em PF, ${pj} em estrutura PJ
- Imóveis PF: ${imoveis.filter(i => i.titular === 'PF').map(i => `${i.nome || i.logradouro}: ${fmtR(i.aluguel)}/mês`).join('; ')}

Compare: 1) IRPF sobre aluguéis (tabela progressiva), 2) Lucro Presumido PJ (32% presunção, ~11.33% carga), 3) ITCMD na sucessão (4-8% conforme UF), 4) Blindagem patrimonial, 5) Custo de manutenção da holding (contabilidade, CNPJ), 6) Payback fiscal (quando a economia cobre o custo), 7) Próximos passos recomendados.`);
                }}>
                  {Icons.brain} Análise Holding & Tributação IA
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================
export default function RealEstatePage() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [imoveis, setImoveis] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [manutencoes, setManutencoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [profileName, setProfileName] = useState('');

  // Auth
  useEffect(() => {
    if (!supabase) { setAuthChecked(true); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase.from('profiles').select('role, name').eq('id', user.id).single().then(({ data }) => {
      setIsAdmin(data?.role === 'admin');
      setProfileName(data?.name || user.email?.split('@')[0] || 'User');
    });
  }, [user]);

  useEffect(() => {
    if (!supabase || !user || !isAdmin) return;
    supabase.from('profiles').select('*').eq('role', 'client').order('name').then(({ data }) => setClients(data || []));
  }, [user, isAdmin]);

  // Load data
  const loadData = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    let q = supabase.from('imoveis').select('*').order('created_at', { ascending: false });
    let qR = supabase.from('imoveis_recibos').select('*').order('created_at', { ascending: false });
    let qO = supabase.from('imoveis_ocorrencias').select('*').order('created_at', { ascending: false });
    let qM = supabase.from('imoveis_manutencoes').select('*').order('created_at', { ascending: false });
    if (isAdmin && selectedClient) {
      q = q.eq('user_id', selectedClient);
      qR = qR.eq('user_id', selectedClient);
      qO = qO.eq('user_id', selectedClient);
      qM = qM.eq('user_id', selectedClient);
    }
    const [{ data: i }, { data: r }, { data: o }, { data: m }] = await Promise.all([q, qR, qO, qM]);
    setImoveis(i || []);
    setRecibos(r || []);
    setOcorrencias(o || []);
    setManutencoes(m || []);
    setLoading(false);
  }, [user, isAdmin, selectedClient]);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  // CRUD operations
  async function saveImovel(data) {
    const { error } = await supabase.from('imoveis').insert(data).select();
    if (error) { alert('Erro: ' + error.message); return; }
    await loadData();
  }
  async function editImovel(id, data) {
    const { user_id, id: _, created_at, ...clean } = data;
    const { error } = await supabase.from('imoveis').update(clean).eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    await loadData();
  }
  async function deleteImovel(id) {
    if (!confirm('Excluir este imóvel?')) return;
    await supabase.from('imoveis').delete().eq('id', id);
    await loadData();
  }
  async function updateImovel(id, data) {
    await supabase.from('imoveis').update(data).eq('id', id);
    await loadData();
  }
  async function saveRecibo(data) {
    if (!data.imovel_id) { alert('Selecione um imóvel'); return; }
    await supabase.from('imoveis_recibos').insert({ ...data, user_id: user.id, valor_bruto: Number(data.valor_bruto) || 0, taxa_adm_valor: Number(data.taxa_adm_valor) || 0, valor_liquido: Number(data.valor_liquido) || 0 });
    await loadData();
  }
  async function saveOcorrencia(data) {
    if (!data.imovel_id) { alert('Selecione um imóvel'); return; }
    await supabase.from('imoveis_ocorrencias').insert({ ...data, user_id: user.id, valor: Number(data.valor) || 0 });
    await loadData();
  }
  async function saveManutencao(data) {
    if (!data.imovel_id) { alert('Selecione um imóvel'); return; }
    await supabase.from('imoveis_manutencoes').insert({ ...data, user_id: user.id, valor: Number(data.valor) || 0 });
    await loadData();
  }

  if (!authChecked) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>Carregando...</div>;
  if (!user) {
    // Redirect to main page for login
    if (typeof window !== 'undefined') window.location.href = '/';
    return null;
  }

  const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.dashboard },
    { id: 'cadastro', label: 'Cadastro', icon: Icons.building },
    { id: 'operacional', label: 'Operacional', icon: Icons.wrench },
    { id: 'motor', label: 'Motor Financeiro', icon: Icons.calculator },
    { id: 'valuation', label: 'Valuation', icon: Icons.chart },
    { id: 'decisao', label: 'Decisão', icon: Icons.target },
    { id: 'mercado', label: 'Mercado IA', icon: Icons.brain },
  ];

  return (
    <div style={S.app}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.sidebarLogo}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={S.logoIcon}>W</div>
            <div>
              <div style={S.logoText}>WealthOffice</div>
              <div style={S.logoSub}>Real Estate</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 14px 8px' }}>
          <a href="/" style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
            borderRadius: 10, color: 'var(--text-muted)', fontSize: 12, fontWeight: 500,
            textDecoration: 'none', transition: 'all var(--transition)',
            border: '1px solid var(--border)', background: 'transparent',
          }}>
            {Icons.back} Voltar ao Escritório
          </a>
        </div>

        {/* Admin client selector */}
        {isAdmin && clients.length > 0 && (
          <div style={{ padding: '12px 18px' }}>
            <label style={{ ...S.label, fontSize: 9 }}>Clientes</label>
            <select
              style={{ ...S.select, fontSize: 12, padding: '8px 12px' }}
              value={selectedClient || ''}
              onChange={e => setSelectedClient(e.target.value || null)}
            >
              <option value="">Todos os Clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.email}</option>)}
            </select>
          </div>
        )}

        <nav style={S.nav}>
          {TABS.map(t => (
            <button key={t.id} style={S.navItem(tab === t.id)} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        <div style={S.sidebarFooter}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{profileName}</div>
            {isAdmin && <div style={{ fontSize: 9, color: 'var(--blue)', fontWeight: 700, letterSpacing: '1px' }}>ADMIN</div>}
          </div>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }}>
            {Icons.logout}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={S.main}>
        <div style={S.header}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 8 }}>
              Gestão Imobiliária
            </div>
            <h1 style={S.pageTitle}>{TABS.find(t => t.id === tab)?.label}</h1>
            <p style={S.pageSub}>{new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '12px 20px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Imóveis</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>{imoveis.length}</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>Carregando dados...</div>
        ) : (
          <>
            {tab === 'dashboard' && <DashboardTab imoveis={imoveis} />}
            {tab === 'cadastro' && <CadastroTab imoveis={imoveis} onSave={saveImovel} onEdit={editImovel} onDelete={deleteImovel} user={user} />}
            {tab === 'operacional' && <OperacionalTab imoveis={imoveis} recibos={recibos} ocorrencias={ocorrencias} manutencoes={manutencoes} onSaveRecibo={saveRecibo} onSaveOcorrencia={saveOcorrencia} onSaveManutencao={saveManutencao} onUpdateImovel={updateImovel} />}
            {tab === 'motor' && <MotorFinanceiroTab imoveis={imoveis} />}
            {tab === 'valuation' && <ValuationTab imoveis={imoveis} />}
            {tab === 'decisao' && <DecisaoTab imoveis={imoveis} />}
            {tab === 'mercado' && <MercadoIATab imoveis={imoveis} />}
          </>
        )}
      </main>
    </div>
  );
}
