const DB_NAME = 'selfcrm-order-estimates'
const STORE_NAME = 'estimates'
const DB_VERSION = 1

export interface OrderEstimateFile {
  orderId: string
  fileName: string
  mimeType: string
  size: number
  updatedAt: number
  blob: Blob
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'orderId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Не удалось открыть хранилище смет'))
  })
}

export async function getOrderEstimate(orderId: string): Promise<OrderEstimateFile | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(orderId)
    request.onsuccess = () => resolve(request.result as OrderEstimateFile | undefined)
    request.onerror = () => reject(request.error ?? new Error('Не удалось прочитать смету'))
    tx.oncomplete = () => db.close()
  })
}

export async function saveOrderEstimate(orderId: string, file: File): Promise<OrderEstimateFile> {
  const record: OrderEstimateFile = {
    orderId,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    updatedAt: Date.now(),
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
      reject(tx.error ?? new Error('Не удалось сохранить смету'))
    }
  })
}

export async function deleteOrderEstimate(orderId: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(orderId)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error ?? new Error('Не удалось удалить смету'))
    }
  })
}

export function downloadOrderEstimate(file: OrderEstimateFile): void {
  const url = URL.createObjectURL(file.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
