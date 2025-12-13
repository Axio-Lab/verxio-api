 "use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

// Only register MWA on the client side (browser), not during SSR
if (typeof window !== 'undefined') {
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
  });
}

export default function Providers({ children }: ProvidersProps) {
    // Create QueryClient inside component to avoid sharing between requests
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000, // 1 minute - data is fresh for 1 min
                refetchOnWindowFocus: false, // Don't refetch on window focus
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
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
        </QueryClientProvider>
    );
} 