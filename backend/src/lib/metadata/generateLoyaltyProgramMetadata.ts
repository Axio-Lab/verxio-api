import { storeMetadata } from './storeMetadata';

interface LoyaltyProgramMetadataInput {
  loyaltyProgramName: string;
  metadata: {
    organizationName: string;
    brandColor?: string;
    [key: string]: any;
  };
  tiers: Array<{
    name: string;
    xpRequired: number;
    rewards: string[];
  }>;
  pointsPerAction: Record<string, number>;
  imageUri: string;
  creatorAddress: string;
  mimeType?: string;
}

/**
 * Generate NFT metadata for a loyalty program
 */
export async function generateLoyaltyProgramMetadata(
  data: LoyaltyProgramMetadataInput
): Promise<string> {
  try {
    const { loyaltyProgramName, metadata, tiers, pointsPerAction, imageUri, creatorAddress, mimeType } = data;

    if (!loyaltyProgramName || !imageUri || !creatorAddress) {
      throw new Error('Missing required data for metadata generation');
    }

    const metadataObject = {
      name: loyaltyProgramName,
      symbol: 'VERXIO',
      description: `Loyalty Program for ${metadata.organizationName}`,
      image: imageUri,
      properties: {
        files: [
          {
            uri: imageUri,
            type: mimeType || 'image/png',
          },
        ],
        category: 'image',
        creators: [
          {
            address: creatorAddress,
            share: 100,
          },
        ],
      },
      attributes: [
        {
          trait_type: 'Organization',
          value: metadata.organizationName,
        },
        {
          trait_type: 'Brand Color',
          value: metadata.brandColor || '#00adef',
        },
      ],
      program: {
        name: loyaltyProgramName,
        metadata: metadata,
        tiers: tiers,
        pointsPerAction: pointsPerAction,
      },
    };

    const uri = await storeMetadata(metadataObject);
    return uri;
  } catch (error) {
    console.error('Error generating loyalty program metadata:', error);
    throw new Error('Failed to generate loyalty program metadata');
  }
}

