import { AppError } from '../../middleware/errorHandler';

const RPC_ENDPOINT = `${process.env.RPC_URL}?api-key=${process.env.HELIUS_API_KEY}`;

export interface VoucherDetails {
  id: string;
  name: string;
  description: string;
  image: string;
  symbol: string;
  isExpired: boolean;
  canRedeem: boolean;
  attributes: {
    voucherType: string;
    maxUses: string;
    expiryDate: string;
    merchantId: string;
    status: string;
    conditions?: string;
    valueSymbol?: string;
    [key: string]: any;
  };
  creator: string;
  owner: string;
  collectionId: string;
  voucherData: {
    type: string;
    value: number;
    remainingWorth: number;
    status: string;
    maxUses: number;
    issuedAt: number;
    conditions: string[];
    description: string;
    expiryDate: number;
    merchantId: string;
    currentUses: number;
    transferable: boolean;
    redemptionHistory: any[];
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

// Helper function to calculate remaining voucher worth
const calculateRemainingWorth = (originalValue: number, redemptionHistory: any[]): number => {
  const totalRedeemed = redemptionHistory.reduce((sum, redemption) => {
    return sum + (redemption.total_amount || 0);
  }, 0);
  const remainingWorth = Math.max(0, originalValue - totalRedeemed);
  return remainingWorth;
};

export const getVoucherDetails = async (voucherAddress: string): Promise<{
  success: boolean;
  data?: VoucherDetails;
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

    // Add retry logic for rate limiting
    let response;
    let data: RpcResponse | null = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount <= maxRetries) {
      try {
        response = await fetch(url, options);
        data = (await response.json()) as RpcResponse;

        // If we get a 429 (Too Many Requests), wait and retry
        if (response.status === 429 && retryCount < maxRetries) {
          const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          retryCount++;
          continue;
        }

        break; // Success or non-429 error
      } catch (error) {
        if (retryCount < maxRetries) {
          const waitTime = Math.pow(2, retryCount) * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          retryCount++;
          continue;
        }
        throw error; // Final attempt failed
      }
    }

    if (!data) {
      return { success: false, error: 'Failed to fetch voucher details' };
    }

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    const asset = data.result;
    if (!asset) {
      return { success: false, error: 'Voucher not found' };
    }

    // Extract metadata
    const metadata = asset.content?.metadata;
    const attributes = metadata?.attributes || [];

    // Extract attributes from metadata
    const voucherTypeAttr = attributes.find((attr: any) => attr.trait_type === 'Voucher Type');
    const maxUsesAttr = attributes.find((attr: any) => attr.trait_type === 'Max Uses');
    const expiryDateAttr = attributes.find((attr: any) => attr.trait_type === 'Expiry Date');
    const merchantIdAttr = attributes.find((attr: any) => attr.trait_type === 'Merchant ID');
    const statusAttr = attributes.find((attr: any) => attr.trait_type === 'Status');
    const conditionsAttr = attributes.find(
      (attr: any) => attr.trait_type === 'Conditions' || attr.trait_type === 'conditions'
    );
    const assetNameAttr = attributes.find((attr: any) => attr.trait_type === 'Asset Name');
    const assetSymbolAttr = attributes.find((attr: any) => attr.trait_type === 'Asset Symbol');
    const tokenAddressAttr = attributes.find((attr: any) => attr.trait_type === 'Token Address');

    // Extract collection ID from grouping
    const collectionGrouping = asset.grouping?.find((group: any) => group.group_key === 'collection');
    const collectionId = collectionGrouping?.group_value || '';

    // Extract voucher data from external plugins
    const externalPlugins = asset.external_plugins || [];
    const appDataPlugin = externalPlugins.find((plugin: any) => plugin.type === 'AppData');
    const voucherData = appDataPlugin?.data || {
      type: '',
      value: 0,
      status: 'active',
      maxUses: 1,
      issuedAt: 0,
      conditions: [],
      description: '',
      expiryDate: 0,
      merchantId: '',
      currentUses: 0,
      transferable: true,
      redemptionHistory: [],
    };

    // Calculate remaining worth for TOKEN and FIAT vouchers
    const originalValue = voucherData.value || 0;
    const redemptionHistory = voucherData.redemption_history || [];
    const remainingWorth =
      voucherData.type?.toLowerCase() === 'token' || voucherData.type?.toLowerCase() === 'fiat'
        ? calculateRemainingWorth(originalValue, redemptionHistory)
        : originalValue;

    // Calculate if voucher is expired
    const currentTime = Date.now();
    const expiryTimestamp = voucherData.expiry_date || 0;
    const isExpired = expiryTimestamp > 0 && currentTime > expiryTimestamp;

    // Calculate if voucher can be redeemed
    const canRedeem =
      !isExpired &&
      (voucherData.status === 'active' || voucherData.status === 'Active') &&
      (voucherData.current_uses || 0) < (voucherData.max_uses || 1) &&
      remainingWorth > 0;

    // Get symbol from attributes
    const symbol = assetSymbolAttr?.value || 'USDC';

    const voucherDetails: VoucherDetails = {
      id: asset.id,
      name: metadata?.name || 'Unknown Voucher',
      description: metadata?.description || '',
      image: asset.content?.links?.image || '',
      symbol: symbol,
      isExpired: isExpired,
      canRedeem: canRedeem,
      attributes: {
        voucherType: voucherTypeAttr?.value || '',
        maxUses: maxUsesAttr?.value || '1',
        expiryDate: expiryDateAttr?.value || '',
        merchantId: merchantIdAttr?.value || '',
        status: statusAttr?.value || 'Active',
        conditions: conditionsAttr?.value || '',
        valueSymbol: assetSymbolAttr?.value || '',
        'Asset Name': assetNameAttr?.value || '',
        'Asset Symbol': assetSymbolAttr?.value || '',
        'Token Address': tokenAddressAttr?.value || '',
      },
      creator: asset.ownership?.owner || '',
      owner: asset.ownership?.owner || '',
      collectionId: collectionId,
      voucherData: {
        type: voucherData.type || '',
        value: originalValue,
        remainingWorth: remainingWorth,
        status: voucherData.status || 'active',
        maxUses: voucherData.max_uses || 1,
        issuedAt: voucherData.issued_at || 0,
        conditions: voucherData.conditions || [],
        description: voucherData.description || '',
        expiryDate: voucherData.expiry_date || 0,
        merchantId: voucherData.merchant_id || '',
        currentUses: voucherData.current_uses || 0,
        transferable: voucherData.transferable || true,
        redemptionHistory: redemptionHistory,
      },
    };

    return { success: true, data: voucherDetails };
  } catch (error: any) {
    console.error('Error fetching voucher details:', error);
    return { success: false, error: 'Failed to fetch voucher details' };
  }
};

