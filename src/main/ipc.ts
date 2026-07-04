import { IpcMain, dialog, BrowserWindow, shell } from 'electron'
import { NimClient } from './nim'
import { CacheStore } from './cache'
import { fetchGeneData, resolveEntity, formatContextData, getSuggestions } from './apis'
import { QueryResult } from '../shared/types'

let nimClient: NimClient | null = null
let cacheStore: CacheStore | null = null

function getNimClient(): NimClient {
  if (!nimClient) {
    nimClient = new NimClient()
  }
  return nimClient
}

function getCacheStore(): CacheStore {
  if (!cacheStore) {
    cacheStore = new CacheStore()
  }
  return cacheStore
}

export function registerIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('query:suggest', async (_event, query: string) => {
    return getSuggestions(query)
  })

  ipcMain.handle('query:run', async (_event, query: string) => {
    try {
      // Check cache first
      const cache = getCacheStore()
      const cached = await cache.getQuery(query)
      if (cached) {
        return cached.result
      }

      // Run entity resolution AND data fetch in parallel — don't wait for entity type
      const [entity, rawData] = await Promise.all([
        resolveEntity(query).catch(() => ({
          canonicalName: query,
          entityType: 'disease' as const,
          organism: 'Homo sapiens',
          synonyms: [],
          description: ''
        })),
        fetchGeneData(query).catch(() => ({
          ncbi: { gene: null, abstracts: [] },
          uniprot: [],
          ensembl: [],
          reactome: [],
          pubmed: []
        }))
      ])
      const context = formatContextData(rawData)

      // Synthesize with NIM
      const nim = getNimClient()
      const sections = await nim.synthesize(query, context)

    // Build source cards
    const sources = [
      ...rawData.ncbi.abstracts.map((abs: any, i: number) => ({
        title: abs.title,
        type: 'PubMed' as const,
        snippet: abs.abstract.substring(0, 200) + '...',
        url: `https://pubmed.ncbi.nlm.nih.gov/${abs.pmid}/`,
        id: abs.pmid,
        date: abs.date
      })),
      ...rawData.uniprot.map((up: any) => ({
        title: up.name,
        type: 'UniProt' as const,
        snippet: up.function,
        url: `https://www.uniprot.org/uniprot/${up.accession}`,
        id: up.accession
      })),
      ...rawData.ensembl.map((en: any) => ({
        title: en.displayName,
        type: 'Ensembl' as const,
        snippet: en.description,
        url: `https://ensembl.org/Homo_sapiens/Gene/Summary?g=${en.id}`,
        id: en.id
      })),
      ...rawData.reactome
        .filter((re: any) => re.stableId && re.url)
        .map((re: any) => {
          const summationText = Array.isArray(re.summation)
            ? re.summation.map((s: any) => typeof s === 'string' ? s : s?.text || '').filter(Boolean).join(' ')
            : ''
          return {
            title: re.pathwayName,
            type: 'Reactome' as const,
            snippet: summationText || 'Pathway data from Reactome',
            url: re.url,
            id: re.stableId
          }
        })
    ]

    const result: QueryResult = {
      query,
      entity,
      sections,
      sources,
      timestamp: new Date().toISOString()
    }

    // Cache the result
    await cache.saveQuery(query, result)

    return result
    } catch (error) {
      console.error('Query failed:', error)
      throw error
    }
  })

  ipcMain.handle('query:history', async () => {
    const cache = getCacheStore()
    return cache.getRecentQueries(20)
  })

  ipcMain.handle('query:export', async (_event, format: string, result: QueryResult) => {
    const win = BrowserWindow.getFocusedWindow()
    const dialogResult = await dialog.showSaveDialog(win!, {
      defaultPath: `${result.entity.canonicalName}_report.${format === 'pdf' ? 'pdf' : 'md'}`,
      filters: format === 'pdf'
        ? [{ name: 'PDF', extensions: ['pdf'] }]
        : [{ name: 'Markdown', extensions: ['md'] }]
    })

    if (dialogResult.canceled || !dialogResult.filePath) return null

    if (format === 'markdown') {
      const markdown = generateMarkdown(result)
      const fs = await import('fs')
      fs.writeFileSync(dialogResult.filePath, markdown)
    } else if (format === 'pdf') {
      await generatePDF(result, dialogResult.filePath)
    }

    return dialogResult.filePath
  })

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url)
  })
}

