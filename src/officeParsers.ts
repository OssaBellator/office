export type ImportedDocumentBlock = {
  kind: 'paragraph' | 'heading-1' | 'heading-2' | 'heading-3' | 'bullet' | 'numbered'
  text: string
}

export type ImportedSlide = { title: string; body: string[]; note: string }
export type ImportedSheet = { name: string; rows: Array<Array<string | number | null>> }

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

function attribute(fragment: string, name: string) {
  return fragment.match(new RegExp(`(?:\\w+:)?${name}="([^"]*)"`, 'i'))?.[1]
}

function tagTexts(fragment: string, localName: string) {
  const result: string[] = []
  const regex = new RegExp(`<(?:\\w+:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${localName}>`, 'gi')
  for (const match of fragment.matchAll(regex)) result.push(decodeXml(match[1].replace(/<[^>]+>/g, '')))
  return result
}

function wordParagraphText(fragment: string) {
  const parts: string[] = []
  const regex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?\s*>|<w:br\b[^>]*\/?\s*>/gi
  for (const match of fragment.matchAll(regex)) {
    if (match[1] !== undefined) parts.push(decodeXml(match[1].replace(/<[^>]+>/g, '')))
    else if (/w:tab/i.test(match[0])) parts.push('\t')
    else parts.push('\n')
  }
  return parts.join('').trim()
}

function parseDocxNumbering(xml: string | null) {
  const abstractFormats = new Map<string, 'bullet' | 'numbered'>()
  if (!xml) return new Map<string, 'bullet' | 'numbered'>()
  for (const match of xml.matchAll(/<w:abstractNum\b([^>]*)>([\s\S]*?)<\/w:abstractNum>/gi)) {
    const id = attribute(match[1], 'abstractNumId')
    const format = match[2].match(/<w:numFmt\b[^>]*w:val="([^"]+)"/i)?.[1]
    if (id) abstractFormats.set(id, format === 'bullet' ? 'bullet' : 'numbered')
  }
  const numFormats = new Map<string, 'bullet' | 'numbered'>()
  for (const match of xml.matchAll(/<w:num\b([^>]*)>([\s\S]*?)<\/w:num>/gi)) {
    const numId = attribute(match[1], 'numId')
    const abstractId = match[2].match(/<w:abstractNumId\b[^>]*w:val="([^"]+)"/i)?.[1]
    if (numId && abstractId) numFormats.set(numId, abstractFormats.get(abstractId) ?? 'numbered')
  }
  return numFormats
}

export function parseDocxDocumentXml(documentXml: string, numberingXml: string | null = null): ImportedDocumentBlock[] {
  const numbering = parseDocxNumbering(numberingXml)
  const blocks: ImportedDocumentBlock[] = []
  for (const match of documentXml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi)) {
    const fragment = match[1]
    const text = wordParagraphText(fragment)
    if (!text) continue
    const style = fragment.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/i)?.[1] ?? ''
    const heading = style.match(/heading\s*([1-3])/i)
    if (heading) { blocks.push({ kind:`heading-${heading[1]}` as ImportedDocumentBlock['kind'], text }); continue }
    const numId = fragment.match(/<w:numId\b[^>]*w:val="([^"]+)"/i)?.[1]
    if (numId) { blocks.push({ kind:numbering.get(numId) ?? 'numbered', text }); continue }
    blocks.push({ kind:'paragraph', text })
  }
  return blocks
}

function slideParagraphs(fragment: string) {
  const lines: string[] = []
  for (const match of fragment.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/gi)) {
    const text = tagTexts(match[1], 't').join('').trim()
    if (text) lines.push(text)
  }
  if (lines.length) return lines
  const text = tagTexts(fragment, 't').join(' ').trim()
  return text ? [text] : []
}

export function parsePptxSlideXml(slideXml: string, notesXml: string | null = null): ImportedSlide {
  const titleCandidates: string[] = []
  const body: string[] = []
  for (const match of slideXml.matchAll(/<p:sp\b[^>]*>([\s\S]*?)<\/p:sp>/gi)) {
    const shape = match[1]
    const lines = slideParagraphs(shape)
    if (!lines.length) continue
    const isTitle = /<p:ph\b[^>]*type="(?:title|ctrTitle)"/i.test(shape)
    if (isTitle) titleCandidates.push(lines.join(' '))
    else body.push(...lines)
  }
  if (!titleCandidates.length && body.length) titleCandidates.push(body.shift()!)
  const noteLines = notesXml ? tagTexts(notesXml, 't').map((value) => value.trim()).filter(Boolean) : []
  return { title:titleCandidates.join(' ').trim() || 'Imported slide', body, note:noteLines.join(' · ') }
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? 'A'
  let result = 0
  for (const char of letters) result = result * 26 + char.charCodeAt(0) - 64
  return result - 1
}

export function parseXlsxSheetXml(sheetXml: string, sharedStrings: string[] = []): Array<Array<string | number | null>> {
  const rows: Array<Array<string | number | null>> = []
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    const row: Array<string | number | null> = []
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const attrs = cellMatch[1], body = cellMatch[2]
      const reference = attribute(attrs, 'r') ?? `A${rows.length + 1}`
      const index = columnIndex(reference)
      const type = attribute(attrs, 't') ?? ''
      const raw = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1]
      let value: string | number | null = null
      if (type === 's' && raw !== undefined) value = sharedStrings[Number(raw)] ?? ''
      else if (type === 'inlineStr') value = tagTexts(body, 't').join('')
      else if ((type === 'str' || type === 'e') && raw !== undefined) value = decodeXml(raw)
      else if (raw !== undefined && raw !== '') value = Number.isFinite(Number(raw)) ? Number(raw) : decodeXml(raw)
      while (row.length <= index) row.push(null)
      row[index] = value
    }
    rows.push(row)
  }
  return rows
}

export function parseXlsxSharedStrings(xml: string | null) {
  if (!xml) return []
  const strings: string[] = []
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)) strings.push(tagTexts(match[1], 't').join(''))
  return strings
}

export function parseXlsxWorkbook(workbookXml: string, relationshipsXml: string, sheetXmlByPath: Map<string, string>, sharedStrings: string[] = []): ImportedSheet[] {
  const relTargets = new Map<string,string>()
  for (const match of relationshipsXml.matchAll(/<Relationship\b([^>]*)\/?\s*>/gi)) {
    const id = attribute(match[1], 'Id'), target = attribute(match[1], 'Target')
    if (id && target) relTargets.set(id, target.replace(/^\/?/, ''))
  }
  const sheets: ImportedSheet[] = []
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/gi)) {
    const name = decodeXml(attribute(match[1], 'name') ?? 'Sheet')
    const relId = attribute(match[1], 'id')
    if (!relId) continue
    const target = relTargets.get(relId)
    if (!target) continue
    const normalized = target.startsWith('xl/') ? target : `xl/${target.replace(/^\.\//, '')}`
    const xml = sheetXmlByPath.get(normalized)
    if (xml) sheets.push({ name, rows:parseXlsxSheetXml(xml, sharedStrings) })
  }
  return sheets
}
