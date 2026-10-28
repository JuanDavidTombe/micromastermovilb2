import React from 'react';

export function ModuleError({
  onReload,
  title = 'Error de conexión con el servidor',
  detail = 'No fue posible cargar este módulo. El muelle no puede quedar bloqueado: recarga e inténtalo de nuevo.',
}) {
  return (
    <div className="flex items-center justify-center min-h-[52vh] px-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-red-200 p-8 text-center shadow-sm">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-2xl">
          <i className="bi bi-hdd-network" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-2">{detail}</p>
        <button
          type="button"
          onClick={onReload}
          className="mt-6 inline-flex items-center gap-2 bg-lime-400 hover:bg-lime-500 text-slate-900 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
        >
          <i className="bi bi-arrow-clockwise" aria-hidden="true" />
          Recargar Módulo
        </button>
      </div>
    </div>
  );
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // El recuadro amigable sustituye la pantalla blanca; no re-lanzamos el error.
  }

  handleReload = () => {
    this.setState({ hasError: false });
    if (typeof this.props.onReload === 'function') {
      this.props.onReload();
    }
  };

  render() {
    if (this.state.hasError) {
      return <ModuleError onReload={this.handleReload} />;
    }

    return this.props.children;
  }
}
