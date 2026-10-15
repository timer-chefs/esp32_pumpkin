const DATABASE_NAME = "pumpkin-downloads";
const STORE_NAME = "files";

export interface DownloadProgress {
  loaded: number;
  /** 0 when the size isn't known up front. */
  total: number;
}

let database: Promise<IDBDatabase | null> | null = null;

/**
 * Fetches a file, keeping it in IndexedDB so it's only downloaded once. The
 * page is served over plain HTTP, which rules out the Cache API and the
 * origin private file system, and these files are too big to rely on the
 * browser's HTTP cache keeping them.
 */
export async function fetchCached(
  url: string,
  onProgress: (progress: DownloadProgress) => void = () => {},
): Promise<ArrayBuffer> {
  const files = await openDatabase();

  const cached = files && (await read(files, url).catch(() => undefined));
  if (cached) {
    return cached;
  }

  const data = await download(url, onProgress);
  if (files) {
    await write(files, url, data).catch((error) =>
      console.warn(`Could not keep ${url} for next time:`, error),
    );
  }
  return data;
}

function openDatabase(): Promise<IDBDatabase | null> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    // A private window, say. Everything still works, just downloaded afresh.
    console.warn("Downloads can't be kept in this browser:", error);
    return null;
  });
  return database;
}

function read(
  files: IDBDatabase,
  url: string,
): Promise<ArrayBuffer | undefined> {
  return new Promise((resolve, reject) => {
    const request = files
      .transaction(STORE_NAME)
      .objectStore(STORE_NAME)
      .get(url);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function write(files: IDBDatabase, url: string, data: ArrayBuffer) {
  return new Promise<void>((resolve, reject) => {
    const transaction = files.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(data, url);
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(transaction.error);
  });
}

async function download(
  url: string,
  onProgress: (progress: DownloadProgress) => void,
): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Could not download ${url} (${response.status})`);
  }

  // A compressed response's length is of what comes over the wire, not of
  // what reading it gives back.
  const total = response.headers.get("Content-Encoding")
    ? 0
    : Number(response.headers.get("Content-Length")) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    loaded += value.length;
    onProgress({ loaded, total });
  }

  const data = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return data.buffer;
}
