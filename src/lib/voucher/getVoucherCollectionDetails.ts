
const RPC_ENDPOINT = `${process.env.RPC_URL}?api-key=${process.env.HELIUS_API_KEY}`;

export interface VoucherCollectionDetails {
  id: string;
  name: string;
  description: string;
  image: string;
  attributes: {
    merchant: string;
    collectionType: string;
    status: string;
    voucherTypes: string[];
  };
  creator: string;
  owner: string;
  metadata: {
    merchantName: string;
    merchantAddress: string;
    voucherTypes: string[];
  };
  voucherStats: {
    totalVouchersIssued: number;
    totalVouchersRedeemed: number;
    totalValueRedeemed: number;
  };
}

interface RpcResponse {
  jsonrpc: string;
  id: string;
  result?: any;
  error?: {
    code?: number;
    message: string;
  };
}

export const getVoucherCollectionDetails = async (voucherAddress: string): Promise<{
  success: boolean;
  data?: VoucherCollectionDetails;
  error?: string;
}> => {
  try {
    const url = RPC_ENDPOINT;
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '1',
        method: 'getAsset',
        params: {
          id: voucherAddress,
        },
      }),
    };

    const response = await fetch(url, options);
    const data = (await response.json()) as RpcResponse;

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    const asset = data.result;
    if (!asset) {
      return { success: false, error: 'Voucher collection not found' };
    }

    // Extract metadata
    const metadata = asset.content?.metadata;
    const attributes = metadata?.attributes || [];

    // Extract attributes
    const merchantAttr = attributes.find((attr: any) => attr.trait_type === 'Merchant');
    const collectionTypeAttr = attributes.find((attr: any) => attr.trait_type === 'Collection Type');
    const statusAttr = attributes.find((attr: any) => attr.trait_type === 'Status');
    const voucherTypesAttr = attributes.find((attr: any) => attr.trait_type === 'Voucher Types');

    // Extract plugin data
    const externalPlugins = asset.external_plugins || [];
    const appDataPlugin = externalPlugins.find((plugin: any) => plugin.type === 'AppData');
    const voucherStats = appDataPlugin?.data || {
      totalVouchersIssued: 0,
      totalVouchersRedeemed: 0,
      totalValueRedeemed: 0,
    };

    // Extract metadata from plugins
    const attributesPlugin = asset.plugins?.attributes?.data?.attribute_list || [];
    const metadataAttr = attributesPlugin.find((attr: any) => attr.key === 'metadata');
    const parsedMetadata = metadataAttr ? JSON.parse(metadataAttr.value) : {};

    const voucherDetails: VoucherCollectionDetails = {
      id: asset.id,
      name: metadata?.name || 'Unknown Voucher Collection',
      description: metadata?.description || '',
      image: asset.content?.links?.image || '',
      attributes: {
        merchant: merchantAttr?.value || '',
        collectionType: collectionTypeAttr?.value || '',
        status: statusAttr?.value || '',
        voucherTypes: voucherTypesAttr?.value ? voucherTypesAttr.value.split(', ') : [],
      },
      creator: asset.ownership?.owner || '',
      owner: asset.ownership?.owner || '',
      metadata: {
        merchantName: parsedMetadata.merchantName || '',
        merchantAddress: parsedMetadata.merchantAddress || '',
        voucherTypes: parsedMetadata.voucherTypes || [],
      },
      voucherStats: {
        totalVouchersIssued: voucherStats.total_vouchers_issued || 0,
        totalVouchersRedeemed: voucherStats.total_vouchers_redeemed || 0,
        totalValueRedeemed: voucherStats.total_value_redeemed || 0,
      },
    };

    return { success: true, data: voucherDetails };
  } catch (error: any) {
    console.error('Error fetching voucher collection details:', error);
    return { success: false, error: 'Failed to fetch voucher collection details' };
  }
};

