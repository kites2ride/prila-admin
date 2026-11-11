import { useState } from 'react';
import { ConfigEditorPage } from './ConfigEditorPage';

export function AppConfigPage() {
  const [which, setWhich] = useState<'customer' | 'pilot'>('customer');
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm">
        <button
          type="button"
          className={`rounded-full px-4 py-1.5 ${which === 'customer' ? 'bg-violet-600 text-white' : 'text-slate-600'}`}
          onClick={() => setWhich('customer')}
        >
          Customer
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-1.5 ${which === 'pilot' ? 'bg-violet-600 text-white' : 'text-slate-600'}`}
          onClick={() => setWhich('pilot')}
        >
          Pilot
        </button>
      </div>
      {which === 'customer' ? (
        <ConfigEditorPage
          title="Customer app config"
          configKey="app_config_customer"
          description="Feature flags, languages (en/te), home tiles."
        />
      ) : (
        <ConfigEditorPage
          title="Pilot app config"
          configKey="app_config_pilot"
          description="KYC document lists, location interval, languages."
        />
      )}
    </div>
  );
}
