 "use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { ReactNode } from "react";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { 
    createDefaultAuthorizationCache, 
    createDefaultChainSelector, 
    createDefaultWalletNotFoundHandler,
    registerMwa, 
} from '@solana-mobile/wallet-standard-mobile';

type ProvidersProps = {
  children: ReactNode;
};

registerMwa({
    appIdentity: {
      name: "Verxio's Checkout Gateway",
      uri: 'https://www.verxio.xyz',
        icon: 'favicon.ico', // resolves to https://myapp.io/relative/path/to/icon.png
        },    
    authorizationCache: createDefaultAuthorizationCache(),
    chains: ['solana:mainnet'],
    chainSelector: createDefaultChainSelector(),
    onWalletNotFound: createDefaultWalletNotFoundHandler(),
    // remoteHostAuthority: '<REPLACE_WITH_URL_>', // Include to enable remote connection option.
})

export default function Providers({ children }: ProvidersProps) {
    return (
        <PrivyProvider
            appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
            config={{

                loginMethods: ['google', 'email' ], // Only email and Google
                appearance: {
                    theme: '#ffffff',
                    accentColor: '#000000',
                    showWalletLoginFirst: false,
                    logo: "/logo/verxioLogoMain.svg",
                    walletChainType: "solana-only",
                    walletList: [
                        "detected_solana_wallets",
                    ]
                },
                embeddedWallets: {
                    solana: {
                        createOnLogin: 'users-without-wallets'
                    }
                },
                externalWallets: {
                    solana: {
                        connectors: toSolanaWalletConnectors()
                    }
                }
            }}
        >
            {children}
        </PrivyProvider>
    );
} 