from sonnenlicht import auth


def test_link_code_roundtrip():
    code = auth.create_link_code(7)
    assert auth.decode_link_code(code) == 7


def test_link_code_rejected_as_session_token():
    assert auth.decode_token(auth.create_link_code(7)) is None


def test_link_code_rejected_as_reset_token():
    assert auth.decode_reset_token(auth.create_link_code(7)) is None


def test_session_token_rejected_as_link_code():
    assert auth.decode_link_code(auth.create_token(7)) is None


def test_reset_token_rejected_as_link_code():
    token = auth.create_reset_token(7, auth.hash_password("secret123"))
    assert auth.decode_link_code(token) is None


def test_garbage_link_code_rejected():
    assert auth.decode_link_code("not-a-code") is None
