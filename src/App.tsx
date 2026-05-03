import { useState, useEffect, useRef } from "react";
import { isAddress, parseEther, getAddress } from "viem";
import { normalize } from "viem/ens";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useWriteContract,
  useSwitchChain,
  WagmiProvider,
} from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { QRCodeSVG } from "qrcode.react";
import { config } from "./lib/wagmi";
import { SUPPORTED_CHAINS, publicClients } from "./lib/chains";
import {
  STEALTH_REGISTRY_ADDRESS,
  STEALTH_REGISTRY_ABI,
  STEALTH_ANNOUNCER_ADDRESS,
  STEALTH_ANNOUNCER_ABI,
  SCHEME_ID_CLASSIC,
  SCHEME_ID_PQ,
  deriveStealthAddress,
  derivePQStealthAddress,
  buildMetadata,
  type StealthResult,
} from "./lib/stealth";

const queryClient = new QueryClient();

const DEFAULT_RELAY_URL =
  import.meta.env.VITE_RELAY_URL ?? "https://relay.bautawallet.com";
const RELAY_STORAGE_KEY = "bauta_relay_url";

interface RegistryHit {
  chainId: number;
  label: string;
  explorer: string;
  metaAddress: string;
}

type SendMode = "none" | "wallet" | "gasless";
type GaslessStatus =
  | "idle"
  | "watching"
  | "received"
  | "forwarding"
  | "announced"
  | "failed";

