import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', background: '#fff', padding: 32, borderRadius: 16, margin: 32 }}>
          <h2>React Error Caught</h2>
          <pre>{String(this.state.error)}</pre>
          <p>Check the console for more details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
