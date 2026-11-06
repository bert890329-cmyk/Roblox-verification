
import crypto from "crypto";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  const clientId = process.env.ROBLOX_CLIENT_ID;
  const secret = process.env.OAUTH_STATE_SECRET;

  if (!clientId || !secret) {
    return res.status(500).send("Missing environment variables");
  }

  const state = crypto.randomBytes(32).toString("hex");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: "https://roblox-verification-one.vercel.app/api/oauth/callback",
    response_type: "code",
    scope: "openid profile",
    state,
  });

  // Temporary: we'll add secure state storage next.
  res.redirect(
    "https://apis.roblox.com/oauth/v1/authorize?" +
    params.toString()
  );
}
