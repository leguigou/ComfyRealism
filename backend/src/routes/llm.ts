import express from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth';
import { ServiceUrlError, validateServiceUrl } from '../security/service-url';

const router = express.Router();

router.post('/enhance-prompt', authenticate, async (req, res) => {
  try {
    const { prompt, llmUrl, llmModel, systemMessage } = req.body;
    if (!llmUrl || !llmModel) return res.status(400).json({ error: 'LLM configuration missing' });
    
    const targetUrl = validateServiceUrl(llmUrl, 'LLM');
    const response = await axios.post(`${targetUrl}/v1/chat/completions`, {
      model: llmModel,
      messages: [
        { role: "system", content: systemMessage || "You are a professional stable diffusion prompt engineer. Transform user's ideas into highly detailed English prompts. Output JSON with 'positive' and 'negative' keys." }, 
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    }, { timeout: 25000 });
    
    let content = response.data.choices[0].message.content;
    let result = { positive: content, negative: "" };
    
    // Try to extract JSON from markdown blocks first
    let jsonStr = null;
    const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1];
    }

    // Try to extract the first valid JSON object block if no markdown block
    const extractJSON = (text: string) => {
      const start = text.indexOf('{');
      if (start === -1) return null;
      let depth = 0;
      for (let i = start; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') {
          depth--;
          if (depth === 0) return text.substring(start, i + 1);
        }
      }
      return null;
    };

    if (!jsonStr) {
      jsonStr = extractJSON(content);
    }
    
    if (jsonStr) {
      try { 
        const parsed = JSON.parse(jsonStr);
        const pos = parsed.positive || parsed.prompt || parsed.positive_prompt || parsed.text;
        const neg = parsed.negative || parsed.negative_prompt || parsed.neg || "";
        if (pos) { 
          result.positive = pos; 
          if (neg) result.negative = neg; 
        }
      } catch (e) {
        console.error('[LLM] Failed to parse JSON block:', e);
      }
    }

    // Fallback: If we failed to parse JSON, at least strip the markdown formatting
    if (result.positive === content) {
      const stripped = content.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
      if (stripped.startsWith('{')) {
         // It might be a valid JSON without markdown
         try {
           const parsed = JSON.parse(stripped);
           if (parsed.positive) {
             result.positive = parsed.positive;
             result.negative = parsed.negative || "";
           } else {
             result.positive = stripped;
           }
         } catch(e) {
           result.positive = stripped;
         }
      } else {
        result.positive = stripped;
      }
    }

    res.json({ enhancedPrompt: result.positive, negativePrompt: result.negative });
  } catch (error: any) {
    if (error instanceof ServiceUrlError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'LLM Error: ' + (error.response?.data?.error?.message || error.message) }); 
  }
});

router.post('/models', authenticate, async (req, res) => {
  try {
    const targetUrl = validateServiceUrl(req.body.llmUrl, 'LLM');
    const response = await axios.get(`${targetUrl}/v1/models`, { timeout: 5000 });
    res.json({ models: response.data.data.map((m: any) => m.id) });
  } catch (error: any) {
    if (error instanceof ServiceUrlError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Failed to fetch models' }); 
  }
});

router.post('/check', authenticate, async (req, res) => {
  try {
    const targetUrl = validateServiceUrl(req.body.llmUrl, 'LLM');
    const response = await axios.get(`${targetUrl}/v1/models`, { timeout: 3000 });
    res.json({ success: true, count: response.data.data?.length || 0 });
  } catch (error: any) {
    if (error instanceof ServiceUrlError) return res.status(error.statusCode).json({ success: false, error: error.message });
    res.status(500).json({ success: false, error: 'LLM connection failed: ' + (error.response?.data?.error?.message || error.message) }); 
  }
});

export default router;
