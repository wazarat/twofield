from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx
from fastmcp import FastMCP
from fastmcp.server.auth import AccessToken, TokenVerifier, require_scopes
from fastmcp.server.dependencies import get_access_token


logging.basicConfig(level=os.environ.get("MCP_LOG_LEVEL", "INFO").upper())
logger = logging.getLogger("twofield.mcp")


class TwofieldTokenVerifier(TokenVerifier):
    """Validate opaque MCP credentials through Twofield's introspection route."""

    def __init__(self, introspection_url: str, introspection_secret: str) -> None:
        super().__init__(required_scopes=["mcp:identity"])
        self.introspection_url = introspection_url
        self.introspection_secret = introspection_secret

    async def verify_token(self, token: str) -> AccessToken | None:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.post(
                    self.introspection_url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "X-MCP-Introspection-Secret": self.introspection_secret,
                    },
                )
            if response.status_code != 200:
                logger.warning("Token introspection returned HTTP %s", response.status_code)
                return None

            data = response.json()
            if not isinstance(data, dict):
                logger.warning("Token introspection returned an invalid response")
                return None
            if data.get("active") is not True:
                logger.warning("Token introspection rejected the token")
                return None

            claims = data.get("claims")
            scope_value = data.get("scope")
            if not isinstance(claims, dict) or not isinstance(scope_value, str):
                logger.warning("Token introspection response was missing claims or scope")
                return None
            scopes = scope_value.split()
            if not scopes:
                logger.warning("Token introspection response contained no scopes")
                return None

            expires_at: datetime | None = None
            if isinstance(data.get("exp"), int):
                expires_at = datetime.fromtimestamp(data["exp"], tz=timezone.utc)

            access_token = AccessToken(
                token=token,
                client_id=data.get("client_id"),
                scopes=scopes,
                expires_at=expires_at,
                claims=claims,
            )
            logger.debug("MCP token accepted for agent %s", claims.get("agent_id", "unknown"))
            return access_token
        except (httpx.HTTPError, ValueError, TypeError, AttributeError) as error:
            logger.error("Token introspection failed: %s", type(error).__name__)
            return None


introspection_url = os.environ.get(
    "TWOFIELD_INTROSPECTION_URL",
    "http://localhost:3000/api/mcp/introspect",
)
introspection_secret = os.environ.get("MCP_INTROSPECTION_SECRET", "")
if not introspection_secret:
    raise RuntimeError("MCP_INTROSPECTION_SECRET must be set")

auth = TwofieldTokenVerifier(introspection_url, introspection_secret)
mcp = FastMCP("twofield", auth=auth)
logger.info("FastMCP server initialized with introspection URL %s", introspection_url)


@mcp.tool(auth=require_scopes("mcp:identity"))
async def whoami() -> dict[str, Any]:
    """Return the authenticated Twofield user and buyer agent."""
    token = get_access_token()
    if token is None:
        return {"authenticated": False}

    return {
        "authenticated": True,
        "user_id": token.claims.get("sub"),
        "agent_id": token.claims.get("agent_id"),
        "credential_id": token.claims.get("credential_id"),
        "scopes": token.scopes,
        "expires_at": token.expires_at.isoformat() if token.expires_at else None,
    }


# Vercel detects this module-level ASGI application in its Python runtime.
app = mcp.http_app(path="/mcp")


if __name__ == "__main__":
    mcp.run(
        transport="http",
        host=os.environ.get("MCP_HOST", "127.0.0.1"),
        port=int(os.environ.get("MCP_PORT", "8000")),
    )
