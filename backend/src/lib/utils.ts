import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey, signerIdentity, keypairIdentity, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Keypair as Web3JsKeypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { VerxioContext } from '@verxioprotocol/core';

export function uint8ArrayToBase58String(uint8Array: Uint8Array): string {
  return bs58.encode(uint8Array);
}

export function convertSecretKeyToKeypair(secretKey: string) {
  try {
    const secretKeyBytes = bs58.decode(secretKey);
    const keypair = Web3JsKeypair.fromSecretKey(secretKeyBytes);
    return fromWeb3JsKeypair(keypair);
  } catch (error) {
    console.error('Error converting secret key:', error);
    throw new Error('Invalid secret key format');
  }
}

export function initializeVerxioContext(
  walletPublicKey: string,
  rpcEndpoint: string,
  privateKey: string,
  collectionAddress?: string
): VerxioContext {
  const umi = createUmi(rpcEndpoint);
  const programAuthority = publicKey(walletPublicKey);
  const keypair = createSignerFromKeypair(umi, convertSecretKeyToKeypair(privateKey));

  umi.use(signerIdentity(keypair));
  umi.use(keypairIdentity(keypair));

  return {
    umi,
    programAuthority,
    collectionAddress: collectionAddress ? publicKey(collectionAddress) : undefined,
  };
}

