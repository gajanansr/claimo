"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Building2, Home, Construction, MapPin, Star, Target, Loader2, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: { id: string; Icon: LucideIcon; label: string }[] = [
  { id: "building", Icon: Building2, label: "Office" },
  { id: "home",     Icon: Home,       label: "Home"   },
  { id: "site",     Icon: Construction, label: "Site" },
  { id: "pin",      Icon: MapPin,     label: "Pin"    },
  { id: "star",     Icon: Star,       label: "Star"   },
  { id: "target",   Icon: Target,     label: "Target" },
];

const COLORS = [
  { value: "#10b981", label: "Emerald" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#f97316", label: "Orange" },
  { value: "#f43f5e", label: "Rose" },
];

interface LocationPickerProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function LocationPicker({ open, onClose, onSaved }: LocationPickerProps) {
  const [label, setLabel] = useState("");
  const [selectedIconId, setSelectedIconId] = useState("pin");
  const [selectedColor, setSelectedColor] = useState("#10b981");
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState(100);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<{
    lat: number;
    lng: number;
    formattedAddress: string;
  } | null>(null);
  const [geocodeError, setGeocodeError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleGeocode = async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    setGeocodeError("");
    setGeocodeResult(null);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address.trim())}`);
      const data = await res.json();
      if (data.error) {
        setGeocodeError(data.error);
      } else {
        setGeocodeResult(data);
      }
    } catch {
      setGeocodeError("Failed to geocode address. Please try again.");
    } finally {
      setGeocoding(false);
    }
  };

  const handleSave = async () => {
    if (!label.trim() || !geocodeResult) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          lat: geocodeResult.lat,
          lng: geocodeResult.lng,
          radius_meters: radius,
          color: selectedColor,
          emoji: selectedIconId,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setSaveError(data.error);
      } else {
        onSaved();
        handleClose();
      }
    } catch {
      setSaveError("Failed to save location. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setLabel("");
    setSelectedIconId("pin");
    setSelectedColor("#10b981");
    setAddress("");
    setRadius(100);
    setGeocodeResult(null);
    setGeocodeError("");
    setSaveError("");
    onClose();
  };

  const mapKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const staticMapUrl =
    geocodeResult && mapKey
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${geocodeResult.lat},${geocodeResult.lng}&zoom=16&size=400x180&markers=color:red%7C${geocodeResult.lat},${geocodeResult.lng}&key=${mapKey}`
      : null;

  const canSave = label.trim().length > 0 && geocodeResult !== null && !saving;

  const SelectedIcon = ICONS.find(i => i.id === selectedIconId)?.Icon ?? MapPin;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-zinc-950 border border-zinc-800 rounded-2xl p-0 w-[calc(100vw-2rem)] max-w-md shadow-2xl shadow-black/60 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-900">
          <DialogTitle className="text-zinc-100 text-[16px] font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-400" />
            Add Named Location
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Label */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Location Name
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Office, Home, Client Site"
              className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-800 focus:ring-0 h-9 rounded-lg text-[13px]"
            />
          </div>

          {/* Icon picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Icon
            </label>
            <div className="flex gap-2 flex-wrap">
              {ICONS.map(({ id, Icon, label: iconLabel }) => (
                <button
                  key={id}
                  onClick={() => setSelectedIconId(id)}
                  title={iconLabel}
                  className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all border
                    ${selectedIconId === id
                      ? "border-emerald-700/60 ring-1 ring-emerald-600/40"
                      : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60"
                    }`}
                  style={selectedIconId === id ? { backgroundColor: selectedColor + "22" } : {}}
                >
                  <Icon
                    className="h-4 w-4"
                    style={{ color: selectedIconId === id ? selectedColor : "#71717a" }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Color
            </label>
            <div className="flex gap-2.5">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setSelectedColor(c.value)}
                  title={c.label}
                  className={`h-7 w-7 rounded-full transition-all border-2
                    ${selectedColor === c.value
                      ? "scale-110 border-zinc-300 shadow-lg"
                      : "border-transparent hover:border-zinc-500 hover:scale-105"
                    }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          {/* Address search */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Address
            </label>
            <div className="flex gap-2">
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGeocode()}
                placeholder="Enter a full address to search…"
                className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-800 focus:ring-0 h-9 rounded-lg text-[13px] flex-1"
              />
              <Button
                onClick={handleGeocode}
                disabled={geocoding || !address.trim()}
                className="h-9 px-3 bg-emerald-700 hover:bg-emerald-600 text-white text-[12px] font-semibold rounded-lg border-0 shrink-0"
              >
                {geocoding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            {geocodeError && (
              <p className="text-[11px] text-red-400 mt-1">{geocodeError}</p>
            )}

            {geocodeResult && (
              <div className="mt-2 px-3 py-2 bg-emerald-950/20 border border-emerald-900/40 rounded-lg space-y-0.5">
                <p className="text-[12px] text-emerald-300 font-medium">
                  ✓ Location found
                </p>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {geocodeResult.formattedAddress}
                </p>
                <p className="text-[10px] text-zinc-600 font-mono">
                  {geocodeResult.lat.toFixed(6)}, {geocodeResult.lng.toFixed(6)}
                </p>
              </div>
            )}
          </div>

          {/* Static map */}
          {staticMapUrl && (
            <div className="rounded-xl overflow-hidden border border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={staticMapUrl}
                alt="Location preview map"
                className="w-full object-cover"
                style={{ height: 180 }}
              />
            </div>
          )}

          {/* Radius slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                Detection Radius
              </label>
              <span className="text-[12px] font-semibold text-emerald-400 tabular-nums">
                {radius}m
              </span>
            </div>
            <Slider
              value={[radius]}
              onValueChange={(v) => setRadius(v[0])}
              min={50}
              max={500}
              step={10}
            />
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>50m (precise)</span>
              <span>500m (broad)</span>
            </div>
          </div>

          {/* Save error */}
          {saveError && (
            <p className="text-[11px] text-red-400">{saveError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-900 flex gap-3">
          <Button
            onClick={handleClose}
            variant="ghost"
            className="flex-1 h-9 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-lg text-[13px] font-medium"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 h-9 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg border-0 text-[13px]"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <SelectedIcon className="h-3.5 w-3.5 mr-1.5" />
            )}
            {saving ? "Saving…" : "Save Location"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
