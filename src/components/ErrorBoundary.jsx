import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ margin: 24, textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: 'var(--text-muted)' }}>Try refreshing the page. Your portfolio is saved in this browser.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Refresh
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