function LookupApp() {
  const { address, isConnected, chain: walletChain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { switchChain } = useSwitchChain();

  // ── Scan state ───────────────────────────────────────────────────────────────
  const [recipient, setRecipient] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [ensResolving, setEnsResolving] = useState(false);
  const [ensError, setEnsError] = useState<string | null>(null);
  const [scheme, setScheme] = useState<bigint>(SCHEME_ID_CLASSIC);
  const [scanning, setScanning] = useState(false);
  const [scanningChain, setScanningChain] = useState<string | null>(null);
  const [foundOn, setFoundOn] = useState<RegistryHit | null>(null);
  const [scanDone, setScanDone] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // ── Stealth result ───────────────────────────────────────────────────────────
  const [selectedChain, setSelectedChain] = useState<number | null>(null);
  const [chainExpanded, setChainExpanded] = useState(false);
  const [stealthResult, setStealthResult] = useState<StealthResult | null>(
    null,
  );

  // ── Send mode ────────────────────────────────────────────────────────────────
  const [sendMode, setSendMode] = useState<SendMode>("none");

  // ── Wallet path ──────────────────────────────────────────────────────────────
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTx, setSentTx] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // ── Relay URL ────────────────────────────────────────────────────────────────
  const [relayUrl, setRelayUrl] = useState<string>(
    () => localStorage.getItem(RELAY_STORAGE_KEY) ?? DEFAULT_RELAY_URL,
  );
  const [relayUrlDraft, setRelayUrlDraft] = useState<string>(relayUrl);
  const [relayEditing, setRelayEditing] = useState(false);
  const [relayAlive, setRelayAlive] = useState<boolean | null>(null);

  const saveRelayUrl = () => {
    const trimmed = relayUrlDraft.trim();
    if (!trimmed) return;
    setRelayUrl(trimmed);
    localStorage.setItem(RELAY_STORAGE_KEY, trimmed);
    setRelayEditing(false);
  };

  // ── Gasless path ─────────────────────────────────────────────────────────────
  const [gaslessStatus, setGaslessStatus] = useState<GaslessStatus>("idle");
  const [relayStealthAddress, setRelayStealthAddress] = useState<string | null>(
    null,
  );
  const [feeBps, setFeeBps] = useState<number | null>(null);
  const [realStealthRevealed, setRealStealthRevealed] = useState<string | null>(
    null,
  );
  const [gaslessTx, setGaslessTx] = useState<string | null>(null);
  const [gaslessError, setGaslessError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [relayCopied, setRelayCopied] = useState(false);
  const [relayUnreachable, setRelayUnreachable] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFailCount = useRef(0);
  const pendingSend = useRef(false);

  const cancelWatch = (id: string | null) => {
    if (!id) return;
    fetch(`${relayUrl}/watch/${id}`, { method: "DELETE" }).catch(() => {});
  };

  // ── Auto-send after wallet connects + chain matches ──────────────────────────
  useEffect(() => {
    if (!isConnected || !pendingSend.current || !selectedChain) return;
    if (walletChain?.id !== selectedChain) {
      switchChain({ chainId: selectedChain });
      return;
    }
    pendingSend.current = false;
    handleSend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, walletChain?.id]);

  // ── Live ENS resolution ──────────────────────────────────────────────────────
  useEffect(() => {
    const trimmed = recipient.trim();
    setResolvedAddress(null);
    setEnsError(null);
    if (!trimmed || isAddress(trimmed) || !trimmed.includes(".")) return;

    setEnsResolving(true);
    const timer = setTimeout(async () => {
      try {
        const resolved = await publicClients[1].getEnsAddress({
          name: normalize(trimmed),
        });
        setResolvedAddress(resolved ?? null);
        if (!resolved) setEnsError(`"${trimmed}" not found`);
      } catch {
        setEnsError("ENS resolution failed");
      } finally {
        setEnsResolving(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [recipient]);

  // ── Reset send state when chain changes ──────────────────────────────────────
  useEffect(() => {
    setSendMode("none");
    setSentTx(null);
    setSendError(null);
    setGaslessStatus("idle");
    setRelayStealthAddress(null);
    setFeeBps(null);
    setRealStealthRevealed(null);
    setGaslessTx(null);
    setGaslessError(null);
    setRelayUnreachable(false);
    pollFailCount.current = 0;
    if (pollRef.current) clearInterval(pollRef.current);
    setWatchId((prev) => {
      cancelWatch(prev);
      return null;
    });
  }, [selectedChain]);

  // ── beforeunload warning ─────────────────────────────────────────────────────
  useEffect(() => {
    const isDone = sentTx !== null || gaslessStatus === "announced";
    if (sendMode === "none" || isDone) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [sendMode, sentTx, gaslessStatus]);

  // ── Relay health check — when send mode selector appears or relay URL changes
  useEffect(() => {
    if (!stealthResult || !selectedChain) return;
    setRelayAlive(null);
    fetch(`${relayUrl}/health`)
      .then((r) => setRelayAlive(r.ok))
      .catch(() => setRelayAlive(false));
  }, [stealthResult, selectedChain, relayUrl]);

  // ── Gasless init — triggered when user selects "without wallet" ─────────────
  useEffect(() => {
    if (sendMode !== "gasless" || !stealthResult || !selectedChain) return;
    handleGaslessStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendMode]);

  // ── Gasless polling — triggered when watchId is set ──────────────────────────
  useEffect(() => {
    if (!watchId) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollFailCount.current = 0;
    setRelayUnreachable(false);

    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${relayUrl}/watch/${watchId}`);
        if (!r.ok) return;
        pollFailCount.current = 0;
        setRelayUnreachable(false);
        const data = await r.json();

        if (data.status === "received") setGaslessStatus("received");
        if (data.status === "forwarding" || data.status === "forwarded")
          setGaslessStatus("forwarding");
        if (data.status === "announced") {
          if (pollRef.current) clearInterval(pollRef.current);
          setGaslessTx(data.announce_tx_hash);
          setRealStealthRevealed(data.real_stealth_address);
          setGaslessStatus("announced");
          setWatchId(null);
        }
        if (data.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setGaslessError("Relay failed — your funds are recoverable.");
          setGaslessStatus("failed");
          setWatchId(null);
        }
      } catch {
        pollFailCount.current += 1;
        if (pollFailCount.current >= 1) setRelayUnreachable(true);
      }
    }, 10_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [watchId]);

  // ── Scan ─────────────────────────────────────────────────────────────────────
  const handleScan = async () => {
    const trimmed = recipient.trim();
    if (!trimmed) return;
    setScanning(true);
    setScanDone(false);
    setFoundOn(null);
    setScanError(null);
    setScanningChain(null);
    setSelectedChain(null);
    setChainExpanded(false);
    setStealthResult(null);
    setResolvedAddress(null);

    try {
      let addr: string;
      if (isAddress(trimmed)) {
        addr = trimmed;
      } else if (resolvedAddress) {
        addr = resolvedAddress;
      } else {
        setScanningChain("ENS");
        const resolved = await publicClients[1].getEnsAddress({
          name: normalize(trimmed),
        });
        if (!resolved) throw new Error(`ENS name "${trimmed}" not found`);
        addr = resolved;
        setResolvedAddress(resolved);
      }

      for (const { chain, label, explorer } of SUPPORTED_CHAINS) {
        setScanningChain(label);
        let metaAddress: string | null = null;
        try {
          const data = await publicClients[chain.id].readContract({
            address: STEALTH_REGISTRY_ADDRESS,
            abi: STEALTH_REGISTRY_ABI,
            functionName: "stealthMetaAddressOf",
            args: [getAddress(addr), scheme],
          });
          if (data && (data as string) !== "0x") metaAddress = data as string;
        } catch {
          /* RPC failed — try next chain */
        }

        if (metaAddress) {
          const hit = { chainId: chain.id, label, explorer, metaAddress };
          setFoundOn(hit);
          setStealthResult(
            scheme === SCHEME_ID_PQ
              ? await derivePQStealthAddress(metaAddress)
              : await deriveStealthAddress(metaAddress),
          );
          return;
        }
      }
    } catch (e: unknown) {
      setScanError((e as { message?: string })?.message ?? "Scan failed");
    } finally {
      setScanning(false);
      setScanningChain(null);
      setScanDone(true);
    }
  };

  // ── Gasless init: health check → register watch → get relay address ─────────
  const handleGaslessStart = async () => {
    if (!stealthResult || !selectedChain) return;
    setGaslessStatus("watching");
    setGaslessError(null);

    try {
      // 1. Health check
      const health = await fetch(`${relayUrl}/health`).catch(() => null);
      if (!health?.ok) throw new Error("Relay unavailable — try again later.");

      // 2. Register watch
      const metadata = buildMetadata(stealthResult);
      const r = await fetch(`${relayUrl}/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          real_stealth: stealthResult.stealthAddress,
          ephemeral_pubkey: stealthResult.ephemeralPubkey,
          metadata,
          scheme_id: Number(stealthResult.schemeId),
          chain_id: selectedChain,
          amount_expected: "0",
        }),
      });
      if (!r.ok) throw new Error("Failed to register watch");
      const { watch_id, relay_stealth_address, fee_bps } = await r.json();
      setWatchId(watch_id);
      setRelayStealthAddress(relay_stealth_address);
      setFeeBps(fee_bps);
    } catch (e: unknown) {
      setGaslessError(
        (e as { message?: string })?.message ?? "Relay unavailable",
      );
      setGaslessStatus("failed");
    }
  };

  // ── Wallet send + announce ────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!stealthResult || !selectedChain || !amount || !isConnected) return;
    setSending(true);
    setSentTx(null);
    setSendError(null);
    try {
      const { stealthAddress, ephemeralPubkey } = stealthResult;
      const metadata = buildMetadata(stealthResult);

      const sendHash = await sendTransactionAsync({
        to: getAddress(stealthAddress) as `0x${string}`,
        value: parseEther(amount),
      });

      await writeContractAsync({
        address: STEALTH_ANNOUNCER_ADDRESS,
        abi: STEALTH_ANNOUNCER_ABI,
        functionName: "announce",
        args: [
          scheme,
          getAddress(stealthAddress) as `0x${string}`,
          ephemeralPubkey as `0x${string}`,
          metadata,
        ],
        chainId: selectedChain,
      });

      setSentTx(sendHash);
    } catch (e: unknown) {
      setSendError((e as { message?: string })?.message ?? "Send failed");
    } finally {
      setSending(false);
    }
  };

  const selectedChainInfo = SUPPORTED_CHAINS.find(
    (c) => c.chain.id === selectedChain,
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e5e5e5",
        fontFamily: "monospace",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: 4,
          }}
        >
          bauta <span style={{ color: "#555" }}>/</span> lookup
        </h1>
        <p style={{ fontSize: 12, color: "#555", marginBottom: 32 }}>
          Send ETH privately
        </p>

        {/* Recipient */}
        <input
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value);
            setScanDone(false);
            setFoundOn(null);
            setSelectedChain(null);
            setStealthResult(null);
            setResolvedAddress(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleScan()}
          placeholder="0x... or ENS"
          style={inputStyle}
        />

        {/* Scheme selector */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 12,
          }}
        >
          {(
            [
              {
                id: SCHEME_ID_CLASSIC,
                label: "Classic",
                sub: "ECDH · secp256k1",
              },
              {
                id: SCHEME_ID_PQ,
                label: "Post-quantum",
                sub: "ECDH + ML-KEM-768",
              },
            ] as const
          ).map(({ id, label, sub }) => (
            <button
              key={String(id)}
              onClick={() => {
                setScheme(id);
                setFoundOn(null);
                setStealthResult(null);
                setScanDone(false);
              }}
              style={{
                padding: "10px 12px",
                textAlign: "left",
                fontFamily: "monospace",
                background: scheme === id ? "#13131f" : "#0f0f0f",
                border: `1px solid ${scheme === id ? "#4f46e5" : "#1f1f1f"}`,
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  color: scheme === id ? "#e5e5e5" : "#666",
                  marginBottom: 2,
                }}
              >
                {label}
              </p>
              <p
                style={{
                  fontSize: 10,
                  color: scheme === id ? "#818cf8" : "#333",
                }}
              >
                {sub}
              </p>
            </button>
          ))}
        </div>

        <button
          onClick={handleScan}
          disabled={scanning || !recipient.trim()}
          style={{
            ...btnPrimary,
            width: "100%",
            marginBottom: 16,
            opacity: scanning || !recipient.trim() ? 0.4 : 1,
          }}
        >
          {scanning ? `checking ${scanningChain ?? "…"}` : "stealth lookup →"}
        </button>

        {ensResolving && (
          <p
            style={{
              fontSize: 10,
              color: "#555",
              marginBottom: 12,
              marginTop: -8,
            }}
          >
            resolving…
          </p>
        )}
        {resolvedAddress && !ensResolving && (
          <p
            style={{
              fontSize: 10,
              color: "#818cf8",
              marginBottom: 12,
              marginTop: -8,
            }}
          >
            ↳ {resolvedAddress}
          </p>
        )}
        {ensError && !ensResolving && (
          <p
            style={{
              fontSize: 10,
              color: "#f87171",
              marginBottom: 12,
              marginTop: -8,
            }}
          >
            ✗ {ensError}
          </p>
        )}

        {scanError && (
          <p style={{ color: "#f87171", fontSize: 12, marginBottom: 16 }}>
            ✗ {scanError}
          </p>
        )}
        {scanDone && !foundOn && !scanError && (
          <div
            style={{
              padding: "12px 14px",
              background: "#0f0f0f",
              border: "1px solid #1f1f1f",
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            <p style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
              No stealth meta-address found on any chain.
            </p>
            <p style={{ fontSize: 11, color: "#555", lineHeight: 1.7 }}>
              Try switching between Classic and Post-quantum modes. If neither
              works, this address hasn't registered yet.
              <br />
              <br />
              Do it with{" "}
              <a
                href="https://github.com/Bauta-Wallet/bauta-wallet"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#818cf8", textDecoration: "none" }}
              >
                bauta wallet
              </a>{" "}
              and discover the power of privacy.
            </p>
          </div>
        )}

        {/* Found badge */}
        {foundOn && stealthResult && (
          <p style={{ fontSize: 11, color: "#555", marginBottom: 16 }}>
            Found on <span style={{ color: "#818cf8" }}>{foundOn.label}</span>
            {" · "}
            <span
              style={{
                color:
                  stealthResult.schemeId === SCHEME_ID_PQ ? "#4ade80" : "#555",
              }}
            >
              {stealthResult.schemeId === SCHEME_ID_PQ ? "PQS" : "classic"}
            </span>
            {" — select chain to send on:"}
          </p>
        )}

        {/* Send chain selector */}
        {foundOn && (
          <div style={{ marginBottom: 20 }}>
            {selectedChain && !chainExpanded ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 14px",
                  background: "#13131f",
                  border: "1px solid #4f46e5",
                  borderRadius: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: "#e5e5e5",
                    fontFamily: "monospace",
                  }}
                >
                  <span style={{ color: "#818cf8", marginRight: 8 }}>●</span>
                  {
                    SUPPORTED_CHAINS.find((c) => c.chain.id === selectedChain)
                      ?.label
                  }
                </span>
                <button
                  onClick={() => {
                    setChainExpanded(true);
                    setSelectedChain(null);
                    setStealthResult(null);
                  }}
                  style={{
                    fontSize: 10,
                    color: "#555",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "monospace",
                    textDecoration: "underline",
                  }}
                >
                  change
                </button>
              </div>
            ) : (
              SUPPORTED_CHAINS.map(({ chain, label }) => (
                <button
                  key={chain.id}
                  onClick={async () => {
                    setSelectedChain(chain.id);
                    setChainExpanded(false);
                    switchChain({ chainId: chain.id });
                    if (foundOn) {
                      const result =
                        scheme === SCHEME_ID_PQ
                          ? await derivePQStealthAddress(foundOn.metaAddress)
                          : await deriveStealthAddress(foundOn.metaAddress);
                      setStealthResult(result);
                    }
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 14px",
                    marginBottom: 6,
                    background:
                      selectedChain === chain.id ? "#13131f" : "#0f0f0f",
                    border: `1px solid ${selectedChain === chain.id ? "#4f46e5" : "#1f1f1f"}`,
                    borderRadius: 6,
                    color: "#e5e5e5",
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: "monospace",
                  }}
                >
                  <span
                    style={{
                      color: selectedChain === chain.id ? "#818cf8" : "#333",
                      marginRight: 8,
                    }}
                  >
                    ●
                  </span>
                  {label}
                </button>
              ))
            )}
          </div>
        )}

        {/* ── Relay config ─────────────────────────────────────────────────────── */}
        {stealthResult && selectedChain && sendMode === "none" && (
          <div style={{ marginBottom: 12 }}>
            {relayEditing ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  value={relayUrlDraft}
                  onChange={(e) => setRelayUrlDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveRelayUrl()}
                  style={{
                    ...inputStyle,
                    marginBottom: 0,
                    flex: 1,
                    fontSize: 11,
                  }}
                />
                <button onClick={saveRelayUrl} style={{ ...btnSmall }}>
                  save
                </button>
                <button
                  onClick={() => {
                    setRelayUrlDraft(relayUrl);
                    setRelayEditing(false);
                  }}
                  style={{ ...btnSmall }}
                >
                  cancel
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background:
                      relayAlive === null
                        ? "#555"
                        : relayAlive
                          ? "#4ade80"
                          : "#f87171",
                    boxShadow: relayAlive === true ? "0 0 6px #4ade80" : "none",
                  }}
                />
                <span style={{ fontSize: 10, color: "#444" }}>relay:</span>
                <span
                  style={{
                    fontSize: 10,
                    color: "#555",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {relayUrl}
                </span>
                <button
                  onClick={() => {
                    setRelayUrlDraft(relayUrl);
                    setRelayEditing(true);
                  }}
                  style={{ ...btnSmall, fontSize: 10 }}
                >
                  change
                </button>
                {relayUrl !== DEFAULT_RELAY_URL && (
                  <button
                    onClick={() => {
                      setRelayUrl(DEFAULT_RELAY_URL);
                      setRelayUrlDraft(DEFAULT_RELAY_URL);
                      localStorage.removeItem(RELAY_STORAGE_KEY);
                    }}
                    style={{ ...btnSmall, fontSize: 10 }}
                  >
                    reset
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Send mode selector ───────────────────────────────────────────────── */}
        {stealthResult && selectedChain && sendMode === "none" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <button
              onClick={() => relayAlive === true && setSendMode("gasless")}
              disabled={relayAlive !== true}
              style={{
                padding: "14px 12px",
                textAlign: "left",
                fontFamily: "monospace",
                background: "#0f0f0f",
                border: "1px solid #1f1f1f",
                borderRadius: 6,
                cursor: relayAlive === true ? "pointer" : "not-allowed",
                opacity: relayAlive === true ? 1 : 0.4,
              }}
              onMouseOver={(e) =>
                relayAlive === true &&
                (e.currentTarget.style.borderColor = "#4f46e5")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.borderColor = "#1f1f1f")
              }
            >
              <p style={{ fontSize: 12, color: "#e5e5e5", marginBottom: 4 }}>
                Without wallet
              </p>
              <p style={{ fontSize: 10, color: "#555", lineHeight: 1.6 }}>
                {relayAlive === null
                  ? "checking relay…"
                  : relayAlive
                    ? "No wallet needed. Send from anywhere, relay handles the rest."
                    : "Relay unavailable."}
              </p>
            </button>
            <button
              onClick={() => setSendMode("wallet")}
              style={{
                padding: "14px 12px",
                textAlign: "left",
                fontFamily: "monospace",
                background: "#0f0f0f",
                border: "1px solid #1f1f1f",
                borderRadius: 6,
                cursor: "pointer",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.borderColor = "#4f46e5")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.borderColor = "#1f1f1f")
              }
            >
              <p style={{ fontSize: 12, color: "#e5e5e5", marginBottom: 4 }}>
                With wallet
              </p>
              <p style={{ fontSize: 10, color: "#555", lineHeight: 1.6 }}>
                Connect wallet, send ETH and announce in two transactions.
              </p>
            </button>
          </div>
        )}

        {/* ── Gasless path ─────────────────────────────────────────────────────── */}
        {sendMode === "gasless" && stealthResult && selectedChain && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Phase 1: connecting to relay */}
            {gaslessStatus === "idle" && (
              <div
                style={{
                  padding: "12px 14px",
                  background: "#0f0f0f",
                  border: "1px solid #1f1f1f",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    border: "1.5px solid #1f1f1f",
                    borderTop: "1.5px solid #818cf8",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                    flexShrink: 0,
                  }}
                />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <p style={{ fontSize: 10, color: "#555" }}>
                  connecting to relay…
                </p>
              </div>
            )}

            {/* Phase 2: relay address + status */}
            {gaslessStatus !== "idle" &&
              gaslessStatus !== "announced" &&
              gaslessStatus !== "failed" &&
              relayStealthAddress && (
                <>
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "#0d1a0d",
                      border: "1px solid #1a3a1a",
                      borderRadius: 6,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: "#555",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        send ETH to
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(relayStealthAddress);
                          setRelayCopied(true);
                          setTimeout(() => setRelayCopied(false), 2000);
                        }}
                        style={{
                          ...btnSmall,
                          fontSize: 10,
                          color: relayCopied ? "#4ade80" : "#888",
                        }}
                      >
                        {relayCopied ? "copied ✓" : "copy"}
                      </button>
                    </div>
                    <div
                      style={{ display: "flex", gap: 16, alignItems: "center" }}
                    >
                      <div
                        style={{
                          flexShrink: 0,
                          padding: 6,
                          background: "#fff",
                          borderRadius: 4,
                        }}
                      >
                        <QRCodeSVG
                          value={relayStealthAddress}
                          size={80}
                          bgColor="#ffffff"
                          fgColor="#000000"
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          color: "#4ade80",
                          wordBreak: "break-all",
                          lineHeight: 1.6,
                        }}
                      >
                        {relayStealthAddress}
                      </span>
                    </div>
                    {feeBps !== null && (
                      <p style={{ fontSize: 10, color: "#555", marginTop: 10 }}>
                        relay fee:{" "}
                        <span style={{ color: "#818cf8" }}>
                          {feeBps / 100}%
                        </span>
                      </p>
                    )}
                  </div>

                  {gaslessStatus === "watching" && (
                    <div
                      style={{
                        padding: "12px 14px",
                        background: "#0f0f0f",
                        border: "1px solid #1f1f1f",
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#555",
                          animation: "pulse 2s ease-in-out infinite",
                          flexShrink: 0,
                        }}
                      />
                      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
                      <p
                        style={{ fontSize: 10, color: "#555", lineHeight: 1.9 }}
                      >
                        Waiting for ETH on{" "}
                        <span style={{ color: "#818cf8" }}>
                          {selectedChainInfo?.label}
                        </span>{" "}
                        · polling every 15s
                      </p>
                    </div>
                  )}

                  {(gaslessStatus === "received" ||
                    gaslessStatus === "forwarding") && (
                    <div
                      style={{
                        padding: "12px 14px",
                        background: "#060c06",
                        border: "1px solid #1a3a1a",
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          border: "1.5px solid #1f1f1f",
                          borderTop: "1.5px solid #4ade80",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                          flexShrink: 0,
                        }}
                      />
                      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                      <p style={{ fontSize: 10, color: "#4ade80" }}>
                        {gaslessStatus === "received"
                          ? "// payment detected — forwarding…"
                          : "// forwarded — announcing on-chain…"}
                      </p>
                    </div>
                  )}

                  {relayUnreachable && (
                    <div
                      style={{
                        padding: "10px 12px",
                        background: "#1a0505",
                        border: "1px solid #3d0a0a",
                        borderRadius: 6,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 10,
                          color: "#f87171",
                          lineHeight: 1.7,
                        }}
                      >
                        ⚠ Relay unreachable — still watching. Your funds are
                        safu if already sent.
                      </p>
                    </div>
                  )}

                  <div
                    style={{
                      padding: "10px 14px",
                      background: "#100800",
                      border: "1px solid #6b3a00",
                      borderRadius: 6,
                      display: "flex",
                      gap: 10,
                    }}
                  >
                    <span style={{ flexShrink: 0 }}>⚠</span>
                    <p
                      style={{
                        fontSize: 10,
                        color: "#f59e0b",
                        lineHeight: 1.8,
                      }}
                    >
                      {gaslessStatus === "watching"
                        ? "Keep this tab open while you send ETH from your other wallet."
                        : "Don't close this tab — relay is in progress."}
                    </p>
                  </div>

                  {gaslessStatus === "watching" && (
                    <button
                      onClick={() => {
                        cancelWatch(watchId);
                        setWatchId(null);
                        setSendMode("none");
                        setGaslessStatus("idle");
                        setRelayStealthAddress(null);
                      }}
                      style={{
                        alignSelf: "flex-start",
                        fontSize: 10,
                        color: "#555",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        fontFamily: "monospace",
                        textDecoration: "underline",
                      }}
                    >
                      ← change
                    </button>
                  )}
                </>
              )}

            {/* Phase 3: announced — reveal real stealth */}
            {gaslessStatus === "announced" &&
              realStealthRevealed &&
              selectedChainInfo && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "#060c06",
                      border: "1px solid #1a3a1a",
                      borderRadius: 6,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 11,
                        color: "#4ade80",
                        marginBottom: 10,
                      }}
                    >
                      ✓ sent & announced
                    </p>
                    <p
                      style={{
                        fontSize: 9,
                        color: "#555",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 6,
                      }}
                    >
                      recipient's stealth address
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        color: "#4ade80",
                        wordBreak: "break-all",
                        lineHeight: 1.6,
                        marginBottom: 10,
                      }}
                    >
                      {realStealthRevealed}
                    </p>
                    {gaslessTx && (
                      <a
                        href={`${selectedChainInfo.explorer}/tx/${gaslessTx}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 10,
                          color: "#86efac",
                          wordBreak: "break-all",
                        }}
                      >
                        {gaslessTx}
                      </a>
                    )}
                  </div>
                </div>
              )}

            {gaslessStatus === "failed" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    padding: "10px 12px",
                    background: "#1a0505",
                    border: "1px solid #3d0a0a",
                    borderRadius: 6,
                  }}
                >
                  <p
                    style={{ fontSize: 10, color: "#f87171", marginBottom: 4 }}
                  >
                    ✗ Relay failed
                  </p>
                  <p style={{ fontSize: 10, color: "#666", lineHeight: 1.7 }}>
                    {gaslessError}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSendMode("none");
                    setGaslessStatus("idle");
                    setGaslessError(null);
                    setRelayStealthAddress(null);
                  }}
                  style={{
                    alignSelf: "flex-start",
                    fontSize: 10,
                    color: "#555",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: "monospace",
                    textDecoration: "underline",
                  }}
                >
                  ← change
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Wallet path ──────────────────────────────────────────────────────── */}
        {sendMode === "wallet" && stealthResult && selectedChain && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {!sentTx && (
              <>
                <div
                  style={{
                    padding: "8px 12px",
                    background: "#100800",
                    border: "1px solid #6b3a00",
                    borderRadius: 6,
                    fontSize: 10,
                    color: "#f59e0b",
                    lineHeight: 1.7,
                  }}
                >
                  ⚠ Only send ETH. ERC-20 tokens sent to a stealth address
                  cannot be detected by the recipient (soon).
                </div>
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#100800",
                    border: "1px solid #6b3a00",
                    borderRadius: 6,
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <span style={{ flexShrink: 0 }}>⚠</span>
                  <p
                    style={{ fontSize: 10, color: "#f59e0b", lineHeight: 1.8 }}
                  >
                    Don't close this tab until both transactions are confirmed.
                  </p>
                </div>
                <label style={labelStyle}>amount (ETH)</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.001"
                  type="number"
                  min="0"
                  step="any"
                  style={{ ...inputStyle, marginBottom: 8 }}
                />

                {!isConnected ? (
                  <button
                    onClick={() => {
                      pendingSend.current = true;
                      connect({ connector: connectors[0] });
                    }}
                    style={{ ...btnPrimary, width: "100%" }}
                  >
                    connect wallet to send
                  </button>
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: "#666",
                          background: "#111",
                          border: "1px solid #222",
                          borderRadius: 4,
                          padding: "4px 8px",
                        }}
                      >
                        {address?.slice(0, 6)}…{address?.slice(-4)}
                      </span>
                      <button onClick={() => disconnect()} style={btnSmall}>
                        disconnect
                      </button>
                    </div>
                    <button
                      onClick={handleSend}
                      disabled={sending || !amount}
                      style={{
                        ...btnPrimary,
                        width: "100%",
                        opacity: sending || !amount ? 0.4 : 1,
                      }}
                    >
                      {sending
                        ? "sending…"
                        : `send on ${selectedChainInfo?.label}`}
                    </button>
                  </div>
                )}

                {sendError && (
                  <p style={{ color: "#f87171", fontSize: 11 }}>
                    ✗ {sendError}
                  </p>
                )}

                <button
                  onClick={() => setSendMode("none")}
                  style={{
                    alignSelf: "flex-start",
                    fontSize: 10,
                    color: "#555",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: "monospace",
                    textDecoration: "underline",
                  }}
                >
                  ← change
                </button>
              </>
            )}

            {sentTx && selectedChainInfo && (
              <div
                style={{
                  padding: "12px 14px",
                  background: "#060c06",
                  border: "1px solid #1a3a1a",
                  borderRadius: 6,
                }}
              >
                <p style={{ fontSize: 11, color: "#4ade80", marginBottom: 6 }}>
                  ✓ sent & announced
                </p>
                <a
                  href={`${selectedChainInfo.explorer}/tx/${sentTx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 10,
                    color: "#86efac",
                    wordBreak: "break-all",
                  }}
                >
                  {sentTx}
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  background: "#0f0f0f",
  border: "1px solid #1f1f1f",
  borderRadius: 6,
  padding: "10px 12px",
  color: "#e5e5e5",
  fontSize: 13,
  fontFamily: "monospace",
  marginBottom: 10,
  outline: "none",
};
const btnPrimary: React.CSSProperties = {
  background: "#111",
  border: "1px solid #2a2a2a",
  borderRadius: 6,
  color: "#e5e5e5",
  padding: "10px 16px",
  cursor: "pointer",
  fontSize: 13,
  fontFamily: "monospace",
};
const btnSmall: React.CSSProperties = {
  ...btnPrimary,
  padding: "4px 10px",
  fontSize: 11,
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "#555",
  marginBottom: 6,
  letterSpacing: "0.05em",
};

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <LookupApp />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
