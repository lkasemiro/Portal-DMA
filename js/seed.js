const AedesSeed = (() => {
  const SEED_URL = "./data/aedes-seed.json";

  async function fetchSeed() {
    const response = await fetch(SEED_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Falha ao carregar seed: ${response.status}`);
    }

    return response.json();
  }

  async function ensureSeedLoaded(forceReload = false) {
    const seedStatus = await AedesDB.getConfig("seed_loaded");

    if (!seedStatus || forceReload) {
      const seed = await fetchSeed();
      await AedesDB.clearAndSeed(seed);
      return { loaded: true, reloaded: forceReload, seed };
    }

    return { loaded: false, reloaded: false, seed: null };
  }

  return {
    fetchSeed,
    ensureSeedLoaded
  };
})();