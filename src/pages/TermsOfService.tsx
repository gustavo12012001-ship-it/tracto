import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');
        .terms-body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .prose-dark h2 { color: #f1f5f9; font-size: 1rem; font-weight: 700; margin-top: 2.5rem; margin-bottom: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase; }
        .prose-dark h3 { color: #cbd5e1; font-size: 0.875rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; }
        .prose-dark p { color: #94a3b8; font-size: 0.875rem; line-height: 1.8; margin-bottom: 1rem; font-weight: 300; }
        .prose-dark ul { color: #94a3b8; font-size: 0.875rem; line-height: 1.8; margin-bottom: 1rem; padding-left: 1.25rem; font-weight: 300; }
        .prose-dark ol { color: #94a3b8; font-size: 0.875rem; line-height: 1.8; margin-bottom: 1rem; padding-left: 1.25rem; font-weight: 300; }
        .prose-dark li { margin-bottom: 0.35rem; }
        .prose-dark a { color: #f97316; text-decoration: underline; }
        .prose-dark strong { color: #e2e8f0; font-weight: 600; }
        .section-divider { border-color: rgba(255,255,255,0.06); }
      `}</style>

      <div className="terms-body min-h-screen" style={{ background: '#080809' }}>
        {/* Header */}
        <header style={{ background: 'rgba(8,8,9,0.95)', borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="sticky top-0 z-50 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs uppercase tracking-widest font-medium"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar
            </button>
            <span className="text-base font-black tracking-[0.15em] text-white">TRACTO</span>
            <div className="w-16" />
          </div>
        </header>

        {/* Content */}
        <main className="max-w-4xl mx-auto px-6 py-16">
          {/* Title Block */}
          <div className="mb-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.5em] mb-4" style={{ color: '#f97316' }}>
              Contrato de Uso
            </p>
            <h1 className="text-3xl md:text-4xl font-light text-white mb-4 tracking-tight">
              Termos de Uso
            </h1>
            <p className="text-slate-500 text-sm font-light">
              Última atualização: 9 de abril de 2026 &nbsp;·&nbsp; Versão 1.0
            </p>
          </div>

          <div className="prose-dark">

            {/* Intro */}
            <div className="p-6 rounded-2xl mb-10" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}>
              <p className="!mb-0" style={{ color: '#fdba74' }}>
                Ao criar uma conta ou acessar a plataforma <strong style={{ color: '#fed7aa' }}>Tracto</strong>, você declara que leu, compreendeu e concorda integralmente com estes Termos de Uso. Se não concordar, não utilize o serviço.
              </p>
            </div>

            {/* 1. Definições */}
            <h2>1. Definições</h2>
            <ul>
              <li><strong>"Tracto" / "Plataforma"</strong> — sistema de inteligência agronômica provido pela Tracto Agricultural Technologies, incluindo o aplicativo web, APIs e serviços associados.</li>
              <li><strong>"Usuário"</strong> — pessoa física (maior de 18 anos) ou jurídica que cria uma conta e utiliza a plataforma.</li>
              <li><strong>"Dados de Talhão"</strong> — informações geoespaciais, agronômicas e produtivas inseridas pelo Usuário.</li>
              <li><strong>"Conteúdo de IA"</strong> — recomendações, análises e respostas geradas pela inteligência artificial integrada à plataforma.</li>
            </ul>

            <hr className="section-divider my-8" />

            {/* 2. Aceitação */}
            <h2>2. Aceitação e Vigência</h2>
            <p>
              Estes Termos entram em vigor no momento do cadastro e permanecem vigentes durante todo o período de uso da plataforma. A continuidade do uso após eventuais alterações implica aceitação das novas condições.
            </p>

            <hr className="section-divider my-8" />

            {/* 3. Cadastro */}
            <h2>3. Cadastro e Conta</h2>
            <ul>
              <li>O cadastro requer informações verdadeiras, precisas e atualizadas.</li>
              <li>Cada conta é pessoal e intransferível. O compartilhamento de credenciais é vedado.</li>
              <li>Você é responsável por manter a confidencialidade da sua senha e por todas as atividades realizadas com sua conta.</li>
              <li>Em caso de acesso não autorizado, notifique imediatamente: <a href="mailto:contato@tracto.ag">contato@tracto.ag</a>.</li>
              <li>É permitida apenas <strong>uma conta por usuário</strong>. Contas duplicadas podem ser suspensas sem aviso prévio.</li>
            </ul>

            <hr className="section-divider my-8" />

            {/* 4. Planos */}
            <h2>4. Planos de Assinatura e Pagamento</h2>

            <h3>4.1 Planos disponíveis</h3>
            <p>A Tracto oferece diferentes planos de assinatura com funcionalidades e limites de área distintos. Os valores, funcionalidades e condições de cada plano estão descritos na página de preços da plataforma e podem ser alterados mediante aviso prévio de 30 dias.</p>

            <h3>4.2 Cobrança</h3>
            <ul>
              <li>As assinaturas são cobradas mensalmente, no dia do ciclo de faturamento.</li>
              <li>O pagamento é processado por meio de gateway seguro. A Tracto não armazena dados de cartão de crédito.</li>
              <li>A falta de pagamento por mais de 7 (sete) dias poderá resultar na suspensão temporária do acesso.</li>
            </ul>

            <h3>4.3 Cancelamento e reembolso</h3>
            <ul>
              <li>O cancelamento pode ser realizado a qualquer momento pelo painel da conta, sem multa.</li>
              <li>Não há reembolso proporcional pelo período não utilizado do ciclo em curso, exceto nos casos previstos pelo Código de Defesa do Consumidor (CDC — Lei nº 8.078/1990), como o direito de arrependimento em compras online dentro de 7 dias.</li>
            </ul>

            <hr className="section-divider my-8" />

            {/* 5. Uso permitido */}
            <h2>5. Uso Permitido</h2>
            <p>A plataforma Tracto é licenciada para uso exclusivo em atividades agrícolas legítimas. É expressamente <strong>vedado</strong>:</p>
            <ul>
              <li>Usar a plataforma para fins ilegais, fraudulentos ou prejudiciais a terceiros</li>
              <li>Reproduzir, distribuir, vender ou sublicenciar qualquer parte da plataforma sem autorização escrita</li>
              <li>Realizar engenharia reversa, descompilar ou extrair código-fonte</li>
              <li>Sobrecarregar intencionalmente os sistemas (ataques DDoS, scraping agressivo, etc.)</li>
              <li>Inserir dados falsos, enganosos ou de terceiros sem autorização</li>
              <li>Usar os Conteúdos de IA para fins que possam causar danos a pessoas, animais ou ao meio ambiente</li>
            </ul>

            <hr className="section-divider my-8" />

            {/* 6. IA */}
            <h2>6. Natureza dos Conteúdos de Inteligência Artificial</h2>
            <div className="p-5 rounded-xl mb-4" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p className="!mb-0" style={{ color: '#fca5a5' }}>
                <strong style={{ color: '#fca5a5' }}>Aviso importante:</strong> As análises, recomendações e alertas gerados pela IA da Tracto têm caráter <strong style={{ color: '#fca5a5' }}>informativo e de apoio à decisão</strong>. Não substituem o laudo técnico de um Engenheiro Agrônomo habilitado pelo CREA. Decisões agronômicas críticas devem ser validadas por profissional qualificado.
              </p>
            </div>
            <p>A Tracto não se responsabiliza por perdas ou danos decorrentes do uso exclusivo das recomendações da IA sem consulta a profissional técnico.</p>

            <hr className="section-divider my-8" />

            {/* 7. Dados */}
            <h2>7. Propriedade dos Dados</h2>
            <ul>
              <li><strong>Seus dados são seus.</strong> Os Dados de Talhão, conversas e informações inseridas por você permanecem de sua propriedade.</li>
              <li>Você concede à Tracto uma licença limitada, não exclusiva e revogável para processar esses dados com a finalidade de prestar o serviço.</li>
              <li>A Tracto pode utilizar dados anonimizados e agregados para melhoria dos modelos e serviços, sem identificar o usuário individualmente.</li>
              <li>Ao encerrar sua conta, você pode solicitar a exportação ou exclusão de seus dados conforme nossa <button onClick={() => navigate('/privacy')} className="text-orange-400 underline hover:text-orange-300">Política de Privacidade</button>.</li>
            </ul>

            <hr className="section-divider my-8" />

            {/* 8. Disponibilidade */}
            <h2>8. Disponibilidade do Serviço</h2>
            <p>
              Nos comprometemos a manter a plataforma disponível com <strong>99% de uptime mensal</strong>, exceto em casos de:
            </p>
            <ul>
              <li>Manutenções programadas (comunicadas com antecedência mínima de 24h)</li>
              <li>Falhas em serviços de terceiros (Supabase, provedores de satélite, APIs de clima)</li>
              <li>Eventos de força maior (desastres, quedas de internet em larga escala, etc.)</li>
            </ul>
            <p>
              Em caso de indisponibilidade superior a 24h contínuas por falha nossa, o usuário terá direito a desconto proporcional na próxima fatura.
            </p>

            <hr className="section-divider my-8" />

            {/* 9. Propriedade Intelectual */}
            <h2>9. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo da plataforma — incluindo código-fonte, design, algoritmos agronômicos, marca "Tracto" e logotipos — é de propriedade exclusiva da Tracto Agricultural Technologies, protegido pela Lei de Direitos Autorais (Lei nº 9.610/1998) e pela legislação de propriedade industrial.
            </p>
            <p>
              O uso da marca "Tracto" sem autorização escrita é expressamente proibido.
            </p>

            <hr className="section-divider my-8" />

            {/* 10. Limitação de responsabilidade */}
            <h2>10. Limitação de Responsabilidade</h2>
            <p>Na máxima extensão permitida pela lei, a Tracto não se responsabiliza por:</p>
            <ul>
              <li>Perdas agrícolas decorrentes de decisões baseadas exclusivamente em recomendações da IA</li>
              <li>Imprecisões nos dados satelitais ou meteorológicos fornecidos por terceiros</li>
              <li>Danos indiretos, lucros cessantes ou perda de dados por falhas fora do nosso controle</li>
              <li>Acesso não autorizado à conta por negligência do usuário em proteger suas credenciais</li>
            </ul>
            <p>
              Em qualquer hipótese, a responsabilidade total da Tracto fica limitada ao valor pago pelo usuário nos últimos 3 meses de assinatura.
            </p>

            <hr className="section-divider my-8" />

            {/* 11. Suspensão */}
            <h2>11. Suspensão e Encerramento de Conta</h2>
            <p>A Tracto reserva-se o direito de suspender ou encerrar contas, com ou sem aviso prévio, nos seguintes casos:</p>
            <ul>
              <li>Violação destes Termos de Uso</li>
              <li>Inadimplência no pagamento da assinatura</li>
              <li>Comportamento abusivo em relação a outros usuários ou à equipe Tracto</li>
              <li>Uso da plataforma para fins ilegais</li>
              <li>Solicitação expressa do próprio usuário</li>
            </ul>

            <hr className="section-divider my-8" />

            {/* 12. Alterações */}
            <h2>12. Alterações nos Termos</h2>
            <p>
              Podemos modificar estes Termos a qualquer momento. Alterações materiais serão comunicadas por e-mail com antecedência de <strong>30 dias</strong>. O uso continuado após esse prazo implica aceitação dos novos Termos.
            </p>

            <hr className="section-divider my-8" />

            {/* 13. Lei aplicável */}
            <h2>13. Lei Aplicável e Foro</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Para dirimir quaisquer controvérsias, fica eleito o <strong>Foro da Comarca de São Paulo/SP</strong>, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
            </p>

            <hr className="section-divider my-8" />

            {/* 14. Contato */}
            <h2>14. Contato</h2>
            <p>Dúvidas, solicitações ou reclamações sobre estes Termos:</p>
            <ul>
              <li><strong>E-mail:</strong> <a href="mailto:contato@tracto.ag">contato@tracto.ag</a></li>
              <li><strong>Privacidade/LGPD:</strong> <a href="mailto:privacidade@tracto.ag">privacidade@tracto.ag</a></li>
            </ul>

          </div>

          {/* Footer nav */}
          <div className="mt-16 pt-10 border-t flex flex-col sm:flex-row gap-4 justify-between items-center" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <p className="text-slate-600 text-xs">© 2026 Tracto Agricultural Technologies. Todos os direitos reservados.</p>
            <div className="flex gap-6">
              <button onClick={() => navigate('/privacy')} className="text-slate-400 hover:text-white text-xs transition-colors">
                Política de Privacidade
              </button>
              <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white text-xs transition-colors">
                Site Tracto
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
