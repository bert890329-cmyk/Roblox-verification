
import nacl from "tweetnacl";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const signature = req.headers["x-signature-ed25519"];
    const timestamp = req.headers["x-signature-timestamp"];
    const publicKey = process.env.DISCORD_PUBLIC_KEY;

    if (!signature || !timestamp || !publicKey || !req.rawBody) {
      return res.status(401).send("Invalid request");
    }

    const valid = nacl.sign.detached.verify(
      Buffer.from(timestamp + req.rawBody.toString()),
      Buffer.from(signature, "hex"),
      Buffer.from(publicKey, "hex")
    );

    if (!valid) {
      return res.status(401).send("Invalid signature");
    }

    const interaction = JSON.parse(req.rawBody.toString());

    if (interaction.type === 1) {
      return res.status(200).json({ type: 1 });
    }

    if (interaction.type === 2) {
      return res.status(200).json({
        type: 4,
        data: {
          content: "Discord verification endpoint is working!"
        }
      });
    }

    return res.status(400).send("Unsupported interaction");
  } catch (error) {
    console.error("Discord interaction error:", error.message);
    return res.status(400).send("Invalid request");
  }
}