function generateMarkdown(result: QueryResult): string {
  const lines: string[] = []
  lines.push(`# ${result.entity.canonicalName} — PathwayLens Report`)
  lines.push('')
  lines.push(`**Entity Type:** ${result.entity.entityType}`)
  lines.push(`**Organism:** ${result.entity.organism || 'Unknown'}`)
  if (result.entity.synonyms.length > 0) {
    lines.push(`**Synonyms:** ${result.entity.synonyms.join(', ')}`)
  }
  lines.push(`**Generated:** ${new Date(result.timestamp).toLocaleString()}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  const sections = ['overview', 'function', 'pathways', 'biomarkers', 'clinicalNotes'] as const
  const titles = ['Overview', 'Function', 'Associated Pathways', 'Known Biomarkers', 'Clinical/Research Notes']

  for (let i = 0; i < sections.length; i++) {
    const section = result.sections[sections[i]]
    lines.push(`## ${titles[i]}`)
    lines.push('')
    lines.push(`> **Confidence:** ${section.confidence.level} — ${section.confidence.rationale}`)
    lines.push('')
    lines.push(section.text)
    lines.push('')
  }

  if (result.sections.readNext.length > 0) {
    lines.push('## What to Read Next')
    lines.push('')
    for (const reading of result.sections.readNext) {
      lines.push(`- **[${reading.title}](${reading.url})** — ${reading.reason}`)
    }
    lines.push('')
  }

  lines.push('## Sources')
  lines.push('')
  for (const source of result.sources) {
    lines.push(`- [${source.title}](${source.url}) (${source.type})`)
  }
  lines.push('')
  lines.push('---')
  lines.push('*Generated by PathwayLens — A research-assist tool, not a clinical decision system.*')

  return lines.join('\n')
}

async function generatePDF(result: QueryResult, filePath: string): Promise<void> {
  const PDFDocument = (await import('pdfkit')).default
  const fs = await import('fs')

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    doc.fontSize(20).text(`${result.entity.canonicalName}`, { align: 'center' })
    doc.moveDown()
    doc.fontSize(12).text(`Entity Type: ${result.entity.entityType}`)
    doc.text(`Organism: ${result.entity.organism || 'Unknown'}`)
    doc.text(`Generated: ${new Date(result.timestamp).toLocaleString()}`)
    doc.moveDown()

    const sections = ['overview', 'function', 'pathways', 'biomarkers', 'clinicalNotes'] as const
    const titles = ['Overview', 'Function', 'Associated Pathways', 'Known Biomarkers', 'Clinical/Research Notes']

    for (let i = 0; i < sections.length; i++) {
      const section = result.sections[sections[i]]
      doc.fontSize(14).text(titles[i])
      doc.fontSize(10).text(`Confidence: ${section.confidence.level} — ${section.confidence.rationale}`)
      doc.moveDown(0.5)
      doc.fontSize(11).text(section.text)
      doc.moveDown()
    }

    if (result.sections.readNext.length > 0) {
      doc.fontSize(14).text('What to Read Next')
      doc.moveDown(0.5)
      doc.fontSize(11)
      for (const reading of result.sections.readNext) {
        doc.text(`• ${reading.title} — ${reading.reason}`)
      }
      doc.moveDown()
    }

    doc.fontSize(8).text('Generated by PathwayLens — A research-assist tool, not a clinical decision system.', { align: 'center' })
    doc.end()

    stream.on('finish', resolve)
    stream.on('error', reject)
  })
}
