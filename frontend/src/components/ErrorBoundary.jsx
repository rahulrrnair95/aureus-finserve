import { Component } from 'react';

/** Shows a reload prompt instead of a blank screen when a page fails to render or load. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="section">
        <div className="container center" role="alert">
          <h1>This page didn’t load</h1>
          <p className="lead" style={{ margin: '0 auto 2rem' }}>
            Please check your connection and try again.
          </p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </section>
    );
  }
}
