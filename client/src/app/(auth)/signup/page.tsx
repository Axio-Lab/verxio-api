"use client";

import {  RegisterForm } from "@/app/app-components/auth-components/register-form";

export default function LoginPage() {

    return (
        <div className="flex flex-col items-center justify-center min-h-screen relative">
            <RegisterForm />
        </div>
    );
}