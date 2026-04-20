import type { ReactNode } from 'react';

type AppPageHeaderProps = {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export default function AppPageHeader({ kicker, title, description, actions }: AppPageHeaderProps) {
  return (
    <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        {kicker && <div className="kv-kicker" style={{ marginBottom: 'var(--space-sm)' }}>{kicker}</div>}
        <h1 style={{ fontSize: '1.5rem', letterSpacing: '-0.02em' }}>{title}</h1>
        {description && (
          <p style={{ marginTop: 'var(--space-sm)', maxWidth: '42rem' }}>{description}</p>
        )}
      </div>
      {actions ? <div style={{ flexShrink: 0 }}>{actions}</div> : null}
    </div>
  );
}
