import { useRouteError, Link, isRouteErrorResponse } from 'react-router';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';

export function ErrorBoundary() {
  const error = useRouteError();
  
  let errorMessage: string;
  let errorStatus: string | number = 'Error';

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.statusText || error.data;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else {
    errorMessage = 'Ocorreu um erro desconhecido';
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {errorStatus}
        </h1>
        
        <p className="text-slate-600 mb-6">
          {errorMessage}
        </p>
        
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          
          <Link
            to="/"
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Home className="w-4 h-4" />
            Página Inicial
          </Link>
        </div>
      </div>
    </div>
  );
}
