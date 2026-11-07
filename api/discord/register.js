export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const {
    REGISTER_SECRET,
    DISCORD_BOT_TOKEN
  } = process.env;

  if (!req.body?.secret || req.body.secret !== REGISTER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!DISCORD_BOT_TOKEN) {
    return res.status(500).json({ error: "Missing bot token" });
  }

  try {
    const response = await fetch(
      "https://discord.com/api/v10/channels/1568473525671432202/messages",
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: "**ROBLOX VERIFICATION**\n\nClick the button below to link your Roblox account and unlock the server.",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 1,
                  label: "Verify with Roblox",
                  custom_id: "verify_roblox"
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Message creation failed:", data);
      return res.status(500).json({ error: "Could not create button" });
    }

    return res.status(200).json({
      success: true,
      message: "Verification button created!"
    });

  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: "Setup failed" });
  }
}
