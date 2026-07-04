// Entity types
export type EntityType = 'gene' | 'disease' | 'pathway' | 'unknown'

// Confidence levels
export type ConfidenceLevel = 'High' | 'Medium' | 'Low'

// Source types
export type SourceType = 'PubMed' | 'UniProt' | 'Ensembl' | 'Reactome' | 'Manual'

// Confidence with rationale
export interface Confidence {
  level: ConfidenceLevel
  rationale: string
}

// Section with text, confidence, and sources
export interface Section {
  text: string
  confidence: Confidence
  sourceIndices: number[]
}

// Source card
export interface SourceCard {
  title: string
  type: SourceType
  snippet: string
  url: string
  id: string
  date?: string
}

// Entity info (canonical name, synonyms, etc.)
export interface EntityInfo {
  canonicalName: string
  entityType: EntityType
  organism?: string
  synonyms: string[]
  description?: string
}

// Recommended reading
export interface Reading {
  title: string
  url: string
  reason: string
}

// Full query result
export interface QueryResult {
  query: string
  entity: EntityInfo
  sections: {
    overview: Section
    function: Section
    pathways: Section
    biomarkers: Section
    clinicalNotes: Section
    readNext: Reading[]
  }
  sources: SourceCard[]
  timestamp: string
}

// Raw data from APIs
export interface RawData {
  ncbi: {
    gene?: any
    abstracts: any[]
  }
  uniprot: any[]
  ensembl: any[]
  reactome: any[]
}

// Cache entry
export interface CacheEntry {
  id: string
  query: string
  result: QueryResult
  createdAt: string
}

// API response types
export interface NCBIResult {
  pmid: string
  title: string
  authors: string[]
  abstract: string
  date: string
  journal: string
}

export interface UniProtResult {
  accession: string
  name: string
  organism: string
  function: string
  subcellularLocation: string
  pathways: string[]
}

export interface EnsemblResult {
  id: string
  displayName: string
  description: string
  biotype: string
  xrefs: { database: string; identifier: string }[]
}

export interface ReactomeResult {
  stableId: string
  pathwayName: string
  summation: string
  url: string
}
