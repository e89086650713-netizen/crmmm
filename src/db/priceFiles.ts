const DB_NAME = 'selfcrm-files'
const STORE_NAME = 'files'
const DB_VERSION = 1

export type PriceFileCategory = 'price' | 'estimate'

export interface PriceFile {
  id: string
  name: string
  fileName: string
  category: PriceFileCategory
  mimeType: string
  size: number
  createdAt: number
  blob: Blob
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('category', 'category', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Не удалось открыть хранилище файлов'))
  })
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function listPriceFiles(category?: PriceFileCategory): Promise<PriceFile[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = category
      ? tx.objectStore(STORE_NAME).index('category').getAll(category)
      : tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => {
      const files = (request.result as PriceFile[]).sort((a, b) => b.createdAt - a.createdAt)
      resolve(files)
    }
    request.onerror = () => reject(request.error ?? new Error('Не удалось прочитать файлы'))
    tx.oncomplete = () => db.close()
  })
}

export async function savePriceFile(
  file: File,
  category: PriceFileCategory,
  name: string,
): Promise<PriceFile> {
  const record: PriceFile = {
    id: makeId(),
    name: name.trim() || file.name.replace(/\.(xlsx?|xlsm)$/i, ''),
    fileName: file.name,
    category,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: Date.now(),
    blob: file,
  }

  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(record)
    tx.oncomplete = () => {
      db.close()
      resolve(record)
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error ?? new Error('Не удалось сохранить файл'))
    }
  })
}

export async function deletePriceFile(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error ?? new Error('Не удалось удалить файл'))
    }
  })
}

export function downloadPriceFile(file: PriceFile): void {
  const url = URL.createObjectURL(file.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
