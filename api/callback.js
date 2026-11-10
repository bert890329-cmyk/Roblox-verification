import { getRedis } from "../../lib/redis.js";

function successPage(username, reviewOnly) {
  const heading = reviewOnly ? "Roblox sign-in successful" : "Verification successful";
  const message = reviewOnly
    ? "Your Roblox account was successfully authorized. You can close this page."
    : `Roblox username: ${username}. You can close this page.`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading}</title><style>body{background:#111;color:white;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px;text-align:center}.box{background:#202020;padding:32px;border-radius:16px;max-width:480px}h1{color:#ff5555}</style></head><body><main class="box"><h1>${heading}</h1><p>${message}</p></main></body></html>`;
}

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
    const sessionData = await redis.getDel(`oauth:${state}`);
    if (!sessionData) {
      return res.status(400).send("Invalid or expired verification session.");
    }

    const session = JSON.parse(sessionData);
    const { verifier, discordId, discordUsername, mode } = session;
    const reviewOnly = mode === "review";

    if (!verifier || (!reviewOnly && !discordId)) {
      return res.status(400).send("Invalid verification session.");
    }

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.ROBLOX_CLIENT_ID,
      client_secret: process.env.ROBLOX_CLIENT_SECRET,
      redirect_uri: "https://roblox-verification-one.vercel.app/api/oauth/callback",
      code,
      code_verifier: verifier
    });

    const tokenResponse = await fetch("https://apis.roblox.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams
    });

    if (!tokenResponse.ok) {
      console.error("Roblox token exchange failed:", await tokenResponse.text());
      return res.status(400).send("Roblox login could not be completed.");
    }

    const tokens = await tokenResponse.json();
    const userResponse = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    if (!userResponse.ok) {
      return res.status(400).send("Could not retrieve Roblox account.");
    }

    const user = await userResponse.json();
    if (!user.sub) {
      return res.status(400).send("Roblox did not return a user ID.");
    }

    const robloxRecord = {
      robloxId: String(user.sub),
      username: user.preferred_username || "Unknown",
      discordUsername: discordUsername || "Unknown"
    };

    // Public review sign-in only demonstrates OAuth. It does not save a
    // verification record or attempt to assign Discord roles.
    if (reviewOnly) {
      return res.status(200).send(successPage(robloxRecord.username, true));
    }

    await redis.set(`roblox:${user.sub}`, JSON.stringify(robloxRecord));
    await redis.del(`discord:${discordId}`);

    const guildId = process.env.DISCORD_GUILD_ID;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const verifiedRole = process.env.DISCORD_VERIFIED_ROLE_ID;
    const memberRole = process.env.DISCORD_MEMBER_ROLE_ID;

    const addRole = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${verifiedRole}`,
      { method: "PUT", headers: { Authorization: `Bot ${botToken}` } }
    );
    if (!addRole.ok) {
      console.error("Could not assign VIP role:", await addRole.text());
    }

    const removeRole = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${memberRole}`,
      { method: "DELETE", headers: { Authorization: `Bot ${botToken}` } }
    );
    if (!removeRole.ok) {
      console.error("Could not remove Member role:", await removeRole.text());
    }

    try {
      const dmResponse = await fetch("https://discord.com/api/v10/users/@me/channels", {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ recipient_id: discordId })
      });

      if (dmResponse.ok) {
        const channel = await dmResponse.json();
        await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            content: `✅ Your Roblox account **${robloxRecord.username}** has been successfully linked!`
          })
        });
      }
    } catch (dmError) {
      console.error("Discord DM failed:", dmError.message);
    }

    return res.status(200).send(successPage(robloxRecord.username, false));
  } catch (error) {
    console.error("OAuth callback error:", error.message);
    return res.status(500).send("Verification failed. Please try again.");
  }
}
