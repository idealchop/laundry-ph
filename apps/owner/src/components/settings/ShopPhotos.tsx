"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRef } from "react";
import { Badge, Button, Card } from "@river-apps/ui";
import type { Shop } from "@/data";
import { useAction, useShop } from "@/lib/shop";
import { deleteShopPhotoByUrl, MAX_SHOP_PHOTOS, uploadShopPhoto } from "@/lib/shop-photos";
import { ErrorNote } from "../ui";

/** Storefront / interior photos saved on the shop for River Mobile. */
export function ShopPhotos({ shop }: { shop: Shop }) {
  const { source, reload } = useShop();
  const { busy, error, run, setError } = useAction();
  const inputRef = useRef<HTMLInputElement>(null);
  const urls = shop.photoUrls ?? [];
  const readOnly = shop.sample === true && source.mode === "firebase";
  const full = urls.length >= MAX_SHOP_PHOTOS;

  async function addFiles(files: FileList | null) {
    if (!files?.length || readOnly) return;
    setError(null);
    const batch = Array.from(files);
    const ok = await run(async (s) => {
      const next = [...(shop.photoUrls ?? [])];
      for (const file of batch) {
        if (next.length >= MAX_SHOP_PHOTOS) break;
        next.push(await uploadShopPhoto(shop.id, file));
      }
      await s.setShopPhotos(next);
      return true;
    }, "Sign in to upload shop photos for River Mobile.");
    if (ok) reload();
    if (inputRef.current) inputRef.current.value = "";
  }

  async function removeAt(index: number) {
    if (readOnly) return;
    setError(null);
    const target = urls[index];
    if (!target) return;
    const next = urls.filter((_, i) => i !== index);
    const ok = await run(async (s) => {
      await s.setShopPhotos(next);
      return true;
    }, "Sign in to update shop photos.");
    if (ok) {
      void deleteShopPhotoByUrl(target);
      reload();
    }
  }

  return (
    <Card className="px-4 py-3.5 lg:col-span-2">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <b className="text-[16px]">Shop photos</b>
          <p className="mt-0.5 text-[13px] font-medium text-muted">
            Show customers on River Mobile what your shop looks like. JPG, PNG or WebP · up to {MAX_SHOP_PHOTOS} · 5 MB each.
          </p>
        </div>
        <Badge variant="soft" size="sm" className="shrink-0">{urls.length}/{MAX_SHOP_PHOTOS}</Badge>
      </div>

      {readOnly ? (
        <p className="rounded-tile bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">
          This is the shared demo shop — create your own shop to upload photos.
        </p>
      ) : null}

      {urls.length ? (
        <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {urls.map((url, i) => (
            <li key={url} className="group relative overflow-hidden rounded-[16px] bg-grey-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Shop photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
              {!readOnly ? (
                <button
                  type="button"
                  className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink/80 text-white sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label={`Remove photo ${i + 1}`}
                  disabled={busy}
                  onClick={() => void removeAt(i)}
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-tile border border-dashed border-line px-4 py-8 text-center text-[13.5px] font-semibold text-muted">
          No photos yet. Add a clear storefront shot first — River Mobile will use these on your listing.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        disabled={readOnly || busy || full}
        onChange={(e) => void addFiles(e.target.files)}
      />

      {error ? <ErrorNote className="mt-3">{error}</ErrorNote> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="md"
          disabled={readOnly || busy || full}
          leadingIcon={<ImagePlus size={18} />}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : full ? "Photo limit reached" : "Upload photos"}
        </Button>
      </div>
    </Card>
  );
}
