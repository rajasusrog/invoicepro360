
 // Shared Cloudflare Worker & Pages Functions helper for Gemini API calls via fetch

export function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status);
}

/**
 * Direct fetch-based Gemini GenerateContent caller.
 * Compatible with Cloudflare Workers and Pages Functions.
 */
export async function callGeminiRest(
  apiKey: string,
  model: string,
  payload: {
    contents: any[];
    systemInstruction?: string;
    responseSchema?: any;
    responseMimeType?: string;
  }
): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const generationConfig: any = {};

  if (payload.responseMimeType) {
    generationConfig.responseMimeType = payload.responseMimeType;
  }

  if (payload.responseSchema) {
    generationConfig.responseSchema = payload.responseSchema;
  }

  const requestBody: any = {
    contents: payload.contents,
    generationConfig:
      Object.keys(generationConfig).length > 0
        ? generationConfig
        : undefined,
  };

  if (payload.systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: payload.systemInstruction }],
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();

  let data: any;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Gemini API returned non-JSON response (status ${response.status}): ${responseText.slice(0, 200)}`
    );
  }

  if (!response.ok || data.error) {
    const errMsg =
      data.error?.message ||
      `Gemini API request failed with status ${response.status}`;

    throw new Error(errMsg);
  }

  const candidate = data.candidates?.[0];

  if (!candidate || !candidate.content?.parts?.[0]?.text) {
    throw new Error(
      "No output text received from Gemini model candidate"
    );
  }

  return candidate.content.parts[0].text;
}
