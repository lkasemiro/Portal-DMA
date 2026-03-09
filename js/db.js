const AedesDB = (() => {
  const DB_NAME = "portal_dma_aedes";
  const DB_VERSION = 1;

  const STORES = {
    metadata: "metadata",
    unidades: "unidades",
    vistorias: "vistorias",
    config: "config"
  };

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORES.metadata)) {
          db.createObjectStore(STORES.metadata, { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains(STORES.unidades)) {
          const store = db.createObjectStore(STORES.unidades, { keyPath: "id" });
          store.createIndex("nome", "nome", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.vistorias)) {
          const store = db.createObjectStore(STORES.vistorias, { keyPath: "id" });
          store.createIndex("unidadeId", "unidadeId", { unique: false });
          store.createIndex("ano", "ano", { unique: false });
          store.createIndex("dataVistoria", "dataVistoria", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.config)) {
          db.createObjectStore(STORES.config, { keyPath: "key" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function txComplete(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function clearAndSeed(seed) {
    const db = await openDB();
    const tx = db.transaction(
      [STORES.metadata, STORES.unidades, STORES.vistorias, STORES.config],
      "readwrite"
    );

    tx.objectStore(STORES.metadata).clear();
    tx.objectStore(STORES.unidades).clear();
    tx.objectStore(STORES.vistorias).clear();

    tx.objectStore(STORES.metadata).put({
      key: "aedes",
      value: seed.metadata || {}
    });

    for (const unidade of seed.unidades || []) {
      tx.objectStore(STORES.unidades).put(unidade);
    }

    for (const vistoria of seed.vistorias || []) {
      tx.objectStore(STORES.vistorias).put(vistoria);
    }

    tx.objectStore(STORES.config).put({
      key: "seed_loaded",
      value: true,
      loadedAt: new Date().toISOString()
    });

    await txComplete(tx);
    db.close();
  }

  async function getConfig(key) {
    const db = await openDB();
    const tx = db.transaction(STORES.config, "readonly");
    const req = tx.objectStore(STORES.config).get(key);

    const result = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    db.close();
    return result;
  }

  async function getMetadata() {
    const db = await openDB();
    const tx = db.transaction(STORES.metadata, "readonly");
    const req = tx.objectStore(STORES.metadata).get("aedes");

    const result = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result?.value || null);
      req.onerror = () => reject(req.error);
    });

    db.close();
    return result;
  }

  async function getAll(storeName) {
    const db = await openDB();
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();

    const result = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    db.close();
    return result;
  }

  async function getAllUnidades() {
    return getAll(STORES.unidades);
  }

  async function getAllVistorias() {
    return getAll(STORES.vistorias);
  }

  return {
    openDB,
    clearAndSeed,
    getConfig,
    getMetadata,
    getAllUnidades,
    getAllVistorias,
    STORES
  };
})();