"use client";

import { LoginForm } from "@/app/app-components/auth-components/login-form";

export default function LoginPage() {

    return (
        <div className="flex flex-col items-center justify-center min-h-screen relative">
            <LoginForm />
        </div>
    );
}