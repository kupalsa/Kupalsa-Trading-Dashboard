import type { AppSettings } from "./settings";
import { dataUrlToBase64 } from "./image";

export interface ExtractedTrade {
  date: string | null; // YYYY-MM-DD
  entryTime: string | null; // HH:MM
  exitTime: string | null; // HH:MM
  direction: "Long" | "Short" | null;
  result: "W" | "L" | "BE" | null;
  stopPoints: number | null;
}

const SYSTEM_PROMPT = `You look at a screenshot of a trading platform (e.g. TradingView) showing an entered or closed trade. Extract what is visible into strict JSON only, no prose, matching exactly this shape:
{"date": "YYYY-MM-DD or null", "entryTime": "HH:MM 24h or null", "exitTime": "HH:MM 24h or null", "direction": "Long" | "Short" | null, "result": "W" | "L" | "BE" | null, "stopPoints": number or null}
If a field is not visible or you are not confident, use null for it. Respond with only the JSON object, nothing else.`;

export async function extractTradeFromScreenshot(
  s: AppSettings,
  imageDataUrl: string,
): Promise<ExtractedTrade> {
  const mediaType = imageDataUrl.substring(
    imageDataUrl.indexOf(":") + 1,
    imageDataUrl.indexOf(";"),
  );
  const base64 = dataUrlToBase64(imageDataUrl);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": s.anthropicKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-opus-5",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: "Extract the trade data as JSON." },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse AI response as JSON");
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    date: parsed.date ?? null,
    entryTime: parsed.entryTime ?? null,
    exitTime: parsed.exitTime ?? null,
    direction: parsed.direction ?? null,
    result: parsed.result ?? null,
    stopPoints:
      typeof parsed.stopPoints === "number" ? parsed.stopPoints : null,
  };
}
