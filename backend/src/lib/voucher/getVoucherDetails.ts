const RPC_ENDPOINT = `${process.env.RPC_URL}?api-key=${process.env.HELIUS_API_KEY}`;

export interface VoucherDetails {
  id: string;
  name: string;
  description: string;
  image: string;
  symbol: string;
  assetName: string;
  assetSymbol: string;
  tokenAddress: string;
  isExpired: boolean;
  canRedeem: boolean;
  creator: string;
  owner: string;
  collectionId: string;
  // Flattened voucherData fields
  type: string;
  value: number;
  remainingWorth: number;
  status: string;
  maxUses: number;
  issuedAt: number;
  conditions: string;
  voucherDescription: string;
  expiryDate: number;
  merchantId: string;
  currentUses: number;
  transferable: boolean;
  redemptionHistory: any[];
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

    // Extract attributes from metadata that are still surfaced
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

    // Calculate remaining worth for all voucher types that have redemption history
    const originalValue = voucherData.value || 0;
    const redemptionHistory = voucherData.redemption_history || [];
    const maxUses = voucherData.max_uses || 1;
    
    // Calculate remaining worth by subtracting total redeemed amounts from original value
    const remainingWorth = redemptionHistory.length > 0
      ? calculateRemainingWorth(originalValue, redemptionHistory)
      : originalValue;

    // Calculate current uses from redemption history (source of truth)
    // Cap it at maxUses to ensure it never exceeds the maximum
    const currentUses = Math.min(redemptionHistory.length, maxUses);

    // Calculate if voucher is expired
    const currentTime = Date.now();
    const expiryTimestamp = voucherData.expiry_date || 0;
    const isExpired = expiryTimestamp > 0 && currentTime > expiryTimestamp;

    // Calculate if voucher can be redeemed
    const canRedeem =
      !isExpired &&
      (voucherData.status === 'active' || voucherData.status === 'Active') &&
      currentUses < maxUses &&
      remainingWorth > 0;

    // Get symbol from attributes
    const symbol = assetSymbolAttr?.value || 'USDC';

    const voucherDetails: VoucherDetails = {
      id: asset.id,
      name: metadata?.name || 'Unknown Voucher',
      description: metadata?.description || '',
      image: asset.content?.links?.image || '',
      symbol: symbol,
      assetName: assetNameAttr?.value || '',
      assetSymbol: assetSymbolAttr?.value || '',
      tokenAddress: tokenAddressAttr?.value || '',
      isExpired: isExpired,
      canRedeem: canRedeem,
      creator: asset.ownership?.owner || '',
      owner: asset.ownership?.owner || '',
      collectionId: collectionId,
      // Flattened voucherData fields
      type: voucherData.type || '',
      value: originalValue,
      remainingWorth: remainingWorth,
      status: voucherData.status || 'active',
      maxUses: maxUses,
      issuedAt: voucherData.issued_at || 0,
      conditions: Array.isArray(voucherData.conditions)
        ? voucherData.conditions
            .map((c: any) => (typeof c === 'string' ? c : c.value || ''))
            .filter(Boolean)
            .join(', ')
        : voucherData.conditions || '',
      voucherDescription: voucherData.description || '',
      expiryDate: voucherData.expiry_date || 0,
      merchantId: voucherData.merchant_id || '',
      currentUses: currentUses, // Use calculated value from redemption history
      transferable: voucherData.transferable || true,
      redemptionHistory: redemptionHistory,
    };

    return { success: true, data: voucherDetails };
  } catch (error: any) {
    console.error('Error fetching voucher details:', error);
    return { success: false, error: 'Failed to fetch voucher details' };
  }
};

