# Tracto - Checklist operacional de pre-venda

Use este checklist antes de anunciar a Tracto para venda publica. Os itens abaixo dependem de
dashboards externos e devem ser executados pelo dono das contas.

## 1. Rotacionar secrets expostos

Rotacione todos os tokens que ja foram copiados em chats, prints ou arquivos locais:

- Anthropic API key.
- Supabase anon key, service role key e JWT secret se aplicavel.
- Copernicus/Sentinel client secret.
- Planet API key.
- Mercado Pago access token e webhook secret.
- VAPID public/private keys.
- Z-API ou qualquer token de WhatsApp, se voltar a usar.

Depois de rotacionar:

1. Atualize as variaveis em Vercel > Project > Settings > Environment Variables.
2. Remova valores antigos de qualquer ferramenta externa.
3. Gere um novo deploy de producao.
4. Valide `GET /api/health`.
5. Valide login, mapas, IA, satelite, Pix e cartão.

## 2. Dominio final

Recomendado antes de vender:

- App: `app.tractoagro.com.br`.
- Site: `tractoagro.com.br`.
- API: manter `/api/*` na propria Vercel, sem Railway.

Passos:

1. Vercel > Project > Domains > Add.
2. Adicione o dominio escolhido.
3. Configure DNS no registrador conforme a Vercel indicar.
4. Atualize `FRONTEND_URL`, `BACKEND_URL`, `ALLOWED_ORIGINS` e `VITE_API_URL`.
5. Atualize os redirect URLs do Supabase Auth.
6. Atualize URLs de retorno e webhook do Mercado Pago.
7. Gere novo deploy e teste login + billing.

## 3. Mercado Pago - teste real controlado

Antes da campanha publica, execute com um usuario de teste:

- Cartao aprovado: assinatura criada, status autorizado, entitlement Pro liberado.
- Pix aprovado: pagamento aprovado, subscription criada/atualizada e entitlement liberado.
- Pix pendente: usuario continua Free ate aprovacao.
- Pagamento rejeitado: subscription nao deve liberar entitlement pago.
- Cancelamento: status cancelado e acesso pago removido no fim do periodo.
- Webhook duplicado: nao deve duplicar transacao nem alterar usuario errado.

Webhook esperado:

`https://SEU_DOMINIO_FINAL/api/billing/mercadopago-webhook`

Validacao minima no banco apos cada pagamento:

- `subscriptions.user_id` pertence ao usuario correto.
- `subscriptions.plan_id` e `billing_cycle` correspondem ao checkout escolhido.
- `subscriptions.status` fica `authorized` somente quando o pagamento for aprovado.
- `subscriptions.current_period_end` fica preenchido para Pix aprovado.
- `payment_transactions.mp_payment_id` nao duplica em reentrega de webhook.
- `/api/billing/entitlements` reflete o plano pago apos webhook aprovado.

Variaveis para E2E autenticado:

1. Copie `.env.e2e.example` para `.env.e2e` ou exporte as variaveis no shell.
2. Preencha `E2E_EMAIL` e `E2E_PASS` com uma conta Free de teste.
3. Preencha `E2E_PRO_EMAIL` e `E2E_PRO_PASS` com uma conta Pro de teste.
4. Rode `npm run e2e`.

## 4. Go/no-go de anuncio

Pode anunciar quando:

- Build e lint produtivo passam.
- Testes unitarios passam.
- `e2e/pre-sale.spec.ts` passa nas rotas publicas.
- Um checkout Pix real e um checkout cartão real foram validados.
- Secrets antigos foram revogados.
- Termos, privacidade e politica comercial estao publicados.
- WhatsApp nao aparece como beneficio enquanto estiver pausado.
