
import nacl from "tweetnacl";

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

    if (interaction.type === 2) {
      return res.status(200).json({
        type: 4,
        data: { content: "Verification system is online!" }
      });
    }

    return res.status(400).send("Unsupported interaction");
  } catch (error) {
    console.error(error.message);
    return res.status(400).send("Invalid request");
  }
}
