import OpenAI from 'openai'
import { QueryResult } from '../shared/types'

const SYSTEM_PROMPT = `You are a biomedical research assistant. Given raw data from multiple sources (PubMed, UniProt, Ensembl, Reactome), produce a structured JSON summary.

Return ONLY valid JSON matching this exact structure:
{
  "overview": { "text": "...", "confidence": { "level": "High|Medium|Low", "rationale": "..." } },
  "function": { "text": "...", "confidence": { "level": "High|Medium|Low", "rationale": "..." } },
  "pathways": { "text": "...", "confidence": { "level": "High|Medium|Low", "rationale": "..." } },
  "biomarkers": { "text": "...", "confidence": { "level": "High|Medium|Low", "rationale": "..." } },
  "clinicalNotes": { "text": "...", "confidence": { "level": "High|Medium|Low", "rationale": "..." } },
  "readNext": [{ "title": "...", "url": "...", "reason": "..." }]
}

Rules:
- Each section MUST have a confidence object with "level" and "rationale" fields
- "level" must be exactly "High", "Medium", or "Low"
- "rationale" must explain WHY that confidence was assigned (e.g. "Based on 5 independent PubMed studies from 2020-2024")
- Each section text should be 3-5 sentences with specific details, not vague summaries
- readNext MUST include 3-5 relevant sources. For each recommendation, you MUST select a source explicitly listed in the Context data and copy its "title" and "URL" exactly as given. Do NOT invent, generalize, or hallucinate any URLs or titles.
- Be factual and detailed - include specific gene names, protein functions, pathway relationships
- Do not hallucinate - only use information and URLs from the provided context
- If data is sparse for a section, state what is known and note the gaps`

export type SynthesisResult = QueryResult['sections']

export class NimClient {
  private client: OpenAI
  private model: string

  constructor() {
    const apiKey = process.env.NIM_API_KEY
    if (!apiKey) {
      throw new Error('NIM_API_KEY environment variable is required')
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://integrate.api.nvidia.com/v1'
    })
    this.model = 'meta/llama-3.1-8b-instruct'
  }

  async synthesize(query: string, context: string): Promise<SynthesisResult> {
    const userMessage = `Query: ${query}

Context data:
${context}

Please synthesize this information into the required JSON structure.`

    let lastError: Error | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await Promise.race([
          this.client.chat.completions.create({
            model: this.model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.3,
            max_tokens: 4096
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('NIM API timeout after 90s')), 90000)
          )
        ])

        const content = response.choices[0]?.message?.content
        if (!content) {
          throw new Error('Empty response from NIM API')
        }

        // Strip markdown code fences if present
        let jsonStr = content.trim()
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '')
        }

        try {
          const parsed = JSON.parse(jsonStr)
          this.validateSynthesisResult(parsed)
          return parsed
        } catch (e) {
          if (e instanceof SyntaxError) {
            throw new Error(`Invalid JSON response from NIM: ${content.substring(0, 200)}`)
          }
          throw e
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 2000))
          continue
        }
      }
    }
    throw lastError || new Error('NIM API failed after retries')
  }

  private validateSynthesisResult(data: any): void {
    const requiredSections = ['overview', 'function', 'pathways', 'biomarkers', 'clinicalNotes', 'readNext']
    for (const section of requiredSections) {
      if (!(section in data)) {
        throw new Error(`Missing required section: ${section}`)
      }
    }

    for (const section of ['overview', 'function', 'pathways', 'biomarkers', 'clinicalNotes']) {
      const s = data[section]
      if (!s.text) {
        throw new Error(`Invalid section structure: ${section} - missing text`)
      }
      // Handle both flat and nested confidence formats
      if (s.confidence && typeof s.confidence === 'string') {
        s.confidence = { level: s.confidence, rationale: s.rationale || 'No rationale provided' }
      } else if (!s.confidence || !s.confidence.level) {
        throw new Error(`Invalid section structure: ${section} - missing confidence`)
      }
      if (!['High', 'Medium', 'Low'].includes(s.confidence.level)) {
        throw new Error(`Invalid confidence level in ${section}: ${s.confidence.level}`)
      }
      if (!s.confidence.rationale) {
        s.confidence.rationale = 'No rationale provided'
      }
    }

    if (!Array.isArray(data.readNext)) {
      throw new Error('readNext must be an array')
    }
  }
}
