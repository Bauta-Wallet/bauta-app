import { keccak256, toHex, hexToBytes, concat, getAddress } from "viem";

export const STEALTH_REGISTRY_ADDRESS =
  "0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538" as `0x${string}`;

export const STEALTH_ANNOUNCER_ADDRESS =
  "0x55649E01B5Df198D18D95b5cc5051630cfD45564" as `0x${string}`;

export const STEALTH_REGISTRY_ABI = [
  {
    type: "function",
    name: "stealthMetaAddressOf",
    stateMutability: "view",
    inputs: [
      { name: "registrant", type: "address" },
      { name: "schemeId",   type: "uint256" },
    ],
    outputs: [{ name: "", type: "bytes" }],
  },
] as const;

export const STEALTH_ANNOUNCER_ABI = [
  {
    type: "function",
    name: "announce",
    stateMutability: "nonpayable",
    inputs: [
      { name: "schemeId",        type: "uint256" },
      { name: "stealthAddress",  type: "address" },
      { name: "ephemeralPubKey", type: "bytes"   },
      { name: "metadata",        type: "bytes"   },
    ],
    outputs: [],
  },
] as const;

export const SCHEME_ID_CLASSIC = 2n;
export const SCHEME_ID_PQ      = 4n;

const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

// ── Meta-address parsing ──────────────────────────────────────────────────────

interface ParsedMetaAddress {
  spendPubBytes: Uint8Array; // 33 bytes
  viewPubBytes:  Uint8Array; // 33 bytes
  mlkemEncapsKey?: Uint8Array; // 1184 bytes — only for PQ
}

function parseMetaAddress(bytes: Uint8Array): ParsedMetaAddress {
  // bauta classic: 0x00 + spend(33) + view(33) = 67 bytes
  if (bytes.length === 67 && bytes[0] === 0x00) {
    return { spendPubBytes: bytes.slice(1, 34), viewPubBytes: bytes.slice(34, 67) };
  }
  // bauta PQ: 0x00 + spend(33) + view(33) + mlkem(1184) = 1251 bytes
  if (bytes.length === 1251 && bytes[0] === 0x00) {
    return {
      spendPubBytes:  bytes.slice(1, 34),
      viewPubBytes:   bytes.slice(34, 67),
      mlkemEncapsKey: bytes.slice(67, 1251),
    };
  }
  // ERC-5564 standard (no prefix): spend(33) + view(33) = 66 bytes
  if (bytes.length === 66) {
    return { spendPubBytes: bytes.slice(0, 33), viewPubBytes: bytes.slice(33, 66) };
  }
  throw new Error(`Unrecognized meta-address format (${bytes.length} bytes)`);
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface StealthResult {
  stealthAddress:  string;
  ephemeralPubkey: string;
  viewTag:         number;
  kemCiphertext?:  string; // only for PQ
  schemeId:        bigint;
}

// ── Classic derivation ────────────────────────────────────────────────────────

export async function deriveStealthAddress(metaAddressHex: string): Promise<StealthResult> {
  const { getPublicKey, getSharedSecret, Point, utils } = await import("@noble/secp256k1");

  const bytes = hexToBytes(metaAddressHex as `0x${string}`);
  const { spendPubBytes, viewPubBytes } = parseMetaAddress(bytes);

  const r = utils.randomSecretKey();
  const R = getPublicKey(r, true); // 33 bytes

  const sharedCompressed = getSharedSecret(r, viewPubBytes, true);
  const sharedX = sharedCompressed.slice(1); // x-coordinate, 32 bytes

  const h       = keccak256(toHex(sharedX));
  const viewTag = parseInt(h.slice(2, 4), 16);
  const hScalar = BigInt(h) % SECP256K1_N;

  const stealthPoint   = Point.fromBytes(spendPubBytes).add(Point.BASE.multiply(hScalar));
  const uncompressed   = stealthPoint.toBytes(false); // 65 bytes
  const addrHash       = keccak256(toHex(uncompressed.slice(1)));
  const stealthAddress = getAddress(`0x${addrHash.slice(-40)}`);

  return {
    stealthAddress,
    ephemeralPubkey: toHex(R),
    viewTag,
    schemeId: SCHEME_ID_CLASSIC,
  };
}

// ── PQ (ML-KEM-768 hybrid) derivation ────────────────────────────────────────

export async function derivePQStealthAddress(metaAddressHex: string): Promise<StealthResult> {
  const { getPublicKey, getSharedSecret, Point, utils } = await import("@noble/secp256k1");
  const { ml_kem768 } = await import("@noble/post-quantum/ml-kem.js");

  const bytes = hexToBytes(metaAddressHex as `0x${string}`);
  const { spendPubBytes, viewPubBytes, mlkemEncapsKey } = parseMetaAddress(bytes);
  if (!mlkemEncapsKey) throw new Error("Missing ML-KEM encapsulation key");

  const r = utils.randomSecretKey();
  const R = getPublicKey(r, true);

  const sharedCompressed = getSharedSecret(r, viewPubBytes, true);
  const sharedX = sharedCompressed.slice(1);

  const { cipherText: kemCiphertextBytes, sharedSecret: sharedKem } = ml_kem768.encapsulate(mlkemEncapsKey);

  // Hybrid: h = keccak256(ecdh_x || kem_secret)
  const h       = keccak256(toHex(concat([sharedX, sharedKem])));
  const viewTag = parseInt(h.slice(2, 4), 16);
  const hScalar = BigInt(h) % SECP256K1_N;

  const stealthPoint   = Point.fromBytes(spendPubBytes).add(Point.BASE.multiply(hScalar));
  const uncompressed   = stealthPoint.toBytes(false);
  const addrHash       = keccak256(toHex(uncompressed.slice(1)));
  const stealthAddress = getAddress(`0x${addrHash.slice(-40)}`);

  return {
    stealthAddress,
    ephemeralPubkey: toHex(R),
    viewTag,
    kemCiphertext: toHex(kemCiphertextBytes),
    schemeId: SCHEME_ID_PQ,
  };
}

// ── Metadata builder ──────────────────────────────────────────────────────────

export function buildMetadata(result: StealthResult): `0x${string}` {
  const viewTagByte = new Uint8Array([result.viewTag]);
  if (result.kemCiphertext) {
    const kemBytes = hexToBytes(result.kemCiphertext as `0x${string}`);
    return toHex(concat([viewTagByte, kemBytes])) as `0x${string}`;
  }
  return toHex(viewTagByte) as `0x${string}`;
}
