import { storeMetadata } from './storeMetadata';

interface VoucherMetadataInput {
  voucherName: string;
  voucherType: string;
  value: number;
  valueSymbol?: string;
  assetName?: string;
  assetSymbol?: string;
  tokenAddress?: string;
  description?: string;
  expiryDate: Date;
  maxUses: number;
  transferable: boolean;
  merchantId: string;
  conditions?: string;
  imageUri: string;
  creatorAddress: string;
  mimeType?: string;
}

/**
 * Generate NFT metadata for an individual voucher
 */
export async function generateVoucherMetadata(
  data: VoucherMetadataInput
): Promise<string> {
  try {
    const {
      voucherName,
      voucherType,
      value,
      valueSymbol,
      assetName,
      assetSymbol,
      tokenAddress,
      description,
      expiryDate,
      maxUses,
      transferable,
      merchantId,
      conditions,
      imageUri,
      creatorAddress,
      mimeType,
    } = data;

    if (!voucherName || !imageUri || !creatorAddress) {
      throw new Error('Missing required data for metadata generation');
    }

    const metadataObject = {
      name: voucherName,
      symbol: 'VERXIO-VOUCHER',
      description: description || `Voucher: ${voucherType} - ${value}`,
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
          trait_type: 'Voucher Type',
          value: voucherType,
        },
        {
          trait_type: 'Value',
          value: value.toString(),
        },
        ...(valueSymbol ? [{
          trait_type: 'Value Symbol',
          value: valueSymbol,
        }] : []),
        {
          trait_type: 'Expiry Date',
          value: expiryDate.toISOString(),
        },
        {
          trait_type: 'Max Uses',
          value: maxUses.toString(),
        },
        {
          trait_type: 'Transferable',
          value: transferable ? 'Yes' : 'No',
        },
        {
          trait_type: 'Merchant ID',
          value: merchantId,
        },
        ...(assetName ? [{
          trait_type: 'Asset Name',
          value: assetName,
        }] : []),
        ...(assetSymbol ? [{
          trait_type: 'Asset Symbol',
          value: assetSymbol,
        }] : []),
        ...(tokenAddress ? [{
          trait_type: 'Token Address',
          value: tokenAddress,
        }] : []),
        ...(conditions ? [{
          trait_type: 'Conditions',
          value: conditions,
        }] : []),
      ],
      voucher: {
        type: voucherType,
        value,
        description,
        expiryDate: expiryDate.getTime(),
        maxUses,
        transferable,
        merchantId,
        conditions: conditions || '',
      },
    };

    const uri = await storeMetadata(metadataObject);
    return uri;
  } catch (error) {
    console.error('Error generating voucher metadata:', error);
    throw new Error('Failed to generate voucher metadata');
  }
}

