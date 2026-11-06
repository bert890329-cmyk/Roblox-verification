
import { getRedis } from "../../lib/redis.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).send("Roblox authorization was denied.");
    }

    if (!code || !state) {
      return res.status(400).send("Missing authorization details.");
    }

    const redis = await getRedis();

    // Consume the state once so it cannot be reused.
    const session = await redis.getDel(`oauth:${state}`);

    if (!session) {
      return res.status(400).send("Invalid or expired verification session.");
    }

    const { verifier, discordId } = JSON.parse(session);

    if (!verifier || !discordId) {
      return res.status(400).send("Invalid verification session.");
    }

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.ROBLOX_CLIENT_ID,
      redirect_uri: "https://roblox-verification-one.vercel.app/api/oauth/callback",
      code,
      code_verifier: verifier
    });

    const tokenResponse = await fetch(
      "https://apis.roblox.com/oauth/v1/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: tokenParams
      }
    );

    if (!tokenResponse.ok) {
      console.error("Roblox token exchange failed:", await tokenResponse.text());
      return res.status(400).send("Roblox login could not be completed.");
    }

    const tokens = await tokenResponse.json();

    const userResponse = await fetch(
      "https://apis.roblox.com/oauth/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`
        }
      }
    );

    if (!userResponse.ok) {
      return res.status(400).send("Could not retrieve Roblox account.");
    }

    const user = await userResponse.json();

    if (!user.sub) {
      return res.status(400).send("Roblox did not return a user ID.");
    }

    const existingDiscord = await redis.get(`roblox:${user.sub}`);

    if (existingDiscord && existingDiscord !== discordId) {
      return res.status(409).send("This Roblox account is already linked.");
    }

    const existingRoblox = await redis.get(`discord:${discordId}`);

    if (existingRoblox && existingRoblox !== user.sub) {
      return res.status(409).send("Your Discord account is already linked to another Roblox account.");
    }

    await redis.set(`discord:${discordId}`, user.sub);
    await redis.set(`roblox:${user.sub}`, discordId);
const dmResponse = await fetch(
  "https://discord.com/api/v10/users/@me/channels",
  {
    method: "POST",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ recipient_id: discordId })
  }
);

if (dmResponse.ok) {
  const channel = await dmResponse.json();

  await fetch(
    `https://discord.com/api/v10/channels/${channel.id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: `✅ Your Roblox account **${user.preferred_username || user.sub}** has been successfully linked!`
      })
    }
  );
}
    return res.status(200).send(
      `Verification successful! Roblox account: ${user.preferred_username || user.sub}. You can close this page.`
    );
  } catch (error) {
    console.error("OAuth callback error:", error.message);
    return res.status(500).send("Verification failed. Please try again.");
  }
}
