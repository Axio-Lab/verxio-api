import { storeMetadata } from './storeMetadata';

interface VoucherCollectionMetadataInput {
  voucherCollectionName: string;
  merchantName: string;
  merchantAddress: string;
  contactInfo?: string;
  voucherTypes: string[];
  description?: string;
  imageUri: string;
  creatorAddress: string;
  mimeType?: string;
}

/**
 * Generate NFT metadata for a voucher collection
 */
export async function generateVoucherCollectionMetadata(
  data: VoucherCollectionMetadataInput
): Promise<string> {
  try {
    const {
      voucherCollectionName,
      merchantName,
      merchantAddress,
      contactInfo,
      voucherTypes,
      description,
      imageUri,
      creatorAddress,
      mimeType,
    } = data;

    if (!voucherCollectionName || !imageUri || !creatorAddress) {
      throw new Error('Missing required data for metadata generation');
    }

    const metadataObject = {
      name: voucherCollectionName,
      symbol: 'VERXIO-VOUCHER',
      description: description || `Voucher collection for ${merchantName}`,
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
          trait_type: 'Merchant',
          value: merchantName,
        },
        {
          trait_type: 'Merchant Address',
          value: merchantAddress,
        },
        {
          trait_type: 'Contact Info',
          value: contactInfo,
        },
        {
          trait_type: 'Voucher Types',
          value: voucherTypes.filter(Boolean).join(', '),
        },
      ],
      collection: {
        merchantName,
        merchantAddress,
        contactInfo,
        voucherTypes,
      },
    };

    const uri = await storeMetadata(metadataObject);
    return uri;
  } catch (error) {
    console.error('Error generating voucher collection metadata:', error);
    throw new Error('Failed to generate voucher collection metadata');
  }
}

