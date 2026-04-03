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
const ESTAGIOS = ['Pronto', 'Em Construção', 'Na Planta', 'Em Reforma'];
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
  contract: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h6"/></svg>,
  debt: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/><path d="M6 16h4M14 16h4"/></svg>,
  shield: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>,
  capex: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  pipeline: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>,
  report: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>,
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
  tipo: 'Apartamento', uso: 'Residencial', estagio: 'Pronto', area_m2: '', quartos: '', padrao: 'Médio', nome: '',
  titular: 'PF', titular_nome: '', cnpj: '', custo_aquisicao: '', data_aquisicao: '', valor_mercado: '', divida: '', parcela_mensal: '',
  status: 'Vago', inquilino: '', inquilino_contato: '', aluguel: '', contrato_inicio: '', contrato_fim: '',
  indice_reajuste: 'IGPM', data_proximo_reajuste: '', garantia: '', imobiliaria: '', taxa_adm: '', inadimplente: false,
  iptu_anual: '', condominio_mensal: '', seguro_anual: '', capex_pendente: '', observacoes: '',
  data_entrega: '', pct_obra: '', valor_contrato: '', entrada_paga: '', parcela_obra: '', indice_correcao: 'INCC-DI', construtora: '',
  banco_financiamento: '', taxa_financiamento: '', prazo_financiamento: '', sistema_amortizacao: 'SAC', valor_financiado: '',
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
function DashboardTab({ imoveis, autoEstimating }) {
  const totais = useMemo(() => {
    const data = imoveis;
    const alugados = data.filter(i => i.status === 'Alugado');
    const receitaMensal = alugados.reduce((s, i) => s + (i.aluguel || 0), 0);
    const noiAnual = data.reduce((s, i) => s + calcNOI(i), 0);
    const patrimonio = data.reduce((s, i) => s + (i.valor_mercado || i.custo_aquisicao || 0), 0);
    const yieldPort = patrimonio > 0 ? (noiAnual / patrimonio) * 100 : 0;
    const vagos = data.filter(i => i.status === 'Vago').length;
    const vacancia = data.length > 0 ? (vagos / data.length) * 100 : 0;
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
          { label: 'Patrimônio', value: fmtR(totais.patrimonio), sub: autoEstimating > 0 ? `Avaliando ${autoEstimating} imóveis...` : null },
          { label: 'Yield Portfólio', value: fmtPct(totais.yieldPort), color: totais.yieldPort >= 6 ? '#34D399' : '#FBBF24' },
          { label: 'Vacância', value: fmtPct(totais.vacancia), color: totais.vacancia > 10 ? '#F87171' : '#34D399' },
        ].map(k => (
          <div key={k.label} style={S.kpiCard(k.accent)}>
            <div style={S.kpiLabel}>{Icons.dollar} {k.label}</div>
            <div style={S.kpiValue(k.color)}>{k.value}</div>
            {k.sub && <div style={S.kpiSub}>{k.sub}</div>}
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

      {/* Advanced KPIs */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
        {(() => {
          const data = imoveis;
          const aluguelAnualTotal = data.reduce((s, i) => s + (i.status === 'Alugado' ? (Number(i.aluguel) || 0) * 12 : 0), 0);
          const custoTotal = data.reduce((s, i) => s + (Number(i.custo_aquisicao) || 0), 0);
          const dividaTotal = data.reduce((s, i) => s + (Number(i.divida) || 0), 0);
          const equityInvestido = custoTotal - dividaTotal;
          const noiAnual = data.reduce((s, i) => s + calcNOI(i), 0);
          const coc = equityInvestido > 0 ? (aluguelAnualTotal / equityInvestido) * 100 : 0;
          const payback = noiAnual > 0 ? equityInvestido / noiAnual : 0;
          const patrimonio = data.reduce((s, i) => s + (Number(i.valor_mercado) || Number(i.custo_aquisicao) || 0), 0);
          const valorizacao = custoTotal > 0 ? ((patrimonio - custoTotal) / custoTotal) * 100 : 0;
          const emConstrucao = data.filter(i => i.estagio === 'Em Construção' || i.estagio === 'Na Planta').length;
          return [
            { label: 'Cash-on-Cash', value: fmtPct(coc), color: coc >= 8 ? '#34D399' : '#FBBF24' },
            { label: 'Payback', value: payback > 0 ? payback.toFixed(1) + ' anos' : '—', color: payback <= 10 ? '#34D399' : '#F87171' },
            { label: 'Valorização', value: fmtPct(valorizacao), color: valorizacao >= 0 ? '#34D399' : '#F87171' },
            { label: 'Em Construção', value: emConstrucao, color: emConstrucao > 0 ? '#60A5FA' : 'var(--text-primary)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 24px', flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
            </div>
          ));
        })()}
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
                  {['Ativo', 'Tipo', 'Valor Mercado', 'Aluguel', 'Yield', 'LTV', 'Status', 'Alertas'].map(h => (
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
                  const isEstimating = !im.valor_mercado && autoEstimating > 0;
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
                      <td style={S.td}>
                        {isEstimating ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>⏳ Estimando...</span>
                        ) : (
                          <div>
                            <span style={{ fontWeight: 600 }}>{fmtR(im.valor_mercado)}</span>
                            {im._estimated && <span style={{ ...S.badge('#60A5FA'), marginLeft: 6, fontSize: 9, padding: '2px 6px' }}>IA</span>}
                          </div>
                        )}
                      </td>
                      <td style={S.td}>{fmtR(im.aluguel)}</td>
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
  const [estimating, setEstimating] = useState(false);
  const [estimateData, setEstimateData] = useState(null);

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
    const data = {};
    // Only include non-empty fields
    Object.entries(form).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined) return;
      data[k] = v;
    });
    // Convert numeric fields (set 0 if empty)
    ['area_m2', 'quartos', 'custo_aquisicao', 'valor_mercado', 'divida', 'parcela_mensal', 'aluguel', 'taxa_adm', 'iptu_anual', 'condominio_mensal', 'seguro_anual', 'capex_pendente', 'pct_obra', 'valor_contrato', 'entrada_paga', 'parcela_obra', 'valor_financiado', 'taxa_financiamento', 'prazo_financiamento'].forEach(k => {
      data[k] = data[k] == null || data[k] === '' ? 0 : Number(data[k]);
    });
    // Ensure required defaults
    data.user_id = user.id;
    data.tipo = data.tipo || 'Apartamento';
    data.uso = data.uso || 'Residencial';
    data.status = data.status || 'Vago';
    data.titular = data.titular || 'PF';
    data.uf = data.uf || 'SP';
    data.inadimplente = data.inadimplente || false;
    // Date fields — convert empty to null
    ['data_aquisicao', 'contrato_inicio', 'contrato_fim', 'data_proximo_reajuste', 'data_entrega'].forEach(k => {
      if (!data[k]) data[k] = null;
    });
    try {
      if (editingId) {
        await onEdit(editingId, data);
      } else {
        await onSave(data);
      }
      setForm({ ...EMPTY_IMOVEL });
      setEditingId(null);
      setSubtab('todos');
    } catch (err) {
      alert('Erro ao salvar: ' + (err.message || err));
    }
    setSaving(false);
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

          {/* Auto-estimate from market data */}
          {cepStatus === 'ok' && form.bairro && form.cidade && (
            <div style={{ marginBottom: 28, padding: 24, background: 'linear-gradient(135deg, rgba(96,165,250,0.06) 0%, rgba(96,165,250,0.02) 100%)', borderRadius: 16, border: '1px solid rgba(96,165,250,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: estimateData ? 20 : 0 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-serif)', marginBottom: 4 }}>Avaliação de Mercado (ABNT NBR 14653-2)</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Método comparativo direto · ZAP, Viva Real, ImovelWeb, QuintoAndar, Loft, Lopes — {form.bairro}, {form.cidade}/{form.uf}
                  </div>
                </div>
                <button
                  style={{ ...S.btn('primary'), opacity: estimating ? 0.6 : 1 }}
                  disabled={estimating}
                  onClick={async () => {
                    setEstimating(true);
                    setEstimateData(null);
                    try {
                      const res = await fetch('/api/real-estate-estimate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          logradouro: form.logradouro, numero: form.numero,
                          bairro: form.bairro, cidade: form.cidade, uf: form.uf,
                          tipo: form.tipo, uso: form.uso, area_m2: Number(form.area_m2) || 70, padrao: form.padrao,
                        }),
                      });
                      const data = await res.json();
                      if (!data.error) {
                        setEstimateData(data);
                        setForm(f => ({
                          ...f,
                          valor_mercado: f.valor_mercado || data.valor_mercado || f.valor_mercado,
                          aluguel: f.aluguel || data.aluguel_estimado || f.aluguel,
                          iptu_anual: f.iptu_anual || data.iptu_estimado_anual || f.iptu_anual,
                          condominio_mensal: f.condominio_mensal || data.condominio_estimado || f.condominio_mensal,
                        }));
                      } else {
                        alert('Erro: ' + (data.error || 'tente novamente'));
                      }
                    } catch (err) { alert('Erro: ' + err.message); }
                    setEstimating(false);
                  }}
                >
                  {estimating ? '⏳ Avaliando...' : '🔍 Avaliar Valor de Mercado'}
                </button>
              </div>
              {estimateData && (
                <div>
                  {/* Main value */}
                  <div style={{ textAlign: 'center', padding: 20, background: 'var(--bg-card)', borderRadius: 14, border: '1px solid rgba(96,165,250,0.2)', marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 6 }}>Valor de Mercado Estimado</div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: '#60A5FA', fontFamily: 'var(--font-serif)' }}>{fmtR(estimateData.valor_mercado)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                      {fmtR(estimateData.preco_m2_venda_medio)}/m² · {estimateData.area_referencia}m²
                      {estimateData.predio && <span> · {estimateData.predio}</span>}
                    </div>
                  </div>
                  {/* R$/m² range */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>R$/m² Mínimo</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#34D399' }}>{fmtR(estimateData.preco_m2_venda_min)}</div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(96,165,250,0.3)', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>R$/m² Médio</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#60A5FA' }}>{fmtR(estimateData.preco_m2_venda_medio)}</div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>R$/m² Máximo</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#F87171' }}>{fmtR(estimateData.preco_m2_venda_max)}</div>
                    </div>
                  </div>
                  {/* Other estimates */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                    {[
                      { label: 'Aluguel Estimado', value: fmtR(estimateData.aluguel_estimado) + '/mês', color: '#FBBF24' },
                      { label: 'IPTU Anual', value: fmtR(estimateData.iptu_estimado_anual) },
                      { label: 'Condomínio', value: fmtR(estimateData.condominio_estimado) + '/mês' },
                      { label: 'Yield', value: fmtPct(estimateData.yield_regiao), color: '#A78BFA' },
                    ].map(k => (
                      <div key={k.label} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: k.color || 'var(--text-primary)' }}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Metadata + confidence */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 10, marginBottom: 12 }}>
                    <div>
                      <b>{estimateData.amostras_venda || '?'}</b> comparáveis
                      {estimateData.outliers_removidos > 0 && <span> ({estimateData.outliers_removidos} outliers removidos)</span>}
                      {estimateData.metodo && <span> · {estimateData.metodo}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {estimateData.confianca_score != null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 60, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.round((estimateData.confianca_score || 0) * 100)}%`, height: '100%', borderRadius: 3, background: estimateData.confianca === 'alta' ? '#34D399' : estimateData.confianca === 'media' ? '#FBBF24' : '#F87171' }} />
                          </div>
                          <span style={{ fontSize: 10 }}>{Math.round((estimateData.confianca_score || 0) * 100)}%</span>
                        </div>
                      )}
                      <span style={{ color: estimateData.confianca === 'alta' ? '#34D399' : estimateData.confianca === 'media' ? '#FBBF24' : '#F87171', fontWeight: 600 }}>
                        {estimateData.confianca === 'alta' ? '● Alta' : estimateData.confianca === 'media' ? '● Média' : '● Baixa'}
                      </span>
                    </div>
                  </div>
                  {/* Comparáveis encontrados */}
                  {estimateData.comparaveis && estimateData.comparaveis.length > 0 && (
                    <details style={{ marginBottom: 12 }}>
                      <summary style={{ fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, marginBottom: 8 }}>
                        Ver {estimateData.comparaveis.length} comparáveis utilizados
                      </summary>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                        {estimateData.comparaveis.map((c, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                              <span style={{ fontWeight: 600 }}>{fmtR(c.preco)}</span>
                              <span style={{ color: 'var(--text-muted)' }}>{c.area_m2}m²</span>
                              <span style={{ color: '#60A5FA', fontWeight: 600 }}>{fmtR(c.preco_m2)}/m²</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {c.bairro && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{c.bairro}</span>}
                              {c.url && c.url.startsWith('http') && (
                                <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 11 }}>Ver anúncio</a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  {/* Empreendimento info */}
                  {estimateData.empreendimento && estimateData.empreendimento.nome && (
                    <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)', marginBottom: 12 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Empreendimento Identificado</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{estimateData.empreendimento.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {[
                          estimateData.empreendimento.construtora && `Construtora: ${estimateData.empreendimento.construtora}`,
                          estimateData.empreendimento.ano_construcao && `Ano: ${estimateData.empreendimento.ano_construcao}`,
                          estimateData.empreendimento.andares && `${estimateData.empreendimento.andares} andares`,
                          estimateData.empreendimento.vagas && `${estimateData.empreendimento.vagas} vagas`,
                        ].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  )}
                  {/* Analysis row: location + trend + FipeZap */}
                  {(estimateData.analise_localizacao || estimateData.tendencia || estimateData.fipezap_delta_pct != null) && (
                    <div style={{ display: 'grid', gridTemplateColumns: estimateData.analise_localizacao ? '2fr 1fr' : '1fr', gap: 12, marginBottom: 12 }}>
                      {estimateData.analise_localizacao && (
                        <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Análise da Microrregião</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{estimateData.analise_localizacao}</div>
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {estimateData.tendencia && (
                          <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)', flex: 1 }}>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Tendência</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: estimateData.tendencia === 'alta' ? '#34D399' : estimateData.tendencia === 'baixa' ? '#F87171' : '#FBBF24' }}>
                              {estimateData.tendencia === 'alta' ? 'Alta' : estimateData.tendencia === 'baixa' ? 'Baixa' : 'Estável'}
                            </div>
                          </div>
                        )}
                        {estimateData.fipezap_delta_pct != null && (
                          <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)', flex: 1 }}>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>vs FipeZap</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: Math.abs(estimateData.fipezap_delta_pct) < 10 ? '#34D399' : '#FBBF24' }}>
                              {estimateData.fipezap_delta_pct > 0 ? '+' : ''}{estimateData.fipezap_delta_pct}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Characteristics */}
          <div style={S.formSection}>Características</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
            <Field label="Nome / Apelido" value={form.nome} onChange={v => upd('nome', v)} placeholder="Ex: Apto Faria Lima" />
            <Field label="Tipo" value={form.tipo} onChange={v => upd('tipo', v)} options={TIPOS} />
            <Field label="Uso" value={form.uso} onChange={v => upd('uso', v)} options={USOS} />
            <Field label="Estágio" value={form.estagio} onChange={v => upd('estagio', v)} options={ESTAGIOS} />
            <Field label="Área m²" value={form.area_m2} onChange={v => upd('area_m2', v)} type="number" />
            <Field label="Quartos" value={form.quartos} onChange={v => upd('quartos', v)} type="number" />
            <Field label="Padrão" value={form.padrao} onChange={v => upd('padrao', v)} options={PADROES} />
          </div>

          {/* Construction (conditional) */}
          {(form.estagio === 'Em Construção' || form.estagio === 'Na Planta') && (
            <>
              <div style={S.formSection}>Dados da Construção</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                <Field label="Construtora" value={form.construtora} onChange={v => upd('construtora', v)} />
                <Field label="Data Prevista Entrega" value={form.data_entrega} onChange={v => upd('data_entrega', v)} type="date" />
                <Field label="% Obra Concluído" value={form.pct_obra} onChange={v => upd('pct_obra', v)} type="number" placeholder="0-100" />
                <Field label="Valor do Contrato" value={form.valor_contrato} onChange={v => upd('valor_contrato', v)} type="number" placeholder="R$" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
                <Field label="Entrada Paga" value={form.entrada_paga} onChange={v => upd('entrada_paga', v)} type="number" placeholder="R$" />
                <Field label="Parcela Mensal Obra" value={form.parcela_obra} onChange={v => upd('parcela_obra', v)} type="number" placeholder="R$" />
                <Field label="Índice Correção" value={form.indice_correcao} onChange={v => upd('indice_correcao', v)} options={['INCC-DI', 'INCC-M', 'IPCA']} />
              </div>
            </>
          )}

          {/* Financing (conditional) */}
          {(Number(form.divida) > 0 || Number(form.valor_financiado) > 0) && (
            <>
              <div style={S.formSection}>Financiamento</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
                <Field label="Banco" value={form.banco_financiamento} onChange={v => upd('banco_financiamento', v)} />
                <Field label="Valor Financiado" value={form.valor_financiado} onChange={v => upd('valor_financiado', v)} type="number" placeholder="R$" />
                <Field label="Taxa a.a. %" value={form.taxa_financiamento} onChange={v => upd('taxa_financiamento', v)} type="number" suffix="%" />
                <Field label="Prazo (meses)" value={form.prazo_financiamento} onChange={v => upd('prazo_financiamento', v)} type="number" />
                <Field label="Sistema" value={form.sistema_amortizacao} onChange={v => upd('sistema_amortizacao', v)} options={['SAC', 'Price', 'Misto']} />
              </div>
            </>
          )}

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
// TAB 8: LEASE MANAGEMENT (Contratos)
// ============================================================
function LeaseManagementTab({ imoveis }) {
  const [subtab, setSubtab] = useState('vencimentos');

  const alugados = useMemo(() => imoveis.filter(i => i.status === 'Alugado' || i.contrato_fim), [imoveis]);
  const sorted = useMemo(() => [...alugados].sort((a, b) => {
    if (!a.contrato_fim) return 1;
    if (!b.contrato_fim) return -1;
    return new Date(a.contrato_fim) - new Date(b.contrato_fim);
  }), [alugados]);

  function contratoCor(im) {
    const d = diasFimContrato(im);
    if (d === null) return 'var(--text-muted)';
    if (d <= 0) return '#F87171';
    if (d <= 90) return '#F87171';
    if (d <= 180) return '#FBBF24';
    return '#34D399';
  }
  function contratoLabel(im) {
    const d = diasFimContrato(im);
    if (d === null) return 'Sem contrato';
    if (d <= 0) return `Vencido há ${Math.abs(d)}d`;
    return `${d}d restantes`;
  }
  function tenantGrade(im) {
    if (im.inadimplente) return { grade: 'C', color: '#F87171' };
    if (!im.inquilino) return { grade: '—', color: 'var(--text-muted)' };
    return { grade: 'A', color: '#34D399' };
  }

  return (
    <div>
      <div style={S.subtabs}>
        {['vencimentos', 'clausulas', 'tenant'].map(t => (
          <button key={t} style={S.subtab(subtab === t)} onClick={() => setSubtab(t)}>
            {{ vencimentos: 'Quadro de Vencimentos', clausulas: 'Cláusulas', tenant: 'Tenant Quality' }[t]}
          </button>
        ))}
      </div>

      {subtab === 'vencimentos' && (
        <div style={S.card}>
          <div style={S.formSection}>Quadro de Vencimentos de Contratos</div>
          {sorted.length === 0 ? (
            <div style={S.emptyState}>Nenhum imóvel com contrato de locação cadastrado.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>Imóvel</th><th style={S.th}>Inquilino</th><th style={S.th}>Aluguel</th>
                  <th style={S.th}>Início</th><th style={S.th}>Fim</th><th style={S.th}>Countdown</th>
                  <th style={S.th}>Índice</th><th style={S.th}>Próx. Reajuste</th>
                </tr></thead>
                <tbody>
                  {sorted.map(im => {
                    const d = diasFimContrato(im);
                    const total = im.contrato_inicio && im.contrato_fim ? Math.max(1, Math.round((new Date(im.contrato_fim) - new Date(im.contrato_inicio)) / (86400000))) : 100;
                    const elapsed = im.contrato_inicio ? Math.max(0, Math.round((new Date() - new Date(im.contrato_inicio)) / 86400000)) : 0;
                    const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
                    return (
                      <tr key={im.id}>
                        <td style={S.td}>{im.nome || im.logradouro || '—'}</td>
                        <td style={S.td}>{im.inquilino || '—'}</td>
                        <td style={S.td}>{fmtR(im.aluguel)}</td>
                        <td style={S.td}>{fmtDate(im.contrato_inicio)}</td>
                        <td style={S.td}>{fmtDate(im.contrato_fim)}</td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--bg-surface)', overflow: 'hidden' }}>
                              <div style={{ width: pct + '%', height: '100%', borderRadius: 3, background: contratoCor(im) }} />
                            </div>
                            <span style={{ ...S.badge(contratoCor(im)), fontSize: 10, padding: '3px 10px' }}>{contratoLabel(im)}</span>
                          </div>
                        </td>
                        <td style={S.td}>{im.indice_reajuste || '—'}</td>
                        <td style={S.td}>{fmtDate(im.data_proximo_reajuste)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subtab === 'clausulas' && (
        <div>
          {alugados.length === 0 ? (
            <div style={S.emptyState}>Nenhum contrato cadastrado.</div>
          ) : alugados.map(im => (
            <div key={im.id} style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>{im.nome || im.logradouro || 'Imóvel'}</div>
              <div style={S.grid3}>
                <div>
                  <div style={S.kpiLabel}>Multa Rescisória</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#F87171' }}>{fmtR((im.aluguel || 0) * 3)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>3x aluguel (padrão)</div>
                </div>
                <div>
                  <div style={S.kpiLabel}>Carência</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>—</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Não informado</div>
                </div>
                <div>
                  <div style={S.kpiLabel}>Índice de Reajuste</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#60A5FA' }}>{im.indice_reajuste || 'IGPM'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Próx: {fmtDate(im.data_proximo_reajuste)}</div>
                </div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                <div style={S.badge('#34D399')}>Garantia: {im.garantia || 'Não informada'}</div>
                <div style={S.badge('#60A5FA')}>Vigência: {fmtDate(im.contrato_inicio)} a {fmtDate(im.contrato_fim)}</div>
                {im.imobiliaria && <div style={S.badge('#A78BFA')}>Imobiliária: {im.imobiliaria}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {subtab === 'tenant' && (
        <div style={S.card}>
          <div style={S.formSection}>Qualidade dos Inquilinos</div>
          {alugados.length === 0 ? (
            <div style={S.emptyState}>Nenhum inquilino cadastrado.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>Imóvel</th><th style={S.th}>Inquilino</th><th style={S.th}>Contato</th>
                  <th style={S.th}>Garantia</th><th style={S.th}>Inadimplente</th><th style={S.th}>Rating</th>
                </tr></thead>
                <tbody>
                  {alugados.map(im => {
                    const { grade, color } = tenantGrade(im);
                    return (
                      <tr key={im.id}>
                        <td style={S.td}>{im.nome || im.logradouro || '—'}</td>
                        <td style={S.td}>{im.inquilino || '—'}</td>
                        <td style={S.td}>{im.inquilino_contato || '—'}</td>
                        <td style={S.td}><span style={S.badge('#60A5FA')}>{im.garantia || 'N/A'}</span></td>
                        <td style={S.td}>{im.inadimplente ? <span style={S.badge('#F87171')}>Sim</span> : <span style={S.badge('#34D399')}>Não</span>}</td>
                        <td style={S.td}><span style={{ fontSize: 20, fontWeight: 800, color }}>{grade}</span></td>
                      </tr>
                    );
                  })}
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
// TAB 9: DEBT SCHEDULE (Dívida)
// ============================================================
function DebtScheduleTab({ imoveis, dividas }) {
  const [subtab, setSubtab] = useState('cronograma');
  const [selicScenario, setSelicScenario] = useState(15);

  const allDividas = useMemo(() => {
    if (dividas && dividas.length > 0) return dividas;
    return imoveis.filter(i => (i.divida || 0) > 0).map(i => ({
      id: i.id, imovel_id: i.id, imovel_nome: i.nome || i.logradouro,
      banco: '—', saldo_devedor: i.divida || 0, taxa: 0, parcela: i.parcela_mensal || 0,
      parcelas_restantes: 0, tipo_taxa: 'fixo', data_vencimento: null,
    }));
  }, [imoveis, dividas]);

  const sorted = useMemo(() => [...allDividas].sort((a, b) => {
    if (!a.data_vencimento) return 1;
    if (!b.data_vencimento) return -1;
    return new Date(a.data_vencimento) - new Date(b.data_vencimento);
  }), [allDividas]);

  const resumo = useMemo(() => {
    const totalDivida = allDividas.reduce((s, d) => s + (d.saldo_devedor || 0), 0);
    const totalParcela = allDividas.reduce((s, d) => s + (d.parcela || 0), 0);
    const patrimonioTotal = imoveis.reduce((s, i) => s + (i.valor_mercado || i.custo_aquisicao || 0), 0);
    const ltvMedio = patrimonioTotal > 0 ? (totalDivida / patrimonioTotal) * 100 : 0;
    const noiAnual = imoveis.reduce((s, i) => s + calcNOI(i), 0);
    const dcrMedio = totalParcela > 0 ? (noiAnual / 12) / totalParcela : 0;
    const taxas = allDividas.filter(d => d.taxa > 0);
    const wtAvgTaxa = taxas.length > 0 ? taxas.reduce((s, d) => s + d.taxa * d.saldo_devedor, 0) / taxas.reduce((s, d) => s + d.saldo_devedor, 0) : 0;
    return { totalDivida, totalParcela, ltvMedio, dcrMedio, wtAvgTaxa };
  }, [allDividas, imoveis]);

  return (
    <div>
      <div style={S.subtabs}>
        {['cronograma', 'stress', 'resumo'].map(t => (
          <button key={t} style={S.subtab(subtab === t)} onClick={() => setSubtab(t)}>
            {{ cronograma: 'Cronograma', stress: 'Stress Test', resumo: 'Resumo' }[t]}
          </button>
        ))}
      </div>

      {subtab === 'cronograma' && (
        <div style={S.card}>
          <div style={S.formSection}>Cronograma de Dívidas</div>
          {sorted.length === 0 ? (
            <div style={S.emptyState}>Nenhuma dívida cadastrada.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>Imóvel</th><th style={S.th}>Banco</th><th style={S.th}>Saldo Devedor</th>
                  <th style={S.th}>Taxa a.a.</th><th style={S.th}>Parcela</th><th style={S.th}>Parcelas Rest.</th>
                  <th style={S.th}>Tipo Taxa</th><th style={S.th}>Vencimento</th>
                </tr></thead>
                <tbody>
                  {sorted.map(d => {
                    const imName = d.imovel_nome || imoveis.find(i => i.id === d.imovel_id)?.nome || imoveis.find(i => i.id === d.imovel_id)?.logradouro || '—';
                    return (
                      <tr key={d.id}>
                        <td style={S.td}>{imName}</td>
                        <td style={S.td}>{d.banco || '—'}</td>
                        <td style={S.td}>{fmtR(d.saldo_devedor)}</td>
                        <td style={S.td}>{d.taxa ? fmtPct(d.taxa) : '—'}</td>
                        <td style={S.td}>{fmtR(d.parcela)}</td>
                        <td style={S.td}>{d.parcelas_restantes || '—'}</td>
                        <td style={S.td}><span style={S.badge(d.tipo_taxa === 'variavel' ? '#FBBF24' : '#34D399')}>{d.tipo_taxa === 'variavel' ? 'Variável' : 'Fixo'}</span></td>
                        <td style={S.td}>{fmtDate(d.data_vencimento)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subtab === 'stress' && (
        <div style={S.card}>
          <div style={S.formSection}>Stress Test — Cenário de Selic</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
            <label style={{ ...S.label, marginBottom: 0 }}>Selic Cenário (%)</label>
            {[12, 15, 18].map(v => (
              <button key={v} style={S.btn(selicScenario === v ? 'primary' : '')} onClick={() => setSelicScenario(v)}>{v}%</button>
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Imóvel</th><th style={S.th}>Tipo Taxa</th><th style={S.th}>Parcela Atual</th>
                <th style={S.th}>Parcela Cenário</th><th style={S.th}>Variação</th><th style={S.th}>DCR Cenário</th>
              </tr></thead>
              <tbody>
                {allDividas.map(d => {
                  const imName = d.imovel_nome || imoveis.find(i => i.id === d.imovel_id)?.nome || '—';
                  const im = imoveis.find(i => i.id === d.imovel_id);
                  const isVar = d.tipo_taxa === 'variavel';
                  const spreadEstimate = d.taxa > 0 ? d.taxa - 13.25 : 2;
                  const newRate = isVar ? selicScenario + Math.max(0, spreadEstimate) : d.taxa;
                  const rateRatio = d.taxa > 0 ? newRate / d.taxa : 1;
                  const parcelaCenario = isVar ? (d.parcela || 0) * rateRatio : d.parcela;
                  const variacao = d.parcela > 0 ? ((parcelaCenario - d.parcela) / d.parcela) * 100 : 0;
                  const noiMensal = im ? calcNOI(im) / 12 : 0;
                  const dcrCenario = parcelaCenario > 0 ? noiMensal / parcelaCenario : 0;
                  return (
                    <tr key={d.id}>
                      <td style={S.td}>{imName}</td>
                      <td style={S.td}><span style={S.badge(isVar ? '#FBBF24' : '#34D399')}>{isVar ? 'Variável' : 'Fixo'}</span></td>
                      <td style={S.td}>{fmtR(d.parcela)}</td>
                      <td style={S.td}>{fmtR(parcelaCenario)}</td>
                      <td style={S.td}><span style={{ color: variacao > 0 ? '#F87171' : '#34D399', fontWeight: 600 }}>{variacao > 0 ? '+' : ''}{fmtPct(variacao)}</span></td>
                      <td style={S.td}><span style={{ color: dcrCenario < 1.2 ? '#F87171' : '#34D399', fontWeight: 700 }}>{dcrCenario.toFixed(2)}x</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subtab === 'resumo' && (
        <div>
          <div style={S.kpiGrid}>
            <div style={S.kpiCard(true)}>
              <div style={S.kpiLabel}>{Icons.dollar} Dívida Total</div>
              <div style={S.kpiValue('#F87171')}>{fmtR(resumo.totalDivida)}</div>
            </div>
            <div style={S.kpiCard()}>
              <div style={S.kpiLabel}>Parcela Total Mensal</div>
              <div style={S.kpiValue('#FBBF24')}>{fmtR(resumo.totalParcela)}</div>
            </div>
            <div style={S.kpiCard()}>
              <div style={S.kpiLabel}>LTV Médio</div>
              <div style={S.kpiValue(resumo.ltvMedio > 70 ? '#F87171' : '#34D399')}>{fmtPct(resumo.ltvMedio)}</div>
            </div>
            <div style={S.kpiCard()}>
              <div style={S.kpiLabel}>DCR Médio</div>
              <div style={S.kpiValue(resumo.dcrMedio < 1.2 ? '#F87171' : '#34D399')}>{resumo.dcrMedio.toFixed(2)}x</div>
            </div>
            <div style={S.kpiCard()}>
              <div style={S.kpiLabel}>Taxa Média Ponderada</div>
              <div style={S.kpiValue('#60A5FA')}>{fmtPct(resumo.wtAvgTaxa)}</div>
            </div>
          </div>
          <div style={S.card}>
            <div style={S.formSection}>Distribuição por Tipo de Taxa</div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ flex: 1, textAlign: 'center', padding: 20, background: 'var(--bg-surface)', borderRadius: 12 }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#34D399' }}>{allDividas.filter(d => d.tipo_taxa !== 'variavel').length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Taxa Fixa</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: 20, background: 'var(--bg-surface)', borderRadius: 12 }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#FBBF24' }}>{allDividas.filter(d => d.tipo_taxa === 'variavel').length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Taxa Variável</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB 10: DD TRACKER
// ============================================================
const DD_DEFAULT_ITEMS = [
  'Matrícula Atualizada', 'CND Federal', 'CND Estadual', 'CND Municipal',
  'Habite-se', 'IPTU Quitado', 'Laudo de Avaliação', 'Seguro Incêndio',
  'Contrato de Locação', 'Alvará',
];
const DD_STATUS_COLORS = { Pendente: '#FBBF24', Aprovado: '#34D399', Vencido: '#F87171', 'N/A': '#6B7280' };

function DDTrackerTab({ imoveis, ddItems, onSaveDD, onUpdateDD }) {
  const [selectedId, setSelectedId] = useState('');
  const [newItem, setNewItem] = useState('');

  const imDDItems = useMemo(() => {
    if (!selectedId) return [];
    return ddItems.filter(d => d.imovel_id === selectedId);
  }, [selectedId, ddItems]);

  const allProgress = useMemo(() => {
    return imoveis.map(im => {
      const items = ddItems.filter(d => d.imovel_id === im.id);
      const total = items.length || 1;
      const done = items.filter(d => d.status === 'Aprovado' || d.status === 'N/A').length;
      return { id: im.id, nome: im.nome || im.logradouro || 'Imóvel', total: items.length, done, pct: items.length > 0 ? (done / total) * 100 : 0 };
    });
  }, [imoveis, ddItems]);

  async function initDD(imovelId) {
    const existing = ddItems.filter(d => d.imovel_id === imovelId);
    if (existing.length > 0) return;
    const im = imoveis.find(i => i.id === imovelId);
    const items = DD_DEFAULT_ITEMS.filter(item => item !== 'Alvará' || (im && im.uso !== 'Residencial'));
    for (const item of items) {
      await onSaveDD({ imovel_id: imovelId, item_nome: item, status: 'Pendente', observacao: '' });
    }
  }

  async function handleStatusChange(ddId, newStatus) {
    await onUpdateDD(ddId, { status: newStatus });
  }

  async function addCustomItem() {
    if (!newItem.trim() || !selectedId) return;
    await onSaveDD({ imovel_id: selectedId, item_nome: newItem.trim(), status: 'Pendente', observacao: '' });
    setNewItem('');
  }

  return (
    <div>
      <div style={S.card}>
        <div style={S.formSection}>Due Diligence — Progresso por Ativo</div>
        {imoveis.length === 0 ? (
          <div style={S.emptyState}>Cadastre imóveis para iniciar o DD Tracker.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
            {allProgress.map(p => (
              <div key={p.id} style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: 16, cursor: 'pointer', border: selectedId === p.id ? '2px solid var(--blue)' : '1px solid var(--border)' }} onClick={() => { setSelectedId(p.id); initDD(p.id); }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>{p.nome}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                    <div style={{ width: p.pct + '%', height: '100%', borderRadius: 4, background: p.pct >= 100 ? '#34D399' : p.pct >= 50 ? '#FBBF24' : '#F87171', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: p.pct >= 100 ? '#34D399' : 'var(--text-muted)' }}>{Math.round(p.pct)}%</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{p.done}/{p.total} itens</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedId && (
        <div style={S.card}>
          <div style={S.formSection}>Checklist — {imoveis.find(i => i.id === selectedId)?.nome || 'Imóvel'}</div>
          {imDDItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Inicializando checklist...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>Item</th><th style={S.th}>Status</th><th style={S.th}>Ações</th>
                </tr></thead>
                <tbody>
                  {imDDItems.map(dd => (
                    <tr key={dd.id}>
                      <td style={S.td}>{dd.item_nome}</td>
                      <td style={S.td}><span style={S.badge(DD_STATUS_COLORS[dd.status] || '#6B7280')}>{dd.status}</span></td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {Object.keys(DD_STATUS_COLORS).map(st => (
                            <button key={st} style={{ ...S.btn(dd.status === st ? 'primary' : ''), padding: '4px 10px', fontSize: 10 }} onClick={() => handleStatusChange(dd.id, st)}>{st}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 20, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Novo Item DD</label>
              <input style={S.input} value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Ex: Certidão de Ônus" onKeyDown={e => e.key === 'Enter' && addCustomItem()} />
            </div>
            <button style={S.btn('primary')} onClick={addCustomItem}>{Icons.plus} Adicionar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB 11: CAPEX PLANNING
// ============================================================
const CAPEX_DEFAULTS = [
  { categoria: 'Pintura Interna', ciclo: 5, custo_m2: 45 },
  { categoria: 'Pintura Fachada', ciclo: 10, custo_m2: 80 },
  { categoria: 'Ar Condicionado', ciclo: 8, custo_m2: 60 },
  { categoria: 'Elevador (revisão)', ciclo: 15, custo_m2: 30 },
  { categoria: 'Impermeabilização', ciclo: 10, custo_m2: 55 },
  { categoria: 'Elétrica', ciclo: 15, custo_m2: 40 },
  { categoria: 'Hidráulica', ciclo: 12, custo_m2: 35 },
];

function CAPEXPlanningTab({ imoveis, manutencoes }) {
  const [subtab, setSubtab] = useState('projecao');
  const [reserveBalance, setReserveBalance] = useState(0);
  const currentYear = new Date().getFullYear();

  const projecao = useMemo(() => {
    const years = Array.from({ length: 10 }, (_, i) => currentYear + i);
    const rows = [];
    imoveis.forEach(im => {
      const area = im.area_m2 || 100;
      const aqYear = im.data_aquisicao ? new Date(im.data_aquisicao).getFullYear() : currentYear - 5;
      const age = currentYear - aqYear;
      CAPEX_DEFAULTS.forEach(cap => {
        const yearCosts = {};
        let total = 0;
        years.forEach(yr => {
          const yearsFromAcq = yr - aqYear;
          if (yearsFromAcq > 0 && yearsFromAcq % cap.ciclo === 0) {
            const cost = area * cap.custo_m2;
            yearCosts[yr] = cost;
            total += cost;
          }
        });
        if (total > 0) {
          rows.push({ imovel: im.nome || im.logradouro || 'Imóvel', categoria: cap.categoria, yearCosts, total });
        }
      });
    });
    return { years, rows };
  }, [imoveis, currentYear]);

  const totalCapex10y = useMemo(() => projecao.rows.reduce((s, r) => s + r.total, 0), [projecao]);
  const monthlyContrib = totalCapex10y / 120;

  const lifecycle = useMemo(() => {
    return imoveis.map(im => {
      const aqYear = im.data_aquisicao ? new Date(im.data_aquisicao).getFullYear() : currentYear - 5;
      const age = currentYear - aqYear;
      const nextMaintenance = CAPEX_DEFAULTS.map(cap => {
        const nextCycle = Math.ceil(age / cap.ciclo) * cap.ciclo;
        const yearDue = aqYear + nextCycle;
        return { ...cap, yearDue, yearsLeft: yearDue - currentYear, cost: (im.area_m2 || 100) * cap.custo_m2 };
      }).filter(c => c.yearsLeft >= 0).sort((a, b) => a.yearsLeft - b.yearsLeft);
      return { id: im.id, nome: im.nome || im.logradouro || 'Imóvel', age, area: im.area_m2 || 0, nextMaintenance };
    });
  }, [imoveis, currentYear]);

  return (
    <div>
      <div style={S.subtabs}>
        {['projecao', 'reserva', 'lifecycle'].map(t => (
          <button key={t} style={S.subtab(subtab === t)} onClick={() => setSubtab(t)}>
            {{ projecao: 'Projeção 10 Anos', reserva: 'Reserve Fund', lifecycle: 'Lifecycle' }[t]}
          </button>
        ))}
      </div>

      {subtab === 'projecao' && (
        <div style={S.card}>
          <div style={S.formSection}>Projeção CAPEX — 10 Anos</div>
          {projecao.rows.length === 0 ? (
            <div style={S.emptyState}>Cadastre imóveis com data de aquisição e área para gerar projeções.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>Imóvel</th><th style={S.th}>Categoria</th>
                  {projecao.years.map(y => <th key={y} style={S.th}>{y}</th>)}
                  <th style={S.th}>Total</th>
                </tr></thead>
                <tbody>
                  {projecao.rows.map((r, idx) => (
                    <tr key={idx}>
                      <td style={S.td}>{r.imovel}</td>
                      <td style={S.td}>{r.categoria}</td>
                      {projecao.years.map(y => (
                        <td key={y} style={{ ...S.td, color: r.yearCosts[y] ? '#F87171' : 'var(--text-muted)', fontWeight: r.yearCosts[y] ? 700 : 400 }}>
                          {r.yearCosts[y] ? fmtR(r.yearCosts[y]) : '—'}
                        </td>
                      ))}
                      <td style={{ ...S.td, fontWeight: 700, color: '#F87171' }}>{fmtR(r.total)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} style={{ ...S.td, fontWeight: 800, fontSize: 14 }}>TOTAL</td>
                    {projecao.years.map(y => {
                      const colTotal = projecao.rows.reduce((s, r) => s + (r.yearCosts[y] || 0), 0);
                      return <td key={y} style={{ ...S.td, fontWeight: 700, color: colTotal > 0 ? '#FBBF24' : 'var(--text-muted)' }}>{colTotal > 0 ? fmtR(colTotal) : '—'}</td>;
                    })}
                    <td style={{ ...S.td, fontWeight: 800, fontSize: 14, color: '#F87171' }}>{fmtR(totalCapex10y)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subtab === 'reserva' && (
        <div>
          <div style={S.kpiGrid}>
            <div style={S.kpiCard(true)}>
              <div style={S.kpiLabel}>CAPEX Total 10 Anos</div>
              <div style={S.kpiValue('#F87171')}>{fmtR(totalCapex10y)}</div>
            </div>
            <div style={S.kpiCard()}>
              <div style={S.kpiLabel}>Contribuição Mensal Sugerida</div>
              <div style={S.kpiValue('#60A5FA')}>{fmtR(monthlyContrib)}</div>
            </div>
            <div style={S.kpiCard()}>
              <div style={S.kpiLabel}>Saldo Atual do Fundo</div>
              <div style={S.kpiValue(reserveBalance >= totalCapex10y / 10 ? '#34D399' : '#FBBF24')}>{fmtR(reserveBalance)}</div>
            </div>
            <div style={S.kpiCard()}>
              <div style={S.kpiLabel}>Cobertura</div>
              <div style={S.kpiValue(reserveBalance >= totalCapex10y / 10 ? '#34D399' : '#F87171')}>{totalCapex10y > 0 ? fmtPct((reserveBalance / totalCapex10y) * 100) : '0%'}</div>
            </div>
          </div>
          <div style={S.card}>
            <div style={S.formSection}>Atualizar Saldo do Fundo de Reserva</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Saldo Atual (R$)</label>
                <input style={S.input} type="number" value={reserveBalance} onChange={e => setReserveBalance(Number(e.target.value) || 0)} placeholder="0" />
              </div>
            </div>
            <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-surface)', borderRadius: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Meta anual: {fmtR(totalCapex10y / 10)} | Meta mensal: {fmtR(monthlyContrib)} | Gap: {fmtR(Math.max(0, totalCapex10y / 10 - reserveBalance))}
            </div>
          </div>
        </div>
      )}

      {subtab === 'lifecycle' && (
        <div>
          {lifecycle.length === 0 ? (
            <div style={S.emptyState}>Cadastre imóveis para visualizar o ciclo de vida.</div>
          ) : lifecycle.map(im => (
            <div key={im.id} style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{im.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Idade: {im.age} anos | Área: {im.area}m²</div>
                </div>
              </div>
              {im.nextMaintenance.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sem manutenções projetadas nos próximos 10 anos.</div>
              ) : (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {im.nextMaintenance.slice(0, 6).map((m, i) => (
                    <div key={i} style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '12px 16px', minWidth: 160, border: m.yearsLeft <= 1 ? '1px solid rgba(248,113,113,0.3)' : '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: m.yearsLeft <= 1 ? '#F87171' : m.yearsLeft <= 3 ? '#FBBF24' : 'var(--text-secondary)' }}>{m.categoria}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{m.yearDue}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{m.yearsLeft === 0 ? 'Este ano' : `Em ${m.yearsLeft} ano${m.yearsLeft > 1 ? 's' : ''}`} — {fmtR(m.cost)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB 12: PIPELINE
// ============================================================
const PIPELINE_STAGES = ['Análise', 'Visita', 'Oferta', 'Negociação', 'Fechado', 'Descartado'];
const PIPELINE_COLORS = { 'Análise': '#60A5FA', 'Visita': '#A78BFA', 'Oferta': '#FBBF24', 'Negociação': '#F97316', 'Fechado': '#34D399', 'Descartado': '#6B7280' };
const SCORE_CRITERIA = ['Localização', 'Preço', 'Yield', 'Inquilino', 'Estrutura'];
const EMPTY_DEAL = { nome: '', cidade: '', uf: 'SP', valor: '', cap_rate: '', estagio: 'Análise', observacoes: '', score_localizacao: 5, score_preco: 5, score_yield: 5, score_inquilino: 5, score_estrutura: 5 };

function PipelineTab({ pipeline, onSavePipeline, onUpdatePipeline, onDeletePipeline }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_DEAL });
  const [viewMode, setViewMode] = useState('kanban');

  const avgScore = (d) => {
    const scores = [d.score_localizacao, d.score_preco, d.score_yield, d.score_inquilino, d.score_estrutura].map(Number).filter(v => !isNaN(v));
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  };

  async function handleSave() {
    if (!form.nome) { alert('Nome é obrigatório'); return; }
    await onSavePipeline({ ...form, valor: Number(form.valor) || 0, cap_rate: Number(form.cap_rate) || 0 });
    setForm({ ...EMPTY_DEAL });
    setShowForm(false);
  }

  async function moveStage(id, newStage) {
    await onUpdatePipeline(id, { estagio: newStage });
  }

  function scoreColor(v) {
    if (v >= 8) return '#34D399';
    if (v >= 5) return '#FBBF24';
    return '#F87171';
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btn(viewMode === 'kanban' ? 'primary' : '')} onClick={() => setViewMode('kanban')}>Kanban</button>
          <button style={S.btn(viewMode === 'lista' ? 'primary' : '')} onClick={() => setViewMode('lista')}>Lista</button>
        </div>
        <button style={S.btn('primary')} onClick={() => setShowForm(!showForm)}>{Icons.plus} Novo Deal</button>
      </div>

      {showForm && (
        <div style={{ ...S.card, marginBottom: 24 }}>
          <div style={S.formSection}>Novo Deal</div>
          <div style={S.grid3}>
            <Field label="Nome" value={form.nome} onChange={v => setForm({ ...form, nome: v })} placeholder="Ex: Galpão Barueri" />
            <Field label="Cidade" value={form.cidade} onChange={v => setForm({ ...form, cidade: v })} />
            <Field label="UF" value={form.uf} onChange={v => setForm({ ...form, uf: v })} options={['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE', 'CE', 'DF', 'GO', 'ES']} />
          </div>
          <div style={{ ...S.grid3, marginTop: 16 }}>
            <Field label="Valor (R$)" value={form.valor} onChange={v => setForm({ ...form, valor: v })} type="number" />
            <Field label="Cap Rate (%)" value={form.cap_rate} onChange={v => setForm({ ...form, cap_rate: v })} type="number" />
            <Field label="Estágio" value={form.estagio} onChange={v => setForm({ ...form, estagio: v })} options={PIPELINE_STAGES} />
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={S.label}>Score por Critério (1-10)</label>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {SCORE_CRITERIA.map((c, i) => {
                const key = 'score_' + c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ç/g, 'c');
                const fieldMap = { 'score_localizacao': 'score_localizacao', 'score_preco': 'score_preco', 'score_yield': 'score_yield', 'score_inquilino': 'score_inquilino', 'score_estrutura': 'score_estrutura' };
                const fk = Object.values(fieldMap)[i];
                return (
                  <div key={c} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>{c}</div>
                    <input style={{ ...S.input, textAlign: 'center', padding: '8px 4px' }} type="number" min="1" max="10" value={form[fk]} onChange={e => setForm({ ...form, [fk]: Number(e.target.value) || 1 })} />
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Field label="Observações" value={form.observacoes} onChange={v => setForm({ ...form, observacoes: v })} placeholder="Notas sobre o deal..." />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button style={S.btn('primary')} onClick={handleSave}>Salvar Deal</button>
            <button style={S.btn()} onClick={() => { setShowForm(false); setForm({ ...EMPTY_DEAL }); }}>Cancelar</button>
          </div>
        </div>
      )}

      {pipeline.length === 0 && !showForm ? (
        <div style={S.emptyState}>Nenhum deal no pipeline. Adicione novos deals para acompanhar oportunidades.</div>
      ) : viewMode === 'kanban' ? (
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 20 }}>
          {PIPELINE_STAGES.map(stage => {
            const deals = pipeline.filter(d => d.estagio === stage);
            return (
              <div key={stage} style={{ minWidth: 240, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: PIPELINE_COLORS[stage] + '15', borderRadius: 10, border: '1px solid ' + PIPELINE_COLORS[stage] + '30' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIPELINE_COLORS[stage] }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: PIPELINE_COLORS[stage], textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stage}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{deals.length}</span>
                </div>
                {deals.map(d => {
                  const score = avgScore(d);
                  return (
                    <div key={d.id} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, marginBottom: 10, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{d.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{d.cidade}/{d.uf}</div>
                      {d.valor > 0 && <div style={{ fontSize: 13, fontWeight: 600, color: '#60A5FA', marginBottom: 4 }}>{fmtR(d.valor)}</div>}
                      {d.cap_rate > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Cap Rate: {fmtPct(d.cap_rate)}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: scoreColor(score) }}>{score.toFixed(1)}</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {PIPELINE_STAGES.filter(s => s !== stage).slice(0, 3).map(s => (
                            <button key={s} style={{ background: PIPELINE_COLORS[s] + '20', color: PIPELINE_COLORS[s], border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 9, fontWeight: 600, cursor: 'pointer' }} onClick={() => moveStage(d.id, s)} title={`Mover para ${s}`}>{s.slice(0, 3)}</button>
                          ))}
                        </div>
                      </div>
                      <button style={{ ...S.btn('danger'), padding: '4px 10px', fontSize: 10, width: '100%', justifyContent: 'center' }} onClick={() => onDeletePipeline(d.id)}>{Icons.trash} Remover</button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={S.card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Nome</th><th style={S.th}>Cidade</th><th style={S.th}>Valor</th>
                <th style={S.th}>Cap Rate</th><th style={S.th}>Score</th><th style={S.th}>Estágio</th><th style={S.th}>Ações</th>
              </tr></thead>
              <tbody>
                {pipeline.map(d => {
                  const score = avgScore(d);
                  return (
                    <tr key={d.id}>
                      <td style={S.td}>{d.nome}</td>
                      <td style={S.td}>{d.cidade}/{d.uf}</td>
                      <td style={S.td}>{fmtR(d.valor)}</td>
                      <td style={S.td}>{fmtPct(d.cap_rate)}</td>
                      <td style={S.td}><span style={{ fontSize: 16, fontWeight: 800, color: scoreColor(score) }}>{score.toFixed(1)}</span></td>
                      <td style={S.td}><span style={S.badge(PIPELINE_COLORS[d.estagio])}>{d.estagio}</span></td>
                      <td style={S.td}>
                        <button style={{ ...S.btn('danger'), padding: '4px 10px', fontSize: 10 }} onClick={() => onDeletePipeline(d.id)}>{Icons.trash}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB 13: RELATÓRIO
// ============================================================
function RelatorioTab({ imoveis, recibos, manutencoes }) {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);

  const metrics = useMemo(() => {
    const patrimonio = imoveis.reduce((s, i) => s + (i.valor_mercado || i.custo_aquisicao || 0), 0);
    const noiAnual = imoveis.reduce((s, i) => s + calcNOI(i), 0);
    const receitaMensal = imoveis.filter(i => i.status === 'Alugado').reduce((s, i) => s + (i.aluguel || 0), 0);
    const yieldPort = patrimonio > 0 ? (noiAnual / patrimonio) * 100 : 0;
    const alugados = imoveis.filter(i => i.status === 'Alugado').length;
    const vagos = imoveis.filter(i => i.status === 'Vago').length;
    const vacancia = imoveis.length > 0 ? (vagos / imoveis.length) * 100 : 0;
    const ocupacao = 100 - vacancia;
    const totalDivida = imoveis.reduce((s, i) => s + (i.divida || 0), 0);
    const ltvMedio = patrimonio > 0 ? (totalDivida / patrimonio) * 100 : 0;
    const inadimplentes = imoveis.filter(i => i.inadimplente).length;
    const capexPendente = imoveis.reduce((s, i) => s + (i.capex_pendente || 0), 0);
    const totalManut = manutencoes.reduce((s, m) => s + (m.valor || 0), 0);
    const prev = { patrimonio: patrimonio * 0.95, noiAnual: noiAnual * 0.95, receitaMensal: receitaMensal * 0.95, yieldPort: yieldPort * 0.95, ocupacao: ocupacao * 0.95 };
    return { patrimonio, noiAnual, receitaMensal, yieldPort, alugados, vagos, vacancia, ocupacao, totalDivida, ltvMedio, inadimplentes, capexPendente, totalManut, prev };
  }, [imoveis, manutencoes]);

  function KPICompare({ label, current, previous, fmt, invert }) {
    const delta = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const isPositive = invert ? delta < 0 : delta > 0;
    return (
      <div style={S.kpiCard()}>
        <div style={S.kpiLabel}>{label}</div>
        <div style={S.kpiValue()}>{fmt(current)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: isPositive ? '#34D399' : '#F87171' }}>{delta > 0 ? '+' : ''}{fmtPct(delta)}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>vs anterior</span>
        </div>
      </div>
    );
  }

  const alertas = useMemo(() => {
    const list = [];
    imoveis.forEach(im => {
      if (im.inadimplente) list.push({ msg: `${im.nome || im.logradouro} — inadimplente`, color: '#F87171' });
      if (im.status === 'Vago') list.push({ msg: `${im.nome || im.logradouro} — vago`, color: '#FBBF24' });
      const d = diasFimContrato(im);
      if (d !== null && d <= 90 && d > 0) list.push({ msg: `${im.nome || im.logradouro} — contrato vence em ${d}d`, color: '#F97316' });
      const ltv = calcLTV(im);
      if (ltv > 70) list.push({ msg: `${im.nome || im.logradouro} — LTV ${fmtPct(ltv)}`, color: '#F87171' });
    });
    return list;
  }, [imoveis]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>Relatório Trimestral</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>Q{quarter} {now.getFullYear()}</div>
        </div>
        <button style={S.btn('primary')} onClick={() => alert('Exportação PDF em desenvolvimento')}>{Icons.report} Exportar PDF</button>
      </div>

      {/* Sumário Executivo */}
      <div style={S.card}>
        <div style={S.formSection}>Sumário Executivo</div>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 14 }}>
          O portfólio conta com <strong>{imoveis.length} ativos</strong> totalizando <strong>{fmtR(metrics.patrimonio)}</strong> em valor de mercado.
          A receita mensal de aluguéis é de <strong>{fmtR(metrics.receitaMensal)}</strong>, com NOI anualizado de <strong>{fmtR(metrics.noiAnual)}</strong>.
          A taxa de ocupação está em <strong>{fmtPct(metrics.ocupacao)}</strong> com yield do portfólio de <strong>{fmtPct(metrics.yieldPort)}</strong>.
          {metrics.inadimplentes > 0 && ` Atenção: ${metrics.inadimplentes} imóvel(is) com inadimplência.`}
        </p>
      </div>

      {/* Performance */}
      <div style={S.card}>
        <div style={S.formSection}>Performance do Portfólio</div>
        <div style={S.kpiGrid}>
          <KPICompare label="Patrimônio" current={metrics.patrimonio} previous={metrics.prev.patrimonio} fmt={fmtR} />
          <KPICompare label="NOI Anual" current={metrics.noiAnual} previous={metrics.prev.noiAnual} fmt={fmtR} />
          <KPICompare label="Receita Mensal" current={metrics.receitaMensal} previous={metrics.prev.receitaMensal} fmt={fmtR} />
          <KPICompare label="Yield" current={metrics.yieldPort} previous={metrics.prev.yieldPort} fmt={v => fmtPct(v)} />
          <KPICompare label="Ocupação" current={metrics.ocupacao} previous={metrics.prev.ocupacao} fmt={v => fmtPct(v)} />
        </div>
      </div>

      {/* NOI Analysis */}
      <div style={S.card}>
        <div style={S.formSection}>NOI por Ativo</div>
        {imoveis.length === 0 ? (
          <div style={S.emptyState}>Sem dados.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Imóvel</th><th style={S.th}>Receita Anual</th><th style={S.th}>Despesas</th>
                <th style={S.th}>NOI</th><th style={S.th}>Yield</th>
              </tr></thead>
              <tbody>
                {imoveis.map(im => {
                  const recAnual = (im.aluguel || 0) * 12;
                  const noi = calcNOI(im);
                  const desp = recAnual - noi;
                  const yld = calcYield(im);
                  return (
                    <tr key={im.id}>
                      <td style={S.td}>{im.nome || im.logradouro || '—'}</td>
                      <td style={S.td}>{fmtR(recAnual)}</td>
                      <td style={{ ...S.td, color: '#F87171' }}>{fmtR(desp)}</td>
                      <td style={{ ...S.td, fontWeight: 700, color: noi >= 0 ? '#34D399' : '#F87171' }}>{fmtR(noi)}</td>
                      <td style={S.td}>{fmtPct(yld)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ocupação & Vacância */}
      <div style={S.card}>
        <div style={S.formSection}>Ocupação & Vacância</div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1, textAlign: 'center', padding: 24, background: 'rgba(52,211,153,0.08)', borderRadius: 12, border: '1px solid rgba(52,211,153,0.2)' }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#34D399' }}>{metrics.alugados}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Ocupados</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: 24, background: 'rgba(248,113,113,0.08)', borderRadius: 12, border: '1px solid rgba(248,113,113,0.2)' }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#F87171' }}>{metrics.vagos}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Vagos</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: 24, background: 'rgba(96,165,250,0.08)', borderRadius: 12, border: '1px solid rgba(96,165,250,0.2)' }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#60A5FA' }}>{fmtPct(metrics.ocupacao)}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Taxa Ocupação</div>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div style={S.card}>
          <div style={S.formSection}>Alertas Críticos</div>
          {alertas.map((a, i) => (
            <div key={i} style={S.alertCard(a.color)}>{Icons.alert} {a.msg}</div>
          ))}
        </div>
      )}

      {/* CAPEX & Debt */}
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.formSection}>CAPEX Summary</div>
          <div style={S.kpiLabel}>CAPEX Pendente</div>
          <div style={S.kpiValue('#FBBF24')}>{fmtR(metrics.capexPendente)}</div>
          <div style={{ ...S.kpiSub, marginTop: 8 }}>Manutenções realizadas: {fmtR(metrics.totalManut)}</div>
        </div>
        <div style={S.card}>
          <div style={S.formSection}>Debt Overview</div>
          <div style={S.kpiLabel}>Dívida Total</div>
          <div style={S.kpiValue('#F87171')}>{fmtR(metrics.totalDivida)}</div>
          <div style={{ ...S.kpiSub, marginTop: 8 }}>LTV Médio: {fmtPct(metrics.ltvMedio)}</div>
        </div>
      </div>

      {/* Próximos Passos */}
      <div style={S.card}>
        <div style={S.formSection}>Próximos Passos</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {metrics.vagos > 0 && <div style={S.alertCard('#FBBF24')}>{Icons.home} Prospectar inquilinos para {metrics.vagos} imóvel(is) vago(s)</div>}
          {metrics.inadimplentes > 0 && <div style={S.alertCard('#F87171')}>{Icons.alert} Acionar cobrança para {metrics.inadimplentes} inadimplente(s)</div>}
          {metrics.ltvMedio > 60 && <div style={S.alertCard('#F97316')}>{Icons.alert} Avaliar amortização — LTV médio {fmtPct(metrics.ltvMedio)}</div>}
          {metrics.capexPendente > 0 && <div style={S.alertCard('#60A5FA')}>{Icons.wrench} Executar CAPEX pendente: {fmtR(metrics.capexPendente)}</div>}
          <div style={S.alertCard('#34D399')}>{Icons.chart} Revisar yields e reavaliar ativos underperforming</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// WRAPPER: Portfólio (Ativos + Contratos + DD)
// ============================================================
function PortfolioWrapper({ imoveis, onSave, onEdit, onDelete, user, ddItems, onSaveDD, onUpdateDD }) {
  const [section, setSection] = useState('ativos');
  return (
    <div>
      <div style={S.subtabs}>
        {[
          { id: 'ativos', label: 'Ativos' },
          { id: 'contratos', label: 'Contratos' },
          { id: 'dd', label: 'DD Tracker' },
        ].map(s => (
          <button key={s.id} style={S.subtab(section === s.id)} onClick={() => setSection(s.id)}>{s.label}</button>
        ))}
      </div>
      {section === 'ativos' && <CadastroTab imoveis={imoveis} onSave={onSave} onEdit={onEdit} onDelete={onDelete} user={user} />}
      {section === 'contratos' && <LeaseManagementTab imoveis={imoveis} />}
      {section === 'dd' && <DDTrackerTab imoveis={imoveis} ddItems={ddItems} onSaveDD={onSaveDD} onUpdateDD={onUpdateDD} />}
    </div>
  );
}

// ============================================================
// CONSTRUÇÃO & INCC TAB
// ============================================================
function ConstrucaoINCC({ imoveis }) {
  const [inccData, setInccData] = useState(null);
  const [inccError, setInccError] = useState(false);

  useEffect(() => {
    fetch('/api/incc')
      .then(r => r.json())
      .then(data => { if (data.error) { setInccError(true); } else { setInccData(data); } })
      .catch(() => setInccError(true));
  }, []);

  const emConstrucao = useMemo(() => imoveis.filter(im => im.estagio === 'Em Construção' || im.estagio === 'Na Planta'), [imoveis]);

  return (
    <div>
      {/* INCC Atual */}
      <div style={S.card}>
        <div style={S.formSection}>INCC Atual</div>
        {inccError || !inccData ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Sem dados INCC disponíveis.</div>
        ) : (
          <div style={S.kpiGrid}>
            <div style={S.kpiCard(true)}>
              <div style={S.kpiLabel}>INCC-DI Mês</div>
              <div style={S.kpiValue('#60A5FA')}>{fmtPct(inccData.mensal_di, 2)}</div>
              <div style={S.kpiSub}>{inccData.referencia || '—'}</div>
            </div>
            <div style={S.kpiCard()}>
              <div style={S.kpiLabel}>Acumulado 12m</div>
              <div style={S.kpiValue('#FBBF24')}>{fmtPct(inccData.acumulado_12m_di, 2)}</div>
            </div>
            <div style={S.kpiCard()}>
              <div style={S.kpiLabel}>Fator 12m</div>
              <div style={S.kpiValue()}>{inccData.fator_12m ? Number(inccData.fator_12m).toFixed(4) : '—'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Imóveis em Construção */}
      <div style={S.card}>
        <div style={S.formSection}>Imóveis em Construção ({emConstrucao.length})</div>
        {emConstrucao.length === 0 ? (
          <div style={S.emptyState}>Nenhum imóvel em construção ou na planta.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['Ativo', 'Construtora', 'Entrega', '% Obra', 'Valor Contrato', 'Entrada', 'Saldo', 'Saldo Corrigido INCC'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emConstrucao.map(im => {
                  const saldo = (Number(im.valor_contrato) || 0) - (Number(im.entrada_paga) || 0);
                  const saldoCorrigido = inccData?.fator_12m ? saldo * Number(inccData.fator_12m) : null;
                  const pct = Number(im.pct_obra) || 0;
                  const diasEntrega = im.data_entrega ? Math.round((new Date(im.data_entrega) - new Date()) / (1000 * 60 * 60 * 24)) : null;
                  return (
                    <tr key={im.id} className="table-row-hover">
                      <td style={S.td}>
                        <div style={{ fontWeight: 600 }}>{im.nome || im.logradouro || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{im.estagio}</div>
                      </td>
                      <td style={S.td}>{im.construtora || '—'}</td>
                      <td style={S.td}>
                        <div>{fmtDate(im.data_entrega)}</div>
                        {diasEntrega !== null && <div style={{ fontSize: 11, color: diasEntrega < 0 ? '#F87171' : diasEntrega < 180 ? '#FBBF24' : '#34D399' }}>{diasEntrega < 0 ? `${Math.abs(diasEntrega)}d atrasado` : `${diasEntrega}d restantes`}</div>}
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: pct >= 80 ? '#34D399' : pct >= 50 ? '#FBBF24' : '#60A5FA', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 36 }}>{fmtPct(pct, 0)}</span>
                        </div>
                      </td>
                      <td style={S.td}>{fmtR(im.valor_contrato)}</td>
                      <td style={S.td}>{fmtR(im.entrada_paga)}</td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{fmtR(saldo)}</td>
                      <td style={{ ...S.td, fontWeight: 600, color: '#FBBF24' }}>{saldoCorrigido !== null ? fmtR(saldoCorrigido) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Evolução INCC 12m */}
      {inccData?.historico_di && inccData.historico_di.length > 0 && (
        <div style={S.card}>
          <div style={S.formSection}>Evolução INCC-DI 12m</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Mês</th>
                  <th style={S.th}>INCC-DI (%)</th>
                </tr>
              </thead>
              <tbody>
                {inccData.historico_di.map((item, i) => (
                  <tr key={i} className="table-row-hover">
                    <td style={S.td}>{item.referencia || item.mes || `Mês ${i + 1}`}</td>
                    <td style={{ ...S.td, fontWeight: 600, color: Number(item.valor) > 0.5 ? '#F87171' : '#34D399' }}>{fmtPct(item.valor, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// FINANCIAMENTO SIMULADOR TAB
// ============================================================
function FinanciamentoSimulador({ imoveis }) {
  const [subtab, setSubtab] = useState('simulador');
  const imoveisComFinanc = useMemo(() => imoveis.filter(im => Number(im.valor_financiado) > 0 || Number(im.divida) > 0), [imoveis]);
  const [selectedImovel, setSelectedImovel] = useState('');
  const [valorFinanciado, setValorFinanciado] = useState(500000);
  const [taxaAnual, setTaxaAnual] = useState(10.5);
  const [prazoMeses, setPrazoMeses] = useState(360);
  const [sistema, setSistema] = useState('SAC');
  const [renda, setRenda] = useState(20000);

  // Sync from selected imovel
  useEffect(() => {
    if (!selectedImovel) return;
    const im = imoveis.find(i => i.id === selectedImovel);
    if (!im) return;
    if (Number(im.valor_financiado) > 0) setValorFinanciado(Number(im.valor_financiado));
    else if (Number(im.divida) > 0) setValorFinanciado(Number(im.divida));
    if (Number(im.taxa_financiamento) > 0) setTaxaAnual(Number(im.taxa_financiamento));
    if (Number(im.prazo_financiamento) > 0) setPrazoMeses(Number(im.prazo_financiamento));
    if (im.sistema_amortizacao) setSistema(im.sistema_amortizacao);
  }, [selectedImovel, imoveis]);

  function calcAmortization(principal, taxaAn, prazo, sys) {
    const taxaMensal = Math.pow(1 + taxaAn / 100, 1 / 12) - 1;
    const rows = [];
    let saldo = principal;
    for (let m = 1; m <= Math.min(prazo, prazo); m++) {
      const juros = saldo * taxaMensal;
      let amort, prestacao;
      if (sys === 'SAC') {
        amort = principal / prazo;
        prestacao = amort + juros;
      } else { // Price
        const pmt = principal * (taxaMensal * Math.pow(1 + taxaMensal, prazo)) / (Math.pow(1 + taxaMensal, prazo) - 1);
        prestacao = pmt;
        amort = pmt - juros;
      }
      saldo = Math.max(0, saldo - amort);
      rows.push({ mes: m, prestacao, juros, amort, saldo });
    }
    return rows;
  }

  function calcSummary(rows) {
    if (!rows.length) return { primeira: 0, ultima: 0, totalPago: 0, totalJuros: 0 };
    return {
      primeira: rows[0].prestacao,
      ultima: rows[rows.length - 1].prestacao,
      totalPago: rows.reduce((s, r) => s + r.prestacao, 0),
      totalJuros: rows.reduce((s, r) => s + r.juros, 0),
    };
  }

  const rowsSAC = useMemo(() => calcAmortization(valorFinanciado, taxaAnual, prazoMeses, 'SAC'), [valorFinanciado, taxaAnual, prazoMeses]);
  const rowsPrice = useMemo(() => calcAmortization(valorFinanciado, taxaAnual, prazoMeses, 'Price'), [valorFinanciado, taxaAnual, prazoMeses]);
  const rows = sistema === 'SAC' ? rowsSAC : rowsPrice;
  const summary = useMemo(() => calcSummary(rows), [rows]);
  const summarySAC = useMemo(() => calcSummary(rowsSAC), [rowsSAC]);
  const summaryPrice = useMemo(() => calcSummary(rowsPrice), [rowsPrice]);

  // Capacidade
  const maxParcela = renda * 0.3;
  const taxaMensalCap = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;
  const maxFinanciavel = taxaMensalCap > 0 ? maxParcela * (Math.pow(1 + taxaMensalCap, prazoMeses) - 1) / (taxaMensalCap * Math.pow(1 + taxaMensalCap, prazoMeses)) : maxParcela * prazoMeses;

  return (
    <div>
      <div style={S.subtabs}>
        {[{ id: 'simulador', label: 'Simulador' }, { id: 'comparativo', label: 'Comparativo' }, { id: 'capacidade', label: 'Capacidade' }].map(s => (
          <button key={s.id} style={S.subtab(subtab === s.id)} onClick={() => setSubtab(s.id)}>{s.label}</button>
        ))}
      </div>

      {subtab === 'simulador' && (
        <div>
          <div style={S.card}>
            <div style={S.formSection}>Parâmetros</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={S.label}>Imóvel (opcional)</label>
                <select style={S.select} value={selectedImovel} onChange={e => setSelectedImovel(e.target.value)}>
                  <option value="">Manual</option>
                  {imoveisComFinanc.map(im => <option key={im.id} value={im.id}>{im.nome || im.logradouro || 'Imóvel'}</option>)}
                </select>
              </div>
              <Field label="Valor Financiado" value={valorFinanciado} onChange={v => setValorFinanciado(Number(v) || 0)} type="number" />
              <Field label="Taxa a.a. %" value={taxaAnual} onChange={v => setTaxaAnual(Number(v) || 0)} type="number" />
              <Field label="Prazo (meses)" value={prazoMeses} onChange={v => setPrazoMeses(Number(v) || 1)} type="number" />
              <Field label="Sistema" value={sistema} onChange={v => setSistema(v)} options={['SAC', 'Price']} />
            </div>
          </div>

          {/* KPIs */}
          <div style={S.kpiGrid}>
            <div style={S.kpiCard(true)}>
              <div style={S.kpiLabel}>Primeira Parcela</div>
              <div style={S.kpiValue('#60A5FA')}>{fmtR(summary.primeira)}</div>
            </div>
            <div style={S.kpiCard()}>
              <div style={S.kpiLabel}>Última Parcela</div>
              <div style={S.kpiValue()}>{fmtR(summary.ultima)}</div>
            </div>
            <div style={S.kpiCard()}>
              <div style={S.kpiLabel}>Total Pago</div>
              <div style={S.kpiValue('#FBBF24')}>{fmtR(summary.totalPago)}</div>
            </div>
            <div style={S.kpiCard()}>
              <div style={S.kpiLabel}>Total Juros</div>
              <div style={S.kpiValue('#F87171')}>{fmtR(summary.totalJuros)}</div>
            </div>
          </div>

          {/* First 12 months */}
          <div style={S.card}>
            <div style={S.formSection}>Primeiros 12 Meses</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>{['Mês', 'Prestação', 'Juros', 'Amortização', 'Saldo Devedor'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 12).map(r => (
                    <tr key={r.mes} className="table-row-hover">
                      <td style={S.td}>{r.mes}</td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{fmtR(r.prestacao)}</td>
                      <td style={{ ...S.td, color: '#F87171' }}>{fmtR(r.juros)}</td>
                      <td style={{ ...S.td, color: '#34D399' }}>{fmtR(r.amort)}</td>
                      <td style={S.td}>{fmtR(r.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subtab === 'comparativo' && (
        <div>
          <div style={S.kpiGrid}>
            {[
              { label: 'Total Pago SAC', value: fmtR(summarySAC.totalPago), color: '#60A5FA' },
              { label: 'Total Pago Price', value: fmtR(summaryPrice.totalPago), color: '#A78BFA' },
              { label: 'Diferença (Price - SAC)', value: fmtR(summaryPrice.totalPago - summarySAC.totalPago), color: '#F87171' },
              { label: 'Juros SAC', value: fmtR(summarySAC.totalJuros), color: '#FBBF24' },
              { label: 'Juros Price', value: fmtR(summaryPrice.totalJuros), color: '#F97316' },
            ].map(k => (
              <div key={k.label} style={S.kpiCard()}>
                <div style={S.kpiLabel}>{k.label}</div>
                <div style={S.kpiValue(k.color)}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {[{ title: 'SAC', data: rowsSAC }, { title: 'Price', data: rowsPrice }].map(col => (
              <div key={col.title} style={S.card}>
                <div style={S.formSection}>{col.title} — Primeiros 12 Meses</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={S.table}>
                    <thead>
                      <tr>{['Mês', 'Prestação', 'Juros', 'Amort.', 'Saldo'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {col.data.slice(0, 12).map(r => (
                        <tr key={r.mes} className="table-row-hover">
                          <td style={S.td}>{r.mes}</td>
                          <td style={{ ...S.td, fontWeight: 600 }}>{fmtR(r.prestacao)}</td>
                          <td style={{ ...S.td, color: '#F87171' }}>{fmtR(r.juros)}</td>
                          <td style={{ ...S.td, color: '#34D399' }}>{fmtR(r.amort)}</td>
                          <td style={S.td}>{fmtR(r.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subtab === 'capacidade' && (
        <div>
          <div style={S.card}>
            <div style={S.formSection}>Capacidade de Financiamento</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
              <Field label="Renda Mensal" value={renda} onChange={v => setRenda(Number(v) || 0)} type="number" />
              <Field label="Taxa a.a. %" value={taxaAnual} onChange={v => setTaxaAnual(Number(v) || 0)} type="number" />
              <Field label="Prazo (meses)" value={prazoMeses} onChange={v => setPrazoMeses(Number(v) || 1)} type="number" />
            </div>
          </div>
          <div style={S.kpiGrid}>
            <div style={S.kpiCard(true)}>
              <div style={S.kpiLabel}>Renda Mensal</div>
              <div style={S.kpiValue()}>{fmtR(renda)}</div>
            </div>
            <div style={S.kpiCard(true)}>
              <div style={S.kpiLabel}>Máx. Parcela (30%)</div>
              <div style={S.kpiValue('#60A5FA')}>{fmtR(maxParcela)}</div>
            </div>
            <div style={S.kpiCard(true)}>
              <div style={S.kpiLabel}>Máx. Financiável</div>
              <div style={S.kpiValue('#34D399')}>{fmtR(maxFinanciavel)}</div>
              <div style={S.kpiSub}>{prazoMeses} meses a {fmtPct(taxaAnual)} a.a.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// WRAPPER: Financeiro (NOI + Dívida + CAPEX + Construção + Financiamento)
// ============================================================
function FinanceiroWrapper({ imoveis, dividas, manutencoes }) {
  const [section, setSection] = useState('noi');
  return (
    <div>
      <div style={S.subtabs}>
        {[
          { id: 'noi', label: 'NOI & Fluxo' },
          { id: 'divida', label: 'Dívida' },
          { id: 'capex', label: 'CAPEX' },
          { id: 'construcao', label: 'Construção & INCC' },
          { id: 'financiamento', label: 'Financiamento' },
        ].map(s => (
          <button key={s.id} style={S.subtab(section === s.id)} onClick={() => setSection(s.id)}>{s.label}</button>
        ))}
      </div>
      {section === 'noi' && <MotorFinanceiroTab imoveis={imoveis} />}
      {section === 'divida' && <DebtScheduleTab imoveis={imoveis} dividas={dividas} />}
      {section === 'capex' && <CAPEXPlanningTab imoveis={imoveis} manutencoes={manutencoes} />}
      {section === 'construcao' && <ConstrucaoINCC imoveis={imoveis} />}
      {section === 'financiamento' && <FinanciamentoSimulador imoveis={imoveis} />}
    </div>
  );
}

// ============================================================
// WRAPPER: Valuation (Banda + Renda + Decisão + Mercado IA)
// ============================================================
function ValuationWrapper({ imoveis }) {
  const [section, setSection] = useState('valuation');
  return (
    <div>
      <div style={S.subtabs}>
        {[
          { id: 'valuation', label: 'Valuation' },
          { id: 'decisao', label: 'Decisão' },
          { id: 'mercado', label: 'Mercado IA' },
        ].map(s => (
          <button key={s.id} style={S.subtab(section === s.id)} onClick={() => setSection(s.id)}>{s.label}</button>
        ))}
      </div>
      {section === 'valuation' && <ValuationTab imoveis={imoveis} />}
      {section === 'decisao' && <DecisaoTab imoveis={imoveis} />}
      {section === 'mercado' && <MercadoIATab imoveis={imoveis} />}
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
  const [pipeline, setPipeline] = useState([]);
  const [dividas, setDividas] = useState([]);
  const [ddItems, setDDItems] = useState([]);
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
    let qP = supabase.from('imoveis_pipeline').select('*').order('created_at', { ascending: false });
    let qD = supabase.from('imoveis_dividas').select('*').order('created_at', { ascending: false });
    let qDD = supabase.from('imoveis_dd').select('*').order('created_at', { ascending: false });
    if (isAdmin && selectedClient) {
      q = q.eq('user_id', selectedClient);
      qR = qR.eq('user_id', selectedClient);
      qO = qO.eq('user_id', selectedClient);
      qM = qM.eq('user_id', selectedClient);
      qP = qP.eq('user_id', selectedClient);
      qD = qD.eq('user_id', selectedClient);
      qDD = qDD.eq('user_id', selectedClient);
    }
    const [{ data: i }, { data: r }, { data: o }, { data: m }, { data: p }, { data: dv }, { data: dd }] = await Promise.all([q, qR, qO, qM, qP, qD, qDD]);
    setImoveis(i || []);
    setRecibos(r || []);
    setOcorrencias(o || []);
    setManutencoes(m || []);
    setPipeline(p || []);
    setDividas(dv || []);
    setDDItems(dd || []);
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
  async function savePipeline(data) {
    await supabase.from('imoveis_pipeline').insert({ ...data, user_id: user.id });
    await loadData();
  }
  async function updatePipeline(id, data) {
    await supabase.from('imoveis_pipeline').update(data).eq('id', id);
    await loadData();
  }
  async function deletePipeline(id) {
    if (!confirm('Remover este deal?')) return;
    await supabase.from('imoveis_pipeline').delete().eq('id', id);
    await loadData();
  }
  async function saveDD(data) {
    await supabase.from('imoveis_dd').insert({ ...data, user_id: user.id });
    await loadData();
  }
  async function updateDD(id, data) {
    await supabase.from('imoveis_dd').update(data).eq('id', id);
    await loadData();
  }

  // ============================================================
  // AUTO-ESTIMATE: avalia automaticamente imóveis sem valor_mercado
  // ============================================================
  const autoEstimateRef = useRef(new Set());
  const [autoEstimating, setAutoEstimating] = useState(0);

  useEffect(() => {
    if (!imoveis.length || loading) return;
    const missing = imoveis.filter(im =>
      !im.valor_mercado && im.logradouro && im.cidade && !autoEstimateRef.current.has(im.id)
    );
    if (!missing.length) return;

    // Estimate sequentially (1 at a time) to avoid overloading Gemini
    (async () => {
      for (const im of missing) {
        if (autoEstimateRef.current.has(im.id)) continue;
        autoEstimateRef.current.add(im.id);
        setAutoEstimating(prev => prev + 1);
        try {
          const res = await fetch('/api/real-estate-estimate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              logradouro: im.logradouro, numero: im.numero,
              bairro: im.bairro, cidade: im.cidade, uf: im.uf,
              tipo: im.tipo, uso: im.uso, area_m2: Number(im.area_m2) || 70,
              padrao: im.padrao || 'Médio',
            }),
          });
          const data = await res.json();
          if (!data.error && data.valor_mercado) {
            await supabase.from('imoveis').update({
              valor_mercado: data.valor_mercado,
              aluguel: im.aluguel || data.aluguel_estimado || 0,
              iptu_anual: im.iptu_anual || data.iptu_estimado_anual || 0,
              condominio_mensal: im.condominio_mensal || data.condominio_estimado || 0,
            }).eq('id', im.id);
            // Update local state without full reload
            setImoveis(prev => prev.map(p => p.id === im.id ? {
              ...p,
              valor_mercado: data.valor_mercado,
              aluguel: p.aluguel || data.aluguel_estimado || 0,
              iptu_anual: p.iptu_anual || data.iptu_estimado_anual || 0,
              condominio_mensal: p.condominio_mensal || data.condominio_estimado || 0,
            } : p));
          }
        } catch (err) {
          console.error('Auto-estimate error for', im.nome || im.logradouro, err);
        }
        setAutoEstimating(prev => prev - 1);
      }
    })();
  }, [imoveis, loading]);

  if (!authChecked) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>Carregando...</div>;
  if (!user) {
    // Redirect to main page for login
    if (typeof window !== 'undefined') window.location.href = '/';
    return null;
  }

  const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.dashboard },
    { id: 'portfolio', label: 'Portfólio', icon: Icons.building },
    { id: 'operacional', label: 'Operacional', icon: Icons.wrench },
    { id: 'financeiro', label: 'Financeiro', icon: Icons.calculator },
    { id: 'valuation', label: 'Valuation', icon: Icons.chart },
    { id: 'pipeline', label: 'Pipeline', icon: Icons.pipeline },
    { id: 'relatorio', label: 'Relatório', icon: Icons.report },
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
            {tab === 'dashboard' && <DashboardTab imoveis={imoveis} autoEstimating={autoEstimating} />}
            {tab === 'portfolio' && <PortfolioWrapper imoveis={imoveis} onSave={saveImovel} onEdit={editImovel} onDelete={deleteImovel} user={user} ddItems={ddItems} onSaveDD={saveDD} onUpdateDD={updateDD} />}
            {tab === 'operacional' && <OperacionalTab imoveis={imoveis} recibos={recibos} ocorrencias={ocorrencias} manutencoes={manutencoes} onSaveRecibo={saveRecibo} onSaveOcorrencia={saveOcorrencia} onSaveManutencao={saveManutencao} onUpdateImovel={updateImovel} />}
            {tab === 'financeiro' && <FinanceiroWrapper imoveis={imoveis} dividas={dividas} manutencoes={manutencoes} />}
            {tab === 'valuation' && <ValuationWrapper imoveis={imoveis} />}
            {tab === 'pipeline' && <PipelineTab pipeline={pipeline} onSavePipeline={savePipeline} onUpdatePipeline={updatePipeline} onDeletePipeline={deletePipeline} />}
            {tab === 'relatorio' && <RelatorioTab imoveis={imoveis} recibos={recibos} manutencoes={manutencoes} />}
          </>
        )}
      </main>
    </div>
  );
}
