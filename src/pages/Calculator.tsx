import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { apiFetch } from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type DoseMode = 'per_ha' | 'per_100l';
type DoseUnit = 'mL' | 'L' | 'g' | 'kg';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCurrency(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Input Field ───────────────────────────────────────────────────────────────
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  borderColor: 'var(--border)',
  color: 'var(--text, #e2e8f0)',
  background: 'transparent',
};

const selectStyle: React.CSSProperties = {
  borderColor: 'var(--border)',
  color: 'var(--text, #e2e8f0)',
  background: 'var(--surface)',
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Calculator() {
  const navigate = useNavigate();
  const { activeFieldId, fields } = useAppStore();
  const activeField = fields.find((f) => f.id === activeFieldId) ?? null;

  // Application data
  const [area, setArea] = useState<string>(
    activeField?.areaHa != null ? String(activeField.areaHa) : ''
  );
  const [volumePerHa, setVolumePerHa] = useState<string>('200');
  const [mode, setMode] = useState<DoseMode>('per_ha');
  const [tankCapacity, setTankCapacity] = useState<string>('400');

  // Product data
  const [productName, setProductName] = useState('');
  const [dose, setDose] = useState<string>('');
  const [unit, setUnit] = useState<DoseUnit>('L');
  const [unitPrice, setUnitPrice] = useState<string>('');

  // Parsed numbers (NaN-safe)
  const areaNum = parseFloat(area) || 0;
  const volumePerHaNum = parseFloat(volumePerHa) || 0;
  const doseNum = parseFloat(dose) || 0;
  const tankCapNum = parseFloat(tankCapacity) || 400;
  const unitPriceNum = parseFloat(unitPrice) || 0;

  // Live calculations
  const results = useMemo(() => {
    const totalCalda = volumePerHaNum * areaNum; // L

    let doseTotal: number;
    if (mode === 'per_ha') {
      doseTotal = doseNum * areaNum;
    } else {
      // per 100L of calda
      doseTotal = doseNum * (totalCalda / 100);
    }

    const tanques = tankCapNum > 0 ? Math.ceil(totalCalda / tankCapNum) : 0;
    const custo = unitPriceNum > 0 ? doseTotal * unitPriceNum : null;

    return { totalCalda, doseTotal, tanques, custo };
  }, [areaNum, volumePerHaNum, doseNum, mode, tankCapNum, unitPriceNum]);

  // ── Análise com Tracto IA — usa contexto completo do talhão + cálculo ──────
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const analyzeWithAI = async () => {
    if (!activeField) {
      setAiError('Selecione um talhão ativo em Mapa & Talhões antes de pedir recomendação.');
      return;
    }
    setAiLoading(true); setAiError(null); setAiResult(null);
    try {
      const body = {
        lat: activeField.lat,
        lng: activeField.lng,
        field_name: activeField.name ?? 'Talhão',
        crop_type: activeField.cultura ?? undefined,
        date_range_days: 30,
        boundaries: activeField.boundaries ?? null,
        planting_date: activeField.dataPlantio ?? undefined,
        variety: activeField.variedade ?? undefined,
        area_ha: areaNum || activeField.areaHa,
        // Contexto extra da Calculator pra IA usar na recomendação:
        application_context: {
          product: productName || null,
          dose: doseNum || null,
          unit,
          volume_l_per_ha: volumePerHaNum,
          total_calda_l: results.totalCalda,
          dose_total: results.doseTotal,
          tanques: results.tanques,
          tank_capacity_l: tankCapNum,
          custo_estimado_brl: results.custo,
        },
      };
      const resp = await apiFetch<{ ai_report?: string }>('/api/analyze-field', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setAiResult(resp?.ai_report ?? 'Análise não disponível.');
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Erro na análise');
    } finally {
      setAiLoading(false);
    }
  };

  const copyResume = () => {
    const lines = [
      `Calculadora de Insumos — Tracto AgTech`,
      ``,
      `Produto: ${productName || '(não informado)'}`,
      `Área: ${areaNum} ha`,
      `Volume de calda: ${fmt(results.totalCalda, 0)} L total (${volumePerHaNum} L/ha)`,
      `Dose total do produto: ${fmt(results.doseTotal, 2)} ${unit}`,
      `Número de tanques: ${results.tanques} (tanque de ${tankCapNum} L)`,
    ];
    if (results.custo != null) {
      lines.push(`Custo estimado: R$ ${fmtCurrency(results.custo)}`);
    }
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {/* silently fail */});
  };

  const goToFieldLog = () => {
    const params = new URLSearchParams({
      product: productName,
      dose: `${dose} ${unit}`,
      area: area,
    });
    void navigate(`/app/field-log?${params.toString()}`);
  };

  // Navegações contextuais — leva o usuário pra outras telas com talhão ativo
  const goToMap = () => void navigate('/app/dashboard');
  const goToImages = () => void navigate('/app/images');
  const goToWeather = () => void navigate('/app/weather');
  const goToAlerts = () => void navigate('/app/alerts');
  const goToReports = () => void navigate('/app/reports');
  const goToAI = () => {
    const params = new URLSearchParams();
    if (productName) params.set('product', productName);
    if (activeField?.name) params.set('field', activeField.name);
    void navigate(`/app/chat?${params.toString()}`);
  };

  const sectionStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '1rem',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text, #e2e8f0)' }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 px-4 md:px-6 py-4 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--sidebar)' }}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="material-symbols-outlined text-xl"
            style={{ color: 'var(--primary)' }}
          >
            calculate
          </span>
          <h1
            className="text-base font-bold tracking-tight"
            style={{ color: 'var(--text, #e2e8f0)' }}
          >
            Calculadora de Insumos
          </h1>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
          Cálculo em tempo real · sem conexão necessária
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">

          {/* Seção: Dados da Aplicação */}
          <div style={sectionStyle}>
            <p className="text-xs font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>
              Dados da Aplicação
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Área (ha)">
                <input
                  type="number"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  min={0}
                  step="0.01"
                  placeholder={activeField?.areaHa != null ? String(activeField.areaHa) : '0'}
                  className="rounded-xl px-3 py-2 text-sm border outline-none w-full"
                  style={inputStyle}
                />
              </Field>

              <Field label="Volume de calda (L/ha)">
                <input
                  type="number"
                  value={volumePerHa}
                  onChange={(e) => setVolumePerHa(e.target.value)}
                  min={0}
                  step="1"
                  className="rounded-xl px-3 py-2 text-sm border outline-none w-full"
                  style={inputStyle}
                />
              </Field>

              <Field label="Capacidade do pulverizador (L)">
                <input
                  type="number"
                  value={tankCapacity}
                  onChange={(e) => setTankCapacity(e.target.value)}
                  min={1}
                  step="1"
                  className="rounded-xl px-3 py-2 text-sm border outline-none w-full"
                  style={inputStyle}
                />
              </Field>

              <Field label="Modo de dose">
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as DoseMode)}
                  className="rounded-xl px-3 py-2 text-sm border outline-none w-full"
                  style={selectStyle}
                >
                  <option value="per_ha">Por hectare (dose/ha)</option>
                  <option value="per_100l">Por 100 L de calda</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Seção: Produto */}
          <div style={sectionStyle}>
            <p className="text-xs font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>
              Produto
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Nome do produto">
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Ex: Roundup WG, Ubyfol, Engeo Pleno..."
                    className="rounded-xl px-3 py-2 text-sm border outline-none w-full"
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Dose">
                <input
                  type="number"
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  min={0}
                  step="0.001"
                  placeholder="0"
                  className="rounded-xl px-3 py-2 text-sm border outline-none w-full"
                  style={inputStyle}
                />
              </Field>

              <Field label="Unidade">
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as DoseUnit)}
                  className="rounded-xl px-3 py-2 text-sm border outline-none w-full"
                  style={selectStyle}
                >
                  <option value="mL">mL</option>
                  <option value="L">L</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                </select>
              </Field>

              <div className="col-span-2">
                <Field label={`Preço unitário (R$ por ${unit}) — opcional`}>
                  <input
                    type="number"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    min={0}
                    step="0.01"
                    placeholder="0,00"
                    className="rounded-xl px-3 py-2 text-sm border outline-none w-full"
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Resultado */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-4"
            style={{
              background: 'rgba(236,91,19,0.08)',
              border: '2px solid rgba(236,91,19,0.35)',
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="material-symbols-outlined text-xl"
                style={{ color: 'var(--primary)' }}
              >
                bar_chart
              </span>
              <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
                Resultado
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <ResultItem
                icon="water"
                label="Volume total de calda"
                value={`${fmt(results.totalCalda, 0)} L`}
              />
              <ResultItem
                icon="science"
                label={`Dose total do produto (${unit})`}
                value={`${fmt(results.doseTotal, 2)} ${unit}`}
              />
              <ResultItem
                icon="local_shipping"
                label={`Tanques (${tankCapNum} L cada)`}
                value={String(results.tanques)}
              />
              {results.custo != null && (
                <ResultItem
                  icon="payments"
                  label="Custo estimado"
                  value={`R$ ${fmtCurrency(results.custo)}`}
                />
              )}
            </div>

            {/* Mode annotation */}
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {mode === 'per_ha'
                ? `Dose total = ${doseNum} ${unit}/ha × ${areaNum} ha`
                : `Dose total = ${doseNum} ${unit}/100L × (${fmt(results.totalCalda, 0)} L ÷ 100)`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={copyResume}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-80 transition-all"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text, #e2e8f0)',
              }}
            >
              <span className="material-symbols-outlined text-base">content_copy</span>
              Copiar resumo
            </button>
            <button
              onClick={goToFieldLog}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all"
              style={{ background: 'var(--primary)', color: '#fff' }}
            >
              <span className="material-symbols-outlined text-base">book</span>
              Salvar no Caderno
            </button>
            <button
              onClick={() => void analyzeWithAI()}
              disabled={aiLoading || !activeField}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
              style={{ background: 'rgba(236,91,19,0.15)', border: '1px solid rgba(236,91,19,0.35)', color: '#ec5b13' }}
            >
              {aiLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                  Analisando…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">auto_awesome</span>
                  Recomendação Tracto IA
                </>
              )}
            </button>
          </div>

          {/* ── Acesso rápido ao resto do sistema com contexto do cálculo ── */}
          <div className="mt-4 rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-sm" style={{ color: 'var(--muted)' }}>hub</span>
              <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                Ver no contexto do talhão
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              <button onClick={goToMap}
                className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all hover:opacity-90"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text, #e2e8f0)' }}>
                <span className="material-symbols-outlined text-base" style={{ color: '#60a5fa' }}>map</span>
                Mapa
              </button>
              <button onClick={goToImages}
                className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all hover:opacity-90"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text, #e2e8f0)' }}>
                <span className="material-symbols-outlined text-base" style={{ color: '#22c55e' }}>satellite_alt</span>
                NDVI / Imagens
              </button>
              <button onClick={goToWeather}
                className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all hover:opacity-90"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text, #e2e8f0)' }}>
                <span className="material-symbols-outlined text-base" style={{ color: '#fbbf24' }}>wb_sunny</span>
                Clima
              </button>
              <button onClick={goToAlerts}
                className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all hover:opacity-90"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text, #e2e8f0)' }}>
                <span className="material-symbols-outlined text-base" style={{ color: '#f87171' }}>notifications_active</span>
                Alertas
              </button>
              <button onClick={goToReports}
                className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all hover:opacity-90"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text, #e2e8f0)' }}>
                <span className="material-symbols-outlined text-base" style={{ color: '#a78bfa' }}>insights</span>
                Relatórios
              </button>
              <button onClick={goToAI}
                className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all hover:opacity-90"
                style={{ background: 'rgba(236,91,19,0.12)', border: '1px solid rgba(236,91,19,0.35)', color: 'var(--primary)' }}>
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                Tracto IA
              </button>
            </div>
          </div>

          {/* ── Resultado da Tracto IA ───────────────────────────────────── */}
          {(aiResult || aiError) && (
            <div
              className="mt-4 rounded-2xl p-4"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>auto_awesome</span>
                <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--primary)' }}>
                  Recomendação Tracto IA
                </h3>
                {activeField && (
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--muted)' }}>
                    {activeField.name}{activeField.cultura ? ` · ${activeField.cultura}` : ''}
                  </span>
                )}
              </div>
              {aiError && (
                <div className="flex items-center gap-2 text-xs" style={{ color: '#f87171' }}>
                  <span className="material-symbols-outlined text-sm">error</span>
                  {aiError}
                </div>
              )}
              {aiResult && (
                <div className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text, #e2e8f0)' }}>
                  {aiResult}
                </div>
              )}
              {aiResult && (
                <p className="text-[10px] mt-3 pt-3 border-t" style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}>
                  IA considerou: imagens Sentinel-2 do talhão, dados meteorológicos atuais, cultura{activeField?.dataPlantio ? `, data de plantio (${activeField.dataPlantio})` : ''}{productName ? `, produto (${productName})` : ''} e janela de pulverização.
                </p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Result Item ───────────────────────────────────────────────────────────────
function ResultItem({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1"
      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(236,91,19,0.15)' }}
    >
      <div className="flex items-center gap-1">
        <span
          className="material-symbols-outlined text-sm"
          style={{ color: 'var(--primary)' }}
        >
          {icon}
        </span>
        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
          {label}
        </p>
      </div>
      <p className="text-base font-black" style={{ color: 'var(--text, #e2e8f0)' }}>
        {value}
      </p>
    </div>
  );
}
