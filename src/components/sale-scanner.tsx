"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { ensureAnonymousUser } from "@/lib/firebase/client";
import { SaleLineInput, SaleCreateResult } from "@/lib/types";

type ProductLookup = {
  barcode: string;
  name: string;
  price: number;
  taxRate: number;
  currency: string;
  active: boolean;
};

type CartLine = SaleLineInput & {
  name: string;
  unitPrice: number;
};

const DEFAULT_STORE_ID = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID ?? "default";

export function SaleScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [storeId, setStoreId] = useState(DEFAULT_STORE_ID);
  const [cashierLabel, setCashierLabel] = useState("counter-1");
  const [manualBarcode, setManualBarcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [lastSale, setLastSale] = useState<SaleCreateResult | null>(null);

  const subtotal = useMemo(
    () => Number(cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0).toFixed(2)),
    [cart],
  );

  const lookupProduct = useCallback(async (barcode: string): Promise<ProductLookup> => {
    const response = await fetch(
      `/api/products/${encodeURIComponent(barcode)}?storeId=${encodeURIComponent(storeId)}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Product lookup failed.");
    }

    return (await response.json()) as ProductLookup;
  }, [storeId]);

  const addBarcode = useCallback(async (barcode: string) => {
    if (!barcode) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const product = await lookupProduct(barcode.trim());
      const normalizedBarcode = String(product.barcode).trim();

      if (!product.active) {
        throw new Error("Product is inactive.");
      }

      setCart((current) => {
        const existingIndex = current.findIndex((item) => item.barcode === normalizedBarcode);

        if (existingIndex === -1) {
          return [
            ...current,
            {
              barcode: normalizedBarcode,
              qty: 1,
              name: product.name,
              unitPrice: Number(product.price),
            },
          ];
        }

        return current.map((item, index) =>
          index === existingIndex ? { ...item, qty: item.qty + 1 } : item,
        );
      });

      setStatus(`Scanned ${product.name}`);
      setManualBarcode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add barcode.");
    } finally {
      setBusy(false);
    }
  }, [lookupProduct]);

  async function checkout() {
    if (cart.length === 0) {
      setError("Cart is empty.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const user = await ensureAnonymousUser();
      const token = await user.getIdToken();

      const response = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeId,
          cashierLabel,
          items: cart.map((line) => ({ barcode: String(line.barcode), qty: line.qty })),
        }),
      });

      const payload = (await response.json()) as SaleCreateResult & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Sale request failed.");
      }

      setLastSale(payload);
      setCart([]);
      setStatus(`Sale ${payload.saleId} recorded`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId = 0;
    let detector: BarcodeDetector | null = null;
    let detectorEnabled = false;
    let zxingReader: BrowserMultiFormatReader | null = null;
    let lastCode = "";
    let lastAt = 0;

    const run = async () => {
      if (!videoRef.current || !canvasRef.current) {
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("Camera API unavailable in this browser, use manual entry.");
        return;
      }

      if (!window.isSecureContext) {
        setStatus("Camera requires a secure origin (HTTPS or localhost). Use localhost for development.");
        return;
      }

      try {
        if ("BarcodeDetector" in globalThis) {
          detector = new BarcodeDetector({
            formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e"],
          });
          detectorEnabled = true;
        } else {
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.CODE_128,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
          ]);
          zxingReader = new BrowserMultiFormatReader(hints);
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d", { willReadFrequently: true });

        if (!context) {
          setStatus("Could not initialize camera context.");
          return;
        }

        video.srcObject = stream;
        await video.play();

        const tick = async () => {
          if (!videoRef.current || !canvasRef.current) {
            return;
          }

          const now = Date.now();

          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          if (detector) {
            try {
              const result = await detector.detect(canvas);
              const code = result[0]?.rawValue?.trim();

              if (code && (code !== lastCode || now - lastAt > 1500)) {
                lastCode = code;
                lastAt = now;
                void addBarcode(code);
              }
            } catch {
              // Ignore camera frame parse errors and keep scanning.
            }
          } else if (zxingReader) {
            try {
              const result = await zxingReader.decodeFromCanvas(canvas);
              const code = result.getText().trim();

              if (code && (code !== lastCode || now - lastAt > 1500)) {
                lastCode = code;
                lastAt = now;
                void addBarcode(code);
              }
            } catch {
              // Ignore decode misses and keep scanning.
            }
          }

          rafId = window.requestAnimationFrame(() => {
            void tick();
          });
        };

        setStatus(
          detectorEnabled
            ? "Camera scanner active"
            : "Camera scanner active (ZXing fallback)",
        );
        rafId = window.requestAnimationFrame(() => {
          void tick();
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Camera start failed.";
        setStatus(`Camera unavailable: ${message}`);
      }
    };

    void run();

    return () => {
      window.cancelAnimationFrame(rafId);

      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
    };
  }, [addBarcode]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-[1.75rem] border border-white/70 bg-white/72 p-4 shadow-[0_28px_80px_rgba(31,41,55,0.10)] backdrop-blur-sm sm:p-6 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center rounded-full border border-[#d8c19d] bg-[#faf5ec] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6a2f]">
            Glowgirl Studio
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Glowgirl- Bags Barcode Sales Console
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700 md:text-base">
            Scan products, update quantities, and complete checkout with a fast register workflow.
          </p>
        </div>
        <p className="inline-flex w-fit items-center rounded-full border border-[#d8c19d] bg-white px-3 py-1 text-xs font-semibold tracking-[0.2em] text-[#8b6a2f] shadow-sm">
          {status}
        </p>
      </div>

      <section className="grid gap-4 rounded-[1.5rem] border border-[#e5d8c4] bg-[#fffcf8]/95 p-4 shadow-sm md:grid-cols-3 md:p-5">
        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-800">
          Store ID
          <input
            className="rounded-full border border-[#d9c9b3] bg-white px-3 py-2 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#8b6a2f] focus:ring-2 focus:ring-[#d8c19d]/30"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-800">
          Cashier Label
          <input
            className="rounded-full border border-[#d9c9b3] bg-white px-3 py-2 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#8b6a2f] focus:ring-2 focus:ring-[#d8c19d]/30"
            value={cashierLabel}
            onChange={(event) => setCashierLabel(event.target.value)}
          />
        </label>

        <div className="flex items-end">
          <button
            type="button"
            disabled={busy}
            onClick={checkout}
            className="w-full rounded-full bg-[#1f2937] px-4 py-2.5 text-sm font-semibold text-[#faf7f2] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#111827] hover:shadow disabled:opacity-60"
          >
            Record Sale
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-[#e5d8c4] bg-[#fffcf8]/95 p-4 shadow-sm md:p-5">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Live Scanner</h2>
          <video ref={videoRef} className="aspect-video w-full rounded-[1rem] bg-black/90 ring-1 ring-inset ring-black/5" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="rounded-[1.5rem] border border-[#e5d8c4] bg-[#fffcf8]/95 p-4 shadow-sm md:p-5">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Manual Barcode Entry</h2>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-full border border-[#d9c9b3] bg-white px-3 py-2 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#8b6a2f] focus:ring-2 focus:ring-[#d8c19d]/30"
              value={manualBarcode}
              placeholder="Enter barcode"
              onChange={(event) => setManualBarcode(event.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void addBarcode(manualBarcode)}
              className="rounded-full bg-[#8b6a2f] px-4 py-2 text-sm font-semibold text-[#faf7f2] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#7a5d27] hover:shadow disabled:opacity-60"
            >
              Add
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[#e5d8c4] bg-[#fffcf8]/95 p-4 shadow-sm md:p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Current Cart</h2>

        {cart.length === 0 ? (
          <p className="rounded-[1rem] border border-dashed border-[#d9c9b3] bg-white px-3 py-4 text-sm text-slate-700">
            No scanned items yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {cart.map((item) => (
              <li
                key={item.barcode}
                className="flex items-center justify-between rounded-[1rem] border border-[#e7dccb] bg-white px-3 py-2.5 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-700">{item.barcode}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800">Qty {item.qty}</p>
                  <p className="text-xs text-slate-700">${(item.unitPrice * item.qty).toFixed(2)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-right text-sm font-semibold tracking-[0.18em] text-[#8b6a2f] uppercase">
          Subtotal ${subtotal.toFixed(2)}
        </p>
      </section>

      {lastSale ? (
        <section className="rounded-[1.5rem] border border-[#d8c19d] bg-[#faf5ec] p-4 text-sm text-slate-900 shadow-sm">
          <p className="font-semibold">Last sale recorded</p>
          <p>Sale ID: {lastSale.saleId}</p>
          <p>Total: {lastSale.currency} {lastSale.grandTotal.toFixed(2)}</p>
        </section>
      ) : null}

      {error ? <p className="rounded-[1rem] border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p> : null}
    </div>
  );
}
