/** Nom de fichier depuis `Content-Disposition: attachment; filename="..."`. */
export function parseContentDispositionFilename(header: string | null | undefined): string | undefined {
  if (!header?.trim()) return undefined
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch {
      return star[1].trim()
    }
  }
  const plain = /filename="?([^";\n]+)"?/i.exec(header)
  return plain?.[1]?.trim() || undefined
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function tableToDelimitedText(
  headers: string[],
  rows: string[][],
  separator: string,
  options?: { includeHeader?: boolean },
): string {
  const lines: string[] = []
  if (options?.includeHeader !== false) {
    lines.push(headers.join(separator))
  }
  for (const row of rows) {
    lines.push(row.map((c) => String(c ?? '').replace(/\r?\n/g, ' ')).join(separator))
  }
  return lines.join('\r\n')
}
