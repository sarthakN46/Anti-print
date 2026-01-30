import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
         <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-800">
            <div className="text-center p-8 bg-white rounded-2xl shadow-xl">
               <h1 className="text-2xl font-bold mb-2">Something went wrong.</h1>
               <p className="text-slate-500 mb-4">Please refresh the page.</p>
               <button onClick={() => window.location.reload()} className="btn btn-primary">Refresh</button>
            </div>
         </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
