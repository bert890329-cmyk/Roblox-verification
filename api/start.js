import crypto from "crypto";
import { getRedis } from "../../lib/redis.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const clientId = process.env.ROBLOX_CLIENT_ID;
    if (!clientId) {
      return res.status(500).send("Roblox login is not configured.");
    }

    const state = crypto.randomBytes(32).toString("hex");
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");

    const redis = await getRedis();
    await redis.set(
      `oauth:${state}`,
      JSON.stringify({ verifier, mode: "review" }),
      { EX: 600, NX: true }
    );

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: "https://roblox-verification-one.vercel.app/api/oauth/callback",
      response_type: "code",
      scope: "openid profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256"
    });

    return res.redirect(
      302,
      "https://apis.roblox.com/oauth/v1/authorize?" + params.toString()
    );
  } catch (error) {
    console.error("Public Roblox OAuth start error:", error.message);
    return res.status(500).send("Could not start Roblox sign-in. Please try again.");
  }
}
