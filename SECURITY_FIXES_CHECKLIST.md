# Plano de Correção — Vulnerabilidades Críticas de Segurança
# Implementar estas correções ANTES do launch da pré-venda

## CORREÇÃO 1: Remover Coordenadas Públicas do Contexto de Chat
# Arquivo: tracto-backend/main.py (função _build_farm_context_from_metadata)
# Antes: Incluía `lat` e `lng` visíveis em logs e contexto da IA
# Depois: Remover coordenadas; manter apenas field_id e field_name

# MUDANÇA NO CÓDIGO:
# OLD: f"- coordinates: {_coord_text(metadata.get('lat'), metadata.get('lng'))}"
# NEW: # Coordenadas removidas por segurança (nunca expor em contexto público)

## CORREÇÃO 2: Validar field_data Explicitamente (Não Deixar Ser None)
# Arquivo: tracto-backend/main.py (função chat_endpoint)
# Antes: if not field_data: raise HTTPException (OK, mas caderno continua sem validação)
# Depois: Validar field_data ANTES de injetar caderno

# MUDANÇA NO CÓDIGO:
# if not field_data:
#     raise HTTPException(...)
# # NOVO: Garante que field_data é válido antes de qualquer injeção
# assert field_data.get("id") == canonical_field_id

## CORREÇÃO 3: Implementar CSRF Token em Checkout
# Arquivo: frontend src/pages/Billing.tsx + backend POST /api/billing/checkout
# Antes: Nenhuma proteção CSRF
# Depois: Gerar token no frontend, validar no backend

# MUDANÇA NO BACKEND:
# @app.post("/api/billing/checkout")
# async def create_checkout(...):
#     csrf_token = request.headers.get("x-csrf-token")
#     # Validar contra session
#     if not csrf_token or not validate_csrf(csrf_token, user.id):
#         raise HTTPException(status_code=403, detail="CSRF token inválido")

## CORREÇÃO 4: Rate Limit por user_id (não por IP)
# Arquivo: tracto-backend/main.py (linha 123)
# Antes: limiter = Limiter(key_func=get_remote_address)
# Depois: Usar função customizada que retorna user_id do JWT

# CÓDIGO NOVO:
# def get_rate_limit_key(request: Request) -> str:
#     user_id = get_unverified_user_id_from_header(request.headers.get("Authorization"))
#     return user_id or get_remote_address(request)
# limiter = Limiter(key_func=get_rate_limit_key)

## CORREÇÃO 5: Remover Dados Sensíveis de Logs
# Arquivo: tracto-backend/main.py (múltiplos logging.error/warning)
# Antes: logging.error("[chat] field_data=%s", field_data) → expõe lat/lng/variedade
# Depois: logging.error("[chat] field_id=%s", field_id) → apenas ID

## CORREÇÃO 6: Migrar localStorage → httpOnly Cookies
# Arquivo: src/services/auth.ts
# Antes: localStorage.setItem('token', access_token)
# Depois: Backend set-cookie com httpOnly=true; frontend nunca toca no token

# Esta é uma refatoração maiore que requer ajustes no backend para retornar cookies

## CORREÇÃO 7: Error Handling Genérico ao Cliente
# Arquivo: tracto-backend/main.py
# Antes: except Exception as exc: raise HTTPException(detail=str(exc)) → expõe erro interno
# Depois: Log detalhado internamente; cliente recebe erro genérico

# MUDANÇA NO CÓDIGO:
# except Exception as exc:
#     logging.exception("[endpoint] Erro completo: %s", exc)  # Log detalhado
#     raise HTTPException(
#         status_code=500,
#         detail="Erro ao processar requisição. Tente novamente mais tarde."  # Genérico
#     )

---

## Implementação Rápida (4h Crítico)

### 1. Remover Coordenadas do Contexto Chat (1h)
Editar `_build_farm_context_from_metadata()`:
- Remover linha: `f"- coordinates: {_coord_text(metadata.get('lat'), metadata.get('lng'))}"`
- Remover também: `f"- lat: ...", f"- lng: ..."`

### 2. Adicionar Validação de field_data (30m)
Em `chat_endpoint()`:
```python
if not field_data:
    raise HTTPException(status_code=404, detail="...")

# NOVO: Garantir integridade
if field_data.get("id") != canonical_field_id:
    logging.warning("[SECURITY] field_id mismatch detected")
    raise HTTPException(status_code=403, detail="Acesso negado")
```

### 3. Remover Contexto de Caderno sem Validação Adicional (30m)
Em `chat_endpoint()`, após bloco do caderno:
```python
# Remover caderno se não conseguir validar propriedade completa
# (já está validado em get_notebook_events, mas ser explícito)
if notebook_events and not field_data.get("id"):
    notebook_events = []  # Descartar se field_data inválido
```

### 4. Implementar Rate Limit por user_id (1h)
Criar função `get_rate_limit_key()`:
```python
def get_rate_limit_key(request: Request) -> str:
    """Usa user_id do JWT como chave primária; fallback para IP."""
    user_id = get_unverified_user_id_from_header(request.headers.get("Authorization", ""))
    return user_id or get_remote_address(request)

# Substituir linha 123:
# limiter = Limiter(key_func=get_rate_limit_key)
```

### 5. Sanitizar Logs (1h)
Procurar `logging.error/warning` com `field_data`, `metadata`, `snapshot`:
- Remover payloads inteiros
- Substituir por apenas IDs

---

## Teste Pós-Correção

```bash
# Validar sintaxe Python
python -m py_compile tracto-backend/main.py

# Validar com pytest (chat_endpoint)
pytest tracto-backend/tests/test_chat.py::test_chat_no_coordinate_leakage
pytest tracto-backend/tests/test_chat.py::test_rate_limit_by_userid

# E2E
npm run e2e -- e2e/pre-sale.spec.ts
```

---

**Criticidade:** 🔴 BLOQUEIA VENDA
**Tempo Estimado:** 4h
**Tester:** GitHub Copilot (Teste de Penetração Contínua)
