
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const {
    REGISTER_SECRET,
    DISCORD_BOT_TOKEN,
    DISCORD_APPLICATION_ID,
    DISCORD_GUILD_ID
  } = process.env;

  if (!req.body?.secret || req.body.secret !== REGISTER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (
    !DISCORD_BOT_TOKEN ||
    !DISCORD_APPLICATION_ID ||
    !DISCORD_GUILD_ID
  ) {
    return res.status(500).json({ error: "Missing configuration" });
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/guilds/${DISCORD_GUILD_ID}/commands`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify([
          {
            name: "verify",
            description: "Verify your Roblox account"
          }
        ])
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Discord registration failed:", data);
      return res.status(500).json({ error: "Discord registration failed" });
    }

    return res.status(200).json({
      success: true,
      message: "The /verify command was registered!"
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: "Registration failed" });
  }
}
