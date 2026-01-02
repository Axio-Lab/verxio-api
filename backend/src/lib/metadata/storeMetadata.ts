import { pinata } from '../config';

/**
 * Store metadata to IPFS via Pinata and return the gateway URL
 */
export const storeMetadata = async (data: any): Promise<string> => {
  try {
    if (!data) {
      throw new Error('No metadata provided');
    }

    // Use Pinata REST API to upload JSON to IPFS
    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      throw new Error('PINATA_JWT is not configured');
    }

    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ pinataContent: data }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Pinata pinJSONToIPFS failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as { IpfsHash?: string };
    const cid = json.IpfsHash;

    if (!cid) {
      throw new Error('Failed to obtain CID for metadata');
    }

    // Convert CID to gateway URL using Pinata SDK
    const url = await pinata.gateways.public.convert(cid);
    new URL(url); // Validate URL format
    return url;
  } catch (error) {
    console.error('Error uploading metadata:', error);
    throw new Error('Failed to store metadata');
  }
};

