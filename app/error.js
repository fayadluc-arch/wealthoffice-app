'use client';

export default function Error({ error, reset }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08090C', color: '#E8E9ED', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: 40 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(248,113,113,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, fontFamily: 'Playfair Display, serif' }}>Algo deu errado</h2>
        <p style={{ fontSize: 14, color: '#8B8D97', lineHeight: 1.7, marginBottom: 32 }}>
          Ocorreu um erro inesperado. Nossa equipe foi notificada.
        </p>
        <button
          onClick={reset}
          style={{ padding: '12px 32px', fontSize: 14, fontWeight: 600, color: '#fff', background: '#2E9E6E', border: 'none', borderRadius: 10, cursor: 'pointer' }}
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
