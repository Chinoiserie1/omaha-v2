/**
 * Curated list of assets available for LLM thesis generation.
 *
 * Sources:
 * - Crypto symbols: derived from asset-aliases-backup.json (the curated alias map)
 * - Crypto mints: looked up from Jupiter-verified tradeable-assets.csv
 * - Stocks: one "best" version per ticker from STOCK_TICKERS (sync-asset-aliases.ts)
 * - Stock mints: from seed-stock-tokens.ts XSTOCKS/ONDO_TOKENS arrays
 */

export interface CuratedAsset {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  category: "crypto" | "stock";
}

export const CURATED_ASSETS: CuratedAsset[] = [
  // ═══════════════════════════════════════════════
  // CRYPTO — from asset-aliases-backup.json targets
  // ═══════════════════════════════════════════════

  // Core
  { symbol: "SOL", name: "Wrapped SOL", mint: "So11111111111111111111111111111111111111112", decimals: 9, category: "crypto" },
  { symbol: "USDC", name: "USD Coin", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, category: "crypto" },
  { symbol: "USDT", name: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6, category: "crypto" },
  { symbol: "ETH", name: "Ether (Portal)", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", decimals: 8, category: "crypto" },
  { symbol: "zBTC", name: "zBTC", mint: "zBTCug3er3tLyffELcvDNrKkCymbPWysGcWihESYfLg", decimals: 8, category: "crypto" },
  { symbol: "21BTC", name: "21.co Wrapped Bitcoin", mint: "21BTCo9hWHjGYYUQQLqjLgDBxjcn8vDt4Zic7TB3UbNE", decimals: 8, category: "crypto" },
  { symbol: "cbBTC", name: "Coinbase Wrapped BTC", mint: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij", decimals: 8, category: "crypto" },
  { symbol: "WBTC", name: "Wrapped BTC", mint: "5XZw2LKTyrfvfiskJ78AMpackRjPcyCif1WhUsPDuVqQ", decimals: 8, category: "crypto" },

  // DeFi / Infrastructure (from aliases)
  { symbol: "JUP", name: "Jupiter", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, category: "crypto" },
  { symbol: "RAY", name: "Raydium", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6, category: "crypto" },
  { symbol: "ORCA", name: "Orca", mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", decimals: 6, category: "crypto" },
  { symbol: "DRIFT", name: "Drift", mint: "DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7", decimals: 6, category: "crypto" },
  { symbol: "PYTH", name: "Pyth Network", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", decimals: 6, category: "crypto" },
  { symbol: "W", name: "Wormhole", mint: "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ", decimals: 6, category: "crypto" },
  { symbol: "KMNO", name: "Kamino", mint: "KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS", decimals: 6, category: "crypto" },
  { symbol: "MNDE", name: "Marinade", mint: "MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey", decimals: 9, category: "crypto" },
  { symbol: "RNGR", name: "Ranger", mint: "RNGRtJMbCveqCp7AC6U95KmrdKecFckaJZiWbPGmeta", decimals: 6, category: "crypto" },
  { symbol: "JTO", name: "JITO", mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", decimals: 9, category: "crypto" },
  { symbol: "TNSR", name: "Tensor", mint: "HHoXk7WursT9DLBBhHzBWBbuQkfvvoNyHKpJi61mpump", decimals: 6, category: "crypto" },
  { symbol: "RENDER", name: "Render Token", mint: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof", decimals: 8, category: "crypto" },
  { symbol: "SHDW", name: "Shadow Token", mint: "SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y", decimals: 9, category: "crypto" },
  { symbol: "HYPE", name: "HYPE", mint: "98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g", decimals: 9, category: "crypto" },
  { symbol: "UNI", name: "Uniswap (Portal)", mint: "8FU95xFJhUUkyyCLU13HSzDLs7oC4QZdXQHL6SCeab36", decimals: 8, category: "crypto" },
  { symbol: "DYDX", name: "dYdX (Portal)", mint: "4Hx6Bj56eGyw8EJrrheM6LBQAvVYRikYCWsALeTrwyRU", decimals: 8, category: "crypto" },
  { symbol: "PUMP", name: "Pump", mint: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn", decimals: 6, category: "crypto" },
  { symbol: "S", name: "Sonic", mint: "3rQK45d1ojXR7vtvCmeNjKKVycnVWqaVcP3zk1G39RJR", decimals: 9, category: "crypto" },
  { symbol: "META", name: "MetaDAO", mint: "METAwkXcqyXKy1AtsSgJ8JiUHwGCafnZL38n3vYmeta", decimals: 9, category: "crypto" },

  // L1 bridges (from aliases, Jupiter-verified)
  { symbol: "ADA", name: "Ada", mint: "E4Q5pLaEiejwEQHcM9GeYSQfMyGy8DJ4bPWgeYthn24v", decimals: 9, category: "crypto" },
  { symbol: "AVAX", name: "AVAX (Allbridge)", mint: "AUrMpCDYYcPuHhyNX8gEEqbmDPFUpBpHrNW3vPeCFn5Z", decimals: 9, category: "crypto" },
  { symbol: "FTM", name: "FTM (Allbridge)", mint: "EsPKhGTMf3bGoy4Qm7pCv3UCcWqAmbC1UGHBTDxRjjD4", decimals: 9, category: "crypto" },
  { symbol: "MNT", name: "Mantle", mint: "4SoQ8UkWfeDH47T56PA53CZCeW4KytYCiU65CwBWoJUt", decimals: 9, category: "crypto" },
  { symbol: "SHIB", name: "SHIBA INU", mint: "5MBBsoCVddAuF8XixvCcXNbHAw6WfpZ8WyTKMmczxxRN", decimals: 9, category: "crypto" },
  { symbol: "PEPE", name: "Pepe", mint: "F9CpWoyeBJfoRB8f2pBe2ZNPbPsEE76mWZWme3StsvHK", decimals: 6, category: "crypto" },
  { symbol: "ZEC", name: "Zcash", mint: "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS", decimals: 8, category: "crypto" },
  { symbol: "BORG", name: "SwissBorg", mint: "3dQTr7ror2QPKQ3GbBCokJUmjErGg8kTJzdnYjNfvi3Z", decimals: 9, category: "crypto" },
  { symbol: "ZORA", name: "ZORA", mint: "soKqZS9pASwBNS46G388nhK7XVtPaTyReffXEd3zora", decimals: 9, category: "crypto" },

  // DePIN
  { symbol: "HNT", name: "Helium Network Token", mint: "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux", decimals: 8, category: "crypto" },
  { symbol: "MOBILE", name: "Helium Mobile", mint: "mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6", decimals: 6, category: "crypto" },
  { symbol: "IOT", name: "Helium IOT", mint: "iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns", decimals: 6, category: "crypto" },
  { symbol: "GRASS", name: "Grass", mint: "Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs", decimals: 9, category: "crypto" },
  { symbol: "NOS", name: "Nosana", mint: "nosXBVoaCTtYdLvKY6Csb4AC8JCdQKKAaWYtx2ZMoo7", decimals: 6, category: "crypto" },

  // LSTs
  { symbol: "mSOL", name: "Marinade staked SOL", mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", decimals: 9, category: "crypto" },
  { symbol: "JitoSOL", name: "Jito Staked SOL", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", decimals: 9, category: "crypto" },
  { symbol: "JupSOL", name: "Jupiter Staked SOL", mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v", decimals: 9, category: "crypto" },
  { symbol: "bSOL", name: "BlazeStake Staked SOL", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", decimals: 9, category: "crypto" },
  { symbol: "INF", name: "Infinity", mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm", decimals: 9, category: "crypto" },
  { symbol: "LST", name: "Liquid Staking Token", mint: "LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp", decimals: 9, category: "crypto" },

  // Memecoins (from aliases)
  { symbol: "Bonk", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5, category: "crypto" },
  { symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6, category: "crypto" },
  { symbol: "PONKE", name: "PONKE", mint: "5z3EqYQo9HiCEs3R84RCDMu2n7anpDMxRhdK8PSWmrRC", decimals: 9, category: "crypto" },
  { symbol: "SPX", name: "SPX6900", mint: "J3NKxxXZcnNiMjKw9hYb2K4LUxgwB6t1FtPtQVsv3KFr", decimals: 8, category: "crypto" },
  { symbol: "Fartcoin", name: "Fartcoin", mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", decimals: 6, category: "crypto" },
  { symbol: "POPCAT", name: "Popcat", mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", decimals: 9, category: "crypto" },
  { symbol: "MEW", name: "cat in a dogs world", mint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", decimals: 5, category: "crypto" },
  { symbol: "PENGU", name: "Pudgy Penguins", mint: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", decimals: 6, category: "crypto" },
  { symbol: "BOME", name: "BOOK OF MEME", mint: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82", decimals: 6, category: "crypto" },
  { symbol: "WEN", name: "Wen", mint: "WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk", decimals: 5, category: "crypto" },
  { symbol: "SLERF", name: "SLERF", mint: "9999FVbjHioTcoJpoBiSjpxHW6xEn3witVuXKqBh2RFQ", decimals: 9, category: "crypto" },
  { symbol: "CHILLGUY", name: "Just a chill guy", mint: "Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump", decimals: 6, category: "crypto" },
  { symbol: "LUCE", name: "Official Mascot of the Holy Year", mint: "CBdCxKo9QavR9hfShgpEBG3zekorAeD7W1jfq2o3pump", decimals: 6, category: "crypto" },
  { symbol: "SAMO", name: "Samoyed Coin", mint: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", decimals: 9, category: "crypto" },
  { symbol: "Franklin", name: "Franklin The Turtle", mint: "CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump", decimals: 6, category: "crypto" },
  { symbol: "gork", name: "New XAI gork", mint: "38PgzpJYu2HkiYvV8qePFakB8tuobPdGm2FFEn7Dpump", decimals: 6, category: "crypto" },
  { symbol: "swarms", name: "swarms", mint: "74SBV4zDXxTRgv1pEMoECskKBkZHc2yGPnc7GYVepump", decimals: 6, category: "crypto" },

  // AI Agents
  { symbol: "ai16z", name: "ai16z", mint: "HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC", decimals: 9, category: "crypto" },
  { symbol: "GOAT", name: "Goated", mint: "EELU55zVCwTzm75UdgeAXJsBKDavjSGe6KdLRLnZpump", decimals: 6, category: "crypto" },
  { symbol: "GRIFFAIN", name: "Griffain", mint: "KENJSUYLASHUMfHyy5o4Hp2FdNqZg1AsUPhfH2kYvEP", decimals: 6, category: "crypto" },
  { symbol: "ZEREBRO", name: "zerebro", mint: "8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn", decimals: 6, category: "crypto" },
  { symbol: "VIRTUAL", name: "Virtual Protocol", mint: "3iQL8BFS2vE7mww4ehAqQHAsbmRNCrPxizWAT2Zfyr9y", decimals: 9, category: "crypto" },
  { symbol: "arc", name: "AI Rig Complex", mint: "61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump", decimals: 6, category: "crypto" },

  // Other
  { symbol: "CLOUD", name: "Cloud", mint: "CLoUDKc4Ane7HeQcPpE3YHnznRxhMimJ4MyaUqyHFzAu", decimals: 9, category: "crypto" },
  { symbol: "HONEY", name: "HONEY", mint: "4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy", decimals: 9, category: "crypto" },
  { symbol: "BLZE", name: "Blaze", mint: "BLZEEuZUBVqFhj8adcCFPJvPVCiCyVmh3hkJMrU8KuJA", decimals: 9, category: "crypto" },
  { symbol: "FIDA", name: "Bonfida", mint: "EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp", decimals: 6, category: "crypto" },
  { symbol: "ME", name: "Magic Eden", mint: "MEFNBXixkEbait3xn9bkm8WsJzXtVsaJEn4c8Sam21u", decimals: 6, category: "crypto" },
  { symbol: "PRCL", name: "Parcl", mint: "4LLbsb5ReP3yEtYzmXewyGjcir5uXtKFURtaEUVC2AHs", decimals: 6, category: "crypto" },
  { symbol: "NEON", name: "Neon EVM", mint: "NeonTjSjsuo3rexg9o6vHuMXw62f9V7zvmu8M8Zut44", decimals: 9, category: "crypto" },

  // Microcap / memes (alias targets, Jupiter-verified mints from tradeable-assets.csv)
  { symbol: "$HACHI", name: "Hachiko", mint: "x95HN3DWvbfCBtTjGm587z8suK3ec6cwQwgZNLbWKyp", decimals: 4, category: "crypto" },
  { symbol: "1", name: "1 coin can change your life", mint: "GMvCfcZg8YvkkQmwDaAzCtHDrrEtgE74nQpQ7xNabonk", decimals: 6, category: "crypto" },
  { symbol: "BIGTROUT", name: "The Big Trout", mint: "EKwF2HD6X4rHHr4322EJeK9QBGkqhpHZQSanSUmWkecG", decimals: 6, category: "crypto" },
  { symbol: "BP", name: "Barking Puppy", mint: "3B1ijcocM5EDga6XxQ7JLW7weocQPWWjuhBYG8Vepump", decimals: 6, category: "crypto" },
  { symbol: "BUTTCOIN", name: "BUTTCOIN", mint: "77KhqraBouiU91KRchLPY8DYbVtfsH4nSBgHCd4UAwBY", decimals: 6, category: "crypto" },
  { symbol: "COPPERINU", name: "copper inu", mint: "61Wj56QgGyyB966T7YsMzEAKRLcMvJpDbPzjkrCZc4Bi", decimals: 6, category: "crypto" },
  { symbol: "FAFO", name: "FAFO", mint: "BP8RUdhLKBL2vgVXc3n7oTSZKWaQVbD8S6QcPaMVBAPo", decimals: 6, category: "crypto" },
  { symbol: "FISH", name: "rainbowfish", mint: "CmgJ1PobhUqB7MEa8qDkiG2TUpMTskWj8d9JeZWSpump", decimals: 6, category: "crypto" },
  { symbol: "GOYIM", name: "Goyim", mint: "9S8edqWxoWz5LYLnxWUmWBJnePg35WfdYQp7HQkUpump", decimals: 6, category: "crypto" },
  { symbol: "GST", name: "GST", mint: "AFbX8oGjGpmVFywbVouvhQSRmiW2aR1mohfahi4Y2AdB", decimals: 9, category: "crypto" },
  { symbol: "JELLYBEAN", name: "Jellybean", mint: "412zDygnwP9DzitnQVgRKUFFTDmrYScFch6P2k39pump", decimals: 6, category: "crypto" },
  { symbol: "KILROY", name: "Kilroy was here", mint: "CFYhdWXsYfS7swnJgHRwb5toTHMEQD7Ljd5gGwKLpump", decimals: 6, category: "crypto" },
  { symbol: "LOBSTAR", name: "Lobstar", mint: "AVF9F4C4j8b1Kh4BmNHqybDaHgnZpJ7W7yLvL7hUpump", decimals: 6, category: "crypto" },
  { symbol: "MACMINI", name: "Mac mini", mint: "2QKrBtNECja4cJygxA7igwqxahs93GNmuQ2We2stpump", decimals: 6, category: "crypto" },
  { symbol: "MAXXING", name: "maxxing", mint: "32CdQdBUxbCsLy5AUHWmyidfwhgGUr9N573NBUrDpump", decimals: 6, category: "crypto" },
  { symbol: "NEET", name: "NEET", mint: "DtzWSnQaQMHKJwW5tJgtMsGSVivLeWNzXZXWctERpump", decimals: 6, category: "crypto" },
  { symbol: "NX8", name: "The Future Of Finance Index", mint: "NX8DuAWprqWAYDvpkkuhKnPfGRXQQhgiw85pCkgvFYk", decimals: 9, category: "crypto" },
  { symbol: "OIL", name: "OLIO", mint: "91D9BXEGYsqjPGWNmzhSesvnz76L8nz4pSTY4FY6surg", decimals: 6, category: "crypto" },
  { symbol: "PEACEGUY", name: "Just a peace guy", mint: "85vdovHhkXnDi98EYMQmD2vXS82jRP1VDDXfkJ38pump", decimals: 6, category: "crypto" },
  { symbol: "PENGUIN", name: "Nietzschean Penguin", mint: "8Jx8AAHj86wbQgUTjGuj6GTTL5Ps3cqxKRTvpaJApump", decimals: 6, category: "crypto" },
  { symbol: "PIGEON", name: "level941", mint: "4fSWEw2wbYEUCcMtitzmeGUfqinoafXxkhqZrA9Gpump", decimals: 6, category: "crypto" },
  { symbol: "PIPPIN", name: "Pippin", mint: "Dfh5DzRgSvvCFDoYc2ciTkMrbDfRKybA4SoFbPmApump", decimals: 6, category: "crypto" },
  { symbol: "PIPPKIN", name: "Pippkin The Horse", mint: "6ydMmFRaNt4AHBjgvSogbBvcxnTrX3QzUe2AEzVppump", decimals: 6, category: "crypto" },
  { symbol: "PSYOPANIME", name: "PsyopAnime", mint: "2nP9yKQNSGQy851iyawDvBkzkK2R2aqKArQCKc2gpump", decimals: 6, category: "crypto" },
  { symbol: "PUNCH", name: "パンチ", mint: "NV2RYH954cTJ3ckFUpvfqaQXU4ARqqDH3562nFSpump", decimals: 6, category: "crypto" },
  { symbol: "PYTHIA", name: "PYTHIA", mint: "CreiuhfwdWCN5mJbMJtA9bBpYQrQF2tCBuZwSPWfpump", decimals: 6, category: "crypto" },
  { symbol: "SURGE", name: "SURGE", mint: "3z2tRjNuQjoq6UDcw4zyEPD1Eb5KXMPYb4GWFzVT1DPg", decimals: 8, category: "crypto" },
  { symbol: "TESTICLE", name: "testicle", mint: "4TyZGqRLG3VcHTGMcLBoPUmqYitMVojXinAmkL8xpump", decimals: 6, category: "crypto" },
  { symbol: "TROLL", name: "TROLL", mint: "5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2", decimals: 6, category: "crypto" },
  { symbol: "USELESS", name: "USELESS COIN", mint: "Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk", decimals: 6, category: "crypto" },
  { symbol: "WAR", name: "WAR", mint: "8opvqaWysX1oYbXuTL8PHaoaTiXD69VFYAX4smPebonk", decimals: 6, category: "crypto" },
  { symbol: "WHITEWHALE", name: "The White Whale", mint: "a3W4qutoEJA4232T2gwZUfgYJTetr96pU4SJMwppump", decimals: 6, category: "crypto" },
  { symbol: "WW3", name: "World War 3", mint: "7m2TUkpPZCScBhPJnGjWjbh75KkDNnwAdd7i74m8awad", decimals: 6, category: "crypto" },

  // ═══════════════════════════════════════════════
  // STOCKS — one best version per STOCK_TICKERS
  // ═══════════════════════════════════════════════

  // xStock wins (decimals 8)
  { symbol: "AAPLx", name: "Apple", mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", decimals: 8, category: "stock" },
  { symbol: "ABTx", name: "Abbott", mint: "XsHtf5RpxsQ7jeJ9ivNewouZKJHbPxhPoEy6yYvULr7", decimals: 8, category: "stock" },
  { symbol: "AMBRx", name: "Amber", mint: "XsaQTCgebC2KPbf27KUhdv5JFvHhQ4GDAPURwrEhAzb", decimals: 8, category: "stock" },
  { symbol: "AMZNx", name: "Amazon", mint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg", decimals: 8, category: "stock" },
  { symbol: "AZNx", name: "AstraZeneca", mint: "Xs3ZFkPYT2BN7qBMqf1j1bfTeTm1rFzEFSsQ1z3wAKU", decimals: 8, category: "stock" },
  { symbol: "BRK.Bx", name: "Berkshire Hathaway", mint: "Xs6B6zawENwAbWVi7w92rjazLuAr5Az59qgWKcNb45x", decimals: 8, category: "stock" },
  { symbol: "CMCSAx", name: "Comcast", mint: "XsvKCaNsxg2GN8jjUmq71qukMJr7Q1c5R2Mk9P8kcS8", decimals: 8, category: "stock" },
  { symbol: "COINx", name: "Coinbase", mint: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu", decimals: 8, category: "stock" },
  { symbol: "CRCLx", name: "Circle", mint: "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1", decimals: 8, category: "stock" },
  { symbol: "CSCOx", name: "Cisco", mint: "Xsr3pdLQyXvDJBFgpR5nexCEZwXvigb8wbPYp4YoNFf", decimals: 8, category: "stock" },
  { symbol: "CVXx", name: "Chevron", mint: "XsNNMt7WTNA2sV3jrb1NNfNgapxRF5i4i6GcnTRRHts", decimals: 8, category: "stock" },
  { symbol: "DFDVx", name: "DFDV", mint: "Xs2yquAgsHByNzx68WJC55WHjHBvG9JsMB7CWjTLyPy", decimals: 8, category: "stock" },
  { symbol: "DHRx", name: "Danaher", mint: "Xseo8tgCZfkHxWS9xbFYeKFyMSbWEvZGFV1Gh53GtCV", decimals: 8, category: "stock" },
  { symbol: "GLDx", name: "Gold ETF", mint: "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re", decimals: 8, category: "stock" },
  { symbol: "GOOGLx", name: "Google", mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", decimals: 8, category: "stock" },
  { symbol: "HONx", name: "Honeywell", mint: "XsRbLZthfABAPAfumWNEJhPyiKDW6TvDVeAeW7oKqA2", decimals: 8, category: "stock" },
  { symbol: "HOODx", name: "Robinhood", mint: "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg", decimals: 8, category: "stock" },
  { symbol: "LINx", name: "Linde", mint: "XsSr8anD1hkvNMu8XQiVcmiaTP7XGvYu7Q58LdmtE8Z", decimals: 8, category: "stock" },
  { symbol: "LLYx", name: "Eli Lilly", mint: "Xsnuv4omNoHozR6EEW5mXkw8Nrny5rB3jVfLqi6gKMH", decimals: 8, category: "stock" },
  { symbol: "MCDx", name: "McDonald's", mint: "XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2", decimals: 8, category: "stock" },
  { symbol: "MDTx", name: "Medtronic", mint: "XsDgw22qRLTv5Uwuzn6T63cW69exG41T6gwQhEK22u2", decimals: 8, category: "stock" },
  { symbol: "METAx", name: "Meta Platforms", mint: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu", decimals: 8, category: "stock" },
  { symbol: "MRKx", name: "Merck", mint: "XsnQnU7AdbRZYe2akqqpibDdXjkieGFfSkbkjX1Sd1X", decimals: 8, category: "stock" },
  { symbol: "MSTRx", name: "MicroStrategy", mint: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ", decimals: 8, category: "stock" },
  { symbol: "NVDAx", name: "NVIDIA", mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", decimals: 8, category: "stock" },
  { symbol: "OPENx", name: "Opendoor", mint: "XsGtpmjhmC8kyjVSWL4VicGu36ceq9u55PTgF8bhGv6", decimals: 8, category: "stock" },
  { symbol: "ORCLx", name: "Oracle", mint: "XsjFwUPiLofddX5cWFHW35GCbXcSu1BCUGfxoQAQjeL", decimals: 8, category: "stock" },
  { symbol: "PEPx", name: "PepsiCo", mint: "Xsv99frTRUeornyvCfvhnDesQDWuvns1M852Pez91vF", decimals: 8, category: "stock" },
  { symbol: "PGx", name: "Procter & Gamble", mint: "XsYdjDjNUygZ7yGKfQaB6TxLh2gC6RRjzLtLAGJrhzV", decimals: 8, category: "stock" },
  { symbol: "PMx", name: "Philip Morris", mint: "Xsba6tUnSjDae2VcopDB6FGGDaxRrewFCDa5hKn5vT3", decimals: 8, category: "stock" },
  { symbol: "QQQx", name: "Nasdaq 100 ETF", mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ", decimals: 8, category: "stock" },
  { symbol: "SPYx", name: "S&P 500 ETF", mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", decimals: 8, category: "stock" },
  { symbol: "TBLLx", name: "US Treasury Bill ETF", mint: "XsqBC5tcVQLYt8wqGCHRnAUUecbRYXoJCReD6w7QEKp", decimals: 8, category: "stock" },
  { symbol: "TMOx", name: "Thermo Fisher", mint: "Xs8drBWy3Sd5QY3aifG9kt9KFs2K3PGZmx7jWrsrk57", decimals: 8, category: "stock" },
  { symbol: "TSLAx", name: "Tesla", mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", decimals: 8, category: "stock" },
  { symbol: "UNHx", name: "UnitedHealth", mint: "XszvaiXGPwvk2nwb3o9C1CX4K6zH8sez11E6uyup6fe", decimals: 8, category: "stock" },
  { symbol: "WMTx", name: "Walmart", mint: "Xs151QeqTCiuKtinzfRATnUESM2xTU6V9Wy8Vy538ci", decimals: 8, category: "stock" },

  // Ondo wins (decimals 9)
  { symbol: "ABBVon", name: "AbbVie", mint: "MFerpBVGKZh2jXN7cbJdXRXQTp6j6pbSnSZrfRondo", decimals: 9, category: "stock" },
  { symbol: "ACNon", name: "Accenture", mint: "12LxMMJYVSf4LoeqjFE47BQQNRciaH9E3nbDfjH4ondo", decimals: 9, category: "stock" },
  { symbol: "AMDon", name: "AMD", mint: "14diAn5z8kjrKwSC8WLqvBqqe5YmihJhjxRxd8Z6ondo", decimals: 9, category: "stock" },
  { symbol: "APPon", name: "AppLovin", mint: "14Z8rQQe2Aza33YgEUmj3g3QGNz8DXLiFPuCnsD1ondo", decimals: 9, category: "stock" },
  { symbol: "AVGOon", name: "Broadcom", mint: "1FWZtdWN7y38BSXGzbs8D6Shk88oL9atDNgbVz9ondo", decimals: 9, category: "stock" },
  { symbol: "BACon", name: "Bank of America", mint: "Wk8gC6iTNp8dqd4ghkJ3h1giiUnyhykwHh7tYWjondo", decimals: 9, category: "stock" },
  { symbol: "BAon", name: "Boeing", mint: "1YVZ4LGpq8CAhpdpm3mgy7GgPb83gJczCpxLUQ3ondo", decimals: 9, category: "stock" },
  { symbol: "COSTon", name: "Costco", mint: "6btaz134wjHkR8sqhAYrtSM6tavftfxnRvnyMd8ondo", decimals: 9, category: "stock" },
  { symbol: "CRMon", name: "Salesforce", mint: "7D7ukbcnUNYt7Et5vtsDZhAy28MKu9pkHka1Hp9ondo", decimals: 9, category: "stock" },
  { symbol: "CRWDon", name: "CrowdStrike", mint: "cdKfoNjbXgnSuxvoajhtH3uixfZhq1YXhQsS1Rwondo", decimals: 9, category: "stock" },
  { symbol: "DISon", name: "Disney", mint: "mJf1xT3suXtkXBCfZcE9oUUuyxkvSgqYBWiX7v1ondo", decimals: 9, category: "stock" },
  { symbol: "GMEon", name: "GameStop", mint: "aznKt8v32CwYMEcTcB4bGTv8DXWStCpHrcCtyy7ondo", decimals: 9, category: "stock" },
  { symbol: "GSon", name: "Goldman Sachs", mint: "BchJRy2snmhJZf3rQ9LJ3ePs2BGfYgfvQNo31d2ondo", decimals: 9, category: "stock" },
  { symbol: "HDon", name: "Home Depot", mint: "MtEXKVN3Pcggy8MPA3eJr15H6SK3RXheScqj9qtondo", decimals: 9, category: "stock" },
  { symbol: "IBMon", name: "IBM", mint: "C8bZkgSxXkyT1RgxByp2teJ24hgimPLoyEYoNa9ondo", decimals: 9, category: "stock" },
  { symbol: "INTCon", name: "Intel", mint: "cJpUMp5R7rZ6fGeLHbHhrRuJzK9mkyKDjZqNpT3ondo", decimals: 9, category: "stock" },
  { symbol: "IWMon", name: "Russell 2000 ETF", mint: "dvj2kKFSyjpnyYSYppgFdAEVfgjMEoQGi9VaV23ondo", decimals: 9, category: "stock" },
  { symbol: "JNJon", name: "Johnson & Johnson", mint: "KUXt7LzHWSQXp5eyqMZRxWjAP6yM8BUh4LRHwiwondo", decimals: 9, category: "stock" },
  { symbol: "JPMon", name: "JPMorgan", mint: "E5Gczsavxcomqf6Cw1sGCKLabL1xYD2FzKxVoB4ondo", decimals: 9, category: "stock" },
  { symbol: "KOon", name: "Coca-Cola", mint: "e6G4pfFcrdKxJuZ4YXixRFfMbpMvgXG2Mjcus71ondo", decimals: 9, category: "stock" },
  { symbol: "MAon", name: "Mastercard", mint: "EsVHcyRxXFJCLMiuYLWhoDygrNe1BJGpYeZ17X7ondo", decimals: 9, category: "stock" },
  { symbol: "MRNAon", name: "Moderna", mint: "14VP7DvCAdBCc5XGNZkPt6zhtPzJrWWS64Koxtxyondo", decimals: 9, category: "stock" },
  { symbol: "MRVLon", name: "Marvell", mint: "FovBwhoV5KQjZCdhoM6jgXYwXLX3F8vgAfvmLH7ondo", decimals: 9, category: "stock" },
  { symbol: "MSFTon", name: "Microsoft", mint: "FRmH6iRkMr33DLG6zVLR7EM4LojBFAuq6NtFzG6ondo", decimals: 9, category: "stock" },
  { symbol: "NFLXon", name: "Netflix", mint: "g4KnPrxPLeeKkwvDmZFMtYQPM64eHeShbD55vK6ondo", decimals: 9, category: "stock" },
  { symbol: "NKEon", name: "Nike", mint: "g646pcdG2Rt5DH9WZzL7VVnVDWCCMTTrnktwE74ondo", decimals: 9, category: "stock" },
  { symbol: "NVOon", name: "Novo Nordisk", mint: "GeV7S8vjP8qdYZpdGv2Xi6e7MUMCk8NAAp2z7g5ondo", decimals: 9, category: "stock" },
  { symbol: "PFEon", name: "Pfizer", mint: "Gwh9fPsX1qWATXy63vNaJnAFfwebWQtZaVmPko6ondo", decimals: 9, category: "stock" },
  { symbol: "PLTRon", name: "Palantir", mint: "HfsnTS5qtdStwec9DfBrunRqnAMYMMz1kjv9Hu9ondo", decimals: 9, category: "stock" },
  { symbol: "PYPLon", name: "PayPal", mint: "hM7B3UQTTR81mS27SxDDPzBbjejmo8fnpFjzgv9ondo", decimals: 9, category: "stock" },
  { symbol: "SHOPon", name: "Shopify", mint: "ivdDracs2s7jCP698dJXKSEQdVrNj9hasJL1Uq1ondo", decimals: 9, category: "stock" },
  { symbol: "SLVon", name: "Silver ETF", mint: "iy11ytbSGcUnrjE6Lfv78TFqxKyUESfku1FugS9ondo", decimals: 9, category: "stock" },
  { symbol: "SNOWon", name: "Snowflake", mint: "JmFLCBwoNvcXy6B2VqABg6m784ubkXpaEx3p7S5ondo", decimals: 9, category: "stock" },
  { symbol: "SPOTon", name: "Spotify", mint: "jzCvs2Pk8tDcfsFRqnEMjurgaQW4iQfEkandUR8ondo", decimals: 9, category: "stock" },
  { symbol: "TLTon", name: "Treasury Bond ETF", mint: "KaSLSWByKy6b9FrCYXPEJoHmLpuFZtTCJk1F1Z9ondo", decimals: 9, category: "stock" },
  { symbol: "TQQQon", name: "ProShares UltraPro QQQ", mint: "14W1itEkV7k1W819mLSknFTaMmkCtPokbF2tRkPUondo", decimals: 9, category: "stock" },
  { symbol: "UBERon", name: "Uber", mint: "KJNeFW3kk3ycPjXpC6cbuyckjeYHacc2ekhtAi5ondo", decimals: 9, category: "stock" },
  { symbol: "Von", name: "Visa", mint: "kxEW4oJL75K37VeXaZF1ynbHQATQwhECQKN1374ondo", decimals: 9, category: "stock" },
  { symbol: "VTIon", name: "Total Stock Market ETF", mint: "jCCU4GwukjNxAXJowG2S4KCrr5g6YyUB61WHYvGondo", decimals: 9, category: "stock" },
  { symbol: "XOMon", name: "Exxon Mobil", mint: "qCYD74QnXzd9pzv6pGHQKJVwoibL6sNcPQDnpDiondo", decimals: 9, category: "stock" },
];

export function getCuratedAssetSymbols(): string[] {
  return CURATED_ASSETS.map((a) => a.symbol);
}
