"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin, useMe } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/apiClient";
import { homePathFor } from "@/lib/auth";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi")
    .pipe(z.email({ error: "Format email tidak valid" })),
  password: z.string().min(1, "Password wajib diisi"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const me = useMe();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  // Sudah login: langsung ke halaman yang sesuai.
  useEffect(() => {
    if (me.data) router.replace(homePathFor(me.data));
  }, [me.data, router]);

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: (user) => router.replace(homePathFor(user)),
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Sistem Inventaris Multi Cabang</CardTitle>
        <CardDescription>Masuk dengan akun Anda.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              aria-invalid={errors.email ? true : undefined}
              {...register("email")}
            />
            {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-destructive text-sm">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={login.isPending || Boolean(me.data)}>
            {login.isPending && <Loader2 className="animate-spin" />}
            Masuk
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
