
import crypto from "crypto";
import { getRedis } from "../../lib/redis.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const clientId = process.env.ROBLOX_CLIENT_ID;
    const secret = process.env.OAUTH_STATE_SECRET;

    if (!clientId || !secret) {
      return res.status(500).send("Missing environment variables");
    }

    const state = crypto.randomBytes(32).toString("hex");
    const redis = await getRedis();

    await redis.set(`oauth:${state}`, "pending", {
      EX: 600,
      NX: true
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: "https://roblox-verification-one.vercel.app/api/oauth/callback",
      response_type: "code",
      scope: "openid profile",
      state
    });

    return res.redirect(
      "https://apis.roblox.com/oauth/v1/authorize?" +
      params.toString()
    );
  } catch (error) {
    console.error("OAuth login error:", error.message);
    return res.status(500).send("Could not start login");
  }
}
