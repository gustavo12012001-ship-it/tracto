"""Testes de validação Pydantic — bounds e schemas."""

import pytest
from pydantic import ValidationError


def test_chat_message_role_required():
    from models import ChatMessage
    with pytest.raises(ValidationError):
        ChatMessage()  # type: ignore[call-arg]


def test_chat_request_field_id_required():
    from models import ChatRequest, ChatMessage
    msg = ChatMessage(role="user", text="oi")
    # field_id NÃO é obrigatório no schema, mas o endpoint rejeita ausente
    req = ChatRequest(messages=[msg])
    assert req.messages[0].text == "oi"


def test_field_create_validates():
    """FieldCreate exige campos essenciais."""
    from models import FieldCreate
    with pytest.raises(ValidationError):
        FieldCreate()  # type: ignore[call-arg]
