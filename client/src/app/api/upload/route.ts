import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type (images, videos, and audio)
    // Use flexible validation: allow any MIME type that starts with image/, video/, or audio/
    // Also check file extension as fallback for cases where MIME type might be incorrect
    const isValidMimeType =
      file.type.startsWith("image/") ||
      file.type.startsWith("video/") ||
      file.type.startsWith("audio/");

    // Fallback: check file extension if MIME type is empty or invalid
    const fileName = file.name.toLowerCase();
    const validExtensions = [
      // Images
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".svg",
      ".bmp",
      ".ico",
      // Videos
      ".mp4",
      ".webm",
      ".mov",
      ".avi",
      ".mkv",
      ".flv",
      ".wmv",
      ".m4v",
      // Audio
      ".mp3",
      ".wav",
      ".ogg",
      ".m4a",
      ".aac",
      ".flac",
      ".wma",
      ".opus",
    ];
    const hasValidExtension = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValidMimeType && !hasValidExtension) {
      return NextResponse.json(
        { error: "Invalid file type. Only images, videos, and audio files are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (max 50MB for video/audio, 10MB for images)
    const isImage = file.type.startsWith("image/");
    const maxSize = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024; // 10MB for images, 50MB for video/audio
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds ${isImage ? "10MB" : "50MB"} limit.` },
        { status: 400 }
      );
    }

    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      return NextResponse.json({ error: "Pinata JWT not configured" }, { status: 500 });
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
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
