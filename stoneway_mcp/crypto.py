"""Cryptographic primitives for StoneWay.

Provides AES-256-GCM encryption/decryption, SHA-256 token hashing, and
token generation strictly compatible with the Node.js @stoneway/database
cryptography specifications.
"""

import base64
import hashlib
import json
import os
import secrets
from typing import Any, Dict, Optional, Union
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

IV_LENGTH_BYTES = 12  # 96-bit IV
TAG_LENGTH_BYTES = 16  # 128-bit authentication tag


def get_master_key(custom_key: Optional[str] = None) -> bytes:
    """Decodes the 32-byte master encryption key from base64 environment or argument."""
    key_base64 = custom_key or os.getenv("STONEWAY_ENCRYPTION_KEY")
    if not key_base64:
        raise ValueError("Missing STONEWAY_ENCRYPTION_KEY in environment or argument")
    key_bytes = base64.b64decode(key_base64)
    if len(key_bytes) != 32:
        raise ValueError(f"STONEWAY_ENCRYPTION_KEY must be exactly 32 bytes (got {len(key_bytes)})")
    return key_bytes


def encrypt_config(data: Any, custom_key: Optional[str] = None) -> Dict[str, Union[int, str]]:
    """Encrypts arbitrary serializable data using AES-256-GCM with a fresh random 96-bit IV.

    Returns envelope matching TypeScript schema:
        {"v": 1, "iv": "<base64>", "tag": "<base64>", "ciphertext": "<base64>"}
    """
    key = get_master_key(custom_key)
    aesgcm = AESGCM(key)
    iv = os.urandom(IV_LENGTH_BYTES)

    if isinstance(data, (dict, list)):
        plaintext = json.dumps(data, separators=(",", ":")).encode("utf-8")
    elif isinstance(data, str):
        plaintext = data.encode("utf-8")
    else:
        plaintext = str(data).encode("utf-8")

    # AESGCM.encrypt appends 16-byte tag to the ciphertext
    ct_with_tag = aesgcm.encrypt(iv, plaintext, None)
    ciphertext = ct_with_tag[:-TAG_LENGTH_BYTES]
    tag = ct_with_tag[-TAG_LENGTH_BYTES:]

    return {
        "v": 1,
        "iv": base64.b64encode(iv).decode("ascii"),
        "tag": base64.b64encode(tag).decode("ascii"),
        "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
    }


def decrypt_config(envelope: Dict[str, Any], custom_key: Optional[str] = None) -> Any:
    """Decrypts an AES-256-GCM envelope and verifies its authentication tag."""
    key = get_master_key(custom_key)
    aesgcm = AESGCM(key)

    iv = base64.b64decode(envelope["iv"])
    tag = base64.b64decode(envelope["tag"])
    ciphertext = base64.b64decode(envelope["ciphertext"])

    ct_with_tag = ciphertext + tag
    plaintext_bytes = aesgcm.decrypt(iv, ct_with_tag, None)
    plaintext = plaintext_bytes.decode("utf-8")

    try:
        return json.loads(plaintext)
    except Exception:
        return plaintext


def hash_api_key(raw_token: str) -> str:
    """Computes a deterministic SHA-256 hex digest of an API token for zero-plaintext lookup."""
    return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()


def generate_api_key() -> str:
    """Generates a high-entropy, base64url-encoded API key formatted as `sw_<32 random bytes>`."""
    random_bytes = secrets.token_bytes(32)
    b64url = base64.urlsafe_b64encode(random_bytes).decode("ascii").rstrip("=")
    return f"sw_{b64url}"
