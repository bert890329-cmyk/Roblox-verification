export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const { REGISTER_SECRET, DISCORD_BOT_TOKEN } = process.env;

  if (!req.body?.secret || req.body.secret !== REGISTER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
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
          embeds: [
            {
              author: {
                name: "VERIFICATION"
              },
              title: "VERIFICATION",
              description:
                "a SPECIAL verification bot made by kaden_vfx simply type Press the button to recieve the special role!",
              color: 16711680,
              image: {
                url: "https://github.com/bert890329-cmyk/Roblox-verification/blob/main/cat.webp?raw=true"
              }
            }
          ],
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
      console.error("Discord message failed:", data);
      return res.status(500).json({ error: data.message });
    }

    return res.status(200).json({
      success: true,
      message: "Verification embed created!"
    });

  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: "Setup failed" });
  }
}
