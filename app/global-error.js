'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08090C', color: '#E8E9ED', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 480, padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>W</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Erro crítico</h2>
          <p style={{ fontSize: 14, color: '#8B8D97', lineHeight: 1.7, marginBottom: 32 }}>
            Algo inesperado aconteceu. Por favor, recarregue a página.
          </p>
          <button
            onClick={reset}
            style={{ padding: '12px 32px', fontSize: 14, fontWeight: 600, color: '#fff', background: '#2E9E6E', border: 'none', borderRadius: 10, cursor: 'pointer' }}
          >
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
