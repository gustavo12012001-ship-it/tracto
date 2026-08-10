import { useNavigate } from 'react-router-dom';

export default function CancellationPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#080809] text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080809]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-white"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Voltar
          </button>
          <span className="text-sm font-black tracking-[0.2em] text-white">TRACTO</span>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        <p className="mb-4 text-[10px] font-black uppercase tracking-[0.4em] text-orange-500">
          Pagamentos e uso responsável
        </p>
        <h1 className="mb-4 text-3xl font-black tracking-tight text-white">
          Cancelamento, reembolso e responsabilidade agronômica
        </h1>
        <p className="mb-10 text-sm leading-7 text-slate-400">
          Esta página resume as regras comerciais mais importantes da Tracto. Em caso de conflito,
          prevalecem os Termos de Uso completos.
        </p>

        <section className="space-y-8">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-white">Cancelamento</h2>
            <p className="text-sm leading-7 text-slate-400">
              Você pode cancelar a assinatura a qualquer momento pela área Minha Assinatura. O acesso
              aos recursos pagos permanece ativo até o fim do período já contratado, salvo bloqueios
              por fraude, violação dos termos ou chargeback.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-white">Reembolso</h2>
            <p className="text-sm leading-7 text-slate-400">
              Não há reembolso proporcional automático por dias não utilizados. O direito de
              arrependimento de 7 dias para contratação online será respeitado quando aplicável pelo
              Código de Defesa do Consumidor. Solicitações devem ser enviadas para
              contato@tractoagro.com.br com o e-mail da conta e comprovante do pagamento.
            </p>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-6">
            <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-red-200">
              Responsabilidade agronômica
            </h2>
            <p className="text-sm leading-7 text-red-100/80">
              As análises, alertas e recomendações geradas pela Tracto são ferramentas de apoio à
              decisão. Elas não substituem laudo técnico, visita de campo ou orientação de Engenheiro
              Agrônomo habilitado. Decisões críticas de manejo, aplicação, irrigação, colheita e
              compra de insumos devem ser confirmadas por profissional responsável.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
