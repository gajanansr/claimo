import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address || address.trim() === "") {
    return NextResponse.json({ error: "Missing address parameter" }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Geocoding API not configured" }, { status: 500 });
  }

  try {
    const url = `https://addressvalidation.googleapis.com/v1:validateAddress?key=${key}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Referer": appUrl,
      },
      body: JSON.stringify({
        address: {
          addressLines: [address.trim()],
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Address Validation API error:", data);
      return NextResponse.json(
        { error: `API error: ${data.error?.message ?? res.statusText}` },
        { status: res.status }
      );
    }

    const location = data?.result?.geocode?.location;
    const formattedAddress = data?.result?.address?.formattedAddress;

    if (location?.latitude != null && location?.longitude != null) {
      return NextResponse.json({
        lat: location.latitude,
        lng: location.longitude,
        formattedAddress: formattedAddress ?? address,
      });
    }

    return NextResponse.json(
      { error: "Could not determine location for this address" },
      { status: 422 }
    );
  } catch (err) {
    console.error("Geocode error:", err);
    return NextResponse.json({ error: "Internal error during geocoding" }, { status: 500 });
  }
}
