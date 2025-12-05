import { PinataSDK } from 'pinata';

export const pinata = new PinataSDK({
  pinataJwt: `${process.env.PINATA_JWT}`,
  pinataGateway: `${process.env.NEXT_PUBLIC_GATEWAY_URL}`,
});

export const getVerxioConfig = () => {
  const RPC_ENDPOINT = `${process.env.RPC_URL}?api-key=${process.env.HELIUS_API_KEY}`;
  return {
    rpcEndpoint: RPC_ENDPOINT,
    privateKey: process.env.PRIVATE_KEY,
    usdcMint: process.env.USDC_MINT,
    authorizedAddress: process.env.AUTHORIZED_ADDRESS
  };
};

