import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type (images and gifs)
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only images and GIFs are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit." },
        { status: 400 }
      );
    }

    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      return NextResponse.json(
        { error: "Pinata JWT not configured" },
        { status: 500 }
      );
    }

    // Convert file to FormData for Pinata
    const pinataFormData = new FormData();
    pinataFormData.append("file", file);

    // Upload to Pinata
    const pinataResponse = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
      },
      body: pinataFormData,
    });

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error("Pinata upload error:", errorText);
      return NextResponse.json(
        { error: `Pinata upload failed: ${pinataResponse.status}` },
        { status: 500 }
      );
    }

    const pinataData = await pinataResponse.json();
    const ipfsHash = pinataData.IpfsHash;

    if (!ipfsHash) {
      return NextResponse.json(
        { error: "Failed to obtain IPFS hash from Pinata" },
        { status: 500 }
      );
    }

    // Convert CID to gateway URL
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.pinata.cloud";
    const imageUrl = `${gatewayUrl}/ipfs/${ipfsHash}`;

    return NextResponse.json({ success: true, imageUrl, ipfsHash });
  } catch (error) {
    console.error("Error uploading file:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
