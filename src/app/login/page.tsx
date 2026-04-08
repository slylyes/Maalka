import { LoginForm } from "@/app/login/login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; step?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params.next && params.next.startsWith("/") ? params.next : "/dashboard";
  const initialStep =
    params.step === "otp" ? "otp" : params.step === "reset" ? "reset" : "signin";

  return <LoginForm nextPath={nextPath} initialStep={initialStep} />;
}
