/**
 * Sihirbaz fotoğraflarının tarayıcıdaki kalıcı deposu.
 *
 * Mobil uygulama taslakta yalnız yerel dosya adresini saklar; tarayıcıda `File` nesnesi
 * yeniden yüklenince yaşamaz. Bu yüzden küçültülmüş JPEG blob'ları IndexedDB'de tutulur,
 * taslak (metin/kararlar) `localStorage`'da kalır. Böylece sekme yenilenince analiz ve kayıt
 * kaldığı yerden devam eder.
 */

const DB_NAME = 'urundedektifi.wizard'
const STORE = 'photos'
const VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Tarayıcı fotoğraf deposunu desteklemiyor.'))
  }
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Fotoğraf deposu açılamadı.'))
  })
  return dbPromise
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDb()
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE, mode)
    const request = run(transaction.objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Fotoğraf deposu hatası.'))
  })
}

export async function putPhotoBlob(id: string, blob: Blob): Promise<void> {
  await withStore('readwrite', (store) => store.put(blob, id))
}

export async function getPhotoBlob(id: string): Promise<Blob | null> {
  const value = await withStore<Blob | undefined>('readonly', (store) => store.get(id))
  return value ?? null
}

export async function deletePhotoBlob(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id))
}

export async function clearPhotoBlobs(): Promise<void> {
  await withStore('readwrite', (store) => store.clear())
}
