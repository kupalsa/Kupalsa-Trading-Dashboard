import type { AppSettings } from "./settings";
import { dataUrlToBase64 } from "./image";

export interface ExtractedTrade {
  date: string | null; // YYYY-MM-DD
  entryTime: string | null; // HH:MM
  exitTime: string | null; // HH:MM
  direction: "Long" | "Short" | null;
  result: "W" | "L" | "BE" | null;
  stopPoints: number | null; // point distance, computed from entryPrice/stopPrice
}

const SYSTEM_PROMPT = `You read a TradingView screenshot of a single gold-futures trade, usually drawn with the Long/Short Position tool. Extract what is visible into strict JSON only, no prose, matching exactly this shape:
{"date": "YYYY-MM-DD or null", "entryTime": "HH:MM 24h or null", "exitTime": "HH:MM 24h or null", "direction": "Long" | "Short" | null, "entryPrice": number or null, "stopPrice": number or null, "result": "W" | "L" | "BE" | null}

Report only what is visible. If a value is unreadable or not shown, use null for it rather than guessing.

How to read the Long/Short Position tool drawing, if present:
- It shows two stacked coloured boxes sharing one horizontal boundary line — that line is the entry.
- The gray box is always the stop side. The coloured box (green/orange/blue/yellow/red) is always the profit side.
- If the gray box is below the entry line and the coloured box is above it, direction is "Long". If the gray box is above the entry line and the coloured box is below it, direction is "Short".
- Read entryPrice from the price-axis label at the entry boundary line, and stopPrice from the price-axis label at the outer edge of the gray box (bottom edge for Long, top edge for Short). Read these from the printed axis labels, not by estimating against gridlines. Report each to one decimal place.

How to read the result, if determinable from this image:
- "W": price reached the far edge of the coloured (profit) box before touching the gray box.
- "L": price reached the outer edge of the gray box first.
- "BE": price returned to the entry line and the trade closed there.
- If price never touched the entry line, or you cannot tell which level was hit first from this single image, use null for result rather than guessing.

Respond with only the JSON object, nothing else.`;

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

  const entryPrice = typeof parsed.entryPrice === "number" ? parsed.entryPrice : null;
  const stopPrice = typeof parsed.stopPrice === "number" ? parsed.stopPrice : null;
  const stopPoints =
    entryPrice != null && stopPrice != null
      ? Math.round(Math.abs(entryPrice - stopPrice) * 100) / 100
      : null;

  return {
    date: parsed.date ?? null,
    entryTime: parsed.entryTime ?? null,
    exitTime: parsed.exitTime ?? null,
    direction: parsed.direction ?? null,
    result: parsed.result ?? null,
    stopPoints,
  };
}
