from sonnenlicht import auth


def test_reset_token_roundtrip():
    hashed = auth.hash_password("secret123")
    token = auth.create_reset_token(42, hashed)
    decoded = auth.decode_reset_token(token)
    assert decoded is not None
    user_id, suffix = decoded
    assert user_id == 42
    assert hashed.endswith(suffix)


def test_reset_token_invalid_after_password_change():
    old_hash = auth.hash_password("secret123")
    token = auth.create_reset_token(42, old_hash)
    new_hash = auth.hash_password("another-password")
    _, suffix = auth.decode_reset_token(token)
    assert not new_hash.endswith(suffix)


def test_reset_token_rejected_as_session_token():
    token = auth.create_reset_token(42, auth.hash_password("secret123"))
    assert auth.decode_token(token) is None


def test_session_token_rejected_as_reset_token():
    assert auth.decode_reset_token(auth.create_token(42)) is None


def test_garbage_reset_token_rejected():
    assert auth.decode_reset_token("not-a-token") is None
