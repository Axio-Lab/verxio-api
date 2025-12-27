
import { AppHeader } from "@/app/app-components/app-header";

const RestLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <>
            <AppHeader />
            <main className="flex-1 p-6">
                {children}
            </main>

        </>

    );
};

export default RestLayout;