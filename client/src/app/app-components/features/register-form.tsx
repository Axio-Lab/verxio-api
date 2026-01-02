"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { signUp, signIn } from "@/lib/auth-client"
import { useAuthWithVerxioUser } from "@/hooks/useAuth"
import { useEffect, useState } from "react"
import { Spinner } from "@/components/ui/spinner"

const formSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
});

type FormSchema = z.infer<typeof formSchema>;

export function RegisterForm() {
    const router = useRouter();
    const { isAuthenticated, verxioUser } = useAuthWithVerxioUser();
    const [socialLoading, setSocialLoading] = useState<string | null>(null);

    const form = useForm<FormSchema>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
            confirmPassword: "",
        }
    });

    // Redirect if already authenticated and VerxioUser is created
    useEffect(() => {
        if (isAuthenticated && verxioUser) {
            router.push("/explore");
        }
    }, [isAuthenticated, verxioUser, router]);

    const onSubmit = async (values: FormSchema) => {
        try {
            const result = await signUp.email({
                email: values.email,
                password: values.password,
                name: values.email.split("@")[0], // Use email prefix as name
            });

            // Better Auth returns { data, error } structure
            if (result?.error) {
                toast.error(result.error.message || "Registration failed. Please try again.");
                return;
            }

            toast.success("Account created successfully! Creating your Verxio profile...");
            // The useAuthWithVerxioUser hook will automatically create VerxioUser
            // Redirect will happen via useEffect when verxioUser is created
        } catch (error: any) {
            console.error("Registration error:", error);
            const errorMessage = error?.message || error?.error?.message || "An unexpected error occurred. Please try again.";
            toast.error(errorMessage);
        }
    };

    const handleSocialSignup = async (provider: "google" | "facebook" | "apple") => {
        setSocialLoading(provider);
        try {
            await signIn.social({
                provider,
                callbackURL: "/explore",
            });
        } catch (error) {
            console.error(`${provider} signup error:`, error);
            toast.error(`Failed to sign up with ${provider}. Please try again.`);
            setSocialLoading(null);
        }
    };

    const isPending = form.formState.isSubmitting;

    return (
        <div className="flex flex-col items-center justify-center w-full px-4 py-8">
            <Card className="w-full max-w-md md:max-w-lg lg:max-w-xl">
                <CardHeader className="text-center space-y-2 px-6 pt-8 pb-6 md:px-8 md:pt-10 md:pb-8">
                    <CardTitle className="text-2xl md:text-3xl font-bold">Get Started</CardTitle>
                    <CardDescription className="text-sm md:text-base text-gray-500">Create your account to get started</CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-8 md:px-8 md:pb-10">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
                            <div className="flex flex-col gap-3 md:gap-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full h-11 md:h-12 text-sm md:text-base flex items-center justify-center gap-2"
                                    disabled={isPending || socialLoading !== null}
                                    onClick={() => handleSocialSignup("google")}
                                >
                                    {socialLoading === "google" ? (
                                        <Spinner className="w-5 h-5" />
                                    ) : (
                                        <Image 
                                            src="/logo/google.svg" 
                                            alt="Google" 
                                            width={20} 
                                            height={20}
                                            className="w-5 h-5"
                                        />
                                    )}
                                    Continue with Google
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full h-11 md:h-12 text-sm md:text-base flex items-center justify-center gap-2"
                                    disabled={isPending || socialLoading !== null}
                                    onClick={() => handleSocialSignup("facebook")}
                                >
                                    {socialLoading === "facebook" ? (
                                        <Spinner className="w-5 h-5" />
                                    ) : (
                                        <Image 
                                            src="/logo/facebook.svg" 
                                            alt="Facebook" 
                                            width={20} 
                                            height={20}
                                            className="w-5 h-5"
                                        />
                                    )}
                                    Continue with Facebook
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full h-11 md:h-12 text-sm md:text-base flex items-center justify-center gap-2"
                                    disabled={isPending || socialLoading !== null}
                                    onClick={() => handleSocialSignup("apple")}
                                >
                                    {socialLoading === "apple" ? (
                                        <Spinner className="w-5 h-5" />
                                    ) : (
                                        <Image 
                                            src="/logo/apple.svg" 
                                            alt="Apple" 
                                            width={20} 
                                            height={20}
                                            className="w-5 h-5"
                                        />
                                    )}
                                    Continue with Apple
                                </Button>
                            </div>
                            
                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-2 text-gray-500">Or continue with</span>
                                </div>
                            </div>

                            <div className="space-y-5 md:space-y-6">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel className="text-sm md:text-base">Email</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    type="email" 
                                                    placeholder="user@example.com" 
                                                    className="h-11 md:h-12 text-base"
                                                    {...field} 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel className="text-sm md:text-base">Password</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    type="password" 
                                                    placeholder="********" 
                                                    className="h-11 md:h-12 text-base"
                                                    {...field} 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel className="text-sm md:text-base">Confirm Password</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    type="password" 
                                                    placeholder="********" 
                                                    className="h-11 md:h-12 text-base"
                                                    {...field} 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="relative pt-2">
                                    <Button
                                        type="submit"
                                        className="w-full h-11 md:h-12 text-base md:text-lg font-semibold relative z-10 flex items-center justify-center gap-2"
                                        disabled={isPending || socialLoading !== null}
                                    >
                                        {isPending && <Spinner className="w-5 h-5" />}
                                        {isPending ? "Creating account..." : "Create Account"}
                                    </Button>
                                    {/* Logo icons behind the button */}
                                    <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-10 pointer-events-none z-0">
                                        <Image 
                                            src="/logo/verxioIcon.svg" 
                                            alt="Verxio" 
                                            width={24} 
                                            height={24}
                                            className="w-6 h-6 md:w-8 md:h-8"
                                        />
                                        <Image 
                                            src="/logo/verxioLogo.svg" 
                                            alt="Verxio" 
                                            width={80} 
                                            height={24}
                                            className="h-6 w-auto md:h-8 md:w-auto"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="text-center text-sm md:text-base pt-2">
                                Already have an account?{" "}
                                <Link href="/login" className="underline underline-offset-4 text-primary hover:text-primary/80 font-medium">
                                    Login
                                </Link>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}