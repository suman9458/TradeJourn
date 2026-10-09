import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="dashboard-panel"
          style={{
            margin: '30px auto',
            maxWidth: '680px',
            textAlign: 'center',
            padding: '40px 24px',
            border: '1px solid rgba(255, 51, 102, 0.3)',
            background: 'rgba(255, 51, 102, 0.04)',
            borderRadius: '16px'
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(255, 51, 102, 0.15)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px'
            }}
          >
            <AlertTriangle size={28} color="var(--loss, #ff3366)" />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '8px', color: '#fff' }}>
            {this.props.title || 'View Render Notice'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '460px', margin: '0 auto 20px', lineHeight: 1.5 }}>
            {this.state.error?.message || 'A temporary display issue occurred while processing dynamic trade data.'}
          </p>
          <button
            onClick={this.handleReset}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} />
            <span>Reload & Refresh View</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
