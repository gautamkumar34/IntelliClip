// src/electron/groq.ts
import { config } from 'dotenv';
config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

export async function callGroq(
    prompt: string,
    systemPrompt?: string
): Promise<string | null> {
    if (!GROQ_API_KEY) {
        console.error('GROQ_API_KEY is missing');
        return null;
    }

    try {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: messages,
                stream: false,
            }),
            signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Groq API error:', response.status, errorData);
            return null;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (e: any) {
        console.error('Groq request failed:', e.message);
        return null;
    }
}

export async function checkGroqHealth(): Promise<boolean> {
    return !!GROQ_API_KEY;
}
