import { useState } from 'react';
import { Settings2, Save, QrCode, RefreshCw, Loader2 } from 'lucide-react';
import { inputCls, labelCls, btnGold } from '../shared';
import type { ModuleProps } from '../Layout';

export function IntegrationsModule({ success }: ModuleProps) {
  const [provider, setProvider] = useState('evolution');
  const [evoUrl, setEvoUrl] = useState('');
  const [evoToken, setEvoToken] = useState('');
  const [zapiUrl, setZapiUrl] = useState('');
  const [zapiId, setZapiId] = useState('');
  const [zapiToken, setZapiToken] = useState('');
  const [metaPhoneId, setMetaPhoneId] = useState('');
  const [metaWabaId, setMetaWabaId] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => { setSaving(false); success('Configurações de integração salvas!'); }, 800);
  };

  const generateQR = () => {
    setQrLoading(true);
    setTimeout(() => { setQrData('iVBORw0KGgoAAAANSUhEUgAA'); setQrLoading(false); }, 1000);
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 text-[#D4AF37]">
          <Settings2 className="w-4 h-4" /> Roteamento Global do Gateway de Mensagens
        </h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className={labelCls}>Provedor Ativo</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className={inputCls}>
              <option value="evolution">Evolution API (Padrão Centralizado)</option>
              <option value="zapi">Z-API / Zapi / Z-PRO</option>
              <option value="meta">Meta Cloud API (Oficial Corporativa)</option>
            </select>
          </div>

          {provider === 'evolution' && (
            <div className="space-y-3 p-3 bg-slate-950 rounded-lg border border-slate-800/60 animate-fade-in">
              <div>
                <label className={labelCls}>Evolution Base URL</label>
                <input className={inputCls} value={evoUrl} onChange={(e) => setEvoUrl(e.target.value)} placeholder="https://suaevolution.com" />
              </div>
              <div>
                <label className={labelCls}>Global Master Token</label>
                <input type="password" className={inputCls} value={evoToken} onChange={(e) => setEvoToken(e.target.value)} placeholder="Token de acesso global" />
              </div>
            </div>
          )}
          {provider === 'zapi' && (
            <div className="space-y-3 p-3 bg-slate-950 rounded-lg border border-slate-800/60 animate-fade-in">
              <div>
                <label className={labelCls}>Z-API Base URL</label>
                <input className={inputCls} value={zapiUrl} onChange={(e) => setZapiUrl(e.target.value)} placeholder="https://api.z-api.com" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Instance ID</label>
                  <input className={inputCls} value={zapiId} onChange={(e) => setZapiId(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Instance Token</label>
                  <input type="password" className={inputCls} value={zapiToken} onChange={(e) => setZapiToken(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          {provider === 'meta' && (
            <div className="space-y-3 p-3 bg-slate-950 rounded-lg border border-slate-800/60 animate-fade-in">
              <div>
                <label className={labelCls}>Phone Number ID</label>
                <input className={inputCls} value={metaPhoneId} onChange={(e) => setMetaPhoneId(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Business Account ID</label>
                <input className={inputCls} value={metaWabaId} onChange={(e) => setMetaWabaId(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Permanent Access Token</label>
                <input type="password" className={inputCls} value={metaToken} onChange={(e) => setMetaToken(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            {!qrData ? (
              <button type="button" onClick={generateQR} disabled={qrLoading} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50">
                {qrLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5 text-[#D4AF37]" />}
                {qrLoading ? 'Gerando...' : 'Gerar QR Code de Conexão'}
              </button>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center min-h-[250px] gap-3 animate-fade-in">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Instância Pareada
                </div>
                <img src={`data:image/png;base64,${qrData}`} alt="QR Code" className="w-40 h-40 rounded-lg border border-slate-800" />
                <p className="text-[10px] text-slate-500 animate-pulse">Aguardando leitura do QR Code...</p>
                <button type="button" onClick={() => setQrData(null)} className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> Gerar novo QR Code
                </button>
              </div>
            )}
          </div>

          <button type="submit" disabled={saving} className={btnGold + ' w-full justify-center'}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Provedor de Mensagens Global
          </button>
        </form>
      </div>

      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Integrações Futuras</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
            <span className="text-xs text-slate-300">Mapas / Geolocalização</span>
            <span className="text-[10px] text-slate-600 font-bold">Em breve</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
            <span className="text-xs text-slate-300">Gateway de Pagamento (Asaas / Stripe)</span>
            <span className="text-[10px] text-slate-600 font-bold">Em breve</span>
          </div>
        </div>
      </div>
    </div>
  );
}
