import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');
        .privacy-body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .prose-dark h2 { color: #f1f5f9; font-size: 1rem; font-weight: 700; margin-top: 2.5rem; margin-bottom: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase; }
        .prose-dark h3 { color: #cbd5e1; font-size: 0.875rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; }
        .prose-dark p { color: #94a3b8; font-size: 0.875rem; line-height: 1.8; margin-bottom: 1rem; font-weight: 300; }
        .prose-dark ul { color: #94a3b8; font-size: 0.875rem; line-height: 1.8; margin-bottom: 1rem; padding-left: 1.25rem; font-weight: 300; }
        .prose-dark li { margin-bottom: 0.35rem; }
        .prose-dark a { color: #f97316; text-decoration: underline; }
        .prose-dark strong { color: #e2e8f0; font-weight: 600; }
        .section-divider { border-color: rgba(255,255,255,0.06); }
      `}</style>

      <div className="privacy-body min-h-screen" style={{ background: '#080809' }}>
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
              Conformidade LGPD
            </p>
            <h1 className="text-3xl md:text-4xl font-light text-white mb-4 tracking-tight">
              Política de Privacidade
            </h1>
            <p className="text-slate-500 text-sm font-light">
              Última atualização: 9 de abril de 2026 &nbsp;·&nbsp; Versão 1.0
            </p>
          </div>

          <div className="prose-dark">

            {/* Intro */}
            <div className="p-6 rounded-2xl mb-10" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}>
              <p className="!mb-0" style={{ color: '#fdba74' }}>
                A <strong style={{ color: '#fed7aa' }}>Tracto Agricultural Technologies</strong> leva a sério a privacidade dos seus dados. Esta Política descreve, de forma clara e transparente, como coletamos, usamos, armazenamos e protegemos suas informações pessoais, em conformidade com a <strong style={{ color: '#fed7aa' }}>Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</strong>.
              </p>
            </div>

            {/* 1. Controlador */}
            <h2>1. Quem é o Controlador dos seus Dados</h2>
            <p>
              A controladora responsável pelo tratamento dos seus dados pessoais é a <strong>Tracto Agricultural Technologies</strong>, empresa brasileira com atuação no setor de tecnologia agrícola.
            </p>
            <ul>
              <li><strong>E-mail de contato:</strong> privacidade@tracto.ag</li>
              <li><strong>Canal de atendimento:</strong> contato@tracto.ag</li>
            </ul>

            <hr className="section-divider my-8" />

            {/* 2. Dados coletados */}
            <h2>2. Quais Dados Coletamos</h2>

            <h3>2.1 Dados fornecidos por você</h3>
            <ul>
              <li><strong>Nome completo</strong> — para identificação e personalização da experiência</li>
              <li><strong>Endereço de e-mail</strong> — para autenticação, notificações e suporte</li>
              <li><strong>Número de telefone / WhatsApp</strong> — para envio de alertas agronômicos críticos</li>
              <li><strong>Senha</strong> — armazenada de forma criptografada (nunca em texto simples)</li>
            </ul>

            <h3>2.2 Dados gerados pelo uso da plataforma</h3>
            <ul>
              <li><strong>Localização geográfica</strong> — para contextualizar análises climáticas e satelitais (solicitamos permissão do browser)</li>
              <li><strong>Dados de fazenda e talhões</strong> — coordenadas, culturas, datas de plantio e polígonos delimitadores inseridos por você</li>
              <li><strong>Histórico de conversas com a IA</strong> — armazenado para continuidade do contexto agronômico</li>
              <li><strong>Logs de uso</strong> — páginas acessadas, horários e ações, para melhoria do serviço e segurança</li>
            </ul>

            <h3>2.3 Dados coletados automaticamente</h3>
            <ul>
              <li>Endereço IP e informações do dispositivo</li>
              <li>Tipo de navegador e sistema operacional</li>
              <li>Cookies de sessão e preferências locais (localStorage)</li>
            </ul>

            <hr className="section-divider my-8" />

            {/* 3. Finalidades */}
            <h2>3. Para Que Usamos seus Dados</h2>
            <p>Tratamos seus dados pessoais com base nas seguintes finalidades e bases legais (art. 7º e 11 da LGPD):</p>

            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>Finalidade</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>Base Legal</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Autenticação e acesso à plataforma', 'Execução de contrato'],
                    ['Envio de alertas climáticos e satelitais por WhatsApp', 'Consentimento / Legítimo interesse'],
                    ['Análise agronômica com inteligência artificial', 'Execução de contrato'],
                    ['Prevenção de fraudes e segurança', 'Legítimo interesse'],
                    ['Melhoria contínua do produto', 'Legítimo interesse'],
                    ['Cumprimento de obrigações legais e regulatórias', 'Obrigação legal'],
                    ['Comunicações sobre sua assinatura e planos', 'Execução de contrato'],
                  ].map(([fin, base], i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{fin}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontStyle: 'italic' }}>{base}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <hr className="section-divider my-8" />

            {/* 4. Compartilhamento */}
            <h2>4. Compartilhamento de Dados</h2>
            <p>
              <strong>Não vendemos seus dados pessoais.</strong> Compartilhamos informações apenas nas situações abaixo e sempre com as salvaguardas adequadas:
            </p>
            <ul>
              <li><strong>Supabase (EUA)</strong> — banco de dados e autenticação. Operado sob cláusulas contratuais padrão de proteção de dados.</li>
              <li><strong>Anthropic (EUA)</strong> — processamento de linguagem natural para a IA agronômica. Os dados de conversa são transmitidos apenas para geração de resposta e não são usados para treinamento de modelos sem seu consentimento.</li>
              <li><strong>Copernicus / ESA (EU)</strong> — consulta de imagens satelitais Sentinel-2. Apenas coordenadas geográficas dos talhões são transmitidas.</li>
              <li><strong>Open-Meteo (Suíça)</strong> — dados meteorológicos públicos. Apenas coordenadas geográficas são transmitidas.</li>
              <li><strong>Google reCAPTCHA</strong> — proteção contra bots nos formulários de acesso.</li>
              <li><strong>Autoridades governamentais</strong> — quando exigido por lei ou ordem judicial.</li>
            </ul>

            <hr className="section-divider my-8" />

            {/* 5. Armazenamento */}
            <h2>5. Armazenamento e Segurança</h2>
            <ul>
              <li>Seus dados são armazenados em servidores com <strong>criptografia em repouso e em trânsito (TLS 1.3)</strong>.</li>
              <li>Senhas são armazenadas com <strong>hash bcrypt</strong> — nunca em texto claro.</li>
              <li>Implementamos <strong>Row Level Security (RLS)</strong> no banco de dados, garantindo que cada usuário acesse apenas seus próprios dados.</li>
              <li>Tokens de autenticação JWT possuem prazo de validade e são renovados automaticamente.</li>
              <li>Realizamos auditorias de segurança periódicas em nossa infraestrutura.</li>
            </ul>

            <hr className="section-divider my-8" />

            {/* 6. Retenção */}
            <h2>6. Retenção dos Dados</h2>
            <p>Mantemos seus dados pelo período necessário para as finalidades descritas:</p>
            <ul>
              <li><strong>Conta ativa:</strong> durante todo o período de uso da plataforma</li>
              <li><strong>Conta encerrada:</strong> até 5 anos para fins fiscais e legais, conforme legislação brasileira</li>
              <li><strong>Logs de segurança:</strong> 12 meses</li>
              <li><strong>Histórico de conversas com IA:</strong> até exclusão pelo usuário ou encerramento da conta</li>
            </ul>

            <hr className="section-divider my-8" />

            {/* 7. Direitos */}
            <h2>7. Seus Direitos (LGPD, Art. 18)</h2>
            <p>Você tem os seguintes direitos em relação aos seus dados pessoais:</p>
            <ul>
              <li><strong>Confirmação e acesso</strong> — saber se tratamos seus dados e obter cópia</li>
              <li><strong>Correção</strong> — corrigir dados incompletos, inexatos ou desatualizados</li>
              <li><strong>Anonimização, bloqueio ou eliminação</strong> — quando desnecessários ou tratados em desconformidade</li>
              <li><strong>Portabilidade</strong> — receber seus dados em formato estruturado</li>
              <li><strong>Eliminação</strong> — excluir dados tratados com base no consentimento</li>
              <li><strong>Revogação do consentimento</strong> — a qualquer momento, sem prejuízo ao tratamento anterior</li>
              <li><strong>Oposição</strong> — opor-se ao tratamento realizado com base em legítimo interesse</li>
              <li><strong>Informação</strong> — sobre entidades com as quais compartilhamos seus dados</li>
            </ul>
            <p>
              Para exercer qualquer desses direitos, envie um e-mail para <a href="mailto:privacidade@tracto.ag">privacidade@tracto.ag</a> com o assunto "Direitos LGPD — [seu nome]". Responderemos em até <strong>15 dias úteis</strong>.
            </p>

            <hr className="section-divider my-8" />

            {/* 8. Cookies */}
            <h2>8. Cookies e Armazenamento Local</h2>
            <p>Utilizamos as seguintes tecnologias de rastreamento:</p>
            <ul>
              <li><strong>Cookies de sessão (Supabase Auth)</strong> — essenciais para autenticação. Não podem ser desativados.</li>
              <li><strong>localStorage</strong> — armazena preferências do usuário (fazenda ativa, talhão selecionado, camada de mapa) localmente no seu dispositivo.</li>
              <li><strong>Google reCAPTCHA</strong> — utiliza cookies para detecção de bots. Sujeito à <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Política de Privacidade do Google</a>.</li>
            </ul>
            <p>
              Você pode limpar os dados do localStorage a qualquer momento pelo painel do seu navegador, sem prejudicar o acesso à conta.
            </p>

            <hr className="section-divider my-8" />

            {/* 9. Menores */}
            <h2>9. Menores de Idade</h2>
            <p>
              A plataforma Tracto é destinada exclusivamente a <strong>pessoas físicas maiores de 18 anos</strong> ou pessoas jurídicas representadas por seus responsáveis legais. Não coletamos intencionalmente dados de menores de 18 anos. Se identificarmos tal coleta, os dados serão imediatamente excluídos.
            </p>

            <hr className="section-divider my-8" />

            {/* 10. Transferência internacional */}
            <h2>10. Transferência Internacional de Dados</h2>
            <p>
              Alguns dos nossos fornecedores operam fora do Brasil (EUA, União Europeia, Suíça). Garantimos que essas transferências ocorrem apenas com parceiros que adotam salvaguardas adequadas, como cláusulas contratuais padrão, certificações de adequação ou marcos regulatórios equivalentes à LGPD (como o GDPR europeu).
            </p>

            <hr className="section-divider my-8" />

            {/* 11. Alterações */}
            <h2>11. Alterações nesta Política</h2>
            <p>
              Podemos atualizar esta Política periodicamente. Quando fizermos alterações materiais, notificaremos você por e-mail ou por aviso destacado na plataforma, com antecedência de pelo menos <strong>15 dias</strong>. O uso continuado após esse prazo implica aceitação das alterações.
            </p>

            <hr className="section-divider my-8" />

            {/* 12. DPO */}
            <h2>12. Encarregado de Proteção de Dados (DPO)</h2>
            <p>
              Em conformidade com o Art. 41 da LGPD, designamos um Encarregado de Proteção de Dados (DPO) disponível para contato:
            </p>
            <ul>
              <li><strong>E-mail:</strong> <a href="mailto:dpo@tracto.ag">dpo@tracto.ag</a></li>
              <li><strong>Canal geral:</strong> <a href="mailto:privacidade@tracto.ag">privacidade@tracto.ag</a></li>
            </ul>
            <p>
              Você também pode registrar reclamações junto à <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong> em <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">www.gov.br/anpd</a>.
            </p>

          </div>

          {/* Footer nav */}
          <div className="mt-16 pt-10 border-t flex flex-col sm:flex-row gap-4 justify-between items-center" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <p className="text-slate-600 text-xs">© 2026 Tracto Agricultural Technologies. Todos os direitos reservados.</p>
            <div className="flex gap-6">
              <button onClick={() => navigate('/terms')} className="text-slate-400 hover:text-white text-xs transition-colors">
                Termos de Uso
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
