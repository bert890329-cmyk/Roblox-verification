
import crypto from "crypto";
import nacl from "tweetnacl";
import { getRedis } from "../../lib/redis.js";

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);

    const signature = req.headers["x-signature-ed25519"];
    const timestamp = req.headers["x-signature-timestamp"];
    const publicKey = process.env.DISCORD_PUBLIC_KEY;

    if (!signature || !timestamp || !publicKey) {
      return res.status(401).send("Invalid request");
    }

    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (age > 300) return res.status(401).send("Expired request");

    const valid = nacl.sign.detached.verify(
      Buffer.concat([Buffer.from(timestamp), rawBody]),
      Buffer.from(signature, "hex"),
      Buffer.from(publicKey, "hex")
    );

    if (!valid) return res.status(401).send("Invalid signature");

    const interaction = JSON.parse(rawBody.toString());

    if (interaction.type === 1) {
      return res.status(200).json({ type: 1 });
    }

    if (interaction.type !== 2 || interaction.data?.name !== "verify") {
      return res.status(400).send("Unsupported interaction");
    }

    const clientId = process.env.ROBLOX_CLIENT_ID;
    if (!clientId) {
      return res.status(500).send("Missing Roblox client ID");
    }

    const discordId = interaction.member?.user?.id || interaction.user?.id;
    if (!discordId) {
      return res.status(400).send("Missing Discord user");
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
      JSON.stringify({ verifier, discordId }),
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

    const loginUrl =
      "https://apis.roblox.com/oauth/v1/authorize?" +
      params.toString();

    return res.status(200).json({
      type: 4,
      data: {
        content: `**Roblox verification**\n[Click here to verify your Roblox account](${loginUrl})\n\nThis link expires in 10 minutes.`,
        flags: 64
      }
    });
  } catch (error) {
    console.error("Discord verification error:", error.message);
    return res.status(500).send("Verification could not start");
  }
}
