import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import useAppStore from '../store/useAppStore';
import { apiFetch, buildAuthHeaders, API_URL, type FieldIntelligenceSnapshot } from '../services/api';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  text: string;
  time: string;
  imagePreview?: string;
}

interface SavedConversation {
  conversation_id: string;
  title: string;
  messages: { role: string; text: string }[];
  field_id?: string | null;
  farm_context?: string;
  created_at: string;
  updated_at: string;
}

interface ChatApiResponse {
  reply: string;
  used_field_id: string;
  used_field_name: string;
  used_variety?: string | null;
  used_area_ha?: number | null;
  used_planting_date?: string | null;
  snapshot_updated_at?: string | null;
  s1_scene_date?: string | null;
  s2_scene_date?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const nowTime = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const nowISO = () => new Date().toISOString();

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'ontem';
  return `há ${days} dias`;
}

const INITIAL_MSG = (time: string): Message => ({
  role: 'assistant',
  text: 'Olá! Sou a **Tracto IA**, sua analista agronômica. Posso ajudar com análise de solo, NDVI, irrigação, pragas, colheita e clima.\n\n📸 **Dica:** Envie uma foto da lavoura para análise visual de pragas e doenças.\n\nComo posso ajudar?',
  time,
});

function buildFarmContextFromSnapshot(snapshot: FieldIntelligenceSnapshot): string {
  const weather = snapshot.weather || {};
  const satellite = snapshot.satellite || {};
  const analysis = snapshot.analysis || {};

  const safe = (value: unknown, fallback = 'N/D') => {
    if (value == null) return fallback;
    const text = String(value).trim();
    return text.length > 0 ? text : fallback;
  };

  const toRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  const sprayWindow = toRecord(toRecord(analysis).spray_window).label;
  const frostRisk = toRecord(toRecord(analysis).frost_risk).label;
  const waterStress = toRecord(toRecord(analysis).water_stress).label;
  const alertTitles = Array.isArray(snapshot.alerts)
    ? snapshot.alerts
        .map((item) => safe((item as Record<string, unknown>).title, '').trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  return [
    `TALHÃO ATIVO: ${snapshot.field_name} | ${safe(snapshot.crop_type)} | ${snapshot.area_ha != null ? `${Number(snapshot.area_ha).toFixed(1)} ha` : 'Área N/D'} | ${safe(snapshot.planting_date)}`,
    `Variedade: ${safe(snapshot.variety)}`,
    `Clima atual: Temp ${safe((weather as Record<string, unknown>).temperature)}C, Umidade ${safe((weather as Record<string, unknown>).humidity)}%, Vento ${safe((weather as Record<string, unknown>).wind_speed)} km/h`,
    `Previsão resumida: ${safe((weather as Record<string, unknown>).forecast_7d, 'Previsão indisponível')}`,
    `Última cena Sentinel: ${safe((satellite as Record<string, unknown>).scene_date_br)} | Nuvens: ${safe((satellite as Record<string, unknown>).cloud_coverage)}`,
    `Cache da imagem: hit=${safe((satellite as Record<string, unknown>).cache_hit)} | salvo=${safe((satellite as Record<string, unknown>).image_cached)} | path=${safe((satellite as Record<string, unknown>).cache_path)} | gerado=${safe((satellite as Record<string, unknown>).generated_at)}`,
    `Análise consolidada: Pulverização ${safe(sprayWindow)}, Geada ${safe(frostRisk)}, Estresse hídrico ${safe(waterStress)}`,
    `Alertas relevantes: ${alertTitles.length ? alertTitles.join(' | ') : 'Nenhum alerta relevante no momento.'}`,
    `Atualizado em: ${safe(snapshot.updated_at)}`,
  ].join('\n');
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function Chat() {
  const {
    addMessage,
    clearChat,
    fields,
    activeFieldId,
    weatherCache,
    fetchFieldIntelligence,
    currentSatelliteScene,
  } = useAppStore();

  // Conversation state
  const [conversationId, setConversationId] = useState<string>(() => uuidv4());
  const [conversationCreatedAt, setConversationCreatedAt] = useState<string>(() => nowISO());
  const [messages, setMessages] = useState<Message[]>(() => [INITIAL_MSG(nowTime())]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [contextUsedLabel, setContextUsedLabel] = useState<string | null>(null);
  const [showHint, setShowHint] = useState<boolean>(() => !sessionStorage.getItem('chat-hint-dismissed'));

  // Sidebar: saved conversations
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Image
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mimeType: string;
    preview: string;
    name: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousActiveFieldIdRef = useRef<string | null>(activeFieldId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    };
  }, [pendingImage]);

  // ── Load saved conversations on mount ──────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const data = await apiFetch<{ conversations: SavedConversation[] }>('/api/conversations');
      setSavedConversations(data.conversations || []);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Nao foi possivel carregar as conversas salvas.');
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const persistConversation = useCallback(
    async (msgs: Message[], cid: string, createdAt: string, farmContextForSave: string, fieldIdForSave: string | null) => {
      const userMessages = msgs.filter((m) => m.role !== 'assistant' || msgs.indexOf(m) > 0);
      if (userMessages.length < 2) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const firstUserMsg = msgs.find((m) => m.role === 'user');
        const title = firstUserMsg
          ? firstUserMsg.text.slice(0, 40) + (firstUserMsg.text.length > 40 ? '...' : '')
          : 'Nova Conversa';

        await apiFetch('/api/conversations/save', {
          method: 'POST',
          body: JSON.stringify({
            conversation_id: cid,
            title,
            messages: msgs.map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              text: m.text,
            })),
            field_id: fieldIdForSave,
            farm_context: farmContextForSave,
            created_at: createdAt,
            updated_at: nowISO(),
          }),
        });
        await loadConversations();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Nao foi possivel sincronizar a conversa.';
        setApiError(`Falha ao salvar conversa: ${message}`);
      }
    },
    [loadConversations]
  );

  // ── Start new conversation ─────────────────────────────────────────────────
  const startNewConversation = useCallback(() => {
    const newId = uuidv4();
    const createdAt = nowISO();
    setConversationId(newId);
    setConversationCreatedAt(createdAt);
    setMessages([INITIAL_MSG(nowTime())]);
    setActiveConversationId(null);
    clearChat();
    setApiError(null);
    setInput('');
    setPendingImage((current) => {
      if (current) URL.revokeObjectURL(current.preview);
      return null;
    });
    setContextUsedLabel(null);
  }, [clearChat]);

  useEffect(() => {
    const previousFieldId = previousActiveFieldIdRef.current;
    if (previousFieldId === activeFieldId) {
      return;
    }

    previousActiveFieldIdRef.current = activeFieldId;

    startNewConversation();
    if (activeFieldId) {
      void fetchFieldIntelligence(activeFieldId, false); // usa cache — snapshot completo é construído pelo backend
    }
  }, [activeFieldId, fetchFieldIntelligence, startNewConversation]);

  // ── Load a saved conversation ──────────────────────────────────────────────
  const loadConversation = (conv: SavedConversation) => {
    setActiveConversationId(conv.conversation_id);
    setConversationId(conv.conversation_id);
    setConversationCreatedAt(conv.created_at);
    const loaded: Message[] = conv.messages.map((m) => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
      text: m.text,
      time: '',
    }));
    setMessages(loaded.length > 0 ? loaded : [INITIAL_MSG(nowTime())]);
    setInput('');
    setPendingImage(null);
    setApiError(null);
    if (!conv.field_id) {
      setContextUsedLabel('Conversa legado carregada. Novas respostas usarão o talhão ativo atual.');
      return;
    }

    const conversationField = fields.find((field) => field.id === conv.field_id);
    if (!conversationField) {
      setContextUsedLabel('Conversa de talhão removido carregada. Novas respostas usarão o talhão ativo atual.');
      return;
    }

    setContextUsedLabel(`Conversa carregada: ${conversationField.name ?? 'Talhão sem nome'}`);
  };

  // ── Delete conversation ────────────────────────────────────────────────────
  const deleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/conversations/${convId}`, { method: 'DELETE' });
      setSavedConversations((prev) => prev.filter((c) => c.conversation_id !== convId));
      if (activeConversationId === convId) startNewConversation();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Nao foi possivel deletar a conversa.');
    }
  };

  // ── Image handling ─────────────────────────────────────────────────────────
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setApiError('Formato inválido. Use JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setApiError('Imagem muito grande. Máximo: 5MB.');
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      const preview = URL.createObjectURL(file);
      setPendingImage({ base64, mimeType: file.type, preview, name: file.name });
      setApiError(null);
    } catch {
      setApiError('Erro ao processar a imagem.');
    }
    e.target.value = '';
  };

  const removePendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
  };

  // ── Carregar imagem satelital atual para análise ────────────────────────────
  const loadSatelliteImageForChat = async () => {
    if (!currentSatelliteScene || !activeFieldId) return;
    try {
      const headers = await buildAuthHeaders();
      const params = new URLSearchParams({
        field_id: activeFieldId,
        source: currentSatelliteScene.source,
        scene_id: currentSatelliteScene.sceneId,
      });
      if (currentSatelliteScene.sceneDate) params.set('scene_date', currentSatelliteScene.sceneDate);
      const resp = await fetch(`${API_URL}/api/sentinel/overlay?${params.toString()}`, { headers });
      if (!resp.ok) throw new Error(`Erro ${resp.status}`);
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        const preview = URL.createObjectURL(blob);
        if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
        setPendingImage({ base64, mimeType: 'image/png', preview, name: `satelite-${currentSatelliteScene.source}-${currentSatelliteScene.sceneDate ?? 'latest'}.png` });
        const sourceLabel = currentSatelliteScene.source === 's1' ? 'Sentinel-1 (Radar SAR)' : 'Sentinel-2 (Óptico)';
        const dateLabel = currentSatelliteScene.sceneDate_br || currentSatelliteScene.sceneDate || 'data desconhecida';
        const cloudLabel = currentSatelliteScene.cloudCoverage != null ? ` | Nuvens: ${currentSatelliteScene.cloudCoverage}%` : '';
        setInput((prev) => prev || `Analise esta imagem de satélite ${sourceLabel} do meu talhão. Data da passagem: ${dateLabel}${cloudLabel}.`);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Erro ao carregar imagem satelital.');
    }
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if ((!content && !pendingImage) || isLoading) return;

    const selectedField = activeFieldId ? fields.find((field) => field.id === activeFieldId) ?? null : null;
    if (!activeFieldId || !selectedField) {
      setApiError('Selecione um talhão ativo válido no mapa antes de analisar com a IA.');
      return;
    }

    setInput('');
    setApiError(null);

    const imagePreview = pendingImage?.preview;
    const imageBase64 = pendingImage?.base64 ?? null;
    const imageMime = pendingImage?.mimeType ?? 'image/jpeg';
    const capturedImage = pendingImage;
    setPendingImage(null);

    const userMsg: Message = {
      role: 'user',
      text: content || '📸 [Imagem enviada para análise]',
      time: nowTime(),
      imagePreview,
    };

    const newMessages = (prev: Message[]) => [...prev, userMsg];
    setMessages((p) => newMessages(p));
    addMessage('user', userMsg.text);
    setIsLoading(true);

    try {
      const payloadMessages = [
        ...messages
          .filter((m) => m.role !== 'assistant' || messages.indexOf(m) > 0)
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            text: m.text,
          })),
        { role: 'user', text: userMsg.text },
      ];

      // Usa cache (false) — o backend constrói seu próprio snapshot canônico na hora do chat
      const snapshot = await fetchFieldIntelligence(activeFieldId, false);
      if (!snapshot || snapshot.field_id !== activeFieldId) {
        throw new Error('Não foi possível carregar o snapshot do talhão ativo. Selecione o talhão novamente.');
      }

      const farm_context = buildFarmContextFromSnapshot(snapshot);

      const weatherFromSnapshot = snapshot?.weather as Record<string, unknown> | undefined;
      const satelliteFromSnapshot = snapshot?.satellite as Record<string, unknown> | undefined;
      const hourly_weather = weatherFromSnapshot
        ? {
            temperature: Number(weatherFromSnapshot.temperature ?? 0),
            humidity: Number(weatherFromSnapshot.humidity ?? 0),
            wind_speed: Number(weatherFromSnapshot.wind_speed ?? 0),
          }
        : weatherCache
          ? { temperature: weatherCache.temperature, humidity: weatherCache.humidity, wind_speed: weatherCache.windSpeed }
          : null;

      const satellite_context = satelliteFromSnapshot
        ? {
            source: satelliteFromSnapshot.source,
            scene_date: satelliteFromSnapshot.scene_date,
            cloud_coverage: satelliteFromSnapshot.cloud_coverage,
            cache_hit: satelliteFromSnapshot.cache_hit,
            generated_at: satelliteFromSnapshot.generated_at,
            cache_path: satelliteFromSnapshot.cache_path,
          }
        : null;

      const data = await apiFetch<ChatApiResponse>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          field_id: activeFieldId,
          messages: payloadMessages,
          farm_context,
          image_base64: imageBase64,
          image_mime_type: imageMime,
          hourly_weather,
          satellite_context,
        }),
      });

      if (data.used_field_id !== activeFieldId) {
        setApiError('Inconsistência de contexto detectada: o backend respondeu com outro talhão. Resposta bloqueada por segurança.');
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: '⚠️ Segurança de contexto: resposta descartada por divergência de talhão ativo.', time: nowTime() },
        ]);
        return;
      }

      if (capturedImage) URL.revokeObjectURL(capturedImage.preview);

      const aiText = data.reply ?? '';
      const auditBits = [
        data.used_field_name,
        data.used_variety ? `Variedade ${data.used_variety}` : null,
        data.used_area_ha != null ? `${Number(data.used_area_ha).toFixed(2)} ha` : null,
        data.used_planting_date ? `Plantio ${data.used_planting_date}` : null,
      ].filter(Boolean);
      const contextLine = `Contexto usado na resposta: ${auditBits.join(' · ')}`;
      const aiMsg: Message = { role: 'assistant', text: `${contextLine}\n\n${aiText}`, time: nowTime() };
      setContextUsedLabel(contextLine);

      const updatedMessages = [...messages, userMsg, aiMsg];
      setMessages(updatedMessages);
      void persistConversation(updatedMessages, conversationId, conversationCreatedAt, farm_context, activeFieldId);
      addMessage('model', aiText);
      setActiveConversationId(conversationId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setApiError(msg);
      setMessages((p) => [
        ...p,
        { role: 'assistant', text: `⚠️ Erro ao conectar: ${msg}`, time: nowTime() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Sidebar: Histórico ──────────────────────────────────────────── */}
      <div
        className="w-64 flex-shrink-0 flex flex-col border-r"
        style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        {/* New conversation button */}
        <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: 'rgba(236,91,19,0.14)', border: '1px solid rgba(236,91,19,0.22)' }}
          >
            <span>Nova Conversa</span>
            <span className="material-symbols-outlined text-base" style={{ color: '#ec5b13' }}>
              add_comment
            </span>
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest px-2 py-2"
            style={{ color: '#64748b' }}
          >
            Conversas Salvas
          </p>

          {loadingConversations && (
            <div className="flex justify-center py-4">
              <span
                className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#ec5b13', borderTopColor: 'transparent' }}
              />
            </div>
          )}

          {!loadingConversations && !apiError && savedConversations.length === 0 && (
            <p className="text-[10px] px-2 py-3" style={{ color: '#334155' }}>
              Nenhuma conversa salva ainda.
            </p>
          )}


          <div className="space-y-0.5">
            {savedConversations.map((conv) => {
              const isActive = activeConversationId === conv.conversation_id;
              const conversationField = conv.field_id ? fields.find((field) => field.id === conv.field_id) : null;
              const conversationScope = !conv.field_id
                ? 'Legado'
                : conversationField
                  ? conversationField.name ?? 'Talhão sem nome'
                  : 'Talhão removido';
              return (
                <div key={conv.conversation_id} className="group relative">
                  <button
                    onClick={() => loadConversation(conv)}
                    className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                    style={{
                      background: isActive ? 'rgba(236,91,19,0.1)' : 'transparent',
                      border: isActive ? '1px solid rgba(236,91,19,0.3)' : '1px solid transparent',
                    }}
                  >
                    <p
                      className="text-xs font-medium truncate pr-5"
                      style={{ color: isActive ? '#f97316' : '#cbd5e1' }}
                    >
                      {conv.title}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>
                      {relativeDate(conv.updated_at)}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: conv.field_id ? '#64748b' : '#f59e0b' }}>
                      {conversationScope}
                    </p>
                  </button>
                  {/* Delete button — visible on hover */}
                  <button
                    onClick={(e) => deleteConversation(e, conv.conversation_id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                    title="Deletar conversa"
                  >
                    <span className="material-symbols-outlined text-xs">delete</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Context badge */}
          {fields.length > 0 && (
            <div className="mt-4 px-2">
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: '#64748b' }}
              >
                Contexto ativo
              </p>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: '#4ade80' }}>
                  <span className="material-symbols-outlined text-xs">map</span>
                  {fields.length} talhão{fields.length > 1 ? 'ões' : ''}
                </div>
                {weatherCache && (
                  <div className="flex items-center gap-1.5 text-[10px]" style={{ color: '#60a5fa' }}>
                    <span className="material-symbols-outlined text-xs">wb_sunny</span>
                    {Math.round(weatherCache.temperature)}°C · {weatherCache.humidity}%
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* API status */}
        <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-semibold ${
              apiError ? 'text-red-400' : 'text-green-400'
            }`}
            style={{
              background: apiError ? 'rgba(239,68,68,0.08)' : 'rgba(74,222,128,0.07)',
              border: `1px solid ${apiError ? 'rgba(239,68,68,0.18)' : 'rgba(74,222,128,0.15)'}`,
            }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                apiError ? 'bg-red-400' : 'bg-green-400 animate-pulse'
              }`}
            />
            {apiError ? 'Erro de API' : 'Servidor conectado'}
          </div>
        </div>
      </div>

      {/* ── Chat Principal ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--bg)' }}>
        {/* Header */}
        <div
          className="px-5 py-3 border-b flex items-center justify-between flex-shrink-0"
          style={{
            borderColor: 'rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.018)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(236,91,19,0.15)' }}
            >
              <span className="material-symbols-outlined text-xl" style={{ color: '#ec5b13' }}>
                smart_toy
              </span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Tracto IA</h2>
              <p className="text-[10px] flex items-center gap-1.5" style={{ color: '#64748b' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                {pendingImage
                  ? 'Analista Agronômica · Claude Sonnet · Visão ativa nesta mensagem'
                  : 'Analista Agronômica · Claude Sonnet · Sem imagem anexada'}
              </p>
              {contextUsedLabel && (
                <p className="text-[10px] mt-1" style={{ color: '#4ade80' }}>
                  {contextUsedLabel}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={startNewConversation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#94a3b8',
            }}
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Reiniciar
          </button>
        </div>

        {/* Hint banner */}
        {showHint && (
          <div
            className="flex items-start gap-2 px-4 py-2.5 flex-shrink-0 border-b"
            style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)' }}
          >
            <span className="material-symbols-outlined text-sm mt-0.5 flex-shrink-0" style={{ color: '#4ade80' }}>info</span>
            <p className="flex-1 text-[10px] leading-relaxed" style={{ color: '#64748b' }}>
              A Tracto IA analisa seu talhão com dados reais do Sentinel-2 e clima — independente da camada visual do mapa.
            </p>
            <button
              onClick={() => { sessionStorage.setItem('chat-hint-dismissed', '1'); setShowHint(false); }}
              className="flex-shrink-0 hover:text-white transition-colors ml-1"
              style={{ color: '#334155' }}
              title="Dispensar"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
          {messages.map((msg, i) =>
            msg.role === 'assistant' ? (
              <div key={i} className="flex gap-3 max-w-2xl">
                <div
                  className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ background: 'rgba(236,91,19,0.15)' }}
                >
                  <span className="material-symbols-outlined text-sm" style={{ color: '#ec5b13' }}>
                    smart_toy
                  </span>
                </div>
                <div className="flex-1 space-y-1">
                  <div
                    className="px-4 py-3 rounded-2xl rounded-tl-none text-sm leading-relaxed prose prose-sm prose-invert max-w-none prose-p:my-1"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: '#cbd5e1',
                    }}
                  >
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                  {msg.time && (
                    <p className="text-[10px] ml-1" style={{ color: '#334155' }}>
                      Tracto IA · {msg.time}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-3 max-w-2xl ml-auto flex-row-reverse">
                <div
                  className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <span className="material-symbols-outlined text-sm" style={{ color: '#64748b' }}>
                    person
                  </span>
                </div>
                <div className="flex-1 flex flex-col items-end space-y-1">
                  {msg.imagePreview && (
                    <img
                      src={msg.imagePreview}
                      alt="Imagem enviada"
                      className="max-w-[200px] max-h-[150px] rounded-xl object-cover"
                      style={{ border: '1px solid rgba(236,91,19,0.3)' }}
                    />
                  )}
                  <div
                    className="px-4 py-3 rounded-2xl rounded-tr-none text-sm leading-relaxed"
                    style={{
                      background: 'rgba(236,91,19,0.12)',
                      border: '1px solid rgba(236,91,19,0.2)',
                      color: '#f1f5f9',
                    }}
                  >
                    {msg.text}
                  </div>
                  {msg.time && (
                    <p className="text-[10px] mr-1" style={{ color: '#334155' }}>
                      Você · {msg.time}
                    </p>
                  )}
                </div>
              </div>
            )
          )}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex gap-3 max-w-2xl">
              <div
                className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
                style={{ background: 'rgba(236,91,19,0.15)' }}
              >
                <span className="material-symbols-outlined text-sm" style={{ color: '#ec5b13' }}>
                  smart_toy
                </span>
              </div>
              <div
                className="px-4 py-3.5 rounded-2xl rounded-tl-none flex items-center gap-1.5"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {[0, 0.15, 0.3].map((d, j) => (
                  <span
                    key={j}
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: '#ec5b13', opacity: 0.7, animationDelay: `${d}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input bar ────────────────────────────────────────────────────── */}
        <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          {/* Badge: imagem satelital disponível no mapa */}
          {currentSatelliteScene && currentSatelliteScene.fieldId === activeFieldId && !pendingImage && (
            <div className="mb-3">
              <button
                onClick={() => void loadSatelliteImageForChat()}
                disabled={isLoading}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}
              >
                <span className="material-symbols-outlined text-sm">satellite_alt</span>
                <span className="flex-1 text-left">
                  📡 Analisar imagem {currentSatelliteScene.source === 's1' ? 'Sentinel-1 (Radar)' : 'Sentinel-2 (Óptico)'} visível no mapa
                  {currentSatelliteScene.sceneDate_br ? ` · ${currentSatelliteScene.sceneDate_br}` : ''}
                  {currentSatelliteScene.cloudCoverage != null ? ` · ${currentSatelliteScene.cloudCoverage}% nuvens` : ''}
                </span>
                <span className="material-symbols-outlined text-sm">add_photo_alternate</span>
              </button>
            </div>
          )}

          {/* Pending image preview */}
          {pendingImage && (
            <div className="mb-3 flex items-start gap-2">
              <div className="relative inline-block">
                <img
                  src={pendingImage.preview}
                  alt="Preview"
                  className="w-16 h-16 rounded-xl object-cover"
                  style={{ border: '1px solid rgba(236,91,19,0.4)' }}
                />
                <button
                  onClick={removePendingImage}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                  style={{ background: '#ef4444' }}
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-300 truncate max-w-[180px]">
                  {pendingImage.name}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: '#4ade80' }}>
                  <span className="material-symbols-outlined text-xs align-middle mr-0.5">
                    visibility
                  </span>
                  Válida para esta mensagem
                </p>
              </div>
            </div>
          )}

          {/* Input row */}
          <div
            className="flex items-center gap-2 p-2 rounded-2xl"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${pendingImage ? 'rgba(236,91,19,0.35)' : 'rgba(255,255,255,0.09)'}`,
            }}
          >
            {/* Attach image button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Enviar foto da lavoura"
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:opacity-80"
              style={{
                background: pendingImage ? 'rgba(236,91,19,0.25)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${pendingImage ? 'rgba(236,91,19,0.5)' : 'rgba(255,255,255,0.08)'}`,
                color: pendingImage ? '#ec5b13' : '#64748b',
              }}
            >
              <span className="material-symbols-outlined text-base">attach_file</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageSelect}
            />

            <input
              className="flex-1 bg-transparent border-none text-sm focus:outline-none text-slate-200 placeholder:text-slate-600 px-1"
              placeholder={
                pendingImage
                  ? 'Adicione uma pergunta ou envie só a foto...'
                  : 'Pergunte sobre sua lavoura...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || (!input.trim() && !pendingImage)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all hover:opacity-90 disabled:opacity-30 flex-shrink-0"
              style={{ background: '#ec5b13' }}
            >
              <span className="material-symbols-outlined text-base">
                {isLoading ? 'more_horiz' : 'arrow_upward'}
              </span>
            </button>
          </div>
          <p className="text-center text-[10px] mt-2" style={{ color: '#1e293b' }}>
            Tracto IA · Claude Sonnet 4.6 · JPG · PNG · WEBP até 5MB
          </p>
          <p className="text-center text-[10px] mt-1" style={{ color: '#334155' }}>
            A foto enviada vale para a mensagem atual. Para novo diagnóstico visual, envie a imagem novamente.
          </p>
        </div>
      </div>
    </>
  );
}
