"""Tests for StoneWay cryptographic invariants."""

import base64
import os
import pytest
from cryptography.exceptions import InvalidTag
from stoneway_mcp.crypto import (
    decrypt_config,
    encrypt_config,
    generate_api_key,
    hash_api_key,
)

# Test key (32 bytes base64 encoded)
DUMMY_KEY = base64.b64encode(os.urandom(32)).decode("ascii")


def test_encrypt_and_decrypt_roundtrip():
    payload = {
        "stoneway_api_key": "sw_test_123456",
        "integrations": {"github_pat": "ghp_secret_token_123"},
    }
    envelope = encrypt_config(payload, custom_key=DUMMY_KEY)

    assert envelope["v"] == 1
    assert "iv" in envelope
    assert "tag" in envelope
    assert "ciphertext" in envelope

    decrypted = decrypt_config(envelope, custom_key=DUMMY_KEY)
    assert decrypted == payload


def test_tamper_detection():
    payload = {"secret": "vibecoding-super-secret"}
    envelope = encrypt_config(payload, custom_key=DUMMY_KEY)

    # Tamper with the ciphertext
    raw_ct = bytearray(base64.b64decode(envelope["ciphertext"]))
    raw_ct[0] ^= 0xFF
    envelope["ciphertext"] = base64.b64encode(raw_ct).decode("ascii")

    with pytest.raises(Exception):
        decrypt_config(envelope, custom_key=DUMMY_KEY)


def test_hash_api_key_deterministic():
    token = "sw_my_super_secure_key_12345"
    h1 = hash_api_key(token)
    h2 = hash_api_key(token)
    assert h1 == h2
    assert len(h1) == 64  # SHA-256 hex is 64 characters


def test_generate_api_key_format():
    key = generate_api_key()
    assert key.startswith("sw_")
    assert len(key) > 35
