
import { createClient } from "redis";

let client;

export async function getRedis() {
  if (!client) {
    client = createClient({
      url: process.env.REDIS_URL
    });

    client.on("error", (error) => {
      console.error("Redis connection error:", error.message);
    });
  }

  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}
